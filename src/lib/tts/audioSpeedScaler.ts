import { execFile } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

const PYTHON_SCRIPT = `
import sys, os, tempfile, gi
gi.require_version("Gst", "1.0")
from gi.repository import Gst
Gst.init(None)

input_file = sys.argv[1]
output_file = sys.argv[2]
speed = float(sys.argv[3])

pipe_str = f"filesrc location={input_file} ! mpegaudioparse ! avdec_mp3 ! audioconvert ! scaletempo ! lamemp3enc ! filesink location={output_file}"
pipe = Gst.parse_launch(pipe_str)
pipe.set_state(Gst.State.PAUSED)
pipe.get_state(Gst.CLOCK_TIME_NONE)

pipe.seek(speed, Gst.Format.TIME, Gst.SeekFlags.FLUSH | Gst.SeekFlags.ACCURATE, Gst.SeekType.SET, 0, Gst.SeekType.NONE, -1)
pipe.set_state(Gst.State.PLAYING)

bus = pipe.get_bus()
bus.timed_pop_filtered(Gst.CLOCK_TIME_NONE, Gst.MessageType.EOS | Gst.MessageType.ERROR)
pipe.set_state(Gst.State.NULL)
`;

export async function scaleMp3Speed(mp3Buffer: Buffer, speed: number): Promise<Buffer> {
  const safeSpeed = Math.max(0.5, Math.min(2.5, speed));
  if (Math.abs(safeSpeed - 1.0) < 0.05) {
    return mp3Buffer;
  }

  const tmpDir = os.tmpdir();
  const rand = Math.random().toString(36).slice(2, 8);
  const inputPath = path.join(tmpDir, `gtts_in_${Date.now()}_${rand}.mp3`);
  const outputPath = path.join(tmpDir, `gtts_out_${Date.now()}_${rand}.mp3`);

  fs.writeFileSync(inputPath, mp3Buffer);

  return new Promise<Buffer>((resolve) => {
    execFile(
      "python3",
      ["-c", PYTHON_SCRIPT, inputPath, outputPath, safeSpeed.toString()],
      { timeout: 8000 },
      (err) => {
        try {
          if (!err && fs.existsSync(outputPath)) {
            const scaledBuffer = fs.readFileSync(outputPath);
            resolve(scaledBuffer);
          } else {
            resolve(mp3Buffer);
          }
        } catch {
          resolve(mp3Buffer);
        } finally {
          try {
            if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
            if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
          } catch {}
        }
      }
    );
  });
}
