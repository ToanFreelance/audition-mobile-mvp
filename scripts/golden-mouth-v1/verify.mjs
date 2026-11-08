// Run: node scripts/golden-eye-v8/verify.mjs /path/to/original.glb /path/to/three.module.js
import fs from 'node:fs';import path from 'node:path';import zlib from 'node:zlib';import assert from 'node:assert/strict';import crypto from 'node:crypto';import {pathToFileURL} from 'node:url';
import {createEyeRig,createIrisGeometry} from '../../public/qa/female-golden-eye-v8/eye-rig.js';
const THREE=await import(pathToFileURL(path.resolve(process.argv[3])));
const dir=new URL('../../public/qa/female-golden-eye-v8/',import.meta.url);
const meta=JSON.parse(fs.readFileSync(new URL('eye-rig.json',dir))),boundary=JSON.parse(zlib.gunzipSync(fs.readFileSync(new URL('eye-boundary.json.gz',dir))));
const bytes=fs.readFileSync(process.argv[2]);assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),meta.sourceSha256);
const jsonSize=bytes.readUInt32LE(12),gltf=JSON.parse(bytes.subarray(20,20+jsonSize));const start=28+jsonSize;
function accessor(i){const a=gltf.accessors[i],v=gltf.bufferViews[a.bufferView],size={SCALAR:1,VEC2:2,VEC3:3}[a.type],Type={5126:Float32Array,5125:Uint32Array,5123:Uint16Array}[a.componentType];return new Type(bytes.buffer,bytes.byteOffset+start+(v.byteOffset||0)+(a.byteOffset||0),a.count*size).slice();}
const primitive=gltf.meshes[0].primitives[0],g=new THREE.BufferGeometry();for(const [from,to,size] of [['POSITION','position',3],['NORMAL','normal',3],['TEXCOORD_0','uv',2]])g.setAttribute(to,new THREE.BufferAttribute(accessor(primitive.attributes[from]),size));g.setIndex(new THREE.BufferAttribute(accessor(primitive.indices),1));
const raw=zlib.gunzipSync(fs.readFileSync(new URL('eye-patch.bin.gz',dir))),buffer=raw.buffer.slice(raw.byteOffset,raw.byteOffset+raw.byteLength),nr=meta.removedTriangles,nv=meta.affectedVertices;
const data={meta,boundary,remove:new Uint32Array(buffer,0,nr),indices:new Uint32Array(buffer,nr*4,nv),poses:Array.from({length:9},(_,k)=>new Float32Array(buffer,(nr+nv)*4+k*nv*12,nv*3))};
const mesh=new THREE.Mesh(g,new THREE.MeshStandardMaterial()),tex=new THREE.Texture(),rig=createEyeRig(THREE,mesh,data,tex);const originalHash=crypto.createHash('sha256').update(Buffer.from(g.attributes.position.array.buffer)).digest('hex');

const {createMouthRig}=await import('../../public/qa/female-golden-face-v1/mouth-rig.js');
const mouthData=JSON.parse(zlib.gunzipSync(fs.readFileSync(new URL('../../public/qa/female-golden-face-v1/mouth-rig.json.gz',import.meta.url))));
rig.setStyle('natural');const mouth=createMouthRig(THREE,mesh,mouthData,new THREE.Texture());
const keepIndex=mesh.geometry.index;let checks=0;
const originalMouthIds=mouth.state.geometryIds;
for(const eye of meta.styles){rig.setStyle(eye);for(const st of mouthData.styles){
 const before=JSON.stringify(rig.state);mouth.setPreset(st.id);assert.equal(JSON.stringify(rig.state),before);assert.equal(mouth.state.preset,st.id);
 const eyeBefore=rig.state.style;rig.setBlink(.8);rig.setExpression(.4);mouth.setAmount(.65);assert.equal(rig.state.style,eyeBefore);assert.equal(mesh.morphTargetInfluences[0],.48);assert.equal(mouth.state.preset,st.id);
 mouth.setPreset(st.id);rig.setBlink(0);rig.setExpression(0);assert.equal(mouth.state.weights[mouthData.styles.indexOf(st)],1);assert.equal(mesh.morphTargetInfluences[0],0);assert.equal(mesh.morphTargetInfluences[1],0);
 assert.equal(mesh.geometry.index,keepIndex);checks++;
}}
for(let i=0;i<30;i++){const m=mouthData.styles[i%9].id;mouth.setPreset(m);const state=JSON.stringify(mouth.state);rig.setStyle(meta.styles[(i*4)%9]);assert.equal(JSON.stringify(mouth.state),state);assert.deepEqual(mouth.state.geometryIds,originalMouthIds);}
// Geometry and all relative GPU targets must be finite and index-safe.
let objects=0,triangles=0;
mesh.traverse(o=>{if(!o.isMesh)return;objects++;const g=o.geometry;triangles+=g.index.count/3;for(const a of Object.values(g.attributes))assert.ok(a.array.every(Number.isFinite));for(const attrs of Object.values(g.morphAttributes))for(const a of attrs){assert.equal(a.count,g.attributes.position.count);assert.ok(a.array.every(Number.isFinite));}assert.ok(g.index.array.every(i=>i<g.attributes.position.count));});
rig.setOriginal(true);mouth.setOriginal(true);assert.equal(mesh.geometry,g);assert.equal(mesh.children[1].visible,false);rig.setOriginal(false);mouth.setOriginal(false);assert.equal(mesh.geometry.index,keepIndex);
// Snapshot actual runtime positions, morph normals, UVs and material names for Blender.
if(process.argv[4]){
 const out=path.resolve(process.argv[4]);fs.mkdirSync(out,{recursive:true});rig.setStyle('natural');
 function snapshot(root,label){root.updateMatrixWorld(true);const parts=[];root.traverse(o=>{if(!o.isMesh||!o.visible)return;let par=o.parent;while(par){if(!par.visible)return;par=par.parent;}const geo=o.geometry,arr=geo.attributes.position.array.slice(),nn=geo.attributes.normal.array.slice();
 for(let k=0;k<(o.morphTargetInfluences?.length||0);k++){const w=o.morphTargetInfluences[k];if(!w)continue;const d=geo.morphAttributes.position[k].array;for(let i=0;i<arr.length;i++)arr[i]+=w*d[i];if(geo.morphAttributes.normal?.[k]){const nd=geo.morphAttributes.normal[k].array;for(let i=0;i<nn.length;i++)nn[i]+=w*nd[i];}}
 const matrix=o.matrixWorld.clone();const inv=mesh.matrixWorld.clone().invert();matrix.premultiply(inv);const nm=new THREE.Matrix3().getNormalMatrix(matrix);const v=new THREE.Vector3();for(let i=0;i<arr.length;i+=3){v.fromArray(arr,i).applyMatrix4(matrix).toArray(arr,i);v.fromArray(nn,i).applyMatrix3(nm).normalize().toArray(nn,i);}
 const id=parts.length;const save=(suffix,a)=>{const file=`${label}-${id}-${suffix}.bin`;fs.writeFileSync(path.join(out,file),Buffer.from(a.buffer,a.byteOffset,a.byteLength));return file;};
 parts.push({name:o.name||'Head',position:save('pos',arr),normal:save('normal',nn),index:save('index',new Uint32Array(geo.index.array)),uv:geo.attributes.uv?save('uv',geo.attributes.uv.array):null,color:geo.attributes.color?save('color',geo.attributes.color.array):null,material:o.material===mesh.material?'source':o.name.includes('Iris')?'iris':o.parent?.name?.startsWith('Eye')?'sclera':o.name});
 });fs.writeFileSync(path.join(out,`${label}.json`),JSON.stringify(parts));}
 for(const st of mouthData.styles){mouth.setPreset(st.id);snapshot(mesh,st.id);}
}
mouth.dispose();rig.dispose();assert.equal(mesh.geometry,g);assert.equal(mesh.children.length,0);assert.equal(crypto.createHash('sha256').update(Buffer.from(g.attributes.position.array.buffer)).digest('hex'),originalHash);
console.log(JSON.stringify({pass:true,combinations:checks,switchCycles:30,objects,triangles,checks:['actual GLB source hash','9 eyes × 9 mouths','mouth changes preserve complete eye state','eye changes preserve complete mouth state','concurrent blink/expression/mouth interpolation','static weights restored','fixed mouth geometry IDs','finite positions/normals/morphs','valid indices','original geometry restored','dispose restores source and removes rigs'],webgl:'not tested by Node; requires GPU browser',iphone:'owner pending'},null,2));
