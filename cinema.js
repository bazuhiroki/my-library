// 中庭の東に建つ「映画館」
// スクリーンに YouTube などを映し、上映した動画は Notion「動画」データベースに残す（ジャンルは Notion の AI が仕分ける）。
import * as THREE from 'three';
import { CSS3DRenderer, CSS3DObject } from 'three/examples/jsm/renderers/CSS3DRenderer.js';
import { CHAR_SCALE } from './characters.js';
import { rand, pick } from './util.js';

const MINCHO = '"Shippori Mincho B1", "Hiragino Mincho ProN", serif';
export const CINEMA = { x0: 50, x1: 68, z0: -30, z1: -8, door: -19 };
const SCREEN = { x: 67.55, y: 3.7, z: -19, w: 10, h: 5.625 };
const ROWS = [54.6, 55.75, 56.9, 58.05, 59.2, 60.35];
const SEATZ = [-25.5, -24.55, -23.6, -22.65, -21.7, -20.75, -17.25, -16.3, -15.35, -14.4, -13.45, -12.5];
const PASS = 'my-library:passcode';
const CACHE = 'my-library:videos:v1';
const HIP = 0.4 * CHAR_SCALE;

function canvasTex(w, h, draw) { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); const t = new THREE.CanvasTexture(c); t.anisotropy = 4; return t; }
function wrap(g, text, x, y, maxW, lh, maxLines) {
  const chars = Array.from(String(text || '')); let line = '', n = 0;
  for (const ch of chars) { if (g.measureText(line + ch).width > maxW && line) { g.fillText(line, x, y + n * lh); line = ch; if (++n >= maxLines) return; } else line += ch; }
  if (line) g.fillText(line, x, y + n * lh);
}

export function createCinema({ scene, M, colliders, world, warp, toast, renderer, player }) {
  const std = (o) => new THREE.MeshStandardMaterial(o);
  const root = new THREE.Group(); scene.add(root);
  const box = (mat, w, h, d, x, y, z, cast = true) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y, z); m.castShadow = cast; m.receiveShadow = true; root.add(m); return m; };
  const { x0, x1, z0, z1, door } = CINEMA;
  const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, H = 7.2;

  // ---------------- 小道と門（中庭の東の塀に入口をあける）
  world.addWalk({ x0: 41.3, x1: 50.8, z0: door - 1.2, z1: door + 1.2 });
  world.addWalk({ x0: x0 + 0.45, x1: x1 - 0.8, z0: z0 + 0.45, z1: z1 - 0.45 });
  const path = new THREE.Mesh(new THREE.PlaneGeometry(9, 2.6), std({ color: 0x8d7f6a, roughness: 0.95 }));
  path.rotation.x = -Math.PI / 2; path.position.set(46.3, 0.012, door); path.receiveShadow = true; root.add(path);
  const stone = std({ color: 0x9a8e7a, roughness: 0.9 });
  [-1.45, 1.45].forEach((o) => {
    box(stone, 0.7, 2.2, 0.7, 42.6, 1.1, door + o);
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 10), new THREE.MeshBasicMaterial({ color: 0xffd08a })); lamp.position.set(42.6, 2.38, door + o); root.add(lamp);
  });
  const gateSign = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 0.55), std({ map: canvasTex(640, 136, (g, w, h) => { g.fillStyle = '#3a1418'; g.fillRect(0, 0, w, h); g.strokeStyle = '#d8b765'; g.lineWidth = 6; g.strokeRect(6, 6, w - 12, h - 12); g.fillStyle = '#f3dfa8'; g.font = '800 64px ' + MINCHO; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('映画館 →', w / 2, h / 2 + 2); }), roughness: 0.6 }));
  gateSign.position.set(42.2, 2.9, door); gateSign.rotation.y = -Math.PI / 2; root.add(gateSign);
  const gs2 = gateSign.clone(); gs2.position.x = 43.0; gs2.rotation.y = Math.PI / 2; root.add(gs2);
  box(M.iron, 0.12, 0.12, 3.1, 42.6, 2.55, door);

  // ---------------- 建物
  const wallMat = std({ color: 0x5a2a2c, roughness: 0.85 });
  const wallIn = std({ color: 0x241418, roughness: 0.95 });
  const trim = std({ color: 0xc9a04e, roughness: 0.4, metalness: 0.6 });
  // 外壁（西の壁に扉の穴）
  box(wallMat, 0.4, H, z1 - z0, x1, H / 2, cz);
  box(wallMat, x1 - x0, H, 0.4, cx, H / 2, z0);
  box(wallMat, x1 - x0, H, 0.4, cx, H / 2, z1);
  const dw = 2.8, dh = 3.3;
  box(wallMat, 0.4, H, (door - dw / 2) - z0, x0, H / 2, (z0 + door - dw / 2) / 2);
  box(wallMat, 0.4, H, z1 - (door + dw / 2), x0, H / 2, (z1 + door + dw / 2) / 2);
  box(wallMat, 0.4, H - dh, dw, x0, dh + (H - dh) / 2, door);
  // 屋根
  box(std({ color: 0x3b2a22, roughness: 0.9 }), x1 - x0 + 0.6, 0.4, z1 - z0 + 0.6, cx, H + 0.2, cz);
  box(trim, x1 - x0 + 0.7, 0.18, z1 - z0 + 0.7, cx, H + 0.45, cz, false);
  // ---- 内装（アールデコ風：布張りの壁・金の柱・腰板・星空の天井）
  const fabric = std({ roughness: 0.95, map: canvasTex(128, 256, (g, w, hh) => { g.fillStyle = '#511826'; g.fillRect(0, 0, w, hh); g.strokeStyle = 'rgba(0,0,0,.22)'; g.lineWidth = 2; for (let y = 0; y < hh; y += 10) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); } g.strokeStyle = 'rgba(226,182,98,.30)'; g.lineWidth = 2; for (let y = 16; y < hh; y += 64) { g.beginPath(); g.moveTo(w / 2, y); g.lineTo(w / 2 + 22, y + 22); g.lineTo(w / 2, y + 44); g.lineTo(w / 2 - 22, y + 22); g.closePath(); g.stroke(); g.beginPath(); g.moveTo(w / 2, y + 8); g.lineTo(w / 2 + 12, y + 22); g.lineTo(w / 2, y + 36); g.lineTo(w / 2 - 12, y + 22); g.closePath(); g.stroke(); } }) });
  fabric.map.wrapS = fabric.map.wrapT = THREE.RepeatWrapping;
  const glow = (color) => new THREE.MeshBasicMaterial({ color, toneMapped: false });
  const lampMat = new THREE.MeshStandardMaterial({ color: 0xffe0a8, emissive: 0xffc070, emissiveIntensity: 1.4, roughness: 0.4 });
  const side = (z, f) => { // 北と南の壁（f は部屋の内側への向き）
    const len = x1 - x0 - 1.8, mx = x0 + 0.3 + len / 2, zz = z + f * 0.27;
    box(M.walnutDark, len, 1.15, 0.07, mx, 0.575, zz, false);
    box(trim, len, 0.06, 0.1, mx, 1.18, zz + f * 0.02, false);
    const up = box(fabric, len, H - 1.75, 0.05, mx, 1.2 + (H - 1.75) / 2, zz, false); up.material = fabric; fabric.map.repeat.set(len / 1.2, 1);
    box(trim, len, 0.12, 0.14, mx, H - 0.48, zz + f * 0.03, false);
    for (let x = x0 + 1.4; x < x1 - 1.6; x += 3.2) {
      box(M.walnutDark, 0.34, H - 0.5, 0.18, x, (H - 0.5) / 2, zz + f * 0.06);
      box(trim, 0.4, 0.12, 0.22, x, H - 0.62, zz + f * 0.06, false);
      box(trim, 0.06, H - 1.9, 0.2, x, 1.2 + (H - 1.9) / 2, zz + f * 0.08, false);
      // 扇形の壁灯
      const fan = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.06, 0.5, 16, 1, false, 0, Math.PI), lampMat);
      fan.position.set(x + 1.6, 3.4, zz + f * 0.03); fan.rotation.y = f > 0 ? Math.PI : 0; root.add(fan);
    }
  };
  side(z0, 1); side(z1, -1);
  // 後ろの壁（映写室の窓と出口の表示）
  const backLen = z1 - z0 - 0.6;
  box(M.walnutDark, 0.07, 1.15, backLen, x0 + 0.27, 0.575, cz, false);
  [[z0 + 0.3, door - dw / 2 - 0.1], [door + dw / 2 + 0.1, z1 - 0.3]].forEach(([a, b]) => { const m = box(fabric, 0.05, H - 1.75, b - a, x0 + 0.27, 1.2 + (H - 1.75) / 2, (a + b) / 2, false); m.material = fabric; });
  const booth = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.7), glow(0x9fb6e8)); booth.position.set(x0 + 0.31, 5.0, door); booth.rotation.y = Math.PI / 2; root.add(booth);
  box(trim, 0.08, 0.86, 1.8, x0 + 0.29, 5.0, door, false);
  const exitTex = canvasTex(256, 96, (g, w, hh) => { g.fillStyle = '#0d7a3e'; g.fillRect(0, 0, w, hh); g.fillStyle = '#eafff1'; g.font = '700 46px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('非常口', w / 2, hh / 2 + 2); });
  const exit = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.34), new THREE.MeshBasicMaterial({ map: exitTex, toneMapped: false })); exit.position.set(x0 + 0.32, dh + 0.35, door); exit.rotation.y = Math.PI / 2; root.add(exit);
  // 天井（濃紺に星の灯り）
  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0 - 0.5, z1 - z0 - 0.5), std({ color: 0x14182a, roughness: 1 }));
  ceil.rotation.x = Math.PI / 2; ceil.position.set(cx, H - 0.06, cz); root.add(ceil);
  for (let x = x0 + 1.4; x < x1 - 1.6; x += 3.2) box(trim, 0.08, 0.1, z1 - z0 - 0.6, x, H - 0.12, cz, false);
  const starPos = new Float32Array(420 * 3);
  for (let i = 0; i < 420; i++) { starPos[i * 3] = x0 + 0.6 + Math.random() * (x1 - x0 - 2.2); starPos[i * 3 + 1] = H - 0.1; starPos[i * 3 + 2] = z0 + 0.6 + Math.random() * (z1 - z0 - 1.2); }
  const starGeo = new THREE.BufferGeometry(); starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
  const stars = new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xfff1cf, size: 0.07, sizeAttenuation: true, toneMapped: false, transparent: true, opacity: 0.9, depthWrite: false }));
  root.add(stars);
  // 床（深紅に金の菱形模様の絨毯）
  const carpet = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0 - 0.4, z1 - z0 - 0.4), std({ map: canvasTex(256, 256, (g) => { g.fillStyle = '#5a1420'; g.fillRect(0, 0, 256, 256); g.strokeStyle = 'rgba(214,170,90,.45)'; g.lineWidth = 3; for (let i = -256; i < 512; i += 64) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i + 256, 256); g.stroke(); g.beginPath(); g.moveTo(i + 256, 0); g.lineTo(i, 256); g.stroke(); } g.fillStyle = 'rgba(214,170,90,.55)'; for (let i = 0; i < 256; i += 64) for (let j = 0; j < 256; j += 64) { g.beginPath(); g.arc(i + 32, j, 4, 0, Math.PI * 2); g.fill(); } }), roughness: 1 }));
  carpet.material.map.wrapS = carpet.material.map.wrapT = THREE.RepeatWrapping; carpet.material.map.repeat.set(6, 7);
  carpet.rotation.x = -Math.PI / 2; carpet.position.set(cx, 0.014, cz); carpet.receiveShadow = true; root.add(carpet);
  // 通路の足元灯（暗くなっても見える）
  const stepGlow = glow(0xffb45c);
  ROWS.forEach((x) => [-20.4, -17.6, -26.25, -11.75].forEach((z) => { const l = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.04, 0.05), stepGlow); l.position.set(x, 0.05, z); root.add(l); }));
  const warm = new THREE.PointLight(0xffb070, 0.7, 24, 2); warm.position.set(57, 5.8, cz); root.add(warm);

  // ---------------- 正面（西側）の飾り：ひさし・看板・電球・ポスター
  box(trim, 0.6, 0.25, 5.2, x0 - 0.5, dh + 0.3, door, false);
  const marqueeCanvas = document.createElement('canvas'); marqueeCanvas.width = 1024; marqueeCanvas.height = 256;
  const marqueeTex = new THREE.CanvasTexture(marqueeCanvas);
  const marquee = new THREE.Mesh(new THREE.PlaneGeometry(5.6, 1.4), std({ map: marqueeTex, emissive: 0xffffff, emissiveMap: marqueeTex, emissiveIntensity: 0.55, roughness: 0.5 }));
  marquee.position.set(x0 - 0.22, dh + 1.35, door); marquee.rotation.y = -Math.PI / 2; root.add(marquee);
  function drawMarquee(now) {
    const g = marqueeCanvas.getContext('2d'), w = 1024, h = 256;
    g.fillStyle = '#1d0b0e'; g.fillRect(0, 0, w, h); g.strokeStyle = '#e8c46a'; g.lineWidth = 10; g.strokeRect(8, 8, w - 16, h - 16);
    for (let i = 0; i < 26; i++) { g.fillStyle = i % 2 ? '#ffe7a8' : '#ffd070'; g.beginPath(); g.arc(30 + i * 37.5, 22, 7, 0, Math.PI * 2); g.fill(); g.beginPath(); g.arc(30 + i * 37.5, h - 22, 7, 0, Math.PI * 2); g.fill(); }
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillStyle = '#f7e2a6'; g.font = '800 78px ' + MINCHO; g.fillText(now ? '上映中' : 'MY CINEMA', w / 2, 98);
    g.font = '600 40px ' + MINCHO; g.fillStyle = '#fff6dc';
    const sub = now ? String(now).slice(0, 26) : 'スクリーンをタップして上映';
    g.fillText(sub, w / 2, 178, w - 80);
    marqueeTex.needsUpdate = true;
  }
  drawMarquee('');
  const bulbs = new THREE.MeshBasicMaterial({ color: 0xffd58a });
  for (let i = 0; i < 12; i++) { const b = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), bulbs); b.position.set(x0 - 0.8, dh + 0.18, door - 2.4 + i * 0.44); root.add(b); }
  // ポスター（最近の動画のサムネイル）
  const posters = [-4.6, 4.6].map((o) => {
    const frame = box(trim, 0.08, 2.5, 1.9, x0 - 0.22, 2.0, door + o, false);
    const p = new THREE.Mesh(new THREE.PlaneGeometry(1.7, 2.3), std({ color: 0xffffff, roughness: 0.6, map: canvasTex(340, 460, (g, w, h) => { g.fillStyle = '#2a1015'; g.fillRect(0, 0, w, h); g.fillStyle = '#e8c46a'; g.font = '800 44px ' + MINCHO; g.textAlign = 'center'; g.fillText('近日上映', w / 2, h / 2); }) }));
    p.position.set(x0 - 0.27, 2.0, door + o); p.rotation.y = -Math.PI / 2; root.add(p);
    return p;
  });

  // ---------------- スクリーン・幕・映写の光
  const idleTex = canvasTex(1280, 720, (g, w, h) => {
    const grd = g.createRadialGradient(w / 2, h / 2, 50, w / 2, h / 2, w * 0.7); grd.addColorStop(0, '#2b2b33'); grd.addColorStop(1, '#0c0c10');
    g.fillStyle = grd; g.fillRect(0, 0, w, h);
    g.fillStyle = '#e8d7a8'; g.textAlign = 'center'; g.font = '800 92px ' + MINCHO; g.fillText('MY CINEMA', w / 2, h / 2 - 30);
    g.font = '500 44px ' + MINCHO; g.fillStyle = '#c9bfa6'; g.fillText('スクリーンをタップして、上映する動画を選んでください', w / 2, h / 2 + 60);
  });
  const screenMat = new THREE.MeshBasicMaterial({ map: idleTex, toneMapped: false });
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(SCREEN.w, SCREEN.h), screenMat);
  screen.position.set(SCREEN.x, SCREEN.y, SCREEN.z); screen.rotation.y = -Math.PI / 2; root.add(screen);
  box(std({ color: 0x0b0b0d, roughness: 1 }), 0.1, SCREEN.h + 0.5, SCREEN.w + 0.5, SCREEN.x + 0.1, SCREEN.y, SCREEN.z, false);
  // 動画は 3D の後ろに置き、ここだけ透明にして見せる（手前の観客の頭は動画の前に来る）
  const hole = new THREE.Mesh(new THREE.PlaneGeometry(SCREEN.w, SCREEN.h), new THREE.MeshBasicMaterial({ color: 0x000000, opacity: 0, blending: THREE.NoBlending, toneMapped: false }));
  hole.position.copy(screen.position); hole.rotation.copy(screen.rotation); hole.visible = false; root.add(hole);
  // 額縁（金のプロセニアム）と、幕の上の飾り
  [[SCREEN.y + SCREEN.h / 2 + 0.35, SCREEN.w + 1.2, 0.18], [SCREEN.y - SCREEN.h / 2 - 0.3, SCREEN.w + 1.2, 0.12]].forEach(([y, w, hh]) => box(trim, 0.16, hh, w, SCREEN.x - 0.12, y, SCREEN.z, false));
  [-1, 1].forEach((s2) => box(trim, 0.16, SCREEN.h + 0.8, 0.14, SCREEN.x - 0.12, SCREEN.y, SCREEN.z + s2 * (SCREEN.w / 2 + 0.55), false));
  const foot = glow(0xffd28a);
  for (let i = 0; i < 14; i++) { const fl = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), foot); fl.position.set(x1 - 1.32, 0.63, z0 + 1.6 + i * ((z1 - z0 - 3.2) / 13)); root.add(fl); }
  const velvet = std({ color: 0x7a1020, roughness: 0.85 });
  [-1, 1].forEach((s) => {
    for (let k = 0; k < 6; k++) { const f = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, H - 0.6, 10), velvet); f.position.set(SCREEN.x - 0.25, (H - 0.6) / 2, SCREEN.z + s * (SCREEN.w / 2 + 0.35 + k * 0.32)); f.castShadow = true; root.add(f); }
  });
  box(velvet, 0.5, 0.8, SCREEN.w + 4.5, SCREEN.x - 0.25, H - 0.5, SCREEN.z, false);
  box(std({ color: 0x2a1d18, roughness: 0.9 }), 1.0, 0.6, z1 - z0 - 1, x1 - 0.8, 0.3, cz); // 舞台
  colliders.push({ x0: x1 - 1.4, x1: x1 + 0.5, z0, z1 });
  const beam = new THREE.Mesh(new THREE.ConeGeometry(2.6, 16.4, 24, 1, true), new THREE.MeshBasicMaterial({ color: 0xcfe0ff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false }));
  beam.rotation.z = Math.PI / 2; beam.position.set(x0 + 0.5 + 8.2, 5.0, door); root.add(beam);
  const screenGlow = new THREE.PointLight(0x9fb8ff, 0, 18, 2); screenGlow.position.set(SCREEN.x - 4, 3.4, SCREEN.z); root.add(screenGlow);

  // ---------------- 座席（6列×12席、中央に通路）
  const seats = [];
  ROWS.forEach((x) => SEATZ.forEach((z) => seats.push({ x, z })));
  const seatMat = std({ color: 0x8a1626, roughness: 0.7 });
  const cushion = new THREE.InstancedMesh(new THREE.BoxGeometry(0.5, 0.14, 0.56), seatMat, seats.length);
  const back = new THREE.InstancedMesh(new THREE.BoxGeometry(0.1, 0.7, 0.56), seatMat, seats.length);
  const arm = new THREE.InstancedMesh(new THREE.BoxGeometry(0.5, 0.08, 0.06), M.walnutDark, seats.length);
  const d = new THREE.Object3D();
  seats.forEach((s, i) => {
    d.position.set(s.x, 0.44, s.z); d.updateMatrix(); cushion.setMatrixAt(i, d.matrix);
    d.position.set(s.x - 0.25, 0.82, s.z); d.updateMatrix(); back.setMatrixAt(i, d.matrix);
    d.position.set(s.x, 0.62, s.z + 0.3); d.updateMatrix(); arm.setMatrixAt(i, d.matrix);
  });
  [cushion, back, arm].forEach((m) => { m.castShadow = true; m.receiveShadow = true; root.add(m); });
  ROWS.forEach((x) => { colliders.push({ x0: x - 0.4, x1: x + 0.32, z0: -26.1, z1: -20.3 }, { x0: x - 0.4, x1: x + 0.32, z0: -17.7, z1: -11.9 }); });

  // ---------------- 観客（キャラクターが読み込まれてから）
  const audience = [];
  const pop = std({ color: 0xffffff, roughness: 0.6, map: canvasTex(64, 64, (g) => { for (let i = 0; i < 8; i++) { g.fillStyle = i % 2 ? '#c8202c' : '#ffffff'; g.fillRect(i * 8, 0, 8, 64); } }) });
  function attach(cast) {
    const free = seats.slice().sort(() => Math.random() - 0.5).filter((s) => !(Math.abs(s.z - door) < 3 && s.x === ROWS[2])).slice(0, 16);
    free.forEach((s, i) => {
      occupied.add(s);
      const a = cast.spawn(pick(['Rogue', 'Mage', 'Knight', 'Rogue_Hooded', 'Barbarian']), { gear: [] });
      a.root.position.set(s.x + HIP * 0.25, 0.13, s.z); a.root.rotation.y = Math.PI / 2;
      root.add(a.root);
      const act = a.play('Sit_Chair_Idle'); if (act) act.time = rand(0, 3);
      if (i % 3 === 0) { const b = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.07, 0.2, 12), pop); b.position.set(s.x + 0.05, 0.76, s.z + 0.3); root.add(b); }
      audience.push({ a, cheer: rand(8, 30) });
    });
  }

  // ---------------- 上映（CSS3D でスクリーンの位置に動画を重ねる）
  const css = new CSS3DRenderer();
  css.setSize(innerWidth, innerHeight);
  // 動画の層（0）を、透明な穴のあいた 3D の画面（1）のすぐ後ろに置く。ページの背景より前に来るように 0 にする
  Object.assign(css.domElement.style, { position: 'fixed', left: '0', top: '0', pointerEvents: 'none', zIndex: '0' });
  { const cv = document.getElementById('c'); if (cv) { cv.style.position = 'fixed'; cv.style.zIndex = '1'; } }
  document.body.append(css.domElement);
  addEventListener('resize', () => css.setSize(innerWidth, innerHeight));
  const cssScene = new THREE.Scene();
  const holder = document.createElement('div');
  Object.assign(holder.style, { width: '1280px', height: '720px', background: '#000', pointerEvents: 'none', backfaceVisibility: 'hidden' });
  const film = new CSS3DObject(holder);
  film.position.set(SCREEN.x - 0.03, SCREEN.y, SCREEN.z); film.rotation.y = -Math.PI / 2; film.scale.setScalar(SCREEN.w / 1280);
  film.visible = false;
  cssScene.add(film);
  let now = null; // 上映中の動画
  function play(v) {
    now = v;
    holder.innerHTML = '';
    if (v.embed) {
      const f = document.createElement('iframe');
      f.src = v.embed + (v.embed.includes('?') ? '&' : '?') + 'autoplay=1' + (v.service === 'YouTube' ? '&enablejsapi=1&controls=1&origin=' + encodeURIComponent(location.origin) : '');
      f.allow = 'autoplay; encrypted-media; picture-in-picture; fullscreen';
      f.allowFullscreen = true;
      Object.assign(f.style, { width: '100%', height: '100%', border: '0' });
      holder.append(f);
    }
    // 埋め込めない配信は、スクリーンにポスターを映す
    screenMat.map = v.embed ? idleTex : posterTex(v);
    screenMat.needsUpdate = true;
    drawMarquee(v.title || v.service);
    beam.material.opacity = 0.06; screenGlow.intensity = 0.9;
  }
  function stop() { front(false); now = null; holder.innerHTML = ''; screenMat.map = idleTex; screenMat.needsUpdate = true; drawMarquee(''); beam.material.opacity = 0; screenGlow.intensity = 0; }
  const loader = new THREE.TextureLoader();
  function posterTex(v) {
    const t = canvasTex(1280, 720, (g, w, h) => {
      g.fillStyle = '#0d0d12'; g.fillRect(0, 0, w, h);
      g.fillStyle = '#e8d7a8'; g.textAlign = 'center'; g.font = '800 64px ' + MINCHO; wrap(g, v.title || v.service, w / 2, 250, w - 200, 80, 2);
      g.font = '500 40px ' + MINCHO; g.fillStyle = '#c9bfa6'; g.fillText(v.service + ' はここでは再生できないため、アプリで観てください', w / 2, 520);
    });
    if (v.thumb) loader.load('/api/img?u=' + encodeURIComponent(v.thumb), (img) => { if (now === v) { screenMat.map = img; screenMat.needsUpdate = true; } });
    return t;
  }

  // ---------------- 上映室のパネル
  const css2 = document.createElement('style');
  css2.textContent = `#cine{position:fixed;inset:auto 0 0 0;z-index:12;padding:0 12px calc(env(safe-area-inset-bottom,0px) + 12px);transform:translateY(110%);transition:transform .38s cubic-bezier(.2,.8,.2,1)}
#cine.open{transform:none}#cine .card{max-height:84vh;overflow-y:auto;display:block}
#cine h2{font-family:var(--display);font-size:19px;font-weight:800;margin:0}
.cn-row{display:flex;gap:8px;margin-top:10px}.cn-row input{flex:1;min-width:0;height:42px;border-radius:12px;border:1px solid var(--line);background:rgba(20,15,10,.8);color:var(--text);font-size:16px;padding:0 12px;user-select:text;-webkit-user-select:text}
.cn-btn{height:42px;padding:0 14px;border-radius:12px;border:1px solid rgba(210,170,85,.45);background:rgba(210,170,85,.1);color:#EBD08F;font-family:var(--ui);font-size:13px;cursor:pointer;flex-shrink:0}
.cn-btn.main{background:#c9a04e;color:#1b150b;font-weight:700}
.cn-prev{display:flex;gap:10px;margin-top:10px;align-items:flex-start}.cn-prev img{width:128px;aspect-ratio:16/9;object-fit:cover;border-radius:8px;background:#222}
.cn-prev input{width:100%;height:36px;border-radius:9px;border:1px solid var(--line);background:rgba(20,15,10,.8);color:var(--text);font-size:14px;padding:0 8px}
.cn-meta{font-size:11.5px;color:var(--text-dim);margin-top:4px}.cn-acts{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px}
.cn-h{font-family:var(--display);font-size:14px;color:#EBD08F;margin:16px 0 6px;border-bottom:1px solid var(--line);padding-bottom:4px}
.cn-chips{display:flex;gap:6px;overflow-x:auto;padding-bottom:6px}.cn-chips button{flex:0 0 auto;height:30px;padding:0 10px;border-radius:15px;border:1px solid var(--line);background:transparent;color:var(--text-dim);font-size:12px;font-family:var(--ui)}
.cn-chips button[aria-pressed=true]{background:rgba(201,160,78,.25);color:#f3dfa8;border-color:#c9a04e}
.cn-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:10px}
.cn-tile{background:none;border:none;padding:0;text-align:left;color:var(--text);font-family:var(--ui);cursor:pointer}
.cn-tile img{width:100%;aspect-ratio:16/9;object-fit:cover;border-radius:8px;background:#222;display:block}
.cn-tile b{display:block;font-size:12px;line-height:1.4;margin-top:4px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.cn-tile span{font-size:10.5px;color:var(--text-dim)}
.cn-det{margin-top:10px;padding:10px;border:1px solid var(--line);border-radius:12px;display:none}.cn-det.open{display:block}
.cn-det select,.cn-det textarea{width:100%;border-radius:9px;border:1px solid var(--line);background:rgba(20,15,10,.8);color:var(--text);font-family:var(--ui);font-size:14px;padding:6px 8px;margin-top:6px}
.cn-note{font-size:11px;color:var(--text-dim);margin:6px 0 0}`;
  document.head.append(css2);
  const watchCss = document.createElement('style');
  watchCss.textContent = 'body.cine-watch #cross,body.cine-watch #hint,body.cine-watch #joyHint{opacity:0!important;visibility:hidden!important}';
  document.head.append(watchCss);
  const el = document.createElement('section');
  el.id = 'cine';
  el.innerHTML = `<div class='card'>
    <div class='chead'><h2>映画館　上映室</h2><button id='cnClose' class='cn-btn' type='button'>閉じる</button></div>
    <div class='cn-row'><input id='cnUrl' placeholder='YouTube などのリンクを貼り付け' autocomplete='off'><button id='cnProbe' class='cn-btn main' type='button'>調べる</button></div>
    <div id='cnPrev'></div>
    <div class='cn-acts' id='cnNowBar'></div>
    <h3 class='cn-h'>Notion の動画</h3>
    <div class='cn-chips' id='cnChips'></div>
    <div class='cn-grid' id='cnGrid'></div>
    <div class='cn-det' id='cnDet'></div>
    <p class='cn-note'>上映した動画は Notion「動画」に残り、ジャンルは Notion の AI が仕分けます。Amazonプライム・Netflix などは、ここでは再生できないのでアプリで観てください（記録は残せます）。</p>
  </div>`;
  document.body.append(el);
  const $ = (id) => document.getElementById(id);
  const h = (tag, cls, t) => { const e = document.createElement(tag); if (cls) e.className = cls; if (t !== undefined) e.textContent = t; return e; };
  async function api(url, opt) {
    for (let k = 0; k < 2; k++) {
      const o = Object.assign({}, opt); o.headers = Object.assign({ 'Content-Type': 'application/json', 'x-app-key': localStorage.getItem(PASS) || '' }, o.headers);
      const r = await fetch(url, o);
      if (r.status === 401) { const p = window.prompt('合言葉を入れてね（Vercel の APP_PASSCODE）'); if (!p) throw new Error('passcode'); localStorage.setItem(PASS, p); continue; }
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || String(r.status));
      return j;
    }
    throw new Error('passcode');
  }
  let list = (() => { try { return JSON.parse(localStorage.getItem(CACHE) || '[]'); } catch (e) { return []; } })();
  let filter = '';
  async function loadList() {
    try {
      let cur = '', all = [], n = 0;
      do { const j = await api('/api/videos' + (cur ? '?cursor=' + encodeURIComponent(cur) : '')); all = all.concat(j.records); cur = j.next || ''; n++; } while (cur && n < 5);
      list = all; try { localStorage.setItem(CACHE, JSON.stringify(list)); } catch (e) { /* 続ける */ }
      renderList(); updatePosters();
    } catch (e) { /* 前回の一覧を使う */ }
  }
  function renderList() {
    const chips = $('cnChips'); chips.innerHTML = '';
    const genres = [...new Set(list.map((v) => v.genre || '仕分け待ち'))];
    [['', 'すべて ' + list.length]].concat(genres.map((g) => [g, g + ' ' + list.filter((v) => (v.genre || '仕分け待ち') === g).length])).forEach(([g, label]) => {
      const b = h('button', '', label); b.type = 'button'; b.setAttribute('aria-pressed', filter === g ? 'true' : 'false');
      b.addEventListener('click', () => { filter = g; renderList(); }); chips.append(b);
    });
    const grid = $('cnGrid'); grid.innerHTML = '';
    list.filter((v) => !filter || (v.genre || '仕分け待ち') === filter).forEach((v) => {
      const t = h('button', 'cn-tile'); t.type = 'button';
      const img = document.createElement('img'); img.loading = 'lazy'; if (v.thumb) img.src = v.thumb; img.alt = v.title;
      t.append(img, h('b', '', v.title), h('span', '', [v.status, v.rating, v.genre].filter(Boolean).join('　')));
      t.addEventListener('click', () => detail(v));
      grid.append(t);
    });
    if (!list.length) grid.append(h('p', 'cn-note', 'まだ動画がありません。上にリンクを貼って上映してみてください。'));
  }
  function nowBar() {
    const bar = $('cnNowBar'); bar.innerHTML = '';
    if (!now) return;
    bar.append(h('span', 'cn-meta', '上映中：' + (now.title || now.service)));
    const sit = h('button', 'cn-btn', 'スクリーン正面に座る'); sit.type = 'button'; sit.addEventListener('click', () => { close(); sitFront(); });
    const st = h('button', 'cn-btn', '上映を止める'); st.type = 'button'; st.addEventListener('click', () => { stop(); nowBar(); });
    bar.append(sit, st);
    if (now.embed) { const op = h('button', 'cn-btn', '動画を操作する（シーク・音量・全画面）'); op.type = 'button'; op.addEventListener('click', () => { close(); front(true); }); bar.append(op); }
    if (!now.embed) { const a = h('a', 'cn-btn', now.service + 'で開く'); a.href = now.url; a.target = '_blank'; a.rel = 'noopener'; a.style.display = 'inline-flex'; a.style.alignItems = 'center'; a.style.textDecoration = 'none'; bar.append(a); }
  }
  // リンクを調べて、上映 or 観たいリストへ
  async function probeUrl() {
    const url = $('cnUrl').value.trim(); if (!url) return;
    const box2 = $('cnPrev'); box2.innerHTML = '<p class="cn-meta">調べています…</p>';
    let v;
    try { v = await api('/api/videos?probe=' + encodeURIComponent(url)); } catch (e) { v = null; }
    if (!v || v.error) { box2.innerHTML = ''; box2.append(h('p', 'cn-meta', (v && v.error) || '調べられませんでした')); return; }
    box2.innerHTML = '';
    const wrapEl = h('div', 'cn-prev'); const img = document.createElement('img'); if (v.thumb) img.src = v.thumb;
    const info = h('div', ''); info.style.flex = '1'; info.style.minWidth = '0';
    const title = document.createElement('input'); title.value = v.title || ''; title.placeholder = '題名';
    info.append(title, h('div', 'cn-meta', [v.service, v.channel].filter(Boolean).join('　') + (v.embed ? '' : '　（ここでは再生できません）')));
    const acts = h('div', 'cn-acts');
    const go = h('button', 'cn-btn main', v.embed ? 'いま上映する' : '観た記録をつける'); go.type = 'button';
    const later = h('button', 'cn-btn', '観たいリストへ'); later.type = 'button';
    const save = async (status) => {
      const rec = { url: v.url, title: title.value.trim() || v.title || v.service, service: v.service, channel: v.channel, thumb: v.thumb, status, watched: status === '観た' ? 'today' : undefined };
      try { const j = await api('/api/videos', { method: 'POST', body: JSON.stringify(rec) }); list.unshift(j.record); renderList(); updatePosters(); toast(status === '観た' ? 'Notionの「動画」に記録しました' : '観たいリストに入れました'); }
      catch (e) { toast('Notionに保存できませんでした：' + String(e.message).slice(0, 50)); }
    };
    go.addEventListener('click', () => { play({ ...v, title: title.value.trim() || v.title }); nowBar(); save('観た'); $('cnUrl').value = ''; box2.innerHTML = ''; if (v.embed) { close(); sitFront(); } });
    later.addEventListener('click', () => { save('観たい'); $('cnUrl').value = ''; box2.innerHTML = ''; });
    acts.append(go, later); info.append(acts);
    wrapEl.append(img, info); box2.append(wrapEl);
  }
  // 1本の詳しい画面（上映・状態・評価・感想）
  function detail(v) {
    const det = $('cnDet'); det.innerHTML = ''; det.classList.add('open');
    det.append(h('b', '', v.title), h('div', 'cn-meta', [v.service, v.channel, v.genre ? 'ジャンル：' + v.genre : 'ジャンル：Notion の AI が仕分け中', (v.tags || []).map((t) => '#' + t).join(' ')].filter(Boolean).join('　')));
    const d2 = detect(v.url);
    const acts = h('div', 'cn-acts');
    const playB = h('button', 'cn-btn main', d2 && d2.embed ? 'スクリーンで上映' : (v.service || 'アプリ') + 'で開く'); playB.type = 'button';
    playB.addEventListener('click', () => {
      if (d2 && d2.embed) { play({ ...d2, title: v.title, thumb: v.thumb }); nowBar(); close(); sitFront(); }
      else { play({ ...(d2 || {}), title: v.title, thumb: v.thumb, url: v.url, service: v.service }); window.open(v.url, '_blank', 'noopener'); nowBar(); }
    });
    acts.append(playB); det.append(acts);
    const st = document.createElement('select'); ['観たい', '観た', 'お気に入り'].forEach((s) => { const o = document.createElement('option'); o.value = o.textContent = s; st.append(o); }); st.value = v.status || '観たい';
    const rt2 = document.createElement('select'); ['', '★★★★★', '★★★★', '★★★', '★★', '★'].forEach((s) => { const o = document.createElement('option'); o.value = s; o.textContent = s || '評価なし'; rt2.append(o); }); rt2.value = v.rating || '';
    const note = document.createElement('textarea'); note.rows = 3; note.placeholder = '感想'; note.value = v.note || '';
    const save = h('button', 'cn-btn', 'Notionに保存'); save.type = 'button';
    save.addEventListener('click', async () => {
      const fields = { status: st.value, rating: rt2.value, note: note.value };
      if (st.value === '観た' && !v.watched) fields.watched = 'today';
      try { const j = await api('/api/videos', { method: 'PATCH', body: JSON.stringify({ pageId: v.pageId, fields }) }); Object.assign(v, j.record); renderList(); toast('保存しました'); }
      catch (e) { toast('保存できませんでした：' + String(e.message).slice(0, 50)); }
    });
    det.append(st, rt2, note, save);
    det.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
  function open() { el.classList.add('open'); nowBar(); renderList(); loadList(); }
  function close() { el.classList.remove('open'); $('cnDet').classList.remove('open'); }
  $('cnClose').addEventListener('click', close);
  $('cnProbe').addEventListener('click', probeUrl);
  $('cnUrl').addEventListener('keydown', (e) => { if (e.key === 'Enter') probeUrl(); });

  // 正面のポスターに、最近の動画のサムネイルを貼る
  function updatePosters() {
    list.filter((v) => v.thumb).slice(0, 2).forEach((v, i) => {
      loader.load('/api/img?u=' + encodeURIComponent(v.thumb), (t) => { posters[i].material.map = t; posters[i].material.needsUpdate = true; });
    });
  }
  setTimeout(loadList, 4000);

  // ---------------- 一時停止・再生（動画の中へ合図を送る）、操作モード
  let paused = false;
  function control(cmd) {
    const f = holder.querySelector('iframe'); if (!f || !now) return false;
    if (now.service === 'YouTube') f.contentWindow.postMessage(JSON.stringify({ event: 'command', func: cmd === 'pause' ? 'pauseVideo' : 'playVideo', args: [] }), '*');
    else if (now.service === 'Vimeo') f.contentWindow.postMessage(JSON.stringify({ method: cmd }), '*');
    else return false;
    paused = cmd === 'pause'; return true;
  }
  const backBtn = document.createElement('button');
  backBtn.type = 'button'; backBtn.textContent = '3Dの映画館にもどる';
  backBtn.style.cssText = 'position:fixed;left:50%;bottom:calc(env(safe-area-inset-bottom,0px) + 18px);transform:translateX(-50%);z-index:40;height:46px;padding:0 20px;border-radius:23px;border:1px solid #c9a04e;background:rgba(20,14,8,.85);color:#f3dfa8;font-size:14px;display:none';
  document.body.append(backBtn);
  // 操作モード：動画を一番手前に出して、YouTube の操作（シーク・音量・全画面）を使えるようにする
  function front(on) {
    css.domElement.style.zIndex = on ? '35' : '0';
    holder.style.pointerEvents = on ? 'auto' : 'none';
    backBtn.style.display = on ? 'block' : 'none';
  }
  backBtn.addEventListener('click', () => front(false));
  // ---------------- 座る・立つ
  const occupied = new Set();
  let seatedAt = null;
  const standBtn = document.createElement('button');
  standBtn.type = 'button'; standBtn.textContent = '立つ';
  standBtn.style.cssText = 'position:fixed;right:16px;bottom:calc(env(safe-area-inset-bottom,0px) + 110px);z-index:13;width:64px;height:64px;border-radius:32px;border:1px solid #c9a04e;background:rgba(20,14,8,.8);color:#f3dfa8;font-size:15px;font-weight:700;display:none';
  document.body.append(standBtn);
  function sit(s) {
    if (!player) return;
    player.x = s.x + 0.05; player.z = s.z; player.yaw = -Math.PI / 2; player.pitch = 0.1; player.seated = true; player.eye = 1.15;
    seatedAt = s; standBtn.style.display = 'block';
  }
  function stand() {
    if (!player || !seatedAt) return;
    const aisles = [-27.4, -19, -10.9];
    const z = aisles.reduce((a, b) => (Math.abs(b - seatedAt.z) < Math.abs(a - seatedAt.z) ? b : a));
    player.seated = false; player.eye = 0; player.z = z; player.x = seatedAt.x;
    seatedAt = null; standBtn.style.display = 'none';
  }
  standBtn.addEventListener('click', stand);
  const FRONT = { x: ROWS[2], z: -17.25 };
  function sitFront() { if (inside(player)) { sit(FRONT); return; } warp({ x: 57.6, z: door, yaw: -Math.PI / 2, pitch: 0.06 }); setTimeout(() => sit(FRONT), 340); }

  // ---------------- 毎フレーム
  const fwd = new THREE.Vector3(), tmp = new THREE.Vector3();
  const inside = (p) => p && p.x > x0 + 0.2 && p.x < x1 - 0.2 && p.z > z0 + 0.2 && p.z < z1 - 0.2;
  let dim = 0, lastPlayer = null;
  function update(dt, time, camera, p) {
    lastPlayer = p;
    if (player && !player.seated && seatedAt) { seatedAt = null; standBtn.style.display = 'none'; }
    const inRoom = inside(p);
    // 上映中に中にいると、明かりがゆっくり落ちる（ライトダウン）
    const target = inRoom && now ? 1 : 0;
    dim += (target - dim) * Math.min(1, dt * (target ? 0.9 : 1.6));
    if (renderer && dim > 0.002) { renderer.toneMappingExposure *= 1 - 0.78 * dim; }
    warm.intensity = 0.7 * (1 - dim * 0.85);
    lampMat.emissiveIntensity = 1.4 * (1 - dim * 0.7);
    beam.visible = false; // 映写の光はスクリーンを見る邪魔になるので出さない（映写室の窓だけ光らせる）
    const near = p && Math.hypot(p.x - cx, p.z - cz) < 30;
    if (!near) return;
    audience.forEach((a) => {
      a.a.mixer.update(dt);
      if (now && !paused) { a.cheer -= dt; if (a.cheer < 0) { a.cheer = rand(15, 40); a.a.play('Cheer', { loop: false, fade: 0.2 }); setTimeout(() => a.a.play('Sit_Chair_Idle'), 2200); } }
    });
  }
  // カメラが動いたあと（毎フレームの最後）に、動画の位置を合わせて描く
  function renderCss(camera) {
    let show = false;
    if (inside(lastPlayer) && now && now.embed) {
      camera.getWorldDirection(fwd);
      tmp.set(SCREEN.x - camera.position.x, SCREEN.y - camera.position.y, SCREEN.z - camera.position.z).normalize();
      show = fwd.dot(tmp) > 0.2 && camera.position.x < SCREEN.x - 0.6;
    }
    if (css.domElement.style.zIndex === '35') show = !!(now && now.embed);
    film.visible = show; hole.visible = show; screen.visible = !show;
    document.body.classList.toggle('cine-watch', show); // 観ている間は、画面中央の点と案内を消す
    if (show || film.element.parentNode) css.render(cssScene, camera);
  }
  const ray = new THREE.Raycaster(); ray.far = 30;
  const center = new THREE.Vector2(0, 0);
  const targets = [screen, hole, marquee, ...posters, cushion, back];
  function hitTest(ndc, camera) { ray.setFromCamera(ndc || center, camera); return ray.intersectObjects(targets, false)[0] || null; }
  const seatOf = (hh) => (hh && (hh.object === cushion || hh.object === back) && hh.instanceId !== undefined ? seats[hh.instanceId] : null);
  function hint(camera) {
    const hh = hitTest(null, camera); if (!hh) return null;
    const st = seatOf(hh);
    if (st) { if (player && player.seated) return null; return occupied.has(st) ? ['座席', '　お客さんが座っています'] : ['座席', '　タップで座る']; }
    if (hh.object === screen || hh.object === hole) return now ? ['上映中', '　' + (now.title || now.service) + (now.embed ? '　タップで' + (paused ? '再生' : '一時停止') : '　タップで上映室') ] : ['スクリーン', '　タップで上映する動画を選ぶ'];
    return ['映画館', '　タップで上映室を開く'];
  }
  function pickFn(ndc, camera) {
    const hh = hitTest(ndc, camera); if (!hh) return false;
    const st = seatOf(hh);
    if (st) { if (occupied.has(st) || (player && player.seated)) return true; if (hh.distance > 6) return false; sit(st); return true; }
    if ((hh.object === screen || hh.object === hole) && now && now.embed) { const ok = control(paused ? 'play' : 'pause'); if (ok) { toast(paused ? '一時停止しました（もう一度タップで再生）' : '再生します'); return true; } }
    open(); return true;
  }
  return { attach, update, render: renderCss, hint, pick: pickFn, open, close, play, stop, get list() { return list; }, get now() { return now; } };
}

// サーバーと同じ見分け方（スクリーンで再生できるか）
function detect(raw) {
  let u; try { u = new URL(String(raw || '')); } catch (e) { return null; }
  const host = u.hostname.replace(/^www\.|^m\./, '');
  let id = '';
  if (host === 'youtu.be') id = u.pathname.slice(1).split('/')[0];
  else if (host.endsWith('youtube.com')) id = u.searchParams.get('v') || (u.pathname.match(/\/(shorts|live|embed|v)\/([^/?#]+)/) || [])[2] || '';
  if (id) return { service: 'YouTube', url: 'https://www.youtube.com/watch?v=' + id, embed: 'https://www.youtube.com/embed/' + id + '?playsinline=1&rel=0&modestbranding=1' };
  const vm = host.includes('vimeo.com') && (u.pathname.match(/(\d{6,})/) || [])[1];
  if (vm) return { service: 'Vimeo', url: 'https://vimeo.com/' + vm, embed: 'https://player.vimeo.com/video/' + vm + '?playsinline=1' };
  const nico = host.includes('nicovideo.jp') && (u.pathname.match(/((?:sm|so|nm)\d+)/) || [])[1];
  if (nico) return { service: 'ニコニコ', url: 'https://www.nicovideo.jp/watch/' + nico, embed: 'https://embed.nicovideo.jp/watch/' + nico };
  return { service: '', url: u.href, embed: '' };
}
