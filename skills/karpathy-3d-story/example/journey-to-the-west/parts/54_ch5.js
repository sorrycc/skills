
// ============================================================================
//  第五回 · 灵山取经 —— 雷音寺 · 佛光 · 真经
//  Vulture Peak: the Thunderclap Monastery above the cloud sea, and the scrolls.
//
//  The climb is one long stair up the +Z axis. stairY() below is the single
//  source of truth for how high the steps are at a given z, and the pilgrims,
//  the camera targets and the terrace all read from it.
// ============================================================================
(function () {

const STAIR_Z0 = 118;      // foot of the stair, where it leaves the cloud
const STAIR_Z1 = 66;       // top of the stair, at the lip of the terrace
const TERRACE_Y = 34;      // height of the temple terrace
const SLOPE = TERRACE_Y / (STAIR_Z0 - STAIR_Z1);

// The mountain is a cone whose flank has exactly this slope, so the steps lie
// ON the rock instead of hovering over it or tunnelling through it.
function stairY(z) {
  return clamp((STAIR_Z0 - z) * SLOPE, 0, TERRACE_Y);
}

// Where the party is on the climb at story time t.
function partyZ(t) {
  return lerp(STAIR_Z0 - 4, 27, ease(clamp((t - 5) / 22, 0, 1)));
}

registerChapter(5, {
  title: { num: '第 五 回', cn: '灵山取经', en: 'The Scriptures at Vulture Peak' },
  duration: 44,
  sky: {
    top: 0x3f6fb8,
    mid: 0xbcd2f0,
    bot: 0xfff0cc,
    sun: 0xfff6dc,
    sunDir: [-0.28, 0.56, 0.78],
    sunColor: 0xfff4d8,
    sunI: 2.6,
    hemiSky: 0xe8f0ff,
    hemiGround: 0xbfae86,
    hemiI: 1.25,
    fillColor: 0xffe8bc,
    fillI: 0.65,
    glow: 1.0,
    stars: 0,
    fog: { color: 0xe4ecf8, near: 140, far: 800 },
    exposure: 1.12,
    sunTargetY: 30,
    shadowRadius: 110,
  },
  captions: [
    { t: 0.5,  cn: '灵山在望，云海之上', en: 'Vulture Peak, above the sea of cloud' },
    { t: 8.0,  cn: '十四年，一十万八千里', en: 'Fourteen years, one hundred and eight thousand li' },
    { t: 17.0, cn: '登上灵山，见大雷音寺', en: 'They climbed to the Thunderclap Monastery' },
    { t: 26.0, cn: '如来赐经三十五部，五千零四十八卷', en: 'The Buddha granted them the scriptures' },
    { t: 34.0, cn: '功成行满见真如，九九归真', en: 'The work complete, the journey whole' },
    { t: 40.0, cn: '西游记 · 终', en: 'Journey to the West — end' },
  ],
  cam: [
    { t: 0,  p: [-40, 22, 190], l: [0, 40, 40] },
    { t: 8,  p: [-16, 12, 150], l: [0, 26, 60] },
    { t: 17, p: [26, 20, 108], l: [0, 34, 46] },
    { t: 26, p: [15, 44, 78],  l: [0, 42, 30] },
    { t: 33, p: [-11, 41, 62], l: [0, 41, 22] },
    { t: 39, p: [-24, 46, 78], l: [0, 43, 14] },
    { t: 44, p: [-46, 68, 132], l: [0, 44, 10] },
  ],
  build() {
    reseed(50823);
    const g = new THREE.Group();

    // ---- the cloud sea the peak stands in --------------------------------
    const sea = makeCloudSea(60, 420, -8, { scale: 3.2, color: 0xf8f6f0, emissive: 0x6a80b8, minR: 60 });
    g.add(sea.group);
    const seaFar = makeCloudSea(30, 780, -24, { scale: 6.0, color: 0xeef2fa, emissive: 0x5a72aa, minR: 420, opacity: 0.8 });
    g.add(seaFar.group);

    // ---- the peak ---------------------------------------------------------
    // A truncated cone, not a dome: a dome tall enough to read as a mountain
    // closes over the terrace and the camera both.
    // 0.8 below the terrace: coplanar tops z-fight into radial streaks
    const peakGeo = new THREE.CylinderGeometry(STAIR_Z1, STAIR_Z0, TERRACE_Y - 0.8, 40, 3);
    {
      const pp = peakGeo.attributes.position;
      for (let i = 0; i < pp.count; i++) {
        const x = pp.getX(i), y = pp.getY(i), z = pp.getZ(i);
        if (y > (TERRACE_Y - 0.8) / 2 - 0.01) continue;              // keep the summit flat
        const a = Math.atan2(z, x);
        const n = 1 + Math.sin(a * 7) * 0.035 + Math.sin(a * 15 + y * 0.2) * 0.02;
        pp.setXYZ(i, x * n, y, z * n);
      }
      peakGeo.computeVertexNormals();
    }
    const peak = shadowed(new THREE.Mesh(peakGeo,
      STD({ color: 0xbeae8e, roughness: 1.0, flatShading: true })));
    peak.position.y = (TERRACE_Y - 0.8) / 2;
    g.add(peak);
    // the bulk below, disappearing into the cloud
    const skirt = shadowed(new THREE.Mesh(
      new THREE.CylinderGeometry(STAIR_Z0, STAIR_Z0 + 40, 44, 40, 1),
      STD({ color: 0x9c8f74, roughness: 1.0, flatShading: true })));
    skirt.position.y = -22;
    g.add(skirt);
    // crags on the flanks, kept off the stair
    for (let i = 0; i < 11; i++) {
      const a = rand(Math.PI * 0.30, Math.PI * 1.70);
      const rr = rand(52, 92);
      const sp = makeSpire(rand(6, 13), rand(22, 50), 0xa8987c, i * 2.2, rand(-0.06, 0.06));
      sp.position.set(Math.sin(a) * rr, stairY(rr) - 2, Math.cos(a) * rr);
      g.add(sp);
    }

    // ---- the terrace, and the stair up to it ----------------------------
    const terrace = shadowed(new THREE.Mesh(
      new THREE.CylinderGeometry(50, 52, 3.0, 44),
      STD({ color: 0xe8e0cc, roughness: 0.8 })));
    terrace.position.set(0, TERRACE_Y - 1.5, 0);
    g.add(terrace);

    const STEPS = 40;
    const flight = makeStairs(STEPS, 20, TERRACE_Y / STEPS, (STAIR_Z0 - STAIR_Z1) / STEPS, 0xdcd4bf);
    flight.position.set(0, 0, STAIR_Z1);
    flight.rotation.y = Math.PI;
    g.add(flight);

    // lotus lamps up both sides of the stair
    for (let i = 0; i < 12; i++) {
      const z = lerp(STAIR_Z0 - 4, STAIR_Z1 + 4, i / 11);
      for (const sx of [-1, 1]) {
        const post = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.28, 3.6, 8),
          STD({ color: 0xc9bfa4, roughness: 0.9 })));
        post.position.set(sx * 13, stairY(z) + 1.8, z);
        g.add(post);
        const bud = new THREE.Mesh(new THREE.SphereGeometry(0.5, 10, 8),
          STD({ color: 0xffd98a, emissive: 0xffb445, emissiveIntensity: 1.5, roughness: 0.5 }));
        bud.position.set(sx * 13, stairY(z) + 4.0, z);
        g.add(bud);
      }
    }

    // ---- 大雷音寺 — the Thunderclap Monastery ---------------------------
    const temple = makeHall(30, 22, { pillarH: 11, roofH: 8.5, tiers: 2, nx: 6, nz: 4 });
    temple.position.set(0, TERRACE_Y, -14);
    g.add(temple);
    for (const sx of [-1, 1]) {
      const pagoda = new THREE.Group();
      for (let i = 0; i < 5; i++) {
        const w = 7 - i * 0.95;
        const drum = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(w * 0.42, w * 0.46, 3.2, 12),
          STD({ color: 0xf0e6cc, roughness: 0.85 })));
        drum.position.y = 2 + i * 5.4;
        pagoda.add(drum);
        const rf = makeRoof(w, w, 2.6, {});
        rf.position.y = 3.6 + i * 5.4;
        pagoda.add(rf);
      }
      pagoda.position.set(sx * 30, TERRACE_Y, 6);
      g.add(pagoda);
    }

    // ---- the lotus seat and the seated Buddha ---------------------------
    const lotus = new THREE.Group();
    lotus.position.set(0, TERRACE_Y + 1, 6);
    const pod = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(5.4, 3.4, 2.2, 20),
      STD({ color: 0xf2e2c4, roughness: 0.8 })));
    pod.position.y = 1.1;
    lotus.add(pod);
    for (let ring = 0; ring < 2; ring++) {
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * TAU + ring * 0.26;
        const petal = shadowed(new THREE.Mesh(new THREE.SphereGeometry(1.5, 8, 6),
          STD({ color: ring ? 0xf7d9e2 : 0xfbeaf0, roughness: 0.7 })));
        petal.position.set(Math.cos(a) * (5.0 - ring * 1.3), 1.4 + ring * 0.9, Math.sin(a) * (5.0 - ring * 1.3));
        petal.scale.set(0.7, 0.45, 1.25);
        petal.rotation.y = -a;
        lotus.add(petal);
      }
    }
    const buddha = new THREE.Group();
    buddha.position.y = 2.4;
    const bodyMat = STD({ color: 0xe8c069, metalness: 0.65, roughness: 0.35,
      emissive: 0x4a3208, emissiveIntensity: 0.45 });
    const torso = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(2.4, 3.6, 5.0, 16), bodyMat));
    torso.position.y = 2.6;
    buddha.add(torso);
    const shoulders = shadowed(new THREE.Mesh(new THREE.SphereGeometry(2.7, 14, 10), bodyMat));
    shoulders.position.y = 5.0;
    shoulders.scale.set(1.15, 0.7, 0.9);
    buddha.add(shoulders);
    const bhead = shadowed(new THREE.Mesh(new THREE.SphereGeometry(1.5, 14, 12), bodyMat));
    bhead.position.y = 7.0;
    buddha.add(bhead);
    const ushnisha = shadowed(new THREE.Mesh(new THREE.SphereGeometry(0.8, 10, 8), bodyMat));
    ushnisha.position.y = 8.2;
    buddha.add(ushnisha);
    for (const sx of [-1, 1]) {
      const arm = shadowed(new THREE.Mesh(new THREE.CapsuleGeometry(0.75, 3.0, 4, 8), bodyMat));
      arm.position.set(sx * 2.6, 3.4, 0.6);
      arm.rotation.set(0.5, 0, sx * 0.5);
      buddha.add(arm);
      const knee = shadowed(new THREE.Mesh(new THREE.SphereGeometry(1.7, 10, 8), bodyMat));
      knee.position.set(sx * 2.4, 0.9, 1.2);
      knee.scale.set(1.1, 0.6, 1.2);
      buddha.add(knee);
    }
    lotus.add(buddha);
    g.add(lotus);

    // ---- 佛光 — the halo, the rays, the falling petals ------------------
    const haloMat = STD({ color: 0xffe6a0, roughness: 0.4, metalness: 0.5 });
    haloMat.emissive = new THREE.Color(0xffc65a);
    haloMat.emissiveIntensity = 1.6;
    const haloRing = shadowed(new THREE.Mesh(new THREE.TorusGeometry(5.2, 0.45, 10, 40), haloMat));
    haloRing.position.set(0, TERRACE_Y + 10.4, 4.4);
    g.add(haloRing);

    const rays = makeGodRays(30, 96, 0xffe9b4, 0.085, 13);
    rays.group.position.set(0, TERRACE_Y + 34, 4);
    g.add(rays.group);

    const bloom = makeHalo(0xfff0c8, 4, 34, 0.34);
    bloom.group.position.set(0, TERRACE_Y + 1.2, 6);
    g.add(bloom.group);

    const buddhaLight = new THREE.PointLight(0xffd88a, 45, 120, 2);
    buddhaLight.position.set(0, TERRACE_Y + 9, 10);
    g.add(buddhaLight);

    const petals = makePointField(300, {
      style: 'petal', area: new THREE.Vector3(60, 46, 60),
      origin: new THREE.Vector3(0, TERRACE_Y - 4, 6),
      rise: -2.4, drift: 3.2, sizeMin: 1.0, sizeMax: 2.4,
      colorA: 0xffd9e6, colorB: 0xfff2cc,
    });
    g.add(petals.points);

    const motes = makePointField(200, {
      style: 'glow', area: new THREE.Vector3(46, 40, 46),
      origin: new THREE.Vector3(0, TERRACE_Y - 6, 4),
      rise: 2.0, drift: 2.0, sizeMin: 0.8, sizeMax: 2.0,
      colorA: 0xffeec0, colorB: 0xfffaf0,
    });
    g.add(motes.points);

    // ---- cranes over the peak --------------------------------------------
    const cranes = [];
    for (let i = 0; i < 5; i++) {
      const crane = new THREE.Group();
      const bodyC = shadowed(new THREE.Mesh(new THREE.CapsuleGeometry(0.5, 2.4, 4, 8),
        STD({ color: 0xfbfaf6, roughness: 0.9 })));
      bodyC.rotation.x = Math.PI / 2;
      crane.add(bodyC);
      const neck = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.2, 2.0, 6),
        STD({ color: 0xfbfaf6, roughness: 0.9 })));
      neck.position.set(0, 0.3, 1.7);
      neck.rotation.x = 1.2;
      crane.add(neck);
      const wings = [];
      for (const sx of [-1, 1]) {
        const w = shadowed(new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.14, 1.2),
          STD({ color: 0xf2efe6, roughness: 0.95 })));
        w.position.set(sx * 1.9, 0.1, 0);
        crane.add(w);
        wings.push(w);
      }
      g.add(crane);
      cranes.push({ crane, wings, r: rand(46, 82), h: rand(52, 74), spd: rand(0.09, 0.17), ph: rand(0, TAU) });
    }

    // ---- 师徒四人 climbing ------------------------------------------------
    const wukong = makeWukong(4.4);
    const tang = makeTang(4.2);
    const bajie = makeBajie(4.0);
    const wujing = makeWujing(4.3);
    const horse = makeHorse(1.2);
    for (const a of [wukong, tang, bajie, wujing, horse]) g.add(a);

    // ---- 真经 — the scrolls that come down to them ------------------------
    const scrolls = [];
    for (let i = 0; i < 14; i++) {
      const sc = new THREE.Group();
      const roll = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 2.6, 10),
        STD({ color: 0xf6ecd2, roughness: 0.75, emissive: 0x6a5a20, emissiveIntensity: 0.4 })));
      roll.rotation.z = Math.PI / 2;
      sc.add(roll);
      for (const sx of [-1, 1]) {
        const cap = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.3, 10),
          STD({ color: 0xd8a441, metalness: 0.7, roughness: 0.35 })));
        cap.rotation.z = Math.PI / 2;
        cap.position.x = sx * 1.35;
        sc.add(cap);
      }
      g.add(sc);
      scrolls.push({ sc, a: (i / 14) * TAU, ph: rand(0, TAU) });
    }

    this._ = {
      g, sea, seaFar, rays, bloom, haloRing, haloMat, buddhaLight, petals, motes,
      cranes, wukong, tang, bajie, wujing, horse, scrolls, lotus,
    };
    return g;
  },

  update(t, dt) {
    const S = this._;
    S.sea.update(t);
    S.seaFar.update(t);
    S.rays.update(t);
    S.petals.update(t);
    S.motes.update(t);
    S.rays.group.rotation.y = t * 0.05;

    // the light of the peak swells as they arrive
    const arrive = pulse(t, 18, 30);
    S.rays.mat.uniforms.uOpacity.value = 0.055 + arrive * 0.055;
    S.bloom.update(t, 0.28, 0.55 + arrive * 0.5);
    S.haloMat.emissiveIntensity = 1.3 + Math.sin(t * 1.6) * 0.2 + arrive * 0.5;
    S.haloRing.rotation.z = Math.sin(t * 0.3) * 0.05;
    S.buddhaLight.intensity = 30 + arrive * 30 + Math.sin(t * 1.9) * 4;

    // ---- the climb --------------------------------------------------------
    const z = partyZ(t);
    const climbing = t > 5 && t < 27.5;
    const spd = climbing ? 1.0 : 0;
    const place = (actor, dx, dz) => {
      const az = z + dz;
      actor.position.set(dx, stairY(az), az);
      actor.rotation.y = Math.PI;
    };
    place(S.wukong, -8.5, -3.0);
    place(S.tang, 0.4, 0);
    place(S.horse, 4.6, 2.0);
    place(S.bajie, -3.6, 4.6);
    place(S.wujing, 3.0, 6.4);
    walk(S.wukong, t, spd * 1.1, 1);
    walk(S.tang, t + 0.4, spd * 0.95, 1);
    walk(S.bajie, t + 0.9, spd * 1.0, 0.9);
    walk(S.wujing, t + 1.5, spd * 1.05, 0.95);
    horseWalk(S.horse, t, spd, 1);

    // at the top they bow
    if (t > 28) {
      const bow = pulse(t, 28.5, 30.5) * (1 - pulse(t, 40, 42));
      for (const a of [S.wukong, S.tang, S.bajie, S.wujing]) {
        idle(a, t, 0.5);
        a.userData.rig.body.rotation.x = bow * 0.55;
      }
    }

    // ---- the scriptures come down ----------------------------------------
    const give = pulse(t, 29, 36);
    for (let i = 0; i < S.scrolls.length; i++) {
      const d = S.scrolls[i];
      const k = clamp(give * 1.4 - i * 0.03, 0, 1);
      const rad = lerp(7, 15, k);
      const yy = lerp(TERRACE_Y + 13, TERRACE_Y + 4.5, easeOut(k)) + Math.sin(t * 1.3 + d.ph) * 0.5;
      const ang = d.a + t * 0.22;
      d.sc.position.set(Math.cos(ang) * rad, yy, 6 + Math.sin(ang) * rad);
      d.sc.rotation.set(0, -ang, Math.sin(t * 1.1 + d.ph) * 0.15);
      d.sc.visible = k > 0.01;
    }

    // ---- cranes -----------------------------------------------------------
    for (const c of S.cranes) {
      const a = t * c.spd + c.ph;
      c.crane.position.set(Math.cos(a) * c.r, c.h + Math.sin(a * 2.1) * 3, Math.sin(a) * c.r + 6);
      c.crane.rotation.y = -a + Math.PI / 2;
      const flap = Math.sin(t * 5.5 + c.ph) * 0.5;
      c.wings[0].rotation.z = flap;
      c.wings[1].rotation.z = -flap;
    }
  },
});

})();
