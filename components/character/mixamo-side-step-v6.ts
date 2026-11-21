import * as THREE from "three";
import type { FootPair } from "./mixamo-contact-transitions";
import { planSideStepsV5 } from "./mixamo-side-step-v5";

/**
 * Isolated QA only. Source-aware two-phase side-tap:
 * weight shift → swing out → plant → lift/recover → settle.
 * All IK is solved once while authoring the 30 FPS clip; the runtime mixer
 * plays only authored quaternion/hips tracks, never a per-frame foot lock.
 */
export type SideStepV6Event = {
  side: "L" | "R";
  support: "L" | "R";
  startFrame: number;
  endFrame: number;
  reachCm: number;
  liftCm: number;
  maxJointDeltaDeg: number;
  supportDriftBeforeCm: number;
  supportDriftAfterCm: number;
  maxFootErrorCm: number;
};
export type SideStepV6Result = {
  clip: THREE.AnimationClip;
  events: readonly SideStepV6Event[];
};

const FPS = 30;
const MAX_THIGH = THREE.MathUtils.degToRad(13);
const MAX_SHIN = THREE.MathUtils.degToRad(23);
const MAX_ANKLE = THREE.MathUtils.degToRad(23);
const MAX_CONTACT_ERROR = 0.005;
const WINDOW_FRAMES = 48;
const REACH_OPTIONS = [0.080, 0.070, 0.060, 0.050, 0.045] as const;
const VEC = () => new THREE.Vector3();
const clamp01 = (v: number) => THREE.MathUtils.clamp(v, 0, 1);
function smooth(v: number) { const x = clamp01(v); return x * x * (3 - 2 * x); }
function travel(a: THREE.Vector3, b: THREE.Vector3) { return Math.hypot(a.x - b.x, a.z - b.z); }

function resolveBone(rig: THREE.Skeleton, name: string) {
  const safe = THREE.PropertyBinding.sanitizeNodeName(name);
  return rig.bones.find(b => b.name === name || b.name === safe);
}

function targetBoneAt(bone: THREE.Bone, child: THREE.Bone, target: THREE.Vector3) {
  if (!bone.parent) return false;
  const start = bone.getWorldPosition(VEC());
  const current = child.getWorldPosition(VEC()).sub(start);
  const next = target.clone().sub(start);
  if (current.lengthSq() < 1e-10 || next.lengthSq() < 1e-10) return false;
  const q = new THREE.Quaternion().setFromUnitVectors(current.normalize(), next.normalize());
  const parent = bone.parent.getWorldQuaternion(new THREE.Quaternion());
  bone.quaternion.premultiply(parent.clone().invert().multiply(q).multiply(parent)).normalize();
  bone.updateWorldMatrix(false, true);
  return true;
}

export function solveLeg(
  actor: THREE.Object3D, [upper, lower, ankle]: readonly THREE.Bone[],
  targetActorLocal: THREE.Vector3,
  onReject?: (reason: string) => void,
): {delta: number; error: number} | null {
  const reject = (reason:string) => {onReject?.(reason);return null;};
  if (!ankle.parent) return reject("ankle_no_parent");
  // Re-estimate the nearest biomechanically reachable target on THIS rig.
  // A near-ground foot may be 1mm beyond full leg extension during source
  // hip sway. Preserve support within a hard 5mm tolerance; never relax the
  // thigh/shin/ankle angular safety gates to force a planted foot.
  const saved = [upper.quaternion.clone(), lower.quaternion.clone(), ankle.quaternion.clone()];
  const heading = ankle.getWorldQuaternion(new THREE.Quaternion());
  const target = actor.localToWorld(targetActorLocal.clone());
  const root = upper.getWorldPosition(VEC());
  const startingKnee = lower.getWorldPosition(VEC());
  const startingFoot = ankle.getWorldPosition(VEC());
  const upperLength = root.distanceTo(startingKnee);
  const lowerLength = startingKnee.distanceTo(startingFoot);
  if (upperLength < 1e-5 || lowerLength < 1e-5)
    return reject("degenerate_limb");
  const restore = () => {
    upper.quaternion.copy(saved[0]);
    lower.quaternion.copy(saved[1]);
    ankle.quaternion.copy(saved[2]);
    actor.updateWorldMatrix(true,true);
  };
  const initialError = startingFoot.distanceTo(target);
  if (initialError <= 0.001) return {delta:0,error:initialError};

  let bestReason = "";
  for (const alpha of [1, 0.995, 0.98, 0.96, 0.92, 0.86, 0.76, 0.62, 0.45, 0.20, 0]) {
    restore();
    const goal = startingFoot.clone().lerp(target,alpha);
    // Even alpha=0 is useful as a safe no-IK pose when already very close
    // to the requested planted contact.
    if (alpha === 0) {
      if (initialError <= MAX_CONTACT_ERROR) return {delta:0,error:initialError};
      continue;
    }
    const axis = goal.clone().sub(root);
    const reach = axis.length();
    if (reach < 1e-5 || reach >= upperLength + lowerLength - 0.00001 ||
        reach <= Math.abs(upperLength - lowerLength) + 0.00001) {
      bestReason = "unreachable:reach="+reach.toFixed(4)
        +";limbs="+upperLength.toFixed(4)+"/"+lowerLength.toFixed(4)
        +";alpha="+alpha;
      continue;
    }
    axis.divideScalar(reach);
    const kneeAxis = startingKnee.clone().sub(root);
    const pole = kneeAxis.clone().addScaledVector(axis, -kneeAxis.dot(axis));
    if (pole.lengthSq() < 1e-9) {bestReason="pole_degenerate";continue;}
    const along = (upperLength ** 2 - lowerLength ** 2 + reach ** 2) / (2 * reach);
    const across = Math.sqrt(Math.max(0, upperLength ** 2 - along ** 2));
    const kneeGoal = root.clone().addScaledVector(axis, along)
      .addScaledVector(pole.normalize(), across);
    if (!targetBoneAt(upper,lower,kneeGoal) || !targetBoneAt(lower,ankle,goal)) {
      bestReason="aim_failed";continue;
    }
    ankle.quaternion.copy(
      ankle.parent.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(heading)
    ).normalize();
    actor.updateWorldMatrix(true,true);
    const finalFoot=ankle.getWorldPosition(VEC());
    const error = finalFoot.distanceTo(target); // TRUE requested contact
    const angles = [
      upper.quaternion.angleTo(saved[0]),lower.quaternion.angleTo(saved[1]),
      ankle.quaternion.angleTo(saved[2]),
    ];
    if (error <= MAX_CONTACT_ERROR && angles[0]<=MAX_THIGH &&
      angles[1]<=MAX_SHIN && angles[2]<=MAX_ANKLE) {
      return {delta:Math.max(...angles),error};
    }
    bestReason="limits:error="+error.toFixed(4)+";angles="+angles.map(x=>
      THREE.MathUtils.radToDeg(x).toFixed(1)).join("/")+";alpha="+alpha;
  }
  restore();
  return reject(bestReason||"no_feasible_contact");
}

function swingEnvelope(t:number,start:number,end:number) {
  if (t<=start || t>=end) return 0;
  return Math.pow(Math.sin(Math.PI*(t-start)/(end-start)),1.15);
}

function cappedFootAnchor(
  source:THREE.Vector3, anchor:THREE.Vector3, blend:number,
) {
  // Keep only the locally feasible part of the support-foot correction.
  // Long Bored sway cannot be constrained to ONE support foot for 48 frames.
  const drift = anchor.clone().sub(source);
  drift.y = 0; // never pull the ankle through the floor
  drift.clampLength(0,0.012);
  return source.clone().addScaledVector(drift,blend);
}

function jointTrack(clip: THREE.AnimationClip, bone: THREE.Bone, n: number) {
  const track = clip.tracks.find(t => t.name === bone.uuid + ".quaternion");
  return track instanceof THREE.QuaternionKeyframeTrack && track.values.length === n * 4
    ? track : null;
}

/**
 * Bakes up to two paired side-taps into Bored only, with per-frame support
 * anchoring and a tiny pelvis weight shift. If no candidate is solvable,
 * preserve the unmodified source clip rather than deforming the rig.
 */
export function bakeBoredSideStepsV6(
  actor: THREE.Object3D,
  rig: THREE.Skeleton,
  original: THREE.AnimationClip,
): SideStepV6Result {
  if (!original.name.includes("-bored")) return {clip:original,events:[]};
  const legs = (["L","R"] as const).map(side=>
    ["upper_leg","lower_leg","foot"].map(name=>resolveBone(rig,name+"."+side))
  );
  if (legs.flat().some(b=>!b)) return {clip:original,events:[]};
  const bones=legs as THREE.Bone[][];
  const hips=resolveBone(rig,"hips");
  const n=Math.round(original.duration*FPS)+1;
  const hipTrack=hips && original.tracks.find(t=>t.name===hips.uuid+".position");
  if (!hipTrack || !(hipTrack instanceof THREE.VectorKeyframeTrack) ||
      hipTrack.values.length!==n*3) return {clip:original,events:[]};
  const sourceTracks=new Map<string,THREE.QuaternionKeyframeTrack>();
  for (const side of bones) for (const bone of side) {
    const track=jointTrack(original,bone,n);
    if (!track) return {clip:original,events:[]};
    sourceTracks.set(bone.uuid,track);
  }
  const outputs=new Map<string,Float32Array>();
  for(const [uuid,track] of sourceTracks)
    outputs.set(uuid,new Float32Array(track.values));
  const hipsOutput=new Float32Array(hipTrack.values);
  const saved=rig.bones.map(b=>({
    position:b.position.clone(),quaternion:b.quaternion.clone(),scale:b.scale.clone()
  }));
  const probe=new THREE.AnimationMixer(actor);
  const action=probe.clipAction(original).setLoop(THREE.LoopOnce,1);
  action.clampWhenFinished=true;
  action.reset().play();
  const feet=():[THREE.Vector3,THREE.Vector3]=>[
    actor.worldToLocal(bones[0][2].getWorldPosition(VEC())),
    actor.worldToLocal(bones[1][2].getWorldPosition(VEC())),
  ];
  const sample=(f:number)=>{
    action.time=Math.min(original.duration,f/FPS);
    probe.update(0);
    actor.updateWorldMatrix(true,true);
  };
  const sources:[THREE.Vector3,THREE.Vector3][]=[];
  const baked:SideStepV6Event[]=[];
  let attempted=0,rejected=0;
  try {
    for(let f=0;f<n;f++){sample(f);sources.push(feet());}
    const positions:FootPair[]=sources.map(f=>[
      [f[0].x,f[0].y,f[0].z],[f[1].x,f[1].y,f[1].z],
    ]);
    sample(0);
    const hipWorld=hips!.getWorldPosition(VEC());
    const footWorld=bones[0][2].getWorldPosition(VEC());
    const anatomicalHeight=Math.max(0.5,2*hipWorld.distanceTo(footWorld));
    const moments=planSideStepsV5(positions,anatomicalHeight);
    for(const candidate of moments){
      const start=Math.max(6,candidate.start-5);
      const end=start+WINDOW_FRAMES;
      if(end>=n-6) continue;
      const side=candidate.side;
      const opposite=(1-side) as 0|1;
      const sign=Math.sign(sources[start][side].x-sources[start][opposite].x)
        || (side===0?1:-1);
      // Phase A: side steps; Phase B: the former support foot follows. This
      // avoids forcing one planted shoe to resist the whole Bored source sway.
      const holdA=sources[Math.round(start+0.16*WINDOW_FRAMES)][opposite];
      const holdB=sources[Math.round(start+0.43*WINDOW_FRAMES)][side];
      for(const amplitude of REACH_OPTIONS){
        attempted++;
        const lift=Math.min(0.037,Math.max(0.025,amplitude*0.42));
        const staged:{
          frame:number;hipX:number;hipY:number;
          quats:THREE.Quaternion[];feet:[THREE.Vector3,THREE.Vector3];
        }[]=[];
        let rejectAt="",maxDelta=0,maxError=0,failed=false;
        for(let f=start+1;f<end;f++){
          sample(f);
          const t=(f-start)/(end-start);
          const a=swingEnvelope(t,0.16,0.43);
          const b=swingEnvelope(t,0.43,0.76);
          const originalFeet=feet();
          // A subtle source-relative weight shift and knee softening.
          hips!.position.x+= -sign*0.007*a + sign*0.007*b;
          hips!.position.y-= 0.006*Math.max(a,b);
          actor.updateWorldMatrix(true,true);
          const footTargets:[THREE.Vector3,THREE.Vector3]=[
            originalFeet[0].clone(),originalFeet[1].clone(),
          ];
          if(a>0){
            footTargets[side].x+=sign*amplitude*a;
            footTargets[side].z-=0.006*a;
            footTargets[side].y+=lift*a;
            footTargets[opposite]=cappedFootAnchor(
              originalFeet[opposite],holdA,a,
            );
          } else if(b>0) {
            footTargets[opposite].x+=sign*amplitude*0.8*b;
            footTargets[opposite].z-=0.005*b;
            footTargets[opposite].y+=lift*0.9*b;
            footTargets[side]=cappedFootAnchor(originalFeet[side],holdB,b);
          }
          // Zero lift/zero correction on event boundaries returns to the
          // exact source tracks and avoids clip-end discontinuities.
          const supportSide=a>0?opposite:side;
          if(a>0 || b>0){
            const stable=solveLeg(actor,bones[supportSide],footTargets[supportSide],
              reason=>{rejectAt="support f="+f+" "+reason;});
            if(!stable){failed=true;break;}
            maxDelta=Math.max(maxDelta,stable.delta);
            maxError=Math.max(maxError,stable.error);
            const movingSide=a>0?side:opposite;
            const swing=solveLeg(actor,bones[movingSide],footTargets[movingSide],
              reason=>{rejectAt="swing f="+f+" "+reason;});
            if(!swing){failed=true;break;}
            maxDelta=Math.max(maxDelta,swing.delta);
            maxError=Math.max(maxError,swing.error);
          }
          staged.push({
            frame:f,hipX:hips!.position.x,hipY:hips!.position.y,
            quats:bones.flat().map(bone=>bone.quaternion.clone()),feet:feet(),
          });
        }
        if(failed || staged.length!==end-start-1){
          rejected++;
          console.info("[mixamo-side-step-v6] rejected",JSON.stringify({
            clip:original.name,side,amplitude,staged:staged.length,rejectAt,
          }));
          continue;
        }
        // Evaluate ONLY the first true support phase; a 48-frame stationary
        // support target was the V6.0 architecture error.
        const before=sources[Math.round(start+0.16*WINDOW_FRAMES)][opposite];
        const after=staged.find(x=>x.frame===Math.round(start+0.16*WINDOW_FRAMES))!.feet[opposite];
        let sourceDrift=0,correctedDrift=0;
        for(const f of staged){
          const t=(f.frame-start)/(end-start);
          if(t<0.16 || t>0.43)continue;
          sourceDrift=Math.max(sourceDrift,travel(sources[f.frame][opposite],before));
          correctedDrift=Math.max(correctedDrift,travel(f.feet[opposite],after));
        }
        if(correctedDrift>Math.max(0.008,sourceDrift+0.001)){
          rejected++;
          console.info("[mixamo-side-step-v6] drift_rejected",JSON.stringify({
            clip:original.name,side,amplitude,sourceDrift,correctedDrift,
          }));
          continue;
        }
        for(const frame of staged) {
          hipsOutput[frame.frame*3]=frame.hipX;
          hipsOutput[frame.frame*3+1]=frame.hipY;
          bones.flat().forEach((bone,i)=>
            frame.quats[i].toArray(outputs.get(bone.uuid)!,frame.frame*4)
          );
        }
        baked.push({
          side:side===0?"L":"R",support:opposite===0?"L":"R",
          startFrame:start,endFrame:end,
          reachCm:Math.round(amplitude*1000)/10,
          liftCm:Math.round(lift*1000)/10,
          maxJointDeltaDeg:Math.round(THREE.MathUtils.radToDeg(maxDelta)*10)/10,
          supportDriftBeforeCm:Math.round(sourceDrift*1000)/10,
          supportDriftAfterCm:Math.round(correctedDrift*1000)/10,
          maxFootErrorCm:Math.round(maxError*10000)/100,
        });
        break;
      }
    }
  } finally {
    action.stop();
    probe.stopAllAction();
    probe.uncacheRoot(actor);
    rig.bones.forEach((bone,i)=>{
      bone.position.copy(saved[i].position);
      bone.quaternion.copy(saved[i].quaternion);
      bone.scale.copy(saved[i].scale);
    });
    actor.updateWorldMatrix(true,true);
  }
  console.info("[mixamo-side-step-v6] result",JSON.stringify({
    source:original.name,events:baked,attempted,rejected,
  }));
  if(!baked.length)return{clip:original,events:[]};
  const tracks=original.tracks.map(track=>{
    const uuid=track.name.split(".")[0];
    if(hips && uuid===hips.uuid && track.name.endsWith(".position"))
      return new THREE.VectorKeyframeTrack(track.name,track.times,hipsOutput);
    const q=outputs.get(uuid);
    return q?new THREE.QuaternionKeyframeTrack(track.name,track.times,q):track.clone();
  });
  return {
    clip:new THREE.AnimationClip(original.name+"-step-v6",original.duration,tracks),
    events:baked,
  };
}
