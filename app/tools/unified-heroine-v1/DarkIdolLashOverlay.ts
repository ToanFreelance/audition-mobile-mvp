import * as THREE from "three";
import {GLTFLoader} from "three/examples/jsm/loaders/GLTFLoader.js";

const ASSET="/characters/unified-heroine-v1/dark-idol-native-lashes-v1-1ba835887c25.glb";
const ANCHOR=new THREE.Vector3(0,1.413,-.085);

/** Artist-modelled Blender lash ribbons. New mesh follows existing head bone
 * and existing Blink/Joy shape-key influences; never owns an animation clock. */
export class DarkIdolLashOverlay {
 private mount:THREE.Group;
 private actor:THREE.Group|null=null;
 private promise:Promise<THREE.Group>|null=null;
 private requested=false;
 private disposed=false;
 private morphMeshes:THREE.Mesh[]=[];

 constructor(root:THREE.Group){
  let head:THREE.Bone|undefined;
  root.traverse(obj=>{
   if(obj instanceof THREE.Bone&&obj.name==="J_Bip_C_Head")head=obj;
  });
  if(!head)throw new Error("Dark Idol: VRoid head bone not found");
  root.updateWorldMatrix(true,true);
  // The VRoid Face SkinnedMesh is not positioned at its raw glTF geometry
  // coordinates after inverse-bind matrices are evaluated. Recover the
  // actual bind-pose offset from an existing eyelash vertex, instead of
  // eyeballing an arbitrary Y shift (the source of the floating-lash bug).
  let nativeFace:THREE.SkinnedMesh|undefined;
  root.traverse(o=>{
    if(!(o instanceof THREE.SkinnedMesh))return;
    const mats=Array.isArray(o.material)?o.material:[o.material];
    if(mats.some(m=>/FaceEyelash/i.test(m.name)))nativeFace=o;
  });
  if(!nativeFace)throw new Error("Dark Idol: source eyelash skinned mesh unavailable");
  const faceMesh=nativeFace as THREE.SkinnedMesh;
  const attrs=faceMesh.geometry.getAttribute("position");
  const idx=Math.min(848,attrs.count-1);
  faceMesh.skeleton.update();
  faceMesh.updateWorldMatrix(true,false);
  const raw=new THREE.Vector3().fromBufferAttribute(attrs,idx);
  const posed=faceMesh.applyBoneTransform(idx,raw.clone());
  const bindOffsetWorld=faceMesh.localToWorld(posed).sub(faceMesh.localToWorld(raw));
  const world=root.localToWorld(ANCHOR.clone()).add(bindOffsetWorld);
  this.mount=new THREE.Group();
  this.mount.name="DarkIdol_NativeEyeLashAnchor";
  head.add(this.mount);
  this.mount.position.copy(head.worldToLocal(world));
 }
 setRequested(enabled:boolean){
  this.requested=enabled;
  if(this.actor)this.actor.visible=enabled;
 }
 async ensureLoaded(){
  if(this.disposed)return;
  if(this.actor)return;
  if(!this.promise){
   this.promise=new Promise<THREE.Group>((resolve,reject)=>{
    new GLTFLoader().load(ASSET,g=>resolve(g.scene),undefined,reject);
   }).catch(e=>{this.promise=null;throw e});
  }
  const model=await this.promise;
  if(this.disposed){this.destroyModel(model);return}
  if(!this.actor){
   this.actor=model;
   this.actor.name="DarkIdol_ArtistLashModel";
   this.actor.visible=this.requested;
   this.mount.add(this.actor);
   this.morphMeshes=[];
   this.actor.traverse(o=>{
    if(o instanceof THREE.Mesh&&o.morphTargetDictionary&&o.morphTargetInfluences)
      this.morphMeshes.push(o);
   });
   if(this.morphMeshes.length!==2)
     throw new Error("Dark Idol lash morph shape keys not loaded");
  }
 }
 syncMorph(blink:number,joy:number){
  if(!this.actor||!this.requested)return;
  for(const mesh of this.morphMeshes){
   const dict=mesh.morphTargetDictionary;
   const weights=mesh.morphTargetInfluences;
   if(!dict||!weights)continue;
   if(dict.Blink!==undefined)weights[dict.Blink]=blink;
   if(dict.Joy!==undefined)weights[dict.Joy]=joy;
  }
 }
 diagnostics(){
  return {modelLoaded:!!this.actor,active:this.requested,lashMeshes:this.morphMeshes.length};
 }
 private destroyModel(root:THREE.Group){
  root.traverse(o=>{
   if(!(o instanceof THREE.Mesh))return;
   o.geometry.dispose();
   for(const m of Array.isArray(o.material)?o.material:[o.material])m.dispose();
  });
 }
 dispose(){
  this.disposed=true;
  this.requested=false;
  this.mount.removeFromParent();
  if(this.actor)this.destroyModel(this.actor);
  else this.promise?.then(model=>this.destroyModel(model)).catch(()=>{});
  this.actor=null;
 }
}

