import { NextResponse } from "next/server";
import { isSubscriptionFetchUrlAllowed } from "@/lib/proxySubscription/fetchGuard";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const schemaUrl = (body.schemaUrl || "").trim();
    const applicationId = (body.applicationId || "PRO_ERP").trim();

    if (!schemaUrl) {
      return NextResponse.json(
        { success: false, message: "Vui lòng nhập Schema Catalog Endpoint URL." },
        { status: 400 }
      );
    }

    if (!isSubscriptionFetchUrlAllowed(schemaUrl, { allowLocal: true })) {
      return NextResponse.json(
        {
          success: false,
          message: "URL kiểm tra không hợp lệ hoặc bị chặn bởi bộ lọc an ninh (SSRF).",
        },
        { status: 403 }
      );
    }

    const internalKey = process.env.DYNAMIC_REPORT_INTERNAL_KEY || "dr_internal_sec_89f1a23c04b7";

    const res = await fetch(schemaUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Internal-Key": internalKey,
        "X-Application-Id": applicationId,
      },
      body: JSON.stringify({
        applicationId,
        mode: "summary",
      }),
      signal: AbortSignal.timeout(8000),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      let parsedErr = errText;
      try {
        const jsonErr = JSON.parse(errText);
        parsedErr = jsonErr.message || jsonErr.error || errText;
      } catch {}

      return NextResponse.json({
        success: false,
        status: res.status,
        message: `Máy chủ Báo cáo phản hồi HTTP ${res.status}: ${parsedErr || "Không xác định"}`,
      });
    }

    const json = await res.json();
    const tables = Array.isArray(json.tables) ? json.tables : [];
    const tableCount = json.tableCount ?? tables.length;
    const sampleTables = tables.slice(0, 6);

    return NextResponse.json({
      success: true,
      status: 200,
      tableCount,
      sampleTables,
      message: `Kết nối thành công! Đã định vị ${tableCount} bảng dữ liệu từ ứng dụng '${applicationId}'.`,
    });
  } catch (err: any) {
    return NextResponse.json({
      success: false,
      status: 500,
      message: `Lỗi kết nối tới máy chủ Báo cáo: ${err?.message || err}`,
    });
  }
}
