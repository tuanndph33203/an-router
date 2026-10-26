import { randomUUID } from "crypto";
import { getAppConfig, isSqlReportEndpoint } from "./appRegistry";
import { generateActionPlan, synthesizeFinalAnswer, PlanOutput } from "./planEngine";
import { executeRemoteAction } from "./executor";
import { AgentChatResponse, AgentInteractionStatus, StepMappingResult } from "./types";

interface ActivePlanSession {
  planId: string;
  appId: string;
  instruction: string;
  context: Record<string, any>;
  plan: PlanOutput;
  createdAt: number;
}

const activePlans = new Map<string, ActivePlanSession>();
const PLAN_TTL_MS = 30 * 60 * 1000;

function cleanupStalePlans(): void {
  const now = Date.now();
  for (const [id, session] of activePlans.entries()) {
    if (now - session.createdAt > PLAN_TTL_MS) {
      activePlans.delete(id);
    }
  }
}

export type SseSender = (event: string, data: any) => void;

async function loadApiKeyRules(
  effectiveApiKey: string,
  excludeRulePath?: string
): Promise<{
  content: string;
  keyName: string;
  ruleCount: number;
}> {
  if (!effectiveApiKey) return { content: "", keyName: "", ruleCount: 0 };
  try {
    const { getDbInstance } = await import("@/lib/db/core");
    const { getRulesForApiKey, getRuleBookContent } = await import("@/lib/db/ruleBooks");
    const db = getDbInstance();
    const keyRow = db
      .prepare("SELECT id, name FROM api_keys WHERE key = ?")
      .get(effectiveApiKey) as any;
    if (keyRow) {
      const normalizedExclude = (excludeRulePath || "").replace(/\\/g, "/");
      const rules = getRulesForApiKey(keyRow.id).filter((r) => {
        if (!normalizedExclude) return true;
        const rel = (r.relativePath || "").replace(/\\/g, "/");
        return (
          rel !== normalizedExclude &&
          !normalizedExclude.endsWith(`/${r.fileName}`) &&
          r.fileName !== normalizedExclude
        );
      });
      if (rules.length > 0) {
        const contents = rules.map((r) => {
          const text = getRuleBookContent(r);
          return `--- RULE BOOK: [${r.name}] (${r.category}) ---\n${text}`;
        });
        return {
          content: `\nQUY CHUẨN NGHIỆP VỤ BỔ SUNG TỪ KHÓA API [${keyRow.name}]:\n${contents.join("\n\n")}\n`,
          keyName: keyRow.name,
          ruleCount: rules.length,
        };
      }
    }
  } catch (e) {
    console.warn("[Orchestrator] Error loading rules for API Key:", e);
  }
  return { content: "", keyName: "", ruleCount: 0 };
}

function sanitizeAndEnrichPayload(
  payload: Record<string, any>,
  context: Record<string, any> = {},
  _appId: string = "",
  clientHeaders: Record<string, string> = {}
): Record<string, any> {
  const result: Record<string, any> = { ...payload };

  const dbProfile = context?.applicationId || clientHeaders["x-application-id"] || "";
  if (dbProfile) {
    result.applicationId = dbProfile;
  }

  if ("chartSpec" in result) {
    if (typeof result.chartSpec === "string") {
      const ct = result.chartSpec.toLowerCase();
      if (ct === "none" || !ct) {
        delete result.chartSpec;
      } else {
        result.chartSpec = {
          chartType: ct,
          title: result.summary || "Biểu đồ báo cáo",
          categoryColumn: "",
          valueColumns: [],
        };
      }
    } else if (result.chartSpec && typeof result.chartSpec === "object") {
      if (!result.chartSpec.chartType || result.chartSpec.chartType === "none") {
        delete result.chartSpec;
      }
    }
  }

  return result;
}

export class OrchestratorService {
  public static async chat(
    instruction: string,
    context: Record<string, any> = {},
    _autoExecute: boolean = true,
    appId: string = "",
    userAuthToken: string = "",
    clientHeaders: Record<string, string> = {}
  ): Promise<AgentChatResponse> {
    const config = getAppConfig(appId);
    if (!config) {
      throw new Error(
        "Dự án này chưa được thiết lập tài liệu và quy tắc nghiệp vụ. Vui lòng liên hệ quản trị viên để được hỗ trợ."
      );
    }

    const effectiveApiKey = clientHeaders["x-api-key"] || clientHeaders["x-key"] || "";
    const apiKeyRules = await loadApiKeyRules(effectiveApiKey, config.rulePath);

    const mergedConfig = {
      ...config,
      domainPlaybook: apiKeyRules.content
        ? `${apiKeyRules.content}\n${config.domainPlaybook || ""}`
        : config.domainPlaybook,
    };

    const planId = `plan_${randomUUID()}`;
    const plan = await generateActionPlan(mergedConfig, instruction, context, {}, userAuthToken);

    cleanupStalePlans();
    activePlans.set(planId, {
      planId,
      appId,
      instruction,
      context,
      plan,
      createdAt: Date.now(),
    });

    // 1. Trường hợp trả lời trực tiếp không cần API
    if (plan.directAnswer && (!plan.action || plan.action === "direct_answer" || plan.action === "DIRECT")) {
      return {
        planId,
        applicationId: appId,
        status: AgentInteractionStatus.Completed,
        botMessage: plan.directAnswer,
        executionLogs: [
          {
            time: new Date().toLocaleTimeString(),
            step: "Phản hồi trực tiếp",
            status: "SUCCESS",
            detail: "Không yêu cầu gọi API nghiệp vụ",
          },
        ],
      };
    }

    const nextStepDetail: StepMappingResult = {
      step: 1,
      name: plan.planName,
      action: plan.action,
      endpoint: plan.endpoint,
      resolved_payload: plan.resolvedPayload,
      missing_required_fields: plan.missingRequiredFields,
    };

    // 2. Trường hợp thiếu thông tin bắt buộc -> NeedInput
    if (plan.missingRequiredFields && plan.missingRequiredFields.length > 0) {
      return {
        planId,
        applicationId: appId,
        status: AgentInteractionStatus.NeedInput,
        botMessage: `Tôi cần thêm thông tin để ${plan.planName.toLowerCase()}. Vui lòng điền các trường bên dưới:`,
        nextStepDetail,
      };
    }

    // 3. Trường hợp cần xác nhận trước khi thực hiện -> ConfirmationRequired
    if (plan.requiresConfirmation) {
      return {
        planId,
        applicationId: appId,
        status: AgentInteractionStatus.ConfirmationRequired,
        botMessage:
          plan.directAnswer || `Bạn có chắc chắn muốn thực hiện hành động: **${plan.planName}**?`,
        nextStepDetail,
      };
    }

    // 4. Thực thi hành động
    if (plan.action && plan.endpoint) {
      const isReportSql = isSqlReportEndpoint(plan.endpoint, config);
      const effectiveAppId = context?.applicationId || clientHeaders["x-application-id"] || "";

      if (isReportSql && !effectiveAppId) {
        return {
          planId,
          applicationId: "",
          status: AgentInteractionStatus.Completed,
          botMessage: "Rất tiếc, tính năng tra cứu dữ liệu và báo cáo hiện chưa được hỗ trợ.",
          executionLogs: [
            {
              time: new Date().toLocaleTimeString(),
              step: "Kiểm tra ApplicationId",
              status: "FAILED",
              detail: "Bị từ chối: Ô chat không truyền appId nên không được phép gọi SQL.",
            },
          ],
        };
      }

      const requestPayload = sanitizeAndEnrichPayload(
        plan.resolvedPayload || {},
        context,
        appId,
        clientHeaders
      );

      const execResult = await executeRemoteAction(
        config.baseApiUrl,
        plan.action,
        plan.endpoint,
        requestPayload,
        userAuthToken,
        clientHeaders,
        undefined,
        config.sqlExecuteEndpoint
      );

      let botMessage = "";
      if (execResult.success) {
        botMessage = await synthesizeFinalAnswer(
          config,
          instruction,
          plan.action,
          plan.endpoint,
          execResult.data
        );
      } else {
        botMessage = `⚠️ Thực thi [${plan.action}] ${plan.endpoint} không thành công:\n${execResult.error || "Lỗi không xác định"}`;
      }

      return {
        planId,
        applicationId: appId,
        status: execResult.success
          ? AgentInteractionStatus.Completed
          : AgentInteractionStatus.NeedInput,
        botMessage,
        nextStepDetail,
        synthesizedData: execResult.data,
        executionLogs: execResult.logs,
      };
    }

    return {
      planId,
      applicationId: appId,
      status: AgentInteractionStatus.Completed,
      botMessage: plan.directAnswer || "Đã hoàn thành yêu cầu.",
    };
  }

  public static async chatStream(
    instruction: string,
    context: Record<string, any> = {},
    _autoExecute: boolean = true,
    appId: string = "",
    userAuthToken: string = "",
    sendEvent: SseSender,
    clientHeaders: Record<string, string> = {},
    abortSignal?: AbortSignal
  ): Promise<void> {
    const config = getAppConfig(appId);
    if (!config) {
      sendEvent("error", {
        message:
          "Dự án này chưa được thiết lập tài liệu và quy tắc nghiệp vụ. Vui lòng liên hệ quản trị viên để được hỗ trợ.",
      });
      return;
    }

    const effectiveApiKey = clientHeaders["x-api-key"] || clientHeaders["x-key"] || "";
    const apiKeyRules = await loadApiKeyRules(effectiveApiKey, config.rulePath);

    if (apiKeyRules.ruleCount > 0) {
      sendEvent("status", {
        message: `Đã nạp ${apiKeyRules.ruleCount} Rule Book(s) nghiệp vụ của khóa: ${apiKeyRules.keyName}...`,
      });
    }

    const mergedConfig = {
      ...config,
      domainPlaybook: apiKeyRules.content
        ? `${apiKeyRules.content}\n${config.domainPlaybook || ""}`
        : config.domainPlaybook,
    };

    sendEvent("status", { message: "Đang phân tích yêu cầu..." });

    const planId = `plan_${randomUUID()}`;
    const plan = await generateActionPlan(
      mergedConfig,
      instruction,
      context,
      {},
      userAuthToken,
      (msg) => sendEvent("status", { message: msg })
    );

    cleanupStalePlans();
    activePlans.set(planId, {
      planId,
      appId,
      instruction,
      context,
      plan,
      createdAt: Date.now(),
    });

    if (plan.thought) {
      sendEvent("status", { message: plan.thought });
    }

    // Trường hợp trả lời trực tiếp
    if (plan.directAnswer && (!plan.action || plan.action === "direct_answer" || plan.action === "DIRECT")) {
      sendEvent("text_delta", { delta: plan.directAnswer, accumulated: plan.directAnswer });
      sendEvent("done", {
        planId,
        applicationId: appId,
        status: AgentInteractionStatus.Completed,
        botMessage: plan.directAnswer,
        executionLogs: [
          {
            time: new Date().toLocaleTimeString(),
            step: "Phản hồi trực tiếp",
            status: "SUCCESS",
            detail: "Không yêu cầu gọi API nghiệp vụ",
          },
        ],
      });
      return;
    }

    const nextStepDetail: StepMappingResult = {
      step: 1,
      name: plan.planName,
      action: plan.action,
      endpoint: plan.endpoint,
      resolved_payload: plan.resolvedPayload,
      missing_required_fields: plan.missingRequiredFields,
    };

    const stepsToRun = [
      {
        stepIndex: 0,
        name: plan.planName,
        action: plan.action || "API",
        endpoint: plan.endpoint || "",
        status: "pending" as const,
      },
    ];

    sendEvent("plan_created", {
      count: stepsToRun.length,
      steps: stepsToRun,
    });

    // Cần bổ sung thông tin
    if (plan.missingRequiredFields && plan.missingRequiredFields.length > 0) {
      const msg = `Tôi cần thêm thông tin để ${plan.planName.toLowerCase()}. Vui lòng điền các trường bên dưới:`;
      sendEvent("text_delta", { delta: msg, accumulated: msg });
      sendEvent("need_input", {
        planId,
        applicationId: appId,
        status: AgentInteractionStatus.NeedInput,
        botMessage: msg,
        nextStepDetail,
      });
      return;
    }

    // Cần xác nhận
    if (plan.requiresConfirmation) {
      const msg = plan.directAnswer || `Vui lòng xác nhận hành động: **${plan.planName}**`;
      sendEvent("text_delta", { delta: msg, accumulated: msg });
      sendEvent("confirmation_required", {
        planId,
        applicationId: appId,
        status: AgentInteractionStatus.ConfirmationRequired,
        botMessage: msg,
        nextStepDetail,
      });
      return;
    }

    // Thực thi
    if (plan.action && plan.endpoint) {
      const activeStepIndex = 0;

      sendEvent("step_start", {
        stepIndex: activeStepIndex,
        totalSteps: 1,
        name: plan.planName,
        action: plan.action,
        endpoint: plan.endpoint,
      });

      sendEvent("status", { message: `Đang gọi API ${plan.action} ${plan.endpoint}...` });

      const requestPayload = sanitizeAndEnrichPayload(
        plan.resolvedPayload || {},
        context,
        appId,
        clientHeaders
      );

      const isReportSql = isSqlReportEndpoint(plan.endpoint, config);
      const effectiveAppId = context?.applicationId || clientHeaders["x-application-id"] || "";

      if (isReportSql && !effectiveAppId) {
        const warningMsg = "Rất tiếc, tính năng tra cứu dữ liệu và báo cáo hiện chưa được hỗ trợ.";
        sendEvent("step_done", {
          stepIndex: activeStepIndex,
          status: "ERROR",
          error: "Thiếu applicationId: Không được phép gọi SQL khi ô chat không truyền appId.",
        });
        sendEvent("text_delta", { delta: warningMsg, accumulated: warningMsg });
        sendEvent("done", {
          planId,
          applicationId: "",
          status: AgentInteractionStatus.Completed,
          botMessage: warningMsg,
          executionLogs: [
            {
              time: new Date().toLocaleTimeString(),
              step: "Kiểm tra ApplicationId",
              status: "FAILED",
              detail: "Bị từ chối: Ô chat không truyền appId nên không được phép gọi SQL.",
            },
          ],
        });
        return;
      }

      if (abortSignal?.aborted) return;

      const execResult = await executeRemoteAction(
        config.baseApiUrl,
        plan.action,
        plan.endpoint,
        requestPayload,
        userAuthToken,
        clientHeaders,
        abortSignal,
        config.sqlExecuteEndpoint
      );

      if (!execResult.success) {
        sendEvent("step_done", {
          stepIndex: activeStepIndex,
          status: "ERROR",
          error: execResult.error,
        });

        const errMsg = `⚠️ Không thể thực thi [${plan.action}] ${plan.endpoint}:\n${execResult.error || "Lỗi không xác định"}`;
        sendEvent("report_error", { message: execResult.error || "Lỗi thực thi truy vấn" });
        sendEvent("text_delta", { delta: errMsg, accumulated: errMsg });
        sendEvent("done", {
          planId,
          applicationId: appId,
          status: AgentInteractionStatus.NeedInput,
          botMessage: errMsg,
          nextStepDetail,
          synthesizedData: null,
          executionLogs: execResult.logs,
        });
        return;
      }

      sendEvent("step_done", {
        stepIndex: activeStepIndex,
        status: "SUCCESS",
      });

      let finalBotMsg = "";
      if (execResult.data?.isHeavyQuery || execResult.data?.IsHeavyQuery) {
        const estRows =
          (execResult.data.estimatedRows ?? execResult.data.EstimatedRows)
            ? Number(
                execResult.data.estimatedRows ?? execResult.data.EstimatedRows
              ).toLocaleString()
            : "lớn";
        finalBotMsg = `⚡ **Phát hiện truy vấn dữ liệu lớn:**\n${execResult.data.message || execResult.data.Message || `Truy vấn ước tính trả về khoảng ${estRows} dòng.`}\n\nHệ thống tạm ngưng tải trực tiếp để bảo vệ kết nối. Bạn có thể chọn chuyển sang quy trình xuất nền (Hangfire) để tạo file báo cáo.`;
        sendEvent("text_delta", { delta: finalBotMsg, accumulated: finalBotMsg });
      } else {
        sendEvent("status", { message: "Đang tổng hợp kết quả..." });
        finalBotMsg = await synthesizeFinalAnswer(
          config,
          instruction,
          plan.action,
          plan.endpoint,
          execResult.data,
          (delta) => sendEvent("text_delta", { delta })
        );
      }

      sendEvent("done", {
        planId,
        applicationId: appId,
        status: AgentInteractionStatus.Completed,
        botMessage: finalBotMsg,
        nextStepDetail,
        synthesizedData: execResult.data,
        executionLogs: execResult.logs,
      });
    } else {
      const fallbackMsg =
        plan.directAnswer ||
        "Không thể xác định hành động phù hợp cho yêu cầu này. Vui lòng mô tả chi tiết hơn.";
      sendEvent("text_delta", { delta: fallbackMsg, accumulated: fallbackMsg });
      sendEvent("done", {
        planId,
        applicationId: appId,
        status: AgentInteractionStatus.Completed,
        botMessage: fallbackMsg,
        executionLogs: [],
      });
    }
  }

  public static async confirmStream(
    planId: string,
    userSuppliedInputs: Record<string, any> = {},
    appId: string = "",
    userAuthToken: string = "",
    sendEvent: SseSender,
    clientHeaders: Record<string, string> = {},
    abortSignal?: AbortSignal
  ): Promise<void> {
    const session = activePlans.get(planId);
    if (!session) {
      sendEvent("error", { message: `Kế hoạch (${planId}) không tồn tại hoặc đã hết hạn.` });
      return;
    }

    const targetAppId = appId || session.appId;
    const config = getAppConfig(targetAppId);
    if (!config) {
      sendEvent("error", {
        message: `Ứng dụng '${targetAppId || "chưa xác định"}' không tồn tại hoặc chưa được định danh.`,
      });
      return;
    }

    sendEvent("status", { message: "Đang tiếp tục thực hiện kế hoạch..." });

    const mergedPayload = sanitizeAndEnrichPayload(
      {
        ...(session.plan.resolvedPayload || {}),
        ...userSuppliedInputs,
      },
      session.context || {},
      appId,
      clientHeaders
    );

    const action = session.plan.action || "POST";
    const endpoint = session.plan.endpoint || "";

    sendEvent("step_start", {
      stepIndex: 0,
      totalSteps: 1,
      name: session.plan.planName,
      action,
      endpoint,
    });

    if (abortSignal?.aborted) return;

    const execResult = await executeRemoteAction(
      config.baseApiUrl,
      action,
      endpoint,
      mergedPayload,
      userAuthToken,
      clientHeaders,
      abortSignal,
      config.sqlExecuteEndpoint
    );

    sendEvent("step_done", {
      stepIndex: 0,
      status: execResult.success ? "SUCCESS" : "ERROR",
      error: execResult.error,
    });

    let finalBotMsg = "";
    if (execResult.success) {
      if (execResult.data?.isHeavyQuery || execResult.data?.IsHeavyQuery) {
        const estRows =
          (execResult.data.estimatedRows ?? execResult.data.EstimatedRows)
            ? Number(
                execResult.data.estimatedRows ?? execResult.data.EstimatedRows
              ).toLocaleString()
            : "lớn";
        finalBotMsg = `⚡ **Phát hiện truy vấn dữ liệu lớn:**\n${execResult.data.message || execResult.data.Message || `Truy vấn ước tính trả về khoảng ${estRows} dòng.`}\n\nHệ thống tạm ngưng tải trực tiếp để bảo vệ kết nối. Bạn có thể chọn chuyển sang quy trình xuất nền (Hangfire) để tạo file báo cáo.`;
        sendEvent("text_delta", { delta: finalBotMsg, accumulated: finalBotMsg });
      } else {
        sendEvent("status", { message: "Đang tổng hợp kết quả..." });
        finalBotMsg = await synthesizeFinalAnswer(
          config,
          session.instruction,
          action,
          endpoint,
          execResult.data,
          (delta) => sendEvent("text_delta", { delta })
        );
      }
    } else {
      let cleanErr = execResult.error || "Lỗi không xác định";
      try {
        if (typeof cleanErr === "string" && cleanErr.trim().startsWith("{")) {
          const parsed = JSON.parse(cleanErr);
          if (parsed?.message) cleanErr = parsed.message;
        }
      } catch {}
      finalBotMsg = `⚠️ Thực thi thất bại: ${cleanErr}`;
      sendEvent("text_delta", { delta: finalBotMsg, accumulated: finalBotMsg });
    }

    const nextStepDetail: StepMappingResult = {
      step: 1,
      name: session.plan.planName,
      action,
      endpoint,
      resolved_payload: mergedPayload,
    };

    sendEvent("done", {
      planId,
      applicationId: appId,
      status: execResult.success
        ? AgentInteractionStatus.Completed
        : AgentInteractionStatus.NeedInput,
      botMessage: finalBotMsg,
      nextStepDetail,
      synthesizedData: execResult.data,
      executionLogs: execResult.logs,
    });

    activePlans.delete(planId);
  }
}
