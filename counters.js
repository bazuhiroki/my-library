// 貸出カウンター（司書）と購入カウンター（商人）
import * as THREE from 'three';
import { BORROW_URL, amazonUrl, bagList, toggleBag, clearBag, prizeName } from './books.js';

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

  function render() {
    if (!open) return;
    const c = COUNTERS.find((x) => x.kind === open);
    const list = bagList(open);
    $('cTitle').textContent = c.title;
    $('cSpeech').textContent = open === 'borrow'
      ? (list.length ? `ようこそ。お持ちの${list.length}冊、図書館での借り方をご案内します。書名をお写ししてから予約の窓口へお連れしますね。` : 'ようこそ。借りたい本があれば、棚から取り出して「借りる本に入れる」を選んでからお越しください。')
      : (list.length ? `いらっしゃい。${list.length}冊だね。どれも市場で手に入るよ、一冊ずつ案内しよう。` : 'いらっしゃい。手元に置きたい本があれば「買う本に入れる」を選んで持ってきておくれ。');
    const ul = $('cList'); ul.innerHTML = '';
    list.forEach((r) => {
      const li = document.createElement('li');
      const info = document.createElement('div'); info.className = 'ci';
      const t = document.createElement('b'); t.textContent = r.t.split(/[－(（]/)[0];
      const m = document.createElement('span'); m.textContent = [r.a, r.primary ? `${prizeName(r.primary.p)} ${r.primary.label}` : ''].filter(Boolean).join('　');
      info.append(t, m);
      const go = document.createElement('a'); go.className = 'cgo'; go.target = '_blank'; go.rel = 'noopener';
      if (open === 'borrow') { go.href = BORROW_URL; go.textContent = '予約へ'; go.addEventListener('click', () => { copy(r.t.split(/[－(（]/)[0]).then((ok) => ok && toast('書名をコピーしました。検索欄に貼り付けてください')); }); }
      else { go.href = amazonUrl(r.t.split(/[－(（]/)[0], r.a); go.textContent = 'Amazonへ'; }
      const rm = document.createElement('button'); rm.type = 'button'; rm.className = 'crm'; rm.setAttribute('aria-label', 'リストから外す'); rm.textContent = '×';
      rm.addEventListener('click', () => { toggleBag(open, r); render(); onChange && onChange(); });
      li.append(info, go, rm); ul.append(li);
    });
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
