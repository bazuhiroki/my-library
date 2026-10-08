// My Factory：自分が生産する工場。工場長ドワーフに話して整理し、Notion で仕分け、作業台で作って出荷する。
import * as THREE from 'three';
import { CHAR_SCALE } from './characters.js';

export const FACTORY = { x0: 6, x1: 30, z0: 50, z1: 64, door: 14 };
const PASS = 'my-library:passcode';
const TIMER = 'my-library:factory:timer:v1';
const SEEN = 'my-library:factory:alert:v1';
const AREA_C = { 仕事: '#4a7fd1', プライベート: '#3fa36b' };
const STAGES = ['搬入', '仕分け済み', '計画済み', '作業中', '検品待ち', '出荷済み', '保留'];
const AGENTS = ['🧭 Triage', '🗓 Scheduler', '⚙️ Execution', '🔍 Review', '🧠 Research'];
const today = () => new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10);
const ymd = (d) => new Date(d.getTime() + 9 * 3600e3).toISOString().slice(0, 10);
const nowIso = () => new Date(Date.now() + 9 * 3600e3).toISOString().replace('Z', '+09:00').replace(/\.\d+\+/, '+');
function canvasTex(w, h, draw) { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); const t = new THREE.CanvasTexture(c); t.anisotropy = 4; return t; }

export function createFactory({ scene, colliders, world, toast }) {
  const std = (o) => new THREE.MeshStandardMaterial(o);
  const glow = (hex, k = 1.3) => std({ color: hex, emissive: hex, emissiveIntensity: k, roughness: 0.5 });
  const root = new THREE.Group(); scene.add(root);
  const { x0, x1, z0, z1, door } = FACTORY; const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, H = 6;
  const box = (mat, w, h, d, x, y, z, cast = true) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y, z); m.castShadow = cast; m.receiveShadow = true; root.add(m); return m; };
  const targets = []; const pickable = (m, st) => { m.userData.fac = st; targets.push(m); return m; };

  // ---------------- 歩ける範囲と小道
  world.addWalk({ x0: door - 1.4, x1: door + 1.4, z0: 46.5, z1: z0 + 0.6 });
  world.addWalk({ x0: x0 + 0.45, x1: x1 - 0.45, z0: z0 + 0.45, z1: z1 - 0.45 });
  const path = new THREE.Mesh(new THREE.PlaneGeometry(2.8, 3.6), std({ color: 0x4a4038, roughness: 0.95 })); path.rotation.x = -Math.PI / 2; path.position.set(door, 0.012, 48.4); root.add(path);

  // ---------------- 外観：煉瓦と黒い鉄骨、ノコギリ屋根、煙突
  const brick = std({ roughness: 0.92, map: canvasTex(256, 256, (g) => { g.fillStyle = '#5a2e22'; g.fillRect(0, 0, 256, 256); for (let y = 0; y < 256; y += 16) for (let x = (y / 16) % 2 ? -16 : 0; x < 256; x += 32) { g.fillStyle = `hsl(12,${38 + Math.random() * 12}%,${24 + Math.random() * 8}%)`; g.fillRect(x + 1, y + 1, 30, 14); } }) });
  brick.map.wrapS = brick.map.wrapT = THREE.RepeatWrapping; brick.map.repeat.set(5, 1.5);
  const steel = std({ color: 0x18181b, metalness: 0.7, roughness: 0.35 });
  box(brick, x1 - x0, H, 0.35, cx, H / 2, z1); box(brick, 0.35, H, z1 - z0, x0, H / 2, cz); box(brick, 0.35, H, z1 - z0, x1, H / 2, cz);
  box(brick, door - 1.5 - x0, H, 0.35, (x0 + door - 1.5) / 2, H / 2, z0); box(brick, x1 - door - 1.5, H, 0.35, (door + 1.5 + x1) / 2, H / 2, z0); box(brick, 3, H - 3.3, 0.35, door, 3.3 + (H - 3.3) / 2, z0);
  [x0, x1].forEach((x) => [z0, z1].forEach((z) => box(steel, 0.45, H + 0.2, 0.45, x, H / 2, z)));
  box(steel, x1 - x0 + 0.4, 0.3, 0.45, cx, H, z0); box(steel, x1 - x0 + 0.4, 0.3, 0.45, cx, H, z1);
  // ノコギリ屋根（4つの歯。北向きの面は明かり取りのガラス）
  const roofMat = std({ color: 0x232327, roughness: 0.6, metalness: 0.4, side: THREE.DoubleSide });
  const glass = std({ color: 0x9fb8c8, emissive: 0x3a4a55, emissiveIntensity: 0.4, roughness: 0.15, metalness: 0.5, side: THREE.DoubleSide });
  const teeth = 4, tw = (z1 - z0) / teeth;
  for (let i = 0; i < teeth; i++) {
    const za = z0 + i * tw;
    const slope = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0, Math.hypot(tw, 2)), roofMat); slope.position.set(cx, H + 1, za + tw / 2); slope.rotation.x = -Math.PI / 2 + Math.atan2(2, tw); root.add(slope);
    const pane = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0, 2), glass); pane.position.set(cx, H + 1, za); root.add(pane);
  }
  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0, z1 - z0), std({ color: 0x2a2826, roughness: 1 })); ceil.rotation.x = Math.PI / 2; ceil.position.set(cx, H - 0.02, cz); root.add(ceil);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0, z1 - z0), std({ color: 0x3c3a37, roughness: 0.85 })); floor.rotation.x = -Math.PI / 2; floor.position.set(cx, 0.011, cz); floor.receiveShadow = true; root.add(floor);
  const chimney = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.9, 12, 16), brick); chimney.position.set(x1 - 2.5, 6, z1 - 2.5); chimney.castShadow = true; root.add(chimney);
  box(steel, 1.8, 0.25, 1.8, x1 - 2.5, 12.05, z1 - 2.5, false);
  colliders.push({ x0: x1 - 3.4, x1: x1 - 1.6, z0: z1 - 3.4, z1: z1 - 1.6 });
  // 看板とランプ
  const signTex = canvasTex(1024, 192, (g, w, h) => { g.fillStyle = '#121214'; g.fillRect(0, 0, w, h); g.strokeStyle = '#8a6a3a'; g.lineWidth = 6; g.strokeRect(8, 8, w - 16, h - 16); g.fillStyle = '#f2e8d8'; g.font = '700 104px "Helvetica Neue", Arial, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('My Factory', w / 2, h / 2 + 4); });
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(6.4, 1.2), new THREE.MeshBasicMaterial({ map: signTex })); sign.position.set(door + 4.2, 4.4, z0 - 0.2); sign.rotation.y = Math.PI; root.add(sign); pickable(sign, { tab: 'dwarf' });
  const redLamp = glow(0x441010, 0.3), greenLamp = glow(0x0e3a1c, 0.3);
  const rl = new THREE.Mesh(new THREE.SphereGeometry(0.22, 14, 10), redLamp); rl.position.set(door - 1.9, 2.9, z0 - 0.3); root.add(rl);
  const gl = new THREE.Mesh(new THREE.SphereGeometry(0.22, 14, 10), greenLamp); gl.position.set(door + 1.9, 2.9, z0 - 0.3); root.add(gl);
  const postTex = canvasTex(512, 128, (g, w, h) => { g.fillStyle = '#121214'; g.fillRect(0, 0, w, h); g.fillStyle = '#f2e8d8'; g.font = '700 56px "Helvetica Neue", Arial, sans-serif'; g.textAlign = 'center'; g.fillText('My Factory  ↓', w / 2, 84); });
  const post = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 0.55), new THREE.MeshBasicMaterial({ map: postTex })); post.position.set(door + 2.2, 2.3, 46.2); post.rotation.y = Math.PI; root.add(post);
  box(steel, 0.1, 2.1, 0.1, door + 2.2, 1.05, 46.25, false);

  // ---------------- 中：搬入口・コンベア・4本の仕分けレーン・ロボット・計画ボード・作業台・検品台・出荷口
  const wood = std({ color: 0x6b4a2e, roughness: 0.85 });
  const crateMat = std({ color: 0x9a6b3a, roughness: 0.9 });
  // 搬入口（ドワーフの持ち場）
  box(wood, 2.6, 0.9, 1.4, x0 + 2.4, 0.45, z0 + 2.4); colliders.push({ x0: x0 + 1, x1: x0 + 3.8, z0: z0 + 1.6, z1: z0 + 3.2 });
  const dockTex = canvasTex(256, 64, (g, w, h) => { g.fillStyle = '#2a2420'; g.fillRect(0, 0, w, h); g.fillStyle = '#f2e8d8'; g.font = '700 36px sans-serif'; g.textAlign = 'center'; g.fillText('搬入口', w / 2, 46); });
  const dockSign = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 0.35), new THREE.MeshBasicMaterial({ map: dockTex })); dockSign.position.set(x0 + 2.4, 1.5, z0 + 1.65); dockSign.rotation.y = Math.PI; root.add(dockSign); pickable(dockSign, { tab: 'dwarf' });
  // コンベア（帯の模様が流れる）
  const beltTex = canvasTex(64, 64, (g) => { g.fillStyle = '#1c1c1e'; g.fillRect(0, 0, 64, 64); g.fillStyle = '#2c2c30'; for (let i = 0; i < 64; i += 16) g.fillRect(i, 0, 8, 64); });
  beltTex.wrapS = beltTex.wrapT = THREE.RepeatWrapping; beltTex.repeat.set(10, 1);
  const beltMat = std({ map: beltTex, roughness: 0.7 });
  const belt = box(beltMat, 15, 0.12, 1.1, x0 + 11, 0.8, z0 + 5.5); box(steel, 15.2, 0.75, 0.9, x0 + 11, 0.37, z0 + 5.5);
  colliders.push({ x0: x0 + 3.4, x1: x0 + 18.6, z0: z0 + 4.9, z1: z0 + 6.1 });
  const LANES = [{ name: '①', c: 0xc8352b }, { name: '②', c: 0x9a9a9a }, { name: '③', c: 0x777777 }, { name: '④', c: 0x555555 }];
  const lanes = LANES.map((l, i) => {
    const x = x0 + 19.6 + i * 1.15;
    const lane = box(beltMat, 0.9, 0.12, 4.2, x, 0.8, z0 + 7.6); box(steel, 0.8, 0.75, 4.2, x, 0.37, z0 + 7.6, false);
    const tag = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.08, 0.3), glow(l.c, i === 0 ? 0.9 : 0.15)); tag.position.set(x, 0.92, z0 + 5.6); root.add(tag);
    pickable(lane, { tab: 'bench' });
    return { x, tag, crates: [] };
  });
  colliders.push({ x0: x0 + 19.1, x1: x0 + 23.5, z0: z0 + 5.4, z1: z0 + 9.8 });
  // 流れる木箱（搬入の件数）
  const crates = []; const crateGeo = new THREE.BoxGeometry(0.5, 0.4, 0.5);
  for (let i = 0; i < 8; i++) { const c = new THREE.Mesh(crateGeo, crateMat); c.castShadow = true; c.visible = false; c.position.set(x0 + 4 + i * 1.8, 1.06, z0 + 5.5); root.add(c); crates.push(c); }
  // エージェントのロボット（手元の箱の数＝担当の件数）
  const robots = AGENTS.map((a, i) => {
    const g = new THREE.Group(); g.position.set(x0 + 5 + i * 3, 0, z0 + 3.9); root.add(g);
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.7, 0.45), std({ color: 0x8a8f96, metalness: 0.6, roughness: 0.35 })); body.position.y = 0.75; g.add(body);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.24, 14, 10), std({ color: 0x9aa0a8, metalness: 0.6, roughness: 0.3 })); head.position.y = 1.32; g.add(head);
    const eye = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.06, 0.02), glow(0x7fd8ff, 1.2)); eye.position.set(0, 1.34, 0.23); head.parent.add(eye);
    [-0.32, 0.32].forEach((s) => { const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.5, 8), steel); arm.position.set(s, 0.8, 0.12); arm.rotation.x = -0.8; g.add(arm); });
    const stack = new THREE.Group(); stack.position.set(0, 1.0, 0.45); g.add(stack);
    const lbl = canvasTex(256, 64, (c, w, h) => { c.fillStyle = 'rgba(0,0,0,.6)'; c.fillRect(0, 0, w, h); c.fillStyle = '#fff'; c.font = '700 34px sans-serif'; c.textAlign = 'center'; c.fillText(a, w / 2, 44); });
    const plate = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 0.25), new THREE.MeshBasicMaterial({ map: lbl, transparent: true })); plate.position.set(0, 1.75, 0); plate.rotation.y = Math.PI; g.add(plate);
    pickable(body, { tab: 'whole' });
    colliders.push({ x0: g.position.x - 0.35, x1: g.position.x + 0.35, z0: g.position.z - 0.3, z1: g.position.z + 0.3 });
    return { g, stack, head, a };
  });
  // 生産計画ボード（東の壁一面の黒板）
  const boardCanvas = document.createElement('canvas'); boardCanvas.width = 1024; boardCanvas.height = 512;
  const boardTex = new THREE.CanvasTexture(boardCanvas);
  const boardMesh = new THREE.Mesh(new THREE.PlaneGeometry(9, 4.5), new THREE.MeshBasicMaterial({ map: boardTex })); boardMesh.position.set(x1 - 0.22, 2.8, cz + 0.5); boardMesh.rotation.y = -Math.PI / 2; root.add(boardMesh); pickable(boardMesh, { tab: 'plan' });
  box(wood, 0.12, 4.8, 9.3, x1 - 0.16, 2.8, cz + 0.5, false);
  // 作業台（自分の机）
  const bench = box(wood, 4.2, 0.12, 1.6, cx - 3, 0.95, z1 - 4); [-1.9, 1.9].forEach((dx) => [-0.6, 0.6].forEach((dz) => box(steel, 0.1, 0.9, 0.1, cx - 3 + dx, 0.45, z1 - 4 + dz, false)));
  const benchLamp = new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.3, 16, 1, true), glow(0xffd9a0, 0.8)); benchLamp.position.set(cx - 3, 2.3, z1 - 4); root.add(benchLamp);
  pickable(bench, { tab: 'bench' }); colliders.push({ x0: cx - 5.2, x1: cx - 0.8, z0: z1 - 4.9, z1: z1 - 3.1 });
  // 検品台と出荷口
  const inspect = box(wood, 2, 0.1, 1.2, x0 + 2.2, 0.9, z1 - 5); box(steel, 1.9, 0.85, 1.1, x0 + 2.2, 0.42, z1 - 5, false); pickable(inspect, { tab: 'records' });
  colliders.push({ x0: x0 + 1.1, x1: x0 + 3.3, z0: z1 - 5.7, z1: z1 - 4.3 });
  const shipped = []; for (let i = 0; i < 12; i++) { const c = new THREE.Mesh(crateGeo, std({ color: 0x5f8f5a, roughness: 0.85 })); c.position.set(x0 + 1.2 + (i % 4) * 0.6, 0.2 + Math.floor(i / 4) * 0.42, z1 - 1.2); c.visible = false; root.add(c); shipped.push(c); }
  const shipTex = canvasTex(256, 64, (g, w, h) => { g.fillStyle = '#1d2a1c'; g.fillRect(0, 0, w, h); g.fillStyle = '#cfe8c8'; g.font = '700 36px sans-serif'; g.textAlign = 'center'; g.fillText('出荷口', w / 2, 46); });
  const shipSign = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 0.35), new THREE.MeshBasicMaterial({ map: shipTex })); shipSign.position.set(x0 + 2.1, 2.2, z1 - 0.2); shipSign.rotation.y = Math.PI; root.add(shipSign); pickable(shipSign, { tab: 'records' });
  colliders.push({ x0: x0 + 0.6, x1: x0 + 3.6, z0: z1 - 1.7, z1: z1 - 0.6 });
  // 煙突の蒸気（今日の出荷が多いほど増える）
  const steamTex = canvasTex(64, 64, (g) => { const r = g.createRadialGradient(32, 32, 2, 32, 32, 30); r.addColorStop(0, 'rgba(235,235,235,.85)'); r.addColorStop(1, 'rgba(235,235,235,0)'); g.fillStyle = r; g.fillRect(0, 0, 64, 64); });
  const puffs = []; for (let i = 0; i < 14; i++) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: steamTex, transparent: true, depthWrite: false, opacity: 0 })); s.position.set(x1 - 2.5, 12.3, z1 - 2.5); root.add(s); puffs.push({ s, t: i / 14 }); }
  let steamCount = 3;

  // ---------------- 工場長ドワーフ
  let dwarf = null;
  function attach(cast) {
    try {
      const a = cast.spawn('Barbarian', { gear: ['1H_Axe'] });
      const inner = a.root.children[0]; inner.scale.set(CHAR_SCALE * 1.14, CHAR_SCALE * 0.78, CHAR_SCALE * 1.14);
      const head = a.root.getObjectByName('head');
      if (head) { const m = std({ color: 0x9a948c, roughness: 0.85 }); const beard = new THREE.Mesh(new THREE.ConeGeometry(0.42, 0.95, 12), m); beard.rotation.x = Math.PI; beard.scale.set(1, 1, 0.55); beard.position.set(0, -0.2, 0.43); head.add(beard); const goggles = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.04, 6, 14), steel); goggles.position.set(0, 0.32, 0.5); head.add(goggles); }
      a.root.position.set(x0 + 2.4, 0, z0 + 3.6); a.root.rotation.y = Math.PI; scene.add(a.root); a.play('Idle');
      dwarf = a; pickable(a.root.children[0], { tab: 'dwarf' });
      a.root.traverse((o) => { if (o.isMesh) { o.userData.fac = { tab: 'dwarf' }; targets.push(o); } });
    } catch (e) { /* キャラクターが読めなくても工場は動く */ }
  }

  // ---------------- データ
  let data = null, loading = false, alerts = null;
  async function api(url, opt) {
    for (let k = 0; k < 2; k++) {
      const o = Object.assign({}, opt); o.headers = Object.assign({ 'Content-Type': 'application/json', 'x-app-key': localStorage.getItem(PASS) || '' }, o.headers);
      const r = await fetch(url, o);
      if (r.status === 401) { const p = window.prompt('合言葉を入れてね（Vercel の APP_PASSCODE）'); if (!p) throw new Error('passcode'); localStorage.setItem(PASS, p); continue; }
      const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j.error || String(r.status)); return j;
    }
    throw new Error('passcode');
  }
  async function load() {
    if (loading) return; loading = true;
    try { data = await api('/api/factory'); hangData(); if (el.classList.contains('open')) render(); } catch (e) { toast('工場のデータを読めませんでした：' + String(e.message).slice(0, 50)); }
    loading = false;
  }
  const open = () => (data ? data.tasks.filter((t) => t.stage !== '出荷済み') : []);
  const shippedToday = () => (data ? data.tasks.filter((t) => t.stage === '出荷済み' && (t.shipped || '').slice(0, 10) === today()).length : 0);
  function hangData() {
    const o = open();
    const inbox = o.filter((t) => t.stage === '搬入').length;
    crates.forEach((c, i) => { c.visible = i < Math.min(8, inbox); });
    lanes.forEach((l, i) => { const n = o.filter((t) => (t.priority || '').startsWith('①②③④'[i])).length; l.tag.material.emissiveIntensity = n ? (i === 0 ? 1.6 : 0.6) : 0.1; });
    robots.forEach((r) => { r.stack.clear(); const n = Math.min(6, o.filter((t) => t.owner === r.a).length); for (let i = 0; i < n; i++) { const c = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.12, 0.22), crateMat); c.position.y = i * 0.13; r.stack.add(c); } });
    const sd = shippedToday(); steamCount = Math.min(14, 3 + sd * 2);
    const weekShip = data.tasks.filter((t) => t.stage === '出荷済み' && (t.shipped || '') >= ymd(new Date(Date.now() - 7 * 86400e3))).length;
    shipped.forEach((c, i) => { c.visible = i < Math.min(12, weekShip); });
    redLamp.emissive.set(o.some((t) => (t.priority || '').startsWith('①')) ? 0xff2a1a : 0x441010); redLamp.emissiveIntensity = o.some((t) => (t.priority || '').startsWith('①')) ? 2 : 0.3;
    greenLamp.emissive.set(sd ? 0x36e07a : 0x0e3a1c); greenLamp.emissiveIntensity = sd ? 1.6 : 0.3;
    drawBoard();
  }
  function drawBoard() {
    const g = boardCanvas.getContext('2d'); const w = 1024, h = 512;
    g.fillStyle = '#1f2a24'; g.fillRect(0, 0, w, h); g.fillStyle = '#e8efe6'; g.font = '700 40px sans-serif'; g.fillText('生産計画　今週', 30, 56);
    const o = open(); const base = new Date(Date.now() + 9 * 3600e3); base.setUTCHours(0, 0, 0, 0);
    for (let i = 0; i < 7; i++) {
      const d = new Date(base.getTime() + i * 86400e3 - 9 * 3600e3); const key = ymd(d); const x = 30 + i * 140;
      g.strokeStyle = 'rgba(232,239,230,.35)'; g.strokeRect(x, 80, 130, 400);
      g.fillStyle = i === 0 ? '#ffd27a' : '#e8efe6'; g.font = '700 26px sans-serif'; g.fillText((d.getMonth() + 1) + '/' + d.getDate() + ' ' + '日月火水木金土'[d.getDay()], x + 10, 112);
      const list = o.filter((t) => (t.plan || '').slice(0, 10) === key || (t.due || '').slice(0, 10) === key).slice(0, 8);
      list.forEach((t, k) => { g.fillStyle = (t.priority || '').startsWith('①') ? '#ff6a5a' : AREA_C[t.area] || '#cfd8d0'; g.fillRect(x + 8, 128 + k * 42, 6, 30); g.fillStyle = '#e8efe6'; g.font = '20px sans-serif'; g.fillText(((t.due || '').slice(0, 10) === key ? '⚑' : '') + t.title.slice(0, 7), x + 20, 150 + k * 42); });
    }
    boardTex.needsUpdate = true;
  }

  // ---------------- パネル
  const css = document.createElement('style');
  css.textContent = `#factory{position:fixed;inset:auto 0 0 0;z-index:12;padding:0 10px calc(env(safe-area-inset-bottom,0px) + 10px);transform:translateY(110%);transition:transform .4s cubic-bezier(.2,.8,.2,1)}
#factory.open{transform:none}#factory .card{max-height:88vh;overflow-y:auto;display:block;background:linear-gradient(170deg,rgba(28,24,22,.98),rgba(14,13,12,.99));border:1px solid rgba(210,170,120,.3);color:#efe6da}
#factory h2{font-family:"Helvetica Neue",Arial,sans-serif;font-size:20px;margin:0;font-weight:800;letter-spacing:.02em}
.fc-tabs{display:flex;gap:6px;margin:10px 0;overflow-x:auto}.fc-tabs button,.fc-chips button{flex:0 0 auto;min-height:34px;padding:0 12px;border-radius:17px;border:1px solid rgba(210,170,120,.35);background:transparent;color:#e6dccd;font-size:13px;font-family:var(--ui)}
.fc-tabs button[aria-pressed=true],.fc-chips button[aria-pressed=true]{background:#d2a978;color:#1a1410;font-weight:700}
.fc-chips{display:flex;flex-wrap:wrap;gap:6px;margin:6px 0}
.fc-btn{min-height:40px;padding:0 14px;border-radius:12px;border:1px solid rgba(210,170,120,.45);background:rgba(210,170,120,.08);color:#efe6da;font-size:13px;font-family:var(--ui)}.fc-btn.main{background:#d2a978;color:#1a1410;font-weight:700}
.fc-acts{display:flex;flex-wrap:wrap;gap:8px;margin:10px 0}
.fc-say{display:flex;gap:10px;margin:10px 0}.fc-say i{flex:0 0 34px;height:34px;border-radius:17px;background:radial-gradient(circle at 40% 35%,#f0d8b0,#9a6b3a);font-style:normal;text-align:center;line-height:34px}.fc-say p{margin:0;padding:9px 12px;border-radius:4px 14px 14px 14px;background:rgba(255,255,255,.06);font-size:14px;line-height:1.7;white-space:pre-wrap}
.fc-me{text-align:right;margin:8px 0}.fc-me p{display:inline-block;margin:0;padding:8px 12px;border-radius:14px 4px 14px 14px;background:rgba(210,170,120,.16);font-size:14px;text-align:left;white-space:pre-wrap}
.fc-ta{width:100%;box-sizing:border-box;min-height:52px;border-radius:12px;border:1px solid rgba(210,170,120,.3);background:rgba(0,0,0,.3);color:#efe6da;font-size:16px;padding:10px;font-family:var(--ui)}
.fc-in{display:flex;gap:6px;align-items:flex-end}.fc-in .fc-ta{flex:1}
.fc-t{display:block;width:100%;text-align:left;margin:8px 0;padding:10px 12px;border-radius:12px;border:1px solid rgba(255,255,255,.1);border-left:5px solid var(--c,#8a7a6a);background:rgba(255,255,255,.04);color:#efe6da;font-family:var(--ui)}
.fc-t b{display:block;font-size:14.5px}.fc-t span{display:block;font-size:12px;color:#b8ab9a;margin-top:3px}
.fc-lab{font-size:12px;color:#b8ab9a;margin:12px 0 4px}
.fc-cal{display:grid;grid-template-columns:repeat(7,1fr);gap:3px}.fc-cal button{min-height:46px;border-radius:8px;border:1px solid rgba(255,255,255,.08);background:rgba(255,255,255,.03);color:#efe6da;font-size:12px;padding:2px;display:flex;flex-direction:column;align-items:center;gap:2px}
.fc-cal button[aria-pressed=true]{border-color:#d2a978}.fc-cal .dots{display:flex;gap:2px;flex-wrap:wrap;justify-content:center}.fc-cal .dots i{width:6px;height:6px;border-radius:3px}
.fc-tree{font-size:13.5px;line-height:1.8}.fc-tree div{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.fc-note{font-size:10.5px;color:#9a8e7e;margin-top:10px;line-height:1.6}
#fcAlert{position:fixed;top:calc(env(safe-area-inset-top,0px) + 54px);left:50%;transform:translateX(-50%);z-index:13;max-width:92vw;padding:9px 14px;border-radius:14px;background:rgba(24,20,18,.94);border:1px solid #c8352b;color:#f6ece0;font-size:13px;font-family:var(--ui);display:none;gap:10px;align-items:center;box-shadow:0 6px 20px rgba(0,0,0,.4)}
#fcAlert.on{display:flex}#fcAlert button{background:none;border:0;color:#d8c8b8;font-size:16px}
#fcTimer{position:fixed;top:calc(env(safe-area-inset-top,0px) + 54px);right:10px;z-index:13;padding:7px 12px;border-radius:16px;background:#d2a978;color:#1a1410;font-weight:700;font-size:13px;font-family:var(--ui);display:none;border:0}#fcTimer.on{display:block}`;
  document.head.append(css);
  const el = document.createElement('section'); el.id = 'factory';
  el.innerHTML = `<div class='card'><div class='chead'><h2>My Factory</h2><button id='fcClose' class='fc-btn' type='button'>閉じる</button></div><div class='fc-tabs' id='fcTabs'></div><div id='fcBody'></div><p class='fc-note'>データは Notion「My Factory」（生産ライン・プロジェクト・作業ログ）にあります。仕分けと計画は Notion のエージェントが行います。</p></div>`;
  document.body.append(el);
  const alertEl = document.createElement('div'); alertEl.id = 'fcAlert'; document.body.append(alertEl);
  const timerEl = document.createElement('button'); timerEl.id = 'fcTimer'; timerEl.type = 'button'; document.body.append(timerEl);
  timerEl.addEventListener('click', () => openPanel({ tab: 'bench' }));
  const $ = (id) => document.getElementById(id);
  const h = (tag, cls, t) => { const e = document.createElement(tag); if (cls) e.className = cls; if (t !== undefined) e.textContent = t; return e; };
  const btn = (p, label, fn, main) => { const b = h('button', 'fc-btn' + (main ? ' main' : ''), label); b.type = 'button'; b.addEventListener('click', fn); p.append(b); return b; };
  const TABS = [['dwarf', '工場長'], ['bench', '作業台'], ['plan', '計画'], ['whole', '全体像'], ['records', '記録']];
  let tab = 'dwarf';
  const chat = { messages: [], plan: null, thinking: false, input: '文字' };
  let energy = 'Mid', minutes = 30, calMonth = new Date(), calSel = today(), calMode = 'month';
  let timer = null; try { timer = JSON.parse(localStorage.getItem(TIMER) || 'null'); } catch (e) { timer = null; }

  const taskCard = (t, extra) => {
    const b = h('div', 'fc-t'); b.style.setProperty('--c', (t.priority || '').startsWith('①') ? '#c8352b' : AREA_C[t.area] || '#8a7a6a');
    b.append(h('b', '', t.title), h('span', '', [t.stage, t.area, t.kind, t.est ? '見積' + t.est + '分' : '', t.actual ? '実績' + t.actual + '分' : '', t.plan ? '予定' + t.plan.slice(5, 10) : '', t.due ? '⚑' + t.due.slice(5, 10) : '', t.postponed >= 3 ? '後回し' + t.postponed + '回' : ''].filter(Boolean).join('・')));
    if (t.next) b.append(h('span', '', '次の一手：' + t.next));
    if (extra) extra(b); return b;
  };
  function render() {
    const tabs = $('fcTabs'); tabs.innerHTML = '';
    TABS.forEach(([k, l]) => { const b = h('button', '', l); b.type = 'button'; b.setAttribute('aria-pressed', tab === k ? 'true' : 'false'); b.addEventListener('click', () => { tab = k; render(); }); tabs.append(b); });
    const body = $('fcBody'); body.innerHTML = '';
    if (!data) { body.append(h('p', 'fc-note', '工場のデータを読み込み中…')); return; }
    ({ dwarf: renderDwarf, bench: renderBench, plan: renderPlan, whole: renderWhole, records: renderRecords })[tab](body);
  }

  // 工場長と話す → 案を見る → 搬入
  function renderDwarf(body) {
    const say = (t) => { const d = h('div', 'fc-say'); d.append(h('i', '', '⚒'), h('p', '', t)); return d; };
    if (!chat.messages.length) body.append(say('よう、来たな。頭の中にあることを、まとめずにそのまま話してくれ。分けるのはこっちの仕事だ。'));
    chat.messages.forEach((m) => { if (m.role === 'user') { const d = h('div', 'fc-me'); d.append(h('p', '', m.text)); body.append(d); } else body.append(say(m.text)); });
    if (chat.thinking) body.append(say('…図面を引いてる。'));
    const plan = chat.plan;
    if (plan && plan.items && plan.items.length) {
      body.append(h('div', 'fc-lab', 'こう分けた（確認してから搬入する）'));
      const tree = h('div', 'fc-tree');
      const pj = plan.project || {};
      if (pj.existing || pj.name) tree.append(h('div', '', '📦 ' + (pj.existing ? ((data.projects.find((p) => p.id === pj.existing) || {}).name || '既存のプロジェクト') : pj.name + '（新規）') + (pj.area ? '　' + pj.area : '')));
      plan.items.forEach((it) => { const ind = { 親: 1, 子: 2, 孫: 3 }[it.level] || 2; tree.append(h('div', '', '　'.repeat(ind) + (ind === 1 ? '■ ' : ind === 2 ? '└ ' : '　└ ') + it.title + `（${it.area || ''}・${it.kind || ''}${it.repeat && it.repeat !== 'なし' ? '・' + it.repeat : ''}${it.estimate ? '・' + it.estimate + '分' : ''}${it.due ? '・⚑' + it.due.slice(5) : ''}）`)); });
      body.append(tree);
      const a = h('div', 'fc-acts'); body.append(a);
      btn(a, 'この形で搬入する', commit, true); btn(a, '作り直す', () => { chat.plan = null; render(); });
    }
    const row = h('div', 'fc-in'); const ta = h('textarea', 'fc-ta'); ta.placeholder = '例：来週の会議資料を作る。あと毎朝ランニング'; row.append(ta);
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SR) { const mic = h('button', 'fc-btn', '🎤'); mic.type = 'button'; let rec = null; mic.addEventListener('click', () => { if (rec) { rec.stop(); return; } rec = new SR(); rec.lang = 'ja-JP'; rec.interimResults = true; rec.continuous = true; const base = ta.value; rec.onresult = (e) => { let s = ''; for (let i = 0; i < e.results.length; i++) s += e.results[i][0].transcript; ta.value = base + s; chat.input = '音声'; }; rec.onend = () => { rec = null; mic.textContent = '🎤'; }; rec.start(); mic.textContent = '■'; }); row.append(mic); }
    const send = h('button', 'fc-btn main', '話す'); send.type = 'button'; send.addEventListener('click', () => talk(ta.value)); row.append(send);
    body.append(row);
  }
  async function talk(text) {
    const t = String(text || '').trim(); if (!t || chat.thinking) return;
    chat.messages.push({ role: 'user', text: t }); chat.thinking = true; render();
    try {
      const j = await api('/api/factory', { method: 'POST', body: JSON.stringify({ action: 'dwarf', messages: chat.messages }) });
      chat.thinking = false;
      if (j.crisis) { chat.messages.push({ role: 'dwarf', text: j.reply + '\n' + (j.resources || []).map((r) => r.name + ' ' + r.tel).join('\n') }); render(); return; }
      chat.messages.push({ role: 'dwarf', text: (j.reply || '') + (j.question ? '\n\n' + j.question : '') }); chat.plan = j; render();
    } catch (e) { chat.thinking = false; toast(String(e.message).slice(0, 80)); render(); }
  }
  async function commit() {
    try {
      const raw = chat.messages.filter((m) => m.role === 'user').map((m) => m.text).join('\n');
      const j = await api('/api/factory', { method: 'POST', body: JSON.stringify({ action: 'commit', plan: chat.plan, raw, input: chat.input }) });
      toast(j.created + '件を搬入した。仕分けは Notion の Triage に任せる');
      chat.messages = []; chat.plan = null; chat.input = '文字'; await load();
    } catch (e) { toast('搬入できませんでした：' + String(e.message).slice(0, 60)); }
  }

  // 作業台：いまのエネルギーと時間に合うものを1〜3件
  const hasChildren = (t) => data.tasks.some((x) => x.parents.includes(t.id) && x.stage !== '出荷済み');
  function picks() {
    const okE = { High: ['High', 'Mid', 'Low'], Mid: ['Mid', 'Low'], Low: ['Low'] }[energy];
    const pr = (t) => ({ '①': 0, '②': 1, '③': 2, '④': 3 }[(t.priority || '④')[0]] ?? 3);
    return open().filter((t) => ['計画済み', '仕分け済み', '作業中', '搬入'].includes(t.stage) && !hasChildren(t) && (!t.energy || okE.includes(t.energy)) && (!t.est || t.est <= minutes))
      .sort((a, b) => (b.stage === '作業中') - (a.stage === '作業中') || ((a.plan || '9') .slice(0, 10) <= today() ? 0 : 1) - ((b.plan || '9').slice(0, 10) <= today() ? 0 : 1) || pr(a) - pr(b) || (a.due || '9').localeCompare(b.due || '9')).slice(0, 3);
  }
  function renderBench(body) {
    if (timer) {
      body.append(h('div', 'fc-lab', '作業中'));
      const t = data.tasks.find((x) => x.id === timer.id) || { title: timer.title };
      body.append(taskCard({ ...t, title: t.title }, (b) => { b.append(h('span', '', '経過 ' + Math.floor((Date.now() - timer.t0) / 60000) + '分')); }));
      body.append(h('div', 'fc-lab', '止めるとき：どうだった？'));
      const st = { result: '進んだ', focus: '中', reason: '' };
      const seg = (list, k) => { const c = h('div', 'fc-chips'); list.forEach((v) => { const b = h('button', '', v); b.type = 'button'; b.setAttribute('aria-pressed', st[k] === v ? 'true' : 'false'); b.addEventListener('click', () => { st[k] = v; c.querySelectorAll('button').forEach((x) => x.setAttribute('aria-pressed', x === b ? 'true' : 'false')); }); c.append(b); }); return c; };
      body.append(seg(['進んだ', '終わった', '中断', '進まなかった'], 'result'), h('div', 'fc-lab', '集中度'), seg(['高', '中', '低'], 'focus'));
      const r = h('textarea', 'fc-ta'); r.placeholder = '中断・進まなかった理由（あれば）'; r.addEventListener('input', () => { st.reason = r.value; }); body.append(r);
      const a = h('div', 'fc-acts'); body.append(a); btn(a, '止めて記録する', () => stopTimer(st), true);
      return;
    }
    const o = open(); const urgent = o.filter((t) => (t.priority || '').startsWith('①'));
    if (urgent.length) { body.append(h('div', 'fc-lab', '今日の ① 緊急×重要')); urgent.slice(0, 3).forEach((t) => body.append(taskCard(t, (b) => { const a = h('div', 'fc-acts'); btn(a, '始める', () => startTimer(t), true); b.append(a); }))); }
    body.append(h('div', 'fc-lab', 'いまのエネルギー'));
    const ec = h('div', 'fc-chips'); ['High', 'Mid', 'Low'].forEach((v) => { const b = h('button', '', v); b.type = 'button'; b.setAttribute('aria-pressed', energy === v ? 'true' : 'false'); b.addEventListener('click', () => { energy = v; render(); }); ec.append(b); }); body.append(ec);
    body.append(h('div', 'fc-lab', '使える時間'));
    const mc = h('div', 'fc-chips'); [15, 30, 60, 90].forEach((v) => { const b = h('button', '', v + '分'); b.type = 'button'; b.setAttribute('aria-pressed', minutes === v ? 'true' : 'false'); b.addEventListener('click', () => { minutes = v; render(); }); mc.append(b); }); body.append(mc);
    const p = picks(); body.append(h('div', 'fc-lab', 'いまの自分に合うもの（' + p.length + '件）'));
    if (!p.length) body.append(h('p', 'fc-note', '合うものがない。時間かエネルギーを変えるか、工場長に分けてもらおう。'));
    p.forEach((t) => body.append(taskCard(t, (b) => { const a = h('div', 'fc-acts'); btn(a, '始める', () => startTimer(t), true); if (t.stage !== '出荷済み') btn(a, '出荷（完了）', () => ship(t)); b.append(a); })));
    const stuck = o.filter((t) => t.postponed >= 3);
    if (stuck.length) { body.append(h('div', 'fc-lab', '何度も後回しになっているもの')); stuck.slice(0, 3).forEach((t) => body.append(taskCard(t, (b) => { const a = h('div', 'fc-acts'); btn(a, '工場長と小さく分ける', () => { tab = 'dwarf'; talk('「' + t.title + '」がずっと後回しになってる。小さく分けるか、手放すか一緒に決めたい'); }); btn(a, '保留にする', () => setTask(t, { stage: '保留' })); b.append(a); }))); }
  }
  async function startTimer(t) {
    try { await api('/api/factory', { method: 'POST', body: JSON.stringify({ action: 'start', id: t.id, started: t.started }) }); } catch (e) { toast(String(e.message).slice(0, 60)); return; }
    timer = { id: t.id, title: t.title, area: t.area, actual: t.actual, t0: Date.now(), start: nowIso() }; localStorage.setItem(TIMER, JSON.stringify(timer)); t.stage = '作業中'; showTimer(); render();
  }
  async function stopTimer(st) {
    const min = Math.max(1, Math.round((Date.now() - timer.t0) / 60000));
    try {
      await api('/api/factory', { method: 'POST', body: JSON.stringify({ action: 'stop', id: timer.id, title: timer.title, area: timer.area, actual: timer.actual, start: timer.start, end: nowIso(), minutes: min, ...st }) });
      toast(min + '分を作業ログに残した' + (st.result === '終わった' ? '。出荷だ！' : ''));
      timer = null; localStorage.removeItem(TIMER); showTimer(); await load();
    } catch (e) { toast('記録できませんでした：' + String(e.message).slice(0, 60)); }
  }
  async function ship(t) { await setTask(t, { stage: '出荷済み' }); toast('出荷した'); }
  async function setTask(t, fields) { try { await api('/api/factory', { method: 'POST', body: JSON.stringify({ action: 'update', id: t.id, fields }) }); await load(); } catch (e) { toast(String(e.message).slice(0, 60)); } }
  function showTimer() { timerEl.classList.toggle('on', !!timer); if (timer) timerEl.textContent = '⚒ ' + timer.title.slice(0, 10) + '　' + Math.floor((Date.now() - timer.t0) / 60000) + '分'; }

  // 計画：月・週のカレンダー（色＝領域、赤＝①、⚑＝期限）
  function renderPlan(body) {
    const mc = h('div', 'fc-chips'); [['month', '月'], ['week', '週']].forEach(([k, l]) => { const b = h('button', '', l); b.type = 'button'; b.setAttribute('aria-pressed', calMode === k ? 'true' : 'false'); b.addEventListener('click', () => { calMode = k; render(); }); mc.append(b); }); body.append(mc);
    const all = data.tasks; const on = (key) => all.filter((t) => (t.plan || '').slice(0, 10) === key || (t.due || '').slice(0, 10) === key);
    const cell = (d, dim) => { const key = ymd(d); const list = on(key); const b = h('button'); b.type = 'button'; b.setAttribute('aria-pressed', calSel === key ? 'true' : 'false'); if (dim) b.style.opacity = 0.4; if (key === today()) b.style.borderColor = '#ffd27a'; b.append(h('span', '', String(d.getDate()))); const dots = h('span', 'dots'); list.slice(0, 6).forEach((t) => { const i = h('i'); i.style.background = (t.priority || '').startsWith('①') ? '#c8352b' : t.stage === '出荷済み' ? '#555' : AREA_C[t.area] || '#8a7a6a'; dots.append(i); }); if (list.some((t) => (t.due || '').slice(0, 10) === key)) dots.append(h('span', '', '⚑')); b.append(dots); b.addEventListener('click', () => { calSel = key; render(); }); return b; };
    const grid = h('div', 'fc-cal'); '日月火水木金土'.split('').forEach((w) => grid.append(h('span', 'fc-note', w)));
    if (calMode === 'month') {
      const y = calMonth.getFullYear(), m = calMonth.getMonth(); const first = new Date(y, m, 1); const startD = new Date(y, m, 1 - first.getDay());
      const nav = h('div', 'fc-acts'); btn(nav, '‹', () => { calMonth = new Date(y, m - 1, 1); render(); }); nav.append(h('b', '', y + '年' + (m + 1) + '月')); btn(nav, '›', () => { calMonth = new Date(y, m + 1, 1); render(); }); body.append(nav);
      for (let i = 0; i < 42; i++) { const d = new Date(startD.getFullYear(), startD.getMonth(), startD.getDate() + i); grid.append(cell(d, d.getMonth() !== m)); }
    } else { const n = new Date(); const s = new Date(n.getFullYear(), n.getMonth(), n.getDate() - n.getDay()); for (let i = 0; i < 7; i++) grid.append(cell(new Date(s.getFullYear(), s.getMonth(), s.getDate() + i))); }
    body.append(grid);
    const list = on(calSel); const sum = list.filter((t) => (t.plan || '').slice(0, 10) === calSel).reduce((a, t) => a + (t.est || 0), 0);
    body.append(h('div', 'fc-lab', calSel + '　' + list.length + '件・見積' + sum + '分' + (sum > 240 ? '（詰め込みすぎかも）' : '')));
    list.forEach((t) => body.append(taskCard(t, (b) => { const inp = h('input', 'fc-ta'); inp.type = 'date'; inp.style.minHeight = '38px'; inp.value = (t.plan || '').slice(0, 10); inp.addEventListener('change', () => setTask(t, { plan: inp.value })); const a = h('div', 'fc-acts'); a.append(h('span', 'fc-note', '予定日を変える')); a.append(inp); b.append(a); })));
  }

  // 全体像：プロジェクト → 親 → 子 → 孫
  function renderWhole(body) {
    const all = data.tasks; const byParent = (id) => all.filter((t) => t.parents.includes(id));
    const line = (t, depth) => { const kids = byParent(t.id); const done = kids.filter((k) => k.stage === '出荷済み').length; const d = h('div', '', '　'.repeat(depth) + (t.stage === '出荷済み' ? '✓ ' : (t.priority || '').startsWith('①') ? '● ' : '・') + t.title + (kids.length ? `（${done}/${kids.length}）` : '') + (t.due ? '　⚑' + t.due.slice(5, 10) : '')); d.style.color = t.stage === '出荷済み' ? '#7f9a7a' : (t.priority || '').startsWith('①') ? '#ff8a7a' : ''; return [d, ...kids.flatMap((k) => (depth < 4 ? line(k, depth + 1) : []))]; };
    const tree = h('div', 'fc-tree');
    data.projects.forEach((p) => { const top = all.filter((t) => t.projects.includes(p.id) && !t.parents.some((pid) => all.find((x) => x.id === pid && x.projects.includes(p.id)))); tree.append(h('div', '', '📦 ' + p.name + '　' + (p.area || '') + (p.due ? '　⚑' + p.due.slice(5, 10) : '')), ...top.flatMap((t) => line(t, 1))); });
    const loose = all.filter((t) => !t.projects.length && !t.parents.length && t.stage !== '出荷済み');
    if (loose.length) { tree.append(h('div', '', '— プロジェクトに入っていないもの')); loose.forEach((t) => tree.append(...line(t, 1))); }
    body.append(tree);
    body.append(h('div', 'fc-lab', 'エージェント別'));
    const o = open(); body.append(h('div', 'fc-tree', [...AGENTS, '👤 自分'].map((a) => a + '　' + o.filter((t) => t.owner === a).length + '件').join('\n')));
  }

  // 記録：作業ログと、見積と実績の差（読みの精度）
  function renderRecords(body) {
    const logs = data.logs || []; const td = logs.filter((l) => (l.start || '').slice(0, 10) === today());
    const sum = (arr) => arr.reduce((a, l) => a + (l.min || 0), 0);
    const week = logs.filter((l) => (l.start || '') >= ymd(new Date(Date.now() - 7 * 86400e3)));
    body.append(h('div', 'fc-lab', '今日 ' + sum(td) + '分（仕事' + sum(td.filter((l) => l.area === '仕事')) + '・プライベート' + sum(td.filter((l) => l.area === 'プライベート')) + '）　この7日 ' + sum(week) + '分'));
    td.forEach((l) => body.append(h('div', 'fc-t', `${(l.start || '').slice(11, 16)}〜　${l.title}　${l.min}分　${l.result}・集中${l.focus}`)));
    const done = data.tasks.filter((t) => t.stage === '出荷済み' && t.est && t.actual);
    if (done.length) { const r = done.reduce((a, t) => a + t.actual / t.est, 0) / done.length; body.append(h('div', 'fc-lab', `読みの精度：実績は見積の平均${Math.round(r * 100)}%（${done.length}件）`), h('p', 'fc-note', r > 1.3 ? '見積は少し楽観的。次は少し多めに見てみよう。' : r < 0.8 ? '見積は慎重め。もっと詰めてもいいかもしれない。' : 'いい読みだ。')); }
    const shippedList = data.tasks.filter((t) => t.stage === '出荷済み').slice(0, 10);
    if (shippedList.length) { body.append(h('div', 'fc-lab', '最近の出荷')); shippedList.forEach((t) => body.append(taskCard(t))); }
  }

  function openPanel(o) { if (o && o.tab) tab = o.tab; el.classList.add('open'); render(); load(); }
  function close() { el.classList.remove('open'); }
  $('fcClose').addEventListener('click', close);
  showTimer();

  // ---------------- アプリのトップに出す知らせ（1日1回、起動の少しあと）
  setTimeout(async () => {
    try {
      alerts = await api('/api/factory?view=alerts');
      const n = (alerts.urgent || []).length, s = (alerts.soon || []).length, st = (alerts.stuck || []).length;
      const key = today() + ':' + n + ':' + s;
      if ((n || s || st) && localStorage.getItem(SEEN) !== key) {
        alertEl.innerHTML = '';
        const txt = h('span', '', '⚒ ' + [n ? '①が' + n + '件' : '', s ? '期限が近いもの' + s + '件' : '', st ? '後回し' + st + '件' : ''].filter(Boolean).join('・') + '　→ 工場へ');
        txt.style.cursor = 'pointer'; txt.addEventListener('click', () => { alertEl.classList.remove('on'); localStorage.setItem(SEEN, key); openPanel({ tab: 'bench' }); });
        const x = h('button', '', '×'); x.addEventListener('click', () => { alertEl.classList.remove('on'); localStorage.setItem(SEEN, key); });
        alertEl.append(txt, x); alertEl.classList.add('on');
      }
    } catch (e) { /* 知らせは出せなくてもよい */ }
  }, 7000);

  // ---------------- 毎フレーム
  let fetched = false, tick = 0;
  function update(dt, time, player) {
    if (player && !fetched && Math.hypot(player.x - cx, player.z - cz) < 40) { fetched = true; load(); }
    beltTex.offset.x = (time * 0.4) % 1;
    crates.forEach((c, i) => { if (c.visible) c.position.x = x0 + 4 + ((i * 1.8 + time * 0.8) % 14.5); });
    puffs.forEach((p, i) => { const on = i < steamCount; p.t = (p.t + dt * 0.12) % 1; p.s.position.set(x1 - 2.5 + Math.sin(p.t * 6 + i) * 0.4 * p.t, 12.3 + p.t * 6, z1 - 2.5 + p.t * 1.5); const sc = 1 + p.t * 3; p.s.scale.set(sc, sc, 1); p.s.material.opacity = on ? (1 - p.t) * 0.6 : 0; });
    robots.forEach((r, i) => { r.head.rotation.y = Math.sin(time * 0.8 + i) * 0.5; });
    tick += dt; if (tick > 15) { tick = 0; showTimer(); }
  }
  const ray = new THREE.Raycaster(); ray.far = 12; const center = new THREE.Vector2();
  const hit = (ndc, camera) => { ray.setFromCamera(ndc || center, camera); const r = ray.intersectObjects(targets, false)[0]; return r ? r.object.userData.fac : null; };
  const LABEL = { dwarf: ['工場長ドワーフ', '　タップで話す'], bench: ['作業台', '　タップで今やることを選ぶ'], plan: ['生産計画ボード', '　タップでカレンダー'], whole: ['エージェントのロボット', '　タップで全体像'], records: ['出荷口・検品台', '　タップで記録'] };
  return {
    attach, update, open: openPanel, close,
    hint(camera) { const st = hit(null, camera); return st ? LABEL[st.tab] : null; },
    pick(ndc, camera) { const st = hit(ndc, camera); if (!st) return false; openPanel({ tab: st.tab }); return true; },
    get openCount() { return open().length; }, get urgentCount() { return open().filter((t) => (t.priority || '').startsWith('①')).length; },
  };
}
