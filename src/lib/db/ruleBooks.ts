import fs from "fs";
import path from "path";
import { randomUUID } from "crypto";
import { getDbInstance } from "@/lib/db/core";

export interface RuleBook {
  id: string;
  name: string;
  fileName: string;
  relativePath: string;
  category: string;
  description: string;
  createdAt: string;
  updatedAt: string;
}

export interface ApiKeyRuleMapping {
  id: string;
  apiKeyId: string;
  ruleBookId: string;
  priority: number;
  isEnabled: boolean;
  createdAt: string;
  ruleBook?: RuleBook;
}

export function getAllRuleBooks(): RuleBook[] {
  const db = getDbInstance();
  const rows = db.prepare("SELECT * FROM rule_books ORDER BY name ASC").all() as any[];
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    fileName: r.file_name,
    relativePath: r.relative_path,
    category: r.category || "general",
    description: r.description || "",
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }));
}

export function getRuleBookById(id: string): RuleBook | null {
  const db = getDbInstance();
  const r = db.prepare("SELECT * FROM rule_books WHERE id = ?").get(id) as any;
  if (!r) return null;
  return {
    id: r.id,
    name: r.name,
    fileName: r.file_name,
    relativePath: r.relative_path,
    category: r.category || "general",
    description: r.description || "",
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export function createOrUpdateRuleBook(data: {
  id?: string;
  name: string;
  fileName: string;
  relativePath: string;
  category?: string;
  description?: string;
}): RuleBook {
  const db = getDbInstance();
  const now = new Date().toISOString();
  const id = data.id || `rb_${randomUUID().replace(/-/g, "").slice(0, 12)}`;

  db.prepare(
    `
    INSERT INTO rule_books (id, name, file_name, relative_path, category, description, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(file_name) DO UPDATE SET
      name = excluded.name,
      relative_path = excluded.relative_path,
      category = excluded.category,
      description = excluded.description,
      updated_at = excluded.updated_at
  `
  ).run(
    id,
    data.name,
    data.fileName,
    data.relativePath,
    data.category || "general",
    data.description || "",
    now,
    now
  );

  return getRuleBookById(id)!;
}

export function getRuleBookContent(ruleBook: RuleBook): string {
  try {
    const rulesDir = path.resolve(process.cwd(), "rules");
    const fullPath = path.resolve(process.cwd(), ruleBook.relativePath);
    if (!fullPath.startsWith(rulesDir + path.sep) && fullPath !== rulesDir) {
      console.warn(`[RuleBooks] Rejected path traversal attempt: ${ruleBook.relativePath}`);
      return "";
    }
    if (fs.existsSync(fullPath)) {
      return fs.readFileSync(fullPath, "utf-8");
    }
  } catch (err) {
    console.warn(`[RuleBooks] Failed to read rule content for: ${ruleBook.fileName}`, err);
  }
  return "";
}

export function getRulesForApiKey(apiKeyId: string): RuleBook[] {
  const db = getDbInstance();
  const rows = db
    .prepare(
      `
    SELECT rb.*, akr.priority, akr.is_enabled
    FROM rule_books rb
    INNER JOIN api_key_rules akr ON rb.id = akr.rule_book_id
    WHERE akr.api_key_id = ? AND akr.is_enabled = 1
    ORDER BY akr.priority ASC, rb.name ASC
  `
    )
    .all(apiKeyId) as any[];

  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    fileName: r.file_name,
    relativePath: r.relative_path,
    category: r.category || "general",
    description: r.description || "",
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }));
}

export function getRuleIdsForApiKey(apiKeyId: string): string[] {
  const db = getDbInstance();
  const rows = db
    .prepare("SELECT rule_book_id FROM api_key_rules WHERE api_key_id = ? AND is_enabled = 1")
    .all(apiKeyId) as any[];
  return rows.map((r) => r.rule_book_id);
}

export function assignRulesToApiKey(apiKeyId: string, ruleBookIds: string[]): void {
  const db = getDbInstance();
  const now = new Date().toISOString();

  db.prepare("DELETE FROM api_key_rules WHERE api_key_id = ?").run(apiKeyId);

  const insertStmt = db.prepare(`
    INSERT INTO api_key_rules (id, api_key_id, rule_book_id, priority, is_enabled, created_at)
    VALUES (?, ?, ?, ?, 1, ?)
  `);

  ruleBookIds.forEach((ruleId, index) => {
    insertStmt.run(
      `akr_${randomUUID().replace(/-/g, "").slice(0, 12)}`,
      apiKeyId,
      ruleId,
      index + 1,
      now
    );
  });
}

export function syncDiskRuleBooks(): void {
  try {
    const rulesDir = path.resolve(process.cwd(), "rules");
    if (!fs.existsSync(rulesDir)) return;

    const walk = (dir: string) => {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          walk(fullPath);
        } else if (
          entry.isFile() &&
          (entry.name.endsWith(".rule.md") ||
            entry.name.endsWith(".md") ||
            entry.name.endsWith(".txt"))
        ) {
          const relFromRules = path.relative(rulesDir, fullPath).split(path.sep).join("/");
          const folderPrefix = path.dirname(relFromRules);
          const cleanBase = entry.name
            .split(".rule.md")
            .join("")
            .split(".md")
            .join("")
            .split(".txt")
            .join("");
          const displayName =
            folderPrefix && folderPrefix !== "."
              ? `[${folderPrefix.toUpperCase()}] ${cleanBase.toUpperCase()} Rule Book`
              : `${cleanBase.toUpperCase()} Rule Book`;
          const lowerRel = relFromRules.toLowerCase();
          const cat = lowerRel.includes("cmms")
            ? "tickets"
            : lowerRel.includes("anpos")
              ? "finance"
              : folderPrefix && folderPrefix !== "."
                ? folderPrefix
                : "general";

          createOrUpdateRuleBook({
            name: displayName,
            fileName: relFromRules,
            relativePath: `rules/${relFromRules}`,
            category: cat,
            description: `Quy tắc nghiệp vụ từ rules/${relFromRules}`,
          });
        }
      }
    };

    walk(rulesDir);
  } catch (err) {
    console.warn("[RuleBooks] Sync disk rule books error:", err);
  }
}
