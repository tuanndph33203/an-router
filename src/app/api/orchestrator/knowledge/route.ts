import { NextResponse } from "next/server";
import {
  ingestDocumentsToKnowledgeDb,
  listKnowledgeDocumentsFromDb,
  deleteKnowledgeFromDb,
} from "@/lib/orchestrator/knowledgeRetriever";
import { extractTextFromDocumentBuffer } from "@/lib/orchestrator/documentExtractor";

export const dynamic = "force-dynamic";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
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
    const { searchParams } = new URL(request.url);
    const appId = (searchParams.get("appId") || "").trim().toLowerCase();
    if (!appId) {
      return NextResponse.json(
        {
          Code: 400,
          Message: "Thiếu tham số appId.",
          Data: null,
        },
        { status: 400, headers: CORS_HEADERS }
      );
    }

    const result = listKnowledgeDocumentsFromDb(appId);
    return NextResponse.json(
      {
        Code: 200,
        Message: "Lấy danh sách tài liệu trong DB Kiến thức thành công.",
        Data: result,
      },
      { headers: CORS_HEADERS }
    );
  } catch (err: any) {
    console.error("[KnowledgeDB GET] Error:", err);
    return NextResponse.json(
      {
        Code: 500,
        Message: err?.message || "Lỗi truy vấn DB Kiến thức.",
        Data: null,
      },
      { status: 500, headers: CORS_HEADERS }
    );
  }
}

export async function POST(request: Request) {
  try {
    const contentType = (request.headers.get("content-type") || "").toLowerCase();
    let appId = "";
    const docsToIngest: Array<{
      relativePath: string;
      content: string;
      folderName?: string;
    }> = [];

    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      appId = String(formData.get("appId") || "")
        .trim()
        .toLowerCase();
      const customFolderName = String(formData.get("folderName") || "").trim();

      const files: File[] = [];
      const relativePaths: string[] = [];

      for (const [key, value] of formData.entries()) {
        if ((key === "files" || key === "file") && value instanceof File) {
          files.push(value);
        } else if (key === "relativePaths" && typeof value === "string") {
          relativePaths.push(value);
        }
      }

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const relPath = (relativePaths[i] || file.name || `doc_${i + 1}.md`).trim();
        const lowerName = relPath.toLowerCase();
        const isSupportedFormat =
          lowerName.endsWith(".md") ||
          lowerName.endsWith(".markdown") ||
          lowerName.endsWith(".txt") ||
          lowerName.endsWith(".json") ||
          lowerName.endsWith(".csv") ||
          lowerName.endsWith(".pdf") ||
          lowerName.endsWith(".docx") ||
          lowerName.endsWith(".doc");

        if (!isSupportedFormat) continue;

        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const extracted = await extractTextFromDocumentBuffer(buffer, relPath);
        if (!extracted.text.trim()) continue;

        docsToIngest.push({
          relativePath: relPath,
          content: extracted.text,
          folderName: customFolderName || undefined,
        });
      }
    } else {
      const body = await request.json();
      appId = String(body?.appId || "")
        .trim()
        .toLowerCase();
      const rawDocs = Array.isArray(body?.documents) ? body.documents : [];
      for (const d of rawDocs) {
        if (d && typeof d.content === "string" && d.content.trim()) {
          docsToIngest.push({
            relativePath: String(d.relativePath || d.docName || "document.md").trim(),
            content: d.content,
            folderName: d.folderName ? String(d.folderName).trim() : undefined,
          });
        }
      }
    }

    if (!appId) {
      return NextResponse.json(
        {
          Code: 400,
          Message:
            "Vui lòng nhập định danh ứng dụng (App / Client Key) trước khi nạp kiến thức vào DB.",
          Data: null,
        },
        { status: 400, headers: CORS_HEADERS }
      );
    }

    if (docsToIngest.length === 0) {
      return NextResponse.json(
        {
          Code: 400,
          Message:
            "Không tìm thấy tài liệu hợp lệ (.md, .txt, .json, .csv) để nạp vào DB Kiến thức.",
          Data: null,
        },
        { status: 400, headers: CORS_HEADERS }
      );
    }

    const ingestResult = await ingestDocumentsToKnowledgeDb(appId, docsToIngest);
    const updatedList = listKnowledgeDocumentsFromDb(appId);

    return NextResponse.json(
      {
        Code: 200,
        Message: `Đã nạp trực tiếp ${ingestResult.documentsSaved} tài liệu (${ingestResult.totalChunksSaved} mục kiến thức) vào SQLite DB cho '${appId}'.`,
        Data: {
          ...ingestResult,
          ...updatedList,
        },
      },
      { headers: CORS_HEADERS }
    );
  } catch (err: any) {
    console.error("[KnowledgeDB POST] Error:", err);
    return NextResponse.json(
      {
        Code: 500,
        Message: err?.message || "Lỗi khi lưu tài liệu vào DB Kiến thức.",
        Data: null,
      },
      { status: 500, headers: CORS_HEADERS }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const appId = (searchParams.get("appId") || "").trim().toLowerCase();
    const docIdParam = searchParams.get("docId");
    const folderName = searchParams.get("folderName") || undefined;
    const clearAll = searchParams.get("clearAll") === "true";

    if (!appId) {
      return NextResponse.json(
        {
          Code: 400,
          Message: "Thiếu tham số appId.",
          Data: null,
        },
        { status: 400, headers: CORS_HEADERS }
      );
    }

    deleteKnowledgeFromDb(appId, {
      docId: docIdParam || undefined,
      folderName,
      clearAll,
    });

    const updatedList = listKnowledgeDocumentsFromDb(appId);
    return NextResponse.json(
      {
        Code: 200,
        Message: "Đã xóa tài liệu khỏi DB Kiến thức.",
        Data: updatedList,
      },
      { headers: CORS_HEADERS }
    );
  } catch (err: any) {
    console.error("[KnowledgeDB DELETE] Error:", err);
    return NextResponse.json(
      {
        Code: 500,
        Message: err?.message || "Lỗi xóa tài liệu khỏi DB Kiến thức.",
        Data: null,
      },
      { status: 500, headers: CORS_HEADERS }
    );
  }
}
