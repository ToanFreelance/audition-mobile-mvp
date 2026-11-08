// Export actual Three.js evaluated meshes for aligned Cycles comparisons.
import fs from 'node:fs';import path from 'node:path';import zlib from 'node:zlib';
import {pathToFileURL} from 'node:url';import assert from 'node:assert/strict';
import {createEyeRig} from '../../public/qa/female-golden-eye-v8/eye-rig.js';
import {createMouthRig} from '../../public/qa/female-golden-face-v1/mouth-rig.js';
const THREE=await import(pathToFileURL(path.resolve(process.argv[3])));
const bytes=fs.readFileSync(process.argv[2]);const jsonSize=bytes.readUInt32LE(12),gltf=JSON.parse(bytes.subarray(20,20+jsonSize)),start=28+jsonSize;
const out=path.resolve(process.argv[5]);fs.mkdirSync(out,{recursive:true});
function accessor(i){const a=gltf.accessors[i],v=gltf.bufferViews[a.bufferView],size={SCALAR:1,VEC2:2,VEC3:3}[a.type],Type={5126:Float32Array,5125:Uint32Array,5123:Uint16Array}[a.componentType];return new Type(bytes.buffer,bytes.byteOffset+start+(v.byteOffset||0)+(a.byteOffset||0),a.count*size).slice();}
const primitive=gltf.meshes[0].primitives[0];
function source(){const g=new THREE.BufferGeometry();for(const [from,to,size] of [['POSITION','position',3],['NORMAL','normal',3],['TEXCOORD_0','uv',2]])g.setAttribute(to,new THREE.BufferAttribute(accessor(primitive.attributes[from]),size));g.setIndex(new THREE.BufferAttribute(accessor(primitive.indices),1));return new THREE.Mesh(g,new THREE.MeshStandardMaterial());}
const dir=new URL('../../public/qa/female-golden-eye-v8/',import.meta.url);
const meta=JSON.parse(fs.readFileSync(new URL('eye-rig.json',dir))),boundary=JSON.parse(zlib.gunzipSync(fs.readFileSync(new URL('eye-boundary.json.gz',dir))));
const raw=zlib.gunzipSync(fs.readFileSync(new URL('eye-patch.bin.gz',dir))),buffer=raw.buffer.slice(raw.byteOffset,raw.byteOffset+raw.byteLength),nr=meta.removedTriangles,nv=meta.affectedVertices;
const data={meta,boundary,remove:new Uint32Array(buffer,0,nr),indices:new Uint32Array(buffer,nr*4,nv),poses:Array.from({length:9},(_,k)=>new Float32Array(buffer,(nr+nv)*4+k*nv*12,nv*3))};
function snapshot(root,label){root.updateMatrixWorld(true);const parts=[];root.traverse(o=>{if(!o.isMesh||!o.visible)return;let par=o.parent;while(par){if(!par.visible)return;par=par.parent;}
 const geo=o.geometry,arr=geo.attributes.position.array.slice(),nn=geo.attributes.normal.array.slice();
 for(let k=0;k<(o.morphTargetInfluences?.length||0);k++){const w=o.morphTargetInfluences[k];if(!w)continue;const d=geo.morphAttributes.position[k].array;for(let i=0;i<arr.length;i++)arr[i]+=w*d[i];if(geo.morphAttributes.normal?.[k]){const nd=geo.morphAttributes.normal[k].array;for(let i=0;i<nn.length;i++)nn[i]+=w*nd[i];}}
 const matrix=o.matrixWorld.clone().premultiply(root.matrixWorld.clone().invert()),nm=new THREE.Matrix3().getNormalMatrix(matrix),v=new THREE.Vector3();
 for(let i=0;i<arr.length;i+=3){v.fromArray(arr,i).applyMatrix4(matrix).toArray(arr,i);v.fromArray(nn,i).applyMatrix3(nm).normalize().toArray(nn,i);}
 const id=parts.length,save=(suffix,a)=>{const file=`${label}-${id}-${suffix}.bin`;fs.writeFileSync(path.join(out,file),Buffer.from(a.buffer,a.byteOffset,a.byteLength));return file;};
 parts.push({name:o.name||'Head',position:save('pos',arr),normal:save('normal',nn),index:save('index',new Uint32Array(geo.index.array)),uv:geo.attributes.uv?save('uv',geo.attributes.uv.array):null,color:geo.attributes.color?save('color',geo.attributes.color.array):null,material:o.material===root.material?'source':o.name.includes('Iris')?'iris':o.parent?.name?.startsWith('Eye')?'sclera':o.name});
 });fs.writeFileSync(path.join(out,`${label}.json`),JSON.stringify(parts));}
const original=source();snapshot(original,'original');
const v1=source();const eye1=createEyeRig(THREE,v1,data,new THREE.Texture());eye1.setStyle('natural');
const mouth1=createMouthRig(THREE,v1,JSON.parse(zlib.gunzipSync(fs.readFileSync(new URL('../../public/qa/female-golden-face-v1/mouth-rig.json.gz',import.meta.url)))),new THREE.Texture());mouth1.setPreset('natural');snapshot(v1,'v1');
const v2=source();const eye2=createEyeRig(THREE,v2,data,new THREE.Texture());eye2.setStyle('natural');
const md=JSON.parse(zlib.gunzipSync(fs.readFileSync(process.argv[4])));
assert.equal(md.sourceSha256,meta.sourceSha256);
const affected=new Set(data.indices);assert.ok(md.indices.every(i=>!affected.has(i)),'mouth/eye support must not overlap');
const p=v2.geometry.attributes.position.array,n=v2.geometry.attributes.normal.array;
md.indices.forEach((id,k)=>{for(let j=0;j<3;j++){p[id*3+j]+=md.delta[k][j];n[id*3+j]=md.normal[k][j];}});
snapshot(v2,'v2');
console.log(JSON.stringify({exported:['original','v1','v2'],mouthAffected:md.indices.length,eyeMouthOverlap:0,sourceTopologyUnchanged:true}));
