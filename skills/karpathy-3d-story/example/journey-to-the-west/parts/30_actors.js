
// ============================================================================
//  The actor kit
//
//  Everyone is built from the same rig so one walk cycle drives all of them:
//    actor.rig = { root, body, head, armL, armR, legL, legR }
//  Each limb is a group that pivots at its joint with a child group at the
//  elbow/knee, so a two-bone bend is two rotations and no skinning.
//  Origin of every actor is the SOLE OF THE FEET at y=0 — chapters place actors
//  by putting them on terrain height directly, which is what keeps them from
//  sinking or hovering.
// ============================================================================

function makeLimb(upperLen, lowerLen, r, mat) {
  const root = new THREE.Group();
  const up = shadowed(new THREE.Mesh(new THREE.CapsuleGeometry(r, Math.max(0.01, upperLen - 2 * r), 3, 7), mat));
  up.position.y = -upperLen / 2;
  root.add(up);
  const lower = new THREE.Group();
  lower.position.y = -upperLen;
  root.add(lower);
  const lo = shadowed(new THREE.Mesh(new THREE.CapsuleGeometry(r * 0.88, Math.max(0.01, lowerLen - 2 * r * 0.88), 3, 7), mat));
  lo.position.y = -lowerLen / 2;
  lower.add(lo);
  return { root, lower, end: lowerLen };
}

function makeHand(r, mat) {
  const h = shadowed(new THREE.Mesh(new THREE.SphereGeometry(r, 7, 6), mat));
  return h;
}

// Shared skeleton assembly. Everything below is a costume on top of this.
function makeBiped(cfg) {
  const H       = cfg.height;
  const skin    = cfg.skinMat;
  const cloth   = cfg.clothMat;
  const girth   = cfg.girth || 1.0;

  const root = new THREE.Group();
  const hipY = H * 0.46;
  const legU = hipY * 0.52, legL = hipY * 0.48;
  const shoulderY = H * 0.80;
  const armU = H * 0.19, armL = H * 0.17;

  const body = new THREE.Group();
  body.position.y = hipY;
  root.add(body);

  const torso = shadowed(new THREE.Mesh(
    new THREE.CapsuleGeometry(H * 0.115 * girth, H * 0.26, 4, 10), cloth));
  torso.position.y = H * 0.17;
  torso.scale.z = 0.82;
  body.add(torso);

  const head = new THREE.Group();
  head.position.y = H * 0.35;
  body.add(head);
  const skull = shadowed(new THREE.Mesh(new THREE.SphereGeometry(H * 0.105, 14, 12), skin));
  skull.scale.set(1, 1.06, 0.96);
  head.add(skull);

  // eyes — two dots is all it takes to make a silhouette read as a face
  const eyeMat = BASIC({ color: 0x14161c });
  for (const sx of [-1, 1]) {
    const e = new THREE.Mesh(new THREE.SphereGeometry(H * 0.016, 7, 6), eyeMat);
    e.position.set(sx * H * 0.038, H * 0.012, H * 0.094);
    head.add(e);
  }

  const arms = {};
  for (const side of ['L', 'R']) {
    const s = side === 'L' ? -1 : 1;
    const limb = makeLimb(armU, armL, H * 0.032, cfg.armMat || cloth);
    limb.root.position.set(s * H * 0.125 * girth, shoulderY - hipY, 0);
    body.add(limb.root);
    const hand = makeHand(H * 0.036, skin);
    hand.position.y = -armL;
    limb.lower.add(hand);
    limb.hand = hand;
    arms[side] = limb;
  }

  const legs = {};
  for (const side of ['L', 'R']) {
    const s = side === 'L' ? -1 : 1;
    const limb = makeLimb(legU, legL, H * 0.042, cfg.legMat || cloth);
    limb.root.position.set(s * H * 0.055, 0, 0);
    body.add(limb.root);
    const foot = shadowed(new THREE.Mesh(
      new THREE.BoxGeometry(H * 0.075, H * 0.032, H * 0.14), cfg.footMat || STD({ color: C.ink })));
    foot.position.set(0, -legL - H * 0.012, H * 0.032);
    limb.lower.add(foot);
    limb.foot = foot;
    legs[side] = limb;
  }

  root.userData.rig = {
    root, body, head, skull,
    armL: arms.L, armR: arms.R,
    legL: legs.L, legR: legs.R,
    hipY, mode: cfg.mode || 'walk', phase: rand(0, TAU),
  };
  return root;
}

// One cycle for everybody. mode 'robe' hides the legs' contribution and sways
// the whole body instead — a monk in a floor-length kasaya has no visible gait.
function walk(actor, t, speed = 1, amp = 1) {
  const r = actor.userData.rig;
  if (!r) return;
  const p = t * speed * 4.2 + r.phase;
  const s = Math.sin(p), c = Math.cos(p);

  if (r.mode !== 'robe') {
    r.legL.root.rotation.x = s * 0.62 * amp;
    r.legR.root.rotation.x = -s * 0.62 * amp;
    r.legL.lower.rotation.x = Math.max(0, -Math.sin(p - 0.7)) * 0.85 * amp;
    r.legR.lower.rotation.x = Math.max(0, -Math.sin(p + Math.PI - 0.7)) * 0.85 * amp;
  }
  if (!r.lockArmL) {
    r.armL.root.rotation.x = -s * 0.52 * amp;
    r.armL.lower.rotation.x = -Math.max(0, Math.sin(p)) * 0.4 * amp;
  }
  if (!r.lockArmR) {
    r.armR.root.rotation.x = s * 0.52 * amp;
    r.armR.lower.rotation.x = -Math.max(0, -Math.sin(p)) * 0.4 * amp;
  }
  r.body.position.y = r.hipY + Math.abs(c) * 0.045 * amp * (r.mode === 'robe' ? 0.5 : 1);
  r.body.rotation.z = s * 0.035 * amp;
  r.head.rotation.y = Math.sin(p * 0.31) * 0.18;
}

// Standing idle: breathing, a little weight shift.
function idle(actor, t, amp = 1) {
  const r = actor.userData.rig;
  if (!r) return;
  const p = t * 1.5 + r.phase;
  r.body.position.y = r.hipY + Math.sin(p) * 0.02 * amp;
  r.body.rotation.z = Math.sin(p * 0.6) * 0.02 * amp;
  r.head.rotation.y = Math.sin(p * 0.42) * 0.2 * amp;
  if (!r.lockArmL) r.armL.root.rotation.x = Math.sin(p * 0.8) * 0.06;
  if (!r.lockArmR) r.armR.root.rotation.x = Math.sin(p * 0.8 + 1) * 0.06;
}

function faceTo(actor, x, z) {
  actor.rotation.y = Math.atan2(x - actor.position.x, z - actor.position.z);
}

// ---------------------------------------------------------------------------
//  孙悟空 — Sun Wukong
// ---------------------------------------------------------------------------
function makeWukong(height = 3.4) {
  const furMat  = STD({ color: C.fur, roughness: 1.0 });
  const faceMat = STD({ color: C.furLight, roughness: 1.0 });
  const tunic   = STD({ color: C.imperialY, roughness: 0.8 });
  const a = makeBiped({
    height, skinMat: faceMat, clothMat: tunic,
    armMat: furMat, legMat: furMat,
    footMat: STD({ color: 0x7a2c22 }),
  });
  const r = a.userData.rig;
  const H = height;

  // muzzle + brow: the monkey read comes almost entirely from these two
  const muzzle = new THREE.Mesh(new THREE.SphereGeometry(H * 0.058, 10, 8), faceMat);
  muzzle.position.set(0, -H * 0.022, H * 0.082);
  muzzle.scale.set(1.15, 0.8, 1.0);
  r.head.add(muzzle);
  const brow = new THREE.Mesh(new THREE.BoxGeometry(H * 0.13, H * 0.02, H * 0.03), STD({ color: 0x6a4526 }));
  brow.position.set(0, H * 0.042, H * 0.088);
  r.head.add(brow);
  // fur ruff around the face
  const ruff = new THREE.Mesh(new THREE.TorusGeometry(H * 0.098, H * 0.022, 6, 16), furMat);
  ruff.position.set(0, 0, H * 0.012);
  ruff.rotation.x = 0.1;
  r.head.add(ruff);
  for (const sx of [-1, 1]) {
    const ear = new THREE.Mesh(new THREE.SphereGeometry(H * 0.032, 8, 6), faceMat);
    ear.position.set(sx * H * 0.108, H * 0.01, 0);
    ear.scale.set(0.5, 1, 1);
    r.head.add(ear);
  }
  // 金箍 — the gold band. Wukong is unmistakable with it and generic without.
  const band = new THREE.Mesh(
    new THREE.TorusGeometry(H * 0.104, H * 0.013, 8, 22),
    STD({ color: C.gold, metalness: 0.85, roughness: 0.25, emissive: 0x3a2a04, emissiveIntensity: 0.5 }));
  band.position.y = H * 0.055;
  band.rotation.x = Math.PI / 2;
  r.head.add(band);

  // 虎皮裙 — tiger-skin skirt
  const skirt = shadowed(new THREE.Mesh(
    new THREE.CylinderGeometry(H * 0.125, H * 0.165, H * 0.17, 12, 1, true),
    STD({ color: 0xd98c2b, roughness: 1.0, side: THREE.DoubleSide })));
  skirt.position.y = H * 0.02;
  r.body.add(skirt);
  for (let i = 0; i < 6; i++) {
    const stripe = new THREE.Mesh(
      new THREE.BoxGeometry(H * 0.018, H * 0.10, H * 0.012),
      STD({ color: 0x3a2410 }));
    const ang = (i / 6) * TAU + 0.3;
    stripe.position.set(Math.cos(ang) * H * 0.15, H * 0.02, Math.sin(ang) * H * 0.15);
    stripe.rotation.y = -ang;
    r.body.add(stripe);
  }
  // red scarf
  const scarf = new THREE.Mesh(new THREE.TorusGeometry(H * 0.088, H * 0.016, 6, 16), STD({ color: C.cinnabar }));
  scarf.position.y = H * 0.30;
  scarf.rotation.x = Math.PI / 2;
  r.body.add(scarf);

  // tail — a curved tube that the update hook can wag
  const tailCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0, -H * 0.05),
    new THREE.Vector3(0, H * 0.10, -H * 0.22),
    new THREE.Vector3(0, H * 0.24, -H * 0.34),
    new THREE.Vector3(0, H * 0.36, -H * 0.24),
  ]);
  const tail = new THREE.Mesh(new THREE.TubeGeometry(tailCurve, 18, H * 0.02, 6, false), furMat);
  tail.position.y = H * 0.02;
  r.body.add(tail);
  r.tail = tail;

  // 金箍棒 — held in the right hand, scalable along its own axis
  const staffGroup = new THREE.Group();
  const shaft = shadowed(new THREE.Mesh(
    new THREE.CylinderGeometry(H * 0.019, H * 0.019, H * 1.5, 10),
    STD({ color: 0x8a5a20, metalness: 0.5, roughness: 0.45 })));
  staffGroup.add(shaft);
  for (const sy of [-1, 1]) {
    const cap = new THREE.Mesh(
      new THREE.CylinderGeometry(H * 0.026, H * 0.026, H * 0.10, 10),
      STD({ color: C.gold, metalness: 0.9, roughness: 0.2, emissive: 0x2e2205, emissiveIntensity: 0.6 }));
    cap.position.y = sy * H * 0.72;
    staffGroup.add(cap);
  }
  staffGroup.rotation.z = Math.PI / 2;   // held across the body by default
  staffGroup.position.y = -r.armR.end;
  r.armR.lower.add(staffGroup);
  r.staff = staffGroup;
  r.staffBaseLen = H * 1.5;

  a.userData.kind = 'wukong';
  return a;
}

// ---------------------------------------------------------------------------
//  唐僧 — Tang Sanzang, the monk. Robe mode: no visible gait.
// ---------------------------------------------------------------------------
function makeTang(height = 3.7) {
  const skin = STD({ color: 0xe8cba8, roughness: 0.9 });
  const robe = STD({ color: C.monkRobe, roughness: 0.85 });
  const a = makeBiped({ height, skinMat: skin, clothMat: robe, armMat: robe, mode: 'robe' });
  const r = a.userData.rig;
  const H = height;

  // floor-length kasaya hides the legs entirely
  r.legL.root.visible = false;
  r.legR.root.visible = false;
  const kasaya = shadowed(new THREE.Mesh(
    new THREE.CylinderGeometry(H * 0.13, H * 0.24, H * 0.50, 16, 1, true),
    STD({ color: C.monkRobe, roughness: 0.85, side: THREE.DoubleSide })));
  kasaya.position.y = -H * 0.20;
  r.body.add(kasaya);
  // gold panel trim
  for (let i = 0; i < 4; i++) {
    const band = new THREE.Mesh(
      new THREE.TorusGeometry(H * (0.145 + i * 0.028), H * 0.011, 6, 22),
      STD({ color: C.monkGold, metalness: 0.6, roughness: 0.35 }));
    band.position.y = -H * (0.04 + i * 0.11);
    band.rotation.x = Math.PI / 2;
    r.body.add(band);
  }
  const sash = new THREE.Mesh(new THREE.BoxGeometry(H * 0.075, H * 0.42, H * 0.02), STD({ color: C.monkGold }));
  sash.position.set(0, H * 0.10, H * 0.10);
  sash.rotation.z = 0.22;
  r.body.add(sash);

  // 毗卢帽 — the five-panel crown
  const hat = new THREE.Group();
  const crown = shadowed(new THREE.Mesh(
    new THREE.CylinderGeometry(H * 0.108, H * 0.115, H * 0.075, 14),
    STD({ color: C.monkGold, metalness: 0.55, roughness: 0.4 })));
  hat.add(crown);
  for (let i = 0; i < 5; i++) {
    const ang = -Math.PI * 0.55 + (i / 4) * Math.PI * 1.1;
    const petal = new THREE.Mesh(
      new THREE.ConeGeometry(H * 0.028, H * 0.075, 4),
      STD({ color: C.cinnabar, metalness: 0.3, roughness: 0.5 }));
    petal.position.set(Math.sin(ang) * H * 0.085, H * 0.072, Math.cos(ang) * H * 0.085);
    petal.rotation.set(Math.cos(ang) * 0.22, ang, -Math.sin(ang) * 0.22);
    hat.add(petal);
  }
  hat.position.y = H * 0.105;
  r.head.add(hat);
  r.hat = hat;

  // 锡杖 — ringed staff, in the left hand, held upright
  const staff = new THREE.Group();
  const pole = shadowed(new THREE.Mesh(
    new THREE.CylinderGeometry(H * 0.014, H * 0.016, H * 0.95, 8),
    STD({ color: 0x6b4a24, roughness: 0.9 })));
  staff.add(pole);
  const finial = new THREE.Mesh(
    new THREE.TorusGeometry(H * 0.05, H * 0.010, 6, 18),
    STD({ color: C.monkGold, metalness: 0.8, roughness: 0.25, emissive: 0x2a1e04, emissiveIntensity: 0.5 }));
  finial.position.y = H * 0.52;
  staff.add(finial);
  for (let i = 0; i < 4; i++) {
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(H * 0.020, H * 0.005, 5, 12),
      STD({ color: C.monkGold, metalness: 0.8, roughness: 0.3 }));
    ring.position.set((i - 1.5) * H * 0.026, H * 0.545, 0);
    staff.add(ring);
  }
  staff.position.set(0, -r.armL.end - H * 0.32, 0);
  r.armL.lower.add(staff);
  r.staff = staff;
  r.lockArmL = true;
  r.armL.root.rotation.x = -0.25;

  a.userData.kind = 'tang';
  return a;
}

// ---------------------------------------------------------------------------
//  猪八戒 — Zhu Bajie. Wide, low, and unmistakably a pig from behind.
// ---------------------------------------------------------------------------
function makeBajie(height = 3.2) {
  const skin = STD({ color: C.pigSkin, roughness: 0.95 });
  const robe = STD({ color: 0x4d6b52, roughness: 0.9 });
  const a = makeBiped({ height, skinMat: skin, clothMat: robe, girth: 1.45 });
  const r = a.userData.rig;
  const H = height;

  const belly = shadowed(new THREE.Mesh(new THREE.SphereGeometry(H * 0.20, 14, 12), robe));
  belly.position.y = H * 0.14;
  belly.scale.set(1.05, 0.92, 0.86);
  r.body.add(belly);

  const snout = new THREE.Mesh(new THREE.CylinderGeometry(H * 0.045, H * 0.052, H * 0.06, 10), skin);
  snout.rotation.x = Math.PI / 2;
  snout.position.set(0, -H * 0.018, H * 0.108);
  r.head.add(snout);
  const nostrilMat = BASIC({ color: 0x6a3f42 });
  for (const sx of [-1, 1]) {
    const n = new THREE.Mesh(new THREE.CircleGeometry(H * 0.011, 8), nostrilMat);
    n.position.set(sx * H * 0.017, -H * 0.018, H * 0.139);
    r.head.add(n);
  }
  for (const sx of [-1, 1]) {
    const ear = shadowed(new THREE.Mesh(new THREE.ConeGeometry(H * 0.055, H * 0.13, 5), skin));
    ear.position.set(sx * H * 0.10, H * 0.045, -H * 0.01);
    ear.rotation.set(0.5, 0, sx * 1.15);
    ear.scale.z = 0.35;
    r.head.add(ear);
  }
  for (const sx of [-1, 1]) {
    const tusk = new THREE.Mesh(new THREE.ConeGeometry(H * 0.012, H * 0.05, 5), STD({ color: C.bone }));
    tusk.position.set(sx * H * 0.032, -H * 0.005, H * 0.115);
    tusk.rotation.x = -0.35;
    r.head.add(tusk);
  }

  // 九齿钉耙 — nine-tooth rake, over the shoulder
  const rake = new THREE.Group();
  const handle = shadowed(new THREE.Mesh(
    new THREE.CylinderGeometry(H * 0.017, H * 0.019, H * 0.95, 8), STD({ color: 0x5b4327 })));
  rake.add(handle);
  const headBar = shadowed(new THREE.Mesh(
    new THREE.BoxGeometry(H * 0.30, H * 0.045, H * 0.05),
    STD({ color: 0x9aa0a8, metalness: 0.8, roughness: 0.35 })));
  headBar.position.y = H * 0.50;
  rake.add(headBar);
  for (let i = 0; i < 9; i++) {
    const tooth = new THREE.Mesh(
      new THREE.ConeGeometry(H * 0.013, H * 0.075, 5),
      STD({ color: 0xb9c0c8, metalness: 0.85, roughness: 0.28 }));
    tooth.position.set((i - 4) * H * 0.033, H * 0.545, 0);
    rake.add(tooth);
  }
  rake.position.set(0, -r.armR.end - H * 0.30, 0);
  rake.rotation.z = -0.25;
  r.armR.lower.add(rake);
  r.rake = rake;

  a.userData.kind = 'bajie';
  return a;
}

// ---------------------------------------------------------------------------
//  沙悟净 — Sha Wujing. Blue robe, red hair, skull necklace, crescent staff.
// ---------------------------------------------------------------------------
function makeWujing(height = 3.6) {
  const skin = STD({ color: 0x8fa08f, roughness: 0.95 });
  const robe = STD({ color: C.shaRobe, roughness: 0.9 });
  const a = makeBiped({ height, skinMat: skin, clothMat: robe });
  const r = a.userData.rig;
  const H = height;

  const hair = new THREE.Mesh(new THREE.SphereGeometry(H * 0.115, 12, 10), STD({ color: 0x8e3b22, roughness: 1.0 }));
  hair.position.y = H * 0.03;
  hair.scale.set(1.06, 1.12, 1.04);
  r.head.add(hair);
  const beard = new THREE.Mesh(new THREE.ConeGeometry(H * 0.05, H * 0.15, 7), STD({ color: 0x8e3b22, roughness: 1.0 }));
  beard.position.set(0, -H * 0.10, H * 0.055);
  beard.rotation.x = 0.22;
  r.head.add(beard);

  // 九颗骷髅项链
  for (let i = 0; i < 9; i++) {
    const ang = -Math.PI * 0.75 + (i / 8) * Math.PI * 1.5;
    const skull = new THREE.Mesh(new THREE.SphereGeometry(H * 0.021, 7, 6), STD({ color: C.bone, roughness: 0.85 }));
    skull.position.set(Math.sin(ang) * H * 0.115, H * 0.285 - Math.cos(ang) * H * 0.018, Math.cos(ang) * H * 0.085 + H * 0.02);
    r.body.add(skull);
  }

  // 降妖宝杖 — crescent-bladed staff
  const staff = new THREE.Group();
  const pole = shadowed(new THREE.Mesh(
    new THREE.CylinderGeometry(H * 0.016, H * 0.018, H * 1.0, 8), STD({ color: 0x4a3a26 })));
  staff.add(pole);
  const crescent = new THREE.Mesh(
    new THREE.TorusGeometry(H * 0.07, H * 0.014, 6, 14, Math.PI * 1.25),
    STD({ color: 0xc3ccd6, metalness: 0.85, roughness: 0.3 }));
  crescent.position.y = H * 0.53;
  crescent.rotation.z = -Math.PI * 0.62;
  staff.add(crescent);
  const spade = new THREE.Mesh(new THREE.ConeGeometry(H * 0.032, H * 0.09, 6), STD({ color: 0xc3ccd6, metalness: 0.8, roughness: 0.3 }));
  spade.position.y = -H * 0.545;
  spade.rotation.x = Math.PI;
  staff.add(spade);
  staff.position.set(0, -r.armR.end - H * 0.28, 0);
  staff.rotation.z = 0.18;
  r.armR.lower.add(staff);
  r.staff = staff;

  // luggage pole on the back — Wujing carries the baggage the whole way
  const pack = shadowed(new THREE.Mesh(new THREE.BoxGeometry(H * 0.15, H * 0.13, H * 0.09), STD({ color: 0x7a5c33 })));
  pack.position.set(0, H * 0.20, -H * 0.135);
  r.body.add(pack);

  a.userData.kind = 'wujing';
  return a;
}

// ---------------------------------------------------------------------------
//  白龙马 — the white horse. Four limbs on the same rig, phase-offset.
// ---------------------------------------------------------------------------
function makeHorse(scale = 1) {
  const white = STD({ color: 0xece7dd, roughness: 0.95 });
  const mane  = STD({ color: 0xd6cbb6, roughness: 1.0 });
  const g = new THREE.Group();
  const H = 3.0 * scale;

  const body = new THREE.Group();
  body.position.y = H * 0.62;
  g.add(body);

  // The barrel runs nose-to-tail, i.e. along Z. Rotating it about Z instead
  // would lay the horse's body across its own direction of travel.
  const barrel = shadowed(new THREE.Mesh(new THREE.CapsuleGeometry(H * 0.20, H * 0.52, 5, 12), white));
  barrel.rotation.x = Math.PI / 2;
  barrel.scale.set(0.88, 1, 1);
  body.add(barrel);

  const neck = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(H * 0.11, H * 0.155, H * 0.42, 9), white));
  neck.position.set(0, H * 0.20, H * 0.30);
  neck.rotation.x = 0.62;
  body.add(neck);

  const headG = new THREE.Group();
  headG.position.set(0, H * 0.38, H * 0.48);
  body.add(headG);
  const skull = shadowed(new THREE.Mesh(new THREE.BoxGeometry(H * 0.14, H * 0.15, H * 0.30), white));
  skull.rotation.x = 0.42;
  headG.add(skull);
  const muzzle = shadowed(new THREE.Mesh(new THREE.BoxGeometry(H * 0.10, H * 0.09, H * 0.12), white));
  muzzle.position.set(0, -H * 0.085, H * 0.15);
  headG.add(muzzle);
  for (const sx of [-1, 1]) {
    const ear = new THREE.Mesh(new THREE.ConeGeometry(H * 0.03, H * 0.08, 5), white);
    ear.position.set(sx * H * 0.055, H * 0.10, -H * 0.06);
    headG.add(ear);
    const eye = new THREE.Mesh(new THREE.SphereGeometry(H * 0.018, 6, 5), BASIC({ color: 0x1b1b20 }));
    eye.position.set(sx * H * 0.072, H * 0.02, H * 0.03);
    headG.add(eye);
  }
  const forelock = new THREE.Mesh(new THREE.BoxGeometry(H * 0.07, H * 0.10, H * 0.03), mane);
  forelock.position.set(0, H * 0.08, -H * 0.10);
  headG.add(forelock);

  // crest mane along the neck
  for (let i = 0; i < 7; i++) {
    const t = i / 6;
    const tuft = new THREE.Mesh(new THREE.BoxGeometry(H * 0.035, H * 0.09, H * 0.05), mane);
    tuft.position.set(0, H * (0.10 + t * 0.30), H * (0.16 + t * 0.30));
    tuft.rotation.x = 0.62;
    body.add(tuft);
  }
  const tail = new THREE.Mesh(new THREE.ConeGeometry(H * 0.075, H * 0.42, 7), mane);
  tail.position.set(0, H * 0.02, -H * 0.40);
  tail.rotation.x = -0.55;
  body.add(tail);

  // red saddle and blanket — this is a pilgrim's horse, not a wild one
  const saddle = shadowed(new THREE.Mesh(new THREE.BoxGeometry(H * 0.30, H * 0.07, H * 0.30), STD({ color: C.cinnabar })));
  saddle.position.y = H * 0.20;
  body.add(saddle);
  const blanket = shadowed(new THREE.Mesh(new THREE.BoxGeometry(H * 0.42, H * 0.02, H * 0.38), STD({ color: C.imperialY })));
  blanket.position.y = H * 0.165;
  body.add(blanket);

  const legs = [];
  const legDefs = [[-1, 1], [1, 1], [-1, -1], [1, -1]];
  for (let i = 0; i < 4; i++) {
    const [sx, sz] = legDefs[i];
    const limb = makeLimb(H * 0.30, H * 0.32, H * 0.045, white);
    limb.root.position.set(sx * H * 0.135, -H * 0.02, sz * H * 0.24);
    body.add(limb.root);
    const hoof = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(H * 0.05, H * 0.055, H * 0.05, 7), STD({ color: 0x4b4038 })));
    hoof.position.y = -H * 0.32;
    limb.lower.add(hoof);
    legs.push(limb);
  }

  g.userData.horse = { body, headG, legs, baseY: H * 0.62, H };
  return g;
}

function horseWalk(horse, t, speed = 1, amp = 1) {
  const h = horse.userData.horse;
  const p = t * speed * 3.6;
  const offs = [0, Math.PI, Math.PI, 0];   // diagonal pairs
  for (let i = 0; i < 4; i++) {
    const ph = p + offs[i];
    h.legs[i].root.rotation.x = Math.sin(ph) * 0.48 * amp;
    h.legs[i].lower.rotation.x = Math.max(0, -Math.sin(ph - 0.6)) * 0.55 * amp;
  }
  h.body.position.y = h.baseY + Math.abs(Math.cos(p)) * 0.05 * amp;
  h.headG.rotation.x = Math.sin(p) * 0.06 * amp;
}

// ---------------------------------------------------------------------------
//  天兵 — a celestial soldier. Deliberately uniform: they are a crowd, not
//  characters, and the crowd is what makes 大闹天宫 read as a battle.
// ---------------------------------------------------------------------------
function makeSoldier(height = 3.5, plumeColor = 0xd94f2b) {
  const armour = STD({ color: 0x9fa8b8, metalness: 0.75, roughness: 0.42 });
  const skin   = STD({ color: 0xd9b58e, roughness: 0.9 });
  const a = makeBiped({ height, skinMat: skin, clothMat: armour, footMat: STD({ color: 0x3a3a42 }) });
  const r = a.userData.rig;
  const H = height;

  // shoulder pauldrons + helmet + plume
  for (const sx of [-1, 1]) {
    const pauld = shadowed(new THREE.Mesh(
      new THREE.SphereGeometry(H * 0.062, 8, 6, 0, TAU, 0, Math.PI * 0.55),
      STD({ color: C.darkGold, metalness: 0.8, roughness: 0.35 })));
    pauld.position.set(sx * H * 0.128, H * 0.335, 0);
    r.body.add(pauld);
  }
  const helm = shadowed(new THREE.Mesh(
    new THREE.ConeGeometry(H * 0.115, H * 0.14, 10),
    STD({ color: C.darkGold, metalness: 0.85, roughness: 0.3 })));
  helm.position.y = H * 0.075;
  r.head.add(helm);
  const plume = new THREE.Mesh(new THREE.ConeGeometry(H * 0.022, H * 0.11, 6), STD({ color: plumeColor }));
  plume.position.y = H * 0.20;
  r.head.add(plume);
  const cuirass = shadowed(new THREE.Mesh(
    new THREE.CylinderGeometry(H * 0.128, H * 0.135, H * 0.20, 12),
    STD({ color: C.cinnabar, roughness: 0.6 })));
  cuirass.position.y = H * 0.20;
  cuirass.scale.z = 0.82;
  r.body.add(cuirass);

  // spear, gripped upright in the right hand
  const spear = new THREE.Group();
  const shaft = shadowed(new THREE.Mesh(
    new THREE.CylinderGeometry(H * 0.013, H * 0.013, H * 1.25, 7), STD({ color: 0x5d4326 })));
  spear.add(shaft);
  const tip = new THREE.Mesh(new THREE.ConeGeometry(H * 0.030, H * 0.15, 6),
    STD({ color: 0xd6dde6, metalness: 0.9, roughness: 0.2 }));
  tip.position.y = H * 0.70;
  spear.add(tip);
  const tassel = new THREE.Mesh(new THREE.ConeGeometry(H * 0.026, H * 0.07, 6), STD({ color: C.cinnabar }));
  tassel.position.y = H * 0.60;
  tassel.rotation.x = Math.PI;
  spear.add(tassel);
  spear.position.set(0, -r.armR.end - H * 0.36, 0);
  r.armR.lower.add(spear);
  r.spear = spear;
  r.lockArmR = true;
  r.armR.root.rotation.x = -0.15;

  a.userData.kind = 'soldier';
  return a;
}

// ---------------------------------------------------------------------------
//  A small monkey of 花果山 — Wukong's subjects, built cheap and used in bulk.
// ---------------------------------------------------------------------------
function makeMonkeySmall(scale = 1) {
  const fur = STD({ color: pick([0xa8794a, 0xb98a55, 0x94663a]), roughness: 1.0 });
  const face = STD({ color: C.furLight, roughness: 1.0 });
  const g = new THREE.Group();
  const s = 0.9 * scale;
  const body = shadowed(new THREE.Mesh(new THREE.CapsuleGeometry(0.20 * s, 0.28 * s, 3, 8), fur));
  body.position.y = 0.44 * s;
  g.add(body);
  const head = shadowed(new THREE.Mesh(new THREE.SphereGeometry(0.19 * s, 9, 8), fur));
  head.position.y = 0.80 * s;
  g.add(head);
  const muzzle = new THREE.Mesh(new THREE.SphereGeometry(0.11 * s, 8, 6), face);
  muzzle.position.set(0, 0.77 * s, 0.14 * s);
  muzzle.scale.set(1.1, 0.85, 1);
  g.add(muzzle);
  for (const sx of [-1, 1]) {
    const ear = new THREE.Mesh(new THREE.SphereGeometry(0.06 * s, 6, 5), face);
    ear.position.set(sx * 0.185 * s, 0.82 * s, 0);
    ear.scale.x = 0.5;
    g.add(ear);
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.028 * s, 6, 5), BASIC({ color: 0x14161c }));
    eye.position.set(sx * 0.065 * s, 0.855 * s, 0.165 * s);
    g.add(eye);
    const arm = shadowed(new THREE.Mesh(new THREE.CapsuleGeometry(0.055 * s, 0.28 * s, 3, 6), fur));
    arm.position.set(sx * 0.24 * s, 0.44 * s, 0);
    arm.rotation.z = sx * 0.35;
    g.add(arm);
    const leg = shadowed(new THREE.Mesh(new THREE.CapsuleGeometry(0.065 * s, 0.24 * s, 3, 6), fur));
    leg.position.set(sx * 0.11 * s, 0.17 * s, 0);
    g.add(leg);
  }
  const tailCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0.34 * s, -0.16 * s),
    new THREE.Vector3(0, 0.52 * s, -0.42 * s),
    new THREE.Vector3(0, 0.86 * s, -0.44 * s),
  ]);
  g.add(new THREE.Mesh(new THREE.TubeGeometry(tailCurve, 12, 0.035 * s, 5, false), fur));
  g.userData.monkey = { body, head, base: 0.44 * s, phase: rand(0, TAU) };
  return g;
}

function monkeyIdle(m, t) {
  const d = m.userData.monkey;
  const p = t * 2.4 + d.phase;
  d.body.position.y = d.base + Math.abs(Math.sin(p)) * 0.06;
  d.head.rotation.y = Math.sin(p * 0.7) * 0.5;
  m.rotation.y = m.userData.baseRotY !== undefined
    ? m.userData.baseRotY + Math.sin(p * 0.31) * 0.25
    : m.rotation.y;
}
