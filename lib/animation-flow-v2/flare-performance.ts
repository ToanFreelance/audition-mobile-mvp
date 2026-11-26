import * as T from "three";
import { type PhraseSpec } from "./catalog";
import { rootYaw, type Pose, type PreparedPhrase, type SourceFlowEngine } from "./engine";
import { wrapAngle } from "./heading";
import { FlareRetarget, type FlareSource } from "./flare-source";

export const FLARE_SPEC: PhraseSpec = {id:"finish-flare",source:"kabal-flair-owner-glb",label:"FINISH · Flare liên hoàn (thử nghiệm)",group:"finish-power-flare",start:0,end:1,policy:"PROTECTED",exitMarkers:[1],protectedRanges:[[0,1]],referenceBpm:120,tempoBasis:"testing-assumption",role:"finish"};
export const FLARE_RISE_SPEC: PhraseSpec = {id:"flare-rise-source",source:"85_03",label:"Nguồn crouch → đứng dậy cho Flare",group:"flare-dismount",start:18,end:18.7,policy:"PROTECTED",exitMarkers:[.7],protectedRanges:[[0,.7]],referenceBpm:120,tempoBasis:"testing-assumption",role:"recovery"};
const Y=new T.Vector3(0,1,0), ease=(t:number)=>{const x=T.MathUtils.clamp(t,0,1);return x*x*(3-2*x);};
const copy=(p:Pose):Pose=>({root:p.root.clone(),rotations:p.rotations.map(q=>q.clone())});
const blend=(a:Pose,b:Pose,t:number):Pose=>({root:a.root.clone().lerp(b.root,t),rotations:a.rotations.map((q,i)=>q.clone().slerp(b.rotations[i],t))});
const sample=(p:PreparedPhrase,t:number):Pose=>({root:new T.Vector3().fromArray(p.translation.evaluate(t)),rotations:p.rotations.map(s=>new T.Quaternion().fromArray(s.evaluate(t)))});
const sampler=(t:T.KeyframeTrack)=>(t as T.KeyframeTrack & {createInterpolant():{evaluate(t:number):ArrayLike<number>}}).createInterpolant();
export type FlarePlan={kind:"flare";yaw:number;requestedBeat:number;visualStartBeat:number;resumeBeat:number;entrySeconds:number;loopSeconds:number;dismountSeconds:number;readySeconds:number;loopCount:number;playbackRate:number;phaseOffset:number;entryEndBeat:number;loopEndBeat:number;readyBeat:number;sourceSha256:string;seam:Record<string,number>;setupStepLocalXZ:number[];bodyEnvelopeRadius:number;maxBridgeTargetError:number;minimumFloorY:number};

/** A single immutable cyclic source sampler. Periodic Catmull tangents close
 * both pose and velocity, without flattening the essential leg sweep. The raw
 * source has a tiny endpoint error; it is measured before this correction. */
export class FlareLibrary {
  readonly retarget:FlareRetarget;
  readonly frames:Pose[]=[];
  readonly seam:Record<string,number>;
  constructor(source:FlareSource,readonly engine:SourceFlowEngine,readonly rise:PreparedPhrase){
    this.retarget=new FlareRetarget(source,engine.rig);
    for(let i=0;i<120;i++)this.frames.push(this.retarget.sample(i/120));
    // Only the small contact correction on arms is cyclically filtered (67ms).
    // A source arm going nearly straight makes per-sample IK ill-conditioned.
    // Legs, hips, source phase and authored root travel are never filtered here.
    const original=this.frames.map(copy),armIndices=engine.rig.names.map((name,i)=>/^(Left|Right)(Arm|ForeArm|Hand)$/.test(name)?i:-1).filter(i=>i>=0);
    for(let i=0;i<120;i++)for(const j of armIndices){
      let total=0;const q=new T.Quaternion();
      for(let k=-4;k<=4;k++){const weight=Math.exp(-k*k/8),v=original[(i+k+120)%120].rotations[j];if(!total)q.copy(v);else q.slerp(v,weight/(total+weight));total+=weight;}
      this.frames[i].rotations[j].copy(q).normalize();
    }
    const a=this.retarget.sample(0),b=this.retarget.sample(1);
    const points=(p:Pose)=>{const root=engine.rig.root.clone(true),bones:T.Bone[]=[];root.traverse(o=>{if((o as T.Bone).isBone)bones.push(o as T.Bone);});root.position.copy(p.root);bones.forEach((bone,i)=>bone.quaternion.copy(p.rotations[i]));root.updateMatrixWorld(true);return bones.map(bone=>bone.getWorldPosition(new T.Vector3()));};
    const pa=points(a),pb=points(b),named=(name:string)=>pa[engine.rig.names.indexOf(name)].distanceTo(pb[engine.rig.names.indexOf(name)]);
    this.seam={rawRootTranslation:a.root.distanceTo(b.root),rawRootQuaternionDeg:T.MathUtils.radToDeg(a.rotations[0].angleTo(b.rotations[0])),rawMaxJointQuaternionDeg:Math.max(...a.rotations.map((q,i)=>T.MathUtils.radToDeg(q.angleTo(b.rotations[i])))),rawLeftWrist:named('LeftHand'),rawRightWrist:named('RightHand'),rawLeftFoot:named('LeftFoot'),rawRightFoot:named('RightFoot'),rawLeftToe:named('LeftToeBase'),rawRightToe:named('RightToeBase'),closedPoseError:0,armFilterWindowSeconds:8/120,maxSupportReachError:this.retarget.maxHandReachError};
  }
  cycle(time:number):Pose {
    const n=this.frames.length,phase=((time%1)+1)%1*n,i=Math.floor(phase),t=phase-i;
    const p=[-1,0,1,2].map(k=>this.frames[(i+k+n)%n]);
    const cubic=(a:number,b:number,c:number,d:number)=>.5*((2*b)+(-a+c)*t+(2*a-5*b+4*c-d)*t*t+(-a+3*b-3*c+d)*t*t*t);
    const root=new T.Vector3(...[0,1,2].map(k=>cubic(p[0].root.getComponent(k),p[1].root.getComponent(k),p[2].root.getComponent(k),p[3].root.getComponent(k))) as [number,number,number]);
    const rotations=p[1].rotations.map((q,j)=>{
      const v=p.map(f=>{const a=f.rotations[j].clone();return a.dot(q)<0?a.set(-a.x,-a.y,-a.z,-a.w):a;});
      return new T.Quaternion(...[0,1,2,3].map(k=>cubic(v[0].toArray()[k],v[1].toArray()[k],v[2].toArray()[k],v[3].toArray()[k])) as [number,number,number,number]).normalize();
    });return {root,rotations};
  }
  /** Build once per Finish, from the currently displayed safe-exit pose.
   * The resulting one-shot contains cyclic source sampling, not mixer restarts. */
  prepare(before:Pose,requestedBeat:number,visualStartBeat:number,resumeBeat:number,bpm:number):PreparedPhrase|null {
    const available=(resumeBeat-visualStartBeat)*60/bpm;
    // Reserve one *musical beat* for visible standing/weight-shift idle before L6.
    // At 180–200 BPM scale only the authored entry/dismount timings modestly:
    // this preserves natural loop rate rather than dropping Flare entirely.
    const tempoScale=Math.min(1,160/bpm);
    const entrySeconds=1.85*tempoScale,dismountSeconds=1.4*tempoScale,readySeconds=60/bpm;
    const loopSeconds=available-entrySeconds-dismountSeconds-readySeconds;
    const loopCount=Math.round(loopSeconds),playbackRate=loopCount/loopSeconds;
    if(loopCount<2||playbackRate<.85||playbackRate>1.15)return null;
    const yaw=rootYaw(before.rotations[0]),inv=new T.Quaternion().setFromAxisAngle(Y,-yaw);
    const origin=before.root.clone(),localBefore=copy(before);localBefore.root.set(0,before.root.y,0);localBefore.rotations[0].premultiply(inv);
    // Normalized CMU get-up, reversed for the crouch entry. Authored XZ motion
    // is retained on descent/ascent, rather than rooting the hips in place.
    const riseYaw=rootYaw(new T.Quaternion().fromArray(this.rise.rotations[0].evaluate(this.rise.duration))),riseCalibration=new T.Quaternion().setFromAxisAngle(Y,-riseYaw);
    const authoredRise=(t:number)=>{const p=sample(this.rise,t);p.root.applyQuaternion(riseCalibration);p.rotations[0].premultiply(riseCalibration);return p;};
    const stand=authoredRise(this.rise.duration),low=authoredRise(0);
    const standShift=new T.Vector3(-stand.root.x,0,-stand.root.z);
    // Explicit short setup step before going low, not per-frame XZ clamping or
    // cancellation of the Flare trajectory. Feet lift and move in two phases.
    const r=Math.hypot(origin.x,origin.z),step=new T.Vector3(-origin.x,0,-origin.z).normalize().multiplyScalar(Math.min(.5,Math.max(0,r-.3))).applyQuaternion(inv);
    standShift.add(step);
    const rise=(t:number)=>{const p=authoredRise(t);p.root.add(standShift);return p;};
    const phaseOffset=.7,loopEntry=this.cycle(phaseOffset),loopShift=low.root.clone().add(standShift).sub(loopEntry.root);loopShift.y=0;
    const flare=(t:number)=>{const p=this.cycle(phaseOffset+t);p.root.add(loopShift);return p;};
    const scratch=this.engine.rig.root.clone(true),bones:T.Bone[]=[];scratch.traverse(o=>{if((o as T.Bone).isBone)bones.push(o as T.Bone);});
    const get=(name:string)=>bones[this.engine.rig.names.indexOf(name)];
    const apply=(p:Pose)=>{scratch.position.copy(p.root);bones.forEach((b,i)=>b.quaternion.copy(p.rotations[i]));scratch.updateMatrixWorld(true);};
    const points=(p:Pose)=>{apply(p);return bones.map(b=>b.getWorldPosition(new T.Vector3()));};
    let maxBridgeTargetError=0,minimumFloorY=Infinity,bodyEnvelopeRadius=0;
    function setWorld(b:T.Bone,q:T.Quaternion){b.quaternion.copy((b.parent?.getWorldQuaternion(new T.Quaternion())??new T.Quaternion()).invert().multiply(q));scratch.updateMatrixWorld(true);}
    // Narrow contact-aware two-bone solve on this same CMU rig. Segment lengths
    // stay rigid, the existing bend plane is preserved, and endpoints step/lift
    // instead of being dragged blindly by an upright-to-floor slerp.
    const solve=(upperName:string,lowerName:string,endName:string,target:T.Vector3)=>{
      const upper=get(upperName),lower=get(lowerName),end=get(endName),a=upper.getWorldPosition(new T.Vector3()),b=lower.getWorldPosition(new T.Vector3());
      const endQ=end.getWorldQuaternion(new T.Quaternion()),l1=lower.position.length(),l2=end.position.length(),dir=target.clone().sub(a),d=T.MathUtils.clamp(dir.length(),Math.abs(l1-l2)+.001,l1+l2-.001);dir.normalize();
      const pole=b.clone().sub(a).addScaledVector(dir,-b.clone().sub(a).dot(dir));if(pole.lengthSq()<1e-8)pole.set(0,0,1).addScaledVector(dir,-dir.z);pole.normalize();
      const along=(l1*l1-l2*l2+d*d)/(2*d),mid=a.clone().addScaledVector(dir,along).addScaledVector(pole,Math.sqrt(Math.max(0,l1*l1-along*along)));
      setWorld(upper,new T.Quaternion().setFromUnitVectors(b.clone().sub(a).normalize(),mid.clone().sub(a).normalize()).multiply(upper.getWorldQuaternion(new T.Quaternion())));
      const knee=lower.getWorldPosition(new T.Vector3());setWorld(lower,new T.Quaternion().setFromUnitVectors(end.getWorldPosition(new T.Vector3()).sub(knee).normalize(),target.clone().sub(knee).normalize()).multiply(lower.getWorldQuaternion(new T.Quaternion())));setWorld(end,endQ);
      maxBridgeTargetError=Math.max(maxBridgeTargetError,end.getWorldPosition(new T.Vector3()).distanceTo(target));
    };
    const bridge=(a:Pose,b:Pose,t:number,standing=false)=>{
      if(t<=0)return copy(a);if(t>=1)return copy(b);
      const pa=points(a),pb=points(b),w=ease(t),p=blend(a,b,w);apply(p);
      const feetTargets=['Left','Right'].map(side=>{
        const i=this.engine.rig.names.indexOf(side+'Foot'),phase=standing?T.MathUtils.clamp(t*2-(side==='Right'?1:0),0,1):t,target=pa[i].clone().lerp(pb[i],ease(phase));
        const travel=Math.hypot(pa[i].x-pb[i].x,pa[i].z-pb[i].z);
        if(travel>.06)target.y+=.10*Math.sin(Math.PI*phase);
        return target;
      });
      // Transfer pelvis weight before lifting the second foot; an advancing
      // pelvis must not pull the still-planted leg through straight/hyperextended
      // IK. This is a Y reach correction, never an XZ clamp.
      if(standing){
        const initialY=p.root.y;
        for(let i=0;i<2;i++){
          const side=i?'Right':'Left',hip=get(side+'UpLeg').getWorldPosition(new T.Vector3()),target=feetTargets[i],reach=.98*(get(side+'Leg').position.length()+get(side+'Foot').position.length());
          const horizontal=Math.hypot(target.x-hip.x,target.z-hip.z);
          p.root.y=Math.min(p.root.y,target.y+Math.sqrt(Math.max(.01,reach*reach-horizontal*horizontal))-(hip.y-initialY));
        }
        apply(p);
      }
      ['Left','Right'].forEach((side,i)=>solve(side+'UpLeg',side+'Leg',side+'Foot',feetTargets[i]));
      if(!standing)for(const side of ['Left','Right']){
        const i=this.engine.rig.names.indexOf(side+'Hand'),target=pa[i].clone().lerp(pb[i],w);
        solve(side+'Arm',side+'ForeArm',side+'Hand',target);
      }
      return {root:p.root,rotations:bones.map(b=>b.quaternion.clone())};
    };
    const total=available,frames=Math.ceil(total*120),times:number[]=[],roots:number[]=[],values=this.engine.rig.names.map(()=>[] as number[]),path:T.Vector3[]=[],headings:number[]=[];
    const lowPose=rise(0),standing=rise(this.rise.duration),floorPose=flare(0);
    const idle=this.engine.phrases.get("rest-standing");
    const idleStart=idle?sample(idle,0):null;
    const idleYaw=idleStart?rootYaw(standing.rotations[0])-rootYaw(idleStart.rotations[0]):0;
    const idleYawQ=new T.Quaternion().setFromAxisAngle(Y,idleYaw);
    const livingIdle=(seconds:number):Pose=>{
      if(!idle||!idleStart)return copy(standing);
      const p=sample(idle,seconds%idle.duration);
      p.root.sub(idleStart.root).applyQuaternion(idleYawQ).add(standing.root);
      p.rotations[0].premultiply(idleYawQ);
      return blend(standing,p,ease(seconds/Math.min(.16,readySeconds*.5)));
    };
    for(let f=0;f<=frames;f++){
      const t=f===frames?total:f/120;let p:Pose;
      const entryT=t/tempoScale, dismountT=(t-entrySeconds-loopSeconds)/tempoScale;
      if(t<entrySeconds&&entryT<.75)p=bridge(localBefore,standing,entryT/.75,true);
      else if(t<entrySeconds&&entryT<1.45)p=rise(this.rise.duration*(1-(entryT-.75)/.7));
      else if(t<entrySeconds)p=bridge(lowPose,floorPose,(entryT-1.45)/.4);
      else if(t<entrySeconds+loopSeconds)p=flare((t-entrySeconds)*playbackRate);
      else if(dismountT<.5)p=bridge(floorPose,lowPose,dismountT/.5);
      else if(dismountT<1.2)p=rise(this.rise.duration*(dismountT-.5)/.7);
      else p=livingIdle(Math.max(0,t-entrySeconds-loopSeconds-1.2*tempoScale));
      apply(p);const min=Math.min(...bones.map(b=>b.getWorldPosition(new T.Vector3()).y));p.root.y-=Math.min(0,min);apply(p);
      minimumFloorY=Math.min(minimumFloorY,...bones.map(b=>b.getWorldPosition(new T.Vector3()).y));
      for(const b of bones){const v=b.getWorldPosition(new T.Vector3()).applyAxisAngle(Y,yaw).add(new T.Vector3(origin.x,0,origin.z));bodyEnvelopeRadius=Math.max(bodyEnvelopeRadius,Math.hypot(v.x,v.z));}
      times.push(t);roots.push(...p.root.toArray());path.push(p.root.clone());
      p.rotations.forEach((q,i)=>{if(f&&new T.Quaternion().fromArray(values[i],values[i].length-4).dot(q)<0)q.set(-q.x,-q.y,-q.z,-q.w);values[i].push(...q.toArray());});
      const h=rootYaw(p.rotations[0]);headings.push(f?headings[f-1]+wrapAngle(h-headings[f-1]):h);
    }
    const plan:FlarePlan={kind:'flare',yaw,requestedBeat,visualStartBeat,resumeBeat,entrySeconds,loopSeconds,dismountSeconds,readySeconds,loopCount,playbackRate,phaseOffset,entryEndBeat:visualStartBeat+entrySeconds*bpm/60,loopEndBeat:resumeBeat-(dismountSeconds+readySeconds)*bpm/60,readyBeat:resumeBeat-readySeconds*bpm/60,sourceSha256:this.retarget.source.sha256,seam:this.seam,setupStepLocalXZ:[step.x,step.z],bodyEnvelopeRadius,maxBridgeTargetError,minimumFloorY};
    const tracks:T.KeyframeTrack[]=[new T.VectorKeyframeTrack('motionRoot.position',times,roots),...this.engine.rig.names.map((n,i)=>new T.QuaternionKeyframeTrack(n+'.quaternion',times,values[i]))];
    return {spec:{...FLARE_SPEC,end:total,referenceBpm:bpm,exitMarkers:[total],protectedRanges:[[0,total]]},duration:total,clip:new T.AnimationClip(FLARE_SPEC.id,total,tracks),translation:sampler(tracks[0]),rotations:tracks.slice(1).map(sampler),sourceScale:this.retarget.scale,floorReference:0,path,headings,flare:plan};
  }
}
