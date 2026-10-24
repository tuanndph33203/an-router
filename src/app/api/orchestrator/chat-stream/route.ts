import { OrchestratorService } from "@/lib/orchestrator/orchestratorService";
import { isValidApiKey } from "@/sse/services/auth";
import { CORS_HEADERS, handleCorsOptions, extractRequestContext } from "../shared";

export const dynamic = "force-dynamic";

export async function OPTIONS() {
  return handleCorsOptions();
}

export async function POST(request: Request) {
  const {
    microsoftClientKey,
    dbProfile,
    appId,
    userAuthToken,
    clientHeaders,
    instruction,
    context,
    autoExecute,
    appConfig,
  } = await extractRequestContext(request);

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const sendEvent = (event: string, data: any) => {
        try {
          const dataStr = typeof data === "string" ? data : JSON.stringify(data);
          controller.enqueue(encoder.encode(`event: ${event}\ndata: ${dataStr}\n\n`));
        } catch (e) {
          console.warn("[Orchestrator] Error encoding SSE event:", e);
        }
      };

      try {
        const apiKey = clientHeaders["x-api-key"] || clientHeaders["x-key"];
        if (apiKey) {
          const isValid = await isValidApiKey(apiKey);
          if (!isValid) {
            sendEvent("error", { message: "API Key không hợp lệ hoặc đã hết hạn." });
            controller.close();
            return;
          }
        }

        if (!instruction) {
          sendEvent("error", { message: "instruction không được để trống" });
          controller.close();
          return;
        }

        if (!appConfig) {
          sendEvent("error", {
            message:
              "Dự án này chưa được thiết lập tài liệu và quy tắc nghiệp vụ. Vui lòng liên hệ quản trị viên để được hỗ trợ.",
          });
          controller.close();
          return;
        }

        await OrchestratorService.chatStream(
          instruction,
          context,
          autoExecute,
          appId,
          userAuthToken,
          sendEvent,
          clientHeaders,
          request.signal
        );
      } catch (err: any) {
        sendEvent("error", { message: err?.message || String(err) });
      } finally {
        try {
          controller.close();
        } catch {}
      }
    },
  });

  return new Response(stream, {
    headers: {
      ...CORS_HEADERS,
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
