import { NextResponse } from "next/server";
import { getAllVietnameseVoices } from "@/lib/tts/voiceCatalog";

export const dynamic = "force-dynamic";

export async function GET() {
  const voices = getAllVietnameseVoices();
  return NextResponse.json({
    success: true,
    total: voices.length,
    voices,
  });
}
