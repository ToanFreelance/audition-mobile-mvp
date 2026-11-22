import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import sharp from "sharp";

// Repaint the ORIGINAL VRoid UV skin texture, not a floating 3D decal.
// Eye skin atlas UVs inspected on the 2054-vertex face mesh: left eye U=.58-.73,
// right U=.27-.42, upper lid V=.425-.48. Keep all native skin alpha and details.
const root=process.cwd();
const glb=fs.readFileSync(path.join(root,"public/characters/unified-heroine-v1/unified-heroine-v1-a41bb9e659e5.glb"));
const n=glb.readUInt32LE(12),gltf=JSON.parse(glb.subarray(20,20+n).toString("utf8"));
const img=gltf.images.find(x=>x.name==="F00_000_00_Face_00");
if(!img)throw new Error("Canonical VRoid Face_00 image not present");
const bv=gltf.bufferViews[img.bufferView];
const image=glb.subarray(20+n+8+(bv.byteOffset||0),20+n+8+(bv.byteOffset||0)+bv.byteLength);
const {data,info}=await sharp(image).ensureAlpha().raw().toBuffer({resolveWithObject:true});
const W=info.width,H=info.height;const out=Buffer.from(data);
const smooth=(a,b,x)=>{const v=Math.max(0,Math.min(1,(x-a)/(b-a)));return v*v*(3-2*v)};
for(let y=0;y<H;y++)for(let x=0;x<W;x++){
 const u=(x+.5)/W, v=1-(y+.5)/H;
 const p=(y*W+x)*4;if(out[p+3]<10)continue;
 const u0=u<.5?.338:.662;
 const du=(u-u0)/.103;
 const dv=(v-.454)/.032;
 const core=Math.exp(-(du*du*1.6+dv*dv*1.9));
 const mask=smooth(.407,.430,v)*(1-smooth(.483,.504,v));
 const outer=u<.5?Math.max(0,(.339-u)/.11):Math.max(0,(u-.661)/.11);
 const wing=Math.exp(-Math.pow((outer-.65)/.55,2))*Math.exp(-Math.pow((v-.469)/.027,2));
 const opacity=Math.min(.38,core*.24*mask+wing*.115*mask);
 if(opacity<=.003)continue;
 const base=[out[p],out[p+1],out[p+2]];
 const shade=[121,71,121];
 // Warm plum skin makeup retains the existing skin shading / native AO.
 for(let k=0;k<3;k++)out[p+k]=Math.max(0,Math.min(255,Math.round(base[k]*(1-opacity)+shade[k]*opacity)));
 // Tiny understated satin shimmer at inner lid, not a polygon/cosmetic icon.
 const inner=(u<.5?Math.max(0,(u-.38)/.07):Math.max(0,(.62-u)/.07));
 const satin=Math.exp(-Math.pow((inner-.57)/.45,2))*Math.exp(-Math.pow((v-.467)/.013,2))*.10;
 out[p]+=Math.round(satin*38);out[p+1]+=Math.round(satin*21);out[p+2]+=Math.round(satin*27);
}
const dest=path.join(root,"public/characters/unified-heroine-v1/eye-pack-v1/face-dark-idol-makeup-v1.png");
fs.mkdirSync(path.dirname(dest),{recursive:true});
await sharp(out,{raw:{width:W,height:H,channels:4}}).png({effort:8,compressionLevel:9}).toFile(dest);
const b=fs.readFileSync(dest);
console.log("DARK_IDOL_MAKEUP",W+"x"+H,b.length,crypto.createHash("sha256").update(b).digest("hex"));

