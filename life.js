// 図書館のまわりの暮らし：湖畔・桟橋の釣り人・焚き火・ベンチのふたり・木陰のカフェ・ビアガーデン
// そして館内で「ぼくの本」を読む人たち。新しい場所は AREAS に足していけば広げられる。
import * as THREE from 'three';
import { WALK_SPEED_AT_1X, CHAR_SCALE } from './characters.js';
import { RECS, isRead } from './books.js';
import { rand, pick } from './util.js';

export const LAKE = { x: -48, z: 31, rx: 13, rz: 9 };
export const CAMP = { x: -33, z: 14 };
export const BEER = { x: 21, z: 44.6 };
const PIER = { x0: -44.2, x1: -34.6, z: 31, w: 1.6, y: 0.14 };
const HIP = 0.4 * CHAR_SCALE;

const std = (o) => new THREE.MeshStandardMaterial(o);

export function createLife({ scene, M, flameTex, colliders, world }) {
  const addCol = (x0, x1, z0, z1) => colliders.push({ x0, x1, z0, z1 });
  const box = (mat, w, h, d, x, y, z, parent, cast = true) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y, z); m.castShadow = cast; m.receiveShadow = true; (parent || scene).add(m); return m; };
  const wood = M.walnut, woodDark = M.walnutDark;

  // ---------------- 歩ける場所を広げる（草原・生け垣の門・桟橋）
  world.addWalk({ x0: -72, x1: -24.2, z0: 4, z1: 58 });
  world.addWalk({ x0: -25, x1: -22.4, z0: 35.9, z1: 40.1 });
  world.addWalk({ x0: PIER.x0, x1: PIER.x1 + 0.6, z0: PIER.z - 0.65, z1: PIER.z + 0.65 });
  world.addBlock((x, z) => {
    if (x >= PIER.x0 && x <= PIER.x1 + 0.6 && Math.abs(z - PIER.z) <= 0.65) return false;
    const dx = (x - LAKE.x) / (LAKE.rx - 0.5), dz = (z - LAKE.z) / (LAKE.rz - 0.5);
    return dx * dx + dz * dz < 1;
  });

  // ---------------- 湖
  const lake = new THREE.Group();
  scene.add(lake);
  {
    const shore = new THREE.Mesh(new THREE.CircleGeometry(1, 72), std({ color: 0xcdbb8e, roughness: 1 }));
    shore.scale.set(LAKE.rx + 1.8, LAKE.rz + 1.8, 1); shore.rotation.x = -Math.PI / 2; shore.position.set(LAKE.x, 0.004, LAKE.z); shore.receiveShadow = true; lake.add(shore);
    const water = new THREE.Mesh(new THREE.CircleGeometry(1, 72), std({ color: 0x2f6a86, roughness: 0.08, metalness: 0.45, transparent: true, opacity: 0.92, emissive: 0x0b2a3a, emissiveIntensity: 0.6 }));
    water.scale.set(LAKE.rx, LAKE.rz, 1); water.rotation.x = -Math.PI / 2; water.position.set(LAKE.x, 0.012, LAKE.z); lake.add(water);
    lake.userData.water = water;
    // 睡蓮の葉と、岸辺の葦
    const pad = std({ color: 0x3f7a3a, roughness: 0.6 });
    for (let i = 0; i < 26; i++) {
      const a = rand(0, Math.PI * 2), r = rand(0.55, 0.92);
      const p = new THREE.Mesh(new THREE.CircleGeometry(rand(0.25, 0.45), 14, 0.3, Math.PI * 1.85), pad);
      p.rotation.x = -Math.PI / 2; p.rotation.z = rand(0, 6); p.position.set(LAKE.x + Math.cos(a) * LAKE.rx * r, 0.02, LAKE.z + Math.sin(a) * LAKE.rz * r); lake.add(p);
      if (i % 4 === 0) { const f = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6), std({ color: 0xf3c6d6, roughness: 0.5 })); f.position.set(p.position.x + 0.1, 0.06, p.position.z); lake.add(f); }
    }
    const reedM = std({ color: 0x6b7a3a, roughness: 1 });
    const reedG = new THREE.CylinderGeometry(0.02, 0.03, 1.2, 4); reedG.translate(0, 0.6, 0);
    const reeds = new THREE.InstancedMesh(reedG, reedM, 220);
    const d = new THREE.Object3D();
    for (let i = 0; i < 220; i++) {
      const a = rand(Math.PI * 0.55, Math.PI * 1.75), r = rand(0.97, 1.08);
      d.position.set(LAKE.x + Math.cos(a) * LAKE.rx * r, 0, LAKE.z + Math.sin(a) * LAKE.rz * r);
      d.rotation.set(rand(-0.15, 0.15), 0, rand(-0.15, 0.15)); d.scale.setScalar(rand(0.7, 1.3)); d.updateMatrix(); reeds.setMatrixAt(i, d.matrix);
    }
    lake.add(reeds);
    // 木の桟橋
    const deckLen = PIER.x1 - PIER.x0;
    box(wood, deckLen, 0.08, PIER.w, (PIER.x0 + PIER.x1) / 2, PIER.y, PIER.z, lake);
    for (let x = PIER.x0 + 0.1; x < PIER.x1; x += 0.32) box(woodDark, 0.02, 0.085, PIER.w, x, PIER.y + 0.002, PIER.z, lake, false);
    for (let x = PIER.x0 + 0.2; x < PIER.x1; x += 2.2) [-1, 1].forEach((s) => box(woodDark, 0.14, 0.9, 0.14, x, -0.2, PIER.z + s * (PIER.w / 2 - 0.05), lake));
    // 小舟
    const boat = new THREE.Group(); boat.position.set(-52, 0.05, 25); boat.rotation.y = 0.6; lake.add(boat);
    box(std({ color: 0x8a4b2a, roughness: 0.7 }), 2.4, 0.3, 0.9, 0, 0.1, 0, boat);
    box(std({ color: 0xe9dcc2, roughness: 0.8 }), 2.2, 0.06, 0.75, 0, 0.24, 0, boat, false);
    lake.userData.boat = boat;
  }

  // ---------------- 焚き火
  const fire = { light: null, flames: [], sparks: null };
  {
    const g = new THREE.Group(); g.position.set(CAMP.x, 0, CAMP.z); scene.add(g);
    const stone = std({ color: 0x8a8580, roughness: 1, flatShading: true });
    for (let i = 0; i < 10; i++) { const a = (i / 10) * Math.PI * 2; const s = new THREE.Mesh(new THREE.DodecahedronGeometry(0.17), stone); s.position.set(Math.cos(a) * 0.62, 0.08, Math.sin(a) * 0.62); s.castShadow = true; g.add(s); }
    const logM = std({ color: 0x5a3a22, roughness: 1 });
    for (let i = 0; i < 4; i++) { const l = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.07, 0.9, 6), logM); l.rotation.z = Math.PI / 2 - 0.35; l.rotation.y = (i / 4) * Math.PI; l.position.y = 0.18; g.add(l); }
    const ember = new THREE.Mesh(new THREE.CircleGeometry(0.42, 16), new THREE.MeshBasicMaterial({ color: 0xff6a1a })); ember.rotation.x = -Math.PI / 2; ember.position.y = 0.03; g.add(ember);
    for (let i = 0; i < 3; i++) {
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: flameTex, color: i ? 0xffb050 : 0xffe0a0, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
      sp.position.set(rand(-0.12, 0.12), 0.55, rand(-0.12, 0.12)); sp.scale.set(0.8, 1.2, 1); g.add(sp); fire.flames.push(sp);
    }
    fire.light = new THREE.PointLight(0xff8a3c, 1.2, 14, 1.6); fire.light.position.set(0, 1.0, 0); g.add(fire.light);
    const N = 60; const pos = new Float32Array(N * 3); const life = [];
    for (let i = 0; i < N; i++) life.push({ t: rand(0, 2), vx: rand(-0.15, 0.15), vz: rand(-0.15, 0.15), v: rand(0.6, 1.2) });
    const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const sparks = new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xffb060, size: 0.05, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false }));
    g.add(sparks); fire.sparks = { pos, life, sg, N };
    addCol(CAMP.x - 0.9, CAMP.x + 0.9, CAMP.z - 0.9, CAMP.z + 0.9);
  }
  // 焚き火を囲む丸太の椅子
  const campSeats = [0, 1, 2, 3].map((k) => {
    const a = k * Math.PI / 2 + Math.PI / 4;
    const x = CAMP.x + Math.cos(a) * 2.3, z = CAMP.z + Math.sin(a) * 2.3;
    const log = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 1.3, 10), std({ color: 0x6b4a2e, roughness: 1 }));
    log.rotation.z = Math.PI / 2; log.rotation.y = -a + Math.PI / 2; log.position.set(x, 0.2, z); log.castShadow = true; scene.add(log);
    addCol(x - 0.4, x + 0.4, z - 0.4, z + 0.4);
    return { x, z, ry: Math.atan2(CAMP.x - x, CAMP.z - z), h: 0.42 };
  });

  // ---------------- ベンチ・カフェの机・ビアガーデン
  function bench(x, z, ry) {
    const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = ry; scene.add(g);
    box(wood, 1.8, 0.07, 0.5, 0, 0.46, 0, g); box(wood, 1.8, 0.45, 0.06, 0, 0.75, -0.24, g);
    [-0.75, 0.75].forEach((dx) => box(M.iron, 0.08, 0.44, 0.45, dx, 0.22, 0, g));
    addCol(x - 1, x + 1, z - 1, z + 1);
    const at = (lx) => ({ x: x + lx * Math.cos(ry), z: z - lx * Math.sin(ry), ry, h: 0.48 });
    return [at(-0.42), at(0.42)];
  }
  const faceLake = (x, z) => Math.atan2(LAKE.x - x, LAKE.z - z);
  const coupleBench = bench(-37.5, 44, faceLake(-37.5, 44));
  const benchB = bench(-58, 45.2, faceLake(-58, 45.2));
  const benchC = bench(-62, 21, faceLake(-62, 21));

  const cupM = std({ color: 0xf5f0e6, roughness: 0.3 });
  const beerM = std({ color: 0xd99a2b, roughness: 0.25, transparent: true, opacity: 0.9 });
  const foamM = std({ color: 0xfffbea, roughness: 0.9 });
  function cup(x, y, z) { const c = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.035, 0.09, 12), cupM); c.position.set(x, y + 0.045, z); scene.add(c); const s = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.01, 14), cupM); s.position.set(x, y + 0.005, z); scene.add(s); return c; }
  function mug(x, y, z) { const m = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.16, 12), beerM); m.position.set(x, y + 0.08, z); scene.add(m); const f = new THREE.Mesh(new THREE.CylinderGeometry(0.062, 0.062, 0.03, 12), foamM); f.position.set(x, y + 0.17, z); scene.add(f); return m; }

  function cafeTable(x, z) {
    const top = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 0.04, 24), M.marble); top.position.set(x, 0.74, z); top.castShadow = true; scene.add(top);
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.2, 0.72, 10), M.iron); leg.position.set(x, 0.36, z); scene.add(leg);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 2.3, 6), M.iron); pole.position.set(x, 1.15, z); scene.add(pole);
    const shade = new THREE.Mesh(new THREE.ConeGeometry(1.4, 0.55, 12, 1, true), std({ color: 0xf2e6c8, roughness: 0.9, side: THREE.DoubleSide })); shade.position.set(x, 2.25, z); shade.castShadow = true; scene.add(shade);
    addCol(x - 0.7, x + 0.7, z - 0.7, z + 0.7);
    return [-1, 1].map((s) => {
      const cx = x + s * 0.95;
      box(wood, 0.42, 0.05, 0.42, cx, 0.46, z); box(wood, 0.05, 0.45, 0.42, cx + s * 0.2, 0.7, z);
      [[-0.17, -0.17], [0.17, -0.17], [-0.17, 0.17], [0.17, 0.17]].forEach(([a, b]) => box(M.iron, 0.03, 0.44, 0.03, cx + a, 0.22, z + b, null, false));
      return { x: cx, z, ry: s > 0 ? -Math.PI / 2 : Math.PI / 2, h: 0.48, top: 0.76 };
    });
  }
  const cafe1 = cafeTable(-29.5, 28);
  const cafe2 = cafeTable(-31, 51);

  // ビアガーデン（長机・長椅子・電球の飾り）
  const beerSeats = [];
  {
    const { x, z } = BEER;
    box(woodDark, 4.2, 0.07, 0.9, x, 0.76, z); [-1.8, 1.8].forEach((dx) => box(woodDark, 0.08, 0.72, 0.8, x + dx, 0.38, z));
    [-1, 1].forEach((s) => { box(wood, 4.2, 0.06, 0.32, x, 0.46, z + s * 0.75); [-1.8, 1.8].forEach((dx) => box(woodDark, 0.06, 0.44, 0.3, x + dx, 0.22, z + s * 0.75)); });
    addCol(x - 2.3, x + 2.3, z - 1.1, z + 1.1);
    [-1.3, 0.2, 1.4].forEach((dx, i) => [-1, 1].forEach((s) => { if (i === 1 && s > 0) return; beerSeats.push({ x: x + dx, z: z + s * 0.75, ry: s < 0 ? 0 : Math.PI, h: 0.48, top: 0.8 }); }));
    for (let k = 0; k < 6; k++) mug(x - 1.6 + k * 0.62, 0.8, z + (k % 2 ? 0.18 : -0.2));
    const poleX = [x - 3.4, x + 3.4];
    poleX.forEach((px) => { box(M.iron, 0.08, 3.2, 0.08, px, 1.6, z); addCol(px - 0.2, px + 0.2, z - 0.2, z + 0.2); });
    const bulbM = new THREE.MeshBasicMaterial({ color: 0xffd58a });
    const n = 16;
    for (let i = 0; i <= n; i++) {
      const t = i / n; const bx = poleX[0] + (poleX[1] - poleX[0]) * t; const by = 3.1 - Math.sin(t * Math.PI) * 0.6;
      const b = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), bulbM); b.position.set(bx, by, z); scene.add(b);
    }
    fire.bulbs = bulbM;
  }

  // ---------------- 本・カップの小物
  const coverMats = [0x7a1f1f, 0x2c3d6b, 0x2f5a3a, 0x6b4226, 0x4f2f63].map((c) => std({ color: c, roughness: 0.6 }));
  const pageM = std({ color: 0xf4ecd8, roughness: 0.9 });
  function openBook(x, y, z, ry, tilt = 0.25) {
    const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = ry; scene.add(g);
    const cm = pick(coverMats);
    [-1, 1].forEach((s) => {
      const half = new THREE.Group(); half.rotation.z = s * -tilt; g.add(half);
      const c = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.008, 0.21), cm); c.position.set(s * 0.075, 0, 0); half.add(c);
      const p = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.012, 0.2), pageM); p.position.set(s * 0.072, 0.009, 0); half.add(p);
    });
    return g;
  }
  // 本の題名：ぼくが読んだ本（図書館で借りた本・読了の本）から選ぶ
  function bookPool() { const mine = RECS.filter((r) => r.fromLib || isRead(r)); return mine.length ? mine : RECS; }
  const pickRec = () => { const p = bookPool(); return p.length ? pick(p) : null; };

  // ---------------- 人々（キャラクターが読み込まれてから）
  const folk = [];
  let ready = false;
  // ドワーフ：背が低くがっしり、豊かなひげと三つ編み
  const BEARDS = [0xb5532a, 0x6b3f22, 0x9a948c, 0x3a2a20, 0xd08a3a];
  function dwarfify(a, color) {
    const inner = a.root.children[0];
    inner.scale.set(CHAR_SCALE * 1.14, CHAR_SCALE * 0.78, CHAR_SCALE * 1.14);
    const head = a.root.getObjectByName('head');
    if (!head) return a;
    const m = std({ color, roughness: 0.85 });
    const beard = new THREE.Mesh(new THREE.ConeGeometry(0.42, 0.95, 12), m);
    beard.rotation.x = Math.PI; beard.scale.set(1, 1, 0.55); beard.position.set(0, -0.2, 0.43); beard.castShadow = true; head.add(beard);
    const mus = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.06, 6, 16, Math.PI), m); mus.rotation.z = Math.PI; mus.position.set(0, 0.2, 0.56); head.add(mus);
    [-1, 1].forEach((s) => {
      const br = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.035, 0.55, 6), m); br.position.set(s * 0.2, -0.62, 0.42); head.add(br);
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.055, 0.02, 6, 12), M.gold); ring.rotation.x = Math.PI / 2; ring.position.set(s * 0.2, -0.78, 0.42); head.add(ring);
    });
    a.dwarf = true;
    return a;
  }
  function sit(cast, model, gear, seat, dwarf) {
    const a = cast.spawn(model, { gear });
    if (dwarf) dwarfify(a, pick(BEARDS));
    const sy = dwarf ? 0.78 : 1, sx = dwarf ? 1.14 : 1;
    a.root.position.set(seat.x + Math.sin(seat.ry) * HIP * sx, (seat.h || 0.48) - 0.38 * sy, seat.z + Math.cos(seat.ry) * HIP * sx);
    a.root.rotation.y = seat.ry;
    scene.add(a.root);
    const act = a.play('Sit_Chair_Idle');
    if (act) act.time = rand(0, 3);
    return a;
  }
  function attach(cast, people) {
    const add = (o) => { folk.push(o); return o; };
    // 湖畔のベンチ：湖を眺めるふたり、ひとりで本を読む人
    add({ a: sit(cast, 'Rogue', [], coupleBench[0]), kind: 'couple', hours: [8, 21.5] });
    add({ a: sit(cast, 'Mage', [], coupleBench[1]), kind: 'couple', hours: [8, 21.5] });
    [benchB[0], benchC[1]].forEach((s, i) => {
      const a = sit(cast, i ? 'Rogue_Hooded' : 'Knight', [], s);
      const b = openBook(s.x + Math.sin(s.ry) * 0.5, 0.82, s.z + Math.cos(s.ry) * 0.5, s.ry, 0.35); b.rotation.x = -0.7;
      add({ a, kind: 'read', rec: pickRec(), props: [b], hours: [7, 18.5] });
    });
    // 木陰のカフェ：並んで読むふたり、コーヒーで談笑するふたり
    cafe1.forEach((s, i) => {
      const a = sit(cast, i ? 'Mage' : 'Rogue', [], s);
      const fx = Math.sin(s.ry), fz = Math.cos(s.ry);
      const b = openBook(s.x + fx * 0.62, s.top, s.z + fz * 0.62, s.ry + Math.PI / 2);
      const c = cup(s.x + fx * 0.55 + fz * 0.25, s.top, s.z + fz * 0.55 - fx * 0.25);
      add({ a, kind: 'cafe', rec: pickRec(), props: [b, c], hours: [8, 19] });
    });
    cafe2.forEach((s, i) => {
      const a = sit(cast, i ? 'Knight' : 'Rogue_Hooded', [], s);
      const fx = Math.sin(s.ry), fz = Math.cos(s.ry);
      const c = cup(s.x + fx * 0.6, s.top, s.z + fz * 0.6);
      add({ a, kind: 'coffee', props: [c], hours: [8, 19] });
    });
    // 焚き火：読んだ本の話をする仲間（ビールを片手に）
    campSeats.forEach((s, i) => {
      const model = ['Barbarian', 'Mage', 'Rogue', 'Knight'][i];
      const a = sit(cast, model, model === 'Barbarian' ? ['Mug'] : (model === 'Mage' ? ['Spellbook_open'] : []), s, model === 'Barbarian');
      add({ a, kind: i === 1 ? 'campread' : 'camp', rec: pickRec(), hours: [0, 24], cheer: rand(6, 16), dwarf: model === 'Barbarian' });
    });
    // 桟橋の釣り人
    [[-43.3, 30.55], [-43.3, 31.45]].forEach(([x, z], i) => {
      box(woodDark, 0.4, 0.32, 0.4, x - 0.35, PIER.y + 0.2, z);
      const s = { x: x - 0.35, z, ry: -Math.PI / 2, h: PIER.y + 0.36 };
      const a = sit(cast, i ? 'Barbarian' : 'Rogue_Hooded', [], s, !!i);
      const rodBase = new THREE.Vector3(x - 0.75, 0.9, z + (i ? 0.12 : -0.12));
      const tip = new THREE.Vector3(x - 2.7, 2.3, z + (i ? 0.6 : -0.6));
      const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.02, rodBase.distanceTo(tip), 5), std({ color: 0x3a2a1a, roughness: 0.6 }));
      rod.position.copy(rodBase).add(tip).multiplyScalar(0.5);
      rod.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), tip.clone().sub(rodBase).normalize());
      scene.add(rod);
      const bob = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), std({ color: 0xd9463b, roughness: 0.4 }));
      bob.position.set(tip.x - 0.4, 0.03, tip.z + (i ? 0.5 : -0.5)); scene.add(bob);
      const lg = new THREE.BufferGeometry().setFromPoints([tip, bob.position.clone()]);
      const line = new THREE.Line(lg, new THREE.LineBasicMaterial({ color: 0xdddddd, transparent: true, opacity: 0.6 }));
      scene.add(line);
      add({ a, kind: 'fish', props: [rod, bob, line], fish: { bob, lg, tip, t: rand(0, 6), bite: rand(8, 25) }, hours: [5, 19.5], dwarf: !!i });
    });
    // ビアガーデン：乾杯する人たち
    beerSeats.forEach((s, i) => {
      const dw = i % 2 === 0;
      const model = dw ? 'Barbarian' : ['Knight', 'Rogue', 'Mage'][i % 3];
      const a = sit(cast, model, dw ? ['Mug'] : [], s, dw);
      add({ a, kind: 'beer', hours: [15, 24], cheer: rand(4, 14), dwarf: dw });
    });
    // 前庭のベンチで読む人
    [{ x: -12 + 0.4, z: 36, ry: 0, h: 0.48 }, { x: 4.5, z: 38.1, ry: Math.PI / 2, h: 0.48 }].forEach((s, i) => {
      const a = sit(cast, i ? 'Mage' : 'Rogue', [], s);
      const b = openBook(s.x + Math.sin(s.ry) * 0.5, 0.82, s.z + Math.cos(s.ry) * 0.5, s.ry, 0.35); b.rotation.x = -0.7;
      add({ a, kind: 'read', rec: pickRec(), props: [b], hours: [7, 18.5] });
    });
    // 前庭と中庭を見回るドワーフ
    const LOOP = [[1, 29.5], [13, 30.5], [15, 38.5], [30, 38.5], [34, 22], [34, -12], [22, -15], [14, -2], [14, 29.5]];
    [0, 1].forEach((k) => {
      const a = dwarfify(cast.spawn('Barbarian', { gear: k ? ['1H_Axe'] : ['Mug'] }), pick(BEARDS));
      const i0 = k * 4;
      a.root.position.set(LOOP[i0][0], 0, LOOP[i0][1]);
      scene.add(a.root);
      a.play('Walking_A', { timeScale: 0.62 / (WALK_SPEED_AT_1X * 0.78) });
      add({ a, kind: 'dwarfwalk', walk: { i: (i0 + 1) % LOOP.length, loop: LOOP, sp: 0.62, rest: 0 }, hours: [6, 23], dwarf: true, axe: !!k });
    });
    // 湖畔を散歩するふたり
    const stroll = { ang: rand(0, 6), r1: LAKE.rx + 4, r2: LAKE.rz + 4, sp: 0.5 };
    [0, 1].forEach((k) => {
      const a = cast.spawn(k ? 'Mage' : 'Knight', { gear: [] });
      scene.add(a.root);
      a.play('Walking_B', { timeScale: stroll.sp / WALK_SPEED_AT_1X });
      add({ a, kind: 'stroll', side: k ? 0.36 : -0.36, stroll, hours: [7, 21] });
    });
    // 館内で座って読む人に、ぼくの本と飲み物を
    (people && people.seated ? people.seated : []).forEach((s, i) => {
      const fx = Math.sin(s.ry), fz = Math.cos(s.ry);
      const props = [];
      if (s.a.model !== 'Mage') props.push(openBook(s.x + fx * 0.66, s.top, s.z + fz * 0.66, s.ry + Math.PI / 2));
      if (i % 3 === 0) props.push(i % 2 ? mug(s.x + fx * 0.6 + fz * 0.3, s.top, s.z + fz * 0.6 - fx * 0.3) : cup(s.x + fx * 0.6 + fz * 0.3, s.top, s.z + fz * 0.6 - fx * 0.3));
      add({ a: s.a, kind: 'inside', rec: pickRec(), props, inside: true, drink: i % 3 === 0 ? (i % 2 ? 'beer' : 'coffee') : '' });
    });
    ready = true;
  }

  // ---------------- 毎フレーム
  const tmp = new THREE.Vector3();
  function inHours(h, [a, b]) { return a <= b ? h >= a && h < b : h >= a || h < b; }
  function update(dt, time, player, hour) {
    // 湖と焚き火
    const w = lake.userData.water;
    w.material.emissiveIntensity = 0.55 + Math.sin(time * 0.8) * 0.08;
    lake.userData.boat.position.y = 0.05 + Math.sin(time * 1.3) * 0.03;
    lake.userData.boat.rotation.z = Math.sin(time * 0.9) * 0.03;
    const night = hour < 6 || hour > 18.5;
    fire.light.intensity = (night ? 2.2 : 0.7) * (0.85 + Math.sin(time * 13) * 0.08 + Math.sin(time * 7.3) * 0.07);
    fire.flames.forEach((f, i) => { const s = 1 + Math.sin(time * (9 + i * 2.3) + i) * 0.15; f.scale.set(0.75 * s, (1.1 + i * 0.12) * (2 - s), 1); f.position.y = 0.5 + i * 0.06; });
    const sp = fire.sparks;
    for (let i = 0; i < sp.N; i++) {
      const L = sp.life[i]; L.t += dt; if (L.t > 2) { L.t = 0; L.vx = rand(-0.15, 0.15); L.vz = rand(-0.15, 0.15); L.v = rand(0.6, 1.2); }
      sp.pos[i * 3] = L.vx * L.t * 2; sp.pos[i * 3 + 1] = 0.4 + L.v * L.t; sp.pos[i * 3 + 2] = L.vz * L.t * 2;
    }
    sp.sg.attributes.position.needsUpdate = true;
    fire.bulbs.color.setHex(night ? 0xffd58a : 0x9a8a6a);
    if (!ready) return;
    const px = player ? player.x : 0, pz = player ? player.z : 0;
    folk.forEach((f) => {
      const r = f.a.root;
      if (f.inside) { (f.props || []).forEach((p) => { p.visible = r.visible; }); return; }
      const on = inHours(hour, f.hours || [0, 24]);
      r.visible = on; (f.props || []).forEach((p) => { p.visible = on; });
      if (!on) return;
      const near = !player || Math.hypot(r.position.x - px, r.position.z - pz) < 45;
      if (f.kind === 'stroll') {
        const s = f.stroll;
        if (f.side < 0) s.ang += (s.sp / ((s.r1 + s.r2) / 2)) * dt;
        const c = Math.cos(s.ang), si = Math.sin(s.ang);
        const tx = -s.r1 * si, tz = s.r2 * c; const tl = Math.hypot(tx, tz) || 1;
        r.position.set(LAKE.x + s.r1 * c + (-tz / tl) * f.side, 0, LAKE.z + s.r2 * si + (tx / tl) * f.side);
        r.rotation.y = Math.atan2(tx, tz);
      }
      if (f.walk) {
        const W = f.walk;
        if (W.rest > 0) { W.rest -= dt; if (W.rest <= 0 && near) f.a.play('Walking_A', { timeScale: W.sp / (WALK_SPEED_AT_1X * 0.78) }); }
        else {
          const t = W.loop[W.i]; const dx = t[0] - r.position.x, dz = t[1] - r.position.z, d = Math.hypot(dx, dz);
          if (d < 0.1) { W.i = (W.i + 1) % W.loop.length; if (Math.random() < 0.3) { W.rest = rand(4, 9); if (near) f.a.play(Math.random() < 0.5 ? 'Cheer' : 'Idle'); } }
          else { const st = Math.min(d, W.sp * dt); r.position.x += dx / d * st; r.position.z += dz / d * st; const ty = Math.atan2(dx, dz); let dy = ty - r.rotation.y; dy = Math.atan2(Math.sin(dy), Math.cos(dy)); r.rotation.y += dy * Math.min(1, dt * 6); }
        }
      }
      if (f.fish) {
        const F = f.fish; F.t += dt;
        const biting = F.t > F.bite && F.t < F.bite + 1.6;
        F.bob.position.y = 0.03 + Math.sin(time * 2 + F.bite) * 0.012 - (biting ? 0.05 + Math.sin(F.t * 18) * 0.03 : 0);
        if (F.t > F.bite + 1.6) { F.t = 0; F.bite = rand(8, 25); if (near) f.a.play('Use_Item', { loop: false, fade: 0.2 }); }
        else if (near && f.a.current && !f.a.current.isRunning()) f.a.play('Sit_Chair_Idle');
        const arr = F.lg.attributes.position.array; arr[3] = F.bob.position.x; arr[4] = F.bob.position.y; arr[5] = F.bob.position.z; F.lg.attributes.position.needsUpdate = true;
      }
      if (f.cheer !== undefined && near) {
        f.cheer -= dt;
        if (f.cheer < 0) { f.cheer = rand(8, 20); f.a.play('Cheer', { loop: false, fade: 0.2 }); f.cheering = true; }
        else if (f.cheering && f.a.current && !f.a.current.isRunning()) { f.cheering = false; f.a.play('Sit_Chair_Idle'); }
      }
      if (near) f.a.mixer.update(dt);
    });
  }

  // ---------------- 見ている人の説明
  const T = (f) => { let t = f.rec ? String(f.rec.t) : '本'; for (const c of ['－', '―', '(', '（']) { const k = t.indexOf(c); if (k > 0) t = t.slice(0, k); } return '『' + (t.length > 28 ? t.slice(0, 27) + '…' : t) + '』'; };
  const LABEL = {
    couple: () => ['湖を眺めるふたり', '　肩を並べてのんびり'],
    read: (f) => [T(f), '　' + (f.rec && f.rec.a ? f.rec.a + '　' : '') + 'を読んでいる'],
    cafe: (f) => [T(f), '　コーヒーを片手に読んでいる'],
    coffee: () => ['木陰のカフェ', '　コーヒーで読書談義'],
    camp: (f) => [f.dwarf ? '焚き火のドワーフ' : '焚き火のまわり', '　' + (f.rec ? T(f) + 'の話で盛り上がっている' : '本の話で盛り上がっている')],
    campread: (f) => [T(f), '　焚き火の明かりで読んでいる'],
    fish: (f) => [f.dwarf ? 'ドワーフの釣り人' : '桟橋の釣り人', '　浮きをじっと見つめている'],
    beer: (f) => (f.dwarf ? ['ドワーフの酒盛り', '　ジョッキを掲げて乾杯！'] : ['ビアガーデン', '　ビールで乾杯！']),
    dwarfwalk: (f) => ['ドワーフ', f.axe ? '　斧をかついで見回り中' : '　ジョッキ片手にご機嫌で散歩中'],
    stroll: () => ['湖畔を散歩するふたり', ''],
    inside: (f) => [T(f), '　' + (f.drink === 'beer' ? 'ビールを片手に' : f.drink === 'coffee' ? 'コーヒーを片手に' : '') + 'ぼくの本を読んでいる'],
  };
  const fwd = new THREE.Vector3();
  function hint(camera, player) {
    const best = hintFolk(camera, player);
    if (!best) return null;
    return (LABEL[best.kind] || LABEL.read)(best);
  }
  // 読んでいる人をタップしたら、その本の記録を開けるように
  return { attach, update, hint, recAt: (camera, player) => { const h = hintFolk(camera, player); return h && h.rec ? h.rec : null; } };

  function hintFolk(camera, player) {
    if (!ready || !player) return null;
    camera.getWorldDirection(fwd); fwd.y = 0; fwd.normalize();
    let best = null, bd = 1e9;
    folk.forEach((f) => {
      const r = f.a.root; if (!r.visible) return;
      tmp.set(r.position.x - player.x, 0, r.position.z - player.z);
      const d = tmp.length(); if (d > 3.6 || d < 0.3) return;
      tmp.divideScalar(d);
      if (tmp.dot(fwd) < 0.93) return;
      if (d < bd) { bd = d; best = f; }
    });
    return best;
  }
}
