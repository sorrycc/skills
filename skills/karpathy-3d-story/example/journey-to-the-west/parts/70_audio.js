
// ============================================================================
//  Audio
//
//  Three layers, all driven from the same story clock the visuals use:
//    narration  one clip per caption beat, fired as the clock crosses its t
//    ambience   one looping bed per chapter, crossfaded at chapter changes
//    sfx        one-shots on the big beats
//
//  Plain <audio> elements, not Web Audio: decodeAudioData needs fetch(), and
//  fetch() on file:// is a CORS error — the whole soundtrack would silently
//  fail for anyone who just double-clicks scene.html.
// ============================================================================

const audio = (function () {
  const GAIN = { narration: 1.0, ambience: 0.30, sfx: 0.55 };
  const FADE = 0.9;              // seconds to crossfade an ambience bed

  let enabled = false;           // set true by the first user gesture
  let muted = false;
  let master = 0.8;
  let lastCh = -1, lastT = -1;
  const fired = new Set();

  function make(src, loop) {
    const a = new Audio(src);
    a.preload = 'auto';
    a.loop = !!loop;
    a.volume = 0;
    return a;
  }

  // Elements are created lazily in enable(), not at load. Constructing ~40
  // preloading <audio> elements up front stalls the page before the first
  // frame — and it makes someone who only wants to watch silently pay for a
  // soundtrack they never asked for.
  const narration = CUES.narration.map((c) => ({ ...c, el: null }));
  const beds = CUES.ambience.map((c) => ({ ...c, el: null, vol: 0, want: 0, retryAt: 0 }));
  // sfx get two elements each so a repeated cue (the three fan waves) can
  // overlap itself instead of cutting its own tail off
  const sfx = CUES.sfx.map((c) => ({ ...c, els: null, n: 0 }));

  let speaking = null;

  function play(el, gain) {
    if (!enabled) return;
    try {
      el.currentTime = 0;
      el.volume = Math.max(0, Math.min(1, master * gain * (muted ? 0 : 1)));
      const p = el.play();
      if (p && p.catch) p.catch(() => {});     // autoplay refusals are not fatal
    } catch (e) { /* ignore */ }
  }

  function stopSpeech() {
    if (speaking) { try { speaking.pause(); } catch (e) {} speaking = null; }
  }

  function applyVolumes() {
    const m = muted ? 0 : master;
    for (const b of beds) if (b.el) b.el.volume = Math.max(0, Math.min(1, b.vol * GAIN.ambience * m));
    if (speaking) speaking.volume = Math.max(0, Math.min(1, GAIN.narration * m));
    for (const s of sfx) if (s.els) for (const el of s.els) {
      if (!el.paused) el.volume = Math.max(0, Math.min(1, GAIN.sfx * m));
    }
  }

  return {
    get enabled() { return enabled; },
    get muted() { return muted; },

    // Called from the click on the start gate. Kicking every bed off here (and
    // muting it immediately) is what buys permission to start it later without
    // another gesture.
    enable() {
      if (enabled) return;
      enabled = true;
      for (const c of narration) if (!c.el) c.el = make(c.src, false);
      for (const s2 of sfx) if (!s2.els) s2.els = [make(s2.src, false), make(s2.src, false)];
      for (const b of beds) {
        if (!b.el) b.el = make(b.src, true);
        b.el.volume = 0;
        const p = b.el.play();
        if (p && p.catch) p.catch(() => {});
      }
      lastCh = -1; lastT = -1; fired.clear();
    },

    setMuted(v) { muted = !!v; applyVolumes(); },
    setVolume(v) { master = Math.max(0, Math.min(1, v)); applyVolumes(); },

    pause() {
      for (const b of beds) if (b.el) { try { b.el.pause(); } catch (e) {} }
      if (speaking) { try { speaking.pause(); } catch (e) {} }
    },
    resume() {
      if (!enabled) return;
      for (const b of beds) if (b.el && b.want > 0.001) { const p = b.el.play(); if (p && p.catch) p.catch(() => {}); }
      if (speaking) { const p = speaking.play(); if (p && p.catch) p.catch(() => {}); }
    },

    // ch is 1-based, localT is seconds inside that chapter.
    sync(ch, localT, dt) {
      if (!enabled) return;
      const now = (typeof performance !== 'undefined' ? performance.now() : 0) / 1000;

      // A chapter change, a loop back to the start, or a scrub all mean the
      // same thing: forget what has been fired, and treat everything already
      // behind the playhead as spent rather than replaying it in a burst.
      const jumped = ch !== lastCh || localT < lastT - 0.12 || localT > lastT + 1.0;
      if (jumped) {
        fired.clear();
        stopSpeech();
        for (const s of sfx) if (s.els) for (const el of s.els) { try { el.pause(); } catch (e) {} }
        for (const c of narration) if (c.ch === ch && c.t <= localT) fired.add('n' + c.id);
        for (let i = 0; i < sfx.length; i++) if (sfx[i].ch === ch && sfx[i].t <= localT) fired.add('s' + i);
      }

      for (const c of narration) {
        if (c.ch !== ch || !c.el || fired.has('n' + c.id) || localT < c.t) continue;
        fired.add('n' + c.id);
        stopSpeech();
        speaking = c.el;
        play(c.el, GAIN.narration);
      }
      for (let i = 0; i < sfx.length; i++) {
        const s = sfx[i];
        if (s.ch !== ch || !s.els || fired.has('s' + i) || localT < s.t) continue;
        fired.add('s' + i);
        play(s.els[s.n++ % s.els.length], GAIN.sfx);
      }

      for (const b of beds) b.want = (b.ch === ch) ? 1 : 0;
      const step = dt / FADE;
      for (const b of beds) {
        b.vol += Math.max(-step, Math.min(step, b.want - b.vol));
        // Retry a stalled bed at most twice a second. Without the throttle a
        // bed that refuses to start (autoplay policy, missing file) gets a
        // play() call on every single frame for the rest of the film.
        if (b.el && b.vol > 0.001 && b.el.paused && now >= b.retryAt) {
          b.retryAt = now + 0.5;
          const p = b.el.play();
          if (p && p.catch) p.catch(() => {});
        }
      }
      applyVolumes();

      lastCh = ch; lastT = localT;
    },
  };
})();
