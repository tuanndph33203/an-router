import { NextResponse } from "next/server";
import path from "path";
import fs from "fs";
import { createOrUpdateRuleBook } from "@/lib/db/ruleBooks";

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

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const files: File[] = [];
    const targetFolderRaw = String(formData.get("folder") || formData.get("appId") || "").trim();
    const safeFolder = targetFolderRaw
      ? path.basename(targetFolderRaw).split("..").join("").trim()
      : "";

    for (const [key, value] of formData.entries()) {
      if ((key === "files" || key === "file") && value instanceof File) {
        files.push(value);
      }
    }

    if (files.length === 0) {
      return NextResponse.json(
        {
          Code: 400,
          Message: "Không tìm thấy file nào được gửi lên.",
          Data: null,
        },
        { status: 400, headers: CORS_HEADERS }
      );
    }

    const rulesDir = path.resolve(process.cwd(), "rules");
    const targetDir = safeFolder ? path.resolve(rulesDir, safeFolder) : rulesDir;
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }

    const uploadedRules = [];

    for (const file of files) {
      const rawName = file.name || "custom.rule.md";
      const baseRaw = path.basename(rawName).trim();
      let finalFileName = baseRaw;
      if (!finalFileName.endsWith(".md") && !finalFileName.endsWith(".txt")) {
        finalFileName = `${finalFileName}.md`;
      }

      const filePath = path.resolve(targetDir, finalFileName);
      const buffer = Buffer.from(await file.arrayBuffer());
      fs.writeFileSync(filePath, buffer);

      const relFileName = safeFolder ? `${safeFolder}/${finalFileName}` : finalFileName;
      const baseNameWithoutExt = finalFileName
        .split(".rule.md")
        .join("")
        .split(".md")
        .join("")
        .split(".txt")
        .join("");
      const displayName = safeFolder
        ? `[${safeFolder.toUpperCase()}] ${baseNameWithoutExt.toUpperCase()} Rule Book`
        : `${baseNameWithoutExt.toUpperCase()} Rule Book`;

      const rule = createOrUpdateRuleBook({
        name: displayName,
        fileName: relFileName,
        relativePath: `rules/${relFileName}`,
        category: safeFolder || "business_rules",
        description: `Tải lên từ giao diện cấu hình (${new Date().toLocaleDateString("vi-VN")})`,
      });

      uploadedRules.push(rule);
    }

    return NextResponse.json(
      {
        Code: 200,
        Message: `Đã tải lên thành công ${uploadedRules.length} file quy chuẩn.`,
        Data: {
          uploadedRules,
          fileNames: uploadedRules.map((r) => r.fileName),
        },
      },
      { headers: CORS_HEADERS }
    );
  } catch (err: any) {
    console.error("[RulesUpload] Lỗi tải file quy chuẩn:", err);
    return NextResponse.json(
      {
        Code: 500,
        Message: err?.message || "Lỗi xử lý tải file lên hệ thống",
        Data: null,
      },
      { status: 500, headers: CORS_HEADERS }
    );
  }
}
