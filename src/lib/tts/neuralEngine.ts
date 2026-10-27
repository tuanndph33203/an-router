import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { findVoiceByIdOrName } from "./voiceCatalog.ts";

const runtimeRequire = createRequire(path.join(process.cwd(), "package.json"));
const ORT_PATH =
  "/home/nguyendinhtuan/Documents/antigravity/bold-noether/nghitts/node_modules/onnxruntime-web";
const ort = runtimeRequire(ORT_PATH);

interface VoiceSessionCache {
  session: any;
  config: any;
}

const sessionCache = new Map<string, VoiceSessionCache>();

const MODELS_DIR = path.join(process.cwd(), "models", "tts");

async function ensureModelDownloaded(
  voiceId: string,
  modelKey: string
): Promise<{ modelPath: string; configPath: string }> {
  if (!fs.existsSync(MODELS_DIR)) {
    fs.mkdirSync(MODELS_DIR, { recursive: true });
  }

  const modelPath = path.join(MODELS_DIR, `${voiceId}.onnx`);
  const configPath = path.join(MODELS_DIR, `${voiceId}.onnx.json`);

  if (fs.existsSync(modelPath) && fs.existsSync(configPath)) {
    return { modelPath, configPath };
  }

  const encodedKey = encodeURIComponent(modelKey);
  const onnxUrl = `https://nghitts.app/api/model/${encodedKey}.onnx`;
  const jsonUrl = `https://nghitts.app/api/model/${encodedKey}.onnx.json`;

  if (!fs.existsSync(configPath)) {
    const resConfig = await fetch(jsonUrl);
    if (!resConfig.ok) {
      throw new Error(`Không thể tải cấu hình mô hình từ ${jsonUrl} (HTTP ${resConfig.status})`);
    }
    const configBuffer = Buffer.from(await resConfig.arrayBuffer());
    fs.writeFileSync(configPath, configBuffer);
  }

  if (!fs.existsSync(modelPath)) {
    const resModel = await fetch(onnxUrl);
    if (!resModel.ok) {
      throw new Error(`Không thể tải mô hình ONNX từ ${onnxUrl} (HTTP ${resModel.status})`);
    }
    const modelBuffer = Buffer.from(await resModel.arrayBuffer());
    fs.writeFileSync(modelPath, modelBuffer);
  }

  return { modelPath, configPath };
}

async function getOrLoadSession(voiceId: string, modelKey: string): Promise<VoiceSessionCache> {
  const cached = sessionCache.get(voiceId);
  if (cached) {
    return cached;
  }

  const { modelPath, configPath } = await ensureModelDownloaded(voiceId, modelKey);

  const modelBuffer = fs.readFileSync(modelPath);
  const config = JSON.parse(fs.readFileSync(configPath, "utf8"));

  const session = await ort.InferenceSession.create(modelBuffer, {
    executionProviders: [{ name: "wasm", simd: true }],
  });

  const entry: VoiceSessionCache = { session, config };
  sessionCache.set(voiceId, entry);
  return entry;
}

export async function synthesizeNeuralVoice(
  text: string,
  voiceId = "ban_mai",
  speed = 1.0
): Promise<Buffer> {
  const voice = findVoiceByIdOrName(voiceId);
  const effectiveVoiceId = voice ? voice.id : voiceId;
  const effectiveModelKey = voice ? voice.modelKey : "Ban Mai";

  const { session, config } = await getOrLoadSession(effectiveVoiceId, effectiveModelKey);

  // Load eSpeak phonemizer (vendored CommonJS) via runtimeRequire
  const phonemizerPath = path.join(
    process.cwd(),
    "src",
    "lib",
    "tts",
    "vendor",
    "phonemizer",
    "dist",
    "phonemizer.cjs"
  );
  const { phonemize } = runtimeRequire(phonemizerPath);

  // Normalize Unicode NFC and ensure sentence punctuation if missing
  let inputText = text.trim();
  const lastChar = inputText.slice(-1);
  if (lastChar !== "." && lastChar !== "!" && lastChar !== "?" && lastChar !== "…") {
    inputText += ".";
  }

  const rawPhonemes: string[] = await phonemize(inputText, "vi");
  const idMap = config.phoneme_id_map || {};

  const bosId = Array.isArray(idMap["^"]) ? idMap["^"][0] : 1;
  const padId = Array.isArray(idMap["_"]) ? idMap["_"][0] : 0;
  const eosId = Array.isArray(idMap["$"]) ? idMap["$"][0] : 2;

  const phonemeIds: number[] = [bosId, padId];

  for (const part of rawPhonemes) {
    const normalizedPart = part.normalize("NFD");
    for (let i = 0; i < normalizedPart.length; i++) {
      const ch = normalizedPart[i];
      if (ch in idMap) {
        const mapped = idMap[ch];
        const val = Array.isArray(mapped) ? mapped[0] : mapped;
        phonemeIds.push(val);
        phonemeIds.push(padId);
      }
    }
  }

  phonemeIds.push(eosId);

  // Speaking rate in Piper is inversely proportional to lengthScale
  const safeSpeed = Math.max(0.5, Math.min(2.0, speed));
  const lengthScale = 1.0 / safeSpeed;
  const noiseScale = config.inference?.noise_scale || 0.667;
  const noiseW = config.inference?.noise_w || 0.8;

  const inputs: Record<string, any> = {
    input: new ort.Tensor("int64", new BigInt64Array(phonemeIds.map((x) => BigInt(x))), [
      1,
      phonemeIds.length,
    ]),
    input_lengths: new ort.Tensor("int64", BigInt64Array.from([BigInt(phonemeIds.length)]), [1]),
    scales: new ort.Tensor("float32", Float32Array.from([noiseScale, lengthScale, noiseW]), [3]),
  };

  if (config.num_speakers > 1) {
    inputs["sid"] = new ort.Tensor("int64", BigInt64Array.from([BigInt(0)]), [1]);
  }

  const results = await session.run(inputs);
  const rawData: Float32Array = results.output.data;
  const audioData = new Float32Array(rawData);

  // Anti-crack envelope: smooth linear decay over last 250 samples to prevent popping/breaking sound
  const fadeCount = Math.min(250, audioData.length);
  for (let i = 0; i < fadeCount; i++) {
    const factor = (fadeCount - i) / fadeCount;
    audioData[audioData.length - fadeCount + i] *= factor;
  }

  // Trailing silence padding (~160ms) for natural room ambience and smooth DAC playback
  const sampleRate = config.audio?.sample_rate || 22050;
  const silenceSamples = Math.floor(sampleRate * 0.16);
  const totalSamples = audioData.length + silenceSamples;

  const wavBuf = Buffer.alloc(44 + totalSamples * 2);
  wavBuf.write("RIFF", 0);
  wavBuf.writeUInt32LE(36 + totalSamples * 2, 4);
  wavBuf.write("WAVE", 8);
  wavBuf.write("fmt ", 12);
  wavBuf.writeUInt32LE(16, 16);
  wavBuf.writeUInt16LE(1, 20); // PCM format
  wavBuf.writeUInt16LE(1, 22); // Mono channel
  wavBuf.writeUInt32LE(sampleRate, 24);
  wavBuf.writeUInt32LE(sampleRate * 2, 28);
  wavBuf.writeUInt16LE(2, 32);
  wavBuf.writeUInt16LE(16, 34);
  wavBuf.write("data", 36);
  wavBuf.writeUInt32LE(totalSamples * 2, 40);

  for (let i = 0; i < audioData.length; i++) {
    const s = Math.max(-1, Math.min(1, audioData[i]));
    wavBuf.writeInt16LE(s < 0 ? s * 0x8000 : s * 0x7fff, 44 + i * 2);
  }

  return wavBuf;
}
