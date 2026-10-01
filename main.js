// My Library — 竜の国の大図書館
import * as THREE from 'three';
import './style.css';
import { $, rand, pick, clamp, lerp, smooth, isTouch } from './util.js';
import { createTextures } from './textures.js';
import { createFigureKit } from './figures.js';
import { RECS, BORROW_URL, amazonUrl, isRead, setRead, readCount, findRec, mergeRemote, PRIZE_ORDER, PRIZE_SHORT, prizeName, inBag, toggleBag, bagList } from './books.js';
import { loadCast } from './characters.js';
import { createPeople } from './people.js';
import { COUNTERS, buildCounters, createCounterUI } from './counters.js';
import { createScanner } from './scanner.js';
import { createWishlist, lookupIsbn, coverUrl } from './wishlist.js';
import { createWishPile, PILE } from './wishpile.js';
import { registerWish } from './books.js';
import { initSearch } from './search.js';
import { createTreasure, createSfx } from './treasure.js';
import { createJournal } from './journal.js';
import { createWorld } from './world.js';
import { createMapTexture, createMapUI } from './mapui.js';
import { createArchive } from './archive.js';
import { createSpineAtlas, patchSpineMaterial } from './spines.js';

let renderer;
try{renderer=new THREE.WebGLRenderer({canvas:$('c'),antialias:true,powerPreference:'high-performance'});}catch(e){$('err').style.display='flex';throw e;}
renderer.setPixelRatio(Math.min(devicePixelRatio,isTouch?1.6:2));renderer.setSize(innerWidth,innerHeight);
renderer.outputEncoding=THREE.sRGBEncoding;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.05;
renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
const scene=new THREE.Scene();scene.fog=new THREE.Fog(0xa9bccc,120,700);
const camera=new THREE.PerspectiveCamera(isTouch?74:68,innerWidth/innerHeight,0.05,1300);camera.rotation.order='YXZ';

// ================= textures =================
const ANISO=Math.min(8,renderer.capabilities.getMaxAnisotropy());
const {parquetTex,plasterTex,vaultTex,cupolaTex,muralTex,roseTex,spineTex,rainTex,cloudTex,stoneTex,flameTex,textTex,globeTex}=createTextures(ANISO);


// ================= materials & helpers =================
const M={
  walnut:new THREE.MeshStandardMaterial({color:0x4a2c18,roughness:.6}),
  walnutDark:new THREE.MeshStandardMaterial({color:0x2c190c,roughness:.55}),
  floor:new THREE.MeshStandardMaterial({map:parquetTex,roughness:.38}),
  plaster:new THREE.MeshStandardMaterial({map:plasterTex,color:0xe9dcc2,roughness:.95}),
  gold:new THREE.MeshStandardMaterial({color:0xc9a04e,roughness:.3,metalness:.9}),
  iron:new THREE.MeshStandardMaterial({color:0x1f1d1b,roughness:.45,metalness:.6}),
  leather:new THREE.MeshStandardMaterial({color:0x2d4a36,roughness:.55}),
  lampGreen:new THREE.MeshStandardMaterial({color:0x1c5a3a,emissive:0x4fae6a,emissiveIntensity:.3,roughness:.3,side:THREE.DoubleSide}),
  marble:new THREE.MeshStandardMaterial({color:0xe8e2d6,roughness:.35}),
};
const geoBox=new THREE.BoxGeometry(1,1,1);
function box(mat,w,h,d,x,y,z,opt={}){const m=new THREE.Mesh(geoBox,mat);m.scale.set(w,h,d);m.position.set(x,y,z);m.castShadow=opt.cast!==false;m.receiveShadow=true;(opt.parent||scene).add(m);return m;}
function mesh(geo,mat,x,y,z,parent){const m=new THREE.Mesh(geo,mat);m.position.set(x||0,y||0,z||0);(parent||scene).add(m);return m;}

// ================= hall =================
const W=6,L=22,SH=6.8,VR=6;
const colliders=[];
const floor=mesh(new THREE.PlaneGeometry(W*2,L*2),M.floor,0,0,0);floor.rotation.x=-Math.PI/2;floor.receiveShadow=true;
// vault
const vault=new THREE.Mesh(new THREE.CylinderGeometry(VR,VR,L*2,56,1,true,Math.PI/2,Math.PI),new THREE.MeshStandardMaterial({map:vaultTex,roughness:.8,side:THREE.DoubleSide}));
vault.rotation.x=Math.PI/2;vault.position.y=SH;vault.castShadow=true;vault.receiveShadow=true;scene.add(vault);
const oculi=[];
[-16,-8,0,8,16].forEach(z=>{const c=mesh(new THREE.CircleGeometry(2.25,48),new THREE.MeshStandardMaterial({map:cupolaTex,roughness:.8,emissive:0xffffff,emissiveMap:cupolaTex,emissiveIntensity:.05}),0,SH+VR-0.52,z);c.rotation.x=Math.PI/2;
  const o=mesh(new THREE.CircleGeometry(0.5,32),new THREE.MeshBasicMaterial({color:0xaaccee,fog:false}),0,SH+VR-0.53,z);o.rotation.x=Math.PI/2;oculi.push(o.material);
  const rib=new THREE.Mesh(new THREE.TorusGeometry(VR-0.05,0.12,8,48,Math.PI),M.gold);rib.position.set(0,SH,z);scene.add(rib);});
// cornices
[-1,1].forEach(s=>{box(M.walnutDark,0.7,0.35,L*2,s*(W-0.3),SH-0.15,0);box(M.gold,0.05,0.06,L*2,s*(W-0.66),SH-0.3,0,{cast:false});});
// west wall
box(M.plaster,0.6,SH,L*2,-W-0.3,SH/2,0);
// east wall with arched windows
const EWIN=[-16,-8,0,8,16],WW=2.6,SILL=1.0,SPR=4.9;
function archPath(p,cu){p.moveTo(cu-WW/2,SILL);p.lineTo(cu+WW/2,SILL);p.lineTo(cu+WW/2,SPR);p.absarc(cu,SPR,WW/2,0,Math.PI,false);p.lineTo(cu-WW/2,SILL);return p;}
{const s=new THREE.Shape();s.moveTo(-L,0);s.lineTo(L,0);s.lineTo(L,SH);s.lineTo(-L,SH);s.lineTo(-L,0);EWIN.forEach(z=>s.holes.push(archPath(new THREE.Path(),z)));
 const m=new THREE.Mesh(new THREE.ExtrudeGeometry(s,{depth:0.6,bevelEnabled:false,curveSegments:24}),M.plaster);m.rotation.y=-Math.PI/2;m.position.x=W+0.6;m.castShadow=m.receiveShadow=true;scene.add(m);}
const glassMats=[];
EWIN.forEach(z=>{const gm=new THREE.MeshBasicMaterial({map:rainTex,transparent:true,opacity:0,depthWrite:false});glassMats.push(gm);
  const g=new THREE.Mesh(new THREE.ShapeGeometry(archPath(new THREE.Shape(),z),20),gm);g.rotation.y=-Math.PI/2;g.position.x=W+0.3;scene.add(g);
  const top=SPR+WW/2;box(M.iron,0.08,top-SILL,0.06,W+0.3,(top+SILL)/2,z);[2.3,3.6,SPR].forEach(y=>box(M.iron,0.08,0.05,WW,W+0.3,y,z));
  box(M.walnutDark,0.5,0.08,WW+0.2,W+0.05,SILL-0.04,z);});
// end walls
function endShape(){const s=new THREE.Shape();s.moveTo(-W-0.6,0);s.lineTo(W+0.6,0);s.lineTo(W+0.6,SH);s.lineTo(W,SH);s.absarc(0,SH,VR,0,Math.PI,false);s.lineTo(-W-0.6,SH);s.lineTo(-W-0.6,0);return s;}
{const s=endShape();const rose=new THREE.Path();rose.absarc(0,9.3,1.9,0,Math.PI*2,true);s.holes.push(rose);{const dp=new THREE.Path();dp.moveTo(-1.5,0);dp.lineTo(1.5,0);dp.lineTo(1.5,3.2);dp.absarc(0,3.2,1.5,0,Math.PI,false);dp.lineTo(-1.5,0);s.holes.push(dp);}
 const m=new THREE.Mesh(new THREE.ExtrudeGeometry(s,{depth:0.6,bevelEnabled:false,curveSegments:40}),M.plaster);m.position.z=-L-0.6;m.castShadow=m.receiveShadow=true;scene.add(m);
 const ms=new THREE.Shape();ms.moveTo(W,SH);ms.absarc(0,SH,VR-0.02,0,Math.PI,false);ms.lineTo(W,SH);const mh=new THREE.Path();mh.absarc(0,9.3,2.15,0,Math.PI*2,true);ms.holes.push(mh);
 const mt=muralTex('north');const mg=new THREE.ShapeGeometry(ms,40);remapUV(mg,-VR,SH,VR*2,VR);const mu=mesh(mg,new THREE.MeshStandardMaterial({map:mt,roughness:.85}),0,0,-L+0.02);
 const rg=mesh(new THREE.CircleGeometry(1.92,48),new THREE.MeshBasicMaterial({map:roseTex}),0,9.3,-L-0.3);rg.userData.rose=true;window.__rose=rg.material;
 const rr=new THREE.Mesh(new THREE.TorusGeometry(2.05,0.12,8,48),M.gold);rr.position.set(0,9.3,-L+0.03);scene.add(rr);}
{const s=endShape();const d=new THREE.Path();d.moveTo(-1.6,0);d.lineTo(1.6,0);d.lineTo(1.6,3.4);d.absarc(0,3.4,1.6,0,Math.PI,false);d.lineTo(-1.6,0);s.holes.push(d);
 const m=new THREE.Mesh(new THREE.ExtrudeGeometry(s,{depth:0.6,bevelEnabled:false,curveSegments:40}),M.plaster);m.position.z=L;m.castShadow=m.receiveShadow=true;scene.add(m);
 
 
 const tr=mesh(new THREE.CircleGeometry(1.6,32,0,Math.PI),new THREE.MeshStandardMaterial({color:0xffe6b8,emissive:0xffd79a,emissiveIntensity:.3}),0,3.4,L+0.3);tr.rotation.y=Math.PI;
 const ms=new THREE.Shape();ms.moveTo(W,SH);ms.absarc(0,SH,VR-0.02,0,Math.PI,false);ms.lineTo(W,SH);
 const mg=new THREE.ShapeGeometry(ms,40);remapUV(mg,-VR,SH,VR*2,VR);const mu=mesh(mg,new THREE.MeshStandardMaterial({map:muralTex('south'),roughness:.85}),0,0,L-0.02);mu.rotation.y=Math.PI;}
function remapUV(g,x0,y0,w,h){const p=g.attributes.position,uv=g.attributes.uv;for(let i=0;i<p.count;i++)uv.setXY(i,(p.getX(i)-x0)/w,(p.getY(i)-y0)/h);uv.needsUpdate=true;}

// ================= wall shelves =================
const LOW=[0.14,0.64,1.14,1.64,2.14,2.64],UP=[3.62,4.12,4.62,5.12,5.62];
const FRONT=W-0.45;
const WALLS=[{side:-1,name:'西の壁',segs:[[-21.2,21.2]]},{side:1,name:'東の壁',segs:[[-21.2,-17.55],[-14.45,-9.55],[-6.45,-1.55],[1.55,6.45],[9.55,14.45],[17.55,21.2]]}];
const BOOK_COLORS=[0x7a1f1f,0x1f2f5a,0x274a36,0xa8742a,0xe6dcc3,0x1b1b1d,0x5a2238,0x2c5f64,0x6b6b66,0xf2efe6,0x8c3b1e,0x3c4f7a,0xc9a24b,0x4b3a2a,0xb5462f,0x3d2a52];
const bookMat=new THREE.MeshStandardMaterial({map:spineTex,roughness:.75});
const labelMat=new THREE.MeshStandardMaterial({color:0xd6ae52,metalness:.8,roughness:.3,emissive:0x5a3f08,emissiveIntensity:.6});
const dummy=new THREE.Object3D();
const postMat=M.walnut;const posts=[];const balusters=[];
const wallMeshes=[];
WALLS.forEach(wl=>{
  const s=wl.side,face=-s,bx=s*FRONT;
  const bays=[];wl.segs.forEach(([z0,z1])=>{const n=Math.max(1,Math.round((z1-z0)/3));for(let i=0;i<n;i++)bays.push([z0+(z1-z0)*i/n,z0+(z1-z0)*(i+1)/n]);});
  bays.sort((a,b)=>b[0]-a[0]);bays.forEach((b,i)=>b.num=i+1);
  wl.bays=bays;
  // backs, boards, posts
  wl.segs.forEach(([z0,z1])=>{const len=z1-z0,zc=(z0+z1)/2;
    box(M.walnutDark,0.05,6.2,len,s*(W-0.02),3.1,zc,{cast:false});
    LOW.concat(UP).forEach(y=>box(M.walnut,0.46,0.03,len,s*(W-0.23),y-0.015,zc,{cast:false}));
    box(M.walnut,0.5,0.14,len,s*(W-0.25),0.07,zc);
    box(M.walnutDark,0.52,0.3,len,s*(W-0.26),3.1,zc);box(M.gold,0.02,0.03,len,s*(FRONT-0.06),3.02,zc,{cast:false});});
  bays.forEach(b=>{posts.push([s*(W-0.24),b[0]]);posts.push([s*(W-0.24),b[1]]);
    const t=textTex(String(b.num),128,128,'800 76px "Shippori Mincho B1", serif','#2a1a0c','#e3c06a');
    const pl=mesh(new THREE.PlaneGeometry(0.28,0.28),new THREE.MeshStandardMaterial({map:t,roughness:.5,emissive:0xffffff,emissiveMap:t,emissiveIntensity:.12}),s*(FRONT-0.075),3.12,(b[0]+b[1])/2);pl.rotation.y=-s*Math.PI/2;});
  // gallery walkway (full length) + railing
  box(M.walnutDark,0.95,0.12,L*2-0.6,s*(FRONT-0.46),3.3,0);box(M.gold,0.02,0.04,L*2-0.6,s*(FRONT-0.94),3.25,0,{cast:false});
  box(M.iron,0.05,0.05,L*2-0.6,s*(FRONT-0.9),4.3,0);box(M.iron,0.04,0.04,L*2-0.6,s*(FRONT-0.9),3.42,0,{cast:false});
  for(let z=-L+0.4;z<=L-0.4;z+=0.24)balusters.push([s*(FRONT-0.9),z]);
  for(let z=-L+0.8;z<=L-0.8;z+=2.2){box(M.walnutDark,0.4,0.3,0.08,s*(FRONT-0.25),3.05,z,{cast:false});}
  // books
  const inst=[];
  bays.forEach((b,bi)=>{
    [['low',LOW],['up',UP]].forEach(([tier,levels])=>levels.forEach((ly,li)=>{
      let z=b[0]+0.08;
      while(z<b[1]-0.08){
        if(Math.random()<.03){z+=rand(.05,.14);continue;}
        const t=Math.random()<.15?rand(.055,.085):rand(.022,.05);if(z+t>b[1]-0.07)break;
        const h=rand(.27,.45),d=rand(.17,.24);
        inst.push({x:bx+s*d/2,y:ly+h/2,z:z+t/2,sx:d,sy:h,sz:t,face,bay:b.num,tier,level:li+1});z+=t+0.0015;}
    }));
  });
  const mesh2=new THREE.InstancedMesh(new THREE.BoxGeometry(1,1,1),bookMat,inst.length);mesh2.receiveShadow=true;
  const col=new THREE.Color();
  inst.forEach((b,i)=>{dummy.position.set(b.x,b.y,b.z);dummy.scale.set(b.sx,b.sy,b.sz);dummy.rotation.set(Math.random()<.02?rand(-.07,.07):0,0,0);dummy.updateMatrix();mesh2.setMatrixAt(i,dummy.matrix);
    col.setHex(pick(BOOK_COLORS));col.offsetHSL(rand(-.015,.015),rand(-.06,.04),rand(-.06,.05));mesh2.setColorAt(i,col);});
  mesh2.instanceMatrix.needsUpdate=true;scene.add(mesh2);
  wallMeshes.push({wl,mesh:mesh2,inst,rec:new Int16Array(inst.length).fill(-1),lab:new Int32Array(inst.length).fill(-1),base:mesh2.instanceMatrix.array.slice()});
  colliders.push(s<0?{x0:-7,x1:-(FRONT-0.05),z0:-L,z1:L}:{x0:FRONT-0.05,x1:6.6,z0:-L,z1:L});
});
{const pm=new THREE.InstancedMesh(new THREE.BoxGeometry(0.47,6.25,0.1),postMat,posts.length);posts.forEach((p,i)=>{dummy.position.set(p[0],3.12,p[1]);dummy.scale.set(1,1,1);dummy.rotation.set(0,0,0);dummy.updateMatrix();pm.setMatrixAt(i,dummy.matrix);});pm.castShadow=true;pm.receiveShadow=true;scene.add(pm);
 const bm=new THREE.InstancedMesh(new THREE.CylinderGeometry(0.012,0.012,0.88,5),M.iron,balusters.length);balusters.forEach((p,i)=>{dummy.position.set(p[0],3.86,p[1]);dummy.updateMatrix();bm.setMatrixAt(i,dummy.matrix);});scene.add(bm);}
// ---- 本の置き場所：西の壁＝貸出履歴と未読、東の壁＝文学賞（賞ごと・新しい回から）
const recLoc=[];
const nearCounter=b=>b.z>16.3&&b.z<20.5;
const slotsW=[],slotsE=[];
wallMeshes.forEach((w,wi)=>w.inst.forEach((b,i)=>{if(b.tier==='low'&&b.level>=2&&b.level<=5&&!nearCounter(b))(wi===0?slotsW:slotsE).push([wi,i]);}));
for(let i=slotsW.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[slotsW[i],slotsW[j]]=[slotsW[j],slotsW[i]];}
slotsE.sort((a,b)=>{const A=wallMeshes[1].inst[a[1]],B=wallMeshes[1].inst[b[1]];return A.bay-B.bay||B.level-A.level||(B.z-A.z);});
const PRIZE_RESERVE=12;const prizeSlots={};const bayPrizes={};
{let k=0;
 PRIZE_ORDER.forEach(p=>{const recs=RECS.filter(r=>r.primary&&r.primary.p===p).sort((a,b)=>(b.primary.n-a.primary.n)||a.t.localeCompare(b.t,'ja'));
   const n=recs.length+PRIZE_RESERVE;const slots=slotsE.slice(k,k+n);k+=n;prizeSlots[p]=slots;
   slots.forEach(([wi,i])=>{const bay=wallMeshes[1].inst[i].bay;(bayPrizes[bay]=bayPrizes[bay]||new Set()).add(p);});
   recs.forEach((r,j)=>place(r.id,slots[j]));});
 prizeSlots._overflow=slotsE.slice(k);
 let w=0;RECS.forEach(r=>{if(!r.primary)place(r.id,slotsW[w++]);});}
function place(ri,slot){if(!slot)return false;const [wi,i]=slot;const w=wallMeshes[wi];w.rec[i]=ri;recLoc[ri]=slot;return true;}
function placeNew(ri){const r=RECS[ri];if(r.primary){const s=(prizeSlots[r.primary.p]||[]).find(([wi,i])=>wallMeshes[wi].rec[i]<0)||prizeSlots._overflow.find(([wi,i])=>wallMeshes[wi].rec[i]<0);return place(ri,s);}return place(ri,slotsW.find(([wi,i])=>wallMeshes[wi].rec[i]<0));}
{const labels=[[],[]];
 wallMeshes.forEach((w,wi)=>w.inst.forEach((b,i)=>{if(b.tier==='low'&&b.level>=2&&b.level<=5){w.lab[i]=labels[wi].length;labels[wi].push({x:b.x+b.face*b.sx/2+b.face*0.003,y:b.y-b.sy/2+0.045,z:b.z,t:b.sz*.72});}}));
 wallMeshes.forEach((w,wi)=>{const lm=new THREE.InstancedMesh(new THREE.BoxGeometry(1,1,1),labelMat,Math.max(1,labels[wi].length));
   labels[wi].forEach((l,k)=>{dummy.position.set(l.x,l.y,l.z);dummy.scale.set(0.008,0.03,l.t);dummy.rotation.set(0,0,0);dummy.updateMatrix();lm.setMatrixAt(k,dummy.matrix);});
   lm.count=labels[wi].length;scene.add(lm);w.lm=lm;w.lbase=lm.instanceMatrix.array.slice();});
 wallMeshes.forEach(w=>w.inst.forEach((b,i)=>applyLabel(w,i,0)));}
function applyLabel(w,i,amt){const li=w.lab[i];if(li<0)return;const m=new THREE.Matrix4();const ri=w.rec[i];if(ri>=0&&isRead(RECS[ri])){m.fromArray(w.lbase,li*16);const f=w.inst[i].face;m.elements[12]+=f*amt;m.elements[13]+=amt*.1;}else m.makeScale(0,0,0);w.lm.setMatrixAt(li,m);w.lm.instanceMatrix.needsUpdate=true;}
// ---- 背表紙の書名
const spineAtlas=createSpineAtlas(ANISO);patchSpineMaterial(bookMat,spineAtlas.tex);
wallMeshes.forEach(w=>{const n=w.inst.length;w.atlasAttr=new THREE.InstancedBufferAttribute(new Float32Array(n*4),4);const sg=new Float32Array(n);w.inst.forEach((b,i)=>{sg[i]=b.face;});
  w.mesh.geometry.setAttribute('atlasRect',w.atlasAttr);w.mesh.geometry.setAttribute('spineSign',new THREE.InstancedBufferAttribute(sg,1));});
function setSpine(w,i){const ri=w.rec[i];if(ri<0)return;const k=spineAtlas.add(RECS[ri].t);if(k<0)return;w.atlasAttr.array.set(spineAtlas.rect(k),i*4);w.atlasAttr.needsUpdate=true;}
wallMeshes.forEach(w=>w.rec.forEach((ri,i)=>{if(ri>=0)setSpine(w,i);}));spineAtlas.flush();
if(document.fonts&&document.fonts.ready)document.fonts.ready.then(()=>{spineAtlas.redrawAll();spineAtlas.flush();});
// 賞の名札（東の壁の書架の上）
{const wl=WALLS[1];wl.bays.forEach(b=>{const ps=bayPrizes[b.num];if(!ps)return;const txt=[...ps].map(p=>PRIZE_SHORT[p]||p).join('・');
  const t=textTex(txt,512,96,'800 52px "Shippori Mincho B1", serif','#1f3a2d','#efd99a');
  const len=Math.min(2.1,(b[1]-b[0])-0.5);const pl=mesh(new THREE.PlaneGeometry(len,len*96/512),new THREE.MeshStandardMaterial({map:t,roughness:.5,emissive:0xffffff,emissiveMap:t,emissiveIntensity:.14}),FRONT-0.08,2.99,(b[0]+b[1])/2);pl.rotation.y=-Math.PI/2;});}
{const t=textTex('貸出の記録と、まだ読んでいない本',1024,96,'800 50px "Shippori Mincho B1", serif','#1f3a2d','#efd99a');const pl=mesh(new THREE.PlaneGeometry(4.2,0.39),new THREE.MeshStandardMaterial({map:t,roughness:.5,emissive:0xffffff,emissiveMap:t,emissiveIntensity:.14}),-FRONT+0.08,2.99,0);pl.rotation.y=Math.PI/2;
 const t2=textTex('文学賞の書架',512,96,'800 52px "Shippori Mincho B1", serif','#1f3a2d','#efd99a');}
// ================= reading tables, globe, candles =================
const seats=[];const lampLights=[];
[-14,-4.5,5].forEach((tz,ti)=>{
  box(M.walnutDark,1.5,0.08,6,0,0.78,tz);box(M.leather,1.3,0.01,5.8,0,0.825,tz,{cast:false});
  [[-1,-1],[1,-1],[-1,1],[1,1],[-1,0],[1,0]].forEach(([a,b])=>box(M.walnutDark,0.1,0.74,0.1,a*0.62,0.37,tz+b*2.7));
  [-1.8,0,1.8].forEach((lz,k)=>{box(M.gold,0.16,0.03,0.16,0,0.84,tz+lz,{cast:false});box(M.gold,0.02,0.34,0.02,0,1.0,tz+lz,{cast:false});
    const sh=new THREE.Mesh(new THREE.CylinderGeometry(0.11,0.14,0.42,16,1,true,0,Math.PI),M.lampGreen);sh.rotation.z=Math.PI/2;sh.position.set(0,1.18,tz+lz);scene.add(sh);
    if(k===1){const pl=new THREE.PointLight(0xffc98a,0,8,2);pl.position.set(0,1.1,tz);scene.add(pl);lampLights.push(pl);}});
  [-2.1,-0.7,0.7,2.1].forEach(cz=>[-1,1].forEach(s=>{const cx=s*1.05;
    box(M.walnut,0.46,0.06,0.46,cx,0.48,tz+cz);box(M.leather,0.4,0.03,0.4,cx,0.52,tz+cz,{cast:false});box(M.walnut,0.05,0.6,0.46,cx+s*0.22,0.8,tz+cz);
    seats.push({x:cx,z:tz+cz,ry:s>0?-Math.PI/2:Math.PI/2});}));
  colliders.push({x0:-1.4,x1:1.4,z0:tz-3.2,z1:tz+3.2});
});
const globeG=new THREE.Group();globeG.position.set(0,0,14.5);scene.add(globeG);
{mesh(new THREE.CylinderGeometry(0.35,0.5,0.9,16),M.walnutDark,0,0.45,0,globeG);const ring=new THREE.Mesh(new THREE.TorusGeometry(0.72,0.03,8,40),M.gold);ring.position.y=1.65;ring.rotation.y=Math.PI/2;globeG.add(ring);
 const h=new THREE.Mesh(new THREE.TorusGeometry(0.72,0.025,8,40),M.gold);h.position.y=1.65;h.rotation.x=Math.PI/2;globeG.add(h);
 const sp=new THREE.Mesh(new THREE.SphereGeometry(0.66,32,20),new THREE.MeshStandardMaterial({map:globeTex,roughness:.5}));sp.position.y=1.65;sp.rotation.z=0.4;globeG.add(sp);globeG.userData.sphere=sp;}
colliders.push({x0:-0.9,x1:0.9,z0:13.6,z1:15.4});
const CANDLE_N=70;const candleMesh=new THREE.InstancedMesh(new THREE.CylinderGeometry(0.03,0.03,0.22,8),new THREE.MeshStandardMaterial({color:0xf2ead6,roughness:.6,emissive:0xffe2b0,emissiveIntensity:.2}),CANDLE_N);
const candleData=[];const flamePos=new Float32Array(CANDLE_N*3);
for(let i=0;i<CANDLE_N;i++){candleData.push({x:rand(-4.2,4.2),y:rand(7,10.6),z:rand(-20,20),ph:Math.random()*9});}
scene.add(candleMesh);
const flameGeo=new THREE.BufferGeometry();flameGeo.setAttribute('position',new THREE.BufferAttribute(flamePos,3));
const flames=new THREE.Points(flameGeo,new THREE.PointsMaterial({map:flameTex,size:0.35,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,opacity:0}));scene.add(flames);
const vaultLights=[-10,10].map(z=>{const l=new THREE.PointLight(0xffc27a,0,26,1.4);l.position.set(0,9.5,z);scene.add(l);return l;});

const counterDecor=buildCounters({scene,box,M,textTex,colliders});
const wishPile=createWishPile({scene,M,textTex,colliders});
const mapTex=createMapTexture();
const world=createWorld({scene,box,mesh,M,textTex,colliders,tex:{stoneTex,parquetTex,plasterTex},mapTex,W,L,weather:()=>[rain,snow]});
// ================= lights & sky =================
const hemi=new THREE.HemisphereLight(0xcfe0f0,0x3a2a1c,0.4);scene.add(hemi);
const amb=new THREE.AmbientLight(0xffd9b0,0.12);scene.add(amb);
const sun=new THREE.DirectionalLight(0xffffff,1.5);sun.castShadow=true;const sm=isTouch?1024:2048;sun.shadow.mapSize.set(sm,sm);
Object.assign(sun.shadow.camera,{left:-28,right:28,top:28,bottom:-28,near:1,far:180});sun.shadow.camera.updateProjectionMatrix();sun.shadow.bias=-0.0006;sun.shadow.normalBias=0.04;scene.add(sun);scene.add(sun.target);
const skyU={top:{value:new THREE.Color()},hor:{value:new THREE.Color()},bot:{value:new THREE.Color(0x2a2a28)}};
const sky=new THREE.Mesh(new THREE.SphereGeometry(900,32,16),new THREE.ShaderMaterial({uniforms:skyU,side:THREE.BackSide,depthWrite:false,fog:false,
  vertexShader:'varying vec3 vW;void main(){vec4 w=modelMatrix*vec4(position,1.);vW=w.xyz;gl_Position=projectionMatrix*viewMatrix*w;}',
  fragmentShader:'uniform vec3 top;uniform vec3 hor;uniform vec3 bot;varying vec3 vW;void main(){float h=normalize(vW).y;vec3 c=h>0.?mix(hor,top,pow(clamp(h,0.,1.),.55)):mix(hor,bot,clamp(-h*5.,0.,1.));gl_FragColor=vec4(c,1.);}'}));scene.add(sky);
const sunDisc=mesh(new THREE.SphereGeometry(16,20,12),new THREE.MeshBasicMaterial({color:0xfff1c8,fog:false,transparent:true}));
const moonDisc=mesh(new THREE.SphereGeometry(11,20,12),new THREE.MeshBasicMaterial({color:0xe8ecf5,fog:false,transparent:true}));
const moon2=mesh(new THREE.SphereGeometry(5,16,10),new THREE.MeshBasicMaterial({color:0xd8b8e8,fog:false,transparent:true}));
const starGeo=new THREE.BufferGeometry();{const p=[];for(let i=0;i<1200;i++){const th=Math.random()*Math.PI*2,ph=Math.acos(rand(0.05,1));p.push(Math.sin(ph)*Math.cos(th)*820,Math.cos(ph)*820,Math.sin(ph)*Math.sin(th)*820);}starGeo.setAttribute('position',new THREE.Float32BufferAttribute(p,3));}
const stars=new THREE.Points(starGeo,new THREE.PointsMaterial({color:0xffffff,size:1.7,sizeAttenuation:false,transparent:true,opacity:0,fog:false,depthWrite:false}));scene.add(stars);
const clouds=[];for(let i=0;i<18;i++){const m=mesh(new THREE.PlaneGeometry(rand(160,280),rand(60,90)),new THREE.MeshBasicMaterial({map:cloudTex,transparent:true,opacity:0,depthWrite:false,fog:false}),rand(120,600),rand(110,200),rand(-500,500));clouds.push(m);}

// ================= outside world =================
const grassMat=new THREE.MeshStandardMaterial({color:0x5f7a45,roughness:1});
const ground=mesh(new THREE.PlaneGeometry(1400,1400),grassMat,700+W+0.6,-0.02,0);ground.rotation.x=-Math.PI/2;ground.receiveShadow=true;
const court=mesh(new THREE.PlaneGeometry(36,80),new THREE.MeshStandardMaterial({map:stoneTex,roughness:.9}),W+0.6+18,0.01,0);court.rotation.x=-Math.PI/2;court.receiveShadow=true;const courtMat=court.material;
box(new THREE.MeshStandardMaterial({color:0x9a8e7a,roughness:.9}),0.8,1.1,80,W+0.6+36,0.55,0);
const torchFlames=[];
for(let z=-36;z<=36;z+=12){if(z===-24||z===24)continue;box(M.iron,0.12,2.6,0.12,W+4,1.3,z);const f=mesh(new THREE.SphereGeometry(0.16,10,8),new THREE.MeshBasicMaterial({color:0xffb050,transparent:true,opacity:0}),W+4,2.72,z);torchFlames.push(f);}
// forest
const TREE_N=420;const treeGeo=new THREE.ConeGeometry(2.4,9,7);treeGeo.translate(0,4.5,0);
const treeMat=new THREE.MeshStandardMaterial({color:0x2f4a2c,roughness:1,flatShading:true});
const forest=new THREE.InstancedMesh(treeGeo,treeMat,TREE_N);
for(let i=0;i<TREE_N;i++){let x,z;do{x=rand(48,320);z=rand(-360,360);}while(Math.hypot(x-120,z+60)<45);const s=rand(.7,1.5);dummy.position.set(x,0,z);dummy.scale.set(s,s*rand(.9,1.3),s);dummy.rotation.set(0,Math.random()*6,0);dummy.updateMatrix();forest.setMatrixAt(i,dummy.matrix);}
scene.add(forest);
// mountains
const mtMat=new THREE.MeshStandardMaterial({color:0x5b6475,roughness:1,flatShading:true});const snowCapMat=new THREE.MeshStandardMaterial({color:0xeef2f6,roughness:.9,flatShading:true});
for(let i=0;i<11;i++){const h=rand(120,240),r=rand(110,190),x=rand(430,620),z=-520+i*105+rand(-30,30);const m=mesh(new THREE.ConeGeometry(r,h,9),mtMat,x,h/2-2,z);m.rotation.y=Math.random()*6;
  const cap=mesh(new THREE.ConeGeometry(r*0.3,h*0.3,9),snowCapMat,x,h-h*0.15-1,z);cap.rotation.y=m.rotation.y;}
// castle
const castle=new THREE.Group();castle.position.set(120,0,-60);scene.add(castle);
const stoneMat=new THREE.MeshStandardMaterial({color:0xa99f8c,roughness:.95});const roofMat=new THREE.MeshStandardMaterial({color:0x2c3d6b,roughness:.7});
const castleWin=new THREE.MeshStandardMaterial({color:0x221b12,emissive:0xffc070,emissiveIntensity:0});
[[-22,-22],[22,-22],[-22,22],[22,22]].forEach(([x,z])=>{mesh(new THREE.CylinderGeometry(5,5.5,26,14),stoneMat,x,13,z,castle);mesh(new THREE.ConeGeometry(6.4,12,14),roofMat,x,32,z,castle);
  for(let k=0;k<3;k++){const w=mesh(new THREE.BoxGeometry(0.9,1.6,0.3),castleWin,x-5.2,8+k*6,z,castle);w.rotation.y=Math.PI/2;}});
[[0,-22,44,1],[0,22,44,1],[-22,0,1,44],[22,0,1,44]].forEach(([x,z,w,d])=>{mesh(new THREE.BoxGeometry(w===1?3:w,16,d===1?3:d),stoneMat,x,8,z,castle);});
mesh(new THREE.BoxGeometry(20,34,20),stoneMat,0,17,0,castle);mesh(new THREE.ConeGeometry(15,14,4),roofMat,0,41,0,castle).rotation.y=Math.PI/4;
mesh(new THREE.CylinderGeometry(3.5,3.8,58,12),stoneMat,6,29,6,castle);mesh(new THREE.ConeGeometry(4.6,14,12),roofMat,6,65,6,castle);
for(let k=0;k<6;k++){const w=mesh(new THREE.BoxGeometry(0.3,2,1.2),castleWin,-10.2,8+k*4.2,rand(-6,6),castle);}
const banners=[];[[-22,-22],[22,-22],[-22,22],[22,22],[6,6]].forEach(([x,z],i)=>{const h=i===4?72:38;mesh(new THREE.CylinderGeometry(.12,.12,6,6),M.iron,x,h,z,castle);const b=mesh(new THREE.PlaneGeometry(4,1.6,8,1),new THREE.MeshStandardMaterial({color:i%2?0x8a1f2a:0xd2aa55,side:THREE.DoubleSide,roughness:.8}),x+2,h+2,z,castle);banners.push(b);});

// ================= figures =================
const {makeDragon}=createFigureKit(scene);


// ================= dragons =================

const dragons=[
  {g:makeDragon(0x8e1c1c,1.5),cx:95,cz:-10,rx:82,rz:110,h:34,sp:.07,a:0},
  {g:makeDragon(0x1f5e3f,1.2),cx:180,cz:40,rx:120,rz:90,h:58,sp:.05,a:2},
  {g:makeDragon(0x23242e,1.8),cx:260,cz:-120,rx:160,rz:140,h:80,sp:.035,a:4},
];

// ================= precipitation =================
const RAIN_N=4500;const rainPos=new Float32Array(RAIN_N*6);
for(let i=0;i<RAIN_N;i++){const x=rand(W+1,120),y=rand(0,55),z=rand(-90,90);rainPos.set([x,y,z,x+0.05,y-1,z],i*6);}
const rainGeo=new THREE.BufferGeometry();rainGeo.setAttribute('position',new THREE.BufferAttribute(rainPos,3));
const rain=new THREE.LineSegments(rainGeo,new THREE.LineBasicMaterial({color:0xaebccb,transparent:true,opacity:.55}));scene.add(rain);
const SNOW_N=2800;const snowPos=new Float32Array(SNOW_N*3);const snowPh=new Float32Array(SNOW_N);
for(let i=0;i<SNOW_N;i++){snowPos.set([rand(W+1,120),rand(0,55),rand(-90,90)],i*3);snowPh[i]=Math.random()*9;}
const snowGeo=new THREE.BufferGeometry();snowGeo.setAttribute('position',new THREE.BufferAttribute(snowPos,3));
const snow=new THREE.Points(snowGeo,new THREE.PointsMaterial({color:0xffffff,size:0.16,transparent:true,opacity:.9,depthWrite:false}));scene.add(snow);

// ================= state & env UI =================
const WX={clear:{cloud:0,rain:0,snow:0,name:'晴れ'},cloudy:{cloud:.65,rain:0,snow:0,name:'くもり'},rain:{cloud:.9,rain:1,snow:0,name:'雨'},snow:{cloud:.75,rain:0,snow:1,name:'雪'}};
const now=new Date();
const S={hour:now.getHours()+now.getMinutes()/60,auto:true,autoWx:true,wx:'clear',cloud:0,rain:0,snow:0,flash:0,nextFlash:6,nextWx:rand(3,5)*20};
const player={x:0,z:19.5,yaw:0,pitch:0,bob:0};const keys={};
const timeIn=$('time');
function fmt(h){h=((h%24)+24)%24;const hh=Math.floor(h),mm=Math.floor((h-hh)*60);return String(hh).padStart(2,'0')+':'+String(mm).padStart(2,'0');}
function setWx(w){S.wx=w;document.querySelectorAll('#wx button').forEach(b=>b.setAttribute('aria-pressed',b.dataset.w===w?'true':'false'));}
document.querySelectorAll('#wx button').forEach(b=>b.addEventListener('click',()=>{setWx(b.dataset.w);S.nextWx=rand(3,5)*20;}));
timeIn.addEventListener('input',()=>{S.hour=parseFloat(timeIn.value);});
$('auto').addEventListener('change',e=>S.auto=e.target.checked);$('autoWx').addEventListener('change',e=>S.autoWx=e.target.checked);
$('envBtn').addEventListener('click',()=>{const o=$('env').classList.toggle('open');$('envBtn').setAttribute('aria-expanded',o);});
if(!isTouch)$('joyHint').textContent='WASD / 矢印キーで歩く・ドラッグで見回す';

const C=h=>new THREE.Color(h);
const NIGHT_T=C(0x070f22),NIGHT_H=C(0x1b2848),DAY_T=C(0x3a78c6),DAY_H=C(0xc8dcec),DUSK_T=C(0x3c3f7a),DUSK_H=C(0xf2915a),OVC_T=C(0x7a8591),OVC_H=C(0xb3b9bf);
const SNOWC=C(0xe9eef2),FLASHC=C(0xdde6ff),WHITE=C(0xffffff);
const tA=new THREE.Color(),tB=new THREE.Color(),tC=new THREE.Color();
const vSun=new THREE.Vector3(),vMoon=new THREE.Vector3();
let activity=1;
function updateEnv(dt,time){
  const t=WX[S.wx];const k=1-Math.exp(-dt*.35);S.cloud=lerp(S.cloud,t.cloud,k);S.rain=lerp(S.rain,t.rain,k);S.snow=lerp(S.snow,t.snow,k);
  const h=S.hour,dayT=(h-6)/12,elev=Math.sin(dayT*Math.PI);
  const day=smooth(-.12,.28,elev),night=1-day,dusk=Math.exp(-Math.pow(elev/.2,2))*(h>4&&h<21?1:0),cloud=S.cloud;
  tA.copy(NIGHT_T).lerp(DAY_T,day).lerp(DUSK_T,dusk*.6*(1-cloud));tB.copy(NIGHT_H).lerp(DAY_H,day).lerp(DUSK_H,dusk*.85*(1-cloud));
  const ob=.1+.9*day;tC.copy(OVC_T).multiplyScalar(ob*(1-S.rain*.3));tA.lerp(tC,cloud);tC.copy(OVC_H).multiplyScalar(ob*(1-S.rain*.25));tB.lerp(tC,cloud);
  if(S.flash>0){tA.lerp(FLASHC,S.flash*.7);tB.lerp(FLASHC,S.flash*.7);}
  skyU.top.value.copy(tA);skyU.hor.value.copy(tB);skyU.bot.value.copy(tB).multiplyScalar(.45);
  const wet=Math.max(S.rain,S.snow*.8);scene.fog.color.copy(tB);scene.fog.far=lerp(750,160,wet);scene.fog.near=lerp(150,30,wet);
  oculi.forEach(m=>m.color.copy(tA).lerp(tB,.3));
  vSun.set(.95,Math.max(elev,-.3)*.95,-Math.cos(dayT*Math.PI)*.85).normalize();
  const mt=((h-18+24)%24)/12,melev=Math.sin(mt*Math.PI);vMoon.set(.9,Math.max(melev,-.3)*.8,-Math.cos(mt*Math.PI)*.8).normalize();
  sunDisc.position.copy(vSun).multiplyScalar(780);sunDisc.material.opacity=clamp(elev*4,0,1)*(1-cloud);sunDisc.material.color.setHSL(.1,1,lerp(.6,.88,smooth(0,.4,elev)));
  moonDisc.position.copy(vMoon).multiplyScalar(780);moonDisc.material.opacity=clamp(melev*4,0,1)*(1-cloud)*night;
  moon2.position.copy(vMoon).applyAxisAngle(new THREE.Vector3(0,1,0),.35).multiplyScalar(780);moon2.position.y+=60;moon2.material.opacity=moonDisc.material.opacity*.9;
  stars.material.opacity=night*(1-cloud)*.9;
  if(elev>0){sun.position.copy(vSun).multiplyScalar(90);sun.intensity=smooth(0,.25,elev)*(1-cloud*.92)*2.6;sun.color.setHSL(.09,lerp(.9,.25,smooth(0,.5,elev)),lerp(.62,.9,smooth(0,.5,elev)));}
  else{sun.position.copy(vMoon).multiplyScalar(90);sun.intensity=clamp(melev,0,1)*(1-cloud)*.35;sun.color.set(0x9fb4ff);}
  hemi.color.copy(tA).lerp(WHITE,.3);hemi.intensity=.12+.5*day*(1-cloud*.45)+S.flash*1.2;
  const dark=clamp(night+cloud*.45*day,0,1);
  amb.intensity=.1+dark*.12;
  lampLights.forEach(l=>l.intensity=.3+dark*1.8);M.lampGreen.emissiveIntensity=.12+dark*.7;
  vaultLights.forEach(l=>l.intensity=.2+dark*1.6);
  flames.material.opacity=.25+dark*.75;candleMesh.material.emissiveIntensity=.1+dark*.5;
  if(window.__rose)window.__rose.color.setScalar(.18+.82*day*(1-cloud*.5)+S.flash*.5);
  renderer.toneMappingExposure=1.02+dark*.12;
  castleWin.emissiveIntensity=night*2.2+cloud*day*.3;
  torchFlames.forEach((f,i)=>{f.material.opacity=dark>.35?.9:0;f.scale.setScalar(1+Math.sin(time*9+i)*.15);});
  courtMat.roughness=lerp(.9,.25,S.rain);courtMat.color.setHex(0xffffff).multiplyScalar(1-S.rain*.3).lerp(SNOWC,S.snow*.8);
  grassMat.color.setHex(0x5f7a45).lerp(SNOWC,S.snow*.85);treeMat.color.setHex(0x2f4a2c).lerp(SNOWC,S.snow*.55);
  clouds.forEach(c=>{c.material.opacity=clamp(.12+cloud*.88,0,1)*(.35+.65*day)*(cloud>.05?1:.3);c.material.color.copy(tB).lerp(WHITE,day*.5*(1-S.rain));c.position.z+=dt*(3+cloud*8);if(c.position.z>600)c.position.z=-600;c.lookAt(camera.position.x,c.position.y,camera.position.z);});
  rain.visible=S.rain>.02;rainGeo.setDrawRange(0,Math.floor(RAIN_N*2*S.rain));rain.material.color.copy(tB).lerp(WHITE,.35);
  if(rain.visible){const a=rainPos;for(let i=0;i<RAIN_N;i++){const o=i*6;let y=a[o+1]-dt*28;if(y<0)y+=55;a[o+1]=y;a[o+4]=y-1;}rainGeo.attributes.position.needsUpdate=true;}
  snow.visible=S.snow>.02;snowGeo.setDrawRange(0,Math.floor(SNOW_N*S.snow));
  if(snow.visible){const a=snowPos;for(let i=0;i<SNOW_N;i++){const o=i*3;a[o+1]-=dt*1.4;a[o+2]+=Math.sin(time*.8+snowPh[i])*dt*.5;if(a[o+1]<0)a[o+1]+=55;}snowGeo.attributes.position.needsUpdate=true;}
  glassMats.forEach(m=>m.opacity=S.rain*.55);rainTex.offset.y-=dt*.05*S.rain;
  if(S.rain>.8){S.nextFlash-=dt;if(S.nextFlash<0){S.flash=1;S.nextFlash=rand(9,22);}}
  S.flash=Math.max(0,S.flash-dt*2.6);$('flash').style.opacity=(S.flash>.6?(S.flash-.6)*.18:0).toFixed(3);
  banners.forEach((b,i)=>{b.rotation.y=Math.sin(time*(1.5+S.rain)+i)*.25;});
  activity=clamp(.15+.85*smooth(6,9,h)*(1-smooth(21,23.5,h))+S.rain*.1,0,1);
  const sp=globeG.userData.sphere;sp.rotation.y+=dt*.08;
  for(let i=0;i<CANDLE_N;i++){const c=candleData[i];const y=c.y+Math.sin(time*.6+c.ph)*.12;dummy.position.set(c.x,y,c.z);dummy.scale.set(1,1,1);dummy.rotation.set(0,0,0);dummy.updateMatrix();candleMesh.setMatrixAt(i,dummy.matrix);flamePos[i*3]=c.x;flamePos[i*3+1]=y+.16;flamePos[i*3+2]=c.z;}
  candleMesh.instanceMatrix.needsUpdate=true;flameGeo.attributes.position.needsUpdate=true;
}

let people=null;
function updateFigures(dt,time){
  if(people)people.update(dt,time,activity,S,started?player:null);
  dragons.forEach((d,i)=>{d.a+=d.sp*dt;const a=d.a;const g=d.g,u=g.userData;
    const x=d.cx+Math.cos(a)*d.rx,z=d.cz+Math.sin(a)*d.rz,y=d.h+Math.sin(a*2.3)*6;
    const nx=d.cx+Math.cos(a+.02)*d.rx,nz=d.cz+Math.sin(a+.02)*d.rz,ny=d.h+Math.sin((a+.02)*2.3)*6;
    g.position.set(x,y,z);g.lookAt(nx,ny,nz);g.rotateZ(-.35);
    u.flap+=dt*(2.6+S.rain*.6);const fl=Math.sin(u.flap);u.wings[0].rotation.z=-fl*.65;u.wings[1].rotation.z=fl*.65;g.position.y+=fl*.4;
    u.tsegs.forEach((s,k)=>{s.rotation.y=Math.sin(time*2+k*.6+i)*.12;s.rotation.x=Math.sin(time*1.5+k*.5)*.05;});
    u.nsegs.forEach((s,k)=>{s.rotation.x=-.12+Math.sin(time*.8+k)*.05;});
    u.fireT-=dt;if(u.fireT<0&&u.fireOn<=0){u.fireOn=2.2;u.fireT=rand(12,26);}
    if(u.fireOn>0){u.fireOn-=dt;const k=clamp(u.fireOn/2.2,0,1);u.fire.material.opacity=Math.sin(k*Math.PI)*.85;u.fire.scale.set(1+Math.random()*.2,1,1+Math.random()*.2);u.jaw.rotation.x=.35*Math.sin(k*Math.PI);}else{u.fire.material.opacity=0;u.jaw.rotation.x=0;}});
  const c=people?people.counts:{inside:0,outside:0};$('crowd').textContent=`館内　${c.inside}人（賢者・学僧・司書たち）\n窓の外　${c.outside}人の冒険者と、${dragons.length}頭の竜`;
  $('crowd').style.whiteSpace='pre-line';
}

// ================= books: pick, pull, search, warp =================
const ray=new THREE.Raycaster();ray.far=3.6;const ndc=new THREE.Vector2();let pulled=null;
function hitBook(cx,cy){if(player.z<-22.2||player.z>22.2||Math.abs(player.x)>6.2)return null;ndc.set(cx/innerWidth*2-1,-(cy/innerHeight)*2+1);ray.setFromCamera(ndc,camera);let best=null;
  wallMeshes.forEach((w,wi)=>{if(Math.sign(ray.ray.direction.x)!==w.wl.side)return;const hs=ray.intersectObject(w.mesh);if(hs.length&&(!best||hs[0].distance<best.d))best={wi,id:hs[0].instanceId,d:hs[0].distance};});
  if(best&&wallMeshes[best.wi].rec[best.id]<0)return null;return best;}
function locText(w,i){const b=w.inst[i];return `${w.wl.name}・第${b.bay}書架・${b.tier==='low'?'下段':'上段'}の上から${(b.tier==='low'?7:6)-b.level}段目`;}
function setPull(w,id,amt){const f=w.inst[id].face;const m=new THREE.Matrix4().fromArray(w.base,id*16);m.elements[12]+=f*amt;m.elements[13]+=amt*.1;w.mesh.setMatrixAt(id,m);w.mesh.instanceMatrix.needsUpdate=true;applyLabel(w,id,amt);}
function splitTitle(t){const p=t.split(/[－(（]/);const main=p[0].trim();const sub=t.slice(p[0].length).replace(/^[－]|[－]$/g,'').trim();return [main||t,sub];}
function openBook(wi,id){if(pulled)closeBook(true);const w=wallMeshes[wi];pulled={w,id,t:0,dir:1};
  const r=RECS[w.rec[id]];const [main,sub]=splitTitle(r.t);const col=new THREE.Color().fromArray(w.mesh.instanceColor.array,id*3);
  $('cover').style.background='#'+col.getHexString();$('cover').style.color=col.getHSL({}).l>.6?'#1d1810':'#fff';$('cover').textContent=main;
  $('bTitle').textContent=main;$('bSub').textContent=sub;$('bAuthor').textContent=r.a;$('bLoc').textContent=locText(w,id);
  $('bPrize').textContent=r.prizes.map(p=>`${prizeName(p.p)}　${p.label}`).join('\n');$('bPrize').style.display=r.prizes.length?'block':'none';updateBagUI(r);
  updateReadUI(r);
  $('borrow').href=BORROW_URL;$('buy').href=amazonUrl(main,r.a);
  $('sheet').querySelector('.card').scrollTop=0;
  showIntro(r,main);
  $('sheet').classList.remove('open');void $('sheet').offsetWidth;$('sheet').classList.add('open');$('hint').classList.remove('on');}
// ---- 紹介（Google Books ＋ openBD）
const introCache=new Map();let introFor=null;
function fmtDate(d){const m=(d||'').match(/^(\d{4})(?:-(\d{2}))?/);return m?(m[2]?`${m[1]}年${+m[2]}月`:`${m[1]}年`):'';}
function showIntro(r,main){introFor=r;
  const img=$('bCoverImg'),glow=$('bGlow'),desc=$('bDesc'),wrap=$('bDescWrap');
  img.classList.remove('on');img.removeAttribute('src');glow.classList.remove('on');glow.style.backgroundImage='';
  wrap.classList.remove('full');$('bMore').style.display='none';$('bMeta').textContent='';$('info').style.display='none';
  desc.className='loading';desc.textContent='紹介を探しています…';
  const q=new URLSearchParams({title:r.t,author:r.a||''});const isbn=r.wishIsbn||(r.wish&&r.wish.isbn);if(isbn)q.set('isbn',isbn);
  const key=q.toString();
  const p=introCache.get(key)||fetch('/api/bookinfo?'+key).then(x=>x.json()).catch(()=>null);introCache.set(key,p);
  p.then(d=>{if(introFor!==r)return;
    if(!d||(!d.description&&!d.source)){desc.className='';desc.textContent='この本の紹介文は見つかりませんでした。';return;}
    const src=d.isbn?`/api/cover?isbn=${d.isbn}${d.cover?'&src='+encodeURIComponent(d.cover):''}`:d.cover;
    if(src){img.onload=()=>{img.classList.add('on');glow.style.backgroundImage=`url("${src}")`;glow.classList.add('on');};img.onerror=()=>{if(d.cover&&img.src.indexOf('/api/cover')>=0)img.src=d.cover;};img.src=src;}
    if(d.pageCount)journal.pages(r,d.pageCount);$('bMeta').textContent=[d.publisher,fmtDate(d.publishedDate),d.pageCount?`${d.pageCount}ページ`:'',d.isbn?`ISBN ${d.isbn}`:''].filter(Boolean).join('　');
    desc.className='';desc.textContent=(d.description||'紹介文はまだ登録されていないようです。').replace(/<[^>]+>/g,'');
    requestAnimationFrame(()=>{if(desc.scrollHeight>desc.clientHeight+4)$('bMore').style.display='block';});
    if(d.infoLink){$('info').href=d.infoLink;$('info').style.display='inline';}});}
$('bMore').addEventListener('click',()=>{$('bDescWrap').classList.add('full');$('bMore').style.display='none';});
function updateBagUI(r){const b1=$('bagBorrow'),b2=$('bagBuy');const i1=inBag('borrow',r),i2=inBag('buy',r);b1.querySelector('b').textContent=i1?'借りる本に入っています':'借りる本に入れる';b1.classList.toggle('in',i1);b2.querySelector('b').textContent=i2?'買う本に入っています':'買う本に入れる';b2.classList.toggle('in',i2);updateBagChip();}
function updateBagChip(){const a=bagList('borrow').length,b=bagList('buy').length;const el=$('bagChip');el.textContent=a||b?`かばん　借${a}・買${b}`:'';el.style.display=a||b?'block':'none';}
['borrow','buy'].forEach(k=>$(k==='borrow'?'bagBorrow':'bagBuy').addEventListener('click',()=>{if(!pulled)return;const r=RECS[pulled.w.rec[pulled.id]];const added=toggleBag(k,r);updateBagUI(r);counterUI.toast(added?(k==='borrow'?'借りる本に入れました。入口の貸出カウンターへどうぞ':'買う本に入れました。入口の購入カウンターへどうぞ'):'リストから外しました');}));
function updateReadUI(r){const br=$('bRead'),rd=isRead(r);if(rd){br.className='';br.textContent=r.fromLib&&r.d?`読んだ本　${r.d}に借りた`:'読んだ本';}else{br.className='unread';br.textContent='まだ読んでいない本';}$('markRead').textContent=rd?'読んだ印を外す':'読んだ本にする';}
$('markRead').addEventListener('click',()=>{if(!pulled)return;const w=pulled.w,id=pulled.id,r=RECS[w.rec[id]];const to=!isRead(r);setRead(r,to);journal.marked(r,to);updateReadUI(r);applyLabel(w,id,.17);});
function closeBook(instant){if(!pulled)return;if(instant){setPull(pulled.w,pulled.id,0);pulled=null;}else pulled.dir=-1;$('sheet').classList.remove('open');}
$('putBack').addEventListener('click',()=>closeBook(false));
// search

const sEl=$('search'),qEl=$('q'),resEl=$('results'),infoEl=$('sInfo');
function openSearch(){search.open();}
function closeSearch(){search.close();}
const search=initSearch({
  hasSpot:(ri)=>!!recLoc[ri],
  locOf:(ri)=>{const l=recLoc[ri];return l?locText(wallMeshes[l[0]],l[1]):'';},
  colorOf:(ri)=>{const l=recLoc[ri];if(!l)return null;const w=wallMeshes[l[0]];return '#'+new THREE.Color().fromArray(w.mesh.instanceColor.array,l[1]*3).getHexString();},
  warpTo:(ri)=>warpTo(ri),
  openWish:(r)=>{warpToPile();setTimeout(()=>journal.open(r),500);}
});
let warp=0;
function warpTo(ri){closeSearch();closeBook(true);const [wi,i]=recLoc[ri];const w=wallMeshes[wi];const b=w.inst[i];
  warp=1;setTimeout(()=>{player.x=b.x+b.face*(b.sx/2+1.45);player.z=clamp(b.z,-21,21);player.yaw=b.face>0?Math.PI/2:-Math.PI/2;player.pitch=Math.atan2(b.y-1.62,1.45);started=true;$('intro').classList.add('gone');
    setTimeout(()=>openBook(wi,i),380);},260);}
addEventListener('keydown',e=>{if(e.key==='Escape'){if(sEl.classList.contains('open'))closeSearch();else closeBook(false);}
  if((e.key==='/'||(e.key==='k'&&(e.metaKey||e.ctrlKey)))&&!sEl.classList.contains('open')){e.preventDefault();openSearch();}});

// ================= input & movement =================
const cv=$('c');let look=null,joy=null;const joyEl=$('joy'),knob=$('knob');const mv={x:0,y:0};
cv.addEventListener('pointerdown',e=>{cv.focus();try{cv.setPointerCapture(e.pointerId);}catch(_){}
  const inJoy=isTouch&&e.clientX<innerWidth*.45&&e.clientY>innerHeight*.45;
  if(inJoy&&!joy){joy={id:e.pointerId,cx:e.clientX,cy:e.clientY};joyEl.style.left=e.clientX+'px';joyEl.style.top=e.clientY+'px';joyEl.classList.add('on');knob.style.transform='';}
  else if(!look)look={id:e.pointerId,x:e.clientX,y:e.clientY,sx:e.clientX,sy:e.clientY,t:performance.now()};});
cv.addEventListener('pointermove',e=>{
  if(joy&&e.pointerId===joy.id){let dx=e.clientX-joy.cx,dy=e.clientY-joy.cy;const d=Math.hypot(dx,dy),mx=46;if(d>mx){dx*=mx/d;dy*=mx/d;}knob.style.transform=`translate(${dx}px,${dy}px)`;mv.x=dx/mx;mv.y=dy/mx;}
  else if(look&&e.pointerId===look.id){const s=isTouch?.0055:.0038;player.yaw-=(e.clientX-look.x)*s;player.pitch=clamp(player.pitch-(e.clientY-look.y)*s,-1.3,1.3);look.x=e.clientX;look.y=e.clientY;}});
function endPtr(e){if(joy&&e.pointerId===joy.id){joy=null;mv.x=mv.y=0;joyEl.classList.remove('on');}
  if(look&&e.pointerId===look.id){const moved=Math.hypot(e.clientX-look.sx,e.clientY-look.sy);if(e.type==='pointerup'&&moved<9&&performance.now()-look.t<400){const h=hitBook(e.clientX,e.clientY);if(h)openBook(h.wi,h.id);else{ndc.set(e.clientX/innerWidth*2-1,-(e.clientY/innerHeight)*2+1);const w=wishPile.pick(ndc,camera);if(w){closeBook(true);journal.open(w==='table'?null:w);}else if(archive.pick(ndc,camera)){closeBook(true);}else if(world.pickBoard(ndc,camera)){mapUI.open();}else if(pulled)closeBook(false);}}look=null;}}
cv.addEventListener('pointerup',endPtr);cv.addEventListener('pointercancel',endPtr);
addEventListener('keydown',e=>{const ae=document.activeElement;if(ae&&/INPUT|TEXTAREA/.test(ae.tagName))return;keys[e.code]=true;});addEventListener('keyup',e=>{keys[e.code]=false;});addEventListener('blur',()=>{for(const k in keys)keys[k]=false;});
function blocked(x,z){if(!world.walkable(x,z))return true;const r=.32;for(const c of colliders)if(x>c.x0-r&&x<c.x1+r&&z>c.z0-r&&z<c.z1+r)return true;return false;}
function zoneName(){const x=player.x,z=player.z;{const zw=world.zone(x,z);if(zw)return zw;}if(z>17.5)return '大扉の前';if(z<-18.5)return '薔薇窓の下';if(Math.abs(x)<1.6&&z>12.8)return '大地球儀のそば';if(Math.abs(x)<2.2)return '中央の閲覧机';
  const w=wallMeshes[x<0?0:1];const b=w.wl.bays.find(b=>z>=b[0]&&z<=b[1]);return b?`${w.wl.name}・第${b.num}書架`:`${w.wl.name}の窓辺`;}
let started=false;
function updatePlayer(dt){
  let f=0,s=0;if(keys.KeyW||keys.ArrowUp)f+=1;if(keys.KeyS||keys.ArrowDown)f-=1;if(keys.KeyA)s-=1;if(keys.KeyD)s+=1;
  if(keys.ArrowLeft)player.yaw+=dt*1.8;if(keys.ArrowRight)player.yaw-=dt*1.8;
  f+=-mv.y;s+=mv.x;const len=Math.hypot(f,s);if(len>1){f/=len;s/=len;}
  const sp=(keys.ShiftLeft||keys.ShiftRight)?3.8:2.2;const sy=Math.sin(player.yaw),cy=Math.cos(player.yaw);
  const dx=(-sy*f+cy*s)*sp*dt,dz=(-cy*f-sy*s)*sp*dt;
  if(!blocked(player.x+dx,player.z))player.x+=dx;if(!blocked(player.x,player.z+dz))player.z+=dz;
  const moving=Math.hypot(dx,dz)>.0005;player.bob+=moving?dt*sp*4:0;
  camera.position.set(player.x,1.62+(moving?Math.sin(player.bob)*.028:0),player.z);camera.rotation.set(player.pitch,player.yaw,0);
  if(moving&&pulled){const b=pulled.w.inst[pulled.id];if(Math.hypot(player.x-b.x,player.z-b.z)>4)closeBook(false);}}

// ================= loop =================
const clock=new THREE.Clock();let hintT=0,lastMin=-1,zoneT=0;
function loop(){
  const dt=Math.min(clock.getDelta(),.05),time=clock.elapsedTime;
  if(S.auto)S.hour=(S.hour+dt/20)%24;
  if(S.autoWx){S.nextWx-=dt;if(S.nextWx<0){const r=Math.random();setWx(r<.45?'clear':r<.7?'cloudy':r<.9?'rain':'snow');S.nextWx=rand(3,6)*20;}}
  updateEnv(dt,time);updateFigures(dt,time);world.update(dt,time,player,S.hour);counterDecor.update(time);if(started)counterUI.update(player);
  if(started)updatePlayer(dt);else{camera.position.set(0,1.62,19.5);camera.rotation.set(.12,Math.sin(time*.15)*.3,0);}
  if(pulled){pulled.t=clamp(pulled.t+dt*3.2*pulled.dir,0,1);const e=1-Math.pow(1-pulled.t,3);setPull(pulled.w,pulled.id,e*.17);if(pulled.dir<0&&pulled.t<=0){setPull(pulled.w,pulled.id,0);pulled=null;}}
  if(warp>0){warp=Math.max(0,warp-dt*1.4);$('warp').style.opacity=(Math.sin(warp*Math.PI)).toFixed(3);}
  const m=Math.floor(S.hour*60);if(m!==lastMin){lastMin=m;const s=fmt(S.hour);$('clockT').textContent=s;$('timeOut').textContent=s;if(document.activeElement!==timeIn)timeIn.value=S.hour.toFixed(2);}
  $('clockW').textContent=WX[S.wx].name;
  zoneT-=dt;if(zoneT<0&&started){zoneT=.4;$('zone').textContent=zoneName();}
  hintT-=dt;if(hintT<0&&started&&!pulled){hintT=.22;const h=hitBook(innerWidth/2,innerHeight/2);const el=$('hint');
    if(!h){ndc.set(0,0);const wp=wishPile.pick(ndc,camera);if(wp){el.innerHTML='';const b=document.createElement('b');b.textContent=wp==='table'?'読みたい本の台':'『'+wp.title+'』';el.append(b,document.createTextNode(wp==='table'?`　${wishPile.count()}冊`:'　読みたい本'));el.classList.add('on');}else{const ah=archive.hint(camera);if(ah){el.innerHTML='';const b=document.createElement('b');b.textContent=ah[0];el.append(b,document.createTextNode(ah[1]));el.classList.add('on');}else if(world.pickBoard(ndc,camera)){el.innerHTML='';const b=document.createElement('b');b.textContent='館内案内図';el.append(b,document.createTextNode('　タップで開く'));el.classList.add('on');}else el.classList.remove('on');}}
    else if(h){const r=RECS[wallMeshes[h.wi].rec[h.id]];el.innerHTML='';const b=document.createElement('b');b.textContent='『'+splitTitle(r.t)[0]+'』';el.append(b,document.createTextNode(isRead(r)?'　読んだ本':''));el.classList.add('on');}}
  renderer.render(scene,camera);requestAnimationFrame(loop);}
$('enter').addEventListener('click',()=>{started=true;$('intro').classList.add('gone');cv.focus();});
const counterUI=createCounterUI({$,onChange:()=>{updateBagChip();if(pulled)updateBagUI(RECS[pulled.w.rec[pulled.id]]);}});
updateBagChip();
// ---- 読みたい本（本屋さんでスキャン）
const wishlist=createWishlist({onChange:(items,mode)=>{registerWish(items);wishPile.rebuild(items);journal.refresh();}});
const journal=createJournal({wishlist,toast:(m)=>counterUI.toast(m),onBag:()=>updateBagChip(),hasSpot:(r)=>!!recLoc[r.id],warpToShelf:(r)=>warpTo(r.id),currentRec:()=>pulled?RECS[pulled.w.rec[pulled.id]]:null});
wishlist.refresh();
function warpToPoint(p){closeSearch();closeBook(true);journal.close();warp=1;setTimeout(()=>{player.x=p.x;player.z=p.z;player.yaw=p.yaw||0;player.pitch=p.pitch||0;started=true;$('intro').classList.add('gone');},260);}
const archive=createArchive({scene,atlas:spineAtlas,world,toast:(m)=>counterUI.toast(m),warp:warpToPoint});
const mapUI=createMapUI({warp:(w)=>warpToPoint(w),player,zoneText:()=>zoneName(),onOpen:()=>{closeSearch();journal.close();archive.close();}});
function warpToPile(){warp=1;setTimeout(()=>{player.yaw=Math.PI;player.x=PILE.x;player.z=PILE.z-1.85;player.pitch=-0.45;started=true;$('intro').classList.add('gone');},260);}
// スキャナー
let scanner=null,scanCount=0,lastAdded=null;
function scanStatus(t){$('sStatus').textContent=t;}
const sfx=createSfx();
const treasure=createTreasure({host:$('scan'),shelf:()=>wishlist.items.filter(i=>i.status!=='読了'),sfx});
const pendingScan=new Set();
function showResult(info,msg,undo){const box=$('sResult');box.classList.add('on');$('sCover').src=coverUrl(info);$('sCover').style.visibility='visible';$('sCover').onerror=()=>{$('sCover').style.visibility='hidden';};
  $('sTitle').textContent=info.title;$('sAuthor').textContent=[(info.authors||[]).join('・'),info.publisher].filter(Boolean).join('　');$('sMsg').textContent=msg;$('sUndo').style.display=undo?'block':'none';}
async function handleIsbn(isbn){
  if(pendingScan.has(isbn))return;pendingScan.add(isbn);
  const dup=wishlist.has(isbn);
  scanStatus('宝箱を開けています…');
  const out=await treasure.play({isbn,dup,load:async()=>{
    if(dup){const it=wishlist.items.find(i=>i.isbn===isbn)||{};return {dup:true,info:{isbn,title:it.title||('ISBN '+isbn),authors:it.authors||[],publisher:it.publisher||'',cover:it.cover||''}};}
    let info=null;try{info=await lookupIsbn(isbn);}catch(_){}
    if(!info)info={isbn,title:'ISBN '+isbn,authors:[],publisher:'',cover:''};
    const rec=findRec(info.title,(info.authors||[])[0]||'');
    const r=await wishlist.add(info);
    scanCount++;lastAdded=wishlist.items.find(i=>i.isbn===isbn)||null;
    const p=rec&&rec.primary;
    return {info,saved:r.saved,rare:p?{label:(PRIZE_SHORT[p.p]||p.p)+' 第'+p.n+'回'}:null,read:!!(rec&&rec.fromLib),count:wishlist.items.filter(i=>i.status!=='読了').length};
  }});
  pendingScan.delete(isbn);
  if(!out)return;
  scanStatus('次の本もどうぞ　今回 '+scanCount+'冊');
  if(out.dup){showResult(out.info,'もう台に積んであります',false);return;}
  showResult(out.info,out.saved==='notion'?'読みたい本の台に積みました（Notionにも保存）':'読みたい本の台に積みました（この端末に保存）',true);}
$('sUndo').addEventListener('click',()=>{if(lastAdded){wishlist.remove(lastAdded);lastAdded=null;scanCount=Math.max(0,scanCount-1);$('sMsg').textContent='取り消しました';$('sUndo').style.display='none';}});
$('scanBtn').addEventListener('click',()=>{sfx.unlock();$('scan').classList.add('open');$('sResult').classList.remove('on');scanCount=0;
  if(!scanner)scanner=createScanner({video:$('sVideo'),onCode:handleIsbn,onStatus:scanStatus});scanner.start();});
function closeScan(){$('scan').classList.remove('open');treasure.reset();if(scanner)scanner.stop();}
$('scanClose').addEventListener('click',closeScan);
$('sManualGo').addEventListener('click',()=>{const v=$('sManual').value.replace(/[^0-9Xx]/g,'');const d=v.length===10?null:v;
  if(v.length===13&&/^97[89]/.test(v)){handleIsbn(v);$('sManual').value='';}else if(v.length===10){fetch('/api/isbn?isbn='+v).then(r=>r.ok?r.json():null).then(i=>{if(i)handleIsbn(i.isbn);else scanStatus('そのISBNの本が見つかりませんでした');});$('sManual').value='';}else scanStatus('ISBNは978から始まる13桁（または10桁）で入れてね');});
$('sManual').addEventListener('keydown',e=>{if(e.key==='Enter')$('sManualGo').click();});
addEventListener('keydown',e=>{if(e.key==='Escape'){closeScan();journal.close();}});
loadCast(p=>{$('loadNote').textContent=`館の人々が集まっています… ${Math.round(p*100)}%`;})
  .then(cast=>{people=createPeople({scene,cast,seats,W,L,counters:COUNTERS});$('loadNote').textContent='';})
  .catch(e=>{console.error(e);$('loadNote').textContent='登場人物を読み込めませんでした';});
// Notion と公式発表から最新の蔵書を取り込む（取れなければ同梱のデータのまま）
fetch('/api/books').then(r=>r.ok?r.json():null).then(d=>{if(!d||!Array.isArray(d.rows))return;
  const added=mergeRemote(d.rows);let placed=0;added.forEach(ri=>{if(placeNew(ri)){placed++;const [wi,i]=recLoc[ri];setSpine(wallMeshes[wi],i);}});spineAtlas.flush();
  wallMeshes.forEach(w=>w.inst.forEach((b,i)=>{if(w.rec[i]>=0)applyLabel(w,i,0);}));
  if(placed)counterUI.toast(`新しく${placed}冊が文学賞の書架に並びました`);}).catch(()=>{});
addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);});
if(document.fonts&&document.fonts.ready)document.fonts.ready.then(()=>{/* bay plaques drawn with fallback until fonts load; acceptable */});
requestAnimationFrame(loop);
