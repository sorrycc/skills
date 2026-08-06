# Audit log — 西游记 scene.html

Every entry below is a defect I found by rendering a frame and **looking at it**,
not by reading the code. Frames are captured with `shot.sh <chapter> <t> <out>`,
which freezes the story clock so the same URL always produces the same pixels.

The point of the exercise: in the bench run this project is modelled on, the
model wrote a round green door, never looked at its own render, and shipped a
scene where the door was buried inside the hill. Half the defects below are
exactly that shape — geometry that exists, is correct in code, and is invisible
or in the wrong place on screen.

---

## Round 0 — the capture pipeline itself

Before any of the scene could be audited, the screenshots had to be real.

| # | What the screenshot showed | Cause | Fix |
|---|---|---|---|
| 0.1 | Flat `#05070f` page background, 98% of pixels, overlays drawn but no 3D at all | The canvas sat in normal flow. A **static, non-positioned canvas is not composited into a headless screenshot** in this Chrome build. `renderer.info` reported 743 draw calls and 125k triangles, and `toDataURL()` returned a correct image — the pixels existed, they just never reached the capture. | `canvas { position: fixed; left:0; top:0; z-index:0 }` plus explicit z-index on the overlays (the canvas is appended after them in DOM order). Even then this build refuses to composite it, so `shot.sh` injects a shim that reads the canvas back with `toDataURL()` and hands the screenshotter an `<img>` of exactly those pixels. The shim lives in `shot.sh`, never in `scene.html`. |
| 0.2 | Black PNG when rendering a single frame and stopping | Without `preserveDrawingBuffer` the buffer is discarded before the tool captures. | `preserveDrawingBuffer: P_FREEZE` — on only for frozen captures, so playback pays nothing. |
| 0.3 | Timeouts: a single 1280×800 shot ran past 3 minutes | Driving the frozen frame through `requestAnimationFrame` let Chrome burn the whole virtual-time budget re-rendering ~500 identical frames under swiftshader. | Freeze mode renders **synchronously** at parse time: two passes (one to compile shaders, one to photograph), then stops. ~5s per shot. |
| 0.4 | Two screenshots of "the same" scene differed everywhere | `Math.random()` for all procedural placement. | Seeded `mulberry32`; `reseed()` per chapter. A fix is now distinguishable from a reroll. |

A note that cost me several rounds: **`?chapter=N&t=0` always screenshots pure
black.** That is not a bug — the chapter fade-in veil is at full opacity at
local time 0. Audit at t≥1.5.

---

## Round 1 — first look at each chapter

### 第一回 石猴出世

| # | What I saw | Fix |
|---|---|---|
| 1.1 | The whole chapter read as night; it is supposed to be dawn. | Sun 1.85→2.5, hemi 0.62→1.0, stars 0.25→0.07, exposure 1.12→1.20, lighter sky ramp. |
| 1.2 | **The 水帘洞 cave was nowhere on screen.** It was placed at z=62.4, just inside terrace 1's rim — but that terrace flares outward as it descends, so the rock closed over the cave a few units below the lip. Written, correct, invisible: the same defect the bench run shipped. | Built an explicit rock buttress that juts clear of the terraces, with a flat front face at z=70, and cut the cave into *that*. |
| 1.3 | Waterfall mist rendered as white blobs the size of boulders. | Point sizes 6–16 → 2.5–6.5, fade 0.42→0.34. |
| 1.4 | Sea mist was sitting *on the island* like ice floes. | `makeCloudSea` gained `minR`; mist now starts 150 units out. |
| 1.5 | Wukong was ~6 px tall in his own hero shot; the monkey tribe were specks. | Wukong 3.4→4.6, monkeys 0.85–1.35→1.9–2.9, cameras pulled in to ~20 units. |
| 1.6 | The "two beams of golden light" were two searchlight cones filling half the frame — and they pointed into the mountain, because the beams were parented to the chapter while Wukong rotates during the beat. | Cone geometry translated so it starts at the eye instead of being centred on it, radius 2.6→0.55, and **parented to his head** so the light follows his gaze. |
| 1.7 | Summit spires stood directly in front of the hero. | Spires confined to the arc away from the +Z camera side. |

### 第二回 大闹天宫

| # | What I saw | Fix |
|---|---|---|
| 2.1 | Battle sparks were screen-filling white discs. | Point size grows as 1/z with no ceiling; added a hard clamp (`min(..., 26·pixelRatio)`) in the shared point shader, and dropped the per-field sizes. This one fix cleaned up every chapter. |
| 2.2 | The balustrade read as 56 loose crossbars scattered round the rim. | Posts + one continuous torus rail. |
| 2.3 | The peach-garden beat was a wall of tree canopy with Wukong hidden behind it. | Trees scaled 1.5–2.2→1.05–1.5, arranged in an arc open toward the lens, and he now stands still at the near edge instead of orbiting through the trees. |
| 2.4 | Every shot was a distant postcard. | Whole camera path moved in: 86→24 units at the gate, 26→16 at the fight. |
| 2.5 | After the rout the terrace was spotless — as if nothing had happened. | 16 dropped spears and helmets, revealed at the moment of impact. |

### 第三回 五行山下

| # | What I saw | Fix |
|---|---|---|
| 3.1 | **The golden seal hung in the sky, 26 units above the peak it is supposed to be stuck to.** Root cause: `makeSpire` returned a mesh centred on its own middle, so every caller that placed one "on the ground" buried half of it, and anything anchored to "the top" floated. | `makeSpire` now returns a group whose **origin is the base**. Fixed the seal, and silently fixed half-buried spires in chapters 1, 4 and 5 too. |
| 3.2 | At the break beat the camera was *inside* the exploding rubble — boulders filled the frame. | Camera moved back and up; debris travel 22→15. |
| 3.3 | At the reunion beat a roadside pine filled the entire frame. | The whole approach corridor (z<104, \|x\|<46) is now kept clear of trees. |
| 3.4 | The monk and the freed Wukong ended 17 units apart, out of frame from each other. | The road straightens onto the mountain face (`roadX` × smoothstep) so both arrive at the same spot. |
| 3.5 | The monk's arm stayed locked overhead for the rest of the chapter after reaching for the seal. | The reach is now a pulse, not a latch. |
| 3.6 | Wukong stood 1.5 units above the ground at the reunion. | He is placed through `groundY()` like everything else. |
| 3.7 | The plain was a billiard table. | 150 scattered rocks and bushes. |

### 第四回 火焰山

| # | What I saw | Fix |
|---|---|---|
| 4.1 | **The white horse's body lay across its own direction of travel** — the barrel capsule was rotated about Z instead of X, so the horse was permanently broadside. | One-line axis fix; affects chapters 3, 4 and 5. |
| 4.2 | 唐僧 appeared to be standing behind the horse's tail rather than riding. | He walks his horse instead — unambiguous, and no seat maths. |
| 4.3 | The fire wall was a blown-out white slab with a hard rectangular edge. | Additive opacity 0.9→0.42, its light 70→34, sky glow 1.35→0.95, and the sheet shader no longer brightens its own bottom edge. |
| 4.4 | The 芭蕉扇 was a barn door parked between the lens and the action, filling the left half of the frame. | Radius 9→5.4, and its path now ends in Wukong's raised hand instead of flying past the camera. |
| 4.5 | The establishing shot was blocked by two ridge spires standing right at the lens. | Reframed as a corridor straight down the road — the ridges live at \|z\|>20, so the road axis is guaranteed clear. |

### 第五回 灵山取经

| # | What I saw | Fix |
|---|---|---|
| 5.1 | **The peak swallowed the temple and the camera.** The mountain was a dome 62 units tall centred at the origin, and the terrace sits at y=34 — so the rock closed over everything on it. | Rebuilt as a truncated cone whose flank has exactly the slope of the stair (`SLOPE = TERRACE_Y / (STAIR_Z0 - STAIR_Z1)`), so the steps lie on the rock and the summit is a flat mesa. |
| 5.2 | White streaks radiating across the terrace. | The terrace top and the peak top were coplanar at y=34 — z-fighting. Peak lowered 0.8. |
| 5.3 | For the entire finale the four pilgrims stood **behind the camera**: their climb ended at z=58, outside the 50-unit terrace, while every camera looked inward. | The climb now ends at z=27, on the terrace, in front of the Buddha. |
| 5.4 | Lotus lamps were spheres the size of the pilgrims' heads. | Radius 0.95→0.5. |
| 5.5 | The 佛光 was a hard white laser blade. | Rays widened 16→30, opacity 0.20→0.085. |

---

## Round 2 — sweep of all five chapters at fresh timestamps

Shots: ch1 t=5/17/32/34/39, ch2 t=9/17/31/44, ch3 t=12/20/24/33/37,
ch4 t=2/6/18/31, ch5 t=20/33/42.

Everything in the "Round 1" tables above that is marked as a camera or framing
fix was found here rather than in the first pass — auditing one beat per chapter
is not enough, because each camera keyframe is effectively its own composition
with its own occluders.

Additional round-2 findings, all fixed:

- ch1 the sea rendered near-black at dawn (roughness 0.14 + metalness 0.55 made
  it a mirror for a dark sky) → 0.34 / 0.42 and a lighter blue.
- ch3 the establishing beat cropped the top off the mountain → camera pulled back.
- ch4 hard bright bottom edge on the fire sheet → shader fade reversed.

---

## Round 4 — the soundtrack

I can measure audio but I cannot hear it, so this round splits cleanly into
things I verified and things I did not.

**Verified by measurement**

| # | What I found | Fix |
|---|---|---|
| A.1 | Five ambience beds came back at *identical* byte counts, which looks exactly like the API ignoring the prompt and returning one file five times. | Not a defect — checksums differ; identical size is just 22.0s of constant-bitrate audio. Checked rather than assumed. |
| A.2 | The page stalled before the first frame and headless Chrome produced nothing at all. | ~40 `<audio>` elements with `preload="auto"` constructed at load. Elements are now created lazily inside `audio.enable()`, on the first gesture. |
| A.3 | A full sweep of the story clock showed the ambience `play()` being called **6,650 times** — once per bed per frame. | A bed that has not started yet was retried every frame. Throttled to twice a second; the sweep now shows 10 calls. |
| A.4 | Every one of my headless probes silently produced no output for several rounds. | `timeout` does not exist on macOS. The commands were failing with 127 and I was reading the empty output as "the page is broken". |
| A.5 | Narration written at an assumed 4 chars/sec. | Measured: the voice runs ~5.5 chars/sec. All 28 clips fit their beat windows with 1.3–4.7s of slack, so no line needed trimming. |

**Sweep test.** Stepping the story clock across all 218 seconds at 1/30s and
recording every `play()` call: 28 narration cues fire, 28 unique, no
duplicates, in ascending time order, first at 0.5s and last at 214.0s; 7 sfx
fire; scrubbing backwards into chapter 2 and forwards to chapter 5 replays no
narration. That is the audio equivalent of the screenshot audit — it proves the
cue logic, not the sound.

**Not verified.** I have not heard any of it. Pronunciation, prosody, whether
the 说书 register lands, whether the ambience beds loop without an audible
seam, and whether the sfx sit at the right level against the narration are all
unchecked. The level balance (narration 1.0, ambience 0.30, sfx 0.55) is a
guess made without listening.

## What is still imperfect

Stated plainly, because the bench run's most interesting failure was a model
declaring "nothing floating or clipped" about a render that had floating
bunting in it:

1. **Scroll/pillar intersections.** In the ch5 finale a few of the 14 floating
   scrolls pass through the temple's pillars on their orbit. Visible if you look
   for it at t≈31–34.
2. **Foot contact is positional, not physical.** Actors are placed on the ground
   height at their origin; on the ch5 stair, feet can clip a step edge slightly
   during the walk cycle. Nobody hovers, but nobody is perfectly planted either.
3. **The horse's gait** is a four-phase sine, not a real gallop; at speed the
   diagonal pairs read as a trot regardless of pace.
4. **Chapter 2's soldiers** all leave the terrace on the same trajectory shape.
   At the wide pull-back you can see the pattern.
5. **Buddha's arms** in ch5 are capsules laid on the torso; from the side they
   read as nubs rather than hands in mudra.
6. I audited **21 frames**. The film is ~218 seconds long. Between the frames I
   looked at, there is plenty I have not seen — in particular the transitions
   through the fade veil, and anything that only misbehaves mid-interpolation
   between two camera keys.
