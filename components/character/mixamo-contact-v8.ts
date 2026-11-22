import * as THREE from "three";
import type { FootPair } from "./mixamo-contact-transitions";
import { solveLeg } from "./mixamo-side-step-v6";

/**
 * V8 is an isolated, opt-in Mixamo QA authoring pass.
 * Each support foot is independently tracked at 30 FPS. Any changes are baked
 * into original leg quaternion curves; the runtime has no foot IK or pose lock.
 */
export type FootContactV8Report = {
  clip: string;
  supportFrames: readonly [number,number];
  beforeCm: readonly [number,number];
  afterCm: readonly [number,number];
  maxJointDeltaDeg: number;
  correctedFrames: number;
  applied: boolean;
  reason: string;
};
export type FootContactV8Profile = {
  clip: string;
  start: FootPair;
  contacts: Uint8Array;
  frames: number;
  getContact(time: number): readonly [boolean,boolean];
};
export type FootContactV8Result = {
  clip: THREE.AnimationClip;
  profile: FootContactV8Profile;
  report: FootContactV8Report;
};
type PerFoot = {ankle:THREE.Vector3; toe:THREE.Vector3; sole:THREE.Vector3};
type PerFrame = readonly [PerFoot,PerFoot];
type Span = {side:0|1;from:number;to:number;anchor:THREE.Vector3};
const FPS=30;
const MAX_CORRECTION=0.008; // native M3 units, per ankle, per frame
const MAX_JOINT=THREE.MathUtils.degToRad(7.5);
const MAX_CORRECTION_CHANGE=THREE.MathUtils.degToRad(3.5);
type BakeCache = {
  report:FootContactV8Report;
  contacts:Uint8Array;
  start:FootPair;
  jointValues:readonly Float32Array[] | null;
};
const bakedCache=new Map<string,BakeCache>();
function profileFromCache(
  clip:string,n:number,contacts:Uint8Array,start:FootPair,
):FootContactV8Profile {
  return {
    clip,frames:n,contacts,start,
    getContact(time){
      const frame=Math.max(0,Math.min(n-1,Math.round(time*FPS)));
      return [(contacts[frame]&1)!==0,(contacts[frame]&2)!==0];
    },
  };
}
const resolver=(rig:THREE.Skeleton,name:string)=>
  rig.bones.find(b=>b.name===name||b.name===THREE.PropertyBinding.sanitizeNodeName(name));
const vector=()=>new THREE.Vector3();
const dist=(a:THREE.Vector3,b:THREE.Vector3)=>Math.hypot(a.x-b.x,a.z-b.z);
const clamp=(v:number)=>Math.max(0,Math.min(1,v));
const ease=(v:number)=>{const x=clamp(v);return x*x*(3-2*x);};
const quantile=(values:number[],q:number)=>{
  const ordered=[...values].sort((a,b)=>a-b);
  return ordered[Math.floor((ordered.length-1)*q)];
};
function sample(actor:THREE.Object3D,pairs:readonly (readonly THREE.Bone[])[]):PerFrame {
  const foot=(pair:readonly THREE.Bone[]):PerFoot=>{
    const ankle=actor.worldToLocal(pair[0].getWorldPosition(vector()));
    const toe=actor.worldToLocal(pair[1].getWorldPosition(vector()));
    return {ankle,toe,sole:ankle.clone().lerp(toe,0.64)};
  };
  return [foot(pairs[0]),foot(pairs[1])];
}
function inferContacts(frames:PerFrame[]):{contacts:Uint8Array;spans:Span[]} {
  const contact=new Uint8Array(frames.length);
  const spans:Span[]=[];
  for(let s=0 as 0|1;s<2;s=(s+1) as 0|1){
    const soleFloor=quantile(frames.map(f=>f[s].sole.y),0.12);
    const toeFloor=quantile(frames.map(f=>f[s].toe.y),0.12);
    const raw=frames.map((f,i)=>{
      const p=f[s];
      if(i===0||i===frames.length-1)return false;
      const vertical=Math.abs(frames[i+1][s].sole.y-frames[i-1][s].sole.y);
      return p.sole.y-soleFloor<=0.036 &&
        p.toe.y-toeFloor<=0.048 && vertical<=0.018;
    });
    for(let i=1;i<raw.length-1;i++)
      if(!raw[i]&&raw[i-1]&&raw[i+1])raw[i]=true;
    let start=-1;
    for(let i=0;i<=raw.length;i++){
      const active=i<raw.length&&raw[i];
      if(active&&start<0)start=i;
      if(!active&&start>=0){
        const end=i-1;
        if(end-start+1>=8){
          const anchor=vector();
          for(let f=start;f<=Math.min(end,start+2);f++)anchor.add(frames[f][s].sole);
          anchor.divideScalar(Math.min(end-start+1,3));
          spans.push({side:s,from:start,to:end,anchor});
          for(let f=start;f<=end;f++)contact[f]|=(1<<s);
        }
        start=-1;
      }
    }
  }
  return {contacts:contact,spans};
}
function contactTravel(frames:PerFrame[],spans:readonly Span[]) {
  const total:[number,number]=[0,0];
  for(const s of spans)for(let f=s.from+1;f<=s.to;f++)
    total[s.side]+=dist(frames[f-1][s.side].sole,frames[f][s.side].sole);
  return total;
}
function footprint(foot:PerFoot):readonly [number,number,number] {
  return [foot.sole.x,foot.sole.y,foot.sole.z];
}
function trackFor(clip:THREE.AnimationClip,bone:THREE.Bone,n:number) {
  const track=clip.tracks.find(t=>t.name===bone.uuid+".quaternion");
  return track instanceof THREE.QuaternionKeyframeTrack && track.values.length===4*n
    ? track:null;
}
function frameQuats(legs:readonly (readonly THREE.Bone[])[]) {
  return legs.map(leg=>leg.map(b=>b.quaternion.clone()));
}
function restoreBones(rig:THREE.Skeleton,
  saved:readonly {position:THREE.Vector3;quaternion:THREE.Quaternion;scale:THREE.Vector3}[]) {
  rig.bones.forEach((bone,i)=>{
    bone.position.copy(saved[i].position);
    bone.quaternion.copy(saved[i].quaternion);
    bone.scale.copy(saved[i].scale);
  });
}
export function bakePerFootContactV8(
  actor:THREE.Object3D,rig:THREE.Skeleton,clip:THREE.AnimationClip,
):FootContactV8Result {
  const n=Math.round(clip.duration*FPS)+1;
  const pairs=(["L","R"] as const).map(s=>[
    resolver(rig,"foot."+s),resolver(rig,"toes."+s),
  ]);
  const legBones=(["L","R"] as const).map(s=>[
    resolver(rig,"upper_leg."+s),resolver(rig,"lower_leg."+s),
    resolver(rig,"foot."+s),
  ]);
  const safePairs=pairs as THREE.Bone[][];
  const safeLegs=legBones as THREE.Bone[][];
  const fallbackProfile:FootContactV8Profile={
    clip:clip.name,frames:n,contacts:new Uint8Array(n),
    start:[[0,0,0],[0,0,0]],
    getContact:()=>[false,false],
  };
  const defaultReport:FootContactV8Report={
    clip:clip.name,supportFrames:[0,0],beforeCm:[0,0],afterCm:[0,0],
    maxJointDeltaDeg:0,correctedFrames:0,applied:false,reason:"not_sampled",
  };
  if(pairs.flat().some(b=>!b)||legBones.flat().some(b=>!b)||
      !Number.isFinite(n)||n<16||n>3000)
    return {clip,profile:fallbackProfile,report:defaultReport};
  const tracks=safeLegs.map(leg=>leg.map(b=>trackFor(clip,b,n)));
  if(tracks.flat().some(t=>!t))
    return {clip,profile:fallbackProfile,report:{...defaultReport,reason:"missing_joint_tracks"}};
  // The source joint samples and rest-limb geometry must both match before a
  // cached plan can be shared. Bone UUIDs are deliberately NOT shared.
  const signature=[
    clip.name,n,
    ...safeLegs.flat().flatMap(b=>[
      ...b.position.toArray().map(v=>v.toFixed(4)),
      ...b.quaternion.toArray().map(v=>v.toFixed(4)),
    ]),
    ...tracks.flat().flatMap(t=>{
      const a=t!.values;
      return [a[0],a[1],a[Math.floor(a.length/2)],a[a.length-1]]
        .map(v=>v.toFixed(4));
    }),
  ].join(":");
  const cached=bakedCache.get(signature);
  if(cached){
    const profile=profileFromCache(clip.name,n,cached.contacts,cached.start);
    if(!cached.jointValues)return {clip,profile,report:cached.report};
    const replacement=new Map<string,THREE.QuaternionKeyframeTrack>();
    tracks.flat().forEach((t,i)=>replacement.set(t!.name,
      new THREE.QuaternionKeyframeTrack(t!.name,t!.times,
        new Float32Array(cached.jointValues![i]))));
    return {
      clip:new THREE.AnimationClip(clip.name+"-foot-v8",clip.duration,
        clip.tracks.map(t=>replacement.get(t.name)??t.clone())),
      profile,report:cached.report,
    };
  }
  const source=rig.bones.map(b=>({
    position:b.position.clone(),quaternion:b.quaternion.clone(),scale:b.scale.clone(),
  }));
  const probe=new THREE.AnimationMixer(actor);
  const action=probe.clipAction(clip).setLoop(THREE.LoopOnce,1);
  action.clampWhenFinished=true;
  const frames:PerFrame[]=[];
  let result:FootContactV8Result | null=null;
  try{
    action.reset().play();
    const at=(f:number)=>{
      action.time=Math.min(clip.duration,f/FPS);
      probe.update(0);
      actor.updateWorldMatrix(true,true);
    };
    for(let f=0;f<n;f++){at(f);frames.push(sample(actor,safePairs));}
    const {contacts,spans}=inferContacts(frames);
    const profile:FootContactV8Profile={
      clip:clip.name,frames:n,contacts,
      start:[footprint(frames[0][0]),footprint(frames[0][1])],
      getContact(time){
        const index=Math.min(n-1,Math.max(0,Math.round(time*FPS)));
        return [(contacts[index]&1)!==0,(contacts[index]&2)!==0];
      },
    };
    const sourceTravel=contactTravel(frames,spans);
    const counts:[number,number]=[0,0];
    for(const f of spans)counts[f.side]+=f.to-f.from+1;
    const read=(f:number)=>spans.filter(x=>f>=x.from&&f<=x.to);
    const values=tracks.map(side=>side.map(t=>new Float32Array(t!.values)));
    let maxDelta=0,corrected=0,unsafe=0;
    const before:THREE.Quaternion[][][]=[];
    const correctedFrames:PerFrame[]=[];
    const lastDelta:THREE.Quaternion[][]=[[],[]];
    for(let f=0;f<n;f++){
      at(f);
      const sourceQs=frameQuats(safeLegs);
      before.push(sourceQs);
      let changed=false;
      const active=read(f);
      for(const span of active){
        const side=span.side;
        const p=sample(actor,safePairs)[side];
        const diff=span.anchor.clone().sub(p.sole);
        diff.y=0;
        const envelope=ease(Math.min(f-span.from,span.to-f)/5);
        diff.clampLength(0,MAX_CORRECTION).multiplyScalar(envelope);
        if(diff.lengthSq()<0.000001)continue;
        const prior=safeLegs[side].map(b=>b.quaternion.clone());
        const target=p.ankle.clone().add(diff);
        const correction=solveLeg(actor,safeLegs[side],target);
        const deltas=safeLegs[side].map((b,i)=>b.quaternion.angleTo(sourceQs[side][i]));
        const valid=correction && Math.max(...deltas)<=MAX_JOINT &&
          deltas.every((d,i)=>!lastDelta[side][i]||
            d<=MAX_CORRECTION_CHANGE||
            d<=lastDelta[side][i].angleTo(sourceQs[side][i])+MAX_CORRECTION_CHANGE);
        if(!valid){
          unsafe++;
          safeLegs[side].forEach((b,i)=>b.quaternion.copy(prior[i]));
          actor.updateWorldMatrix(true,true);
          continue;
        }
        changed=true;
        maxDelta=Math.max(maxDelta,...deltas);
      }
      actor.updateWorldMatrix(true,true);
      correctedFrames.push(sample(actor,safePairs));
      for(let s=0;s<2;s++)for(let j=0;j<3;j++){
        const b=safeLegs[s][j];
        b.quaternion.toArray(values[s][j],f*4);
        lastDelta[s][j]=b.quaternion.clone();
      }
      if(changed)corrected++;
    }
    const afterTravel=contactTravel(correctedFrames,spans);
    const fullBefore=sourceTravel[0]+sourceTravel[1];
    const fullAfter=afterTravel[0]+afterTravel[1];
    const report:FootContactV8Report={
      clip:clip.name,supportFrames:counts,
      beforeCm:sourceTravel.map(v=>Math.round(v*1000)/10) as [number,number],
      afterCm:afterTravel.map(v=>Math.round(v*1000)/10) as [number,number],
      maxJointDeltaDeg:Math.round(THREE.MathUtils.radToDeg(maxDelta)*10)/10,
      correctedFrames:corrected,
      applied:false,reason:"no_safe_gain",
    };
    const meaningful=corrected>=5 && fullBefore>0.008 &&
      fullAfter<fullBefore*0.98;
    if(meaningful){
      // A contact is rejected if its correction has a sudden quaternion spike
      // versus the original. The original clip is preserved unchanged on risk.
      let worstJump=0;
      for(let f=1;f<n;f++)for(let s=0;s<2;s++)for(let j=0;j<3;j++){
        const q1=new THREE.Quaternion().fromArray(values[s][j],(f-1)*4);
        const q2=new THREE.Quaternion().fromArray(values[s][j],f*4);
        const originalJump=before[f-1][s][j].angleTo(before[f][s][j]);
        worstJump=Math.max(worstJump,q1.angleTo(q2)-originalJump);
      }
      if(worstJump<=THREE.MathUtils.degToRad(3.5)){
        const replacements=new Map<string,THREE.QuaternionKeyframeTrack>();
        for(let s=0;s<2;s++)for(let j=0;j<3;j++)
          replacements.set(tracks[s][j]!.name,
            new THREE.QuaternionKeyframeTrack(tracks[s][j]!.name,
              tracks[s][j]!.times,values[s][j]));
        report.applied=true;
        report.reason="accepted";
        result={
          clip:new THREE.AnimationClip(clip.name+"-foot-v8",clip.duration,
            clip.tracks.map(t=>replacements.get(t.name)??t.clone())),
          report,profile,
        };
      }else report.reason="joint_continuity";
    }else report.reason=unsafe>0?"unsafe_or_insufficient_gain":"insufficient_gain";
    result??={clip,report,profile};
    const jointValues=result.report.applied
      ? tracks.flat().map(t=>{
          const baked=result!.clip.tracks.find(x=>x.name===t!.name);
          return new Float32Array(baked!.values);
        })
      :null;
    bakedCache.set(signature,{
      report:result.report,contacts:new Uint8Array(profile.contacts),
      start:profile.start,jointValues,
    });
  }catch(error){
    result={clip,profile:fallbackProfile,report:{
      ...defaultReport,reason:"probe_failed:"+String(error).slice(0,64),
    }};
  }finally{
    action.stop();
    probe.stopAllAction();
    probe.uncacheRoot(actor);
    restoreBones(rig,source);
    actor.updateWorldMatrix(true,true);
  }
  return result ?? {clip,profile:fallbackProfile,report:defaultReport};
}

/** Pure, deterministic QA-only transition selection; never adds/removes a bag entry. */
export function bestSupportCandidateV8<K extends string>(
  bag:readonly K[],
  starts:ReadonlyMap<K,FootPair>,
  startContacts:ReadonlyMap<K,readonly [boolean,boolean]>,
  current:FootPair,
  support:readonly [boolean,boolean],
  excluded:readonly K[]=[],
):number {
  const permitted=bag.map((name,index)=>({name,index}))
    .filter(item=>!excluded.includes(item.name));
  const eligible=permitted.length?permitted:bag.map((name,index)=>({name,index}));
  if(!eligible.length)return -1;
  const score=(name:K)=>{
    const pose=starts.get(name);
    if(!pose)return Number.POSITIVE_INFINITY;
    const incoming=startContacts.get(name)??[false,false];
    let error=0,weight=0;
    for(let side=0;side<2;side++){
      const w=support[side]?1:0.12;
      const a=current[side],b=pose[side];
      // Absolute support sole mismatch in local XZ, plus vertical mismatch
      // and a cost for lifting a planted foot at the transition boundary.
      error+=w*(Math.hypot(a[0]-b[0],a[2]-b[2])+
        0.25*Math.abs(a[1]-b[1])+
        (support[side]&&!incoming[side]?0.018:0));
      weight+=w;
    }
    return error/Math.max(0.001,weight);
  };
  let best=eligible[0],bestScore=score(best.name);
  for(const item of eligible.slice(1)){
    const test=score(item.name);
    if(test<bestScore-0.004){bestScore=test;best=item;}
  }
  return best.index;
}
