
// ============================================================================
//  第四回 · 火焰山 —— 八百里火焰，芭蕉扇
//  The Flaming Mountains: eight hundred li of fire, and the palm-leaf fan.
//
//  The four pilgrims walk a road along +X. Their position is a single function
//  of time (partyX below) and everything else -- camera, fire wall, fan -- is
//  written against it, so nobody drifts out of formation.
// ============================================================================
(function () {

const FIRE_X = 22;              // where the fire crosses the road

function groundY(x, z) {
  return Math.sin(x * 0.035) * Math.cos(z * 0.03) * 2.2
       + Math.sin(x * 0.09 + z * 0.06) * 0.8
       - Math.max(0, 1 - Math.abs(z) / 16) * 1.2;      // the road is a shallow cut
}

// Where the party is at story time t. They stall at the fire, then pass.
function partyX(t) {
  if (t < 30) return lerp(-52, FIRE_X - 10, ease(clamp((t - 3) / 27, 0, 1)));
  return lerp(FIRE_X - 10, 48, ease(clamp((t - 32) / 10, 0, 1)));
}

registerChapter(4, {
  title: { num: '第 四 回', cn: '火焰山', en: 'The Flaming Mountains' },
  duration: 42,
  sky: {
    top: 0x3f1c3a,
    mid: 0xa04430,
    bot: 0xf6b45e,
    sun: 0xffd08a,
    sunDir: [0.72, 0.26, -0.64],
    sunColor: 0xffb070,
    sunI: 2.2,
    hemiSky: 0xe8a06a,
    hemiGround: 0x5a2418,
    hemiI: 1.0,
    fillColor: 0xff8a4a,
    fillI: 0.7,
    glow: 0.95,
    stars: 0,
    fog: { color: 0xc4623a, near: 60, far: 420 },
    exposure: 1.05,
    sunTargetY: 10,
    shadowRadius: 80,
  },
  captions: [
    { t: 0.5,  cn: '西行八百里，有火焰山，无春无秋，四季皆热', en: 'Eight hundred li of flame: no spring, no autumn, heat in all four seasons' },
    { t: 9.0,  cn: '师徒四人，行至山下', en: 'Master and three disciples came to the foot of it' },
    { t: 19.0, cn: '那火不是凡火，乃八卦炉中一点余星', en: 'No common fire — an ember fallen from the Eight Trigrams furnace' },
    { t: 27.0, cn: '悟空三借芭蕉扇', en: 'Wukong three times borrowed the palm-leaf fan' },
    { t: 33.0, cn: '一扇熄火，二扇生风，三扇下雨', en: 'One wave quenched the fire, two raised wind, three brought rain' },
    { t: 38.0, cn: '师徒遂过火焰山', en: 'And so they passed the Flaming Mountains' },
  ],
  cam: [
    { t: 0,  p: [-102, 15, 11], l: [8, 11, 0] },      // down the burning valley: the ridges are at |z|>20, so this corridor stays clear
    { t: 9,  p: [-56, 8, 24],   l: [-40, 4, 2] },      // down at road level with them
    { t: 18, p: [-14, 6, 22],   l: [0, 5, 0] },        // tracking alongside
    { t: 26, p: [4, 6, 20],     l: [18, 6, 0] },       // the fire wall ahead
    { t: 31, p: [10, 5, 15],    l: [22, 7, -1] },      // the fan
    { t: 36, p: [26, 7, 22],    l: [30, 5, 0] },
    { t: 42, p: [62, 30, 66],   l: [24, 12, -6] },     // out the far side
  ],
  build() {
    reseed(40711);
    const g = new THREE.Group();

    // ---- scorched ground ------------------------------------------------
    const geo = new THREE.PlaneGeometry(760, 760, 120, 120);
    geo.rotateX(-Math.PI / 2);
    const gp = geo.attributes.position;
    const cols = [];
    const cA = new THREE.Color(0x7a3520);
    const cB = new THREE.Color(0xb0603a);
    const tmp = new THREE.Color();
    for (let i = 0; i < gp.count; i++) {
      const x = gp.getX(i), z = gp.getZ(i);
      gp.setY(i, groundY(x, z));
      const heat = clamp(1 - Math.abs(z) / 90, 0, 1);
      tmp.copy(cA).lerp(cB, clamp((Math.sin(x * 0.06) * Math.cos(z * 0.05) + 1) * 0.35 + heat * 0.4, 0, 1));
      cols.push(tmp.r, tmp.g, tmp.b);
    }
    geo.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
    geo.computeVertexNormals();
    g.add(shadowed(new THREE.Mesh(geo, STD({ vertexColors: true, roughness: 1.0 })), false, true));

    // glowing cracks in the rock
    for (let i = 0; i < 30; i++) {
      const x = rand(-90, 90), z = (chance(0.5) ? 1 : -1) * rand(9, 42);
      const crackMat = new THREE.MeshBasicMaterial({
        color: 0xff7a26, transparent: true, opacity: 0.7,
        blending: THREE.AdditiveBlending, depthWrite: false });
      const crack = new THREE.Mesh(new THREE.PlaneGeometry(rand(4, 13), rand(0.5, 1.6)), crackMat);
      crack.rotation.x = -Math.PI / 2;
      crack.rotation.z = rand(0, TAU);
      crack.position.set(x, groundY(x, z) + 0.12, z);
      g.add(crack);
    }

    // ---- the burning ranges, flanking the road --------------------------
    const fires = [];
    for (let i = 0; i < 26; i++) {
      const side = i % 2 ? 1 : -1;
      const x = -92 + (i / 25) * 184 + rand(-5, 5);
      const z = side * rand(20, 62);
      const h = rand(14, 44);
      const spire = makeSpire(rand(5, 11), h, pick([0x6e2f22, 0x81402a, 0x5c2a1e]), i * 1.9, rand(-0.08, 0.08));
      spire.position.set(x, groundY(x, z) - 0.5, z);
      g.add(spire);
      if (i % 2 === 0) {
        const f = makePointField(90, {
          style: 'ember', area: new THREE.Vector3(4.5, 16, 4.5),
          origin: new THREE.Vector3(x, groundY(x, z) + h * 0.70, z),
          rise: 7.0, drift: 2.2, sizeMin: 1.5, sizeMax: 3.8,
          colorA: 0xffd166, colorB: 0xff5a12,
        });
        g.add(f.points);
        fires.push(f);
      }
    }

    // ---- the road --------------------------------------------------------
    for (let x = -120; x < 124; x += 3.6) {
      for (let k = -1; k <= 1; k++) {
        const z = k * 2.8 + rand(-0.6, 0.6);
        const st = shadowed(new THREE.Mesh(
          new THREE.CylinderGeometry(rand(1.3, 1.9), rand(1.3, 1.9), 0.3, 6),
          STD({ color: pick([0x8a5a44, 0x9a6a4e, 0x7a4c38]), roughness: 1.0 })), false, true);
        st.position.set(x + rand(-0.5, 0.5), groundY(x, z) + 0.14, z);
        st.rotation.y = rand(0, TAU);
        g.add(st);
      }
    }

    // ---- the fire that crosses the road ----------------------------------
    const wallSheet = makeWaterfall(42, 16, {
      color: 0xff8a24, opacity: 0.42, speed: -2.6,
      blending: THREE.AdditiveBlending, scale: 2.4,
    });
    wallSheet.group.rotation.y = Math.PI / 2;
    wallSheet.group.position.set(FIRE_X, 7.0, 0);
    g.add(wallSheet.group);
    const wallEmbers = makePointField(300, {
      style: 'ember', area: new THREE.Vector3(2.5, 24, 21),
      origin: new THREE.Vector3(FIRE_X, -1, 0),
      rise: 9.0, drift: 2.6, sizeMin: 0.9, sizeMax: 2.4,
      colorA: 0xffe08a, colorB: 0xff4a10,
    });
    g.add(wallEmbers.points);
    const wallLight = new THREE.PointLight(0xff7a2a, 34, 100, 2);
    wallLight.position.set(FIRE_X - 3, 8, 0);
    g.add(wallLight);

    // ---- the palm-leaf fan ------------------------------------------------
    const fan = new THREE.Group();
    const leafMat = STD({ color: 0x6fae5a, roughness: 0.85, side: THREE.DoubleSide,
      emissive: 0x143f14, emissiveIntensity: 0.3 });
    const leaf = shadowed(new THREE.Mesh(
      new THREE.CircleGeometry(5.4, 24, Math.PI * 0.14, Math.PI * 1.72), leafMat));
    fan.add(leaf);
    for (let i = 0; i < 9; i++) {
      const rib = shadowed(new THREE.Mesh(new THREE.BoxGeometry(0.18, 5.0, 0.18),
        STD({ color: 0x3f6b34, roughness: 0.9 })));
      const a = -0.8 + (i / 8) * 1.6;
      rib.position.set(Math.sin(a) * 2.5, Math.cos(a) * 2.5, 0.1);
      rib.rotation.z = -a;
      fan.add(rib);
    }
    const handle = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.3, 4.2, 8),
      STD({ color: 0x6b4a26, roughness: 0.9 })));
    handle.position.y = -3.2;
    fan.add(handle);
    fan.visible = false;
    g.add(fan);

    const gust = makePointField(180, {
      style: 'snow', area: new THREE.Vector3(24, 13, 15),
      origin: new THREE.Vector3(FIRE_X - 5, 1, 0),
      rise: 3.0, drift: 6.0, sizeMin: 0.7, sizeMax: 1.6,
      colorA: 0xdff0ff, colorB: 0xa8d8f0,
    });
    gust.setFade(0);
    g.add(gust.points);

    // ---- 师徒四人 ---------------------------------------------------------
    const wukong = makeWukong(4.4);
    const tang = makeTang(4.2);
    const bajie = makeBajie(4.0);
    const wujing = makeWujing(4.3);
    const horse = makeHorse(1.2);
    for (const a of [wukong, tang, bajie, wujing, horse]) g.add(a);

    const ash = makePointField(220, {
      style: 'ember', area: new THREE.Vector3(110, 34, 70), origin: new THREE.Vector3(0, 0, 0),
      rise: 4.6, drift: 4.0, sizeMin: 0.6, sizeMax: 1.7,
      colorA: 0xffc06a, colorB: 0xd8481a,
    });
    g.add(ash.points);

    this._ = {
      g, fires, wallSheet, wallEmbers, wallLight, fan, gust, ash,
      wukong, tang, bajie, wujing, horse,
    };
    return g;
  },

  update(t, dt) {
    const S = this._;
    for (const f of S.fires) f.update(t);
    S.wallSheet.update(t);
    S.wallEmbers.update(t);
    S.gust.update(t);
    S.ash.update(t);

    // ---- the party walks the road ---------------------------------------
    const x = partyX(t);
    const moving = (t > 3 && t < 29.5) || t > 32;
    const spd = moving ? 1.0 : 0;

    // Wukong scouts ahead; the horse carries the master; the other two trail.
    const place = (actor, dx, dz, faceAhead) => {
      const ax = x + dx, az = dz;
      actor.position.set(ax, groundY(ax, az), az);
      actor.rotation.y = faceAhead ? Math.PI / 2 : Math.PI / 2;
    };
    place(S.wukong, 7.5, -0.5);
    place(S.horse, 0, 1.6);
    place(S.tang, -1.8, -1.8);
    place(S.bajie, -6.5, 2.6);
    place(S.wujing, -9.5, -1.4);
    walk(S.wukong, t, spd * 1.2, 1);
    walk(S.bajie, t + 0.7, spd * 1.0, 0.9);
    walk(S.wujing, t + 1.4, spd * 1.05, 0.95);
    horseWalk(S.horse, t, spd, 1);

    walk(S.tang, t + 0.3, spd * 0.95, 1);

    // ---- the fire wall, and the fan that puts it out ---------------------
    // 一扇熄火，二扇生风，三扇下雨 — three waves, and the road opens.
    const wave1 = pulse(t, 30.0, 31.2);
    const wave2 = pulse(t, 31.6, 32.6);
    const wave3 = pulse(t, 33.0, 34.2);
    const quench = clamp(wave1 * 0.45 + wave2 * 0.3 + wave3 * 0.25, 0, 1);

    S.wallSheet.group.scale.y = Math.max(0.02, 1 - quench);
    S.wallSheet.group.position.y = 7.0 * Math.max(0.02, 1 - quench);
    S.wallEmbers.setFade(1 - quench);
    S.wallLight.intensity = 34 * (1 - quench) * (0.85 + 0.15 * Math.sin(t * 9));
    for (const f of S.fires) f.setFade(1 - quench * 0.65);
    S.ash.setFade(1 - quench * 0.5);

    // the fan sweeps in from Wukong's side of the road
    const fanIn = pulse(t, 28.6, 30.0);
    const fanOut = pulse(t, 34.4, 35.6);
    S.fan.visible = fanIn > 0.01 && fanOut < 0.99;
    if (S.fan.visible) {
      const swing = Math.sin(t * 5.5) * 0.55;
      S.fan.position.set(
        x + lerp(6.0, 9.2, ease(fanIn)),
        lerp(12, 6.0, ease(fanIn)) + Math.sin(t * 2.2) * 0.25,
        lerp(-5.5, -1.4, ease(fanIn)));
      S.fan.rotation.set(0, Math.PI * 0.5 + swing * 0.5, swing);
      S.fan.scale.setScalar(lerp(0.4, 1, ease(fanIn)) * (1 - fanOut));
    }
    S.gust.setFade(Math.max(wave1, Math.max(wave2, wave3)) * (1 - pulse(t, 34.4, 35.4)) * 0.5);

    // Wukong faces the fire and holds the fan up while the waves land
    if (t > 27 && t < 35.5) {
      S.wukong.userData.rig.armR.root.rotation.x = -2.0 + Math.sin(t * 5.5) * 0.35;
      S.wukong.userData.rig.staff.rotation.z = Math.PI / 2 + Math.sin(t * 5.5) * 0.5;
    }
  },
});

})();
