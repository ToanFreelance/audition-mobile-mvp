import * as THREE from "three";
import { fitLobbyGarments } from "./motion/garment-fit";
import drophunter from "./motion/drophunter.json";
import neurohacker from "./motion/neurohacker.json";
import type { M3RigFamily } from "./character-catalog";

import F02 from "./motion/F02.json";
import F03 from "./motion/F03.json";
import F04 from "./motion/F04.json";
import F05 from "./motion/F05.json";
import M02 from "./motion/M02.json";
import M03 from "./motion/M03.json";
import X01 from "./motion/X01.json";
import {
  bridgeBetween,
  ease,
  rigPool,
  stanceAt,
  type IdleId,
  type Shoe,
} from "./motion/stances";
import { selectParticipantIdlePhaseSeconds } from "../multiplayer/lobby-idle-selection";

const sources = {
  F01: drophunter,
  F02,
  F03,
  F04,
  F05,
  M01: neurohacker,
  M02,
  M03,
  X01,
};
export type M3LobbyIdle = {
  readonly instanceId: string;
  elapsedSeconds: number;
  hasScratchPose: boolean; // Retained for the existing Stage3D debug contract.
  currentGesture: IdleId;
  target: IdleId | null;
  contacts: string;
  phase: string;
  floorError: number;
  placement: ReturnType<typeof stanceAt>;
  select(id: IdleId): void;
  request(id: IdleId): void;
  random: boolean;
  completedGestures: number;
  footDrift: number;
  maxFootDrift: number;
  animationProfile: IdleId;
  clipDuration: number;
  poseTime: number;
  update(deltaSeconds: number): void;
  readonly playbackMixer: THREE.AnimationMixer;
  /** QA-only measurement API; never used by production Waiting Room. */
  seekReferenceTime(seconds: number): void;
  projectReferenceJoints(camera: THREE.Camera, width: number, height: number): Record<string, [number, number, number]>;
  dispose(): void;
};

type Joint = {
  bone: THREE.Bone;
  rotation: THREE.Quaternion;
  position: THREE.Vector3;
};
type FootContact = {
  upper: Joint;
  lower: Joint;
  ankle: Joint;
  localAnchor: THREE.Vector3;
  localWorldRotation: THREE.Quaternion;
  poleLocal: THREE.Vector3;
};
function hashId(input: string): number {
  let result = 2166136261;
  for (let i = 0; i < input.length; i++) {
    result = Math.imul(result ^ input.charCodeAt(i), 16777619);
  }
  return result >>> 0;
}
function getJoint(skeleton: THREE.Skeleton, name: string): Joint | null {
  const safe = THREE.PropertyBinding.sanitizeNodeName(name);
  const bone = skeleton.bones.find(
    (item) => item.name === name || item.name === safe,
  );
  return bone
    ? {
        bone,
        rotation: bone.quaternion.clone(),
        position: bone.position.clone(),
      }
    : null;
}
function restore(joint: Joint) {
  joint.bone.quaternion.copy(joint.rotation);
  joint.bone.position.copy(joint.position);
}

// The two leg solves run sequentially in the stage's render tick.
function solveScratch() {
  return {
    origin: new THREE.Vector3(),
    mid: new THREE.Vector3(),
    tip: new THREE.Vector3(),
    direction: new THREE.Vector3(),
    bend: new THREE.Vector3(),
    knee: new THREE.Vector3(),
    end: new THREE.Vector3(),
    start: new THREE.Vector3(),
    before: new THREE.Vector3(),
    after: new THREE.Vector3(),
    delta: new THREE.Quaternion(),
    parent: new THREE.Quaternion(),
    inverse: new THREE.Quaternion(),
    footGoal: new THREE.Vector3(),
    pole: new THREE.Vector3(),
    actorRotation: new THREE.Quaternion(),
  };
}
type SolveScratch = ReturnType<typeof solveScratch>;

function aimBone(
  bone: THREE.Bone,
  child: THREE.Bone,
  target: THREE.Vector3,
  work: SolveScratch,
) {
  bone.getWorldPosition(work.start);
  child.getWorldPosition(work.before).sub(work.start);
  work.after.copy(target).sub(work.start);
  if (work.before.lengthSq() < 1e-10 || work.after.lengthSq() < 1e-10) return;
  work.delta.setFromUnitVectors(
    work.before.normalize(),
    work.after.normalize(),
  );
  bone.parent!.getWorldQuaternion(work.parent);
  work.inverse
    .copy(work.parent)
    .invert()
    .multiply(work.delta)
    .multiply(work.parent);
  bone.quaternion.premultiply(work.inverse).normalize();
}

function solveLimb(contact: FootContact, work: SolveScratch) {
  const { upper, lower, ankle } = contact;
  upper.bone.getWorldPosition(work.origin);
  lower.bone.getWorldPosition(work.mid);
  ankle.bone.getWorldPosition(work.tip);
  const first = work.origin.distanceTo(work.mid),
    second = work.mid.distanceTo(work.tip);
  work.direction.copy(work.footGoal).sub(work.origin);
  const rawDistance = work.direction.length();
  if (Math.min(first, second, rawDistance) < 1e-6) return;
  work.direction.normalize();
  const distance = THREE.MathUtils.clamp(
    rawDistance,
    Math.abs(first - second) + 1e-6,
    first + second - 1e-6,
  );
  const projection =
    (first * first - second * second + distance * distance) / (2 * distance);
  const elevation = Math.sqrt(
    Math.max(0, first * first - projection * projection),
  );
  work.bend.copy(work.pole).sub(work.origin);
  work.bend.addScaledVector(work.direction, -work.bend.dot(work.direction));
  if (work.bend.lengthSq() < 1e-10) return;
  work.knee
    .copy(work.origin)
    .addScaledVector(work.direction, projection)
    .addScaledVector(work.bend.normalize(), elevation);
  work.end.copy(work.origin).addScaledVector(work.direction, distance);
  aimBone(upper.bone, lower.bone, work.knee, work);
  aimBone(lower.bone, ankle.bone, work.end, work);
}

function makeContact(
  actor: THREE.Object3D,
  upper: Joint,
  lower: Joint,
  ankle: Joint,
  height: number,
  side: number,
): FootContact {
  actor.updateWorldMatrix(true, true);
  const worldPoint = ankle.bone.getWorldPosition(new THREE.Vector3());
  const worldRotation = ankle.bone.getWorldQuaternion(new THREE.Quaternion());
  const actorRotation = actor.getWorldQuaternion(new THREE.Quaternion());
  const knee = lower.bone.getWorldPosition(new THREE.Vector3());
  const forward = new THREE.Vector3(0, 0, 1).transformDirection(
    actor.matrixWorld,
  );
  const outward = new THREE.Vector3(1, 0, 0).transformDirection(
    actor.matrixWorld,
  );
  const pole = knee
    .clone()
    .addScaledVector(forward, height * 0.12)
    .addScaledVector(outward, side * height * 0.013);
  return {
    upper,
    lower,
    ankle,
    localAnchor: actor.worldToLocal(worldPoint.clone()),
    localWorldRotation: actorRotation.invert().multiply(worldRotation),
    poleLocal: actor.worldToLocal(pole),
  };
}

function solveFoot(
  actor: THREE.Object3D,
  contact: FootContact,
  work: SolveScratch,
): number {
  const { upper, lower, ankle } = contact;
  restore(upper);
  restore(lower);
  restore(ankle);
  actor.localToWorld(work.footGoal.copy(contact.localAnchor));
  actor.localToWorld(work.pole.copy(contact.poleLocal));
  solveLimb(contact, work);
  actor.getWorldQuaternion(work.actorRotation);
  ankle.bone.parent!.getWorldQuaternion(work.parent);
  ankle.bone.quaternion.copy(
    work.parent
      .invert()
      .multiply(work.actorRotation)
      .multiply(contact.localWorldRotation),
  );
  return ankle.bone.getWorldPosition(work.tip).distanceTo(work.footGoal);
}

type BakedTrack = { frames: number[]; values: number[] };
type BakedMotion = {
  fps: number;
  lastFrame: number;
  sourceFrameCount?: number;
  tracks: Record<string, BakedTrack>;
};

function buildPerformanceClip(
  rig: THREE.Skeleton,
  id: IdleId,
): THREE.AnimationClip {
  const source: BakedMotion = sources[id];
  const tracks: THREE.KeyframeTrack[] = [];
  for (const [name, track] of Object.entries(source.tracks)) {
    const times = track.frames.map((frame) => frame / source.fps);
    if (name.startsWith("curl.")) {
      const side = name.slice(-1);
      // Both M3 bind poses have fingers along local +/-X, with the palm
      // facing -Y. Bend towards the palm, progressively down the chain.
      const axis = new THREE.Vector3(0, 0, side === "L" ? -1 : 1);
      for (const [digit, flex] of Object.entries({
        index: 0.68,
        middle: 0.88,
        ring: 1.1,
        little: 1.25,
        thumb: 0.36,
      })) {
        for (const [segment, gain] of Object.entries({
          proximal: 1,
          intermediate: 0.76,
          distal: 0.48,
        })) {
          const joint = getJoint(rig, [digit, segment, side].join("."));
          if (!joint) continue;
          const values = track.values.flatMap((curl) =>
            joint.rotation
              .clone()
              .multiply(
                new THREE.Quaternion().setFromAxisAngle(
                  axis,
                  curl * flex * gain,
                ),
              )
              .toArray(),
          );
          tracks.push(
            new THREE.QuaternionKeyframeTrack(
              joint.bone.uuid + ".quaternion",
              times,
              values,
            ),
          );
        }
      }
    } else if (name === "hips.position") {
      const hips = getJoint(rig, "hips");
      if (!hips) continue;
      const origin = hips.position.toArray();
      const positions = track.values.map(
        (offset, index) => origin[index % 3] + offset,
      );
      tracks.push(
        new THREE.VectorKeyframeTrack(
          hips.bone.uuid + ".position",
          times,
          positions,
        ),
      );
    } else {
      const joint = getJoint(rig, name);
      if (joint) {
        // Storage rounds components. Restore unit quaternions before slerp.
        const rotations = new Float32Array(track.values.length);
        const q = new THREE.Quaternion();
        for (let i = 0; i < rotations.length; i += 4) {
          q.fromArray(track.values, i).normalize().toArray(rotations, i);
        }
        tracks.push(
          new THREE.QuaternionKeyframeTrack(
            joint.bone.uuid + ".quaternion",
            times,
            rotations,
          ),
        );
      }
    }
  }
  return new THREE.AnimationClip(
    "m3-lobby-" + id,
    (source.sourceFrameCount ?? source.lastFrame) / source.fps,
    tracks,
  );
}

export function createM3LobbyIdle(
  actor: THREE.Object3D,
  participantId: string,
  roomId: string,
  rigFamily: M3RigFamily,
  occupied: () => readonly IdleId[] = () => [],
): M3LobbyIdle | null {
  let skeleton: THREE.Skeleton | null = null;
  actor.traverse((object) => {
    const mesh = object as THREE.SkinnedMesh;
    if (
      mesh.isSkinnedMesh &&
      (!skeleton || mesh.skeleton.bones.length > skeleton.bones.length)
    )
      skeleton = mesh.skeleton;
  });
  if (!skeleton) return null;
  const rig = skeleton as THREE.Skeleton;
  const hips = getJoint(rig, "hips");
  if (
    !hips ||
    ![
      "spine",
      "neck",
      "head",
      "upper_arm.L",
      "upper_arm.R",
      "hand.L",
      "hand.R",
    ].every((name) => getJoint(rig, name))
  )
    return null;
  const leftLeg = getJoint(rig, "upper_leg.L"),
    rightLeg = getJoint(rig, "upper_leg.R");
  const leftShin = getJoint(rig, "lower_leg.L"),
    rightShin = getJoint(rig, "lower_leg.R");
  const leftFoot = getJoint(rig, "foot.L"),
    rightFoot = getJoint(rig, "foot.R");
  if (
    !leftLeg ||
    !rightLeg ||
    !leftShin ||
    !rightShin ||
    !leftFoot ||
    !rightFoot
  )
    return null;
  actor.updateWorldMatrix(true, true);
  const worldHeight = new THREE.Box3()
    .setFromObject(actor)
    .getSize(new THREE.Vector3()).y;
  const worldScale = actor.getWorldScale(new THREE.Vector3());
  if (!(worldHeight > 0) || !(worldScale.y > 0)) return null;
  const localHeight = worldHeight / worldScale.y;
  const leftContact = makeContact(
    actor,
    leftLeg,
    leftShin,
    leftFoot,
    worldHeight,
    1,
  );
  const rightContact = makeContact(
    actor,
    rightLeg,
    rightShin,
    rightFoot,
    worldHeight,
    -1,
  );
  const contacts = [leftContact, rightContact];
  const work = solveScratch();
  const garmentFit =
    rigFamily === "neurohacker" ? fitLobbyGarments(actor) : null;
  const rest = contacts.map((c) => c.localAnchor.clone());
  // Bind-pose shoe vertices give each ankle its own height above the sole.
  // Sample once on assembly; the renderer never scans geometry per frame.
  const sole = [Infinity, Infinity];
  const shoeRadius = [0, 0];
  const vertex = new THREE.Vector3();
  actor.traverse((object) => {
    const mesh = object as THREE.SkinnedMesh;
    if (!mesh.isSkinnedMesh || !mesh.name.includes("m3-shoes")) return;
    for (let i = 0; i < mesh.geometry.attributes.position.count; i++) {
      mesh.getVertexPosition(i, vertex).applyMatrix4(mesh.matrixWorld);
      actor.worldToLocal(vertex);
      const side =
        Math.abs(vertex.x - rest[0].x) < Math.abs(vertex.x - rest[1].x) ? 0 : 1;
      sole[side] = Math.min(sole[side], vertex.y);
      shoeRadius[side] = Math.max(
        shoeRadius[side],
        vertex.distanceTo(rest[side]),
      );
    }
  });
  rest.forEach((point, i) => {
    if (Number.isFinite(sole[i])) point.y -= sole[i];
  });
  const bindPoleX = contacts.map(c => c.poleLocal.x);
  const orientations = contacts.map((c) => c.localWorldRotation.clone());
  const center = (rest[0].x + rest[1].x) / 2;
  const forward = (rest[0].z + rest[1].z) / 2;
  const pool = rigPool[rigFamily];
  const mixer = new THREE.AnimationMixer(actor);
  const actions = new Map(
    pool.map((id) => {
      const clip = buildPerformanceClip(rig, id);
      const action = mixer.clipAction(clip).setLoop(THREE.LoopOnce, 1);
      action.clampWhenFinished = true;
      return [id, action] as const;
    }),
  );
  let seed = hashId(roomId + ":" + participantId) || 1;
  let bag: IdleId[] = [];
  function draw(previous?: IdleId): IdleId {
    if (!bag.length || (bag.length === 1 && bag[0] === previous)) {
      bag = [...pool];
      for (let i = bag.length - 1; i > 0; i--) {
        seed ^= seed << 13;
        seed ^= seed >>> 17;
        seed ^= seed << 5;
        const j = (seed >>> 0) % (i + 1);
        [bag[i], bag[j]] = [bag[j], bag[i]];
      }
    }
    const busy = occupied();
    let index = bag.findIndex((id) => id !== previous && !busy.includes(id));
    if (index < 0) index = bag.findIndex((id) => id !== previous);
    return bag.splice(Math.max(index, 0), 1)[0];
  }
  let id = draw(),
    action = actions.get(id)!.play();
  let placement = stanceAt(id, 0);
  let bridge: ReturnType<typeof bridgeBetween> | null = null;
  let bridgeTime = 0,
    queued: IdleId | null = null;
  let correctionX = 0,
    correctionY = 0;
  const yaw = new THREE.Quaternion(),
    up = new THREE.Vector3(0, 1, 0);
  const pitch = new THREE.Quaternion(),
    across = new THREE.Vector3(1, 0, 0);
  let lastLift = 0,
    settling = 0;
  const originalHips = hips.position;
  const leftArm = getJoint(rig, "upper_arm.L")!.bone;
  const rightArm = getJoint(rig, "upper_arm.R")!.bone;
  const armBase = new THREE.Quaternion(),
    armOffset = new THREE.Quaternion();
  const armAxis = new THREE.Vector3(0, 0, 1);
  let armCorrected = false;
  const actualHips = new THREE.Vector3();
  // Measure the distal finger on the assembled cargo outfit during inertial
  // transitions. The wrist alone can clear the pocket while the fingers enter it.
  const cargoArms = rigFamily === "neurohacker" ? [
    { arm: leftArm, tip: getJoint(rig, "middle.distal.L")?.bone, sign: 1 },
    { arm: rightArm, tip: getJoint(rig, "middle.distal.R")?.bone, sign: -1 },
  ] : [];
  const cargoTip = new THREE.Vector3(), cargoShoulder = new THREE.Vector3();
  const cargoAxis = new THREE.Vector3(), cargoRotation = new THREE.Quaternion();
  function clearCargoPockets(weight: number) {
    actor.worldToLocal(hips!.bone.getWorldPosition(actualHips));
    for (const { arm, tip, sign } of cargoArms) {
      if (!tip) continue;
      actor.worldToLocal(tip.getWorldPosition(cargoTip));
      const relativeY = (cargoTip.y - actualHips.y) / localHeight;
      if (relativeY > 0.08 || relativeY < -0.20) continue;
      const depth = (cargoTip.z - actualHips.z) / localHeight;
      const clearance = 0.177 - Math.max(0, depth - 0.12);
      const deficit = clearance - sign * (cargoTip.x - actualHips.x) / localHeight;
      if (deficit <= 0) continue;
      actor.worldToLocal(arm.getWorldPosition(cargoShoulder));
      const lever = Math.max(0.08, (cargoShoulder.y - cargoTip.y) / localHeight);
      const angle = Math.min(0.36, Math.atan2(deficit, lever)) * weight * sign;
      actor.getWorldQuaternion(cargoRotation);
      cargoAxis.set(0, 0, 1).applyQuaternion(cargoRotation);
      arm.parent!.getWorldQuaternion(cargoRotation);
      cargoAxis.applyQuaternion(cargoRotation.invert());
      arm.quaternion.premultiply(cargoRotation.setFromAxisAngle(cargoAxis, angle));
    }
  }
  const thighPosition = new THREE.Vector3(),
    shinPosition = new THREE.Vector3(),
    anklePosition = new THREE.Vector3();
  const lengths = contacts.map((c) => {
    c.upper.bone.getWorldPosition(thighPosition);
    c.lower.bone.getWorldPosition(shinPosition);
    c.ankle.bone.getWorldPosition(anklePosition);
    return (
      (thighPosition.distanceTo(shinPosition) +
        shinPosition.distanceTo(anklePosition)) /
      worldScale.y
    );
  });
  const phase = selectParticipantIdlePhaseSeconds(
    participantId,
    action.getClip().duration,
    18,
    roomId,
  );
  action.time = phase;
  let incoming: THREE.AnimationAction | null = null;
  // Inertialize the visible chain onto a moving entry action. Store velocity in
  // local joint space, independent of the actor's slot translation, scale and yaw.
  const driven = rig.bones.filter(b => /^(hips|spine|chest|neck|head|shoulder|upper_arm|lower_arm|hand|thumb|index|middle|ring|little)/.test(b.name)).map(bone => ({
    bone, base: bone.quaternion.clone(), previous: bone.quaternion.clone(), exit: new THREE.Quaternion(),
    offset: new THREE.Quaternion(), velocity: new THREE.Quaternion(),
  }));
  const identity = new THREE.Quaternion(), residual = new THREE.Quaternion();
  const exitHips = new THREE.Vector3(), hipOffset = new THREE.Vector3();
  const hipPrevious = new THREE.Vector3(), hipVelocity = new THREE.Vector3();
  // Clamp extrapolation to the finite velocity window before the support changes.
  const baseHips = new THREE.Vector3();
  let restoreBase = false;
  let velocityWindow = 0;
  let exitShift = 0, entryShift = 0, exitDrop = 0, entryDrop = 0;
  const balance = [
    ["hips", -0.64, 0.50], ["spine", 0.46, 0.95], ["chest", 0.36, 0.55],
    ["neck", -0.19, -0.92], ["head", -0.09, -0.70],
    ["shoulder.L", -0.47, 0.25], ["shoulder.R", -0.47, 0.25],
    ["upper_arm.L", 0.78, -0.24], ["upper_arm.R", 0.78, -0.24],
  ] as const;
  const chain = balance.flatMap(([name, roll, flex]) => {
    const joint = getJoint(rig, name);
    return joint ? [{ bone: joint.bone, roll, flex }] : [];
  });
  function begin(next: IdleId, dt: number) {
    queued = null;
    const entry = stanceAt(next, 0);
    bridge = bridgeBetween(placement, entry);
    exitShift = placement.shift;
    entryShift = entry.shift;
    exitDrop = placement.drop;
    entryDrop = entry.drop;
    bridgeTime = 0;
    runtime.target = next;
    velocityWindow = Math.min(5, 0.09 / Math.max(dt, 1 / 120));
    hipVelocity.copy(hips!.bone.position).sub(hipPrevious);
    exitHips.copy(hips!.bone.position);
    for (const j of driven) {
      j.exit.copy(j.bone.quaternion);
      j.velocity.copy(j.previous).invert().multiply(j.exit);
    }
    action.stop();
    incoming = actions.get(next)!.reset().setEffectiveWeight(1).play();
    mixer.update(0);
    baseHips.copy(hips!.bone.position);
    restoreBase = true;
    hipOffset.copy(exitHips).sub(hips!.bone.position);
    for (const j of driven) {
      j.base.copy(j.bone.quaternion);
      j.offset.copy(j.bone.quaternion).invert().multiply(j.exit);
      j.bone.quaternion.copy(j.exit);
    }
    hips!.bone.position.copy(exitHips);
  }
  // These are rig pivots, not surface landmarks; left/right are anatomical.
  const projectedBones = {
    left_shoulder: getJoint(rig, "upper_arm.L")?.bone,
    right_shoulder: getJoint(rig, "upper_arm.R")?.bone,
    left_elbow: getJoint(rig, "lower_arm.L")?.bone,
    right_elbow: getJoint(rig, "lower_arm.R")?.bone,
    left_wrist: getJoint(rig, "hand.L")?.bone,
    right_wrist: getJoint(rig, "hand.R")?.bone,
    left_hip: getJoint(rig, "upper_leg.L")?.bone,
    right_hip: getJoint(rig, "upper_leg.R")?.bone,
    left_knee: getJoint(rig, "lower_leg.L")?.bone,
    right_knee: getJoint(rig, "lower_leg.R")?.bone,
    left_ankle: getJoint(rig, "foot.L")?.bone,
    right_ankle: getJoint(rig, "foot.R")?.bone,
  };
  const referencePoint = new THREE.Vector3();
  const runtime: M3LobbyIdle = {
    instanceId: THREE.MathUtils.generateUUID(),
    playbackMixer: mixer,
    elapsedSeconds: 0,
    hasScratchPose: false,
    currentGesture: id,
    animationProfile: id,
    target: null,
    contacts: "",
    phase: "",
    floorError: 0,
    placement,
    random: true,
    completedGestures: 0,
    footDrift: 0,
    maxFootDrift: 0,
    clipDuration: action.getClip().duration,
    poseTime: phase,
    select(next) {
      if (!actions.has(next)) return;
      hips.bone.position.x -= correctionX;
      hips.bone.position.y -= correctionY;
      correctionX = 0;
      correctionY = 0;
      restoreBase = false;
      armCorrected = false;
      mixer.stopAllAction();
      id = next;
      action = actions.get(id)!.reset().setEffectiveWeight(1).play();
      bridge = null;
      queued = null;
      runtime.target = null;
      runtime.random = false;
      runtime.update(0);
    },
    request(next) {
      if (actions.has(next) && next !== id) queued = next;
    },
    update(deltaSeconds) {
      const dt = THREE.MathUtils.clamp(deltaSeconds, 0, 0.1);
      runtime.elapsedSeconds += dt;
      hips.bone.position.x -= correctionX;
      hips.bone.position.y -= correctionY;
      if (armCorrected) {
        rightArm.quaternion.copy(armBase);
        armCorrected = false;
      }
      if (restoreBase) {
        for (const j of driven) j.bone.quaternion.copy(j.base);
        hips.bone.position.copy(baseHips);
        restoreBase = false;
      }
      let clearanceAngle = 0;
      let cargoWeight = 0;
      if (bridge && runtime.target && incoming) {
        bridgeTime += dt;
        const next = runtime.target;
        if (id === "M01" || next === "M01") {
          cargoWeight = ease(THREE.MathUtils.clamp(Math.min(bridgeTime, bridge.duration - bridgeTime) / 0.12, 0, 1));
        }
        const weight = ease(Math.min(1, bridgeTime / bridge.duration));
        // Start the entry gesture gradually in the last part of settling. The
        // first authored step stays after the bridge and the action keeps its time.
        const ramp = THREE.MathUtils.clamp(1 - (bridge.duration - bridgeTime) / 0.42, 0, 1);
        mixer.update(dt * ease(ramp));
        placement = bridge.sample(bridgeTime);
        const load = placement.shift - THREE.MathUtils.lerp(exitShift, entryShift, weight);
        const compression = placement.drop - THREE.MathUtils.lerp(exitDrop, entryDrop, weight);
        const velocity = velocityWindow * (1 - Math.exp(-bridgeTime / 0.09)) * (1 - weight);
        baseHips.copy(hips.bone.position);
        restoreBase = true;
        for (const j of driven) {
          j.base.copy(j.bone.quaternion);
          j.bone.quaternion.multiply(residual.copy(identity).slerp(j.offset, 1 - weight));
          j.bone.quaternion.multiply(residual.copy(identity).slerp(j.velocity, velocity));
        }
        hips.bone.position.addScaledVector(hipOffset, 1 - weight).addScaledVector(hipVelocity, velocity);
        for (const link of chain) {
          link.bone.quaternion.premultiply(residual.setFromAxisAngle(armAxis, link.roll * load));
          link.bone.quaternion.premultiply(residual.setFromAxisAngle(across, link.flex * compression));
        }
        if ((id === "M03" && next === "M01") || (id === "M01" && next === "M03")) {
          leftArm.quaternion.premultiply(residual.setFromAxisAngle(armAxis, 0.45 * 4 * weight * (1 - weight)));
        }
        // These two paths pass the right pocket between otherwise clear endpoints.
        if (
          (id === "F05" && next === "F01") ||
          (id === "M02" && next === "M01")
        )
          clearanceAngle = -0.3 * 4 * weight * (1 - weight);
        if (bridgeTime >= bridge.duration) {
          id = next;
          action = incoming;
          bridge = null;
          runtime.target = null;
        }
      } else {
        for (const j of driven) j.previous.copy(j.bone.quaternion);
        hipPrevious.copy(hips.bone.position);
        mixer.update(dt);
        placement = stanceAt(id, action.time);
        const finished = action.time >= action.getClip().duration - 1e-6;
        const safe = id === "M03" || (lastLift <= 1e-6 && settling <= 0 && placement.feet.every(f => f[2] < 1e-6));
        if (finished || (queued && safe)) {
          runtime.completedGestures += Number(finished);
          begin(queued ?? (runtime.random ? draw(id) : id), dt);
        }
      }
      if (clearanceAngle) {
        armBase.copy(rightArm.quaternion);
        rightArm.quaternion.premultiply(
          armOffset.setFromAxisAngle(armAxis, clearanceAngle),
        );
        armCorrected = true;
      }
      runtime.placement = placement;
      runtime.currentGesture = id;
      runtime.animationProfile = id;
      runtime.poseTime = bridge ? bridgeTime : action.time;
      runtime.clipDuration = action.getClip().duration;
      correctionX = placement.shift * localHeight;
      correctionY = -placement.drop * localHeight;
      hips.bone.position.x += correctionX;
      hips.bone.position.y += correctionY;
      // Lower the pelvis just enough for the measured leg lengths on this rig.
      for (const [i, c] of contacts.entries()) {
        const shoe: Shoe = placement.feet[i];
        c.localAnchor.set(
          center + shoe[0] * localHeight,
          rest[i].y + shoe[2] * localHeight,
          forward + shoe[1] * localHeight,
        );
        // Aim the knee along the shoe's track when opening the stance. The
        // folded knee opens laterally as the free foot tucks behind the calf.
        const outward = i === 0 ? 1 : -1;
        c.poleLocal.x = bindPoleX[i] + localHeight * (
          0.44 * shoe[0] + 0.09 * Math.sin(shoe[3]) + outward * shoe[2] * 0.85
        );
        // An ankle rotation may lower any sole vertex by at most radius * angle.
        const availablePitch =
          shoeRadius[i] > 0
            ? (shoe[2] * localHeight) / shoeRadius[i]
            : Infinity;
        const solePitch = THREE.MathUtils.clamp(
          placement.pitch[i],
          -availablePitch,
          availablePitch,
        );
        c.localWorldRotation
          .copy(orientations[i])
          .premultiply(pitch.setFromAxisAngle(across, solePitch))
          .premultiply(yaw.setFromAxisAngle(up, shoe[3]));
        actor.worldToLocal(c.upper.bone.getWorldPosition(actualHips));
        const horizontal =
          (actualHips.x - c.localAnchor.x) ** 2 +
          (actualHips.z - c.localAnchor.z) ** 2;
        const ceiling =
          c.localAnchor.y +
          Math.sqrt(Math.max(0, (lengths[i] * 0.998) ** 2 - horizontal));
        const lower = Math.max(0, actualHips.y - ceiling);
        hips.bone.position.y -= lower;
        correctionY -= lower;
      }
      runtime.footDrift = 0;
      runtime.floorError = 0;
      for (const [i, c] of contacts.entries()) {
        const error =
          solveFoot(actor, c, work) / actor.getWorldScale(thighPosition).y;
        if (placement.feet[i][2] < 1e-6)
          runtime.footDrift = Math.max(runtime.footDrift, error);
        actor.worldToLocal(c.ankle.bone.getWorldPosition(anklePosition));
        runtime.floorError = Math.max(
          runtime.floorError,
          rest[i].y - anklePosition.y,
        );
      }
      if (cargoWeight > 0) clearCargoPockets(cargoWeight);
      if (garmentFit) garmentFit.update(placement.feet[1][2]);
      runtime.contacts =
        placement.feet[0][2] > 1e-6
          ? "RIGHT_SUPPORT"
          : placement.feet[1][2] > 1e-6
            ? "LEFT_SUPPORT"
            : "DOUBLE_SUPPORT";
      const lift = Math.max(placement.feet[0][2], placement.feet[1][2]);
      if (lastLift > 1e-6 && lift <= 1e-6) settling = 0.18;
      runtime.phase =
        lift <= 1e-6
          ? settling > 0
            ? "SETTLING"
            : "DOUBLE_SUPPORT"
          : lift < lastLift && lift < 0.009
            ? "LANDING"
            : Math.abs(lift - lastLift) < 1e-8
              ? runtime.contacts
              : placement.feet[0][2] > 0
                ? "LEFT_SWING"
                : "RIGHT_SWING";
      lastLift = lift;
      settling = Math.max(0, settling - dt);
      runtime.maxFootDrift = Math.max(runtime.maxFootDrift, runtime.footDrift);
    },
    seekReferenceTime(seconds) {
      if (bridge || !Number.isFinite(seconds) || seconds < 0) return;
      action.time = THREE.MathUtils.clamp(seconds, 0, action.getClip().duration - 0.0001);
      mixer.update(0);
      runtime.update(0);
    },
    projectReferenceJoints(camera, width, height) {
      if (!(width > 0) || !(height > 0)) return {};
      actor.updateWorldMatrix(true, true);
      camera.updateWorldMatrix(true, false);
      const result: Record<string, [number, number, number]> = {};
      for (const [name, bone] of Object.entries(projectedBones)) {
        if (!bone) continue;
        referencePoint.setFromMatrixPosition(bone.matrixWorld).project(camera);
        if (!Number.isFinite(referencePoint.x) || !Number.isFinite(referencePoint.y)) continue;
        result[name] = [(referencePoint.x + 1) * width / 2,
          (1 - referencePoint.y) * height / 2, 1];
      }
      return result;
    },
    dispose() {
      mixer.stopAllAction();
      mixer.uncacheRoot(actor);
      garmentFit?.dispose();
      hips.bone.position.copy(originalHips);
    },
  };
  runtime.update(0);
  return runtime;
}
