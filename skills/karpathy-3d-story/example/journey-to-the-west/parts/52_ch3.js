
// ============================================================================
//  第三回 · 五行山下 —— 五百年 · 揭帖 · 收徒
//  Five hundred years under the Mountain of Five Elements, and the monk who
//  peels the seal off it.
//
//  This chapter drives the sun and sky itself during the time-lapse. The
//  director sets them once on entry; everything here is computed as an absolute
//  function of local time, so any frame is still reproducible on demand.
// ============================================================================
(function () {

const PEAKS = [
  { a: -0.68, r: 12, h: 42, w: 7.0 },
  { a: -0.30, r: 9,  h: 54, w: 7.6 },
  { a: 0.04,  r: 6,  h: 62, w: 8.4 },
  { a: 0.38,  r: 10, h: 50, w: 7.2 },
  { a: 0.76,  r: 14, h: 39, w: 6.4 },
];
const TRAP_Z = 26;        // where he is pinned, on the +Z face of the mountain

// The road bends, then straightens onto the mountain's face so the arrival
// beat has both figures near the same spot instead of 17 units apart.
function roadX(z) {
  return (Math.sin(z * 0.021) * 16 + Math.sin(z * 0.006) * 9) * smooth(z, 36, 96);
}

function groundY(x, z) {
  const d = Math.hypot(x, z);
  return Math.sin(x * 0.012) * Math.cos(z * 0.010) * 3.4
       + Math.sin(x * 0.031 + z * 0.024) * 1.2
       - Math.max(0, 1 - d / 110) * 2.0;
}

registerChapter(3, {
  title: { num: '第 三 回', cn: '五行山下', en: 'Five Hundred Years Under the Mountain' },
  duration: 42,
  sky: {
    top: 0x24406e, mid: 0x8494b4, bot: 0xd8bc92, sun: 0xffe2b4,
    sunDir: [0.62, 0.42, 0.66], sunColor: 0xffe6bc, sunI: 2.2,
    hemiSky: 0xa8bcd8, hemiGround: 0x5d5a3e, hemiI: 0.95,
    fillColor: 0x93a6cc, fillI: 0.4,
    glow: 1.0, stars: 0,
    fog: { color: 0xb8c2d0, near: 150, far: 800 },
    exposure: 1.14, sunTargetY: 20, shadowRadius: 130,
  },
  captions: [
    { t: 0.5,  cn: '如来翻掌一扑，化作五行山，将他压住', en: 'The Buddha turned his palm, and it became the Mountain of Five Elements' },
    { t: 8.0,  cn: '山顶贴一帖，六字真言：唵嘛呢叭咪吽', en: 'On its peak, a seal of six syllables' },
    { t: 15.0, cn: '饥餐铁丸，渴饮铜汁，五百年', en: 'Five hundred years of iron pellets and molten bronze' },
    { t: 23.0, cn: '一个和尚自东土来，行至山下', en: 'A monk came from the East, and reached the foot of the mountain' },
    { t: 30.0, cn: '揭下金帖，山崩石裂', en: 'He peeled away the golden seal, and the mountain broke' },
    { t: 36.0, cn: '「师父，我出来也！」——自此保唐僧西行', en: '"Master, I am out!" — and so he guarded the monk westward' },
  ],
  cam: [
    { t: 0,  p: [-46, 26, 168], l: [0, 34, 10] },     // the whole mountain, cold and far
    { t: 9,  p: [-14, 30, 118], l: [0, 44, 6] },      // up at the seal through the seasons
    { t: 16, p: [28, 30, 138], l: [0, 44, 6] },
    { t: 23, p: [26, 7, 78],    l: [6, 5, 46] },      // the monk on the road
    { t: 29, p: [12, 9, 52],    l: [0, 30, 16] },     // he climbs toward the seal
    { t: 33, p: [17, 13, 76],   l: [0, 9, 26] },     // the mountain breaks — clear of the debris
    { t: 37, p: [-16, 8, 62],   l: [-1, 4.5, 34] },  // the two of them
    { t: 42, p: [-34, 22, 92],  l: [0, 20, 16] },
  ],
  build() {
    reseed(30913);
    const g = new THREE.Group();

    // ---- the plain ------------------------------------------------------
    const geo = new THREE.PlaneGeometry(900, 900, 120, 120);
    geo.rotateX(-Math.PI / 2);
    const gp = geo.attributes.position;
    const cols = [];
    const cA = new THREE.Color(0x6b7a44), cB = new THREE.Color(0x8a9052), tmp = new THREE.Color();
    for (let i = 0; i < gp.count; i++) {
      const x = gp.getX(i), z = gp.getZ(i);
      gp.setY(i, groundY(x, z));
      tmp.copy(cA).lerp(cB, clamp((Math.sin(x * 0.05) * Math.cos(z * 0.043) + 1) * 0.5, 0, 1));
      cols.push(tmp.r, tmp.g, tmp.b);
    }
    geo.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
    geo.computeVertexNormals();
    const groundMat = STD({ vertexColors: true, roughness: 1.0 });
    const ground = shadowed(new THREE.Mesh(geo, groundMat), false, true);
    g.add(ground);

    // distant ranges, so the horizon is not a flat line
    for (let i = 0; i < 22; i++) {
      const a = rand(0, TAU), rr = rand(230, 400);
      const m = makeRockMass(rand(26, 60), rand(16, 40), 0x4d5668, 0x6c7488, i * 1.7, 16);
      m.position.set(Math.cos(a) * rr, -3, Math.sin(a) * rr);
      g.add(m);
    }

    // ---- 五行山 — five stone fingers ------------------------------------
    const mountain = new THREE.Group();
    const base = makeRockMass(34, 20, 0x4a4740, 0x6d6a60, 3.1, 30);
    mountain.add(base);
    const peakMeshes = [];
    for (let i = 0; i < PEAKS.length; i++) {
      const P = PEAKS[i];
      const spire = makeSpire(P.w, P.h, 0x6a6760, i * 2.9, 0);
      spire.position.set(Math.sin(P.a) * P.r, 12, Math.cos(P.a) * P.r - 6);
      spire.rotation.z = -Math.sin(P.a) * 0.13;
      spire.rotation.x = 0.05;
      mountain.add(spire);
      peakMeshes.push(spire);
      // a knuckle where each finger leaves the palm
      const knuckle = shadowed(new THREE.Mesh(new THREE.DodecahedronGeometry(P.w * 1.25, 0),
        STD({ color: 0x5c5952, roughness: 1.0, flatShading: true })));
      knuckle.position.set(Math.sin(P.a) * P.r, 13, Math.cos(P.a) * P.r - 6);
      mountain.add(knuckle);
    }
    g.add(mountain);

    // ---- 金帖 — the seal on the highest finger --------------------------
    const sealG = new THREE.Group();
    const tallest = PEAKS[2];
    sealG.position.set(Math.sin(tallest.a) * tallest.r, 12 + tallest.h * 0.88, Math.cos(tallest.a) * tallest.r - 6 + 3.4);
    const sealMat = STD({
      color: 0xf0d089, roughness: 0.45, metalness: 0.35,
      emissive: 0xffbe4a, emissiveIntensity: 0.9, side: THREE.DoubleSide,
    });
    const seal = shadowed(new THREE.Mesh(new THREE.PlaneGeometry(6.0, 10.0), sealMat));
    sealG.add(seal);
    for (let i = 0; i < 6; i++) {                       // 唵嘛呢叭咪吽
      const glyph = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.4, 0.1),
        STD({ color: 0x7a2a18, roughness: 0.6 }));
      glyph.position.set(0, 3.7 - i * 1.45, 0.1);
      sealG.add(glyph);
    }
    g.add(sealG);
    const sealLight = new THREE.PointLight(0xffc45c, 12, 90, 2);
    sealLight.position.copy(sealG.position);
    g.add(sealLight);
    const sealRays = makeGodRays(6, 46, 0xffd489, 0.16, 7);
    sealRays.group.position.copy(sealG.position);
    sealRays.group.position.y += 16;
    g.add(sealRays.group);

    // ---- the road, and its flagstones ----------------------------------
    const stones = [];
    for (let z = 38; z < 260; z += 3.4) {
      for (let k = -1; k <= 1; k++) {
        const x = roadX(z) + k * 2.6 + rand(-0.5, 0.5);
        const st = shadowed(new THREE.Mesh(
          new THREE.CylinderGeometry(rand(1.3, 1.9), rand(1.3, 1.9), 0.35, 6),
          STD({ color: pick([0x8e8878, 0x9a9384, 0x807a6c]), roughness: 1.0 })), false, true);
        st.position.set(x, groundY(x, z) + 0.16, z);
        st.rotation.y = rand(0, TAU);
        g.add(st);
        stones.push(st);
      }
    }
    // roadside pines and grass
    for (let i = 0; i < 70; i++) {
      const z = rand(40, 300), side = chance(0.5) ? 1 : -1;
      const x = roadX(z) + side * rand(9, 60);
      if (Math.hypot(x, z) < 46 || (z < 104 && Math.abs(x) < 46)) continue;
      const t = makeTreeSimple(rand(1.2, 2.4), 0x5a4227, pick([0x40603a, 0x36552f, 0x4c6a3e]), false);
      t.position.set(x, groundY(x, z) - 0.2, z);
      g.add(t);
    }

    // scatter: the plain was a billiard table
    for (let i = 0; i < 150; i++) {
      const a = rand(0, TAU), rr = rand(48, 320);
      const x = Math.cos(a) * rr, z = Math.sin(a) * rr;
      const b = shadowed(new THREE.Mesh(
        chance(0.45) ? new THREE.DodecahedronGeometry(rand(0.8, 2.6), 0)
                     : new THREE.SphereGeometry(rand(0.9, 2.2), 7, 6),
        STD({ color: pick([0x6f6a56, 0x4f6b3c, 0x5d7a42, 0x7a7460]), roughness: 1.0, flatShading: true })));
      b.position.set(x, groundY(x, z) + 0.3, z);
      b.scale.y = rand(0.5, 0.9);
      b.rotation.y = rand(0, TAU);
      g.add(b);
    }

    // ---- 悟空 pinned under the rock -------------------------------------
    const trapped = new THREE.Group();
    trapped.position.set(0, 0, TRAP_Z);
    const rubble = [];
    for (let i = 0; i < 26; i++) {
      const rock = shadowed(new THREE.Mesh(new THREE.DodecahedronGeometry(rand(1.4, 4.2), 0),
        STD({ color: pick([0x5c5952, 0x6a675e, 0x4e4b45]), roughness: 1.0, flatShading: true })));
      const a = rand(-1.5, 1.5);
      rock.position.set(Math.sin(a) * rand(3, 12), rand(0.5, 7), Math.cos(a) * rand(-4, 3));
      rock.rotation.set(rand(0, 3), rand(0, 3), rand(0, 3));
      trapped.add(rock);
      rubble.push({ rock, dir: rock.position.clone().normalize().add(new THREE.Vector3(0, 0.7, 0.5)).normalize(), base: rock.position.clone() });
    }
    // his head and one hand, and nothing else — the rest is under the mountain
    const trapHead = new THREE.Group();
    trapHead.position.set(0.6, 3.4, 3.6);
    const furMat = STD({ color: C.fur, roughness: 1.0 });
    const faceMat = STD({ color: C.furLight, roughness: 1.0 });
    const skull = shadowed(new THREE.Mesh(new THREE.SphereGeometry(1.05, 14, 12), faceMat));
    trapHead.add(skull);
    const tmuzzle = new THREE.Mesh(new THREE.SphereGeometry(0.58, 10, 8), faceMat);
    tmuzzle.position.set(0, -0.22, 0.82);
    tmuzzle.scale.set(1.15, 0.8, 1);
    trapHead.add(tmuzzle);
    for (const sx of [-1, 1]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.16, 7, 6), BASIC({ color: 0x14161c }));
      eye.position.set(sx * 0.38, 0.12, 0.94);
      trapHead.add(eye);
      const ear = new THREE.Mesh(new THREE.SphereGeometry(0.32, 8, 6), faceMat);
      ear.position.set(sx * 1.08, 0.1, 0);
      ear.scale.x = 0.5;
      trapHead.add(ear);
    }
    const tband = new THREE.Mesh(new THREE.TorusGeometry(1.04, 0.13, 8, 22),
      STD({ color: C.gold, metalness: 0.85, roughness: 0.25, emissive: 0x3a2a04, emissiveIntensity: 0.5 }));
    tband.position.y = 0.55;
    tband.rotation.x = Math.PI / 2;
    trapHead.add(tband);
    const truff = new THREE.Mesh(new THREE.TorusGeometry(0.98, 0.22, 6, 16), furMat);
    truff.rotation.x = 0.1;
    trapHead.add(truff);
    trapped.add(trapHead);
    const trapArm = shadowed(new THREE.Mesh(new THREE.CapsuleGeometry(0.34, 2.6, 3, 7), furMat));
    trapArm.position.set(-3.4, 2.2, 4.2);
    trapArm.rotation.set(0.5, 0, -0.9);
    trapped.add(trapArm);
    const trapHand = shadowed(new THREE.Mesh(new THREE.SphereGeometry(0.42, 8, 7), faceMat));
    trapHand.position.set(-4.6, 3.4, 4.7);
    trapped.add(trapHand);
    g.add(trapped);

    // ---- the pilgrims ----------------------------------------------------
    const tang = makeTang(4.2);
    tang.position.set(0, 0, 150);
    g.add(tang);
    const horse = makeHorse(1.15);
    horse.position.set(4, 0, 156);
    g.add(horse);

    const wukong = makeWukong(4.6);
    wukong.position.set(-2.5, 0, TRAP_Z + 7);
    wukong.visible = false;
    g.add(wukong);

    // ---- weather and light effects --------------------------------------
    const snow = makePointField(700, {
      style: 'snow', area: new THREE.Vector3(150, 60, 150), origin: new THREE.Vector3(0, 0, 60),
      rise: -6.0, drift: 3.0, sizeMin: 0.7, sizeMax: 1.7,
      colorA: 0xffffff, colorB: 0xdfe8f4,
    });
    snow.setFade(0);
    g.add(snow.points);

    const leaves = makePointField(240, {
      style: 'petal', area: new THREE.Vector3(120, 40, 120), origin: new THREE.Vector3(0, 0, 60),
      rise: -3.2, drift: 4.0, sizeMin: 1.1, sizeMax: 2.4,
      colorA: 0xd8a154, colorB: 0xc4703a,
    });
    leaves.setFade(0);
    g.add(leaves.points);

    const breakHalo = makeHalo(0xfff0c4, 4, 30, 0.5);
    breakHalo.group.position.set(0, 3, TRAP_Z + 2);
    breakHalo.group.visible = false;
    g.add(breakHalo.group);
    const breakBurst = makeBurst(300, 0xffe6b0, 16, 2.2);
    breakBurst.points.position.set(0, 5, TRAP_Z);
    g.add(breakBurst.points);
    const freeLight = new THREE.PointLight(0xffd489, 0, 120, 2);
    freeLight.position.set(0, 8, TRAP_Z + 2);
    g.add(freeLight);

    this._ = {
      g, mountain, peakMeshes, sealG, sealMat, seal, sealLight, sealRays,
      trapped, trapHead, rubble, tang, horse, wukong,
      snow, leaves, breakHalo, breakBurst, freeLight, groundMat, ground,
    };
    return g;
  },

  update(t, dt) {
    const S = this._;

    // ---- the five hundred years: sun, sky and season, all from t ---------
    // One "year" is a second and a half; the montage runs from 4s to 20s.
    const mont = clamp((t - 4) / 16, 0, 1);
    const spin = mont * TAU * 3.1;                      // three sunrises
    const day = 0.5 + 0.5 * Math.sin(spin);             // 1 = noon, 0 = midnight
    if (t < 21) {
      const sx = Math.cos(spin + 1.4) * 0.7, sy = Math.sin(spin) * 0.85, sz = 0.45;
      setSun(new THREE.Vector3(sx, Math.max(-0.3, sy), sz).normalize().multiplyScalar(300),
        new THREE.Color(0xffe6bc).lerp(new THREE.Color(0xff9a5a), 1 - day), 0.5 + day * 2.2);
      hemi.intensity = 0.28 + day * 0.75;
      skyMat.uniforms.topColor.value.set(0x0a1330).lerp(new THREE.Color(0x2a4f8c), day);
      skyMat.uniforms.midColor.value.set(0x2a3554).lerp(new THREE.Color(0x93a8cc), day);
      skyMat.uniforms.botColor.value.set(0x5a3a4a).lerp(new THREE.Color(0xdcc49a), day);
      skyMat.uniforms.uStars.value = (1 - day) * 0.75;
      scene.fog.color.copy(skyMat.uniforms.midColor.value);
      // winters come and go; the grass greys over and recovers
      const season = (Math.sin(mont * TAU * 3.1 - 1.2) + 1) * 0.5;
      const winter = clamp((season - 0.55) / 0.45, 0, 1);
      S.snow.setFade(winter * 0.9);
      S.leaves.setFade(clamp(1 - Math.abs(season - 0.42) / 0.3, 0, 1) * 0.55);
      S.groundMat.color.setRGB(1, 1, 1).lerp(new THREE.Color(0xdfe6ee), winter * 0.8);
    } else {
      // settle into the clear afternoon the monk arrives in
      const k = pulse(t, 21, 24);
      setSun(new THREE.Vector3(0.62, 0.42, 0.66).normalize().multiplyScalar(300), 0xffe6bc, lerp(1.4, 2.3, k));
      hemi.intensity = lerp(0.7, 1.0, k);
      skyMat.uniforms.topColor.value.set(0x24406e);
      skyMat.uniforms.midColor.value.set(0x8494b4);
      skyMat.uniforms.botColor.value.set(0xd8bc92);
      skyMat.uniforms.uStars.value = 0;
      scene.fog.color.set(0xb8c2d0);
      S.snow.setFade(0);
      S.leaves.setFade(0.25);
      S.groundMat.color.set(0xffffff);
    }
    S.snow.update(t);
    S.leaves.update(t);
    S.sealRays.update(t);

    // the seal burns steadily, then is taken
    const peeled = t > 29.5;
    S.sealG.visible = !peeled;
    S.sealMat.emissiveIntensity = peeled ? 0 : 0.7 + Math.sin(t * 2.2) * 0.25;
    S.sealLight.intensity = peeled ? 0 : 10 + Math.sin(t * 2.2) * 3;
    S.sealRays.mat.uniforms.uOpacity.value = peeled ? 0 : 0.16;

    // ---- the monk walks the road, then climbs ---------------------------
    const walkK = pulse(t, 18, 28);
    const z = lerp(150, 40, ease(walkK));
    const rx = roadX(z);
    S.tang.position.set(rx, groundY(rx, z), z);
    S.tang.rotation.y = Math.PI;
    walk(S.tang, t, walkK > 0.001 && walkK < 0.999 ? 1.0 : 0, 1);
    S.horse.position.set(rx + 4.5, groundY(rx + 4.5, z + 5), z + 5);
    S.horse.rotation.y = Math.PI;
    horseWalk(S.horse, t, walkK > 0.001 && walkK < 0.999 ? 1.0 : 0, 1);
    // reaches up for the seal, then lowers the arm again — an arm left locked
    // overhead reads as a permanently raised hand for the rest of the chapter
    S.tang.userData.rig.armR.root.rotation.x =
      -2.2 * (pulse(t, 27.5, 29.5) * (1 - pulse(t, 30.5, 32.5)));

    // ---- the mountain breaks --------------------------------------------
    const BREAK = 30.5;
    const brk = pulse(t, BREAK, 33.5);
    if (brk > 0) {
      const k = easeOut(brk);
      for (const r of S.rubble) {
        r.rock.position.copy(r.base).addScaledVector(r.dir, k * 15);
        r.rock.position.y = r.base.y + k * 9 - k * k * 7;
        r.rock.rotation.x = k * 4 * (r.base.x > 0 ? 1 : -1);
        r.rock.rotation.z = k * 3;
      }
      S.trapHead.visible = brk < 0.35;
      S.breakHalo.group.visible = true;
      S.breakHalo.update(t - BREAK, 0.5, 1 - brk * 0.4);
      S.breakBurst.setAge(t - BREAK);
      S.freeLight.intensity = 90 * Math.exp(-Math.pow((t - BREAK - 0.6) * 1.5, 2));
      for (let i = 0; i < S.peakMeshes.length; i++) {
        S.peakMeshes[i].rotation.z = -Math.sin(PEAKS[i].a) * 0.13 + Math.sin(t * 26 + i) * 0.02 * (1 - brk);
      }
    } else {
      S.trapHead.visible = true;
      S.freeLight.intensity = 0;
      S.breakBurst.setAge(99);
      // he strains against it, all five hundred years of it
      S.trapHead.rotation.z = Math.sin(t * 0.8) * 0.06;
      S.trapHead.rotation.y = Math.sin(t * 0.37) * 0.3;
    }

    // ---- free ------------------------------------------------------------
    const out = pulse(t, 32.0, 35.0);
    if (out > 0) {
      S.wukong.visible = true;
      const k = easeOut(out);
      const wx = lerp(0.6, -2.5, k), wz = lerp(TRAP_Z + 3.6, TRAP_Z + 7, k);
      S.wukong.position.set(wx, groundY(wx, wz) + lerp(2.4, 0, k) + (1 - k) * 2, wz);
      S.wukong.rotation.y = lerp(0.2, Math.PI * 0.14, k);
      if (t > 35) {
        idle(S.wukong, t, 1);
        // a bow to his new master, held rather than looped
        const bow = pulse(t, 35.5, 37.0) * (1 - pulse(t, 39.0, 40.5));
        S.wukong.userData.rig.body.rotation.x = bow * 0.5;
        S.wukong.userData.rig.staff.rotation.z = Math.PI / 2 + bow * 0.4;
      } else {
        walk(S.wukong, t, 1.4, 1);
      }
    } else {
      S.wukong.visible = false;
    }
  },
});

})();
