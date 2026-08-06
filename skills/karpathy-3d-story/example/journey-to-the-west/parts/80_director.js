
// ============================================================================
//  The director
//
//  Chapters are self-contained and all sit at the origin; exactly one is
//  visible at a time. The director owns the clock, the camera, the sky/light
//  state and the caption track, so a chapter change is a state swap behind a
//  1.1s veil rather than five worlds fighting over one scene graph.
// ============================================================================

const ORDER = [1, 2, 3, 4, 5].filter((id) => CHAPTER_IMPL[id]);
const FADE = 1.1;

const chapters = ORDER.map((id) => {
  const impl = CHAPTER_IMPL[id];
  const group = impl.build();
  group.name = 'chapter_' + id;
  group.visible = false;
  scene.add(group);
  return { id, impl, group, duration: impl.duration };
});

let clockOffset = 0;
{
  let acc = 0;
  for (const c of chapters) { c.start = acc; acc += c.duration; }
  var TOTAL = acc;
}

const dom = {
  boot: document.getElementById('boot'),
  chapNum: document.querySelector('#chapter .num'),
  chapCn: document.querySelector('#chapter .cn'),
  chapEn: document.querySelector('#chapter .en'),
  chapBox: document.getElementById('chapter'),
  capCn: document.querySelector('#caption .cn'),
  capEn: document.querySelector('#caption .en'),
  capBox: document.getElementById('caption'),
  fade: document.getElementById('fade'),
};

// In freeze mode every CSS transition would still be mid-flight when Chrome
// grabs the frame, so the overlays would screenshot half-faded.
if (P_FREEZE) {
  for (const el of [dom.chapBox, dom.capBox]) el.style.transition = 'none';
}

// --- Catmull-Rom through the camera keyframes. Plain per-segment easing would
// --- bring the camera to a dead stop at every key; this keeps it gliding.
function catmull(p0, p1, p2, p3, u) {
  const u2 = u * u, u3 = u2 * u;
  return 0.5 * ((2 * p1) + (-p0 + p2) * u
    + (2 * p0 - 5 * p1 + 4 * p2 - p3) * u2
    + (-p0 + 3 * p1 - 3 * p2 + p3) * u3);
}

const _p = new THREE.Vector3(), _l = new THREE.Vector3();
function sampleCam(keys, t) {
  let i = 0;
  while (i < keys.length - 2 && t >= keys[i + 1].t) i++;
  const k1 = keys[i], k2 = keys[i + 1] || keys[i];
  const k0 = keys[i - 1] || k1, k3 = keys[i + 2] || k2;
  const span = Math.max(1e-4, k2.t - k1.t);
  const u = clamp((t - k1.t) / span, 0, 1);
  _p.set(
    catmull(k0.p[0], k1.p[0], k2.p[0], k3.p[0], u),
    catmull(k0.p[1], k1.p[1], k2.p[1], k3.p[1], u),
    catmull(k0.p[2], k1.p[2], k2.p[2], k3.p[2], u));
  _l.set(
    catmull(k0.l[0], k1.l[0], k2.l[0], k3.l[0], u),
    catmull(k0.l[1], k1.l[1], k2.l[1], k3.l[1], u),
    catmull(k0.l[2], k1.l[2], k2.l[2], k3.l[2], u));
  return { fov: lerp(k1.fov || 52, k2.fov || 52, ease(u)) };
}

function applySky(s) {
  skyMat.uniforms.topColor.value.set(s.top);
  skyMat.uniforms.midColor.value.set(s.mid);
  skyMat.uniforms.botColor.value.set(s.bot);
  skyMat.uniforms.sunColor.value.set(s.sun);
  skyMat.uniforms.uGlow.value = s.glow !== undefined ? s.glow : 1.0;
  skyMat.uniforms.uStars.value = s.stars || 0;
  setSun(new THREE.Vector3().fromArray(s.sunDir).normalize().multiplyScalar(300), s.sunColor, s.sunI);
  sun.target.position.set(0, s.sunTargetY || 20, 0);
  sun.target.updateMatrixWorld();
  const sr = s.shadowRadius || 150;
  sun.shadow.camera.left = -sr; sun.shadow.camera.right = sr;
  sun.shadow.camera.top = sr; sun.shadow.camera.bottom = -sr;
  sun.shadow.camera.far = 900;
  sun.shadow.camera.updateProjectionMatrix();
  hemi.color.set(s.hemiSky); hemi.groundColor.set(s.hemiGround); hemi.intensity = s.hemiI;
  fill.color.set(s.fillColor || 0x6f86c4);
  fill.intensity = s.fillI !== undefined ? s.fillI : 0.4;
  scene.fog.color.set(s.fog.color);
  scene.fog.near = s.fog.near;
  scene.fog.far = s.fog.far;
  renderer.toneMappingExposure = s.exposure || 1.1;
}

let activeIdx = -1;
let capIdx = -1;

function setChapter(i) {
  if (i === activeIdx) return;
  if (activeIdx >= 0) chapters[activeIdx].group.visible = false;
  activeIdx = i;
  const c = chapters[i];
  c.group.visible = true;
  applySky(c.impl.sky);
  dom.chapNum.textContent = c.impl.title.num;
  dom.chapCn.textContent = c.impl.title.cn;
  dom.chapEn.textContent = c.impl.title.en;
  capIdx = -1;
  dom.capCn.textContent = '';
  dom.capEn.textContent = '';
}

function setCaption(c, localT) {
  const caps = c.impl.captions;
  let idx = -1;
  for (let i = 0; i < caps.length; i++) if (localT >= caps[i].t) idx = i;
  if (idx !== capIdx) {
    capIdx = idx;
    dom.capCn.textContent = idx >= 0 ? caps[idx].cn : '';
    dom.capEn.textContent = idx >= 0 ? caps[idx].en : '';
  }
  // fade the caption out just before the next one arrives
  let vis = 0;
  if (idx >= 0) {
    const start = caps[idx].t;
    const end = idx + 1 < caps.length ? caps[idx + 1].t : c.duration;
    vis = Math.min(pulse(localT, start, start + 0.9), 1 - pulse(localT, end - 0.7, end));
  }
  dom.capBox.style.opacity = clamp(vis, 0, 1).toFixed(3);
}

const director = {
  time: 0,
  paused: false,

  // The director owns the story clock, so pausing and scrubbing are one line
  // each. (Deriving story time from THREE.Clock.elapsedTime instead means a
  // pause silently swallows the paused duration on resume.)
  advance(dt) { if (!this.paused) this.time += dt; },
  seekTo(t) { this.time = TOTAL > 0 ? ((t % TOTAL) + TOTAL) % TOTAL : 0; },

  update(dt) {
    const time = this.time;
    const wrapped = TOTAL > 0 ? ((time % TOTAL) + TOTAL) % TOTAL : 0;
    let i = 0;
    while (i < chapters.length - 1 && wrapped >= chapters[i].start + chapters[i].duration) i++;
    setChapter(i);
    const c = chapters[i];
    const localT = wrapped - c.start;

    c.impl.update(localT, dt);

    const camInfo = sampleCam(c.impl.cam, localT);
    camera.position.copy(_p);
    camera.lookAt(_l);
    if (Math.abs(camera.fov - camInfo.fov) > 0.01) {
      camera.fov = camInfo.fov;
      camera.updateProjectionMatrix();
    }

    setCaption(c, localT);
    audio.sync(c.id, localT, dt);

    // title card: in for the first breath of the chapter, then out of the way
    const titleVis = Math.min(pulse(localT, 0.3, 1.6), 1 - pulse(localT, 7.5, 9.0));
    dom.chapBox.style.opacity = clamp(titleVis, 0, 1).toFixed(3);

    // veil across chapter boundaries (and up from black at the very start)
    const fadeOut = pulse(localT, c.duration - FADE, c.duration);
    const fadeIn = 1 - pulse(localT, 0, FADE);
    dom.fade.style.opacity = clamp(Math.max(fadeOut, fadeIn), 0, 1).toFixed(3);

    skyMat.uniforms.uTime.value = time;
  },
};

// Where the clock starts: ?chapter=N&t=X lands exactly on that story beat.
if (P_CHAPTER !== null) {
  const idx = clamp(P_CHAPTER - 1, 0, chapters.length - 1);
  clockOffset = chapters[idx].start + (P_TIME || 0);
} else {
  clockOffset = P_TIME || 0;
}
director.time = clockOffset;
