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

    if (!instruction) {
      return NextResponse.json(
        { Code: 400, Message: "instruction không được để trống", Data: null },
        { status: 400, headers: CORS_HEADERS }
      );
    }

    if (!appConfig) {
      return NextResponse.json(
        {
          Code: 404,
          Message:
            "Dự án này chưa được thiết lập tài liệu và quy tắc nghiệp vụ. Vui lòng liên hệ quản trị viên để được hỗ trợ.",
          Data: null,
        },
        { status: 404, headers: CORS_HEADERS }
      );
    }

    const response = await OrchestratorService.chat(
      instruction,
      context,
      autoExecute,
      appId,
      userAuthToken,
      clientHeaders
    );

    return NextResponse.json(
      {
        Code: 200,
        Message: "Success",
        Data: response,
      },
      { headers: CORS_HEADERS }
    );
  } catch (err: any) {
    console.error("[Orchestrator] POST /chat error:", err);
    return NextResponse.json(
      {
        Code: 500,
        Message: err?.message || "Lỗi xử lý nội bộ",
        Data: null,
      },
      { status: 500, headers: CORS_HEADERS }
    );
  }
}
