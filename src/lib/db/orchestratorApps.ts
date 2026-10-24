import { getDbInstance } from "@/lib/db/core";
import type { AppRegistryConfig } from "@/lib/orchestrator/types";

export interface OrchestratorAppRow {
  id: string;
  name: string;
  microsoft_client_key: string | null;
  capabilities: string;
  rule_path: string | null;
  base_api_url: string;
  swagger_endpoint_url: string | null;
  schema_endpoint_url: string | null;
  sql_execute_endpoint: string | null;
  welcome_message: string | null;
  quick_suggestions: string | null;
  created_at: string;
  updated_at: string;
}

function mapRowToConfig(row: OrchestratorAppRow): AppRegistryConfig {
  let capabilities: Array<"api" | "sql" | "workflow"> = ["api"];
  try {
    if (row.capabilities) {
      capabilities = JSON.parse(row.capabilities);
    }
  } catch {}

  let quickSuggestions: string[] = [];
  try {
    if (row.quick_suggestions) {
      quickSuggestions = JSON.parse(row.quick_suggestions);
    }
  } catch {}

  let ruleFiles: string[] = [];
  if (row.rule_path) {
    try {
      if (row.rule_path.trim().startsWith("[")) {
        ruleFiles = JSON.parse(row.rule_path);
      } else {
        ruleFiles = row.rule_path
          .split(/[\n,;]+/)
          .map((s) => s.trim())
          .filter(Boolean);
      }
    } catch {
      ruleFiles = row.rule_path
        .split(/[\n,;]+/)
        .map((s) => s.trim())
        .filter(Boolean);
    }
  }

  const clientKey = row.microsoft_client_key || row.id;

  return {
    microsoftClientKey: clientKey,
    appId: clientKey,
    name: row.name,
    capabilities: capabilities as Array<"api" | "sql">,
    rulePath: row.rule_path || undefined,
    ruleFiles: ruleFiles.length > 0 ? ruleFiles : undefined,
    baseApiUrl: row.base_api_url,
    swaggerEndpointUrl: row.swagger_endpoint_url || undefined,
    schemaEndpointUrl: row.schema_endpoint_url || undefined,
    sqlExecuteEndpoint: row.sql_execute_endpoint || undefined,
    welcomeMessage: row.welcome_message || undefined,
    quickSuggestions: quickSuggestions.length > 0 ? quickSuggestions : undefined,
  };
}

export function getAllAppsFromDb(): AppRegistryConfig[] {
  try {
    const db = getDbInstance();
    const rows = db
      .prepare("SELECT * FROM orchestrator_applications ORDER BY name ASC")
      .all() as OrchestratorAppRow[];
    return rows.map(mapRowToConfig);
  } catch (err) {
    console.warn("[OrchestratorAppsDb] Failed to get apps from DB:", err);
    return [];
  }
}

export function getAppByClientKeyFromDb(clientKey: string): AppRegistryConfig | null {
  if (!clientKey || typeof clientKey !== "string") return null;
  try {
    const db = getDbInstance();
    const key = clientKey.trim();
    const row = db
      .prepare(
        "SELECT * FROM orchestrator_applications WHERE LOWER(microsoft_client_key) = LOWER(?) OR LOWER(id) = LOWER(?) ORDER BY (schema_endpoint_url IS NOT NULL) DESC, updated_at DESC"
      )
      .get(key, key) as OrchestratorAppRow | undefined;

    if (!row) return null;
    return mapRowToConfig(row);
  } catch (err) {
    console.warn(`[OrchestratorAppsDb] Failed to get app by key ${clientKey} from DB:`, err);
    return null;
  }
}

export function getAppByIdFromDb(key: string): AppRegistryConfig | null {
  return getAppByClientKeyFromDb(key);
}

export function upsertAppToDb(app: AppRegistryConfig): void {
  const db = getDbInstance();
  const clientKey = (app.microsoftClientKey || app.appId || "").trim();
  if (!clientKey) {
    throw new Error("microsoftClientKey là bắt buộc để lưu ứng dụng.");
  }

  const stmt = db.prepare(`
    INSERT INTO orchestrator_applications (
      id, name, microsoft_client_key, capabilities, rule_path, base_api_url,
      swagger_endpoint_url, schema_endpoint_url, sql_execute_endpoint,
      welcome_message, quick_suggestions, updated_at
    ) VALUES (
      @id, @name, @microsoft_client_key, @capabilities, @rule_path, @base_api_url,
      @swagger_endpoint_url, @schema_endpoint_url, @sql_execute_endpoint,
      @welcome_message, @quick_suggestions, datetime('now')
    )
    ON CONFLICT(id) DO UPDATE SET
      name = excluded.name,
      microsoft_client_key = excluded.microsoft_client_key,
      capabilities = excluded.capabilities,
      rule_path = excluded.rule_path,
      base_api_url = excluded.base_api_url,
      swagger_endpoint_url = excluded.swagger_endpoint_url,
      schema_endpoint_url = excluded.schema_endpoint_url,
      sql_execute_endpoint = excluded.sql_execute_endpoint,
      welcome_message = excluded.welcome_message,
      quick_suggestions = excluded.quick_suggestions,
      updated_at = datetime('now')
  `);

  stmt.run({
    id: clientKey.toLowerCase(),
    name: app.name,
    microsoft_client_key: clientKey,
    capabilities: JSON.stringify(app.capabilities || ["api"]),
    rule_path:
      Array.isArray(app.ruleFiles) && app.ruleFiles.length > 0
        ? app.ruleFiles
            .map((s) => s.trim())
            .filter(Boolean)
            .join(", ")
        : app.rulePath
          ? app.rulePath.trim()
          : null,
    base_api_url: app.baseApiUrl,
    swagger_endpoint_url: app.swaggerEndpointUrl || null,
    schema_endpoint_url: app.schemaEndpointUrl || null,
    sql_execute_endpoint: app.sqlExecuteEndpoint || null,
    welcome_message: app.welcomeMessage || null,
    quick_suggestions: JSON.stringify(app.quickSuggestions || []),
  });
}

export function deleteAppFromDb(clientKey: string): boolean {
  if (!clientKey) return false;
  try {
    const db = getDbInstance();
    const key = clientKey.trim();
    const info = db
      .prepare(
        "DELETE FROM orchestrator_applications WHERE LOWER(microsoft_client_key) = LOWER(?) OR LOWER(id) = LOWER(?)"
      )
      .run(key, key);
    return info.changes > 0;
  } catch (err) {
    console.warn(`[OrchestratorAppsDb] Failed to delete app ${clientKey}:`, err);
    return false;
  }
}
