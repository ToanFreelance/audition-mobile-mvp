import * as THREE from "three";
import sculpt from "./dark-idol-eye-v1-sculpt.json";
import {DarkIdolLashOverlay} from "./DarkIdolLashOverlay";

/**
 * Isolated, runtime-ready proof of modular eyes on the same VRoid SkinnedMesh.
 * Avatar identity, face topology, skeleton and mixer never change.
 */
export const UNIFIED_EYE_ASSETS = [
  {id:"natural", label:"Tự nhiên", color:"#c18c68", description:"Mắt nâu dịu · nguồn VRoid", expression:"neutral"},
  {id:"doll", label:"Búp bê", color:"#c788fd", description:"Tím long lanh · pupil tròn", expression:"surprised"},
  {id:"idol", label:"Thần tượng", color:"#50b8ff", description:"Xanh sapphire · lấp lánh", expression:"joy"},
  {id:"star", label:"Ngôi sao", color:"#d299ff", description:"Tím sáng · sao vàng", expression:"sparkle"},
  {id:"heart", label:"Trái tim", color:"#f983b8", description:"Hồng tím · biểu tượng tim", expression:"joy"},
  {id:"premium-idol", label:"✦ Premium Idol", color:"#e3b6ff", description:"2048px crystalline iris · physical clearcoat", expression:"joy"},
  {id:"dark-idol", label:"✧ Dark Idol Sculpt", color:"#8f4b8b", description:"Blender-sculpt native lashes & eyeline + new iris", expression:"neutral"},
] as const;

export type UnifiedEyeAssetId = (typeof UNIFIED_EYE_ASSETS)[number]["id"];
export const UNIFIED_EYE_ASSET_ROOT="/characters/unified-heroine-v1/eye-pack-v1";

type MorphMesh = THREE.Mesh & {
  morphTargetDictionary: Record<string,number>;
  morphTargetInfluences: number[];
};
type IrisMaterial = THREE.MeshStandardMaterial | THREE.MeshPhysicalMaterial;
type EyeReport = {assetId:UnifiedEyeAssetId,status:string,loaded:number,morphMeshes:number};

const EXPRESSIONS:Record<UnifiedEyeAssetId,{joy:number,surprised:number}>={
 natural:{joy:0,surprised:0},
 doll:{joy:0,surprised:.16},
 idol:{joy:.16,surprised:.05},
 star:{joy:.06,surprised:.08},
 heart:{joy:.20,surprised:0},
 "premium-idol":{joy:.13,surprised:.06},
 "dark-idol":{joy:.04,surprised:0},
};

export class UnifiedEyePack {
 private irisMats:IrisMaterial[]=[];
 private sculptSlots:Array<{position:THREE.BufferAttribute,original:Float32Array,entries:number[][]}>=[];
 private sculptActive=false;
 private darkLashes:DarkIdolLashOverlay;
 private faceSkinSlots:Array<{mesh:THREE.Mesh,index:number,source:THREE.Material,custom:THREE.MeshStandardMaterial}>=[];
 private faceSkinTexture:Promise<THREE.Texture>|null=null;
 private premiumSlots:Array<{mesh:THREE.Mesh,index:number,source:IrisMaterial,physical:THREE.MeshPhysicalMaterial}>=[];

 private originals=new Map<IrisMaterial,{map:THREE.Texture|null,color:THREE.Color}>();
 private faceMorphs:MorphMesh[]=[];
 private originalMorphs=new Map<MorphMesh,Map<string,number>>();
 private cache=new Map<UnifiedEyeAssetId,Promise<THREE.Texture>>();
 private selected:UnifiedEyeAssetId="natural";
 private serial=0;
 private destroyed=false;
 private elapsed=0;
 private blinkTime=-1;
 private blinkAuto=false;
 private onReport:(event:EyeReport)=>void;

 constructor(root:THREE.Group,onReport:(event:EyeReport)=>void){
  this.onReport=onReport;
  this.darkLashes=new DarkIdolLashOverlay(root);
  const mats=new Set<IrisMaterial>();
  root.traverse(o=>{
    if(!(o instanceof THREE.Mesh))return;
    const all=Array.isArray(o.material)?o.material:[o.material];
    for(const [index,material] of all.entries()){
      if(!/EyeIris/i.test(material.name))continue;
      const base=material as IrisMaterial;
      mats.add(base);
      const physical=new THREE.MeshPhysicalMaterial({
        color:base.color.clone(),map:base.map,alphaMap:base.alphaMap,
        opacity:base.opacity,transparent:base.transparent,alphaTest:base.alphaTest,
        side:base.side,depthWrite:base.depthWrite,depthTest:base.depthTest,
        roughness:.21,metalness:0
      });
      physical.name=base.name+"_PremiumIdolV1";
      physical.roughness=.21;
      physical.metalness=0;
      physical.clearcoat=.83;
      physical.clearcoatRoughness=.07;
      physical.iridescence=.22;
      physical.iridescenceIOR=1.38;
      physical.iridescenceThicknessRange=[200,360];
      physical.emissive.set("#38244f");
      physical.emissiveIntensity=.10;
      this.premiumSlots.push({mesh:o,index,source:base,physical});
    }
    if(o instanceof THREE.SkinnedMesh){
      const matching=all.find(m=>/FaceEyelash|FaceEyeline/i.test(m.name));
      const key=matching?.name.includes("FaceEyelash")?"eyelash":matching?.name.includes("FaceEyeline")?"eyeline":null;
      const attribute=o.geometry.getAttribute("position");
      if(key&&attribute instanceof THREE.BufferAttribute&&attribute.count===sculpt.faceVertexCount){
        this.sculptSlots.push({
          position:attribute,
          original:Float32Array.from(attribute.array),
          entries:sculpt.vertices[key] as number[][]
        });
      }
    }
    for(const [index,material] of all.entries()){
      if(!/Face_00_SKIN/.test(material.name) || !(material instanceof THREE.MeshStandardMaterial))continue;
      const custom=material.clone();
      custom.name=material.name+"_DarkIdolMakeup";
      this.faceSkinSlots.push({mesh:o,index,source:material,custom});
    }
    const m=o as MorphMesh;
    if(m.morphTargetDictionary && m.morphTargetInfluences && Object.keys(m.morphTargetDictionary).some(n=>n==="Blink"||n==="Joy")){
      this.faceMorphs.push(m);
      const saved=new Map<string,number>();
      for(const name of ["Joy","Surprised","Blink"]){
        const i=m.morphTargetDictionary[name];
        if(i!==undefined)saved.set(name,m.morphTargetInfluences[i]);
      }
      this.originalMorphs.set(m,saved);
    }
  });
  if(mats.size===0)throw new Error("EyePack: VRoid EyeIris material not found");
  this.irisMats=[...mats];
  for(const m of this.irisMats)this.originals.set(m,{map:m.map,color:m.color.clone()});
  this.report("READY · iris mesh + morph keys");
 }

 private setNativeSculpt(enabled:boolean){
   if(this.sculptActive===enabled)return;
   this.sculptActive=enabled;
   for(const slot of this.sculptSlots){
     const array=slot.position.array as Float32Array;
     array.set(slot.original);
     if(enabled){
       for(const [index,dx,dy,dz] of slot.entries){
         const i=index*3;
         if(i+2>=array.length)continue;
         array[i]+=dx;array[i+1]+=dy;array[i+2]+=dz;
       }
     }
     slot.position.needsUpdate=true;
   }
 }
 private restoreFaceSkin(){
   for(const slot of this.faceSkinSlots){
     if(Array.isArray(slot.mesh.material))slot.mesh.material[slot.index]=slot.source;
     else slot.mesh.material=slot.source;
   }
 }
 private async loadFaceMakeup():Promise<THREE.Texture>{
   if(!this.faceSkinTexture){
     this.faceSkinTexture=new Promise<THREE.Texture>((resolve,reject)=>{
       new THREE.TextureLoader().load(
         UNIFIED_EYE_ASSET_ROOT+"/face-dark-idol-makeup-v1.png",tex=>{
           tex.flipY=false;
           tex.colorSpace=THREE.SRGBColorSpace;
           tex.anisotropy=4;
           tex.needsUpdate=true;
           resolve(tex);
         },undefined,reject);
     }).catch(e=>{this.faceSkinTexture=null;throw e});
   }
   return await this.faceSkinTexture;
 }
 private assignFaceMakeup(tex:THREE.Texture){
   for(const slot of this.faceSkinSlots){
     slot.custom.map=tex;
     slot.custom.needsUpdate=true;
     if(Array.isArray(slot.mesh.material))slot.mesh.material[slot.index]=slot.custom;
     else slot.mesh.material=slot.custom;
   }
 }
 private restoreMaterials(){
   for(const slot of this.premiumSlots){
     if(Array.isArray(slot.mesh.material))slot.mesh.material[slot.index]=slot.source;
     else slot.mesh.material=slot.source;
   }
 }
 private assignPremium(texture:THREE.Texture){
   for(const slot of this.premiumSlots){
     slot.physical.map=texture;
     slot.physical.color.set("#ffffff");
     slot.physical.needsUpdate=true;
     if(Array.isArray(slot.mesh.material))slot.mesh.material[slot.index]=slot.physical;
     else slot.mesh.material=slot.physical;
   }
 }
 private report(status:string){
   if(!this.destroyed)this.onReport({assetId:this.selected,status,loaded:this.cache.size,morphMeshes:this.faceMorphs.length});
 }

 private morph(name:string,value:number){
   for(const m of this.faceMorphs){
     const i=m.morphTargetDictionary[name];
     if(i!==undefined)m.morphTargetInfluences[i]=value;
   }
 }

 private expression(id:UnifiedEyeAssetId){
   const e=EXPRESSIONS[id];
   this.morph("Joy",e.joy);
   this.morph("Surprised",e.surprised);
 }

 private async texture(id:UnifiedEyeAssetId):Promise<THREE.Texture>{
   let result=this.cache.get(id);
   if(result)return result;
   const url=UNIFIED_EYE_ASSET_ROOT+"/eye-"+id+"-v1.png";
   result=new Promise<THREE.Texture>((resolve,reject)=>{
     new THREE.TextureLoader().load(url,tex=>{
       const gltfMap=this.originals.get(this.irisMats[0])?.map;
       tex.flipY=false; // Keep the VRoid glTF atlas UV mapping (both eyes)
       tex.wrapS=gltfMap?.wrapS??THREE.ClampToEdgeWrapping;
       tex.wrapT=gltfMap?.wrapT??THREE.ClampToEdgeWrapping;
       tex.colorSpace=THREE.SRGBColorSpace;
       tex.anisotropy=4;
       tex.needsUpdate=true;
       resolve(tex);
     },undefined,reject);
   });
   this.cache.set(id,result);
   try{return await result}catch(e){this.cache.delete(id);throw e}
 }

 public async select(id:UnifiedEyeAssetId){
   const token=++this.serial;
   this.selected=id;
   this.expression(id);
   this.setNativeSculpt(id==="dark-idol");
   this.darkLashes.setRequested(id==="dark-idol");
   if(id!=="dark-idol")this.restoreFaceSkin();
   if(id!=="premium-idol"&&id!=="dark-idol")this.restoreMaterials();
   if(id==="natural"){
     for(const m of this.irisMats){
       const o=this.originals.get(m)!;
       m.map=o.map;m.color.copy(o.color);m.needsUpdate=true;
     }
     this.report("Natural · original VRoid iris asset");
     return;
   }
   this.report("Loading "+id+" · texture asset");
   try{
     const [tex,faceTex]=await Promise.all([
       this.texture(id),
       id==="dark-idol"?this.loadFaceMakeup():Promise.resolve(null),
       id==="dark-idol"?this.darkLashes.ensureLoaded():Promise.resolve(),
     ]);
     if(this.destroyed||token!==this.serial)return;
     if(faceTex)this.assignFaceMakeup(faceTex);
     if(id==="premium-idol"||id==="dark-idol"){
       for(const slot of this.premiumSlots){
         slot.physical.clearcoat=id==="dark-idol"?.65:.83;
         slot.physical.emissiveIntensity=id==="dark-idol"?.025:.10;
         slot.physical.roughness=id==="dark-idol"?.27:.21;
       }
       this.assignPremium(tex);
       this.report(id==="dark-idol"
         ?"ACTIVE · Dark Idol Blender sculpt + 3D fitted lash morphs + UV makeup + iris · 57 face morphs retained"
         :"ACTIVE · PREMIUM physical iris + clearcoat · 2048×1024");
       return;
     }
     for(const m of this.irisMats){
       m.map=tex;
       m.color.setRGB(1,1,1);
       m.needsUpdate=true;
     }
     this.report("ACTIVE · real iris atlas "+id);
   }catch(error){
     if(this.destroyed||token!==this.serial)return;
     this.report("ASSET ERROR · "+String(error));
     throw error;
   }
 }

 public setAutoBlink(enabled:boolean){this.blinkAuto=enabled}
 public blinkOnce(){this.blinkTime=0}
 public tick(delta:number){
   if(this.destroyed)return;
   if(this.blinkTime>=0){
     this.blinkTime+=delta;
     const p=Math.min(this.blinkTime/.28,1);
     const amount=Math.pow(Math.sin(p*Math.PI),1.2);
     this.morph("Blink",amount);
     if(p>=1){this.blinkTime=-1;this.morph("Blink",0)}
   }else if(this.blinkAuto){
     this.elapsed+=delta;
     if(this.elapsed>=2.7){this.elapsed=0;this.blinkOnce()}
   }
   const primary=this.faceMorphs.find(m=>m.morphTargetDictionary.Blink!==undefined);
   if(primary){
     const lookup=primary.morphTargetDictionary;
     const values=primary.morphTargetInfluences;
     this.darkLashes.syncMorph(values[lookup.Blink]??0,lookup.Joy!==undefined?(values[lookup.Joy]??0):0);
   }
 }
 public getDiagnostics(){
   return {selected:this.selected,darkLashes:this.darkLashes.diagnostics(),faceMakeupSlots:this.faceSkinSlots.length,sculptedVertices:this.sculptSlots.reduce((n,x)=>n+x.entries.length,0),sculptActive:this.sculptActive,irisMaterials:this.irisMats.length,premiumSkinnedMaterialSlots:this.premiumSlots.length,morphMeshes:this.faceMorphs.length,cachedAssets:this.cache.size};
 }
 public dispose(){
   this.destroyed=true;this.serial++;
   this.setNativeSculpt(false);
   this.darkLashes.dispose();
   this.restoreFaceSkin();
   for(const slot of this.faceSkinSlots)slot.custom.dispose();
   this.faceSkinTexture?.then(t=>t.dispose()).catch(()=>{});
   this.restoreMaterials();
   for(const slot of this.premiumSlots)slot.physical.dispose();
   for(const m of this.irisMats){
     const o=this.originals.get(m);
     if(!o)continue;
     m.map=o.map;m.color.copy(o.color);m.needsUpdate=true;
   }
   for(const [mesh,values] of this.originalMorphs){
     for(const [name,value] of values){
       const i=mesh.morphTargetDictionary[name];
       if(i!==undefined)mesh.morphTargetInfluences[i]=value;
     }
   }
   for(const promise of this.cache.values())promise.then(t=>t.dispose()).catch(()=>{});
   this.cache.clear();
 }
}

