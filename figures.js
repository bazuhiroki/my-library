// 館内・屋外の登場人物（司祭・賢者・騎士・魔導士・剣士）と竜
import * as THREE from 'three';
import { rand, pick } from './util.js';

export function createFigureKit(scene) {
  function mesh(geo, mat, x, y, z, parent) { const m = new THREE.Mesh(geo, mat); m.position.set(x || 0, y || 0, z || 0); (parent || scene).add(m); return m; }
const SKINS=[0xf1c9a5,0xe0ac82,0xc68c62,0x8d5a3b,0xf5d7bd];
const HAIRS=[0x1c1612,0x3a2618,0x6b4a2e,0xc9a26a,0x2a2a2a,0xb04a2a,0xd9d2c4];
const matCache={};function sm2(c,o={}){const k=c+JSON.stringify(o);if(!matCache[k])matCache[k]=new THREE.MeshStandardMaterial(Object.assign({color:c,roughness:.8},o));return matCache[k];}
const armorM=new THREE.MeshStandardMaterial({color:0xb7bcc4,metalness:.85,roughness:.32});
function makeFigure(type){
  const g=new THREE.Group();const u={type,phase:Math.random()*6,t:Math.random()*5};g.userData=u;
  const skin=sm2(pick(SKINS),{roughness:.7});
  const legged=type==='knight'||type==='swordsman';
  let body,trim,limb;
  if(type==='knight'){body=armorM;limb=armorM;trim=sm2(0xc9a04e,{metalness:.8,roughness:.3});}
  else if(type==='swordsman'){body=sm2(pick([0x2f5a4a,0x7a2b2b,0x2c3e6b,0x6b5a2e]));limb=sm2(0x2a2420);trim=sm2(0xd9c9a0);}
  else if(type==='mage'){body=sm2(pick([0x8e1f2b,0x2b2f7a,0x1f5e4a,0x5a2a6b]));limb=body;trim=sm2(0xc9a04e,{metalness:.7,roughness:.35});}
  else if(type==='priest'){body=sm2(0xefeae0,{roughness:.9});limb=body;trim=sm2(0x2d4a8a);}
  else {body=sm2(pick([0x3d2456,0x1f2a4a,0x4a3a2a]));limb=body;trim=sm2(0xc9a04e,{metalness:.7,roughness:.35});}
  let shoulderY,headY;
  if(legged){
    const hip=new THREE.Group();hip.position.y=0.9;g.add(hip);u.legs=[];u.knees=[];
    [-1,1].forEach(sd=>{const th=new THREE.Group();th.position.x=0.09*sd;hip.add(th);mesh(new THREE.CylinderGeometry(.075,.06,.46,8),limb,0,-.23,0,th).castShadow=true;
      const kn=new THREE.Group();kn.position.y=-.46;th.add(kn);mesh(new THREE.CylinderGeometry(.06,.05,.42,8),limb,0,-.21,0,kn);mesh(new THREE.BoxGeometry(.11,.07,.24),sm2(0x2a1c12),0,-.42,.04,kn);u.legs.push(th);u.knees.push(kn);});
    const t=mesh(new THREE.CylinderGeometry(type==='knight'?.21:.18,.16,.62,10),body,0,1.21,0,g);t.castShadow=true;
    mesh(new THREE.CylinderGeometry(.17,.17,.07,10),trim,0,.92,0,g);
    if(type==='knight'){[-1,1].forEach(sd=>mesh(new THREE.SphereGeometry(.11,10,8),armorM,.22*sd,1.5,0,g));}
    shoulderY=1.48;headY=1.7;
  }else{
    const sk=mesh(new THREE.CylinderGeometry(.19,.44,1.15,14),body,0,.575,0,g);sk.castShadow=true;u.skirt=sk;
    mesh(new THREE.CylinderGeometry(.445,.445,.06,14),trim,0,.05,0,g);
    mesh(new THREE.CylinderGeometry(.16,.19,.5,12),body,0,1.38,0,g).castShadow=true;
    mesh(new THREE.BoxGeometry(.06,1.2,.02),trim,0,1.0,.2,g);
    shoulderY=1.56;headY=1.76;
  }
  u.arms=[];[-1,1].forEach(sd=>{const p=new THREE.Group();p.position.set(.23*sd,shoulderY,0);g.add(p);mesh(new THREE.CylinderGeometry(legged?.05:.075,legged?.045:.06,.6,8),type==='knight'?armorM:body,0,-.3,0,p);mesh(new THREE.SphereGeometry(.05,8,6),skin,0,-.63,0,p);u.arms.push(p);});
  mesh(new THREE.CylinderGeometry(.05,.05,.1,8),skin,0,headY-.15,0,g);
  const head=new THREE.Group();head.position.y=headY;g.add(head);u.head=head;
  const hd=mesh(new THREE.SphereGeometry(.115,14,10),skin,0,0,0,head);hd.scale.set(1,1.1,1);hd.castShadow=true;
  const hair=sm2(pick(HAIRS));
  if(type==='knight'){mesh(new THREE.SphereGeometry(.14,14,10),armorM,0,.02,0,head);mesh(new THREE.BoxGeometry(.2,.03,.05),sm2(0x111111),0,.0,.12,head);const pl=mesh(new THREE.ConeGeometry(.05,.34,8),sm2(pick([0xa01c1c,0x1c3aa0,0xe8e0d0])),0,.2,-.1,head);pl.rotation.x=-1.1;}
  else if(type==='swordsman'){mesh(new THREE.SphereGeometry(.122,14,10,0,Math.PI*2,0,Math.PI*.6),hair,0,.02,-.01,head);const hb=new THREE.Mesh(new THREE.TorusGeometry(.118,.015,6,20),trim);hb.rotation.x=Math.PI/2;hb.position.y=.04;head.add(hb);const tail=mesh(new THREE.ConeGeometry(.04,.3,6),hair,0,-.02,-.16,head);tail.rotation.x=2.4;}
  else if(type==='mage'){mesh(new THREE.CylinderGeometry(.3,.3,.02,18),body,0,.1,0,head);const c=mesh(new THREE.ConeGeometry(.15,.5,14),body,0,.35,0,head);c.rotation.z=.18;mesh(new THREE.CylinderGeometry(.155,.155,.04,14),trim,0,.13,0,head);}
  else if(type==='priest'){mesh(new THREE.SphereGeometry(.122,14,10,0,Math.PI*2,0,Math.PI*.5),hair,0,.02,0,head);const m=mesh(new THREE.ConeGeometry(.12,.32,4),sm2(0xefeae0),0,.24,0,head);m.rotation.y=Math.PI/4;mesh(new THREE.BoxGeometry(.03,.28,.01),sm2(0xc9a04e,{metalness:.7,roughness:.35}),0,.22,.07,head);}
  else {const hood=mesh(new THREE.SphereGeometry(.15,14,10,0,Math.PI*2,0,Math.PI*.62),body,0,.02,-.02,head);hood.scale.set(1,1.05,1.1);const b=mesh(new THREE.ConeGeometry(.07,.3,8),sm2(0xe6e2da),0,-.2,.07,head);b.rotation.x=Math.PI;}
  const rh=new THREE.Group();rh.position.y=-.63;u.arms[1].add(rh);
  const lh=new THREE.Group();lh.position.y=-.63;u.arms[0].add(lh);
  if(type==='knight'){const sw=new THREE.Group();rh.add(sw);mesh(new THREE.BoxGeometry(.05,.95,.015),sm2(0xdfe3e8,{metalness:.9,roughness:.2}),0,-.52,.02,sw);mesh(new THREE.BoxGeometry(.22,.035,.04),trim,0,-.04,.02,sw);
    const sh=mesh(new THREE.BoxGeometry(.05,.72,.52),sm2(pick([0x1f3a7a,0x7a1f1f,0x2e5a3a])),-.06,.3,.04,lh);mesh(new THREE.SphereGeometry(.08,10,8),trim,-.09,.3,.04,lh);
    const cape=mesh(new THREE.PlaneGeometry(.44,1.05,1,4),sm2(pick([0x8a1f2a,0x1f3a7a,0xe8e0d0]),{side:THREE.DoubleSide}),0,1.0,-.2,g);cape.rotation.x=.12;u.cape=cape;}
  if(type==='swordsman'){const bl=mesh(new THREE.BoxGeometry(.035,1.0,.012),sm2(0xe8edf2,{metalness:.9,roughness:.15}),0,-.55,.03,rh);bl.rotation.x=.08;mesh(new THREE.CylinderGeometry(.018,.018,.2,6),sm2(0x222222),0,-.02,.03,rh);u.blade=bl;}
  if(type==='mage'||type==='priest'){const st=new THREE.Group();rh.add(st);st.position.set(0,0,.05);mesh(new THREE.CylinderGeometry(.018,.022,1.7,6),sm2(type==='priest'?0xc9a04e:0x5a3a1e,type==='priest'?{metalness:.7,roughness:.35}:{}),0,.35,0,st);
    if(type==='mage'){const oc=pick([0x66ccff,0xff9944,0xb388ff,0x77ff99]);const orb=mesh(new THREE.SphereGeometry(.075,14,10),new THREE.MeshStandardMaterial({color:oc,emissive:oc,emissiveIntensity:1.6}),0,1.25,0,st);u.orb=orb;
      const burst=mesh(new THREE.SphereGeometry(.1,16,12),new THREE.MeshBasicMaterial({color:oc,transparent:true,opacity:0,blending:THREE.AdditiveBlending,depthWrite:false}),0,1.25,0,st);u.burst=burst;}
    else{const r=new THREE.Mesh(new THREE.TorusGeometry(.13,.015,8,24),trim);r.position.y=1.28;st.add(r);}}
  if(type==='sage'){const tome=new THREE.Group();tome.position.set(0,1.28,.42);g.add(tome);const pm=new THREE.MeshStandardMaterial({color:0xf6ecd2,emissive:0xffe6a8,emissiveIntensity:.5});
    const l=mesh(new THREE.BoxGeometry(.16,.01,.22),pm,-.075,0,0,tome);l.rotation.z=.22;const r=mesh(new THREE.BoxGeometry(.16,.01,.22),pm,.075,0,0,tome);r.rotation.z=-.22;u.tome=tome;}
  scene.add(g);return g;
}
function walkAnim(f,dt,speed){const u=f.userData;u.phase+=dt*speed*5.2;const s=Math.sin(u.phase);
  if(u.legs){u.legs[0].rotation.x=s*.5;u.legs[1].rotation.x=-s*.5;u.knees[0].rotation.x=Math.max(0,-Math.cos(u.phase))*.7;u.knees[1].rotation.x=Math.max(0,Math.cos(u.phase))*.7;}
  if(u.skirt){u.skirt.rotation.z=s*.035;}
  u.arms[0].rotation.x=-s*.35;if(u.type==='knight'||u.type==='swordsman')u.arms[1].rotation.x=s*.3;else u.arms[1].rotation.x=-.25;
  if(u.cape)u.cape.rotation.x=.25+Math.abs(s)*.1;}
function idle(f){const u=f.userData;if(u.legs){u.legs.forEach(l=>l.rotation.x=0);u.knees.forEach(k=>k.rotation.x=0);}if(u.skirt)u.skirt.rotation.z=0;if(u.cape)u.cape.rotation.x=.12;}
function makeDragon(color,scale){
  const g=new THREE.Group();const m=new THREE.MeshStandardMaterial({color,roughness:.55,metalness:.25,flatShading:true});
  const belly=new THREE.MeshStandardMaterial({color:new THREE.Color(color).lerp(new THREE.Color(0xd9c29a),.45),roughness:.7,flatShading:true});
  const body=mesh(new THREE.SphereGeometry(1,12,9),m,0,0,0,g);body.scale.set(1.2,1.05,3.1);
  mesh(new THREE.SphereGeometry(1,10,8),belly,0,-.35,.2,g).scale.set(.95,.7,2.4);
  const neck=new THREE.Group();neck.position.set(0,.5,2.6);g.add(neck);
  let prev=neck;const nsegs=[];for(let i=0;i<4;i++){const s=new THREE.Group();s.position.set(0,i?0.28:0,i?0.62:0);prev.add(s);mesh(new THREE.SphereGeometry(.55-i*.07,9,7),m,0,0,0,s).scale.set(1,1,1.4);nsegs.push(s);prev=s;}
  const head=new THREE.Group();head.position.set(0,.2,.75);prev.add(head);
  mesh(new THREE.BoxGeometry(.75,.6,1.05),m,0,0,0,head);const sn=mesh(new THREE.BoxGeometry(.55,.38,.9),m,0,-.08,.85,head);
  const jaw=mesh(new THREE.BoxGeometry(.5,.14,.95),belly,0,-.32,.72,head);
  [-1,1].forEach(s=>{const h=mesh(new THREE.ConeGeometry(.1,.9,6),new THREE.MeshStandardMaterial({color:0xe8dcc0,roughness:.6}),.25*s,.4,-.4,head);h.rotation.x=-2.2;
    const e=mesh(new THREE.SphereGeometry(.07,8,6),new THREE.MeshStandardMaterial({color:0xffcc33,emissive:0xffaa00,emissiveIntensity:1}),.3*s,.12,.42,head);});
  const fire=mesh(new THREE.ConeGeometry(.9,6,12,1,true),new THREE.MeshBasicMaterial({color:0xff7a1a,transparent:true,opacity:0,blending:THREE.AdditiveBlending,depthWrite:false,side:THREE.DoubleSide}),0,-.1,4.2,head);fire.rotation.x=-Math.PI/2;
  const tail=new THREE.Group();tail.position.set(0,0,-2.8);g.add(tail);let tp=tail;const tsegs=[];
  for(let i=0;i<7;i++){const s=new THREE.Group();s.position.z=i?-0.85:0;tp.add(s);mesh(new THREE.SphereGeometry(.55-i*.07,8,6),m,0,0,-.4,s).scale.set(1,.9,1.7);tsegs.push(s);tp=s;}
  mesh(new THREE.ConeGeometry(.35,.9,4),m,0,0,-1,tp).rotation.x=-Math.PI/2;
  const wingMat=new THREE.MeshStandardMaterial({color:new THREE.Color(color).multiplyScalar(.75),roughness:.7,side:THREE.DoubleSide,flatShading:true});
  const wings=[];
  [-1,1].forEach(s=>{const piv=new THREE.Group();piv.position.set(.9*s,.75,1);g.add(piv);
    const pts=[[0,0,0],[3.2*s,1.4,-.6],[7.5*s,.6,-1.6],[6.6*s,0,-3.6],[4.2*s,0,-3.2],[2.6*s,0,-3.9],[.4,0,-2.6]];
    const pos=[];for(let i=1;i<pts.length-1;i++){pos.push(...pts[0],...pts[i],...pts[i+1]);}
    const wg=new THREE.BufferGeometry();wg.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));wg.computeVertexNormals();
    piv.add(new THREE.Mesh(wg,wingMat));
    const bone=mesh(new THREE.CylinderGeometry(.09,.06,7.6,6),m,3.75*s,.9,-.8,piv);bone.rotation.z=Math.PI/2+(-.08*s);bone.rotation.y=.2*s;
    wings.push(piv);});
  [-1,1].forEach(s=>{const lg=mesh(new THREE.CylinderGeometry(.22,.14,1.1,6),m,.6*s,-.9,-.8,g);lg.rotation.x=.9;});
  g.scale.setScalar(scale);g.userData={wings,tsegs,nsegs,fire,jaw,flap:Math.random()*6,fireT:rand(8,20),fireOn:0};scene.add(g);return g;
}
  return { makeFigure, walkAnim, idle, makeDragon };
}
