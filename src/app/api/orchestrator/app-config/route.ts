import { NextResponse } from "next/server";
import { getAppConfig, registerApp } from "@/lib/orchestrator/appRegistry";
import { requireManagementAuth } from "@/lib/api/requireManagementAuth";
import { CORS_HEADERS, handleCorsOptions } from "../shared";

export const dynamic = "force-dynamic";

export async function OPTIONS() {
  return handleCorsOptions();
}

function sanitizeAppForPublic(app: any) {
  if (!app) return null;
  return {
    appId: app.appId || app.microsoftClientKey,
    microsoftClientKey: app.microsoftClientKey,
    name: app.name,
    welcomeMessage: app.welcomeMessage,
    quickSuggestions: app.quickSuggestions,
    capabilities: app.capabilities,
  };
}

export async function GET(request: Request) {
  const authError = await requireManagementAuth(request);
  const isManagement = !authError;

  const url = new URL(request.url);
  const appId =
    url.searchParams.get("appId") ||
    request.headers.get("x-application-id") ||
    request.headers.get("X-Application-Id");

  const clientKey =
    url.searchParams.get("microsoftClientKey") ||
    url.searchParams.get("clientKey") ||
    request.headers.get("x-microsoft-client-key") ||
    request.headers.get("x-client-key");

  const queryKey = appId || clientKey;
  if (!queryKey) {
    return NextResponse.json(
      {
        Code: 400,
        Message: "Vui lòng cung cấp tham số appId hoặc microsoftClientKey.",
        Data: null,
      },
      { status: 400, headers: CORS_HEADERS }
    );
  }

  const config = getAppConfig(queryKey);
  if (!config) {
    return NextResponse.json(
      {
        Code: 404,
        Message: `Không tìm thấy cấu hình cho ứng dụng: ${queryKey}`,
        Data: null,
      },
      { status: 404, headers: CORS_HEADERS }
    );
  }

  return NextResponse.json(
    {
      Code: 200,
      Message: "Success",
      Data: isManagement ? config : sanitizeAppForPublic(config),
    },
    { headers: CORS_HEADERS }
  );
}

export async function POST(request: Request) {
  const authError = await requireManagementAuth(request);
  if (authError) return authError;

  try {
    const body = await request.json();
    if (!body || !body.appId || !body.name) {
      return NextResponse.json(
        {
          Code: 400,
          Message: "appId và name là bắt buộc.",
          Data: null,
        },
        { status: 400, headers: CORS_HEADERS }
      );
    }

    registerApp({
      microsoftClientKey: body.microsoftClientKey || body.appId,
      appId: body.appId,
      name: body.name,
      baseApiUrl: body.baseApiUrl || "",
      capabilities: Array.isArray(body.capabilities) ? body.capabilities : undefined,
      rulePath: body.rulePath || undefined,
      swaggerEndpointUrl: body.swaggerEndpointUrl || "",
      schemaEndpointUrl: body.schemaEndpointUrl || "",
      sqlExecuteEndpoint: body.sqlExecuteEndpoint || "",
      welcomeMessage:
        body.welcomeMessage || `Xin chào! Tôi là Trợ lý AI của hệ thống ${body.name}.`,
      quickSuggestions: Array.isArray(body.quickSuggestions) ? body.quickSuggestions : [],
      domainPlaybook: body.domainPlaybook || undefined,
      defaultModel: body.defaultModel,
    });

    return NextResponse.json(
      {
        Code: 200,
        Message: `Đã cấu hình thành công ứng dụng: ${body.appId}`,
        Data: body,
      },
      { headers: CORS_HEADERS }
    );
  } catch (err: any) {
    return NextResponse.json(
      {
        Code: 500,
        Message: err?.message || "Lỗi lưu cấu hình ứng dụng",
        Data: null,
      },
      { status: 500, headers: CORS_HEADERS }
    );
  }
}
