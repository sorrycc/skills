
// ============================================================================
//  西游记 — a procedural three.js telling of Journey to the West
//  Five chapters, one file, everything built from code.
//
//  URL params (used by shot.sh, handy by hand):
//    ?chapter=N   jump straight to chapter N (1-5)
//    &t=SECONDS   local story time inside that chapter
//    &freeze=1    render exactly one frame and stop — deterministic screenshots
//    &seed=NNN    reseed the procedural placement
// ============================================================================

const PARAMS = new URLSearchParams(location.search);
const P_CHAPTER = PARAMS.has('chapter') ? Math.max(1, parseInt(PARAMS.get('chapter'), 10)) : null;
const P_TIME    = PARAMS.has('t') ? parseFloat(PARAMS.get('t')) : 0;
const P_FREEZE  = PARAMS.get('freeze') === '1';
const P_SEED    = PARAMS.has('seed') ? parseInt(PARAMS.get('seed'), 10) : 20260803;

// ============================================================================
//  Helpers — seeded RNG, so every load places the same rocks in the same spots.
//  Without this, two audit screenshots are of two different scenes and you
//  cannot tell a fix from a reroll.
// ============================================================================
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
let _rng = mulberry32(P_SEED);
function rnd()          { return _rng(); }
function rand(a, b)     { return a + _rng() * (b - a); }
function randi(a, b)    { return Math.floor(rand(a, b + 1)); }
function pick(arr)      { return arr[Math.floor(_rng() * arr.length)]; }
function chance(p)      { return _rng() < p; }
function reseed(s)      { _rng = mulberry32(s); }

const clamp  = THREE.MathUtils.clamp;
const lerp   = THREE.MathUtils.lerp;
const smooth = THREE.MathUtils.smoothstep;
const TAU    = Math.PI * 2;

// Ease helpers for camera moves and beats
function ease(t)      { return t * t * (3 - 2 * t); }               // smoothstep
function easeOut(t)   { return 1 - Math.pow(1 - t, 3); }
function easeIn(t)    { return t * t * t; }
function pulse(t, a, b) { return clamp((t - a) / Math.max(1e-6, b - a), 0, 1); }

const STD = (o) => new THREE.MeshStandardMaterial(Object.assign({ roughness: 0.85, metalness: 0.0 }, o));
const PHONG = (o) => new THREE.MeshPhongMaterial(Object.assign({ shininess: 40 }, o));
const BASIC = (o) => new THREE.MeshBasicMaterial(Object.assign({}, o));

// A colour vocabulary borrowed from temple paint and opera costume.
const C = {
  cinnabar:  0xb8352a,   // 朱红  temple pillars, Wukong's skirt
  vermilion: 0xd94f2b,
  imperialY: 0xe8b83a,   // 明黄  the celestial palace
  gold:      0xf2c75c,
  darkGold:  0xa8781f,
  jade:      0x3f8f76,   // 青绿
  deepJade:  0x1f5a4c,
  ink:       0x1a1d26,
  stone:     0x6b6b6e,
  darkStone: 0x3b3b42,
  fur:       0x9a6b3e,   // Wukong
  furLight:  0xc09257,
  monkRobe:  0xc23b28,
  monkGold:  0xd9a441,
  pigSkin:   0xd9a0a0,
  shaRobe:   0x2f4157,
  cloud:     0xf3f1ea,
  flame:     0xff7a1a,
  ember:     0xffca5c,
  bone:      0xe7e2d4,
};

// ============================================================================
//  Renderer / scene / camera
// ============================================================================
// preserveDrawingBuffer only in freeze mode: it lets the screenshot tool grab a
// frame long after we stopped drawing, which is what makes a cheap 3-frame
// render enough. Leaving it on for playback would cost fps for nothing.
const renderer = new THREE.WebGLRenderer({
  antialias: true,
  powerPreference: 'high-performance',
  preserveDrawingBuffer: P_FREEZE,
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.1;
renderer.outputColorSpace = THREE.SRGBColorSpace;
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0x1a2438, 90, 620);

const camera = new THREE.PerspectiveCamera(52, window.innerWidth / window.innerHeight, 0.5, 4000);
camera.position.set(0, 30, 120);

// ============================================================================
//  Sky — one dome for the whole film. The director drives its uniforms, so a
//  chapter change is a colour interpolation, not five separate skies.
// ============================================================================
const SKY = {
  top:    new THREE.Color(0x1b2a52),
  mid:    new THREE.Color(0x53628c),
  bot:    new THREE.Color(0xd98a4a),
  sun:    new THREE.Color(0xffc07a),
  sunDir: new THREE.Vector3(-0.5, 0.35, -0.8).normalize(),
  glow:   1.0,
  stars:  0.0,
};

const skyMat = new THREE.ShaderMaterial({
  side: THREE.BackSide,
  depthWrite: false,
  fog: false,
  uniforms: {
    topColor: { value: SKY.top },
    midColor: { value: SKY.mid },
    botColor: { value: SKY.bot },
    sunColor: { value: SKY.sun },
    sunDir:   { value: SKY.sunDir.clone() },
    uGlow:    { value: 1.0 },
    uStars:   { value: 0.0 },
    uTime:    { value: 0.0 },
  },
  vertexShader: `
    varying vec3 vDir;
    void main() {
      vDir = position;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }`,
  fragmentShader: `
    uniform vec3 topColor, midColor, botColor, sunColor, sunDir;
    uniform float uGlow, uStars, uTime;
    varying vec3 vDir;

    float hash31(vec3 p) {
      p = fract(p * 0.3183099 + vec3(0.71, 0.113, 0.419));
      p *= 17.0;
      return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
    }

    void main() {
      vec3 d = normalize(vDir);
      float h = d.y;
      vec3 col = (h > 0.0) ? mix(midColor, topColor, pow(h, 0.7))
                           : mix(midColor, botColor, pow(-h, 0.55));

      // sun / celestial glow
      float s = max(dot(d, normalize(sunDir)), 0.0);
      col += sunColor * uGlow * (pow(s, 420.0) * 1.6 + pow(s, 22.0) * 0.40 + pow(s, 4.0) * 0.13);

      // sparse stars, faded in per chapter
      if (uStars > 0.001 && h > 0.02) {
        vec3 q = floor(d * 260.0);
        float n = hash31(q);
        float star = smoothstep(0.9975, 1.0, n);
        float tw = 0.65 + 0.35 * sin(uTime * 2.2 + n * 90.0);
        col += vec3(0.9, 0.94, 1.0) * star * tw * uStars * smoothstep(0.02, 0.35, h);
      }
      gl_FragColor = vec4(col, 1.0);
    }`,
});
const skyDome = new THREE.Mesh(new THREE.SphereGeometry(1400, 48, 28), skyMat);
skyDome.frustumCulled = false;
scene.add(skyDome);

// ============================================================================
//  Light rig — one sun with shadows, one fill, one hemisphere. The director
//  retargets and recolours them per chapter rather than adding new lights.
// ============================================================================
const hemi = new THREE.HemisphereLight(0x8fa4d4, 0x3a3524, 0.55);
scene.add(hemi);

const sun = new THREE.DirectionalLight(0xffd9a0, 1.5);
sun.position.set(-90, 110, -120);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -140;
sun.shadow.camera.right = 140;
sun.shadow.camera.top = 140;
sun.shadow.camera.bottom = -140;
sun.shadow.camera.near = 20;
sun.shadow.camera.far = 520;
sun.shadow.bias = -0.0007;
sun.shadow.normalBias = 0.6;
scene.add(sun);
scene.add(sun.target);

const fill = new THREE.DirectionalLight(0x6f86c4, 0.45);
fill.position.set(80, 45, 90);
scene.add(fill);

function setSun(dir, color, intensity) {
  sun.position.copy(dir);
  sun.color.set(color);
  sun.intensity = intensity;
  SKY.sunDir.copy(dir).normalize();
  skyMat.uniforms.sunDir.value.copy(SKY.sunDir);
}

// ============================================================================
//  Small shared builders used by every chapter
// ============================================================================
function shadowed(mesh, cast = true, receive = true) {
  mesh.castShadow = cast;
  mesh.receiveShadow = receive;
  return mesh;
}

// A lumpy rock / mountain mass: a sphere pushed around by trig noise, flattened
// at the base so it always reads as sitting *on* the ground rather than in it.
function makeRockMass(radius, height, colorLow, colorHigh, seedOff = 0, segs = 28) {
  const geo = new THREE.SphereGeometry(radius, segs, Math.max(10, segs >> 1), 0, TAU, 0, Math.PI * 0.5);
  const pos = geo.attributes.position;
  const colors = [];
  const cl = new THREE.Color(colorLow), ch = new THREE.Color(colorHigh), tmp = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    const a = Math.atan2(z, x);
    const n = 1
      + Math.sin(a * 5.0 + seedOff) * 0.11
      + Math.sin(a * 11.0 + y * 0.16 + seedOff * 2.3) * 0.06
      + Math.cos(y * 0.33 + a * 3.0 + seedOff) * 0.05;
    const yn = y * (1 + Math.sin(a * 7.0 + seedOff * 1.7) * 0.06);
    pos.setXYZ(i, x * n, yn * (height / radius), z * n);
    tmp.copy(cl).lerp(ch, clamp(y / radius, 0, 1));
    colors.push(tmp.r, tmp.g, tmp.b);
  }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  return shadowed(new THREE.Mesh(geo, STD({ vertexColors: true, roughness: 1.0, flatShading: true })));
}

// A jagged spire — the vertical rock vocabulary of 花果山 and 火焰山.
function makeSpire(r, h, color, seedOff = 0, tilt = 0) {
  const geo = new THREE.CylinderGeometry(r * 0.18, r, h, 7, 5, false);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    const t = (y + h / 2) / h;
    const n = 1 + Math.sin(Math.atan2(z, x) * 4.0 + t * 6.0 + seedOff) * 0.16;
    pos.setXYZ(i, x * n, y + Math.sin(t * 5.0 + seedOff) * h * 0.02, z * n);
  }
  geo.computeVertexNormals();
  // Wrap it so the ORIGIN IS THE BASE. A bare cylinder mesh is centred on its
  // own middle, so every caller that places one at ground level buries half of
  // it — and anything anchored to "the top" ends up floating in mid-air.
  const m = shadowed(new THREE.Mesh(geo, STD({ color, roughness: 1.0, flatShading: true })));
  m.position.y = h / 2;
  const g = new THREE.Group();
  g.add(m);
  g.rotation.z = tilt;
  g.userData.height = h;
  return g;
}

// Round-topped foliage used for peach trees and pines.
function makeTreeSimple(scale, trunkColor, leafColor, blossom) {
  const g = new THREE.Group();
  const trunk = shadowed(new THREE.Mesh(
    new THREE.CylinderGeometry(0.22 * scale, 0.36 * scale, 3.0 * scale, 6),
    STD({ color: trunkColor, roughness: 1.0, flatShading: true })));
  trunk.position.y = 1.5 * scale;
  g.add(trunk);
  const canopy = [];
  const n = 3;
  for (let i = 0; i < n; i++) {
    const r = (1.5 - i * 0.28) * scale;
    const blob = shadowed(new THREE.Mesh(
      new THREE.SphereGeometry(r, 9, 7),
      STD({ color: leafColor, roughness: 1.0, flatShading: true })));
    blob.position.set(rand(-0.5, 0.5) * scale, (3.0 + i * 0.85) * scale, rand(-0.5, 0.5) * scale);
    blob.scale.y = 0.82;
    g.add(blob);
    canopy.push(blob);
  }
  if (blossom) {
    const dummy = new THREE.Object3D();
    const inst = new THREE.InstancedMesh(
      new THREE.SphereGeometry(0.13 * scale, 5, 4),
      STD({ color: 0xf2a8c0, roughness: 0.9, emissive: 0x3a1420, emissiveIntensity: 0.4 }),
      26);
    for (let i = 0; i < 26; i++) {
      const b = canopy[randi(0, canopy.length - 1)];
      const dir = new THREE.Vector3(rand(-1, 1), rand(-0.3, 1), rand(-1, 1)).normalize();
      const rr = b.geometry.parameters.radius * 0.95;
      dummy.position.copy(b.position).addScaledVector(dir, rr);
      dummy.scale.setScalar(rand(0.7, 1.5));
      dummy.updateMatrix();
      inst.setMatrixAt(i, dummy.matrix);
    }
    g.add(inst);
  }
  g.userData.canopy = canopy;
  return g;
}

// Chapter registry — each chapter file pushes {id, group, update} here.
const CHAPTER_IMPL = {};
function registerChapter(id, impl) { CHAPTER_IMPL[id] = impl; }

// Everything a chapter builds goes under its own group, parked at the origin.
// Only one is visible at a time, so chapters never leak into each other's
// framing and the camera splines can all be written in local coordinates.
function newChapterGroup(id) {
  const g = new THREE.Group();
  g.name = 'chapter_' + id;
  g.visible = false;
  scene.add(g);
  return g;
}
