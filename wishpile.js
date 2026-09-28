// 読みたい本の台：スキャンした本が、表紙を上にして積み重なっていく
import * as THREE from 'three';
import { coverUrl } from './wishlist.js';

export const PILE = { x: 0, z: 11.6 };
const SPINES = [0x7a1f1f, 0x1f2f5a, 0x274a36, 0xa8742a, 0xe6dcc3, 0x2b2b2e, 0x5a2238, 0x2c5f64, 0x8c3b1e, 0x3c4f7a, 0xf2efe6];
const SPOTS = [[-0.34, -0.26], [0.34, -0.24], [-0.32, 0.3], [0.36, 0.3], [0, 0.02]];
const PER_PILE = 11;

export function createWishPile({ scene, M, textTex, colliders }) {
  // 円卓
  const g = new THREE.Group(); g.position.set(PILE.x, 0, PILE.z); scene.add(g);
  const top = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 0.95, 0.07, 48), M.walnutDark); top.position.y = 0.78; top.castShadow = top.receiveShadow = true; g.add(top);
  const inlay = new THREE.Mesh(new THREE.CylinderGeometry(0.82, 0.82, 0.005, 48), M.leather); inlay.position.y = 0.817; inlay.receiveShadow = true; g.add(inlay);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.95, 0.018, 8, 64), M.gold); ring.rotation.x = Math.PI / 2; ring.position.y = 0.78; g.add(ring);
  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.16, 0.72, 16), M.walnut); post.position.y = 0.38; post.castShadow = true; g.add(post);
  for (let k = 0; k < 4; k++) { const f = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.06, 0.1), M.walnut); f.position.set(Math.cos(k * Math.PI / 2) * 0.28, 0.04, Math.sin(k * Math.PI / 2) * 0.28); f.rotation.y = -k * Math.PI / 2; f.castShadow = true; g.add(f); }
  // 立て札
  const t = textTex('読みたい本', 512, 140, '800 76px "Shippori Mincho B1", serif', '#1f3a2d', '#efd99a');
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.17), new THREE.MeshStandardMaterial({ map: t, emissive: 0xffffff, emissiveMap: t, emissiveIntensity: 0.15, roughness: 0.6 }));
  sign.position.set(0, 0.97, 0.9); sign.rotation.x = -0.35; g.add(sign);
  const back = new THREE.Mesh(new THREE.BoxGeometry(0.66, 0.2, 0.02), M.walnutDark); back.position.set(0, 0.96, 0.885); back.rotation.x = -0.35; g.add(back);
  colliders.push({ x0: PILE.x - 1.35, x1: PILE.x + 1.35, z0: PILE.z - 1.35, z1: PILE.z + 1.35 });

  const books = new THREE.Group(); g.add(books);
  const loader = new THREE.TextureLoader();
  const texCache = new Map();
  const sideMats = SPINES.map((c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.7 }));
  const pageMat = new THREE.MeshStandardMaterial({ color: 0xf1e8d2, roughness: 0.95 });

  function coverMat(item, fallback) {
    const m = new THREE.MeshStandardMaterial({ color: fallback.color.clone(), roughness: 0.55 });
    if (!item.isbn) return m;
    const apply = (tex) => { if (tex) { m.map = tex; m.color.set(0xffffff); m.needsUpdate = true; } };
    if (texCache.has(item.isbn)) { const c = texCache.get(item.isbn); if (c instanceof Promise) c.then(apply); else apply(c); return m; }
    const p = new Promise((res) => loader.load(coverUrl(item), (tex) => { tex.encoding = THREE.sRGBEncoding; tex.anisotropy = 4; texCache.set(item.isbn, tex); res(tex); }, undefined, () => { texCache.set(item.isbn, null); res(null); }));
    texCache.set(item.isbn, p); p.then(apply);
    return m;
  }

  function rebuild(items) {
    books.children.slice().forEach((b) => { books.remove(b); b.geometry.dispose(); });
    const list = items.filter((i) => i.status !== '読了').slice().sort((a, b) => (a.created || '').localeCompare(b.created || ''));
    list.forEach((item, i) => {
      const pile = Math.floor(i / PER_PILE), inPile = i % PER_PILE;
      let x, z, y;
      if (pile < SPOTS.length) { [x, z] = SPOTS[pile]; y = 0.82; }
      else { const a = (pile - SPOTS.length) * 0.9 + 0.4; x = Math.cos(a) * 1.18; z = Math.sin(a) * 1.18; y = 0; }
      const below = books.children.filter((b) => b.userData.pile === pile);
      const h = 0.028 + ((item.isbn || item.title).length % 5) * 0.004;
      y += below.reduce((s, b) => s + b.userData.h, 0);
      const side = sideMats[(item.title.length + i) % sideMats.length];
      const geo = new THREE.BoxGeometry(0.17, h, 0.24);
      const mats = [pageMat, side, coverMat(item, side), side, pageMat, side];
      const mesh = new THREE.Mesh(geo, mats);
      mesh.position.set(x + (Math.sin(i * 7.1) * 0.015), y + h / 2, z + (Math.cos(i * 5.3) * 0.015));
      mesh.rotation.y = Math.sin(i * 12.9898) * 0.35;
      mesh.castShadow = true; mesh.receiveShadow = true;
      mesh.userData = { item, pile, h };
      books.add(mesh);
    });
  }
  const ray = new THREE.Raycaster(); ray.far = 4.5;
  function pick(ndc, camera) {
    ray.setFromCamera(ndc, camera);
    const hits = ray.intersectObjects([...books.children, top, sign], false);
    if (!hits.length) return null;
    return hits[0].object.userData.item || 'table';
  }
  return { rebuild, pick, count: () => books.children.length };
}
