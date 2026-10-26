import { createHash, randomUUID } from "crypto";
import path from "path";
import os from "os";
import { getDbInstance } from "@/lib/db/core";
import { callInternalLlm } from "./planEngine";


let betterDbWithVecInstance: any = null;

export function getBetterDbWithVec(): any {
  if (betterDbWithVecInstance) return betterDbWithVecInstance;
  try {
    const dbMod = require("better-sqlite3");
    const sqliteVec = require("sqlite-vec");
    const dbPath = process.env.SQLITE_FILE || path.join(os.homedir(), ".omniroute", "storage.sqlite");
    const db = new dbMod(dbPath);
    sqliteVec.load(db);
    betterDbWithVecInstance = db;
    return db;
  } catch (err) {
    return getDbInstance();
  }
}

/**
 * Sinh vector ngữ nghĩa 128 chiều chuẩn hóa L2 từ văn bản thuần túy (Không dùng Regex).
 * Tương thích trực tiếp với bảng ảo vec0 của sqlite-vec.
 */
export function generateSemanticVector(text: string, dim: number = 128): Float32Array {
  const vec = new Float32Array(dim);
  const clean = text.toLowerCase();
  
  const words = clean.split(" ").map((w) => w.trim()).filter((w) => w.length > 0);
  for (const w of words) {
    let h1 = 0x811c9dc5;
    let h2 = 0x45d9f3b;
    for (let i = 0; i < w.length; i++) {
      const code = w.charCodeAt(i);
      h1 = Math.imul(h1 ^ code, 0x01000193);
      h2 = Math.imul(h2 ^ code, 0x5bd1e995);
    }
    const idx = Math.abs(h1) % dim;
    const sign = (h2 & 1) === 0 ? 1.0 : -1.0;
    vec[idx] += sign * (1.0 + Math.min(w.length, 8) * 0.2);
  }

  for (let i = 0; i <= clean.length - 3; i++) {
    const gram = clean.slice(i, i + 3);
    let h = 0x811c9dc5;
    for (let j = 0; j < 3; j++) {
      h = Math.imul(h ^ gram.charCodeAt(j), 0x01000193);
    }
    const idx = Math.abs(h) % dim;
    vec[idx] += 0.3;
  }

  let norm = 0;
  for (let i = 0; i < dim; i++) norm += vec[i] * vec[i];
  norm = Math.sqrt(norm);
  if (norm > 0) {
    for (let i = 0; i < dim; i++) vec[i] /= norm;
  }
  return vec;
}

export interface KnowledgeChunk {
  index: number;
  id: string;
  docId?: string;
  sourceName: string;
  heading: string;
  breadcrumb: string;
  preview: string;
  content: string;
}

export interface KnowledgeDocumentSummary {
  id: string;
  appId: string;
  docName: string;
  folderName: string;
  relativePath: string;
  rawSize: number;
  chunkCount: number;
  updatedAt: string;
}

let isSchemaEnsured = false;

/**
 * Khởi tạo các bảng DB Lưu Kiến Thức (`knowledge_documents` & `knowledge_chunks`) trong SQLite.
 * Hoàn toàn lưu trữ trong Database, tách biệt với các file `.md` chứa Rule luồng cố định.
 */
export function ensureKnowledgeDbSchema(): void {
  if (isSchemaEnsured) return;
  try {
    const db = getDbInstance();
    db.exec(`
      CREATE TABLE IF NOT EXISTS knowledge_documents (
        id TEXT PRIMARY KEY,
        app_id TEXT NOT NULL,
        doc_name TEXT NOT NULL,
        folder_name TEXT NOT NULL DEFAULT '',
        relative_path TEXT NOT NULL,
        content_hash TEXT NOT NULL,
        raw_size INTEGER NOT NULL DEFAULT 0,
        chunk_count INTEGER NOT NULL DEFAULT 0,
        updated_at TEXT NOT NULL,
        UNIQUE(app_id, relative_path)
      );

      CREATE TABLE IF NOT EXISTS knowledge_chunks (
        id TEXT PRIMARY KEY,
        doc_id TEXT NOT NULL DEFAULT '',
        app_id TEXT NOT NULL,
        relative_path TEXT NOT NULL DEFAULT '',
        chunk_index INTEGER NOT NULL,
        source_name TEXT NOT NULL,
        heading TEXT NOT NULL,
        breadcrumb TEXT NOT NULL,
        preview TEXT NOT NULL,
        content TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
    `);

    // Tự động nâng cấp bảng knowledge_chunks cũ nếu thiếu cột doc_id hoặc relative_path
    const cols = db.prepare("PRAGMA table_info(knowledge_chunks)").all() as Array<{ name: string }>;
    const colNames = new Set(cols.map((c) => c.name));
    if (!colNames.has("doc_id")) {
      db.exec("ALTER TABLE knowledge_chunks ADD COLUMN doc_id TEXT NOT NULL DEFAULT ''");
    }
    if (!colNames.has("relative_path")) {
      db.exec("ALTER TABLE knowledge_chunks ADD COLUMN relative_path TEXT NOT NULL DEFAULT ''");
    }

    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_knowledge_docs_app
        ON knowledge_documents(app_id, folder_name, relative_path);

      CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_app
        ON knowledge_chunks(app_id, doc_id, chunk_index);

      CREATE VIRTUAL TABLE IF NOT EXISTS fts_knowledge_chunks USING fts5(
        chunk_id UNINDEXED,
        app_id UNINDEXED,
        heading,
        breadcrumb,
        preview,
        content,
        tokenize = 'unicode61'
      );
    `);
        try {
      const vecDb = getBetterDbWithVec();
      vecDb.exec(`
        CREATE VIRTUAL TABLE IF NOT EXISTS vec_knowledge_chunks USING vec0(
          chunk_rowid INTEGER PRIMARY KEY,
          embedding float[128]
        );
      `);
    } catch {}
    isSchemaEnsured = true;
  } catch (err) {
    console.warn("[KnowledgeDB] Could not ensure knowledge DB schema:", err);
  }
}

/**
 * Chuẩn hóa khoảng trắng bằng thao tác chuỗi thuần túy (Không dùng Regex).
 */
function collapseWhitespace(input: string): string {
  if (!input) return "";
  const parts: string[] = [];
  let current = "";
  for (let i = 0; i < input.length; i++) {
    const code = input.charCodeAt(i);
    const isSpace = code === 32 || code === 9 || code === 10 || code === 13;
    if (isSpace) {
      if (current.length > 0) {
        parts.push(current);
        current = "";
      }
    } else {
      current += input[i];
    }
  }
  if (current.length > 0) {
    parts.push(current);
  }
  return parts.join(" ");
}

/**
 * Kiểm tra xem dòng có phải là thẻ đánh dấu nguồn từ nội dung hay không (Không dùng Regex).
 */
function extractRuleSourceMarker(trimmedLine: string): string | null {
  if (trimmedLine.startsWith("<!--") && trimmedLine.endsWith("-->")) {
    const inner = trimmedLine.slice(4, trimmedLine.length - 3).trim();
    const lowerInner = inner.toLowerCase();
    if (lowerInner.startsWith("rule:")) {
      const source = inner.slice(5).trim();
      if (source) return source;
    }
  }

  if (trimmedLine.startsWith("---") && trimmedLine.toUpperCase().includes("RULE BOOK:")) {
    const openBracket = trimmedLine.indexOf("[");
    const closeBracket = trimmedLine.indexOf("]", openBracket + 1);
    if (openBracket !== -1 && closeBracket !== -1) {
      const source = trimmedLine.slice(openBracket + 1, closeBracket).trim();
      if (source) return source;
    }
  }

  return null;
}

/**
 * Cắt văn bản tài liệu kiến thức theo cấu trúc Heading (#, ##, ###) kèm Breadcrumb ngữ cảnh.
 * Hoàn toàn dùng thao tác chuỗi thuần túy, tuyệt đối không dùng bất kỳ Regex nào.
 */
export function chunkMarkdownByHeadings(
  rawMarkdown: string,
  defaultSourceName: string = "KnowledgeDB"
): KnowledgeChunk[] {
  if (!rawMarkdown || !rawMarkdown.trim()) return [];

  const lines = rawMarkdown.split("\n");
  const chunks: KnowledgeChunk[] = [];
  const seenSignatures = new Set<string>();

  let currentSource = defaultSourceName;
  let h1 = "";
  let h2 = "";
  let h3 = "";
  let buffer: string[] = [];

  const flushBuffer = () => {
    const body = buffer.join("\n").trim();
    buffer = [];
    if (!body || body.length < 10) return;

    const headingParts = [h1, h2, h3].filter(Boolean);
    const activeHeading = headingParts[headingParts.length - 1] || "Kiến thức nghiệp vụ";
    const breadcrumb = `[Nguồn: ${currentSource}${
      headingParts.length ? " > " + headingParts.join(" > ") : ""
    }]`;

    const normalizedSig = collapseWhitespace(body).slice(0, 220).toLowerCase();
    if (seenSignatures.has(normalizedSig)) {
      return;
    }
    seenSignatures.add(normalizedSig);

    const bodyWithoutHeadingLines = body
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l.length > 0 && !l.startsWith("#"))
      .join(" ");
    if (!bodyWithoutHeadingLines) return;
    const preview = collapseWhitespace(bodyWithoutHeadingLines).slice(0, 220);

    const idx = chunks.length;
    chunks.push({
      index: idx,
      id: `chunk_${idx}`,
      sourceName: currentSource,
      heading: activeHeading,
      breadcrumb,
      preview,
      content: `${breadcrumb}\n${body}`,
    });
  };

  for (const rawLine of lines) {
    const line = rawLine.endsWith("\r") ? rawLine.slice(0, -1) : rawLine;
    const trimmed = line.trim();

    const markerSource = extractRuleSourceMarker(trimmed);
    if (markerSource) {
      flushBuffer();
      currentSource = markerSource;
      continue;
    }

    if (trimmed.startsWith("### ")) {
      flushBuffer();
      h3 = trimmed.slice(4).trim();
      buffer.push(line);
    } else if (trimmed.startsWith("## ")) {
      flushBuffer();
      h2 = trimmed.slice(3).trim();
      h3 = "";
      buffer.push(line);
    } else if (trimmed.startsWith("# ")) {
      flushBuffer();
      h1 = trimmed.slice(2).trim();
      h2 = "";
      h3 = "";
      buffer.push(line);
    } else {
      buffer.push(line);
    }
  }

  flushBuffer();
  return chunks;
}

/**
 * Trích xuất mảng JSON đầu tiên trong chuỗi phản hồi của LLM (Không dùng Regex).
 */
function extractFirstJsonArray(rawText: string): string | null {
  if (!rawText) return null;
  const startIdx = rawText.indexOf("[");
  if (startIdx === -1) return null;

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = startIdx; i < rawText.length; i++) {
    const ch = rawText[i];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (ch === "\\") {
      escaped = true;
      continue;
    }
    if (ch === '"') {
      inString = !inString;
      continue;
    }
    if (!inString) {
      if (ch === "[") depth++;
      else if (ch === "]") {
        depth--;
        if (depth === 0) {
          return rawText.slice(startIdx, i + 1);
        }
      }
    }
  }
  return null;
}

/**
 * Băm tài liệu theo đoạn văn / bảng biểu khi văn bản không có tiêu đề Markdown (Không dùng Regex).
 */
function chunkDocumentByParagraphs(
  rawText: string,
  sourceName: string,
  maxWordsPerChunk: number = 400
): KnowledgeChunk[] {
  if (!rawText || !rawText.trim()) return [];
  const lines = rawText.split("\n");
  const chunks: KnowledgeChunk[] = [];
  let currentLines: string[] = [];
  let wordCount = 0;

  const flush = () => {
    const body = currentLines.join("\n").trim();
    currentLines = [];
    wordCount = 0;
    if (!body || body.length < 15) return;

    const preview = collapseWhitespace(body).slice(0, 200);
    const idx = chunks.length;
    const heading = `Mục kiến thức ${idx + 1} (${sourceName})`;
    const breadcrumb = `[Nguồn: ${sourceName} > Mục ${idx + 1}]`;

    chunks.push({
      index: idx,
      id: `chunk_${idx}`,
      sourceName,
      heading,
      breadcrumb,
      preview,
      content: `${breadcrumb}\n${body}`,
    });
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) {
      if (wordCount >= maxWordsPerChunk) flush();
      continue;
    }
    const wordsInLine = line.split(" ").filter(Boolean).length;
    currentLines.push(line);
    wordCount += wordsInLine;

    if (wordCount >= maxWordsPerChunk) {
      flush();
    }
  }

  flush();
  return chunks;
}

/**
 * TÍCH HỢP NÃO AI ĐỂ CHƯNG CẤT TRI THỨC (AI Knowledge Distiller):
 * Đọc file phức tạp (PDF bảng biểu, Word testcase, tài liệu không cấu trúc) và
 * tự động trích xuất các quy tắc, điều kiện và công thức tính toán thành các mục sạch sẽ.
 */
export async function distillDocumentWithAi(
  rawContent: string,
  sourceName: string
): Promise<KnowledgeChunk[]> {
  if (!rawContent || !rawContent.trim()) return [];

  // Nếu tài liệu có cấu trúc Markdown rõ ràng và ngắn (< 5000 ký tự), dùng băm heading thuần túy
  const hasMarkdownHeadings =
    rawContent.includes("# ") || rawContent.includes("## ") || rawContent.includes("### ");
  if (hasMarkdownHeadings && rawContent.length < 5000) {
    return chunkMarkdownByHeadings(rawContent, sourceName);
  }

  // Gọi Bộ Não AI (Gemini Flash) để chưng cất tri thức
  try {
    const prompt = `Bạn là Chuyên gia Chưng cất Tri thức Nghiệp vụ (Enterprise Knowledge Distiller).
Nhiệm vụ của bạn là đọc kỹ tài liệu dưới đây và trích xuất thành danh sách các MỤC KIẾN THỨC NGHIỆP VỤ ĐỘC LẬP để nạp vào Database tra cứu tự động cho AI điều phối báo cáo & API.

TÀI LIỆU CẦN CHƯNG CẤT (Nguồn: ${sourceName}):
"""
${rawContent.slice(0, 25000)}
"""

YÊU CẦU BẮT BUỘC:
1. Trích xuất tất cả:
   - CÁC CÔNG THỨC TÍNH TOÁN / TÀI CHÍNH (ví dụ: totalPayment, totalAmount, chiết khấu, thuế, cách tính doanh thu...).
   - CÁC QUY TẮC NGHIỆP VỤ (Điều kiện xuất hóa đơn, áp dụng CTKM, trạng thái hợp lệ, logic trừ hủy...).
   - ÁNH XẠ BẢNG / TRƯỜNG CƠ SỞ DỮ LIỆU (nếu có đề cập).
2. Tách nhỏ thành từng mục riêng biệt theo từng chức năng / phân hệ.
3. Bỏ qua các thông tin rác (link screenshot, id testcase thừa, nhật ký bug không liên quan đến logic).
4. Mỗi mục gồm:
   - "heading": Tiêu đề ngắn gọn phản ánh đúng quy tắc (ví dụ: "Công thức tính Doanh thu Thẻ NoName")
   - "breadcrumb": Ngữ cảnh phân cấp đầy đủ (ví dụ: "[Nguồn: ${sourceName} > Phân hệ Bán Thẻ > Công thức]")
   - "preview": Tóm tắt 1-2 câu nội dung cốt lõi của mục
   - "content": Toàn bộ nội dung quy tắc hoặc công thức chi tiết, rõ ràng

Định dạng trả về: DUY NHẤT một mảng JSON chuẩn:
[
  {
    "heading": "Tiêu đề mục",
    "breadcrumb": "[Nguồn: ...]",
    "preview": "Tóm tắt...",
    "content": "Nội dung quy tắc chi tiết..."
  }
]`;

    const llmRaw = await callInternalLlm([{ role: "user", content: prompt }]);
    const jsonStr = extractFirstJsonArray(llmRaw);
    if (jsonStr) {
      const parsed = JSON.parse(jsonStr);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.map((item: any, idx: number) => ({
          index: idx,
          id: `chunk_${idx}`,
          sourceName,
          heading: String(item.heading || `Quy tắc ${idx + 1}`).trim(),
          breadcrumb: String(item.breadcrumb || `[Nguồn: ${sourceName}]`).trim(),
          preview: String(item.preview || "").trim(),
          content: String(item.content || "").trim(),
        }));
      }
    }
  } catch (err: any) {
    console.warn(`[KnowledgeDB] AI Distiller fallback for ${sourceName}:`, err?.message || err);
  }

  // Fallback an toàn: nếu AI không phản hồi, băm theo cấu trúc heading hoặc đoạn văn
  const headingChunks = chunkMarkdownByHeadings(rawContent, sourceName);
  if (headingChunks.length > 0) return headingChunks;
  return chunkDocumentByParagraphs(rawContent, sourceName);
}

/**
 * Nạp (Ingest) danh sách tài liệu từ Folder hoặc File trực tiếp vào SQLite DB (`knowledge_documents` & `knowledge_chunks`).
 * Không tạo file vật lý trong thư mục `rules/`.
 */
export async function ingestDocumentsToKnowledgeDb(
  appId: string,
  documents: Array<{ relativePath: string; content: string }>
): Promise<{
  documentsSaved: number;
  totalChunksSaved: number;
  items: KnowledgeDocumentSummary[];
}> {
  ensureKnowledgeDbSchema();
  const normalizedAppId = (appId || "").toLowerCase().trim();
  if (!normalizedAppId) {
    throw new Error("Thiếu mã ứng dụng (appId) khi lưu vào DB Kiến thức.");
  }

  console.log(`📥 [KnowledgeRetriever:Ingest] Starting ingestion of ${documents.length} doc(s) for appId="${normalizedAppId}"`);

  const db = getDbInstance();
  const now = new Date().toISOString();
  let documentsSaved = 0;
  let totalChunksSaved = 0;
  const savedSummaries: KnowledgeDocumentSummary[] = [];

  for (const doc of documents) {
    const rawContent = (doc.content || "").trim();
    if (!rawContent) continue;

    const cleanRelPath = (doc.relativePath || "document.md")
      .split("\\")
      .join("/")
      .split("/")
      .map((s) => s.trim())
      .filter((s) => s.length > 0 && s !== "." && s !== "..")
      .join("/");

    const pathSegments = cleanRelPath.split("/");
    const docName = pathSegments[pathSegments.length - 1] || "document.md";
    const folderName =
      pathSegments.length > 1 ? pathSegments.slice(0, pathSegments.length - 1).join("/") : "";

    const contentHash = createHash("sha256").update(rawContent).digest("hex");
    const rawSize = Buffer.byteLength(rawContent, "utf-8");

    const existingDoc = db
      .prepare(
        "SELECT id, content_hash FROM knowledge_documents WHERE app_id = ? AND relative_path = ?"
      )
      .get(normalizedAppId, cleanRelPath) as { id: string; content_hash: string } | undefined;

    const docId = existingDoc?.id || `kdoc_${randomUUID().split("-").join("").slice(0, 16)}`;

    // Tích hợp Não AI để chưng cất thành các mục kiến thức độc lập
    const chunks = await distillDocumentWithAi(rawContent, cleanRelPath);

    // Xóa chunks cũ của tài liệu này và nạp mới vào DB
    db.prepare("DELETE FROM knowledge_chunks WHERE app_id = ? AND doc_id = ?").run(
      normalizedAppId,
      docId
    );
    db.prepare("DELETE FROM knowledge_chunks WHERE app_id = ? AND relative_path = ?").run(
      normalizedAppId,
      cleanRelPath
    );
    try {
      db.prepare("DELETE FROM fts_knowledge_chunks WHERE app_id = ? AND chunk_id LIKE ?").run(
        normalizedAppId,
        `${docId}_%`
      );
    } catch {}

    const insertChunk = db.prepare(`
      INSERT INTO knowledge_chunks (
        id, doc_id, app_id, relative_path, chunk_index, source_name, heading, breadcrumb, preview, content, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    let insertFts: any = null;
    try {
      insertFts = db.prepare(`
        INSERT INTO fts_knowledge_chunks (
          chunk_id, app_id, heading, breadcrumb, preview, content
        ) VALUES (?, ?, ?, ?, ?, ?)
      `);
    } catch {}

    let insertVec: any = null;
    try {
      const vecDb = getBetterDbWithVec();
      insertVec = vecDb.prepare(`
        INSERT OR REPLACE INTO vec_knowledge_chunks (chunk_rowid, embedding)
        VALUES (?, ?)
      `);
    } catch {}

    for (const c of chunks) {
      const chunkId = `${docId}_${c.index}`;
      insertChunk.run(
        chunkId,
        docId,
        normalizedAppId,
        cleanRelPath,
        c.index,
        c.sourceName,
        c.heading,
        c.breadcrumb,
        c.preview,
        c.content,
        now
      );

      if (insertFts) {
        try {
          insertFts.run(
            chunkId,
            normalizedAppId,
            c.heading,
            c.breadcrumb,
            c.preview,
            c.content
          );
        } catch {}
      }

      if (insertVec) {
        try {
          const rowInfo = db.prepare("SELECT rowid FROM knowledge_chunks WHERE id = ?").get(chunkId) as any;
          if (rowInfo?.rowid) {
            const textToEmbed = `${c.heading || ""} ${c.breadcrumb || ""} ${c.content || ""}`;
            const v = generateSemanticVector(textToEmbed);
            insertVec.run(BigInt(rowInfo.rowid), v);
          }
        } catch {}
      }
    }

    db.prepare(
      `
      INSERT INTO knowledge_documents (
        id, app_id, doc_name, folder_name, relative_path, content_hash, raw_size, chunk_count, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(app_id, relative_path) DO UPDATE SET
        doc_name = excluded.doc_name,
        folder_name = excluded.folder_name,
        content_hash = excluded.content_hash,
        raw_size = excluded.raw_size,
        chunk_count = excluded.chunk_count,
        updated_at = excluded.updated_at
    `
    ).run(
      docId,
      normalizedAppId,
      docName,
      folderName,
      cleanRelPath,
      contentHash,
      rawSize,
      chunks.length,
      now
    );

    documentsSaved++;
    totalChunksSaved += chunks.length;
    savedSummaries.push({
      id: docId,
      appId: normalizedAppId,
      docName,
      folderName,
      relativePath: cleanRelPath,
      rawSize,
      chunkCount: chunks.length,
      updatedAt: now,
    });
  }

  return {
    documentsSaved,
    totalChunksSaved,
    items: savedSummaries,
  };
}

/**
 * Lấy danh sách các tài liệu/folder đã được lưu trong DB Kiến thức của một ứng dụng.
 */
export function listKnowledgeDocumentsFromDb(appId: string): {
  documents: KnowledgeDocumentSummary[];
  totalDocuments: number;
  totalChunks: number;
  folders: string[];
} {
  ensureKnowledgeDbSchema();
  const normalizedAppId = (appId || "").toLowerCase().trim();
  if (!normalizedAppId) {
    return { documents: [], totalDocuments: 0, totalChunks: 0, folders: [] };
  }

  try {
    const db = getDbInstance();
    const rows = db
      .prepare(
        `SELECT id, app_id, doc_name, folder_name, relative_path, raw_size, chunk_count, updated_at
         FROM knowledge_documents
         WHERE app_id = ?
         ORDER BY folder_name ASC, doc_name ASC`
      )
      .all(normalizedAppId) as Array<{
      id: string;
      app_id: string;
      doc_name: string;
      folder_name: string;
      relative_path: string;
      raw_size: number;
      chunk_count: number;
      updated_at: string;
    }>;

    const documents: KnowledgeDocumentSummary[] = rows.map((r) => ({
      id: r.id,
      appId: r.app_id,
      docName: r.doc_name,
      folderName: r.folder_name || "",
      relativePath: r.relative_path,
      rawSize: r.raw_size,
      chunkCount: r.chunk_count,
      updatedAt: r.updated_at,
    }));

    const totalChunks = documents.reduce((acc, d) => acc + (d.chunkCount || 0), 0);
    const folders = Array.from(
      new Set(documents.map((d) => d.folderName).filter((f) => Boolean(f)))
    );

    return {
      documents,
      totalDocuments: documents.length,
      totalChunks,
      folders,
    };
  } catch (err) {
    console.warn("[KnowledgeDB] Failed to list knowledge documents:", err);
    return { documents: [], totalDocuments: 0, totalChunks: 0, folders: [] };
  }
}

/**
 * Xóa một tài liệu, một folder, hoặc toàn bộ kho kiến thức trong DB của ứng dụng.
 */
export function deleteKnowledgeFromDb(
  appId: string,
  options?: { docId?: string; folderName?: string; clearAll?: boolean }
): number {
  ensureKnowledgeDbSchema();
  const normalizedAppId = (appId || "").toLowerCase().trim();
  if (!normalizedAppId) return 0;

  const db = getDbInstance();
  if (options?.clearAll) {
    db.prepare("DELETE FROM knowledge_chunks WHERE app_id = ?").run(normalizedAppId);
    try {
      db.prepare("DELETE FROM fts_knowledge_chunks WHERE app_id = ?").run(normalizedAppId);
    } catch {}
    const res = db.prepare("DELETE FROM knowledge_documents WHERE app_id = ?").run(normalizedAppId);
    return Number(res.changes || 0);
  }

  if (options?.docId) {
    db.prepare("DELETE FROM knowledge_chunks WHERE app_id = ? AND doc_id = ?").run(
      normalizedAppId,
      options.docId
    );
    try {
      db.prepare("DELETE FROM fts_knowledge_chunks WHERE app_id = ? AND chunk_id LIKE ?").run(
        normalizedAppId,
        `${options.docId}_%`
      );
    } catch {}
    const res = db
      .prepare("DELETE FROM knowledge_documents WHERE app_id = ? AND id = ?")
      .run(normalizedAppId, options.docId);
    return Number(res.changes || 0);
  }

  if (options?.folderName) {
    const docsInFolder = db
      .prepare("SELECT id FROM knowledge_documents WHERE app_id = ? AND folder_name = ?")
      .all(normalizedAppId, options.folderName) as Array<{ id: string }>;
    for (const d of docsInFolder) {
      db.prepare("DELETE FROM knowledge_chunks WHERE app_id = ? AND doc_id = ?").run(
        normalizedAppId,
        d.id
      );
      try {
        db.prepare("DELETE FROM fts_knowledge_chunks WHERE app_id = ? AND chunk_id LIKE ?").run(
          normalizedAppId,
          `${d.id}_%`
        );
      } catch {}
    }
    const res = db
      .prepare("DELETE FROM knowledge_documents WHERE app_id = ? AND folder_name = ?")
      .run(normalizedAppId, options.folderName);
    return Number(res.changes || 0);
  }

  return 0;
}

/**
 * Đọc toàn bộ các chunk kiến thức từ bảng SQLite `knowledge_chunks` của ứng dụng
 * để phục vụ Luồng Search Nghiệp Vụ (Nằm giữa OpenAPI Locator và DB Table Locator).
 */
export function loadKnowledgeChunksFromDb(appId: string): KnowledgeChunk[] {
  ensureKnowledgeDbSchema();
  const normalizedAppId = (appId || "").toLowerCase().trim();
  if (!normalizedAppId) return [];

  try {
    const db = getDbInstance();
    const rows = db
      .prepare(
        `SELECT id, doc_id, source_name, heading, breadcrumb, preview, content
         FROM knowledge_chunks
         WHERE app_id = ?
         ORDER BY relative_path ASC, chunk_index ASC`
      )
      .all(normalizedAppId) as Array<{
      id: string;
      doc_id: string;
      source_name: string;
      heading: string;
      breadcrumb: string;
      preview: string;
      content: string;
    }>;

    return rows.map((r, idx) => ({
      index: idx,
      id: r.id,
      docId: r.doc_id,
      sourceName: r.source_name,
      heading: r.heading,
      breadcrumb: r.breadcrumb,
      preview: r.preview,
      content: r.content,
    }));
  } catch (err) {
    console.warn("[KnowledgeDB] Failed to load knowledge chunks from DB:", err);
    return [];
  }
}

/**
 * Xây dựng danh mục tóm tắt các mục trong DB Kiến thức để LLM (Business Rule Search Locator)
 * định vị mục kiến thức cần nạp.
 */
export function buildRuleBookCatalogForLocator(chunks: KnowledgeChunk[]): string {
  if (!chunks || chunks.length === 0) return "";
  return chunks.map((c) => `[${c.index}] ${c.breadcrumb} — ${c.preview || c.heading}`).join("\n");
}

/**
 * Ghép các mục Kiến thức từ DB đã được chọn bởi Luồng Search Nghiệp Vụ.
 */
export function assembleSelectedRuleChunks(
  chunks: KnowledgeChunk[],
  selectedIndices: number[]
): {
  matchedContent: string;
  selectedChunks: KnowledgeChunk[];
} {
  if (!chunks || chunks.length === 0) {
    return { matchedContent: "", selectedChunks: [] };
  }

  const uniqueValidIndices = Array.from(
    new Set(selectedIndices.filter((i) => typeof i === "number" && i >= 0 && i < chunks.length))
  ).sort((a, b) => a - b);

  const effectiveChunks =
    uniqueValidIndices.length > 0 ? uniqueValidIndices.map((i) => chunks[i]) : [];

  return {
    matchedContent: effectiveChunks.map((c) => c.content).join("\n\n"),
    selectedChunks: effectiveChunks,
  };
}

/**
 * Trích xuất chuỗi JSON object đầu tiên (Không dùng Regex).
 */
function extractFirstJsonObject(rawText: string): string | null {
  if (!rawText) return null;
  const startIdx = rawText.indexOf("{");
  if (startIdx === -1) return null;

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = startIdx; i < rawText.length; i++) {
    const ch = rawText[i];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (ch === "\\") {
      escaped = true;
      continue;
    }
    if (ch === '"') {
      inString = !inString;
      continue;
    }
    if (!inString) {
      if (ch === "{") depth++;
      else if (ch === "}") {
        depth--;
        if (depth === 0) {
          return rawText.slice(startIdx, i + 1);
        }
      }
    }
  }
  return null;
}

/**
 * Trích xuất các từ khóa an toàn cho câu truy vấn FTS5 (Không dùng Regex).
 */
function sanitizeQueryForFts5(query: string): string {
  if (!query) return "";
  const words: string[] = [];
  const rawParts = query.split(" ");
  for (const part of rawParts) {
    let clean = "";
    for (let i = 0; i < part.length; i++) {
      const code = part.charCodeAt(i);
      const isAlphanumeric =
        (code >= 48 && code <= 57) ||
        (code >= 65 && code <= 90) ||
        (code >= 97 && code <= 122) ||
        code >= 192;
      if (isAlphanumeric) {
        clean += part[i];
      }
    }
    if (clean.length >= 2) {
      words.push(`"${clean}"`);
    }
  }
  return words.join(" OR ");
}

/**
 * Tách các từ đơn phục vụ Semantic / Token Overlap (Không dùng Regex).
 */
function extractSearchTokens(text: string): string[] {
  if (!text) return [];
  const tokens: string[] = [];
  const parts = text.toLowerCase().split(" ");
  for (const part of parts) {
    let clean = "";
    for (let i = 0; i < part.length; i++) {
      const code = part.charCodeAt(i);
      const isAlphanumeric =
        (code >= 48 && code <= 57) ||
        (code >= 65 && code <= 90) ||
        (code >= 97 && code <= 122) ||
        code >= 192;
      if (isAlphanumeric) {
        clean += part[i];
      }
    }
    if (clean.length >= 2) {
      tokens.push(clean);
    }
  }
  return tokens;
}

export interface SearchKnowledgeOptions {
  topK?: number;
  useReranker?: boolean;
}

export interface KnowledgeSearchResult {
  topChunks: KnowledgeChunk[];
  matchedContent: string;
  isGreeting: boolean;
  greetingReply?: string;
}

/**
 * BỘ HÀM MULTI-SEARCH KIẾN THỨC + RERANKER (Advanced RAG):
 * 1. Nhánh 1: FTS5 Full-Text Search (Sparse Search) - Tìm chính xác từ khóa, mã code, tên bảng.
 * 2. Nhánh 2: Semantic / Token Matching (Dense Search) - Tính điểm xuất hiện theo ngữ cảnh.
 * 3. Fusion: Gom kết quả bằng thuật toán RRF (Reciprocal Rank Fusion).
 * 4. Reranker: Chấm điểm lại mức độ phù hợp để chọn ra Top-K mục tinh hoa nhất.
 */
export async function searchKnowledgeBase(
  appId: string,
  query: string,
  options?: SearchKnowledgeOptions
): Promise<KnowledgeSearchResult> {
  ensureKnowledgeDbSchema();
  const normalizedAppId = (appId || "").toLowerCase().trim();
  const topK = options?.topK || 3;

  if (!normalizedAppId || !query || !query.trim()) {
    return { topChunks: [], matchedContent: "", isGreeting: false };
  }

  const allChunks = loadKnowledgeChunksFromDb(normalizedAppId);
  if (allChunks.length === 0) {
    return { topChunks: [], matchedContent: "", isGreeting: false };
  }

  console.log(`\n📚 [KnowledgeRetriever:searchKnowledgeBase] START | appId: "${normalizedAppId}" | query: "${query}" | totalLoadedChunks: ${allChunks.length} | topK: ${topK}`);

  // Nếu kho kiến thức chỉ có <= topK mục, trả về trực tiếp
  if (allChunks.length <= topK) {
    console.log(`📚 [KnowledgeRetriever:searchKnowledgeBase] Total chunks (${allChunks.length}) <= topK (${topK}), returning directly.`);
    return {
      topChunks: allChunks,
      matchedContent: allChunks.map((c) => c.content).join("\n\n"),
      isGreeting: false,
    };
  }

  const db = getDbInstance();
  const chunkMap = new Map<string, KnowledgeChunk>();
  allChunks.forEach((c) => chunkMap.set(c.id, c));

  // =============================================================
  // HYBRID RRF: SQLITE-VEC (Dense) + FTS5 (Sparse) qua better-sqlite3
  // =============================================================
  let candidateChunks: KnowledgeChunk[] = [];
  try {
    const vecDb = getBetterDbWithVec();
    const queryVec = generateSemanticVector(query);
    const ftsTerm = sanitizeQueryForFts5(query);

    console.log(`   🔹 [sqlite-vec] Generated 128-dim dense embedding`);
    console.log(`   🔹 [FTS5] Sanitized sparse query term: "${ftsTerm}"`);
    console.log(`   ⚡ [Hybrid RRF] Executing Alex Garcia native SQL fusion on SQLite...`);

    const ftsClause = ftsTerm
      ? "fts.app_id = ? AND fts_knowledge_chunks MATCH ?"
      : "fts.app_id = ? AND fts.chunk_id IS NOT NULL";

    const hybridSql = `
      WITH vec_results AS (
        SELECT v.chunk_rowid AS rowid,
               ROW_NUMBER() OVER (ORDER BY v.distance ASC) AS vec_rank,
               v.distance AS vec_distance
        FROM vec_knowledge_chunks v
        JOIN knowledge_chunks k ON k.rowid = v.chunk_rowid
        WHERE v.embedding MATCH ?
          AND k.app_id = ?
          AND k = 10
      ),
      fts_results AS (
        SELECT k.rowid,
               ROW_NUMBER() OVER (ORDER BY fts.rank ASC) AS fts_rank,
               fts.rank AS fts_score
        FROM fts_knowledge_chunks fts
        JOIN knowledge_chunks k ON k.id = fts.chunk_id
        WHERE ${ftsClause}
        LIMIT 10
      ),
      fused AS (
        SELECT
          rowid,
          MAX(vec_rank) AS vec_rank,
          MAX(fts_rank) AS fts_rank,
          MAX(vec_distance) AS vec_distance,
          MAX(fts_score) AS fts_score,
          SUM(rrf_contrib) AS rrf_score
        FROM (
          SELECT rowid, vec_rank, NULL AS fts_rank, vec_distance, NULL AS fts_score, 1.0 / (60 + vec_rank) AS rrf_contrib
          FROM vec_results
          UNION ALL
          SELECT rowid, NULL, fts_rank, NULL, fts_score, 1.0 / (60 + fts_rank) AS rrf_contrib
          FROM fts_results
        )
        GROUP BY rowid
      )
      SELECT k.id, k.app_id, k.heading, k.breadcrumb, k.preview, k.content,
             f.vec_rank, f.fts_rank, f.vec_distance, f.fts_score, f.rrf_score
      FROM fused f
      JOIN knowledge_chunks k ON k.rowid = f.rowid
      ORDER BY f.rrf_score DESC
      LIMIT 6;
    `;

    const params = ftsTerm
      ? [queryVec, normalizedAppId, normalizedAppId, ftsTerm]
      : [queryVec, normalizedAppId, normalizedAppId];

    const rows = vecDb.prepare(hybridSql).all(...params) as any[];
    if (rows && rows.length > 0) {
      console.log(`   ⚡ [Hybrid RRF] Native query returned ${rows.length} fused candidates (Top RRF score: ${rows[0]?.rrf_score})`);
      candidateChunks = rows.map((r: any) => ({
        id: r.id,
        index: 0,
        sourceName: r.heading || "Kiến thức DB",
        heading: r.heading || "",
        breadcrumb: r.breadcrumb || "",
        preview: r.preview || "",
        content: r.content || "",
      }));
    }
  } catch (err) {
    console.warn("[searchKnowledgeBase] Native hybrid RRF error, fallback to memory:", err);
  }

  // Fallback nếu native hybrid RRF chưa có dữ liệu hoặc lỗi
  if (candidateChunks.length === 0) {
    const ftsRanks = new Map<string, number>();
    const ftsMatchQuery = sanitizeQueryForFts5(query);
    if (ftsMatchQuery) {
      try {
        const rows = db
          .prepare(
            `SELECT chunk_id, rank
             FROM fts_knowledge_chunks
             WHERE app_id = ? AND fts_knowledge_chunks MATCH ?
             ORDER BY rank ASC
             LIMIT 12`
          )
          .all(normalizedAppId, ftsMatchQuery) as Array<{ chunk_id: string; rank: number }>;
        rows.forEach((r, idx) => ftsRanks.set(r.chunk_id, idx + 1));
      } catch {}
    }

    const queryTokens = extractSearchTokens(query);
    const semanticScores: Array<{ chunkId: string; score: number }> = [];
    for (const c of allChunks) {
      let score = 0;
      const headingLower = c.heading.toLowerCase();
      const breadcrumbLower = c.breadcrumb.toLowerCase();
      const previewLower = c.preview.toLowerCase();
      const contentLower = c.content.toLowerCase();
      for (const t of queryTokens) {
        if (headingLower.includes(t)) score += 5;
        if (breadcrumbLower.includes(t)) score += 3;
        if (previewLower.includes(t)) score += 2;
        if (contentLower.includes(t)) score += 1;
      }
      if (score > 0) semanticScores.push({ chunkId: c.id, score });
    }
    semanticScores.sort((a, b) => b.score - a.score);
    const semanticRanks = new Map<string, number>();
    semanticScores.slice(0, 12).forEach((s, idx) => semanticRanks.set(s.chunkId, idx + 1));

    const RRF_K = 60;
    const candidateIds = new Set<string>([...ftsRanks.keys(), ...semanticRanks.keys()]);
    const fusedScores: Array<{ chunk: KnowledgeChunk; rrfScore: number }> = [];
    for (const id of candidateIds) {
      const chunk = chunkMap.get(id);
      if (!chunk) continue;
      const fRank = ftsRanks.get(id);
      const sRank = semanticRanks.get(id);
      const ftsContrib = fRank ? 1.0 / (RRF_K + fRank) : 0;
      const semContrib = sRank ? 1.0 / (RRF_K + sRank) : 0;
      fusedScores.push({ chunk, rrfScore: ftsContrib + semContrib });
    }
    fusedScores.sort((a, b) => b.rrfScore - a.rrfScore);
    candidateChunks = fusedScores.slice(0, 6).map((f) => f.chunk);
  }
  if (candidateChunks.length === 0) {
    candidateChunks = allChunks.slice(0, 6);
  }

  // -------------------------------------------------------------
  // NHÁNH 3: BỘ RERANKER (Relevance Cross-Encoder)
  // Chấm điểm lại chính xác để chọn ra Top-K mục tinh hoa nhất
  // -------------------------------------------------------------
  try {
    console.log(`   ⚖️ [CrossEncoderRanker] Evaluating relevance for ${candidateChunks.length} candidate(s)...`);
    const candidateCatalog = candidateChunks
      .map((c, i) => `[${i}] ${c.heading} - ${c.preview || c.content.slice(0, 120)}`)
      .join("\n");

    const rerankPrompt = `Bạn là Bộ Reranker Tri thức Nghiệp vụ (Relevance Cross-Encoder).
Câu hỏi của người dùng: "${query}"

Danh sách các mục kiến thức ứng viên (${candidateChunks.length} mục):
${candidateCatalog}

Nhiệm vụ:
1. Nếu câu hỏi CHỈ LÀ câu chào hỏi xã giao, cảm ơn, hỏi bạn là ai (không cần tra cứu nghiệp vụ/số liệu):
   - Đặt "isGreeting": true
   - Đặt "greetingReply": Câu trả lời chào hỏi ngắn gọn, lịch sự bằng tiếng Việt
   - Đặt "selectedIndices": []
2. Nếu câu hỏi cần tra cứu nghiệp vụ, số liệu, quy tắc:
   - Đặt "isGreeting": false
   - Đặt "selectedIndices": Mảng index (tối đa ${topK} mục) liên quan nhất, xếp theo thứ tự ưu tiên giảm dần.

Chỉ trả về DUY NHẤT một chuỗi JSON:
{"isGreeting": false, "selectedIndices": [0, 1], "greetingReply": ""}`;

    const rerankRaw = await callInternalLlm([{ role: "user", content: rerankPrompt }]);
    const jsonStr = extractFirstJsonObject(rerankRaw);
    if (jsonStr) {
      const parsed = JSON.parse(jsonStr);
      console.log(`   ✅ [CrossEncoderRanker] Completed: isGreeting=${parsed?.isGreeting}, selectedIndices=${JSON.stringify(parsed?.selectedIndices)}`);
      if (parsed?.isGreeting === true) {
        return {
          topChunks: [],
          matchedContent: "",
          isGreeting: true,
          greetingReply:
            (typeof parsed.greetingReply === "string" && parsed.greetingReply.trim()) ||
            "Xin chào! Tôi có thể giúp gì cho bạn?",
        };
      }

      if (Array.isArray(parsed?.selectedIndices) && parsed.selectedIndices.length > 0) {
        const topIndices = parsed.selectedIndices.filter(
          (i: any) => typeof i === "number" && i >= 0 && i < candidateChunks.length
        );
        const top = topIndices.map((i: number) => candidateChunks[i]);
        return {
          topChunks: top,
          matchedContent: top.map((c) => c.content).join("\n\n"),
          isGreeting: false,
        };
      }
    }
  } catch (err: any) {
    console.warn("[KnowledgeDB] Reranker fallback:", err?.message || err);
  }

  // Fallback nếu Reranker gặp lỗi: lấy theo RRF topK
  const fallbackTop = candidateChunks.slice(0, topK);
  return {
    topChunks: fallbackTop,
    matchedContent: fallbackTop.map((c) => c.content).join("\n\n"),
    isGreeting: false,
  };
}
