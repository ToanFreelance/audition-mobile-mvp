"use client";
import * as THREE from "three";
import {GLTFLoader} from "three/examples/jsm/loaders/GLTFLoader.js";
import {OrbitControls} from "three/examples/jsm/controls/OrbitControls.js";

export type AriaCamera = "full"|"front"|"left"|"right"|"face";
export type AriaHair = "long"|"bob";
export type AriaOutfit = "dress"|"street";
export type AriaEye = "honey"|"hazel"|"violet";
export type AriaState = {
  camera:AriaCamera;
  hair:AriaHair;
  outfit:AriaOutfit;
  eye:AriaEye;
  dancing:boolean;
};
export type AriaDiagnostic={
  actorUUID:string|null;
  skinnedMeshes:number;
  bones:number;
  faceMorphTargets:number;
  independentV2:true;
  source:"CC0 MakeHuman / CharacterCreator";
  animationMixers:number;
  fps:number|null;
  loadedModules:string[];
  matchedBones:number;
  errors:string[];
};

const ROOT="/characters/anime-lite-v2";
const FILE={
 body:"base_body-b5b450af89f6.glb",
 long:"hair_long01-d340fff458f9.glb",
 bob:"hair_bob02-6fda50782396.glb",
 dress:"clothing_dress-038fc440ae39.glb",
 shoes:"clothing_shoes-ea483876a6de.glb",
 jacket:"clothing_jacket-22c489abb90f.glb",
 jeans:"clothing_jeans-dac0e90aba21.glb",
 tshirt:"clothing_tshirt-f77eaea89354.glb",
} as const;
type ModuleKey=keyof typeof FILE;
type ActorModule={key:ModuleKey;meshes:THREE.SkinnedMesh[];materials:THREE.Material[];group:THREE.Group};
type CameraTarget={pos:[number,number,number];target:[number,number,number]};
const CAMERA:Record<AriaCamera,CameraTarget>={
 full:{pos:[0,1.45,3.18],target:[0,.86,0]},
 front:{pos:[0,1.54,2.10],target:[0,1.47,0]},
 left:{pos:[1.3,1.55,1.65],target:[0,1.47,0]},
 right:{pos:[-1.3,1.55,1.65],target:[0,1.47,0]},
 face:{pos:[0,1.55,.78],target:[0,1.51,0]},
};
const FACE_MORPHS:Record<string,number>={
 gender_female:1,
 face_eye_size_incr:.27,
 face_nose_width_decr:.13,
 proportions_ideal:.17,
};
const EYE_TINT:Record<AriaEye,number>={honey:0xd6b27d,hazel:0x8eab8c,violet:0xb7a2db};
const loader=new GLTFLoader();
const load=(key:ModuleKey)=>new Promise<THREE.Group>((resolve,reject)=>{
  loader.load(ROOT+"/"+FILE[key],g=>resolve(g.scene),undefined,reject);
});
const isSkinned=(o:THREE.Object3D):o is THREE.SkinnedMesh=>o instanceof THREE.SkinnedMesh;

function findModuleMeshes(scene:THREE.Group){
 const result:THREE.SkinnedMesh[]=[];
 scene.traverse(o=>{if(isSkinned(o))result.push(o);});
 return result;
}
/**
 * GLB upstream ships 92 morph targets per mesh (and all default to 1).
 * Bake the four fixed Anime Lite morphs once into rest vertices/normals.
 * Keep only blink_left/right for facial meshes. This removes unused
 * morph attributes from the GPU shader and prevents MakeHuman deformation
 * collisions. Original sculpt/rig remains independent from VRoid V1.
 */
function bakeAnimeLiteMorphs(mesh:THREE.SkinnedMesh,keepBlink:boolean){
 if(mesh.userData.ariaMorphBaked)return;
 mesh.userData.ariaMorphBaked=true;
 const geometry=mesh.geometry;
 const original=mesh.morphTargetDictionary;
 const position=geometry.getAttribute("position");
 const normal=geometry.getAttribute("normal");
 const morphP=geometry.morphAttributes.position??[];
 const morphN=geometry.morphAttributes.normal??[];
 if(!original||!morphP.length||!position)return;
 if(!geometry.morphTargetsRelative){
   throw new Error("Anime Lite morph assets expected glTF relative morph targets");
 }
 for(const [name,value] of Object.entries(FACE_MORPHS)){
   const index=original[name];
   if(index===undefined||!value)continue;
   const delta=morphP[index];
   if(!delta||delta.count!==position.count)continue;
   const nd=morphN[index];
   for(let i=0;i<position.count;i++){
     position.setXYZ(i,
       position.getX(i)+delta.getX(i)*value,
       position.getY(i)+delta.getY(i)*value,
       position.getZ(i)+delta.getZ(i)*value);
     if(normal&&nd&&nd.count===normal.count){
       normal.setXYZ(i,
         normal.getX(i)+nd.getX(i)*value,
         normal.getY(i)+nd.getY(i)*value,
         normal.getZ(i)+nd.getZ(i)*value);
     }
   }
 }
 position.needsUpdate=true;
 if(normal)normal.needsUpdate=true;
 // Limit morph shader cost: retain Blink only on the face geometry.
 const names=keepBlink?["blink_left","blink_right"]:[];
 const indices=names.map(n=>original[n]).filter((v):v is number=>v!==undefined);
 for(const kind of ["position","normal","color"] as const){
   const attrs=geometry.morphAttributes[kind];
   if(attrs)geometry.morphAttributes[kind]=indices.map(i=>attrs[i]).filter(Boolean);
 }
 mesh.updateMorphTargets();
 mesh.morphTargetDictionary=Object.fromEntries(names.filter(n=>original[n]!==undefined).map((n,i)=>[n,i]));
 mesh.morphTargetInfluences=indices.map(()=>0);
 geometry.computeBoundingBox();geometry.computeBoundingSphere();
}
function restQuaternionTrack(bone:THREE.Bone,axis:"x"|"y"|"z",amplitude:number,period:number,phase:number){
 const q0=bone.quaternion.clone();
 const samples=32;
 const times:number[]=[];
 const values:number[]=[];
 for(let i=0;i<=samples;i++){
  const t=i*period/samples;
  const v=Math.sin(t/period*Math.PI*2+phase)*amplitude;
  const d=new THREE.Quaternion().setFromEuler(
   new THREE.Euler(axis==="x"?v:0,axis==="y"?v:0,axis==="z"?v:0));
  const q=q0.clone().multiply(d).normalize();
  times.push(t);values.push(q.x,q.y,q.z,q.w);
 }
 return new THREE.QuaternionKeyframeTrack(bone.name+".quaternion",times,values);
}

/** Candidate-only scene, independent of the accepted VRoid V1 and production. */
export class AnimeLiteV2Scene {
 private host:HTMLElement;
 private canvas:THREE.WebGLRenderer;
 private scene=new THREE.Scene();
 private camera=new THREE.PerspectiveCamera(31,1,.04,80);
 private controls:OrbitControls;
 private clock=new THREE.Clock();
 private frame=0;
 private alive=true;
 private resizeObserver:ResizeObserver|null=null;
 private actor:THREE.Group|null=null;
 private skinMesh:THREE.SkinnedMesh|null=null;
 private bones:THREE.Bone[]=[];
 private moduleCache=new Map<ModuleKey,ActorModule>();
 private materialOriginal=new Map<THREE.Material,THREE.Color>();
 private loadedKeys:ModuleKey[]=[];
 private mixer:THREE.AnimationMixer|null=null;
 private danceAction:THREE.AnimationAction|null=null;
 private baselineQuaternions=new Map<THREE.Bone,THREE.Quaternion>();
 private selected:AriaState={camera:"full",hair:"long",outfit:"dress",eye:"honey",dancing:false};
 private onProgress:(message:string)=>void;
 private onDiag:(diag:AriaDiagnostic)=>void;
 private errors:string[]=[];
 private frames=0;
 private lastReport=0;
 private matchedBones=0;
 private hoverLights:THREE.Light[]=[];

 constructor(host:HTMLElement,onProgress:(text:string)=>void,onDiag:(d:AriaDiagnostic)=>void){
  this.host=host;this.onProgress=onProgress;this.onDiag=onDiag;
  this.canvas=new THREE.WebGLRenderer({antialias:true,alpha:true,powerPreference:"high-performance"});
  this.canvas.setPixelRatio(Math.min(window.devicePixelRatio||1,1.75));
  this.canvas.outputColorSpace=THREE.SRGBColorSpace;
  this.canvas.toneMapping=THREE.ACESFilmicToneMapping;
  this.canvas.toneMappingExposure=1.10;
  this.canvas.shadowMap.enabled=false; // Shadow-hair artifact rejected in V1
  this.canvas.setClearColor(0x171526,0);
  host.appendChild(this.canvas.domElement);
  this.camera.position.set(0,1.45,3);
  this.controls=new OrbitControls(this.camera,this.canvas.domElement);
  this.controls.enablePan=false;this.controls.enableDamping=true;
  this.controls.dampingFactor=.09;
  this.controls.minDistance=.42;this.controls.maxDistance=5.2;
  this.scene.background=new THREE.Color(0x171526);
  const hemi=new THREE.HemisphereLight(0xffffff,0x827b99,1.55);
  this.scene.add(hemi);this.hoverLights.push(hemi);
  const key=new THREE.DirectionalLight(0xffeee3,2.8);
  key.position.set(-3.1,4.0,5.2);this.scene.add(key);this.hoverLights.push(key);
  const fill=new THREE.DirectionalLight(0xc4d6ff,.85);
  fill.position.set(3.4,2.2,3.0);this.scene.add(fill);this.hoverLights.push(fill);
  const rim=new THREE.DirectionalLight(0xb8a0ef,1.1);
  rim.position.set(.6,3.3,-3.5);this.scene.add(rim);this.hoverLights.push(rim);
  const floor=new THREE.Mesh(new THREE.CircleGeometry(1.05,64),new THREE.MeshBasicMaterial({color:0x453c61,transparent:true,opacity:.35,depthWrite:false}));
  floor.rotation.x=-Math.PI/2;floor.position.y=.006;floor.name="QA_Floor";
  this.scene.add(floor);
  this.resizeObserver=new ResizeObserver(()=>this.resize());
  this.resizeObserver.observe(host);this.resize();
  this.setCamera("full");
  this.tick();
 }
 private resize(){
  if(!this.alive)return;
  const w=Math.max(1,this.host.clientWidth);
  const h=Math.max(1,this.host.clientHeight);
  this.camera.aspect=w/h;this.camera.updateProjectionMatrix();
  this.canvas.setSize(w,h,true);
 }
 private trackMaterial(m:THREE.Material){
  if(!(m instanceof THREE.MeshStandardMaterial))return;
  if(!this.materialOriginal.has(m))this.materialOriginal.set(m,m.color.clone());
  if(/Hair/i.test(m.name)){
   m.color.set(0x8a5553);
   m.roughness=.58;
  }else if(/Cloth_dress/i.test(m.name)){
   m.color.set(0xdda9c2);m.roughness=.66;
  }else if(/Cloth_jacket/i.test(m.name)){
   m.color.set(0x403955);m.roughness=.58;
  }else if(/Cloth_tshirt/i.test(m.name)){
   m.color.set(0xffe8e2);m.roughness=.65;
  }else if(/Cloth_jeans/i.test(m.name)){
   m.color.set(0x7b8cad);m.roughness=.78;
  }else if(/Cloth_shoes/i.test(m.name)){
   m.color.set(0xe5d0e0);m.roughness=.43;
  }else if(/Skin/i.test(m.name)){
   m.roughness=.65;
  }else if(/Iris/i.test(m.name)){
   m.color.set(EYE_TINT[this.selected.eye]);m.roughness=.30;
  }
  m.needsUpdate=true;
 }
 private tuneMeshes(root:THREE.Group){
  root.traverse(obj=>{
   if(!(obj instanceof THREE.Mesh))return;
   if(obj instanceof THREE.SkinnedMesh){
     bakeAnimeLiteMorphs(obj,["Body","Eyes","Eyelashes","Eyebrows"].includes(obj.name));
   }
   obj.castShadow=false;obj.receiveShadow=false;
   for(const m of Array.isArray(obj.material)?obj.material:[obj.material])this.trackMaterial(m);
   if(obj.morphTargetDictionary&&obj.morphTargetInfluences){
    obj.morphTargetInfluences.fill(0);
    for(const [k,value] of Object.entries(FACE_MORPHS)){
     const index=obj.morphTargetDictionary[k];
     if(index!==undefined)obj.morphTargetInfluences[index]=value;
    }
   }
  });
 }
 private captureSkeleton(scene:THREE.Group){
  const baseMeshes=findModuleMeshes(scene);
  this.skinMesh=baseMeshes.find(m=>m.name==="Body")??baseMeshes.find(m=>m.skeleton?.bones?.length>0)??null;
  if(!this.skinMesh)throw new Error("CC0 base has no skinned Body mesh");
  this.bones=this.skinMesh.skeleton.bones;
  for(const b of this.bones)this.baselineQuaternions.set(b,b.quaternion.clone());
  return baseMeshes;
 }
 async loadAll(){
  try{
   this.onProgress("Đang tải base CC0 mới (7,2 MB)...");
   const root=await load("body");
   if(!this.alive)return;
   this.actor=root;root.visible=false;this.scene.add(root);
   this.captureSkeleton(root);
   this.tuneMeshes(root);
   this.loadedKeys.push("body");
   this.onProgress("Đã tải base mới. Đang chuẩn bị tóc và trang phục...");
   this.setState(this.selected);
   const modules=(["long","bob","dress","shoes","tshirt","jacket","jeans"] as ModuleKey[]);
   const results=await Promise.allSettled(modules.map(k=>load(k)));
   if(!this.alive)return;
   for(let i=0;i<results.length;i++){
    const entry=results[i],key=modules[i];
    if(entry.status!=="fulfilled"){
     this.errors.push("Asset "+key+": "+String(entry.reason));continue;
    }
    this.attachModule(key,entry.value);
   }
   this.tuneMeshes(root);
   this.setState(this.selected);
   this.setupDance();
   root.visible=true;
   this.onProgress("Sẵn sàng · Anime Lite V2 · độc lập hoàn toàn với VRoid V1");
   this.emitDiag(0);
  }catch(error){
   this.errors.push(String(error));
   this.onProgress("Lỗi load Anime Lite V2: "+String(error));
   this.emitDiag(0);
  }
 }
 private attachModule(key:ModuleKey,source:THREE.Group){
  if(!this.actor||!this.skinMesh)return;
  source.updateWorldMatrix(true,true);
  this.actor.updateWorldMatrix(true,true);
  const reference=this.skinMesh;
  const referenceBones=new Map(this.bones.map(b=>[b.name,b]));
  const meshes=findModuleMeshes(source);
  if(!meshes.length){this.errors.push("No skinned mesh "+key);return;}
  let matches=0;
  const mount=new THREE.Group();
  mount.name="V2_MOD_"+key;mount.visible=false;
  this.actor.add(mount);
  const usedMaterials=new Set<THREE.Material>();
  const attached:THREE.SkinnedMesh[]=[];
  for(const mesh of meshes){
   const srcBones=mesh.skeleton.bones;
   const bindBones=srcBones.map(b=>{
    const resolved=referenceBones.get(b.name);
    if(resolved)matches++;
    return resolved??b;
   });
   if(srcBones.length!==bindBones.length||bindBones.some((b,i)=>b===srcBones[i])){
    this.errors.push("Incomplete binding "+key);continue;
   }
   // Same MakeHuman canonical rig & inverse bind transforms; bind the
   // imported module geometry directly to V2 Body bones, not a second actor.
   const clone=mesh.clone();
   clone.geometry=mesh.geometry;
   const copiedMaterials=(Array.isArray(mesh.material)?mesh.material:[mesh.material]).map(m=>{
    const copy=m.clone();
    usedMaterials.add(copy);return copy;
   });
   clone.material=Array.isArray(mesh.material)?copiedMaterials:copiedMaterials[0];
   const targetSkeleton=new THREE.Skeleton(bindBones,mesh.skeleton.boneInverses);
   clone.bind(targetSkeleton,mesh.bindMatrix.clone());
   // Preserve original CC0 mesh rest transform relative to base source root.
   mesh.updateWorldMatrix(true,false);
   const matrix=mesh.matrixWorld.clone();
   clone.matrix.copy(matrix);
   clone.matrix.decompose(clone.position,clone.quaternion,clone.scale);
   clone.updateMatrixWorld(true);
   mount.add(clone);
   this.tuneMeshes(mount);
   attached.push(clone);
  }
  this.matchedBones+=matches;
  this.moduleCache.set(key,{key,meshes:attached,materials:[...usedMaterials],group:mount});
  this.loadedKeys.push(key);
  source.clear(); // Skeletons not used after module is rebound.
 }
 private setupDance(){
  if(!this.actor||!this.skinMesh)return;
  const chosen=[
   ["spine_02","z",.07,0],["spine_03","z",.10,.3],
   ["upperarm_l","z",.45,0],["upperarm_r","z",-.45,Math.PI],
   ["lowerarm_l","x",.20,1.0],["lowerarm_r","x",.20,1.0],
   ["upperleg_l","x",.11,Math.PI],["upperleg_r","x",.11,0],
   ["head","z",.035,.6]
  ] as const;
  const boneByName=new Map(this.bones.map(x=>[x.name,x]));
  const tracks:THREE.KeyframeTrack[]=[];
  for(const [name,axis,amp,phase] of chosen){
   const bone=boneByName.get(name);
   if(!bone)continue;
   tracks.push(restQuaternionTrack(bone,axis,amp,2.1818,phase));
  }
  if(!tracks.length){this.errors.push("No dance-compatible bone tracks");return;}
  const clip=new THREE.AnimationClip("V2_Dance_QA_notGameplay",2.1818,tracks);
  this.mixer=new THREE.AnimationMixer(this.actor);
  this.danceAction=this.mixer.clipAction(clip);
  this.danceAction.loop=THREE.LoopRepeat;
  if(this.selected.dancing)this.danceAction.play();
 }
 setCamera(which:AriaCamera){
  this.selected.camera=which;
  const position=CAMERA[which];
  this.camera.position.set(...position.pos);
  this.controls.target.set(...position.target);
  this.controls.update();
 }
 setState(state:AriaState){
  const cameraChanged=this.selected.camera!==state.camera;
  this.selected={...state};
  if(cameraChanged)this.setCamera(state.camera);
  this.moduleCache.forEach((m,key)=>{
   const active=key==="shoes"||
    (key==="long"&&state.hair==="long")||
    (key==="bob"&&state.hair==="bob")||
    (key==="dress"&&state.outfit==="dress")||
    (["tshirt","jacket","jeans"].includes(key)&&state.outfit==="street");
   m.group.visible=active;
  });
  this.actor?.traverse(o=>{
   if(!(o instanceof THREE.Mesh))return;
   const mats=Array.isArray(o.material)?o.material:[o.material];
   for(const m of mats){
    if(m instanceof THREE.MeshStandardMaterial&&/Iris/i.test(m.name)){
     m.color.set(EYE_TINT[state.eye]);
     m.needsUpdate=true;
    }
   }
  });
  if(this.danceAction){
   if(state.dancing){
    if(!this.danceAction.isRunning())this.danceAction.play();
   }else{
    this.danceAction.stop();
    this.mixer?.setTime(0);
    for(const [b,q] of this.baselineQuaternions)b.quaternion.copy(q);
   }
  }
  this.emitDiag(0);
 }
 blinkOnce(){
  if(!this.actor)return;
  this.blinkStart=this.clock.elapsedTime;
 }
 private blinkStart:number|null=null;
 private applyBlink(){
  if(!this.actor||this.blinkStart===null)return;
  const dt=this.clock.elapsedTime-this.blinkStart;
  const weight=dt>0&&dt<.30?Math.sin((dt/.30)*Math.PI):0;
  this.actor.traverse(o=>{
   if(!(o instanceof THREE.Mesh)||!o.morphTargetDictionary||!o.morphTargetInfluences)return;
   for(const name of ["blink_left","blink_right"]){
    const index=o.morphTargetDictionary[name];
    if(index!==undefined)o.morphTargetInfluences[index]=weight;
   }
  });
  if(dt>.34)this.blinkStart=null;
 }
 private emitDiag(fps:number){
  const actor=this.actor;
  let meshCount=0,morphCount=0;
  actor?.traverse(o=>{
   if(o instanceof THREE.SkinnedMesh)meshCount++;
   if(o instanceof THREE.Mesh&&o.morphTargetDictionary)morphCount=Math.max(morphCount,Object.keys(o.morphTargetDictionary).length);
  });
  this.onDiag({
   actorUUID:actor?.uuid??null,
   skinnedMeshes:meshCount,bones:this.bones.length,faceMorphTargets:morphCount,
   independentV2:true,source:"CC0 MakeHuman / CharacterCreator",
   animationMixers:this.mixer?1:0,
   fps:fps||null,
   loadedModules:[...this.loadedKeys],
   matchedBones:this.matchedBones,errors:[...this.errors],
  });
 }
 private tick=()=>{
  if(!this.alive)return;
  const dt=Math.min(this.clock.getDelta(),.05);
  this.mixer?.update(dt);
  this.applyBlink();
  this.controls.update();
  this.canvas.render(this.scene,this.camera);
  this.frame=requestAnimationFrame(this.tick);
  this.frames++;
  if(this.clock.elapsedTime-this.lastReport>=2){
   const elapsed=this.clock.elapsedTime-this.lastReport;
   this.emitDiag(Math.round(this.frames/Math.max(elapsed,.01)));
   this.lastReport=this.clock.elapsedTime;this.frames=0;
  }
 };
 dispose(){
  if(!this.alive)return;
  this.alive=false;
  cancelAnimationFrame(this.frame);
  this.resizeObserver?.disconnect();
  this.controls.dispose();
  this.mixer?.stopAllAction();
  this.mixer?.uncacheRoot(this.actor??this.scene);
  this.actor?.traverse(o=>{
   if(o instanceof THREE.Mesh){
    o.geometry.dispose();
    for(const m of Array.isArray(o.material)?o.material:[o.material])m.dispose();
   }
  });
  this.moduleCache.clear();this.actor?.removeFromParent();
  this.canvas.dispose();this.canvas.domElement.remove();
  this.onProgress=()=>{};this.onDiag=()=>{};
 }
}

