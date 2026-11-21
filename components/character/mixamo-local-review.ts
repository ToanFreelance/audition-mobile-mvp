import * as THREE from "three";
import { MIXAMO_BONES, type MixamoGesture } from "./mixamo-lobby-data";

export const LOCAL_REVIEW_IDS = ["cheering","arm-stretching","standing-greeting-2"] as const;
export type LocalReviewId = typeof LOCAL_REVIEW_IDS[number];
type SourceClip = {
  id: LocalReviewId;
  frames: number;
  bones: string[];
  worldDeltaQ16: string;
  rootOffsets: number[];
};
type DecodedClip = Omit<SourceClip,"worldDeltaQ16"> & {samples:Int16Array};

export function decodeReviewPack(text:string):DecodedClip[] {
  if(text.length>2_000_000)throw Error("Gói animation quá lớn");
  const pack=JSON.parse(text);
  if(pack?.schema!=="m3-mixamo-source-delta-v1"||pack.fps!==30||
    !Array.isArray(pack.clips)||(pack.clips.length!==1&&pack.clips.length!==2))throw Error("Gói animation không đúng định dạng");
  const ids=new Set<string>();
  return pack.clips.map((c:SourceClip)=>{
    if(!LOCAL_REVIEW_IDS.includes(c.id)||ids.has(c.id))throw Error("Tên clip không hợp lệ");
    ids.add(c.id);
    if(!Number.isInteger(c.frames)||c.frames<2||c.frames>1800||
      !Array.isArray(c.bones)||c.bones.length!==MIXAMO_BONES.length||
      new Set(c.bones).size!==MIXAMO_BONES.length||
      !MIXAMO_BONES.every(b=>c.bones.includes(b))||
      typeof c.worldDeltaQ16!=="string"||
      !Array.isArray(c.rootOffsets)||c.rootOffsets.length!==3*c.frames||
      !c.rootOffsets.every(v=>Number.isFinite(v)&&Math.abs(v)<=2))
      throw Error("Dữ liệu chuyển động không hợp lệ");
    const raw=atob(c.worldDeltaQ16);
    if(raw.length!==c.frames*c.bones.length*8)throw Error("Thiếu frame animation");
    const bytes=Uint8Array.from(raw,x=>x.charCodeAt(0));
    const dv=new DataView(bytes.buffer);
    const samples=new Int16Array(raw.length/2);
    for(let i=0;i<samples.length;i++)samples[i]=dv.getInt16(i*2,true);
    for(let i=0;i<samples.length;i+=4){
      const norm=Math.hypot(samples[i],samples[i+1],samples[i+2],samples[i+3])/32767;
      if(norm<.99||norm>1.01)throw Error("Quaternion không hợp lệ");
    }
    return {...c,samples};
  });
}
type Rest = {local:THREE.Quaternion;world:THREE.Quaternion};
const boneByName=(rig:THREE.Skeleton,name:string)=>rig.bones.find(b=>
  b.name===name||b.name===THREE.PropertyBinding.sanitizeNodeName(name));

/** Capture the same native target rest transforms used by offline source-delta retargeting.
 * Capture BEFORE the first action. The source pack includes all authored 30 Hz samples.
 * Source world delta * target world rest -> target local (animated parent inverse).
 * No changes to renderer, skin weights, any existing catalog curve, or shared actor transform. */
export function createLocalReviewRetargeter(
  actor:THREE.Object3D, rig:THREE.Skeleton,
  options: {greetingFrameZeroReference?:boolean} = {},
) {
  // IMPORTANT: the actor can arrive here in a M3 preview/idle pose.
  // Capturing that as the Mixamo 'rest' basis turns the source's raised
  // shoulders into crossed/downward arms. Use the actual SKIN BIND pose,
  // not the currently displayed pose, as the retarget coordinate frame.
  // Preserve ALL animated bone transforms and restore them immediately;
  // never reset a live actor/mixer as a side-effect of importing a clip.
  const saved=rig.bones.map(b=>({
    position:b.position.clone(),quaternion:b.quaternion.clone(),scale:b.scale.clone(),
  }));
  const rest=new Map<THREE.Object3D,Rest>();
  const bound=new Map<string,THREE.Bone>();
  const boundHips=new THREE.Vector3();
  let bindHeight=0;
  try {
    actor.updateWorldMatrix(true,true);
    rig.pose();
    actor.updateWorldMatrix(true,true);
    const actorInv=actor.getWorldQuaternion(new THREE.Quaternion()).invert();
    function remember(node:THREE.Object3D|null) {
      if(!node||node===actor||rest.has(node))return;
      remember(node.parent);
      rest.set(node,{local:node.quaternion.clone(),
        world:actorInv.clone().multiply(node.getWorldQuaternion(new THREE.Quaternion())).normalize()});
    }
    for(const name of MIXAMO_BONES){
      const bone=boneByName(rig,name);
      if(bone){bound.set(name,bone);remember(bone);}
    }
    const bindHip=bound.get("hips"),bindFoot=bound.get("foot.L");
    if(bindHip&&bindFoot){
      boundHips.copy(bindHip.position);
      bindHeight=actor.worldToLocal(bindHip.getWorldPosition(new THREE.Vector3()))
        .distanceTo(actor.worldToLocal(bindFoot.getWorldPosition(new THREE.Vector3())));
    }
  } finally {
    rig.bones.forEach((bone,i)=>{
      bone.position.copy(saved[i].position);
      bone.quaternion.copy(saved[i].quaternion);
      bone.scale.copy(saved[i].scale);
    });
    actor.updateWorldMatrix(true,true);
  }
  const hips=bound.get("hips"), foot=bound.get("foot.L");
  if(!hips||!foot)return null;
  const height=bindHeight;
  const hipRest=boundHips;
  if(height<.001||bound.size<20)return null;
  const nameByBone=new Map([...bound].map(([name,b])=>[b as THREE.Object3D,name]));
  const identity=new THREE.Quaternion();
  return (text:string):Array<{id:MixamoGesture;clip:THREE.AnimationClip}>=>{
    const clips=decodeReviewPack(text);
    return clips.map(source=>{
      const n=source.frames, times=Float32Array.from({length:n},(_,i)=>i/30);
      const indices=new Map(source.bones.map((b,i)=>[b,i]));
      // V14: the Mixamo FBX bind skeleton has arms pointing UP, while its
      // first animation frame has the familiar sideways T-pose. The packaged
      // world deltas are relative to FBX BIND, not frame 0. Applying those
      // uncalibrated deltas to M3 bind made Greeting 2 incorrect despite valid
      // source curves. Align the first authored frame to the M3 skin bind,
      // then preserve EVERY relative subsequent source rotation:
      // targetWorld(t) = deltaFBX(t) * inverse(deltaFBX(0)) * targetBindWorld.
      // Only opt in for Greeting; Arm Stretching and existing QA stay intact.
      const zeroInverse=new Map<string,THREE.Quaternion>();
      if(options.greetingFrameZeroReference &&
          source.id==="standing-greeting-2") {
        for (const name of bound.keys()) {
          const index=indices.get(name);
          if(index===undefined)continue;
          zeroInverse.set(name,
            new THREE.Quaternion().fromArray(source.samples,index*4)
              .normalize().invert());
        }
      }
      const values=new Map([...bound].map(([b])=>[b,new Float32Array(n*4)]));
      const root=new Float32Array(n*3);
      for(let frame=0;frame<n;frame++){
        const world=new Map<THREE.Object3D,THREE.Quaternion>();
        for(const [node,base] of rest) {
          const parent=node.parent?world.get(node.parent)??identity:identity;
          const name=nameByBone.get(node);
          const index=name===undefined?undefined:indices.get(name);
          let desired:THREE.Quaternion;
          if(index!==undefined&&name!==undefined){
            const start=(frame*source.bones.length+index)*4;
            desired=new THREE.Quaternion().fromArray(source.samples,start).normalize();
            const zero=zeroInverse.get(name);
            if(zero)desired.multiply(zero).normalize();
            desired.multiply(base.world).normalize();
            const local=parent.clone().invert().multiply(desired).normalize();
            const out=values.get(name)!;
            if(frame>0&&local.dot(new THREE.Quaternion().fromArray(out,(frame-1)*4))<0){
              local.set(-local.x,-local.y,-local.z,-local.w);
            }
            local.toArray(out,frame*4);
          }else desired=parent.clone().multiply(base.local).normalize();
          world.set(node,desired);
        }
        for(let i=0;i<3;i++)root[frame*3+i]=hipRest.getComponent(i)+source.rootOffsets[frame*3+i]*height;
      }
      const tracks:THREE.KeyframeTrack[]=[...bound].map(([name,b])=>
        new THREE.QuaternionKeyframeTrack(b.uuid+".quaternion",times,values.get(name)!));
      tracks.push(new THREE.VectorKeyframeTrack(hips.uuid+".position",times,root));
      return {id:source.id,clip:new THREE.AnimationClip("mixamo-review-local-"+source.id,(n-1)/30,tracks)};
    });
  };
}
