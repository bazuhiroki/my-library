// 読書メーターの本棚（読みたい本・読んだ本・読んでる本・積読本）を取り込み、表紙つきで見せる
import { RECS, isRead } from './books.js';
import { fold } from './search.js';

const LISTS = [['wish', '読みたい本'], ['stacked', '積読本'], ['reading', '読んでる本'], ['read', '読んだ本']];
const KEY = (l) => 'my-library:bookmeter:v1:' + l;
const COVERS = 'my-library:bookmeter:covers:v1';
const DAY = 24 * 3600 * 1000;
const load = (k, d) => { try { return JSON.parse(localStorage.getItem(k) || 'null') || d; } catch (e) { return d; } };
const save = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* 容量不足でも続ける */ } };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export function createMeter({ wishlist, toast }) {
  const data = {};
  LISTS.forEach(([l]) => { data[l] = load(KEY(l), { items: [], total: 0, at: 0 }); });
  const covers = load(COVERS, {});
  const ui = { tab: 'wish', q: '', limit: 60, busy: {}, open: null };

  // ---------------- 取り込み（1ページずつ、ゆっくり）
  async function sync(list, force) {
    if (ui.busy[list]) return;
    const d = data[list];
    if (!force && d.at && Date.now() - d.at < DAY && d.items.length) return;
    ui.busy[list] = { done: 0, pages: 1 };
    render();
    try {
      const first = await (await fetch('/api/bookmeter?list=' + list + '&page=1')).json();
      if (first.error) throw new Error(first.error);
      // 先頭が同じで件数も同じなら、前回の取り込みをそのまま使う
      if (!force && d.items.length && d.total === first.total && d.items[0] && first.items[0] && d.items[0].id === first.items[0].id) {
        d.at = Date.now(); save(KEY(list), d); return;
      }
      const items = first.items.slice();
      ui.busy[list] = { done: 1, pages: first.pages };
      render();
      for (let p = 2; p <= first.pages; p++) {
        await sleep(450);
        let j = null;
        for (let k = 0; k < 2 && !j; k++) { try { j = await (await fetch('/api/bookmeter?list=' + list + '&page=' + p)).json(); if (j.error) j = null; } catch (e) { j = null; } if (!j) await sleep(1500); }
        if (j) j.items.forEach((it) => { if (!items.some((x) => x.id === it.id)) items.push(it); });
        ui.busy[list] = { done: p, pages: first.pages };
        if (p % 3 === 0) { data[list] = { items: items.slice(), total: first.total, at: 0 }; render(); }
      }
      data[list] = { items, total: first.total, at: Date.now() };
      save(KEY(list), data[list]);
      toast('読書メーターの' + LISTS.find((x) => x[0] === list)[1] + 'を取り込みました（' + items.length + '冊）');
    } catch (e) {
      toast('読書メーターを読み込めませんでした。少し時間をおいて試してね');
    } finally {
      delete ui.busy[list];
      updateChip(); render();
    }
  }

  // ---------------- 表紙が無い本は Google Books などで補う（見えている分だけ、少しずつ）
  const queue = [];
  let running = 0;
  function needCover(it, img) {
    if (it.cover || covers[it.id] !== undefined) return;
    queue.push({ it, img });
    pump();
  }
  async function pump() {
    while (running < 3 && queue.length) {
      const { it, img } = queue.shift();
      if (covers[it.id] !== undefined) { if (covers[it.id] && img) img.src = covers[it.id]; continue; }
      running++;
      fetch('/api/bookinfo?title=' + encodeURIComponent(it.title) + '&author=' + encodeURIComponent((it.author || '').split(',')[0]))
        .then((r) => r.json()).then((j) => { covers[it.id] = (j && j.cover) || ''; })
        .catch(() => { covers[it.id] = ''; })
        .finally(() => { running--; save(COVERS, covers); if (covers[it.id] && img) { img.src = covers[it.id]; img.classList.remove('none'); } pump(); });
    }
  }
  const coverOf = (it) => it.cover || covers[it.id] || '';

  // ---------------- 図書館・Notion との照らし合わせ
  const keyT = (t) => fold(String(t || '').split(/[－―:：(（]/)[0]).slice(0, 18);
  let libIndex = null;
  function libMark(it) {
    if (!libIndex) { libIndex = new Map(); RECS.forEach((r) => libIndex.set(keyT(r.t), r)); }
    const r = libIndex.get(keyT(it.title));
    if (!r) return '';
    return isRead(r) ? '図書館で読んだ' : r.fromLib ? '図書館で借りた' : '館内にある';
  }
  const inWish = (it) => (wishlist.items || []).some((w) => keyT(w.title) === keyT(it.title));

  // ---------------- 画面
  const el = document.createElement('section');
  el.id = 'bm';
  el.setAttribute('role', 'dialog');
  el.setAttribute('aria-labelledby', 'bmTitle');
  el.innerHTML = `<div class='card'>
    <div class='chead'><h2 id='bmTitle'>読書メーターの本棚</h2><button id='bmClose' type='button'>閉じる</button></div>
    <div class='bm-tabs' id='bmTabs'></div>
    <div class='bm-bar'><input id='bmQ' autocomplete='off' placeholder='題名・著者で探す'><button id='bmSync' type='button'>最新にする</button></div>
    <p class='bm-note' id='bmNote'></p>
    <div class='bm-grid' id='bmGrid'></div>
    <div id='bmMore'></div>
  </div>
  <div class='bm-detail' id='bmDetail'></div>`;
  document.body.append(el);
  const $ = (id) => document.getElementById(id);
  const h = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt !== undefined) e.textContent = txt; return e; };

  function filtered() {
    const list = data[ui.tab].items;
    const q = fold(ui.q);
    if (!q) return list;
    return list.filter((it) => fold(it.title + ' ' + it.author).includes(q));
  }
  const io = 'IntersectionObserver' in window ? new IntersectionObserver((ents) => ents.forEach((e) => { if (e.isIntersecting) { io.unobserve(e.target); const it = e.target._it; needCover(it, e.target.querySelector('img')); } }), { root: null, rootMargin: '200px' }) : null;
  function tile(it) {
    const b = h('button', 'bm-tile');
    b.type = 'button';
    const img = document.createElement('img');
    img.loading = 'lazy'; img.alt = it.title;
    const c = coverOf(it);
    if (c) img.src = c; else img.className = 'none';
    img.onerror = () => { img.removeAttribute('src'); img.className = 'none'; };
    const cap = h('span', 'bm-cap', it.title);
    b.append(img, cap);
    const mark = libMark(it) || (inWish(it) ? 'Notionにもある' : '');
    if (mark) b.append(h('em', 'bm-mark', mark));
    b.addEventListener('click', () => detail(it));
    b._it = it;
    if (!c) { if (io) io.observe(b); else needCover(it, img); }
    return b;
  }
  function render() {
    if (!el.classList.contains('open')) return;
    const tabs = $('bmTabs'); tabs.innerHTML = '';
    LISTS.forEach(([l, name]) => {
      const b = h('button', '', name + ' ' + (data[l].total || data[l].items.length || ''));
      b.type = 'button'; b.setAttribute('aria-pressed', ui.tab === l ? 'true' : 'false');
      b.addEventListener('click', () => { ui.tab = l; ui.limit = 60; render(); sync(l); });
      tabs.append(b);
    });
    const busy = ui.busy[ui.tab];
    const d = data[ui.tab];
    $('bmNote').textContent = busy ? '読書メーターから読み込み中… ' + busy.done + ' / ' + busy.pages + 'ページ'
      : d.at ? '読書メーターの公開ページから取り込み（' + new Date(d.at).toLocaleString('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }) + '）' : 'まだ取り込んでいません';
    const grid = $('bmGrid'); grid.innerHTML = '';
    const list = filtered();
    list.slice(0, ui.limit).forEach((it) => grid.append(tile(it)));
    if (!list.length) grid.append(h('p', 'bm-empty', busy ? '読み込み中です…' : ui.q ? '見つかりませんでした' : 'まだ本がありません'));
    const more = $('bmMore'); more.innerHTML = '';
    if (list.length > ui.limit) { const b = h('button', 'bm-more', 'もっと見る（残り ' + (list.length - ui.limit) + '冊）'); b.type = 'button'; b.addEventListener('click', () => { ui.limit += 90; render(); }); more.append(b); }
  }
  // 1冊の詳しい紹介
  async function detail(it) {
    const box = $('bmDetail');
    box.innerHTML = '';
    box.classList.add('open');
    const card = h('div', 'bmd-card');
    const img = document.createElement('img'); img.alt = it.title; const c = coverOf(it); if (c) img.src = c; else img.className = 'none';
    const info = h('div', 'bmd-info');
    info.append(h('b', '', it.title), h('span', 'bmd-author', it.author || ''));
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

  function open(list) {
    if (list) ui.tab = list;
    el.classList.add('open');
    render();
    sync(ui.tab);
  }
  function close() { el.classList.remove('open'); $('bmDetail').classList.remove('open'); }
  $('bmClose').addEventListener('click', close);
  $('bmSync').addEventListener('click', () => sync(ui.tab, true));
  $('bmQ').addEventListener('input', (e) => { ui.q = e.target.value; ui.limit = 60; render(); });
  addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });

  // 画面の入口（論文・雑誌のとなり）
  const chip = h('button', 'chip small', '');
  chip.id = 'bmChip'; chip.type = 'button';
  chip.addEventListener('click', () => open());
  const anchor = document.getElementById('arcChip') || document.getElementById('wishChip');
  if (anchor && anchor.parentNode) anchor.after(chip);
  function updateChip() { chip.textContent = '読書メーター ' + (data.wish.total || data.wish.items.length || '') ; chip.style.display = 'block'; }
  updateChip();
  // 起動から少し待って、裏で読みたい本を最新にしておく
  setTimeout(() => sync('wish'), 8000);
  return { open, close, sync, get data() { return data; } };
}
