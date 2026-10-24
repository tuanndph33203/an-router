import type { ExecutionLogItem } from "./types";
import { isSubscriptionFetchUrlAllowed } from "@/lib/proxySubscription/fetchGuard";
import { isSqlReportEndpoint } from "./appRegistry";

export interface ExecutionResult {
  success: boolean;
  status: number;
  data: any;
  error?: string;
  logs: ExecutionLogItem[];
}

export function getEndpointVariants(urlStr: string): string[] {
  const variants: string[] = [];
  try {
    const urlObj = new URL(urlStr);
    const pathname = urlObj.pathname;
    const parts = pathname.split("/");
    const lastPart = parts[parts.length - 1];

    if (!lastPart) return variants;

    const altNames = new Set<string>();

    if (lastPart.includes("-")) {
      // failure-types -> FailureTypes
      const pascal = lastPart
        .split("-")
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join("");
      altNames.add(pascal);
      // failure-types -> failuretypes
      altNames.add(lastPart.replace(/-/g, ""));
    } else if (lastPart.includes("_")) {
      // failure_types -> FailureTypes
      const pascal = lastPart
        .split("_")
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join("");
      altNames.add(pascal);
      altNames.add(lastPart.replace(/_/g, ""));
    } else if (/[A-Z]/.test(lastPart)) {
      // FailureTypes -> failure-types
      const kebab = lastPart.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase();
      altNames.add(kebab);
      // FailureTypes -> failuretypes
      altNames.add(lastPart.toLowerCase());
    } else {
      // failuretypes -> FailureTypes
      const capitalized = lastPart.charAt(0).toUpperCase() + lastPart.slice(1);
      altNames.add(capitalized);
    }

    for (const alt of altNames) {
      if (alt !== lastPart) {
        const clone = new URL(urlStr);
        const altPath = [...parts.slice(0, -1), alt].join("/");
        clone.pathname = altPath;
        variants.push(clone.toString());
      }
    }
  } catch {}
  return variants;
}

export async function executeRemoteAction(
  baseApiUrl: string,
  action: string,
  endpoint: string,
  payload: Record<string, any> = {},
  userAuthToken: string = "",
  clientHeaders: Record<string, string> = {},
  abortSignal?: AbortSignal,
  sqlExecuteEndpoint?: string
): Promise<ExecutionResult> {
  const logs: ExecutionLogItem[] = [];
  const startTime = new Date().toLocaleTimeString();

  logs.push({
    time: startTime,
    step: "Khởi tạo yêu cầu HTTP",
    status: "INFO",
    detail: `${action.toUpperCase()} ${endpoint}`,
  });

  try {
    let resolvedUrl = endpoint;
    const workingPayload = { ...payload };

    // 1. Thay thế path parameters dạng {param} hoặc :param
    for (const [key, val] of Object.entries(payload)) {
      if (resolvedUrl.includes(`{${key}}`)) {
        resolvedUrl = resolvedUrl.replace(`{${key}}`, encodeURIComponent(String(val)));
        delete workingPayload[key];
      } else if (resolvedUrl.includes(`:${key}`)) {
        resolvedUrl = resolvedUrl.replace(`:${key}`, encodeURIComponent(String(val)));
        delete workingPayload[key];
      }
    }

    const cleanBase = baseApiUrl.endsWith("/") ? baseApiUrl.slice(0, -1) : baseApiUrl;
    const cleanEndpoint = resolvedUrl.startsWith("/") ? resolvedUrl : `/${resolvedUrl}`;
    let fullUrl = `${cleanBase}${cleanEndpoint}`;

    const ALLOWED_FORWARD_HEADERS = new Set([
      "x-application-id",
      "x-correlation-id",
      "x-request-id",
      "x-branch-code",
      "x-user-code",
      "accept-language",
    ]);

    const headers: Record<string, string> = {
      Accept: "application/json",
    };

    for (const [k, v] of Object.entries(clientHeaders || {})) {
      if (v && ALLOWED_FORWARD_HEADERS.has(k.toLowerCase())) {
        headers[k] = v;
      }
    }

    if (userAuthToken) {
      headers["Authorization"] = userAuthToken.startsWith("Bearer ")
        ? userAuthToken
        : `Bearer ${userAuthToken}`;
    }

    if (!headers["X-Internal-Key"]) {
      const internalKey = process.env.DYNAMIC_REPORT_INTERNAL_KEY;
      if (internalKey) {
        headers["X-Internal-Key"] = internalKey;
      }
    }

    let requestBody: string | undefined;

    if (action.toUpperCase() === "GET") {
      const queryParams = new URLSearchParams();
      for (const [k, v] of Object.entries(workingPayload)) {
        if (v !== undefined && v !== null && typeof v !== "object") {
          queryParams.append(k, String(v));
        }
      }
      const qs = queryParams.toString();
      if (qs) {
        fullUrl += (fullUrl.includes("?") ? "&" : "?") + qs;
      }
    } else {
      headers["Content-Type"] = "application/json";
      requestBody = JSON.stringify(workingPayload);
    }

    // SSRF Check: protect against cloud metadata (169.254.169.254) and invalid schemes
    if (!isSubscriptionFetchUrlAllowed(fullUrl, { allowLocal: true })) {
      const errorMsg = `Yêu cầu bị từ chối bởi SSRF Guard: Địa chỉ URL '${fullUrl}' không hợp lệ hoặc nằm trong danh sách cấm.`;
      logs.push({
        time: new Date().toLocaleTimeString(),
        step: "Kiểm tra an ninh URL (SSRF Guard)",
        status: "FAILED",
        detail: errorMsg,
      });
      return {
        success: false,
        status: 403,
        data: null,
        error: errorMsg,
        logs,
      };
    }

    logs.push({
      time: new Date().toLocaleTimeString(),
      step: "Gửi HTTP Request",
      status: "INFO",
      detail: `URL: ${fullUrl} | Payload keys: ${Object.keys(workingPayload).join(", ") || "none"}`,
    });

    const isReportSql = isSqlReportEndpoint(fullUrl, sqlExecuteEndpoint);
    const timeoutMs = isReportSql ? 60000 : 30000;
    const effectiveSignal = abortSignal
      ? AbortSignal.any([AbortSignal.timeout(timeoutMs), abortSignal])
      : AbortSignal.timeout(timeoutMs);

    let res = await fetch(fullUrl, {
      method: action.toUpperCase(),
      headers,
      body: requestBody,
      signal: effectiveSignal,
    });

    if (!res.ok && res.status === 404) {
      const altUrls = getEndpointVariants(fullUrl);
      for (const altUrl of altUrls) {
        try {
          const altEffectiveSignal = abortSignal
            ? AbortSignal.any([AbortSignal.timeout(isReportSql ? 30000 : 10000), abortSignal])
            : AbortSignal.timeout(isReportSql ? 30000 : 10000);
          const resAlt = await fetch(altUrl, {
            method: action.toUpperCase(),
            headers,
            body: requestBody,
            signal: altEffectiveSignal,
          });
          if (resAlt.ok || (resAlt.status !== 404 && resAlt.status !== 502)) {
            logs.push({
              time: new Date().toLocaleTimeString(),
              step: "Tự động điều chỉnh Endpoint",
              status: "INFO",
              detail: `Tự động chuyển từ ${fullUrl} sang ${altUrl} (HTTP ${resAlt.status})`,
            });
            res = resAlt;
            break;
          }
        } catch {}
      }
    }

    const finishTime = new Date().toLocaleTimeString();
    const isSuccess = res.ok;

    let responseData: any;
    const contentType = res.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      responseData = await res.json().catch(() => null);
    } else {
      responseData = await res.text().catch(() => "");
    }

    if (isSuccess) {
      logs.push({
        time: finishTime,
        step: "Hoàn tất cuộc gọi API",
        status: "SUCCESS",
        detail: `HTTP ${res.status}: Thực thi thành công`,
      });
      return {
        success: true,
        status: res.status,
        data: responseData,
        logs,
      };
    } else {
      let errorMsg = String(responseData || `HTTP ${res.status}`);
      if (typeof responseData === "object" && responseData !== null) {
        errorMsg =
          responseData.message ||
          responseData.error ||
          responseData.title ||
          JSON.stringify(responseData);
      }
      logs.push({
        time: finishTime,
        step: "Lỗi cuộc gọi API",
        status: "ERROR",
        detail: `HTTP ${res.status}: ${errorMsg.slice(0, 300)}`,
      });
      return {
        success: false,
        status: res.status,
        data: responseData,
        error: errorMsg,
        logs,
      };
    }
  } catch (err: any) {
    const errorTime = new Date().toLocaleTimeString();
    const errMsg = err?.message || String(err);
    logs.push({
      time: errorTime,
      step: "Lỗi kết nối Backend",
      status: "ERROR",
      detail: errMsg,
    });
    return {
      success: false,
      status: 500,
      data: null,
      error: errMsg,
      logs,
    };
  }
}
