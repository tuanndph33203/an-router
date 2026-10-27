import { NextRequest, NextResponse } from "next/server";
import { synthesizeGtts } from "../../../../../../open-sse/executors/gtts";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ voiceId: string }> }) {
  await params;
  try {
    const demoText = "Xin chào! Đây là giọng đọc Google được kết nối trực tiếp qua OmniRoute.";
    const mp3Buffer = await synthesizeGtts({ text: demoText, lang: "vi" });

    return new NextResponse(new Uint8Array(mp3Buffer), {
      status: 200,
      headers: {
        "Content-Type": "audio/mpeg",
        "Content-Length": mp3Buffer.length.toString(),
        "Cache-Control": "public, max-age=86400",
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Lỗi tạo audio nghe thử" }, { status: 500 });
  }
}
