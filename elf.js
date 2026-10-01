// たまにどこかに現れる、ひとりのエルフ
// 今は図書館の住人と同じ作りの人形を、エルフらしく仕立てて使う（尖った耳・長い銀の髪・金の額飾り・若葉色の衣）。
// public/models/elf.glb を置くと、そちらのリアルなモデルに自動で差し替わる。
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { CHAR_SCALE } from './characters.js';
import { RECS, isRead } from './books.js';
import { rand, pick } from './util.js';

const faceTo = (x, z, tx, tz) => Math.atan2(tx - x, tz - z);
const SPOTS = [
  { x: -36.6, z: 41.6, ry: faceTo(-36.6, 41.6, -48, 31), pose: 'gaze', text: '湖を静かに見つめている', hours: [5, 20] },
  { x: -60.5, z: 34, ry: faceTo(-60.5, 34, -48, 31), pose: 'read', text: '湖の岸辺で', hours: [6, 19] },
  { x: 0, z: -20.3, ry: Math.PI, pose: 'gaze', text: '薔薇窓を見上げている', hours: [0, 24], look: 0.5 },
  { x: -20.2, z: -32.5, ry: Math.PI, pose: 'read', text: '論文の間の書架の前で', hours: [0, 24] },
  { x: -3.5, z: 30.4, ry: 0, pose: 'gaze', text: '噴水の水音に耳を澄ませている', hours: [6, 23] },
  { x: -30.6, z: 11.6, ry: faceTo(-30.6, 11.6, -33, 14), pose: 'read', text: '焚き火の明かりで', hours: [18, 24] },
  { x: 4.4, z: 0, ry: Math.PI / 2, pose: 'gaze', text: 'ステンドグラスの光を眺めている', hours: [7, 17] },
];
const inHours = (h, [a, b]) => h >= a && h < b;

// 紫の衣を真珠色の白いドレスに染め直す（モデルの絵を描き替える）
function elvenTexture(map) {
  const img = map && map.image;
  if (!img || !img.width) return null;
  const c = document.createElement('canvas');
  c.width = img.width; c.height = img.height;
  const g = c.getContext('2d');
  g.drawImage(img, 0, 0);
  const d = g.getImageData(0, 0, c.width, c.height);
  const p = d.data;
  for (let i = 0; i < p.length; i += 4) {
    const r = p[i] / 255, gg = p[i + 1] / 255, b = p[i + 2] / 255;
    const mx = Math.max(r, gg, b), mn = Math.min(r, gg, b), l = (mx + mn) / 2, dd = mx - mn;
    if (dd < 0.08) continue;
    let h;
    if (mx === r) h = ((gg - b) / dd) % 6; else if (mx === gg) h = (b - r) / dd + 2; else h = (r - gg) / dd + 4;
    h *= 60; if (h < 0) h += 360;
    if (h > 230 && h < 330) {
      // 紫 → 真珠色の白いドレス（濃いところは銀灰、明るいところは白）
      const t = l < 0.45 ? [0.78, 0.8, 0.84] : [0.98, 0.97, 0.94];
      const k = l < 0.45 ? 0.72 + l * 0.5 : 0.9 + (l - 0.45) * 0.2;
      p[i] = Math.min(255, t[0] * 255 * k * 1.25); p[i + 1] = Math.min(255, t[1] * 255 * k * 1.25); p[i + 2] = Math.min(255, t[2] * 255 * k * 1.25);
    }
  }
  g.putImageData(d, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.flipY = map.flipY; t.encoding = map.encoding; t.magFilter = map.magFilter; t.minFilter = map.minFilter;
  return t;
}

// 耳・髪・額飾りを頭の骨に付ける
function adorn(head) {
  const skin = new THREE.MeshStandardMaterial({ color: 0xf1d2b8, roughness: 0.6 });
  const hair = new THREE.MeshStandardMaterial({ color: 0xf6ecd2, roughness: 0.32, metalness: 0.12, emissive: 0x3a3220, emissiveIntensity: 0.45 });
  const gold = new THREE.MeshStandardMaterial({ color: 0xe4e8ee, roughness: 0.18, metalness: 0.95 });
  const gem = new THREE.MeshStandardMaterial({ color: 0xd8f2ff, roughness: 0.05, metalness: 0.1, emissive: 0x9fd8ff, emissiveIntensity: 0.9 });
  [-1, 1].forEach((s) => {
    const ear = new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.55, 10), skin);
    ear.scale.set(1, 1, 0.45);
    ear.position.set(s * 0.6, 0.42, -0.05);
    ear.rotation.set(-0.35, 0, -s * 1.05);
    ear.castShadow = true;
    head.add(ear);
  });
  const cap = new THREE.Mesh(new THREE.SphereGeometry(0.6, 24, 16, 0, Math.PI * 2, 0, Math.PI * 0.55), hair);
  cap.scale.set(0.98, 0.95, 1.08); cap.position.set(0, 0.42, -0.08); head.add(cap);
  for (let i = 0; i < 11; i++) {
    const a = (i / 10 - 0.5) * 2.3;
    const len = 1.45 + Math.cos(a) * 0.3;
    const strand = new THREE.Mesh(new THREE.BoxGeometry(0.16, len, 0.07), hair);
    strand.position.set(Math.sin(a) * 0.48, 0.42 - len / 2 + 0.1, -0.42 - Math.cos(a) * 0.18);
    strand.rotation.set(0.12, a * 0.25, Math.sin(a) * 0.08);
    strand.castShadow = true;
    head.add(strand);
  }
  // 顔の横に垂れる髪
  [-1, 1].forEach((s) => { const lock = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.0, 0.08), hair); lock.position.set(s * 0.5, -0.05, 0.2); lock.rotation.z = s * 0.06; head.add(lock); });
  // 銀の額飾り（葉の透かし模様と、雫形の宝石）
  const circlet = new THREE.Mesh(new THREE.TorusGeometry(0.585, 0.02, 8, 48), gold);
  circlet.rotation.x = Math.PI / 2 - 0.12; circlet.position.set(0, 0.62, -0.02); head.add(circlet);
  for (let i = -3; i <= 3; i++) {
    if (!i) continue;
    const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), gold);
    const a = i * 0.16;
    leaf.scale.set(0.5, 1.4, 0.3); leaf.position.set(Math.sin(a) * 0.58, 0.66 + (3 - Math.abs(i)) * 0.012, Math.cos(a) * 0.58); leaf.rotation.z = -a * 1.4; head.add(leaf);
  }
  const g = new THREE.Mesh(new THREE.OctahedronGeometry(0.06), gem); g.scale.set(0.8, 1.4, 0.8); g.position.set(0, 0.58, 0.58); head.add(g);
}

export function createElf({ scene }) {
  let actor = null;          // { root, mixer, play }
  let mats = [];
  let state = 'away', timer = rand(45, 100), spot = null, opacity = 0, rec = null, castT = rand(15, 40);
  // 現れるときの光の粒
  const N = 70;
  const pos = new Float32Array(N * 3), vel = [];
  for (let i = 0; i < N; i++) vel.push({ a: rand(0, 6.28), r: rand(0.2, 0.7), y: rand(0, 2), v: rand(0.2, 0.6) });
  const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const motes = new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xd8fff0, size: 0.045, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
  scene.add(motes);
  const glow = new THREE.PointLight(0xbfffe6, 0, 5, 2);
  scene.add(glow);
  // 手のひらのそばを舞う、小さな光の妖精
  const fairy = new THREE.Group(); scene.add(fairy);
  const spriteTex = (draw) => { const c = document.createElement('canvas'); c.width = c.height = 128; draw(c.getContext('2d')); return new THREE.CanvasTexture(c); };
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: spriteTex((g) => { const r = g.createRadialGradient(64, 64, 2, 64, 64, 64); r.addColorStop(0, 'rgba(255,240,180,1)'); r.addColorStop(0.35, 'rgba(255,220,140,.45)'); r.addColorStop(1, 'rgba(255,220,140,0)'); g.fillStyle = r; g.fillRect(0, 0, 128, 128); }), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
  halo.scale.set(0.5, 0.5, 1); fairy.add(halo);
  const body = new THREE.Sprite(new THREE.SpriteMaterial({ map: spriteTex((g) => { g.fillStyle = '#fff3c8'; g.beginPath(); g.arc(64, 44, 8, 0, Math.PI * 2); g.fill(); g.beginPath(); g.ellipse(64, 70, 7, 18, 0, 0, Math.PI * 2); g.fill(); g.beginPath(); g.moveTo(58, 84); g.lineTo(50, 110); g.lineTo(60, 88); g.fill(); g.beginPath(); g.moveTo(70, 84); g.lineTo(78, 108); g.lineTo(68, 88); g.fill(); }), transparent: true, depthWrite: false }));
  body.scale.set(0.16, 0.16, 1); fairy.add(body);
  const wings = new THREE.Sprite(new THREE.SpriteMaterial({ map: spriteTex((g) => { g.fillStyle = 'rgba(230,250,255,.75)'; [[40, 50, -0.5], [88, 50, 0.5], [44, 78, 0.4], [84, 78, -0.4]].forEach(([x, y, r], i) => { g.beginPath(); g.ellipse(x, y, i < 2 ? 22 : 14, i < 2 ? 12 : 8, r, 0, Math.PI * 2); g.fill(); }); }), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
  wings.scale.set(0.2, 0.16, 1); fairy.add(wings);
  const fairyLight = new THREE.PointLight(0xffe2a0, 0, 2.5, 2); fairy.add(fairyLight);
  fairy.visible = false;
  // 出会ったときに見られる肖像
  const card = document.createElement('div');
  card.id = 'elfCard';
  card.innerHTML = `<div class='ec-in'><img src='/elf-portrait.jpg' alt='森のエルフ'><b>森のエルフ</b><span id='ecText'></span><em>タップで閉じる</em></div>`;
  card.addEventListener('click', () => card.classList.remove('open'));
  document.body.append(card);

  function prepare(root) {
    mats = [];
    root.traverse((o) => {
      if (!o.isMesh) return;
      const arr = Array.isArray(o.material) ? o.material : [o.material];
      const cl = arr.map((m) => { const c = m.clone(); c.transparent = true; c.opacity = 0; c.depthWrite = true; mats.push(c); return c; });
      o.material = Array.isArray(o.material) ? cl : cl[0];
      o.castShadow = true;
    });
    root.visible = false;
    scene.add(root);
  }
  // 住人と同じ作りの人形から、エルフを仕立てる
  function fromCast(cast) {
    const a = cast.spawn('Mage', { gear: [], tint: 0xffffff });
    const inner = a.root.children[0];
    const cache = new Map();
    inner.scale.set(CHAR_SCALE * 0.92, CHAR_SCALE * 1.08, CHAR_SCALE * 0.92);
    a.root.traverse((o) => {
      if (o.name === 'Mage_Hat') o.visible = false;
      if (o.isMesh && o.material && o.material.map) {
        const img = o.material.map.image;
        if (!cache.has(img)) cache.set(img, elvenTexture(o.material.map));
        const t = cache.get(img);
        if (t) { o.material.map = t; o.material.needsUpdate = true; }
        o.material.emissive = new THREE.Color(0x0c1a14); o.material.emissiveIntensity = 0.6;
      }
    });
    const head = a.root.getObjectByName('head');
    if (head) adorn(head);
    const book = a.root.getObjectByName('Spellbook_open');
    actor = { root: a.root, mixer: a.mixer, play: (n) => a.play(n), book, kind: 'cast' };
    prepare(a.root);
  }
  // public/models/elf.glb があれば、そちらを使う（リアルなモデルへの差し替え口）
  function tryRealistic(cast) {
    fetch('/models/elf.glb', { method: 'HEAD' }).then((r) => {
      const ok = r.ok && !(r.headers.get('content-type') || '').includes('html');
      if (!ok) { fromCast(cast); return; }
      new GLTFLoader().load('/models/elf.glb', (g) => {
        const root = new THREE.Group();
        root.add(g.scene);
        const box = new THREE.Box3().setFromObject(g.scene);
        const h = box.max.y - box.min.y || 1;
        g.scene.scale.setScalar(1.74 / h);
        g.scene.position.y = -box.min.y * (1.74 / h);
        const mixer = new THREE.AnimationMixer(g.scene);
        const clips = g.animations || [];
        const find = (re) => clips.find((c) => re.test(c.name)) || clips[0];
        let cur = null;
        const play = (n) => { const c = find(n === 'Spellcasting' ? /cast|magic|idle/i : /idle|stand|breath/i); if (!c) return; const act = mixer.clipAction(c); if (cur && cur !== act) cur.fadeOut(0.4); act.reset().fadeIn(0.4).play(); cur = act; };
        actor = { root, mixer, play, kind: 'real' };
        prepare(root);
      }, undefined, () => fromCast(cast));
    }).catch(() => fromCast(cast));
  }
  function attach(cast) { tryRealistic(cast); }

  const fwd = new THREE.Vector3(), tmp = new THREE.Vector3();
  function seen(camera, x, z) {
    camera.getWorldDirection(fwd); fwd.y = 0; fwd.normalize();
    tmp.set(x - camera.position.x, 0, z - camera.position.z); const d = tmp.length(); tmp.divideScalar(d || 1);
    return { d, dot: tmp.dot(fwd) };
  }
  function chooseRec() { const mine = RECS.filter((r) => r.fromLib || isRead(r)); return mine.length ? pick(mine) : null; }

  function update(dt, time, camera, hour) {
    if (!actor) return;
    const r = actor.root;
    if (state === 'away') {
      timer -= dt;
      if (timer > 0) return;
      // 見られていない場所を選んで、そっと現れる
      const cands = SPOTS.filter((s) => inHours(hour, s.hours) && (() => { const v = seen(camera, s.x, s.z); return v.d > 9 || v.dot < 0.3; })());
      if (!cands.length) { timer = 20; return; }
      spot = pick(cands); rec = chooseRec();
      r.position.set(spot.x, 0, spot.z); r.rotation.y = spot.ry; r.visible = true;
      if (actor.book) actor.book.visible = spot.pose === 'read';
      actor.play(spot.pose === 'read' ? 'Idle' : 'Idle');
      state = 'in'; opacity = 0; timer = rand(110, 220);
    }
    if (state === 'in') { opacity = Math.min(1, opacity + dt / 2.5); if (opacity >= 1) state = 'here'; }
    if (state === 'here') {
      timer -= dt;
      castT -= dt;
      if (castT < 0 && actor.kind === 'cast') { castT = rand(25, 60); actor.play('Spellcasting'); setTimeout(() => actor && actor.play('Idle'), 3200); }
      if (timer < 0) state = 'out';
    }
    if (state === 'out') {
      opacity = Math.max(0, opacity - dt / 3);
      if (opacity <= 0) { state = 'away'; r.visible = false; timer = rand(150, 420); }
    }
    mats.forEach((m) => { m.opacity = opacity; m.transparent = opacity < 0.999; });
    if (r.visible) actor.mixer.update(dt);
    // 光の粒と淡い光
    const shimmer = state === 'in' || state === 'out' ? 1 : 0.35;
    motes.material.opacity = r.visible ? Math.min(1, opacity * 1.2) * shimmer + (state === 'in' || state === 'out' ? 0.4 : 0) : 0;
    if (r.visible) {
      for (let i = 0; i < N; i++) {
        const v = vel[i]; v.y += v.v * dt; if (v.y > 2.2) v.y = 0; v.a += dt * 0.6;
        pos[i * 3] = r.position.x + Math.cos(v.a) * v.r; pos[i * 3 + 1] = v.y; pos[i * 3 + 2] = r.position.z + Math.sin(v.a) * v.r;
      }
      sg.attributes.position.needsUpdate = true;
      glow.position.set(r.position.x, 1.6, r.position.z);
    }
    glow.intensity = r.visible ? opacity * (hour < 6 || hour > 18 ? 0.9 : 0.35) * (0.9 + Math.sin(time * 2) * 0.1) : 0;
    // 妖精は、エルフの右手の前をふわふわ舞う
    fairy.visible = r.visible && opacity > 0.05;
    if (fairy.visible) {
      const ry = r.rotation.y, fx = Math.sin(ry), fz = Math.cos(ry), rx = Math.cos(ry), rz = -Math.sin(ry);
      const bob = Math.sin(time * 2.1) * 0.08, sway = Math.sin(time * 1.3) * 0.12;
      fairy.position.set(r.position.x + fx * 0.55 - rx * (0.35 + sway), 1.3 + bob, r.position.z + fz * 0.55 - rz * (0.35 + sway));
      wings.scale.x = 0.2 * (0.55 + Math.abs(Math.sin(time * 22)) * 0.45);
      [halo, body, wings].forEach((sp) => { sp.material.opacity = opacity; });
      fairyLight.intensity = opacity * (hour < 6 || hour > 18 ? 0.9 : 0.4);
    }
  }
  function hint(camera) {
    if (!actor || !actor.root.visible || opacity < 0.5) return null;
    const v = seen(camera, actor.root.position.x, actor.root.position.z);
    if (v.d > 6 || v.dot < 0.9) return null;
    const t = spot.pose === 'read' ? spot.text + (rec ? '『' + String(rec.t).split('－')[0] + '』を' : '本を') + '読んでいる' : spot.text;
    return ['エルフ', '　' + t];
  }
  // 見つめて、タップしたら肖像を見せる
  function pickCard(camera) {
    const h = hint(camera);
    if (!h) return false;
    document.getElementById('ecText').textContent = h[1].trim();
    card.classList.add('open');
    return true;
  }
  return { attach, update, hint, pick: pickCard, get here() { return !!(actor && actor.root.visible); } };
}
