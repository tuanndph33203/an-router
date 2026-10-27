import fs from "node:fs";
import path from "node:path";
import { findVoiceByIdOrName } from "./voiceCatalog.ts";
import { vietnameseNormalizer } from "./vietnameseNormalizer.ts";

export interface TtsSynthesizeOptions {
  text: string;
  voiceId?: string;
  speed?: number;
  normalize?: boolean;
}

export interface TtsSynthesizeResult {
  audioBuffer: Buffer;
  contentType: string;
  normalizedText: string;
  voiceId: string;
  source: "local-engine" | "demo-fallback";
}

export async function synthesizeSpeech(
  options: TtsSynthesizeOptions
): Promise<TtsSynthesizeResult> {
  const voice = findVoiceByIdOrName(options.voiceId);
  const voiceId = voice ? voice.id : "ban_mai";
  const speed = options.speed && options.speed > 0 ? options.speed : 1.0;
  const shouldNormalize = options.normalize !== false;

  const rawText = options.text?.trim() || "Xin chào";
  const normalizedText = shouldNormalize ? vietnameseNormalizer.normalize(rawText) : rawText;

  // Strategy 1: Call high-speed C# .NET 10 In-Process ONNX Engine on port 5000 if active
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);

    const res = await fetch("http://localhost:5000/api/tts/synthesize", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: rawText,
        voiceId,
        speed,
        normalize: shouldNormalize,
      }),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (res.ok) {
      const arrayBuffer = await res.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      return {
        audioBuffer: buffer,
        contentType: "audio/wav",
        normalizedText,
        voiceId,
        source: "local-engine",
      };
    }
  } catch {
    // Port 5000 engine not reachable, proceed to local demo sample fallback
  }

  // Strategy 2: Pre-recorded WAV demo sample
  const demoPath = path.join(process.cwd(), "public", "tts", "demos", `${voiceId}_demo.wav`);
  if (fs.existsSync(demoPath)) {
    const buffer = fs.readFileSync(demoPath);
    return {
      audioBuffer: buffer,
      contentType: "audio/wav",
      normalizedText,
      voiceId,
      source: "demo-fallback",
    };
  }

  throw new Error(`Không thể tổng hợp giọng nói cho ${voiceId}.`);
}
