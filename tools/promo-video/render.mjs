#!/usr/bin/env node
//
// Render the Coding Lab promo video.
//
//   node tools/promo-video/render.mjs --out promo.mp4
//   node tools/promo-video/render.mjs --stills          # one PNG per scene
//   node tools/promo-video/render.mjs --only hub        # just that scene
//   node tools/promo-video/render.mjs --stills --only stats --at 6.5   # that scene, 6.5s in
//   node tools/promo-video/render.mjs --timing          # speak, print the timeline, stop
//
// How it works, in one breath: a neural voice (Kokoro, run locally) reads each
// line of script.json and the result is MEASURED, so the picture is cut to the
// voice rather than the voice squeezed into a guessed duration. storyboard.html is then opened in headless
// Chrome with every animation PAUSED, and each frame is produced by setting the
// animations' clocks by hand and taking a screenshot. Nothing depends on the
// render keeping up with real time, so the output is identical on every run.
//
// Requires: Chrome (driven by Playwright), ffmpeg, and kokoro-js (npm install).
// With `voice.engine: "say"` in script.json the macOS system voice is used instead.

import { chromium } from "playwright";
import { spawn, execFile } from "node:child_process";
import { promisify } from "node:util";
import { createServer } from "node:http";
import { readFile, mkdir, rm, writeFile } from "node:fs/promises";
import { createReadStream } from "node:fs";
import { extname, resolve, dirname, join } from "node:path";

const run = promisify(execFile);
const HERE = dirname(new URL(import.meta.url).pathname);
const REPO = resolve(HERE, "../..");
const WORK = join(HERE, ".work");

/* ------------------------------------------------------------- arguments -- */

const argv = process.argv.slice(2);
const flag = (name, fallback = null) => {
  const i = argv.indexOf(`--${name}`);
  return i === -1 ? fallback : (argv[i + 1]?.startsWith("--") ? true : argv[i + 1] ?? true);
};
const has = (name) => argv.includes(`--${name}`);

const script = JSON.parse(await readFile(join(HERE, "script.json"), "utf8"));
const FPS = Number(flag("fps", script.fps));
const SCALE = Number(flag("scale", script.scale));
const XFADE = Number(flag("crossfade", script.crossfade));
const OUT = resolve(String(flag("out", join(HERE, "coding-lab-promo.mp4"))));
const ONLY = flag("only", null);
const scenes = ONLY ? script.scenes.filter((s) => s.id === ONLY) : script.scenes;
if (!scenes.length) throw new Error(`no scene matches --only ${ONLY}`);

/* ----------------------------------------------------------- voice-over -- */

await rm(WORK, { recursive: true, force: true });
await mkdir(join(WORK, "vo"), { recursive: true });

// The reading happens in voice.mjs, a process of its own — see the note at the
// top of that file for why. Its exit code is meaningless (it ends itself); the
// lines.json it leaves behind is what says it finished.
console.log("Reading the script aloud…");
await new Promise((done) => {
  const child = spawn(process.execPath, [join(HERE, "voice.mjs"), join(HERE, "script.json"), join(WORK, "vo"), ONLY ?? ""],
    { stdio: "inherit" });
  child.on("close", done);
});
const spoken = JSON.parse(await readFile(join(WORK, "vo", "lines.json"), "utf8").catch(() => {
  throw new Error("the voice step did not finish — see the output above");
}));

const timeline = [];
let cursor = 0;
for (const scene of scenes) {
  const line = spoken.find((l) => l.id === scene.id);
  if (!line) throw new Error(`no audio was produced for scene ${scene.id}`);
  const duration = scene.lead + line.speech + scene.tail;
  timeline.push({ ...scene, ...line, duration, start: cursor, voiceAt: cursor + scene.lead });
  cursor += duration - XFADE;          // the next scene dissolves in over the tail
}
const TOTAL = timeline.at(-1).start + timeline.at(-1).duration;

for (const s of timeline) {
  console.log(
    `  ${s.id.padEnd(15)} ${s.start.toFixed(2).padStart(6)}s  +${s.duration.toFixed(2)}s` +
    `  (voice ${s.speech.toFixed(2)}s at ${s.voiceAt.toFixed(2)}s)`,
  );
  // Where each sentence starts, as a scene-local time: what the --d delays in
  // storyboard.html are written against.
  if (has("timing")) for (const m of s.marks) console.log(`      ${(s.lead + m.at).toFixed(2).padStart(6)}s  ${m.text}`);
}
console.log(`  ${"total".padEnd(15)} ${TOTAL.toFixed(2)}s, ${Math.round(TOTAL * FPS)} frames\n`);
await writeFile(join(WORK, "timeline.json"), JSON.stringify(timeline, null, 2));
if (has("timing")) process.exit(0);

/* --------------------------------------------------------- local server -- */

const MIME = {
  ".html": "text/html", ".css": "text/css", ".js": "text/javascript",
  ".svg": "image/svg+xml", ".png": "image/png", ".ico": "image/x-icon",
  ".json": "application/json", ".webmanifest": "application/manifest+json",
};
const server = createServer((req, res) => {
  const path = resolve(REPO, "." + decodeURIComponent(req.url.split("?")[0]));
  if (!path.startsWith(REPO)) { res.writeHead(403).end(); return; }
  const file = createReadStream(path);
  file.once("error", () => res.writeHead(404).end());          // e.g. /favicon.ico
  file.once("open", () => {
    res.writeHead(200, { "content-type": MIME[extname(path)] ?? "application/octet-stream" });
    file.pipe(res);
  });
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const ORIGIN = `http://127.0.0.1:${server.address().port}`;

/* -------------------------------------------------------------- the page -- */

const browser = await chromium.launch({ channel: "chrome", headless: true });
const page = await browser.newPage({
  viewport: { width: script.width, height: script.height },
  deviceScaleFactor: SCALE,
});
await page.goto(`${ORIGIN}/tools/promo-video/storyboard.html`, { waitUntil: "networkidle" });
await page.evaluate(() => window.spriteReady);
await page.evaluate(() => document.fonts.ready);

// Set up the frozen clock. Every animation is paused and tagged with the scene
// it belongs to; -1 means it lives in the persistent chrome and runs on the
// video's global clock instead.
const known = await page.evaluate(({ total, ids }) => {
  document.documentElement.style.setProperty("--total", `${total}s`);
  const sections = ids.map((id) => document.querySelector(`[data-scene="${id}"]`));
  const missing = ids.filter((id, i) => !sections[i]);
  const anims = document.getAnimations();
  anims.forEach((a) => a.pause());
  window.__anims = anims;
  window.__scene = anims.map((a) => {
    const target = a.effect?.target;
    return target ? sections.findIndex((s) => s && s.contains(target)) : -1;
  });
  window.__sections = sections;
  window.__chrome = document.querySelector(".chrome");

  window.__frame = (t, visible) => {
    window.__sections.forEach((s, i) => {
      if (!s) return;
      const v = visible.find((x) => x.i === i);
      s.classList.toggle("is-on", !!v);
      s.style.opacity = v ? v.o : 0;
    });
    window.__anims.forEach((a, k) => {
      const i = window.__scene[k];
      const local = i === -1 ? t : t - visible.find((x) => x.i === i)?.start;
      if (!Number.isFinite(local)) return;
      try { a.currentTime = Math.max(0, local) * 1000; } catch {}
    });
  };
  window.__chromeAt = (o) => { window.__chrome.style.opacity = o; };
  return { missing, animations: anims.length };
}, { total: TOTAL, ids: timeline.map((s) => s.id) });

if (known.missing.length) throw new Error(`storyboard.html has no scene for: ${known.missing.join(", ")}`);
console.log(`Storyboard ready: ${known.animations} animations across ${timeline.length} scenes.`);

/** Which scenes are on screen at `t`, and at what opacity. */
function visibleAt(t) {
  const out = [];
  timeline.forEach((s, i) => {
    if (t < s.start || t >= s.start + s.duration) return;
    const into = t - s.start;
    // A scene is fully opaque once its dissolve-in is done; the scene beneath
    // simply stays put and is covered, which keeps the blend clean on white.
    const o = i === 0 || into >= XFADE ? 1 : into / XFADE;
    out.push({ i, o, start: s.start });
  });
  return out;
}

/** The brand lockup and progress line: up after the title, down under the CTA. */
function chromeAt(t) {
  // Hold off until the opening card has fully dissolved away, and clear out
  // before the closing one arrives: two Coding Lab lockups on screen at once
  // reads as a mistake.
  const up = timeline.length > 1 ? timeline[1].start + XFADE : 0;
  const down = Math.max(0, timeline.at(-1).start - 0.35);
  if (t < up) return 0;
  if (t < up + 0.6) return (t - up) / 0.6;
  if (t < down) return 1;
  return Math.max(0, 1 - (t - down) / 0.5);
}

/* ------------------------------------------------------------- the stills -- */

if (has("stills")) {
  const dir = join(HERE, "stills");
  await mkdir(dir, { recursive: true });
  for (const s of timeline) {
    const at = flag("at", null);
    const t = s.start + (at !== null ? Math.min(s.duration - 0.05, Number(at)) : Math.min(s.duration - 0.1, s.lead + s.speech));
    await page.evaluate(({ t, v, c }) => { window.__frame(t, v); window.__chromeAt(c); },
      { t, v: visibleAt(t), c: chromeAt(t) });
    await page.screenshot({ path: join(dir, `${s.id}.png`), type: "png" });
    console.log(`  still  ${s.id}.png`);
  }
  await browser.close(); server.close();
  console.log(`\nStills in ${dir}`);
  process.exit(0);
}

/* -------------------------------------------------------------- the video -- */

const silent = join(WORK, "silent.mp4");
const ff = spawn("ffmpeg", [
  "-y", "-loglevel", "error",
  "-f", "image2pipe", "-framerate", String(FPS), "-i", "-",
  "-c:v", "libx264", "-preset", "slow", "-crf", "17",
  "-pix_fmt", "yuv420p", "-movflags", "+faststart",
  silent,
], { stdio: ["pipe", "inherit", "inherit"] });
const ffDone = new Promise((ok, no) =>
  ff.on("close", (c) => (c === 0 ? ok() : no(new Error(`ffmpeg exited ${c}`)))));

const frames = Math.round(TOTAL * FPS);
const began = Date.now();
for (let f = 0; f < frames; f++) {
  const t = f / FPS;
  await page.evaluate(({ t, v, c }) => { window.__frame(t, v); window.__chromeAt(c); },
    { t, v: visibleAt(t), c: chromeAt(t) });
  const png = await page.screenshot({ type: "png" });
  if (!ff.stdin.write(png)) await new Promise((r) => ff.stdin.once("drain", r));
  if (f % 60 === 0 || f === frames - 1) {
    const done = (f + 1) / frames;
    const left = ((Date.now() - began) / done) * (1 - done) / 1000;
    process.stdout.write(`\r  frame ${f + 1}/${frames}  ${(done * 100).toFixed(0)}%  ~${left.toFixed(0)}s left   `);
  }
}
ff.stdin.end();
await ffDone;
await browser.close();
server.close();
console.log(`\n  picture: ${((Date.now() - began) / 1000).toFixed(0)}s`);

/* -------------------------------------------------------------- the sound -- */

// Each line is laid onto one silent bed at its own start, then the whole track
// is levelled to the -16 LUFS that web video is mastered to.
const track = join(WORK, "voice.wav");
const inputs = timeline.flatMap((s) => ["-i", s.file]);
const lanes = timeline
  .map((s, i) => `[${i}:a]adelay=${Math.round(s.voiceAt * 1000)}:all=1[v${i}]`)
  .join(";");
const mix = timeline.map((_, i) => `[v${i}]`).join("");
await run("ffmpeg", [
  "-y", "-loglevel", "error", ...inputs,
  "-filter_complex",
  `${lanes};${mix}amix=inputs=${timeline.length}:normalize=0:dropout_transition=0[m];` +
  `[m]highpass=f=80,lowpass=f=12000,acompressor=threshold=-18dB:ratio=2.2:attack=12:release=160:makeup=2,loudnorm=I=-16:TP=-1.5:LRA=11,apad[a]`,
  "-map", "[a]", "-t", String(TOTAL), "-ar", "48000", "-ac", "2", track,
]);

await run("ffmpeg", [
  "-y", "-loglevel", "error",
  "-i", silent, "-i", track,
  "-c:v", "copy", "-c:a", "aac", "-b:a", "192k",
  "-movflags", "+faststart", "-shortest", OUT,
]);

/* ----------------------------------------------------------- the subtitles -- */

const srtTime = (s) => {
  const ms = Math.round(s * 1000);
  const p = (n, w = 2) => String(n).padStart(w, "0");
  return `${p(Math.floor(ms / 3600000))}:${p(Math.floor(ms / 60000) % 60)}:${p(Math.floor(ms / 1000) % 60)},${p(ms % 1000, 3)}`;
};
await writeFile(
  OUT.replace(/\.mp4$/, ".srt"),
  timeline.map((s, i) =>
    `${i + 1}\n${srtTime(s.voiceAt)} --> ${srtTime(s.voiceAt + s.speech)}\n${s.caption}\n`).join("\n"),
);

const { stdout: probe } = await run("ffprobe", [
  "-v", "error", "-show_entries", "format=duration,size", "-of", "default=nw=1", OUT,
]);
console.log(`\nDone.\n  ${OUT}\n  ${OUT.replace(/\.mp4$/, ".srt")}\n${probe.trim().split("\n").map((l) => "  " + l).join("\n")}`);
