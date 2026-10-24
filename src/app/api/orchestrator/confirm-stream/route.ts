import { OrchestratorService } from "@/lib/orchestrator/orchestratorService";
import { isValidApiKey } from "@/sse/services/auth";
import { CORS_HEADERS, handleCorsOptions, extractRequestContext } from "../shared";

export const dynamic = "force-dynamic";

export async function OPTIONS() {
  return handleCorsOptions();
}

export async function POST(request: Request) {
  const { appId, userAuthToken, clientHeaders, rawBody } = await extractRequestContext(request);

  const planId = rawBody?.planId || "";
  const userSuppliedInputs = rawBody?.userSuppliedInputs || {};

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const sendEvent = (event: string, data: any) => {
        try {
          const dataStr = typeof data === "string" ? data : JSON.stringify(data);
          controller.enqueue(encoder.encode(`event: ${event}\ndata: ${dataStr}\n\n`));
        } catch (e) {
          console.warn("[Orchestrator] Error encoding SSE confirm event:", e);
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

        if (!planId) {
          sendEvent("error", { message: "planId không được để trống" });
          controller.close();
          return;
        }

        await OrchestratorService.confirmStream(
          planId,
          userSuppliedInputs,
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
