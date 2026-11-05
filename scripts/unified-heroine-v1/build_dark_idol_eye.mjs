import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import sharp from "sharp";

// Dark Idol V1: no stickers/sigils. Optical source details from real VRoid
// UV atlas, darkened concentric iris, copper-rose inner pigment, deep indigo
// limbal boundary and restrained catchlights.
const root=process.cwd();
const dir=path.join(root,"public/characters/unified-heroine-v1/eye-pack-v1");
const source=path.join(dir,"eye-natural-v1.png");
const target=path.join(dir,"eye-dark-idol-v1.png");
const W=2048,H=1024;
const src=await sharp(source).resize(W,H,{kernel:"lanczos3"}).ensureAlpha().raw().toBuffer({resolveWithObject:true});
const raw=Buffer.from(src.data);
const clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x));
const mix=(a,b,t)=>a+(b-a)*t;
const smooth=t=>t*t*(3-2*t);
const hash=x=>{let v=Math.sin(x*71.23+13.1)*43912.4;return v-Math.floor(v)};
for(let y=0;y<H;y++)for(let x=0;x<W;x++){
 const p=(y*W+x)*4;
 if(raw[p+3]<12)continue;
 const cx=x<W/2?512:1536,dx=(x-cx)/205,dy=(y-530)/255;
 const r=Math.hypot(dx,dy);if(r>1.13)continue;
 const theta=Math.atan2(dy,dx),a=(theta+Math.PI)/(Math.PI*2);
 const idx=Math.floor(a*360),fr=smooth(a*360-idx);
 const noise=mix(hash(idx),hash(idx+1),fr)-.5;
 const radial=Math.sin(theta*221+r*31+Math.sin(theta*14)*3.1)*.065
             +Math.sin(theta*101-r*57)*.038+noise*.15;
 const t=smooth(clamp((r-.27)/.64));
 const center=[170,87,135],outer=[42,30,87];
 let R=mix(center[0],outer[0],t),G=mix(center[1],outer[1],t),B=mix(center[2],outer[2],t);
 const sapphire=(1-clamp(Math.abs(r-.60)/.26))*clamp((dy+.60)/1.6);
 R=mix(R,53,sapphire*.22);G=mix(G,111,sapphire*.22);B=mix(B,168,sapphire*.22);
 const copper=Math.exp(-Math.pow((r-.51)/.05,2))*.16;
 R=mix(R,208,copper);G=mix(G,132,copper);B=mix(B,114,copper);
 const pupils=1-smooth(clamp((r-.17)/.09));
 const rim=smooth(clamp((r-.80)/.20));
 const L=(raw[p]*.2126+raw[p+1]*.7152+raw[p+2]*.0722)/255;
 // Preserve native pigment/highlight, tempered for dark fashion makeup.
 const highlight=Math.pow(clamp((L-.54)/.46),1.3)*.20;
 const lamp=.92+radial*clamp((r-.22)/.55)+highlight;
 for(let k=0;k<3;k++){
   let v=[R,G,B][k]*lamp;
   v=mix(v,[10,8,25][k],pupils*.84);
   v=mix(v,[15,12,32][k],rim*.90);
   v+=highlight*[65,60,68][k];
   raw[p+k]=Math.round(clamp(v,0,255));
 }
}
await sharp(raw,{raw:{width:W,height:H,channels:4}})
 .png({compressionLevel:9,effort:8}).toFile(target);
const sha=crypto.createHash("sha256").update(fs.readFileSync(target)).digest("hex");
console.log("DARK_IDOL_ATLAS",path.basename(target),"bytes",fs.statSync(target).size,"sha256",sha);

