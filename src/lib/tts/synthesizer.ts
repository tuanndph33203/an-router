import { findVoiceByIdOrName } from "./voiceCatalog.ts";
import { vietnameseNormalizer } from "./vietnameseNormalizer.ts";
import { synthesizeGtts } from "../../../open-sse/executors/gtts.ts";

export interface TtsSynthesizeOptions {
  text: string;
  voiceId?: string;
  engine?: "google" | "auto";
  speed?: number;
  lang?: string;
  normalize?: boolean;
}

export interface TtsSynthesizeResult {
  audioBuffer: Buffer;
  contentType: string;
  normalizedText: string;
  voiceId: string;
  source: "google-forward";
}

export async function synthesizeSpeech(
  options: TtsSynthesizeOptions
): Promise<TtsSynthesizeResult> {
  const voice = findVoiceByIdOrName(options.voiceId);
  const voiceId = voice ? voice.id : options.voiceId || "google_vi";
  const shouldNormalize = options.normalize !== false;

  const rawText = options.text?.trim() || "Xin chào";
  const normalizedText = shouldNormalize ? vietnameseNormalizer.normalize(rawText) : rawText;
  const lang = options.lang || "vi";

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
}
