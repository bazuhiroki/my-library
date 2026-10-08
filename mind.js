// 「心の部屋」：湖のほとりの庵。エルフと一緒に、出来事をリフレーミングする。
// 出来事A → 感情（状態B）→ 観測条件を変えた見方（反状態C）→ 対話 → 感情の変化 → Notion「心の部屋」に残す。
import * as THREE from 'three';

const MINCHO = '"Shippori Mincho B1", "Hiragino Mincho ProN", serif';
export const HERMIT = { x: -63, z: 10 };
const PASS = 'my-library:passcode';
const BEFORE = ['不安', 'モヤっと', '悲しい', '落ち込む', '怒り', 'ちょっと怒り', '悔しい', '怖い', '嫌だなー', '疲れた', 'めんどくさい', 'どうしたものか', 'なにをしてるんだか', 'ほめられたい', 'やりすぎに注意', '休む', '少し', 'なるほど', '気になる！', '面白い', '楽しい', '嬉しい', 'なんかほっとする', 'やるぞ！', 'がんばる(前に向かって進むと同義）'];
const AFTER = ['頭の整理ができた', '不安が減った', '落ち込みが減った', '安心感×2', '希望', '希望が湧いた', '勇気が生まれた', 'やることが明確になった', 'よし！！わかった！', '疲れていることに気づけた', 'ストレスサイン◎', '要注意(ストレスかかっている）×２', 'やる気×2', 'スッゴいがんばる！', '楽しさ×2', '面白い×2', '嬉しさ倍増', '新しい楽しさを見いだせた喜び', 'ラッキー', 'まだ変わらない'];

const THEMES = ['対人関係', '自己理解', '体調・環境', '仕事・学習', '生活・趣味', '将来・不安'];
const NEXTS = [['なし', 0], ['3日後', 3], ['1週間後', 7], ['1か月後', 30]];
const addDays = (n) => new Date(Date.now() + 9 * 3600 * 1000 + n * 86400000).toISOString().slice(0, 10);
function canvasTex(w, h, draw) { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); const t = new THREE.CanvasTexture(c); t.anisotropy = 4; return t; }

export function createMind({ scene, M, colliders, toast, elf }) {
  const std = (o) => new THREE.MeshStandardMaterial(o);
  const root = new THREE.Group(); scene.add(root);
  const box = (mat, w, h, d, x, y, z, cast = true) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y, z); m.castShadow = cast; m.receiveShadow = true; root.add(m); return m; };
  const { x: hx, z: hz } = HERMIT;

  // ---------------- 庵（東と南が開いた小さな建物。西と北は障子）
  const wood = std({ color: 0x6b4a2e, roughness: 0.85 });
  const woodDark = std({ color: 0x3e2a1a, roughness: 0.9 });
  const floorMat = std({ roughness: 0.9, map: canvasTex(256, 256, (g) => { g.fillStyle = '#b8a46a'; g.fillRect(0, 0, 256, 256); g.strokeStyle = 'rgba(90,70,30,.35)'; g.lineWidth = 1; for (let y = 0; y < 256; y += 4) { g.beginPath(); g.moveTo(0, y); g.lineTo(256, y); g.stroke(); } g.fillStyle = '#3e3020'; g.fillRect(0, 0, 256, 6); g.fillRect(0, 128, 256, 6); }) });
  floorMat.map.wrapS = floorMat.map.wrapT = THREE.RepeatWrapping; floorMat.map.repeat.set(2, 3);
  box(std({ color: 0x8a8378, roughness: 0.95 }), 6.6, 0.12, 5.6, hx, 0.06, hz); // 石の基壇
  const fl = new THREE.Mesh(new THREE.PlaneGeometry(6, 5), floorMat); fl.rotation.x = -Math.PI / 2; fl.position.set(hx, 0.125, hz); fl.receiveShadow = true; root.add(fl);
  [[-3, -2.5], [3, -2.5], [-3, 2.5], [3, 2.5]].forEach(([dx, dz]) => { box(woodDark, 0.18, 2.7, 0.18, hx + dx, 1.35, hz + dz); colliders.push({ x0: hx + dx - 0.15, x1: hx + dx + 0.15, z0: hz + dz - 0.15, z1: hz + dz + 0.15 }); });
  box(woodDark, 6.3, 0.16, 0.2, hx, 2.68, hz - 2.5, false); box(woodDark, 6.3, 0.16, 0.2, hx, 2.68, hz + 2.5, false);
  box(woodDark, 0.2, 0.16, 5.3, hx - 3, 2.68, hz, false); box(woodDark, 0.2, 0.16, 5.3, hx + 3, 2.68, hz, false);
  // 茅葺きの屋根（四角錐）
  const roof = new THREE.Mesh(new THREE.ConeGeometry(5.6, 2.2, 4, 1, true), std({ color: 0x6e5a3a, roughness: 1, side: THREE.DoubleSide, map: canvasTex(128, 128, (g) => { g.fillStyle = '#6e5a3a'; g.fillRect(0, 0, 128, 128); g.strokeStyle = 'rgba(40,30,15,.45)'; for (let x = 0; x < 128; x += 3) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x + (Math.random() * 6 - 3), 128); g.stroke(); } }) }));
  roof.rotation.y = Math.PI / 4; roof.scale.set(1, 1, 0.86); roof.position.set(hx, 2.75 + 1.1, hz); roof.castShadow = true; root.add(roof);
  box(woodDark, 0.5, 0.25, 0.5, hx, 5.0, hz, false);
  // 障子（西と北）：やわらかく光る紙
  const shojiTex = canvasTex(256, 256, (g) => { g.fillStyle = '#f3ead2'; g.fillRect(0, 0, 256, 256); g.strokeStyle = '#5a4128'; g.lineWidth = 5; for (let i = 0; i <= 4; i++) { g.beginPath(); g.moveTo(i * 64, 0); g.lineTo(i * 64, 256); g.stroke(); g.beginPath(); g.moveTo(0, i * 64); g.lineTo(256, i * 64); g.stroke(); } });
  const shoji = std({ map: shojiTex, emissive: 0xffe2b0, emissiveIntensity: 0.25, roughness: 0.9, side: THREE.DoubleSide });
  const sW = new THREE.Mesh(new THREE.PlaneGeometry(5, 2.4), shoji); sW.position.set(hx - 2.95, 1.35, hz); sW.rotation.y = Math.PI / 2; root.add(sW);
  const sN = new THREE.Mesh(new THREE.PlaneGeometry(6, 2.4), shoji); sN.position.set(hx, 1.35, hz - 2.45); root.add(sN);
  colliders.push({ x0: hx - 3.2, x1: hx - 2.8, z0: hz - 2.6, z1: hz + 2.6 }, { x0: hx - 3.2, x1: hx + 3.2, z0: hz - 2.65, z1: hz - 2.3 });
  // ちゃぶ台・座布団・お茶
  const table = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 0.06, 28), wood); table.position.set(hx - 0.6, 0.45, hz); table.castShadow = true; root.add(table);
  [[-0.25, -0.25], [0.25, -0.25], [-0.25, 0.25], [0.25, 0.25]].forEach(([dx, dz]) => box(woodDark, 0.05, 0.3, 0.05, hx - 0.6 + dx, 0.28, hz + dz, false));
  colliders.push({ x0: hx - 1.2, x1: hx, z0: hz - 0.6, z1: hz + 0.6 });
  const cushionMat = std({ color: 0x5b2a3a, roughness: 0.95 });
  box(cushionMat, 0.62, 0.08, 0.62, hx + 0.25, 0.17, hz, false); box(cushionMat, 0.62, 0.08, 0.62, hx - 1.45, 0.17, hz, false);
  const cupMat = std({ color: 0xe8e2d4, roughness: 0.4 });
  [[-0.45, 0.12], [-0.75, -0.12]].forEach(([dx, dz]) => { const c = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.035, 0.07, 12), cupMat); c.position.set(hx + dx, 0.52, hz + dz); root.add(c); });
  const pot = new THREE.Mesh(new THREE.SphereGeometry(0.09, 14, 10), std({ color: 0x2d3a34, roughness: 0.5 })); pot.position.set(hx - 0.6, 0.56, hz); root.add(pot);
  // 行灯（あんどん）
  const andonMat = std({ color: 0xfff0d0, emissive: 0xffc070, emissiveIntensity: 1.1, roughness: 0.8 });
  box(woodDark, 0.34, 0.06, 0.34, hx - 2.3, 0.18, hz - 1.7, false);
  const andon = box(andonMat, 0.28, 0.5, 0.28, hx - 2.3, 0.46, hz - 1.7, false);
  const lamp = new THREE.PointLight(0xffc27a, 0.8, 9, 2); lamp.position.set(hx - 2.3, 0.9, hz - 1.7); root.add(lamp);
  // 入口の札「心の部屋」
  const plaqueTex = canvasTex(160, 420, (g, w, h) => { g.fillStyle = '#4a3420'; g.fillRect(0, 0, w, h); g.strokeStyle = '#c9a04e'; g.lineWidth = 6; g.strokeRect(6, 6, w - 12, h - 12); g.fillStyle = '#f4ead2'; g.font = '800 92px ' + MINCHO; g.textAlign = 'center'; ['心', 'の', '部', '屋'].forEach((c, i) => g.fillText(c, w / 2, 100 + i * 92)); });
  const plaque = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 1.1), std({ map: plaqueTex, roughness: 0.6 })); plaque.position.set(hx + 3.12, 1.85, hz - 1.6); plaque.rotation.y = Math.PI / 2; root.add(plaque);
  // 庭：飛び石・石灯籠・つくばい・紅葉
  const stoneMat = std({ color: 0x8f8a80, roughness: 0.95 });
  [[3.9, 0], [4.8, 0.35], [5.7, -0.1], [6.6, 0.25]].forEach(([dx, dz]) => { const s = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.36, 0.08, 9), stoneMat); s.position.set(hx + dx, 0.04, hz + dz); s.receiveShadow = true; root.add(s); });
  const toro = new THREE.Group(); toro.position.set(hx + 4.2, 0, hz - 3.4); root.add(toro);
  [[0.5, 0.12, 0.5, 0.06], [0.16, 0.7, 0.16, 0.47], [0.46, 0.1, 0.46, 0.87]].forEach(([w, h, d, y]) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), stoneMat); m.position.y = y; m.castShadow = true; toro.add(m); });
  const fire = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.26, 0.3), std({ color: 0x8f8a80, emissive: 0xffb050, emissiveIntensity: 0.6 })); fire.position.y = 1.05; toro.add(fire);
  const cap = new THREE.Mesh(new THREE.ConeGeometry(0.42, 0.28, 4), stoneMat); cap.rotation.y = Math.PI / 4; cap.position.y = 1.32; toro.add(cap);
  colliders.push({ x0: hx + 3.9, x1: hx + 4.5, z0: hz - 3.7, z1: hz - 3.1 });
  const basin = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.45, 0.4, 14), stoneMat); basin.position.set(hx + 4.0, 0.2, hz + 3.2); root.add(basin);
  const water = new THREE.Mesh(new THREE.CircleGeometry(0.3, 18), std({ color: 0x3e6a78, roughness: 0.1, metalness: 0.3 })); water.rotation.x = -Math.PI / 2; water.position.set(hx + 4.0, 0.41, hz + 3.2); root.add(water);
  colliders.push({ x0: hx + 3.5, x1: hx + 4.5, z0: hz + 2.7, z1: hz + 3.7 });
  const maple = new THREE.Group(); maple.position.set(hx - 4.6, 0, hz + 4.2); root.add(maple);
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.16, 2.2, 8), woodDark); trunk.position.y = 1.1; maple.add(trunk);
  const leafMat = std({ color: 0xc23a22, roughness: 0.8 });
  [[0, 2.5, 0, 1.2], [0.6, 2.2, 0.3, 0.8], [-0.5, 2.3, -0.3, 0.85], [0.1, 3.0, 0.1, 0.8]].forEach(([x, y, z, r]) => { const l = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 0), leafMat); l.position.set(x, y, z); l.castShadow = true; maple.add(l); });
  colliders.push({ x0: hx - 4.8, x1: hx - 4.4, z0: hz + 4.0, z1: hz + 4.4 });
  const ELF_SPOT = { x: hx - 1.45, z: hz, ry: Math.PI / 2, pose: 'gaze', text: '心の部屋で、あなたを待っている', hours: [0, 24] };

  // ---------------- パネル
  const css = document.createElement('style');
  css.textContent = `#mind{position:fixed;inset:auto 0 0 0;z-index:12;padding:0 10px calc(env(safe-area-inset-bottom,0px) + 10px);transform:translateY(110%);transition:transform .4s cubic-bezier(.2,.8,.2,1)}
#mind.open{transform:none}#mind .card{max-height:88vh;overflow-y:auto;display:block;background:linear-gradient(180deg,rgba(22,34,30,.97),rgba(14,20,18,.98));border-color:rgba(160,210,180,.35)}
#mind h2{font-family:var(--display);font-size:19px;margin:0;color:#e8f3ea}#mind h2 small{font-size:11px;color:#9fb8aa;margin-left:6px;font-weight:500}
.md-btn{min-height:42px;padding:0 14px;border-radius:12px;border:1px solid rgba(160,210,180,.45);background:rgba(160,210,180,.08);color:#d6eedd;font-family:var(--ui);font-size:13.5px;cursor:pointer}
.md-btn.main{background:#7fbf98;color:#0f1a14;font-weight:700;border-color:#7fbf98}.md-btn:disabled{opacity:.5}
.md-acts{display:flex;flex-wrap:wrap;gap:8px;margin-top:12px}
.md-elf{display:flex;gap:10px;align-items:flex-start;margin:12px 0}.md-elf i{flex:0 0 36px;height:36px;border-radius:18px;background:radial-gradient(circle at 40% 35%,#fff7d8,#bfe8d2 60%,#5f8f78);box-shadow:0 0 14px rgba(190,255,220,.5)}
.md-elf p{margin:0;background:rgba(255,255,255,.06);border:1px solid rgba(160,210,180,.25);border-radius:4px 14px 14px 14px;padding:10px 12px;font-size:14.5px;line-height:1.75;color:#eef6f0;white-space:pre-wrap}
.md-me{text-align:right;margin:10px 0}.md-me p{display:inline-block;margin:0;background:rgba(201,160,78,.16);border:1px solid rgba(201,160,78,.35);border-radius:14px 4px 14px 14px;padding:9px 12px;font-size:14px;line-height:1.7;color:#f3ead6;text-align:left;white-space:pre-wrap;max-width:88%}
.md-lab{font-size:12px;color:#9fb8aa;margin:12px 0 6px}
.md-ta{width:100%;box-sizing:border-box;min-height:84px;border-radius:12px;border:1px solid rgba(160,210,180,.3);background:rgba(0,0,0,.25);color:#eef6f0;font-size:16px;line-height:1.6;padding:10px;font-family:var(--ui)}
.md-in{display:flex;gap:6px;align-items:flex-end}.md-in .md-ta{min-height:46px;flex:1}
.md-mic{flex:0 0 46px;height:46px;border-radius:23px;border:1px solid rgba(160,210,180,.45);background:rgba(160,210,180,.08);color:#d6eedd;font-size:20px}.md-mic.on{background:#c0503c;border-color:#c0503c;color:#fff;animation:mdp 1.2s infinite}
@keyframes mdp{50%{box-shadow:0 0 0 8px rgba(192,80,60,.25)}}
.md-chips{display:flex;flex-wrap:wrap;gap:6px}.md-chips button{min-height:32px;padding:0 11px;border-radius:16px;border:1px solid rgba(160,210,180,.3);background:transparent;color:#bcd6c6;font-size:12.5px;font-family:var(--ui)}
.md-chips button[aria-pressed=true]{background:rgba(127,191,152,.28);border-color:#7fbf98;color:#f0fff4}
.md-view{display:block;width:100%;text-align:left;margin-top:10px;padding:12px;border-radius:14px;border:1px solid rgba(160,210,180,.3);background:rgba(255,255,255,.04);color:#eef6f0;font-family:var(--ui)}
.md-view em{display:inline-block;font-style:normal;font-size:11px;padding:2px 8px;border-radius:9px;background:rgba(127,191,152,.22);color:#cfeedd;margin-bottom:6px}
.md-view b{display:block;font-size:15px;margin-bottom:4px}.md-view span{display:block;font-size:13.5px;line-height:1.7;color:#d5e6dc}.md-view small{display:block;margin-top:6px;font-size:12.5px;color:#9fd0b2}
.md-rec{display:block;width:100%;text-align:left;padding:10px 4px;border:none;border-bottom:1px solid rgba(160,210,180,.15);background:none;color:#e4f0e8;font-family:var(--ui)}
.md-rec b{display:block;font-size:14px}.md-rec span{font-size:11.5px;color:#9fb8aa}
.md-crisis{margin-top:10px;padding:12px;border-radius:14px;border:1px solid rgba(240,180,160,.5);background:rgba(120,40,30,.25)}.md-crisis a{display:flex;justify-content:space-between;gap:8px;padding:9px 4px;color:#ffe2d8;text-decoration:none;border-bottom:1px solid rgba(255,255,255,.08);font-size:14px}.md-crisis a b{font-size:15px}
.md-note{font-size:10.5px;color:#7f998a;margin:12px 0 0;line-height:1.6}
.md-say{flex:0 0 34px;height:34px;border-radius:17px;border:1px solid rgba(160,210,180,.35);background:rgba(160,210,180,.08);color:#d6eedd;font-size:15px;align-self:flex-end}
.md-wait{display:flex;gap:5px;padding:12px}.md-wait i{width:7px;height:7px;border-radius:4px;background:#9fd0b2;animation:mdw 1s infinite}.md-wait i:nth-child(2){animation-delay:.15s}.md-wait i:nth-child(3){animation-delay:.3s}@keyframes mdw{50%{opacity:.2;transform:translateY(-3px)}}`;
  document.head.append(css);
  const el = document.createElement('section');
  el.id = 'mind';
  el.innerHTML = `<div class='card'><div class='chead'><h2>心の部屋<small>湖のほとりの庵</small></h2><button id='mdClose' class='md-btn' type='button'>閉じる</button></div><div id='mdBody'></div><p class='md-note' id='mdNote'></p></div>`;
  document.body.append(el);
  const $ = (id) => document.getElementById(id);
  const h = (tag, cls, t) => { const e = document.createElement(tag); if (cls) e.className = cls; if (t !== undefined) e.textContent = t; return e; };
  async function api(url, opt) {
    for (let k = 0; k < 2; k++) {
      const o = Object.assign({}, opt); o.headers = Object.assign({ 'Content-Type': 'application/json', 'x-app-key': localStorage.getItem(PASS) || '' }, o.headers);
      const r = await fetch(url, o);
      if (r.status === 401) { const p = window.prompt('合言葉を入れてね（Vercel の APP_PASSCODE）'); if (!p) throw new Error('passcode'); localStorage.setItem(PASS, p); continue; }
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || String(r.status));
      return j;
    }
    throw new Error('passcode');
  }

  // ---------------- 状態
  let S = null, history = [], aiKind = '', usage = null, diaryInfo = null, stats = null, journal = [], voiceOn = false;
  let autoVoice = localStorage.getItem('my-library:mind:voice') !== 'off';
  const fresh = () => ({ step: 'home', input: '文字', event: '', emotions: [], autoThought: '', views: [], view: null, conditions: [], messages: [], after: [], conclusion: '', opposite: '', title: '', diaryPageId: '', diaryText: '', elf: '', context: null, since: '', themes: [], next: 7, writeDiary: true });
  S = fresh();
  const greet = () => { const hr = new Date().getHours(); return hr < 5 ? '夜の湖は静かですね。眠れないときも、ここにいます。' : hr < 11 ? 'おはようございます。お茶をいれました。今日のことを、少し話していきませんか。' : hr < 17 ? 'ようこそ、心の部屋へ。どんな出来事がありましたか。' : 'おかえりなさい。今日一日のことを、ここでほどいていきましょう。'; };
  async function loadHistory() { try { const j = await api('/api/mind?history=1'); history = j.records || []; aiKind = j.ai || ''; usage = j.usage || usage; diaryInfo = j.diary || null; stats = j.stats || null; journal = j.journal || []; voiceOn = !!j.voice; } catch (e) { /* 続ける */ } }

  // ---------------- 音声入力（Chrome の音声認識。無料）
  let rec = null;
  function micButton(target) {
    const b = h('button', 'md-mic', '🎤'); b.type = 'button'; b.title = '話して入力';
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { b.disabled = true; b.title = 'この端末では音声入力が使えません'; return b; }
    b.addEventListener('click', () => {
      if (rec) { rec.stop(); return; }
      rec = new SR(); rec.lang = 'ja-JP'; rec.interimResults = true; rec.continuous = true;
      const base = target.value ? target.value + (/[。！？\n]$/.test(target.value) ? '' : '。') : '';
      let finalText = '';
      rec.onresult = (e) => { let interim = ''; for (let i = e.resultIndex; i < e.results.length; i++) { const t = e.results[i][0].transcript; if (e.results[i].isFinal) finalText += t; else interim += t; } target.value = base + finalText + interim; S.input = '音声'; };
      rec.onend = () => { rec = null; b.classList.remove('on'); target.dispatchEvent(new Event('input')); };
      rec.onerror = () => { toast('音声を聞き取れませんでした（マイクの許可を確かめてください）'); };
      rec.start(); b.classList.add('on');
    });
    return b;
  }
  function chips(list, sel, onChange) {
    const w = h('div', 'md-chips');
    list.forEach((name) => { const b = h('button', '', name.replace('(前に向かって進むと同義）', '')); b.type = 'button'; b.setAttribute('aria-pressed', sel.includes(name) ? 'true' : 'false'); b.addEventListener('click', () => { const i = sel.indexOf(name); if (i >= 0) sel.splice(i, 1); else sel.push(name); b.setAttribute('aria-pressed', i >= 0 ? 'false' : 'true'); onChange && onChange(); }); w.append(b); });
    return w;
  }
  const elfSays = (text) => { const d = h('div', 'md-elf'); d.append(h('i'), h('p', '', text)); if (voiceOn && text) { const b = h('button', 'md-say', '🔊'); b.type = 'button'; b.title = 'エルフの声で聞く'; b.addEventListener('click', () => speak(text, true)); d.append(b); } return d; };
  // エルフの声（ElevenLabs）。同じ文は二度作らない
  const voiceCache = new Map(); let audio = null;
  async function speak(text, manual) {
    if (!voiceOn || !text || (!manual && !autoVoice)) return;
    try {
      if (audio) { audio.pause(); audio = null; }
      let src = voiceCache.get(text);
      if (!src) {
        const j = await api('/api/mind', { method: 'POST', body: JSON.stringify({ action: 'tts', text }) });
        src = j.audio; voiceCache.set(text, src);
        if (usage) { usage.voiceUsed = j.voiceUsed; usage.voiceCap = j.voiceCap; }
      }
      audio = new Audio(src); await audio.play();
    } catch (e) { if (manual) toast(String(e.message || e).slice(0, 80)); }
  }
  const meSays = (text) => { const d = h('div', 'md-me'); d.append(h('p', '', text)); return d; };
  const waiting = () => { const d = h('div', 'md-elf'); const w = h('div', 'md-wait'); w.append(h('i'), h('i'), h('i')); d.append(h('i'), w); return d; };
  function crisisCard(j) {
    const box2 = h('div', 'md-crisis');
    box2.append(h('div', '', j.reply));
    (j.resources || []).forEach((r) => { const a = h('a'); a.href = 'tel:' + r.tel.replace(/-/g, ''); a.append(h('b', '', r.name), h('span', '', r.tel + '　' + r.note)); box2.append(a); });
    return box2;
  }
  async function ai(phase, extra) {
    const j = await api('/api/mind', { method: 'POST', body: JSON.stringify({ action: 'ai', phase, event: S.event, emotions: S.emotions, autoThought: S.autoThought, diary: S.diaryText, view: S.view ? S.view.condition + '：' + S.view.title + '／' + S.view.text : '', messages: S.messages, after: S.after, memory: S.context ? S.context.text : '', ...(extra || {}) }) });
    if (j && j.used !== undefined) usage = { used: j.used, cap: j.cap };
    return j;
  }

  // ---------------- 画面
  function render() {
    const body = $('mdBody'); body.innerHTML = '';
    $('mdNote').textContent = (aiKind === 'gemini' ? 'エルフの言葉は Gemini（無料枠では、送った内容が Google の改善に使われることがあります）で作られます。' : aiKind === 'anthropic' ? 'エルフの言葉は Claude で作られます。' : 'AI のキーが未設定です。') + (usage ? '今月のAI利用：約' + usage.used + '円（' + usage.cap + '円で自動停止）' + (voiceOn && usage.voiceCap ? '・エルフの声 ' + (usage.voiceUsed || 0) + '／' + usage.voiceCap + '文字' : '') + '。' : '') + 'エルフは相談相手ですが、医療やカウンセリングの代わりではありません。';
    const acts = () => { const a = h('div', 'md-acts'); body.append(a); return a; };
    const btn = (parent, label, fn, main) => { const b = h('button', 'md-btn' + (main ? ' main' : ''), label); b.type = 'button'; b.addEventListener('click', fn); parent.append(b); return b; };
    if (S.step === 'home') {
      const j0 = journal[0];
      body.append(elfSays(greet() + (j0 ? '\n\n' + (j0.date || '').slice(5, 10).replace('-', '/') + 'の日誌は「' + j0.line + '」' + (j0.weather ? '（心の天気：' + j0.weather + '）' : '') + 'でしたね。' : '')));
      if (diaryInfo) body.append(h('div', 'md-lab', diaryInfo.ok ? '感情日記：つながっています（' + diaryInfo.count + '件を参考にできます）' : '感情日記：まだつながっていません。' + (diaryInfo.message || '')));
      const a = acts(); btn(a, 'いまの出来事を話す', () => { S = fresh(); S.step = 'event'; render(); }, true); btn(a, '過去の日記を見直す', openDiary); btn(a, 'ふりかえり', () => { S = fresh(); S.step = 'review'; render(); });
      if (voiceOn) btn(a, autoVoice ? 'エルフの声：自動で読む' : 'エルフの声：押したときだけ', () => { autoVoice = !autoVoice; localStorage.setItem('my-library:mind:voice', autoVoice ? 'on' : 'off'); render(); });
      const due = (stats && stats.revisit) || [];
      if (due.length) {
        body.append(h('div', 'md-lab', 'もう一度観測する日が来た記録'));
        due.forEach((r) => { const b2 = h('button', 'md-rec'); b2.type = 'button'; b2.append(h('b', '', r.title), h('span', '', r.date + 'の記録　→　いまの位置から見直す')); b2.addEventListener('click', () => revisit(r)); body.append(b2); });
      }
      if (history.length) {
        body.append(h('div', 'md-lab', 'これまでの心の記録'));
        history.slice(0, 12).forEach((r) => { const b2 = h('button', 'md-rec'); b2.type = 'button'; b2.append(h('b', '', r.title || r.event), h('span', '', (r.date || '').slice(0, 10) + '　' + (r.emotions || []).join('・') + (r.after && r.after.length ? '　→　' + r.after.join('・') : ''))); b2.addEventListener('click', () => { S = fresh(); S.step = 'record'; S.rec = r; render(); }); body.append(b2); });
      }
      return;
    }
    if (S.step === 'review') {
      body.append(elfSays('ためてきた記録から、あなたの観測のくせを眺めてみましょう。'));
      if (!stats) { body.append(h('p', 'md-note', 'まだ記録がありません。')); const a = acts(); btn(a, 'もどる', () => { S = fresh(); render(); }); return; }
      const box = (title, lines) => { body.append(h('div', 'md-lab', title)); const p2 = h('div', 'md-view'); p2.style.cursor = 'default'; lines.forEach((l) => p2.append(h('span', '', l))); body.append(p2); };
      box('記録', ['心の部屋：全部で' + stats.sessions + '回（今月' + stats.monthSessions + '回）', '気持ちが動いた割合：' + stats.movedRate + '%', '感情日記：' + stats.diaryCount + '件を参考にしています']);
      if (stats.topBefore.length) box('今月よく出た最初の気持ち', stats.topBefore.map((x) => x.name + '　' + x.count + '回'));
      if (stats.topAfter.length) box('今月の対話のあとの気持ち', stats.topAfter.map((x) => x.name + '　' + x.count + '回'));
      const used = stats.conditions.filter((c) => c.used);
      if (used.length) box('観測条件と、気持ちが動いた回数', used.map((c) => c.name + '　' + c.moved + '／' + c.used + '回'));
      if (stats.nextTry.length) box('次に試してみる観測条件', stats.nextTry.map((c) => c + '（まだ使っていません）'));
      if (stats.themes.length) box('よく出る主題', stats.themes.map((x) => x.name + '　' + x.count + '回'));
      if (stats.diaryLong.length) box('感情日記の、この3か月の気持ち', stats.diaryLong.map((x) => x.name + '　' + x.count + '回'));
      if (journal.length) box('最近の日誌', journal.slice(0, 7).map((x) => (x.date || '').slice(5, 10) + '　' + (x.weather ? '［' + x.weather + '］' : '') + x.line));
      const a = acts(); btn(a, 'もどる', () => { S = fresh(); render(); });
      return;
    }
    if (S.step === 'record') {
      const r = S.rec; body.append(h('div', 'md-lab', (r.date || '').slice(0, 10)), elfSays(['出来事：' + r.event, r.autoThought && '浮かんだ考え：' + r.autoThought, r.opposite && '反対の見方：' + r.opposite, r.conclusion && '結論：' + r.conclusion, r.after && r.after.length && '変化：' + r.after.join('・')].filter(Boolean).join('\n\n')));
      const a = acts(); btn(a, 'もどる', () => { S = fresh(); render(); }); btn(a, 'この出来事をもう一度見直す', () => { const ev = r.event; S = fresh(); S.step = 'event'; S.event = ev; render(); }, true);
      return;
    }
    if (S.step === 'diary') {
      body.append(elfSays('どの日の記録を、一緒に見直しましょうか。'));
      if (!S.diary) { body.append(waiting()); return; }
      if (!S.diary.available) { body.append(h('p', 'md-note', S.diary.message)); acts(); btn(body.lastChild, 'もどる', () => { S = fresh(); render(); }); return; }
      S.diary.records.forEach((r) => { const b = h('button', 'md-rec'); b.type = 'button'; b.append(h('b', '', r.title || '（題名なし）'), h('span', '', (r.date || '').slice(0, 10) + '　' + r.emotions.join('・'))); b.addEventListener('click', () => pickDiary(r)); body.append(b); });
      const a = acts(); btn(a, 'もどる', () => { S = fresh(); render(); });
      return;
    }
    if (S.step === 'event') {
      body.append(elfSays('どんな出来事がありましたか。話しても、書いても大丈夫です。'));
      const row = h('div', 'md-in'); const ta = h('textarea', 'md-ta'); ta.placeholder = '出来事（いつ・どこで・何があったか）'; ta.value = S.event; ta.addEventListener('input', () => { S.event = ta.value; go.disabled = !(S.event.trim() && S.emotions.length); });
      row.append(ta, micButton(ta)); body.append(row);
      body.append(h('div', 'md-lab', 'そのときの気持ち（いくつでも）'));
      body.append(chips(BEFORE, S.emotions, () => { go.disabled = !(S.event.trim() && S.emotions.length); }));
      const a = acts(); btn(a, 'もどる', () => { S = fresh(); render(); });
      const go = btn(a, 'エルフに聴いてもらう', listen, true); go.disabled = !(S.event.trim() && S.emotions.length);
      return;
    }
    // 対話の流れ（listen → views → talk → close）
    body.append(meSays(S.event + '\n（' + S.emotions.map((e) => e.replace('(前に向かって進むと同義）', '')).join('・') + '）'));
    if (S.crisis) { body.append(elfSays(S.crisis.reply), crisisCard(S.crisis)); const a = acts(); btn(a, '閉じる', () => { S = fresh(); close(); }); return; }
    if (S.step === 'listen') {
      if (!S.elf) { body.append(waiting()); return; }
      body.append(elfSays(S.elf));
      memCards(body);
      body.append(h('div', 'md-lab', 'そのとき浮かんだ考え（自動思考）。違っていたら直してください'));
      const ta = h('textarea', 'md-ta'); ta.value = S.autoThought; ta.addEventListener('input', () => { S.autoThought = ta.value; }); body.append(ta);
      const a = acts(); btn(a, '見方を変えてみる', views, true);
      return;
    }
    if (S.step === 'views') {
      if (S.autoThought) body.append(meSays('浮かんだ考え：' + S.autoThought));
      if (!S.views.length) { body.append(waiting()); return; }
      body.append(elfSays(S.viewsIntro || '同じ出来事を、観測条件を少し変えて眺めてみましょう。気になるものを選んでください。'));
      S.views.forEach((v) => { const c = h('button', 'md-view'); c.type = 'button'; c.append(h('em', '', v.condition), h('b', '', v.title), h('span', '', v.text), h('small', '', v.question || '')); c.addEventListener('click', () => chooseView(v)); body.append(c); });
      const a = acts(); btn(a, 'ほかの見方を見る', () => { S.views = []; render(); views(); });
      return;
    }
    if (S.step === 'talk' || S.step === 'close') {
      if (S.view) body.append(h('div', 'md-lab', '選んだ見方：' + S.view.condition + '「' + S.view.title + '」'));
      S.messages.forEach((m) => body.append(m.role === 'user' ? meSays(m.text) : elfSays(m.text)));
      if (S.thinking) body.append(waiting());
      if (S.step === 'talk') {
        const row = h('div', 'md-in'); const ta = h('textarea', 'md-ta'); ta.placeholder = 'エルフに返す'; ta.value = S.draft || ''; ta.addEventListener('input', () => { S.draft = ta.value; });
        const send = h('button', 'md-btn main', '送る'); send.type = 'button'; send.addEventListener('click', () => talk(ta.value));
        row.append(ta, micButton(ta), send); body.append(row);
        const a = acts(); btn(a, '別の見方にする', () => { S.step = 'views'; render(); }); btn(a, '気持ちを確かめる', () => { S.step = 'close'; render(); }, true);
      } else {
        body.append(h('div', 'md-lab', 'いまの気持ちは、どう変わりましたか'));
        body.append(chips(AFTER, S.after, () => {}));
        if (S.closing) {
          body.append(elfSays(S.closing.farewell || 'ここまで、よく言葉にしてくれました。'));
          body.append(h('div', 'md-lab', '題名'));
          const t = h('input', 'md-ta'); t.style.minHeight = '42px'; t.value = S.title; t.addEventListener('input', () => { S.title = t.value; }); body.append(t);
          body.append(h('div', 'md-lab', '反対の見方（見えたこと）'));
          const o = h('textarea', 'md-ta'); o.value = S.opposite; o.addEventListener('input', () => { S.opposite = o.value; }); body.append(o);
          body.append(h('div', 'md-lab', '結論（自分の言葉に直してください）'));
          const c = h('textarea', 'md-ta'); c.value = S.conclusion; c.addEventListener('input', () => { S.conclusion = c.value; }); body.append(c);
          body.append(h('div', 'md-lab', '主題'));
          body.append(chips(THEMES, S.themes, () => {}));
          body.append(h('div', 'md-lab', 'もう一度観測する日'));
          const nx = h('div', 'md-chips'); NEXTS.forEach(([label, n]) => { const b2 = h('button', '', label); b2.type = 'button'; b2.setAttribute('aria-pressed', S.next === n ? 'true' : 'false'); b2.addEventListener('click', () => { S.next = n; nx.querySelectorAll('button').forEach((x) => x.setAttribute('aria-pressed', x === b2 ? 'true' : 'false')); }); nx.append(b2); }); body.append(nx);
          if (!S.diaryPageId) { const lb = h('label', 'md-lab'); lb.style.display = 'flex'; lb.style.gap = '8px'; lb.style.alignItems = 'center'; const cb = document.createElement('input'); cb.type = 'checkbox'; cb.checked = S.writeDiary; cb.addEventListener('change', () => { S.writeDiary = cb.checked; }); lb.append(cb, document.createTextNode('感情日記にも残す（自動思考・検証・結論・結果をいつもの形で）')); body.append(lb); }
          const a = acts(); btn(a, '心の記録に残す', save, true);
        } else {
          const a = acts(); btn(a, '対話にもどる', () => { S.step = 'talk'; render(); }); btn(a, 'まとめてもらう', closeUp, true);
        }
      }
      body.scrollTop = body.scrollHeight;
      return;
    }
    if (S.step === 'done') {
      body.append(elfSays(S.doneText || '心の記録に残しました。またいつでも来てください。'));
      const a = acts(); btn(a, 'もうひとつ話す', () => { S = fresh(); S.step = 'event'; render(); }, true); btn(a, '閉じる', close);
      if (S.saved && S.saved.pageId) { const l = h('a', 'md-btn', 'Notionで見る'); l.href = 'https://www.notion.so/' + S.saved.pageId.replace(/-/g, ''); l.target = '_blank'; l.rel = 'noopener'; l.style.display = 'inline-flex'; l.style.alignItems = 'center'; l.style.textDecoration = 'none'; a.append(l); }
    }
  }
  // 思い出した記録（似た記録）と、その後の自分
  function memCards(body) {
    const c = S.context; if (!c) return;
    const card = (r) => { const b2 = h('button', 'md-view'); b2.type = 'button'; b2.append(h('em', '', r.source + '　' + r.date), h('b', '', r.title || '（題名なし）'), h('span', '', [(r.emotions || []).join('・'), r.thought && '考え：' + r.thought].filter(Boolean).join('　'))); const more = h('small', '', [r.view && '見方：' + r.view, r.conclusion && '結論：' + r.conclusion, r.after && r.after.length && 'その後：' + r.after.join('・')].filter(Boolean).join('\n')); more.style.display = 'none'; more.style.whiteSpace = 'pre-wrap'; b2.append(more); b2.addEventListener('click', () => { more.style.display = more.style.display === 'none' ? 'block' : 'none'; }); return b2; };
    if (c.later && c.later.length) { body.append(h('div', 'md-lab', 'その後のあなた（この日より後の、似た記録）')); c.later.forEach((r) => body.append(card(r))); }
    if (c.similar && c.similar.length) { body.append(h('div', 'md-lab', '思い出した記録（タップで中身）')); c.similar.forEach((r) => body.append(card(r))); }
    if (c.diary && !c.diary.ok) body.append(h('p', 'md-note', c.diary.message || '感情日記が読めませんでした'));
  }
  async function loadContext() {
    try { S.context = await api('/api/mind', { method: 'POST', body: JSON.stringify({ action: 'context', event: S.event, emotions: S.emotions, autoThought: S.autoThought, since: S.since, diaryPageId: S.diaryPageId }) }); } catch (e) { S.context = null; }
  }
  async function revisit(r) {
    S = fresh(); S.event = r.event || r.title; S.emotions = (r.emotions || []).slice(); S.autoThought = r.autoThought || ''; S.since = r.date; S.input = '過去の日記';
    S.step = 'listen'; S.elf = ''; render();
    await loadContext();
    S.elf = r.date + 'に観測した出来事です。そのときの結論は「' + (r.conclusion || '（なし）') + '」でした。いまの位置から、もう一度眺めてみましょう。'; render();
  }
  const fail = (e) => { S.thinking = false; toast('エルフに届きませんでした：' + String(e.message || e).slice(0, 70)); render(); };
  async function listen() {
    S.step = 'listen'; S.elf = ''; render();
    await loadContext();
    try { const j = await ai('listen'); if (j.crisis) { S.crisis = j; render(); return; } S.elf = j.reply || 'お話ししてくれて、ありがとう。'; if (j.autoThought && !S.autoThought) S.autoThought = j.autoThought; render(); speak(S.elf); }
    catch (e) { S.step = 'event'; fail(e); }
  }
  async function views() {
    S.step = 'views'; S.views = []; render();
    try { const j = await ai('views'); if (j.crisis) { S.crisis = j; render(); return; } S.views = (j.views || []).slice(0, 4); S.viewsIntro = j.intro || ''; if (!S.views.length) throw new Error('見方を作れませんでした'); render(); }
    catch (e) { S.step = 'listen'; fail(e); }
  }
  function chooseView(v) {
    S.view = v; if (!S.conditions.includes(v.condition)) S.conditions.push(v.condition);
    S.opposite = [S.opposite, v.condition + '：' + v.text].filter(Boolean).join('\n');
    S.messages.push({ role: 'elf', text: v.text + (v.question ? '\n\n' + v.question : '') });
    S.step = 'talk'; render();
  }
  async function talk(text) {
    const t = String(text || '').trim(); if (!t || S.thinking) return;
    S.messages.push({ role: 'user', text: t }); S.draft = ''; S.thinking = true; render();
    try { const j = await ai('talk'); S.thinking = false; if (j.crisis) { S.crisis = j; render(); return; } S.messages.push({ role: 'elf', text: j.reply || '…' }); render(); speak(j.reply); }
    catch (e) { fail(e); }
  }
  async function closeUp() {
    if (!S.after.length) { toast('いまの気持ちを、ひとつ選んでください'); return; }
    S.thinking = true; render();
    try { const j = await ai('close'); S.thinking = false; if (j.crisis) { S.crisis = j; render(); return; } S.closing = j; S.themes = (j.themes || []).filter((t) => THEMES.includes(t)); S.conclusion = j.conclusion || ''; S.title = j.title || S.event.slice(0, 20); if (j.opposite) S.opposite = j.opposite; render(); speak(j.farewell); }
    catch (e) { fail(e); }
  }
  async function save() {
    try {
      const refs = S.context ? [...(S.context.similar || []), ...(S.context.later || [])].filter((r) => r.source === '感情日記').map((r) => r.pageId) : [];
      const j = await api('/api/mind', { method: 'POST', body: JSON.stringify({ action: 'save', record: { title: S.title, event: S.event, input: S.input, emotions: S.emotions, autoThought: S.autoThought, conditions: S.conditions, opposite: S.opposite, conclusion: S.conclusion, after: S.after, messages: S.messages, diaryPageId: S.diaryPageId, refs, themes: S.themes, next: S.next ? addDays(S.next) : '', writeDiary: S.writeDiary } }) });
      S.saved = j.record; history.unshift(j.record);
      const st = j.status || {};
      const lines = ['心の部屋に残しました。'];
      if (st.diary === 'created') lines.push('感情日記にも書きました。');
      else if (st.diary === 'linked') lines.push('見直した感情日記とつなぎました。');
      else if (String(st.diary).startsWith('failed')) lines.push('感情日記には書けませんでした（' + String(st.diary).replace('failed: ', '') + '）。');
      if (st.refs) lines.push('参考にした記録' + st.refs + '件とつなぎました。');
      if (String(st.link).startsWith('failed')) lines.push('つながりは保存できませんでした（' + String(st.link).replace('failed: ', '') + '）。');
      if (S.next) lines.push(addDays(S.next) + 'に、もう一度観測しましょう。');
      S.doneText = ((S.closing && S.closing.farewell) || '') + '\n\n' + lines.join('\n'); S.step = 'done'; render(); toast('記録を残しました');
      loadHistory();
    } catch (e) { toast('残せませんでした：' + String(e.message).slice(0, 60)); }
  }
  async function openDiary() {
    S = fresh(); S.step = 'diary'; render();
    try { S.diary = await api('/api/mind?diary=1'); } catch (e) { S.diary = { available: false, message: '読み込めませんでした：' + e.message }; }
    render();
  }
  function pickDiary(r) {
    S = fresh(); S.input = '過去の日記'; S.diaryPageId = r.pageId;
    S.event = r.title || '（この日の出来事）'; S.emotions = r.emotions.filter((e) => BEFORE.includes(e)); if (!S.emotions.length) S.emotions = r.emotions.slice(0, 3);
    S.autoThought = r.autoThought || ''; S.diaryText = [r.autoThought && '自動思考：' + r.autoThought, r.check && '検証：' + r.check, r.conclusion && '結論：' + r.conclusion].filter(Boolean).join('／');
    S.since = (r.date || '').slice(0, 10); loadContext().then(() => { if (S.step === 'listen') render(); });
    S.step = 'listen'; S.elf = (r.date || '').slice(0, 10) + 'の記録ですね。そのときの考えを、もう一度ここに置いてみましょう。違う観測条件から眺めると、何が見えるでしょう。';
    render();
  }
  function open() { el.classList.add('open'); render(); loadHistory().then(() => { if (S.step === 'home') render(); }); }
  function close() { el.classList.remove('open'); if (rec) rec.stop(); if (audio) { audio.pause(); audio = null; } }
  $('mdClose').addEventListener('click', close);
  let histLoaded = false;

  // ---------------- 毎フレーム：近づくとエルフが庵で待っている
  let summoned = false;
  function update(dt, time, player) {
    if (!player) return;
    const d = Math.hypot(player.x - hx, player.z - hz);
    if (!histLoaded && d < 25) { histLoaded = true; loadHistory(); }
    if (elf && elf.summon) {
      if (d < 11 && !summoned) summoned = !!elf.summon(ELF_SPOT);
      else if (d > 16 && summoned) { elf.release(); summoned = false; }
    }
    andonMat.emissiveIntensity = 1.0 + Math.sin(time * 1.7) * 0.08;
  }
  const ray = new THREE.Raycaster(); ray.far = 9;
  const center = new THREE.Vector2(0, 0);
  const targets = [plaque, sW, sN, table, andon];
  function hitTest(ndc, camera) { ray.setFromCamera(ndc || center, camera); return ray.intersectObjects(targets, false)[0] || null; }
  function hint(camera) { const hh = hitTest(null, camera); return hh ? ['心の部屋', '　タップでエルフと話す'] : null; }
  function pick(ndc, camera) { if (!hitTest(ndc, camera)) return false; open(); return true; }
  return { update, hint, pick, open, close, get count() { return history.length; } };
}
