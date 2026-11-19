# The promo video

A narrated ~80-second film of what Coding Lab is: one interface over every
conversation, project and AI account; things defined once and inherited; the
two ways to start a project; machines and the accounts on them; the team's
statistics. It is **rendered from this folder**, not edited in a video app, so
changing a word of the script and running one command gives you a new cut.

```sh
npm install                                   # once: Playwright + the voice
node tools/promo-video/render.mjs --out /tmp/coding-lab-promo.mp4
```

Out comes a 1920×1080 H.264 file at 30 fps with an AAC voice track, and a
`.srt` of the same name beside it. The first run downloads the voice model
(about 330 MB, into `node_modules`); after that everything is offline except
the fonts.

## What is in here

| File | What it is |
|---|---|
| `script.json` | The narration, the voice, and the scene order. **Start here.** |
| `storyboard.html` | The eight scenes, as real HTML and CSS |
| `storyboard.css` | Scene layout, motion, and the product's own design tokens |
| `render.mjs` | Drives the browser frame by frame, encodes the file |
| `voice.mjs` | Reads the script aloud (run by `render.mjs` as a child process) |
| `brand/` | The OpenAI and DeepSeek marks (Simple Icons, CC0) |

## Where the screens come from

Nothing in the video is a screenshot. The FRAME around the screens is the
landing page's design system, read straight from `public/assets/styles.css`
and its icon sprite. The SCREENS — the sessions rail and conversation, the
Accounts tab, the Dashboard in report and live mode, the starting-point
wizard, the inherited-settings card — are the product's own components
transcribed to static HTML from the app's SCSS (`SessionsChat.scss`,
`AccountsBoard.scss`, `WorkspaceOverview.scss`, `ProjectAi.scss`,
`themes.scss` in the capital-wizard repository), light theme, with the app's
indigo accent and its ×1.08 type scale. The provider marks are the app's
`BrandLogo` set: the Claude sunburst and the "custom" sliders are drawn
inline, OpenAI and DeepSeek are the CC0 files in `brand/`.

The names and figures are the landing page's invented ones (Northwind Studio,
Orbit Website, Anna Kowalska…), so the README's "sample content" caveat
covers the video too.

## The voice

The narration is **Kokoro-82M**, an open neural voice run locally through
`kokoro-js` — no account, no API key, nothing leaves the machine. `voice` in
`script.json` picks the speaker and pace:

```json
"voice": { "engine": "kokoro", "name": "af_heart", "speed": 1.2, "breath": 0.16, "pause": 0.38 }
```

Voices worth trying: `af_heart` (default, warm), `af_bella`, `bf_emma`
(British), `am_michael`, `am_fenrir`, `bm_george`. Each sentence is spoken on
its own, faded in and out over 8 ms, with `breath` seconds between sentences
and `pause` seconds at a `\n` in the line, which is how a narrator paces a
paragraph. `speed` above about 1.25 starts to sound rushed. `"engine": "say"`
falls back to the macOS system voice.

The finished track is cleaned the way a recording would be: a band-pass
(80 Hz – 12 kHz) per line, a gentle downward expander so breaths and tails
between words sit below the speech, and one measured, static gain to
−16 LUFS. Two things not to undo: the band-pass filters run in 64-bit
precision (`precision=f64`) — chained in ffmpeg 8's default precision they go
unstable on this material, +10 dB and rubbish in the low end, which an
earlier cut shipped as "noise behind the voice" — and there is no compressor
or single-pass `loudnorm`, both of which ride the quiet moments up. Check a
gap between scenes with `astats` before publishing; it should read as silence.

`voice.mjs` is a separate process on purpose: the ONNX runtime under
kokoro-js cannot be shut down cleanly on macOS and aborts the process on exit;
there it aborts after the files are written and nobody minds.

## How it is put together

The usual way to animate a web page into a video is to play it and capture
the screen, which drops frames the moment the machine is busy. This does the
opposite: **every animation is paused**, and the renderer sets each one's
clock by hand before each screenshot. A frame takes as long as it takes, and
the result is identical on every run.

The voice comes first. Each line is read, the result is **measured**, and the
scene is made exactly as long as its line plus the `lead` and `tail` pads in
`script.json`. The picture is cut to the voice, never the other way round.
Scenes dissolve into each other over `crossfade` seconds, which is also why the
total is shorter than the sum of the scenes.

## Changing it

**Rewording a line** — edit `say` and `caption` in `script.json` and
re-render. The scene silently gets longer or shorter to fit.

**Re-timing a scene** — the `--d` values in `storyboard.html` are delays in
seconds from the start of that scene, written against the sentence starts
recorded as that scene's `beats` in `script.json`. When the voice is re-read
(faster, or with other words) the renderer bends each scene's clock so a cue
still lands on its sentence; you only need to touch the delays when a scene
gains or loses a sentence. To see where the sentences now start:

```sh
node tools/promo-video/render.mjs --timing
```

Then, if you changed the sentence count, update that scene's `beats` to the
printed starts and re-choreograph its delays against them.

**Checking a scene** without rendering the lot:

```sh
node tools/promo-video/render.mjs --stills                        # one PNG per scene
node tools/promo-video/render.mjs --stills --only stats --at 6.8  # that scene, 6.8 s in
```

Or open the storyboard in a browser and freeze a moment by hand. Serve the
repository root (not `public/`, because the storyboard reads from both):

```sh
python3 -m http.server 8000
# then: localhost:8000/tools/promo-video/storyboard.html?scene=stats&t=6.8
```

**Other formats** — `--fps`, `--scale` and `--crossfade` override the values in
`script.json`. `scale` is the multiplier on the 1200×675 design size, so `1.6`
gives 1080p and `3.2` gives 4K. A vertical cut for Reels or Shorts is not just
a flag: the scenes are composed landscape and would need their own layout.

## What it needs

Google Chrome (driven by Playwright), `ffmpeg`, Node 22, and the two npm
packages `npm install` brings. Fonts come from Google Fonts at render time,
so the machine doing the rendering needs to be online.
