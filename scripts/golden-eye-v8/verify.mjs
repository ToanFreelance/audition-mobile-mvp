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
const stats=[];
for(const style of meta.styles){rig.setStyle(style);const work=mesh.geometry;
 assert.equal(work.morphAttributes.position.length,3,'GPU blink + neutral expression + neutral blink');
 assert.equal(work.morphTargetsRelative,true);
 for(const attribute of work.morphAttributes.position){
  assert.equal(attribute.count,work.attributes.position.count);
  assert.ok(attribute.array.every(Number.isFinite));
 }
 assert.ok(work.morphAttributes.position[1].array.every(Number.isFinite));
 const disp=work.morphAttributes.position[0].array;
 assert.ok(disp.some((v,i)=>i%3===2&&v<-.012),'upper lid must close');
 assert.ok(disp.some((v,i)=>i%3===2&&v>.004),'lower lid must lift');
 rig.setBlink(.75);assert.ok(Math.abs(mesh.morphTargetInfluences[0]-.75)<.00001);
 rig.setBlink(1);assert.equal(mesh.morphTargetInfluences[0],1);
 rig.setBlink(0);assert.equal(mesh.morphTargetInfluences[0],0);
 rig.setExpression(.5);rig.setBlink(.8);
 assert.ok(Math.abs(mesh.morphTargetInfluences[0]-.4)<.00001,'preset blink half weight');
 assert.ok(Math.abs(mesh.morphTargetInfluences[1]-.5)<.00001,'neutral transition');
 assert.ok(Math.abs(mesh.morphTargetInfluences[2]-.4)<.00001,'neutral blink half weight');
 for(const eye of mesh.children[0].children)
  assert.ok(Math.abs(eye.children[0].morphTargetInfluences[0]-.5)<.00001,'sclera follows contour');
 rig.setBlink(0);rig.setExpression(0);
 rig.setGaze(.20);
 assert.ok(Math.abs(rig.state.gazeYaw[0]-.20)<.00001 && Math.abs(rig.state.gazeYaw[1]-.20)<.00001,'both eyes move together');
 rig.resetGaze();assert.ok(work.attributes.position.array.every(Number.isFinite));assert.ok(work.attributes.normal.array.every(Number.isFinite));assert.ok(work.index.array.every(x=>x<work.attributes.position.count));assert.equal(rig.state.gazeYaw[0],rig.state.gazeYaw[1]);
 const anchor=mesh.children[0].children[0];const eye=anchor.getObjectByName('ApprovedIrisCurvedCap');const p=eye.geometry.attributes.position,n=eye.geometry.attributes.normal;assert.ok(n.getY(150)>.5,'Iris must face forward, not be culled');
 for(const a of mesh.children[0].children)assert.ok(a.children[0].geometry.attributes.normal.getY(300)>.5,'Sclera must face forward');
 const local=new THREE.Vector3(0,meta.eyeRadius+.00035,0).applyEuler(anchor.getObjectByName('Gaze').rotation);if(style==='playful')assert.ok(local.x>.02,'Both iris assemblies must rotate screen-right');else assert.equal(local.x,0);
 stats.push({style,vertices:work.attributes.position.count,triangles:work.index.count/3,gaze:rig.state.gazeYaw,irisRadius:meta.irisRadii[meta.styles.indexOf(style)]});rig.setOriginal(true);assert.equal(mesh.geometry,g);assert.equal(mesh.children[0].visible,false);
}
assert.equal(crypto.createHash('sha256').update(Buffer.from(g.attributes.position.array.buffer)).digest('hex'),originalHash);
const working=rig.state.workingGeometry;for(let i=0;i<30;i++)rig.setStyle(meta.styles[i%9]);assert.equal(rig.state.workingGeometry,working);rig.dispose();assert.equal(mesh.geometry,g);assert.equal(mesh.children.length,0);
console.log(JSON.stringify({pass:true,checks:['source SHA-256','nine finite poses','nine GPU blink deltas','three weighted morph targets','neutral to emotion + sclera aperture blend','0.75/100% blink morph weights','conjugate gaze overrides','valid indices','forward iris winding','conjugate gaze > 0.02','exact original restore','30 switches reuse geometry','disposal'],styles:stats},null,2));
