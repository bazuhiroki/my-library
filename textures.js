// 手続き的に描くテクスチャ（画像ファイルを使わず canvas で生成）
import * as THREE from 'three';
import { rand, pick } from './util.js';

export function createTextures(ANISO) {
function canvasTex(w,h,draw){const c=document.createElement('canvas');c.width=w;c.height=h;const x=c.getContext('2d');draw(x,w,h);const t=new THREE.CanvasTexture(c);t.encoding=THREE.sRGBEncoding;t.anisotropy=ANISO;return t;}
function noise(x,w,h,n,a){for(let i=0;i<n;i++){x.fillStyle=`rgba(${Math.random()<.5?255:0},${Math.random()<.5?240:0},${Math.random()<.5?220:0},${Math.random()*a})`;x.fillRect(Math.random()*w,Math.random()*h,2,2);}}
const parquetTex=canvasTex(512,512,(x,w,h)=>{const cell=128,pl=cell/4;
  for(let i=0;i<w/cell;i++)for(let j=0;j<h/cell;j++){const vert=(i+j)%2;
    for(let k=0;k<4;k++){const l=24+Math.random()*10;x.fillStyle=`hsl(${24+Math.random()*8},${40+Math.random()*12}%,${l}%)`;
      const rx=vert?i*cell+k*pl:i*cell,ry=vert?j*cell:j*cell+k*pl,rw=vert?pl:cell,rh=vert?cell:pl;x.fillRect(rx,ry,rw,rh);
      x.strokeStyle='rgba(20,9,2,.5)';x.lineWidth=1.5;x.strokeRect(rx+.5,ry+.5,rw-1,rh-1);
      for(let g=0;g<5;g++){x.strokeStyle=`rgba(40,18,4,${.05+Math.random()*.1})`;x.beginPath();if(vert){const gx=rx+Math.random()*rw;x.moveTo(gx,ry);x.lineTo(gx+rand(-2,2),ry+rh);}else{const gy=ry+Math.random()*rh;x.moveTo(rx,gy);x.lineTo(rx+rw,gy+rand(-2,2));}x.stroke();}}}});
parquetTex.wrapS=parquetTex.wrapT=THREE.RepeatWrapping;parquetTex.repeat.set(4,15);
const plasterTex=canvasTex(256,256,(x,w,h)=>{x.fillStyle='#d9ccb2';x.fillRect(0,0,w,h);noise(x,w,h,5000,.05);});
plasterTex.wrapS=plasterTex.wrapT=THREE.RepeatWrapping;plasterTex.repeat.set(6,2);
const vaultTex=canvasTex(512,1024,(x,w,h)=>{
  const g=x.createLinearGradient(0,0,w,0);g.addColorStop(0,'#8f6532');g.addColorStop(.5,'#b98a4c');g.addColorStop(1,'#8f6532');x.fillStyle=g;x.fillRect(0,0,w,h);
  const cw=w/12,ch=h/28;
  for(let i=0;i<12;i++)for(let j=0;j<28;j++){const px=i*cw,py=j*ch;
    x.fillStyle='rgba(70,40,12,.55)';x.fillRect(px+4,py+4,cw-8,ch-8);
    const gg=x.createRadialGradient(px+cw/2,py+ch/2,1,px+cw/2,py+ch/2,cw*.5);gg.addColorStop(0,'rgba(140,40,30,.55)');gg.addColorStop(1,'rgba(60,24,10,.2)');x.fillStyle=gg;x.fillRect(px+7,py+7,cw-14,ch-14);
    x.strokeStyle='rgba(235,200,120,.85)';x.lineWidth=1.6;x.strokeRect(px+4,py+4,cw-8,ch-8);
    x.fillStyle='rgba(240,210,140,.9)';x.beginPath();x.arc(px+cw/2,py+ch/2,3,0,7);x.fill();}
  [-16,-8,0,8,16].forEach(z=>{const py=(z+22)/44*h;x.fillStyle='#caa052';x.fillRect(0,py-10,w,20);x.fillStyle='rgba(90,55,15,.6)';x.fillRect(0,py-11,w,2);x.fillRect(0,py+9,w,2);});
  noise(x,w,h,9000,.06);});
const cupolaTex=canvasTex(512,512,(x,w,h)=>{const c=w/2;
  const bg=x.createRadialGradient(c,c,40,c,c,c);bg.addColorStop(0,'#f3dfb0');bg.addColorStop(.35,'#a9c1cf');bg.addColorStop(.7,'#c79a5c');bg.addColorStop(1,'#7a5024');x.fillStyle=bg;x.beginPath();x.arc(c,c,c,0,7);x.fill();
  for(let i=0;i<34;i++){const a=Math.random()*7,r=rand(90,200),px=c+Math.cos(a)*r,py=c+Math.sin(a)*r,s=rand(18,48);const cg=x.createRadialGradient(px,py,0,px,py,s);cg.addColorStop(0,'rgba(255,245,225,.55)');cg.addColorStop(1,'rgba(255,245,225,0)');x.fillStyle=cg;x.beginPath();x.arc(px,py,s,0,7);x.fill();}
  for(let i=0;i<8;i++){const a=i/8*Math.PI*2+.2,r=150,px=c+Math.cos(a)*r,py=c+Math.sin(a)*r;x.save();x.translate(px,py);x.rotate(a+Math.PI/2);
    x.fillStyle=pick(['rgba(120,30,30,.75)','rgba(40,60,110,.75)','rgba(60,90,50,.75)','rgba(140,100,40,.8)']);x.beginPath();x.ellipse(0,6,9,22,0,0,7);x.fill();
    x.fillStyle='rgba(235,205,170,.9)';x.beginPath();x.arc(0,-20,7,0,7);x.fill();
    x.fillStyle='rgba(255,250,240,.55)';x.beginPath();x.moveTo(-6,-4);x.quadraticCurveTo(-34,-30,-26,4);x.closePath();x.fill();x.beginPath();x.moveTo(6,-4);x.quadraticCurveTo(34,-30,26,4);x.closePath();x.fill();x.restore();}
  x.strokeStyle='#e0b760';x.lineWidth=14;x.beginPath();x.arc(c,c,c-8,0,7);x.stroke();x.strokeStyle='rgba(80,50,15,.7)';x.lineWidth=3;x.beginPath();x.arc(c,c,c-16,0,7);x.stroke();
  x.strokeStyle='#e0b760';x.lineWidth=8;x.beginPath();x.arc(c,c,62,0,7);x.stroke();});
function muralTex(kind){return canvasTex(1024,512,(x,w,h)=>{
  const sky=x.createLinearGradient(0,0,0,h);
  if(kind==='south'){sky.addColorStop(0,'#3d4f7c');sky.addColorStop(.55,'#d88a4f');sky.addColorStop(1,'#f3c98a');}else{sky.addColorStop(0,'#16223f');sky.addColorStop(.6,'#3b4d78');sky.addColorStop(1,'#8a7aa0');}
  x.fillStyle=sky;x.fillRect(0,0,w,h);
  if(kind!=='south'){for(let i=0;i<220;i++){x.fillStyle=`rgba(255,250,230,${Math.random()*.8})`;x.fillRect(Math.random()*w,Math.random()*h*.7,2,2);}}
  x.fillStyle=kind==='south'?'rgba(70,45,55,.85)':'rgba(25,25,45,.9)';
  x.beginPath();x.moveTo(0,h);for(let i=0;i<=16;i++){x.lineTo(i/16*w,h*.72-Math.abs(Math.sin(i*1.7))*h*.28-Math.random()*20);}x.lineTo(w,h);x.fill();
  x.fillStyle=kind==='south'?'rgba(50,30,40,.95)':'rgba(15,15,30,.95)';const cx=w*.68;x.fillRect(cx,h*.62,120,h*.4);
  [[cx-10,h*.5],[cx+110,h*.46],[cx+50,h*.4]].forEach(([tx,ty])=>{x.fillRect(tx,ty,24,h);x.beginPath();x.moveTo(tx-6,ty);x.lineTo(tx+12,ty-50);x.lineTo(tx+30,ty);x.fill();});
  x.save();x.translate(w*.3,h*.32);x.scale(1.4,1.4);x.fillStyle=kind==='south'?'rgba(60,20,20,.9)':'rgba(10,10,25,.95)';
  x.beginPath();x.moveTo(-80,10);x.quadraticCurveTo(-20,-10,40,0);x.lineTo(70,-12);x.lineTo(78,-6);x.lineTo(56,6);x.quadraticCurveTo(0,20,-80,10);x.fill();
  x.beginPath();x.moveTo(-10,0);x.lineTo(-60,-70);x.lineTo(-40,-40);x.lineTo(-20,-62);x.lineTo(-8,-30);x.lineTo(10,-50);x.lineTo(14,0);x.fill();x.restore();
  noise(x,w,h,7000,.07);
  const fr=x.createRadialGradient(w/2,h,h*.2,w/2,h,h*1.1);fr.addColorStop(.8,'rgba(0,0,0,0)');fr.addColorStop(1,'rgba(40,20,5,.6)');x.fillStyle=fr;x.fillRect(0,0,w,h);});}
const roseTex=canvasTex(512,512,(x,w,h)=>{const c=w/2;x.fillStyle='#1a1410';x.fillRect(0,0,w,h);
  const cols=['#1f3f8a','#8a1f2a','#c99a2e','#2c6b46','#5a2a7a'];
  for(let ring=0;ring<3;ring++){const r0=[40,110,180][ring],r1=[105,175,245][ring],n=[8,12,16][ring];
    for(let i=0;i<n;i++){const a0=i/n*Math.PI*2,a1=(i+1)/n*Math.PI*2;x.fillStyle=cols[(i+ring)%cols.length];x.beginPath();x.arc(c,c,r1,a0+.03,a1-.03);x.arc(c,c,r0,a1-.03,a0+.03,true);x.closePath();x.fill();}}
  x.fillStyle='#e8c35e';x.beginPath();x.arc(c,c,34,0,7);x.fill();
  noise(x,w,h,4000,.12);});
const spineTex=canvasTex(64,256,(x,w,h)=>{x.fillStyle='#fff';x.fillRect(0,0,w,h);noise(x,w,h,900,.07);
  x.fillStyle='rgba(0,0,0,.3)';x.fillRect(0,h*.06,w,5);x.fillRect(0,h*.9,w,5);x.fillStyle='rgba(255,226,150,.8)';x.fillRect(0,h*.1,w,3);x.fillRect(0,h*.13,w,1);x.fillRect(0,h*.87,w,3);x.fillStyle='rgba(255,255,255,.25)';x.fillRect(w*.3,h*.22,w*.4,h*.46);});
const rainTex=canvasTex(256,512,(x,w,h)=>{x.clearRect(0,0,w,h);
  for(let i=0;i<260;i++){const px=Math.random()*w,py=Math.random()*h,r=.8+Math.random()*2.6;const g=x.createRadialGradient(px,py,0,px,py,r);g.addColorStop(0,'rgba(255,255,255,.95)');g.addColorStop(.6,'rgba(210,225,240,.35)');g.addColorStop(1,'rgba(255,255,255,0)');x.fillStyle=g;x.beginPath();x.arc(px,py,r,0,7);x.fill();}
  for(let i=0;i<46;i++){const px=Math.random()*w,py=Math.random()*h,l=20+Math.random()*90;x.strokeStyle='rgba(235,242,250,.32)';x.lineWidth=1+Math.random();x.beginPath();x.moveTo(px,py);x.lineTo(px+rand(-3,3),py+l);x.stroke();}});
rainTex.wrapS=rainTex.wrapT=THREE.RepeatWrapping;
const cloudTex=canvasTex(256,128,(x,w,h)=>{for(let i=0;i<26;i++){const px=rand(40,w-40),py=rand(45,h-30),r=rand(18,44);const g=x.createRadialGradient(px,py,0,px,py,r);g.addColorStop(0,'rgba(255,255,255,.5)');g.addColorStop(1,'rgba(255,255,255,0)');x.fillStyle=g;x.beginPath();x.arc(px,py,r,0,7);x.fill();}});
const stoneTex=canvasTex(512,512,(x,w,h)=>{x.fillStyle='#8d8474';x.fillRect(0,0,w,h);for(let j=0;j<16;j++){let px=-(j%2)*20;while(px<w){const sw=rand(34,70);x.fillStyle=`hsl(${30+rand(-6,6)},${10+rand(0,8)}%,${42+rand(-7,7)}%)`;x.fillRect(px+1,j*32+1,sw-2,30);px+=sw;}}noise(x,w,h,6000,.08);});
stoneTex.wrapS=stoneTex.wrapT=THREE.RepeatWrapping;stoneTex.repeat.set(8,16);
const flameTex=canvasTex(64,64,(x,w,h)=>{const g=x.createRadialGradient(32,36,0,32,36,30);g.addColorStop(0,'rgba(255,250,220,1)');g.addColorStop(.3,'rgba(255,190,90,.9)');g.addColorStop(1,'rgba(255,120,20,0)');x.fillStyle=g;x.fillRect(0,0,w,h);});
function textTex(txt,w,h,font,bg,fg){return canvasTex(w,h,(x)=>{if(bg){x.fillStyle=bg;x.fillRect(0,0,w,h);}x.fillStyle=fg;x.font=font;x.textAlign='center';x.textBaseline='middle';x.fillText(txt,w/2,h/2+2);});}
const globeTex=canvasTex(512,256,(x,w,h)=>{x.fillStyle='#2e4d6b';x.fillRect(0,0,w,h);
  for(let k=0;k<7;k++){let px=rand(30,w-30),py=rand(50,h-50);x.fillStyle=pick(['#b59a62','#8f9b5a','#a88a52']);x.beginPath();x.moveTo(px,py);for(let i=0;i<14;i++){const a=i/14*Math.PI*2,r=rand(18,52);x.lineTo(px+Math.cos(a)*r*1.4,py+Math.sin(a)*r);}x.closePath();x.fill();}
  x.strokeStyle='rgba(240,220,170,.35)';for(let i=1;i<8;i++){x.beginPath();x.moveTo(0,i*h/8);x.lineTo(w,i*h/8);x.stroke();x.beginPath();x.moveTo(i*w/8,0);x.lineTo(i*w/8,h);x.stroke();}});
  return { parquetTex, plasterTex, vaultTex, cupolaTex, muralTex, roseTex, spineTex, rainTex, cloudTex, stoneTex, flameTex, textTex, globeTex };
}
