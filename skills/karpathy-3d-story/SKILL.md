---
name: karpathy-3d-story
description: Build a multi-chapter animated 3D story from source material — procedural three.js, one scene.html, deterministic and seeded, with a mandatory screenshot audit loop and optional ElevenLabs narration, ambience and sound effects. Idea from @karpathy (https://x.com/karpathy/status/2083749667410727319). Use when asked to make a 3D story, a procedural three.js film, an animated diorama of a book/legend/myth, a 三国演义 / 水浒传 / Odyssey-style retelling, or to add a chapter to a story built with this skill.
disable-model-invocation: true
argument-hint: '<source material> [--chapters N] [--no-audio]'
---

# 3D story

Produces one self-contained folder in the current project:

```
<story-name>/
  scene.html          the deliverable — open it, no build step, file:// works
  parts/              source, concatenated into scene.html by build.sh
  audio/              narration/ ambience/ sfx/          (skip with --no-audio)
  shots/              every frame actually looked at
  vendor/             local three.js, used only by shot.sh
  README.md  audit_log.md  narration.json
  build.sh  shot.sh  gen_audio.py  split_narration.py  audio_sweep.js
```

`example/journey-to-the-west/` is the reference implementation, bundled with this
skill. **Read its `parts/` before inventing anything** — the actor rig, the FX
library and the director transfer directly, and re-deriving them wastes a day.

Its `audio/`, `shots/` and `vendor/` are not bundled (9 MB of generated MP3s and
audit PNGs). Everything you need to read is there; `bash build.sh` regenerates
`scene.html` from `parts/`, and `reference/audio.md` regenerates the soundtrack.

## Phase 0 — scope it

Ask before building. These change the artifact and must not be guessed:

1. **Source material, and which episodes.** Get specific beats, not a whole book.
2. **Chapter count and runtime.** Default 5 chapters × ~44s ≈ 3½ minutes.
3. **Caption language(s).** Default: source language, with an English subtitle line.
4. **Audio or silent** — and if audio, **which narration voice**. On a free plan
   this is a real fork, not a detail: a *premade* voice keeps the whole build
   automatic but reads non-English with an accent, while a native *library* voice
   needs one manual round trip through the web app. Decide it here. See
   `reference/audio.md`.

## Phase 1 — scaffold

Copy all five scripts from this skill's own `templates/` directory — its absolute
path is given to you as the base directory when the skill is invoked — into the new
story folder, then vendor three.js — headless Chrome has no network, and `shot.sh`
rewrites the CDN tag to this local copy:

```bash
mkdir -p parts shots vendor audio
curl -sL -o vendor/three.min.js https://unpkg.com/three@0.160.0/build/three.min.js
```

## Phase 2 — shared toolkit, before any chapter

Build these `parts/` files in order. Filenames sort into concatenation order, and
anything referenced at module scope must sort **earlier** than its user.

| file | contents |
|---|---|
| `00_head.html` | page shell, overlays, CSS, `<script>` open |
| `10_core.js` | URL params, seeded RNG, palette, renderer, sky shader, light rig, rock/spire/tree builders |
| `30_actors.js` | one biped rig; each character is a costume on top of it |
| `40_fx.js` | water, waterfall, point fields, clouds, god-rays, halos, bursts, architecture |
| `69_cues.js` | GENERATED audio cue table |
| `70_audio.js` | narration / ambience / sfx, driven off the story clock |
| `80_director.js` | clock, chapter switching, camera splines, captions |
| `85_ui.js` | start gate, play/pause, scrub bar, mute, volume |
| `90_animate.js` | the loop |
| `99_tail.html` | close |

See `reference/architecture.md` for the exact contracts.

## Phase 3 — chapters

One `parts/5N_chN.js` per chapter calling `registerChapter(n, {...})`. Build **one**
chapter, screenshot two of its beats, fix what you see, then start the next. Never
write five chapters before looking at any of them.

## Phase 4 — audit loop (mandatory, at least 3 rounds)

```bash
bash shot.sh <chapter> <t> shots/r<round>-ch<N>-t<NN>.png 960 600
```

Each round: shoot **every camera keyframe of every chapter**, open each PNG and
**look at it**, write what you saw into `audit_log.md`, fix, repeat. Ship nothing
you have not seen rendered.

Hunt specifically for:

- geometry that exists in code but is invisible, buried, or occluded
- anything anchored to the "top" of something, floating above it
- occluders between camera and subject at a specific keyframe
- actors sunk into or hovering over terrain
- particles that fill the screen at close camera range
- blown-out additive material, and hard rectangular edges on additive planes
- coplanar surfaces z-fighting

**After any global change, re-shoot beats you already approved.** Fixes regress
earlier framings; that is the most common way this build goes wrong.

Full checklist: `reference/pitfalls.md`.

## Phase 5 — audio

`reference/audio.md`. Order: pick the voice → write `narration.json` sized to the
beat windows → generate → **measure every clip against its window with ffprobe**
→ trim and regenerate anything over ~88% → `gen_audio.py cues` → sweep-test the
cue engine across the whole timeline → `build.sh`.

**Premade voices work on the free plan and speak every language the multilingual
model does.** Only *library* voices are refused (402). That makes the whole
soundtrack a shell command with no browser and no human in it — take that route
unless the accent matters more than the automation, and say which you took.

Never ship the character-count estimate as if it were a duration. In the last
two builds the real pace came in at 4.4 and ~5.5 chars/s for the same language
on different voices; the estimate was 25% out and every line looked fine until
it was measured.

## Phase 6 — document

`README.md`: chapters, controls, file layout, regeneration commands, known jank.
`audit_log.md`: every defect found by looking, and an honest "still imperfect"
section. Do not claim a clean render you have not verified — and say plainly which
things you could not check (you cannot hear audio).

## Invariants

1. **Ground height is a stated function.** One `groundY(x,z)` / `islandY` / `stairY`
   per chapter, and every placer calls it. Nothing hovers, nothing sinks.
2. **One chapter visible at a time, all built at the origin.** Camera paths in local
   coordinates. A chapter change is a state swap behind a fade veil.
3. **Every frame is a pure function of story time.** Seeded RNG, no wall-clock
   timers, no fire-and-forget spawns — effect ages derive from `t`. This is what
   makes `?chapter=N&t=X&freeze=1` reproducible, and therefore what makes the audit
   loop mean anything: a difference between two screenshots is a change you made,
   not a reroll.

## Environment traps

- **`timeout` does not exist on macOS.** Commands wrapped in it fail with 127 and
  produce no output, which reads exactly like a hung page.
- **A static in-flow `<canvas>` is never composited into a headless screenshot.**
  Use `position: fixed` with explicit z-index on the overlays. `shot.sh` also
  injects a `toDataURL()` readback shim — that shim stays in `shot.sh`, never in
  `scene.html`.
- **Freeze mode must render synchronously** with `preserveDrawingBuffer`. Through
  rAF the pixels never reach the capture; without the flag the PNG is black.
- **`t=0` always screenshots black** — that is the fade-in veil at full opacity.
  Audit at t ≥ 1.5.
- **Kill stray `Google Chrome` processes between batches** (`pkill -9 -f "Google
  Chrome"`); they pile up and stall every subsequent run.

## Companion files

- `reference/architecture.md` — chapter, director, actor and FX contracts
- `reference/pitfalls.md` — the 25 audited defects, as a pre-flight checklist
- `reference/audio.md` — ElevenLabs pipeline, choosing a voice on a free plan,
  measuring clips against their beat windows, the cue sweep, the splitter
