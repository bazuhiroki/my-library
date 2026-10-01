// 背表紙の書名。すべての書名を縦書きで1枚のテクスチャ（アトラス）に描き、本ごとに自分の区画を貼る
import * as THREE from 'three';

const W = 2048, H = 4096, CW = 22, CH = 200;
const COLS = Math.floor(W / CW), ROWS = Math.floor(H / CH), CAP = COLS * ROWS;
const ROTATE = /[ー－―─—〜～…‥（）()「」『』【】\-~]/; // 縦書きで90度回す文字
const FONT = '"Shippori Mincho B1", "Hiragino Mincho ProN", "Yu Mincho", serif';

const latin = (s) => { const a = Array.from(s || ''); let n = 0; for (const c of a) if (c.charCodeAt(0) < 0x2e80) n++; return a.length > 0 && n > a.length * 0.7; };
export const spineTitle = (t) => {
  const main = (t || '').split(/[－―]/)[0].replace(/[（(][^）)]*[）)]/g, '').replace(/^[「『]|[」』]$/g, '').trim() || t;
  if (latin(main)) return main.length > 60 ? main.slice(0, 59) + '…' : main;
  return main.length > 15 ? main.slice(0, 14) + '…' : main;
};

export function createSpineAtlas(anisotropy = 4) {
  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d');
  const tex = new THREE.CanvasTexture(canvas);
  tex.anisotropy = anisotropy;
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  const titles = [];
  let dirty = false;

  function draw(i) {
    const x0 = (i % COLS) * CW, y0 = Math.floor(i / COLS) * CH;
    ctx.clearRect(x0, y0, CW, CH);
    const s = titles[i]; if (!s) return;
    if (latin(s)) {
      ctx.save();
      ctx.beginPath(); ctx.rect(x0, y0, CW, CH); ctx.clip();
      ctx.translate(x0 + CW / 2, y0 + CH * 0.1);
      ctx.rotate(Math.PI / 2);
      ctx.fillStyle = '#fff'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
      const room = CH * 0.8;
      let fs = 14;
      ctx.font = '700 ' + fs + 'px Georgia, serif';
      while (ctx.measureText(s).width > room && fs > 9) { fs--; ctx.font = '700 ' + fs + 'px Georgia, serif'; }
      let text = s;
      let cut = s.length;
      while (ctx.measureText(text).width > room && cut > 4) { cut--; text = s.slice(0, cut) + '…'; }
      ctx.fillText(text, 0, 0);
      ctx.restore();
      return;
    }
    const chars = [...s];
    const top = y0 + CH * 0.13, room = CH * 0.74;
    const fs = Math.max(10, Math.min(17, Math.floor(room / (chars.length * 1.02))));
    ctx.save();
    ctx.beginPath(); ctx.rect(x0, y0, CW, CH); ctx.clip();
    ctx.fillStyle = '#fff';
    ctx.font = `800 ${fs}px ${FONT}`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const used = chars.length * fs * 1.02;
    let y = top + Math.max(0, (room - used) * 0.15) + fs / 2;
    for (const ch of chars) {
      if (ROTATE.test(ch)) { ctx.save(); ctx.translate(x0 + CW / 2, y); ctx.rotate(Math.PI / 2); ctx.fillText(ch, 0, 0); ctx.restore(); }
      else ctx.fillText(ch, x0 + CW / 2, y);
      y += fs * 1.02;
    }
    ctx.restore();
  }
  function add(title) {
    if (titles.length >= CAP) return -1;
    titles.push(spineTitle(title));
    draw(titles.length - 1); dirty = true;
    return titles.length - 1;
  }
  // テクスチャ座標 [u0, v0, 幅, 高さ]（canvas は上下反転して貼られる）
  function rect(i) {
    const col = i % COLS, row = Math.floor(i / COLS);
    return [col * CW / W, 1 - (row + 1) * CH / H, CW / W, CH / H];
  }
  function redrawAll() { for (let i = 0; i < titles.length; i++) draw(i); dirty = true; }
  function flush() { if (dirty) { tex.needsUpdate = true; dirty = false; } }
  return { tex, add, rect, redrawAll, flush };
}

// 本の材質に「背表紙の面にだけ書名を重ねる」処理を足す
export function patchSpineMaterial(material, atlasTex) {
  material.onBeforeCompile = (shader) => {
    shader.uniforms.spineAtlas = { value: atlasTex };
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec4 atlasRect;\nattribute float spineSign;\nvarying vec2 vAtlasUv;\nvarying float vIsSpine;')
      .replace('#include <uv_vertex>', '#include <uv_vertex>\nvAtlasUv = atlasRect.xy + uv * atlasRect.zw;\nvIsSpine = step(0.5, normal.x * spineSign) * step(0.00001, atlasRect.z);');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform sampler2D spineAtlas;\nvarying vec2 vAtlasUv;\nvarying float vIsSpine;')
      .replace('#include <color_fragment>', `#include <color_fragment>
      if (vIsSpine > 0.5) {
        float ink = texture2D(spineAtlas, vAtlasUv).a;
        float lum = dot(diffuseColor.rgb, vec3(0.299, 0.587, 0.114));
        vec3 inkColor = lum > 0.28 ? vec3(0.06, 0.04, 0.03) : vec3(0.93, 0.78, 0.45);
        diffuseColor.rgb = mix(diffuseColor.rgb, inkColor, ink * 0.95);
      }`);
  };
  material.customProgramCacheKey = () => 'spine-titles-v1';
  material.needsUpdate = true;
}
