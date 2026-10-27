import { NextRequest, NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";
import { findVoiceByIdOrName } from "@/lib/tts/voiceCatalog";
import { synthesizeGtts } from "../../../../../../open-sse/executors/gtts";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ voiceId: string }> }) {
  const { voiceId } = await params;
  const voice = findVoiceByIdOrName(voiceId);
  const targetId = voice ? voice.id : voiceId;

  // 1. If Google voice, dynamically synthesize demo with gTTS
  if (targetId.startsWith("google")) {
    try {
      const demoText =
        targetId === "google_en"
          ? "Hello! This is Google voice streaming directly through OmniRoute with low latency."
          : "Xin chào! Đây là luồng giọng đọc Google siêu tốc được chuyển tiếp trực tiếp qua OmniRoute.";
      const lang = targetId === "google_en" ? "en" : "vi";
      const mp3Buffer = await synthesizeGtts({ text: demoText, lang });

      return new NextResponse(new Uint8Array(mp3Buffer), {
        status: 200,
        headers: {
          "Content-Type": "audio/mpeg",
          "Content-Length": mp3Buffer.length.toString(),
          "Cache-Control": "public, max-age=86400",
        },
      });
    } catch {}
  }

  // 2. Pre-recorded WAV demo
  const demoPath = path.join(process.cwd(), "public", "tts", "demos", `${targetId}_demo.wav`);
  if (!fs.existsSync(demoPath)) {
    return NextResponse.json(
      { error: `Không tìm thấy file nghe thử cho giọng '${voiceId}'.` },
      { status: 404 }
    );
  }

  const fileBuffer = fs.readFileSync(demoPath);
  return new NextResponse(fileBuffer, {
    status: 200,
    headers: {
      "Content-Type": "audio/wav",
      "Content-Length": fileBuffer.length.toString(),
      "Cache-Control": "public, max-age=86400, immutable",
    },
  });
}
