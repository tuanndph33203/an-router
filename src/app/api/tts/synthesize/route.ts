import { NextRequest, NextResponse } from "next/server";
import { synthesizeSpeech } from "@/lib/tts/synthesizer";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const text = body.text || "";

    if (!text.trim()) {
      return NextResponse.json({ error: "Text không được để trống." }, { status: 400 });
    }

    const result = await synthesizeSpeech({
      text,
      voiceId: body.voiceId || body.voice,
      speed: typeof body.speed === "number" ? body.speed : 1.0,
      normalize: body.normalize !== false,
    });

    return new NextResponse(new Uint8Array(result.audioBuffer), {
      status: 200,
      headers: {
        "Content-Type": result.contentType,
        "Content-Length": result.audioBuffer.length.toString(),
        "X-Voice-Id": result.voiceId,
        "X-Normalized-Text": encodeURIComponent(result.normalizedText),
        "X-Tts-Source": result.source,
        "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
        Pragma: "no-cache",
        Expires: "0",
        "Access-Control-Expose-Headers": "X-Voice-Id, X-Normalized-Text, X-Tts-Source",
      },
    });
  } catch (err: any) {
    console.error("[TTS DEBUG ERROR]:", err);
    return NextResponse.json({ error: err?.message || String(err) }, { status: 500 });
  }
}
