// 蔵書の検索：かな・全角半角のゆれを吸収し、関連度順に並べる。打ち間違いにも少し強い
import { RECS, isRead, PRIZE_ORDER, PRIZE_SHORT, catalogVersion, parseLoanDate } from './books.js';

const DROP = new Set(Array.from(` 　・、。「」『』()（）[]【】:：!！?？.,，．~〜～…'’‘“”ー－―─—-`));
const SMALL = 'ぁぃぅぇぉっゃゅょゎ';
const BIG = 'あいうえおつやゆよわ';

// 文字をそろえる（全角半角・カタカナ→ひらがな・小さい「っゃゅょ」・記号や空白を無視）。元の位置も覚えておく
export function foldMap(s) {
  const src = String(s || '');
  let f = '';
  const map = [];
  let pos = 0;
  for (const ch0 of Array.from(src)) {
    const at = pos;
    pos += ch0.length;
    for (let ch of ch0.normalize('NFKC').toLowerCase()) {
      const code = ch.charCodeAt(0);
      if (code >= 0x30a1 && code <= 0x30f6) ch = String.fromCharCode(code - 0x60);
      const k = SMALL.indexOf(ch);
      if (k >= 0) ch = BIG[k];
      if (DROP.has(ch) || ch.trim() === '') continue;
      f += ch;
      map.push(at);
    }
  }
  return { f, map };
}
export const fold = (s) => foldMap(s).f;

// 一致した部分を目立たせるための区切り
export function marks(text, words) {
  const { f, map } = foldMap(text);
  const on = new Array(text.length).fill(false);
  for (const w of words) {
    let from = 0;
    for (;;) {
      const k = f.indexOf(w, from);
      if (k < 0 || !w) break;
      const a = map[k];
      const b = (map[k + w.length - 1] === undefined ? a : map[k + w.length - 1]) + 1;
      for (let x = a; x < b; x++) on[x] = true;
      from = k + w.length;
    }
  }
  const segs = [];
  let cur = '';
  let flag = false;
  for (let x = 0; x < text.length; x++) {
    if (on[x] !== flag) { if (cur) segs.push([cur, flag]); cur = ''; flag = on[x]; }
    cur += text[x];
  }
  if (cur) segs.push([cur, flag]);
  return segs;
}

function mainTitle(t) {
  const s = String(t || '');
  let cut = s.length;
  for (const c of ['－', '―', '(', '（']) { const k = s.indexOf(c); if (k > 0 && k < cut) cut = k; }
  return s.slice(0, cut).trim() || s;
}
function bigrams(s) {
  const set = new Set();
  if (s.length === 1) set.add(s);
  for (let k = 0; k < s.length - 1; k++) set.add(s.slice(k, k + 2));
  return set;
}
function dice(a, b) {
  if (!a.size || !b.size) return 0;
  let n = 0;
  for (const x of a) if (b.has(x)) n++;
  return (2 * n) / (a.size + b.size);
}

// 賞の名前の読み（かなで入れても見つかるように）
const PRIZE_READ = {
  芥川賞: 'あくたがわしょう', 直木賞: 'なおきしょう', 本屋大賞: 'ほんやたいしょう', 三島由紀夫賞: 'みしまゆきおしょう',
  山本周五郎賞: 'やまもとしゅうごろうしょう', 谷崎潤一郎賞: 'たにざきじゅんいちろうしょう', 江戸川乱歩賞: 'えどがわらんぽしょう', このミステリーがすごい: 'このみすたいしょう',
};
let idx = [];
let idxVer = -1;
let idxLen = -1;
function build() {
  if (idxVer === catalogVersion && idxLen === RECS.length) return;
  idx = RECS.map((r, i) => {
    const pt = r.prizes.map((p) => p.p + ' ' + (PRIZE_SHORT[p.p] || '') + ' 第' + p.n + '回 ' + (p.y || '') + ' ' + (PRIZE_READ[p.p] || '')).join(' ');
    const tm = fold(mainTitle(r.t));
    const a = fold(r.a);
    return { i, t: fold(r.t), tm, a, p: fold(pt), bg: bigrams(tm), bga: bigrams(a), date: parseLoanDate(r.d) };
  });
  idxVer = catalogVersion;
  idxLen = RECS.length;
}

function wordScore(w, e) {
  let s = 0;
  if (e.tm === w) s = 100;
  else if (e.tm.startsWith(w)) s = 70;
  else {
    const k = e.tm.indexOf(w);
    if (k >= 0) s = 52 - Math.min(k, 20);
    else {
      const k2 = e.t.indexOf(w);
      if (k2 >= 0) s = 36 - Math.min(k2, 16);
    }
  }
  if (e.a === w) s = Math.max(s, 64);
  else if (e.a.startsWith(w)) s = Math.max(s, 46);
  else if (e.a.includes(w)) s = Math.max(s, 34);
  if (s < 15 && e.p.includes(w)) s = 15;
  return s;
}

export const FILTERS = [['all', 'すべて'], ['read', '読んだ'], ['unread', '未読'], ['prize', '受賞作'], ['loan', '貸出履歴'], ['wish', '読みたい']];
function pass(r, filter, prize) {
  if (prize && !r.prizes.some((p) => p.p === prize)) return false;
  switch (filter) {
    case 'read': return isRead(r);
    case 'unread': return !isRead(r);
    case 'prize': return r.prizes.length > 0;
    case 'loan': return r.fromLib;
    case 'wish': return !!r.wish;
    default: return true;
  }
}
const prizeN = (i, prize) => {
  const ps = RECS[i].prizes;
  const p = prize ? ps.find((x) => x.p === prize) : RECS[i].primary;
  return p ? p.n : 0;
};

export function runSearch({ q, filter, prize }) {
  build();
  const words = String(q || '').replace(/　/g, ' ').split(' ').map(fold).filter(Boolean);
  let items = [];
  let fuzzy = false;
  if (words.length) {
    for (const e of idx) {
      const r = RECS[e.i];
      if (!pass(r, filter, prize)) continue;
      let s = 0;
      let ok = true;
      for (const w of words) {
        const v = wordScore(w, e);
        if (v <= 0) { ok = false; break; }
        s += v;
      }
      if (ok) items.push({ i: e.i, s });
    }
    items.sort((a, b) => (b.s - a.s) || (prizeN(b.i) - prizeN(a.i)) || (idx[a.i].tm.length - idx[b.i].tm.length) || (a.i - b.i));
    const wq = words.join('');
    if (items.length < 4 && wq.length >= 2) {
      const have = new Set(items.map((x) => x.i));
      const qb = bigrams(wq);
      const extra = [];
      for (const e of idx) {
        if (have.has(e.i) || !pass(RECS[e.i], filter, prize)) continue;
        const d = Math.max(dice(qb, e.bg), dice(qb, e.bga));
        if (d >= 0.5) extra.push({ i: e.i, s: d * 30, fuzzy: true });
      }
      extra.sort((a, b) => b.s - a.s);
      if (extra.length && !items.length) fuzzy = true;
      items = items.concat(extra.slice(0, 12));
    }
  } else if (filter !== 'all' || prize) {
    for (const e of idx) if (pass(RECS[e.i], filter, prize)) items.push({ i: e.i, s: 0 });
    if (prize || filter === 'prize') items.sort((a, b) => prizeN(b.i, prize) - prizeN(a.i, prize));
    else if (filter === 'read' || filter === 'loan') items.sort((a, b) => idx[b.i].date.localeCompare(idx[a.i].date));
    else if (filter === 'wish') items.sort((a, b) => (RECS[b.i].wish.created || '').localeCompare(RECS[a.i].wish.created || ''));
  }
  return { items, words, fuzzy };
}

const hueOf = (s) => { let h = 0; for (const c of String(s)) h = (h * 31 + c.charCodeAt(0)) % 360; return h; };

export function initSearch({ hasSpot, locOf, colorOf, warpTo, openWish }) {
  const $ = (id) => document.getElementById(id);
  const sEl = $('search');
  const qEl = $('q');
  const resEl = $('results');
  const infoEl = $('sInfo');
  const bar = sEl.querySelector('.sbar');
  const fWrap = document.createElement('div');
  fWrap.className = 'schips';
  const pWrap = document.createElement('div');
  pWrap.className = 'schips small';
  bar.after(fWrap);
  fWrap.after(pWrap);
  const state = { filter: 'all', prize: null, limit: 60 };
  const RK = 'my-library:recent-q:v1';
  const recent = () => { try { return JSON.parse(localStorage.getItem(RK) || '[]') || []; } catch (e) { return []; } };
  const pushRecent = (q) => {
    const t = q.trim();
    if (!t) return;
    const a = [t].concat(recent().filter((x) => x !== t)).slice(0, 8);
    try { localStorage.setItem(RK, JSON.stringify(a)); } catch (e) { /* 保存できなくても続ける */ }
  };
  function chip(label, on, fn) {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = label;
    b.setAttribute('aria-pressed', on ? 'true' : 'false');
    b.addEventListener('click', fn);
    return b;
  }
  function drawChips() {
    fWrap.innerHTML = '';
    FILTERS.forEach(([k, l]) => fWrap.append(chip(l, state.filter === k, () => { state.filter = k; state.limit = 60; drawChips(); render(); })));
    pWrap.innerHTML = '';
    PRIZE_ORDER.forEach((p) => pWrap.append(chip(PRIZE_SHORT[p] || p, state.prize === p, () => { state.prize = state.prize === p ? null : p; state.limit = 60; drawChips(); render(); })));
  }
  function badge(text, cls) {
    const s = document.createElement('span');
    s.className = 'sb ' + cls;
    s.textContent = text;
    return s;
  }
  function withMarks(parent, text, words) {
    marks(text, words).forEach(([t, on]) => {
      if (on) { const m = document.createElement('mark'); m.textContent = t; parent.append(m); } else parent.append(document.createTextNode(t));
    });
  }
  function row(it, words) {
    const r = RECS[it.i];
    const li = document.createElement('li');
    const b = document.createElement('button');
    b.type = 'button';
    const sp = document.createElement('span');
    sp.className = 'sp';
    sp.style.background = colorOf(it.i) || 'hsl(' + hueOf(r.t) + ' 38% 34%)';
    const tx = document.createElement('span');
    tx.className = 'stx';
    const t = document.createElement('div');
    t.className = 't';
    withMarks(t, mainTitle(r.t), words);
    const m = document.createElement('div');
    m.className = 'm';
    if (r.a) { const a = document.createElement('span'); withMarks(a, r.a, words); m.append(a); }
    r.prizes.slice(0, 2).forEach((p) => m.append(badge((PRIZE_SHORT[p.p] || p.p) + ' 第' + p.n + '回', 'prize')));
    if (isRead(r)) m.append(badge('読んだ', 'read'));
    if (r.wish) m.append(badge('読みたい', 'wish'));
    const place = document.createElement('div');
    place.className = 'm place';
    place.textContent = hasSpot(it.i) ? locOf(it.i) : '読みたい本の台';
    tx.append(t, m, place);
    b.append(sp, tx);
    if (it.fuzzy) b.append(badge('近い', 'fuzzy'));
    b.addEventListener('click', () => {
      pushRecent(qEl.value);
      close();
      if (hasSpot(it.i)) warpTo(it.i); else openWish(r);
    });
    li.append(b);
    return li;
  }
  function head(text) {
    const li = document.createElement('li');
    li.className = 'shead';
    li.textContent = text;
    return li;
  }
  function home() {
    const read = RECS.filter(isRead).length;
    infoEl.textContent = '蔵書 ' + RECS.length + '冊（読んだ本 ' + read + '冊）。書名・著者名・賞の名前で探せます';
    const rc = recent();
    if (rc.length) {
      resEl.append(head('最近の検索'));
      const li = document.createElement('li');
      li.className = 'schips inline';
      rc.forEach((q) => li.append(chip(q, false, () => { qEl.value = q; state.limit = 60; render(); })));
      resEl.append(li);
    }
    const loans = runSearch({ q: '', filter: 'loan', prize: null }).items.filter((x) => hasSpot(x.i)).slice(0, 8);
    if (loans.length) {
      resEl.append(head('最近借りた本'));
      loans.forEach((x) => resEl.append(row(x, [])));
    }
  }
  function render() {
    const q = qEl.value;
    resEl.innerHTML = '';
    if (!q.trim() && state.filter === 'all' && !state.prize) { home(); return; }
    const res = runSearch({ q, filter: state.filter, prize: state.prize });
    const n = res.items.length;
    infoEl.textContent = n ? (res.fuzzy ? 'もしかして：近い本が' + n + '冊' : n + '冊見つかりました。選ぶとその棚へ飛びます') : '見つかりませんでした。かなや別の言葉でも試してみてね';
    res.items.slice(0, state.limit).forEach((it) => resEl.append(row(it, res.words)));
    if (n > state.limit) {
      const li = document.createElement('li');
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'smore';
      b.textContent = 'さらに表示（残り ' + (n - state.limit) + '冊）';
      b.addEventListener('click', () => { state.limit += 60; render(); });
      li.append(b);
      resEl.append(li);
    }
  }
  function open() {
    sEl.classList.add('open');
    qEl.value = '';
    state.limit = 60;
    drawChips();
    render();
    setTimeout(() => qEl.focus(), 40);
  }
  function close() {
    sEl.classList.remove('open');
    qEl.blur();
  }
  qEl.addEventListener('input', () => { state.limit = 60; render(); });
  qEl.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { const f = resEl.querySelector('li:not(.shead) > button:not(.smore)'); if (f) f.click(); }
  });
  $('searchBtn').addEventListener('click', open);
  $('sClose').addEventListener('click', close);
  return { open, close };
}
