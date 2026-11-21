import * as THREE from "three";

/**
 * V7, QA-only: author a small shared pelvis X/Z adjustment for detected
 * planted-foot intervals across the Mixamo clip catalog. This is an offline
 * 30 FPS bake; there is NO runtime IK, ankle lock or actor translation.
 * Contact is inferred from ankle+toe joints (shoe-sole proxy, not mesh rays).
 */
export type ClipContactV7 = {
  clip: string;
  segments: number;
  supportFrames: number;
  rawTravelCm: number;
  correctedTravelCm: number;
  maxPelvisCm: number;
  maxJumpCm: number;
  applied: boolean;
  reason: string;
};
export type ContactBakeV7 = { clip: THREE.AnimationClip; report: ClipContactV7 };
type ContactFoot = {sole: THREE.Vector3; ankle: THREE.Vector3; toe: THREE.Vector3};
type Frame = readonly [ContactFoot, ContactFoot];
type Span = {side: 0 | 1; from: number; to: number; anchor: THREE.Vector3};
type Plan = {offsets: Float32Array; spans: Span[]; frames: Frame[]; before: number; after: number; max: number; jump: number; reason: string};
const FPS=30;
const MAX_PELVIS=0.018;
const MAX_FRAME_JUMP=0.006;
// Share only numeric plans across M3 actors of matching rig family/rest
// dimensions, never skeleton-bound AnimationClip tracks or Bone references.
const plans=new Map<string, Omit<Plan,"frames"|"spans"> & {segments: number; supportFrames: number}>();
const tmp=()=>new THREE.Vector3();
const smooth=(t:number)=>{const x=THREE.MathUtils.clamp(t,0,1);return x*x*(3-2*x);};
const travel=(a:THREE.Vector3,b:THREE.Vector3)=>Math.hypot(a.x-b.x,a.z-b.z);
function q12(values:number[]) {
  const sorted=[...values].sort((a,b)=>a-b);
  return sorted[Math.floor((sorted.length-1)*0.12)];
}
function bone(rig:THREE.Skeleton,name:string) {
  const safe=THREE.PropertyBinding.sanitizeNodeName(name);
  return rig.bones.find(b=>b.name===name||b.name===safe);
}
function getPair(actor:THREE.Object3D,feet:readonly (readonly THREE.Bone[])[]):Frame {
  const sample=(leg:readonly THREE.Bone[]):ContactFoot=>{
    const ankle=actor.worldToLocal(leg[0].getWorldPosition(tmp()));
    const toe=actor.worldToLocal(leg[1].getWorldPosition(tmp()));
    // Mid-sole proxy: includes toe pitch that the old ankle-only tracking missed.
    return {sole:ankle.clone().lerp(toe,0.64),ankle,toe};
  };
  return [sample(feet[0]),sample(feet[1])];
}
function contactSpans(frames:Frame[]):Span[] {
  const spans:Span[]=[];
  for(let s=0 as 0|1;s<2;s=(s+1) as 0|1){
    const floor=q12(frames.map(f=>f[s].sole.y));
    const toeFloor=q12(frames.map(f=>f[s].toe.y));
    const low=frames.map((f,i)=>{
      if(i<2||i>=frames.length-2)return false;
      const p=f[s];
      const dv=Math.abs(frames[i+1][s].sole.y-frames[i-1][s].sole.y);
      return p.sole.y-floor<=0.019 && p.toe.y-toeFloor<=0.027 && dv<=0.012;
    });
    // Bridge a one-frame tracking gap, never a lifted swing/step.
    for(let i=1;i<low.length-1;i++)
      if(!low[i]&&low[i-1]&&low[i+1]) low[i]=true;
    let from=-1;
    for(let i=0;i<=low.length;i++){
      const on=i<low.length&&low[i];
      if(on && from<0)from=i;
      if(!on && from>=0){
        const to=i-1;
        // A contact must be able to release into airborne frames; otherwise
        // an offset would snap at clip end and cannot be safely baked.
        if(to-from>=7 && to<frames.length-9){
          const sample=frames.slice(from,Math.min(to+1,from+3))
            .map(x=>x[s].sole);
          const anchor=sample.reduce((sum,v)=>sum.add(v),tmp()).divideScalar(sample.length);
          spans.push({side:s,from,to,anchor});
        }
        from=-1;
      }
    }
  }
  return spans;
}
function contactTravel(frames:Frame[],spans:Span[],dx?:Float32Array) {
  let sum=0;
  for(const span of spans){
    for(let f=span.from+1;f<=span.to;f++){
      const a=frames[f-1][span.side].sole;
      const b=frames[f][span.side].sole;
      const ax=dx?dx[(f-1)*2]:0,az=dx?dx[(f-1)*2+1]:0;
      const bx=dx?dx[f*2]:0,bz=dx?dx[f*2+1]:0;
      sum+=Math.hypot(b.x+bx-a.x-ax,b.z+bz-a.z-az);
    }
  }
  return sum;
}
export function planFootContactV7(frames:Frame[]):Plan {
  const n=frames.length;
  const zero=new Float32Array(n*2);
  const empty=(reason:string):Plan=>({frames,spans:[],offsets:zero,before:0,after:0,max:0,jump:0,reason});
  if(n<24) return empty("short_clip");
  const spans=contactSpans(frames);
  if(!spans.length)return empty("no_stable_contact");
  const raw=new Float32Array(n*2);
  const weights=new Float32Array(n);
  for(const span of spans){
    for(let f=span.from;f<=span.to;f++){
      const p=frames[f][span.side].sole;
      // Hold the planted contact for its FULL interval. Tapering back to zero
      // before liftoff created a second, artificial shoe slide in V7 draft.
      const diff=span.anchor.clone().sub(p);
      diff.y=0;
      diff.clampLength(0,MAX_PELVIS);
      raw[f*2]+=diff.x;
      raw[f*2+1]+=diff.z;
      weights[f]+=1;
    }
    // Release the compensating pelvis shift only AFTER the foot has lifted.
    // The source's swing/gesture is left intact, including its knee and toes.
    const release=span.anchor.clone().sub(frames[span.to][span.side].sole);
    release.y=0;
    release.clampLength(0,MAX_PELVIS);
    for(let k=1;k<=7 && span.to+k<frames.length;k++){
      const weight=1-smooth(k/7);
      const f=span.to+k;
      raw[f*2]+=release.x*weight;
      raw[f*2+1]+=release.z*weight;
      weights[f]+=1; // normalize between contacts, do not cancel fade-out
    }
  }
  for(let f=0;f<n;f++)if(weights[f]>0){
    raw[f*2]/=weights[f];
    raw[f*2+1]/=weights[f];
  }
  // Symmetric five-tap smoothing avoids one-frame hip jerks.
  const smoothOffsets=new Float32Array(n*2);
  for(let f=2;f<n-2;f++){
    for(let k=0;k<2;k++)
      smoothOffsets[f*2+k]=(raw[(f-2)*2+k]+2*raw[(f-1)*2+k]
        +3*raw[f*2+k]+2*raw[(f+1)*2+k]+raw[(f+2)*2+k])/9;
  }
  for(let f=0;f<n;f++){
    const d=Math.hypot(smoothOffsets[f*2],smoothOffsets[f*2+1]);
    if(d>MAX_PELVIS){const k=MAX_PELVIS/d;smoothOffsets[f*2]*=k;smoothOffsets[f*2+1]*=k;}
  }
  let max=0,jump=0;
  for(let f=1;f<n;f++){
    const d=Math.hypot(smoothOffsets[f*2],smoothOffsets[f*2+1]);
    const delta=Math.hypot(
      smoothOffsets[f*2]-smoothOffsets[(f-1)*2],
      smoothOffsets[f*2+1]-smoothOffsets[(f-1)*2+1],
    );
    max=Math.max(max,d);
    jump=Math.max(jump,delta);
  }
  const before=contactTravel(frames,spans);
  const after=contactTravel(frames,spans,smoothOffsets);
  const reason=jump>MAX_FRAME_JUMP?"hip_velocity_limit":
    before<0.008?"insufficient_slide":
    after>before*0.985?"no_measured_improvement":
    "accepted";
  return {frames,spans,offsets:smoothOffsets,before,after,max,jump,reason};
}

export function bakeFootContactsV7(
  actor:THREE.Object3D, rig:THREE.Skeleton,
  original:THREE.AnimationClip, rigFamily:string,
):ContactBakeV7 {
  const defaultReport:ClipContactV7={
    clip:original.name,segments:0,supportFrames:0,rawTravelCm:0,
    correctedTravelCm:0,maxPelvisCm:0,maxJumpCm:0,
    applied:false,reason:"unavailable",
  };
  const hip=bone(rig,"hips");
  const feet=(["L","R"] as const).map(side=>
    ["foot","toes"].map(k=>bone(rig,k+"."+side))
  );
  const count=Math.round(original.duration*FPS)+1;
  const track=hip&&original.tracks.find(t=>t.name===hip.uuid+".position");
  if(!hip||feet.flat().some(x=>!x)||!(track instanceof THREE.VectorKeyframeTrack)
     ||track.values.length!==count*3)return {clip:original,report:defaultReport};
  const legs=feet as THREE.Bone[][];
  actor.updateWorldMatrix(true,true);
  const rest=getPair(actor,legs);
  const geometry=[...rest.flatMap(f=>[f.ankle.y,f.toe.y,f.ankle.x,f.toe.x]),hip.position.y]
    .map(v=>Math.round(v*1000)).join(":");
  const key=rigFamily+"/"+original.name+"/"+geometry+"/"+count;
  let result=plans.get(key);
  if(!result){
    const saved=rig.bones.map(b=>({
      position:b.position.clone(),quaternion:b.quaternion.clone(),scale:b.scale.clone(),
    }));
    const probe=new THREE.AnimationMixer(actor);
    const action=probe.clipAction(original).setLoop(THREE.LoopOnce,1);
    action.clampWhenFinished=true;
    action.reset().play();
    const frames:Frame[]=[];
    try{
      for(let i=0;i<count;i++){
        action.time=Math.min(original.duration,i/FPS);
        probe.update(0);
        actor.updateWorldMatrix(true,true);
        frames.push(getPair(actor,legs));
      }
    }finally{
      action.stop();
      probe.stopAllAction();
      probe.uncacheRoot(actor);
      rig.bones.forEach((b,i)=>{
        b.position.copy(saved[i].position);
        b.quaternion.copy(saved[i].quaternion);
        b.scale.copy(saved[i].scale);
      });
      actor.updateWorldMatrix(true,true);
    }
    const planned=planFootContactV7(frames);
    result={
      offsets:planned.offsets,before:planned.before,after:planned.after,
      max:planned.max,jump:planned.jump,reason:planned.reason,
      segments:planned.spans.length,
      supportFrames:planned.spans.reduce((n,s)=>n+s.to-s.from+1,0),
    };
    plans.set(key,result);
  }
  const round=(n:number)=>Math.round(n*1000)/10;
  const report:ClipContactV7={
    clip:original.name,segments:result.segments,supportFrames:result.supportFrames,
    rawTravelCm:round(result.before),correctedTravelCm:round(result.after),
    maxPelvisCm:round(result.max),maxJumpCm:round(result.jump),
    applied:result.reason==="accepted",reason:result.reason,
  };
  if(!report.applied)return {clip:original,report};
  const out=new Float32Array(track.values);
  for(let f=0;f<count;f++){
    out[f*3]+=result.offsets[f*2];
    out[f*3+2]+=result.offsets[f*2+1];
  }
  const tracks=original.tracks.map(t=>t===track
    ?new THREE.VectorKeyframeTrack(track.name,track.times,out)
    :t.clone()
  );
  return {
    clip:new THREE.AnimationClip(original.name+"-contact-v7",original.duration,tracks),
    report,
  };
}
