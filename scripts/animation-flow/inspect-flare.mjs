// Reproducible animation-only extraction from the owner's exact GLB. No mesh or
// texture is redistributed. node scripts/animation-flow/inspect-flare.mjs INPUT
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
const bytes = readFileSync(process.argv[2]);
if (bytes.readUInt32LE(0) !== 0x46546c67 || bytes.readUInt32LE(4) !== 2 || bytes.readUInt32LE(8) !== bytes.length) throw Error('GLB 2 header');
const length = bytes.readUInt32LE(12), g = JSON.parse(bytes.subarray(20,20+length).toString()), binary = bytes.subarray(28+length);
function accessor(i) {
  const a=g.accessors[i], v=g.bufferViews[a.bufferView], n={SCALAR:1,VEC2:2,VEC3:3,VEC4:4,MAT4:16}[a.type];
  const size={5126:4,5123:2,5125:4,5121:1}[a.componentType], fn={5126:'readFloatLE',5123:'readUInt16LE',5125:'readUInt32LE',5121:'readUInt8'}[a.componentType];
  return Array.from({length:a.count},(_,j)=>Array.from({length:n},(_,k)=>binary[fn]((v.byteOffset??0)+(a.byteOffset??0)+j*(v.byteStride??n*size)+k*size))).flat();
}
const animation=g.animations[0], parents=g.nodes.map(()=>-1);g.nodes.forEach((n,i)=>(n.children??[]).forEach(c=>parents[c]=i));
const channels=animation.channels.map(c=>{const s=animation.samplers[c.sampler];return {node:c.target.node,path:c.target.path,interpolation:s.interpolation??'LINEAR',times:accessor(s.input),values:accessor(s.output)};});
if(channels.some(c=>c.interpolation!=='LINEAR'))throw Error('Unexpected interpolation');
const weights=accessor(7), sums=Array.from({length:weights.length/4},(_,i)=>weights.slice(i*4,i*4+4).reduce((a,b)=>a+b,0));
const hips=g.nodes.findIndex(n=>n.name==='mixamorig:Hips_01'),rootChannel=channels.find(c=>c.node===hips&&c.path==='translation');
const rootDelta=rootChannel.values.slice(-3).map((v,i)=>v-rootChannel.values[i]);
const qErrors=channels.filter(c=>c.path==='rotation').map(c=>{const a=c.values.slice(0,4),b=c.values.slice(-4),dot=Math.abs(a.reduce((v,x,i)=>v+x*b[i],0)/Math.hypot(...a)/Math.hypot(...b));return 2*Math.acos(Math.min(1,dot))*180/Math.PI;});
const deltas=channels.flatMap(c=>c.times.slice(1).map((v,i)=>v-c.times[i]));
const output={schemaVersion:1,sha256:createHash('sha256').update(bytes).digest('hex'),originalBytes:bytes.length,asset:g.asset,
  inspection:{nodes:g.nodes.length,meshes:g.meshes.length,skins:g.skins.length,joints:g.skins[0].joints.length,vertices:g.accessors[0].count,indices:g.accessors[4].count,weightSumRange:[Math.min(...sums),Math.max(...sums)],jointIndexRange:[Math.min(...accessor(6)),Math.max(...accessor(6))],images:g.images.length,materials:g.materials.length,nativeRootDeltaSourceUnits:rootDelta,nativeMaxTrackSeamDeg:Math.max(...qErrors),keyIntervalRangeSeconds:[Math.min(...deltas),Math.max(...deltas)],allChannelsFinite:channels.every(c=>c.values.every(Number.isFinite)&&c.times.every(Number.isFinite))?1:0,allBindingsValid:channels.every(c=>g.nodes[c.node])?1:0},
  nodes:g.nodes.map((n,i)=>({name:n.name,parent:parents[i],translation:n.translation,rotation:n.rotation,scale:n.scale,matrix:n.matrix})),
  skin:{joints:g.skins[0].joints,inverseBindMatrices:accessor(g.skins[0].inverseBindMatrices)},
  animation:{name:animation.name,duration:Math.max(...channels.map(c=>c.times.at(-1))),channels},
  changes:'Animation and bind hierarchy extracted from owner upload; Kabal mesh/textures omitted. CMU adaptation and transition synthesis are experimental, not author-approved.'};
mkdirSync('public/qa/animation-flow-v2',{recursive:true});writeFileSync('public/qa/animation-flow-v2/flare-source.json',JSON.stringify(output));
console.log(JSON.stringify({sha256:output.sha256,...output.inspection,animation:output.animation.name,duration:output.animation.duration,channels:channels.length,bytes:JSON.stringify(output).length},null,2));
