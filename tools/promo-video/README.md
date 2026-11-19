# The promo video

A narrated ~53-second film of what Coding Lab is: machines, projects, accounts,
the team and the structure. It is **rendered from this folder**, not edited in
a video app, so changing a word of the script and running one command gives you
a new cut.

```sh
node tools/promo-video/render.mjs --out /tmp/coding-lab-promo.mp4
```

Out comes a 1920×1080 H.264 file at 30 fps with an AAC voice track, and a
`.srt` of the same name beside it.

## What is in here

| File | What it is |
|---|---|
| `script.json` | The narration and the scene order. **Start here.** |
| `storyboard.html` | The eight scenes, as real HTML and CSS |
| `storyboard.css` | Scene layout and the motion vocabulary |
| `render.mjs` | Speaks the script, drives the browser, encodes the file |

Nothing in the video is a screenshot. Every frame is live HTML drawn with the
landing page's own stylesheet (`public/assets/styles.css`) and its own icon
sprite, lifted out of `public/index.html` at render time. Restyle the site and
the video follows.

## How it is put together

The usual way to animate a web page into a video is to play it and capture the
screen, which drops frames the moment the machine is busy. This does the
opposite: **every animation is paused**, and the renderer sets each one's clock
by hand before each screenshot. A frame takes as long as it takes, and the
result is identical on every run and on every machine.

The voice comes first. `say` reads each line, the result is **measured**, and
the scene is made exactly as long as its line plus the `lead` and `tail` pads
in `script.json`. The picture is cut to the voice, never the other way round.
Scenes dissolve into each other over `crossfade` seconds, which is also why the
total is shorter than the sum of the scenes.

## Changing it

**Rewording a line** — edit `say` and `caption` in `script.json` and re-render.
The scene silently gets longer or shorter to fit.

**Re-timing a scene** — the `--d` values in `storyboard.html` are delays in
seconds from the start of that scene, written against the narration as it is
now. `render.mjs` prints each scene's measured length when it runs; if you make
a line much longer, nudge the delays that came after the words you changed.

**Checking one scene** without rendering the lot:

```sh
node tools/promo-video/render.mjs --stills            # one PNG per scene
node tools/promo-video/render.mjs --only hub --stills # just that one
```

Or open the storyboard in a browser and freeze a moment by hand. Serve the
repository root (not `public/`, because the storyboard reads from both):

```sh
python3 -m http.server 8000
# then: localhost:8000/tools/promo-video/storyboard.html?scene=hub&t=4.2
```

**Other formats** — `--fps`, `--scale` and `--crossfade` override the values in
`script.json`. `scale` is the multiplier on the 1200×675 design size, so `1.6`
gives 1080p and `3.2` gives 4K. A vertical cut for Reels or Shorts is not just
a flag: the scenes are composed landscape and would need their own layout.

## What it needs

Google Chrome, driven by Playwright (`npm install` in the repo root installs
it), `ffmpeg`, and macOS `say`. The narration is **synthesised**, not recorded
by a person — good enough to cut to and to publish internally, short of what
you would put in front of customers. To swap in a recorded voice, drop one WAV
per scene into `.work/vo/<scene-id>.aiff` after a run and re-run the audio and
mux steps, or hand the `.srt` to whoever records it.

Fonts come from Google Fonts at render time, so the machine doing the rendering
needs to be online.
