import { NextResponse } from "next/server";
import path from "path";
import { getAllRuleBooks, syncDiskRuleBooks, createOrUpdateRuleBook } from "@/lib/db/ruleBooks";
import { requireManagementAuth } from "@/lib/api/requireManagementAuth";

export const dynamic = "force-dynamic";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, accept",
};

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: CORS_HEADERS,
  });
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    if (url.searchParams.get("sync") === "true") {
      syncDiskRuleBooks();
    }

    const rules = getAllRuleBooks();
    return NextResponse.json(
      {
        Code: 200,
        Message: "Success",
        Data: rules,
      },
      { headers: CORS_HEADERS }
    );
  } catch (err: any) {
    return NextResponse.json(
      {
        Code: 500,
        Message: err?.message || "Failed to retrieve rule books",
        Data: [],
      },
      { status: 500, headers: CORS_HEADERS }
    );
  }
}

export async function POST(request: Request) {
  const authError = await requireManagementAuth(request);
  if (authError) return authError;

  try {
    const body = await request.json();
    if (!body || !body.name || !body.fileName) {
      return NextResponse.json(
        {
          Code: 400,
          Message: "name and fileName are required.",
          Data: null,
        },
        { status: 400, headers: CORS_HEADERS }
      );
    }

    const safeFileName = path.basename(String(body.fileName).trim());
    if (!safeFileName) {
      return NextResponse.json(
        { Code: 400, Message: "Tên file không hợp lệ.", Data: null },
        { status: 400, headers: CORS_HEADERS }
      );
    }

    const rule = createOrUpdateRuleBook({
      name: body.name,
      fileName: safeFileName,
      relativePath: `rules/${safeFileName}`,
      category: body.category || "general",
      description: body.description || "",
    });

    return NextResponse.json(
      {
        Code: 200,
        Message: "Rule book created or updated successfully",
        Data: rule,
      },
      { headers: CORS_HEADERS }
    );
  } catch (err: any) {
    return NextResponse.json(
      {
        Code: 500,
        Message: err?.message || "Failed to save rule book",
        Data: null,
      },
      { status: 500, headers: CORS_HEADERS }
    );
  }
}
