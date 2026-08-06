
// ============================================================================
//  第一回 · 石猴出世 —— 花果山 · 水帘洞
//  Birth of the Stone Monkey, on the Mountain of Flowers and Fruit.
//
//  The island is built as concentric terraces rather than a noise heightfield,
//  because then the ground height is something I can state exactly:
//  islandY() below is the single source of truth, and every tree, monkey and
//  camera target is placed through it. Nothing on this island floats.
// ============================================================================
(function () {

const TERRACES = [
  { r: 96, y: 3.0 },
  { r: 63, y: 15.0 },
  { r: 41, y: 29.0 },
  { r: 25, y: 43.0 },
  { r: 12.5, y: 55.0 },
];
const SEA_Y = 0;

function islandY(x, z) {
  const d = Math.hypot(x, z);
  for (let i = TERRACES.length - 1; i >= 0; i--) {
    if (d <= TERRACES[i].r - 2.0) return TERRACES[i].y;
  }
  return -6;
}

// A terrace: flat top plus a rough rocky rim, so the silhouette is craggy but
// the walkable surface is exactly TERRACES[i].y.
function makeTerrace(r, top, height, seedOff) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.CylinderGeometry(r, r * 1.12, height, 30, 1),
    STD({ color: 0x6a6357, roughness: 1.0, flatShading: true }));
  const pos = body.geometry.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    if (Math.abs(y - height / 2) < 0.01) continue;         // keep the top flat
    const a = Math.atan2(z, x);
    const n = 1 + Math.sin(a * 6 + seedOff) * 0.045 + Math.sin(a * 13 + y * 0.2 + seedOff) * 0.028;
    pos.setXYZ(i, x * n, y, z * n);
  }
  body.geometry.computeVertexNormals();
  shadowed(body);
  body.position.y = top - height / 2;
  g.add(body);

  // grass cap
  const cap = new THREE.Mesh(
    new THREE.CylinderGeometry(r, r, 0.55, 30, 1),
    STD({ color: 0x4e7d3c, roughness: 1.0, flatShading: true }));
  cap.position.y = top - 0.1;
  shadowed(cap);
  g.add(cap);

  // boulders around the rim
  for (let i = 0; i < 16; i++) {
    const a = rand(0, TAU);
    const rr = r * rand(0.86, 1.0);
    const b = shadowed(new THREE.Mesh(
      new THREE.DodecahedronGeometry(rand(1.2, 3.2), 0),
      STD({ color: 0x6f6659, roughness: 1.0, flatShading: true })));
    b.position.set(Math.cos(a) * rr, top - rand(0.2, 1.2), Math.sin(a) * rr);
    b.rotation.set(rand(0, 3), rand(0, 3), rand(0, 3));
    g.add(b);
  }
  return g;
}

registerChapter(1, {
  title: { num: '第 一 回', cn: '石猴出世', en: 'Birth of the Stone Monkey' },
  duration: 44,
  sky: {
    top: 0x1d3f79, mid: 0x7f92c0, bot: 0xf2b478, sun: 0xffd9a4,
    sunDir: [-0.55, 0.28, 0.78], sunColor: 0xffd6a0, sunI: 2.5,
    hemiSky: 0xa8bde8, hemiGround: 0x53603c, hemiI: 1.0,
    fillColor: 0x86a0e0, fillI: 0.55,
    glow: 1.3, stars: 0.07,
    fog: { color: 0xa8b8d4, near: 180, far: 900 },
    exposure: 1.2, sunTargetY: 30, shadowRadius: 120,
  },
  captions: [
    { t: 0.5,  cn: '东胜神洲，海中有一座花果山', en: 'In the Eastern Sea stands the Mountain of Flowers and Fruit' },
    { t: 10.5, cn: '山顶一块仙石，受日月精华，孕育多年', en: 'On its summit lay a stone, nursed by sun and moon' },
    { t: 21.0, cn: '一日迸裂，产一石卵，化作石猴', en: 'One day it split, and from it came a stone monkey' },
    { t: 30.0, cn: '目运两道金光，射冲斗府', en: 'From his eyes shot two beams of golden light' },
    { t: 37.0, cn: '群猴拜为王，号「美猴王」', en: 'The monkeys hailed him king — the Handsome Monkey King' },
  ],
  cam: [
    { t: 0,    p: [-40, 9, 330],  l: [0, 34, 0] },
    { t: 10,   p: [-16, 14, 178], l: [0, 30, 0] },
    { t: 17,   p: [13, 15, 116],  l: [0, 9, 71] },    // the water curtain and the cave behind it
    { t: 24,   p: [26, 52, 86],   l: [0, 40, 10] },   // climbing the terraces
    { t: 30,   p: [11, 64, 31],   l: [0, 58, 0] },    // summit, the stone
    { t: 34,   p: [-8, 61, 20],   l: [0, 58.5, 0] },  // the new king, close
    { t: 39,   p: [-27, 66, 48],  l: [0, 56, 0] },
    { t: 44,   p: [-72, 92, 152], l: [0, 44, 0] },
  ],
  build() {
    reseed(11071);
    const g = new THREE.Group();

    // ---- the sea ------------------------------------------------------
    const sea = makeWater(1800, 150, 0x3a749e, 0.75, { roughness: 0.34, metalness: 0.42 });
    sea.mesh.position.y = SEA_Y;
    g.add(sea.mesh);

    // ---- the island: five terraces ------------------------------------
    for (let i = 0; i < TERRACES.length; i++) {
      const T = TERRACES[i];
      const prevY = i === 0 ? -12 : TERRACES[i - 1].y;
      g.add(makeTerrace(T.r, T.y, T.y - prevY + 4, i * 3.7));
    }

    // crags on the summit — 花果山 is a peak, not a wedding cake
    for (let i = 0; i < 7; i++) {
      // keep the +Z sector clear: every camera in this chapter looks from there
      const a = rand(Math.PI * 0.72, Math.PI * 1.28), rr = rand(9.5, 13);
      const s = makeSpire(rand(1.8, 3.0), rand(6, 11), 0x6d6456, i * 2.1, rand(-0.12, 0.12));
      s.position.set(Math.cos(a) * rr, TERRACES[4].y, Math.sin(a) * rr);
      g.add(s);
    }
    for (let i = 0; i < 10; i++) {
      const a = rand(-2.95, -1.7), rr = rand(28, 39);
      const s = makeSpire(rand(2, 4), rand(7, 15), 0x746a5b, i * 1.3, rand(-0.15, 0.15));
      s.position.set(Math.cos(a) * rr, TERRACES[2].y, Math.sin(a) * rr);
      g.add(s);
    }

    // ---- the falls: one drop per terrace, all on the +Z face ----------
    // The lowest drop pours over a rock buttress that juts clear of the
    // terraces — the cave has to be cut into a face the camera can actually
    // see, not into a slope that closes over it a few units further down.
    const buttress = shadowed(new THREE.Mesh(new THREE.BoxGeometry(46, 16, 16),
      STD({ color: 0x6c6457, roughness: 1.0, flatShading: true })));
    {
      const bp = buttress.geometry.attributes.position;
      for (let i = 0; i < bp.count; i++) {
        const x = bp.getX(i), y = bp.getY(i), z = bp.getZ(i);
        if (z > 7.9) continue;                              // leave the front face flat
        bp.setXYZ(i, x * rand(0.94, 1.06), y, z * rand(0.9, 1.05));
      }
      buttress.geometry.computeVertexNormals();
    }
    buttress.position.set(0, 7.6, 62);                      // front face at z = 70
    g.add(buttress);
    for (let i = 0; i < 14; i++) {                          // rubble at its foot
      const b = shadowed(new THREE.Mesh(new THREE.DodecahedronGeometry(rand(1.6, 4.0), 0),
        STD({ color: 0x6f6659, roughness: 1.0, flatShading: true })));
      b.position.set(rand(-26, 26), rand(1.5, 3.5), rand(68, 78));
      b.rotation.set(rand(0, 3), rand(0, 3), rand(0, 3));
      g.add(b);
    }

    const falls = [];
    const FALL_SPECS = [
      { z: 25.8, yTop: 43.5, yBot: 28.5, w: 9 },
      { z: 41.8, yTop: 29.5, yBot: 14.5, w: 12 },
      { z: 71.8, yTop: 15.8, yBot: 1.0,  w: 17 },
    ];
    for (const f of FALL_SPECS) {
      const h = f.yTop - f.yBot;
      const wf = makeWaterfall(f.w, h, { color: 0xd8ecf7, opacity: 0.62 });
      wf.group.position.set(0, (f.yTop + f.yBot) / 2, f.z);
      wf.group.rotation.x = -0.06;
      g.add(wf.group);
      falls.push(wf);

      // splash pool + mist at the foot of each drop
      const pool = new THREE.Mesh(
        new THREE.CircleGeometry(f.w * 0.85, 24),
        STD({ color: 0x7fb6cf, roughness: 0.15, metalness: 0.4, transparent: true, opacity: 0.85 }));
      pool.rotation.x = -Math.PI / 2;
      pool.position.set(0, f.yBot + 0.35, f.z - 1.5);
      g.add(pool);

      const mist = makePointField(120, {
        style: 'glow', area: new THREE.Vector3(f.w * 0.7, 8, 3.5),
        origin: new THREE.Vector3(0, f.yBot, f.z - 1),
        rise: 3.2, drift: 1.2, sizeMin: 2.5, sizeMax: 6.5,
        colorA: 0xdfeef8, colorB: 0x9fc4dc,
      });
      mist.mat.blending = THREE.NormalBlending;
      mist.mat.uniforms.uFade.value = 0.34;
      g.add(mist.points);
      falls.push(mist);
    }

    // ---- 水帘洞 — the cave behind the lowest fall ----------------------
    const caveG = new THREE.Group();
    caveG.position.set(0, 2.6, 70.1);         // flush with the buttress front face
    // dark mouth
    const mouthShape = new THREE.Shape();
    mouthShape.moveTo(-5.2, 0);
    mouthShape.lineTo(-5.2, 5.0);
    mouthShape.quadraticCurveTo(0, 11.0, 5.2, 5.0);
    mouthShape.lineTo(5.2, 0);
    mouthShape.lineTo(-5.2, 0);
    const mouth = new THREE.Mesh(new THREE.ShapeGeometry(mouthShape),
      new THREE.MeshBasicMaterial({ color: 0x0a0d14 }));
    mouth.position.z = 0.05;
    caveG.add(mouth);
    // rock surround, built as chunks around the arch so the opening reads as
    // carved into the cliff rather than painted on it
    for (let i = 0; i < 22; i++) {
      const a = Math.PI * (0.02 + 0.96 * (i / 21));
      const rr = 6.6 + rand(-0.3, 0.9);
      const chunk = shadowed(new THREE.Mesh(
        new THREE.DodecahedronGeometry(rand(1.3, 2.4), 0),
        STD({ color: 0x5e564a, roughness: 1.0, flatShading: true })));
      chunk.position.set(Math.cos(a) * rr, Math.sin(a) * rr * 0.95, rand(0.2, 1.2));
      chunk.rotation.set(rand(0, 3), rand(0, 3), rand(0, 3));
      caveG.add(chunk);
    }
    const caveGlow = new THREE.PointLight(0xffb367, 0, 40, 2);
    caveGlow.position.set(0, 5, -2.5);
    caveG.add(caveGlow);
    g.add(caveG);

    // 石碣 — the stone tablet beside the cave: 「花果山福地，水帘洞洞天」
    const tablet = shadowed(new THREE.Mesh(new THREE.BoxGeometry(3.2, 6.4, 0.6),
      STD({ color: 0x8d8577, roughness: 0.95 })));
    tablet.position.set(15.5, 6.0, 70.3);
    tablet.rotation.y = -0.35;
    g.add(tablet);
    for (let i = 0; i < 5; i++) {
      const glyph = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.16, 0.1),
        STD({ color: 0x3a3128, roughness: 0.9 }));
      glyph.position.set(15.35, 8.2 - i * 0.95, 70.62);
      glyph.rotation.y = -0.35;
      g.add(glyph);
    }

    // ---- vegetation ----------------------------------------------------
    for (let i = 0; i < 46; i++) {
      const ti = randi(0, 2);
      const T = TERRACES[ti];
      const a = rand(0, TAU);
      const rr = rand(ti === 0 ? 42 : 8, T.r - 5);
      const x = Math.cos(a) * rr, z = Math.sin(a) * rr;
      if (Math.abs(x) < 14 && z > 0) continue;             // keep the falls clear
      const tree = makeTreeSimple(rand(1.5, 2.6), 0x5b4227, pick([0x3f7a36, 0x4a8a3c, 0x35682e]), chance(0.55));
      tree.position.set(x, islandY(x, z) - 0.2, z);
      tree.rotation.y = rand(0, TAU);
      g.add(tree);
    }
    // 蟠桃 — peaches, since this is the Mountain of Flowers and *Fruit*
    for (let i = 0; i < 60; i++) {
      const a = rand(0, TAU), rr = rand(20, 88);
      const x = Math.cos(a) * rr, z = Math.sin(a) * rr;
      const y = islandY(x, z);
      if (y < 0) continue;
      const bush = shadowed(new THREE.Mesh(new THREE.SphereGeometry(rand(0.8, 1.8), 7, 6),
        STD({ color: 0x39702f, roughness: 1.0, flatShading: true })));
      bush.position.set(x, y + 0.6, z);
      bush.scale.y = 0.7;
      g.add(bush);
    }

    // ---- the summit stone 仙石 and its egg -----------------------------
    const summitY = TERRACES[4].y;
    const pedestal = shadowed(new THREE.Mesh(
      new THREE.CylinderGeometry(5.2, 6.4, 2.4, 12),
      STD({ color: 0x7d7565, roughness: 1.0, flatShading: true })));
    pedestal.position.set(0, summitY + 1.2, 0);
    g.add(pedestal);

    const eggMat = STD({
      color: 0xbdb4a0, roughness: 0.72,
      emissive: 0x6a4a12, emissiveIntensity: 0.0, flatShading: true,
    });
    const eggTop = shadowed(new THREE.Mesh(
      new THREE.SphereGeometry(3.6, 20, 14, 0, TAU, 0, Math.PI / 2), eggMat));
    const eggBot = shadowed(new THREE.Mesh(
      new THREE.SphereGeometry(3.6, 20, 14, 0, TAU, Math.PI / 2, Math.PI / 2), eggMat));
    eggTop.scale.y = 1.35; eggBot.scale.y = 1.35;
    const eggG = new THREE.Group();
    eggG.position.set(0, summitY + 2.4 + 3.6 * 1.35 * 0.75, 0);
    eggG.add(eggTop); eggG.add(eggBot);
    g.add(eggG);

    const eggLight = new THREE.PointLight(0xffd27a, 0, 90, 2);
    eggLight.position.copy(eggG.position);
    g.add(eggLight);

    const halo = makeHalo(0xffe0a0, 4, 20, 0.55);
    halo.group.position.copy(eggG.position);
    halo.group.position.y = summitY + 0.4;
    halo.group.visible = false;
    g.add(halo.group);

    const rays = makeGodRays(9, 78, 0xffd591, 0.0, 8);
    rays.group.position.set(0, summitY + 34, 0);
    g.add(rays.group);

    const burst = makeBurst(220, 0xffe2a8, 9, 1.8);
    burst.points.position.copy(eggG.position);
    g.add(burst.points);

    // ---- 石猴 — the stone monkey himself -------------------------------
    const wukong = makeWukong(4.6);
    wukong.position.set(0, summitY + 2.4, 0);
    wukong.rotation.y = Math.PI * 0.92;
    wukong.visible = false;
    // he is stone before he is flesh: start pale, warm up after the hatch
    wukong.traverse((o) => {
      if (o.isMesh && o.material && o.material.color) {
        o.userData.warmColor = o.material.color.clone();
        o.material = o.material.clone();
        o.material.color.lerp(new THREE.Color(0xa9a396), 0.85);
      }
    });
    g.add(wukong);
    const eyeBeamMat = new THREE.MeshBasicMaterial({
      color: 0xffdc7a, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
    const beams = [];
    for (const sx of [-1, 1]) {
      // Cones are centred on their own origin, so half would shoot backwards
      // through his skull. Shift the geometry to start at the eye, then parent
      // it to the head — he turns during this beat and the light must turn too.
      const beamGeo = new THREE.CylinderGeometry(0.09, 0.55, 30, 8, 1, true);
      beamGeo.translate(0, 15, 0);
      const beam = new THREE.Mesh(beamGeo, eyeBeamMat);
      beam.position.set(sx * 4.6 * 0.038, 4.6 * 0.012, 4.6 * 0.10);
      beam.rotation.x = Math.PI * 0.5 - 0.28;      // forward, tilted slightly up
      beam.visible = false;
      wukong.userData.rig.head.add(beam);
      beams.push(beam);
    }

    // ---- the tribe ------------------------------------------------------
    const monkeys = [];
    for (let i = 0; i < 24; i++) {
      const ti = i < 9 ? 4 : randi(2, 3);       // a third of them up on the summit
      const T = TERRACES[ti];
      const a = rand(0, TAU), rr = ti === 4 ? rand(8.5, 11.5) : rand(6, T.r - 4);
      const x = Math.cos(a) * rr, z = Math.sin(a) * rr;
      const m = makeMonkeySmall(rand(1.9, 2.9));
      m.position.set(x, islandY(x, z), z);
      m.userData.baseRotY = Math.atan2(-x, -z);
      m.rotation.y = m.userData.baseRotY;
      m.userData.hopBase = m.position.y;
      g.add(m);
      monkeys.push(m);
    }

    // ---- atmosphere -----------------------------------------------------
    const seaMist = makeCloudSea(22, 300, 3, { scale: 2.2, color: 0xdfe6ef, emissive: 0x2c3550, minR: 150, opacity: 0.55 });
    g.add(seaMist.group);
    const petals = makePointField(140, {
      style: 'petal', area: new THREE.Vector3(70, 42, 70), origin: new THREE.Vector3(0, 8, 0),
      rise: -2.6, drift: 3.0, sizeMin: 1.6, sizeMax: 3.6,
      colorA: 0xf7c2d4, colorB: 0xffe6ec,
    });
    g.add(petals.points);
    const motes = makePointField(150, {
      style: 'glow', area: new THREE.Vector3(60, 45, 60), origin: new THREE.Vector3(0, 10, 0),
      rise: 2.2, drift: 2.4, sizeMin: 1.2, sizeMax: 2.8,
      colorA: 0xffe1a8, colorB: 0xfff6de,
    });
    g.add(motes.points);

    this._ = {
      g, sea, falls, halo, rays, burst, eggG, eggTop, eggBot, eggMat, eggLight,
      wukong, beams, eyeBeamMat, monkeys, seaMist, petals, motes, summitY, caveGlow, cave: caveG,
    };
    return g;
  },

  update(t, dt) {
    const S = this._;
    S.sea.update(t);
    for (const f of S.falls) f.update(t);
    S.seaMist.update(t);
    S.petals.update(t);
    S.motes.update(t);

    // the stone glows harder the closer it gets to splitting
    const charge = pulse(t, 8, 25.5);
    S.eggMat.emissiveIntensity = charge * 1.9 + Math.sin(t * 3.1) * 0.12 * charge;
    S.eggLight.intensity = charge * 22;
    S.caveGlow.intensity = 4 + Math.sin(t * 1.7) * 1.2;

    // 25.5s: 石破天惊
    const crack = pulse(t, 25.5, 28.5);
    if (crack > 0) {
      const k = easeOut(crack);
      S.eggTop.position.y = k * 9.5;
      S.eggTop.rotation.z = k * 1.15;
      S.eggTop.position.x = k * 3.2;
      S.eggBot.position.y = -k * 1.2;
      S.eggBot.rotation.z = -k * 0.5;
      S.eggBot.position.x = -k * 2.6;
      S.eggMat.opacity = 1;
      S.eggG.visible = crack < 0.985;
      S.eggLight.intensity = 22 + 120 * Math.exp(-Math.pow((t - 26.0) * 1.6, 2));
      S.halo.group.visible = true;
      S.halo.update(t - 25.5, 0.55, 1 - crack * 0.35);
      S.burst.setAge(t - 25.6);
      S.rays.mat.uniforms.uOpacity.value = 0.30 * Math.exp(-Math.pow((t - 27.0) * 0.34, 2));
    } else {
      S.eggG.visible = true;
      S.rays.mat.uniforms.uOpacity.value = 0.05 * charge;
      S.burst.setAge(99);
    }
    S.rays.update(t);
    S.rays.group.rotation.y = t * 0.06;

    // the monkey rises out of the broken stone
    const born = pulse(t, 26.6, 30.0);
    if (born > 0) {
      S.wukong.visible = true;
      const k = easeOut(born);
      S.wukong.position.y = S.summitY + 2.4 + (1 - k) * -3.0;
      S.wukong.scale.setScalar(0.55 + 0.45 * k);
      // stone turns to flesh
      S.wukong.traverse((o) => {
        if (o.isMesh && o.userData.warmColor) {
          o.material.color.copy(new THREE.Color(0xa9a396)).lerp(o.userData.warmColor, k);
        }
      });
      if (t > 29.5) {
        walk(S.wukong, t, 0.0, 0);
        idle(S.wukong, t, 1);
        S.wukong.userData.rig.staff.rotation.z = Math.PI / 2 + Math.sin(t * 1.2) * 0.25;
      }
      S.wukong.rotation.y = Math.PI * 0.92 + (t - 26.6) * 0.28;
    } else {
      S.wukong.visible = false;
    }

    // 目运两道金光 — the twin beams from his eyes, once, at 31s
    const beam = Math.exp(-Math.pow((t - 32.0) * 0.55, 2));
    S.eyeBeamMat.opacity = beam * 0.6;
    for (const b of S.beams) b.visible = beam > 0.02 && S.wukong.visible;

    // the tribe: idle, then jubilant once the king is born
    const joy = pulse(t, 30, 34);
    for (let i = 0; i < S.monkeys.length; i++) {
      const m = S.monkeys[i];
      monkeyIdle(m, t);
      if (joy > 0) {
        const hop = Math.abs(Math.sin(t * 4.2 + i * 0.7));
        m.position.y = m.userData.hopBase + hop * 1.5 * joy;
        m.rotation.y = m.userData.baseRotY + Math.sin(t * 3 + i) * 0.4 * joy;
      }
    }
  },
});

})();
