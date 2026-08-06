#!/usr/bin/env node
/* Sweep-test the cue engine without a browser and without ears.
 *
 *   node audio_sweep.js
 *
 * You cannot listen to the soundtrack from here, so this proves the only part
 * that IS provable: that every cue fires, once, in order, in the right chapter,
 * and that scrubbing does not replay anything. It runs 70_audio.js verbatim in
 * a VM with <audio> stubbed out, then steps the story clock across the whole
 * film at 30 Hz exactly the way the director does.
 *
 * If audio/narration/ is still empty the narration cue list is taken from
 * narration.json instead, so the timing logic is exercised before the clips
 * exist rather than after.
 */
'use strict';
const fs = require('fs');
const vm = require('vm');
const path = require('path');

const DIR = __dirname;
const DUR = 44;                      // every chapter is 44s
const CHAPTERS = [1, 2, 3, 4, 5];

// ---- build the context -----------------------------------------------------
const plays = [];
let clock = 0;

let liveCh = 0, liveT = 0;
class FakeAudio {
  constructor(src) { this.src = src; this.paused = true; this.volume = 0; this.currentTime = 0; this.loop = false; }
  play() {
    this.paused = false;
    plays.push({ src: this.src, at: clock, ch: liveCh, t: liveT, loop: this.loop });
    return { catch() {} };
  }
  pause() { this.paused = true; }
}

const sandbox = {
  Audio: FakeAudio,
  performance: { now: () => clock * 1000 },
  console,
};
vm.createContext(sandbox);

let cuesSrc = fs.readFileSync(path.join(DIR, 'parts/69_cues.js'), 'utf8');
const audioSrc = fs.readFileSync(path.join(DIR, 'parts/70_audio.js'), 'utf8');

// If the narration clips have not been generated yet, stand in for them from
// narration.json so the cue logic is still under test.
const spec = JSON.parse(fs.readFileSync(path.join(DIR, 'narration.json'), 'utf8'));
let synthesized = false;
if (/narration:\s*\[\s*\]/.test(cuesSrc)) {
  synthesized = true;
  const rows = spec.lines.map((l) =>
    `    { id: '${l.id}', ch: ${l.ch}, t: ${l.t}, dur: 3, src: 'audio/narration/${l.id}.mp3' },`).join('\n');
  cuesSrc = cuesSrc.replace(/narration:\s*\[\s*\]/, `narration: [\n${rows}\n  ]`);
}

// Both CUES and audio are top-level `const`s, i.e. lexical bindings in the
// script's own scope rather than properties of the sandbox global — they have
// to be handed out explicitly.
vm.runInContext(cuesSrc + '\n' + audioSrc +
  '\nglobalThis.__audio = audio; globalThis.__cues = CUES;', sandbox);
const audio = sandbox.__audio;
const CUES = sandbox.__cues;

// ---- run the film ----------------------------------------------------------
const dt = 1 / 30;
audio.enable();
plays.length = 0;                    // enable() kicks the beds off; not under test

for (const ch of CHAPTERS) {
  for (let t = 0; t < DUR; t += dt) {
    clock += dt;
    liveCh = ch; liveT = t;
    audio.sync(ch, t, dt);
  }
}
const forward = plays.slice();

// ---- scrub: back, then forward again ---------------------------------------
plays.length = 0;
liveCh = 3;
liveT = 40; audio.sync(3, 40, dt);  clock += dt;
liveT = 5;  audio.sync(3, 5,  dt);  clock += dt;      // jump backwards
for (let t = 5; t < 20; t += dt) { clock += dt; liveT = t; audio.sync(3, t, dt); }
const afterScrub = plays.slice();

// ---- assertions ------------------------------------------------------------
let bad = 0;
const fail = (m) => { console.log('  FAIL  ' + m); bad++; };
const ok   = (m) => console.log('  ok    ' + m);

const nar = forward.filter((p) => p.src.includes('/narration/'));
const sfx = forward.filter((p) => p.src.includes('/sfx/'));

// 1. every narration cue fires exactly once
const counts = {};
for (const p of nar) counts[p.src] = (counts[p.src] || 0) + 1;
const missing = CUES.narration.filter((c) => !counts[c.src]);
const dupes = Object.entries(counts).filter(([, n]) => n > 1);
if (CUES.narration.length === 0) fail('no narration cues at all');
else if (missing.length) fail(`narration never fired: ${missing.map((c) => c.id).join(', ')}`);
else if (dupes.length) fail(`narration fired more than once: ${dupes.map(([s, n]) => `${s}x${n}`).join(', ')}`);
else ok(`all ${CUES.narration.length} narration cues fired exactly once`);

// 2. in ascending story order
let order = true;
for (let i = 1; i < nar.length; i++) if (nar[i].at < nar[i - 1].at) order = false;
order ? ok('narration fired in ascending story order') : fail('narration fired out of order');

// 3. each fired in its own chapter, within a frame of its own cue time
const idx = {};
[...CUES.narration, ...CUES.sfx].forEach((c) => { idx[c.src] = c; });
const misplaced = [...nar, ...sfx].filter((p) => {
  const c = idx[p.src];
  return !c || c.ch !== p.ch || Math.abs(c.t - p.t) > 0.1;
});
misplaced.length === 0
  ? ok('every cue fired in its own chapter, on its own beat')
  : fail(`${misplaced.length} cue(s) fired in the wrong chapter or off-beat`);

// 4. every sfx fires
const sfxCounts = {};
for (const p of sfx) sfxCounts[p.src] = (sfxCounts[p.src] || 0) + 1;
const sfxMissing = CUES.sfx.filter((c) => !sfxCounts[c.src]);
sfxMissing.length ? fail(`sfx never fired: ${sfxMissing.map((c) => c.name).join(', ')}`)
                  : ok(`all ${CUES.sfx.length} sfx cues fired`);

// 5. scrubbing backwards then forwards replays nothing already behind the head
const replayed = afterScrub.filter((p) => {
  const c = CUES.narration.find((x) => x.src === p.src) || CUES.sfx.find((x) => x.src === p.src);
  return c && c.ch === 3 && c.t < 5;
});
replayed.length ? fail(`scrub replayed ${replayed.length} cue(s) from behind the playhead`)
                : ok('scrubbing back then forward replayed nothing already spent');

// 6. no runaway retries: a bed should not get thousands of play() calls
const bedCalls = forward.filter((p) => p.loop).length;
bedCalls <= 60 ? ok(`ambience retry calls bounded (${bedCalls} over the whole film)`)
               : fail(`ambience retried ${bedCalls} times — throttle is not working`);

console.log('');
if (synthesized) {
  console.log('NOTE: audio/narration/ is empty, so narration cues were taken from');
  console.log('      narration.json. Re-run after split_narration.py to test the real table.');
}
console.log(bad ? `${bad} check(s) FAILED` : 'all checks passed');
process.exit(bad ? 1 : 0);
