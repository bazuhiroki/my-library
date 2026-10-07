// 読書メーターの本棚（読みたい本・積読本・読んでる本・読んだ本）：取り込み・検索・Notion同期
// ジャンルとタグは Notion の AI エージェントが付ける。アプリは Notion から読み込んで表示し、
// まだ仕分けされていない本だけ、題名からの推測（仮）で並べておく。
import { RECS, isRead, inBag, toggleBag, bagList } from './books.js';
import { setAcq } from './counters.js';
import { fold } from './search.js';
import { GENRE_NAMES, OTHER, guessGenre, shortOf } from './genre.js';

const LISTS = [['wish', '読みたい本'], ['stacked', '積読本'], ['reading', '読んでる本'], ['read', '読んだ本']];
const SHELF_NAME = Object.fromEntries(LISTS);
const KEY = (l) => 'my-library:bookmeter:v1:' + l;
const COVERS = 'my-library:bookmeter:covers:v1';
const GKEY = 'my-library:bookmeter:genre:v1';
const PKEY = 'my-library:bookmeter:pages:v1';
const PULLED = 'my-library:bookmeter:pulled:v1';
const PASS = 'my-library:passcode';
const DAY = 24 * 3600 * 1000;
const RANK = { rule: 1, notion: 2, ai: 2, manual: 3 };
const ORDER = GENRE_NAMES.concat([OTHER]);
const load = (k, d) => { try { return JSON.parse(localStorage.getItem(k) || 'null') || d; } catch (e) { return d; } };
const save = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* 容量不足でも続ける */ } };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export function createMeter({ wishlist, toast }) {
  const data = {};
  LISTS.forEach(([l]) => { data[l] = load(KEY(l), { items: [], total: 0, at: 0 }); data[l].items.forEach((it) => { it.shelf = l; }); });
  const covers = load(COVERS, {});
  const gmap = load(GKEY, {}); // 本のID → { g: ジャンル, t: タグ, s: rule（仮の推測）|notion（Notionで仕分け済み）|manual（手で直した） }
  const pmap = load(PKEY, {}); // 本のID → Notion のページID
  const ui = { tab: 'wish', q: '', genre: '', lib: '', sort: 'default', group: false, limit: 60, busy: {}, job: null };

  // ================= 取り込み（読書メーターから1ページずつ） =================
  async function sync(list, force) {
    if (ui.busy[list]) return;
    const d = data[list];
    if (!force && d.at && Date.now() - d.at < DAY && d.items.length) return;
    ui.busy[list] = { done: 0, pages: 1 };
    render();
    try {
      const first = await (await fetch('/api/bookmeter?list=' + list + '&page=1')).json();
      if (first.error) throw new Error(first.error);
      if (!force && d.items.length && d.total === first.total && d.items[0] && first.items[0] && d.items[0].id === first.items[0].id) { d.at = Date.now(); save(KEY(list), d); return; }
      const items = first.items.slice();
      ui.busy[list] = { done: 1, pages: first.pages };
      render();
      for (let p = 2; p <= first.pages; p++) {
        await sleep(450);
        let j = null;
        for (let k = 0; k < 2 && !j; k++) { try { j = await (await fetch('/api/bookmeter?list=' + list + '&page=' + p)).json(); if (j.error) j = null; } catch (e) { j = null; } if (!j) await sleep(1500); }
        if (j) j.items.forEach((it) => { if (!items.some((x) => x.id === it.id)) items.push(it); });
        ui.busy[list] = { done: p, pages: first.pages };
        if (p % 3 === 0) { data[list] = { items: items.map((x) => Object.assign(x, { shelf: list })), total: first.total, at: 0 }; render(); }
      }
      items.forEach((x) => { x.shelf = list; });
      data[list] = { items, total: first.total, at: Date.now() };
      save(KEY(list), data[list]);
      toast('読書メーターの' + SHELF_NAME[list] + 'を取り込みました（' + items.length + '冊）');
    } catch (e) {
      toast('読書メーターを読み込めませんでした。少し時間をおいて試してね');
    } finally { delete ui.busy[list]; updateChip(); render(); }
  }

  // ================= 表紙（無い本は Google Books などで補う） =================
  const queue = [];
  let running = 0;
  function needCover(it, img) { if (it.cover || covers[it.id] !== undefined) return; queue.push({ it, img }); pump(); }
  async function pump() {
    while (running < 3 && queue.length) {
      const { it, img } = queue.shift();
      if (covers[it.id] !== undefined) { if (covers[it.id] && img) { img.src = covers[it.id]; img.classList.remove('none'); } continue; }
      running++;
      fetch('/api/bookinfo?title=' + encodeURIComponent(it.title) + '&author=' + encodeURIComponent((it.author || '').split(',')[0]))
        .then((r) => r.json()).then((j) => { covers[it.id] = (j && j.cover) || ''; })
        .catch(() => { covers[it.id] = ''; })
        .finally(() => { running--; save(COVERS, covers); if (covers[it.id] && img) { img.src = covers[it.id]; img.classList.remove('none'); } pump(); });
    }
  }
  const coverOf = (it) => it.cover || covers[it.id] || '';

  // ================= かばん（貸出・購入カウンターへ持っていく） =================
  const isbns = load('my-library:bookmeter:isbn:v1', {});
  const asBag = (it) => ({ ext: true, key: 'bm:' + it.id, bmId: it.id, t: it.title, a: it.author || '', isbn: isbns[it.id] || '', cover: coverOf(it), url: it.url, src: 'bookmeter' });
  const inBagBM = (kind, it) => inBag(kind, asBag(it));
  function bagChip() {
    const a = bagList('borrow').length, b = bagList('buy').length;
    const c = document.getElementById('bagChip');
    if (c) { c.textContent = a || b ? `かばん　借${a}・買${b}` : ''; c.style.display = a || b ? 'block' : 'none'; }
  }
  function toBag(kind, it, quiet) {
    const r = asBag(it);
    const added = toggleBag(kind, r);
    setAcq(r, added ? (kind === 'borrow' ? '借りる予定' : '買う予定') : '');
    bagChip();
    if (!quiet) toast(added ? (kind === 'borrow' ? '借りるかばんに入れました。貸出カウンターへどうぞ' : '買うかばんに入れました。購入カウンターへどうぞ') : 'かばんから出しました');
    return added;
  }
  function bulkBag(kind) {
    const base = ui.tab === 'all' ? allItems() : data[ui.tab].items;
    const rows = sorted(search(base, false).rows, true).map((x) => x.it).filter((it) => !inBagBM(kind, it)).slice(0, 20);
    if (!rows.length) { toast('入れる本がありません'); return; }
    if (!window.confirm('いま表示している本のうち' + rows.length + '冊を、' + (kind === 'borrow' ? '借りる' : '買う') + 'かばんに入れますか？')) return;
    rows.forEach((it) => toBag(kind, it, true));
    toast(rows.length + '冊をかばんに入れました');
    render();
  }

  // ================= ジャンル =================
  function genreOf(it) {
    let g = gmap[it.id];
    if (!g) { const r = guessGenre(it.title, it.author); g = gmap[it.id] = { g: r.genre, t: r.tags, s: 'rule' }; gsave(); }
    return g;
  }
  let gsaveT = 0;
  function gsave() { clearTimeout(gsaveT); gsaveT = setTimeout(() => save(GKEY, gmap), 600); }
  function setGenre(it, g, t, s) { gmap[it.id] = { g, t: t || (gmap[it.id] || {}).t || [], s }; it._f = null; gsave(); }

  // ================= 図書館・Notion との照らし合わせ =================
  const keyT = (t) => fold(String(t || '').split(/[－―:：(（]/)[0]).slice(0, 18);
  let libIndex = null;
  function libMark(it) {
    if (!libIndex) { libIndex = new Map(); RECS.forEach((r) => libIndex.set(keyT(r.t), r)); }
    const r = libIndex.get(keyT(it.title));
    if (!r) return '';
    return isRead(r) ? '図書館で読んだ' : r.fromLib ? '図書館で借りた' : '館内にある';
  }
  const inWish = (it) => (wishlist.items || []).some((w) => keyT(w.title) === keyT(it.title));

  // ================= 検索 =================
  const allItems = () => LISTS.flatMap(([l]) => data[l].items);
  function index(it) {
    if (it._f) return it._f;
    const g = genreOf(it);
    return (it._f = { t: fold(it.title), a: fold(it.author), g: fold(g.g + ' ' + shortOf(g.g)), tg: fold((g.t || []).join(' ')), main: fold(String(it.title).split(/[－―:：(（]/)[0]) });
  }
  // 「著者:福岡 ジャンル:経済 -マンガ 生命」のような書き方に対応する
  function parseQuery(q) {
    const P = { pos: [], neg: [], au: [], ge: [] };
    String(q || '').replace(/　/g, ' ').split(' ').filter(Boolean).forEach((tok) => {
      let m;
      if ((m = tok.match(/^(著者|著|author|a)[:：](.+)$/i))) P.au.push(fold(m[2]));
      else if ((m = tok.match(/^(ジャンル|genre|g)[:：](.+)$/i))) P.ge.push(fold(m[2]));
      else if (tok.length > 1 && /^[-−－]/.test(tok)) P.neg.push(fold(tok.slice(1)));
      else { const f = fold(tok); if (f) P.pos.push(f); }
    });
    return P;
  }
  const bigrams = (s) => { const set = new Set(); if (s.length === 1) set.add(s); for (let k = 0; k < s.length - 1; k++) set.add(s.slice(k, k + 2)); return set; };
  const dice = (a, b) => { if (!a.size || !b.size) return 0; let n = 0; for (const x of a) if (b.has(x)) n++; return (2 * n) / (a.size + b.size); };
  const contain = (q, t) => { if (!q.size || !t.size) return 0; let n = 0; for (const x of q) if (t.has(x)) n++; return n / q.size; };
  const unv = (s) => String(s).normalize('NFD').replace(/[\u3099\u309a]/g, ''); // 濁点・半濁点の打ち間違いを吸収する
  function wordScore(w, f) {
    let s = 0;
    if (f.main === w) s = 100; else if (f.t.startsWith(w)) s = 70; else if (f.t.includes(w)) s = 52;
    if (f.a === w) s = Math.max(s, 64); else if (f.a.startsWith(w)) s = Math.max(s, 46); else if (f.a.includes(w)) s = Math.max(s, 40);
    if (f.tg.includes(w)) s = Math.max(s, 30);
    if (f.g.includes(w)) s = Math.max(s, 26);
    return s;
  }
  const libOk = (it) => {
    if (!ui.lib) return true;
    const lib = !!libMark(it), notion = inWish(it);
    if (ui.lib === 'pending') return genreOf(it).s === 'rule';
    return ui.lib === 'lib' ? lib : ui.lib === 'notion' ? notion : (!lib && !notion);
  };
  // 条件に合う本を、関連度つきで返す（skipGenre のときはジャンルの絞り込みを外して数える）
  function search(base, skipGenre) {
    const P = parseQuery(ui.q);
    const hasQ = !!(P.pos.length || P.au.length || P.ge.length || P.neg.length);
    let out = [];
    for (const it of base) {
      if (!libOk(it)) continue;
      const f = index(it);
      if (!skipGenre && ui.genre && genreOf(it).g !== ui.genre) continue;
      if (P.au.some((a) => !f.a.includes(a))) continue;
      if (P.ge.some((g) => !f.g.includes(g) && !f.tg.includes(g))) continue;
      if (P.neg.some((n) => f.t.includes(n) || f.a.includes(n) || f.tg.includes(n))) continue;
      let s = 0, ok = true;
      for (const w of P.pos) { const v = wordScore(w, f); if (v <= 0) { ok = false; break; } s += v; }
      if (ok) out.push({ it, s });
    }
    let fuzzy = false;
    if (P.pos.length && out.length < 5) {
      const wq = P.pos.join('');
      if (wq.length >= 2) {
        const have = new Set(out.map((x) => x.it.id));
        const qb = bigrams(unv(wq));
        const extra = [];
        for (const it of base) {
          if (have.has(it.id) || !libOk(it)) continue;
          const f = index(it);
          if (!skipGenre && ui.genre && genreOf(it).g !== ui.genre) continue;
          if (P.au.some((a) => !f.a.includes(a)) || P.neg.some((n) => f.t.includes(n))) continue;
          const tb = bigrams(unv(f.main)), ab = bigrams(unv(f.a));
          const d = Math.max(dice(qb, tb), dice(qb, ab), wq.length >= 3 ? contain(qb, tb) * 0.85 : 0, wq.length >= 3 ? contain(qb, ab) * 0.85 : 0);
          if (d >= 0.45 && (d >= 0.6 || wq.length < 3)) extra.push({ it, s: d * 30, fuzzy: true });
        }
        extra.sort((a, b) => b.s - a.s);
        if (extra.length && !out.length) fuzzy = true;
        out = out.concat(extra.slice(0, 12));
      }
    }
    return { rows: out, hasQ, fuzzy };
  }
  function sorted(rows, hasQ) {
    const r = rows.slice();
    const byTitle = (a, b) => String(a.it.title).localeCompare(String(b.it.title), 'ja');
    switch (ui.sort) {
      case 'pop': r.sort((a, b) => (b.it.regs || 0) - (a.it.regs || 0) || byTitle(a, b)); break;
      case 'rare': r.sort((a, b) => (a.it.regs || 0) - (b.it.regs || 0) || byTitle(a, b)); break;
      case 'title': r.sort(byTitle); break;
      case 'author': r.sort((a, b) => String(a.it.author).localeCompare(String(b.it.author), 'ja') || byTitle(a, b)); break;
      default: if (hasQ) r.sort((a, b) => (b.s - a.s) || ((b.it.regs || 0) - (a.it.regs || 0)));
    }
    return r;
  }

  // ================= Notion への同期 =================
  async function api(url, opt) {
    for (let attempt = 0; attempt < 2; attempt++) {
      const o = Object.assign({}, opt);
      o.headers = Object.assign({ 'Content-Type': 'application/json', 'x-app-key': localStorage.getItem(PASS) || '' }, o.headers);
      const r = await fetch(url, o);
      if (r.status === 401) { const p = window.prompt('合言葉を入れてね（Vercel の APP_PASSCODE）'); if (!p) throw new Error('passcode'); localStorage.setItem(PASS, p); continue; }
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || String(r.status));
      return j;
    }
    throw new Error('passcode');
  }
  function job(name, done, total) { ui.job = name ? { name, done, total } : null; renderNote(); }
  // Notion にある本をすべて読み込み、ジャンル・タグ・ページIDを手元に反映する
  async function pullNotion(quiet) {
    const remote = new Map();
    let cur = '', n = 0;
    do {
      const j = await api('/api/meter-notion' + (cur ? '?cursor=' + encodeURIComponent(cur) : ''));
      j.records.forEach((r) => remote.set(String(r.id), r));
      cur = j.next || ''; n += j.records.length;
      if (!quiet) job('Notionから読み込み中', n, 0);
    } while (cur);
    const byId = new Map(allItems().map((x) => [String(x.id), x]));
    let applied = 0;
    remote.forEach((r, id) => {
      pmap[id] = r.pageId;
      if (!r.genre || r.src === 'rule') return; // 古い仮の判定は使わない
      const src = r.src === 'manual' ? 'manual' : 'notion';
      const it = byId.get(id);
      const cur = gmap[id];
      if (cur && cur.s === 'manual' && src !== 'manual') return; // アプリで直した分は、同期で Notion に送る
      if (!cur || cur.g !== r.genre || cur.s !== src || (r.tags || []).join() !== (cur.t || []).join()) {
        gmap[id] = { g: r.genre, t: r.tags || [], s: src }; applied++;
        if (it) it._f = null;
      }
    });
    save(GKEY, gmap); save(PKEY, pmap); save(PULLED, Date.now());
    return { remote, applied };
  }
  // 手元の本を Notion に送る（新しい本の追加・本棚の移動・表紙・アプリで直したジャンル）
  async function pushNotion() {
    if (ui.job) return;
    try {
      job('Notionから読み込み中', 0, 0);
      const { remote } = await pullNotion();
      const all = allItems();
      if (!all.length) { toast('先に読書メーターの本を取り込んでね'); return; }
      const manual = (it) => { const g = genreOf(it); return g.s === 'manual' ? { genre: g.g, tags: g.t || [], src: 'manual' } : {}; };
      const creates = all.filter((it) => !remote.has(String(it.id)));
      const updates = all.filter((it) => {
        const r = remote.get(String(it.id)); if (!r) return false;
        const g = genreOf(it);
        return r.shelf !== SHELF_NAME[it.shelf] || (!r.hasCover && coverOf(it)) || (g.s === 'manual' && (r.genre !== g.g || r.src !== 'manual'));
      });
      const total = creates.length + updates.length;
      let done = 0;
      for (let i = 0; i < creates.length; i += 8) {
        job('Notionに追加中', done, total);
        const chunk = creates.slice(i, i + 8).map((it) => Object.assign({ id: it.id, title: it.title, author: it.author, shelf: it.shelf, url: it.url, cover: coverOf(it), regs: it.regs, lib: libMark(it) }, manual(it)));
        const j = await api('/api/meter-notion', { method: 'POST', body: JSON.stringify({ items: chunk }) });
        (j.created || []).forEach((c) => { pmap[c.id] = c.pageId; });
        done += chunk.length; await sleep(250);
      }
      for (let i = 0; i < updates.length; i += 10) {
        job('Notionを更新中', done, total);
        const chunk = updates.slice(i, i + 10).map((it) => ({ pageId: remote.get(String(it.id)).pageId, fields: Object.assign({ shelf: it.shelf, cover: coverOf(it) || undefined, lib: libMark(it) }, manual(it)) }));
        await api('/api/meter-notion', { method: 'PATCH', body: JSON.stringify({ updates: chunk }) });
        done += chunk.length; await sleep(250);
      }
      save(PKEY, pmap);
      toast(total ? 'Notionに同期しました（追加' + creates.length + '・更新' + updates.length + '）。ジャンルはNotionのAIが仕分けたあと「Notionから反映」で表示されます' : 'Notionはすでに最新です');
    } catch (e) {
      toast(String(e.message) === 'passcode' ? '合言葉が違います' : 'Notionに同期できませんでした：' + String(e.message).slice(0, 60));
    } finally { job(null); render(); }
  }
  // Notion の AI が仕分けたジャンルを読み込む
  async function refreshGenres(quiet) {
    if (ui.job) return;
    try {
      if (!quiet) job('Notionから読み込み中', 0, 0);
      const { applied } = await pullNotion(quiet);
      if (!quiet) toast(applied ? 'Notionのジャンルを反映しました（' + applied + '冊）' : 'Notionのジャンルは反映済みです');
    } catch (e) {
      if (!quiet) toast('Notionから読み込めませんでした：' + String(e.message).slice(0, 60));
    } finally { job(null); render(); }
  }
  // アプリでジャンルを直したら、すぐ Notion にも送る（AI の判定より優先される）
  async function sendManual(it) {
    const pageId = pmap[String(it.id)];
    if (!pageId) return;
    const g = genreOf(it);
    try { await api('/api/meter-notion', { method: 'PATCH', body: JSON.stringify({ updates: [{ pageId, fields: { genre: g.g, tags: g.t || [], src: 'manual' } }] }) }); } catch (e) { /* 次の同期で送る */ }
  }

  // ================= 画面 =================
  const el = document.createElement('section');
  el.id = 'bm';
  el.setAttribute('role', 'dialog');
  el.setAttribute('aria-labelledby', 'bmTitle');
  el.innerHTML = `<div class='card'>
    <div class='chead'><h2 id='bmTitle'>読書メーターの本棚</h2><button id='bmClose' type='button'>閉じる</button></div>
    <div class='bm-tabs' id='bmTabs'></div>
    <div class='bm-bar'><input id='bmQ' autocomplete='off' placeholder='題名・著者・ジャンル（例：福岡 生命　著者:ドゥ　-マンガ）'><button id='bmClear' type='button' aria-label='消す'>×</button></div>
    <div class='bm-genres' id='bmGenres'></div>
    <div class='bm-ctl'>
      <label>並び<select id='bmSort'><option value='default'>おすすめ順</option><option value='pop'>登録者が多い順</option><option value='rare'>登録者が少ない順</option><option value='title'>題名順</option><option value='author'>著者順</option></select></label>
      <label>絞り込み<select id='bmLib'><option value=''>すべて</option><option value='lib'>図書館にある</option><option value='notion'>Notionに積んだ</option><option value='none'>どちらにもない</option><option value='pending'>Notionで未仕分け</option></select></label>
      <label class='bm-chk'><input id='bmGroup' type='checkbox'>ジャンル別に分ける</label>
    </div>
    <p class='bm-note' id='bmNote'></p>
    <div class='bm-grid' id='bmGrid'></div>
    <div id='bmMore'></div>
    <div class='bm-tools'><button id='bmSync' type='button'>読書メーターを最新にする</button><button id='bmNotion' type='button'>Notionに同期</button><button id='bmPull' type='button'>Notionのジャンルを反映</button><button id='bmBagB' type='button'>表示中の本を借りるかばんへ</button><button id='bmBagY' type='button'>表示中の本を買うかばんへ</button></div>
  </div>
  <div class='bm-detail' id='bmDetail'></div>`;
  document.body.append(el);
  document.body.append(el.querySelector('#bmDetail')); // 3Dの特集コーナーからも紹介を開けるよう、パネルの外に置く
  const $ = (id) => document.getElementById(id);
  const h = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt !== undefined) e.textContent = txt; return e; };

  const io = 'IntersectionObserver' in window ? new IntersectionObserver((ents) => ents.forEach((e) => { if (e.isIntersecting) { io.unobserve(e.target); needCover(e.target._it, e.target.querySelector('img')); } }), { rootMargin: '200px' }) : null;
  function tile(it, fuzzy) {
    const b = h('button', 'bm-tile');
    b.type = 'button';
    const img = document.createElement('img');
    img.loading = 'lazy'; img.alt = it.title;
    const c = coverOf(it);
    if (c) img.src = c; else img.className = 'none';
    img.onerror = () => { img.removeAttribute('src'); img.className = 'none'; };
    const gg = genreOf(it);
    b.append(img, h('span', 'bm-cap', it.title), h('span', 'bm-gn' + (gg.s === 'rule' ? ' tmp' : ''), shortOf(gg.g) + (gg.s === 'rule' ? '（仮）' : '')));
    const mark = fuzzy ? '近い' : (libMark(it) || (inWish(it) ? 'Notionにもある' : ''));
    if (mark) b.append(h('em', 'bm-mark', mark));
    const inB = inBagBM('borrow', it), inY = inBagBM('buy', it);
    if (inB || inY) b.append(h('em', 'bm-mark bag', inB && inY ? '借・買' : inB ? '借りる' : '買う'));
    b.addEventListener('click', () => detail(it));
    b._it = it;
    if (!c) { if (io) io.observe(b); else needCover(it, img); }
    return b;
  }
  function renderTabs() {
    const tabs = $('bmTabs'); tabs.innerHTML = '';
    const total = LISTS.reduce((n, [l]) => n + (data[l].total || data[l].items.length || 0), 0);
    const mk = (k, name, n) => {
      const b = h('button', '', name + (n ? ' ' + n : '')); b.type = 'button'; b.setAttribute('aria-pressed', ui.tab === k ? 'true' : 'false');
      b.addEventListener('click', () => { ui.tab = k; ui.genre = ''; ui.limit = 60; render(); if (k === 'all') LISTS.forEach(([l]) => sync(l)); else sync(k); });
      tabs.append(b);
    };
    mk('all', 'すべて', total);
    LISTS.forEach(([l, name]) => mk(l, name, data[l].total || data[l].items.length || ''));
  }
  function renderNote() {
    const note = $('bmNote'); if (!note) return;
    const busy = ui.tab === 'all' ? Object.values(ui.busy)[0] : ui.busy[ui.tab];
    if (ui.job) note.textContent = ui.job.name + (ui.job.total ? '… ' + ui.job.done + ' / ' + ui.job.total : ui.job.done ? '… ' + ui.job.done + '件' : '…');
    else if (busy) note.textContent = '読書メーターから読み込み中… ' + busy.done + ' / ' + busy.pages + 'ページ';
    else {
      const d = ui.tab === 'all' ? null : data[ui.tab];
      const base = d ? d.items : allItems();
      const sorted = base.filter((x) => genreOf(x).s !== 'rule').length;
      const head = d ? (d.at ? '読書メーターから取り込み（' + new Date(d.at).toLocaleString('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }) + '）' : 'まだ取り込んでいません') : '4つの本棚をまとめて表示';
      note.textContent = head + (base.length ? '　Notionで仕分け済み ' + sorted + ' / ' + base.length + '冊' : '');
    }
  }
  function render() {
    if (!el.classList.contains('open')) return;
    renderTabs();
    const base = ui.tab === 'all' ? allItems() : data[ui.tab].items;
    // ジャンルのチップ（件数つき）。ジャンルの絞り込み以外の条件で数える
    const counts = {};
    const pre = search(base, true);
    pre.rows.forEach((x) => { const g = genreOf(x.it).g; counts[g] = (counts[g] || 0) + 1; });
    const gw = $('bmGenres'); gw.innerHTML = '';
    const chip = (label, on, fn) => { const b = h('button', '', label); b.type = 'button'; b.setAttribute('aria-pressed', on ? 'true' : 'false'); b.addEventListener('click', fn); gw.append(b); };
    chip('すべて ' + pre.rows.length, !ui.genre, () => { ui.genre = ''; ui.limit = 60; render(); });
    ORDER.filter((g) => counts[g]).sort((a, b) => counts[b] - counts[a]).forEach((g) => chip(shortOf(g) + ' ' + counts[g], ui.genre === g, () => { ui.genre = ui.genre === g ? '' : g; ui.limit = 60; render(); }));
    $('bmSort').value = ui.sort; $('bmLib').value = ui.lib; $('bmGroup').checked = ui.group;
    renderNote();
    const grid = $('bmGrid'); grid.innerHTML = '';
    const res = search(base, false);
    const rows = sorted(res.rows, res.hasQ);
    const show = rows.slice(0, ui.limit);
    if (ui.group) {
      let last = null;
      show.slice().sort((a, b) => ORDER.indexOf(genreOf(a.it).g) - ORDER.indexOf(genreOf(b.it).g)).forEach((x) => {
        const g = genreOf(x.it).g;
        if (g !== last) { last = g; grid.append(h('h3', 'bm-gh', g + '　' + (counts[g] || ''))); }
        grid.append(tile(x.it, x.fuzzy));
      });
    } else show.forEach((x) => grid.append(tile(x.it, x.fuzzy)));
    if (!rows.length) grid.append(h('p', 'bm-empty', Object.keys(ui.busy).length ? '読み込み中です…' : (ui.q || ui.genre || ui.lib) ? '見つかりませんでした。条件をゆるめてみてね' : 'まだ本がありません'));
    else if (res.fuzzy) grid.prepend(h('p', 'bm-empty', 'もしかして：近い本が' + rows.length + '冊'));
    const more = $('bmMore'); more.innerHTML = '';
    if (rows.length > ui.limit) { const b = h('button', 'bm-more', 'もっと見る（残り ' + (rows.length - ui.limit) + '冊）'); b.type = 'button'; b.addEventListener('click', () => { ui.limit += 90; render(); }); more.append(b); }
    if (rows.length && res.hasQ) more.append(h('p', 'bm-hit', rows.length + '冊 見つかりました'));
  }

  // 1冊の詳しい紹介
  async function detail(it) {
    const box = $('bmDetail');
    box.innerHTML = '';
    box.classList.add('open');
    const card = h('div', 'bmd-card');
    const img = document.createElement('img'); img.alt = it.title; const c = coverOf(it); if (c) img.src = c; else img.className = 'none';
    const info = h('div', 'bmd-info');
    info.append(h('b', '', it.title));
    // 著者・タグをタップすると、その言葉で探せる
    const au = h('span', 'bmd-author');
    (it.author || '').split(',').filter(Boolean).forEach((a, i) => { if (i) au.append(document.createTextNode('、')); const l = h('a', 'bmd-link', a); l.href = '#'; l.addEventListener('click', (e) => { e.preventDefault(); searchFor('著者:' + a.replace(/\s/g, '')); }); au.append(l); });
    info.append(au);
    const g = genreOf(it);
    const gl = h('div', 'bmd-genre');
    const sel = document.createElement('select');
    ORDER.forEach((n) => { const o = document.createElement('option'); o.value = n; o.textContent = n; sel.append(o); });
    sel.value = g.g;
    sel.addEventListener('change', () => { setGenre(it, sel.value, g.t, 'manual'); sendManual(it); toast('ジャンルを「' + sel.value + '」にしました（Notionにも反映）'); render(); });
    gl.append(h('span', 'bmd-lbl', 'ジャンル'), sel, h('em', 'bmd-src', g.s === 'manual' ? '手で直した' : g.s === 'rule' ? '仮（NotionのAIの仕分け待ち）' : 'NotionのAIが仕分け'));
    info.append(gl);
    if ((g.t || []).length) { const tg = h('div', 'bmd-tags'); g.t.forEach((t) => { const b = h('button', '', '#' + t); b.type = 'button'; b.addEventListener('click', () => searchFor(t)); tg.append(b); }); info.append(tg); }
    const bagRow = h('div', 'bmd-bag');
    const bb = h('button', '', ''), by = h('button', '', '');
    bb.type = by.type = 'button';
    const paintBag = () => {
      const i1 = inBagBM('borrow', it), i2 = inBagBM('buy', it);
      bb.textContent = i1 ? '借りるかばんに入っています' : '借りるかばんへ'; bb.setAttribute('aria-pressed', i1 ? 'true' : 'false');
      by.textContent = i2 ? '買うかばんに入っています' : '買うかばんへ'; by.setAttribute('aria-pressed', i2 ? 'true' : 'false');
    };
    bb.addEventListener('click', () => { toBag('borrow', it); paintBag(); render(); });
    by.addEventListener('click', () => { toBag('buy', it); paintBag(); render(); });
    paintBag();
    bagRow.append(bb, by);
    info.append(bagRow);
    const desc = h('p', 'bmd-desc', '紹介を探しています…');
    info.append(desc);
    const acts = h('div', 'bmd-acts');
    const link = document.createElement('a'); link.href = it.url; link.target = '_blank'; link.rel = 'noopener'; link.textContent = '読書メーターで開く';
    acts.append(link);
    const add = h('button', '', inWish(it) ? 'Notionの読みたい本に登録済み' : 'Notionの読みたい本に追加');
    add.type = 'button'; add.disabled = inWish(it);
    acts.append(add);
    const close = h('button', 'bmd-close', '閉じる'); close.type = 'button'; close.addEventListener('click', () => box.classList.remove('open'));
    acts.append(close);
    info.append(acts);
    card.append(img, info);
    box.append(card);
    box.onclick = (e) => { if (e.target === box) box.classList.remove('open'); };
    let bi = null;
    try { bi = await (await fetch('/api/bookinfo?title=' + encodeURIComponent(it.title) + '&author=' + encodeURIComponent((it.author || '').split(',')[0]))).json(); } catch (e) { bi = null; }
    if (bi && !c && bi.cover) { img.src = bi.cover; img.className = ''; covers[it.id] = bi.cover; save(COVERS, covers); }
    if (bi && bi.isbn) { isbns[it.id] = bi.isbn; save('my-library:bookmeter:isbn:v1', isbns); }
    const meta = bi ? [bi.publisher, bi.published || bi.publishedDate, bi.pageCount ? bi.pageCount + 'ページ' : ''].filter(Boolean).join('　') : '';
    desc.textContent = bi && bi.description ? bi.description : '紹介文は見つかりませんでした。';
    if (meta) info.insertBefore(h('span', 'bmd-meta', meta), desc);
    add.onclick = async () => {
      add.disabled = true;
      const r = await wishlist.add({ isbn: (bi && bi.isbn) || '', title: it.title, authors: (it.author || '').split(',').filter(Boolean), publisher: (bi && bi.publisher) || '', cover: (bi && bi.cover) || it.cover || '', description: (bi && bi.description) || '' });
      add.textContent = r.duplicate ? 'Notionの読みたい本に登録済み' : 'Notionの読みたい本に追加しました';
      toast(r.duplicate ? 'もう登録されています' : '『' + it.title + '』を読みたい本の台に積みました');
      render();
    };
  }
  function searchFor(q) { $('bmDetail').classList.remove('open'); ui.q = q; ui.genre = ''; ui.limit = 60; $('bmQ').value = q; render(); const c = el.querySelector('.card'); if (c) c.scrollTop = 0; }

  function open(list) {
    if (list) ui.tab = list;
    el.classList.add('open');
    render();
    if (ui.tab === 'all') LISTS.forEach(([l]) => sync(l)); else sync(ui.tab);
    // 前回から10分以上たっていたら、Notion で仕分けられたジャンルを裏で読み込む
    if (Date.now() - (load(PULLED, 0) || 0) > 10 * 60 * 1000) refreshGenres(true);
  }
  function close() { el.classList.remove('open'); $('bmDetail').classList.remove('open'); }
  $('bmClose').addEventListener('click', close);
  $('bmSync').addEventListener('click', () => (ui.tab === 'all' ? LISTS.forEach(([l]) => sync(l, true)) : sync(ui.tab, true)));
  $('bmNotion').addEventListener('click', pushNotion);
  $('bmPull').addEventListener('click', () => refreshGenres(false));
  $('bmBagB').addEventListener('click', () => bulkBag('borrow'));
  $('bmBagY').addEventListener('click', () => bulkBag('buy'));
  let qt = 0;
  $('bmQ').addEventListener('input', (e) => { ui.q = e.target.value; ui.limit = 60; clearTimeout(qt); qt = setTimeout(render, 120); });
  $('bmClear').addEventListener('click', () => { ui.q = ''; $('bmQ').value = ''; render(); });
  $('bmSort').addEventListener('change', (e) => { ui.sort = e.target.value; render(); });
  $('bmLib').addEventListener('change', (e) => { ui.lib = e.target.value; ui.limit = 60; render(); });
  $('bmGroup').addEventListener('change', (e) => { ui.group = e.target.checked; render(); });
  addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });

  const chip = h('button', 'chip small', '');
  chip.id = 'bmChip'; chip.type = 'button';
  chip.addEventListener('click', () => open());
  const anchor = document.getElementById('arcChip') || document.getElementById('wishChip');
  if (anchor && anchor.parentNode) anchor.after(chip);
  function updateChip() { chip.textContent = '読書メーター ' + (data.wish.total || data.wish.items.length || ''); chip.style.display = 'block'; }
  updateChip();
  setTimeout(() => sync('wish'), 8000);
  // 条件に合う本の一覧を返す（ほかの画面の検索からも使える）
  function find(opt) {
    const keep = Object.assign({}, ui);
    Object.assign(ui, { tab: 'all', q: '', genre: '', lib: '', sort: 'default' }, opt || {});
    const base = ui.tab === 'all' ? allItems() : data[ui.tab].items;
    const res = search(base, false);
    const rows = sorted(res.rows, res.hasQ);
    Object.keys(ui).forEach((k) => { delete ui[k]; });
    Object.assign(ui, keep);
    return rows.map((x) => ({ item: x.it, genre: genreOf(x.it).g, fuzzy: !!x.fuzzy }));
  }
  return { open, close, sync, pushNotion, refreshGenres, find, show: (it) => detail(it), get data() { return data; } };
}
