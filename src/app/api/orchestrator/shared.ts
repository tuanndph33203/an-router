import { getAppConfig } from "@/lib/orchestrator/appRegistry";

export const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Application-Id, x-application-id, x-microsoft-client-key, x-client-key, x-key, x-api-key, accept",
};

export function handleCorsOptions() {
  return new Response(null, {
    status: 204,
    headers: CORS_HEADERS,
  });
}

export interface ExtractedRequestContext {
  microsoftClientKey: string;
  dbProfile: string;
  appId: string;
  userAuthToken: string;
  clientHeaders: Record<string, string>;
  instruction: string;
  context: Record<string, any>;
  autoExecute: boolean;
  rawBody: any;
  appConfig: ReturnType<typeof getAppConfig>;
}

function extractClientKeyFromJwt(token: string): string | null {
  try {
    const raw = token.startsWith("Bearer ") ? token.slice(7).trim() : token.trim();
    const parts = raw.split(".");
    if (parts.length !== 3) return null;
    const payloadJson = Buffer.from(parts[1], "base64url").toString("utf-8");
    const payload = JSON.parse(payloadJson);
    return payload.microsoftClientKey || payload.clientKey || payload.client_key || null;
  } catch {
    return null;
  }
}

export async function extractRequestContext(
  request: Request,
  providedBody?: any
): Promise<ExtractedRequestContext> {
  const body = providedBody !== undefined ? providedBody : await request.json().catch(() => ({}));

  const url = new URL(request.url);
  const userAuthToken = request.headers.get("Authorization") || "";
  const tokenClientKey = userAuthToken ? extractClientKeyFromJwt(userAuthToken) : null;

  const explicitClientKey =
    body?.microsoftClientKey ||
    body?.clientKey ||
    body?.appId ||
    url.searchParams.get("microsoftClientKey") ||
    url.searchParams.get("clientKey") ||
    url.searchParams.get("appId") ||
    request.headers.get("x-microsoft-client-key") ||
    request.headers.get("x-client-key") ||
    tokenClientKey ||
    "";

  const finalClientKey = explicitClientKey ? String(explicitClientKey).trim() : "";
  const matchedApp = finalClientKey ? getAppConfig(finalClientKey) : null;

  const dbProfile =
    body?.dbProfile ||
    body?.context?.dbProfile ||
    body?.context?.applicationId ||
    request.headers.get("x-target-application-id") ||
    url.searchParams.get("dbProfile") ||
    url.searchParams.get("db") ||
    "";

  const clientHeaders: Record<string, string> = {};
  const xKey = request.headers.get("x-key") || request.headers.get("x-api-key");
  if (xKey) {
    clientHeaders["x-key"] = xKey;
    clientHeaders["x-api-key"] = xKey;
  }

  if (dbProfile) {
    clientHeaders["x-application-id"] = dbProfile;
  }

  const instruction = body?.instruction || "";
  const context = body?.context || {};
  if (dbProfile && !context.applicationId) {
    context.applicationId = dbProfile;
  }
  const autoExecute = body?.autoExecute !== false;

  return {
    microsoftClientKey: finalClientKey,
    dbProfile,
    appId: finalClientKey,
    userAuthToken,
    clientHeaders,
    instruction,
    context,
    autoExecute,
    rawBody: body,
    appConfig: matchedApp,
  };
}
