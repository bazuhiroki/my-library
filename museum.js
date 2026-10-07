// 「映画博物館」：映画館の北東に建つ、映画のポスターの博物館
// 収蔵品は Notion「映画」（作品情報は TMDb）。展示は毎日入れ替わり、サブスク・ジャンル・年代・国・監督・俳優から探せる。
// This product uses the TMDB API but is not endorsed or certified by TMDB.
import * as THREE from 'three';
import { WALK_SPEED_AT_1X } from './characters.js';
import { rand, pick } from './util.js';

const MINCHO = '"Shippori Mincho B1", "Hiragino Mincho ProN", serif';
export const MUSEUM = { x0: 70, x1: 90, z0: -45, z1: -23, door: -36 };
const PASS = 'my-library:passcode';
const CACHE = 'my-library:movies:v1';
const OVERRIDE = 'my-library:museum:walls:v1';
const SEEDED = 'my-library:museum:seeded:v1';
const REFRESHED = 'my-library:museum:refreshed:v1';
const STATUS = ['観たい', '観た', 'お気に入り'];
const SUB_ORDER = ['Netflix', 'Prime Video', 'U-NEXT', 'Disney+', 'Hulu', 'ABEMA', 'Lemino', 'FOD', 'DMM TV', 'TELASA', 'WOWOWオンデマンド'];

function canvasTex(w, h, draw) { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); const t = new THREE.CanvasTexture(c); t.anisotropy = 4; return t; }
function seedRng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const todayStr = () => new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);
const daySeed = () => Number(todayStr().replace(/-/g, ''));

export function createMuseum({ scene, M, colliders, world, warp, toast, cinema }) {
  const std = (o) => new THREE.MeshStandardMaterial(o);
  const root = new THREE.Group(); scene.add(root);
  const box = (mat, w, h, d, x, y, z, cast = true) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y, z); m.castShadow = cast; m.receiveShadow = true; root.add(m); return m; };
  const { x0, x1, z0, z1, door } = MUSEUM;
  const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, H = 9;

  // ---------------- 小道（映画館への小道から北へ、そして東へ）
  world.addWalk({ x0: 45.3, x1: 47.7, z0: -37.4, z1: -18.5 });
  world.addWalk({ x0: 45.3, x1: x0 + 0.6, z0: door - 1.4, z1: door + 1.4 });
  world.addWalk({ x0: x0 + 0.45, x1: x1 - 0.45, z0: z0 + 0.45, z1: z1 - 0.45 });
  const pathMat = std({ color: 0x8d7f6a, roughness: 0.95 });
  const pv = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 19), pathMat); pv.rotation.x = -Math.PI / 2; pv.position.set(46.5, 0.012, -28); root.add(pv);
  const ph = new THREE.Mesh(new THREE.PlaneGeometry(x0 - 45, 2.8), pathMat); ph.rotation.x = -Math.PI / 2; ph.position.set((45 + x0) / 2, 0.013, door); root.add(ph);
  const lampMat = new THREE.MeshBasicMaterial({ color: 0xfff0c8 });
  for (let x = 50; x < x0 - 1; x += 5) [door - 1.7, door + 1.7].forEach((z) => { box(M.iron, 0.08, 1.4, 0.08, x, 0.7, z, false); const l = new THREE.Mesh(new THREE.SphereGeometry(0.11, 10, 8), lampMat); l.position.set(x, 1.48, z); root.add(l); });
  const signPost = canvasTex(640, 136, (g, w, h) => { g.fillStyle = '#1c2236'; g.fillRect(0, 0, w, h); g.strokeStyle = '#d8b765'; g.lineWidth = 6; g.strokeRect(6, 6, w - 12, h - 12); g.fillStyle = '#f1e6c6'; g.font = '800 58px ' + MINCHO; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('映画博物館 ↑', w / 2, h / 2 + 2); });
  const sp = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 0.47), std({ map: signPost, roughness: 0.6 })); sp.position.set(47.9, 2.4, -21.2); sp.rotation.y = -Math.PI / 2; root.add(sp);
  box(M.iron, 0.1, 2.6, 0.1, 47.95, 1.3, -21.2, false);

  // ---------------- 建物（白い石の外壁、西側に柱廊と三角の破風）
  const stone = std({ color: 0xe8e1d2, roughness: 0.75 });
  const stoneDark = std({ color: 0xcfc6b2, roughness: 0.8 });
  const gold = std({ color: 0xc9a04e, roughness: 0.38, metalness: 0.65 });
  const dw = 3.2, dh = 4.4;
  box(stone, 0.5, H, z1 - z0, x1, H / 2, cz);
  box(stone, x1 - x0, H, 0.5, cx, H / 2, z0);
  box(stone, x1 - x0, H, 0.5, cx, H / 2, z1);
  box(stone, 0.5, H, (door - dw / 2) - z0, x0, H / 2, (z0 + door - dw / 2) / 2);
  box(stone, 0.5, H, z1 - (door + dw / 2), x0, H / 2, (z1 + door + dw / 2) / 2);
  box(stone, 0.5, H - dh, dw, x0, dh + (H - dh) / 2, door);
  box(stoneDark, x1 - x0 + 0.8, 0.5, z1 - z0 + 0.8, cx, H + 0.25, cz);
  // 柱廊：階段・6本の柱・梁・破風
  for (let k = 0; k < 3; k++) box(stoneDark, 2.6 - k * 0.6, 0.16, 15, x0 - 1.6 + k * 0.3, 0.08 + k * 0.16, door, false);
  const colGeo = new THREE.CylinderGeometry(0.34, 0.4, 6.4, 18);
  [-6.6, -4.4, -2.2, 2.2, 4.4, 6.6].forEach((o) => { const c = new THREE.Mesh(colGeo, stone); c.position.set(x0 - 2.1, 3.2 + 0.4, door + o); c.castShadow = true; root.add(c); box(stoneDark, 0.95, 0.25, 0.95, x0 - 2.1, 0.55, door + o); box(stoneDark, 0.95, 0.3, 0.95, x0 - 2.1, 6.9, door + o); });
  colliders.push({ x0: x0 - 2.6, x1: x0 - 1.6, z0: door - 7.1, z1: door - 1.7 }, { x0: x0 - 2.6, x1: x0 - 1.6, z0: door + 1.7, z1: door + 7.1 });
  box(stone, 2.8, 0.7, 15.6, x0 - 1.4, 7.4, door);
  const ped = new THREE.Shape(); ped.moveTo(-7.8, 0); ped.lineTo(7.8, 0); ped.lineTo(0, 2.4); ped.lineTo(-7.8, 0);
  const pedM = new THREE.Mesh(new THREE.ExtrudeGeometry(ped, { depth: 2.6, bevelEnabled: false }), stone); pedM.rotation.y = Math.PI / 2; pedM.position.set(x0 - 2.7, 7.75, door); root.add(pedM);
  const nameTex = canvasTex(1024, 160, (g, w, h) => { g.fillStyle = '#f4efe2'; g.fillRect(0, 0, w, h); g.fillStyle = '#5a4520'; g.font = '700 70px "Cinzel", ' + MINCHO; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('MOVIE MUSEUM', w / 2, 62); g.font = '600 38px ' + MINCHO; g.fillText('映 画 博 物 館', w / 2, 126); });
  const nameP = new THREE.Mesh(new THREE.PlaneGeometry(6.4, 1.0), std({ map: nameTex, roughness: 0.7 })); nameP.position.set(x0 - 2.82, 7.42, door); nameP.rotation.y = -Math.PI / 2; root.add(nameP);
  // 入口の両側の垂れ幕（今日の一本と、北の壁の展示）
  const banners = [-4.4 - 1.1, 4.4 + 1.1].map((o) => { const b = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 3.4), std({ color: 0x7a1020, roughness: 0.8, side: THREE.DoubleSide })); b.position.set(x0 - 0.3, 4.6, door + o); b.rotation.y = -Math.PI / 2; root.add(b); return b; });

  // ---------------- 内装（大理石の床・腰板・金の手すり・天窓）
  const marble = std({ roughness: 0.35, map: canvasTex(512, 512, (g) => { for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) { g.fillStyle = (i + j) % 2 ? '#e9e4da' : '#2b2a2e'; g.fillRect(i * 128, j * 128, 128, 128); } g.strokeStyle = 'rgba(160,140,110,.25)'; g.lineWidth = 2; for (let k = 0; k < 40; k++) { g.beginPath(); let x = Math.random() * 512, y = Math.random() * 512; g.moveTo(x, y); for (let s = 0; s < 6; s++) { x += rand(-30, 30); y += rand(-30, 30); g.lineTo(x, y); } g.stroke(); } }) });
  marble.map.wrapS = marble.map.wrapT = THREE.RepeatWrapping; marble.map.repeat.set(5, 5.5);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0 - 0.5, z1 - z0 - 0.5), marble); floor.rotation.x = -Math.PI / 2; floor.position.set(cx, 0.015, cz); floor.receiveShadow = true; root.add(floor);
  const plaster = std({ color: 0xf3eee4, roughness: 0.9 });
  const innerWall = (w, d, x, z) => { box(plaster, w, H - 0.3, d, x, H / 2, z, false); };
  innerWall(x1 - x0 - 0.6, 0.05, cx, z0 + 0.28); innerWall(x1 - x0 - 0.6, 0.05, cx, z1 - 0.28); innerWall(0.05, z1 - z0 - 0.6, x1 - 0.28, cz);
  // 腰板と手すり
  [[x1 - x0 - 0.7, 0.08, cx, z0 + 0.32], [x1 - x0 - 0.7, 0.08, cx, z1 - 0.32], [0.08, z1 - z0 - 0.7, x1 - 0.32, cz]].forEach(([w, d, x, z]) => { box(M.walnutDark, w, 1.0, d, x, 0.5, z, false); box(gold, w + (d > 0.5 ? 0 : 0), 0.05, d + 0.02, x, 1.02, z, false); });
  // 天井と天窓
  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0 - 0.5, z1 - z0 - 0.5), std({ color: 0xe6dfd0, roughness: 1 })); ceil.rotation.x = Math.PI / 2; ceil.position.set(cx, H - 0.05, cz); root.add(ceil);
  const sky = new THREE.Mesh(new THREE.PlaneGeometry(12, 9), new THREE.MeshBasicMaterial({ color: 0xdcecff })); sky.rotation.x = Math.PI / 2; sky.position.set(cx + 1, H - 0.08, cz); root.add(sky);
  for (let i = -2; i <= 2; i++) box(gold, 12.2, 0.08, 0.08, cx + 1, H - 0.12, cz + i * 2.25, false);
  const hallLight = new THREE.PointLight(0xfff3dc, 0.9, 30, 2); hallLight.position.set(cx, H - 1.5, cz); root.add(hallLight);

  // ---------------- 展示（額に入ったポスター）
  const frameMat = std({ color: 0x2b2116, roughness: 0.5, metalness: 0.2 });
  const lightBar = new THREE.MeshBasicMaterial({ color: 0xfff1cc });
  const posterGeo = new THREE.PlaneGeometry(1.1, 1.65);
  const blankTex = canvasTex(128, 192, (g) => { g.fillStyle = '#26221d'; g.fillRect(0, 0, 128, 192); g.strokeStyle = '#6a5a3c'; g.strokeRect(6, 6, 116, 180); });
  function frame(x, z, ry, big) {
    const g = new THREE.Group(); g.position.set(x, big ? 2.9 : 2.25, z); g.rotation.y = ry; root.add(g);
    const s = big ? 2.0 : 1;
    const fr = new THREE.Mesh(new THREE.BoxGeometry(1.3 * s, 1.86 * s, 0.08), frameMat); fr.position.z = -0.02; g.add(fr);
    const inner = new THREE.Mesh(new THREE.BoxGeometry(1.2 * s, 1.76 * s, 0.09), gold); inner.position.z = -0.025; g.add(inner);
    const p = new THREE.Mesh(posterGeo, std({ map: blankTex, roughness: 0.55 })); p.scale.setScalar(s); p.position.z = 0.03; g.add(p);
    const lb = new THREE.Mesh(new THREE.BoxGeometry(0.7 * s, 0.05, 0.12), lightBar); lb.position.set(0, 1.05 * s, 0.12); g.add(lb);
    return { g, p, movie: null };
  }
  const walls = {
    north: { title: '', items: [], frames: [], sign: null },
    south: { title: '', items: [], frames: [], sign: null },
    east: { title: '', items: [], frames: [], sign: null },
  };
  for (let i = 0; i < 8; i++) walls.north.frames.push(frame(72.65 + i * 2.1, z0 + 0.38, 0));
  for (let i = 0; i < 8; i++) walls.south.frames.push(frame(72.65 + i * 2.1, z1 - 0.38, Math.PI));
  for (let i = 0; i < 6; i++) walls.east.frames.push(frame(x1 - 0.38, -40.5 + i * 2.6, -Math.PI / 2));
  const signOf = (x, z, ry, w) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, 0.8), std({ color: 0xffffff, roughness: 0.6, emissive: 0xffffff, emissiveIntensity: 0.1 })); m.position.set(x, 4.3, z); m.rotation.y = ry; root.add(m); return m; };
  walls.north.sign = signOf(cx, z0 + 0.36, 0, 8);
  walls.south.sign = signOf(cx, z1 - 0.36, Math.PI, 8);
  walls.east.sign = signOf(x1 - 0.36, -34, -Math.PI / 2, 7);
  // 中央の「今日の一本」（台座の上の大きなポスター）
  box(stoneDark, 1.6, 0.9, 1.6, 80, 0.45, -34); box(gold, 1.7, 0.06, 1.7, 80, 0.92, -34, false);
  colliders.push({ x0: 79.1, x1: 80.9, z0: -34.9, z1: -33.1 });
  const feature = frame(80, -34, -Math.PI / 2, true); feature.g.position.y = 2.9;
  const easel = new THREE.Mesh(new THREE.BoxGeometry(0.12, 2.1, 0.12), M.walnut); easel.position.set(80.15, 1.95, -34); root.add(easel);
  const featSign = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 0.42), std({ color: 0xffffff, roughness: 0.6 })); featSign.position.set(79.15, 1.3, -34); featSign.rotation.y = -Math.PI / 2; root.add(featSign);
  // ベンチ
  [[77, -29.2], [77, -38.8], [84, -29.2], [84, -38.8]].forEach(([x, z]) => { box(M.walnut, 2.2, 0.1, 0.55, x, 0.46, z); [-0.9, 0.9].forEach((o) => box(M.iron, 0.08, 0.42, 0.5, x + o, 0.21, z)); colliders.push({ x0: x - 1.15, x1: x + 1.15, z0: z - 0.32, z1: z + 0.32 }); });
  // 案内台（TMDb の表示と、展示室のパネルを開く）
  box(M.walnutDark, 1.4, 1.0, 0.7, 72.2, 0.5, -31.5); box(gold, 1.44, 0.05, 0.74, 72.2, 1.02, -31.5, false);
  colliders.push({ x0: 71.4, x1: 73.0, z0: -31.9, z1: -31.1 });
  const deskTex = canvasTex(512, 256, (g, w, h) => { g.fillStyle = '#0d253f'; g.fillRect(0, 0, w, h); g.fillStyle = '#90cea1'; g.font = '800 64px sans-serif'; g.textAlign = 'center'; g.fillText('TMDB', w / 2, 92); g.fillStyle = '#e8f3ec'; g.font = '500 24px sans-serif'; g.fillText('This product uses the TMDB API', w / 2, 150); g.fillText('but is not endorsed or certified by TMDB.', w / 2, 184); g.font = '700 30px ' + MINCHO; g.fillStyle = '#f1e6c6'; g.fillText('展示室の案内（タップ）', w / 2, 236); });
  const desk = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.6), new THREE.MeshBasicMaterial({ map: deskTex })); desk.position.set(72.2, 1.4, -31.5); desk.rotation.y = Math.PI / 2 - 0.3; root.add(desk);

  function signTex(title, sub) {
    return canvasTex(1024, 104, (g, w, h) => { g.fillStyle = '#1c1812'; g.fillRect(0, 0, w, h); g.strokeStyle = '#c9a04e'; g.lineWidth = 4; g.strokeRect(4, 4, w - 8, h - 8); g.fillStyle = '#f1e2b8'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = '800 42px ' + MINCHO; g.fillText(title, w / 2, sub ? 38 : 52, w - 40); if (sub) { g.font = '500 24px ' + MINCHO; g.fillStyle = '#cdbf9c'; g.fillText(sub, w / 2, 78, w - 40); } });
  }
  const loader = new THREE.TextureLoader();
  const texCache = new Map();
  function posterTexture(url) {
    if (!url) return blankTex;
    if (texCache.has(url)) return texCache.get(url);
    const t = loader.load('/api/img?u=' + encodeURIComponent(url));
    t.anisotropy = 4; texCache.set(url, t); return t;
  }
  function setFrame(f, m) { f.movie = m || null; f.p.material.map = m ? posterTexture(m.poster) : blankTex; f.p.material.needsUpdate = true; }
  function hangWall(name, title, sub, items) {
    const w = walls[name]; w.title = title; w.items = items;
    w.sign.material.map = signTex(title, sub); w.sign.material.needsUpdate = true;
    w.frames.forEach((f, i) => setFrame(f, items[i]));
  }
  function hangFeature(m, why) {
    setFrame(feature, m);
    featSign.material.map = signTex('今日の一本', m ? (m.title + (m.year ? '（' + m.year + '）' : '') + (why ? '　' + why : '')) : '収蔵品を集めると飾られます');
    featSign.material.needsUpdate = true;
    banners[0].material.map = m && m.poster ? posterTexture(m.poster) : null; banners[0].material.color.set(m && m.poster ? 0xffffff : 0x7a1020); banners[0].material.needsUpdate = true;
  }

  // ---------------- データ
  let list = (() => { try { const v = JSON.parse(localStorage.getItem(CACHE) || '[]'); return Array.isArray(v) ? v.filter((m) => m && m.id) : []; } catch (e) { return []; } })();
  let loadedAt = 0, loading = null;
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
  const saveList = () => { try { localStorage.setItem(CACHE, JSON.stringify(list.map((m) => ({ ...m, overview: (m.overview || '').slice(0, 90) })))); } catch (e) { /* 多すぎて保存できなくても続ける */ } };
  function loadAll() {
    if (loading) return loading;
    loading = (async () => {
      try {
        let cur = '', all = [], n = 0;
        do { const j = await api('/api/movies' + (cur ? '?cursor=' + encodeURIComponent(cur) : '')); all = all.concat(j.records); cur = j.next || ''; n++; if (n % 10 === 0) { list = all.slice(); curate(); } } while (cur && n < 150);
        list = all; loadedAt = Date.now(); saveList(); curate(); if (el.classList.contains('open')) render();
      } catch (e) { /* 前回の一覧で続ける */ }
      loading = null;
    })();
    return loading;
  }

  // ---------------- 毎日の展示替え（日付で決まる。手で替えた壁はその日だけ優先）
  const overrides = () => { try { const o = JSON.parse(localStorage.getItem(OVERRIDE) || 'null'); return o && o.date === todayStr() ? o.walls : {}; } catch (e) { return {}; } };
  function setOverride(name, title, ids) { const o = overrides(); o[name] = { title, ids }; try { localStorage.setItem(OVERRIDE, JSON.stringify({ date: todayStr(), walls: o })); } catch (e) { /* 続ける */ } }
  const byScore = (a, b) => (b.vote || 0) - (a.vote || 0) || (b.popularity || 0) - (a.popularity || 0);
  const unseenFirst = (a, b) => (a.status === '観た') - (b.status === '観た') || byScore(a, b);
  function curate() {
    if (!list.length) { hangWall('north', 'サブスクの部屋', '収蔵品を集めると展示されます', []); hangWall('south', '年代の回廊', '', []); hangWall('east', '特集の部屋', '', []); hangFeature(null); return; }
    const r = seedRng(daySeed());
    const ov = overrides();
    const byIds = (ids) => ids.map((id) => list.find((m) => m.id === id)).filter(Boolean);
    // 北：サブスク（その日のサービスで、見放題の名作）
    const subs = SUB_ORDER.filter((s) => list.filter((m) => m.flatrate.includes(s)).length >= 6);
    if (ov.north) hangWall('north', ov.north.title, 'あなたが選んだ展示', byIds(ov.north.ids));
    else if (subs.length) { const s = subs[Math.floor(r() * subs.length)]; hangWall('north', s + 'で観られる名作', '今日の見放題から（TMDbの情報）', list.filter((m) => m.flatrate.includes(s)).sort(unseenFirst).slice(0, 8)); }
    else hangWall('north', '人気の作品', '', list.slice().sort((a, b) => (b.popularity || 0) - (a.popularity || 0)).slice(0, 8));
    // 南：年代の回廊
    const decades = ['2020年代', '2010年代', '2000年代', '1990年代', '1980年代', '1970年代', '1960年代', '1950年代'].filter((d) => list.filter((m) => m.decade === d).length >= 6);
    if (ov.south) hangWall('south', ov.south.title, 'あなたが選んだ展示', byIds(ov.south.ids));
    else if (decades.length) { const d = decades[Math.floor(r() * decades.length)]; hangWall('south', d + 'の回廊', 'この時代を代表する作品', list.filter((m) => m.decade === d).sort(byScore).slice(0, 8)); }
    // 東：監督特集（3本以上あれば）またはジャンル特集
    const fresh = list.filter((m) => (m.collections || []).includes('最新作')).sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
    if (fresh[0] && fresh[0].poster) { banners[1].material.map = posterTexture(fresh[0].poster); banners[1].material.color.set(0xffffff); banners[1].material.needsUpdate = true; }
    if (ov.east) hangWall('east', ov.east.title, 'あなたが選んだ展示', byIds(ov.east.ids));
    else if (fresh.length >= 6 && daySeed() % 2 === 0) hangWall('east', '新作コーナー', '最近の公開作と、これから公開の作品', fresh.slice(0, 6));
    else {
      const dc = {}; list.forEach((m) => m.directors.forEach((d) => { dc[d] = (dc[d] || 0) + 1; }));
      const dirs = Object.keys(dc).filter((d) => dc[d] >= 3);
      if (dirs.length && r() < 0.6) { const d = dirs[Math.floor(r() * dirs.length)]; hangWall('east', d + ' 監督特集', '作品を年代順に', list.filter((m) => m.directors.includes(d)).sort((a, b) => (a.year || 0) - (b.year || 0)).slice(0, 6)); }
      else { const gs = [...new Set(list.flatMap((m) => m.genres))].filter((g) => list.filter((m) => m.genres.includes(g)).length >= 6); const g = gs[Math.floor(r() * gs.length)] || 'ドラマ'; hangWall('east', g + 'の部屋', 'ジャンル特集', list.filter((m) => m.genres.includes(g)).sort(byScore).slice(0, 6)); }
    }
    // 中央：今日の一本（まだ観ていない、配信で観られる高評価作）
    const cand = list.filter((m) => m.status !== '観た' && m.flatrate.length && (m.vote || 0) >= 7.2).sort(byScore).slice(0, 30);
    const pickM = cand.length ? cand[Math.floor(r() * cand.length)] : list.slice().sort(byScore)[0];
    hangFeature(pickM, pickM && pickM.flatrate.length ? pickM.flatrate[0] + 'で見放題' : '');
  }
  if (list.length) setTimeout(curate, 0); else curate();
  setTimeout(() => loadAll(), 6000);

  // ---------------- 来館者（壁の前を見て回る）
  const visitors = [];
  const spots = () => [...walls.north.frames, ...walls.south.frames, ...walls.east.frames].map((f) => { const p = f.g.position; const n = new THREE.Vector3(0, 0, 1).applyQuaternion(f.g.quaternion); return { x: p.x + n.x * 2.2, z: p.z + n.z * 2.2, ry: Math.atan2(-n.x, -n.z) }; });
  function attach(cast) {
    const S = spots();
    for (let i = 0; i < 5; i++) {
      const a = cast.spawn(pick(['Rogue', 'Mage', 'Knight', 'Rogue_Hooded']), { gear: [] });
      const s = S[Math.floor(Math.random() * S.length)];
      a.root.position.set(s.x, 0, s.z); a.root.rotation.y = s.ry; root.add(a.root); a.play('Idle');
      visitors.push({ a, path: [], wait: rand(2, 10), ry: s.ry });
    }
  }
  function moveVisitor(v, dt) {
    if (v.wait > 0) { v.wait -= dt; if (v.wait <= 0) { const S = spots(); const t = S[Math.floor(Math.random() * S.length)]; const p = v.a.root.position; v.path = [{ x: 74, z: p.z }, { x: 74, z: t.z }, t]; v.target = t; v.a.play('Walking_A', { timeScale: 0.75 / WALK_SPEED_AT_1X }); } return; }
    const n = v.path[0]; if (!n) return;
    const p = v.a.root.position; const dx = n.x - p.x, dz = n.z - p.z, d = Math.hypot(dx, dz);
    if (d < 0.08) { v.path.shift(); if (!v.path.length) { v.a.root.rotation.y = v.target.ry; v.a.play(Math.random() < 0.3 ? 'Cheer' : 'Idle'); v.wait = rand(6, 14); } return; }
    const s = Math.min(d, 0.75 * dt); p.x += (dx / d) * s; p.z += (dz / d) * s; v.a.root.rotation.y = Math.atan2(dx, dz);
  }

  // ---------------- 展示室のパネル
  const style = document.createElement('style');
  style.textContent = `#mus{position:fixed;inset:auto 0 0 0;z-index:12;padding:0 10px calc(env(safe-area-inset-bottom,0px) + 10px);transform:translateY(110%);transition:transform .38s cubic-bezier(.2,.8,.2,1)}
#mus.open{transform:none}#mus .card{max-height:88vh;overflow-y:auto;display:block}
#mus h2{font-family:var(--display);font-size:19px;font-weight:800;margin:0}#mus h2 small{font-size:11px;color:var(--text-dim);margin-left:6px;font-weight:500}
.mu-tabs{display:flex;gap:6px;margin:10px 0}.mu-tabs button{flex:1;height:36px;border-radius:11px;border:1px solid var(--line);background:transparent;color:var(--text-dim);font-family:var(--ui);font-size:13px}
.mu-tabs button[aria-pressed=true]{background:#c9a04e;color:#1b150b;border-color:#c9a04e;font-weight:700}
.mu-btn{height:38px;padding:0 13px;border-radius:11px;border:1px solid rgba(210,170,85,.45);background:rgba(210,170,85,.1);color:#EBD08F;font-family:var(--ui);font-size:12.5px;cursor:pointer;flex-shrink:0}
.mu-btn.main{background:#c9a04e;color:#1b150b;font-weight:700}
.mu-q{display:flex;gap:6px}.mu-q input{flex:1;min-width:0;height:40px;border-radius:11px;border:1px solid var(--line);background:rgba(20,15,10,.8);color:var(--text);font-size:16px;padding:0 12px}
.mu-q select{height:40px;border-radius:11px;border:1px solid var(--line);background:rgba(20,15,10,.8);color:var(--text);font-size:13px;padding:0 6px}
.mu-row{display:flex;gap:6px;overflow-x:auto;padding:6px 0 2px;scrollbar-width:none}.mu-row::-webkit-scrollbar{display:none}
.mu-row b{flex:0 0 auto;font-size:11px;color:var(--text-dim);align-self:center;min-width:40px}
.mu-row button{flex:0 0 auto;height:30px;padding:0 10px;border-radius:15px;border:1px solid var(--line);background:transparent;color:var(--text-dim);font-size:12px;font-family:var(--ui)}
.mu-row button[aria-pressed=true]{background:rgba(201,160,78,.25);color:#f3dfa8;border-color:#c9a04e}
.mu-count{font-size:11.5px;color:var(--text-dim);margin:8px 0 6px;display:flex;justify-content:space-between;align-items:center;gap:8px}
.mu-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}
.mu-tile{background:none;border:none;padding:0;text-align:left;color:var(--text);font-family:var(--ui);position:relative}
.mu-tile img{width:100%;aspect-ratio:2/3;object-fit:cover;border-radius:7px;background:#222;display:block}
.mu-tile b{display:block;font-size:11px;line-height:1.35;margin-top:3px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.mu-tile span{font-size:10px;color:var(--text-dim)}
.mu-tile i{position:absolute;top:4px;left:4px;font-style:normal;font-size:10px;padding:1px 6px;border-radius:8px;background:rgba(20,16,10,.85);color:#f3dfa8}
.mu-det{position:fixed;inset:0;z-index:32;background:rgba(5,4,3,.72);display:none;align-items:flex-end;justify-content:center}
.mu-det.open{display:flex}.mu-det .in{width:100%;max-width:640px;max-height:92vh;overflow-y:auto;background:#17130e;border-radius:18px 18px 0 0;border:1px solid var(--line);padding-bottom:calc(env(safe-area-inset-bottom,0px) + 14px)}
.mu-bd{height:150px;background-size:cover;background-position:center;border-radius:18px 18px 0 0;position:relative}.mu-bd::after{content:'';position:absolute;inset:0;background:linear-gradient(transparent 30%,#17130e)}
.mu-top{display:flex;gap:12px;padding:0 14px;margin-top:-70px;position:relative;z-index:1}.mu-top img{width:104px;aspect-ratio:2/3;object-fit:cover;border-radius:8px;box-shadow:0 6px 18px rgba(0,0,0,.6)}
.mu-top h3{font-family:var(--display);font-size:18px;margin:62px 0 2px;line-height:1.3}.mu-top p{margin:0;font-size:11.5px;color:var(--text-dim)}
.mu-sec{padding:8px 14px 0;font-size:13px;line-height:1.7}.mu-sec h4{margin:6px 0 4px;font-size:12px;color:#EBD08F;font-weight:600}
.mu-chip{display:inline-block;margin:0 5px 5px 0;padding:3px 9px;border-radius:12px;border:1px solid var(--line);font-size:12px;color:var(--text);background:transparent;font-family:var(--ui)}
.mu-chip.sub{border-color:#5fbf86;color:#bfeccd}.mu-chip.rent{border-color:#7f8fa8;color:#cfd8e8}
.mu-acts{display:flex;flex-wrap:wrap;gap:6px;padding:10px 14px 0}
.mu-prog{height:8px;border-radius:4px;background:rgba(255,255,255,.1);overflow:hidden;margin:8px 0}.mu-prog i{display:block;height:100%;width:0;background:linear-gradient(90deg,#c9a04e,#f0d48a)}
.mu-note{font-size:11px;color:var(--text-dim);margin:8px 0 0;line-height:1.6}`;
  document.head.append(style);
  const el = document.createElement('section');
  el.id = 'mus';
  el.innerHTML = `<div class='card'>
    <div class='chead'><h2>映画博物館<small id='muCount'></small></h2><button id='muClose' class='mu-btn' type='button'>閉じる</button></div>
    <div class='mu-tabs' id='muTabs'><button type='button' data-t='find' aria-pressed='true'>探す</button><button type='button' data-t='walls' aria-pressed='false'>今日の展示</button><button type='button' data-t='collect' aria-pressed='false'>収蔵品を集める</button></div>
    <div id='muBody'></div>
    <p class='mu-note'>作品情報・配信状況は TMDb（The Movie Database）提供。This product uses the TMDB API but is not endorsed or certified by TMDB.</p>
  </div>`;
  document.body.append(el);
  const det = document.createElement('div'); det.className = 'mu-det'; det.innerHTML = "<div class='in' id='muDet'></div>"; document.body.append(det);
  det.addEventListener('click', (e) => { if (e.target === det) det.classList.remove('open'); });
  const $ = (id) => document.getElementById(id);
  const h = (tag, cls, t) => { const e = document.createElement(tag); if (cls) e.className = cls; if (t !== undefined) e.textContent = t; return e; };
  let tab = 'find';
  const F = { q: '', coll: '', sub: '', genre: '', decade: '', country: '', status: '', sort: 'vote', limit: 60 };
  el.querySelectorAll('#muTabs button').forEach((b) => b.addEventListener('click', () => { tab = b.dataset.t; el.querySelectorAll('#muTabs button').forEach((x) => x.setAttribute('aria-pressed', x === b ? 'true' : 'false')); render(); }));
  const norm = (s) => String(s || '').normalize('NFKC').toLowerCase().replace(/[\s・･]/g, '');
  function filtered() {
    const q = norm(F.q);
    let r = list.filter((m) => (!F.coll || (m.collections || []).includes(F.coll)) && (!F.sub || m.flatrate.includes(F.sub)) && (!F.genre || m.genres.includes(F.genre)) && (!F.decade || m.decade === F.decade) && (!F.country || m.countries.includes(F.country)) && (!F.status || (F.status === '未見' ? !m.status : m.status === F.status)));
    if (q) r = r.filter((m) => norm([m.title, m.original, m.directors.join(' '), m.cast.join(' '), m.genres.join(' ')].join(' ')).includes(q));
    const S = { rel: (a, b) => String(b.date || b.year || '').localeCompare(String(a.date || a.year || '')), vote: byScore, pop: (a, b) => (b.popularity || 0) - (a.popularity || 0), new: (a, b) => (b.year || 0) - (a.year || 0), old: (a, b) => (a.year || 0) - (b.year || 0) };
    return r.sort(S[F.sort] || byScore);
  }
  function chipRow(label, key, values) {
    const row = h('div', 'mu-row'); row.append(h('b', '', label));
    [''].concat(values).forEach((v) => { const b = h('button', '', v || 'すべて'); b.type = 'button'; b.setAttribute('aria-pressed', F[key] === v ? 'true' : 'false'); b.addEventListener('click', () => { F[key] = v; F.limit = 60; render(); }); row.append(b); });
    return row;
  }
  const counted = (arr, min) => { const c = {}; arr.forEach((x) => { c[x] = (c[x] || 0) + 1; }); return Object.keys(c).filter((k) => c[k] >= (min || 1)).sort((a, b) => c[b] - c[a]); };
  function render() {
    $('muCount').textContent = list.length ? '収蔵 ' + list.length + '本' : '';
    const body = $('muBody'); body.innerHTML = '';
    if (tab === 'find') {
      const qrow = h('div', 'mu-q');
      const inp = document.createElement('input'); inp.placeholder = '題名・監督・俳優で探す'; inp.value = F.q;
      inp.addEventListener('input', () => { F.q = inp.value; F.limit = 60; clearTimeout(inp._t); inp._t = setTimeout(() => { const pos = inp.selectionStart; render(); const n = body.querySelector('input'); if (n) { n.focus(); try { n.setSelectionRange(pos, pos); } catch (e) { /* 続ける */ } } }, 260); });
      const sel = document.createElement('select'); [['vote', '評価順'], ['pop', '人気順'], ['rel', '公開日順'], ['new', '新しい順'], ['old', '古い順']].forEach(([v, l]) => { const o = document.createElement('option'); o.value = v; o.textContent = l; sel.append(o); }); sel.value = F.sort; sel.addEventListener('change', () => { F.sort = sel.value; render(); });
      qrow.append(inp, sel); body.append(qrow);
      const subs = SUB_ORDER.filter((s) => list.some((m) => m.flatrate.includes(s))).concat(counted(list.flatMap((m) => m.flatrate), 3).filter((s) => !SUB_ORDER.includes(s)));
      const colls = counted(list.flatMap((m) => m.collections || []), 3); const ci = colls.indexOf('最新作'); if (ci > 0) { colls.splice(ci, 1); colls.unshift('最新作'); }
      body.append(chipRow('特集', 'coll', colls), chipRow('サブスク', 'sub', subs), chipRow('ジャンル', 'genre', counted(list.flatMap((m) => m.genres), 2)), chipRow('年代', 'decade', ['2020年代', '2010年代', '2000年代', '1990年代', '1980年代', '1970年代', '1960年代', '1950年代', 'それ以前'].filter((d) => list.some((m) => m.decade === d))), chipRow('国', 'country', counted(list.flatMap((m) => m.countries), 3).slice(0, 14)), chipRow('記録', 'status', ['未見', '観たい', '観た', 'お気に入り']));
      const res = filtered();
      const cnt = h('div', 'mu-count'); cnt.append(h('span', '', res.length + '本'));
      if (res.length) { const hang = h('button', 'mu-btn', 'この結果を壁に飾る'); hang.type = 'button'; hang.addEventListener('click', () => hangChooser(res)); cnt.append(hang); }
      body.append(cnt);
      const grid = h('div', 'mu-grid');
      res.slice(0, F.limit).forEach((m) => grid.append(tile(m)));
      body.append(grid);
      if (res.length > F.limit) { const more = h('button', 'mu-btn', 'もっと見る'); more.type = 'button'; more.style.width = '100%'; more.style.marginTop = '8px'; more.addEventListener('click', () => { F.limit += 60; render(); }); body.append(more); }
      if (!list.length) body.append(h('p', 'mu-note', 'まだ収蔵品がありません。「収蔵品を集める」から、名作のコレクションを集めてください。'));
    } else if (tab === 'walls') {
      [['north', '北の壁'], ['south', '南の壁'], ['east', '東の壁']].forEach(([k, label]) => {
        body.append(h('h4', '', label + '：' + (walls[k].title || '（準備中）')));
        const grid = h('div', 'mu-grid'); walls[k].items.forEach((m) => grid.append(tile(m))); body.append(grid);
      });
      const goto = h('button', 'mu-btn main', '博物館の中へ行く'); goto.type = 'button'; goto.style.marginTop = '10px'; goto.addEventListener('click', () => { close(); warp({ x: 74, z: door, yaw: -Math.PI / 2, pitch: 0.04 }); }); body.append(goto);
      body.append(h('p', 'mu-note', '展示は毎日入れ替わります。北はサブスクの見放題、南は年代、東は監督かジャンルの特集。中央の「今日の一本」は、まだ観ていない配信中の名作から選ばれます。'));
    } else {
      collectView(body);
    }
  }
  function tile(m) {
    const t = h('button', 'mu-tile'); t.type = 'button';
    const img = document.createElement('img'); img.loading = 'lazy'; if (m.poster) img.src = m.poster.replace('/w342/', '/w185/'); img.alt = m.title;
    t.append(img, h('b', '', m.title), h('span', '', [m.year, m.vote ? '★' + m.vote : ''].filter(Boolean).join('　')));
    if (m.status) t.append(h('i', '', m.status));
    t.addEventListener('click', () => detail(m));
    return t;
  }
  function hangChooser(items) {
    const ids = items.slice(0, 8).map((m) => m.id);
    const title = [F.sub && F.sub + 'で観られる', F.genre, F.decade, F.country, F.q && '「' + F.q + '」'].filter(Boolean).join('・') || 'あなたの選んだ作品';
    const which = window.prompt('どの壁に飾りますか？ 1＝北の壁　2＝南の壁　3＝東の壁', '1');
    const k = { 1: 'north', 2: 'south', 3: 'east' }[String(which || '').trim()];
    if (!k) return;
    setOverride(k, title, ids); curate(); toast('今日の' + { north: '北', south: '南', east: '東' }[k] + 'の壁に飾りました');
  }
  function detail(m) {
    const d = $('muDet'); d.innerHTML = '';
    const bd = h('div', 'mu-bd'); if (m.backdrop) bd.style.backgroundImage = `url("${m.backdrop}")`; d.append(bd);
    const top = h('div', 'mu-top'); const img = document.createElement('img'); if (m.poster) img.src = m.poster; const info = h('div');
    info.append(h('h3', '', m.title), h('p', '', [m.original && m.original !== m.title ? m.original : '', m.year, m.runtime ? m.runtime + '分' : '', m.countries.join('・'), m.vote ? 'TMDb ★' + m.vote : ''].filter(Boolean).join('　')));
    top.append(img, info); d.append(top);
    const sec = (title, nodes) => { const s = h('div', 'mu-sec'); s.append(h('h4', '', title)); nodes.forEach((n) => s.append(n)); d.append(s); };
    const link = (label, fn, cls) => { const b = h('button', 'mu-chip' + (cls ? ' ' + cls : ''), label); b.type = 'button'; b.addEventListener('click', fn); return b; };
    const go = (patch) => () => { Object.assign(F, { q: '', coll: '', sub: '', genre: '', decade: '', country: '', status: '', limit: 60 }, patch); det.classList.remove('open'); tab = 'find'; el.querySelectorAll('#muTabs button').forEach((x) => x.setAttribute('aria-pressed', x.dataset.t === 'find' ? 'true' : 'false')); open(); };
    sec('配信（日本）', m.flatrate.length || m.rent.length ? [...m.flatrate.map((s) => link(s + '　見放題', go({ sub: s }), 'sub')), ...m.rent.slice(0, 6).map((s) => link(s + '　レンタル', () => {}, 'rent'))] : [h('span', '', 'いま日本で配信されている情報はありません')]);
    if (m.genres.length) sec('ジャンル', m.genres.map((g) => link(g, go({ genre: g }))));
    if (m.directors.length) sec('監督', m.directors.map((n) => link(n, go({ q: n }))));
    if (m.cast.length) sec('キャスト', m.cast.map((n) => link(n, go({ q: n }))));
    if (m.overview) { const s = h('div', 'mu-sec'); s.append(h('h4', '', 'あらすじ'), h('div', '', m.overview)); d.append(s); }
    const acts = h('div', 'mu-acts');
    if (m.trailer && cinema) { const b = h('button', 'mu-btn main', '予告編を映画館で上映'); b.type = 'button'; b.addEventListener('click', () => { const id = (m.trailer.match(/v=([\w-]+)/) || [])[1]; if (!id) return; det.classList.remove('open'); close(); cinema.play({ service: 'YouTube', url: m.trailer, embed: 'https://www.youtube.com/embed/' + id + '?playsinline=1&rel=0&modestbranding=1', title: '予告編：' + m.title, thumb: m.poster }); warp({ x: 57.6, z: -19, yaw: -Math.PI / 2, pitch: 0.06 }); toast('映画館で予告編を上映します'); }); acts.append(b); }
    if (m.link) { const a = h('a', 'mu-btn', '配信ページを開く'); a.href = m.link; a.target = '_blank'; a.rel = 'noopener'; a.style.display = 'inline-flex'; a.style.alignItems = 'center'; a.style.textDecoration = 'none'; acts.append(a); }
    const feat = h('button', 'mu-btn', '中央に飾る'); feat.type = 'button'; feat.addEventListener('click', () => { hangFeature(m, 'あなたが選んだ一本'); toast('「今日の一本」に飾りました'); }); acts.append(feat);
    d.append(acts);
    // 観た・観たい・お気に入りと、自分のスコア
    const st = h('div', 'mu-acts');
    STATUS.forEach((s) => { const b = h('button', 'mu-btn' + (m.status === s ? ' main' : ''), s); b.type = 'button'; b.addEventListener('click', () => saveStatus(m, m.status === s ? '' : s, m.score)); st.append(b); });
    const sc = document.createElement('select'); sc.className = 'mu-btn'; ['', '5', '4.5', '4', '3.5', '3', '2.5', '2', '1.5', '1'].forEach((v) => { const o = document.createElement('option'); o.value = v; o.textContent = v ? '★' + v : '私のスコア'; sc.append(o); }); sc.value = m.score ? String(m.score) : ''; sc.addEventListener('change', () => saveStatus(m, m.status || '観た', sc.value));
    st.append(sc); d.append(st);
    det.classList.add('open');
  }
  async function saveStatus(m, status, score) {
    try { const j = await api('/api/movies', { method: 'POST', body: JSON.stringify({ action: 'status', pageId: m.pageId, status, score: score === undefined ? undefined : score }) }); Object.assign(m, { status: j.record.status, score: j.record.score }); saveList(); detail(m); render(); toast('Notion「映画」に記録しました'); }
    catch (e) { toast('記録できませんでした：' + String(e.message).slice(0, 50)); }
  }
  // ---- 収蔵品を集める（TMDb の名作コレクションを少しずつ Notion へ）
  let collecting = false;
  async function collectView(body) {
    const prog = (() => { try { return JSON.parse(localStorage.getItem(SEEDED) || '{}'); } catch (e) { return {}; } })();
    body.append(h('p', 'mu-note', '「最新作をすべて取り込む」は、日本で最近公開された作品・上映中・公開予定・各サブスクの新着をまとめて取り込みます（これからは毎朝自動）。「収蔵品を集める」は、名作・人気作・年代別・ヒット作・日本映画・アニメ・各国の映画・各サブスク・ジャンル別を集めます（全部で数千本・1時間ほど。画面を開いたままにしてください）。途中でやめても続きから再開できます。'));
    const bar = h('div', 'mu-prog'); const fill = h('i'); bar.append(fill); body.append(bar);
    const msg = h('p', 'mu-note', ''); body.append(msg);
    const row = h('div', 'mu-acts'); row.style.padding = '0';
    const go = h('button', 'mu-btn main', collecting ? '集めています…' : (Object.keys(prog).length ? '続きを集める' : '収蔵品を集める')); go.type = 'button'; go.disabled = collecting;
    const ref = h('button', 'mu-btn', '配信状況を最新にする'); ref.type = 'button';
    const lat = h('button', 'mu-btn main', '最新作をすべて取り込む'); lat.type = 'button';
    row.append(lat, go, ref); body.append(row);
    lat.addEventListener('click', async () => {
      lat.disabled = true; let n = 0;
      try { for (let i = 0; i < 8; i++) { msg.textContent = '最新作を取り込んでいます…（いま ' + n + '本 追加）'; const r = await api('/api/movies', { method: 'POST', body: JSON.stringify({ action: 'latest' }) }); r.added.forEach((m) => { if (!list.some((x) => x.id === m.id)) list.push(m); }); n += r.added.length; if (r.done) break; } saveList(); curate(); msg.textContent = '最新作の取り込みが終わりました（' + n + '本 追加）。これからは毎朝、自動で取り込みます。'; $('muCount').textContent = '収蔵 ' + list.length + '本'; }
      catch (e) { msg.textContent = '途中で止まりました：' + String(e.message).slice(0, 60) + '　もう一度押すと続きから取り込みます'; }
      lat.disabled = false;
    });
    // 1本だけ探して加える
    body.append(h('h4', '', '1本だけ加える'));
    const q = h('div', 'mu-q'); const inp = document.createElement('input'); inp.placeholder = '映画の題名'; const sb = h('button', 'mu-btn', '探す'); sb.type = 'button'; q.append(inp, sb); body.append(q);
    const found = h('div', 'mu-grid'); found.style.marginTop = '8px'; body.append(found);
    sb.addEventListener('click', async () => {
      found.innerHTML = '';
      try { const j = await api('/api/movies?search=' + encodeURIComponent(inp.value.trim())); j.results.forEach((r2) => { const t = h('button', 'mu-tile'); t.type = 'button'; const im = document.createElement('img'); if (r2.poster) im.src = r2.poster; t.append(im, h('b', '', r2.title), h('span', '', r2.year)); t.addEventListener('click', async () => { try { const a = await api('/api/movies', { method: 'POST', body: JSON.stringify({ action: 'add', tmdbId: r2.id }) }); if (!list.some((m) => m.id === a.record.id)) list.unshift(a.record); saveList(); toast(a.existed ? 'すでに収蔵されています' : '「' + r2.title + '」を収蔵しました'); detail(a.record); } catch (e) { toast('加えられませんでした：' + String(e.message).slice(0, 40)); } }); found.append(t); }); }
      catch (e) { toast('探せませんでした：' + String(e.message).slice(0, 40)); }
    });
    let plan = [];
    try { plan = (await api('/api/movies?plan=1')).collections; } catch (e) { msg.textContent = '収集計画を読めませんでした：' + e.message; return; }
    const total = plan.reduce((s, c) => s + c.pages, 0);
    const doneCount = () => plan.reduce((s, c) => s + Math.min(c.pages, prog[c.key] || 0), 0);
    const upd = (t) => { fill.style.width = (doneCount() / total * 100).toFixed(1) + '%'; if (t) msg.textContent = t; };
    upd(doneCount() ? '進み具合：' + doneCount() + ' / ' + total : '');
    go.addEventListener('click', async () => {
      if (collecting) return; collecting = true; go.disabled = true; go.textContent = '集めています…';
      let added = 0;
      try {
        for (const c of plan) {
          for (let p = (prog[c.key] || 0) + 1; p <= c.pages; p++) {
            let more = true, guard = 0;
            while (more && guard++ < 5) {
              upd('「' + c.label + '」' + p + 'ページ目を集めています…（いま ' + added + '本 追加）');
              const j = await api('/api/movies', { method: 'POST', body: JSON.stringify({ action: 'seed', list: c.key, page: p }) });
              j.added.forEach((m) => { if (!list.some((x) => x.id === m.id)) list.push(m); }); added += j.added.length; more = j.more;
            }
            prog[c.key] = p; localStorage.setItem(SEEDED, JSON.stringify(prog)); saveList();
          }
        }
        upd('すべて集め終わりました（今回 ' + added + '本 追加）'); curate();
      } catch (e) { upd('途中で止まりました：' + String(e.message).slice(0, 60) + '　もう一度押すと続きから再開します'); }
      collecting = false; go.disabled = false; go.textContent = '続きを集める'; $('muCount').textContent = '収蔵 ' + list.length + '本';
    });
    ref.addEventListener('click', async () => { ref.disabled = true; try { let n = 0; for (let i = 0; i < 3; i++) { const j = await api('/api/movies', { method: 'POST', body: JSON.stringify({ action: 'refresh', count: 20 }) }); n += j.refreshed; } toast(n + '本の配信状況を更新しました'); loadAll(); } catch (e) { toast('更新できませんでした：' + String(e.message).slice(0, 40)); } ref.disabled = false; });
  }
  // 1日1回、開いたときに配信状況を少し更新する（データを新しく保つ）
  async function dailyRefresh() {
    if (localStorage.getItem(REFRESHED) === todayStr() || !list.length) return;
    localStorage.setItem(REFRESHED, todayStr());
    try { await api('/api/movies', { method: 'POST', body: JSON.stringify({ action: 'refresh', count: 20 }) }); } catch (e) { /* 次の日にまた */ }
    try { const r = await api('/api/movies', { method: 'POST', body: JSON.stringify({ action: 'latest' }) }); if (r.added.length) { r.added.forEach((m) => { if (!list.some((x) => x.id === m.id)) list.push(m); }); saveList(); curate(); toast('最新作を' + r.added.length + '本 収蔵しました'); } } catch (e) { /* 次の日にまた */ }
  }
  function open() { el.classList.add('open'); render(); if (!list.length || Date.now() - loadedAt > 30 * 60 * 1000) loadAll(); dailyRefresh(); }
  function close() { el.classList.remove('open'); }
  $('muClose').addEventListener('click', close);

  // ---------------- 毎フレーム・案内・タップ
  function update(dt, time, player) {
    const near = player && Math.hypot(player.x - cx, player.z - cz) < 34;
    if (!near) return;
    visitors.forEach((v) => { moveVisitor(v, dt); v.a.mixer.update(dt); });
  }
  const ray = new THREE.Raycaster(); ray.far = 16;
  const center = new THREE.Vector2(0, 0);
  const allFrames = () => [...walls.north.frames, ...walls.south.frames, ...walls.east.frames, feature];
  function hitTest(ndc, camera) {
    ray.setFromCamera(ndc || center, camera);
    const targets = [...allFrames().map((f) => f.p), walls.north.sign, walls.south.sign, walls.east.sign, desk, featSign, nameP];
    return ray.intersectObjects(targets, false)[0] || null;
  }
  const frameOf = (o) => allFrames().find((f) => f.p === o);
  function hint(camera) {
    const hh = hitTest(null, camera); if (!hh) return null;
    const f = frameOf(hh.object);
    if (f && f.movie) { const m = f.movie; return ['『' + m.title + '』', '　' + [m.year, m.directors[0], m.flatrate[0] ? m.flatrate[0] + 'で見放題' : ''].filter(Boolean).join('・') + '　タップで解説']; }
    if (hh.object === desk) return ['案内台', '　タップで展示室の案内'];
    if (hh.object === nameP) return ['映画博物館', '　タップで展示室の案内'];
    const w = Object.values(walls).find((x) => x.sign === hh.object);
    if (w) return [w.title, '　タップで展示室の案内'];
    return null;
  }
  function pickFn(ndc, camera) {
    const hh = hitTest(ndc, camera); if (!hh) return false;
    const f = frameOf(hh.object);
    if (f) { if (f.movie) detail(f.movie); else open(); return true; }
    open(); return true;
  }
  return { attach, update, hint, pick: pickFn, open, close, get list() { return list; } };
}
