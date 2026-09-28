// 館内と中庭の人々。KayKit のアニメーション（歩く・座って読む・呪文・剣戟など）で動かす
import * as THREE from 'three';
import { rand, pick, clamp } from './util.js';
import { CHAR_SCALE, WALK_SPEED_AT_1X } from './characters.js';

const turnTo = (obj, target, k) => { let d = target - obj.rotation.y; d = Math.atan2(Math.sin(d), Math.cos(d)); obj.rotation.y += d * Math.min(1, k); };

export function createPeople({ scene, cast, seats, W, L, counters }) {
  const inside = [], readers = [], staff = [], outside = [], guards = [];
  const add = (a, x, z, ry = 0) => { a.root.position.set(x, 0, z); a.root.rotation.y = ry; scene.add(a.root); return a; };

  // ---- 館内を巡る人（賢者・学僧・来館者）
  const AISLES = [[-3.4, -1], [3.4, 1], [-2.6, -1], [2.6, 1]];
  const spot = () => { const a = pick(AISLES); return { x: a[0] + rand(-0.3, 0.3), z: rand(-19.5, 13.5), face: a[1] }; };
  [['Mage', ['Spellbook']], ['Rogue_Hooded', []], ['Mage', []], ['Rogue', []], ['Rogue_Hooded', []], ['Barbarian', []]].forEach(([m, gear]) => {
    const s = spot();
    const a = add(cast.spawn(m, { gear }), s.x, s.z);
    a.play('Idle');
    inside.push({ a, path: [], wait: rand(0, 5), spot: s, speed: rand(0.75, 0.95), acted: false });
  });
  function plan(w) {
    const n = spot(); const c = w.a.root.position;
    if (Math.sign(n.x) === Math.sign(c.x)) w.path = [{ x: n.x, z: n.z }];
    else { const hub = Math.random() < 0.5 ? 10 : -19; w.path = [{ x: c.x, z: hub }, { x: n.x, z: hub }, { x: n.x, z: n.z }]; }
    w.spot = n; w.acted = false;
  }

  // ---- 閲覧机で読みふける人（椅子に座る）
  const hipBack = 0.4 * CHAR_SCALE; // 座りアニメは腰が後ろへ 0.4 下がるので、その分だけ机側に置く
  seats.slice().sort(() => Math.random() - 0.5).slice(0, 8).forEach((st, i) => {
    const m = i % 3 === 0 ? 'Rogue_Hooded' : 'Mage';
    const a = cast.spawn(m, { gear: m === 'Mage' ? ['Spellbook_open'] : [] });
    const fx = Math.sin(st.ry), fz = Math.cos(st.ry);
    add(a, st.x + fx * hipBack, st.z + fz * hipBack, st.ry);
    a.root.position.y = 0.1;
    const act = a.play('Sit_Chair_Idle');
    if (act) act.time = rand(0, 3);
    readers.push({ a });
  });

  // ---- 入口の衛兵
  [-1, 1].forEach((s) => {
    const a = add(cast.spawn('Knight', { gear: ['2H_Sword'] }), s * 1.95, L - 0.9, Math.PI);
    a.play('2H_Melee_Idle');
    guards.push({ a, next: rand(8, 20) });
  });

  // ---- カウンターの係（司書と商人）
  counters.forEach((c) => {
    const model = c.kind === 'borrow' ? 'Rogue' : 'Barbarian';
    const a = add(cast.spawn(model, { gear: c.kind === 'buy' ? ['Mug'] : [] }), c.staffX, c.z, c.side < 0 ? Math.PI / 2 : -Math.PI / 2);
    a.play('Idle');
    staff.push({ a, c, greeted: false, t: 0 });
  });

  // ---- 中庭：見回りの騎士
  for (let i = 0; i < 3; i++) {
    const a = add(cast.spawn('Knight', { gear: ['1H_Sword', 'Badge_Shield'] }), W + 6 + i * 3.2, rand(-30, 30));
    a.play('Walking_A', { timeScale: 1.1 / WALK_SPEED_AT_1X });
    outside.push({ kind: 'patrol', a, dir: Math.random() < 0.5 ? 1 : -1, speed: 1.1, pause: 0 });
  }
  // ---- 中庭：魔導士
  const burstGeo = new THREE.SphereGeometry(0.12, 16, 12);
  for (let i = 0; i < 3; i++) {
    const a = add(cast.spawn('Mage', { gear: ['2H_Staff'] }), rand(W + 10, W + 24), rand(-26, 26), rand(-Math.PI, Math.PI));
    a.play('Idle');
    const col = pick([0x66ccff, 0xff9944, 0xb388ff, 0x77ffaa]);
    const burst = new THREE.Mesh(burstGeo, new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
    scene.add(burst);
    outside.push({ kind: 'cast', a, burst, next: rand(2, 7), t: -1 });
  }
  // ---- 中庭：稽古をつける剣士たち
  {
    const cz = rand(-8, 8), cx = W + 18;
    const b = add(cast.spawn('Barbarian', { gear: ['1H_Axe', 'Barbarian_Round_Shield'] }), cx, cz - 0.95, 0);
    const k = add(cast.spawn('Knight', { gear: ['1H_Sword', 'Round_Shield'] }), cx, cz + 0.95, Math.PI);
    b.play('Idle'); k.play('Blocking');
    outside.push({ kind: 'duel', a: b, foe: k, t: 0, turn: 0 });
  }
  // ---- 中庭：旅人
  for (let i = 0; i < 2; i++) {
    const a = add(cast.spawn(i ? 'Rogue_Hooded' : 'Rogue', { gear: [] }), W + rand(28, 33), rand(-30, 30));
    a.play('Walking_B', { timeScale: 1.2 / WALK_SPEED_AT_1X });
    outside.push({ kind: 'patrol', a, dir: i ? 1 : -1, speed: 1.2, pause: 0 });
  }

  const tmp = new THREE.Vector3();
  let counts = { inside: 0, outside: 0 };

  function update(dt, time, activity, S, player) {
    const nIn = Math.round(inside.length * activity), nRd = Math.round(readers.length * Math.max(activity, 0.35));
    inside.forEach((w, i) => {
      const on = i < nIn; w.a.root.visible = on; if (!on) return;
      w.a.mixer.update(dt);
      const r = w.a.root;
      if (w.wait > 0) {
        w.wait -= dt;
        turnTo(r, w.spot.face > 0 ? Math.PI / 2 : -Math.PI / 2, dt * 3);
        if (!w.acted && w.wait < 2.4 && Math.random() < 0.5) { w.a.play(pick(['Interact', 'PickUp', 'Use_Item']), { loop: false, fade: 0.25 }); w.acted = true; }
        else if (w.a.current && !w.a.current.isRunning()) w.a.play('Idle');
        if (w.wait <= 0) plan(w);
        return;
      }
      const t = w.path[0];
      if (!t) { w.wait = rand(4, 10); w.a.play('Idle'); return; }
      const dx = t.x - r.position.x, dz = t.z - r.position.z, d = Math.hypot(dx, dz);
      if (d < 0.08) { w.path.shift(); if (!w.path.length) { w.wait = rand(4, 10); w.a.play('Idle'); } return; }
      w.a.play('Walking_A', { timeScale: w.speed / WALK_SPEED_AT_1X });
      const st = Math.min(d, w.speed * dt); r.position.x += dx / d * st; r.position.z += dz / d * st;
      turnTo(r, Math.atan2(dx, dz), dt * 8);
    });
    readers.forEach((rd, i) => { const on = i < nRd; rd.a.root.visible = on; if (on) rd.a.mixer.update(dt); });
    guards.forEach((g) => {
      g.a.mixer.update(dt); g.next -= dt;

    });
    staff.forEach((s) => {
      s.a.mixer.update(dt);
      const near = player && Math.hypot(player.x - s.c.frontX, player.z - s.c.z) < 2.6;
      turnTo(s.a.root, near ? Math.atan2(player.x - s.a.root.position.x, player.z - s.a.root.position.z) : (s.c.side < 0 ? Math.PI / 2 : -Math.PI / 2), dt * 3);
      if (near && !s.greeted) { s.a.play('Interact', { loop: false }); s.greeted = true; }
      if (!near) s.greeted = false;
      if (s.a.current && !s.a.current.isRunning()) s.a.play('Idle');
    });
    let nOut = 0;
    outside.forEach((o) => {
      const r = o.a.root;
      if (o.kind === 'patrol') {
        o.a.mixer.update(dt); nOut++;
        if (o.pause > 0) { o.pause -= dt; if (o.pause <= 0) { o.dir *= -1; o.a.play(o.a.model === 'Knight' ? 'Walking_A' : 'Walking_B', { timeScale: o.speed / WALK_SPEED_AT_1X }); } return; }
        const sp = o.speed * (1 - S.snow * 0.3);
        o.a.setSpeed(sp / WALK_SPEED_AT_1X);
        r.position.z += o.dir * sp * dt;
        turnTo(r, o.dir > 0 ? 0 : Math.PI, dt * 6);
        if (Math.abs(r.position.z) > 34) { r.position.z = clamp(r.position.z, -34, 34); o.pause = rand(1.5, 3); o.a.play('Idle'); }
      } else if (o.kind === 'cast') {
        const vis = activity > 0.3; r.visible = vis; o.burst.visible = vis; if (!vis) return;
        o.a.mixer.update(dt); nOut++;
        o.next -= dt;
        if (o.next < 0 && o.t < 0) { o.a.play('Spellcasting'); o.t = 0; }
        if (o.t >= 0) {
          o.t += dt;
          if (o.t > 1.8 && o.t - dt <= 1.8) o.a.play('Spellcast_Shoot', { loop: false, fade: 0.15 });
          const k = clamp((o.t - 1.9) / 1.2, 0, 1);
          tmp.set(0, 1.5, 0.9).applyAxisAngle(new THREE.Vector3(0, 1, 0), r.rotation.y).add(r.position);
          o.burst.position.copy(tmp).addScaledVector(new THREE.Vector3(Math.sin(r.rotation.y), 0.25, Math.cos(r.rotation.y)), k * 6);
          o.burst.material.opacity = o.t < 1.9 ? Math.min(1, o.t) * 0.6 : (1 - k) * 0.9;
          o.burst.scale.setScalar(o.t < 1.9 ? 1 + o.t : 2 + k * 10);
          if (o.t > 3.3) { o.t = -1; o.next = rand(4, 9); o.a.play('Idle'); o.burst.material.opacity = 0; r.rotation.y += rand(-1, 1); }
        }
      } else if (o.kind === 'duel') {
        const vis = activity > 0.45; r.visible = vis; o.foe.root.visible = vis; if (!vis) return;
        o.a.mixer.update(dt); o.foe.mixer.update(dt); nOut += 2;
        o.t -= dt;
        if (o.t < 0) {
          o.turn ^= 1; o.t = rand(1.1, 1.6);
          const [atk, def] = o.turn ? [o.a, o.foe] : [o.foe, o.a];
          atk.play(pick(['1H_Melee_Attack_Slice_Diagonal', '1H_Melee_Attack_Chop', '1H_Melee_Attack_Stab']), { loop: false, fade: 0.15 });
          def.play('Block', { loop: false, fade: 0.15 });
        }
      }
    });
    counts = { inside: nIn + nRd + guards.length + staff.length, outside: nOut };
  }
  return { update, get counts() { return counts; } };
}
