// 中庭の東南にある「運動場」
// トラックを走る人たちのそばで、トレーニングを選んで記録し、体重も残す（Notion「トレーニング」「体重」）。
import * as THREE from 'three';
import { WALK_SPEED_AT_1X } from './characters.js';
import { rand, pick } from './util.js';
import { createRun } from './run.js';

const MINCHO = '"Shippori Mincho B1", "Hiragino Mincho ProN", serif';
export const FIELD = { x0: 50, x1: 88, z0: 6, z1: 33, gate: 19.5 };
const TC = { x: 69, z: 19.5, a: 8, rin: 7.5, rout: 11 }; // トラック（直線の半分の長さ a、内側・外側の半径）
const PASS = 'my-library:passcode';
const CACHE = 'my-library:sports:v1';
const TYPES = [
  ['ランニング', '🏃', true], ['ウォーキング', '🚶', true], ['筋トレ', '💪', false], ['ストレッチ', '🧘', false], ['サイクリング', '🚴', true], ['水泳', '🏊', true], ['その他', '✨', false],
];

function canvasTex(w, h, draw) { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); const t = new THREE.CanvasTexture(c); t.anisotropy = 4; return t; }
// トラックの形（直線＋半円）。r の半径で、中心線から外向きの輪郭を作る
function stadium(shape, r, hole) {
  const { x, z, a } = TC;
  const p = hole ? new THREE.Path() : shape;
  p.moveTo(x - a, -(z - r));
  p.lineTo(x + a, -(z - r));
  p.absarc(x + a, -z, r, Math.PI / 2, -Math.PI / 2, true);
  p.lineTo(x - a, -(z + r));
  p.absarc(x - a, -z, r, -Math.PI / 2, -Math.PI * 1.5, true);
  return p;
}
// トラック上の位置（s は 0〜1 で一周、lane は中心線からのずれ）
function trackPoint(s, lane) {
  const { x, z, a } = TC; const r = (TC.rin + TC.rout) / 2 + lane;
  const L1 = 2 * a, L2 = Math.PI * r, P = 2 * L1 + 2 * L2;
  let d = ((s % 1) + 1) % 1 * P;
  if (d < L1) return { x: x - a + d, z: z - r, dir: 0 };
  d -= L1;
  if (d < L2) { const t = -Math.PI / 2 + d / r; return { x: x + a + Math.cos(t) * r, z: z + Math.sin(t) * r, dir: t + Math.PI / 2 }; }
  d -= L2;
  if (d < L1) return { x: x + a - d, z: z + r, dir: Math.PI };
  d -= L1;
  const t = Math.PI / 2 + d / r; return { x: x - a + Math.cos(t) * r, z: z + Math.sin(t) * r, dir: t + Math.PI / 2 };
}

export function createSports({ scene, M, colliders, world, warp, toast }) {
  const std = (o) => new THREE.MeshStandardMaterial(o);
  const root = new THREE.Group(); scene.add(root);
  const box = (mat, w, h, d, x, y, z, cast = true) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y, z); m.castShadow = cast; m.receiveShadow = true; root.add(m); return m; };
  const { x0, x1, z0, z1, gate } = FIELD;

  // ---------------- 小道と門・歩ける範囲
  world.addWalk({ x0: 41.3, x1: 50.6, z0: gate - 1.2, z1: gate + 1.2 });
  world.addWalk({ x0, x1, z0, z1 });
  const path = new THREE.Mesh(new THREE.PlaneGeometry(9, 2.6), std({ color: 0x8d7f6a, roughness: 0.95 }));
  path.rotation.x = -Math.PI / 2; path.position.set(46.3, 0.012, gate); root.add(path);
  const stone = std({ color: 0x9a8e7a, roughness: 0.9 });
  [-1.45, 1.45].forEach((o) => { box(stone, 0.7, 2.2, 0.7, 42.6, 1.1, gate + o); const l = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 10), new THREE.MeshBasicMaterial({ color: 0xcff2d6 })); l.position.set(42.6, 2.38, gate + o); root.add(l); });
  const signTex = canvasTex(640, 136, (g, w, h) => { g.fillStyle = '#16351f'; g.fillRect(0, 0, w, h); g.strokeStyle = '#d8b765'; g.lineWidth = 6; g.strokeRect(6, 6, w - 12, h - 12); g.fillStyle = '#e9f5d8'; g.font = '800 64px ' + MINCHO; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('運動場 →', w / 2, h / 2 + 2); });
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 0.55), std({ map: signTex, roughness: 0.6 }));
  sign.position.set(42.2, 2.9, gate); sign.rotation.y = -Math.PI / 2; root.add(sign);
  const sign2 = sign.clone(); sign2.position.x = 43.0; sign2.rotation.y = Math.PI / 2; root.add(sign2);
  box(M.iron, 0.12, 0.12, 3.1, 42.6, 2.55, gate);

  // ---------------- 地面・トラック・白線
  const turf = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0, z1 - z0), std({ color: 0x4f8a3e, roughness: 1 }));
  turf.rotation.x = -Math.PI / 2; turf.position.set((x0 + x1) / 2, 0.006, (z0 + z1) / 2); turf.receiveShadow = true; root.add(turf);
  const ring = new THREE.Shape(); stadium(ring, TC.rout); ring.holes.push(stadium(null, TC.rin, true));
  const track = new THREE.Mesh(new THREE.ShapeGeometry(ring, 32), std({ color: 0xb4553a, roughness: 0.95 }));
  track.rotation.x = -Math.PI / 2; track.position.y = 0.012; track.receiveShadow = true; root.add(track);
  const lineM = new THREE.LineBasicMaterial({ color: 0xf6f1e4 });
  [TC.rin, TC.rin + 0.9, TC.rin + 1.8, TC.rin + 2.7, TC.rout].forEach((r) => {
    const pts = []; for (let i = 0; i <= 160; i++) { const p = trackPoint(i / 160, r - (TC.rin + TC.rout) / 2); pts.push(new THREE.Vector3(p.x, 0.02, p.z)); }
    root.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), lineM));
  });
  // スタートライン
  box(std({ color: 0xffffff }), 0.12, 0.01, TC.rout - TC.rin, TC.x - TC.a + 0.3, 0.02, TC.z - (TC.rin + TC.rout) / 2, false);

  // ---------------- 観客席・ベンチ・用具・旗
  const wood = M.walnut;
  for (let k = 0; k < 3; k++) box(wood, 16, 0.4, 0.9, TC.x, 0.2 + k * 0.4, z1 - 0.9 - k * 0.9 + 0.0, true);
  colliders.push({ x0: TC.x - 8.2, x1: TC.x + 8.2, z0: z1 - 3.2, z1: z1 + 0.2 });
  // トレーニング広場（トラックの内側）
  const mat = new THREE.Mesh(new THREE.PlaneGeometry(6, 3.2), std({ color: 0x2f5aa0, roughness: 0.9 }));
  mat.rotation.x = -Math.PI / 2; mat.position.set(TC.x, 0.02, TC.z - 1.6); root.add(mat);
  const dumb = std({ color: 0x2a2a2a, metalness: 0.6, roughness: 0.4 });
  for (let i = 0; i < 4; i++) { const g = new THREE.Group(); g.position.set(TC.x + 2.9 + i * 0.45, 0.92, TC.z + 2.2); root.add(g); [-0.12, 0.12].forEach((o) => { const w = new THREE.Mesh(new THREE.CylinderGeometry(0.07 + i * 0.01, 0.07 + i * 0.01, 0.06, 12), dumb); w.rotation.z = Math.PI / 2; w.position.x = o; g.add(w); }); const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.26, 8), M.iron); bar.rotation.z = Math.PI / 2; g.add(bar); }
  box(M.iron, 1.9, 0.06, 0.5, TC.x + 3.6, 0.86, TC.z + 2.2);
  [-0.9, 0.9].forEach((o) => box(M.iron, 0.06, 0.86, 0.5, TC.x + 3.6 + o, 0.43, TC.z + 2.2));
  colliders.push({ x0: TC.x + 2.5, x1: TC.x + 4.7, z0: TC.z + 1.8, z1: TC.z + 2.6 });
  // 体重計
  const scaleG = new THREE.Group(); scaleG.position.set(TC.x - 3.4, 0, TC.z + 2.2); root.add(scaleG);
  const plate = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.08, 0.6), std({ color: 0xe8e4da, roughness: 0.4 })); plate.position.y = 0.04; scaleG.add(plate);
  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.1, 8), M.iron); post.position.set(0, 0.6, -0.26); scaleG.add(post);
  const dialTex = canvasTex(256, 256, (g) => { g.fillStyle = '#fbf7ec'; g.beginPath(); g.arc(128, 128, 120, 0, Math.PI * 2); g.fill(); g.strokeStyle = '#333'; g.lineWidth = 6; g.stroke(); for (let i = 0; i < 40; i++) { const a = (i / 40) * Math.PI * 2; g.beginPath(); g.moveTo(128 + Math.cos(a) * 100, 128 + Math.sin(a) * 100); g.lineTo(128 + Math.cos(a) * 112, 128 + Math.sin(a) * 112); g.stroke(); } g.fillStyle = '#c33'; g.fillRect(124, 30, 8, 98); g.fillStyle = '#333'; g.font = '700 30px sans-serif'; g.textAlign = 'center'; g.fillText('kg', 128, 190); });
  const dial = new THREE.Mesh(new THREE.CircleGeometry(0.22, 24), new THREE.MeshBasicMaterial({ map: dialTex }));
  dial.position.set(0, 1.18, -0.24); scaleG.add(dial);
  colliders.push({ x0: TC.x - 3.8, x1: TC.x - 3.0, z0: TC.z + 1.8, z1: TC.z + 2.6 });
  // 旗
  [[x0 + 1, z0 + 1], [x1 - 1, z0 + 1], [x0 + 1, z1 - 1], [x1 - 1, z1 - 1]].forEach(([fx, fz], i) => {
    box(M.iron, 0.08, 4, 0.08, fx, 2, fz, false);
    const f = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.7), std({ color: [0xc8202c, 0x2a5fb0, 0xd8a531, 0x2d8a4e][i], side: THREE.DoubleSide, roughness: 0.8 }));
    f.position.set(fx + 0.62, 3.6, fz); root.add(f);
  });

  // ---------------- 記録板（掲示板）：今週の距離・時間と最新の体重
  const boardCanvas = document.createElement('canvas'); boardCanvas.width = 1024; boardCanvas.height = 512;
  const boardTex = new THREE.CanvasTexture(boardCanvas);
  const board = new THREE.Mesh(new THREE.PlaneGeometry(4.4, 2.2), std({ map: boardTex, emissive: 0xffffff, emissiveMap: boardTex, emissiveIntensity: 0.35, roughness: 0.6 }));
  const BZ = TC.z + 6; // 入口の少し北に立てる
  board.position.set(x0 + 1.2, 2.6, BZ); board.rotation.y = Math.PI / 2; root.add(board);
  box(wood, 0.2, 2.6, 4.7, x0 + 1.05, 2.6, BZ, true);
  [-2, 2].forEach((o) => box(wood, 0.16, 1.3, 0.16, x0 + 1.05, 0.65, BZ + o));
  colliders.push({ x0: x0 + 0.7, x1: x0 + 1.5, z0: BZ - 2.5, z1: BZ + 2.5 });

  // ---------------- 走る人・体を動かす人
  const runners = [], movers = [];
  function attach(cast) {
    for (let i = 0; i < 7; i++) {
      const a = cast.spawn(pick(['Rogue', 'Knight', 'Mage', 'Barbarian', 'Rogue_Hooded']), { gear: [] });
      root.add(a.root);
      const sp = rand(1.7, 2.6);
      a.play('Walking_C', { timeScale: (sp * 0.7) / WALK_SPEED_AT_1X });
      runners.push({ a, s: rand(0, 1), lane: rand(-1.3, 1.3), sp });
    }
    [[TC.x - 1.5, TC.z - 1.4, 'Cheer'], [TC.x + 0.4, TC.z - 2.0, 'Idle'], [TC.x + 1.8, TC.z - 1.2, 'Spellcasting']].forEach(([x, z, anim]) => {
      const a = cast.spawn(pick(['Knight', 'Barbarian', 'Rogue']), { gear: [] });
      a.root.position.set(x, 0, z); a.root.rotation.y = rand(-1, 1); root.add(a.root);
      a.play(anim); movers.push({ a, anim, t: rand(3, 8) });
    });
  }

  // ---------------- データ
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
  let data = (() => { try { return JSON.parse(localStorage.getItem(CACHE) || 'null') || { training: [], weight: [] }; } catch (e) { return { training: [], weight: [] }; } })();
  const saveCache = () => { try { localStorage.setItem(CACHE, JSON.stringify(data)); } catch (e) { /* 続ける */ } };
  // GPS のランニング画面（記録は data.training に足して、記録板も更新する）
  const runner = createRun({ toast, history: () => data.training, onSaved: (rec) => { data.training.unshift(rec); saveCache(); drawBoard(); render(); } });
  async function load() {
    try {
      const [t, w] = await Promise.all([api('/api/sports?kind=training'), api('/api/sports?kind=weight')]);
      data = { training: t.records || [], weight: w.records || [] }; saveCache(); render(true); drawBoard();
    } catch (e) { /* 前回の記録を使う */ }
  }
  const todayStr = () => new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);
  function weekStats() {
    const now = new Date(todayStr()); const day = (now.getDay() + 6) % 7; const mon = new Date(now); mon.setDate(now.getDate() - day);
    const from = mon.toISOString().slice(0, 10);
    const list = data.training.filter((r) => r.date >= from);
    return { km: list.reduce((s, r) => s + (r.km || 0), 0), min: list.reduce((s, r) => s + (r.minutes || 0), 0), n: list.length };
  }
  function drawBoard() {
    const g = boardCanvas.getContext('2d'), w = 1024, h = 512;
    g.fillStyle = '#123220'; g.fillRect(0, 0, w, h); g.strokeStyle = '#d8b765'; g.lineWidth = 12; g.strokeRect(10, 10, w - 20, h - 20);
    g.fillStyle = '#f3e9c8'; g.textAlign = 'center'; g.font = '800 64px ' + MINCHO; g.fillText('今週の記録', w / 2, 100);
    const st = weekStats();
    g.font = '700 54px ' + MINCHO; g.fillStyle = '#ffffff';
    g.fillText(st.km.toFixed(1) + ' km　' + Math.round(st.min) + ' 分　' + st.n + ' 回', w / 2, 220);
    const last = data.weight[0];
    g.font = '600 46px ' + MINCHO; g.fillStyle = '#cfe8c8';
    g.fillText(last ? '体重 ' + last.kg + ' kg（' + last.date.slice(5).replace('-', '/') + '）' : '体重計で体重を記録しよう', w / 2, 330);
    g.font = '500 34px ' + MINCHO; g.fillStyle = '#e7dcb8'; g.fillText('掲示板や体重計をタップしてトレーニングを記録', w / 2, 430);
    boardTex.needsUpdate = true;
  }
  drawBoard();

  // ---------------- 画面（トレーニングを選ぶ・記録する・体重）
  const style = document.createElement('style');
  style.textContent = `#spt{position:fixed;inset:auto 0 0 0;z-index:12;padding:0 12px calc(env(safe-area-inset-bottom,0px) + 12px);transform:translateY(110%);transition:transform .38s cubic-bezier(.2,.8,.2,1)}
#spt.open{transform:none}#spt .card{max-height:86vh;overflow-y:auto;display:block}#spt h2{font-family:var(--display);font-size:19px;font-weight:800;margin:0}
.sp-tabs{display:flex;gap:6px;margin:12px 0 8px}.sp-tabs button{flex:1;height:38px;border-radius:12px;border:1px solid var(--line);background:transparent;color:var(--text-dim);font-family:var(--ui);font-size:13px}
.sp-tabs button[aria-pressed=true]{background:#c9a04e;color:#1b150b;border-color:#c9a04e;font-weight:700}
.sp-types{display:grid;grid-template-columns:repeat(4,1fr);gap:6px}.sp-types button{height:58px;border-radius:12px;border:1px solid var(--line);background:rgba(255,255,255,.03);color:var(--text);font-family:var(--ui);font-size:12px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px}
.sp-types button b{font-size:20px}.sp-types button[aria-pressed=true]{border-color:#7fd19a;background:rgba(120,200,150,.15)}
.sp-form{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin-top:10px}.sp-form label{display:flex;flex-direction:column;gap:4px;font-size:11.5px;color:var(--text-dim);min-width:0}
.sp-form label.big{grid-column:1/-1;font-size:13px;color:#f3e9c8}.sp-form label.big input{height:56px;font-size:26px;font-weight:700;text-align:center;border-color:#c9a04e}
.sp-form input,.sp-form textarea{width:100%;min-width:0;box-sizing:border-box;height:42px;border-radius:10px;border:1px solid var(--line);background:rgba(20,15,10,.8);color:var(--text);font-size:16px;padding:0 10px;font-family:var(--ui)}
.sp-form textarea{height:60px;padding:8px 10px;grid-column:1/-1}.sp-form .wide{grid-column:1/-1}
.sp-btn{height:44px;padding:0 16px;border-radius:12px;border:1px solid rgba(210,170,85,.45);background:rgba(210,170,85,.1);color:#EBD08F;font-family:var(--ui);font-size:13px;cursor:pointer}
.sp-btn.main{background:#c9a04e;color:#1b150b;font-weight:700;width:100%;margin-top:10px}
.sp-stat{display:flex;gap:8px;margin:8px 0}.sp-stat div{flex:1;border:1px solid var(--line);border-radius:12px;padding:8px;text-align:center}.sp-stat b{display:block;font-size:20px;font-family:var(--display)}.sp-stat span{font-size:11px;color:var(--text-dim)}
.sp-list{list-style:none;margin:8px 0 0;padding:0;display:flex;flex-direction:column;gap:6px}.sp-list li{display:flex;justify-content:space-between;gap:8px;padding:8px 10px;border-radius:10px;border:1px solid var(--line);font-size:12.5px}.sp-list li span{color:var(--text-dim);font-size:11.5px}
.sp-chart{width:100%;height:150px;margin-top:8px;border:1px solid var(--line);border-radius:12px;background:rgba(255,255,255,.02)}
.sp-note{font-size:11px;color:var(--text-dim);margin:8px 0 0}`;
  document.head.append(style);
  const el = document.createElement('section');
  el.id = 'spt';
  el.innerHTML = `<div class='card'>
    <div class='chead'><h2>運動場</h2><button id='spClose' class='sp-btn' type='button'>閉じる</button></div>
    <div class='sp-tabs' id='spTabs'><button type='button' data-t='train' aria-pressed='true'>トレーニング</button><button type='button' data-t='weight' aria-pressed='false'>体重</button><button type='button' data-t='log' aria-pressed='false'>記録</button></div>
    <div id='spBody'></div>
  </div>`;
  document.body.append(el);
  const $ = (id) => document.getElementById(id);
  const h = (tag, cls, t) => { const e = document.createElement(tag); if (cls) e.className = cls; if (t !== undefined) e.textContent = t; return e; };
  let tab = 'train', type = 'ランニング';
  el.querySelectorAll('#spTabs button').forEach((b) => b.addEventListener('click', () => { tab = b.dataset.t; el.querySelectorAll('#spTabs button').forEach((x) => x.setAttribute('aria-pressed', x === b ? 'true' : 'false')); render(); }));
  function field(label, id, attrs, wide) { const l = h('label', wide ? 'wide' : ''); l.append(document.createTextNode(label)); const i = document.createElement('input'); i.id = id; Object.assign(i, attrs || {}); l.append(i); return l; }
  // keepInputs：Notion から読み直して描き直すときは、入力途中の値を消さない
  function render(keepInputs) {
    const body = $('spBody');
    const keep = {};
    if (keepInputs) body.querySelectorAll('input,textarea').forEach((i) => { if (i.id && i.value) keep[i.id] = i.value; });
    body.innerHTML = '';
    if (tab === 'train') {
      const st = weekStats();
      const stat = h('div', 'sp-stat');
      [[st.km.toFixed(1) + ' km', '今週の距離'], [Math.round(st.min) + ' 分', '今週の時間'], [st.n + ' 回', '今週の回数']].forEach(([a, b]) => { const d = h('div'); d.append(h('b', '', a), h('span', '', b)); stat.append(d); });
      body.append(stat);
      const types = h('div', 'sp-types');
      TYPES.forEach(([name, icon]) => { const b = h('button'); b.type = 'button'; b.setAttribute('aria-pressed', type === name ? 'true' : 'false'); b.append(h('b', '', icon), document.createTextNode(name)); b.addEventListener('click', () => { type = name; render(); }); types.append(b); });
      body.append(types);
      const dist = (TYPES.find((t) => t[0] === type) || [])[2];
      const form = h('div', 'sp-form');
      form.append(field('日付', 'spDate', { type: 'date', value: todayStr() }), field('時間（分）', 'spMin', { type: 'number', inputMode: 'decimal', min: 0, placeholder: '30' }));
      if (dist) form.append(field('距離（km）', 'spKm', { type: 'number', inputMode: 'decimal', min: 0, step: '0.01', placeholder: type === 'ランニング' ? '10' : '' }));
      if (type === '筋トレ' || type === 'ストレッチ' || type === 'その他') form.append(field('回数・セット', 'spReps', { type: 'text', placeholder: '腕立て 20回×3' }, !dist));
      const memo = document.createElement('textarea'); memo.id = 'spMemo'; memo.placeholder = 'メモ（体調・場所など）'; form.append(memo);
      body.append(form);
      const go = h('button', 'sp-btn main', type + 'を記録する'); go.type = 'button';
      go.addEventListener('click', saveTraining); body.append(go);
      if (dist && type !== '水泳') { const gpsB = h('button', 'sp-btn main', '📍 GPSで計測する'); gpsB.type = 'button'; gpsB.style.background = '#2d8a4e'; gpsB.style.color = '#fff'; gpsB.style.marginTop = '8px'; gpsB.addEventListener('click', () => { close(); runner.open(type); }); body.insertBefore(gpsB, body.children[2]); body.append(h('p', 'sp-note', 'GPSで計測するときは、画面をつけたまま走ってください（画面を消したり、ほかのアプリに切り替えると記録が止まります）。走ったあとに入れる場合は、下の欄に距離と時間を入れて記録できます。')); }
    } else if (tab === 'weight') {
      const form = h('div', 'sp-form');
      // 体重をいちばん上に大きく出す（スマホで横にはみ出して見えなくならないように）
      const kgField = field('体重（kg）', 'wKg', { type: 'text', inputMode: 'decimal', placeholder: String((data.weight[0] && data.weight[0].kg) || '60.0') }); kgField.className = 'big';
      form.append(kgField, field('日付', 'wDate', { type: 'date', value: todayStr() }), field('体脂肪率（%）任意', 'wFat', { type: 'text', inputMode: 'decimal' }), field('メモ', 'wMemo', { type: 'text' }, true));
      body.append(form);
      const go = h('button', 'sp-btn main', '体重を記録する'); go.type = 'button'; go.addEventListener('click', saveWeight); body.append(go);
      body.append(chart());
      const pts = data.weight.filter((w) => w.kg).slice(0, 30);
      if (pts.length >= 2) { const d = pts[0].kg - pts[pts.length - 1].kg; body.append(h('p', 'sp-note', pts.length + '回の記録で ' + (d > 0 ? '+' : '') + d.toFixed(1) + ' kg（' + pts[pts.length - 1].date + ' → ' + pts[0].date + '）')); }
    } else {
      const ul = h('ul', 'sp-list');
      data.training.slice(0, 40).forEach((r) => { const li = h('li'); li.append(h('b', '', r.title || r.type), h('span', '', [r.date, r.pace ? r.pace.toFixed(2) + '分/km' : '', r.reps].filter(Boolean).join('　'))); if (r.route) { const rb = h('button', 'sp-btn', 'ルート'); rb.type = 'button'; rb.style.height = '30px'; rb.style.padding = '0 10px'; rb.addEventListener('click', () => { close(); runner.showRoute(r); }); li.append(rb); } ul.append(li); });
      if (!data.training.length) ul.append(h('li', '', 'まだ記録がありません'));
      body.append(ul);
    }
    Object.entries(keep).forEach(([id, v]) => { const i = document.getElementById(id); if (i) i.value = v; });
  }
  // 体重の折れ線グラフ（最近30回）
  function chart() {
    const pts = data.weight.filter((w) => w.kg).slice(0, 30).reverse();
    const ns = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(ns, 'svg'); svg.setAttribute('viewBox', '0 0 320 150'); svg.setAttribute('class', 'sp-chart');
    if (pts.length < 2) { const t = document.createElementNS(ns, 'text'); t.setAttribute('x', '160'); t.setAttribute('y', '80'); t.setAttribute('text-anchor', 'middle'); t.setAttribute('fill', '#9a9080'); t.setAttribute('font-size', '12'); t.textContent = '2回以上記録するとグラフが出ます'; svg.append(t); return svg; }
    const ks = pts.map((p) => p.kg), lo = Math.min(...ks) - 0.5, hi = Math.max(...ks) + 0.5;
    const X = (i) => 16 + (i / (pts.length - 1)) * 288, Y = (k) => 130 - ((k - lo) / (hi - lo)) * 110;
    const line = document.createElementNS(ns, 'polyline'); line.setAttribute('points', pts.map((p, i) => X(i) + ',' + Y(p.kg)).join(' ')); line.setAttribute('fill', 'none'); line.setAttribute('stroke', '#c9a04e'); line.setAttribute('stroke-width', '2.5'); svg.append(line);
    pts.forEach((p, i) => { const c = document.createElementNS(ns, 'circle'); c.setAttribute('cx', X(i)); c.setAttribute('cy', Y(p.kg)); c.setAttribute('r', '3'); c.setAttribute('fill', '#f3e9c8'); svg.append(c); });
    [[hi - 0.5, 18], [lo + 0.5, 128]].forEach(([k, y]) => { const t = document.createElementNS(ns, 'text'); t.setAttribute('x', '4'); t.setAttribute('y', String(y)); t.setAttribute('fill', '#9a9080'); t.setAttribute('font-size', '10'); t.textContent = k.toFixed(1); svg.append(t); });
    return svg;
  }
  async function saveTraining() {
    const v = (id) => { const e = $(id); return e ? e.value : ''; };
    const rec = { kind: 'training', type, date: v('spDate'), minutes: v('spMin'), km: v('spKm'), reps: v('spReps'), memo: v('spMemo'), method: '手入力' };
    if (!rec.minutes && !rec.km && !rec.reps) { toast('時間か距離を入れてね'); return; }
    try { const j = await api('/api/sports', { method: 'POST', body: JSON.stringify(rec) }); data.training.unshift(j.record); saveCache(); drawBoard(); toast(type + 'を記録しました（Notion「トレーニング」）'); tab = 'log'; el.querySelectorAll('#spTabs button').forEach((x) => x.setAttribute('aria-pressed', x.dataset.t === 'log' ? 'true' : 'false')); render(); }
    catch (e) { toast('記録できませんでした：' + String(e.message).slice(0, 50)); }
  }
  async function saveWeight() {
    const kg = String($('wKg').value || '').replace(',', '.').trim(); if (!kg || !Number.isFinite(Number(kg))) { toast('体重を数字で入れてね（例：66.5）'); return; }
    try { const j = await api('/api/sports', { method: 'POST', body: JSON.stringify({ kind: 'weight', date: $('wDate').value, kg, fat: String($('wFat').value || '').replace(',', '.').trim(), memo: $('wMemo').value }) }); data.weight.unshift(j.record); data.weight.sort((a, b) => (a.date < b.date ? 1 : -1)); saveCache(); drawBoard(); render(); toast('体重を記録しました（Notion「体重」）'); }
    catch (e) { toast('記録できませんでした：' + String(e.message).slice(0, 50)); }
  }
  function open(t) { if (t) { tab = t; el.querySelectorAll('#spTabs button').forEach((x) => x.setAttribute('aria-pressed', x.dataset.t === t ? 'true' : 'false')); } el.classList.add('open'); render(); load(); }
  function close() { el.classList.remove('open'); }
  $('spClose').addEventListener('click', close);
  setTimeout(load, 5000);

  // ---------------- 毎フレーム・案内・タップ
  function update(dt, time, player) {
    const near = player && Math.hypot(player.x - TC.x, player.z - TC.z) < 45;
    if (!near) return;
    runners.forEach((r) => {
      const Lp = 2 * 2 * TC.a + 2 * Math.PI * ((TC.rin + TC.rout) / 2 + r.lane);
      r.s += (r.sp * dt) / Lp;
      const p = trackPoint(r.s, r.lane);
      r.a.root.position.set(p.x, 0, p.z);
      r.a.root.rotation.y = Math.PI / 2 - p.dir;
      r.a.mixer.update(dt);
    });
    movers.forEach((m) => { m.a.mixer.update(dt); m.t -= dt; if (m.t < 0) { m.t = rand(4, 9); m.a.play(pick(['Cheer', 'Idle', 'Spellcasting', 'Use_Item'])); } });
  }
  const ray = new THREE.Raycaster(); ray.far = 25;
  const center = new THREE.Vector2(0, 0);
  const targets = [board, plate, dial];
  const hitTest = (ndc, camera) => { ray.setFromCamera(ndc || center, camera); return ray.intersectObjects(targets, false)[0] || null; };
  function hint(camera) {
    const hh = hitTest(null, camera); if (!hh) return null;
    return hh.object === board ? ['記録板', '　タップでトレーニングを記録'] : ['体重計', '　タップで体重を記録'];
  }
  function pickFn(ndc, camera) { const hh = hitTest(ndc, camera); if (!hh) return false; open(hh.object === board ? 'train' : 'weight'); return true; }
  return { attach, update, hint, pick: pickFn, open, close, get data() { return data; }, weekStats };
}
