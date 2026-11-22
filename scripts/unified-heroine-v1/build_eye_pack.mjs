// Real UV-compatible Eye Pack V1 assets for the accepted VRoid face.
// Uses embedded iris image from the canonical GLB; requires sharp (Next.js dependency).
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import sharp from "sharp";
const root=process.cwd();
const source=path.join(root,"public/characters/unified-heroine-v1/unified-heroine-v1-a41bb9e659e5.glb");
const folder=path.join(root,"public/characters/unified-heroine-v1/eye-pack-v1");
const glb=fs.readFileSync(source);
if(glb.toString("ascii",0,4)!=="glTF")throw Error("Expected GLB");
const jlen=glb.readUInt32LE(12),g=JSON.parse(glb.subarray(20,20+jlen).toString("utf8")),bin=20+jlen+8;
const face=g.meshes.find(m=>/Face/i.test(m.name));
const primitive=face.primitives.find(p=>/EyeIris/i.test(g.materials[p.material].name));
const material=g.materials[primitive.material];
const t=g.textures[material.pbrMetallicRoughness.baseColorTexture.index];
const image=g.images[t.source], view=g.bufferViews[image.bufferView];
const imageBytes=glb.subarray(bin+view.byteOffset,bin+view.byteOffset+view.byteLength);
const decoded=await sharp(imageBytes).ensureAlpha().raw().toBuffer({resolveWithObject:true});
const w=decoded.info.width,h=decoded.info.height;
if(w!==1024||h!==512)throw Error("Unexpected iris UV atlas");
fs.mkdirSync(folder,{recursive:true});
const looks=[
 {id:"natural",base:[145,95,69],label:"Tự nhiên"},
 {id:"doll",base:[177,102,238],label:"Búp bê"},
 {id:"idol",base:[33,126,240],label:"Thần tượng"},
 {id:"star",base:[139,70,218],label:"Ngôi sao"},
 {id:"heart",base:[235,69,141],label:"Trái tim"}
];
function points(cx,cy,outer,inner,n){
 const result=[];
 for(let i=0;i<n*2;i++){
 const a=-Math.PI/2+i*Math.PI/n,r=i%2?inner:outer;
 result.push((cx+Math.cos(a)*r).toFixed(1)+","+(cy+Math.sin(a)*r).toFixed(1));
 }
 return result.join(" ");
}
function artwork(style) {
 if(style==="natural")return "";
 const all=[];
 for(const x of [256,768]){
  const glints=[[-50,-43,8],[52,-8,7],[-45,67,6],[43,65,4]];
  all.push('<g clip-path="url(#eye'+x+')">');
  const bright=style==="idol"?"#b3faff":style==="star"?"#fce6ff":style==="heart"?"#ffc8ed":"#ebd6ff";
  for(let i=0;i<40;i++){
   const angle=i*Math.PI*2/40;
   all.push('<line x1="'+(x+Math.cos(angle)*57)+'" y1="'+(270+Math.sin(angle)*73)+'" x2="'+(x+Math.cos(angle)*82)+'" y2="'+(270+Math.sin(angle)*103)+'" stroke="'+bright+'" stroke-width="2" opacity=".34"/>');
  }
  if(style==="star"){
   all.push('<polygon points="'+points(x,265,43,19,5)+'" fill="#ffe98b" stroke="#fff4c2" stroke-width="4"/>');
   all.push('<polygon points="'+points(x,264,28,12,5)+'" fill="#ffd55e" opacity=".87"/>');
  }else if(style==="heart"){
   all.push('<path d="M'+x+' 303 C'+(x-13)+' 287 '+(x-41)+' 269 '+(x-36)+' 247 C'+(x-31)+' 229 '+(x-9)+' 226 '+x+' 245 C'+(x+9)+' 226 '+(x+31)+' 229 '+(x+36)+' 247 C'+(x+41)+' 269 '+(x+13)+' 287 '+x+' 303Z" fill="#ffc8e7" stroke="#ffedf9" stroke-width="4"/>');
  }else if(style==="idol"){
   all.push('<polygon points="'+points(x,267,38,19,4)+'" fill="#d5fcff" stroke="#82e6ff" stroke-width="4"/>');
   all.push('<polygon points="'+points(x,266,20,10,4)+'" fill="white" opacity=".87"/>');
  }else{
   all.push('<ellipse cx="'+x+'" cy="264" rx="30" ry="40" fill="#4c2276" opacity=".8"/>');
   all.push('<ellipse cx="'+x+'" cy="262" rx="20" ry="30" fill="#251044"/>');
  }
  for(const [dx,dy,r] of glints){
   all.push('<polygon points="'+points(x+dx,270+dy,r,r*.33,4)+'" fill="#fffaff" opacity=".9"/>');
  }
  all.push('<ellipse cx="'+(x-22)+'" cy="223" rx="13" ry="18" fill="#fffaff" opacity=".91"/>');
  all.push('<circle cx="'+(x+29)+'" cy="320" r="7" fill="white" opacity=".95"/>');
  all.push('</g>');
 }
 return all.join("");
}
const manifest={id:"unified-heroine-eye-pack-v1",version:"v1",sourceMesh:"Face.baked/EyeIris",uvAtlas:[w,h],assets:[]};
for(const look of looks){
 const output=path.join(folder,"eye-"+look.id+"-v1.png");
 if(look.id==="natural")fs.writeFileSync(output,imageBytes);
 else{
  const data=Buffer.from(decoded.data);
  for(let i=0;i<data.length;i+=4){
   if(!data[i+3])continue;
   const lum=(.23*data[i]+.68*data[i+1]+.09*data[i+2])/255;
   const factor=.22+1.5*lum, shine=lum>.64?(lum-.64)*150:0;
   for(let c=0;c<3;c++)data[i+c]=Math.min(255,Math.round(look.base[c]*factor+shine));
  }
  const svg='<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="512"><defs><clipPath id="eye256"><ellipse cx="256" cy="260" rx="103" ry="132"/></clipPath><clipPath id="eye768"><ellipse cx="768" cy="260" rx="103" ry="132"/></clipPath></defs>'+artwork(look.id)+'</svg>';
  const overlay=await sharp(data,{raw:{width:w,height:h,channels:4}}).composite([{input:Buffer.from(svg)}]).raw().toBuffer();
  for(let i=3;i<overlay.length;i+=4)overlay[i]=decoded.data[i];
  await sharp(overlay,{raw:{width:w,height:h,channels:4}}).png({compressionLevel:9,effort:8}).toFile(output);
 }
 const b=fs.readFileSync(output);
 const entry={id:look.id,label:look.label,file:path.basename(output),bytes:b.length,sha256:crypto.createHash("sha256").update(b).digest("hex")};
 manifest.assets.push(entry);
 console.log("EYE_ASSET",JSON.stringify(entry));
}
fs.writeFileSync(path.join(folder,"manifest.json"),JSON.stringify(manifest,null,2)+"\n");
console.log("EYE_PACK_READY",JSON.stringify({count:manifest.assets.length,totalBytes:manifest.assets.reduce((a,b)=>a+b.bytes,0)}));

