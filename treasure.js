// 宝物の演出：バーコードを読むと宝箱が開き、光の中から本が現れて、読みたい本の棚へ収まっていく
import { coverUrl } from './wishlist.js';

const reduced = () => !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
const rand = (a, b) => a + Math.random() * (b - a);

export function spineHue(t) {
  let h = 0;
  for (const c of String(t)) h = (h * 31 + c.charCodeAt(0)) % 360;
  return h;
}
export const spineColor = (t) => 'hsl(' + spineHue(t) + ' 40% 32%)';
const shortTitle = (t) => {
  const s = String(t || '');
  let cut = s.length;
  for (const c of ['－', '―', '(', '（']) { const k = s.indexOf(c); if (k > 0 && k < cut) cut = k; }
  return s.slice(0, cut).trim() || s;
};

// ---- 効果音（Web Audio でその場で鳴らす。音のファイルは使わない）
export function createSfx() {
  let ctx = null;
  let on = true;
  try { on = localStorage.getItem('my-library:sfx') !== '0'; } catch (e) { on = true; }
  const ensure = () => {
    if (!ctx) { const A = window.AudioContext || window.webkitAudioContext; if (A) ctx = new A(); }
    if (ctx && ctx.state === 'suspended') ctx.resume();
    return ctx;
  };
  function tone(f, t0, d, type, g) {
    const c = ensure();
    if (!c || !on) return;
    const o = c.createOscillator();
    const a = c.createGain();
    const t = c.currentTime + t0;
    o.type = type || 'sine';
    o.frequency.value = f;
    a.gain.setValueAtTime(0.0001, t);
    a.gain.exponentialRampToValueAtTime(g || 0.1, t + 0.02);
    a.gain.exponentialRampToValueAtTime(0.0001, t + d);
    o.connect(a);
    a.connect(c.destination);
    o.start(t);
    o.stop(t + d + 0.05);
  }
  function noise(t0, d, f0, f1, g) {
    const c = ensure();
    if (!c || !on) return;
    const n = Math.floor(c.sampleRate * d);
    const buf = c.createBuffer(1, n, c.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < n; i++) data[i] = Math.random() * 2 - 1;
    const s = c.createBufferSource();
    s.buffer = buf;
    const f = c.createBiquadFilter();
    f.type = 'bandpass';
    const t = c.currentTime + t0;
    f.frequency.setValueAtTime(f0, t);
    f.frequency.exponentialRampToValueAtTime(f1, t + d);
    const a = c.createGain();
    a.gain.setValueAtTime(g, t);
    a.gain.exponentialRampToValueAtTime(0.0001, t + d);
    s.connect(f);
    f.connect(a);
    a.connect(c.destination);
    s.start(t);
  }
  return {
    unlock() { ensure(); },
    get on() { return on; },
    toggle() {
      on = !on;
      try { localStorage.setItem('my-library:sfx', on ? '1' : '0'); } catch (e) { /* 保存できなくても続ける */ }
      if (on) tone(880, 0, 0.18, 'triangle', 0.08);
      return on;
    },
    drop() { noise(0, 0.28, 320, 80, 0.2); tone(110, 0, 0.32, 'sine', 0.18); },
    creak() { noise(0, 0.5, 700, 240, 0.05); tone(180, 0.05, 0.4, 'sawtooth', 0.02); },
    open(rare) {
      [1047, 1319, 1568, 2093, 2637].forEach((f, k) => tone(f, k * 0.07, 0.7, 'triangle', 0.08));
      tone(262, 0, 0.9, 'sine', 0.1);
      if (rare) [523, 659, 784, 1047, 1319].forEach((f, k) => tone(f, 0.4 + k * 0.05, 1.3, 'sine', 0.07));
    },
    land() { tone(392, 0, 0.28, 'sine', 0.12); tone(587, 0.09, 0.45, 'triangle', 0.1); },
    dup() { tone(330, 0, 0.2, 'sine', 0.1); tone(262, 0.12, 0.32, 'sine', 0.1); },
  };
}

export function createTreasure({ host, shelf, sfx }) {
  const el = document.createElement('div');
  el.id = 'tz';
  el.innerHTML = `
    <div class='tz-dim'></div>
    <div class='tz-rays'></div>
    <div class='tz-flash'></div>
    <div class='tz-stage'>
      <div class='tz-glow'></div>
      <div class='tz-chest'>
        <div class='tz-inner'></div>
        <div class='tz-cbody'><i class='tz-band b1'></i><i class='tz-band b2'></i><i class='tz-lock'></i></div>
        <div class='tz-clid'><i class='tz-band b1'></i><i class='tz-band b2'></i></div>
      </div>
      <div class='tz-book'><div class='tz-bfall'></div><img class='tz-img' alt=''><i class='tz-shine'></i></div>
    </div>
    <div class='tz-sparks'></div>
    <div class='tz-text'><div class='tz-badge'></div><div class='tz-head'></div><div class='tz-title'></div><div class='tz-author'></div><div class='tz-sub'></div></div>
    <div class='tz-shelf'><div class='tz-shtop'><span class='tz-shname'>読みたい本の棚</span><span class='tz-shcount'></span></div><div class='tz-row'></div></div>
    <div class='tz-hint'>タップでスキップ</div>`;
  host.append(el);

  // 音のオン・オフ（スキャン画面の上のボタンのとなり）
  const closeBtn = document.getElementById('scanClose');
  const sfxBtn = document.createElement('button');
  sfxBtn.type = 'button';
  sfxBtn.id = 'sfxBtn';
  const paintSfx = () => { sfxBtn.textContent = sfx.on ? '音あり' : '音なし'; sfxBtn.setAttribute('aria-pressed', sfx.on ? 'true' : 'false'); };
  sfxBtn.addEventListener('click', () => { sfx.toggle(); paintSfx(); });
  paintSfx();
  if (closeBtn && closeBtn.parentNode) {
    const box = document.createElement('span');
    box.className = 'tz-btns';
    closeBtn.replaceWith(box);
    box.append(sfxBtn, closeBtn);
  }

  const q = (s) => el.querySelector(s);
  const chest = q('.tz-chest');
  const lid = q('.tz-clid');
  const inner = q('.tz-inner');
  const book = q('.tz-book');
  const img = q('.tz-img');
  const fall = q('.tz-bfall');
  const rays = q('.tz-rays');
  const glow = q('.tz-glow');
  const flash = q('.tz-flash');
  const dim = q('.tz-dim');
  const text = q('.tz-text');
  const shelfEl = q('.tz-shelf');
  const row = q('.tz-row');
  const sparks = q('.tz-sparks');
  const stage = q('.tz-stage');

  let skipped = false;
  let running = [];
  let waiters = [];
  const queue = [];
  let busy = false;

  const A = (node, frames, opts) => {
    const a = node.animate(frames, Object.assign({ fill: 'forwards' }, opts));
    running.push(a);
    return a.finished.catch(() => {});
  };
  const sleep = (ms) => (skipped ? Promise.resolve() : new Promise((r) => {
    const t = setTimeout(r, ms);
    waiters.push(() => { clearTimeout(t); r(); });
  }));
  function skip() {
    skipped = true;
    running.forEach((a) => { try { if (a.effect && a.effect.getTiming().iterations === Infinity) a.cancel(); else a.finish(); } catch (e) { /* もう終わっている */ } });
    waiters.splice(0).forEach((f) => f());
  }
  el.addEventListener('click', skip);

  function clearAll() {
    running.forEach((a) => { try { a.cancel(); } catch (e) { /* もう終わっている */ } });
    running = [];
    if (document.getAnimations) document.getAnimations().forEach((a) => { try { if (a.effect && a.effect.target && el.contains(a.effect.target)) a.cancel(); } catch (e) { /* 無視 */ } });
    sparks.innerHTML = '';
    row.innerHTML = '';
    waiters.splice(0).forEach((f) => f());
  }
  function hide() {
    clearAll();
    el.classList.remove('on', 'rare', 'dup');
    host.classList.remove('tzon');
  }

  function fillShelf(items, newTitle) {
    row.innerHTML = '';
    const list = items.slice(-15);
    list.forEach((it) => {
      const i = document.createElement('i');
      const hgt = 36 + (String(it.title).length % 6) * 4;
      i.style.height = hgt + 'px';
      i.style.width = 9 + (String(it.title).length % 4) * 2 + 'px';
      i.style.background = spineColor(it.title);
      row.append(i);
    });
    const slot = document.createElement('i');
    slot.className = 'tz-slot';
    slot.dataset.title = newTitle;
    row.append(slot);
    return slot;
  }
  function setCover(info) {
    fall.style.background = spineColor(info.title);
    fall.textContent = shortTitle(info.title);
    img.style.opacity = '0';
    img.removeAttribute('src');
    if (!info.isbn && !info.cover) return Promise.resolve();
    return new Promise((res) => {
      img.onload = () => { if (img.naturalWidth > 40) img.style.opacity = '1'; res(); };
      img.onerror = () => { img.style.opacity = '0'; res(); };
      img.src = coverUrl(info);
    });
  }
  function burst(rare) {
    const colors = rare ? ['#ffd6ff', '#9ad7ff', '#fff3b8', '#c9a3ff'] : ['#fff3b8', '#ffd56a', '#ffffff', '#ffb84a'];
    const n = rare ? 40 : 28;
    for (let k = 0; k < n; k++) {
      const s = document.createElement('i');
      s.className = 'tz-sp2';
      const c = colors[k % colors.length];
      s.style.background = c;
      s.style.boxShadow = '0 0 10px 3px ' + c;
      sparks.append(s);
      const ang = rand(0, Math.PI * 2);
      const dist = rand(70, 210);
      const x = Math.cos(ang) * dist;
      const y = Math.sin(ang) * dist * 0.85 - 40;
      A(s, [
        { transform: 'translate(0,0) scale(.4)', opacity: 1 },
        { transform: 'translate(' + x + 'px,' + y + 'px) scale(1)', opacity: 1, offset: 0.6 },
        { transform: 'translate(' + x * 1.12 + 'px,' + (y + 36) + 'px) scale(.15)', opacity: 0 },
      ], { duration: rand(900, 1500), easing: 'cubic-bezier(.1,.7,.3,1)', delay: rand(0, 160) });
    }
  }

  const POSE = 'translateY(-150px) scale(1.05)';
  const withTimeout = (p, ms) => Promise.race([p, new Promise((r) => setTimeout(() => r(null), ms))]);

  async function run(job) {
    skipped = false;
    hide();
    const small = reduced();
    el.classList.add('on');
    host.classList.add('tzon');
    if (job.dup) el.classList.add('dup');
    const loadP = Promise.resolve().then(() => job.load()).catch(() => null);

    // ---- すでに持っている本：短い演出
    if (job.dup) {
      const data = (await loadP) || { info: { isbn: job.isbn, title: 'ISBN ' + job.isbn, authors: [] } };
      await withTimeout(setCover(data.info), 1200);
      q('.tz-badge').textContent = 'もう持っている本';
      q('.tz-head').textContent = 'この宝は棚にあります';
      q('.tz-title').textContent = shortTitle(data.info.title);
      q('.tz-author').textContent = (data.info.authors || []).join('・');
      q('.tz-sub').textContent = '';
      sfx.dup();
      A(dim, [{ opacity: 0 }, { opacity: 1 }], { duration: 250 });
      A(book, [{ opacity: 0, transform: 'translateY(-20px) scale(.9)' }, { opacity: 1, transform: 'translateY(-90px) scale(1)' }], { duration: small ? 1 : 420, easing: 'cubic-bezier(.2,.9,.3,1)' });
      A(text, [{ opacity: 0 }, { opacity: 1 }], { duration: 300, delay: 150 });
      await sleep(1500);
      hide();
      return data;
    }

    // ---- 1. 宝箱が落ちてくる
    q('.tz-badge').textContent = '';
    A(dim, [{ opacity: 0 }, { opacity: 1 }], { duration: 300 });
    sfx.drop();
    if (!small) {
      await A(chest, [
        { transform: 'translateY(-70vh) scale(.7)', opacity: 0 },
        { transform: 'translateY(6px) scale(1.04)', opacity: 1, offset: 0.72 },
        { transform: 'translateY(0) scale(1)', opacity: 1 },
      ], { duration: 560, easing: 'cubic-bezier(.3,.1,.5,1)' });
      // ---- 2. かたかた揺れる（本を調べている間）
      sfx.creak();
      A(glow, [{ opacity: 0 }, { opacity: 0.5 }], { duration: 700 });
      await A(chest, [
        { transform: 'rotate(0deg)' }, { transform: 'rotate(-2.6deg) translateX(-3px)' }, { transform: 'rotate(2.6deg) translateX(3px)' },
        { transform: 'rotate(-2deg)' }, { transform: 'rotate(2deg)' }, { transform: 'rotate(0deg)' },
      ], { duration: 560 });
    } else {
      A(chest, [{ opacity: 0 }, { opacity: 1 }], { duration: 200 });
    }
    // 本の情報が届くまで（最長およそ3秒）待つ
    const data = (await withTimeout(loadP, 3200)) || { info: { isbn: job.isbn, title: 'ISBN ' + job.isbn, authors: [], publisher: '', cover: '' }, late: true };
    await withTimeout(setCover(data.info), 1200);
    const rare = !!data.rare;
    if (rare) el.classList.add('rare');
    q('.tz-badge').textContent = rare ? '伝説の宝物　' + data.rare.label : 'たからもの';
    q('.tz-head').textContent = '宝物を見つけた！';
    q('.tz-title').textContent = shortTitle(data.info.title);
    q('.tz-author').textContent = (data.info.authors || []).join('・');
    q('.tz-sub').textContent = data.read ? '図書館で借りた記録のある本です' : (data.rare ? '受賞作を手に入れました' : '読みたい本の棚に収めます');
    const slot = fillShelf(shelf().filter((i) => i.isbn !== job.isbn), data.info.title);
    const total = data.count || shelf().length;
    q('.tz-shcount').textContent = Math.max(0, total - 1) + '冊';

    // ---- 3. ふたが開いて、光があふれる
    sfx.open(rare);
    try { if (navigator.vibrate) navigator.vibrate(rare ? [40, 40, 80] : 60); } catch (e) { /* 振動できない端末 */ }
    if (!small) {
      A(lid, [{ transform: 'rotateX(0deg)' }, { transform: 'rotateX(-125deg)' }], { duration: 430, easing: 'cubic-bezier(.2,.9,.3,1.25)' });
      A(inner, [{ opacity: 0 }, { opacity: 1 }], { duration: 220 });
      A(flash, [{ opacity: 0 }, { opacity: 0.9, offset: 0.25 }, { opacity: 0 }], { duration: 520 });
      A(rays, [{ opacity: 0 }, { opacity: 1 }], { duration: 500 });
      A(rays, [{ transform: 'rotate(0deg)' }, { transform: 'rotate(360deg)' }], { duration: 18000, iterations: Infinity, fill: 'none' });
      A(glow, [{ opacity: 0.5, transform: 'scale(1)' }, { opacity: 1, transform: 'scale(1.35)' }], { duration: 600 });
      burst(rare);
      await sleep(260);
    }

    // ---- 4. 本が光の中からふわっと浮かび上がる
    A(book, [
      { transform: 'translateY(64px) scale(.3) rotate(-10deg)', opacity: 0 },
      { transform: 'translateY(-60px) scale(.8) rotate(3deg)', opacity: 1, offset: 0.55 },
      { transform: POSE + ' rotate(0deg)', opacity: 1 },
    ], { duration: small ? 1 : 1000, easing: 'cubic-bezier(.2,.9,.25,1.05)' });
    A(text, [{ opacity: 0, transform: 'translateY(14px)' }, { opacity: 1, transform: 'translateY(0)' }], { duration: 520, delay: small ? 0 : 520 });
    A(shelfEl, [{ opacity: 0, transform: 'translate(-50%,18px)' }, { opacity: 1, transform: 'translate(-50%,0)' }], { duration: 500, delay: small ? 0 : 400 });
    await sleep(small ? 1200 : 1000);
    let floatA = null;
    if (!small && !skipped) {
      floatA = book.animate([
        { transform: POSE + ' rotate(-1.5deg)' }, { transform: 'translateY(-158px) scale(1.05) rotate(1.5deg)' }, { transform: POSE + ' rotate(-1.5deg)' },
      ], { duration: 2400, iterations: Infinity, easing: 'ease-in-out' });
      running.push(floatA);
    }
    await sleep(small ? 600 : 1500);

    // ---- 5. ふわぁっと棚へ収まっていく
    if (floatA) { try { floatA.cancel(); } catch (e) { /* 無視 */ } }
    const slotBox = slot.getBoundingClientRect();
    const sBox = stage.getBoundingClientRect();
    const dx = slotBox.left + slotBox.width / 2 - sBox.left;
    const dy = slotBox.top + slotBox.height / 2 - (sBox.top + 30);
    const sc = Math.max(0.12, slotBox.height / 190);
    if (!small && !skipped) {
      sfx.land();
      A(chest, [{ opacity: 1, transform: 'translateY(0)' }, { opacity: 0, transform: 'translateY(40px) scale(.9)' }], { duration: 700 });
      A(rays, [{ opacity: 1 }, { opacity: 0 }], { duration: 700 });
      A(glow, [{ opacity: 1 }, { opacity: 0 }], { duration: 700 });
      A(text, [{ opacity: 1 }, { opacity: 0 }], { duration: 500 });
      await A(book, [
        { transform: POSE + ' rotate(0deg)', opacity: 1 },
        { transform: 'translate(' + dx * 0.4 + 'px,' + (dy * 0.25 - 150) + 'px) scale(.75) rotate(10deg)', opacity: 1, offset: 0.45 },
        { transform: 'translate(' + dx + 'px,' + dy + 'px) scale(' + sc + ') rotate(4deg)', opacity: 0.9, offset: 0.9 },
        { transform: 'translate(' + dx + 'px,' + dy + 'px) scale(' + sc + ') rotate(0deg)', opacity: 0 },
      ], { duration: 950, easing: 'cubic-bezier(.45,.05,.3,1)' });
    }
    // 棚に背表紙が収まる
    slot.className = '';
    slot.style.height = 44 + (String(data.info.title).length % 6) * 4 + 'px';
    slot.style.width = '13px';
    slot.style.background = spineColor(data.info.title);
    slot.style.borderRadius = '2px 2px 0 0';
    q('.tz-shcount').textContent = total + '冊';
    if (!small) {
      A(slot, [{ transform: 'translateY(-16px)', opacity: 0, boxShadow: '0 0 18px 8px rgba(255,214,100,.95)' }, { transform: 'translateY(0)', opacity: 1, boxShadow: '0 0 0 0 rgba(255,214,100,0)' }], { duration: 520, easing: 'cubic-bezier(.2,1.3,.4,1)' });
      A(shelfEl, [{ transform: 'translate(-50%,0) scale(1)' }, { transform: 'translate(-50%,0) scale(1.04)', offset: 0.4 }, { transform: 'translate(-50%,0) scale(1)' }], { duration: 480 });
      await sleep(700);
    } else {
      await sleep(400);
    }
    hide();
    return (await withTimeout(loadP, 2500)) || data;
  }

  async function pump() {
    if (busy) return;
    busy = true;
    while (queue.length) {
      const item = queue.shift();
      let out = null;
      try { out = await run(item.job); } catch (e) { hide(); }
      item.done(out);
    }
    busy = false;
  }
  return {
    play(job) { return new Promise((done) => { queue.push({ job, done }); pump(); }); },
    reset() { queue.splice(0).forEach((x) => x.done(null)); hide(); },
    get busy() { return busy; },
  };
}
