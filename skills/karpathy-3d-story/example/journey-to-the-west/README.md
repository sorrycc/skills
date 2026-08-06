# 西游记 — a procedural three.js telling of Journey to the West

> **Bundled copy.** This is the reference implementation shipped with the
> `karpathy-3d-story` skill, and it is the *source* only: `audio/` (7.2 MB of generated
> MP3s), `shots/` (2.1 MB of audit PNGs) and `vendor/three.min.js` are not
> included, so the embedded screenshot below and any path under those three
> directories will not resolve here. Everything else is intact —
> `bash build.sh` rebuilds `scene.html` from `parts/` byte-for-byte, and the
> skill's `reference/audio.md` regenerates the soundtrack. The full version
> lives in the original project repo.

A five-chapter animated retelling of 西游记, built entirely from code: no
models, no textures, no images. One `scene.html` of ~4,100 lines, three.js from
the CDN, ~218 seconds, loops forever — with 说书 narration, per-chapter ambience
and sound effects alongside.

Open `scene.html` in a browser. That is the whole thing — no build step, no
server, `file://` is fine.

![chapter 5](shots/final-ch5.png)

## The chapters

| # | | | |
|---|---|---|---|
| 一 | 石猴出世 | Birth of the Stone Monkey | 花果山 rising out of the Eastern Sea, three waterfalls, the 水帘洞 behind the lowest curtain, the stone splitting on the summit |
| 二 | 大闹天宫 | Havoc in the Palace of Heaven | 南天门 and 凌霄殿 on a jade terrace above the cloud sea, the 蟠桃园, and fourteen celestial troops swept off the edge |
| 三 | 五行山下 | Five Hundred Years Under the Mountain | five stone fingers, the six-syllable seal burning on the highest one, five hundred years compressed into a sun-and-season time-lapse, then the monk on the road |
| 四 | 火焰山 | The Flaming Mountains | eight hundred li of burning ridge, the road through it, and the 芭蕉扇 |
| 五 | 灵山取经 | The Scriptures at Vulture Peak | the long stair out of the cloud, 大雷音寺, the Buddha-light, and the scrolls |

## Controls

Click 开始 to start with sound, or 静音观看 to watch silently — browsers refuse
to play audio without a gesture, so the gate is unavoidable; it doubles as the
title card.

| | |
|---|---|
| `Space` | pause / resume |
| `[` `]` | previous / next chapter |
| `←` `→` | back / forward 5s |
| `M` | mute |

The transport bar at the bottom appears on mouse movement and hides again after
a few seconds: play/pause, a scrub bar with chapter ticks (hover to preview the
time and chapter, click or drag to seek), elapsed/total, mute and volume.

## Sound

Three layers, all driven off the same story clock as the visuals:

| layer | what | files |
|---|---|---|
| 配音 | 说书-style narration, one clip per caption beat | `audio/narration/*.mp3` |
| ambience | one looping bed per chapter, crossfaded at chapter changes | `audio/ambience/ch*.mp3` |
| sfx | one-shots on the big beats: the stone splitting, the cudgel, the mountain breaking, the three fan waves, the light at 灵山 | `audio/sfx/*.mp3` |

Everything is generated from ElevenLabs by `gen_audio.py`; the narration script
lives in `narration.json` and each line is written to fit its beat window.

```bash
export ELEVENLABS_API_KEY=...
python3 gen_audio.py ambience            # 5 looping beds
python3 gen_audio.py sfx                 # 5 one-shots
python3 gen_audio.py narration --voice <VOICE_ID>
python3 gen_audio.py cues                # regenerates parts/69_cues.js
bash build.sh
```

`gen_audio.py cues` writes the cue table as a **JS file**, not a JSON manifest:
`fetch()` on `file://` is a CORS error, so a fetched manifest would make the
whole soundtrack vanish for anyone who just double-clicks `scene.html`.

Audio elements are constructed lazily on the first gesture rather than at load —
~40 preloading `<audio>` elements stall the page before the first frame, and
someone who chose 静音观看 should not pay for a soundtrack they declined.

**Free-plan limitation.** Library ("professional") voices — including the good
native-Mandarin ones — work in the ElevenLabs web app but are refused over the
API with `402 paid_plan_required`. The way around it without upgrading:

```bash
# 1. paste audio/PASTE-INTO-ELEVENLABS.txt into the web app, pick the voice,
#    download the single MP3
# 2. cut it back into the 28 per-beat clips:
python3 split_narration.py <downloaded.mp3>
python3 gen_audio.py cues && bash build.sh
```

`split_narration.py` auto-tunes the silence threshold until it finds exactly as
many segments as `narration.json` has lines, cuts on speech onset rather than
gap midpoints, and checks every clip against its beat window — so a bad
threshold fails loudly instead of producing 28 quietly misaligned files.

URL parameters, mostly for auditing but useful by hand:

```
scene.html?chapter=3&t=30     # jump to chapter 3, 30 seconds in
scene.html?chapter=3&t=30&freeze=1   # render exactly that frame and stop
scene.html?seed=12345         # reroll the procedural placement
```

## How it is put together

```
scene.html          the deliverable — everything, in one file
parts/              the same file, split up for editing; build.sh concatenates them
  00_head.html      page shell, caption/title/seal overlays
  10_core.js        seeded RNG, palette, renderer, sky shader, light rig
  30_actors.js      one rig, six characters: 悟空 唐僧 八戒 沙僧 白马 天兵
  40_fx.js          water, waterfall, point fields, clouds, god-rays, 斗拱 roofs, halls, stairs
  50_ch1 … 54_ch5   one file per chapter: {title, sky, captions, cam, build, update}
  69_cues.js        GENERATED audio cue table (must sort before 70_audio.js)
  70_audio.js       narration / ambience / sfx, driven off the story clock
  80_director.js    clock, chapter switching, camera splines, caption track
  85_ui.js          start gate, play/pause, scrub bar, mute, volume
  90_animate.js     the loop
build.sh            parts/* -> scene.html
shot.sh             deterministic screenshot of one story beat
gen_audio.py        generates every audio asset + the cue table
split_narration.py  cuts one long narration MP3 back into the 28 per-beat clips
narration.json      the 配音 script, one line per beat
audio/              narration/ ambience/ sfx/ samples/
vendor/three.min.js local copy of the CDN file, used only by shot.sh
audit_log.md        every defect found by looking at renders, and what it was
shots/              the frames I actually looked at
```

Three rules the whole thing is built on, each of them a reaction to a specific
way this kind of scene goes wrong:

1. **Ground height is a function, not a guess.** Every chapter defines exactly
   one of `islandY(x,z)`, `groundY(x,z)` or `stairY(z)`, and every tree, rock,
   monkey and pilgrim is placed through it. Nothing hovers, nothing sinks.
2. **Every chapter is at the origin, one visible at a time.** Camera splines are
   written in local coordinates and chapters cannot leak into each other's
   framing. A chapter change is a state swap behind a 1.1s veil.
3. **Every frame is a pure function of story time.** No `Math.random()` at
   runtime (placement uses a seeded `mulberry32`), no wall-clock timers, no
   fire-and-forget particle spawns — burst ages are driven from `t`. So
   `?chapter=N&t=X&freeze=1` always produces the same pixels, which is what
   makes the audit loop meaningful: a difference between two screenshots is a
   change I made, not a reroll.

## Auditing it

```bash
bash shot.sh 3 30 shots/ch3.png 1280 800
```

Freezes chapter 3 at t=30 and writes a PNG, then prints a dominant-colour
summary so a black or near-uniform canvas is obvious rather than something you
skim past.

Two things about this environment, both documented in `audit_log.md`:

- **Headless Chrome here will not composite the WebGL canvas into a
  screenshot.** The pixels are correct (`toDataURL` proves it); they just never
  reach the capture. `shot.sh` therefore injects a shim that reads the canvas
  back and hands the screenshotter an `<img>` of exactly those pixels. The shim
  is in `shot.sh`, never in `scene.html`.
- **`t=0` always screenshots black** — that is the chapter fade-in veil at full
  opacity, not a failure. Audit at t≥1.5.

`audit_log.md` lists all 25 defects found by looking, including the ones I would
never have found by reading the code: a cave sealed inside a hillside, a golden
seal floating 26 units above the peak it is glued to, a horse whose body lay
across its own direction of travel, and a finale where the four pilgrims spent
the entire scene standing behind the camera.

## Known jank

Listed rather than glossed, because the failure mode this project is a reaction
to was a model declaring its work clean while the render showed otherwise:

- A few of the floating scrolls in chapter 5 pass through the temple pillars.
- Feet can clip step edges on the chapter 5 stair; contact is positional, not
  physical.
- The horse gait is a four-phase sine — it trots at every speed.
- Chapter 2's routed soldiers all fly out on the same trajectory shape, visible
  at the wide pull-back.
- 21 of ~218 seconds have been looked at. What happens between those frames,
  particularly mid-interpolation between camera keys, is unverified.
