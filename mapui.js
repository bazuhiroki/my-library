// 館内案内図：3Dの案内板の絵と、画面の地図（タップで一瞬で移動）
import * as THREE from 'three';
import { WARPS } from './world.js';

const VX0 = -74, VZ0 = -42, VW = 120, VH = 92;
const MINCHO = `'Shippori Mincho B1', 'Hiragino Mincho ProN', serif`;
const EAST_SEGS = [[-21.2, -17.55], [-14.45, -9.55], [-6.45, -1.55], [1.55, 6.45], [9.55, 14.45], [17.55, 21.2]];

// 図の部品（ワールド座標）
const RECTS = [
  { x0: -72, x1: -24.2, z0: 4, z1: 58, fill: '#86a565' },
  { x0: -44.2, x1: -34.6, z0: 30.2, z1: 31.8, fill: '#8a6a4a' },
  { x0: 18.7, x1: 23.3, z0: 43.6, z1: 45.6, fill: '#6b4a33' },
  { x0: -24, x1: -23.2, z0: 26.5, z1: 35.6, fill: '#3b5a34' },
  { x0: -24, x1: -23.2, z0: 40.4, z1: 46.5, fill: '#3b5a34' },
  { x0: 6.6, x1: 42.6, z0: -40, z1: 40, fill: '#bdb29c' },
  { x0: -24.4, x1: 6.6, z0: 22.6, z1: 48.6, fill: '#c7bda9' },
  { x0: 6.6, x1: 42.6, z0: 40.6, z1: 48.6, fill: '#c7bda9' },
  { x0: -6.6, x1: 6.6, z0: -22.6, z1: 22.6, fill: '#5a3d28' },
  { x0: -6, x1: 6, z0: -22, z1: 22, fill: '#efe4cc' },
  { x0: -30.6, x1: 30.6, z0: -35.2, z1: -22.6, fill: '#5a3d28' },
  { x0: -30, x1: -6.2, z0: -34.6, z1: -23.2, fill: '#b9c6d8' },
  { x0: -5.8, x1: 5.8, z0: -34.6, z1: -22.6, fill: '#f3ecdc' },
  { x0: 6.2, x1: 30, z0: -34.6, z1: -23.2, fill: '#ecd3ae' },
  { x0: -1.5, x1: 1.5, z0: -22.8, z1: -21.8, fill: '#f3ecdc' },
  { x0: -1.6, x1: 1.6, z0: 21.8, z1: 22.8, fill: '#efe4cc' },
  { x0: -6, x1: -5.1, z0: -21.2, z1: 21.2, fill: '#7a1f1f' },
  ...EAST_SEGS.map(([a, b]) => ({ x0: 5.1, x1: 6, z0: a, z1: b, fill: '#2c3d6b' })),
  { x0: -30, x1: -7, z0: -34.6, z1: -34, fill: '#3a4a6a' },
  { x0: 6.8, x1: 29.1, z0: -34.6, z1: -34, fill: '#a0522d' },
  { x0: -6, x1: -3.1, z0: 17.8, z1: 19.0, fill: '#6b4a33' },
  { x0: 3.1, x1: 6, z0: 17.8, z1: 19.0, fill: '#6b4a33' },
  ...[-14, -4.5, 5].map((z) => ({ x0: -0.75, x1: 0.75, z0: z - 3, z1: z + 3, fill: '#8a6a52' })),
  ...[-27.2, -16.2].map((x) => ({ x0: x, x1: x + 5.4, z0: -29.3, z1: -27.9, fill: '#8a6a52' })),
  ...[-1, 1].map((s) => ({ x0: s * 9.3 - 2.6, x1: s * 9.3 + 2.6, z0: 22.7, z1: 27.9, fill: '#8d8474' })),
];
const ELLIPSES = [
  { x: -48, z: 31, rx: 14.8, rz: 10.8, fill: '#d8c79c' },
  { x: -48, z: 31, rx: 13, rz: 9, fill: '#4f8fb0' },
];
const CIRCLES = [
  { x: -33, z: 14, r: 2.6, fill: '#c97a3a' },
  { x: -29.5, z: 28, r: 1.2, fill: '#efe2c4' },
  { x: -31, z: 51, r: 1.2, fill: '#efe2c4' },
  { x: 0, z: 14.5, r: 0.9, fill: '#2e4d6b' },
  { x: 0, z: 11.6, r: 1.0, fill: '#6b4a33' },
  { x: -3.5, z: 34.5, r: 2.5, fill: '#6fa3c0' },
  { x: 0, z: -29.2, r: 2.3, fill: '#e3d3a8' },
  { x: 13.2, z: -27.6, r: 0.7, fill: '#d8cfbf' },
  { x: 21.8, z: -27.9, r: 0.7, fill: '#d8cfbf' },
];
const LABELS = {
  door: [0, 20.4, '大扉'], borrow: [-4.4, 16.6, '貸出'], buy: [4.4, 16.6, '購入'], globe: [0, 14.5, '地球儀'],
  pile: [0, 11.6, '読みたい本'], loan: [-3.2, 0, '貸出の記録'], prize: [3.2, -4, '文学賞'], rose: [0, -20.2, '薔薇窓'],
  lobby: [0, -26.2, '玄関ホール'], papers: [-18, -29, '論文の間'], mags: [18, -29, '雑誌の回廊'],
  court0: [0, 27, '前庭'], fountain: [-3.5, 38.6, '噴水'], court: [24, 5, '中庭'],
  lake: [-48, 31, '湖'], camp: [-33, 10.5, '焚き火'], cafe: [-27, 25.5, 'カフェ'], beer: [21, 41.5, 'ビアガーデン'],
};
const AREA = { hall: '本の大広間', annex: '北の翼廊', out: '外' };

const sx = (x, k) => (x - VX0) * k;
const sz = (z, k) => (z - VZ0) * k;

// ---- 3Dの案内板に貼る絵
export function createMapTexture() {
  const k = 12.8;
  const c = document.createElement('canvas');
  c.width = Math.round(VW * k); c.height = Math.round(VH * k);
  const g = c.getContext('2d');
  const tex = new THREE.CanvasTexture(c);
  tex.anisotropy = 4;
  function draw() {
    g.fillStyle = '#6f8a55'; g.fillRect(0, 0, c.width, c.height);
    RECTS.forEach((r) => { g.fillStyle = r.fill; g.fillRect(sx(r.x0, k), sz(r.z0, k), (r.x1 - r.x0) * k, (r.z1 - r.z0) * k); });
    ELLIPSES.forEach((o) => { g.fillStyle = o.fill; g.beginPath(); g.ellipse(sx(o.x, k), sz(o.z, k), o.rx * k, o.rz * k, 0, 0, Math.PI * 2); g.fill(); });
    CIRCLES.forEach((o) => { g.fillStyle = o.fill; g.beginPath(); g.arc(sx(o.x, k), sz(o.z, k), o.r * k, 0, Math.PI * 2); g.fill(); });
    g.textAlign = 'center'; g.textBaseline = 'middle';
    Object.keys(LABELS).forEach((id) => {
      const [x, z, t] = LABELS[id];
      g.font = '800 ' + (id === 'papers' || id === 'mags' || id === 'court' || id === 'lake' ? 34 : 24) + 'px ' + MINCHO;
      g.lineWidth = 6; g.strokeStyle = 'rgba(255,250,235,.85)'; g.strokeText(t, sx(x, k), sz(z, k));
      g.fillStyle = '#2c190c'; g.fillText(t, sx(x, k), sz(z, k));
    });
    g.font = '800 30px ' + MINCHO; g.fillStyle = '#fff8e0';
    g.fillText('城へ →', sx(40, k), sz(-38, k));
    g.fillText('北 ↑', sx(-68, k), sz(-38, k));
    g.strokeStyle = '#c9a04e'; g.lineWidth = 10; g.strokeRect(5, 5, c.width - 10, c.height - 10);
    tex.needsUpdate = true;
  }
  draw();
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(draw);
  return tex;
}

// ---- 画面の地図
export function createMapUI({ warp, player, zoneText, onOpen }) {
  const NS = 'http://www.w3.org/2000/svg';
  const K = 10;
  const el = document.createElement('section');
  el.id = 'mapv';
  el.setAttribute('role', 'dialog');
  el.setAttribute('aria-label', '館内案内図');
  el.innerHTML = `<div class='mv-card'>
    <div class='chead'><h2>館内案内図</h2><button id='mvClose' type='button'>閉じる</button></div>
    <p class='mv-here' id='mvHere'></p>
    <div class='mv-map' id='mvMap'></div>
    <div class='mv-list' id='mvList'></div>
  </div>`;
  document.body.append(el);
  const $ = (id) => document.getElementById(id);

  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', '0 0 ' + VW * K + ' ' + VH * K);
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', '図書館の平面図');
  const node = (tag, attrs, parent) => { const e = document.createElementNS(NS, tag); Object.keys(attrs).forEach((a) => e.setAttribute(a, String(attrs[a]))); (parent || svg).append(e); return e; };
  node('rect', { x: 0, y: 0, width: VW * K, height: VH * K, fill: '#6f8a55' });
  RECTS.forEach((r) => node('rect', { x: sx(r.x0, K), y: sz(r.z0, K), width: (r.x1 - r.x0) * K, height: (r.z1 - r.z0) * K, fill: r.fill }));
  ELLIPSES.forEach((o) => node('ellipse', { cx: sx(o.x, K), cy: sz(o.z, K), rx: o.rx * K, ry: o.rz * K, fill: o.fill }));
  CIRCLES.forEach((o) => node('circle', { cx: sx(o.x, K), cy: sz(o.z, K), r: o.r * K, fill: o.fill }));
  WARPS.forEach((w) => {
    const l = LABELS[w.id]; if (!l) return;
    const g = node('g', { class: 'mv-spot', tabindex: 0, role: 'button', 'aria-label': w.name + 'へ移動' });
    const big = w.id === 'papers' || w.id === 'mags' || w.id === 'court' || w.id === 'lake';
    node('circle', { cx: sx(l[0], K), cy: sz(l[1], K), r: big ? 46 : 30, fill: 'transparent' }, g);
    const t = node('text', { x: sx(l[0], K), y: sz(l[1], K) + 8, 'text-anchor': 'middle', class: big ? 'mv-t big' : 'mv-t' }, g);
    t.textContent = l[2];
    const go = () => { close(); warp(w); };
    g.addEventListener('click', go);
    g.addEventListener('keydown', (e) => { if (e.key === 'Enter') go(); });
  });
  const castle = node('text', { x: sx(40, K), y: sz(-38, K), 'text-anchor': 'middle', class: 'mv-t light' }); castle.textContent = '城へ →';
  const north = node('text', { x: sx(-68, K), y: sz(-38, K), 'text-anchor': 'middle', class: 'mv-t light' }); north.textContent = '北 ↑';
  const me = node('g', { class: 'mv-me' });
  node('circle', { cx: 0, cy: 0, r: 16, fill: '#d9463b', stroke: '#fff', 'stroke-width': 5 }, me);
  node('path', { d: 'M 0 -38 L 12 -16 L -12 -16 Z', fill: '#d9463b', stroke: '#fff', 'stroke-width': 3 }, me);
  $('mvMap').append(svg);

  // 行き先の一覧（押しやすいボタン）
  Object.keys(AREA).forEach((a) => {
    const box = document.createElement('div');
    box.className = 'mv-group';
    const h = document.createElement('h3');
    h.textContent = AREA[a];
    box.append(h);
    WARPS.filter((w) => w.area === a).forEach((w) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = w.name;
      b.addEventListener('click', () => { close(); warp(w); });
      box.append(b);
    });
    $('mvList').append(box);
  });

  let timer = 0;
  function paint() {
    const x = sx(player.x, K), y = sz(player.z, K);
    const deg = Math.atan2(-Math.cos(player.yaw), -Math.sin(player.yaw)) * 180 / Math.PI + 90;
    me.setAttribute('transform', 'translate(' + x.toFixed(1) + ' ' + y.toFixed(1) + ') rotate(' + deg.toFixed(1) + ')');
    $('mvHere').textContent = '現在地：' + (zoneText() || '') + '　行き先をタップすると、すぐに移動できます';
  }
  function open() {
    el.classList.add('open');
    if (onOpen) onOpen();
    paint();
    clearInterval(timer);
    timer = setInterval(paint, 300);
  }
  function close() {
    el.classList.remove('open');
    clearInterval(timer);
  }
  $('mvClose').addEventListener('click', close);
  el.addEventListener('click', (e) => { if (e.target === el) close(); });
  addEventListener('keydown', (e) => {
    if (e.key === 'Escape') close();
    const ae = document.activeElement;
    if (e.key === 'm' && !(ae && (ae.tagName === 'INPUT' || ae.tagName === 'TEXTAREA'))) { if (el.classList.contains('open')) close(); else open(); }
  });

  // 画面上のボタン（検索ボタンのとなり）
  const sb = document.getElementById('searchBtn');
  if (sb && sb.parentNode) {
    const b = document.createElement('button');
    b.id = 'mapBtn';
    b.type = 'button';
    b.setAttribute('aria-label', '館内案内図');
    b.innerHTML = `<svg width='21' height='21' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='1.8' stroke-linejoin='round'><path d='M3 6.5 9 4l6 2.5L21 4v13.5L15 20l-6-2.5L3 20z'/><path d='M9 4v13.5M15 6.5V20'/></svg>`;
    b.addEventListener('click', open);
    sb.parentNode.insertBefore(b, sb);
  }
  return { open, close, get isOpen() { return el.classList.contains('open'); } };
}
