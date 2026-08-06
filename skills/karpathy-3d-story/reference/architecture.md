# Architecture contracts

Extracted from `example/journey-to-the-west/`, bundled with this skill. Copy the
shapes; the implementations there are working code you can lift wholesale.

## Concatenation order

`build.sh` cats `parts/*` in filename order into `scene.html`. There is no module
system, so everything shares one global scope and **anything used at module scope
must sort earlier than its user**. The generated cue table is `69_cues.js`
specifically so it lands before `70_audio.js`, which reads `CUES` the moment it is
defined.

## URL parameters (in `10_core.js`, parsed first)

```js
?chapter=N   jump to chapter N (1-based)
&t=SECONDS   local story time inside that chapter
&freeze=1    render one frame synchronously and stop — deterministic screenshots
&seed=NNN    reseed procedural placement
```

`P_FREEZE` must also be readable *before* the renderer is constructed, because it
selects `preserveDrawingBuffer`.

## Chapter contract

```js
registerChapter(n, {
  title:    { num: '第 一 回', cn: '石猴出世', en: 'Birth of the Stone Monkey' },
  duration: 44,                       // seconds
  sky: {
    top, mid, bot, sun,               // hex colours for the sky dome shader
    sunDir: [x, y, z], sunColor, sunI,
    hemiSky, hemiGround, hemiI,
    fillColor, fillI,
    glow, stars,
    fog: { color, near, far },
    exposure, sunTargetY, shadowRadius,
  },
  captions: [{ t, cn, en }, ...],     // t is local seconds
  cam:      [{ t, p: [x,y,z], l: [x,y,z], fov? }, ...],   // >= 4 keyframes
  build() { /* returns a THREE.Group; called once at load */ },
  update(t, dt) { /* t is LOCAL story seconds */ },
});
```

`build()` should `reseed(<constant>)` first, stash everything the update loop needs
on `this._`, and return the group. The director parks it at the origin, hidden.

## Director

Owns the clock so pause and scrub are one line each:

```js
director.time            // absolute story seconds
director.paused
director.advance(dt)     // no-op while paused
director.seekTo(t)       // wraps into [0, TOTAL)
director.update(dt)      // picks chapter, drives camera/captions/audio
```

Do **not** derive story time from `THREE.Clock.elapsedTime`: a pause silently
swallows the paused duration on resume, because `getDelta()` adds it back.

Camera keys are interpolated with Catmull-Rom, not per-segment easing — easing each
segment brings the camera to a dead stop at every keyframe.

## Actor rig

One skeleton, costumes on top. Origin is **the sole of the feet at y=0**, so
chapters place actors by setting `y = groundY(x, z)` directly.

```js
actor.userData.rig = {
  root, body, head, skull,
  armL, armR, legL, legR,     // each { root, lower, end, hand?, foot? }
  hipY, mode, phase,
  lockArmL, lockArmR,         // set true when a prop dictates the pose
};

walk(actor, t, speed, amp);   // mode 'robe' sways instead of stepping
idle(actor, t, amp);
faceTo(actor, x, z);
horseWalk(horse, t, speed, amp);
```

A limb is a group pivoting at the joint with a child group at the elbow/knee — a
two-bone bend is two rotations and no skinning.

Props attach to `rig.armR.lower` so they follow the hand. Anything that must follow
a character's gaze (light beams, held effects) parents to `rig.head`, not to the
chapter group.

## FX factories

Every factory returns an object with a `.group` (or `.mesh` / `.points`) and an
`.update(t, dt)`. Chapters own placement; the factory owns behaviour.

```js
makeWater(size, segs, color, amp, opts)      // wave displacement via onBeforeCompile,
                                             // so it keeps sun, shadows and fog
makeWaterfall(w, h, {color, opacity, speed, blending, scale})
                                             // negative speed + additive = fire
makePointField(count, {style, area, origin, rise, drift, sizeMin, sizeMax,
                       colorA, colorB, spin})   // style: glow|ember|petal|snow
makeCloudSea(count, radius, y, {scale, color, emissive, minR, opacity})
makeCloudPuff(scale, color, emissive, opacity)
makeGodRays(radius, height, color, opacity, blades)
makeHalo(color, count, maxR, opacity)        // .update(t, speed, gain)
makeBurst(count, color, spread, life)        // .setAge(t) — never a timer
makeRoof(w, d, h, opts) / makeHall(w, d, opts) / makeStairs(...) / makeBanner(...)
makeRockMass(...) / makeSpire(...) / makeTreeSimple(...)
```

Two rules learned the hard way:

- **Point size must be clamped.** `gl_PointSize` grows as 1/z; without a ceiling any
  particle that drifts near the lens swallows the frame.
- **`makeSpire` returns a group whose origin is its base.** A bare cylinder mesh is
  centred on its middle, so every caller placing one "on the ground" buries half of
  it and anything anchored to its top floats.

## Audio contract

```js
audio.enable()                    // first user gesture; creates elements lazily
audio.setMuted(b) / setVolume(v)
audio.pause() / resume()
audio.sync(chapterId, localT, dt) // called from director.update
```

`sync` treats a chapter change, a loop, and a scrub identically: clear the fired
set, stop what is speaking, and mark everything already behind the playhead as
spent rather than replaying it in a burst.

## UI

`85_ui.js` builds the start gate (browsers refuse audio without a gesture; the gate
doubles as the title card) and the transport bar. It must return early and hide
both when `P_FREEZE` — otherwise the chrome lands in every screenshot.
