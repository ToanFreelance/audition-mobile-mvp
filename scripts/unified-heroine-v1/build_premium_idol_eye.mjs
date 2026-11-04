import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import sharp from "sharp";
// Premium Idol Eye V1: actual VRoid iris UV atlas, not a screen overlay.
const root=process.cwd();
const dir=path.join(root,"public/characters/unified-heroine-v1/eye-pack-v1");
const base=path.join(dir,"eye-natural-v1.png");
const target=path.join(dir,"eye-premium-idol-v1.png");
const W=2048,H=1024,src=await sharp(base).resize(W,H).ensureAlpha().raw().toBuffer({resolveWithObject:true});
const b=Buffer.from(src.data);
const clamp=(v,a=0,c=1)=>Math.max(a,Math.min(c,v));
const smooth=t=>t*t*(3-2*t);
const lerp=(a,b,t)=>a+(b-a)*t;
const hash=x=>{const a=Math.sin(x*93.912+17.12)*41589.231;return a-Math.floor(a)};
for(let y=0;y<H;y++)for(let x=0;x<W;x++){
 const p=(y*W+x)*4;if(b[p+3]<4)continue;
 const eye=x<W/2?0:1,cx=eye?1536:512,dx=(x-cx)/208,dy=(y-532)/255;
 const r=Math.sqrt(dx*dx+dy*dy);if(r>1.12)continue;
 const a=Math.atan2(dy,dx),theta=(a+Math.PI)/(Math.PI*2);
 const k=Math.floor(theta*490),t=smooth(theta*490-k);
 const fl=lerp(hash(k+eye*319),hash(k+eye*319+1),t)-.5;
 const fine=Math.sin(a*179+r*35+Math.sin(a*21)*5)*.19+Math.sin(a*323-r*42)*.10+fl*.31;
 const rim=clamp((r-.79)/.19),pupil=1-smooth(clamp((r-.17)/.11));
 let rgb=[178,106,225];const inner=clamp((r-.2)/.55);
 rgb=rgb.map((v,i)=>lerp(v,[73,52,165][i],smooth(inner)));
 const lower=clamp((dy+.15)/1.2),cyan=clamp((r-.20)/.33)*(1-clamp((r-.74)/.17))*lower*.43;
 rgb=rgb.map((v,i)=>lerp(v,[61,177,246][i],cyan));
 const striae=Math.max(0,fine)*clamp((r-.22)/.54),wave=Math.sin(r*49+a*5)*.09;
 const goldRing=Math.exp(-Math.pow((r-.70)/.033,2))*.14,light=.90+striae+wave+goldRing-(1-lower)*.14;
 for(let c=0;c<3;c++){
  let v=rgb[c]*light;
  v=lerp(v,[13,8,30][c],pupil*.88);
  v=lerp(v,[19,11,47][c],rim*.91);
  b[p+c]=Math.round(clamp(v,0,255));
 }
}
function star(cx,cy,r){let a=[];for(let i=0;i<8;i++){const t=-Math.PI/2+i*Math.PI/4,R=i%2?r*.22:r;a.push((cx+Math.cos(t)*R).toFixed(2)+","+(cy+Math.sin(t)*R).toFixed(2))}return a.join(" ")}
let body=[];
for(const cx of [512,1536]){
 body.push('<clipPath id="c'+cx+'"><ellipse cx="'+cx+'" cy="532" rx="201" ry="244"/></clipPath>');
}
let shapes=[];
for(const cx of [512,1536]){
 shapes.push('<g clip-path="url(#c'+cx+')">');
 for(let j=0;j<96;j++){
  const a=j*Math.PI*2/96,rin=172+hash(j+cx)*8,rout=196+hash(j*3+cx)*7;
  const x1=cx+Math.cos(a)*rin,x2=cx+Math.cos(a)*rout,y1=532+Math.sin(a)*rin*1.2,y2=532+Math.sin(a)*rout*1.2;
  shapes.push('<path d="M'+x1.toFixed(1)+' '+y1.toFixed(1)+' L'+x2.toFixed(1)+' '+y2.toFixed(1)+'" stroke="'+(j%6===0?'#ffe8b6':'#ecc9ff')+'" stroke-opacity="'+(j%6===0?'.6':'.27')+'" stroke-width="1.6"/>');
 }
 shapes.push('<path d="M'+(cx-104)+' 438 C'+(cx-93)+' 368 '+(cx-26)+' 351 '+(cx+31)+' 363" fill="none" stroke="#fff2ff" stroke-opacity=".63" stroke-linecap="round" stroke-width="13"/>');
 shapes.push('<ellipse cx="'+(cx-74)+'" cy="420" rx="18" ry="34" transform="rotate(-22 '+(cx-74)+' 420)" fill="#ffffff" opacity=".69"/>');
 shapes.push('<ellipse cx="'+(cx+73)+'" cy="622" rx="56" ry="22" fill="#a7edff" opacity=".18"/>');
 for(const [dx,dy,r,o] of [[-89,-56,16,.72],[92,-48,11,.49],[-85,90,10,.40],[86,80,9,.31]]){
  shapes.push('<polygon points="'+star(cx+dx,532+dy,r)+'" fill="#f8f4ff" fill-opacity="'+o+'"/>');
 }
 shapes.push('</g>');
}
const svg='<svg xmlns="http://www.w3.org/2000/svg" width="'+W+'" height="'+H+'"><defs>'+body.join('')+'</defs>'+shapes.join('')+'</svg>';
const overlay=await sharp(b,{raw:{width:W,height:H,channels:4}}).composite([{input:Buffer.from(svg)}]).raw().toBuffer();
for(let i=3;i<overlay.length;i+=4)overlay[i]=src.data[i];
await sharp(overlay,{raw:{width:W,height:H,channels:4}}).png({compressionLevel:9,effort:8}).toFile(target);
const bytes=fs.readFileSync(target);
console.log("PREMIUM_IDOL_V1",JSON.stringify({bytes:bytes.length,sha256:crypto.createHash("sha256").update(bytes).digest("hex"),atlas:W+"x"+H,output:target}));

