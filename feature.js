// 玄関ホールの「今週の特集」コーナー
// 読書メーターの本から、週ごとに入れ替わる4つの特集を選び、表紙を正面に向けて並べる。
// 表紙をタップすると、その本の紹介（借りる・買うかばんへ）が開く。上の垂れ幕をタップすると別の特集に替わる。
import * as THREE from 'three';
import { GENRE_NAMES } from './genre.js';

const MINCHO = '"Shippori Mincho B1", "Hiragino Mincho ProN", serif';
const OFFSET_KEY = 'my-library:feature:offset:v1';
const COLS = 5, ROWS = 3, CW = 0.4, CH = 0.58;

// 季節の特集（月ごと）
const SEASON = {
  1: ['新年に読みたい教養の本', ['哲学・思想・宗教', '歴史・地理', '教育・学習・自己啓発']],
  2: ['春に向けて学び直す', ['教育・学習・自己啓発', '経営・ビジネス', 'AI・IT・テクノロジー']],
  3: ['春に向けて学び直す', ['教育・学習・自己啓発', '経営・ビジネス', 'AI・IT・テクノロジー']],
  4: ['新緑と生命の本', ['生命・生物・医学', '物理・数学・宇宙']],
  5: ['新緑と生命の本', ['生命・生物・医学', '物理・数学・宇宙']],
  6: ['雨の日に読む物語と思索', ['文学・小説', '哲学・思想・宗教', '心理・脳・認知']],
  7: ['夏休みの大きな本', ['歴史・地理', '人類学・社会学', '文学・小説']],
  8: ['夏休みの大きな本', ['歴史・地理', '人類学・社会学', '文学・小説']],
  9: ['読書の秋：じっくり考える本', ['哲学・思想・宗教', '心理・脳・認知', '人類学・社会学', '経済・金融']],
  10: ['読書の秋：じっくり考える本', ['哲学・思想・宗教', '心理・脳・認知', '人類学・社会学', '経済・金融']],
  11: ['読書の秋：じっくり考える本', ['哲学・思想・宗教', '心理・脳・認知', '人類学・社会学', '経済・金融']],
  12: ['今年をふり返る社会と経済', ['経済・金融', '政治・法律・社会', '経営・ビジネス']],
};

// 日本時間の「週」（月曜はじまり）
function weekInfo(now = Date.now()) {
  const jst = new Date(now + 9 * 3600 * 1000);
  const day = Math.floor(jst.getTime() / 86400000);
  const week = Math.floor((day + 3) / 7); // 1970/1/1 は木曜
  const monday = (week * 7 - 3) * 86400000;
  const fmt = (t) => { const d = new Date(t); return (d.getUTCMonth() + 1) + '/' + d.getUTCDate(); };
  return { week, label: fmt(monday) + '〜' + fmt(monday + 6 * 86400000), month: jst.getUTCMonth() + 1 };
}
function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function pickN(list, n, r) {
  const a = list.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  // 表紙のある本を先に
  a.sort((x, y) => (y.item.cover ? 1 : 0) - (x.item.cover ? 1 : 0));
  return a.slice(0, n);
}

// 特集の組み立て（同じ週・同じ番号なら、いつも同じ本が並ぶ）
export function planWeek(rows, wk, offset) {
  const used = new Set();
  const avail = (list) => list.filter((x) => !used.has(x.item.id));
  const take = (list, seed) => { const out = pickN(avail(list), COLS * ROWS, rng(seed)); out.forEach((x) => used.add(x.item.id)); return out; };
  const k = wk.week + offset;
  const wish = rows.filter((x) => x.item.shelf === 'wish' || x.item.shelf === 'stacked');
  const pool = wish.length >= 20 ? wish : rows;
  const plans = [];
  // 1. 今週のジャンル特集
  const counts = {};
  pool.forEach((x) => { counts[x.genre] = (counts[x.genre] || 0) + 1; });
  const genres = GENRE_NAMES.filter((g) => (counts[g] || 0) >= 6);
  if (genres.length) {
    const g = genres[((k % genres.length) + genres.length) % genres.length];
    plans.push({ title: '今週のジャンル特集', sub: g, books: take(pool.filter((x) => x.genre === g), k * 11 + 1) });
  }
  // 2. 隠れた名著 ／ 季節の特集（週ごとに交代）
  if (k % 2 === 0) plans.push({ title: '隠れた名著', sub: '登録者が少ない、あなたの読みたい本', books: take(pool.filter((x) => (x.item.regs || 0) <= 40), k * 13 + 2) });
  else { const [t, gs] = SEASON[wk.month] || SEASON[10]; plans.push({ title: '季節の特集', sub: t, books: take(pool.filter((x) => gs.includes(x.genre)), k * 13 + 2) }); }
  // 3. 眠れる本を起こそう（積読と、読みたい本の古いほう）
  const wishOnly = rows.filter((x) => x.item.shelf === 'wish');
  const old = wishOnly.slice(Math.floor(wishOnly.length * 0.6));
  plans.push({ title: '眠れる本を起こそう', sub: '積読と、ずっと前に積んだ本', books: take(rows.filter((x) => x.item.shelf === 'stacked').concat(old), k * 17 + 3) });
  // 4. みんなが読んでいる本 ／ 偶然の出会い
  if (k % 2 === 0) { const pop = pool.slice().sort((a, b) => (b.item.regs || 0) - (a.item.regs || 0)).slice(0, 150); plans.push({ title: 'みんなが読んでいる本', sub: '登録者の多い、読みたい本', books: take(pop, k * 19 + 4) }); }
  else plans.push({ title: '偶然の出会い', sub: 'ジャンルを越えて選んだ本', books: take(pool, k * 19 + 4) });
  return plans.filter((p) => p.books.length);
}

// 文字を描いた板
function signTex(title, sub, w = 1024, h = 200) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d');
  g.fillStyle = '#1f3a2d'; g.fillRect(0, 0, w, h);
  g.strokeStyle = '#c9a04e'; g.lineWidth = 8; g.strokeRect(10, 10, w - 20, h - 20);
  g.fillStyle = '#efd99a'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.font = '800 64px ' + MINCHO; g.fillText(title, w / 2, sub ? h * 0.38 : h / 2, w - 60);
  if (sub) { g.font = '600 38px ' + MINCHO; g.fillStyle = '#e8e0c8'; g.fillText(sub, w / 2, h * 0.74, w - 60); }
  const t = new THREE.CanvasTexture(c); t.anisotropy = 4; return t;
}
// 表紙が無い本の、仮の表紙
function blankCover(title, author, seed) {
  const c = document.createElement('canvas'); c.width = 256; c.height = 372;
  const g = c.getContext('2d');
  const hues = [[122, 31, 31], [31, 47, 90], [39, 74, 54], [90, 34, 56], [110, 74, 30]];
  const [r, gg, b] = hues[seed % hues.length];
  g.fillStyle = `rgb(${r},${gg},${b})`; g.fillRect(0, 0, 256, 372);
  g.strokeStyle = '#d8b765'; g.lineWidth = 4; g.strokeRect(14, 14, 228, 344);
  g.fillStyle = '#f3e7c4'; g.textAlign = 'center'; g.font = '700 26px ' + MINCHO;
  const t = String(title).split(/[－―:：(（]/)[0];
  const lines = []; for (let i = 0; i < t.length && lines.length < 6; i += 8) lines.push(t.slice(i, i + 8));
  lines.forEach((l, i) => g.fillText(l, 128, 90 + i * 36));
  g.font = '500 18px ' + MINCHO; g.fillText(String(author || '').split(',')[0].slice(0, 12), 128, 330);
  return new THREE.CanvasTexture(c);
}

// 壁の陳列棚（表紙を正面に向けて3段×5冊）
const RACKS = [
  { x: -3.85, z: -34.55, ry: 0 },
  { x: 3.85, z: -34.55, ry: 0 },
  { x: -3.8, z: -23.25, ry: Math.PI },
  { x: 3.8, z: -23.25, ry: Math.PI },
];

export function createFeature({ scene, meter, M, colliders }) {
  const root = new THREE.Group(); scene.add(root);
  const covers = [];      // 表紙のメッシュ（userData に本）
  const signs = [];       // 棚の札（特集名）
  const loader = new THREE.TextureLoader();
  loader.setCrossOrigin('anonymous');
  const std = (o) => new THREE.MeshStandardMaterial(o);

  // ---- 棚そのもの（一度だけ作る）
  const slots = [];
  RACKS.forEach((r, ri) => {
    const g = new THREE.Group(); g.position.set(r.x, 0, r.z); g.rotation.y = r.ry; root.add(g);
    const W = COLS * 0.58 + 0.2;
    const back = new THREE.Mesh(new THREE.BoxGeometry(W, 2.55, 0.06), M.walnutDark); back.position.set(0, 1.6, 0.03); back.receiveShadow = true; g.add(back);
    const cloth = new THREE.Mesh(new THREE.PlaneGeometry(W - 0.16, 2.4), std({ color: 0x3d1d22, roughness: 0.95 })); cloth.position.set(0, 1.6, 0.065); g.add(cloth);
    [-1, 1].forEach((s) => { const p = new THREE.Mesh(new THREE.BoxGeometry(0.08, 2.75, 0.4), M.walnut); p.position.set(s * (W / 2), 1.37, 0.2); p.castShadow = true; g.add(p); });
    for (let row = 0; row < ROWS; row++) {
      const y = 0.55 + row * 0.8;
      const ledge = new THREE.Mesh(new THREE.BoxGeometry(W - 0.1, 0.035, 0.24), M.walnut); ledge.position.set(0, y, 0.18); ledge.castShadow = true; g.add(ledge);
      const lip = new THREE.Mesh(new THREE.BoxGeometry(W - 0.1, 0.06, 0.02), M.gold); lip.position.set(0, y + 0.04, 0.3); g.add(lip);
      for (let col = 0; col < COLS; col++) slots.push({ g, ri, x: (col - (COLS - 1) / 2) * 0.58, y: y + 0.02 + CH / 2, z: 0.2 });
    }
    const crown = new THREE.Mesh(new THREE.BoxGeometry(W + 0.12, 0.08, 0.44), M.gold); crown.position.set(0, 2.9, 0.18); g.add(crown);
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 0.47), std({ roughness: 0.6, emissive: 0xffffff, emissiveIntensity: 0.18 }));
    sign.position.set(0, 3.25, 0.05); g.add(sign); signs.push(sign);
    // 通れない範囲（棚の前 0.45m）
    const x0 = r.x - W / 2 - 0.05, x1 = r.x + W / 2 + 0.05;
    colliders.push(r.ry === 0 ? { x0, x1, z0: r.z - 0.1, z1: r.z + 0.45 } : { x0, x1, z0: r.z - 0.45, z1: r.z + 0.1 });
  });
  // 中央の垂れ幕（今週の特集・期間）。タップすると別の特集に替わる
  const banner = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 0.7), std({ roughness: 0.7, emissive: 0xffffff, emissiveIntensity: 0.22, side: THREE.DoubleSide }));
  banner.position.set(0, 4.55, -26.2); root.add(banner);
  [-1.75, 1.75].forEach((x) => { const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 1.25, 6), M.iron || M.gold); rod.position.set(x, 5.5, -26.2); root.add(rod); });
  const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 3.8, 8), M.gold); bar.rotation.z = Math.PI / 2; bar.position.set(0, 4.92, -26.2); root.add(bar);

  // ---- 本を並べる
  const coverGeo = new THREE.PlaneGeometry(CW, CH);
  let state = { key: '', count: -1 };
  let wk = weekInfo();
  const offset = () => { try { const o = JSON.parse(localStorage.getItem(OFFSET_KEY) || 'null'); return o && o.week === wk.week ? o.n : 0; } catch (e) { return 0; } };
  function build() {
    const rows = meter.find({});
    wk = weekInfo();
    const off = offset();
    const key = wk.week + ':' + off + ':' + rows.length;
    if (key === state.key) return;
    state = { key, count: rows.length };
    covers.splice(0).forEach((c) => { c.parent.remove(c); if (c.material.map) c.material.map.dispose(); c.material.dispose(); });
    const plans = rows.length ? planWeek(rows, wk, off) : [];
    banner.material.map = signTex('今週の特集　' + wk.label, plans.length ? 'タップで別の特集に替わります' : '読書メーターの本を取り込むと並びます', 1400, 270);
    banner.material.emissiveMap = banner.material.map; banner.material.needsUpdate = true;
    RACKS.forEach((r, ri) => {
      const p = plans[ri];
      signs[ri].material.map = signTex(p ? p.title : '準備中', p ? p.sub : ''); signs[ri].material.emissiveMap = signs[ri].material.map; signs[ri].material.needsUpdate = true;
      if (!p) return;
      const mine = slots.filter((s) => s.ri === ri);
      p.books.forEach((b, i) => {
        const s = mine[i]; if (!s) return;
        // まず仮の表紙を出し、本物の表紙が読み込めたら差し替える
        const mat = std({ roughness: 0.55, map: blankCover(b.item.title, b.item.author, i + ri * 7) });
        if (b.item.cover) loader.load('/api/img?u=' + encodeURIComponent(b.item.cover), (t) => { t.anisotropy = 4; if (mat.map) mat.map.dispose(); mat.map = t; mat.needsUpdate = true; });
        const m = new THREE.Mesh(coverGeo, mat);
        m.position.set(s.x, s.y, s.z); m.rotation.x = -0.12; m.castShadow = true;
        m.userData.book = b.item; m.userData.plan = p;
        s.g.add(m); covers.push(m);
      });
    });
  }
  let t0 = 0;
  function update(dt, time) {
    t0 -= dt;
    if (t0 > 0) return;
    t0 = 5; // 5秒ごとに、本の数や週が変わっていないか確かめる
    const n = meter.find({}).length;
    if (n !== state.count || weekInfo().week !== wk.week) build();
  }
  const ray = new THREE.Raycaster(); ray.far = 7;
  const center = new THREE.Vector2(0, 0);
  function hit(ndc, camera) {
    ray.setFromCamera(ndc || center, camera);
    return ray.intersectObjects(covers.concat([banner]), false)[0] || null;
  }
  function hint(camera) {
    const h = hit(null, camera);
    if (!h) return null;
    if (h.object === banner) return ['今週の特集', '　タップすると別の特集に替わります'];
    const b = h.object.userData.book, p = h.object.userData.plan;
    return ['『' + String(b.title).split(/[－―(（]/)[0] + '』', '　' + p.title + '　タップで紹介'];
  }
  function pick(ndc, camera) {
    const h = hit(ndc, camera);
    if (!h) return false;
    if (h.object === banner) {
      const n = offset() + 1;
      try { localStorage.setItem(OFFSET_KEY, JSON.stringify({ week: wk.week, n })); } catch (e) { /* 保存できなくても替える */ }
      state.key = ''; build();
      return true;
    }
    if (meter.show) meter.show(h.object.userData.book);
    return true;
  }
  setTimeout(build, 1500);
  return { update, hint, pick, rebuild: () => { state.key = ''; build(); }, get covers() { return covers; } };
}
