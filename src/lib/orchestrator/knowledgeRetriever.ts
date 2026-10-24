import { createHash, randomUUID } from "crypto";
import { getDbInstance } from "@/lib/db/core";

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
    `);
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
 * Nạp (Ingest) danh sách tài liệu từ Folder hoặc File trực tiếp vào SQLite DB (`knowledge_documents` & `knowledge_chunks`).
 * Không tạo file vật lý trong thư mục `rules/`.
 */
export function ingestDocumentsToKnowledgeDb(
  appId: string,
  documents: Array<{ relativePath: string; content: string }>
): {
  documentsSaved: number;
  totalChunksSaved: number;
  items: KnowledgeDocumentSummary[];
} {
  ensureKnowledgeDbSchema();
  const normalizedAppId = (appId || "").toLowerCase().trim();
  if (!normalizedAppId) {
    throw new Error("Thiếu mã ứng dụng (appId) khi lưu vào DB Kiến thức.");
  }

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
    const chunks = chunkMarkdownByHeadings(rawContent, cleanRelPath);

    // Xóa chunks cũ của tài liệu này và nạp mới vào DB
    db.prepare("DELETE FROM knowledge_chunks WHERE app_id = ? AND doc_id = ?").run(
      normalizedAppId,
      docId
    );
    db.prepare("DELETE FROM knowledge_chunks WHERE app_id = ? AND relative_path = ?").run(
      normalizedAppId,
      cleanRelPath
    );

    const insertChunk = db.prepare(`
      INSERT INTO knowledge_chunks (
        id, doc_id, app_id, relative_path, chunk_index, source_name, heading, breadcrumb, preview, content, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const c of chunks) {
      insertChunk.run(
        `${docId}_${c.index}`,
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
    const res = db.prepare("DELETE FROM knowledge_documents WHERE app_id = ?").run(normalizedAppId);
    return Number(res.changes || 0);
  }

  if (options?.docId) {
    db.prepare("DELETE FROM knowledge_chunks WHERE app_id = ? AND doc_id = ?").run(
      normalizedAppId,
      options.docId
    );
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
