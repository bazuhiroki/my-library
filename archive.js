// 論文の間と雑誌の回廊：Notion「論文」「雑誌」の中身を棚に並べ、登録・管理する
import * as THREE from 'three';
import { patchSpineMaterial } from './spines.js';

const PASS = 'my-library:passcode';
const LOCAL = 'my-library:archive-local:v1';
const KINDS = { paper: '論文', magazine: '雑誌' };
const FIELDS = ['AI/技術', '経営/経済', '社会科学', '自然科学', '人文', 'その他'];
const FIELD_COLOR = { 'AI/技術': 0x243a66, '経営/経済': 0x2f5a3a, '社会科学': 0x6a4326, '自然科学': 0x1f5a5e, '人文': 0x4f2f63, 'その他': 0x6b2230, '': 0x5a1e24 };
const STATUS = ['未読', '読書中', '読了'];
const MINCHO = `'Shippori Mincho B1', 'Hiragino Mincho ProN', serif`;
const hash = (s) => { let h = 0; for (const c of String(s)) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h; };
const loadLocal = () => { try { return JSON.parse(localStorage.getItem(LOCAL) || '{}') || {}; } catch (e) { return {}; } };
const saveLocal = (v) => { try { localStorage.setItem(LOCAL, JSON.stringify(v)); } catch (e) { /* 保存できなくても続ける */ } };
const stars = (n) => '★★★★★'.slice(0, n) + '☆☆☆☆☆'.slice(0, 5 - n);
const today = () => new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);

export function createArchive({ scene, atlas, world, toast, warp }) {
  const data = { paper: [], magazine: [] };
  let mode = 'local';

  // ================= データ（Notion、つながらなければこの端末） =================
  async function call(method, kind, body, q) {
    for (let attempt = 0; attempt < 2; attempt++) {
      const r = await fetch('/api/items?kind=' + kind + (q || ''), { method, headers: { 'Content-Type': 'application/json', 'x-app-key': localStorage.getItem(PASS) || '' }, body: body ? JSON.stringify(body) : undefined });
      if (r.status === 401) { const p = window.prompt('合言葉を入れてね（Vercel の APP_PASSCODE）'); if (!p) throw new Error('passcode'); localStorage.setItem(PASS, p); continue; }
      if (!r.ok) throw new Error(String(r.status));
      return r.json();
    }
    throw new Error('passcode');
  }
  function persistLocal() {
    const v = {};
    Object.keys(KINDS).forEach((k) => { v[k] = data[k].filter((i) => i.pending || mode === 'local'); });
    saveLocal(v);
  }
  async function refresh() {
    const loc = loadLocal();
    let ok = true;
    for (const k of Object.keys(KINDS)) {
      try {
        const d = await call('GET', k);
        const pend = (loc[k] || []).filter((p) => p.pending && !d.items.some((i) => i.url && i.url === p.url));
        data[k] = d.items.concat(pend);
      } catch (e) { ok = false; data[k] = loc[k] || []; }
    }
    mode = ok ? 'notion' : 'local';
    rebuild();
    render();
    if (ok) sync();
  }
  // Notion に送る中身（端末だけで使う値は外し、アップロードした画像は image として送る）
  function payload(item) {
    const { id, pending, kind, localImage, uploaded, coverUrl, ...b } = item;
    if (String(b.cover || '').startsWith('data:')) b.cover = coverUrl || '';
    if (localImage) b.image = { name: 'cover.jpg', type: 'image/jpeg', data: localImage.split(',')[1] };
    return b;
  }
  function settle(item, saved) {
    Object.assign(item, saved, { pending: false });
    delete item.localImage;
  }
  async function sync() {
    let changed = false;
    for (const k of Object.keys(KINDS)) {
      for (const p of data[k].filter((i) => i.pending)) {
        try { const d = await call('POST', k, payload(p)); settle(p, d.item); changed = true; } catch (e) { /* 次の機会に */ }
      }
    }
    if (changed) { persistLocal(); rebuild(); render(); }
  }
  async function add(kind, fields) {
    const dupe = fields.url && data[kind].find((i) => i.url === fields.url);
    if (dupe) return { item: dupe, duplicate: true };
    const draft = Object.assign({ id: 'local-' + Date.now(), kind, status: '未読', rating: 0, note: '', created: new Date().toISOString(), pending: true }, fields);
    if (draft.localImage) { draft.coverUrl = fields.cover || ''; draft.cover = draft.localImage; }
    data[kind].unshift(draft);
    rebuild(); render();
    if (mode === 'notion') {
      try { const d = await call('POST', kind, payload(draft)); settle(draft, d.item); rebuild(); render(); return { item: draft, saved: 'notion' }; } catch (e) { /* 端末に残す */ }
    }
    persistLocal();
    return { item: draft, saved: 'local' };
  }
  const timers = {};
  function update(item, fields, lazy) {
    Object.assign(item, fields);
    if (fields.status === '読了' && !item.finished) item.finished = today();
    if (item.pending || mode === 'local') { persistLocal(); return; }
    const send = () => call('PATCH', item.kind, Object.assign({ id: item.id }, fields, fields.status === '読了' ? { finished: item.finished } : {})).catch(() => {});
    if (lazy) { clearTimeout(timers[item.id]); timers[item.id] = setTimeout(send, 700); } else send();
  }
  async function remove(item) {
    const k = item.kind;
    data[k] = data[k].filter((i) => i !== item);
    rebuild(); render();
    if (item.pending || mode === 'local') { persistLocal(); return; }
    try { await call('DELETE', k, null, '&id=' + encodeURIComponent(item.id)); } catch (e) { /* 次に開いたときに残っていれば、もう一度 */ }
  }

  // ================= 論文：綴じ本と文書箱 =================
  const MAXP = 360;
  const MAXB = 1400;
  const unit = new THREE.BoxGeometry(1, 1, 1);
  const paperGeo = unit.clone();
  const paperMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.72 });
  const papers = new THREE.InstancedMesh(paperGeo, paperMat, MAXP);
  papers.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  papers.setColorAt(0, new THREE.Color(1, 1, 1));
  const atlasAttr = new THREE.InstancedBufferAttribute(new Float32Array(MAXP * 4), 4);
  const signAttr = new THREE.InstancedBufferAttribute(new Float32Array(MAXP).fill(1), 1);
  paperGeo.setAttribute('atlasRect', atlasAttr);
  paperGeo.setAttribute('spineSign', signAttr);
  patchSpineMaterial(paperMat, atlas.tex);
  papers.castShadow = true; papers.receiveShadow = true;
  papers.count = 0;
  scene.add(papers);
  const boxMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9 });
  const boxes = new THREE.InstancedMesh(unit, boxMat, MAXB);
  boxes.setColorAt(0, new THREE.Color(1, 1, 1));
  boxes.receiveShadow = true;
  scene.add(boxes);
  const labels = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshStandardMaterial({ color: 0xe9e0c8, roughness: 0.8 }), MAXB);
  scene.add(labels);
  const cells = new Map();
  const paperAt = [];
  const d = new THREE.Object3D();
  const col = new THREE.Color();
  const TIER_ORDER = [3, 2, 4, 1, 5, 0, 6];

  function layoutPapers() {
    const shelves = world.paperShelves;
    const byBay = [1, 2, 3].map((b) => shelves.filter((s) => s.bay === b));
    const order = [];
    byBay.forEach((tiers) => TIER_ORDER.forEach((t) => { if (tiers[t]) order.push(tiers[t]); }));
    const list = data.paper.slice().sort((a, b) => String(b.created || '').localeCompare(String(a.created || ''))).slice(0, MAXP);
    let si = 0;
    let cur = order[0] ? order[0].x0 : 0;
    let n = 0;
    paperAt.length = 0;
    const used = new Map();
    for (const it of list) {
      const h = hash(it.id + it.title);
      const t = 0.03 + (h % 5) * 0.006;
      const ht = 0.3 + (h % 3) * 0.016;
      while (order[si] && cur + t > order[si].x1) { used.set(order[si], cur); si++; cur = order[si] ? order[si].x0 : 0; }
      const sh = order[si];
      if (!sh) break;
      d.position.set(cur + t / 2, sh.y + ht / 2, sh.z);
      d.rotation.set(0, -Math.PI / 2, 0);
      d.scale.set(0.235, ht, t);
      d.updateMatrix();
      papers.setMatrixAt(n, d.matrix);
      col.setHex(FIELD_COLOR[it.field || ''] || FIELD_COLOR['']);
      if (it.status === '読了') col.offsetHSL(0, -0.05, 0.08);
      papers.setColorAt(n, col);
      let c = cells.get(it.id);
      if (c === undefined || cells.get(it.id + ':t') !== it.title) { c = atlas.add(it.title); cells.set(it.id, c); cells.set(it.id + ':t', it.title); }
      if (c >= 0) atlasAttr.array.set(atlas.rect(c), n * 4); else atlasAttr.array.fill(0, n * 4, n * 4 + 4);
      paperAt.push({ item: it, x: cur + t / 2, y: sh.y + ht / 2, z: sh.z, bay: sh.bay, tier: sh.tier });
      cur += t + 0.004;
      n++;
    }
    if (order[si]) used.set(order[si], cur);
    papers.count = n;
    papers.instanceMatrix.needsUpdate = true;
    if (papers.instanceColor) papers.instanceColor.needsUpdate = true;
    atlasAttr.needsUpdate = true;
    atlas.flush();
    // 残りの場所は文書箱で埋める
    let b = 0;
    shelves.forEach((sh) => {
      let x = used.has(sh) ? used.get(sh) + 0.02 : sh.x0;
      if (order.indexOf(sh) > si) x = sh.x0;
      if (order.indexOf(sh) < si) return;
      while (x + 0.13 <= sh.x1 && b < MAXB) {
        const hh = hash(sh.bay * 100 + sh.tier * 10 + b);
        d.position.set(x + 0.065, sh.y + 0.15, sh.z); d.rotation.set(0, 0, 0); d.scale.set(0.125, 0.3, 0.26); d.updateMatrix();
        boxes.setMatrixAt(b, d.matrix);
        col.setHSL(0.09 + (hh % 7) * 0.01, 0.18 + (hh % 3) * 0.05, 0.28 + (hh % 5) * 0.025);
        boxes.setColorAt(b, col);
        d.position.set(x + 0.065, sh.y + 0.2, sh.z + 0.131); d.scale.set(0.08, 0.06, 1); d.updateMatrix();
        labels.setMatrixAt(b, d.matrix);
        x += 0.133; b++;
      }
    });
    boxes.count = b; labels.count = b;
    boxes.instanceMatrix.needsUpdate = true; labels.instanceMatrix.needsUpdate = true;
    if (boxes.instanceColor) boxes.instanceColor.needsUpdate = true;
  }

  // ================= 雑誌：表紙を見せて飾る =================
  const magGroup = new THREE.Group();
  scene.add(magGroup);
  const magAt = [];
  const coverCache = new Map();
  const LEDGE_ORDER = [2, 3, 1, 4];
  const groupKey = (i) => (i.magazine || i.title || '').trim() || '(無題)';
  function magGroups() {
    const map = new Map();
    data.magazine.forEach((i) => { const k = groupKey(i); if (!map.has(k)) map.set(k, []); map.get(k).push(i); });
    const out = [];
    map.forEach((items, name) => {
      items.sort((a, b) => String(b.date || b.created || '').localeCompare(String(a.date || a.created || '')));
      out.push({ name, items, latest: items[0] });
    });
    out.sort((a, b) => String(b.latest.date || b.latest.created || '').localeCompare(String(a.latest.date || a.latest.created || '')));
    return out;
  }
  function wrap(g, text, x, y, maxW, lh, maxLines) {
    let line = '';
    let n = 0;
    for (const ch of Array.from(text)) {
      if (g.measureText(line + ch).width > maxW && line) { g.fillText(line, x, y + n * lh); n++; line = ch; if (n >= maxLines) return; } else line += ch;
    }
    if (line && n < maxLines) g.fillText(n === maxLines - 1 && line.length > 1 ? line : line, x, y + n * lh);
  }
  function coverTexture(it, size) {
    const grp = { name: groupKey(it) };
    const key = it.id + '|' + grp.name + '|' + (it.title || '') + '|' + (it.date || '') + '|' + (it.cover || '') + '|' + size;
    if (coverCache.has(key)) return coverCache.get(key);
    const c = document.createElement('canvas');
    c.width = size; c.height = size;
    const g = c.getContext('2d');
    g.scale(size / 256, size / 340);
    const hue = hash(grp.name) % 360;
    const tex = new THREE.CanvasTexture(c);
    tex.anisotropy = 8;
    tex.minFilter = THREE.LinearMipmapLinearFilter;
    const paint = (img) => {
      g.fillStyle = 'hsl(' + hue + ' 35% 88%)'; g.fillRect(0, 0, 256, 340);
      // 画像があれば、表紙そのものを板いっぱいに（ラベルは付けない）
      if (img) {
        const ar = img.naturalWidth / img.naturalHeight;
        let sw = img.naturalWidth, shh = img.naturalHeight, sx0 = 0, sy0 = 0;
        if (ar > 256 / 340) { sw = shh * 256 / 340; sx0 = (img.naturalWidth - sw) / 2; } else { shh = sw * 340 / 256; sy0 = (img.naturalHeight - shh) / 2; }
        if (ar > 0.95) {
          // 横長の画像は、ぼかした背景の上に全体が見えるように置く
          g.globalAlpha = 0.55; g.drawImage(img, sx0, sy0, sw, shh, 0, 0, 256, 340); g.globalAlpha = 1;
          g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(0, 0, 256, 340);
          const h2 = 256 / ar;
          g.drawImage(img, 0, (340 - h2) / 2, 256, h2);
        } else g.drawImage(img, sx0, sy0, sw, shh, 0, 0, 256, 340);
        tex.needsUpdate = true;
        return;
      }
      g.fillStyle = 'hsl(' + hue + ' 40% 45%)'; g.fillRect(0, 64, 256, 250);
      g.fillStyle = 'rgba(255,255,255,.15)';
      for (let k = 0; k < 6; k++) { g.beginPath(); g.arc(40 + k * 40, 150 + (k % 2) * 60, 30 + (k % 3) * 12, 0, Math.PI * 2); g.fill(); }
      g.fillStyle = 'hsl(' + hue + ' 55% 30%)'; g.fillRect(0, 0, 256, 64);
      g.fillStyle = '#fff'; g.textAlign = 'center'; g.textBaseline = 'middle';
      let fs = 40; g.font = '900 ' + fs + 'px ' + MINCHO;
      while (g.measureText(grp.name).width > 236 && fs > 16) { fs -= 2; g.font = '900 ' + fs + 'px ' + MINCHO; }
      g.fillText(grp.name, 128, 34);
      g.fillStyle = 'rgba(0,0,0,.55)'; g.fillRect(0, 250, 256, 90);
      g.fillStyle = '#fff'; g.textAlign = 'left'; g.textBaseline = 'top'; g.font = '700 17px ' + MINCHO;
      if (it.title && it.title !== grp.name) wrap(g, it.title, 12, 258, 232, 22, 3);
      g.font = '600 12px sans-serif'; g.textAlign = 'right'; g.textBaseline = 'bottom';
      g.fillText(String(it.date || '').slice(0, 10), 248, 334);
      tex.needsUpdate = true;
    };
    paint(null);
    if (it.cover) {
      const img = new Image();
      img.onload = () => paint(img);
      img.src = String(it.cover).startsWith('data:') ? it.cover : '/api/img?u=' + encodeURIComponent(it.cover);
    }
    coverCache.set(key, tex);
    return tex;
  }
  function layoutMagazines() {
    magGroup.children.slice().forEach((m) => { magGroup.remove(m); if (m.geometry) m.geometry.dispose(); if (m.material && m.material.dispose) m.material.dispose(); });
    magAt.length = 0;
    // 棚の段ごとに幅を求めて、大きな表紙（0.40×0.52）を並べ直す
    const rows = new Map();
    world.magSlots.forEach((s) => { const k = s.rack + ':' + s.ledge; if (!rows.has(k)) rows.set(k, []); rows.get(k).push(s); });
    const slots = [];
    rows.forEach((xs) => {
      xs.sort((a, b) => a.x - b.x);
      const step = xs.length > 1 ? xs[1].x - xs[0].x : 1;
      const x0 = xs[0].x - step / 2, w = step * xs.length;
      const m = Math.max(1, Math.floor(w / 0.6));
      for (let k = 0; k < m; k++) slots.push({ x: x0 + (k + 0.5) * (w / m), y: xs[0].y, z: xs[0].z, rack: xs[0].rack, ledge: xs[0].ledge });
    });
    slots.sort((a, b) => (a.rack - b.rack) || (LEDGE_ORDER.indexOf(a.ledge) - LEDGE_ORDER.indexOf(b.ledge)) || (a.x - b.x));
    const issues = [];
    magGroups().forEach((grp) => grp.items.forEach((it) => issues.push({ grp, it })));
    const size = issues.length <= 40 ? 1024 : 512;
    issues.slice(0, slots.length).forEach(({ grp, it }, i) => {
      const s = slots[i];
      const mat = new THREE.MeshStandardMaterial({ map: coverTexture(it, size), roughness: 0.45 });
      const m = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 0.52), mat);
      m.position.set(s.x, s.y + 0.1, s.z + 0.03);
      m.rotation.x = -0.22;
      m.userData.grp = grp;
      m.userData.item = it;
      magGroup.add(m);
      magAt.push({ grp, item: it, x: s.x, y: s.y, z: s.z, rack: s.rack, ledge: s.ledge });
    });
  }
  function rebuild() { layoutPapers(); layoutMagazines(); updateChip(); }

  // ================= 見る・選ぶ =================
  const ray = new THREE.Raycaster();
  ray.far = 3.8;
  const center = new THREE.Vector2(0, 0);
  function hitAt(ndc, camera) {
    ray.setFromCamera(ndc, camera);
    const hs = ray.intersectObjects([papers, ...magGroup.children], false);
    for (const h of hs) {
      if (h.object === papers && h.instanceId !== undefined && paperAt[h.instanceId]) return { kind: 'paper', item: paperAt[h.instanceId].item };
      if (h.object.userData.item) return { kind: 'magazine', grp: h.object.userData.grp, item: h.object.userData.item };
    }
    return null;
  }
  function hint(camera) {
    const h = hitAt(center, camera);
    if (!h) return null;
    if (h.kind === 'paper') return ['『' + h.item.title + '』', '　' + [h.item.authors ? h.item.authors.split(',')[0] + (h.item.authors.includes(',') ? ' ほか' : '') : '', h.item.year || ''].filter(Boolean).join('・')];
    return ['『' + h.grp.name + '』', '　' + (h.item.title && h.item.title !== h.grp.name ? h.item.title : '') + (h.item.date ? '　' + String(h.item.date).slice(0, 10) : '')];
  }
  function pick(ndc, camera) {
    const h = hitAt(ndc, camera);
    if (!h) return false;
    open(h.item);
    return true;
  }
  function placeOf(item) {
    if (item.kind === 'paper') { const p = paperAt.find((x) => x.item === item); return p ? { ...p, label: '論文の間・第' + p.bay + '書架・上から' + (8 - p.tier) + '段目' } : null; }
    const m = magAt.find((x) => x.item === item);
    return m ? { ...m, label: '雑誌の回廊・' + m.rack + '番目の棚・' + m.ledge + '段目' } : null;
  }
  function goTo(item) {
    const p = placeOf(item);
    if (!p) { toast('まだ棚に並んでいません'); return; }
    close();
    warp({ x: Math.max(-29.3, Math.min(29.3, p.x)), z: p.z + 1.75, yaw: 0, pitch: Math.atan2(p.y - 1.62, 1.75) });
  }

  // ================= 画面：登録と管理 =================
  const el = document.createElement('section');
  el.id = 'arc';
  el.setAttribute('role', 'dialog');
  el.setAttribute('aria-labelledby', 'arcTitle');
  el.innerHTML = `<div class='card'>
    <div class='chead'><h2 id='arcTitle'>論文と雑誌</h2><button id='arcClose' type='button'>閉じる</button></div>
    <div class='a-tabs' id='arcTabs' role='tablist'></div>
    <div class='a-add'><input id='arcIn' inputmode='url' autocomplete='off'><button id='arcGo' type='button'>調べる</button></div>
    <div class='a-form' id='arcForm'></div>
    <div class='a-find'><input id='arcFind' autocomplete='off' placeholder='この中を探す（題名・著者・雑誌名）'></div>
    <p class='a-note' id='arcNote'></p>
    <ul class='a-list' id='arcList'></ul>
  </div>`;
  document.body.append(el);
  const $ = (id) => document.getElementById(id);
  const ui = { tab: 'paper', open: null, limit: 40, form: null, edit: null };
  const h = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = text; return e; };
  const btn = (label, fn, cls, on) => { const b = h('button', cls || '', label); b.type = 'button'; if (on !== undefined) b.setAttribute('aria-pressed', on ? 'true' : 'false'); b.addEventListener('click', fn); return b; };
  const linkBtn = (label, url) => { const a = h('a', 'a-link', label); a.href = url; a.target = '_blank'; a.rel = 'noopener'; return a; };

  function renderTabs() {
    const box = $('arcTabs');
    box.innerHTML = '';
    Object.keys(KINDS).forEach((k) => box.append(btn(KINDS[k] + ' ' + data[k].length, () => { ui.tab = k; ui.open = null; ui.form = null; ui.edit = null; ui.limit = 40; render(); }, '', ui.tab === k)));
    $('arcIn').placeholder = ui.tab === 'paper' ? '論文のURL・DOI・PDFのURLを貼り付け' : '雑誌（号・記事）のURLを貼り付け';
  }
  function field(label, key, value, type, opts) {
    const w = h('label', 'a-f');
    w.append(h('span', '', label));
    let i;
    if (opts) {
      i = document.createElement('select');
      ['', ...opts].forEach((o) => { const op = document.createElement('option'); op.value = o; op.textContent = o || '（未分類）'; i.append(op); });
    } else { i = document.createElement('input'); i.type = type || 'text'; }
    i.value = value || '';
    i.dataset.key = key;
    w.append(i);
    return w;
  }
  // 入力欄のまとまり（登録と書き換えで共通）
  function fieldsGrid(k, f) {
    const grid = h('div', 'a-grid');
    if (k === 'paper') {
      grid.append(field('題名', 'title', f.title), field('著者', 'authors', f.authors), field('年', 'year', f.year || '', 'number'), field('掲載誌', 'journal', f.journal),
        field('URL', 'url', f.url, 'url'), field('PDFのURL', 'pdf', f.pdf, 'url'), field('DOI', 'doi', f.doi), field('分野', 'field', f.field, null, FIELDS));
    } else {
      grid.append(field('雑誌名', 'magazine', f.magazine), field('号・記事の題名', 'title', f.title), field('URL', 'url', f.url, 'url'), field('表紙の画像URL', 'cover', f.cover, 'url'), field('発行日', 'date', f.date, 'date'));
    }
    return grid;
  }
  function readGrid(grid) {
    const out = {};
    grid.querySelectorAll('[data-key]').forEach((i) => { out[i.dataset.key] = String(i.value || '').trim(); });
    if (out.year !== undefined) out.year = Number(out.year) || 0;
    return out;
  }
  // 画像を選んで、端末の中で小さくする（長い辺 900px の JPEG）
  function pickImage(done) {
    const inp = document.createElement('input');
    inp.type = 'file';
    inp.accept = 'image/*';
    inp.addEventListener('change', () => {
      const file = inp.files && inp.files[0];
      if (!file) return;
      const fr = new FileReader();
      fr.onload = () => {
        const img = new Image();
        img.onload = () => {
          const k = Math.min(1, 1400 / Math.max(img.naturalWidth, img.naturalHeight));
          const c = document.createElement('canvas');
          c.width = Math.max(1, Math.round(img.naturalWidth * k)); c.height = Math.max(1, Math.round(img.naturalHeight * k));
          c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
          done(c.toDataURL('image/jpeg', 0.85));
        };
        img.onerror = () => toast('この画像は読み込めませんでした');
        img.src = fr.result;
      };
      fr.readAsDataURL(file);
    });
    inp.click();
  }
  function zoom(src) {
    const z = h('div', 'a-zoom');
    const im = document.createElement('img');
    im.src = src; im.alt = '表紙';
    z.append(im, h('span', 'a-zoomx', 'タップで閉じる'));
    z.addEventListener('click', () => z.remove());
    document.body.append(z);
  }
  function imageBox(src, onPick, onClear, label, big) {
    const w = h('div', 'a-img' + (big ? ' big' : ''));
    if (src) {
      const im = document.createElement('img');
      im.src = String(src).startsWith('data:') ? src : '/api/img?u=' + encodeURIComponent(src);
      im.alt = '表紙';
      im.addEventListener('click', () => zoom(im.src));
      w.append(im);
    }
    else w.append(h('span', 'a-noimg', '表紙なし'));
    const col = h('div', 'a-imgacts');
    col.append(h('span', 'a-lbl', label || '表紙の画像'), btn('画像をアップロード', () => pickImage(onPick)));
    if (onClear) col.append(btn('アップロードした画像を外す', onClear));
    w.append(col);
    return w;
  }
  const ownImage = (it) => !!(it.uploaded || String(it.cover || '').startsWith('data:'));
  async function uploadCover(it, dataUrl) {
    if (!ownImage(it)) it.coverUrl = it.coverUrl || it.cover || '';
    it.cover = dataUrl;
    rebuild(); render();
    if (it.pending || mode === 'local') { it.localImage = dataUrl; persistLocal(); toast('表紙を差し替えました（この端末に保存）'); return; }
    try {
      await call('PATCH', 'magazine', { id: it.id, image: { name: 'cover.jpg', type: 'image/jpeg', data: dataUrl.split(',')[1] } });
      it.uploaded = true;
      toast('表紙を差し替えました（Notionにも保存）');
    } catch (e) { toast('アップロードできませんでした。もう一度試してね'); }
  }
  async function clearCover(it) {
    it.cover = it.coverUrl || '';
    it.uploaded = false;
    delete it.localImage;
    rebuild(); render();
    if (it.pending || mode === 'local') { persistLocal(); return; }
    try { await call('PATCH', 'magazine', { id: it.id, clearImage: true }); } catch (e) { /* 次に開いたときに残っていれば、もう一度 */ }
  }
  // 登録済みの論文・雑誌を書き換える
  function editForm(it) {
    const box = h('div', 'a-detail a-edit');
    const f = Object.assign({}, it, { cover: ownImage(it) ? (it.coverUrl || '') : it.cover });
    const grid = fieldsGrid(it.kind, f);
    box.append(grid);
    const acts = h('div', 'a-acts');
    acts.append(btn('書き換えを保存', () => {
      const out = readGrid(grid);
      if (!out.title && !(it.kind === 'magazine' && out.magazine)) { toast('題名を入れてね'); return; }
      const changes = {};
      Object.keys(out).forEach((k) => { const cur = k === 'cover' ? f.cover : it[k]; if (String(out[k] === undefined ? '' : out[k]) !== String(cur === undefined || cur === null ? '' : cur)) changes[k] = out[k]; });
      ui.edit = null;
      if (!Object.keys(changes).length) { render(); return; }
      const keep = it.cover;
      const own = ownImage(it);
      update(it, changes);
      if ('cover' in changes) { it.coverUrl = changes.cover; if (own) it.cover = keep; }
      rebuild(); render();
      toast('書き換えました');
    }, 'a-primary'), btn('やめる', () => { ui.edit = null; render(); }));
    box.append(acts);
    return box;
  }
  function renderForm() {
    const box = $('arcForm');
    box.innerHTML = '';
    if (!ui.form) return;
    const f = ui.form;
    if (f.loading) { box.append(h('p', 'a-wait', '調べています…')); return; }
    const k = f.kind;
    const grid = fieldsGrid(k, f);
    box.append(grid);
    if (k === 'magazine') {
      const keepInputs = () => { const cur = readGrid(grid); Object.assign(f, cur); };
      box.append(imageBox(f.localImage || '', (d) => { keepInputs(); f.localImage = d; renderForm(); }, f.localImage ? () => { keepInputs(); delete f.localImage; renderForm(); } : null, 'この端末の画像を表紙にする'));
    }
    if (f.note) box.append(h('p', 'a-warn', f.note));
    const acts = h('div', 'a-acts');
    acts.append(btn(k === 'paper' ? '論文の間に並べる' : '雑誌の回廊に飾る', async () => {
      const out = readGrid(grid);
      if (k === 'magazine' && f.localImage) out.localImage = f.localImage;
      if (!out.title && !(k === 'magazine' && out.magazine)) { toast('題名を入れてね'); return; }
      const r = await add(k, out);
      ui.form = null;
      $('arcIn').value = '';
      if (r.duplicate) toast('もう登録されています');
      else { const p = placeOf(r.item); toast((p ? p.label + 'に並べました' : '登録しました') + (r.saved === 'local' ? '（この端末に保存）' : '')); ui.open = r.item.id; }
      render();
    }, 'a-primary'), btn('やめる', () => { ui.form = null; render(); }));
    box.append(acts);
  }
  async function lookup() {
    const q = $('arcIn').value.trim();
    const k = ui.tab;
    if (!q) { ui.form = { kind: k }; render(); return; }
    ui.form = { kind: k, loading: true }; renderForm();
    let m = null;
    try { const r = await fetch('/api/meta?kind=' + k + '&q=' + encodeURIComponent(q)); m = await r.json(); } catch (e) { m = null; }
    const base = q.startsWith('http') ? { url: q } : {};
    ui.form = Object.assign({ kind: k }, base, m || {}, { note: m && (m.title || m.magazine) ? '' : '自動では読み取れませんでした。分かるところだけ入れてね' });
    if (k === 'paper' && ui.form.url && ui.form.url.toLowerCase().split('?')[0].endsWith('.pdf') && !ui.form.pdf) ui.form.pdf = ui.form.url;
    render();
  }
  function detail(it) {
    if (ui.edit === it.id) return editForm(it);
    const box = h('div', 'a-detail');
    const links = h('div', 'a-acts');
    if (it.url) links.append(linkBtn('リンクを開く', it.url));
    if (it.pdf) links.append(linkBtn('PDFを開く', it.pdf));
    links.append(btn('棚へ行く', () => goTo(it)), btn('題名などを書き換える', () => { ui.edit = it.id; render(); }));
    box.append(links);
    if (it.kind === 'magazine') box.append(imageBox(it.cover, (d) => uploadCover(it, d), ownImage(it) ? () => clearCover(it) : null, '', true));
    const st = h('div', 'a-st');
    STATUS.forEach((s) => st.append(btn(s, () => { update(it, { status: s }); if (s === '読了') toast('読了にしました。おつかれさま！'); render(); }, '', it.status === s)));
    box.append(st);
    const rate = h('div', 'a-rate');
    rate.append(h('span', 'a-lbl', '評価'));
    for (let n = 1; n <= 5; n++) {
      const b = btn('★', () => { update(it, { rating: it.rating === n ? 0 : n }); render(); }, 'a-star' + (it.rating >= n ? ' on' : ''));
      b.setAttribute('aria-label', n + 'つ星');
      rate.append(b);
    }
    box.append(rate);
    if (it.kind === 'paper') {
      const sel = field('分野', 'field', it.field, null, FIELDS);
      sel.querySelector('select').addEventListener('change', (e) => { update(it, { field: e.target.value }); rebuild(); render(); });
      box.append(sel);
    }
    const ta = document.createElement('textarea');
    ta.className = 'a-ta'; ta.rows = 4; ta.maxLength = 1900;
    ta.placeholder = 'メモ・要点（Notionに保存されます）';
    ta.value = it.note || '';
    ta.addEventListener('input', () => update(it, { note: ta.value }, true));
    box.append(ta);
    const place = placeOf(it);
    if (place) box.append(h('p', 'a-place', place.label));
    box.append(btn('この' + KINDS[it.kind] + 'を外す', () => { if (window.confirm('『' + (it.title || it.magazine) + '』を外しますか？')) { remove(it); } }, 'a-danger'));
    return box;
  }
  function row(it) {
    const li = h('li', 'a-row' + (ui.open === it.id ? ' open' : ''));
    const head = btn('', () => { ui.open = ui.open === it.id ? null : it.id; ui.edit = null; render(); }, 'a-head');
    const sw = h('i', 'a-sw');
    sw.style.background = it.kind === 'paper' ? '#' + new THREE.Color(FIELD_COLOR[it.field || ''] || FIELD_COLOR['']).getHexString() : 'hsl(' + (hash(groupKey(it)) % 360) + ' 40% 45%)';
    const info = h('span', 'a-info');
    info.append(h('b', '', it.title || it.magazine || '(無題)'));
    const meta = it.kind === 'paper' ? [it.authors ? it.authors.split(',').slice(0, 2).join(',') + (it.authors.split(',').length > 2 ? ' ほか' : '') : '', it.year || '', it.journal].filter(Boolean).join('　') : [it.magazine, String(it.date || '').slice(0, 10)].filter(Boolean).join('　');
    info.append(h('span', 'a-meta', meta));
    const tags = h('span', 'a-tags');
    tags.append(h('em', 'a-s s' + STATUS.indexOf(it.status || '未読'), it.status || '未読'));
    if (it.rating) tags.append(h('em', 'a-r', stars(it.rating)));
    if (it.pending) tags.append(h('em', 'a-p', '未送信'));
    info.append(tags);
    head.append(sw, info, h('i', 'a-chev', ui.open === it.id ? '−' : '＋'));
    li.append(head);
    if (ui.open === it.id) li.append(detail(it));
    return li;
  }
  function render() {
    if (!el.classList.contains('open')) return;
    renderTabs();
    renderForm();
    $('arcNote').textContent = mode === 'notion' ? 'Notion「' + KINDS[ui.tab] + '」と同期中' : 'この端末に保存中（Notionにつながったら自動で送ります）';
    const ul = $('arcList');
    ul.innerHTML = '';
    const q = $('arcFind').value.trim().toLowerCase();
    let list = data[ui.tab].slice().sort((a, b) => String(b.created || '').localeCompare(String(a.created || '')));
    if (q) list = list.filter((i) => [i.title, i.authors, i.journal, i.magazine, i.note].join(' ').toLowerCase().includes(q));
    if (!list.length) { ul.append(h('li', 'a-empty', q ? '見つかりませんでした' : (ui.tab === 'paper' ? 'まだ論文がありません。上の欄に論文のURLやDOIを貼って「調べる」を押してね。' : 'まだ雑誌がありません。上の欄に雑誌の号や記事のURLを貼って「調べる」を押してね。'))); return; }
    list.slice(0, ui.limit).forEach((it) => ul.append(row(it)));
    if (list.length > ui.limit) { const li = h('li'); li.append(btn('もっと見る（残り ' + (list.length - ui.limit) + '件）', () => { ui.limit += 40; render(); }, 'a-more')); ul.append(li); }
    const o = ul.querySelector('.a-row.open');
    if (o && o.scrollIntoView && ui.scroll) { o.scrollIntoView({ block: 'center' }); ui.scroll = false; }
  }
  function open(item) {
    el.classList.add('open');
    ui.edit = null;
    if (item) { ui.tab = item.kind; ui.open = item.id; ui.form = null; ui.scroll = true; $('arcFind').value = ''; const at = data[item.kind].indexOf(item); if (at >= ui.limit) ui.limit = at + 20; }
    render();
  }
  function close() { el.classList.remove('open'); }
  $('arcClose').addEventListener('click', close);
  $('arcGo').addEventListener('click', lookup);
  $('arcIn').addEventListener('keydown', (e) => { if (e.key === 'Enter') lookup(); });
  $('arcFind').addEventListener('input', () => { ui.limit = 40; render(); });
  addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });

  // 画面の入口（読書記録のとなり）
  const chip = h('button', 'chip small', '');
  chip.id = 'arcChip';
  chip.type = 'button';
  chip.addEventListener('click', () => open());
  const anchor = document.getElementById('wishChip');
  if (anchor && anchor.parentNode) anchor.after(chip);
  function updateChip() { chip.textContent = '論文 ' + data.paper.length + '・雑誌 ' + data.magazine.length; chip.style.display = 'block'; }

  rebuild();
  refresh();
  return { open, close, pick, hint, refresh, get data() { return data; } };
}
