import { NextResponse } from "next/server";
import { OrchestratorService } from "@/lib/orchestrator/orchestratorService";
import { isValidApiKey } from "@/sse/services/auth";
import { CORS_HEADERS, handleCorsOptions, extractRequestContext } from "../shared";

export const dynamic = "force-dynamic";

export async function OPTIONS() {
  return handleCorsOptions();
}

export async function POST(request: Request) {
  try {
    const { appId, userAuthToken, clientHeaders, rawBody } = await extractRequestContext(request);

    const apiKey = clientHeaders["x-api-key"] || clientHeaders["x-key"];
    if (apiKey) {
      const isValid = await isValidApiKey(apiKey);
      if (!isValid) {
        return NextResponse.json(
          { Code: 401, Message: "API Key không hợp lệ hoặc đã hết hạn.", Data: null },
          { status: 401, headers: CORS_HEADERS }
        );
      }
    }

    const planId = rawBody?.planId || "";
    const userSuppliedInputs = rawBody?.userSuppliedInputs || {};

    if (!planId) {
      return NextResponse.json(
        { Code: 400, Message: "planId không được để trống", Data: null },
        { status: 400, headers: CORS_HEADERS }
      );
    }

    let finalResponse: any = null;
    await OrchestratorService.confirmStream(
      planId,
      userSuppliedInputs,
      appId,
      userAuthToken,
      (event, data) => {
        if (event === "done") {
          finalResponse = data;
        }
      },
      clientHeaders
    );

    return NextResponse.json(
      {
        Code: 200,
        Message: "Success",
        Data: finalResponse,
      },
      { headers: CORS_HEADERS }
    );
  } catch (err: any) {
    console.error("[Orchestrator] POST /confirm error:", err);
    return NextResponse.json(
      {
        Code: 500,
        Message: err?.message || "Lỗi xác nhận kế hoạch",
        Data: null,
      },
      { status: 500, headers: CORS_HEADERS }
    );
  }
}
