// 快適さの管理：画質の段階（自動・高・中・省エネ）、遅いときの自動調整、放置中の省電力、遠くの施設を描かない。
import * as THREE from 'three';

const KEY = 'my-library:quality:v1';
const TIERS = {
  high: { pr: 2, shadow: true, soft: true, sm: 2048, fps: 60, cull: 70 },
  mid: { pr: 1.25, shadow: true, soft: false, sm: 1024, fps: 60, cull: 55 },
  eco: { pr: 0.9, shadow: false, soft: false, sm: 512, fps: 30, cull: 42 },
};
const ORDER = ['eco', 'mid', 'high'];

export function createPerf({ renderer, scene, camera, sun }) {
  const touch = matchMedia('(pointer: coarse)').matches;
  const weak = (navigator.hardwareConcurrency || 4) <= 4 || (navigator.deviceMemory || 8) <= 4;
  let mode = localStorage.getItem(KEY) || 'auto';
  let tier = mode === 'auto' ? (weak || touch ? 'mid' : 'high') : mode;
  let lastFrame = 0, prevRender = 0, idleSince = performance.now();
  const frames = []; let windowStart = performance.now(), slowWindows = 0, fastWindows = 0, holdUntil = 0;

  function apply() {
    const t = TIERS[tier];
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, t.pr));
    const wasShadow = renderer.shadowMap.enabled, wasType = renderer.shadowMap.type;
    renderer.shadowMap.enabled = t.shadow;
    renderer.shadowMap.type = t.soft ? THREE.PCFSoftShadowMap : THREE.PCFShadowMap;
    if (sun) {
      sun.castShadow = t.shadow;
      if (sun.shadow.mapSize.x !== t.sm) { sun.shadow.mapSize.set(t.sm, t.sm); if (sun.shadow.map) { sun.shadow.map.dispose(); sun.shadow.map = null; } }
    }
    if (wasShadow !== t.shadow || wasType !== renderer.shadowMap.type) scene.traverse((o) => { if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => { m.needsUpdate = true; }); });
    renderUI();
  }

  // ---- 画質の切り替え（空と時間のパネル）
  function renderUI() {
    const seg = document.getElementById('quality'); if (!seg) return;
    seg.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', b.dataset.q === mode ? 'true' : 'false'));
    const note = document.getElementById('qualityNote'); if (note) note.textContent = mode === 'auto' ? 'いまは「' + { high: '高', mid: '中', eco: '省エネ' }[tier] + '」で動いています' : '';
  }
  const env = document.getElementById('env');
  if (env) {
    const lbl = document.createElement('div'); lbl.className = 'lbl'; lbl.innerHTML = '<span>画質</span><output id="qualityNote"></output>';
    const seg = document.createElement('div'); seg.className = 'seg'; seg.id = 'quality';
    [['auto', '自動'], ['high', '高'], ['mid', '中'], ['eco', '省エネ']].forEach(([q, l]) => { const b = document.createElement('button'); b.type = 'button'; b.dataset.q = q; b.textContent = l; b.addEventListener('click', () => { mode = q; localStorage.setItem(KEY, q); tier = q === 'auto' ? tier : q; holdUntil = performance.now() + 15000; apply(); }); seg.append(b); });
    const crowd = document.getElementById('crowd');
    if (crowd && env.insertBefore) { env.insertBefore(lbl, crowd); env.insertBefore(seg, crowd); } else env.append(lbl, seg);
  }
  ['pointerdown', 'keydown', 'touchstart', 'wheel'].forEach((e) => addEventListener(e, () => { idleSince = performance.now(); }, { passive: true }));

  // ---- フレームの間引き（省エネ・放置中）
  function skip(now) {
    const idle = now - idleSince > 25000;
    const cap = idle ? 20 : TIERS[tier].fps;
    if (cap >= 60) { lastFrame = now; return false; }
    if (now - lastFrame < 1000 / cap - 2) return true;
    lastFrame = now; return false;
  }

  // ---- 自動調整：2秒ごとに平均を見て、重ければ一段下げる・軽ければゆっくり上げる
  function measure(now, dt) {
    frames.push(dt);
    if (now - windowStart < 2000) return;
    const avg = frames.reduce((a, b) => a + b, 0) / frames.length; frames.length = 0; windowStart = now;
    if (mode !== 'auto' || now < holdUntil || now - idleSince > 25000) return;
    const cap = 1000 / TIERS[tier].fps;
    if (avg > Math.max(36, cap * 1.25)) { slowWindows++; fastWindows = 0; } else if (avg < 18) { fastWindows++; slowWindows = 0; } else { slowWindows = 0; fastWindows = 0; }
    const i = ORDER.indexOf(tier);
    if (slowWindows >= 2 && i > 0) { tier = ORDER[i - 1]; slowWindows = 0; holdUntil = now + 30000; apply(); }
    else if (fastWindows >= 8 && i < ORDER.length - 1 && !(touch && tier === 'mid')) { tier = ORDER[i + 1]; fastWindows = 0; holdUntil = now + 20000; apply(); }
  }

  // ---- 遠くの施設と灯りを描かない（キャラクターと空・地面・森は対象外）
  const tmp = new THREE.Box3(), sph = new THREE.Sphere();
  const info = new Map(); let nextCull = 0, nextRescan = 0;
  function scan() {
    info.clear();
    for (const o of scene.children) {
      if (o.isLight) { if ((o.isPointLight || o.isSpotLight) && o.distance > 0) info.set(o, { light: true, r: o.distance }); continue; }
      if (o === camera || o.userData.noCull) continue;
      let skinned = false; o.traverse((c) => { if (c.isSkinnedMesh || c.isInstancedMesh) skinned = true; });
      if (skinned) continue;
      tmp.setFromObject(o); if (tmp.isEmpty()) continue;
      tmp.getBoundingSphere(sph);
      if (sph.radius < 1.5 || sph.radius > 30 || sph.center.x < -80 || sph.center.x > 100 || sph.center.z < -70 || sph.center.z > 75) continue;
      info.set(o, { c: sph.center.clone(), r: sph.radius });
    }
  }
  function cull(now) {
    if (now < nextCull) return; nextCull = now + 500;
    if (now > nextRescan) { scan(); nextRescan = now + 30000; }
    const p = camera.position, lim = TIERS[tier].cull;
    for (const [o, v] of info) {
      const c = v.light ? o.position : v.c;
      const d = Math.hypot(c.x - p.x, c.z - p.z) - (v.light ? v.r : v.r);
      const far = d > (v.light ? 12 : lim);
      if (far && o.visible) { o.visible = false; o.userData.__culled = true; }
      else if (!far && o.userData.__culled) { o.visible = true; o.userData.__culled = false; }
    }
  }

  apply();
  setTimeout(() => { nextRescan = 0; }, 6000); // 施設がそろってから測り直す
  return {
    // ループの先頭で呼ぶ。true なら、この回は描かずに休む
    frame() { const now = performance.now(); if (skip(now)) return false; if (prevRender) measure(now, now - prevRender); prevRender = now; cull(now); return true; },
    get tier() { return tier; },
  };
}
