import { NextRequest, NextResponse } from "next/server";
import { vietnameseNormalizer } from "@/lib/tts/vietnameseNormalizer";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const text = body.text || "";

    if (!text.trim()) {
      return NextResponse.json({ error: "Văn bản không được để trống." }, { status: 400 });
    }

    const normalizedText = vietnameseNormalizer.normalize(text);
    const chunks = vietnameseNormalizer.chunkText(normalizedText, 32);

    return NextResponse.json({
      originalText: text,
      normalizedText,
      chunks,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Lỗi chuẩn hóa văn bản" }, { status: 500 });
  }
}
