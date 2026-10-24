import fs from "fs";
import path from "path";
import type { AppRegistryConfig } from "./types";
import {
  getAllAppsFromDb,
  getAppByIdFromDb,
  upsertAppToDb,
  deleteAppFromDb,
} from "@/lib/db/orchestratorApps";

function parseRulePathTargets(rulePathInput: string | undefined): string[] {
  if (!rulePathInput) return [];
  const rawParts: string[] = [];
  for (const line of rulePathInput.split("\n")) {
    for (const part of line.split(",")) {
      for (const item of part.split(";")) {
        const trimmed = item.trim();
        if (trimmed) rawParts.push(trimmed);
      }
    }
  }
  return rawParts;
}

function collectRuleFiles(rulesDir: string, targetInput: string): string[] {
  const cleanTarget = targetInput.trim();
  if (!cleanTarget) return [];
  const normalizedTarget = cleanTarget.startsWith("rules/")
    ? cleanTarget.slice(6)
    : cleanTarget.startsWith("rules\\")
      ? cleanTarget.slice(6)
      : cleanTarget;

  const targetPath = path.resolve(rulesDir, normalizedTarget);
  if (!targetPath.startsWith(rulesDir + path.sep) && targetPath !== rulesDir) {
    console.warn(`[AppRegistry] Rejected unsafe rule path traversal attempt: ${cleanTarget}`);
    return [];
  }
  if (!fs.existsSync(targetPath)) {
    console.warn(`[AppRegistry] Rule path not found: ${targetPath}`);
    return [];
  }

  const stat = fs.statSync(targetPath);
  if (stat.isFile()) return [targetPath];
  if (stat.isDirectory()) {
    const out: string[] = [];
    const walk = (dir: string) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, entry.name);
        if (entry.isDirectory()) walk(p);
        else if (entry.isFile() && (entry.name.endsWith(".md") || entry.name.endsWith(".txt"))) {
          out.push(p);
        }
      }
    };
    walk(targetPath);
    return out.sort();
  }
  return [];
}

function loadRuleMarkdowns(rulePathInput: string): string {
  const targets = parseRulePathTargets(rulePathInput);
  if (targets.length === 0) return "";

  const rulesDir = path.resolve(process.cwd(), "rules");
  const sections: string[] = [];
  for (const target of targets) {
    try {
      const matchedFiles = collectRuleFiles(rulesDir, target);
      for (const filePath of matchedFiles) {
        const relName = path.relative(rulesDir, filePath).split(path.sep).join("/");
        const content = fs.readFileSync(filePath, "utf-8");
        sections.push(`<!-- Rule: ${relName} -->\n${content}`);
      }
    } catch (err) {
      console.warn(`[AppRegistry] Could not read rule target: ${target}`, err);
    }
  }

  return sections.join("\n\n---\n\n");
}

export function getAppConfig(appIdOrClientKey: string): AppRegistryConfig | null {
  if (!appIdOrClientKey || typeof appIdOrClientKey !== "string") {
    return null;
  }
  const normalized = appIdOrClientKey.toLowerCase().trim();
  if (!normalized) return null;

  let rawConfig: AppRegistryConfig | null = null;
  try {
    rawConfig = getAppByIdFromDb(normalized);
  } catch (err) {
    console.warn("[AppRegistry] DB query failed:", err);
  }

  if (!rawConfig) return null;

  const config: AppRegistryConfig = { ...rawConfig };

  if (config.rulePath) {
    const markdownContent = loadRuleMarkdowns(config.rulePath);
    if (markdownContent) {
      if (config.domainPlaybook && !config.domainPlaybook.includes(markdownContent.slice(0, 80))) {
        config.domainPlaybook = `${config.domainPlaybook}\n\n${markdownContent}`;
      } else if (!config.domainPlaybook) {
        config.domainPlaybook = markdownContent;
      }
    }
  }

  return config;
}

export function registerApp(config: AppRegistryConfig): void {
  try {
    upsertAppToDb(config);
  } catch (err) {
    console.warn(`[AppRegistry] Failed to save app ${config.microsoftClientKey} to DB:`, err);
    throw err;
  }
}

export function unregisterApp(clientKey: string): boolean {
  return deleteAppFromDb(clientKey);
}

export function listApps(): AppRegistryConfig[] {
  try {
    return getAllAppsFromDb();
  } catch (err) {
    console.warn("[AppRegistry] Failed to get apps from DB:", err);
    return [];
  }
}

/**
 * Chuẩn hóa một URL/endpoint path để so khớp:
 * - Loại bỏ query string và hash (?query, #hash)
 * - Nếu là full URL, tách lấy pathname (http://host:port/path -> /path)
 * - Bỏ trailing slash và đảm bảo bắt đầu bằng '/'
 * - Chuyển về lowercase
 */
export function normalizeEndpointPath(endpoint: string): string {
  if (!endpoint || typeof endpoint !== "string") return "";
  let clean = endpoint.trim().toLowerCase();

  try {
    if (clean.startsWith("http://") || clean.startsWith("https://")) {
      const parsed = new URL(clean);
      clean = parsed.pathname;
    }
  } catch {}

  const queryIdx = clean.indexOf("?");
  if (queryIdx !== -1) clean = clean.slice(0, queryIdx);
  const hashIdx = clean.indexOf("#");
  if (hashIdx !== -1) clean = clean.slice(0, hashIdx);

  if (!clean.startsWith("/")) clean = "/" + clean;
  while (clean.length > 1 && clean.endsWith("/")) {
    clean = clean.slice(0, -1);
  }
  return clean;
}

/**
 * Kiểm tra xem một endpoint có phải là endpoint truy vấn báo cáo SQL hay không.
 * Ưu tiên so khớp với sqlExecuteEndpoint được cấu hình trong AppRegistryConfig,
 * đồng thời fallback về các signature mặc định (/execute-sql, /generate-excel) để tương thích ngược.
 */
export function isSqlReportEndpoint(
  endpoint: string,
  appConfigOrSqlEndpoint?: AppRegistryConfig | string | null
): boolean {
  if (!endpoint || typeof endpoint !== "string") return false;

  const normalizedEndpoint = normalizeEndpointPath(endpoint);
  if (!normalizedEndpoint) return false;

  const configuredEndpoint =
    typeof appConfigOrSqlEndpoint === "string"
      ? appConfigOrSqlEndpoint
      : appConfigOrSqlEndpoint?.sqlExecuteEndpoint;

  if (configuredEndpoint) {
    const normalizedConfigured = normalizeEndpointPath(configuredEndpoint);
    if (
      normalizedConfigured &&
      (normalizedEndpoint === normalizedConfigured ||
        normalizedEndpoint.endsWith(normalizedConfigured))
    ) {
      return true;
    }
  }

  return (
    normalizedEndpoint.includes("/execute-sql") || normalizedEndpoint.includes("/generate-excel")
  );
}
