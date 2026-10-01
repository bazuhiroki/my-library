// 天井画とステンドグラス
// 天井画は著作権の切れた名画（パブリックドメイン）を Wikimedia Commons から読み込み、
// 読み込めるまでは手描き風の空の絵を表示する。
import * as THREE from 'three';

const commons = (name) => '/api/img?u=' + encodeURIComponent('https://commons.wikimedia.org/wiki/Special:FilePath/' + name.split(' ').join('_') + '?width=1280');

// 身廊の6つの区画（リブとリブの間）に掛ける絵。候補は上から順に試す
export const CEILING = [
  { z: -19.8, title: 'アダムの創造', artist: 'ミケランジェロ（1512年頃）', aspect: 2.2, files: ['Michelangelo - Creation of Adam (cropped).jpg', 'Creation of Adam, Michelangelo (1475–1564), circa 1511.jpg'] },
  { z: -12, title: 'アテナイの学堂', artist: 'ラファエロ（1511年頃）', aspect: 1.29, files: ['"The School of Athens" by Raffaello Sanzio da Urbino.jpg', 'Raffael 058.jpg', 'La scuola di Atene.jpg'] },
  { z: -4, title: 'ヴィーナスの誕生', artist: 'ボッティチェリ（1485年頃）', aspect: 1.55, files: ['Sandro Botticelli - La nascita di Venere - Google Art Project - edited.jpg', 'Sandro Botticelli - La nascita di Venere - Google Art Project.jpg'] },
  { z: 4, title: '星月夜', artist: 'ゴッホ（1889年）', aspect: 1.26, files: ['Van Gogh - Starry Night - Google Art Project.jpg', 'Vincent van Gogh Starry Night.jpg'] },
  { z: 12, title: '印象・日の出', artist: 'モネ（1872年）', aspect: 1.3, files: ['Monet - Impression, Sunrise.jpg', 'Claude Monet, Impression, soleil levant.jpg'] },
  { z: 19.8, title: '雲海の上の旅人', artist: 'フリードリヒ（1818年頃）', aspect: 0.78, files: ['Caspar David Friedrich - Wanderer above the Sea of Fog.jpeg', 'Caspar David Friedrich - Wanderer above the sea of fog.jpg'] },
];

// 読み込み前・失敗時に見せる、手描き風の空（雲と光）
function skyFresco(seed) {
  const c = document.createElement('canvas');
  c.width = 1024; c.height = 512;
  const g = c.getContext('2d');
  const sky = g.createLinearGradient(0, 0, 0, 512);
  sky.addColorStop(0, '#5f86b8'); sky.addColorStop(0.6, '#a9c3dd'); sky.addColorStop(1, '#f2dcae');
  g.fillStyle = sky; g.fillRect(0, 0, 1024, 512);
  let s = seed * 9301 + 49297;
  const rnd = () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
  const glow = g.createRadialGradient(512, 300, 10, 512, 300, 360);
  glow.addColorStop(0, 'rgba(255,240,200,.85)'); glow.addColorStop(1, 'rgba(255,240,200,0)');
  g.fillStyle = glow; g.fillRect(0, 0, 1024, 512);
  for (let i = 0; i < 70; i++) {
    const x = rnd() * 1024, y = 120 + rnd() * 380, r = 30 + rnd() * 90;
    const cg = g.createRadialGradient(x, y, 2, x, y, r);
    cg.addColorStop(0, 'rgba(255,250,240,.75)'); cg.addColorStop(1, 'rgba(255,250,240,0)');
    g.fillStyle = cg; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
  }
  const t = new THREE.CanvasTexture(c);
  return t;
}

// ステンドグラスの絵（鉛の線・菱形の小窓・中央の円形メダイヨン・縁取り）
const PALETTES = [
  ['#1f3f8f', '#2f5fbf', '#c9a227', '#8f1d2c', '#e8c86a', '#16306b'],
  ['#8f1d2c', '#b8323f', '#2d6b3a', '#d8a531', '#f1d27a', '#5a1420'],
  ['#4b2a7a', '#7a4fb0', '#d18a2a', '#1f5a6b', '#f0c060', '#2e1a4f'],
  ['#14625e', '#2a8c84', '#b8323f', '#d8a531', '#f3dc8a', '#0d3f3c'],
  ['#2a3f9a', '#c9a227', '#9a2a3a', '#3f7a3a', '#f3e2a0', '#1a275f'],
];
function stainedTexture(k) {
  const P = PALETTES[k % PALETTES.length];
  const c = document.createElement('canvas');
  c.width = 512; c.height = 1024;
  const g = c.getContext('2d');
  g.fillStyle = '#1a1410'; g.fillRect(0, 0, 512, 1024);
  // 菱形の小窓（ひとつずつ色を少しずつ変える）
  let s = 17 + k * 31;
  const rnd = () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
  const D = 64;
  for (let y = -D; y < 1024 + D; y += D / 2) {
    for (let x = -D; x < 512 + D; x += D) {
      const ox = ((y / (D / 2)) % 2) * (D / 2);
      const cx = x + ox, cy = y;
      g.beginPath(); g.moveTo(cx, cy - D / 2); g.lineTo(cx + D / 2, cy); g.lineTo(cx, cy + D / 2); g.lineTo(cx - D / 2, cy); g.closePath();
      g.fillStyle = rnd() < 0.18 ? P[2] : (rnd() < 0.5 ? P[0] : P[1]);
      g.globalAlpha = 0.85 + rnd() * 0.15; g.fill(); g.globalAlpha = 1;
      g.strokeStyle = '#120d0a'; g.lineWidth = 5; g.stroke();
    }
  }
  // 縁取り
  for (let y = 0; y < 1024; y += 48) {
    [[0, 34], [478, 34]].forEach(([x, w]) => { g.fillStyle = (y / 48) % 2 ? P[3] : P[4]; g.fillRect(x, y, w, 48); g.strokeStyle = '#120d0a'; g.lineWidth = 5; g.strokeRect(x, y, w, 48); });
  }
  // 中央のメダイヨン（花弁と、開いた本）
  const mx = 256, my = 560, R = 170;
  g.beginPath(); g.arc(mx, my, R + 18, 0, Math.PI * 2); g.fillStyle = P[4]; g.fill(); g.lineWidth = 8; g.strokeStyle = '#120d0a'; g.stroke();
  g.beginPath(); g.arc(mx, my, R, 0, Math.PI * 2); g.fillStyle = P[5]; g.fill(); g.stroke();
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    g.save(); g.translate(mx, my); g.rotate(a);
    g.beginPath(); g.ellipse(0, -R * 0.62, R * 0.17, R * 0.36, 0, 0, Math.PI * 2);
    g.fillStyle = i % 2 ? P[3] : P[2]; g.fill(); g.lineWidth = 6; g.stroke(); g.restore();
  }
  g.beginPath(); g.arc(mx, my, R * 0.36, 0, Math.PI * 2); g.fillStyle = '#f6edd6'; g.fill(); g.lineWidth = 6; g.stroke();
  g.fillStyle = P[3];
  g.beginPath(); g.moveTo(mx - 44, my - 18); g.quadraticCurveTo(mx - 20, my - 30, mx, my - 16); g.lineTo(mx, my + 26); g.quadraticCurveTo(mx - 20, my + 12, mx - 44, my + 24); g.closePath(); g.fill(); g.stroke();
  g.beginPath(); g.moveTo(mx + 44, my - 18); g.quadraticCurveTo(mx + 20, my - 30, mx, my - 16); g.lineTo(mx, my + 26); g.quadraticCurveTo(mx + 20, my + 12, mx + 44, my + 24); g.closePath(); g.fill(); g.stroke();
  // 上部（アーチ部分）の小さな円窓
  g.beginPath(); g.arc(256, 150, 80, 0, Math.PI * 2); g.fillStyle = P[2]; g.fill(); g.lineWidth = 8; g.stroke();
  for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; g.beginPath(); g.arc(256 + Math.cos(a) * 46, 150 + Math.sin(a) * 46, 26, 0, Math.PI * 2); g.fillStyle = i % 2 ? P[0] : P[3]; g.fill(); g.lineWidth = 5; g.stroke(); }
  // 下の横帯
  g.fillStyle = P[4]; g.fillRect(34, 900, 444, 40); g.strokeRect(34, 900, 444, 40);
  const t = new THREE.CanvasTexture(c);
  t.anisotropy = 4;
  return t;
}

export function createArt({ scene, W, SH, VR, EWIN, WW, SILL, SPR, remapUV, archPath }) {
  // ---------------- 天井画
  const paintings = [];
  const HZ = 3.2; // 区画の中での奥行き方向の長さ（m）
  const goldMat = new THREE.MeshStandardMaterial({ color: 0xc9a04e, metalness: 0.75, roughness: 0.35, side: THREE.DoubleSide });
  CEILING.forEach((p, i) => {
    const arc = Math.min(HZ * p.aspect, VR * 2.2);
    const tl = arc / (VR - 0.06);
    const t0 = Math.PI - tl / 2;
    const frame = new THREE.Mesh(new THREE.CylinderGeometry(VR - 0.03, VR - 0.03, HZ + 0.36, 48, 1, true, t0 - 0.06, tl + 0.12), goldMat);
    frame.rotation.x = Math.PI / 2; frame.position.set(0, SH, p.z); scene.add(frame);
    const tex = skyFresco(i + 1);
    tex.center.set(0.5, 0.5); tex.rotation = Math.PI;
    const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.75, side: THREE.DoubleSide, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.32 });
    const m = new THREE.Mesh(new THREE.CylinderGeometry(VR - 0.06, VR - 0.06, HZ, 48, 1, true, t0, tl), mat);
    m.rotation.x = Math.PI / 2; m.position.set(0, SH, p.z); scene.add(m);
    m.userData.painting = p;
    paintings.push(m);
    // 読み込めたら差し替える（候補を順番に試す）
    const tryLoad = (k) => {
      if (k >= p.files.length) return;
      const img = new Image();
      img.onload = () => {
        const t = new THREE.Texture(img);
        t.center.set(0.5, 0.5); t.rotation = Math.PI; t.anisotropy = 8; t.needsUpdate = true;
        mat.map = t; mat.emissiveMap = t; mat.needsUpdate = true;
      };
      img.onerror = () => tryLoad(k + 1);
      img.src = commons(p.files[k]);
    };
    setTimeout(() => tryLoad(0), 1500 + i * 400);
  });

  // ---------------- ステンドグラス（東の窓）と床に落ちる色の光
  const glassMats = [];
  const patchMats = [];
  EWIN.forEach((z, k) => {
    const tex = stainedTexture(k);
    const geo = new THREE.ShapeGeometry(archPath(new THREE.Shape(), z), 24);
    remapUV(geo, z - WW / 2, SILL, WW, SPR + WW / 2 - SILL);
    const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0.94, side: THREE.DoubleSide, depthWrite: false });
    const g = new THREE.Mesh(geo, mat);
    g.rotation.y = -Math.PI / 2; g.position.x = W + 0.27;
    scene.add(g);
    glassMats.push(mat);
    // 床の色の光（窓の形をぼかした光だまり）
    const pm = new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
    const patch = new THREE.Mesh(new THREE.PlaneGeometry(WW * 1.1, 3.4), pm);
    patch.rotation.x = -Math.PI / 2; patch.rotation.z = Math.PI / 2;
    patch.position.set(W - 2.3, 0.012, z);
    scene.add(patch);
    patchMats.push(pm);
  });

  // 明るさ（昼は鮮やか、夜は沈む）。main の環境更新から呼ぶ
  function setLight(v, sun) {
    glassMats.forEach((m) => m.color.setScalar(Math.max(0.12, Math.min(1.15, v))));
    patchMats.forEach((m) => { m.opacity = Math.max(0, Math.min(0.5, (sun || 0) * 0.42)); });
  }
  // 天井を見上げたときの案内
  const ray = new THREE.Raycaster();
  ray.far = 16;
  const center = new THREE.Vector2(0, 0);
  function hint(camera) {
    ray.setFromCamera(center, camera);
    const h = ray.intersectObjects(paintings, false)[0];
    if (!h) return null;
    const p = h.object.userData.painting;
    return ['『' + p.title + '』', '　' + p.artist + '　天井画'];
  }
  return { setLight, hint };
}
