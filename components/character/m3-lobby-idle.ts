import * as THREE from "three";

/**
 * M3 Waiting Room Idle V1.4 — video-reference pose choreography.
 *
 * Only the per-participant SkeletonUtils CLONE is animated. This has no
 * relationship with WebAudio, gameplay AnimationMixer, or RoomState.
 *
 * The most important invariant is dual planted feet: heel/ankle anchors are
 * stored in actor-local space, and the two-bone legs solve for those anchors
 * after each subtle weight shift. Root/formation/camera motion remains owned
 * by WaitingRoomStage3D.
 */
export type M3LobbyGesture =
  | "hand-on-hip"
  | "outfit-adjust"
  | "look-aside"
  | "neck-relax"
  | "hair-brush";

export type M3LobbyIdle = {
  elapsedSeconds: number;
  hasScratchPose: boolean; // Retained for the existing Stage3D debug contract.
  currentGesture: M3LobbyGesture | null;
  completedGestures: number;
  footDrift: number;
  maxFootDrift: number;
  update(deltaSeconds: number): void;
};

type Joint = {
  bone: THREE.Bone;
  rotation: THREE.Quaternion;
  position: THREE.Vector3;
};
type ArmPose = {
  upper: THREE.Quaternion;
  forearm: THREE.Quaternion;
  wrist: THREE.Quaternion;
};
type FootContact = {
  upper: Joint;
  lower: Joint;
  ankle: Joint;
  localAnchor: THREE.Vector3;
  localWorldRotation: THREE.Quaternion;
  poleLocal: THREE.Vector3;
};
type ActionPose = {
  arm: ArmPose | null;
  side: "L" | "R" | null;
};

const X = new THREE.Vector3(1, 0, 0);
const Y = new THREE.Vector3(0, 1, 0);
const Z = new THREE.Vector3(0, 0, 1);

function hashId(input: string): number {
  let result = 2166136261;
  for (let i = 0; i < input.length; i++) {
    result = Math.imul(result ^ input.charCodeAt(i), 16777619);
  }
  return result >>> 0;
}
function ease(t: number): number {
  const x = THREE.MathUtils.clamp(t, 0, 1);
  return x * x * (3 - 2 * x);
}
function keyCurve(phase: number): number {
  // Long, recognisable holds rather than four sine waves in lockstep.
  const keys: readonly [number, number][] = [
    [0, 0], [.14, .1], [.28, .82], [.45, .85],
    [.61, 0], [.77, -.65], [.89, -.60], [1, 0],
  ];
  for (let i = 0; i < keys.length - 1; i++) {
    const [from, a] = keys[i], [to, b] = keys[i + 1];
    if (phase <= to) return THREE.MathUtils.lerp(a, b, ease((phase - from) / (to - from)));
  }
  return 0;
}
function getJoint(skeleton: THREE.Skeleton, name: string): Joint | null {
  const safe = THREE.PropertyBinding.sanitizeNodeName(name);
  const bone = skeleton.bones.find(item => item.name === name || item.name === safe);
  return bone ? { bone, rotation: bone.quaternion.clone(), position: bone.position.clone() } : null;
}
function appendRotation(joint: Joint, axis: THREE.Vector3, rad: number, tmp: THREE.Quaternion) {
  joint.bone.quaternion.multiply(tmp.setFromAxisAngle(axis, rad));
}
function restore(joint: Joint) {
  joint.bone.quaternion.copy(joint.rotation);
  joint.bone.position.copy(joint.position);
}

function aimBone(bone: THREE.Bone, child: THREE.Bone, worldTarget: THREE.Vector3): boolean {
  bone.updateWorldMatrix(true, true);
  const start = bone.getWorldPosition(new THREE.Vector3());
  const before = child.getWorldPosition(new THREE.Vector3()).sub(start);
  const after = worldTarget.clone().sub(start);
  if (before.lengthSq() < 1e-10 || after.lengthSq() < 1e-10) return false;
  const delta = new THREE.Quaternion().setFromUnitVectors(before.normalize(), after.normalize());
  const parentQ = bone.parent?.getWorldQuaternion(new THREE.Quaternion()) ?? new THREE.Quaternion();
  bone.quaternion.premultiply(
    parentQ.clone().invert().multiply(delta).multiply(parentQ),
  ).normalize();
  bone.updateWorldMatrix(true, true);
  return true;
}

/**
 * One two-bone solve. Includes a meaningful elbow/knee pole and an ankle
 * orientation fix so soles stay level. Targets are in world coordinates.
 */
function solveLimb(
  upper: Joint,
  lower: Joint,
  end: Joint,
  target: THREE.Vector3,
  pole: THREE.Vector3,
): boolean {
  upper.bone.updateWorldMatrix(true, true);
  const origin = upper.bone.getWorldPosition(new THREE.Vector3());
  const mid = lower.bone.getWorldPosition(new THREE.Vector3());
  const tip = end.bone.getWorldPosition(new THREE.Vector3());
  const first = origin.distanceTo(mid), second = mid.distanceTo(tip);
  const direction = target.clone().sub(origin);
  const rawDistance = direction.length();
  if (first < 1e-6 || second < 1e-6 || rawDistance < 1e-6) return false;
  direction.normalize();
  const distance = THREE.MathUtils.clamp(rawDistance, Math.abs(first - second) + 1e-6, first + second - 1e-6);
  const projection = (first * first - second * second + distance * distance) / (2 * distance);
  const elevation = Math.sqrt(Math.max(0, first * first - projection * projection));
  const poleDirection = pole.clone().sub(origin);
  poleDirection.addScaledVector(direction, -poleDirection.dot(direction));
  if (poleDirection.lengthSq() < 1e-10) return false;
  const bend = poleDirection.normalize();
  const midTarget = origin.clone().addScaledVector(direction, projection).addScaledVector(bend, elevation);
  const limitedTarget = origin.clone().addScaledVector(direction, distance);
  return aimBone(upper.bone, lower.bone, midTarget)
    && aimBone(lower.bone, end.bone, limitedTarget);
}

function bakeArm(
  upper: Joint, forearm: Joint, wrist: Joint, target: THREE.Vector3, pole: THREE.Vector3,
): ArmPose | null {
  // Arms are posed ONCE at spawn, not continuously re-targeted each frame.
  const success = solveLimb(upper, forearm, wrist, target, pole);
  const posed = success
    ? { upper: upper.bone.quaternion.clone(), forearm: forearm.bone.quaternion.clone(), wrist: wrist.bone.quaternion.clone() }
    : null;
  restore(wrist);
  restore(forearm);
  restore(upper);
  upper.bone.updateWorldMatrix(true, true);
  return posed;
}

function makeContact(
  actor: THREE.Object3D, upper: Joint, lower: Joint, ankle: Joint, height: number, side: number,
): FootContact {
  actor.updateWorldMatrix(true, true);
  const worldPoint = ankle.bone.getWorldPosition(new THREE.Vector3());
  const worldRotation = ankle.bone.getWorldQuaternion(new THREE.Quaternion());
  const actorRotation = actor.getWorldQuaternion(new THREE.Quaternion());
  const knee = lower.bone.getWorldPosition(new THREE.Vector3());
  const forward = new THREE.Vector3(0, 0, 1).transformDirection(actor.matrixWorld);
  const outward = new THREE.Vector3(1, 0, 0).transformDirection(actor.matrixWorld);
  const pole = knee.clone().addScaledVector(forward, height * .12)
    .addScaledVector(outward, side * height * .013);
  return {
    upper, lower, ankle,
    localAnchor: actor.worldToLocal(worldPoint.clone()),
    localWorldRotation: actorRotation.invert().multiply(worldRotation),
    poleLocal: actor.worldToLocal(pole),
  };
}

function solvePlantedFoot(actor: THREE.Object3D, contact: FootContact): number {
  const { upper, lower, ankle } = contact;
  restore(upper); restore(lower); restore(ankle);
  actor.updateWorldMatrix(true, true);
  const footGoal = actor.localToWorld(contact.localAnchor.clone());
  const kneePole = actor.localToWorld(contact.poleLocal.clone());
  solveLimb(upper, lower, ankle, footGoal, kneePole);

  // A bent knee changes the ankle's world orientation; undo that so the shoe
  // follows the original actor heading, not a spinning lower-leg rotation.
  const actorRotation = actor.getWorldQuaternion(new THREE.Quaternion());
  const parentWorld = ankle.bone.parent!.getWorldQuaternion(new THREE.Quaternion());
  ankle.bone.quaternion.copy(
    parentWorld.invert().multiply(actorRotation).multiply(contact.localWorldRotation),
  );
  ankle.bone.updateWorldMatrix(true, true);
  const actual = ankle.bone.getWorldPosition(new THREE.Vector3());
  return actual.distanceTo(footGoal);
}

export function createM3LobbyIdle(actor: THREE.Object3D, participantId: string, roomId: string): M3LobbyIdle | null {
  let skeleton: THREE.Skeleton | null = null;
  actor.traverse(item => {
    const skinned = item as THREE.SkinnedMesh;
    if (skinned.isSkinnedMesh && (!skeleton || skinned.skeleton.bones.length > skeleton.bones.length)) {
      skeleton = skinned.skeleton;
    }
  });
  if (!skeleton) return null;
  const rig = skeleton as THREE.Skeleton;
  const hips = getJoint(rig, "hips"), spine = getJoint(rig, "spine"), neck = getJoint(rig, "neck"), head = getJoint(rig, "head");
  const upperL = getJoint(rig, "upper_arm.L"), upperR = getJoint(rig, "upper_arm.R");
  const foreL = getJoint(rig, "lower_arm.L"), foreR = getJoint(rig, "lower_arm.R");
  const wristL = getJoint(rig, "hand.L"), wristR = getJoint(rig, "hand.R");
  const thighL = getJoint(rig, "upper_leg.L"), thighR = getJoint(rig, "upper_leg.R");
  const shinL = getJoint(rig, "lower_leg.L"), shinR = getJoint(rig, "lower_leg.R");
  const ankleL = getJoint(rig, "foot.L"), ankleR = getJoint(rig, "foot.R");
  if (!hips || !spine || !neck || !head || !upperL || !upperR || !foreL || !foreR ||
    !wristL || !wristR || !thighL || !thighR || !shinL || !shinR || !ankleL || !ankleR) return null;

  actor.updateWorldMatrix(true, true);
  const worldHeight = new THREE.Box3().setFromObject(actor).getSize(new THREE.Vector3()).y;
  const scale = actor.getWorldScale(new THREE.Vector3());
  if (!(worldHeight > 0) || !(scale.y > 0)) return null;
  const localHeight = worldHeight / scale.y;
  const leftContact = makeContact(actor, thighL, shinL, ankleL, worldHeight, 1);
  const rightContact = makeContact(actor, thighR, shinR, ankleR, worldHeight, -1);

  const seed = hashId(roomId + ":" + participantId);
  const side: "L" | "R" = seed & 1 ? "L" : "R";
  const arm = side === "L" ? upperL : upperR;
  const forearm = side === "L" ? foreL : foreR;
  const hand = side === "L" ? wristL : wristR;
  const right = X.clone().transformDirection(actor.matrixWorld);
  const up = Y.clone().transformDirection(actor.matrixWorld);
  const forward = Z.clone().transformDirection(actor.matrixWorld);
  const headW = head.bone.getWorldPosition(new THREE.Vector3());
  const hipsW = hips.bone.getWorldPosition(new THREE.Vector3());
  const spineW = spine.bone.getWorldPosition(new THREE.Vector3());
  const shoulderW = arm.bone.getWorldPosition(new THREE.Vector3());
  const outward = Math.sign(shoulderW.clone().sub(headW).dot(right)) || (side === "L" ? 1 : -1);
  const at = (origin: THREE.Vector3, horizontal: number, vertical: number, depth: number) =>
    origin.clone().addScaledVector(right, horizontal * outward * worldHeight)
      .addScaledVector(up, vertical * worldHeight)
      .addScaledVector(forward, depth * worldHeight);
  const handPoses: Partial<Record<M3LobbyGesture, ArmPose>> = {};
  const pose = (kind: M3LobbyGesture, goal: THREE.Vector3, elbow: THREE.Vector3) => {
    const result = bakeArm(arm, forearm, hand, goal, elbow);
    if (result) handPoses[kind] = result;
  };
  // These targets come from the reference's casual body language, not exact
  // proprietary animation curves or assets.
  pose("hand-on-hip", at(hipsW, .095, .045, .055), at(shoulderW, .145, -.125, .075));
  pose("outfit-adjust", at(spineW, .035, -.095, .095), at(shoulderW, .125, -.135, .090));
  // Optional, low elbow. Side-of-temple hand, NEVER above the head.
  pose("hair-brush", at(headW, .067, -.024, .032), at(shoulderW, .120, -.078, .070));

  const schedule: readonly M3LobbyGesture[] = [
    "look-aside", "hand-on-hip", "outfit-adjust", "neck-relax",
  ];
  // Hair-touch is deliberately excluded until an owner-approved hand-to-hair
  // pose exists. The current video shows it looks too much like a salute.
  const hasScratchPose = Boolean(handPoses["hair-brush"]);
  const tempo = 5.2 + ((seed >>> 12) % 125) / 100;
  const phase = ((seed >>> 6) % 1000) / 1000;
  const localTimeOffset = phase * tempo;
  const q = new THREE.Quaternion();
  let ordinal = 0;
  let gestureAt = 3.0 + ((seed >>> 8) % 280) / 100;
  let duration = 2.65;
  let gesture: M3LobbyGesture | null = null;
  const nextGesture = (now: number) => {
    ordinal++;
    const rand = hashId(roomId + ":" + participantId + ":gesture:" + ordinal);
    gestureAt = now + 7.5 + (rand % 551) / 100;
    duration = 2.45 + ((rand >>> 10) % 80) / 100;
    gesture = null;
  };

  const runtime: M3LobbyIdle = {
    elapsedSeconds: 0, hasScratchPose, currentGesture: null,
    completedGestures: 0, footDrift: 0, maxFootDrift: 0,
    update(deltaSeconds) {
      const delta = THREE.MathUtils.clamp(deltaSeconds, 0, .10);
      runtime.elapsedSeconds += delta;
      const time = runtime.elapsedSeconds;
      const shift = keyCurve(((time + localTimeOffset) / tempo) % 1);
      const inhale = Math.sin(time * 1.67 + phase * 6.28);
      const look = keyCurve(((time * .52 + phase * 3.1) / tempo) % 1);

      // KEY DIFFERENCE from V1.3: hips shift in the source rig's local
      // coordinates. The two planted heels are subsequently solved, and the
      // ankle's world orientation is restored to keep soles flat.
      restore(hips);
      hips.bone.position.x += shift * localHeight * .012;
      hips.bone.position.y -= localHeight * (.012 + Math.abs(shift) * .004);
      appendRotation(hips, Y, .010 * shift, q);

      restore(spine);
      appendRotation(spine, Z, -.040 * shift, q);
      appendRotation(spine, X, .018 * inhale, q);
      restore(neck);
      appendRotation(neck, Z, .022 * shift, q);
      restore(head);
      appendRotation(head, Y, .050 * look, q);
      appendRotation(head, Z, -.014 * shift, q);

      restore(upperL); restore(upperR);
      restore(foreL); restore(foreR);
      restore(wristL); restore(wristR);
      // A small shoulder swing is enough when expressive gestures carry the
      // visual action; don't rotate legs in free-running sine waves.
      appendRotation(upperL, X, .041 * shift, q);
      appendRotation(upperR, X, -.041 * shift, q);
      appendRotation(foreL, Z, .012 * inhale, q);
      appendRotation(foreR, Z, -.012 * inhale, q);

      const driftL = solvePlantedFoot(actor, leftContact);
      const driftR = solvePlantedFoot(actor, rightContact);
      runtime.footDrift = Math.max(driftL, driftR);
      runtime.maxFootDrift = Math.max(runtime.maxFootDrift, runtime.footDrift);

      if (!gesture && time >= gestureAt) {
        gesture = schedule[(ordinal + (seed >>> 4)) % schedule.length];
        runtime.currentGesture = gesture;
      }
      if (!gesture) return;
      const progress = time - gestureAt;
      if (progress >= duration) {
        runtime.completedGestures++;
        runtime.currentGesture = null;
        nextGesture(time);
        return;
      }
      // Anticipate → action → readable hold → settle; not a continuous wave.
      const weight = ease(progress / .52) * (1 - ease((progress - (duration - .83)) / .83));
      if (weight <= 0) return;

      if (gesture === "look-aside") {
        appendRotation(head, Y, .26 * weight * outward, q);
        appendRotation(head, X, -.075 * weight, q);
        appendRotation(spine, Y, .053 * weight * outward, q);
      } else if (gesture === "neck-relax") {
        appendRotation(head, Z, .18 * weight * outward, q);
        appendRotation(neck, X, .070 * weight, q);
        appendRotation(upperL, X, -.10 * weight, q);
        appendRotation(upperR, X, -.10 * weight, q);
      } else {
        const target = handPoses[gesture];
        if (!target) return;
        const raised = side === "L" ? upperL : upperR;
        const elbow = side === "L" ? foreL : foreR;
        const palm = side === "L" ? wristL : wristR;
        raised.bone.quaternion.slerp(target.upper, weight);
        elbow.bone.quaternion.slerp(target.forearm, weight);
        palm.bone.quaternion.slerp(target.wrist, weight);
        if (gesture === "hand-on-hip") {
          appendRotation(head, Y, -.085 * weight * outward, q);
          appendRotation(spine, Z, .075 * weight * outward, q);
        } else if (gesture === "outfit-adjust") {
          appendRotation(palm, X, Math.sin(progress * 12) * .045 * weight, q);
          appendRotation(head, X, .045 * weight, q);
        }
      }
    },
  };
  return runtime;
}
