import { NextResponse } from "next/server";
import { getRuleIdsForApiKey, getRulesForApiKey, assignRulesToApiKey } from "@/lib/db/ruleBooks";
import { requireManagementAuth } from "@/lib/api/requireManagementAuth";

export const dynamic = "force-dynamic";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, PUT, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, accept",
};

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: CORS_HEADERS,
  });
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const authError = await requireManagementAuth(request);
  if (authError) return authError;

  try {
    const { id: keyId } = await params;
    if (!keyId) {
      return NextResponse.json(
        { Code: 400, Message: "Missing key id", Data: null },
        { status: 400, headers: CORS_HEADERS }
      );
    }

    const { getDbInstance } = await import("@/lib/db/core");
    const db = getDbInstance();
    const keyRow = db
      .prepare("SELECT id, name, app_id, app_name FROM api_keys WHERE id = ?")
      .get(keyId) as any;

    const assignedRuleIds = getRuleIdsForApiKey(keyId);
    const assignedRules = getRulesForApiKey(keyId);

    return NextResponse.json(
      {
        Code: 200,
        Message: "Success",
        Data: {
          keyId,
          keyName: keyRow?.name || "",
          appId: keyRow?.app_id || "",
          appName: keyRow?.app_name || "",
          assignedRuleIds,
          rules: assignedRules,
        },
      },
      { headers: CORS_HEADERS }
    );
  } catch (err: any) {
    return NextResponse.json(
      { Code: 500, Message: err?.message || "Failed to fetch key rules", Data: null },
      { status: 500, headers: CORS_HEADERS }
    );
  }
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const authError = await requireManagementAuth(request);
  if (authError) return authError;

  try {
    const { id: keyId } = await params;
    if (!keyId) {
      return NextResponse.json(
        { Code: 400, Message: "Missing key id", Data: null },
        { status: 400, headers: CORS_HEADERS }
      );
    }

    const body = await request.json();
    const ruleIds = Array.isArray(body?.ruleIds) ? body.ruleIds : [];
    const appId = typeof body?.appId === "string" ? body.appId.trim() : undefined;
    const appName = typeof body?.appName === "string" ? body.appName.trim() : undefined;

    const { getDbInstance } = await import("@/lib/db/core");
    const db = getDbInstance();
    const existing = db.prepare("SELECT id FROM api_keys WHERE id = ?").get(keyId) as any;
    if (!existing) {
      return NextResponse.json(
        {
          Code: 404,
          Message: `API key '${keyId}' không tồn tại. Không thể liên kết rule book.`,
          Data: null,
        },
        { status: 404, headers: CORS_HEADERS }
      );
    }
    if (appId !== undefined) {
      db.prepare("UPDATE api_keys SET app_id = ?, app_name = ? WHERE id = ?").run(
        appId,
        appName ?? "",
        keyId
      );
    }

    assignRulesToApiKey(keyId, ruleIds);

    return NextResponse.json(
      {
        Code: 200,
        Message: `Successfully updated application info and assigned ${ruleIds.length} rule book(s).`,
        Data: {
          keyId,
          appId,
          appName,
          assignedRuleIds: ruleIds,
        },
      },
      { headers: CORS_HEADERS }
    );
  } catch (err: any) {
    return NextResponse.json(
      { Code: 500, Message: err?.message || "Failed to assign rules", Data: null },
      { status: 500, headers: CORS_HEADERS }
    );
  }
}
