"use strict";

const fs = require("node:fs");
const path = require("node:path");

const ort = require("onnxruntime-web");
if (ort && ort.env && ort.env.wasm) {
  ort.env.wasm.numThreads = 1;
  const wasmDir = path.join(process.cwd(), "node_modules", "onnxruntime-web", "dist") + "/";
  if (fs.existsSync(wasmDir)) {
    ort.env.wasm.wasmPaths = wasmDir;
  }
}

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
const { phonemize } = require(phonemizerPath);

const MODELS_DIR = path.join(process.cwd(), "models", "tts");
let currentVoiceId = null;
let currentSession = null;
let currentConfig = null;
let idleTimer = null;

function resetIdleTimer() {
  if (idleTimer) clearTimeout(idleTimer);
  idleTimer = setTimeout(() => {
    process.exit(0);
  }, 15000);
}

async function ensureModelDownloaded(voiceId, modelKey) {
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
    fs.writeFileSync(configPath, Buffer.from(await resConfig.arrayBuffer()));
  }
  if (!fs.existsSync(modelPath)) {
    const resModel = await fetch(onnxUrl);
    if (!resModel.ok) {
      throw new Error(`Không thể tải mô hình ONNX từ ${onnxUrl} (HTTP ${resModel.status})`);
    }
    fs.writeFileSync(modelPath, Buffer.from(await resModel.arrayBuffer()));
  }
  return { modelPath, configPath };
}

async function getSession(voiceId, modelKey) {
  if (currentVoiceId === voiceId && currentSession && currentConfig) {
    return { session: currentSession, config: currentConfig };
  }
  if (currentSession && typeof currentSession.release === "function") {
    try {
      await currentSession.release();
    } catch {}
  }
  const { modelPath, configPath } = await ensureModelDownloaded(voiceId, modelKey);
  const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
  const session = await ort.InferenceSession.create(modelPath, {
    executionProviders: [{ name: "wasm", simd: true }],
    enableCpuMemArena: false,
    enableMemPattern: false,
  });
  currentVoiceId = voiceId;
  currentSession = session;
  currentConfig = config;
  return { session, config };
}

async function synthesize({ text, voiceId, modelKey, speed }) {
  const { session, config } = await getSession(voiceId, modelKey);

  let inputText = (text || "").trim();
  const lastChar = inputText.slice(-1);
  if (lastChar !== "." && lastChar !== "!" && lastChar !== "?" && lastChar !== "…") {
    inputText += ".";
  }

  const rawPhonemes = await phonemize(inputText, "vi");
  const idMap = config.phoneme_id_map || {};
  const bosId = Array.isArray(idMap["^"]) ? idMap["^"][0] : 1;
  const padId = Array.isArray(idMap["_"]) ? idMap["_"][0] : 0;
  const eosId = Array.isArray(idMap["$"]) ? idMap["$"][0] : 2;

  const phonemeIds = [bosId, padId];
  for (const part of rawPhonemes) {
    const normalizedPart = part.normalize("NFD");
    for (let i = 0; i < normalizedPart.length; i++) {
      const ch = normalizedPart[i];
      if (ch in idMap) {
        const mapped = idMap[ch];
        phonemeIds.push(Array.isArray(mapped) ? mapped[0] : mapped);
        phonemeIds.push(padId);
      }
    }
  }
  phonemeIds.push(eosId);

  const safeSpeed = Math.max(0.5, Math.min(2.0, speed || 1.0));
  const lengthScale = 1.0 / safeSpeed;
  const noiseScale = config.inference?.noise_scale || 0.667;
  const noiseW = config.inference?.noise_w || 0.8;

  const inputs = {
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
  const audioData = new Float32Array(results.output.data);

  const fadeCount = Math.min(250, audioData.length);
  for (let i = 0; i < fadeCount; i++) {
    const factor = (fadeCount - i) / fadeCount;
    audioData[audioData.length - fadeCount + i] *= factor;
  }

  const sampleRate = config.audio?.sample_rate || 22050;
  const silenceSamples = Math.floor(sampleRate * 0.16);
  const totalSamples = audioData.length + silenceSamples;

  const wavBuf = Buffer.alloc(44 + totalSamples * 2);
  wavBuf.write("RIFF", 0);
  wavBuf.writeUInt32LE(36 + totalSamples * 2, 4);
  wavBuf.write("WAVE", 8);
  wavBuf.write("fmt ", 12);
  wavBuf.writeUInt32LE(16, 16);
  wavBuf.writeUInt16LE(1, 20);
  wavBuf.writeUInt16LE(1, 22);
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

resetIdleTimer();

process.on("message", async (msg) => {
  resetIdleTimer();
  try {
    const buf = await synthesize(msg);
    process.send({ id: msg.id, ok: true, data: buf.toString("base64") });
  } catch (err) {
    process.send({ id: msg.id, ok: false, error: err?.message || String(err) });
  } finally {
    resetIdleTimer();
  }
});
