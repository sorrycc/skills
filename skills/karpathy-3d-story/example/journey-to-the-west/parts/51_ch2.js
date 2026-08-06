
// ============================================================================
//  第二回 · 大闹天宫 —— 南天门 · 蟠桃园 · 凌霄殿
//  Havoc in Heaven. Gold and cinnabar on a floor of cloud.
//
//  Everything stands on a jade terrace at y = 0 with the cloud sea below it, so
//  "the ground" is again one number rather than a surface to guess at.
// ============================================================================
(function () {

const DECK_Y = 0;
const DECK_R = 46;

registerChapter(2, {
  title: { num: '第 二 回', cn: '大闹天宫', en: 'Havoc in the Palace of Heaven' },
  duration: 46,
  sky: {
    top: 0x2f4f96, mid: 0x9fb6e2, bot: 0xf6e2b4, sun: 0xfff0c8,
    sunDir: [0.35, 0.52, -0.78], sunColor: 0xfff2d2, sunI: 2.7,
    hemiSky: 0xd8e4ff, hemiGround: 0x8a7a52, hemiI: 1.15,
    fillColor: 0xffd9a0, fillI: 0.6,
    glow: 1.1, stars: 0,
    fog: { color: 0xd8e2f4, near: 120, far: 700 },
    exposure: 1.08, sunTargetY: 12, shadowRadius: 90,
  },
  captions: [
    { t: 0.5,  cn: '云宫琼阁，天上一日，世上千年', en: 'A day in the cloud palace is a thousand years below' },
    { t: 9.0,  cn: '官封弼马，心何足；名注齐天，意未宁', en: 'Made a stablemaster, he would not rest' },
    { t: 17.0, cn: '偷吃蟠桃，搅乱蟠桃盛会', en: 'He ate the immortal peaches and wrecked the feast' },
    { t: 26.0, cn: '十万天兵天将，围之不住', en: 'A hundred thousand celestial troops could not hold him' },
    { t: 36.0, cn: '「齐天大圣」——闹得天宫无宁日', en: 'Great Sage Equal to Heaven' },
  ],
  cam: [
    { t: 0,  p: [0, -22, 58],   l: [0, 4, -12] },    // rising out of the cloud sea
    { t: 9,  p: [3, 3, 24],     l: [0, 15, -34] },   // looking up at the gate of heaven
    { t: 17, p: [45, 8, 24],    l: [34, 4.5, 9] },   // the peach garden
    { t: 25, p: [15, 6, 19],    l: [0, 4, 6] },      // the ranks close in
    { t: 31, p: [-9, 5, 16],    l: [0, 5, 6] },      // the cudgel swings
    { t: 37, p: [-7, 13, 29],   l: [0, 8, 0] },
    { t: 46, p: [-27, 36, 78],  l: [0, 10, -18] },   // pull back over the ruin
  ],
  build() {
    reseed(20482);
    const g = new THREE.Group();

    // ---- cloud floor ---------------------------------------------------
    const seaLow = makeCloudSea(46, 340, -16, { scale: 2.6, color: 0xf6f4ee, emissive: 0x5a6ea8, minR: 40 });
    g.add(seaLow.group);
    const seaFar = makeCloudSea(26, 620, -34, { scale: 5.0, color: 0xeef0f6, emissive: 0x4a5c92, minR: 330, opacity: 0.75 });
    g.add(seaFar.group);

    // ---- the jade terrace ----------------------------------------------
    const deck = shadowed(new THREE.Mesh(
      new THREE.CylinderGeometry(DECK_R, DECK_R * 0.94, 3.0, 56),
      STD({ color: 0xe4e0d2, roughness: 0.65, metalness: 0.06 })));
    deck.position.y = DECK_Y - 1.5;
    g.add(deck);
    const inlay = new THREE.Mesh(
      new THREE.RingGeometry(DECK_R * 0.52, DECK_R * 0.60, 56),
      STD({ color: C.darkGold, roughness: 0.4, metalness: 0.6, side: THREE.DoubleSide }));
    inlay.rotation.x = -Math.PI / 2;
    inlay.position.y = DECK_Y + 0.03;
    g.add(inlay);
    // balustrade: posts plus one continuous ring, not 56 loose crossbars
    for (let i = 0; i < 40; i++) {
      const a = (i / 40) * TAU;
      if (a > Math.PI * 0.80 && a < Math.PI * 1.20) continue;    // opening toward the gate
      const post = shadowed(new THREE.Mesh(new THREE.BoxGeometry(0.5, 2.4, 0.5),
        STD({ color: 0xf0ece0, roughness: 0.8 })));
      post.position.set(Math.cos(a) * (DECK_R - 1.2), DECK_Y + 1.2, Math.sin(a) * (DECK_R - 1.2));
      post.rotation.y = -a;
      g.add(post);
    }
    const rail = shadowed(new THREE.Mesh(
      new THREE.TorusGeometry(DECK_R - 1.2, 0.22, 6, 72, Math.PI * 1.6),
      STD({ color: 0xf0ece0, roughness: 0.8 })));
    rail.rotation.x = Math.PI / 2;
    rail.rotation.z = -Math.PI * 0.30;
    rail.position.y = DECK_Y + 2.2;
    g.add(rail);

    // ---- 南天门 — the South Gate of Heaven -----------------------------
    const gate = new THREE.Group();
    gate.position.set(0, DECK_Y, -34);
    for (const sx of [-1, 1]) {
      const tower = new THREE.Group();
      tower.position.x = sx * 11;
      const base = shadowed(new THREE.Mesh(new THREE.BoxGeometry(9, 3, 9),
        STD({ color: 0xe8e2d2, roughness: 0.85 })));
      base.position.y = 1.5;
      tower.add(base);
      for (const px of [-1, 1]) for (const pz of [-1, 1]) {
        const p = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.78, 11, 10),
          STD({ color: C.cinnabar, roughness: 0.55 })));
        p.position.set(px * 3.2, 8.5, pz * 3.2);
        tower.add(p);
      }
      const lintel = shadowed(new THREE.Mesh(new THREE.BoxGeometry(9.4, 1.5, 9.4),
        STD({ color: C.darkGold, roughness: 0.4, metalness: 0.5 })));
      lintel.position.y = 14.6;
      tower.add(lintel);
      const roof = makeRoof(12, 12, 6.5, {});
      roof.position.y = 15.4;
      tower.add(roof);
      gate.add(tower);
    }
    // the span over the road, and its plaque
    const span = shadowed(new THREE.Mesh(new THREE.BoxGeometry(23, 2.2, 5),
      STD({ color: C.darkGold, roughness: 0.4, metalness: 0.55 })));
    span.position.y = 15.8;
    gate.add(span);
    const plaque = shadowed(new THREE.Mesh(new THREE.BoxGeometry(7.6, 3.0, 0.6),
      STD({ color: 0x2b2f3a, roughness: 0.6 })));
    plaque.position.set(0, 18.6, 2.6);
    gate.add(plaque);
    for (let i = 0; i < 3; i++) {
      const glyph = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.28, 0.12),
        STD({ color: C.gold, metalness: 0.7, roughness: 0.3, emissive: 0x2a2004, emissiveIntensity: 0.7 }));
      glyph.position.set((i - 1) * 2.1, 18.6, 2.95);
      gate.add(glyph);
    }
    const spanRoof = makeRoof(26, 8, 6.0, {});
    spanRoof.position.y = 17.0;
    gate.add(spanRoof);
    g.add(gate);

    // ---- 凌霄殿 — the throne hall, further back and higher --------------
    const hallPlat = shadowed(new THREE.Mesh(
      new THREE.CylinderGeometry(30, 33, 8, 40),
      STD({ color: 0xe6e0cf, roughness: 0.8 })));
    hallPlat.position.set(0, DECK_Y + 4, -86);
    g.add(hallPlat);
    const hall = makeHall(24, 17, { pillarH: 9, roofH: 7, tiers: 2, nx: 5, nz: 4 });
    hall.position.set(0, DECK_Y + 8, -86);
    g.add(hall);
    const hallStairs = makeStairs(14, 16, 0.6, 1.5);
    hallStairs.position.set(0, DECK_Y, -66);
    hallStairs.rotation.y = Math.PI;
    g.add(hallStairs);
    // side pavilions floating on their own cloud islets
    for (const sx of [-1, 1]) {
      const pav = makeHall(10, 8, { pillarH: 5.5, roofH: 4, nx: 3, nz: 3 });
      pav.position.set(sx * 48, DECK_Y + 10, -58);
      g.add(pav);
      const isle = makeCloudPuff(7, 0xf2f0e8, 0x4a5a90);
      isle.position.set(sx * 48, DECK_Y + 7, -58);
      g.add(isle);
    }

    // ---- 蟠桃园 — the peach garden on the east side --------------------
    const orchard = new THREE.Group();
    orchard.position.set(30, DECK_Y, 2);
    const peachDeck = shadowed(new THREE.Mesh(
      new THREE.CylinderGeometry(15, 16, 1.6, 28),
      STD({ color: 0xd9e6c8, roughness: 0.95 })));
    peachDeck.position.y = 0.4;
    orchard.add(peachDeck);
    const peaches = [];
    for (let i = 0; i < 8; i++) {
      const a = -1.9 + (i / 7) * 4.6, rr = rand(6, 12);   // arc, open toward the camera
      const tree = makeTreeSimple(rand(1.05, 1.5), 0x6b4a2a, 0x3f7f3c, true);
      tree.position.set(Math.cos(a) * rr, 1.2, Math.sin(a) * rr);
      orchard.add(tree);
      for (let k = 0; k < 4; k++) {
        const peach = shadowed(new THREE.Mesh(new THREE.SphereGeometry(0.42, 9, 8),
          STD({ color: 0xf2b3a0, roughness: 0.7, emissive: 0x3a1410, emissiveIntensity: 0.35 })));
        const c = tree.userData.canopy[randi(0, 2)];
        peach.position.copy(tree.position).add(c.position)
          .add(new THREE.Vector3(rand(-1.3, 1.3), rand(-1.1, 0.2), rand(-1.3, 1.3)));
        orchard.add(peach);
        peaches.push(peach);
      }
    }
    // a table of the wrecked feast
    for (let i = 0; i < 3; i++) {
      const tbl = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(1.9, 1.9, 0.24, 14),
        STD({ color: C.cinnabar, roughness: 0.6 })));
      tbl.position.set(rand(-9, 9), 2.3, rand(-9, 9));
      tbl.rotation.set(rand(0.9, 1.5), rand(0, 3), rand(-0.4, 0.4));   // overturned
      orchard.add(tbl);
      for (let L = 0; L < 3; L++) {
        const leg = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 1.5, 6),
          STD({ color: 0x7a3a24, roughness: 0.8 })));
        const la = (L / 3) * TAU;
        leg.position.set(Math.cos(la) * 1.3, 0.85, Math.sin(la) * 1.3);
        tbl.add(leg);
      }
      for (let k = 0; k < 3; k++) {
        const bowl = shadowed(new THREE.Mesh(new THREE.SphereGeometry(0.4, 9, 6, 0, TAU, 0, Math.PI / 2),
          STD({ color: C.gold, metalness: 0.8, roughness: 0.3 })));
        bowl.position.set(tbl.position.x + rand(-2.5, 2.5), 1.6, tbl.position.z + rand(-2.5, 2.5));
        bowl.rotation.z = rand(-2, 2);
        orchard.add(bowl);
      }
    }
    g.add(orchard);

    // ---- banners along the terrace -------------------------------------
    const banners = [];
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI * 0.42 + (i / 9) * Math.PI * 1.84;
      const pole = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.26, 13, 8),
        STD({ color: 0x6b4b28, roughness: 0.8 })));
      const px = Math.cos(a) * (DECK_R - 6), pz = Math.sin(a) * (DECK_R - 6);
      pole.position.set(px, DECK_Y + 6.5, pz);
      g.add(pole);
      const ban = makeBanner(3.0, 7.0, pick([C.cinnabar, C.imperialY, 0x2f5aa8]));
      ban.position.set(px, DECK_Y + 12.4, pz);
      ban.rotation.y = -a;
      g.add(ban);
      banners.push(ban);
    }

    // ---- 齐天大圣 and the celestial ranks -------------------------------
    const wukong = makeWukong(4.6);
    wukong.position.set(0, DECK_Y, 6);
    g.add(wukong);
    const staffPivot = wukong.userData.rig.staff;

    const cloudUnder = makeCloudPuff(2.2, 0xfaf8f0, 0x6a7ab0);
    cloudUnder.position.set(0, DECK_Y + 0.4, 6);
    cloudUnder.visible = false;
    g.add(cloudUnder);

    const soldiers = [];
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * TAU;
      const s = makeSoldier(3.6, i % 2 ? C.cinnabar : 0x2f5aa8);
      const r0 = rand(15, 23);
      s.position.set(Math.cos(a) * r0, DECK_Y, 6 + Math.sin(a) * r0);
      s.rotation.y = Math.atan2(-Math.cos(a), -Math.sin(a));
      g.add(s);
      soldiers.push({ s, a, r0, phase: rand(0, TAU), tumble: new THREE.Vector3(rand(-1, 1), rand(0.4, 1), rand(-1, 1)) });
    }

    // what the routed ranks left behind — an empty terrace reads as "nothing
    // happened here", which is the opposite of the point of this chapter
    const debris = [];
    for (let i = 0; i < 16; i++) {
      const a = rand(0, TAU), rr = rand(11, 34);
      const px = Math.cos(a) * rr, pz = 6 + Math.sin(a) * rr;
      if (chance(0.55)) {
        const spear = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, rand(4, 5.4), 6),
          STD({ color: 0x5d4326, roughness: 0.85 })));
        spear.position.set(px, DECK_Y + 0.12, pz);
        spear.rotation.set(Math.PI / 2, 0, rand(0, TAU));
        g.add(spear);
        debris.push(spear);
      } else {
        const helm = shadowed(new THREE.Mesh(new THREE.ConeGeometry(0.62, 0.78, 9),
          STD({ color: C.darkGold, metalness: 0.8, roughness: 0.35 })));
        helm.position.set(px, DECK_Y + 0.3, pz);
        helm.rotation.set(rand(1.2, 2.0), rand(0, TAU), rand(-0.5, 0.5));
        g.add(helm);
        debris.push(helm);
      }
    }

    const bursts = [];
    for (let i = 0; i < 3; i++) {
      const b = makeBurst(180, 0xffe9a8, 12, 1.6);
      b.points.position.set(0, DECK_Y + 3, 6);
      g.add(b.points);
      bursts.push(b);
    }
    const shock = makeHalo(0xfff0bc, 3, 26, 0.42);
    shock.group.position.set(0, DECK_Y + 0.6, 6);
    shock.group.visible = false;
    g.add(shock.group);

    const sparks = makePointField(150, {
      style: 'ember', area: new THREE.Vector3(40, 26, 40), origin: new THREE.Vector3(0, DECK_Y, 4),
      rise: 5.5, drift: 3.0, sizeMin: 0.9, sizeMax: 2.1,
      colorA: 0xffe9a8, colorB: 0xffb03a,
    });
    g.add(sparks.points);

    const drift = makePointField(70, {
      style: 'petal', area: new THREE.Vector3(70, 40, 70), origin: new THREE.Vector3(0, DECK_Y - 4, 0),
      rise: -1.8, drift: 2.6, sizeMin: 1.1, sizeMax: 2.2,
      colorA: 0xffd9e2, colorB: 0xfff3d0,
    });
    drift.setFade(0.5);
    g.add(drift.points);

    this._ = { g, seaLow, seaFar, wukong, staffPivot, soldiers, bursts, shock, sparks, drift, banners, peaches, cloudUnder, debris };
    return g;
  },

  update(t, dt) {
    const S = this._;
    S.seaLow.update(t);
    S.seaFar.update(t);
    S.sparks.update(t);
    S.drift.update(t);
    for (const b of S.banners) b.rotation.z = Math.sin(t * 1.4 + b.position.x) * 0.06;
    // the wreckage only exists once the ranks have actually been broken
    for (const d of S.debris) d.visible = t > 30.2;

    const rig = S.wukong.userData.rig;

    // --- beat 1: he is in the orchard, helping himself to the peaches ---
    if (t < 21) {
      // stands at the near edge of the orchard, in the open, reaching for fruit
      S.wukong.position.set(34.5, 0, 9.5);
      S.wukong.rotation.y = 2.5 + Math.sin(t * 0.5) * 0.25;
      idle(S.wukong, t, 0.8);
      rig.staff.rotation.z = Math.PI / 2 + Math.sin(t * 0.8) * 0.15;
      rig.armL.root.rotation.x = -1.9 + Math.sin(t * 2.2) * 0.45;   // reaching up for fruit
      rig.armL.lower.rotation.x = -0.5;
      S.shock.group.visible = false;
      for (const b of S.bursts) b.setAge(99);
    } else {
      // --- beat 2: he plants himself on the terrace and the ranks close in
      const k = pulse(t, 21, 24);
      S.wukong.position.set(lerp(30, 0, ease(k)), 0, lerp(2, 6, ease(k)));
      S.wukong.rotation.y = lerp(t * 0.4 + Math.PI, 0.3, ease(k));
      if (t < 26) {
        walk(S.wukong, t, 1.3, 1.0);
      } else {
        // the cudgel: spun overhead, growing as it goes
        idle(S.wukong, t, 0.6);
        const spin = (t - 26) * 7.5;
        rig.armR.root.rotation.x = -2.1;
        rig.armR.lower.rotation.x = 0.2;
        rig.staff.rotation.z = spin;
        rig.staff.rotation.y = Math.sin(spin * 0.5) * 0.4;
        const grow = 1 + pulse(t, 30, 36) * 3.4;
        rig.staff.scale.y = grow;
        rig.lockArmR = true;
      }
    }

    // --- the celestial ranks: charge, then get swept off the terrace -----
    const impact = 29.5;
    for (let i = 0; i < S.soldiers.length; i++) {
      const d = S.soldiers[i];
      if (t < impact) {
        const close = pulse(t, 24, impact);
        const r = lerp(d.r0, 9.5, ease(close));
        d.s.position.set(Math.cos(d.a) * r, 0, 6 + Math.sin(d.a) * r);
        d.s.rotation.set(0, Math.atan2(-Math.cos(d.a), -Math.sin(d.a)), 0);
        walk(d.s, t + d.phase, close > 0.02 ? 1.5 : 0.0, close > 0.02 ? 1.0 : 0.0);
        if (close < 0.02) idle(d.s, t + d.phase, 0.7);
      } else {
        // blown outward and tumbling — and then genuinely gone, not stuck
        // hovering at the terrace edge
        const k = Math.min((t - impact) * 0.55, 3.2);
        const r = 9.5 + k * 26;
        d.s.position.set(
          Math.cos(d.a) * r,
          Math.max(-70, 6 * Math.sin(Math.min(k, 1.6) * 1.9) - k * k * 3.4),
          6 + Math.sin(d.a) * r);
        d.s.rotation.set(
          d.tumble.x * k * 2.4,
          Math.atan2(-Math.cos(d.a), -Math.sin(d.a)) + d.tumble.y * k * 2.0,
          d.tumble.z * k * 2.6);
        walk(d.s, t + d.phase, 0.6, 0.4);
      }
    }

    // --- impact flash -----------------------------------------------------
    if (t >= impact - 0.2) {
      S.shock.group.visible = true;
      S.shock.update(t - impact, 0.5, Math.exp(-(t - impact) * 0.5));
      for (let i = 0; i < S.bursts.length; i++) S.bursts[i].setAge(t - impact - i * 0.28);
    }
    S.sparks.setFade(0.25 + 0.75 * pulse(t, 26, 30));

    // the peaches he did not eat sway; the ones he did are long gone
    for (let i = 0; i < S.peaches.length; i++) {
      S.peaches[i].visible = !(t > 14 && i % 3 === 0);
    }
  },
});

})();
