// 読書記録（読書メーターのような個人用の記録）：読みたい・読んでる・読んだ、月ごとの冊数、評価と感想
import { RECS, isRead, setRead, inBag, toggleBag, parseLoanDate } from './books.js';
import { coverUrl } from './wishlist.js';
import { spineColor } from './treasure.js';

const KEY = 'my-library:journal:v1';
const p2 = (n) => String(n).padStart(2, '0');
const today = () => { const d = new Date(); return d.getFullYear() + '-' + p2(d.getMonth() + 1) + '-' + p2(d.getDate()); };
let store = {};
try { store = JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch (e) { store = {}; }
const persist = () => { try { localStorage.setItem(KEY, JSON.stringify(store)); } catch (e) { /* 保存できなくても続ける */ } };
const keyOf = (r) => r.t + '|' + r.a;
let WL = null;
const MIG = 'my-library:journal-migrated:v1';
// Notion にある値を優先し、なければこの端末の記録を使う
const get = (r) => {
  const g = store[keyOf(r)] || {};
  const w = r.wish;
  if (!w) return g;
  const o = Object.assign({}, g);
  if (w.rating) o.rating = w.rating;
  if (w.note) o.note = w.note;
  if (w.started) o.start = w.started;
  if (w.finished) o.end = w.finished;
  return o;
};
const promoting = new Map();
function syncRemote(r, patch) {
  if (!WL) return;
  const f = {};
  if ('rating' in patch) f.rating = patch.rating || 0;
  if ('note' in patch) f.note = patch.note || '';
  if ('start' in patch) f.started = patch.start || '';
  if ('end' in patch) f.finished = patch.end || '';
  if (!Object.keys(f).length) return;
  if (r.wish) { WL.update(r.wish, f, 'note' in patch); return; }
  const k = keyOf(r);
  if (promoting.has(k)) { Object.assign(promoting.get(k), f); return; }
  const local = store[k] || {};
  if (!(local.rating || local.note)) return;
  const extra = {};
  promoting.set(k, extra);
  const reading = local.st === 'reading' && !isRead(r);
  WL.add({
    title: r.t, authors: r.a ? r.a.split('・').filter(Boolean) : [], isbn: '', publisher: '', cover: '', description: '',
    status: reading ? '読書中' : '読了', finished: reading ? '' : (local.end || finishedOf(r)), started: local.start || '', rating: local.rating || 0, note: local.note || '',
  }).then(() => {
    promoting.delete(k);
    if (Object.keys(extra).length && r.wish) WL.update(r.wish, extra);
  }).catch(() => promoting.delete(k));
}
function put(r, patch) {
  const k = keyOf(r);
  const v = Object.assign({}, store[k], patch);
  Object.keys(v).forEach((x) => { if (!v[x]) delete v[x]; });
  if (Object.keys(v).length) store[k] = v; else delete store[k];
  persist();
  syncRemote(r, patch);
}
const fmtJa = (iso) => {
  const m = String(iso || '').match(/^([0-9]{4})-([0-9]{2})-([0-9]{2})/);
  return m ? m[1] + '年' + Number(m[2]) + '月' + Number(m[3]) + '日' : '';
};
const mainTitle = (t) => {
  const s = String(t || '');
  let cut = s.length;
  for (const c of ['－', '―', '(', '（']) { const k = s.indexOf(c); if (k > 0 && k < cut) cut = k; }
  return s.slice(0, cut).trim() || s;
};
const stars = (n) => '★★★★★'.slice(0, n) + '☆☆☆☆☆'.slice(0, 5 - n);

const WISH_STATUS = [['未読', '読みたい'], ['読書中', '読んでる'], ['読了', '読んだ'], ['中断', '中断'], ['再読予定', '再読予定']];

export function statusOf(r) {
  if (r.wish) {
    const s = r.wish.status;
    if (s === '読了') return '読了';
    if (s === '読書中') return '読書中';
    if (s === '中断') return '中断';
    return '読みたい';
  }
  if (isRead(r)) return '読了';
  if (get(r).st === 'reading') return '読書中';
  return null;
}
// 読んだ日。記録がなければ、図書館で借りた日で代用する
export function finishedOf(r) {
  return get(r).end || (r.wish && r.wish.finished) || parseLoanDate(r.d) || (r.wish ? String(r.wish.created || '').slice(0, 10) : '');
}
function collect() {
  const want = [];
  const doing = [];
  const done = [];
  for (const r of RECS) {
    const s = statusOf(r);
    if (s === '読了') done.push(r);
    else if (s === '読書中' || s === '中断') doing.push(r);
    else if (s === '読みたい') want.push(r);
  }
  want.sort((a, b) => String(b.wish.created || '').localeCompare(String(a.wish.created || '')));
  doing.sort((a, b) => String(get(b).start || '').localeCompare(String(get(a).start || '')));
  done.sort((a, b) => finishedOf(b).localeCompare(finishedOf(a)));
  return { want, doing, done };
}
export function monthly(done) {
  const now = new Date();
  const months = [];
  for (let k = 11; k >= 0; k--) {
    const d = new Date(now.getFullYear(), now.getMonth() - k, 1);
    months.push({ key: d.getFullYear() + '-' + p2(d.getMonth() + 1), m: d.getMonth() + 1, n: 0, pages: 0 });
  }
  const byKey = {};
  months.forEach((m) => { byKey[m.key] = m; });
  let year = 0;
  let pages = 0;
  const y = String(now.getFullYear());
  done.forEach((r) => {
    const f = finishedOf(r);
    const pg = get(r).pages || 0;
    pages += pg;
    if (f.slice(0, 4) === y) year++;
    const m = byKey[f.slice(0, 7)];
    if (m) { m.n++; m.pages += pg; }
  });
  return { months, year, total: done.length, pages, thisMonth: months[months.length - 1].n };
}

function h(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}
function btn(label, on, fn, cls) {
  const b = h('button', cls || '', label);
  b.type = 'button';
  if (on !== null) b.setAttribute('aria-pressed', on ? 'true' : 'false');
  b.addEventListener('click', fn);
  return b;
}

export function createJournal({ wishlist, toast, onBag, hasSpot, warpToShelf, currentRec }) {
  WL = wishlist;
  let migrated = false;
  // 以前この端末だけに保存していた評価・感想を、一度だけ Notion に移す
  function migrate() {
    if (migrated || wishlist.mode !== 'notion') return;
    migrated = true;
    try { if (localStorage.getItem(MIG)) return; localStorage.setItem(MIG, '1'); } catch (e) { return; }
    let delay = 600;
    Object.keys(store).forEach((k) => {
      const v = store[k];
      if (!(v.rating || v.note)) return;
      const r = RECS.find((x) => keyOf(x) === k);
      if (!r) return;
      setTimeout(() => syncRemote(r, { rating: v.rating || 0, note: v.note || '', start: v.start || '', end: v.end || '' }), delay);
      delay += 450;
    });
  }
  const wrap = document.getElementById('wish');
  const card = wrap.querySelector('.card');
  const chip = document.getElementById('wishChip');
  card.innerHTML = `
    <div class='chead'><h2 id='wTitle'>読書記録</h2><button id='wClose' type='button'>閉じる</button></div>
    <div class='j-sum' id='jSum'></div>
    <div class='j-chart' id='jChart'></div>
    <p class='j-note' id='jNote'></p>
    <div class='j-tabs' id='jTabs' role='tablist'></div>
    <p id='wNote'></p>
    <ul id='wList'></ul>
    <div class='j-foot'><button id='jCopy' type='button'>記録のバックアップをコピー</button><button id='jRestore' type='button'>バックアップから戻す</button></div>`;
  const $ = (id) => document.getElementById(id);
  const state = { tab: 'want', month: null, open: null, limit: 40 };
  let data = collect();
  let stat = monthly(data.done);

  function renderSummary() {
    const box = $('jSum');
    box.innerHTML = '';
    [[stat.thisMonth, '今月'], [stat.year, '今年'], [stat.total, '累計'], [stat.pages ? stat.pages : '-', 'ページ']].forEach(([n, l]) => {
      const c = h('div');
      c.append(h('b', '', String(n)), h('span', '', l));
      box.append(c);
    });
  }
  function renderChart() {
    const NS = 'http://www.w3.org/2000/svg';
    const W = 320;
    const H = 98;
    const bw = 18;
    const gap = (W - bw * 12) / 12;
    const max = Math.max(3, ...stat.months.map((m) => m.n));
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
    svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', '月ごとの読了冊数');
    stat.months.forEach((m, i) => {
      const x = gap / 2 + i * (bw + gap);
      const bh = Math.max(m.n ? 3 : 1, (m.n / max) * 58);
      const g = document.createElementNS(NS, 'g');
      g.setAttribute('class', 'j-bar' + (state.month === m.key ? ' on' : ''));
      const hit = document.createElementNS(NS, 'rect');
      hit.setAttribute('x', String(x - gap / 2));
      hit.setAttribute('y', '0');
      hit.setAttribute('width', String(bw + gap));
      hit.setAttribute('height', String(H));
      hit.setAttribute('fill', 'transparent');
      const bar = document.createElementNS(NS, 'rect');
      bar.setAttribute('x', String(x));
      bar.setAttribute('y', String(72 - bh));
      bar.setAttribute('width', String(bw));
      bar.setAttribute('height', String(bh));
      bar.setAttribute('rx', '3');
      const n = document.createElementNS(NS, 'text');
      n.setAttribute('x', String(x + bw / 2));
      n.setAttribute('y', String(68 - bh));
      n.setAttribute('text-anchor', 'middle');
      n.setAttribute('class', 'j-n');
      n.textContent = m.n ? String(m.n) : '';
      const lb = document.createElementNS(NS, 'text');
      lb.setAttribute('x', String(x + bw / 2));
      lb.setAttribute('y', '90');
      lb.setAttribute('text-anchor', 'middle');
      lb.setAttribute('class', 'j-l');
      lb.textContent = m.m + '月';
      g.append(hit, bar, n, lb);
      g.addEventListener('click', () => {
        state.month = state.month === m.key ? null : m.key;
        state.tab = 'done';
        state.limit = 40;
        renderAll();
      });
      svg.append(g);
    });
    const box = $('jChart');
    box.innerHTML = '';
    box.append(svg);
    const m = stat.months.find((x) => x.key === state.month);
    $('jNote').textContent = m
      ? m.m + '月に読んだ本 ' + m.n + '冊。もう一度タップで解除'
      : '月ごとの読了冊数（読了日がない本は、図書館で借りた日で数えています）';
  }
  function renderTabs() {
    const box = $('jTabs');
    box.innerHTML = '';
    [['want', '読みたい', data.want.length], ['doing', '読んでる', data.doing.length], ['done', '読んだ', data.done.length]].forEach(([k, l, n]) => {
      const b = btn(l + ' ' + n, state.tab === k, () => { state.tab = k; state.limit = 40; renderAll(); });
      b.setAttribute('role', 'tab');
      box.append(b);
    });
  }

  function coverNode(r) {
    const box = h('div', 'j-cv');
    box.style.background = spineColor(r.t);
    box.textContent = mainTitle(r.t).slice(0, 8);
    if (r.wish && r.wish.isbn) {
      const img = document.createElement('img');
      img.alt = '';
      img.loading = 'lazy';
      img.onload = () => { box.textContent = ''; };
      img.onerror = () => { img.remove(); };
      img.src = coverUrl(r.wish);
      box.append(img);
    }
    return box;
  }
  function dateLabel(r) {
    const s = statusOf(r);
    const g = get(r);
    if (s === '読了') {
      const own = g.end || (r.wish && r.wish.finished);
      if (own) return '読了 ' + fmtJa(own);
      const loan = parseLoanDate(r.d);
      return loan ? '貸出 ' + fmtJa(loan) : '';
    }
    if (s === '読書中' || s === '中断') return g.start ? '読み始め ' + fmtJa(g.start) : (s === '中断' ? '中断中' : '');
    return r.wish && r.wish.created ? '追加 ' + fmtJa(String(r.wish.created).slice(0, 10)) : '';
  }

  function setWishStatus(r, v) {
    wishlist.setStatus(r.wish, v);
    if (v === '読了') {
      const t = today();
      if (!r.wish.finished) r.wish.finished = t;
      if (!get(r).end) put(r, { end: t });
      toast('読了にしました。おつかれさま！');
    }
    if (v === '読書中' && !get(r).start) put(r, { start: today() });
    refresh();
  }
  function setFinished(r, v) {
    put(r, { end: v });
    if (r.wish) {
      r.wish.finished = v;
      if (wishlist.setFinished) wishlist.setFinished(r.wish, v);
      if (r.wish.status !== '読了' && v) setWishStatus(r, '読了');
    } else if (v && !isRead(r)) setRead(r, true);
    refresh();
  }
  function marked(r, to) {
    if (to) {
      if (!get(r).end) put(r, { end: today() });
      if (r.wish && r.wish.status !== '読了') wishlist.setStatus(r.wish, '読了');
    } else {
      put(r, { end: '' });
      if (r.wish && r.wish.status === '読了') wishlist.setStatus(r.wish, '未読');
    }
    refresh();
  }

  function dateField(label, value, onChange) {
    const w = h('label', 'j-date');
    w.append(h('span', '', label));
    const i = document.createElement('input');
    i.type = 'date';
    i.value = value || '';
    i.addEventListener('change', () => onChange(i.value));
    w.append(i);
    return w;
  }
  function detail(r) {
    const box = h('div', 'j-detail');
    const st = statusOf(r);
    const g = get(r);
    const s1 = h('div', 'j-st');
    if (r.wish) {
      WISH_STATUS.forEach(([v, label]) => s1.append(btn(label, r.wish.status === v, () => setWishStatus(r, v))));
    } else {
      s1.append(btn('読んでる', st === '読書中', () => {
        const on = st !== '読書中';
        put(r, { st: on ? 'reading' : '', start: on ? (g.start || today()) : g.start });
        refresh();
      }));
      s1.append(btn('読んだ', st === '読了', () => { const to = st !== '読了'; setRead(r, to); marked(r, to); }));
    }
    box.append(s1);
    const dates = h('div', 'j-dates');
    dates.append(dateField('読み始め', g.start || '', (v) => { put(r, { start: v }); refresh(); }));
    dates.append(dateField('読了日', st === '読了' ? finishedOf(r) : '', (v) => setFinished(r, v)));
    box.append(dates);
    const rate = h('div', 'j-rate');
    rate.append(h('span', 'j-lbl', '評価'));
    for (let n = 1; n <= 5; n++) {
      const b = h('button', 'j-star' + (g.rating >= n ? ' on' : ''), '★');
      b.type = 'button';
      b.setAttribute('aria-label', n + 'つ星');
      b.addEventListener('click', () => { put(r, { rating: g.rating === n ? 0 : n }); renderList(); });
      rate.append(b);
    }
    box.append(rate);
    const ta = document.createElement('textarea');
    ta.className = 'j-ta';
    ta.rows = 4;
    ta.maxLength = 1500;
    ta.placeholder = '感想やメモ（Notionの読書管理に保存されます）';
    ta.value = g.note || '';
    let timer = 0;
    ta.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(() => put(r, { note: ta.value }), 350); });
    ta.addEventListener('blur', () => { clearTimeout(timer); put(r, { note: ta.value }); });
    box.append(ta);
    const acts = h('div', 'j-acts');
    [['borrow', '借りる本'], ['buy', '買う本']].forEach(([k, label]) => {
      acts.append(btn(inBag(k, r) ? label + '（入れた）' : label + 'に入れる', null, () => {
        const on = toggleBag(k, r);
        onBag();
        toast(on ? label + 'に入れました。入口のカウンターへ' : 'リストから外しました');
        renderList();
      }));
    });
    if (hasSpot(r)) acts.append(btn('棚へ行く', null, () => { close(); warpToShelf(r); }));
    if (r.wish) acts.append(btn('台から外す', null, () => { if (window.confirm('『' + r.t + '』を読みたい本から外しますか？')) wishlist.remove(r.wish); }, 'j-danger'));
    box.append(acts);
    return box;
  }
  function rowNode(r) {
    const key = keyOf(r);
    const isOpen = state.open === key;
    const li = h('li', 'j-row' + (isOpen ? ' open' : ''));
    const head = h('button', 'j-head');
    head.type = 'button';
    const info = h('div', 'j-info');
    info.append(h('b', '', mainTitle(r.t)));
    info.append(h('span', 'j-meta', [r.a, dateLabel(r)].filter(Boolean).join('　')));
    const g = get(r);
    if (g.rating) info.append(h('span', 'j-stars', stars(g.rating)));
    if (g.note) info.append(h('span', 'j-notep', g.note.split(String.fromCharCode(10))[0].slice(0, 60)));
    head.append(coverNode(r), info, h('i', 'j-chev', isOpen ? '−' : '＋'));
    head.addEventListener('click', () => { state.open = isOpen ? null : key; renderList(); });
    li.append(head);
    if (isOpen) li.append(detail(r));
    return li;
  }
  function renderList() {
    const ul = $('wList');
    ul.innerHTML = '';
    $('wNote').textContent = wishlist.mode === 'notion' ? 'Notion「読書管理」と同期中（状態・日付・評価・感想）' : '読みたい本はこの端末に保存中（Notion未接続。つながったら自動で送ります）';
    let list = data[state.tab];
    if (state.tab === 'done' && state.month) list = list.filter((r) => finishedOf(r).slice(0, 7) === state.month);
    const empty = {
      want: 'まだ何も積まれていません。右上のカメラで、本屋さんの本のバーコードを読んでみて。',
      doing: '読んでる本はまだありません。読みたい本の詳細で「読んでる」を押すと、ここに入ります。',
      done: '読んだ本はまだありません。',
    };
    if (!list.length) { ul.append(h('li', 'j-empty', empty[state.tab])); return; }
    list.slice(0, state.limit).forEach((r) => ul.append(rowNode(r)));
    if (list.length > state.limit) {
      const li = h('li');
      li.append(btn('もっと見る（残り ' + (list.length - state.limit) + '冊）', null, () => { state.limit += 40; renderList(); }, 'j-more'));
      ul.append(li);
    }
  }
  function renderAll() {
    renderSummary();
    renderChart();
    renderTabs();
    renderList();
  }
  function updateChip() {
    chip.textContent = '読書記録　読みたい' + data.want.length + '・今月' + stat.thisMonth + '冊';
    chip.style.display = 'block';
  }
  function refresh() {
    migrate();
    data = collect();
    stat = monthly(data.done);
    updateChip();
    if (wrap.classList.contains('open')) renderAll();
  }
  function open(arg) {
    wrap.classList.add('open');
    let r = null;
    if (arg) r = arg.isbn !== undefined && arg.title !== undefined && arg.t === undefined ? RECS.find((x) => x.wish === arg) : arg;
    data = collect();
    stat = monthly(data.done);
    if (r) {
      const s = statusOf(r);
      state.tab = s === '読了' ? 'done' : (s === '読書中' || s === '中断') ? 'doing' : 'want';
      state.open = keyOf(r);
      state.month = null;
      state.limit = 40;
      const at = data[state.tab].indexOf(r);
      if (at >= state.limit) state.limit = at + 20;
    }
    updateChip();
    renderAll();
    if (r) {
      const row = $('wList').querySelector('.j-row.open');
      if (row && row.scrollIntoView) row.scrollIntoView({ block: 'center' });
    }
  }
  function close() { wrap.classList.remove('open'); }

  $('wClose').addEventListener('click', close);
  chip.addEventListener('click', () => open());
  $('jCopy').addEventListener('click', async () => {
    const json = JSON.stringify(store);
    try { await navigator.clipboard.writeText(json); toast('感想や評価のバックアップをコピーしました'); } catch (e) { window.prompt('コピーして保存してね', json); }
  });
  $('jRestore').addEventListener('click', () => {
    const t = window.prompt('コピーしたバックアップを貼り付けてね', '');
    if (!t) return;
    try {
      const o = JSON.parse(t);
      if (o && typeof o === 'object') { Object.assign(store, o); persist(); refresh(); toast('バックアップから戻しました'); }
    } catch (e) { toast('読み込めませんでした'); }
  });
  const quick = document.querySelector('#sheet .quick');
  if (quick) {
    const a = h('a', '', '読書記録で開く');
    a.setAttribute('role', 'button');
    a.tabIndex = 0;
    a.addEventListener('click', () => { const r = currentRec(); if (r) open(r); });
    quick.append(a);
  }
  updateChip();
  return {
    open,
    close,
    refresh,
    marked,
    pages(r, n) { if (n && get(r).pages !== n) { put(r, { pages: n }); if (wrap.classList.contains('open')) refresh(); } },
    statusOf,
  };
}
