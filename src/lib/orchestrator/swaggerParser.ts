interface SwaggerCacheEntry {
  fetchedAt: number;
  data: any;
  operations: DiscoveredOperation[];
}

export interface DiscoveredOperation {
  action: string; // "GET" | "POST" | "PUT" | "DELETE"
  endpoint: string; // "/api/v1/tickets"
  summary: string;
  description: string;
  operationId: string;
  parameters: Array<{
    name: string;
    in: "query" | "path" | "header";
    required: boolean;
    description?: string;
    type?: string;
  }>;
  requestBodySchema?: Record<string, any>;
  requiredFields?: string[];
}

const cache = new Map<string, SwaggerCacheEntry>();
const CACHE_TTL_MS = 5 * 60 * 1000;

export async function getSwaggerOperations(
  swaggerUrl: string,
  throwOnError = false
): Promise<DiscoveredOperation[]> {
  if (!swaggerUrl) return [];

  const cached = cache.get(swaggerUrl);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    return cached.operations;
  }

  try {
    const res = await fetch(swaggerUrl, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(6000),
    });

    if (!res.ok) {
      const msg = `Không thể tải tài liệu Swagger từ ${swaggerUrl} (HTTP ${res.status}: ${res.statusText || "Lỗi phản hồi"})`;
      console.warn(`[SwaggerParser] ${msg}`);
      if (throwOnError) {
        throw new Error(`[OpenAPI Error] ${msg}`);
      }
      return cached?.operations || [];
    }

    const doc = await res.json();
    const operations = parseSwaggerDocument(doc);

    cache.set(swaggerUrl, {
      fetchedAt: Date.now(),
      data: doc,
      operations,
    });

    return operations;
  } catch (err: any) {
    const msg = `Không thể kết nối tới Swagger Endpoint (${swaggerUrl}): ${err?.message || err}`;
    console.warn(`[SwaggerParser] ${msg}`);
    if (throwOnError) {
      throw new Error(`[OpenAPI Error] ${msg}`);
    }
    return cached?.operations || [];
  }
}

function parseSwaggerDocument(doc: any): DiscoveredOperation[] {
  const operations: DiscoveredOperation[] = [];
  if (!doc || !doc.paths) return operations;

  const paths = doc.paths;
  for (const [pathStr, pathItem] of Object.entries<any>(paths)) {
    if (!pathItem || typeof pathItem !== "object") continue;

    const methods = ["get", "post", "put", "delete", "patch"];
    for (const method of methods) {
      const op = pathItem[method];
      if (!op) continue;

      const action = method.toUpperCase();
      const summary = op.summary || op.description || `${action} ${pathStr}`;
      const description = op.description || op.summary || "";
      const operationId = op.operationId || `${action}_${pathStr.replace(/[^a-zA-Z0-9]/g, "_")}`;

      const parameters: DiscoveredOperation["parameters"] = [];
      if (Array.isArray(op.parameters)) {
        for (const p of op.parameters) {
          if (!p || !p.name) continue;
          parameters.push({
            name: p.name,
            in: p.in || "query",
            required: Boolean(p.required),
            description: p.description,
            type: p.schema?.type || p.type || "string",
          });
        }
      }

      let requestBodySchema: Record<string, any> | undefined;
      const requiredFields: string[] = [];

      const schema =
        op.requestBody?.content?.["application/json"]?.schema ||
        op.requestBody?.content?.["*/*"]?.schema;

      if (schema) {
        requestBodySchema = resolveSchema(schema, doc);
        if (Array.isArray(requestBodySchema?.required)) {
          requiredFields.push(...requestBodySchema.required);
        }
      }

      operations.push({
        action,
        endpoint: pathStr,
        summary,
        description,
        operationId,
        parameters,
        requestBodySchema,
        requiredFields,
      });
    }
  }

  return operations;
}

function resolveSchema(schema: any, rootDoc: any, depth = 0): any {
  if (!schema || depth > 4) return schema;

  if (schema.$ref && typeof schema.$ref === "string") {
    const refPath = schema.$ref.replace(/^#\//, "").split("/");
    let curr = rootDoc;
    for (const segment of refPath) {
      curr = curr?.[segment];
    }
    if (curr) {
      return resolveSchema(curr, rootDoc, depth + 1);
    }
  }

  if (schema.properties) {
    const resolvedProps: Record<string, any> = {};
    for (const [key, prop] of Object.entries<any>(schema.properties)) {
      resolvedProps[key] = resolveSchema(prop, rootDoc, depth + 1);
    }
    return { ...schema, properties: resolvedProps };
  }

  return schema;
}

export function formatOperationsForPrompt(
  operations: DiscoveredOperation[],
  limit?: number,
  instruction = ""
): string {
  if (operations.length === 0) return "Không có OpenAPI schema khả dụng.";

  let sorted = operations;
  if (instruction && instruction.trim()) {
    const keywords = instruction
      .toLowerCase()
      .split(/\s+/)
      .filter((w) => w.length > 1);
    sorted = [...operations].sort((a, b) => {
      const scoreA = keywords.reduce((score, kw) => {
        const text = `${a.endpoint} ${a.summary} ${a.description} ${a.operationId}`.toLowerCase();
        return score + (text.includes(kw) ? 2 : 0);
      }, 0);
      const scoreB = keywords.reduce((score, kw) => {
        const text = `${b.endpoint} ${b.summary} ${b.description} ${b.operationId}`.toLowerCase();
        return score + (text.includes(kw) ? 2 : 0);
      }, 0);
      return scoreB - scoreA;
    });
  }

  const targetOps = limit && limit > 0 ? sorted.slice(0, limit) : sorted;

  return targetOps
    .map((op) => {
      const paramsDesc = op.parameters.length
        ? `Params: [${op.parameters.map((p) => `${p.name}${p.required ? "*" : ""}:${p.type}`).join(", ")}]`
        : "";
      const bodyDesc = op.requiredFields?.length
        ? `Required body fields: [${op.requiredFields.join(", ")}]`
        : "";
      return `- [${op.action}] ${op.endpoint} (${op.summary}) ${paramsDesc} ${bodyDesc}`.trim();
    })
    .join("\n");
}

export function formatDetailedOperations(operations: DiscoveredOperation[]): string {
  if (operations.length === 0) return "";
  const lines: string[] = ["\nCHI TIẾT THAM SỐ & CẤU TRÚC BODY CHO CÁC API PHÙ HỢP NHẤT:"];
  for (const op of operations) {
    lines.push(
      `\n[${op.action}] ${op.endpoint} (${op.summary || op.description || op.operationId})`
    );
    if (op.parameters.length > 0) {
      lines.push("  - Tham số URL / Query:");
      for (const p of op.parameters) {
        lines.push(
          `    * ${p.name} (${p.in}, ${p.type}${p.required ? ", bắt buộc" : ""}): ${p.description || ""}`
        );
      }
    }
    if (op.requestBodySchema) {
      lines.push("  - Cấu trúc Request Body (JSON Schema):");
      lines.push(
        JSON.stringify(op.requestBodySchema, null, 2)
          .split("\n")
          .map((l) => `    ${l}`)
          .join("\n")
      );
    }
  }
  return lines.join("\n");
}
