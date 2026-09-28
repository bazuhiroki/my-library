// 登場人物（KayKit Adventurers / CC0）の読み込みと、共有アニメーションの再生
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { SkeletonUtils } from 'three/examples/jsm/utils/SkeletonUtils.js';
const cloneSkinned = (o) => SkeletonUtils.clone(o);

const URLS = {
  Knight: new URL('./models/Knight.glb', import.meta.url).href,
  Mage: new URL('./models/Mage.glb', import.meta.url).href,
  Rogue: new URL('./models/Rogue.glb', import.meta.url).href,
  Rogue_Hooded: new URL('./models/Rogue_Hooded.glb', import.meta.url).href,
  Barbarian: new URL('./models/Barbarian.glb', import.meta.url).href,
  anims: new URL('./models/anims.glb', import.meta.url).href,
};

// 手に持たせる小物（名前はモデル内のノード名）
const GEAR = {
  Knight: ['1H_Sword_Offhand', 'Badge_Shield', 'Rectangle_Shield', 'Round_Shield', 'Spike_Shield', '1H_Sword', '2H_Sword'],
  Mage: ['Spellbook', 'Spellbook_open', '1H_Wand', '2H_Staff'],
  Rogue: ['Knife_Offhand', '1H_Crossbow', '2H_Crossbow', 'Knife', 'Throwable'],
  Rogue_Hooded: ['Knife_Offhand', '1H_Crossbow', '2H_Crossbow', 'Knife', 'Throwable'],
  Barbarian: ['1H_Axe_Offhand', 'Barbarian_Round_Shield', '1H_Axe', '2H_Axe', 'Mug'],
};

// モデル単位 → メートル。頭頂が約1.8mになる倍率
export const CHAR_SCALE = 0.85;
// 歩行アニメ1周期で進む距離（m/秒、timeScale=1のとき）
export const WALK_SPEED_AT_1X = 0.58;

export async function loadCast(onProgress) {
  const loader = new GLTFLoader();
  const names = Object.keys(URLS);
  let done = 0;
  const loaded = await Promise.all(names.map((n) => new Promise((res, rej) => {
    loader.load(URLS[n], (g) => { done++; onProgress && onProgress(done / names.length); res([n, g]); }, undefined, rej);
  })));
  const src = Object.fromEntries(loaded);
  const clips = {};
  src.anims.animations.forEach((c) => { clips[c.name] = c; });

  function spawn(model, { gear = [], tint = null } = {}) {
    const root = cloneSkinned(src[model].scene);
    root.scale.setScalar(CHAR_SCALE);
    const holder = new THREE.Group();
    holder.add(root);
    root.traverse((o) => {
      if (o.isMesh) {
        o.castShadow = true;
        o.receiveShadow = true;
        o.frustumCulled = false;
        if (tint) { o.material = o.material.clone(); o.material.color.multiply(new THREE.Color(tint)); }
      }
      if (GEAR[model].includes(o.name)) o.visible = gear.includes(o.name);
    });
    const mixer = new THREE.AnimationMixer(root);
    const actions = {};
    let current = null;
    function play(name, { fade = 0.35, loop = true, timeScale = 1 } = {}) {
      const clip = clips[name];
      if (!clip) return null;
      let a = actions[name];
      if (!a) { a = actions[name] = mixer.clipAction(clip); }
      a.timeScale = timeScale;
      if (current === a && loop) return a;
      if (current === a) { a.reset().play(); return a; }
      a.reset();
      a.setLoop(loop ? THREE.LoopRepeat : THREE.LoopOnce, loop ? Infinity : 1);
      a.clampWhenFinished = !loop;
      a.enabled = true;
      a.play();
      if (current) current.crossFadeTo(a, fade, false);
      current = a;
      return a;
    }
    function setSpeed(ts) { if (current) current.timeScale = ts; }
    const api = { root: holder, mixer, play, setSpeed, model, get current() { return current; } };
    holder.userData.actor = api;
    return api;
  }
  return { spawn, clips };
}
