import fs from "node:fs";
import path from "node:path";
import { findVoiceByIdOrName } from "./voiceCatalog.ts";
import { vietnameseNormalizer } from "./vietnameseNormalizer.ts";
import { synthesizeGtts } from "../../../open-sse/executors/gtts.ts";

export interface TtsSynthesizeOptions {
  text: string;
  voiceId?: string;
  engine?: "google" | "nghitts" | "auto";
  speed?: number;
  lang?: string;
  normalize?: boolean;
}

export interface TtsSynthesizeResult {
  audioBuffer: Buffer;
  contentType: string;
  normalizedText: string;
  voiceId: string;
  source: "google-forward" | "local-engine" | "demo-fallback";
}

export async function synthesizeSpeech(
  options: TtsSynthesizeOptions
): Promise<TtsSynthesizeResult> {
  const voice = findVoiceByIdOrName(options.voiceId);
  const voiceId = voice ? voice.id : options.voiceId || "ban_mai";
  const speed = options.speed && options.speed > 0 ? options.speed : 1.0;
  const shouldNormalize = options.normalize !== false;

  const rawText = options.text?.trim() || "Xin chào";
  const normalizedText = shouldNormalize ? vietnameseNormalizer.normalize(rawText) : rawText;

  const isGoogleMode =
    options.engine === "google" || voiceId.startsWith("google") || voice?.engine === "google";

  // ── Strategy 1: Google TTS Forward (~150ms-300ms) ──
  if (isGoogleMode) {
    const lang = options.lang || "vi";
    try {
      const mp3Buffer = await synthesizeGtts({
        text: normalizedText,
        lang,
      });

      return {
        audioBuffer: mp3Buffer,
        contentType: "audio/mpeg",
        normalizedText,
        voiceId,
        source: "google-forward",
      };
    } catch (err: any) {
      console.warn("[TTS] Google forward failed, trying fallback:", err?.message);
    }
  }

  // ── Strategy 2: High-speed C# .NET 10 In-Process ONNX Engine (18 Vietnamese Voices) ──
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

  // ── Strategy 3: Pre-recorded WAV demo sample fallback ──
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
