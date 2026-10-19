import * as T from "three";
import type { CanonicalRig, Pose } from "./engine";

export type FlareSource = {
  schemaVersion: number; sha256: string; originalBytes: number;
  asset: { extras: { author: string; license: string; source: string; title: string } };
  inspection: Record<string, number | number[]>;
  nodes: { name: string; parent: number; translation?: number[]; rotation?: number[]; scale?: number[]; matrix?: number[] }[];
  skin: { joints: number[]; inverseBindMatrices: number[] };
  animation: { name: string; duration: number; channels: {node: number; path: string; interpolation: string; times: number[]; values: number[]}[] };
};
export const FLARE_SHA256 = "8b30f4f26d80a0939b5556d12bb1f40b4f69268504bff716efe4060242bc4b4c";
// Explicit anatomical correspondence, including CMU's zero-offset intermediary
// joints. No array-index copying, no Mixamo track is bound to a CMU bone.
const MAP: Record<string,string> = { Hips:"Hips", LowerBack:"Spine", Spine:"Spine1", Spine1:"Spine2", Neck:"Neck", Neck1:"Neck", Head:"Head",
  LeftShoulder:"LeftShoulder", LeftArm:"LeftArm", LeftForeArm:"LeftForeArm", LeftHand:"LeftHand", LeftFingerBase:"LeftHandMiddle1", LeftHandIndex1:"LeftHandIndex1", LThumb:"LeftHandThumb1",
  RightShoulder:"RightShoulder", RightArm:"RightArm", RightForeArm:"RightForeArm", RightHand:"RightHand", RightFingerBase:"RightHandMiddle1", RightHandIndex1:"RightHandIndex1", RThumb:"RightHandThumb1",
  LeftUpLeg:"LeftUpLeg", LeftLeg:"LeftLeg", LeftFoot:"LeftFoot", LeftToeBase:"LeftToeBase", RightUpLeg:"RightUpLeg", RightLeg:"RightLeg", RightFoot:"RightFoot", RightToeBase:"RightToeBase" };
const CHILD: Record<string,string> = {Hips:"Spine",Spine:"Spine1",Spine1:"Spine2",Spine2:"Neck",Neck:"Head",Head:"HeadTop_End",LeftShoulder:"LeftArm",LeftArm:"LeftForeArm",LeftForeArm:"LeftHand",LeftHand:"LeftHandMiddle1",LeftUpLeg:"LeftLeg",LeftLeg:"LeftFoot",LeftFoot:"LeftToeBase",LeftToeBase:"LeftToe_End",RightShoulder:"RightArm",RightArm:"RightForeArm",RightForeArm:"RightHand",RightHand:"RightHandMiddle1",RightUpLeg:"RightLeg",RightLeg:"RightFoot",RightFoot:"RightToeBase",RightToeBase:"RightToe_End"};
const shortName=(s:string)=>s.replace(/^mixamorig:/,'').replace(/_0\d+$/,'');

/** Owner GLB has two cancelling scene-axis nodes, a Z-up inverse bind, and
 * Y-up animated joint positions. Sample actual animated world transforms;
 * never apply an extra -90deg conversion to an already Y-up animation. */
export class FlareRetarget {
  readonly sourceBones: T.Object3D[];
  readonly root = new T.Group();
  readonly scale: number;
  readonly duration: number;
  readonly mapping = MAP;
  readonly diagnostics;
  private readonly tracks;
  private readonly sourceNames: Map<string,T.Object3D>;
  private readonly target: T.Bone;
  private readonly bones: T.Bone[] = [];
  private readonly alignments: (T.Quaternion | null)[];
  private readonly inverseBind;
  private readonly handAnchors=new Map<string,T.Vector3>();
  maxHandReachError=0;
  constructor(readonly source: FlareSource, readonly rig: CanonicalRig) {
    if(source.sha256!==FLARE_SHA256||source.animation.duration!==1||source.skin.joints.length!==58)throw Error('Flare source identity/structure mismatch');
    this.duration=source.animation.duration;
    this.sourceBones=source.nodes.map(n=>{const b=new T.Object3D();b.name=n.name;if(n.matrix)new T.Matrix4().fromArray(n.matrix).decompose(b.position,b.quaternion,b.scale);else{if(n.translation)b.position.fromArray(n.translation);if(n.rotation)b.quaternion.fromArray(n.rotation);if(n.scale)b.scale.fromArray(n.scale);}return b;});
    source.nodes.forEach((n,i)=>(n.parent<0?this.root:this.sourceBones[n.parent]).add(this.sourceBones[i]));
    this.sourceNames=new Map(this.sourceBones.map(b=>[shortName(b.name),b]));
    this.tracks=source.animation.channels.map(c=>({node:this.sourceBones[c.node],path:c.path,sampler:c.path==='rotation'?new T.QuaternionLinearInterpolant(new Float32Array(c.times),new Float32Array(c.values),4):new T.LinearInterpolant(new Float32Array(c.times),new Float32Array(c.values),3)}));
    this.target=rig.root.clone(true);this.target.traverse(o=>{if((o as T.Bone).isBone)this.bones.push(o as T.Bone);});
    this.target.position.set(0,0,0);this.bones.forEach(b=>b.quaternion.identity());this.target.updateMatrixWorld(true);
    // Limb ratio, not mesh bbox: retain the canonical body's accepted scale.
    const length=(name:string)=>this.sourceNames.get(name)!.position.length();
    const sourceLeg=length('LeftLeg')+length('LeftFoot');
    const targetLeg=['LeftLeg','LeftFoot'].reduce((s,n)=>s+this.bones.find(b=>b.name===n)!.position.length(),0);
    this.scale=targetLeg/sourceLeg;
    this.alignments=this.bones.map(b=>{
      const mapped=MAP[b.name], child=mapped&&CHILD[mapped];
      if(!mapped||!child||b.name==='Hips')return null;
      const targetChild=b.children.find(o=>(o as T.Bone).isBone&&o.position.length()>.001) as T.Bone|undefined;
      const sourceChild=this.sourceNames.get(child);
      return targetChild&&sourceChild?new T.Quaternion().setFromUnitVectors(targetChild.position.clone().normalize(),sourceChild.position.clone().normalize()):null;
    });
    this.inverseBind=source.skin.joints.map((_,i)=>new T.Matrix4().fromArray(source.skin.inverseBindMatrices,i*16));
    for(const side of ['Left','Right']){
      const anchor=new T.Vector3();let count=0;
      for(let i=0;i<120;i++){
        this.sampleSource(i/120);
        const palm=Math.min(...[...this.sourceNames].filter(([n])=>n.startsWith(side+'Hand')).map(([,b])=>b.getWorldPosition(new T.Vector3()).y*this.scale));
        if(palm<.025){anchor.add(this.sourceNames.get(side+'Hand')!.getWorldPosition(new T.Vector3()).multiplyScalar(this.scale));count++;}
      }
      if(!count)throw Error('Flare source missing supporting hand');anchor.divideScalar(count);this.handAnchors.set(side,anchor);
    }
    this.sampleSource(0);
    const entry=this.sourceNames.get('Hips')!.getWorldPosition(new T.Vector3());
    const hipsIndex=source.nodes.findIndex(n=>shortName(n.name)==='Hips'),bind=this.sourceBindMatrix(source.skin.joints.indexOf(hipsIndex)),bindQ=new T.Quaternion();bind.decompose(new T.Vector3(),bindQ,new T.Vector3());
    const residual=new T.Quaternion().setFromAxisAngle(new T.Vector3(1,0,0),-Math.PI/2).multiply(bindQ);
    const bindCalibrationRootResidualDeg=T.MathUtils.radToDeg(residual.angleTo(new T.Quaternion()));
    if(bindCalibrationRootResidualDeg>.01)throw Error('Unexpected bind forward/up calibration');
    this.diagnostics={sourceSha256:source.sha256,sourceRig:'Mixamo 58 joints → named CMU segment-direction/world-frame adaptation',sourceUp:'animated +Y; inverse-bind +Z',canonicalUp:'+Y',canonicalForward:'+Z',bindCalibrationRootResidualDeg,scale:this.scale,entrySource:entry.toArray(),mapping:MAP,unmappedCanonical:rig.names.filter(n=>!MAP[n]),meshRetargetValidated:false};
  }
  sampleSource(time:number) {
    for(const t of this.tracks){const a=t.sampler.evaluate(T.MathUtils.clamp(time,0,this.duration));if(t.path==='rotation')t.node.quaternion.fromArray(a).normalize();else if(t.path==='translation')t.node.position.fromArray(a);else throw Error('Unsupported source channel');}
    this.root.updateMatrixWorld(true);
    return this.sourceNames;
  }
  sample(time:number):Pose {
    this.sampleSource(time);
    const src=this.sourceNames;
    this.target.position.set(0,0,0);this.bones.forEach(b=>b.quaternion.identity());this.target.updateMatrixWorld(true);
    for(let i=0;i<this.bones.length;i++){
      const bone=this.bones[i], source=src.get(MAP[bone.name]);if(!source)continue;
      // World frames retain source rotation/twist; a fixed axis calibration
      // maps each canonical segment's actual oblique offset to source +Y.
      const world=source.getWorldQuaternion(new T.Quaternion());
      if(this.alignments[i])world.multiply(this.alignments[i]!);
      const parent=bone.parent?.getWorldQuaternion(new T.Quaternion())??new T.Quaternion();
      bone.quaternion.copy(parent.invert().multiply(world)).normalize();this.target.updateMatrixWorld(true);
    }
    const root=src.get('Hips')!.getWorldPosition(new T.Vector3()).multiplyScalar(this.scale);
    this.target.position.copy(root);this.target.updateMatrixWorld(true);
    // Preserve the support phase from actual source finger/palm heights. CMU
    // shoulder proportions differ, so directional retarget alone skates hands.
    // A damped arm solve stabilizes each supporting palm at its source contact
    // centroid; the unaltered hip path and circular leg sweep remain authored.
    for(const side of ['Left','Right']){
      const sourcePalm=Math.min(...[...src].filter(([n])=>n.startsWith(side+'Hand')).map(([,b])=>b.getWorldPosition(new T.Vector3()).y*this.scale));
      const x=T.MathUtils.clamp((sourcePalm-.015)/.10,0,1),weight=1-x*x*(3-2*x);if(weight<=0)continue;
      const upper=this.bones.find(b=>b.name===side+'Arm')!,lower=this.bones.find(b=>b.name===side+'ForeArm')!,hand=this.bones.find(b=>b.name===side+'Hand')!;
      const wrist=hand.getWorldPosition(new T.Vector3()),pad:T.Vector3[]=[];hand.traverse(o=>pad.push(o.getWorldPosition(new T.Vector3())));
      const target=this.handAnchors.get(side)!.clone();target.y=wrist.y-Math.min(...pad.map(p=>p.y))+.004;target.lerp(wrist,1-weight);
      const handQ=hand.getWorldQuaternion(new T.Quaternion());
      // Damped CCD starts from the authored arm on EVERY source sample. This
      // follows its existing elbow branch instead of choosing a new pole at a
      // straight-arm singularity. Small bounded swings preserve the source twist.
      for(let iteration=0;iteration<10;iteration++)for(const bone of [lower,upper]){
        const pivot=bone.getWorldPosition(new T.Vector3()),from=hand.getWorldPosition(new T.Vector3()).sub(pivot),to=target.clone().sub(pivot);
        if(from.lengthSq()<1e-10||to.lengthSq()<1e-10)continue;
        const delta=new T.Quaternion().setFromUnitVectors(from.normalize(),to.normalize());
        const angle=2*Math.acos(T.MathUtils.clamp(Math.abs(delta.w),0,1));
        if(angle>.18)delta.slerp(new T.Quaternion(),1-.18/angle);
        const world=delta.multiply(bone.getWorldQuaternion(new T.Quaternion()));
        bone.quaternion.copy((bone.parent?.getWorldQuaternion(new T.Quaternion())??new T.Quaternion()).invert().multiply(world));
        this.target.updateMatrixWorld(true);
      }
      hand.quaternion.copy((hand.parent?.getWorldQuaternion(new T.Quaternion())??new T.Quaternion()).invert().multiply(handQ));this.target.updateMatrixWorld(true);
      if(weight>.95)this.maxHandReachError=Math.max(this.maxHandReachError,hand.getWorldPosition(new T.Vector3()).distanceTo(target));
    }
    // Floor is determined from hands/toes as well as feet. No XZ cancellation.
    const min=Math.min(...this.bones.map(b=>b.getWorldPosition(new T.Vector3()).y));root.y-=min;
    return {root,rotations:this.bones.map(b=>b.quaternion.clone())};
  }
  sourceBindMatrix(joint:number) { return this.inverseBind[joint].clone().invert(); }
}
