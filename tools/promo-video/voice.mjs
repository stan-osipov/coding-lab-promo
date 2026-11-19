#!/usr/bin/env node
//
// Read the script aloud. Run by render.mjs as a CHILD PROCESS, not imported:
// onnxruntime (under kokoro-js) cannot be torn down cleanly on macOS and aborts
// the process on exit with "mutex lock failed". Here that abort lands after the
// files are written and nobody is listening for it; in the renderer it would
// have ended the run.
//
//   node voice.mjs <script.json> <out-dir> <only-id-or-empty>
//
// Writes one WAV per scene into <out-dir> and a `lines.json` beside them with
// each line's measured length and where its sentences start.

import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

const run = promisify(execFile);
const [scriptPath, outDir, only] = process.argv.slice(2);
const script = JSON.parse(await readFile(scriptPath, "utf8"));
const scenes = only ? script.scenes.filter((s) => s.id === only) : script.scenes;
await mkdir(outDir, { recursive: true });

/** 16-bit PCM mono WAV from float samples. */
function wavBytes(samples, rate) {
  const buf = Buffer.alloc(44 + samples.length * 2);
  buf.write("RIFF", 0); buf.writeUInt32LE(36 + samples.length * 2, 4); buf.write("WAVE", 8);
  buf.write("fmt ", 12); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(1, 22);
  buf.writeUInt32LE(rate, 24); buf.writeUInt32LE(rate * 2, 28); buf.writeUInt16LE(2, 32); buf.writeUInt16LE(16, 34);
  buf.write("data", 36); buf.writeUInt32LE(samples.length * 2, 40);
  for (let i = 0; i < samples.length; i++) {
    const v = Math.max(-1, Math.min(1, samples[i]));
    buf.writeInt16LE(Math.round(v < 0 ? v * 32768 : v * 32767), 44 + i * 2);
  }
  return buf;
}

/**
 * The reader. Kokoro is spoken a sentence at a time, with a short breath
 * between sentences and a longer one at a line break, which is how a narrator
 * paces a paragraph; one long call runs the sentences together.
 */
async function makeReader(voice) {
  if (voice.engine === "say") {
    const v = voice.say ?? { name: "Samantha", rate: 170 };
    return async (text, file) => {
      await run("say", ["-v", v.name, "-r", String(v.rate), "-o", file, text.replace(/\n/g, " [[slnc 420]] ")]);
      return [];
    };
  }
  const { KokoroTTS } = await import("kokoro-js");
  process.stdout.write("Loading the Kokoro voice… ");
  const tts = await KokoroTTS.from_pretrained("onnx-community/Kokoro-82M-v1.0-ONNX", { dtype: "fp32", device: "cpu" });
  console.log("ready.");
  const BREATH = 0.24, PAUSE = 0.55;
  return async (text, file) => {
    const parts = [], marks = [];
    let rate = 24000, at = 0;
    for (const [li, line] of text.split("\n").entries()) {
      if (li > 0) { const gap = new Float32Array(Math.round(rate * (PAUSE - BREATH))); parts.push(gap); at += gap.length; }
      for (const sentence of line.split(/(?<=[.!?])\s+/).filter(Boolean)) {
        const audio = await tts.generate(sentence, { voice: voice.name, speed: voice.speed ?? 1 });
        rate = audio.sampling_rate;
        marks.push({ at: at / rate, text: sentence });
        const breath = new Float32Array(Math.round(rate * BREATH));
        parts.push(audio.audio, breath);
        at += audio.audio.length + breath.length;
      }
    }
    parts.pop();                                   // no breath after the last sentence
    const total = parts.reduce((n, a) => n + a.length, 0);
    const all = new Float32Array(total);
    let o = 0;
    for (const a of parts) { all.set(a, o); o += a.length; }
    await writeFile(file, wavBytes(all, rate));
    return marks;
  };
}

const read = await makeReader(script.voice);
const lines = [];
for (const scene of scenes) {
  const file = join(outDir, `${scene.id}.wav`);
  const marks = await read(scene.say, file);
  const { stdout } = await run("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", file]);
  lines.push({ id: scene.id, file, speech: Number(stdout.trim()), marks });
}
await writeFile(join(outDir, "lines.json"), JSON.stringify(lines, null, 2));
// Leave by the front door before onnxruntime can trip over its own threads.
process.stdout.write("", () => process.kill(process.pid, "SIGKILL"));
