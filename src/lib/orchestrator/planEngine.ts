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
  searchKnowledgeBase,
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

interface SchemaCacheEntry {
  data: any;
  timestamp: number;
}
const schemaCache = new Map<string, SchemaCacheEntry>();
const SCHEMA_CACHE_TTL_MS = 5 * 60 * 1000; // 5 phút

async function fetchSchemaFromBackend(
  schemaUrl: string,
  appId: string,
  mode: "summary" | "detail",
  tables: string[] | undefined,
  userAuthToken: string = ""
): Promise<any> {
  const sortedTablesKey = tables ? [...tables].sort().join(",") : "*";
  const cacheKey = `${schemaUrl}:${appId}:${mode}:${sortedTablesKey}`;
  const cached = schemaCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < SCHEMA_CACHE_TTL_MS) {
    return cached.data;
  }

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
  schemaCache.set(cacheKey, { data, timestamp: Date.now() });
  return data;
}

export async function callInternalLlmWithTools(
  messages: Array<any>,
  tools: any[],
  toolChoice?: any,
  model: string = DEFAULT_INTERNAL_MODEL
): Promise<{
  content: string | null;
  toolCalls?: Array<{
    id: string;
    type: "function";
    function: { name: string; arguments: string };
  }>;
}> {
  try {
    const bearer = resolveSelfLoopBearer();
    const headers = new Headers({
      "Content-Type": "application/json",
      Authorization: `Bearer ${bearer}`,
    });

    const bodyObj: any = {
      model,
      messages,
      stream: false,
      temperature: 0.1,
      reasoning_effort: "low",
    };
    if (tools && tools.length > 0) {
      bodyObj.tools = tools;
    }
    if (toolChoice) {
      bodyObj.tool_choice = toolChoice;
    }

    const req = new Request("http://localhost/api/v1/chat/completions", {
      method: "POST",
      headers,
      body: JSON.stringify(bodyObj),
    });

    const res = await postChatCompletion(req);
    if (!res.ok) {
      const errText = await res.text();
      console.warn("[PlanEngine] Internal LLM with tools failed:", res.status, errText);
      return { content: null };
    }

    const json = await res.json();
    const choice = json.choices?.[0]?.message;
    return {
      content: choice?.content || null,
      toolCalls: choice?.tool_calls || undefined,
    };
  } catch (err: any) {
    console.error("[PlanEngine] Error in callInternalLlmWithTools:", err?.message || err);
    return { content: null };
  }
}

export async function generateActionPlan(
  appConfig: AppRegistryConfig,
  instruction: string,
  context: Record<string, any> = {},
  userSuppliedInputs: Record<string, any> = {},
  userAuthToken: string = "",
  onProgressStatus?: (msg: string) => void
): Promise<PlanOutput> {
  const targetAppId = context?.applicationId || context?.dbProfile || "";
  const hasAppIdFromChat = Boolean(targetAppId);
  const supportsSql =
    hasAppIdFromChat &&
    (appConfig.capabilities?.includes("sql") ?? Boolean(appConfig.schemaEndpointUrl)) &&
    Boolean(appConfig.schemaEndpointUrl);
  const sqlEndpoint = appConfig.sqlExecuteEndpoint || "/api/ai-report/execute-sql";

  // Layer 1: Rule Luồng Cố Định (.md)
  const coreFlowRules = (appConfig.domainPlaybook || "").trim();
  const knowledgeAppKey = appConfig.appId || appConfig.microsoftClientKey;

  // Danh sách công cụ (Tools) cung cấp cho AI
  const tools: any[] = [];

  // Tool 1: search_knowledge (Multi-Search FTS5 + Semantic + RRF + Cross-Encoder Reranker)
  tools.push({
    type: "function",
    function: {
      name: "search_knowledge",
      description:
        "Tra cứu cơ sở tri thức nghiệp vụ, quy tắc tính toán, tài liệu hoặc chính sách từ CSDL tri thức. Sử dụng Multi-Search (FTS5 + Semantic) kết hợp Cross-Encoder Reranker để lấy top các đoạn thông tin chính xác nhất. Gọi khi cần biết quy tắc nghiệp vụ, công thức tính tiền/chiết khấu, hoặc chính sách hoàn huỷ.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Từ khóa hoặc câu hỏi cần tra cứu kiến thức" },
          topK: { type: "number", description: "Số lượng đoạn kiến thức cần lấy (mặc định 3)" },
        },
        required: ["query"],
      },
    },
  });

  // Tool 2 & 3: DB Schema tools (nếu hỗ trợ SQL)
  if (supportsSql && appConfig.schemaEndpointUrl) {
    tools.push({
      type: "function",
      function: {
        name: "list_tables",
        description:
          "Liệt kê danh sách tên bảng trong CSDL của hệ thống. Dùng khi người dùng yêu cầu lập báo cáo hoặc tra cứu dữ liệu số liệu thực tế.",
        parameters: {
          type: "object",
          properties: {
            keyword: { type: "string", description: "Từ khóa tùy chọn để lọc danh sách tên bảng" },
          },
        },
      },
    });

    tools.push({
      type: "function",
      function: {
        name: "describe_tables",
        description:
          "Lấy cấu trúc chi tiết các cột, kiểu dữ liệu, khóa chính/ngoại của tối đa 6 bảng CSDL. Bắt buộc phải gọi xem cấu trúc trước khi sinh SQL.",
        parameters: {
          type: "object",
          properties: {
            tables: {
              type: "array",
              items: { type: "string" },
              description: "Danh sách tên bảng cần xem cấu trúc chi tiết",
            },
          },
          required: ["tables"],
        },
      },
    });
  }

  // Tool 4 & 5: OpenAPI tools (nếu có swagger)
  let cachedSwaggerOps: any[] | null = null;
  if (appConfig.swaggerEndpointUrl) {
    tools.push({
      type: "function",
      function: {
        name: "search_api",
        description:
          "Tìm kiếm các REST API endpoint hiện có trong hệ thống theo chức năng cần thực hiện.",
        parameters: {
          type: "object",
          properties: {
            query: { type: "string", description: "Từ khóa tìm kiếm API nghiệp vụ" },
          },
          required: ["query"],
        },
      },
    });

    tools.push({
      type: "function",
      function: {
        name: "describe_api",
        description:
          "Lấy cấu trúc chi tiết request/response của các REST API endpoint được chỉ định.",
        parameters: {
          type: "object",
          properties: {
            indices: {
              type: "array",
              items: { type: "number" },
              description: "Danh sách chỉ số index của endpoint cần xem chi tiết",
            },
          },
          required: ["indices"],
        },
      },
    });
  }

  // Tool 6: submit_plan (terminal tool)
  tools.push({
    type: "function",
    function: {
      name: "submit_plan",
      description:
        "Hoàn tất kế hoạch xử lý và trả kết quả cho người dùng. Bắt buộc gọi hàm này khi: (1) Trả lời câu chào hỏi hoặc giải đáp kiến thức trực tiếp (action='direct_answer'), hoặc (2) Đã có đủ bảng và cấu trúc để sinh câu lệnh SQL (action='report_sql'), hoặc (3) Thực thi API nghiệp vụ (action='GET'|'POST'|'PUT'|'DELETE').",
      parameters: {
        type: "object",
        properties: {
          thought: { type: "string", description: "Suy nghĩ phân tích lý do chọn hành động này" },
          planName: { type: "string", description: "Tên ngắn gọn của hành động" },
          action: {
            type: "string",
            enum: ["direct_answer", "report_sql", "GET", "POST", "PUT", "DELETE"],
          },
          endpoint: { type: "string", description: `Endpoint URL (ví dụ: '${sqlEndpoint}' khi là report_sql)` },
          resolvedPayload: {
            type: "object",
            description:
              "Payload truyền vào API hoặc { sql, summary, chartSpec } nếu action là report_sql",
          },
          directAnswer: {
            type: "string",
            description:
              "Nội dung câu trả lời trực tiếp cho người dùng nếu action là direct_answer",
          },
          requiresConfirmation: {
            type: "boolean",
            description: "true nếu cần người dùng bấm xác nhận trước khi thực thi",
          },
          confirmationMessage: { type: "string", description: "Thông điệp hiển thị khi yêu cầu xác nhận" },
          missingRequiredFields: {
            type: "array",
            items: {
              type: "object",
              properties: {
                fieldName: { type: "string" },
                label: { type: "string" },
                type: { type: "string" },
                description: { type: "string" },
              },
              required: ["fieldName", "label"],
            },
          },
        },
        required: ["thought", "planName", "action"],
      },
    },
  });

  // System Prompt với Tầng 1: Rule Luồng Cố Định (.md)
  const systemPrompt = `Bạn là Trợ lý AI Orchestrator chuyên nghiệp của ứng dụng ${appConfig.name}.
Mô tả ứng dụng: ${appConfig.description || "Hệ thống hỗ trợ quản trị và báo cáo doanh nghiệp"}.
Ngữ cảnh người dùng:
- Application ID: "${targetAppId || "Không có (chế độ hỏi đáp chung)"}"
- Chi nhánh (BranchCode): "${context?.branchCode || context?.userBranch || "Tất cả"}"
${Object.keys(userSuppliedInputs || {}).length > 0 ? `- Tham số người dùng đã cung cấp: ${JSON.stringify(userSuppliedInputs)}` : ""}

=== TẦNG 1: RULE LUỒNG CỐ ĐỊNH (.MD) ===
${coreFlowRules || "Không có quy tắc luồng cố định."}

=== NGUYÊN TẮC HÀNH ĐỘNG AGENTIC ===
Bạn có các công cụ được cung cấp và BẮT BUỘC tuân thủ các quy tắc sau:
1. NẾU NGƯỜI DÙNG CHÀO HỎI / GIAO TIẾP XÃ GIAO:
   - Gọi ngay \`submit_plan\` ở lượt đầu tiên với \`action: "direct_answer"\` và câu chào mừng lịch sự, thân thiện.
   - Tuyệt đối KHÔNG gọi công cụ tra cứu kiến thức hay cơ sở dữ liệu.
2. NẾU NGƯỜI DÙNG HỎI VỀ KIẾN THỨC NGHIỆP VỤ / QUY TẮC / CÔNG THỨC / CHÍNH SÁCH:
   - Gọi công cụ \`search_knowledge\` với từ khóa phù hợp để lấy kiến thức từ DB (Multi-Search + Reranker).
   - Sau khi nhận được kết quả tri thức ở lượt tiếp theo, hãy tổng hợp câu trả lời đầy đủ, chính xác và gọi \`submit_plan\` với \`action: "direct_answer"\`.
3. NẾU NGƯỜI DÙNG YÊU CẦU BÁO CÁO HOẶC TRA CỨU SỐ LIỆU CSDL:
   - Bước 1: Gọi \`list_tables\` để xem danh sách bảng có trong hệ thống.
   - Bước 2: Gọi \`describe_tables\` để nạp cấu trúc chi tiết các cột cần truy vấn (tối đa 6 bảng liên quan).
   - Bước 3: Sau khi đã nắm rõ cấu trúc bảng và kiểu dữ liệu, gọi \`submit_plan\` với:
     * \`action\`: "report_sql"
     * \`endpoint\`: "${sqlEndpoint}"
     * \`resolvedPayload\`:
       {
         "sql": "Câu lệnh SELECT T-SQL an toàn, chính xác",
         "summary": "Tóm tắt ngắn gọn báo cáo",
         "chartSpec": { ... } (chỉ tạo khi người dùng có yêu cầu rõ ràng về vẽ biểu đồ tròn/cột/đường, nếu không thì null)
       }
   - QUY TẮC SQL AN TOÀN:
     * Chỉ dùng SELECT, tuyệt đối không INSERT, UPDATE, DELETE, DROP, ALTER, EXEC.
     * Luôn tự động bổ sung điều kiện lọc theo chi nhánh nếu người dùng thuộc chi nhánh cụ thể.
4. NẾU NGƯỜI DÙNG YÊU CẦU THỰC HIỆN NGHIỆP VỤ REST API:
   - Dùng \`search_api\` và \`describe_api\` để tìm endpoint và schema payload phù hợp, sau đó gọi \`submit_plan\`.`;

  const messages: any[] = [
    { role: "system", content: systemPrompt },
    { role: "user", content: instruction },
  ];

  let turn = 0;
  const maxTurns = 4;
  const executionSteps: ActionPlanStepItem[] = [];

  while (turn < maxTurns) {
    turn++;

    const isLastTurn = turn === maxTurns;
    const toolChoice = isLastTurn
      ? { type: "function", function: { name: "submit_plan" } }
      : undefined;

    const response = await callInternalLlmWithTools(messages, tools, toolChoice);

    if (response.toolCalls && response.toolCalls.length > 0) {
      messages.push({
        role: "assistant",
        content: response.content || null,
        tool_calls: response.toolCalls,
      });

      let submittedPlan: PlanOutput | null = null;

      for (const call of response.toolCalls) {
        const fnName = call.function.name;
        let args: any = {};
        try {
          args = JSON.parse(call.function.arguments);
        } catch {
          args = {};
        }

        if (fnName === "submit_plan") {
          submittedPlan = {
            thought: args.thought || "Đã phân tích yêu cầu",
            planName: args.planName || "Kế hoạch xử lý",
            action: args.action || "direct_answer",
            endpoint: args.endpoint || (args.action === "report_sql" ? sqlEndpoint : undefined),
            resolvedPayload: args.resolvedPayload,
            directAnswer: args.directAnswer,
            requiresConfirmation: Boolean(args.requiresConfirmation),
            confirmationMessage: args.confirmationMessage,
            missingRequiredFields: Array.isArray(args.missingRequiredFields)
              ? args.missingRequiredFields
              : undefined,
          };
          break;
        }

        let toolResultStr = "";
        if (fnName === "search_knowledge") {
          onProgressStatus?.(`Đang tra cứu cơ sở tri thức: "${args.query || instruction}"...`);
          const searchRes = await searchKnowledgeBase(knowledgeAppKey, args.query || instruction, {
            topK: typeof args.topK === "number" ? args.topK : 3,
          });
          toolResultStr = searchRes.matchedContent || "Không tìm thấy đoạn kiến thức phù hợp trong DB.";
          executionSteps.push({
            stepIndex: executionSteps.length,
            name: `Tra cứu tri thức: ${args.query || instruction}`,
            action: "KNOWLEDGE",
            status: "success",
          });
        } else if (fnName === "list_tables") {
          onProgressStatus?.("Đang kiểm tra danh mục bảng CSDL...");
          try {
            const summaryData = await fetchSchemaFromBackend(
              appConfig.schemaEndpointUrl!,
              targetAppId,
              "summary",
              undefined,
              userAuthToken
            );
            const allTables: string[] = Array.isArray(summaryData?.tables) ? summaryData.tables : [];
            const keyword = String(args.keyword || "").trim().toLowerCase();
            const filteredTables = keyword
              ? allTables.filter((t) => t.toLowerCase().includes(keyword))
              : allTables;
            toolResultStr = JSON.stringify({ totalTables: allTables.length, tables: filteredTables.slice(0, 50) });
            executionSteps.push({
              stepIndex: executionSteps.length,
              name: "Liệt kê danh mục bảng CSDL",
              action: "SCHEMA_LIST",
              status: "success",
            });
          } catch (err: any) {
            toolResultStr = `Lỗi tra cứu bảng CSDL: ${err?.message || err}`;
          }
        } else if (fnName === "describe_tables") {
          const reqTables: string[] = Array.isArray(args.tables) ? args.tables.slice(0, 6) : [];
          onProgressStatus?.(`Đang xem cấu trúc bảng: ${reqTables.join(", ")}...`);
          try {
            const detailData = await fetchSchemaFromBackend(
              appConfig.schemaEndpointUrl!,
              targetAppId,
              "detail",
              reqTables,
              userAuthToken
            );
            toolResultStr = JSON.stringify(detailData || {});
            executionSteps.push({
              stepIndex: executionSteps.length,
              name: `Xem cấu trúc bảng: ${reqTables.join(", ")}`,
              action: "SCHEMA_DETAIL",
              status: "success",
            });
          } catch (err: any) {
            toolResultStr = `Lỗi xem chi tiết bảng: ${err?.message || err}`;
          }
        } else if (fnName === "search_api") {
          onProgressStatus?.(`Đang tìm kiếm API: "${args.query}"...`);
          try {
            if (!cachedSwaggerOps) {
              cachedSwaggerOps = await getSwaggerOperations(appConfig.swaggerEndpointUrl!, true);
            }
            const queryLower = String(args.query || "").toLowerCase();
            const matchedOps = cachedSwaggerOps.filter(
              (op) =>
                op.endpoint.toLowerCase().includes(queryLower) ||
                (op.summary && op.summary.toLowerCase().includes(queryLower)) ||
                (op.description && op.description.toLowerCase().includes(queryLower))
            );
            toolResultStr = formatOperationsForPrompt(matchedOps.slice(0, 8));
            executionSteps.push({
              stepIndex: executionSteps.length,
              name: `Tìm kiếm API: ${args.query}`,
              action: "API_SEARCH",
              status: "success",
            });
          } catch (err: any) {
            toolResultStr = `Lỗi tìm API: ${err?.message || err}`;
          }
        } else if (fnName === "describe_api") {
          try {
            if (!cachedSwaggerOps) {
              cachedSwaggerOps = await getSwaggerOperations(appConfig.swaggerEndpointUrl!, true);
            }
            const indices: number[] = Array.isArray(args.indices) ? args.indices : [];
            const selectedOps = indices
              .filter((i) => i >= 0 && i < (cachedSwaggerOps?.length || 0))
              .map((i) => cachedSwaggerOps![i]);
            toolResultStr = formatDetailedOperations(selectedOps);
            executionSteps.push({
              stepIndex: executionSteps.length,
              name: "Nạp chi tiết cấu trúc API",
              action: "API_DETAIL",
              status: "success",
            });
          } catch (err: any) {
            toolResultStr = `Lỗi xem chi tiết API: ${err?.message || err}`;
          }
        }

        messages.push({
          role: "tool",
          tool_call_id: call.id,
          content: toolResultStr,
        });
      }

      if (submittedPlan) {
        if (!submittedPlan.steps || submittedPlan.steps.length === 0) {
          if (executionSteps.length > 0) {
            submittedPlan.steps = executionSteps;
          } else {
            submittedPlan.steps = [
              {
                stepIndex: 0,
                name: submittedPlan.planName,
                action: submittedPlan.action === "report_sql" ? "SQL" : "DIRECT",
                status: "success",
              },
            ];
          }
        }
        return submittedPlan;
      }
    } else if (response.content) {
      // LLM trả lời trực tiếp mà không gọi submit_plan
      return {
        thought: "Phản hồi trực tiếp từ AI Orchestrator",
        planName: "Phản hồi trực tiếp",
        action: "direct_answer",
        directAnswer: response.content,
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
  }

  // Fallback an toàn nếu hết số lượt
  return {
    thought: "Đã hoàn thành vòng lặp xử lý",
    planName: "Phản hồi hệ thống",
    action: "direct_answer",
    directAnswer:
      "Yêu cầu của bạn đã được ghi nhận. Vui lòng cung cấp thêm thông tin chi tiết để tôi có thể hỗ trợ tốt nhất.",
    steps: [
      {
        stepIndex: 0,
        name: "Phản hồi hệ thống",
        action: "DIRECT",
        status: "success",
      },
    ],
  };
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

export async function callInternalLlm(
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
