// SixTONES館：公式YouTubeの新着動画とニュースで、6人の活動を追う館。
// 写真や公式の絵は描かず・複製せず、公式動画のサムネイル（YouTube の表示）と見出しへのリンクで構成する。
import * as THREE from 'three';

export const STONES = { x0: 50, x1: 72, z0: 38, z1: 54, door: 55 };
export const MEMBERS = [
  { id: 'jesse', name: 'ジェシー', color: '#e5383b', emoji: '🦓', nick: 'ジェス', keys: ['ジェシー', 'Jesse', 'JESSE'] },
  { id: 'juri', name: '田中樹', color: '#3a7bdf', emoji: '🦁', nick: 'じゅり', keys: ['田中樹', '樹', 'じゅり', 'Juri'] },
  { id: 'hokuto', name: '松村北斗', color: '#d9d9e0', base: '#111114', emoji: '🦅', nick: 'ほくと', keys: ['松村北斗', '北斗', 'ほくと', 'Hokuto'], fav: '推し' },
  { id: 'taiga', name: '京本大我', color: '#ff74b1', emoji: '🦇', nick: 'きょも', keys: ['京本大我', '京本', '大我', 'きょも', 'Taiga'], fav: '声' },
  { id: 'kochi', name: '髙地優吾', color: '#f4c430', emoji: '🦔', nick: 'こーち', keys: ['髙地', '高地', 'こーち', 'Kochi'] },
  { id: 'shintaro', name: '森本慎太郎', color: '#34b36a', emoji: '🐻', nick: '慎ちゃん', keys: ['森本慎太郎', '慎太郎', 'Shintaro'] },
];
const KEY = 'my-library:stones:v1';
const SEEN = 'my-library:stones:seen:v1';
const LOG = 'my-library:stones:log:v1';
const img = (u) => '/api/img?u=' + encodeURIComponent(u);
const mentions = (v, m) => m.keys.some((k) => (v.title || '').includes(k));

function canvasTex(w, h, draw) { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); const t = new THREE.CanvasTexture(c); t.anisotropy = 4; return t; }

export function createStones({ scene, colliders, world, warp, toast, cinema }) {
  const std = (o) => new THREE.MeshStandardMaterial(o);
  const root = new THREE.Group(); scene.add(root);
  const { x0, x1, z0, z1, door } = STONES;
  const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, H = 7.2;
  const box = (mat, w, h, d, x, y, z, cast = true) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y, z); m.castShadow = cast; m.receiveShadow = true; root.add(m); return m; };
  const glow = (hex, k = 1.4) => new THREE.MeshStandardMaterial({ color: hex, emissive: hex, emissiveIntensity: k, roughness: 0.4 });
  const targets = [];
  const pickable = (m, data) => { m.userData.st = data; targets.push(m); return m; };

  // ---------------- 小道・歩ける範囲
  world.addWalk({ x0: door - 1.4, x1: door + 1.4, z0: 32.6, z1: z0 + 0.6 });
  world.addWalk({ x0: x0 + 0.45, x1: x1 - 0.45, z0: z0 + 0.45, z1: z1 - 0.45 });
  const path = new THREE.Mesh(new THREE.PlaneGeometry(2.8, 5.6), std({ color: 0x2a2a30, roughness: 0.5, metalness: 0.3 }));
  path.rotation.x = -Math.PI / 2; path.position.set(door, 0.013, 35.4); root.add(path);
  MEMBERS.forEach((m, i) => { const s = new THREE.Mesh(new THREE.PlaneGeometry(0.12, 0.7), glow(m.base ? 0xd9d9e0 : m.color, 1.2)); s.rotation.x = -Math.PI / 2; s.position.set(door - 1.25, 0.02, 33.2 + i * 0.85); root.add(s); const s2 = s.clone(); s2.position.x = door + 1.25; root.add(s2); });

  // ---------------- 外観：黒いガラスの館と光る看板
  const glass = std({ color: 0x0d0d10, metalness: 0.75, roughness: 0.22 });
  const trim = std({ color: 0x2b2b31, metalness: 0.9, roughness: 0.3 });
  box(glass, x1 - x0, H, 0.3, cx, H / 2, z1);                       // 南
  box(glass, 0.3, H, z1 - z0, x0, H / 2, cz);                       // 西
  box(glass, 0.3, H, z1 - z0, x1, H / 2, cz);                       // 東
  box(glass, door - 1.5 - x0, H, 0.3, (x0 + door - 1.5) / 2, H / 2, z0); // 北（扉の左）
  box(glass, x1 - door - 1.5, H, 0.3, (door + 1.5 + x1) / 2, H / 2, z0); // 北（扉の右）
  box(glass, 3, H - 3.4, 0.3, door, 3.4 + (H - 3.4) / 2, z0);        // 扉の上
  box(trim, x1 - x0 + 0.6, 0.35, z1 - z0 + 0.6, cx, H + 0.17, cz);   // 屋根
  const ceiling = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0, z1 - z0), std({ color: 0x07070a, roughness: 0.9 })); ceiling.rotation.x = Math.PI / 2; ceiling.position.set(cx, H - 0.05, cz); root.add(ceiling);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0, z1 - z0), std({ color: 0x141418, metalness: 0.55, roughness: 0.18 })); floor.rotation.x = -Math.PI / 2; floor.position.set(cx, 0.012, cz); floor.receiveShadow = true; root.add(floor);
  // 看板（館の名前は文字で。公式ロゴは使わない）
  const signTex = canvasTex(1024, 256, (g, w, h) => {
    g.fillStyle = '#060608'; g.fillRect(0, 0, w, h);
    g.font = '800 132px "Helvetica Neue", Arial, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.shadowColor = 'rgba(255,255,255,.75)'; g.shadowBlur = 22; g.fillStyle = '#ffffff'; g.fillText('SixTONES', w / 2 - 40, 112);
    g.shadowBlur = 0; g.font = '700 58px "Shippori Mincho B1", serif'; g.fillStyle = '#d9d9e0'; g.fillText('館', w - 110, 120);
    MEMBERS.forEach((m, i) => { g.fillStyle = m.base ? '#e9e9ee' : m.color; g.fillRect(150 + i * 125, 196, 100, 12); });
  });
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(9, 2.25), new THREE.MeshBasicMaterial({ map: signTex })); sign.position.set(cx + 2, 5.25, z0 - 0.17); sign.rotation.y = Math.PI; root.add(sign); pickable(sign, { kind: 'open' });
  // 正面の6本の光の柱（メンバーカラー）
  const facadeBars = MEMBERS.map((m, i) => { const b = box(glow(m.base ? 0xe6e6ee : m.color, 1.6), 0.22, 3.0, 0.08, x0 + 1.4 + i * 0.6 + (i > 2 ? 0 : 0), 1.7, z0 - 0.2, false); return b; });
  facadeBars.forEach((b, i) => { b.position.x = (i < 3 ? x0 + 1.2 + i * 0.75 : x1 - 1.2 - (5 - i) * 0.75); });
  const edge = box(glow(0xffffff, 0.6), x1 - x0 + 0.62, 0.06, 0.06, cx, H + 0.37, z0 - 0.3, false);
  // 野原の端の道しるべ
  const postTex = canvasTex(512, 128, (g, w, h) => { g.fillStyle = '#0c0c10'; g.fillRect(0, 0, w, h); g.strokeStyle = '#e9e9ee'; g.lineWidth = 4; g.strokeRect(6, 6, w - 12, h - 12); g.fillStyle = '#fff'; g.font = '700 54px "Helvetica Neue", Arial, sans-serif'; g.textAlign = 'center'; g.fillText('SixTONES館  ↓', w / 2, 84); });
  const post = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 0.55), new THREE.MeshBasicMaterial({ map: postTex })); post.position.set(door + 2.2, 2.4, 32.4); root.add(post);
  box(trim, 0.1, 2.2, 0.1, door + 2.2, 1.1, 32.45);

  // ---------------- 中：ステージ・LEDの大画面・光の柱・ポスターの額・ニュースの電光掲示板
  box(std({ color: 0x1b1b20, metalness: 0.6, roughness: 0.3 }), 15, 0.5, 3.0, cx, 0.25, z1 - 1.65);
  colliders.push({ x0: cx - 7.6, x1: cx + 7.6, z0: z1 - 3.2, z1: z1 });
  const ledMat = new THREE.MeshBasicMaterial({ color: 0x222228 });
  const led = new THREE.Mesh(new THREE.PlaneGeometry(10, 5.625), ledMat); led.position.set(cx, 3.95, z1 - 0.2); led.rotation.y = Math.PI; root.add(led); pickable(led, { kind: 'latest' });
  box(trim, 10.4, 6.0, 0.08, cx, 3.95, z1 - 0.13, false);
  const ledLabelTex = canvasTex(1024, 96, () => {});
  const ledLabel = new THREE.Mesh(new THREE.PlaneGeometry(10, 0.94), new THREE.MeshBasicMaterial({ map: ledLabelTex, transparent: true })); ledLabel.position.set(cx, 0.85, z1 - 0.22); ledLabel.rotation.y = Math.PI; root.add(ledLabel);
  // マイクスタンド
  MEMBERS.forEach((m, i) => { const x = cx - 5 + i * 2; box(trim, 0.05, 1.5, 0.05, x, 1.25, z1 - 1.4, false); const mic = new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 8), glow(m.base ? 0xd9d9e0 : m.color, 0.9)); mic.position.set(x, 2.02, z1 - 1.4); root.add(mic); });
  // 6本の光の柱（中央に北斗と京本）
  const columns = MEMBERS.map((m, i) => {
    const x = cx - 6.5 + i * 2.6, z = cz + 1.2;
    const hex = m.base ? 0x111114 : m.color;
    const mat = m.base ? std({ color: 0x111114, metalness: 0.9, roughness: 0.15, emissive: 0x444450, emissiveIntensity: 0.6 }) : glow(m.color, 1.1);
    const col = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 4.6, 24), mat); col.position.set(x, 2.3, z); root.add(col); pickable(col, { kind: 'member', id: m.id });
    const ringMat = glow(m.base ? 0xe9e9ee : m.color, 1.8);
    [0.6, 2.3, 4.0].forEach((y) => { const r = new THREE.Mesh(new THREE.TorusGeometry(0.36, 0.035, 8, 32), ringMat); r.rotation.x = Math.PI / 2; r.position.set(x, y, z); root.add(r); });
    box(trim, 1.0, 0.25, 1.0, x, 0.125, z, false);
    colliders.push({ x0: x - 0.55, x1: x + 0.55, z0: z - 0.55, z1: z + 0.55 });
    const plate = canvasTex(512, 200, (g, w, h) => { g.fillStyle = '#0a0a0d'; g.fillRect(0, 0, w, h); g.fillStyle = m.base ? '#e9e9ee' : m.color; g.fillRect(0, 0, w, 10); g.fillStyle = '#fff'; g.textAlign = 'center'; g.font = '700 64px "Shippori Mincho B1", serif'; g.fillText(m.name, w / 2, 98); g.font = '48px sans-serif'; g.fillText(m.emoji + (m.fav ? '  ' + (m.fav === '推し' ? '★ 推し' : '♪ 声') : ''), w / 2, 168); });
    const pl = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 0.59), new THREE.MeshBasicMaterial({ map: plate })); pl.position.set(x, 0.7, z - 0.62); pl.rotation.y = Math.PI; root.add(pl); pickable(pl, { kind: 'member', id: m.id });
    let deco = null;
    if (m.fav === '推し') { const star = new THREE.Mesh(new THREE.OctahedronGeometry(0.26, 0), glow(0xffd76a, 2.2)); star.position.set(x, 5.05, z); root.add(star); deco = star; }
    if (m.fav === '声') { const nt = canvasTex(128, 128, (g) => { g.fillStyle = '#ff9ccb'; g.font = '700 110px serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('♪', 64, 70); }); deco = new THREE.Sprite(new THREE.SpriteMaterial({ map: nt, transparent: true })); deco.scale.set(0.7, 0.7, 1); deco.position.set(x, 5.05, z); root.add(deco); }
    return { m, col, ringMat, deco, x, z, hex };
  });
  // 壁の額（公式動画のサムネイル）
  const frames = [];
  for (let side = 0; side < 2; side++) for (let k = 0; k < 5; k++) {
    const x = side ? x1 - 0.2 : x0 + 0.2, z = z0 + 2.6 + k * 2.55;
    const m = MEMBERS[(k + side * 3) % 6];
    const border = box(glow(m.base ? 0xd9d9e0 : m.color, 0.9), 0.06, 1.42, 2.42, x, 2.5, z, false);
    const pic = new THREE.Mesh(new THREE.PlaneGeometry(2.24, 1.26), new THREE.MeshBasicMaterial({ color: 0x1a1a20 }));
    pic.position.set(side ? x - 0.05 : x + 0.05, 2.5, z); pic.rotation.y = side ? -Math.PI / 2 : Math.PI / 2; root.add(pic);
    pickable(pic, { kind: 'video', idx: frames.length });
    frames.push({ pic, border });
  }
  // ニュースの電光掲示板（入口の上・内側）
  const tick = document.createElement('canvas'); tick.width = 4096; tick.height = 64;
  const tickTex = new THREE.CanvasTexture(tick); tickTex.wrapS = THREE.RepeatWrapping; tickTex.repeat.set(0.5, 1);
  const ticker = new THREE.Mesh(new THREE.PlaneGeometry(18, 0.55), new THREE.MeshBasicMaterial({ map: tickTex })); ticker.position.set(cx, 6.3, z0 + 0.2); root.add(ticker); pickable(ticker, { kind: 'news' });
  // ステージを照らす光の筋（本物のライトは使わず、軽い板で表現）
  const beams = MEMBERS.map((m, i) => { const mat = new THREE.MeshBasicMaterial({ color: m.base ? 0xffffff : m.color, transparent: true, opacity: 0.11, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }); const cone = new THREE.Mesh(new THREE.ConeGeometry(1.1, 6.2, 20, 1, true), mat); const g = new THREE.Group(); g.position.set(cx - 5 + i * 2, H - 0.2, z1 - 3.5); cone.position.y = -3.1; g.add(cone); root.add(g); return g; });
  const lamp = new THREE.PointLight(0xffe8f2, 0.9, 22, 2); lamp.position.set(cx, 5.5, cz + 2); root.add(lamp);

  // ---------------- データ
  let data = null; try { data = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { /* なし */ }
  let seen = localStorage.getItem(SEEN) || '';
  let log = []; try { log = JSON.parse(localStorage.getItem(LOG) || '[]'); } catch (e) { log = []; }
  const loader = new THREE.TextureLoader(); loader.setCrossOrigin('anonymous');
  const texCache = new Map();
  function thumbTex(v, crop) {
    const k = v.id + (crop ? 'c' : '');
    if (texCache.has(k)) return texCache.get(k);
    const t = loader.load(img(crop ? v.thumb : 'https://i.ytimg.com/vi/' + v.id + '/mqdefault.jpg'));
    if (crop) { t.repeat.set(1, 0.75); t.offset.set(0, 0.125); }
    texCache.set(k, t); return t;
  }
  const vids = () => (data && data.videos) || [];
  const longVids = () => vids().filter((v) => !v.short);
  function hang() {
    const list = longVids().length ? longVids() : vids();
    const top = list[0];
    if (top) { ledMat.map = thumbTex(top, true); ledMat.color.set(0xffffff); ledMat.needsUpdate = true; }
    const g = ledLabelTex.image.getContext('2d'); g.clearRect(0, 0, 1024, 96); g.fillStyle = 'rgba(0,0,0,.6)'; g.fillRect(0, 0, 1024, 96); g.fillStyle = '#fff'; g.font = '700 40px sans-serif'; g.textAlign = 'center'; g.fillText(top ? '最新：' + top.title.slice(0, 34) : '新着動画を読み込み中…', 512, 62); ledLabelTex.needsUpdate = true;
    frames.forEach((f, i) => { const v = list[i + 1]; if (v) { f.pic.material.map = thumbTex(v); f.pic.material.color.set(0xffffff); f.pic.material.needsUpdate = true; f.pic.userData.st = { kind: 'video', id: v.id }; } });
    const heads = [...(((data && data.news) || {}).group || []).slice(0, 8)].map((n) => '◆ ' + n.title).join('　　　') || 'SixTONES館へようこそ　　　ニュースを読み込み中…';
    const tg = tick.getContext('2d'); tg.fillStyle = '#050507'; tg.fillRect(0, 0, 4096, 64); tg.fillStyle = '#ffe9a8'; tg.font = '700 38px sans-serif'; tg.textBaseline = 'middle'; tg.fillText(heads.slice(0, 120), 20, 34); tickTex.needsUpdate = true;
  }
  async function load(force) {
    try {
      const r = await fetch('/api/stones' + (force ? '?refresh=1' : ''));
      const j = await r.json(); if (!r.ok) throw new Error(j.error || r.status);
      data = j; try { localStorage.setItem(KEY, JSON.stringify(j)); } catch (e) { /* 容量 */ }
      hang(); if (el.classList.contains('open')) render();
    } catch (e) { if (force) toast('読み込めませんでした：' + String(e.message).slice(0, 50)); }
  }
  const newCount = () => { if (!seen) return longVids().length ? Math.min(3, longVids().length) : 0; return vids().filter((v) => v.published > seen).length; };

  // ---------------- パネル
  const css = document.createElement('style');
  css.textContent = `#stones{position:fixed;inset:auto 0 0 0;z-index:12;padding:0 10px calc(env(safe-area-inset-bottom,0px) + 10px);transform:translateY(110%);transition:transform .4s cubic-bezier(.2,.8,.2,1)}
#stones.open{transform:none}#stones .card{max-height:88vh;overflow-y:auto;display:block;background:linear-gradient(160deg,rgba(14,14,18,.98),rgba(6,6,9,.99));border:1px solid rgba(255,255,255,.14)}
#stones h2{font-family:"Helvetica Neue",Arial,sans-serif;font-weight:800;letter-spacing:.04em;font-size:20px;margin:0;color:#fff}#stones h2 small{font-family:var(--display);font-size:13px;margin-left:4px;color:#ccc}
.st-bar{display:flex;height:4px;border-radius:2px;overflow:hidden;margin:8px 0 2px}.st-bar i{flex:1}
.st-tabs{display:flex;gap:6px;margin:10px 0;overflow-x:auto}.st-tabs button{flex:0 0 auto;min-height:36px;padding:0 13px;border-radius:18px;border:1px solid rgba(255,255,255,.22);background:transparent;color:#ddd;font-size:13px;font-family:var(--ui)}
.st-tabs button[aria-pressed=true]{background:#fff;color:#0b0b0e;font-weight:700}
.st-chips{display:flex;flex-wrap:wrap;gap:6px;margin:6px 0 10px}.st-chips button{min-height:30px;padding:0 10px;border-radius:15px;border:1px solid var(--c,rgba(255,255,255,.3));background:transparent;color:#eee;font-size:12px;font-family:var(--ui)}
.st-chips button[aria-pressed=true]{background:var(--c,#fff);color:#0b0b0e;font-weight:700}
.st-v{display:flex;gap:10px;padding:8px 0;border-bottom:1px solid rgba(255,255,255,.08);cursor:pointer;width:100%;background:none;border-left:0;border-right:0;border-top:0;text-align:left;color:#eee;font-family:var(--ui)}
.st-v img{flex:0 0 132px;width:132px;height:74px;object-fit:cover;border-radius:8px;background:#222}.st-v b{display:block;font-size:13.5px;line-height:1.45}.st-v span{display:block;font-size:11.5px;color:#aaa;margin-top:4px}
.st-n{display:block;padding:10px 2px;border-bottom:1px solid rgba(255,255,255,.08);color:#eee;text-decoration:none;font-size:14px;line-height:1.55}.st-n span{display:block;font-size:11.5px;color:#999;margin-top:3px}
.st-m{display:block;width:100%;text-align:left;margin-bottom:8px;padding:12px;border-radius:14px;border:1px solid rgba(255,255,255,.12);background:linear-gradient(90deg,var(--c) 0 6px,rgba(255,255,255,.03) 6px);color:#fff;font-family:var(--ui)}
.st-m b{font-family:var(--display);font-size:17px}.st-m em{font-style:normal;font-size:11px;padding:2px 8px;border-radius:9px;background:var(--c);color:#0b0b0e;margin-left:6px;font-weight:700}.st-m span{display:block;font-size:12px;color:#bbb;margin-top:4px}
.st-acts{display:flex;flex-wrap:wrap;gap:8px;margin:10px 0}.st-btn{min-height:40px;padding:0 14px;border-radius:12px;border:1px solid rgba(255,255,255,.3);background:rgba(255,255,255,.06);color:#fff;font-size:13px;font-family:var(--ui);text-decoration:none;display:inline-flex;align-items:center}
.st-btn.main{background:#fff;color:#0b0b0e;font-weight:700}
.st-hero img{width:100%;aspect-ratio:16/9;object-fit:cover;border-radius:12px;background:#222}.st-hero b{display:block;margin:8px 0 2px;font-size:15px;color:#fff}
.st-note{font-size:10.5px;color:#888;margin-top:12px;line-height:1.6}`;
  document.head.append(css);
  const el = document.createElement('section'); el.id = 'stones';
  el.innerHTML = `<div class='card'><div class='chead'><h2>SixTONES<small>館</small></h2><button id='stClose' class='st-btn' type='button'>閉じる</button></div><div class='st-bar'>${MEMBERS.map((m) => `<i style="background:${m.base ? '#e9e9ee' : m.color}"></i>`).join('')}</div><div class='st-tabs' id='stTabs'></div><div id='stBody'></div><p class='st-note'>動画は公式YouTubeチャンネルの公開情報、ニュースはGoogle ニュースの見出しとリンクです。写真や記事の本文は取り込んでいません。</p></div>`;
  document.body.append(el);
  const $ = (id) => document.getElementById(id);
  const h = (tag, cls, t) => { const e = document.createElement(tag); if (cls) e.className = cls; if (t !== undefined) e.textContent = t; return e; };
  const TABS = [['videos', '新着動画'], ['news', 'ニュース'], ['members', 'メンバー'], ['log', '推し記録']];
  let tab = 'videos', vFilter = '', nFilter = 'hokuto', detail = null;
  const fmt = (d) => { const t = new Date(d); return isNaN(t) ? '' : (t.getMonth() + 1) + '/' + t.getDate(); };
  const colorOf = (m) => (m.base ? '#e9e9ee' : m.color);
  function play(v) {
    if (!cinema) { window.open(v.url, '_blank', 'noopener'); return; }
    log = [{ id: v.id, title: v.title, at: new Date().toISOString(), members: MEMBERS.filter((m) => mentions(v, m)).map((m) => m.id) }, ...log.filter((x) => x.id !== v.id)].slice(0, 300);
    try { localStorage.setItem(LOG, JSON.stringify(log)); } catch (e) { /* 容量 */ }
    close();
    cinema.play({ service: 'YouTube', url: v.url, embed: 'https://www.youtube.com/embed/' + v.id + '?playsinline=1&rel=0&modestbranding=1', title: v.title, thumb: v.thumb });
    warp({ x: 57.6, z: -19, yaw: -Math.PI / 2, pitch: 0.06 });
    toast('映画館で上映します');
  }
  function videoRow(v) {
    const b = h('button', 'st-v'); b.type = 'button';
    const im = h('img'); im.loading = 'lazy'; im.alt = ''; im.src = 'https://i.ytimg.com/vi/' + v.id + '/mqdefault.jpg';
    const t = h('div'); t.append(h('b', '', v.title), h('span', '', fmt(v.published) + (v.short ? '　ショート' : '') + (seen && v.published > seen ? '　NEW' : '') + (log.some((x) => x.id === v.id) ? '　観た' : '')));
    b.append(im, t); b.addEventListener('click', () => { detail = v; render(); });
    return b;
  }
  function render() {
    const tabs = $('stTabs'); tabs.innerHTML = '';
    TABS.forEach(([k, label]) => { const b = h('button', '', label + (k === 'videos' && newCount() ? '  ' + newCount() : '')); b.type = 'button'; b.setAttribute('aria-pressed', tab === k ? 'true' : 'false'); b.addEventListener('click', () => { tab = k; detail = null; render(); }); tabs.append(b); });
    const body = $('stBody'); body.innerHTML = '';
    if (!data) { body.append(h('p', 'st-note', '読み込み中…')); return; }
    if (detail) {
      const v = detail; const hero = h('div', 'st-hero'); const im = h('img'); im.src = v.thumb; im.alt = ''; hero.append(im, h('b', '', v.title), h('span', 'st-note', fmt(v.published) + '　公式チャンネル')); body.append(hero);
      const who = MEMBERS.filter((m) => mentions(v, m)); if (who.length) { const c = h('div', 'st-chips'); who.forEach((m) => { const x = h('button', '', m.emoji + ' ' + m.name); x.style.setProperty('--c', colorOf(m)); x.addEventListener('click', () => { tab = 'members'; detail = null; render(); }); c.append(x); }); body.append(c); }
      const a = h('div', 'st-acts'); const p = h('button', 'st-btn main', '映画館で上映'); p.type = 'button'; p.addEventListener('click', () => play(v)); const y = h('a', 'st-btn', 'YouTubeで観る'); y.href = v.url; y.target = '_blank'; y.rel = 'noopener'; const bk = h('button', 'st-btn', 'もどる'); bk.type = 'button'; bk.addEventListener('click', () => { detail = null; render(); }); a.append(p, y, bk); body.append(a);
      return;
    }
    if (tab === 'videos') {
      if (data.videoError && !vids().length) body.append(h('p', 'st-note', '動画を読み込めませんでした（' + data.videoError + '）'));
      const c = h('div', 'st-chips'); [['', 'すべて'], ['long', '本編だけ'], ...MEMBERS.map((m) => [m.id, m.emoji + ' ' + m.name])].forEach(([k, label]) => { const b = h('button', '', label); b.type = 'button'; const m = MEMBERS.find((x) => x.id === k); if (m) b.style.setProperty('--c', colorOf(m)); b.setAttribute('aria-pressed', vFilter === k ? 'true' : 'false'); b.addEventListener('click', () => { vFilter = k; render(); }); c.append(b); }); body.append(c);
      let list = vids(); if (vFilter === 'long') list = longVids(); else if (vFilter) { const m = MEMBERS.find((x) => x.id === vFilter); list = list.filter((v) => mentions(v, m)); }
      if (!list.length) body.append(h('p', 'st-note', 'この条件の動画は、最新の15本の中にはありません。'));
      list.forEach((v) => body.append(videoRow(v)));
      const a = h('div', 'st-acts'); const r = h('button', 'st-btn', '最新にする'); r.type = 'button'; r.addEventListener('click', () => load(true)); const ch = h('a', 'st-btn', '公式チャンネルを開く'); ch.href = 'https://www.youtube.com/@SixTONES_official'; ch.target = '_blank'; ch.rel = 'noopener'; a.append(r, ch); body.append(a);
      if (vids()[0]) { seen = vids().reduce((a2, v) => (v.published > a2 ? v.published : a2), seen); localStorage.setItem(SEEN, seen); }
      return;
    }
    if (tab === 'news') {
      const c = h('div', 'st-chips'); [['hokuto'], ['taiga'], ['group'], ['jesse'], ['juri'], ['kochi'], ['shintaro']].forEach(([k]) => { const m = MEMBERS.find((x) => x.id === k); const b = h('button', '', m ? m.emoji + ' ' + m.name : 'SixTONES'); b.type = 'button'; if (m) b.style.setProperty('--c', colorOf(m)); b.setAttribute('aria-pressed', nFilter === k ? 'true' : 'false'); b.addEventListener('click', () => { nFilter = k; render(); }); c.append(b); }); body.append(c);
      const list = (data.news || {})[nFilter] || [];
      if (!list.length) body.append(h('p', 'st-note', 'ニュースがまだありません。'));
      list.forEach((n) => { const a = h('a', 'st-n'); a.href = n.link; a.target = '_blank'; a.rel = 'noopener'; a.append(document.createTextNode(n.title), h('span', '', [n.source, fmt(n.date)].filter(Boolean).join('　'))); body.append(a); });
      return;
    }
    if (tab === 'members') {
      [...MEMBERS].sort((a, b) => (b.fav === '推し') - (a.fav === '推し') || (b.fav ? 1 : 0) - (a.fav ? 1 : 0)).forEach((m) => {
        const b = h('div', 'st-m'); b.style.setProperty('--c', colorOf(m));
        const title = h('div'); title.append(h('b', '', m.emoji + ' ' + m.name)); if (m.fav) title.append(h('em', '', m.fav === '推し' ? '★ 推し' : '♪ 声が好き'));
        const vc = vids().filter((v) => mentions(v, m)).length, nc = ((data.news || {})[m.id] || []).length;
        b.append(title, h('span', '', m.nick + '　新着動画' + vc + '本・ニュース' + nc + '件'));
        const a = h('div', 'st-acts');
        const nb = h('button', 'st-btn', 'ニュース'); nb.type = 'button'; nb.addEventListener('click', () => { tab = 'news'; nFilter = m.id; render(); });
        const vb = h('button', 'st-btn', '動画'); vb.type = 'button'; vb.addEventListener('click', () => { tab = 'videos'; vFilter = m.id; render(); });
        const q = m.id === 'taiga' ? '京本大我 歌' : m.id === 'hokuto' ? '松村北斗 映画 予告' : m.name + ' SixTONES';
        const yb = h('a', 'st-btn', m.id === 'taiga' ? '歌声をさがす' : m.id === 'hokuto' ? '出演作の予告をさがす' : 'YouTubeでさがす'); yb.href = 'https://www.youtube.com/results?search_query=' + encodeURIComponent(q); yb.target = '_blank'; yb.rel = 'noopener';
        a.append(nb, vb, yb); b.append(a); body.append(b);
      });
      return;
    }
    if (tab === 'log') {
      const month = new Date().toISOString().slice(0, 7);
      const mon = log.filter((x) => x.at.slice(0, 7) === month);
      const p = h('div', 'st-m'); p.style.setProperty('--c', '#ffffff'); p.append(h('b', '', '今月観た動画　' + mon.length + '本'), h('span', '', MEMBERS.map((m) => m.emoji + mon.filter((x) => x.members.includes(m.id)).length).join('　')));
      body.append(p);
      if (!log.length) body.append(h('p', 'st-note', '館から映画館で上映した動画が、ここにたまっていきます。'));
      log.slice(0, 40).forEach((x) => { const v = vids().find((y) => y.id === x.id) || { id: x.id, title: x.title, published: x.at, url: 'https://www.youtube.com/watch?v=' + x.id, thumb: 'https://i.ytimg.com/vi/' + x.id + '/hqdefault.jpg' }; const r = videoRow(v); r.querySelector('span').textContent = '観た日 ' + fmt(x.at); body.append(r); });
    }
  }
  function open(opts) { if (opts && opts.tab) tab = opts.tab; if (opts && opts.member) { tab = 'members'; } if (opts && opts.video) detail = opts.video; else detail = null; el.classList.add('open'); render(); load(false); }
  function close() { el.classList.remove('open'); }
  $('stClose').addEventListener('click', close);
  hang();
  load(false);

  // ---------------- 毎フレーム
  function update(dt, time) {
    beams.forEach((g, i) => { g.rotation.z = Math.sin(time * 0.6 + i * 1.1) * 0.35; g.rotation.x = Math.cos(time * 0.45 + i) * 0.2; });
    columns.forEach((c, i) => { c.ringMat.emissiveIntensity = 1.2 + Math.sin(time * 2 + i * 1.05) * 0.6; if (c.deco) { c.deco.position.y = 5.05 + Math.sin(time * 1.5 + i) * 0.12; c.deco.rotation && (c.deco.rotation.y = time); } });
    facadeBars.forEach((b, i) => { b.material.emissiveIntensity = 1.1 + Math.max(0, Math.sin(time * 1.6 - i * 0.7)) * 1.4; });
    tickTex.offset.x = (time * 0.035) % 1;
  }
  const ray = new THREE.Raycaster(); ray.far = 14;
  const center = new THREE.Vector2(0, 0);
  function hitTest(ndc, camera) { ray.setFromCamera(ndc || center, camera); const hit = ray.intersectObjects(targets, false)[0]; return hit ? hit.object.userData.st : null; }
  function label(st) {
    if (st.kind === 'member') { const m = MEMBERS.find((x) => x.id === st.id); return [m.emoji + ' ' + m.name, '　タップでメンバーの今を見る']; }
    if (st.kind === 'video') { const v = vids().find((x) => x.id === st.id); return v ? [v.title.slice(0, 22), '　タップで上映の案内'] : ['SixTONES館', '　タップで開く']; }
    if (st.kind === 'latest') { const v = longVids()[0] || vids()[0]; return [v ? '最新：' + v.title.slice(0, 18) : 'SixTONES館', '　タップで上映の案内']; }
    if (st.kind === 'news') return ['ニュースの電光掲示板', '　タップでニュースを読む'];
    return ['SixTONES館', '　タップで館の案内をひらく'];
  }
  function hint(camera) { const st = hitTest(null, camera); return st ? label(st) : null; }
  function pick(ndc, camera) {
    const st = hitTest(ndc, camera); if (!st) return false;
    if (st.kind === 'member') { open({ tab: 'members' }); }
    else if (st.kind === 'video') { const v = vids().find((x) => x.id === st.id); open(v ? { video: v } : {}); }
    else if (st.kind === 'latest') { const v = longVids()[0] || vids()[0]; open(v ? { video: v } : {}); }
    else if (st.kind === 'news') open({ tab: 'news' });
    else open({});
    return true;
  }
  return { update, hint, pick, open, close, get newCount() { return newCount(); }, get count() { return vids().length; } };
}
