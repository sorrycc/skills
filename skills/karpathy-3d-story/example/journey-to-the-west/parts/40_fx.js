
// ============================================================================
//  Shared effects and architecture
//
//  Every factory here returns an object with a .group (or .mesh) and an
//  .update(t, dt). Chapters own the placement; this file owns the behaviour.
// ============================================================================

// ---------------------------------------------------------------------------
//  Water — a lit standard material with wave displacement patched into the
//  vertex stage, so it still takes the chapter's sun, shadows and fog.
// ---------------------------------------------------------------------------
function makeWater(size, segs, color, amp = 0.55, opts = {}) {
  const geo = new THREE.PlaneGeometry(size, size, segs, segs);
  geo.rotateX(-Math.PI / 2);
  const mat = STD({
    color,
    roughness: opts.roughness !== undefined ? opts.roughness : 0.22,
    metalness: opts.metalness !== undefined ? opts.metalness : 0.35,
    transparent: !!opts.transparent,
    opacity: opts.opacity !== undefined ? opts.opacity : 1.0,
  });
  const uTime = { value: 0 };
  const uAmp = { value: amp };
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = uTime;
    sh.uniforms.uAmp = uAmp;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', `
        #include <common>
        uniform float uTime; uniform float uAmp;
        float waveH(vec2 p) {
          return uAmp * (sin(p.x * 0.085 + uTime * 0.85) * cos(p.y * 0.072 - uTime * 0.62)
                       + 0.5 * sin(p.x * 0.21 - p.y * 0.17 + uTime * 1.5));
        }`)
      .replace('#include <beginnormal_vertex>', `
        #include <beginnormal_vertex>
        {
          vec2 p = position.xz;
          float e = 1.2;
          float hx = waveH(p + vec2(e, 0.0)) - waveH(p - vec2(e, 0.0));
          float hz = waveH(p + vec2(0.0, e)) - waveH(p - vec2(0.0, e));
          objectNormal = normalize(vec3(-hx / (2.0 * e), 1.0, -hz / (2.0 * e)));
        }`)
      .replace('#include <begin_vertex>', `
        #include <begin_vertex>
        transformed.y += waveH(position.xz);`);
  };
  const mesh = new THREE.Mesh(geo, mat);
  mesh.receiveShadow = true;
  return { mesh, update: (t) => { uTime.value = t; } };
}

// ---------------------------------------------------------------------------
//  Waterfall — scrolling translucent sheets. Three layers at slightly
//  different speeds is what stops it looking like a moving wallpaper.
// ---------------------------------------------------------------------------
function makeWaterfall(width, height, opts = {}) {
  const group = new THREE.Group();
  const uTime = { value: 0 };
  const layers = 3;
  for (let i = 0; i < layers; i++) {
    const mat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: opts.blending || THREE.NormalBlending,
      uniforms: {
        uTime: uTime,
        uSpeed: { value: (1.5 + i * 0.55) * (opts.speed !== undefined ? opts.speed / 1.5 : 1) },
        uColor: { value: new THREE.Color(opts.color || 0xcfe4f2) },
        uOpacity: { value: (opts.opacity || 0.55) * (1 - i * 0.18) },
        uScale: { value: (opts.scale || 5.0) + i * 3.0 },
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }`,
      fragmentShader: `
        uniform float uTime, uSpeed, uOpacity, uScale;
        uniform vec3 uColor;
        varying vec2 vUv;
        float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        float noise(vec2 p){
          vec2 i = floor(p), f = fract(p);
          f = f * f * (3.0 - 2.0 * f);
          return mix(mix(hash(i), hash(i + vec2(1,0)), f.x),
                     mix(hash(i + vec2(0,1)), hash(i + vec2(1,1)), f.x), f.y);
        }
        void main() {
          vec2 uv = vUv;
          float streak = noise(vec2(uv.x * uScale, uv.y * 2.2 - uTime * uSpeed));
          streak += 0.5 * noise(vec2(uv.x * uScale * 2.3, uv.y * 4.0 - uTime * uSpeed * 1.6));
          streak = smoothstep(0.45, 1.05, streak);
          // fade at the vertical edges, froth at the foot
          float edge = smoothstep(0.0, 0.12, uv.x) * smoothstep(1.0, 0.88, uv.x);
          float foot = smoothstep(0.0, 0.22, uv.y);
          float top  = smoothstep(1.0, 0.72, uv.y);
          float a = uOpacity * edge * (0.35 + 0.65 * streak) * mix(0.25, 1.0, foot) * mix(0.0, 1.0, top);
          vec3 col = mix(uColor * 0.72, vec3(1.0), streak * 0.8);
          gl_FragColor = vec4(col, clamp(a, 0.0, 1.0));
        }`,
    });
    const m = new THREE.Mesh(new THREE.PlaneGeometry(width * (1 - i * 0.05), height, 1, 1), mat);
    m.position.z = i * 0.35;
    m.renderOrder = 5 + i;
    group.add(m);
  }
  return { group, update: (t) => { uTime.value = t; } };
}

// ---------------------------------------------------------------------------
//  Point fields — embers, petals, snow, sparks, motes. One shader, four moods.
//  Points are always camera-facing, which is exactly what these need, and they
//  cost almost nothing next to instanced billboards.
// ---------------------------------------------------------------------------
function makePointField(count, opts) {
  const style   = opts.style || 'glow';
  const area    = opts.area || new THREE.Vector3(60, 30, 60);
  const origin  = opts.origin || new THREE.Vector3(0, 0, 0);
  const rise    = opts.rise !== undefined ? opts.rise : 4.0;
  const drift   = opts.drift !== undefined ? opts.drift : 1.2;
  const sizeMin = opts.sizeMin || 1.0;
  const sizeMax = opts.sizeMax || 3.0;
  const colA    = new THREE.Color(opts.colorA || 0xffb457);
  const colB    = new THREE.Color(opts.colorB || 0xff5a1e);
  const spin    = opts.spin !== undefined ? opts.spin : 0.0;

  const pos = new Float32Array(count * 3);
  const seed = new Float32Array(count);
  const size = new Float32Array(count);
  const mixv = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    pos[i * 3 + 0] = origin.x + rand(-area.x, area.x);
    pos[i * 3 + 1] = origin.y + rand(0, area.y);
    pos[i * 3 + 2] = origin.z + rand(-area.z, area.z);
    seed[i] = rnd();
    size[i] = rand(sizeMin, sizeMax);
    mixv[i] = rnd();
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
  geo.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
  geo.setAttribute('aMix', new THREE.BufferAttribute(mixv, 1));
  geo.computeBoundingSphere();
  geo.boundingSphere.radius = Math.max(area.x, area.y, area.z) * 3;

  const uTime = { value: 0 };
  const uFade = { value: 1 };
  const mat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: (style === 'ember' || style === 'spark' || style === 'glow')
      ? THREE.AdditiveBlending : THREE.NormalBlending,
    uniforms: {
      uTime: uTime, uFade: uFade,
      uPix: { value: Math.min(window.devicePixelRatio, 2) },
      uColA: { value: colA }, uColB: { value: colB },
      uRise: { value: rise }, uDrift: { value: drift },
      uSpanY: { value: area.y }, uOriginY: { value: origin.y },
      uSpin: { value: spin },
    },
    vertexShader: `
      attribute float aSeed, aSize, aMix;
      uniform float uTime, uPix, uRise, uDrift, uSpanY, uOriginY, uSpin;
      varying float vSeed, vMix, vAlpha;
      void main() {
        vSeed = aSeed; vMix = aMix;
        vec3 p = position;
        float life = fract(aSeed + uTime * uRise / max(uSpanY, 0.001));
        p.y = uOriginY + life * uSpanY;
        p.x += sin(uTime * (0.4 + aSeed) + aSeed * 30.0) * uDrift;
        p.z += cos(uTime * (0.33 + aSeed * 0.8) + aSeed * 22.0) * uDrift;
        if (uSpin > 0.0) {
          float a = uTime * uSpin * (0.4 + aSeed);
          float ca = cos(a), sa = sin(a);
          p.xz = mat2(ca, -sa, sa, ca) * p.xz;
        }
        vAlpha = smoothstep(0.0, 0.12, life) * smoothstep(1.0, 0.72, life);
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_PointSize = min(aSize * uPix * (260.0 / max(-mv.z, 1.0)), 26.0 * uPix);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `
      uniform vec3 uColA, uColB;
      uniform float uFade, uTime;
      varying float vSeed, vMix, vAlpha;
      void main() {
        vec2 d = gl_PointCoord - 0.5;
        float r = length(d);
        ${style === 'petal' ? `
          // petal: a soft lens shape, not a disc
          float shape = smoothstep(0.5, 0.06, length(vec2(d.x * 1.9, d.y)));
        ` : style === 'snow' ? `
          float shape = smoothstep(0.5, 0.18, r);
        ` : `
          float shape = smoothstep(0.5, 0.0, r);
          shape *= shape;
        `}
        float tw = 0.75 + 0.25 * sin(uTime * (3.0 + vSeed * 6.0) + vSeed * 40.0);
        vec3 col = mix(uColA, uColB, vMix);
        gl_FragColor = vec4(col, shape * vAlpha * uFade * tw);
        if (gl_FragColor.a < 0.01) discard;
      }`,
  });
  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;
  return { points, mat, update: (t) => { uTime.value = t; }, setFade: (f) => { uFade.value = f; } };
}

// ---------------------------------------------------------------------------
//  Cloud vocabulary — the sea of cloud the celestial chapters stand on, and
//  the 筋斗云 somersault cloud that carries Wukong.
// ---------------------------------------------------------------------------
function makeCloudPuff(scale = 1, color = 0xf6f3ec, emissive = 0x2a3050, opacity = 1) {
  const g = new THREE.Group();
  const mat = STD({ color, roughness: 1.0, emissive, emissiveIntensity: 0.35, flatShading: true,
    transparent: opacity < 1, opacity, depthWrite: opacity > 0.85 });
  const n = randi(5, 8);
  for (let i = 0; i < n; i++) {
    const r = rand(0.6, 1.25) * scale;
    const b = new THREE.Mesh(new THREE.SphereGeometry(r, 8, 6), mat);
    b.position.set(rand(-1.5, 1.5) * scale, rand(-0.25, 0.3) * scale, rand(-1.0, 1.0) * scale);
    b.scale.y = rand(0.45, 0.7);
    g.add(b);
  }
  // curled tips — the auspicious-cloud silhouette from painted scrolls
  for (let i = 0; i < 3; i++) {
    const t = new THREE.Mesh(new THREE.TorusGeometry(0.42 * scale, 0.2 * scale, 6, 12), mat);
    t.position.set(rand(-1.7, 1.7) * scale, rand(-0.1, 0.15) * scale, rand(-0.9, 0.9) * scale);
    t.rotation.x = Math.PI / 2;
    t.scale.y = 0.6;
    g.add(t);
  }
  return g;
}

function makeCloudSea(count, radius, y, opts = {}) {
  const group = new THREE.Group();
  const puffs = [];
  const minR = opts.minR || 0;
  for (let i = 0; i < count; i++) {
    const a = rnd() * TAU, r = minR + Math.sqrt(rnd()) * (radius - minR);
    const p = makeCloudPuff(rand(2.2, 5.0) * (opts.scale || 1), opts.color || 0xf1efe8, opts.emissive || 0x36406a, opts.opacity !== undefined ? opts.opacity : 1);
    p.position.set(Math.cos(a) * r, y + rand(-3, 3), Math.sin(a) * r);
    group.add(p);
    puffs.push({ p, spd: rand(0.35, 1.1), phase: rand(0, TAU), baseY: p.position.y });
  }
  return {
    group,
    update: (t) => {
      for (const c of puffs) {
        c.p.position.y = c.baseY + Math.sin(t * 0.35 + c.phase) * 1.1;
        c.p.rotation.y = c.phase + t * 0.02 * c.spd;
      }
    },
  };
}

// ---------------------------------------------------------------------------
//  Light shafts — a soft additive cone. Used for the seal on 五行山 and for
//  the Buddha-light of 灵山.
// ---------------------------------------------------------------------------
function makeGodRays(radius, height, color, opacity = 0.22, blades = 9) {
  const group = new THREE.Group();
  const uTime = { value: 0 };
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    uniforms: { uColor: { value: new THREE.Color(color) }, uOpacity: { value: opacity }, uTime },
    vertexShader: `
      varying vec2 vUv;
      void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `
      uniform vec3 uColor; uniform float uOpacity, uTime;
      varying vec2 vUv;
      void main() {
        float v = smoothstep(0.0, 0.45, vUv.y) * smoothstep(1.0, 0.35, vUv.y);
        float h = smoothstep(0.0, 0.5, vUv.x) * smoothstep(1.0, 0.5, vUv.x);
        float flick = 0.82 + 0.18 * sin(uTime * 1.6 + vUv.x * 8.0);
        gl_FragColor = vec4(uColor, v * h * uOpacity * flick);
      }`,
  });
  for (let i = 0; i < blades; i++) {
    const a = (i / blades) * Math.PI;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(radius * 2, height), mat);
    m.rotation.y = a;
    m.renderOrder = 8;
    group.add(m);
  }
  return { group, mat, update: (t) => { uTime.value = t; } };
}

// Expanding halo rings — the visual grammar for "something divine just happened".
function makeHalo(color, count = 4, maxR = 14, opacity = 0.5) {
  const group = new THREE.Group();
  const rings = [];
  for (let i = 0; i < count; i++) {
    const mat = new THREE.MeshBasicMaterial({
      color, transparent: true, opacity, side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending, depthWrite: false,
    });
    const m = new THREE.Mesh(new THREE.RingGeometry(0.9, 1.0, 48), mat);
    m.rotation.x = -Math.PI / 2;
    m.renderOrder = 9;
    group.add(m);
    rings.push({ m, mat, off: i / count });
  }
  return {
    group,
    update: (t, speed = 0.35, gain = 1) => {
      for (const r of rings) {
        const k = (t * speed + r.off) % 1;
        const s = 0.4 + k * maxR;
        r.m.scale.setScalar(s);
        r.mat.opacity = opacity * (1 - k) * gain;
      }
    },
  };
}

// ---------------------------------------------------------------------------
//  Architecture — the temple/palace vocabulary. Everything gold-and-cinnabar
//  in chapters 2 and 5 is assembled from these three functions.
// ---------------------------------------------------------------------------

// A hip roof with upturned eaves, built as stacked tile courses whose overhang
// curves upward toward the corners. Cheap, and reads unmistakably as Chinese.
function makeRoof(w, d, h, opts = {}) {
  const g = new THREE.Group();
  const courses = opts.courses || 9;
  const tileMat = STD({ color: opts.color || C.imperialY, roughness: 0.55, metalness: 0.28 });
  const trimMat = STD({ color: opts.trim || C.cinnabar, roughness: 0.7 });
  for (let i = 0; i < courses; i++) {
    const t = i / (courses - 1);
    // the profile: shrinks toward the ridge, and the lowest courses flare out
    const flare = Math.pow(1 - t, 2.6) * 0.16;
    const cw = w * (1 - t * 0.82) + w * flare;
    const cd = d * (1 - t * 0.82) + d * flare;
    const y = h * (t * t * 0.55 + t * 0.45);
    const course = shadowed(new THREE.Mesh(new THREE.BoxGeometry(cw, h / courses * 1.35, cd), tileMat));
    course.position.y = y;
    g.add(course);
  }
  // ridge beam
  const ridge = shadowed(new THREE.Mesh(new THREE.BoxGeometry(w * 0.24, h * 0.11, d * 0.24), trimMat));
  ridge.position.y = h * 1.02;
  g.add(ridge);
  // four upturned corner horns
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const horn = new THREE.Mesh(
      new THREE.TorusGeometry(w * 0.075, w * 0.016, 5, 10, Math.PI * 0.55),
      trimMat);
    horn.position.set(sx * w * 0.55, h * 0.10, sz * d * 0.55);
    horn.rotation.set(0, Math.atan2(sx, sz), Math.PI * 0.5 - 0.5);
    g.add(horn);
    const tip = new THREE.Mesh(new THREE.ConeGeometry(w * 0.022, w * 0.10, 5), trimMat);
    tip.position.set(sx * w * 0.60, h * 0.20, sz * d * 0.60);
    tip.rotation.set(sz * 0.5, 0, -sx * 0.5);
    g.add(tip);
  }
  return g;
}

// A colonnade hall: platform, red pillars, roof. opts.tiers stacks roofs.
function makeHall(w, d, opts = {}) {
  const g = new THREE.Group();
  const pillarH = opts.pillarH || 7;
  const plat = shadowed(new THREE.Mesh(
    new THREE.BoxGeometry(w * 1.22, 1.4, d * 1.22),
    STD({ color: opts.platform || 0xd8d2c2, roughness: 0.9 })));
  plat.position.y = 0.7;
  g.add(plat);
  const step = shadowed(new THREE.Mesh(
    new THREE.BoxGeometry(w * 1.38, 0.6, d * 1.38),
    STD({ color: opts.platform || 0xd8d2c2, roughness: 0.95 })));
  step.position.y = 0.3;
  g.add(step);

  const pillarMat = STD({ color: opts.pillar || C.cinnabar, roughness: 0.6 });
  const nx = opts.nx || 4, nz = opts.nz || 3;
  for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) {
    if (i > 0 && i < nx - 1 && j > 0 && j < nz - 1) continue;   // perimeter only
    const p = shadowed(new THREE.Mesh(
      new THREE.CylinderGeometry(w * 0.030, w * 0.033, pillarH, 10), pillarMat));
    p.position.set(
      -w / 2 + (i / (nx - 1)) * w,
      1.4 + pillarH / 2,
      -d / 2 + (j / (nz - 1)) * d);
    g.add(p);
  }
  // architrave
  const beam = shadowed(new THREE.Mesh(
    new THREE.BoxGeometry(w * 1.08, 0.75, d * 1.08), STD({ color: C.darkGold, roughness: 0.5, metalness: 0.4 })));
  beam.position.y = 1.4 + pillarH + 0.3;
  g.add(beam);

  const roof = makeRoof(w * 1.42, d * 1.42, opts.roofH || 5.5, { color: opts.roof || C.imperialY, trim: opts.trim || C.cinnabar });
  roof.position.y = 1.4 + pillarH + 0.7;
  g.add(roof);

  if (opts.tiers && opts.tiers > 1) {
    const roof2 = makeRoof(w * 1.02, d * 1.02, (opts.roofH || 5.5) * 0.8, { color: opts.roof || C.imperialY, trim: opts.trim || C.cinnabar });
    roof2.position.y = 1.4 + pillarH + 0.7 + (opts.roofH || 5.5) * 0.95;
    g.add(roof2);
  }
  g.userData.topY = 1.4 + pillarH + 0.7 + (opts.roofH || 5.5) * (opts.tiers > 1 ? 1.85 : 1.05);
  return g;
}

// A flight of stone steps, used at 南天门 and up 灵山.
function makeStairs(steps, width, rise, run, color = 0xcfc8b6) {
  const g = new THREE.Group();
  const mat = STD({ color, roughness: 0.95 });
  for (let i = 0; i < steps; i++) {
    const s = shadowed(new THREE.Mesh(new THREE.BoxGeometry(width, rise, run * (steps - i) + run), mat));
    s.position.set(0, rise * (i + 0.5), -(run * (steps - i) + run) / 2 + run * 0.5);
    g.add(s);
  }
  // balustrades
  for (const sx of [-1, 1]) {
    for (let i = 0; i < steps; i += 2) {
      const post = shadowed(new THREE.Mesh(new THREE.BoxGeometry(width * 0.05, rise * 2.2, width * 0.05),
        STD({ color: 0xe6e0d0, roughness: 0.9 })));
      post.position.set(sx * width * 0.47, rise * (i + 1.6), -run * i);
      g.add(post);
    }
  }
  g.userData.topY = rise * steps;
  g.userData.depth = run * steps;
  return g;
}

// A hanging banner: cloth panel plus a pole. Colour bands stand in for text.
function makeBanner(w, h, color, accent = C.gold) {
  const g = new THREE.Group();
  const cloth = shadowed(new THREE.Mesh(new THREE.PlaneGeometry(w, h, 1, 6),
    STD({ color, roughness: 0.9, side: THREE.DoubleSide })));
  cloth.position.y = -h / 2;
  g.add(cloth);
  for (let i = 0; i < 3; i++) {
    const band = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.5, h * 0.06),
      STD({ color: accent, side: THREE.DoubleSide, roughness: 0.6, metalness: 0.4 }));
    band.position.set(0, -h * (0.22 + i * 0.24), 0.02);
    g.add(band);
  }
  const rod = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(w * 0.03, w * 0.03, w * 1.15, 6),
    STD({ color: C.darkGold, metalness: 0.7, roughness: 0.35 })));
  rod.rotation.z = Math.PI / 2;
  g.add(rod);
  g.userData.cloth = cloth;
  return g;
}

// ---------------------------------------------------------------------------
//  A burst of sparks for impacts — pre-allocated, replayed by resetting t0.
// ---------------------------------------------------------------------------
function makeBurst(count, color, spread = 6, life = 1.2) {
  const pos = new Float32Array(count * 3);
  const vel = new Float32Array(count * 3);
  const seed = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    const dir = new THREE.Vector3(rand(-1, 1), rand(-0.2, 1), rand(-1, 1)).normalize().multiplyScalar(rand(0.35, 1) * spread);
    vel[i * 3] = dir.x; vel[i * 3 + 1] = dir.y; vel[i * 3 + 2] = dir.z;
    seed[i] = rnd();
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('aVel', new THREE.BufferAttribute(vel, 3));
  geo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
  geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), spread * 3);
  const uAge = { value: 99 };
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: {
      uAge, uLife: { value: life }, uColor: { value: new THREE.Color(color) },
      uPix: { value: Math.min(window.devicePixelRatio, 2) },
    },
    vertexShader: `
      attribute vec3 aVel; attribute float aSeed;
      uniform float uAge, uLife, uPix;
      varying float vA;
      void main() {
        float k = clamp(uAge / uLife, 0.0, 1.0);
        vec3 p = aVel * (k * (2.0 - k)) * 3.0;
        p.y -= 4.0 * k * k;
        vA = (1.0 - k) * step(uAge, uLife);
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_PointSize = min((2.0 + aSeed * 4.0) * uPix * (240.0 / max(-mv.z, 1.0)), 30.0 * uPix);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `
      uniform vec3 uColor; varying float vA;
      void main() {
        float r = length(gl_PointCoord - 0.5);
        float s = smoothstep(0.5, 0.0, r);
        gl_FragColor = vec4(uColor, s * s * vA);
        if (gl_FragColor.a < 0.01) discard;
      }`,
  });
  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;
  return {
    points,
    // age is driven directly by the chapter clock so screenshots stay
    // deterministic — no fire-and-forget timers anywhere in this file.
    setAge: (a) => { uAge.value = a; },
  };
}
