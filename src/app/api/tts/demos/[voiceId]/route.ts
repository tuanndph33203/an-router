import { NextRequest, NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";
import { findVoiceByIdOrName } from "@/lib/tts/voiceCatalog";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ voiceId: string }> }) {
  const { voiceId } = await params;
  const voice = findVoiceByIdOrName(voiceId);
  const targetId = voice ? voice.id : voiceId;

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
