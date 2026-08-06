
// ============================================================================
//  Transport: start gate, play/pause, scrub bar, mute, volume
//
//  The gate exists because browsers refuse to start audio without a user
//  gesture. It doubles as the title card.
// ============================================================================

const ui = (function () {
  const gate = document.getElementById('gate');
  const bar = document.getElementById('bar');
  const btnPlay = document.getElementById('btn-play');
  const btnMute = document.getElementById('btn-mute');
  const vol = document.getElementById('vol');
  const track = document.getElementById('track');
  const fill = track.querySelector('.fill');
  const knob = track.querySelector('.knob');
  const hover = track.querySelector('.hover');
  const clockEl = document.getElementById('clock');

  // Screenshots must not have the chrome in them.
  if (P_FREEZE) {
    for (const el of [gate, bar]) el.style.display = 'none';
    return { update() {}, started: true };
  }

  function mmss(s) {
    s = Math.max(0, Math.round(s));
    return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
  }

  // chapter boundaries as ticks on the rail
  for (const c of chapters) {
    if (c.start === 0) continue;
    const tick = document.createElement('div');
    tick.className = 'tick';
    tick.style.left = (c.start / TOTAL * 100) + '%';
    track.appendChild(tick);
  }

  let started = false;
  function start(withSound) {
    if (started) return;
    started = true;
    if (withSound) audio.enable();
    audio.setMuted(!withSound);
    audio.setVolume(vol.value / 100);
    btnMute.textContent = withSound ? '静音' : '开声';
    director.seekTo(0);
    gate.style.opacity = '0';
    setTimeout(() => { gate.style.display = 'none'; }, 850);
    showBar();
  }
  document.getElementById('gate-go').addEventListener('click', () => start(true));
  document.getElementById('gate-mute').addEventListener('click', () => start(false));

  // the bar hides itself when the pointer is still, so the film is unobstructed
  let hideAt = 0;
  function showBar() { bar.classList.add('show'); hideAt = performance.now() + 2600; }
  window.addEventListener('mousemove', showBar);
  window.addEventListener('touchstart', showBar);

  function setPaused(p) {
    director.paused = p;
    btnPlay.textContent = p ? '播放' : '暂停';
    if (p) audio.pause(); else audio.resume();
  }
  btnPlay.addEventListener('click', () => { setPaused(!director.paused); showBar(); });

  btnMute.addEventListener('click', () => {
    // First press of 开声 on a muted start still needs to unlock playback.
    if (!audio.enabled) audio.enable();
    const m = !audio.muted;
    audio.setMuted(m);
    btnMute.textContent = m ? '开声' : '静音';
    showBar();
  });

  vol.addEventListener('input', () => {
    audio.setVolume(vol.value / 100);
    if (audio.muted && vol.value > 0) { audio.setMuted(false); btnMute.textContent = '静音'; }
    showBar();
  });

  // ---- scrubbing ----------------------------------------------------------
  function timeAt(ev) {
    const r = track.getBoundingClientRect();
    return clamp((ev.clientX - r.left) / r.width, 0, 1) * TOTAL;
  }
  let dragging = false;
  function seek(ev) { director.seekTo(timeAt(ev)); }
  track.addEventListener('mousedown', (ev) => { dragging = true; seek(ev); ev.preventDefault(); });
  window.addEventListener('mousemove', (ev) => {
    if (dragging) seek(ev);
    if (ev.target === track || track.contains(ev.target)) {
      const r = track.getBoundingClientRect();
      const t = timeAt(ev);
      let name = '';
      for (const c of chapters) if (t >= c.start) name = c.impl.title.cn;
      hover.style.display = 'block';
      hover.style.left = (ev.clientX - r.left) + 'px';
      hover.textContent = mmss(t) + ' · ' + name;
    } else {
      hover.style.display = 'none';
    }
  });
  window.addEventListener('mouseup', () => { dragging = false; });

  return {
    get started() { return started; },
    setPaused,
    update() {
      const t = TOTAL > 0 ? ((director.time % TOTAL) + TOTAL) % TOTAL : 0;
      const pct = (t / TOTAL * 100);
      fill.style.width = pct + '%';
      knob.style.left = pct + '%';
      clockEl.textContent = mmss(t) + ' / ' + mmss(TOTAL);
      if (bar.classList.contains('show') && performance.now() > hideAt && !dragging) {
        bar.classList.remove('show');
      }
    },
  };
})();
