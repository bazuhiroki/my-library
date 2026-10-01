// 図書館の拡張：北の翼廊（論文の間・玄関ホール・雑誌の回廊）と、大扉の外の前庭
import * as THREE from 'three';

// 翼廊の大きさ（外壁の外側）
export const ANNEX = { x0: -30.6, x1: 30.6, z0: -35.2, z1: -22.6, H: 6.0 };
const IN = { x0: -30, x1: 30, z0: -34.6, z1: -23.2 };
const ARCH_X = 6;
const MINCHO = `'Shippori Mincho B1', 'Hiragino Mincho ProN', serif`;

// 歩ける範囲（長方形の集まり）
const REGIONS = [
  { x0: -5.75, x1: 5.75, z0: -21.5, z1: 21.5 }, // 身廊
  { x0: -1.35, x1: 1.35, z0: -23.9, z1: -21.2 }, // 北の出入口
  { x0: IN.x0 + 0.45, x1: IN.x1 - 0.45, z0: IN.z0 + 0.45, z1: IN.z1 - 0.3 }, // 翼廊
  { x0: -1.35, x1: 1.35, z0: 21.2, z1: 23.6 }, // 大扉
  { x0: -23, x1: 43, z0: 23.0, z1: 47 }, // 前庭
  { x0: 7.0, x1: 41.6, z0: -22.2, z1: 40 }, // 中庭
  { x0: 31.2, x1: 41.6, z0: -39.5, z1: -22.2 }, // 翼廊の東側
  { x0: 7.0, x1: 41.6, z0: -39.5, z1: -35.8 }, // 翼廊の裏
];

// 案内図から飛べる場所
export const WARPS = [
  { id: 'door', name: '大扉の前', area: 'hall', x: 0, z: 19.4, yaw: 0, pitch: 0.02 },
  { id: 'borrow', name: '貸出カウンター', area: 'hall', x: -1.9, z: 17.3, yaw: Math.PI / 2 - 0.35, pitch: -0.1 },
  { id: 'buy', name: '購入カウンター', area: 'hall', x: 1.9, z: 17.3, yaw: -Math.PI / 2 + 0.35, pitch: -0.1 },
  { id: 'globe', name: '大地球儀', area: 'hall', x: 0, z: 16.9, yaw: 0, pitch: -0.05 },
  { id: 'pile', name: '読みたい本の台', area: 'hall', x: 0, z: 9.75, yaw: Math.PI, pitch: -0.45 },
  { id: 'loan', name: '貸出の記録と未読の本（西の壁）', area: 'hall', x: -3.4, z: 2, yaw: Math.PI / 2, pitch: 0.05 },
  { id: 'prize', name: '文学賞の書架（東の壁）', area: 'hall', x: 3.4, z: -4, yaw: -Math.PI / 2, pitch: 0.05 },
  { id: 'rose', name: '薔薇窓の下', area: 'hall', x: 0, z: -19.2, yaw: 0, pitch: 0.55 },
  { id: 'lobby', name: '翼廊の玄関ホール', area: 'annex', x: 0, z: -24.6, yaw: 0, pitch: 0 },
  { id: 'papers', name: '論文の間', area: 'annex', x: -8.2, z: -28.6, yaw: Math.PI / 2, pitch: 0 },
  { id: 'mags', name: '雑誌の回廊', area: 'annex', x: 8.2, z: -28.6, yaw: -Math.PI / 2, pitch: 0 },
  { id: 'court0', name: '前庭（大扉の外）', area: 'out', x: 0, z: 25.2, yaw: Math.PI, pitch: 0.02 },
  { id: 'fountain', name: '噴水のほとり', area: 'out', x: -3.5, z: 39.4, yaw: Math.PI * 0.75, pitch: 0 },
  { id: 'court', name: '中庭', area: 'out', x: 16, z: 6, yaw: -Math.PI / 2, pitch: 0.05 },
  { id: 'lake', name: '湖の桟橋', area: 'out', x: -36.2, z: 32.6, yaw: Math.PI / 2 + 0.25, pitch: 0 },
  { id: 'camp', name: '焚き火', area: 'out', x: -33, z: 18.6, yaw: 0, pitch: -0.08 },
  { id: 'cafe', name: '木陰のカフェ', area: 'out', x: -27.4, z: 31.2, yaw: Math.PI * 0.15, pitch: -0.05 },
  { id: 'beer', name: 'ビアガーデン', area: 'out', x: 21, z: 41.8, yaw: Math.PI, pitch: -0.05 },
];

export function createWorld({ scene, box, mesh, M, textTex, colliders, tex, mapTex, W, L, weather }) {
  const walls = [];
  const T = (t, rx, ry) => { const c = t.clone(); c.needsUpdate = true; c.wrapS = c.wrapT = THREE.RepeatWrapping; c.repeat.set(rx, ry); return c; };
  const std = (o) => new THREE.MeshStandardMaterial(o);
  const plaster = std({ map: T(tex.plasterTex, 8, 2), color: 0xe9dcc2, roughness: 0.95 });
  const slate = std({ color: 0x3a4152, roughness: 0.8, flatShading: true });
  const stoneWall = std({ color: 0xb4a88f, roughness: 0.95 });
  const addCol = (x0, x1, z0, z1) => colliders.push({ x0, x1, z0, z1 });
  const plaque = (text, w, h, bg, fg, px, font) => {
    const t = textTex(text, 1024, Math.round(1024 * h / w), font || '800 ' + (px || 60) + 'px ' + MINCHO, bg || '#1f3a2d', fg || '#efd99a');
    return new THREE.Mesh(new THREE.PlaneGeometry(w, h), std({ map: t, roughness: 0.5, emissive: 0xffffff, emissiveMap: t, emissiveIntensity: 0.14 }));
  };

  // ================= 北の翼廊 =================
  const annex = new THREE.Group();
  scene.add(annex);
  // 床：論文の間は濃い寄木、玄関ホールは大理石、雑誌の回廊は明るい石
  const fl = (mat, x0, x1) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0, IN.z1 - IN.z0 + 0.6), mat); m.rotation.x = -Math.PI / 2; m.position.set((x0 + x1) / 2, 0.004, (IN.z0 + IN.z1 + 0.6) / 2); m.receiveShadow = true; annex.add(m); };
  fl(std({ map: T(tex.parquetTex, 6, 3), color: 0x8a6a52, roughness: 0.45 }), IN.x0, -ARCH_X);
  fl(M.marble, -ARCH_X, ARCH_X);
  fl(std({ map: T(tex.stoneTex, 6, 3), color: 0xf0e6d6, roughness: 0.7 }), ARCH_X, IN.x1);
  // 外壁
  const H = ANNEX.H;
  box(plaster, ANNEX.x1 - ANNEX.x0, H, 0.6, 0, H / 2, IN.z0 - 0.3, { parent: annex });
  box(plaster, 0.6, H, IN.z1 - IN.z0 + 0.6, IN.x0 - 0.3, H / 2, (IN.z0 + IN.z1) / 2 + 0.3, { parent: annex });
  box(plaster, 0.6, H, IN.z1 - IN.z0 + 0.6, IN.x1 + 0.3, H / 2, (IN.z0 + IN.z1) / 2 + 0.3, { parent: annex });
  box(plaster, 24.6, H, 0.6, -18.3, H / 2, IN.z1 + 0.3, { parent: annex });
  // 雑誌の回廊の南壁：中庭が見えるアーチ窓
  const MWIN = [12, 18.5, 25];
  {
    const s = new THREE.Shape();
    s.moveTo(6.6, 0); s.lineTo(IN.x1 + 0.6, 0); s.lineTo(IN.x1 + 0.6, H); s.lineTo(6.6, H); s.lineTo(6.6, 0);
    MWIN.forEach((cx) => { const p = new THREE.Path(); p.moveTo(cx - 1.1, 1.0); p.lineTo(cx + 1.1, 1.0); p.lineTo(cx + 1.1, 3.7); p.absarc(cx, 3.7, 1.1, 0, Math.PI, false); p.lineTo(cx - 1.1, 1.0); s.holes.push(p); });
    const m = new THREE.Mesh(new THREE.ExtrudeGeometry(s, { depth: 0.6, bevelEnabled: false, curveSegments: 20 }), plaster);
    m.position.z = IN.z1; m.castShadow = m.receiveShadow = true; annex.add(m);
    const glass = new THREE.MeshBasicMaterial({ color: 0xcfe3f2, transparent: true, opacity: 0.12, depthWrite: false });
    MWIN.forEach((cx) => {
      const sh = new THREE.Shape(); sh.moveTo(cx - 1.1, 1.0); sh.lineTo(cx + 1.1, 1.0); sh.lineTo(cx + 1.1, 3.7); sh.absarc(cx, 3.7, 1.1, 0, Math.PI, false); sh.lineTo(cx - 1.1, 1.0);
      const g = new THREE.Mesh(new THREE.ShapeGeometry(sh, 16), glass); g.position.z = IN.z1 + 0.3; annex.add(g);
      box(M.iron, 0.05, 3.8, 0.05, cx, 2.9, IN.z1 + 0.3, { parent: annex, cast: false });
      [2.1, 3.2].forEach((y) => box(M.iron, 2.2, 0.04, 0.05, cx, y, IN.z1 + 0.3, { parent: annex, cast: false }));
      box(M.walnutDark, 2.4, 0.07, 0.45, cx, 0.98, IN.z1 - 0.05, { parent: annex });
    });
  }
  // 天井：格天井の梁
  {
    const ceil = new THREE.Mesh(new THREE.PlaneGeometry(IN.x1 - IN.x0, IN.z1 - IN.z0), std({ color: 0x3b2616, roughness: 0.8 }));
    ceil.rotation.x = Math.PI / 2; ceil.position.set(0, H - 0.02, (IN.z0 + IN.z1) / 2); annex.add(ceil);
    for (let x = IN.x0 + 1.5; x < IN.x1; x += 3) box(M.walnutDark, 0.22, 0.3, IN.z1 - IN.z0, x, H - 0.17, (IN.z0 + IN.z1) / 2, { parent: annex, cast: false });
    [IN.z0 + 3, (IN.z0 + IN.z1) / 2, IN.z1 - 3].forEach((z) => box(M.walnutDark, IN.x1 - IN.x0, 0.24, 0.18, 0, H - 0.14, z, { parent: annex, cast: false }));
  }
  // 屋根（外から見える切妻）
  {
    const run = (ANNEX.z1 - ANNEX.z0) / 2 + 0.5;
    const rise = 1.35;
    const len = Math.hypot(run, rise);
    const ang = Math.atan2(rise, run);
    [-1, 1].forEach((s) => {
      const r = new THREE.Mesh(new THREE.BoxGeometry(ANNEX.x1 - ANNEX.x0 + 0.8, 0.18, len), slate);
      r.position.set(0, H + rise / 2, (ANNEX.z0 + ANNEX.z1) / 2 + s * run / 2);
      r.rotation.x = s * ang; r.castShadow = true; annex.add(r);
    });
    [ANNEX.x0 - 0.1, ANNEX.x1 + 0.1].forEach((x) => {
      const g = new THREE.Shape(); g.moveTo(ANNEX.z0 - 0.3, 0); g.lineTo(ANNEX.z1 + 0.3, 0); g.lineTo((ANNEX.z0 + ANNEX.z1) / 2, rise); g.lineTo(ANNEX.z0 - 0.3, 0);
      const m = new THREE.Mesh(new THREE.ShapeGeometry(g), plaster); m.rotation.y = -Math.PI / 2; m.position.set(x, H, 0); m.material.side = THREE.DoubleSide; annex.add(m);
    });
  }
  // 玄関ホールと両翼を分けるアーチ
  [-1, 1].forEach((side) => {
    const x = side * ARCH_X;
    const s = new THREE.Shape();
    s.moveTo(IN.z0, 0); s.lineTo(IN.z1, 0); s.lineTo(IN.z1, H); s.lineTo(IN.z0, H); s.lineTo(IN.z0, 0);
    const a0 = -33.0, a1 = -24.8, spring = 3.2, rx = (a1 - a0) / 2, ry = 1.9;
    const p = new THREE.Path(); p.moveTo(a0, 0); p.lineTo(a1, 0); p.lineTo(a1, spring); p.absellipse((a0 + a1) / 2, spring, rx, ry, 0, Math.PI, false); p.lineTo(a0, 0);
    s.holes.push(p);
    const m = new THREE.Mesh(new THREE.ExtrudeGeometry(s, { depth: 0.5, bevelEnabled: false, curveSegments: 28 }), plaster);
    m.rotation.y = -Math.PI / 2; m.position.x = x + 0.25; m.castShadow = m.receiveShadow = true; annex.add(m);
    const trim = new THREE.Mesh(new THREE.TorusGeometry(1, 0.07, 8, 40, Math.PI), M.gold);
    trim.scale.set(rx, ry, 1); trim.rotation.y = Math.PI / 2; trim.position.set(x, spring, (a0 + a1) / 2); annex.add(trim);
    [a0, a1].forEach((z) => {
      box(M.walnutDark, 0.62, spring, 0.18, x, spring / 2, z + (z === a0 ? 0.09 : -0.09), { parent: annex });
      const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.3, 0.26, 12), M.gold); cap.position.set(x, spring + 0.05, z); annex.add(cap);
    });
    addCol(x - 0.3, x + 0.3, IN.z0, a0);
    addCol(x - 0.3, x + 0.3, a1, IN.z1 + 0.6);
    const sign = plaque(side < 0 ? '論文の間' : '雑誌の回廊', 2.6, 0.5, '#1f3a2d', '#efd99a', 64);
    sign.position.set(x - side * 0.27, spring + ry + 0.36, (a0 + a1) / 2);
    sign.rotation.y = side < 0 ? Math.PI / 2 : -Math.PI / 2;
    annex.add(sign);
  });
  // 北の出入口の枠（身廊側と翼廊側）
  [-L + 0.02, -L - 0.62].forEach((z, k) => {
    const f = new THREE.Mesh(new THREE.TorusGeometry(1.5, 0.09, 8, 36, Math.PI), M.gold);
    f.position.set(0, 3.2, z); if (k) f.rotation.y = Math.PI; scene.add(f);
    [-1.5, 1.5].forEach((x) => box(M.gold, 0.18, 3.2, 0.08, x, 1.6, z, { cast: false }));
  });
  {
    const sign = plaque('翼廊へ　論文の間・雑誌の回廊', 3.4, 0.4, '#1f3a2d', '#efd99a', 52);
    sign.position.set(0, 5.0, -L + 0.05); scene.add(sign);
  }

  // ---- 玄関ホール：案内図・床の羅針盤・長椅子
  const boards = [];
  function mapBoard(x, z, ry, parent, w, h) {
    const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = ry; (parent || scene).add(g);
    box(M.walnutDark, w + 0.24, h + 0.24, 0.12, 0, 0.95 + h / 2, -0.04, { parent: g });
    const face = new THREE.Mesh(new THREE.PlaneGeometry(w, h), std({ map: mapTex, roughness: 0.6, emissive: 0xffffff, emissiveMap: mapTex, emissiveIntensity: 0.22 }));
    face.position.set(0, 0.95 + h / 2, 0.03); g.add(face); boards.push(face);
    const head = plaque('館内案内図', w * 0.55, 0.3, '#2c190c', '#efd99a', 70);
    head.position.set(0, 0.95 + h + 0.3, 0.03); g.add(head);
    [-1, 1].forEach((s) => box(M.walnutDark, 0.1, 0.95, 0.1, s * (w / 2 - 0.1), 0.475, -0.04, { parent: g }));
    return g;
  }
  mapBoard(0, IN.z0 + 0.12, 0, annex, 3.4, 2.4);
  mapBoard(2.6, -L + 1.1, 0, scene, 1.3, 0.95);
  addCol(1.8, 3.4, -L + 0.9, -L + 1.3);
  {
    const c = document.createElement('canvas'); c.width = c.height = 512;
    const x = c.getContext('2d');
    x.fillStyle = '#e8e2d6'; x.fillRect(0, 0, 512, 512);
    x.translate(256, 256);
    x.strokeStyle = '#b89a55'; x.lineWidth = 6; x.beginPath(); x.arc(0, 0, 240, 0, Math.PI * 2); x.stroke();
    x.lineWidth = 2; x.beginPath(); x.arc(0, 0, 200, 0, Math.PI * 2); x.stroke();
    for (let k = 0; k < 16; k++) {
      const a = k * Math.PI / 8; const r = k % 2 ? 120 : 196; const w = k % 2 ? 18 : 30;
      x.fillStyle = k % 4 === 0 ? '#7a1f1f' : (k % 2 ? '#c9a24b' : '#2c3d6b');
      x.beginPath(); x.moveTo(Math.cos(a) * r, Math.sin(a) * r); x.lineTo(Math.cos(a + Math.PI / 2) * w, Math.sin(a + Math.PI / 2) * w); x.lineTo(0, 0); x.lineTo(Math.cos(a - Math.PI / 2) * w, Math.sin(a - Math.PI / 2) * w); x.closePath(); x.fill();
    }
    x.fillStyle = '#2c190c'; x.font = '800 34px ' + MINCHO; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.fillText('北', 0, -222); x.fillText('南', 0, 222); x.fillText('東', 222, 0); x.fillText('西', -222, 0);
    const t = new THREE.CanvasTexture(c);
    const m = new THREE.Mesh(new THREE.CircleGeometry(2.3, 48), std({ map: t, roughness: 0.4 }));
    m.rotation.x = -Math.PI / 2; m.position.set(0, 0.008, -29.2); annex.add(m);
  }
  [-3.4, 3.4].forEach((x) => {
    box(M.walnut, 0.5, 0.08, 2.2, x, 0.46, -29.2, { parent: annex });
    box(M.walnut, 0.08, 0.5, 2.2, x + Math.sign(x) * 0.22, 0.75, -29.2, { parent: annex });
    [-0.9, 0.9].forEach((dz) => box(M.walnutDark, 0.42, 0.44, 0.08, x, 0.22, -29.2 + dz, { parent: annex }));
    addCol(x - 0.3, x + 0.3, -30.35, -28.05);
  });
  // シャンデリア（光る蝋燭の輪）
  const chandelier = (x, z, col) => {
    const g = new THREE.Group(); g.position.set(x, H - 1.5, z); annex.add(g);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.8, 0.04, 8, 32), M.gold); ring.rotation.x = Math.PI / 2; g.add(ring);
    box(M.iron, 0.03, 1.3, 0.03, 0, 0.75, 0, { parent: g, cast: false });
    const cm = std({ color: 0xf2ead6, emissive: col, emissiveIntensity: 0.9 });
    for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4; const c = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.16, 6), cm); c.position.set(Math.cos(a) * 0.8, 0.1, Math.sin(a) * 0.8); g.add(c); }
    const glow = new THREE.Mesh(new THREE.SphereGeometry(0.2, 12, 8), new THREE.MeshBasicMaterial({ color: col })); g.add(glow);
  };
  chandelier(0, -29.2, 0xffd9a0);
  chandelier(-18, -29, 0xdce8ff);
  chandelier(18, -29, 0xffdcaa);
  const lights = [
    new THREE.PointLight(0xffe0b0, 0.9, 20, 1.6),
    new THREE.PointLight(0xd6e4ff, 1.0, 28, 1.4),
    new THREE.PointLight(0xffe2b8, 1.0, 28, 1.4),
  ];
  lights[0].position.set(0, 4.6, -29); lights[1].position.set(-18, 4.4, -29); lights[2].position.set(18, 4.4, -29);
  lights.forEach((l) => annex.add(l));

  // ---- 論文の間：北壁の書架（論文の綴じ本が並ぶ）、閲覧机、カード目録、梯子
  const paperShelves = [];
  {
    const bays = [[-29.4, -22.2], [-21.8, -14.6], [-14.2, -7.0]];
    const TIERS = [0.12, 0.72, 1.32, 1.92, 2.52, 3.12, 3.72];
    const z = IN.z0;
    bays.forEach(([x0, x1], bi) => {
      box(M.walnutDark, x1 - x0 + 0.2, 4.6, 0.08, (x0 + x1) / 2, 2.3, z + 0.04, { parent: annex });
      [x0 - 0.05, x1 + 0.05].forEach((x) => box(M.walnutDark, 0.1, 4.6, 0.5, x, 2.3, z + 0.25, { parent: annex }));
      TIERS.forEach((y) => { box(M.walnut, x1 - x0, 0.04, 0.48, (x0 + x1) / 2, y - 0.02, z + 0.26, { parent: annex, cast: false }); paperShelves.push({ x0: x0 + 0.06, x1: x1 - 0.06, y, z: z + 0.27, bay: bi + 1, tier: TIERS.indexOf(y) + 1 }); });
      box(M.walnutDark, x1 - x0 + 0.3, 0.2, 0.56, (x0 + x1) / 2, 4.66, z + 0.28, { parent: annex });
      const lab = plaque(['第一書架', '第二書架', '第三書架'][bi], 1.6, 0.2, '#2c190c', '#efd99a', 90);
      lab.position.set((x0 + x1) / 2, 4.66, z + 0.57); annex.add(lab);
    });
    addCol(IN.x0, -6.9, IN.z0, IN.z0 + 0.62);
    // 梯子
    const lad = new THREE.Group(); lad.position.set(-18.2, 0, IN.z0 + 0.75); lad.rotation.x = -0.2; annex.add(lad);
    [-0.25, 0.25].forEach((x) => box(M.walnut, 0.05, 4.4, 0.05, x, 2.2, 0, { parent: lad }));
    for (let y = 0.3; y < 4.3; y += 0.36) box(M.walnut, 0.5, 0.035, 0.035, 0, y, 0, { parent: lad, cast: false });
    addCol(-18.6, -17.8, IN.z0, IN.z0 + 1.3);
    // 閲覧机
    [[-24.5, -28.6], [-13.5, -28.6]].forEach(([x, z]) => {
      box(M.walnutDark, 5, 0.08, 1.4, x, 0.78, z, { parent: annex });
      box(M.leather, 4.8, 0.01, 1.2, x, 0.825, z, { parent: annex, cast: false });
      [[-2.3, -0.6], [2.3, -0.6], [-2.3, 0.6], [2.3, 0.6]].forEach(([dx, dz]) => box(M.walnutDark, 0.1, 0.74, 0.1, x + dx, 0.37, z + dz, { parent: annex }));
      [-1.5, 1.5].forEach((dx) => {
        box(M.gold, 0.16, 0.03, 0.16, x + dx, 0.84, z, { parent: annex, cast: false });
        box(M.gold, 0.02, 0.34, 0.02, x + dx, 1.0, z, { parent: annex, cast: false });
        const sh = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.14, 0.42, 16, 1, true, 0, Math.PI), M.lampGreen);
        sh.rotation.z = Math.PI / 2; sh.position.set(x + dx, 1.18, z); annex.add(sh);
      });
      [-1.6, 0, 1.6].forEach((dx) => [-1, 1].forEach((s) => { box(M.walnut, 0.44, 0.06, 0.44, x + dx, 0.48, z + s * 1.0, { parent: annex }); box(M.walnut, 0.44, 0.6, 0.05, x + dx, 0.8, z + s * 1.21, { parent: annex }); }));
      addCol(x - 2.7, x + 2.7, z - 1.35, z + 1.35);
    });
    // カード目録（小さな引き出しがたくさん）
    const c = document.createElement('canvas'); c.width = 512; c.height = 256;
    const g = c.getContext('2d');
    g.fillStyle = '#4a2c18'; g.fillRect(0, 0, 512, 256);
    for (let r = 0; r < 6; r++) for (let q = 0; q < 8; q++) {
      const x = 8 + q * 63, y = 8 + r * 41;
      g.fillStyle = '#6b4226'; g.fillRect(x, y, 57, 35);
      g.fillStyle = '#e8dcc0'; g.fillRect(x + 18, y + 6, 22, 10);
      g.fillStyle = '#c9a04e'; g.beginPath(); g.arc(x + 29, y + 25, 4, 0, Math.PI * 2); g.fill();
    }
    const ct = new THREE.CanvasTexture(c);
    const cab = new THREE.Group(); cab.position.set(-8.6, 0, -25.2); cab.rotation.y = Math.PI / 2; annex.add(cab);
    box(M.walnutDark, 1.9, 1.05, 0.62, 0, 0.52, 0, { parent: cab });
    const face = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 0.9), std({ map: ct, roughness: 0.6 })); face.position.set(0, 0.55, 0.315); cab.add(face);
    box(M.walnut, 2.0, 0.05, 0.7, 0, 1.07, 0, { parent: cab });
    addCol(-9.0, -8.2, -26.2, -24.2);
  }

  // ---- 雑誌の回廊：表紙を見せる斜めの棚、カフェの丸机
  const magSlots = [];
  {
    const racks = [9.5, 15.3, 21.1, 26.8];
    const LEDGES = [0.5, 1.1, 1.7, 2.3];
    const z = IN.z0;
    racks.forEach((cx, ri) => {
      const w = ri === 3 ? 4.6 : 5.4;
      box(M.walnut, w + 0.2, 2.95, 0.1, cx, 1.475, z + 0.05, { parent: annex });
      [cx - w / 2 - 0.05, cx + w / 2 + 0.05].forEach((x) => box(M.walnut, 0.1, 2.95, 0.5, x, 1.475, z + 0.25, { parent: annex }));
      box(M.walnutDark, w + 0.3, 0.14, 0.56, cx, 2.99, z + 0.28, { parent: annex });
      LEDGES.forEach((y) => {
        box(M.walnutDark, w, 0.04, 0.3, cx, y - 0.06, z + 0.3, { parent: annex, cast: false });
        box(M.gold, w, 0.05, 0.02, cx, y - 0.02, z + 0.44, { parent: annex, cast: false });
        const n = ri === 3 ? 4 : 5;
        for (let k = 0; k < n; k++) magSlots.push({ x: cx - w / 2 + (k + 0.5) * (w / n), y: y + 0.17, z: z + 0.28, rack: ri + 1, ledge: LEDGES.indexOf(y) + 1 });
      });
    });
    addCol(6.6, IN.x1, IN.z0, IN.z0 + 0.62);
    // 新聞掛け（東の壁）
    const np = new THREE.Group(); np.position.set(IN.x1 - 0.3, 0, -28.8); np.rotation.y = -Math.PI / 2; annex.add(np);
    box(M.walnut, 2.4, 0.06, 0.3, 0, 1.9, 0, { parent: np });
    const paperM = std({ color: 0xece6d8, roughness: 0.9 });
    for (let k = 0; k < 6; k++) { box(M.iron, 0.02, 0.02, 0.6, -1 + k * 0.4, 1.86, 0.18, { parent: np, cast: false }); box(paperM, 0.02, 0.62, 0.36, -1 + k * 0.4, 1.52, 0.3, { parent: np, cast: false }); }
    addCol(IN.x1 - 0.7, IN.x1, -30.2, -27.4);
    // カフェの丸机
    [[13.2, -27.6], [21.8, -27.9]].forEach(([x, z]) => {
      const top = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.62, 0.05, 28), M.marble); top.position.set(x, 0.76, z); top.castShadow = true; annex.add(top);
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.22, 0.74, 12), M.iron); leg.position.set(x, 0.37, z); annex.add(leg);
      const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.04, 0.08, 12), std({ color: 0xf5f0e6, roughness: 0.3 })); cup.position.set(x + 0.2, 0.83, z + 0.1); annex.add(cup);
      [0, 1, 2].forEach((k) => {
        const a = k * Math.PI * 2 / 3 + 0.4;
        const cx = x + Math.cos(a) * 0.95, cz = z + Math.sin(a) * 0.95;
        const seat = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.05, 16), M.leather); seat.position.set(cx, 0.46, cz); annex.add(seat);
        const sl = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.44, 6), M.iron); sl.position.set(cx, 0.22, cz); annex.add(sl);
      });
      addCol(x - 1.25, x + 1.25, z - 1.25, z + 1.25);
    });
  }

  // ================= 大扉（近づくと外へ開く） =================
  const doors = [];
  [-1, 1].forEach((s) => {
    const pivot = new THREE.Group(); pivot.position.set(s * 1.6, 0, L + 0.3); scene.add(pivot);
    const leaf = new THREE.Group(); leaf.position.x = -s * 0.8; pivot.add(leaf);
    box(M.walnutDark, 1.58, 3.4, 0.12, 0, 1.7, 0, { parent: leaf });
    for (let k = 0; k < 3; k++) [-1, 1].forEach((f) => box(M.walnut, 1.2, 0.9, 0.04, 0, 0.7 + k * 1.05, f * 0.08, { parent: leaf, cast: false }));
    [-1, 1].forEach((f) => { const r = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.018, 8, 20), M.gold); r.position.set(-s * 0.62, 1.3, f * 0.11); leaf.add(r); });
    [0.5, 2.9].forEach((y) => box(M.iron, 1.5, 0.06, 0.16, 0, y, 0, { parent: leaf, cast: false }));
    doors.push({ pivot, s });
  });
  let doorOpen = 0;

  // ================= 前庭：双塔・噴水・街灯・並木 =================
  {
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(1400, 1400), std({ color: 0x5f7a45, roughness: 1 }));
    ground.rotation.x = -Math.PI / 2; ground.position.set(-700 + W + 0.6, -0.02, 0); ground.receiveShadow = true; scene.add(ground);
    const plazaMat = std({ map: T(tex.stoneTex, 9, 4), roughness: 0.9, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 });
    const plaza = new THREE.Mesh(new THREE.PlaneGeometry(31, 26), plazaMat);
    plaza.rotation.x = -Math.PI / 2; plaza.position.set(-8.9, 0.006, 35.6); plaza.receiveShadow = true; scene.add(plaza);
    const road = new THREE.Mesh(new THREE.PlaneGeometry(36, 8), plazaMat);
    road.rotation.x = -Math.PI / 2; road.position.set(24.6, 0.006, 44.6); road.receiveShadow = true; scene.add(road);
    // 双塔（ノートルダムのように正面の両側に）
    [-1, 1].forEach((s) => {
      const x = s * 9.3, z = L + 3.3;
      box(stoneWall, 5.2, 19, 5.2, x, 9.5, z);
      box(stoneWall, 5.8, 0.5, 5.8, x, 13.2, z);
      for (let k = 0; k < 2; k++) [-1, 1].forEach((f) => {
        const op = box(std({ color: 0x1a1612, roughness: 1 }), 0.9, 3.0, 0.1, x + (k ? 1.2 : -1.2) * 0.9, 16.2, z + f * 2.62, { cast: false });
        op.rotation.y = 0;
      });
      [-1, 1].forEach((f) => { const w = box(std({ color: 0x1a1612, roughness: 1 }), 0.1, 3.0, 0.9, x + f * 2.62, 16.2, z, { cast: false }); w.rotation.y = 0; });
      const roof = new THREE.Mesh(new THREE.ConeGeometry(4.0, 6.5, 4), slate); roof.rotation.y = Math.PI / 4; roof.position.set(x, 22.2, z); roof.castShadow = true; scene.add(roof);
      box(M.gold, 0.08, 1.4, 0.08, x, 26.1, z, { cast: false });
      addCol(x - 2.7, x + 2.7, z - 2.7, z + 2.7);
    });
    // 正面の飾り：尖頭アーチの縁と、扉の上の小さな窓の列
    const fr = new THREE.Mesh(new THREE.TorusGeometry(2.0, 0.16, 8, 40, Math.PI), stoneWall); fr.position.set(0, 3.4, L + 0.66); scene.add(fr);
    [-2.0, 2.0].forEach((x) => box(stoneWall, 0.32, 3.4, 0.2, x, 1.7, L + 0.7));
    for (let k = -4; k <= 4; k++) { const n = box(stoneWall, 0.9, 1.9, 0.25, k * 1.25, 8.8, L + 0.72); n.castShadow = false; box(std({ color: 0x2a2320, roughness: 1 }), 0.5, 1.3, 0.05, k * 1.25, 8.8, L + 0.86, { cast: false }); }
    box(stoneWall, 13.4, 0.35, 0.5, 0, 7.4, L + 0.78);
  }
  // 噴水
  const fountain = { drops: null, water: null };
  {
    const fx = -3.5, fz = 34.5;
    const basin = new THREE.Mesh(new THREE.CylinderGeometry(2.4, 2.6, 0.6, 8, 1, true), std({ color: 0xc9bfae, roughness: 0.8, side: THREE.DoubleSide }));
    basin.position.set(fx, 0.3, fz); basin.castShadow = true; scene.add(basin);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(2.45, 0.12, 6, 8), std({ color: 0xd8cfbf, roughness: 0.7 })); rim.rotation.x = Math.PI / 2; rim.rotation.z = Math.PI / 8; rim.position.set(fx, 0.6, fz); scene.add(rim);
    const water = new THREE.Mesh(new THREE.CircleGeometry(2.3, 8), std({ color: 0x3f7fa0, roughness: 0.1, metalness: 0.3, transparent: true, opacity: 0.85, emissive: 0x0c2a3a })); water.rotation.x = -Math.PI / 2; water.position.set(fx, 0.45, fz); scene.add(water);
    const col = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.35, 1.8, 10), std({ color: 0xd8cfbf, roughness: 0.7 })); col.position.set(fx, 0.9, fz); scene.add(col);
    const bowl = new THREE.Mesh(new THREE.SphereGeometry(0.8, 16, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), std({ color: 0xd8cfbf, roughness: 0.7, side: THREE.DoubleSide })); bowl.position.set(fx, 1.85, fz); scene.add(bowl);
    const N = 220; const pos = new Float32Array(N * 3); const vel = []; for (let i = 0; i < N; i++) vel.push({ t: Math.random() * 1.2, a: Math.random() * Math.PI * 2, s: 0.6 + Math.random() * 0.6 });
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const pts = new THREE.Points(g, new THREE.PointsMaterial({ color: 0xcfe8ff, size: 0.07, transparent: true, opacity: 0.8, depthWrite: false })); scene.add(pts);
    Object.assign(fountain, { drops: { pos, vel, g, N }, water, fx, fz });
    addCol(fx - 2.7, fx + 2.7, fz - 2.7, fz + 2.7);
  }
  // 街灯と長椅子
  const lanterns = [];
  {
    const lm = std({ color: 0xffe6b0, emissive: 0xffc870, emissiveIntensity: 0.1 });
    [[-6.5, 26], [6.5, 26], [-6.5, 42], [6.5, 42], [-16, 30], [-16, 42], [12, 44]].forEach(([x, z]) => {
      box(M.iron, 0.12, 3.2, 0.12, x, 1.6, z);
      const head = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.14, 0.42, 6), lm); head.position.set(x, 3.4, z); scene.add(head);
      const cap = new THREE.Mesh(new THREE.ConeGeometry(0.26, 0.22, 6), M.iron); cap.position.set(x, 3.72, z); scene.add(cap);
      addCol(x - 0.2, x + 0.2, z - 0.2, z + 0.2);
    });
    lanterns.push(lm);
    [[-12, 36, 0], [4.5, 38.5, Math.PI / 2]].forEach(([x, z, r]) => {
      const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = r; scene.add(g);
      box(M.walnut, 2.0, 0.07, 0.5, 0, 0.46, 0, { parent: g });
      box(M.walnut, 2.0, 0.45, 0.06, 0, 0.75, -0.24, { parent: g });
      [-0.85, 0.85].forEach((dx) => box(M.iron, 0.08, 0.44, 0.45, dx, 0.22, 0, { parent: g }));
      addCol(x - 1.1, x + 1.1, z - 1.1, z + 1.1);
    });
    mapBoard(-5.2, L + 1.6, 0, scene, 1.6, 1.15);
    addCol(-6.1, -4.3, L + 1.3, L + 1.9);
  }
  // 西と南の並木
  {
    const N = 260;
    const tg = new THREE.ConeGeometry(2.2, 8, 7); tg.translate(0, 4, 0);
    const inst = new THREE.InstancedMesh(tg, std({ color: 0x2f4a2c, roughness: 1, flatShading: true }), N);
    const d = new THREE.Object3D();
    let i = 0;
    while (i < N) {
      const x = -30 - Math.random() * 260, z = -300 + Math.random() * 600;
      const x2 = -30 + Math.random() * 360, z2 = 52 + Math.random() * 240;
      const [px, pz] = i % 3 === 2 ? [x2, z2] : [x, z];
      if (px > -26 && pz < 50) continue;
      if (px > -82 && px < -20 && pz > -4 && pz < 66) continue; // 湖畔の草原はあける
      const s = 0.7 + Math.random() * 0.7;
      d.position.set(px, 0, pz); d.scale.set(s, s * (0.9 + Math.random() * 0.4), s); d.rotation.set(0, Math.random() * 6, 0); d.updateMatrix();
      inst.setMatrixAt(i, d.matrix); i++;
    }
    scene.add(inst);
    // 前庭の生け垣
    const hedge = std({ color: 0x3b5a34, roughness: 1 });
    // 生け垣（湖へ抜ける門をあける）
    box(hedge, 0.8, 0.9, 9.2, -23.6, 0.45, 31.1);
    box(hedge, 0.8, 0.9, 6.2, -23.6, 0.45, 43.4);
    [35.6, 40.4].forEach((gz) => { box(stoneWall, 0.6, 1.6, 0.6, -23.6, 0.8, gz); const cap = new THREE.Mesh(new THREE.SphereGeometry(0.2, 10, 8), M.gold); cap.position.set(-23.6, 1.75, gz); scene.add(cap); });
    addCol(-24.1, -23.1, 26.5, 35.8); addCol(-24.1, -23.1, 40.2, 46.5);
    box(hedge, 26, 0.9, 0.8, -10.6, 0.45, 47.6);
  }

  // ================= 判定と更新 =================
  const EXTRA = [], BLOCKS = [];
  function walkable(x, z) {
    let ok = false;
    for (const r of REGIONS) if (x >= r.x0 && x <= r.x1 && z >= r.z0 && z <= r.z1) { ok = true; break; }
    if (!ok) for (const r of EXTRA) if (x >= r.x0 && x <= r.x1 && z >= r.z0 && z <= r.z1) { ok = true; break; }
    if (!ok) return false;
    for (const b of BLOCKS) if (b(x, z)) return false;
    if (Math.abs(x) < 1.6 && z > L - 0.4 && z < L + 1.0 && doorOpen < 0.72) return false;
    return true;
  }
  function zone(x, z) {
    if (z < -22.6) {
      if (x < -ARCH_X) {
        if (z < IN.z0 + 1.6) { const b = x < -22 ? '第一' : x < -14.4 ? '第二' : '第三'; return '論文の間・' + b + '書架'; }
        return '論文の間';
      }
      if (x > ARCH_X) return z < IN.z0 + 1.6 ? '雑誌の回廊・表紙の棚' : '雑誌の回廊';
      return '翼廊の玄関ホール';
    }
    if (x < -24) {
      if (Math.hypot(x + 33, z - 14) < 5) return '焚き火のまわり';
      if (x < -34 && Math.abs(z - 31) < 0.8) return '湖の桟橋';
      const dx = (x + 48) / 17, dz = (z - 31) / 13;
      if (dx * dx + dz * dz < 1) return '湖のほとり';
      if (Math.hypot(x + 29.5, z - 28) < 3 || Math.hypot(x + 31, z - 51) < 3) return '木陰のカフェ';
      return '湖へ続く草原';
    }
    if (z > L + 0.5) {
      if (x > 17 && x < 25 && z > 42 && z < 47.5) return 'ビアガーデン';
      if (Math.hypot(x - fountain.fx, z - fountain.fz) < 5) return '噴水のほとり';
      if (x > 6.6) return '中庭の入口';
      return '前庭';
    }
    if (x > 6.6) return '中庭';
    return null;
  }
  const outside = (p) => p.z > L + 0.4 || p.x > 6.6 || p.x < -24;
  const ray = new THREE.Raycaster(); ray.far = 7;
  function pickBoard(ndc, camera) {
    ray.setFromCamera(ndc, camera);
    return ray.intersectObjects(boards, false).length > 0;
  }
  function update(dt, time, player, hour) {
    // 大扉：近づくと外へ開く
    const near = Math.abs(player.x) < 4 && Math.abs(player.z - (L + 0.3)) < 3.6 ? 1 : 0;
    doorOpen += (near - doorOpen) * Math.min(1, dt * 3);
    doors.forEach(({ pivot, s }) => { pivot.rotation.y = s * doorOpen * 1.45; });
    // 噴水
    const d = fountain.drops;
    if (d) {
      for (let i = 0; i < d.N; i++) {
        const v = d.vel[i]; v.t += dt; if (v.t > 1.2) { v.t = 0; v.a = Math.random() * Math.PI * 2; v.s = 0.6 + Math.random() * 0.6; }
        const r = v.s * v.t; const y = 2.3 + 2.2 * v.t - 4.9 * v.t * v.t;
        d.pos[i * 3] = fountain.fx + Math.cos(v.a) * r; d.pos[i * 3 + 1] = Math.max(0.46, y); d.pos[i * 3 + 2] = fountain.fz + Math.sin(v.a) * r;
      }
      d.g.attributes.position.needsUpdate = true;
      fountain.water.material.emissiveIntensity = 0.8 + Math.sin(time * 3) * 0.2;
    }
    // 夜は街灯をともす
    const night = hour < 6.3 || hour > 17.8 ? 1 : 0;
    lanterns.forEach((m) => { m.emissiveIntensity += ((night ? 1.6 : 0.1) - m.emissiveIntensity) * Math.min(1, dt * 2); });
    // 外にいるときは、雨や雪が自分のまわりに降るようにする
    const w = weather ? weather() : null;
    if (w) { const out = outside(player); const tx = out && player.x < 6.6 ? player.x - 60 : 0; w.forEach((o) => { if (o) o.position.x = tx; }); }
  }
  return { walkable, zone, update, pickBoard, paperShelves, magSlots, isOutside: outside, addWalk: (r) => EXTRA.push(r), addBlock: (fn) => BLOCKS.push(fn), get doorOpen() { return doorOpen; } };
}
