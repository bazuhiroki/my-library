// 貸出カウンター（司書）と購入カウンター（商人）
import * as THREE from 'three';
import { BORROW_URL, amazonUrl, bagList, toggleBag, clearBag, prizeName, updateBagItem } from './books.js';

// ISBN-13 → ISBN-10（Amazon の商品ページは ISBN-10 で開ける）
function isbn10(n) {
  const s = String(n || '').replace(/[^0-9X]/gi, '');
  if (s.length === 10) return s.toUpperCase();
  if (s.length !== 13 || !s.startsWith('978')) return '';
  const core = s.slice(3, 12);
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += Number(core[i]) * (10 - i);
  const c = (11 - (sum % 11)) % 11;
  return core + (c === 10 ? 'X' : String(c));
}
const plain = (t) => String(t || '').split(/[－(（]/)[0].trim();
const PASS = 'my-library:passcode';
// 図書館の本・受賞作には ISBN が無いので、題名と著者から調べた ISBN を覚えておく（見つからなかったときは空で覚える）
const ISBN_KEY = 'my-library:isbn-cache:v2';
const isbnCache = (() => { try { return JSON.parse(localStorage.getItem(ISBN_KEY) || '{}') || {}; } catch (e) { return {}; } })();
const ikey = (r) => plain(r.t) + '|' + String(r.a || '').split(/[,・]/)[0];
const isbnOf = (r) => r.isbn || (typeof isbnCache[ikey(r)] === 'string' ? isbnCache[ikey(r)] : '');
// 見つからなかった本は、1日たったらもう一度探す
const tried = (r) => { const v = isbnCache[ikey(r)]; return typeof v === 'string' ? true : !!(v && Date.now() - v.at < 86400000); };
const PAGES = 'my-library:bookmeter:pages:v1';
// 読書メーターの本なら、Notion「読書メーター」の「入手」を更新する
export async function setAcq(r, acq) {
  if (!r || !r.bmId) return;
  let pageId = '';
  try { pageId = (JSON.parse(localStorage.getItem(PAGES) || '{}') || {})[String(r.bmId)] || ''; } catch (e) { pageId = ''; }
  if (!pageId) return;
  try {
    await fetch('/api/meter-notion', { method: 'PATCH', headers: { 'Content-Type': 'application/json', 'x-app-key': localStorage.getItem(PASS) || '' }, body: JSON.stringify({ updates: [{ pageId, fields: { acq, isbn: r.isbn || undefined } }] }) });
  } catch (e) { /* 次の機会に */ }
}

// side: -1 = 西側（入って右手）, +1 = 東側
export const COUNTERS = [
  { kind: 'borrow', side: -1, x: -3.55, z: 18.4, staffX: -4.75, frontX: -2.5, title: '貸出カウンター', sub: '司書が本の借り方を案内します' },
  { kind: 'buy', side: 1, x: 3.55, z: 18.4, staffX: 4.75, frontX: 2.5, title: '購入カウンター', sub: '行商人が本の買い方を案内します' },
];
const LEN = 3.4; // 机の長さ（z方向）

export function buildCounters({ scene, box, M, textTex, colliders }) {
  const bellMat = new THREE.MeshStandardMaterial({ color: 0xd4af5a, metalness: 0.9, roughness: 0.25 });
  const paper = new THREE.MeshStandardMaterial({ color: 0xf3ead2, roughness: 0.9 });
  const coin = new THREE.MeshStandardMaterial({ color: 0xe8c25a, metalness: 0.95, roughness: 0.2 });
  const flames = [];
  COUNTERS.forEach((c) => {
    const s = c.side, z0 = c.z - LEN / 2, z1 = c.z + LEN / 2;
    // 本体：腰板・天板・蹴込み
    box(M.walnutDark, 0.72, 1.02, LEN, c.x, 0.51, c.z);
    box(M.walnut, 0.06, 0.86, LEN - 0.2, c.x - s * 0.37, 0.5, c.z, { cast: false });
    for (let k = 0; k < 4; k++) box(M.gold, 0.02, 0.62, 0.03, c.x - s * 0.405, 0.52, z0 + 0.45 + k * (LEN - 0.9) / 3, { cast: false });
    box(M.walnutDark, 0.86, 0.06, LEN + 0.12, c.x, 1.05, c.z);
    box(M.leather, 0.66, 0.012, LEN - 0.2, c.x, 1.085, c.z, { cast: false });
    box(M.gold, 0.02, 0.03, LEN + 0.12, c.x - s * 0.43, 1.05, c.z, { cast: false });
    // 係の後ろの棚
    box(M.walnut, 0.4, 2.2, LEN, c.x + s * 1.75, 1.1, c.z);
    for (let k = 0; k < 4; k++) box(M.walnutDark, 0.42, 0.03, LEN, c.x + s * 1.75, 0.35 + k * 0.55, c.z, { cast: false });
    // 呼び鈴
    const bell = new THREE.Mesh(new THREE.SphereGeometry(0.07, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), bellMat);
    bell.position.set(c.x - s * 0.18, 1.095, c.z - 1.1); scene.add(bell);
    box(M.walnutDark, 0.18, 0.02, 0.18, c.x - s * 0.18, 1.1, c.z - 1.1, { cast: false });
    // 帳簿（開いた本）と羽ペン
    const led = new THREE.Group(); led.position.set(c.x, 1.1, c.z + 0.2); scene.add(led);
    [-1, 1].forEach((k) => { const pg = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.012, 0.34), paper); pg.position.x = k * 0.13; pg.rotation.z = -k * 0.06; led.add(pg); });
    const quill = new THREE.Mesh(new THREE.ConeGeometry(0.018, 0.34, 6), new THREE.MeshStandardMaterial({ color: 0xf6f1e6, roughness: 0.8 }));
    quill.position.set(c.x + s * 0.2, 1.2, c.z + 0.62); quill.rotation.set(0.9, 0, -s * 0.5); scene.add(quill);
    box(M.iron, 0.07, 0.07, 0.07, c.x + s * 0.2, 1.12, c.z + 0.72, { cast: false });
    // 積み上げた本
    for (let k = 0; k < 5; k++) {
      const b = box(new THREE.MeshStandardMaterial({ color: [0x7a1f1f, 0x1f2f5a, 0x274a36, 0xa8742a, 0x5a2238][k], roughness: 0.7 }), 0.24, 0.05, 0.32, c.x + s * 0.12, 1.12 + k * 0.05, c.z + 1.25, { cast: false });
      b.rotation.y = (k % 2 ? 0.12 : -0.08);
    }
    // 燭台
    box(M.gold, 0.1, 0.03, 0.1, c.x + s * 0.22, 1.1, c.z - 0.45, { cast: false });
    box(new THREE.MeshStandardMaterial({ color: 0xf2ead6, emissive: 0xffe2b0, emissiveIntensity: 0.3 }), 0.04, 0.16, 0.04, c.x + s * 0.22, 1.2, c.z - 0.45, { cast: false });
    const fl = new THREE.Mesh(new THREE.SphereGeometry(0.025, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffc36b }));
    fl.position.set(c.x + s * 0.22, 1.305, c.z - 0.45); fl.scale.y = 1.8; scene.add(fl); flames.push(fl);
    const light = new THREE.PointLight(0xffb86b, 0.9, 4, 2); light.position.set(c.x + s * 0.1, 1.5, c.z - 0.3); scene.add(light);
    // 商人の机には金貨と天秤
    if (c.kind === 'buy') {
      for (let k = 0; k < 3; k++) for (let h = 0; h < 3 + k * 2; h++) { const m = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.01, 14), coin); m.position.set(c.x + s * (0.05 + k * 0.08), 1.1 + h * 0.011, c.z - 0.75 + k * 0.05); scene.add(m); }
      box(M.gold, 0.02, 0.36, 0.02, c.x - s * 0.1, 1.27, c.z + 0.85, { cast: false });
      box(M.gold, 0.02, 0.02, 0.4, c.x - s * 0.1, 1.44, c.z + 0.85, { cast: false });
      [-0.2, 0.2].forEach((o) => { const pan = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.05, 0.02, 16), bellMat); pan.position.set(c.x - s * 0.1, 1.3, c.z + 0.85 + o); scene.add(pan); });
    }
    // 吊り看板
    const t = textTex(c.kind === 'borrow' ? '貸 出' : '購 入', 512, 180, '800 96px "Shippori Mincho B1", serif', '#1f3a2d', '#efd99a');
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 0.52), new THREE.MeshStandardMaterial({ map: t, emissive: 0xffffff, emissiveMap: t, emissiveIntensity: 0.12, roughness: 0.6 }));
    sign.position.set(c.x - s * 0.05, 2.75, c.z); sign.rotation.y = -s * Math.PI / 2; scene.add(sign);
    const back = sign.clone(); back.rotation.y = s * Math.PI / 2; back.position.x += s * 0.01; scene.add(back);
    box(M.gold, 1.56, 0.04, 0.04, c.x - s * 0.05, 3.03, c.z, { cast: false });
    [-0.6, 0.6].forEach((o) => box(M.iron, 0.012, 3.3, 0.012, c.x - s * 0.05, 4.6, c.z + o, { cast: false }));
    // 通れない範囲（机と係の奥）
    colliders.push(s < 0 ? { x0: -6, x1: c.x + 0.43, z0: z0 - 0.06, z1: z1 + 0.06 } : { x0: c.x - 0.43, x1: 6, z0: z0 - 0.06, z1: z1 + 0.06 });
  });
  return { update(time) { flames.forEach((f, i) => { f.scale.set(1 + Math.sin(time * 13 + i) * 0.12, 1.8 + Math.sin(time * 9 + i * 2) * 0.25, 1); }); } };
}

// 近づいたときのボタンと、カウンターのパネル
export function createCounterUI({ $, onChange }) {
  const btn = $('counterBtn'), panel = $('counter');
  let near = null, open = null;
  const copy = async (text) => { try { await navigator.clipboard.writeText(text); return true; } catch (_) { return false; } };
  const toast = (msg) => { const t = $('toast'); t.textContent = msg; t.classList.add('on'); clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.remove('on'), 2200); };

  const avail = {};       // ISBN → { status, reserveurl }
  let calilOff = false;
  // かばんの本の ISBN を、足りない分だけ調べて覚えておく
  async function fillIsbn(list) {
    const need = list.filter((r) => !isbnOf(r) && !tried(r)).slice(0, 6);
    if (!need.length) return false;
    await Promise.all(need.map(async (r) => {
      let n = '';
      const q = 'title=' + encodeURIComponent(plain(r.t)) + '&author=' + encodeURIComponent(String(r.a || '').split(/[,・]/)[0]);
      // まず国立国会図書館サーチ、だめなら Google Books で探す
      try { const j = await (await fetch('/api/calil?find=1&' + q)).json(); n = (j && j.isbn) || ''; } catch (e) { n = ''; }
      if (!n) { try { const j = await (await fetch('/api/bookinfo?' + q)).json(); n = (j && j.isbn) || ''; } catch (e) { n = ''; } }
      if (r.ext && n) updateBagItem(r.key, { isbn: n });
      isbnCache[ikey(r)] = n || { at: Date.now() };
    }));
    try { localStorage.setItem(ISBN_KEY, JSON.stringify(isbnCache)); } catch (e) { /* 保存できなくても続ける */ }
    if (open) render();
    return true;
  }
  // カーリルで葛飾区立図書館の貸出状況を調べる
  let checking = false;
  async function checkAvail(list) {
    if (calilOff || checking) return;
    if (await fillIsbn(list)) return;
    const isbns = [...new Set(list.map(isbnOf).filter((n) => n && !avail[n]))];
    if (!isbns.length) return;
    checking = true;
    try {
      const j = await (await fetch('/api/calil?isbn=' + isbns.join(','))).json();
      if (!j.available) { calilOff = true; return; }
      Object.assign(avail, j.books || {});
    } catch (e) { calilOff = true; } finally { checking = false; }
    if (open) render();
  }
  function render() {
    if (!open) return;
    const c = COUNTERS.find((x) => x.kind === open);
    const list = bagList(open);
    $('cTitle').textContent = c.title;
    $('cSpeech').textContent = open === 'borrow'
      ? (list.length ? `ようこそ。お持ちの${list.length}冊、図書館での借り方をご案内します。書名をお写ししてから予約の窓口へお連れしますね。` : 'ようこそ。借りたい本があれば、棚から取り出して「借りる本に入れる」を選んでからお越しください。')
      : (list.length ? `いらっしゃい。${list.length}冊だね。どれも市場で手に入るよ、一冊ずつ案内しよう。` : 'いらっしゃい。手元に置きたい本があれば「買う本に入れる」を選んで持ってきておくれ。');
    if (open === 'borrow' && list.length) $('cSpeech').textContent += calilOff ? '（カーリルのキーを登録すると、ここで貸出できるかも分かります）' : '　貸出の状況もお調べしますね。';
    const ul = $('cList'); ul.innerHTML = '';
    list.forEach((r) => {
      const li = document.createElement('li');
      const info = document.createElement('div'); info.className = 'ci';
      const t = document.createElement('b'); t.textContent = plain(r.t);
      const m = document.createElement('span'); m.textContent = [r.a, r.primary ? `${prizeName(r.primary.p)} ${r.primary.label}` : '', r.ext ? '読書メーター' : ''].filter(Boolean).join('　');
      info.append(t, m);
      const st = document.createElement('em'); st.className = 'cst';
      info.append(st);
      const acts = document.createElement('div'); acts.className = 'cacts2';
      const go = document.createElement('a'); go.className = 'cgo'; go.target = '_blank'; go.rel = 'noopener';
      acts.append(go);
      const done = document.createElement('button'); done.type = 'button'; done.className = 'cdone';
      if (open === 'borrow') {
        const s = avail[isbnOf(r)];
        if (s) { st.textContent = s.status; st.dataset.s = s.status; }
        else if (!calilOff) st.textContent = (tried(r) && !isbnOf(r)) ? 'ISBNが見つからず確認できません' : '貸出状況を確認中…';
        go.href = (s && s.reserveurl) || BORROW_URL; go.textContent = s && s.reserveurl ? '予約ページへ' : '予約へ';
        go.addEventListener('click', () => { if (!(s && s.reserveurl)) copy(plain(r.t)).then((ok) => ok && toast('書名をコピーしました。検索欄に貼り付けてください')); });
        done.textContent = '予約した';
        done.addEventListener('click', () => { setAcq(r, '予約済み'); toggleBag(open, r); toast('「' + plain(r.t) + '」を予約済みにしました'); render(); onChange && onChange(); });
      } else {
        const n10 = isbn10(isbnOf(r));
        go.href = n10 ? 'https://www.amazon.co.jp/dp/' + n10 : amazonUrl(plain(r.t), r.a); go.textContent = 'Amazonへ';
        const rk = document.createElement('a'); rk.className = 'cgo sub'; rk.target = '_blank'; rk.rel = 'noopener';
        rk.href = 'https://books.rakuten.co.jp/search?sitem=' + encodeURIComponent(isbnOf(r) || plain(r.t)); rk.textContent = '楽天';
        acts.append(rk);
        done.textContent = '買った';
        done.addEventListener('click', () => { setAcq(r, '購入済み'); toggleBag(open, r); toast('「' + plain(r.t) + '」を購入済みにしました'); render(); onChange && onChange(); });
      }
      const rm = document.createElement('button'); rm.type = 'button'; rm.className = 'crm'; rm.setAttribute('aria-label', 'リストから外す'); rm.textContent = '×';
      rm.addEventListener('click', () => { if (r.ext) setAcq(r, ''); toggleBag(open, r); render(); onChange && onChange(); });
      acts.append(done);
      li.append(info, acts, rm); ul.append(li);
    });
    if (open === 'borrow') checkAvail(list);
    else fillIsbn(list);
    $('cEmpty').style.display = list.length ? 'none' : 'block';
    $('cCopy').style.display = list.length ? 'block' : 'none';
    $('cClear').style.display = list.length ? 'block' : 'none';
  }
  $('cCopy').addEventListener('click', () => { const list = bagList(open); copy(list.map((r) => `${r.t.split(/[－(（]/)[0]}　${r.a}`).join('\n')).then((ok) => toast(ok ? `${list.length}冊の書名をコピーしました` : 'コピーできませんでした')); });
  $('cClear').addEventListener('click', () => { clearBag(open); render(); onChange && onChange(); });
  $('cClose').addEventListener('click', () => close());
  btn.addEventListener('click', () => { if (near) openPanel(near); });
  function openPanel(kind) { open = kind; panel.classList.add('open'); render(); }
  function close() { open = null; panel.classList.remove('open'); }
  function update(player) {
    let n = null;
    COUNTERS.forEach((c) => { if (Math.abs(player.x - c.frontX) < 1.25 && Math.abs(player.z - c.z) < 2.1) n = c.kind; });
    if (n !== near) {
      near = n;
      if (near) { const c = COUNTERS.find((x) => x.kind === near); const k = bagList(near).length; btn.textContent = `${c.title}で話す${k ? `（${k}冊）` : ''}`; btn.classList.add('on'); }
      else { btn.classList.remove('on'); if (open) close(); }
    }
  }
  return { update, open: openPanel, close, render, toast, get isOpen() { return !!open; } };
}
