import * as THREE from "three";
import type { FootPair } from "./mixamo-contact-transitions";

/**
 * V5 QA only: convert an existing horizontal Bored foot traverse into a small,
 * source-timed side-step. All 30 Hz keyframes are baked BEFORE playback.
 * No frame-by-frame IK, actor translation, or upper-body modification.
 */
export type SideStepV5Event = {
  side: "L" | "R";
  startFrame: number;
  endFrame: number;
  distanceCm: number;
  liftCm: number;
  maxJointDeltaDeg: number;
};

type Candidate = { side: 0 | 1; start: number; end: number; distance: number; score: number };
const FPS = 30;
const WINDOW_FRAMES = 14;
const MAX_EVENTS = 2;
const STEP_LIFT_RATIO = 0.014; // 2.24 cm for a 1.6m M3 body
const MAX_UPPER_RAD = THREE.MathUtils.degToRad(11);
const MAX_LOWER_RAD = THREE.MathUtils.degToRad(19);

function q10(values: readonly number[]) {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor((sorted.length - 1) * 0.1)];
}

/**
 * Detect a sustained near-floor sideways traverse in the original sampled clip.
 * Reject preexisting lifted steps and movements dominated by forward/backward
 * motion. At most two separate steps in the 10.67s Bored performance.
 */
export function planSideStepsV5(frames: readonly FootPair[], height: number): Candidate[] {
  if (frames.length < 45 || !(height > 0)) return [];
  const floor: [number, number] = [
    q10(frames.map(f => f[0][1])),
    q10(frames.map(f => f[1][1])),
  ];
  const candidates: Candidate[] = [];
  const minTravel = Math.max(0.019, height * 0.012);
  for (let side = 0 as 0 | 1; side < 2; side = (side + 1) as 0 | 1) {
    const opposite = (1 - side) as 0 | 1;
    for (let start = 12; start + WINDOW_FRAMES < frames.length - 12; start += 2) {
      const end = start + WINDOW_FRAMES;
      const mid = Math.floor((start + end) / 2);
      const a = frames[start][side], b = frames[end][side];
      const supportA = frames[start][opposite], supportB = frames[end][opposite];
      const dx = b[0] - a[0], dz = b[2] - a[2];
      const distance = Math.hypot(dx, dz);
      if (Math.abs(dx) < minTravel || Math.abs(dx) < Math.abs(dz) * 1.2) continue;
      if (distance > height * 0.075) continue; // too large for a tiny idle step
      const maxRise = Math.max(...frames.slice(start, end + 1).map(f => f[side][1] - floor[side]));
      if (maxRise > height * 0.026) continue; // source already authored a lift
      if (Math.max(a[1], b[1]) - floor[side] > height * 0.019) continue;
      if (frames[mid][opposite][1] - floor[opposite] > height * 0.022) continue;
      const supportMotion = Math.hypot(supportB[0] - supportA[0], supportB[2] - supportA[2]);
      // A moving support foot is suspicious; favor the cleaner of the two sides.
      const score = Math.abs(dx) - supportMotion * 0.23 - Math.abs(dz) * 0.15;
      if (score < minTravel * 0.60) continue;
      candidates.push({ side, start, end, distance, score });
    }
  }
  candidates.sort((a, b) => b.score - a.score);
  const picked: Candidate[] = [];
  for (const item of candidates) {
    if (picked.some(previous => Math.abs(item.start - previous.start) < FPS * 1.1)) continue;
    picked.push(item);
    if (picked.length === MAX_EVENTS) break;
  }
  return picked.sort((a, b) => a.start - b.start);
}

function findBone(rig: THREE.Skeleton, name: string) {
  const safe = THREE.PropertyBinding.sanitizeNodeName(name);
  return rig.bones.find(b => b.name === name || b.name === safe);
}

function aim(bone: THREE.Bone, child: THREE.Bone, target: THREE.Vector3): boolean {
  if (!bone.parent) return false;
  const from = bone.getWorldPosition(new THREE.Vector3());
  const direction = child.getWorldPosition(new THREE.Vector3()).sub(from);
  const desired = target.clone().sub(from);
  if (direction.lengthSq() < 1e-10 || desired.lengthSq() < 1e-10) return false;
  const rotation = new THREE.Quaternion().setFromUnitVectors(direction.normalize(), desired.normalize());
  const parent = bone.parent.getWorldQuaternion(new THREE.Quaternion());
  bone.quaternion.premultiply(parent.clone().invert().multiply(rotation).multiply(parent)).normalize();
  bone.updateWorldMatrix(false, true);
  return true;
}

/** One frame in the SOURCE pose; preserve its native knee plane and foot heading. */
function smallStepSolve(
  actor: THREE.Object3D, upper: THREE.Bone, lower: THREE.Bone, foot: THREE.Bone, lift: number,
) {
  const originalUpper = upper.quaternion.clone();
  const originalLower = lower.quaternion.clone();
  const originalAnkle = foot.quaternion.clone();
  const orientation = foot.getWorldQuaternion(new THREE.Quaternion());
  const thigh = upper.getWorldPosition(new THREE.Vector3());
  const knee = lower.getWorldPosition(new THREE.Vector3());
  const ankle = foot.getWorldPosition(new THREE.Vector3());
  const goal = ankle.clone().add(new THREE.Vector3(0, lift, 0));
  const l1 = thigh.distanceTo(knee), l2 = knee.distanceTo(ankle);
  const axis = goal.clone().sub(thigh);
  const reach = axis.length();
  if (reach < 1e-6 || l1 < 1e-6 || l2 < 1e-6 || reach > l1 + l2 - 1e-5 ||
      reach < Math.abs(l1 - l2) + 1e-5) return null;
  axis.divideScalar(reach);
  const pole = knee.clone().sub(thigh).addScaledVector(axis, -knee.clone().sub(thigh).dot(axis));
  if (pole.lengthSq() < 1e-9) return null;
  const along = (l1 * l1 - l2 * l2 + reach * reach) / (2 * reach);
  const across = Math.sqrt(Math.max(0, l1 * l1 - along * along));
  const kneeTarget = thigh.clone().addScaledVector(axis, along)
    .addScaledVector(pole.normalize(), across);
  if (!aim(upper, lower, kneeTarget) || !aim(lower, foot, goal)) return null;
  if (!foot.parent) return null;
  const parentWorld = foot.parent.getWorldQuaternion(new THREE.Quaternion());
  foot.quaternion.copy(parentWorld.invert().multiply(orientation)).normalize();
  actor.updateWorldMatrix(true, true);
  const error = foot.getWorldPosition(new THREE.Vector3()).distanceTo(goal);
  const upperAngle = upper.quaternion.angleTo(originalUpper);
  const lowerAngle = lower.quaternion.angleTo(originalLower);
  const ankleAngle = foot.quaternion.angleTo(originalAnkle);
  if (error > 0.003 || upperAngle > MAX_UPPER_RAD || lowerAngle > MAX_LOWER_RAD ||
      ankleAngle > MAX_LOWER_RAD) return null;
  return Math.max(upperAngle, lowerAngle, ankleAngle);
}

type BakeResult = { clip: THREE.AnimationClip; events: SideStepV5Event[] };

/**
 * Re-sample one already-retargeted Bored clip against this M3 skeleton, and
 * bake tiny vertical shoe arcs into ONLY the selected thigh/shin/foot tracks.
 * A failed leg solve rejects its entire candidate (no discontinuous frames).
 */
export function bakeBoredSideStepsV5(
  actor: THREE.Object3D, rig: THREE.Skeleton, original: THREE.AnimationClip, height: number,
): BakeResult {
  const left = ["upper_leg.L", "lower_leg.L", "foot.L"].map(name => findBone(rig, name));
  const right = ["upper_leg.R", "lower_leg.R", "foot.R"].map(name => findBone(rig, name));
  if ([...left, ...right].some(b => !b)) return {clip: original, events: []};
  const legs = [left as THREE.Bone[], right as THREE.Bone[]] as const;
  const n = Math.round(original.duration * FPS) + 1;
  const tracked = new Map<string, THREE.QuaternionKeyframeTrack>();
  for (const bones of legs) for (const bone of bones) {
    const track = original.tracks.find(t => t.name === bone.uuid + ".quaternion");
    if (!(track instanceof THREE.QuaternionKeyframeTrack) || track.values.length !== n * 4)
      return {clip: original, events: []};
    tracked.set(bone.uuid, track);
  }
  const saved = rig.bones.map(bone => ({
    position: bone.position.clone(), quaternion: bone.quaternion.clone(), scale: bone.scale.clone(),
  }));
  const probe = new THREE.AnimationMixer(actor);
  const action = probe.clipAction(original);
  action.setLoop(THREE.LoopOnce, 1);
  action.clampWhenFinished = true;
  action.reset().play();
  const poses: FootPair[] = [];
  const outputs = new Map<string, Float32Array>();
  for (const [uuid, track] of tracked) outputs.set(uuid, new Float32Array(track.values));
  const accepted: SideStepV5Event[] = [];
  try {
    const sample = (frame: number) => {
      action.time = Math.min(original.duration, frame / FPS);
      probe.update(0);
      actor.updateWorldMatrix(true, true);
    };
    for (let frame = 0; frame < n; frame++) {
      sample(frame);
      const a = actor.worldToLocal(legs[0][2].getWorldPosition(new THREE.Vector3()));
      const b = actor.worldToLocal(legs[1][2].getWorldPosition(new THREE.Vector3()));
      poses.push([[a.x, a.y, a.z], [b.x, b.y, b.z]]);
    }
    const plans = planSideStepsV5(poses, height);
    const maxWindowTravel = [0, 1].map(side => {
      let max = 0, maxLow = 0;
      const floor = q10(poses.map(p => p[side][1]));
      for (let f = 12; f + WINDOW_FRAMES < poses.length - 12; f += 2) {
        const a = poses[f][side], b = poses[f + WINDOW_FRAMES][side];
        const dx = Math.abs(b[0] - a[0]);
        max = Math.max(max, dx);
        if (a[1] - floor < height * 0.035 && b[1] - floor < height * 0.035)
          maxLow = Math.max(maxLow, dx);
      }
      return {side, maxXCm: Math.round(max * 1000) / 10, maxNearFloorXCm: Math.round(maxLow * 1000) / 10,
        minY: Math.round(floor * 1000) / 1000};
    });
    console.info("[mixamo-side-step-v5] plan", JSON.stringify({clip: original.name, height,
      candidates: plans.length, maxWindowTravel, picks: plans}));
    for (const event of plans) {
      const bones = legs[event.side];
      const staged: {frame: number; values: readonly THREE.Quaternion[]}[] = [];
      let maxDelta = 0;
      const liftMeters = height * STEP_LIFT_RATIO;
      let valid = true;
      for (let frame = event.start + 1; frame < event.end; frame++) {
        sample(frame);
        const progress = (frame - event.start) / (event.end - event.start);
        const lift = liftMeters * Math.pow(Math.sin(Math.PI * progress), 1.15);
        const angle = smallStepSolve(actor, bones[0], bones[1], bones[2], lift);
        if (angle === null) {valid = false; break;}
        maxDelta = Math.max(maxDelta, angle);
        staged.push({frame, values: bones.map(bone => bone.quaternion.clone())});
      }
      if (!valid || staged.length < event.end - event.start - 1) {
        console.info("[mixamo-side-step-v5] reject", JSON.stringify({clip:original.name, event, 
          acceptedFrames:staged.length, expectedFrames:event.end-event.start-1}));
        continue;
      }
      for (const pose of staged) bones.forEach((bone, boneIndex) => {
        pose.values[boneIndex].toArray(outputs.get(bone.uuid)!, pose.frame * 4);
      });
      console.info("[mixamo-side-step-v5] baked", JSON.stringify({clip:original.name, event}));
      accepted.push({
        side: event.side === 0 ? "L" : "R",
        startFrame: event.start, endFrame: event.end,
        distanceCm: Math.round(event.distance * 1000) / 10,
        liftCm: Math.round(liftMeters * 1000) / 10,
        maxJointDeltaDeg: Math.round(THREE.MathUtils.radToDeg(maxDelta) * 10) / 10,
      });
    }
  } finally {
    action.stop();
    probe.stopAllAction();
    probe.uncacheRoot(actor);
    rig.bones.forEach((bone, index) => {
      bone.position.copy(saved[index].position);
      bone.quaternion.copy(saved[index].quaternion);
      bone.scale.copy(saved[index].scale);
    });
    actor.updateWorldMatrix(true, true);
  }
  if (!accepted.length) return {clip: original, events: []};
  const tracks = original.tracks.map(track => {
    const uuid = track.name.split(".")[0];
    const output = outputs.get(uuid);
    if (!output) return track.clone();
    return new THREE.QuaternionKeyframeTrack(track.name, track.times, output);
  });
  return {clip: new THREE.AnimationClip(original.name + "-side-step-v5", original.duration, tracks), events: accepted};
}
