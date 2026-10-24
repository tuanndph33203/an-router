import { NextResponse } from "next/server";
import { listApps, registerApp, unregisterApp, getAppConfig } from "@/lib/orchestrator/appRegistry";
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
  const clientKey =
    url.searchParams.get("clientKey") ||
    url.searchParams.get("microsoftClientKey") ||
    url.searchParams.get("appId");

  if (clientKey && clientKey !== "all") {
    const config = getAppConfig(clientKey);
    if (!config) {
      return NextResponse.json(
        { Code: 404, Message: `Không tìm thấy ứng dụng với key: ${clientKey}`, Data: null },
        { status: 404, headers: CORS_HEADERS }
      );
    }
    return NextResponse.json(
      { Code: 200, Message: "Success", Data: isManagement ? config : sanitizeAppForPublic(config) },
      { headers: CORS_HEADERS }
    );
  }

  const apps = listApps();
  return NextResponse.json(
    {
      Code: 200,
      Message: "Success",
      Data: isManagement ? apps : apps.map(sanitizeAppForPublic),
      Total: apps.length,
    },
    { headers: CORS_HEADERS }
  );
}

export async function POST(request: Request) {
  const authError = await requireManagementAuth(request);
  if (authError) return authError;
  try {
    const body = await request.json();
    const clientKey = (body?.microsoftClientKey || body?.appId || "").trim();

    if (!body || !clientKey || !body.name || !body.baseApiUrl) {
      return NextResponse.json(
        {
          Code: 400,
          Message: "microsoftClientKey, name và baseApiUrl là các trường bắt buộc.",
          Data: null,
        },
        { status: 400, headers: CORS_HEADERS }
      );
    }

    const ruleFiles = Array.isArray(body.ruleFiles)
      ? body.ruleFiles.map((s: string) => String(s).trim()).filter(Boolean)
      : typeof body.rulePath === "string"
        ? body.rulePath
            .split(/[\n,;]+/)
            .map((s: string) => s.trim())
            .filter(Boolean)
        : [];

    registerApp({
      microsoftClientKey: clientKey,
      appId: clientKey,
      name: body.name.trim(),
      baseApiUrl: body.baseApiUrl.trim(),
      capabilities: Array.isArray(body.capabilities) ? body.capabilities : ["api"],
      rulePath: ruleFiles.length > 0 ? ruleFiles.join(", ") : body.rulePath || undefined,
      ruleFiles: ruleFiles.length > 0 ? ruleFiles : undefined,
      swaggerEndpointUrl: body.swaggerEndpointUrl || undefined,
      schemaEndpointUrl: body.schemaEndpointUrl || undefined,
      sqlExecuteEndpoint: body.sqlExecuteEndpoint || undefined,
      welcomeMessage:
        body.welcomeMessage || `Xin chào! Tôi là Trợ lý AI của hệ thống ${body.name}.`,
      quickSuggestions: Array.isArray(body.quickSuggestions) ? body.quickSuggestions : [],
      domainPlaybook: body.domainPlaybook || undefined,
      defaultModel: body.defaultModel || undefined,
    });

    return NextResponse.json(
      {
        Code: 200,
        Message: `Đã lưu thành công ứng dụng: ${body.name}`,
        Data: getAppConfig(clientKey),
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

export async function DELETE(request: Request) {
  const authError = await requireManagementAuth(request);
  if (authError) return authError;

  try {
    const url = new URL(request.url);
    const clientKey =
      url.searchParams.get("clientKey") ||
      url.searchParams.get("microsoftClientKey") ||
      url.searchParams.get("appId");

    if (!clientKey) {
      return NextResponse.json(
        { Code: 400, Message: "Thiếu tham số microsoftClientKey để xóa.", Data: null },
        { status: 400, headers: CORS_HEADERS }
      );
    }

    const ok = unregisterApp(clientKey);
    return NextResponse.json(
      {
        Code: ok ? 200 : 404,
        Message: ok
          ? `Đã xóa thành công ứng dụng: ${clientKey}`
          : `Không tìm thấy ứng dụng: ${clientKey}`,
        Data: { clientKey, deleted: ok },
      },
      { status: ok ? 200 : 404, headers: CORS_HEADERS }
    );
  } catch (err: any) {
    return NextResponse.json(
      {
        Code: 500,
        Message: err?.message || "Lỗi khi xóa ứng dụng",
        Data: null,
      },
      { status: 500, headers: CORS_HEADERS }
    );
  }
}
