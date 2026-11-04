import * as T from "three";
import {GLTFLoader} from "three/examples/jsm/loaders/GLTFLoader.js";

/**
 * QA-only Spider Queen Fang. One immutable GLB on demand; no character refetch.
 * All model coordinates below come from the canonical VRoid FaceMouth indexed
 * vertices measured in original glTF metres, not camera-space offsets.
 */
export const SPIDER_QUEEN_FANG_ID="spider-queen-fang-v1" as const;
export const SPIDER_QUEEN_FANG_URL=
 "/characters/unified-heroine-v1/spider-queen-fang-v1-47366a109f16.glb";
const MOUTH_ANCHOR_IN_ROOT=new T.Vector3(0,1.350,-0.104);

export type SpiderQueenFangReport={
 id:typeof SPIDER_QUEEN_FANG_ID;
 status:"UNEQUIPPED"|"LOADING"|"EQUIPPED"|"ERROR";
 meshes:number;
 message:string;
};

type MorphMesh=T.Mesh&{
 morphTargetDictionary:Record<string,number>;
 morphTargetInfluences:number[];
};

export class SpiderQueenFangAccessory {
 private root:T.Group;
 private bone:T.Bone;
 private mount:T.Group;
 private loaded:T.Group|null=null;
 private loading:Promise<T.Group>|null=null;
 private enabled=false;
 private disposed=false;
 private onReport:(data:SpiderQueenFangReport)=>void;
 private faceMorphs:Array<{mesh:MorphMesh,index:number,base:number}>=[];
 private mouthOpen=false;
 private numMeshes=0;

 constructor(root:T.Group,onReport:(data:SpiderQueenFangReport)=>void){
  this.root=root;
  this.onReport=onReport;
  let head:T.Bone|undefined;
  root.traverse(obj=>{if(obj instanceof T.Bone&&obj.name==="J_Bip_C_Head")head=obj});
  if(!head)throw new Error("SpiderQueenFang: canonical head bone not found");
  this.bone=head;

  root.updateWorldMatrix(true,true);
  const desiredWorld=root.localToWorld(MOUTH_ANCHOR_IN_ROOT.clone());
  this.mount=new T.Group();
  this.mount.name="SQ_MouthAnchor_BoneMounted";
  head.add(this.mount);
  this.mount.position.copy(head.worldToLocal(desiredWorld));
  // Model source and head bind axes are parallel on the accepted VRoid rig.
  // The mount inherits the head bone animation and no independent clock.
  root.traverse(obj=>{
   if(!(obj instanceof T.Mesh))return;
   const mesh=obj as MorphMesh;
   const i=mesh.morphTargetDictionary?.A;
   if(i!==undefined&&mesh.morphTargetInfluences){
    this.faceMorphs.push({mesh,index:i,base:mesh.morphTargetInfluences[i]});
   }
  });
  this.report("UNEQUIPPED","Fang accessory available; not yet requested");
 }

 private report(status:SpiderQueenFangReport["status"],message:string){
  if(this.disposed)return;
  this.onReport({id:SPIDER_QUEEN_FANG_ID,status,meshes:this.numMeshes,message});
 }

 private fetchAsset(){
  if(this.loading)return this.loading;
  this.loading=new Promise<T.Group>((resolve,reject)=>{
   new GLTFLoader().load(SPIDER_QUEEN_FANG_URL,
    gltf=>resolve(gltf.scene),
    undefined,reject);
  }).catch(error=>{
   this.loading=null;throw error;
  });
  return this.loading;
 }

 async equip(value:boolean){
  this.enabled=value;
  if(!value){
   if(this.loaded)this.loaded.visible=false;
   this.setMouthOpen(false);
   this.report("UNEQUIPPED","Asset retained in memory; no actor rebuild");
   return;
  }
  if(this.loaded){
   this.loaded.visible=true;
   this.report("EQUIPPED","17 real glTF material/geometry nodes; same head bone");
   return;
  }
  this.report("LOADING","Loading separate Spider Queen Fang GLB once");
  try{
   const asset=await this.fetchAsset();
   if(this.disposed){
    this.disposeAsset(asset);
    return;
   }
   if(!this.loaded){
    this.loaded=asset;
    this.loaded.name="SQ_Fang_MeshAccessory";
    this.mount.add(asset);
    this.numMeshes=0;
    asset.traverse(o=>{if(o instanceof T.Mesh)this.numMeshes++});
   }
   this.loaded.visible=this.enabled;
   this.report(this.enabled?"EQUIPPED":"UNEQUIPPED",
    this.enabled?"3D fang + metal filigree + gemstone, mounted to head bone":"Loaded and cached");
  }catch(e){
   if(!this.disposed)this.report("ERROR","Failed to load fang GLB: "+String(e));
   throw e;
  }
 }

 setMouthOpen(open:boolean){
  this.mouthOpen=open&&this.enabled;
  for(const {mesh,index,base} of this.faceMorphs){
   mesh.morphTargetInfluences[index]=this.mouthOpen?Math.max(base,.18):base;
  }
 }

 diagnostics(){
  return {
   enabled:this.enabled,
   loaded:!!this.loaded,
   meshes:this.numMeshes,
   attachedTo:this.bone.name,
   localAnchor:this.mount.position.toArray(),
   mouthMorphMeshes:this.faceMorphs.length,
   mouthOpen:this.mouthOpen,
  };
 }

 private disposeAsset(root:T.Group){
  root.traverse(o=>{
   if(!(o instanceof T.Mesh))return;
   o.geometry.dispose();
   const materials=Array.isArray(o.material)?o.material:[o.material];
   materials.forEach(m=>m.dispose());
  });
 }

 dispose(){
  if(this.disposed)return;
  this.setMouthOpen(false);
  this.disposed=true;this.enabled=false;
  this.mount.removeFromParent();
  if(this.loaded)this.disposeAsset(this.loaded);
  else this.loading?.then(asset=>this.disposeAsset(asset)).catch(()=>{});
  this.loaded=null;
 }
}

