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

function solveLeg(
  actor: THREE.Object3D, [upper, lower, ankle]: readonly THREE.Bone[],
  targetActorLocal: THREE.Vector3,
): {delta: number; error: number} | null {
  if (!ankle.parent) return null;
  const saved = [upper.quaternion.clone(), lower.quaternion.clone(), ankle.quaternion.clone()];
  const heading = ankle.getWorldQuaternion(new THREE.Quaternion());
  const root = upper.getWorldPosition(VEC());
  const knee = lower.getWorldPosition(VEC());
  const foot = ankle.getWorldPosition(VEC());
  const goal = actor.localToWorld(targetActorLocal.clone());
  const upperLength = root.distanceTo(knee);
  const lowerLength = knee.distanceTo(foot);
  const axis = goal.clone().sub(root);
  const reach = axis.length();
  if (reach < 1e-5 || upperLength < 1e-5 || lowerLength < 1e-5 ||
    reach >= upperLength + lowerLength - 0.00001 ||
    reach <= Math.abs(upperLength - lowerLength) + 0.00001) return null;
  axis.divideScalar(reach);
  const kneeAxis = knee.clone().sub(root);
  const pole = kneeAxis.clone().addScaledVector(axis, -kneeAxis.dot(axis));
  if (pole.lengthSq() < 1e-9) return null;
  const along = (upperLength ** 2 - lowerLength ** 2 + reach ** 2) / (2 * reach);
  const perpendicular = Math.sqrt(Math.max(0, upperLength ** 2 - along ** 2));
  const targetKnee = root.clone().addScaledVector(axis, along)
    .addScaledVector(pole.normalize(), perpendicular);
  if (!targetBoneAt(upper, lower, targetKnee) || !targetBoneAt(lower, ankle, goal)) return null;
  ankle.quaternion.copy(
    ankle.parent.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(heading)
  ).normalize();
  actor.updateWorldMatrix(true, true);
  const error = ankle.getWorldPosition(VEC()).distanceTo(goal);
  const rotations = [
    upper.quaternion.angleTo(saved[0]), lower.quaternion.angleTo(saved[1]),
    ankle.quaternion.angleTo(saved[2]),
  ];
  if (error > MAX_CONTACT_ERROR || rotations[0] > MAX_THIGH ||
      rotations[1] > MAX_SHIN || rotations[2] > MAX_ANKLE) return null;
  return {delta: Math.max(...rotations), error};
}

function phase(t: number) {
  // Each limb has two complete lift/land events. Endpoints are continuous.
  const out = smooth((t - 0.13) / 0.23);
  const inward = smooth((t - 0.60) / 0.23);
  const reach = out * (1 - inward);
  let lift = 0;
  if (t >= 0.13 && t <= 0.36) {
    lift = Math.pow(Math.sin(Math.PI * (t - 0.13) / 0.23), 1.15);
  } else if (t >= 0.60 && t <= 0.83) {
    lift = Math.pow(Math.sin(Math.PI * (t - 0.60) / 0.23), 1.15);
  }
  const contact = smooth(t / 0.13) * (1 - smooth((t - 0.83) / 0.17));
  // Small hip sway towards support foot, then towards planted swing shoe.
  const sway = smooth(t / 0.15) * (1 - smooth((t - 0.85) / 0.15));
  return {reach, lift, contact, sway};
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
  if (!original.name.includes("-bored")) return {clip:original, events:[]};
  const legs = (["L", "R"] as const).map(side =>
    ["upper_leg", "lower_leg", "foot"].map(name => resolveBone(rig, name + "." + side))
  );
  if (legs.flat().some(b => !b)) return {clip:original, events:[]};
  const bones = legs as THREE.Bone[][];
  const hips = resolveBone(rig,"hips");
  const n = Math.round(original.duration * FPS) + 1;
  const hipTrack = hips && original.tracks.find(t => t.name === hips.uuid + ".position");
  if (!hipTrack || !(hipTrack instanceof THREE.VectorKeyframeTrack) || hipTrack.values.length !== n * 3)
    return {clip:original, events:[]};
  const originalTracks = new Map<string,THREE.QuaternionKeyframeTrack>();
  for (const side of bones) for (const bone of side) {
    const track = jointTrack(original,bone,n);
    if (!track) return {clip:original, events:[]};
    originalTracks.set(bone.uuid,track);
  }
  const output = new Map<string,Float32Array>();
  for (const [uuid,track] of originalTracks) output.set(uuid,new Float32Array(track.values));
  const outputHips = new Float32Array(hipTrack.values);
  const baseline = rig.bones.map(b => ({
    position:b.position.clone(), quaternion:b.quaternion.clone(), scale:b.scale.clone()
  }));
  const mixer = new THREE.AnimationMixer(actor);
  const action = mixer.clipAction(original).setLoop(THREE.LoopOnce,1);
  action.clampWhenFinished = true;
  action.reset().play();
  const getFeet = (): [THREE.Vector3,THREE.Vector3] => [
    actor.worldToLocal(bones[0][2].getWorldPosition(VEC())),
    actor.worldToLocal(bones[1][2].getWorldPosition(VEC())),
  ];
  const sample = (f: number) => {
    action.time = Math.min(original.duration,f / FPS);
    mixer.update(0);
    actor.updateWorldMatrix(true,true);
  };
  const footFrames: [THREE.Vector3,THREE.Vector3][] = [];
  const baked: SideStepV6Event[] = [];
  let attempted = 0;
  let rejected = 0;
  try {
    for (let f=0;f<n;f++) { sample(f); footFrames.push(getFeet()); }
    // The source's own near-floor lateral motion supplies step timing.
    const scan: FootPair[] = footFrames.map(f=>[
      [f[0].x,f[0].y,f[0].z],[f[1].x,f[1].y,f[1].z],
    ]);
    // Character height must come from bones, not the 4.05m actor AABB.
    const hipAtStart = (() => {sample(0);return hips!.getWorldPosition(VEC());})();
    const ankleAtStart = bones[0][2].getWorldPosition(VEC());
    const legScale = Math.max(0.5,2 * hipAtStart.distanceTo(ankleAtStart));
    const events = planSideStepsV5(scan,legScale);
    for (const proposed of events) {
      const start = Math.max(6,proposed.start - 5);
      const end = Math.min(n-7,start + WINDOW_FRAMES);
      if (end-start !== WINDOW_FRAMES) continue;
      const side = proposed.side;
      const support = (1-side) as 0|1;
      const sign = Math.sign(footFrames[start][side].x-footFrames[start][support].x)
        || (side===0 ? 1 : -1);
      const plantedAnchor = footFrames[start][support].clone();
      // The contact-foot transform never inherits accumulated runtime offset.
      for (const amplitude of REACH_OPTIONS) {
        attempted++;
        const lift = Math.min(0.037,Math.max(0.025,amplitude*0.42));
        const staged: {frame:number; quats:THREE.Quaternion[]; hipX:number; feet:[THREE.Vector3,THREE.Vector3]}[] = [];
        let failed = false;
        let maxDelta = 0;
        let maxError = 0;
        for (let f=start+1;f<end;f++) {
          sample(f);
          const t = (f-start)/(end-start);
          const p = phase(t);
          const originalFeet = getFeet();
          const hipShift = -sign * 0.012 * p.sway + sign * 0.009 * p.reach;
          hips!.position.x += hipShift;
          actor.updateWorldMatrix(true,true);
          const supportGoal = originalFeet[support].clone().lerp(plantedAnchor,p.contact);
          const swingGoal = originalFeet[side].clone();
          swingGoal.x += sign * amplitude * p.reach;
          swingGoal.z -= 0.008 * p.reach;
          swingGoal.y += lift * p.lift;
          // Plant the out-step between both lifting phases, no lateral scrape.
          const landT = 0.36;
          const returnT = 0.60;
          if (t >= landT) {
            const landedFrame = Math.round(start + (end-start)*landT);
            const landed = footFrames[landedFrame][side].clone();
            landed.x += sign*amplitude;
            landed.z -= 0.008;
            // No one-frame snap when leaving the short planted hold.
            const release = t <= returnT ? 0 : smooth((t-returnT)/0.23);
            swingGoal.lerpVectors(landed, originalFeet[side],release);
            swingGoal.x += sign * amplitude * p.reach * release;
            swingGoal.z -= 0.008 * p.reach * release;
            swingGoal.y += lift * p.lift;
          }
          // Correct support first so swing leg moves relative to a stable base.
          const solvedSupport = solveLeg(actor,bones[support],supportGoal);
          if (!solvedSupport) {failed=true;break;}
          const solvedSwing = solveLeg(actor,bones[side],swingGoal);
          if (!solvedSwing) {failed=true;break;}
          maxDelta = Math.max(maxDelta,solvedSupport.delta,solvedSwing.delta);
          maxError = Math.max(maxError,solvedSupport.error,solvedSwing.error);
          staged.push({
            frame:f,hipX:hips!.position.x,
            quats:bones.flat().map(b=>b.quaternion.clone()),
            feet:getFeet(),
          });
        }
        if (failed || staged.length!==end-start-1) {rejected++;continue;}
        const core = (f:number)=> f>=start+8 && f<=end-8;
        const baselineSupport = footFrames[start+8][support];
        const finalSupport = staged.find(e=>e.frame===start+8)!.feet[support];
        let sourceDrift = 0, correctedDrift=0;
        for (const frame of staged.filter(e=>core(e.frame))) {
          sourceDrift=Math.max(sourceDrift,travel(footFrames[frame.frame][support],baselineSupport));
          correctedDrift=Math.max(correctedDrift,travel(frame.feet[support],finalSupport));
        }
        // A reduced support-foot error is mandatory for declaring a valid step.
        if (correctedDrift > Math.max(0.008,sourceDrift+0.001)) {rejected++;continue;}
        for(const frame of staged) {
          outputHips[frame.frame*3] = frame.hipX;
          bones.flat().forEach((b,i)=>frame.quats[i].toArray(output.get(b.uuid)!,frame.frame*4));
        }
        baked.push({
          side:side===0?"L":"R",support:support===0?"L":"R",
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
    mixer.stopAllAction();
    mixer.uncacheRoot(actor);
    rig.bones.forEach((bone,i)=>{
      bone.position.copy(baseline[i].position);
      bone.quaternion.copy(baseline[i].quaternion);
      bone.scale.copy(baseline[i].scale);
    });
    actor.updateWorldMatrix(true,true);
  }
  console.info("[mixamo-side-step-v6] result",JSON.stringify({
    source:original.name,events:baked,attempted,rejected,
  }));
  if (!baked.length) return {clip:original,events:[]};
  const tracks = original.tracks.map(t=>{
    const name = t.name.split(".")[0];
    if (hips && name===hips.uuid && t.name.endsWith(".position"))
      return new THREE.VectorKeyframeTrack(t.name,t.times,outputHips);
    const q = output.get(name);
    return q ? new THREE.QuaternionKeyframeTrack(t.name,t.times,q) : t.clone();
  });
  return {
    clip:new THREE.AnimationClip(original.name+"-step-v6",original.duration,tracks),
    events:baked,
  };
}
