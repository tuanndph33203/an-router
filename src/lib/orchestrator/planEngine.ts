import { z } from "zod";
import { POST as postChatCompletion } from "@/app/api/v1/chat/completions/route";
import { resolveSelfLoopBearer } from "@/shared/middleware/chatAdmissionIdentity";
import { isSubscriptionFetchUrlAllowed } from "@/lib/proxySubscription/fetchGuard";
import {
  formatOperationsForPrompt,
  formatDetailedOperations,
  getSwaggerOperations,
} from "./swaggerParser";
import { AppRegistryConfig, MissingFieldRequirement, ActionPlanStepItem } from "./types";
import { isSqlReportEndpoint } from "./appRegistry";
import {
  loadKnowledgeChunksFromDb,
  buildRuleBookCatalogForLocator,
  assembleSelectedRuleChunks,
} from "./knowledgeRetriever";

export interface PlanOutput {
  thought: string;
  planName: string;
  action?: string;
  endpoint?: string;
  resolvedPayload?: Record<string, any>;
  missingRequiredFields?: MissingFieldRequirement[];
  requiresConfirmation?: boolean;
  directAnswer?: string;
  steps?: ActionPlanStepItem[];
}

const DEFAULT_INTERNAL_MODEL = process.env.INTERNAL_AGENT_MODEL || "gemini-3.8-flash-tiered";

async function fetchSchemaFromBackend(
  schemaUrl: string,
  appId: string,
  mode: "summary" | "detail",
  tables: string[] | undefined,
  userAuthToken: string = ""
): Promise<any> {
  if (!schemaUrl || !isSubscriptionFetchUrlAllowed(schemaUrl, { allowLocal: true })) {
    throw new Error(`URL schema không hợp lệ hoặc bị chặn: ${schemaUrl}`);
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "X-Application-Id": appId,
  };
  const internalKey = process.env.DYNAMIC_REPORT_INTERNAL_KEY;
  if (internalKey) {
    headers["X-Internal-Key"] = internalKey;
  }
  if (userAuthToken) {
    headers["Authorization"] = userAuthToken.startsWith("Bearer ")
      ? userAuthToken
      : `Bearer ${userAuthToken}`;
  }

  let res: Response;
  try {
    res = await fetch(schemaUrl, {
      method: "POST",
      headers,
      body: JSON.stringify({
        applicationId: appId,
        mode,
        tables,
      }),
      signal: AbortSignal.timeout(8000),
    });
  } catch (err: any) {
    throw new Error(`Không thể kết nối đến máy chủ Schema (${schemaUrl}): ${err?.message || err}`);
  }

  if (!res.ok) {
    const errorText = await res.text().catch(() => "");
    throw new Error(
      `Lỗi nạp cấu trúc DB từ ${schemaUrl} (HTTP ${res.status}): ${errorText || res.statusText}`
    );
  }

  const data = await res.json().catch(() => null);
  if (!data) {
    throw new Error(`Dữ liệu schema trả về từ ${schemaUrl} không đúng định dạng JSON.`);
  }
  return data;
}

export async function generateActionPlan(
  appConfig: AppRegistryConfig,
  instruction: string,
  context: Record<string, any> = {},
  userSuppliedInputs: Record<string, any> = {},
  userAuthToken: string = "",
  onProgressStatus?: (msg: string) => void
): Promise<PlanOutput> {
  let apiDetailedPromptSection = "";
  let opsListStr = "Không có OpenAPI schema khả dụng.";
  let selectedApiOpsCount = 0;

  // =========================================================================
  // BƯỚC 1: ĐỊNH VỊ ENDPOINT REST API (OpenAPI Summary Locator)
  // =========================================================================
  if (appConfig.swaggerEndpointUrl) {
    const swaggerOps = await getSwaggerOperations(appConfig.swaggerEndpointUrl, true);
    if (swaggerOps.length > 0) {
      onProgressStatus?.("Đang kiểm tra danh mục API liên quan...");
      const apiSummaryList = swaggerOps
        .map(
          (op, idx) =>
            `[${idx}] [${op.action}] ${op.endpoint} - ${op.summary || op.description || op.operationId}`
        )
        .join("\n");

      const apiLocatorPrompt = `Bạn là bộ định vị API (OpenAPI Locator) cho ứng dụng ${appConfig.name}.
Yêu cầu của người dùng: "${instruction}"
Danh sách các API hiện có trong hệ thống (${swaggerOps.length} endpoints):
${apiSummaryList}

Nhiệm vụ:
- Nếu yêu cầu của người dùng cần gọi REST API (thực hiện nghiệp vụ tạo, sửa, xóa, lấy thông tin theo API), hãy chọn tối đa 3 API phù hợp nhất và trả về mảng JSON chứa các số thứ tự index trong danh sách trên (ví dụ: [0, 4]).
- Nếu câu hỏi chỉ là chào hỏi, hỏi đáp chính sách chung hoặc là báo cáo/tra cứu số liệu DB (không dùng REST API), hãy trả về [].
Chỉ trả về JSON array thuần túy, ví dụ: [0] hoặc []`;

      const apiLocatorRaw = await callInternalLlm([{ role: "user", content: apiLocatorPrompt }]);
      const selectedIndices = parseJsonArrayOfIndices(apiLocatorRaw, swaggerOps.length);

      const selectedOps = selectedIndices.map((i) => swaggerOps[i]);
      selectedApiOpsCount = selectedOps.length;
      if (selectedOps.length > 0) {
        onProgressStatus?.(
          `Đang nạp chi tiết cấu trúc API: ${selectedOps.map((op) => `${op.action} ${op.endpoint}`).join(", ")}...`
        );
        apiDetailedPromptSection = formatDetailedOperations(selectedOps);
        opsListStr = formatOperationsForPrompt(selectedOps);
      } else {
        opsListStr = "Không có REST API nào khớp với yêu cầu này.";
      }
    }
  }

  // =========================================================================
  // TẦNG 1: RULE LUỒNG CỐ ĐỊNH (Đọc từ file .md - LUÔN ĐƯỢC TRUYỀN VÀO PROMPT)
  // =========================================================================
  const coreFlowRules = (appConfig.domainPlaybook || "").trim();

  // =========================================================================
  // BƯỚC 2: LUỒNG SEARCH NGHIỆP VỤ TRONG DB KIẾN THỨC (Knowledge DB Search Locator)
  // Nằm ở giữa OpenAPI Locator và DB Table Locator để:
  // 1) Tải danh mục các mục kiến thức từ bảng SQLite DB (`knowledge_chunks`).
  // 2) Nhận diện tự nhiên nếu chỉ là câu chào hỏi / hội thoại xã giao để phản hồi ngay (không cần gọi DB).
  // 3) Tìm ra đúng các mục kiến thức nghiệp vụ trong DB (`matchedKnowledgeFromDb`) để truyền cùng `coreFlowRules` cho DB Table Locator ở Bước 3 và Planner ở Bước 5.
  // =========================================================================
  const knowledgeAppKey = appConfig.appId || appConfig.microsoftClientKey;
  const knowledgeChunks = loadKnowledgeChunksFromDb(knowledgeAppKey);
  let matchedKnowledgeFromDb = "";

  if (selectedApiOpsCount === 0 && Object.keys(userSuppliedInputs || {}).length === 0) {
    onProgressStatus?.("Đang tra cứu kiến thức nghiệp vụ trong DB...");
    const knowledgeCatalog = buildRuleBookCatalogForLocator(knowledgeChunks);

    const ruleSearchPrompt = `Bạn là bộ định vị Kiến thức Nghiệp vụ trong DB (Knowledge DB Search Locator) cho hệ thống ${appConfig.name}.
Câu của người dùng: "${instruction}"
${coreFlowRules ? `\nRULE LUỒNG CỐ ĐỊNH CỦA HỆ THỐNG:\n${coreFlowRules}\n` : ""}
Danh mục Kho Kiến thức Nghiệp vụ trong DB (${knowledgeChunks.length} mục):
${knowledgeCatalog || "(Kho kiến thức trong DB hiện đang trống)"}

Nhiệm vụ của bạn:
1. Nếu câu của người dùng CHỈ LÀ câu chào hỏi xã giao, cảm ơn, tạm biệt, hoặc hỏi bạn là ai / làm được gì (không yêu cầu tra cứu dữ liệu, không hỏi nghiệp vụ hay thực hiện tác vụ):
   - Đặt "isGreetingOrChat": true
   - Đặt "greetingReply": Câu trả lời chào hỏi ngắn gọn, thân thiện, lịch sự bằng tiếng Việt với vai trò Trợ lý AI của ${appConfig.name}
   - Đặt "ruleIndices": []
2. Nếu câu của người dùng có liên quan đến nghiệp vụ, báo cáo, số liệu, quy trình hoặc tra cứu dữ liệu:
   - Đặt "isGreetingOrChat": false
   - Đặt "ruleIndices": Mảng số thứ tự index của tối đa 4 mục Kiến thức nghiệp vụ trong DB có liên quan nhất tới câu hỏi (nếu Kho kiến thức trong DB có mục phù hợp).

Chỉ trả về DUY NHẤT một chuỗi JSON chuẩn:
{"isGreetingOrChat": false, "ruleIndices": [0, 1, 2], "greetingReply": ""}`;

    const ruleLocatorRaw = await callInternalLlm([{ role: "user", content: ruleSearchPrompt }]);
    const ruleLocatorJsonStr = extractFirstJsonObject(ruleLocatorRaw);
    if (ruleLocatorJsonStr) {
      try {
        const parsedRuleLoc = JSON.parse(ruleLocatorJsonStr);
        if (parsedRuleLoc?.isGreetingOrChat === true) {
          return {
            thought: "Câu chào hỏi hoặc hội thoại chung được nhận diện tại bước Search Nghiệp Vụ.",
            planName: "Phản hồi trực tiếp",
            directAnswer:
              (typeof parsedRuleLoc.greetingReply === "string" &&
                parsedRuleLoc.greetingReply.trim()) ||
              appConfig.welcomeMessage ||
              `Xin chào! Tôi là trợ lý AI của ${appConfig.name}. Tôi có thể giúp bạn tra cứu dữ liệu và lập báo cáo.`,
            steps: [
              {
                stepIndex: 0,
                name: "Phản hồi trực tiếp",
                action: "DIRECT",
                status: "success",
              },
            ],
          };
        }

        if (knowledgeChunks.length > 0) {
          const indices = Array.isArray(parsedRuleLoc?.ruleIndices)
            ? parsedRuleLoc.ruleIndices.filter((n: any) => typeof n === "number")
            : [];
          const assembled = assembleSelectedRuleChunks(knowledgeChunks, indices);
          if (assembled.matchedContent) {
            matchedKnowledgeFromDb = assembled.matchedContent;
          }
        }
      } catch {
        if (knowledgeChunks.length > 0) {
          const fallbackAssembled = assembleSelectedRuleChunks(knowledgeChunks, []);
          if (fallbackAssembled.matchedContent) {
            matchedKnowledgeFromDb = fallbackAssembled.matchedContent;
          }
        }
      }
    } else if (knowledgeChunks.length > 0) {
      const fallbackAssembled = assembleSelectedRuleChunks(knowledgeChunks, []);
      if (fallbackAssembled.matchedContent) {
        matchedKnowledgeFromDb = fallbackAssembled.matchedContent;
      }
    }
  } else if (knowledgeChunks.length > 0) {
    const fallbackAssembled = assembleSelectedRuleChunks(knowledgeChunks, []);
    if (fallbackAssembled.matchedContent) {
      matchedKnowledgeFromDb = fallbackAssembled.matchedContent;
    }
  }

  // Kết hợp Tầng 1 (Rule luồng cố định từ file .md - luôn truyền) + Tầng 2 (Kiến thức nghiệp vụ search từ DB)
  const combinedRulesAndKnowledge = [
    coreFlowRules ? `=== RULE LUỒNG CỐ ĐỊNH (.MD) ===\n${coreFlowRules}` : "",
    matchedKnowledgeFromDb
      ? `=== KIẾN THỨC NGHIỆP VỤ TRA CỨU TỪ DB ===\n${matchedKnowledgeFromDb}`
      : "",
  ]
    .filter(Boolean)
    .join("\n\n");

  // =========================================================================
  // BƯỚC 3: ĐỊNH VỊ BẢNG DỮ LIỆU (DB Table Locator)
  // Nhận trực tiếp Rule Luồng Cố Định + Kiến Thức Nghiệp Vụ từ DB ở Bước 2
  // =========================================================================
  let dbSchemaPromptSection = "";
  const targetAppId = context?.applicationId || context?.dbProfile || "";
  const hasAppIdFromChat = Boolean(targetAppId);
  const supportsSql =
    hasAppIdFromChat &&
    (appConfig.capabilities?.includes("sql") ?? Boolean(appConfig.schemaEndpointUrl)) &&
    Boolean(appConfig.schemaEndpointUrl);

  // Chỉ chạy DB Table Locator khi hỗ trợ SQL và không phải là lệnh gọi REST API thuần túy đã xác định
  const shouldInspectDbSchema =
    supportsSql && Boolean(appConfig.schemaEndpointUrl) && selectedApiOpsCount === 0;

  if (shouldInspectDbSchema && appConfig.schemaEndpointUrl) {
    const summaryData = await fetchSchemaFromBackend(
      appConfig.schemaEndpointUrl,
      targetAppId,
      "summary",
      undefined,
      userAuthToken
    );

    const allTables: string[] = Array.isArray(summaryData?.tables) ? summaryData.tables : [];
    if (allTables.length === 0) {
      throw new Error(
        `Không tìm thấy bảng dữ liệu nào trong cấu hình cơ sở dữ liệu của ứng dụng '${targetAppId}'.`
      );
    }

    onProgressStatus?.("Đang kiểm tra dữ liệu và bảng liên quan...");
    const businessRulesContextBlock = combinedRulesAndKnowledge
      ? `\nRULE LUỒNG CỐ ĐỊNH & KIẾN THỨC NGHIỆP VỤ TỪ DB:\n${combinedRulesAndKnowledge}\n`
      : "";

    const locatorPrompt = `Bạn là bộ định vị bảng dữ liệu (DB Table Locator) cho ứng dụng ${appConfig.name}.
Câu hỏi của người dùng: "${instruction}"
${businessRulesContextBlock}
Danh sách các bảng hiện có trong DB (${allTables.length} bảng):
${allTables.join(", ")}

Nhiệm vụ:
- Dựa vào RULE LUỒNG CỐ ĐỊNH & KIẾN THỨC NGHIỆP VỤ ở trên và danh sách bảng hiện có trong DB, nếu câu hỏi cần tra cứu / tổng hợp số liệu từ DB, hãy trả về mảng JSON chứa tối đa 8 tên bảng liên quan nhất.
- Nếu câu hỏi yêu cầu dữ liệu hoàn toàn không tồn tại trong danh sách bảng DB của hệ thống (ví dụ hỏi nghiệp vụ ngoài phạm vi hệ thống) hoặc không cần truy vấn DB, hãy trả về [].
Chỉ trả về JSON array thuần túy, ví dụ: ["SaleService", "SaleServiceDetail"]`;

    const locatorRaw = await callInternalLlm([{ role: "user", content: locatorPrompt }]);
    const selectedTables = parseJsonArrayOfStrings(locatorRaw, allTables);

    // =========================================================================
    // BƯỚC 4: NẠP CẤU TRÚC BẢNG CHI TIẾT (DB Schema Detail Introspection)
    // =========================================================================
    if (selectedTables.length > 0) {
      onProgressStatus?.(`Đang nạp cấu trúc chi tiết bảng: ${selectedTables.join(", ")}...`);
      const detailData = await fetchSchemaFromBackend(
        appConfig.schemaEndpointUrl,
        targetAppId,
        "detail",
        selectedTables,
        userAuthToken
      );
      if (
        !detailData?.tables ||
        !Array.isArray(detailData.tables) ||
        detailData.tables.length === 0
      ) {
        throw new Error(
          `Không thể lấy cấu trúc chi tiết cho các bảng [${selectedTables.join(", ")}] từ máy chủ DB.`
        );
      }
      const lines = detailData.tables.map(
        (t: any) => `- ${t.table}: ${(t.columns || []).join(", ")}`
      );
      dbSchemaPromptSection = `\nCẤU TRÚC BẢNG CƠ SỞ DỮ LIỆU CHI TIẾT:\n${lines.join("\n")}\n`;
    }
  }

  const hasDetailedDbSchema = Boolean(dbSchemaPromptSection.trim());
  const sqlEndpoint = appConfig.sqlExecuteEndpoint || "/api/ai-report/execute-sql";

  const dbSupportInstruction = !hasAppIdFromChat
    ? `\n⚠️ LƯU Ý VỀ DỮ LIỆU BÁO CÁO:
Phiên chat hiện tại không được cấp quyền tra cứu cơ sở dữ liệu (không có appId).
Vì vậy:
- TUYỆT ĐỐI KHÔNG sinh lệnh gọi API truy vấn SQL (${sqlEndpoint}).
- Nếu người dùng hỏi bất kỳ câu hỏi nào cần tra cứu số liệu, báo cáo, doanh thu, đơn hàng, hóa đơn, tồn kho, v.v.:
  BẠN BẮT BUỘC trả về trực tiếp (directAnswer) ngắn gọn:
  "Rất tiếc, tính năng tra cứu dữ liệu và báo cáo hiện chưa được hỗ trợ."
  (Và đặt "action": null, "endpoint": null).\n`
    : !hasDetailedDbSchema
      ? `\n⚠️ CHỐT CHẶN AN TOÀN SCHEMA (FAIL-FAST):
Hiện tại KHÔNG tìm thấy bảng cơ sở dữ liệu nào khớp với câu hỏi này (không có cấu trúc bảng chi tiết).
- TUYỆT ĐỐI CẤM tự suy đoán tên bảng hay tên cột để sinh truy vấn SQL (${sqlEndpoint}).
- Nếu người dùng đang yêu cầu tra cứu số liệu / báo cáo từ DB, hãy đặt "action": null, "endpoint": null và trả về "directAnswer" thông báo rõ ràng rằng không tìm thấy bảng dữ liệu phù hợp với yêu cầu, đề nghị người dùng nêu rõ hơn nghiệp vụ cần tra cứu.\n`
      : "";

  const enrichedContext = {
    currentTime: new Date().toISOString(),
    ...context,
    ...userSuppliedInputs,
  };

  // =========================================================================
  // BƯỚC 5: LẬP KẾ HOẠCH HÀNH ĐỘNG (Planner)
  // Luôn truyền Rule Luồng Cố Định (.md) + Kiến Thức Nghiệp Vụ từ DB (nếu có)
  // =========================================================================
  const effectivePlaybook = combinedRulesAndKnowledge || "Bạn là trợ lý AI thông minh.";

  const systemPrompt = `${effectivePlaybook}
${dbSupportInstruction}
HỆ THỐNG API KHẢ DỤNG (OpenAPI):
${opsListStr}
${apiDetailedPromptSection}
${dbSchemaPromptSection}
BỐI CẢNH HIỆN TẠI (Context):
${JSON.stringify(enrichedContext, null, 2)}

NHIỆM VỤ CỦA BẠN:
Phân tích yêu cầu của người dùng: "${instruction}"
Và trả về DUY NHẤT một chuỗi JSON chuẩn (không dùng markdown code fence, không kèm lời giải thích bên ngoài):
{
  "thought": "Suy luận phân tích chi tiết ngắn gọn",
  "planName": "Tiêu đề hành động chính bằng tiếng Việt",
  "steps": [
    {
      "stepIndex": 0,
      "name": "Tên bước hành động cụ thể do bạn sinh ra theo ngữ cảnh câu hỏi",
      "action": "GET hoặc POST hoặc PUT hoặc DELETE hoặc SCHEMA hoặc SQL",
      "endpoint": "URL endpoint (nếu có)"
    }
  ],
  "action": "GET hoặc POST hoặc PUT hoặc DELETE (hoặc null nếu chỉ trả lời trò chuyện)",
  "endpoint": "URL endpoint chính xác (ví dụ: /api/v1/tickets hoặc ${sqlEndpoint})",
  "resolvedPayload": { "field": "value" },
  "missingRequiredFields": [
    {
      "fieldName": "tên_trường",
      "fieldLabel": "Tên tiếng Việt hiển thị cho người dùng",
      "fieldType": "string hoặc number hoặc date hoặc select",
      "isRequired": true,
      "options": [{ "label": "Tên", "value": "giá_trị" }]
    }
  ],
  "requiresConfirmation": true/false (true nếu là thao tác POST/PUT/DELETE làm thay đổi dữ liệu nghiệp vụ; true nếu là truy vấn báo cáo ${sqlEndpoint} có phạm vi dữ liệu lớn: không có bộ lọc ngày, hoặc thời gian > 3 tháng, cả năm, từ trước đến nay, toàn bộ lịch sử, hoặc quét chi tiết bảng lớn không có TOP - khi đó đặt directAnswer chứa cảnh báo rõ ràng; false nếu là truy vấn an toàn có giới hạn ngày trong vòng 1 tháng hoặc có TOP <= 100),
  "directAnswer": "Câu trả lời trực tiếp hoặc thông điệp cảnh báo yêu cầu xác nhận khi requiresConfirmation=true"
}

QUY TẮC BƯỚC ĐỘNG (steps):
- Tuyệt đối không fix cứng các bước. Dựa vào yêu cầu cụ thể để sinh từ 1 đến 3 bước động phản ánh đúng lộ trình phân tích và xử lý.
- Nếu người dùng chỉ chào hỏi hoặc hỏi đáp thuần túy: "steps" có 1 bước (ví dụ: "Phản hồi trực tiếp", action: "DIRECT").
- Nếu người dùng yêu cầu tra cứu/báo cáo/thực thi: "steps" mô tả rõ các bước cụ thể theo đúng tên bảng/API đang dùng.

QUY TẮC ĐẶC BIỆT KHI GỌI BÁO CÁO SQL (${sqlEndpoint}):
- "resolvedPayload" cần có cấu trúc:
  {
    "sql": "Câu truy vấn T-SQL chuẩn",
    "summary": "Tóm tắt ngắn gọn báo cáo",
    "chartSpec": { ... } (chỉ tạo khi thỏa mãn quy tắc dưới đây)
  }
- QUY TẮC VỀ BIỂU ĐỒ (chartSpec):
  1. CHỈ SINH "chartSpec" KHI NGƯỜI DÙNG CÓ YÊU CẦU RÕ RÀNG VỀ BIỂU ĐỒ:
     - Ví dụ người dùng yêu cầu: "vẽ biểu đồ", "tạo biểu đồ tròn", "biểu đồ cột", "biểu đồ đường", "tỷ lệ cơ cấu", "vẽ chart", "thể hiện dạng biểu đồ"...
     - Cấu trúc "chartSpec":
       {
         "chartType": "pie | bar | line",
         "title": "Tiêu đề biểu đồ tiếng Việt",
         "categoryColumn": "Tên_cột_nhãn_trục_X_trong_SQL",
         "valueColumns": ["Tên_cột_số_liệu_trục_Y_trong_SQL"]
       }
       + Nếu người dùng yêu cầu biểu đồ tròn hoặc cơ cấu/tỷ lệ: chọn "chartType": "pie".
       + Nếu người dùng yêu cầu biểu đồ cột hoặc so sánh danh mục/doanh thu: chọn "chartType": "bar".
       + Nếu người dùng yêu cầu biểu đồ đường hoặc theo dõi xu hướng theo ngày/tháng/thời gian: chọn "chartType": "line".
  2. KHI NGƯỜI DÙNG KHÔNG YÊU CẦU BIỂU ĐỒ:
     - Ví dụ tra cứu danh sách chi tiết: "cho tôi tất cả các phiếu dịch vụ trong tuần này", "danh sách khách hàng", "xem đơn hàng hôm nay", "tra cứu vật tư"...
     - TUYỆT ĐỐI KHÔNG sinh trường "chartSpec" (hoặc đặt "chartSpec": null) để hệ thống chỉ hiển thị bảng dữ liệu chi tiết, tránh tự tiện vẽ biểu đồ khi người dùng không yêu cầu.`;

  const completion = await callInternalLlm([
    { role: "system", content: systemPrompt },
    { role: "user", content: instruction },
  ]);

  return parsePlanOutput(completion, appConfig, hasDetailedDbSchema);
}

export function buildSafeSynthesisPayload(apiResponseData: any): string {
  if (!apiResponseData || typeof apiResponseData !== "object") {
    return String(apiResponseData ?? "").slice(0, 3500);
  }

  // Nếu là kết quả báo cáo SQL hoặc danh sách dữ liệu từ Backend .NET, trích xuất đầy đủ metadata + tối đa 15 dòng mẫu nguyên vẹn
  const candidateRows =
    apiResponseData.previewData ??
    apiResponseData.PreviewData ??
    apiResponseData.rows ??
    apiResponseData.Rows ??
    apiResponseData.data ??
    apiResponseData.Data;
  if (Array.isArray(candidateRows)) {
    const rows = candidateRows;
    const safeSummaryObj = {
      success: apiResponseData.success ?? apiResponseData.Success ?? true,
      applicationId: apiResponseData.applicationId ?? apiResponseData.ApplicationId,
      summary: apiResponseData.summary ?? apiResponseData.Summary,
      rowCount: apiResponseData.rowCount ?? apiResponseData.RowCount ?? rows.length,
      executionTimeMs: apiResponseData.executionTimeMs ?? apiResponseData.ExecutionTimeMs,
      columns: apiResponseData.columns ?? apiResponseData.Columns,
      sampleRows: rows.slice(0, 15),
      isSampleTruncated: rows.length > 15,
    };
    return JSON.stringify(safeSummaryObj, null, 2);
  }

  const rawJson = JSON.stringify(apiResponseData, null, 2);
  if (rawJson.length <= 4000) return rawJson;
  return rawJson.slice(0, 4000) + "\n... [Dữ liệu đã được rút gọn để tổng hợp]";
}

export async function synthesizeFinalAnswer(
  appConfig: AppRegistryConfig,
  instruction: string,
  action: string,
  endpoint: string,
  apiResponseData: any,
  onDelta?: (delta: string) => void
): Promise<string> {
  const safePayloadStr = buildSafeSynthesisPayload(apiResponseData);

  const prompt = `Bạn là Trợ lý AI của hệ thống ${appConfig.name}.
Người dùng đã yêu cầu: "${instruction}"
Hệ thống vừa thực thi API [${action}] ${endpoint} thành công.
Dữ liệu kết quả từ Backend:
${safePayloadStr}

Hãy viết câu trả lời bằng tiếng Việt tự nhiên, súc tích, đi thẳng vào số liệu phân tích:
- Tóm tắt kết quả chính (tổng tiền, tổng số dòng rowCount, các con số đáng chú ý, nhận xét súc tích nếu có).
- QUY TẮC BẮT BUỘC: 
  * TUYỆT ĐỐI KHÔNG viết các câu rườm rà mô tả giao diện hay nhắc nhở về biểu đồ/bảng/nút tải Excel bên dưới (ví dụ: TUYỆT ĐỐI KHÔNG viết "Biểu đồ trực quan cùng bảng số liệu...", "đã được hiển thị ngay bên dưới để bạn tiện theo dõi...", "Nếu bạn cần phân tích thêm..."). Giao diện đã tự hiển thị các thành phần này.
  * TUYỆT ĐỐI KHÔNG vẽ lại bảng Markdown (| cột 1 | cột 2 |) trong văn bản để tránh bị trùng lặp 2 bảng.`;

  if (onDelta) {
    const streamedAnswer = await callInternalLlmStream(
      [{ role: "user", content: prompt }],
      DEFAULT_INTERNAL_MODEL,
      onDelta
    );
    if (streamedAnswer) return streamedAnswer;
  }

  const answer = await callInternalLlm([{ role: "user", content: prompt }]);

  return answer || "Tác vụ đã được thực hiện thành công.";
}

async function callInternalLlmStream(
  messages: Array<{ role: string; content: string }>,
  model: string = DEFAULT_INTERNAL_MODEL,
  onDelta: (delta: string) => void
): Promise<string> {
  try {
    const bearer = resolveSelfLoopBearer();
    const headers = new Headers({
      "Content-Type": "application/json",
      Authorization: `Bearer ${bearer}`,
    });

    const req = new Request("http://localhost/api/v1/chat/completions", {
      method: "POST",
      headers,
      body: JSON.stringify({
        model,
        messages,
        stream: true,
        temperature: 0.2,
        reasoning_effort: "low",
      }),
    });

    const res = await postChatCompletion(req);
    if (!res.ok || !res.body) {
      return "";
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder("utf-8");
    let fullText = "";
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith("data: ")) continue;
        const dataStr = trimmed.substring(6).trim();
        if (dataStr === "[DONE]") continue;

        try {
          const parsed = JSON.parse(dataStr);
          const deltaContent = parsed.choices?.[0]?.delta?.content || "";
          if (deltaContent) {
            fullText += deltaContent;
            onDelta(deltaContent);
          }
        } catch {}
      }
    }

    return fullText;
  } catch (err: any) {
    console.error("[PlanEngine] Error in callInternalLlmStream:", err?.message || err);
    return "";
  }
}

async function callInternalLlm(
  messages: Array<{ role: string; content: string }>,
  model: string = DEFAULT_INTERNAL_MODEL
): Promise<string> {
  try {
    const bearer = resolveSelfLoopBearer();
    const headers = new Headers({
      "Content-Type": "application/json",
      Authorization: `Bearer ${bearer}`,
    });

    const req = new Request("http://localhost/api/v1/chat/completions", {
      method: "POST",
      headers,
      body: JSON.stringify({
        model,
        messages,
        stream: false,
        temperature: 0.2,
        reasoning_effort: "low",
      }),
    });

    const res = await postChatCompletion(req);
    if (!res.ok) {
      const errText = await res.text();
      console.warn("[PlanEngine] Internal LLM call failed:", res.status, errText);
      return "";
    }

    const json = await res.json();
    return json.choices?.[0]?.message?.content || "";
  } catch (err: any) {
    console.error("[PlanEngine] Error in callInternalLlm:", err?.message || err);
    return "";
  }
}

export function extractFirstJsonArray(rawText: string): string | null {
  const startIdx = rawText.indexOf("[");
  if (startIdx === -1) return null;

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = startIdx; i < rawText.length; i++) {
    const ch = rawText[i];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (ch === "\\") {
      escaped = true;
      continue;
    }
    if (ch === '"') {
      inString = !inString;
      continue;
    }
    if (!inString) {
      if (ch === "[") depth++;
      else if (ch === "]") {
        depth--;
        if (depth === 0) {
          return rawText.slice(startIdx, i + 1);
        }
      }
    }
  }
  return null;
}

function stripCodeFences(rawText: string): string {
  return rawText.split("```json").join("").split("```").join("").trim();
}

function parseLeadingInteger(str: string): number {
  let digits = "";
  for (let i = 0; i < str.length; i++) {
    const code = str.charCodeAt(i);
    if (code >= 48 && code <= 57) {
      digits += str[i];
    } else if (digits.length > 0) {
      break;
    }
  }
  return digits.length > 0 ? parseInt(digits, 10) : -1;
}

function parseJsonArrayOfIndices(rawText: string, maxLen: number): number[] {
  if (!rawText) return [];
  try {
    const jsonCandidate = extractFirstJsonArray(rawText) || stripCodeFences(rawText);
    const parsed = JSON.parse(jsonCandidate);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((item) => {
        if (typeof item === "number") return item;
        if (typeof item === "string") {
          return parseLeadingInteger(item);
        }
        return -1;
      })
      .filter((idx) => idx >= 0 && idx < maxLen);
  } catch (err: any) {
    console.warn(
      "[PlanEngine] Failed to parse API locator indices:",
      err?.message || rawText.slice(0, 120)
    );
    return [];
  }
}

function parseJsonArrayOfStrings(rawText: string, validTables: string[]): string[] {
  if (!rawText) return [];
  const validMap = new Map(validTables.map((t) => [t.toLowerCase(), t]));
  try {
    const jsonCandidate = extractFirstJsonArray(rawText) || stripCodeFences(rawText);
    const parsed = JSON.parse(jsonCandidate);
    if (!Array.isArray(parsed)) return [];
    const resolved: string[] = [];
    for (const item of parsed) {
      if (typeof item === "string") {
        const canonical = validMap.get(item.trim().toLowerCase());
        if (canonical && !resolved.includes(canonical)) {
          resolved.push(canonical);
        }
      }
    }
    return resolved;
  } catch (err: any) {
    console.warn(
      "[PlanEngine] Failed to parse Table locator output:",
      err?.message || rawText.slice(0, 120)
    );
    return [];
  }
}

export function extractFirstJsonObject(rawText: string): string | null {
  const startIdx = rawText.indexOf("{");
  if (startIdx === -1) return null;

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = startIdx; i < rawText.length; i++) {
    const ch = rawText[i];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (ch === "\\") {
      escaped = true;
      continue;
    }
    if (ch === '"') {
      inString = !inString;
      continue;
    }
    if (!inString) {
      if (ch === "{") depth++;
      else if (ch === "}") {
        depth--;
        if (depth === 0) {
          return rawText.slice(startIdx, i + 1);
        }
      }
    }
  }
  return null;
}

const RawPlanZodSchema = z.object({
  thought: z.string().nullish(),
  planName: z.string().nullish(),
  steps: z.array(z.any()).nullish(),
  action: z.string().nullish(),
  endpoint: z.string().nullish(),
  resolvedPayload: z.record(z.string(), z.any()).nullish(),
  missingRequiredFields: z.array(z.any()).nullish(),
  requiresConfirmation: z.boolean().nullish(),
  directAnswer: z.string().nullish(),
});

function normalizeSqlTokens(sql: string): string {
  const tokens: string[] = [];
  let cur = "";
  for (let i = 0; i < sql.length; i++) {
    const c = sql.charCodeAt(i);
    if (c === 32 || c === 9 || c === 10 || c === 13) {
      if (cur.length > 0) {
        tokens.push(cur);
        cur = "";
      }
    } else {
      cur += sql[i];
    }
  }
  if (cur.length > 0) tokens.push(cur);
  return ` ${tokens.join(" ").toUpperCase()} `;
}

function isTautologyClause(clause: string): boolean {
  const compact = clause.split(" ").join("").trim();
  if (!compact) return true;
  const eqIdx = compact.indexOf("=");
  if (eqIdx === -1) return false;
  const left = compact.slice(0, eqIdx).trim();
  const right = compact.slice(eqIdx + 1).trim();
  return left.length > 0 && left === right;
}

export function hasMeaningfulSqlFilterOrLimit(sql: string): boolean {
  if (!sql) return false;
  const norm = normalizeSqlTokens(sql);

  // Kiểm tra giới hạn số dòng qua TOP <số> hoặc OFFSET <số> ROWS
  const topIdx = norm.indexOf(" TOP ");
  if (topIdx !== -1) {
    const afterTop = norm.slice(topIdx + 5).trim();
    if (parseLeadingInteger(afterTop) > 0) return true;
  }
  const offsetIdx = norm.indexOf(" OFFSET ");
  if (offsetIdx !== -1 && norm.includes(" ROWS ")) {
    const afterOffset = norm.slice(offsetIdx + 8).trim();
    if (parseLeadingInteger(afterOffset) >= 0) return true;
  }

  const whereIdx = norm.indexOf(" WHERE ");
  if (whereIdx === -1) return false;

  let whereBody = norm.slice(whereIdx + 7);
  for (const stopper of [" GROUP BY ", " ORDER BY ", " HAVING ", " OFFSET ", ";"]) {
    const stopPos = whereBody.indexOf(stopper);
    if (stopPos !== -1) {
      whereBody = whereBody.slice(0, stopPos);
    }
  }

  const conditions = whereBody
    .split(" AND ")
    .flatMap((part) => part.split(" OR "))
    .map((c) => c.trim())
    .filter((c) => c.length > 0 && !isTautologyClause(c));

  if (conditions.length === 0) return false;

  const validOperators = [
    "=",
    "<>",
    "!=",
    ">=",
    "<=",
    ">",
    "<",
    " IN ",
    " LIKE ",
    " BETWEEN ",
    " IS ",
  ];
  return conditions.some((cond) => validOperators.some((op) => ` ${cond} `.includes(op)));
}

function extractUrlPathParameters(endpoint: string): string[] {
  const cleanPath = endpoint.split("?")[0];
  const segments = cleanPath.split("/");
  const params: string[] = [];
  for (const seg of segments) {
    const trimmed = seg.trim();
    if (trimmed.startsWith("{") && trimmed.endsWith("}") && trimmed.length > 2) {
      params.push(trimmed.slice(1, -1).trim());
    } else if (trimmed.startsWith(":") && trimmed.length > 1) {
      params.push(trimmed.slice(1).trim());
    }
  }
  return params;
}

export function parsePlanOutput(
  rawText: string,
  appConfig?: AppRegistryConfig,
  hasDetailedDbSchema: boolean = true
): PlanOutput {
  if (!rawText || !rawText.trim()) {
    return {
      thought: "Không nhận được phản hồi từ AI",
      planName: "Không xác định",
      directAnswer:
        "Xin lỗi, hiện tại hệ thống AI chưa thể phản hồi yêu cầu này. Vui lòng thử lại.",
      steps: [
        {
          stepIndex: 0,
          name: "Phản hồi hệ thống",
          action: "DIRECT",
          status: "error",
        },
      ],
    };
  }

  const extractedJson = extractFirstJsonObject(rawText.trim());
  const candidate = extractedJson || stripCodeFences(rawText);

  try {
    const rawParsed = JSON.parse(candidate);
    const validated = RawPlanZodSchema.safeParse(rawParsed);
    const parsed = validated.success ? validated.data : rawParsed;

    let parsedSteps: ActionPlanStepItem[] = [];
    if (Array.isArray(parsed.steps) && parsed.steps.length > 0) {
      parsedSteps = parsed.steps.map((s: any, idx: number) => ({
        stepIndex: typeof s.stepIndex === "number" ? s.stepIndex : idx,
        name: s.name || s.stepName || `Bước ${idx + 1}`,
        action: s.action || undefined,
        endpoint: s.endpoint || undefined,
        status: "pending" as const,
      }));
    } else if (parsed.planName) {
      parsedSteps = [
        {
          stepIndex: 0,
          name: parsed.planName,
          action: parsed.action || (parsed.directAnswer ? "DIRECT" : "API"),
          endpoint: parsed.endpoint || undefined,
          status: "pending" as const,
        },
      ];
    }

    let action = parsed.action ? String(parsed.action).toUpperCase() : undefined;
    if (action === "NULL" || action === "NONE" || action === "DIRECT") {
      action = undefined;
    }
    let endpoint = parsed.endpoint || undefined;
    if (endpoint === "null" || endpoint === "none") {
      endpoint = undefined;
    }

    const isReportSql = endpoint ? isSqlReportEndpoint(endpoint, appConfig) : false;

    // 0. Chốt chặn P0: Cấm tuyệt đối việc thực thi SQL khi không có Schema bảng chi tiết (Fail-Fast)
    if (isReportSql && !hasDetailedDbSchema) {
      console.warn(
        "[PlanEngine] Blocked hallucinated SQL execution because no DB schema was resolved for this query."
      );
      return {
        thought:
          (parsed.thought || "") +
          " [Đã chặn tự động: Không có Schema bảng chi tiết nên không cho phép đoán SQL]",
        planName: "Yêu cầu làm rõ dữ liệu",
        action: undefined,
        endpoint: undefined,
        resolvedPayload: {},
        missingRequiredFields: [],
        requiresConfirmation: false,
        directAnswer:
          parsed.directAnswer ||
          "Không tìm thấy bảng dữ liệu phù hợp trong hệ thống cho câu hỏi này. Để đảm bảo số liệu chính xác tuyệt đối, hệ thống không tự ý suy đoán câu lệnh truy vấn. Vui lòng mô tả rõ hơn nghiệp vụ hoặc danh mục bạn muốn tra cứu.",
        steps: [
          {
            stepIndex: 0,
            name: "Kiểm tra cấu trúc dữ liệu (Schema Guard)",
            action: "DIRECT",
            status: "error",
          },
        ],
      };
    }

    // 1. Quy tắc phê duyệt xác định (Deterministic Consequential Action):
    let requiresConfirmation = Boolean(parsed.requiresConfirmation);
    if (action && ["POST", "PUT", "DELETE", "PATCH"].includes(action)) {
      if (!isReportSql) {
        // Mọi hành động thay đổi dữ liệu nghiệp vụ (POST/PUT/DELETE) BẮT BUỘC cần xác nhận
        requiresConfirmation = true;
      } else {
        // Đối với truy vấn SQL: kiểm tra có bộ lọc thực chất (loại trừ WHERE 1=1) hoặc giới hạn TOP
        const sql = String(parsed.resolvedPayload?.sql || parsed.resolvedPayload?.sqlQuery || "");
        if (sql && !hasMeaningfulSqlFilterOrLimit(sql)) {
          requiresConfirmation = true;
        }
      }
    }

    // 2. Pre-flight URL parameter check: Tự động phát hiện tham số {param} hoặc :param chưa được điền
    const missingFields: MissingFieldRequirement[] = Array.isArray(parsed.missingRequiredFields)
      ? [...parsed.missingRequiredFields]
      : [];

    if (endpoint) {
      const pathParams = extractUrlPathParameters(endpoint);
      if (pathParams.length > 0) {
        const payloadKeys = Object.keys(parsed.resolvedPayload || {});
        for (const paramName of pathParams) {
          if (!payloadKeys.includes(paramName) && !parsed.resolvedPayload?.[paramName]) {
            if (!missingFields.some((f) => (f.fieldName || f.field_name) === paramName)) {
              missingFields.push({
                fieldName: paramName,
                fieldLabel: `Tham số ${paramName}`,
                fieldType: "text",
                isRequired: true,
              });
            }
          }
        }
      }
    }

    return {
      thought: parsed.thought || "",
      planName: parsed.planName || "Thực thi tác vụ",
      action,
      endpoint,
      resolvedPayload: parsed.resolvedPayload || {},
      missingRequiredFields: missingFields,
      requiresConfirmation,
      directAnswer: parsed.directAnswer || undefined,
      steps: parsedSteps,
    };
  } catch (err: any) {
    console.warn("[PlanEngine] Failed to parse PlanOutput JSON:", err?.message);
    // Chặn tuyệt đối việc lộ chuỗi JSON thô bị cắt cụt lên giao diện người dùng
    const looksLikeBrokenJson =
      rawText.includes('"planName"') ||
      rawText.includes('"resolvedPayload"') ||
      rawText.includes('"thought"') ||
      rawText.trim().startsWith("{");

    return {
      thought: "Không parse được JSON từ AI",
      planName: "Phản hồi thông tin",
      directAnswer: looksLikeBrokenJson
        ? "Hệ thống gặp sự cố định dạng khi lập kế hoạch xử lý yêu cầu này. Vui lòng thử diễn đạt lại câu hỏi cụ thể hơn."
        : rawText.trim(),
      steps: [
        {
          stepIndex: 0,
          name: "Phản hồi trực tiếp",
          action: "DIRECT",
          status: looksLikeBrokenJson ? "error" : "pending",
        },
      ],
    };
  }
}
