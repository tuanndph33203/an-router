import { fork, type ChildProcess } from "node:child_process";
import path from "node:path";
import { findVoiceByIdOrName } from "./voiceCatalog.ts";

let workerProc: ChildProcess | null = null;
let reqSeq = 0;
const pendingRequests = new Map<
  number,
  { resolve: (buf: Buffer) => void; reject: (err: Error) => void }
>();

function getOrSpawnWorker(): ChildProcess {
  if (workerProc && workerProc.connected && !workerProc.killed) {
    return workerProc;
  }

  const workerScript = path.join(process.cwd(), "src", "lib", "tts", "vendor", "tts-worker.cjs");

  const child = fork(workerScript, [], {
    cwd: process.cwd(),
    execArgv: ["--max-old-space-size=512"],
    stdio: ["ignore", "inherit", "inherit", "ipc"],
  });

  child.on("message", (msg: any) => {
    if (!msg || typeof msg.id !== "number") return;
    const pending = pendingRequests.get(msg.id);
    if (!pending) return;
    pendingRequests.delete(msg.id);
    if (msg.ok && typeof msg.data === "string") {
      pending.resolve(Buffer.from(msg.data, "base64"));
    } else {
      pending.reject(new Error(msg.error || "TTS worker synthesis failed"));
    }
  });

  const cleanup = () => {
    if (workerProc === child) {
      workerProc = null;
    }
    for (const [id, pending] of pendingRequests.entries()) {
      pendingRequests.delete(id);
      pending.reject(new Error("TTS worker process exited unexpectedly"));
    }
  };

  child.on("exit", cleanup);
  child.on("error", cleanup);

  workerProc = child;
  return child;
}

export async function synthesizeNeuralVoice(
  text: string,
  voiceId = "ban_mai",
  speed = 1.0
): Promise<Buffer> {
  const voice = findVoiceByIdOrName(voiceId);
  const effectiveVoiceId = voice ? voice.id : voiceId;
  const effectiveModelKey = voice ? voice.modelKey : "Ban Mai";

  const worker = getOrSpawnWorker();
  const id = ++reqSeq;

  return new Promise<Buffer>((resolve, reject) => {
    const timer = setTimeout(() => {
      pendingRequests.delete(id);
      reject(new Error("TTS synthesis timed out after 30s"));
    }, 30000);

    pendingRequests.set(id, {
      resolve: (buf) => {
        clearTimeout(timer);
        resolve(buf);
      },
      reject: (err) => {
        clearTimeout(timer);
        reject(err);
      },
    });

    worker.send({
      id,
      text,
      voiceId: effectiveVoiceId,
      modelKey: effectiveModelKey,
      speed,
    });
  });
}
