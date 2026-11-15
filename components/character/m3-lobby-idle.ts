import * as THREE from "three";

/**
 * M3-only Waiting Room idle. Keeps all motion on the participant's own
 * SkeletonUtils clone; gameplay clock, Mixamo mixers and canonical RoomState
 * never participate in this loop.
 *
 * V1.3: visible weight shift + authored, blended gesture poses. Two-bone IK
 * is solved ONCE when an actor spawns (not continuously). Crucially, the
 * hair-touch target is to the SIDE of the temple, below the top of the head:
 * not above the head as in the old "salute" gesture.
 */
export type M3LobbyGesture = "hair-touch" | "hand-on-hip" | "adjust-outfit" | "shoulder-roll";
export type M3LobbyIdle = {
  elapsedSeconds: number;
  hasScratchPose: boolean; // Existing Stage3D diagnostic contract.
  currentGesture: M3LobbyGesture | null;
  completedGestures: number;
  update(deltaSeconds: number): void;
};

type Pose = { bone: THREE.Bone; rest: THREE.Quaternion; position: THREE.Vector3 };
type ArmPose = { shoulder: THREE.Quaternion; forearm: THREE.Quaternion; hand: THREE.Quaternion };
type GesturePose = {
  side: "L" | "R";
  arm: ArmPose | null;
};
const AXIS_X = new THREE.Vector3(1, 0, 0);
const AXIS_Y = new THREE.Vector3(0, 1, 0);
const AXIS_Z = new THREE.Vector3(0, 0, 1);
const GESTURES: readonly M3LobbyGesture[] = [
  "hair-touch", "hand-on-hip", "adjust-outfit", "shoulder-roll",
];

function hashId(input: string): number {
  let hash = 2166136261;
  for (let index = 0; index < input.length; index++) {
    hash = Math.imul(hash ^ input.charCodeAt(index), 16777619);
  }
  return hash >>> 0;
}
function ease(value: number) {
  const x = THREE.MathUtils.clamp(value, 0, 1);
  return x * x * (3 - 2 * x);
}
function findBone(skeleton: THREE.Skeleton, name: string) {
  const safe = THREE.PropertyBinding.sanitizeNodeName(name);
  return skeleton.bones.find(bone => bone.name === name || bone.name === safe);
}
function aim(bone: THREE.Bone, child: THREE.Bone, target: THREE.Vector3): boolean {
  bone.updateWorldMatrix(true, true);
  const source = bone.getWorldPosition(new THREE.Vector3());
  const current = child.getWorldPosition(new THREE.Vector3()).sub(source);
  const desired = target.clone().sub(source);
  if (current.lengthSq() < 1e-8 || desired.lengthSq() < 1e-8) return false;
  const world = new THREE.Quaternion().setFromUnitVectors(current.normalize(), desired.normalize());
  const parent = bone.parent?.getWorldQuaternion(new THREE.Quaternion()) ?? new THREE.Quaternion();
  const local = parent.clone().invert().multiply(world).multiply(parent);
  bone.quaternion.premultiply(local).normalize();
  bone.updateWorldMatrix(true, true);
  return true;
}

function captureArmGesture(
  shoulder: Pose,
  forearm: Pose,
  hand: Pose,
  target: THREE.Vector3,
  elbowHint: THREE.Vector3,
): ArmPose | null {
  // Source character already has the accepted creator-neutral resting pose.
  // Solve a single reaching pose with preserved upper/lower bone lengths.
  shoulder.bone.updateWorldMatrix(true, true);
  const origin = shoulder.bone.getWorldPosition(new THREE.Vector3());
  const elbow = forearm.bone.getWorldPosition(new THREE.Vector3());
  const wrist = hand.bone.getWorldPosition(new THREE.Vector3());
  const upperLength = origin.distanceTo(elbow);
  const lowerLength = elbow.distanceTo(wrist);
  if (upperLength < 1e-6 || lowerLength < 1e-6) return null;

  const toHand = target.clone().sub(origin);
  const targetDistance = toHand.length();
  if (targetDistance < 1e-6) return null;
  const direction = toHand.normalize();
  const distance = THREE.MathUtils.clamp(
    targetDistance,
    Math.abs(upperLength - lowerLength) + 0.001,
    (upperLength + lowerLength) * 0.97,
  );
  const reachable = origin.clone().addScaledVector(direction, distance);
  const along = (upperLength ** 2 - lowerLength ** 2 + distance ** 2) / (2 * distance);
  const height = Math.sqrt(Math.max(0, upperLength ** 2 - along ** 2));
  const bend = elbowHint.clone().sub(origin);
  bend.addScaledVector(direction, -bend.dot(direction));
  if (bend.lengthSq() < 1e-8) return null;
  bend.normalize();
  const elbowTarget = origin.clone().addScaledVector(direction, along)
    .addScaledVector(bend, height);

  const solved = aim(shoulder.bone, forearm.bone, elbowTarget)
    && aim(forearm.bone, hand.bone, reachable);
  const result = solved ? {
    shoulder: shoulder.bone.quaternion.clone(),
    forearm: forearm.bone.quaternion.clone(),
    hand: hand.bone.quaternion.clone(),
  } : null;
  forearm.bone.quaternion.copy(forearm.rest);
  shoulder.bone.quaternion.copy(shoulder.rest);
  hand.bone.quaternion.copy(hand.rest);
  shoulder.bone.updateWorldMatrix(true, true);
  return result;
}

export function createM3LobbyIdle(
  actor: THREE.Object3D, participantId: string, roomId: string,
): M3LobbyIdle | null {
  let skeleton: THREE.Skeleton | null = null;
  actor.traverse(node => {
    const mesh = node as THREE.SkinnedMesh;
    if (mesh.isSkinnedMesh && (!skeleton || mesh.skeleton.bones.length > skeleton.bones.length)) {
      skeleton = mesh.skeleton;
    }
  });
  if (!skeleton) return null;
  const rig = skeleton as THREE.Skeleton;
  const capture = (name: string): Pose | null => {
    const bone = findBone(rig, name);
    return bone ? { bone, rest: bone.quaternion.clone(), position: bone.position.clone() } : null;
  };
  const hips = capture("hips"), spine = capture("spine"), neck = capture("neck"), head = capture("head");
  const upperL = capture("upper_arm.L"), upperR = capture("upper_arm.R");
  const lowerL = capture("lower_arm.L"), lowerR = capture("lower_arm.R");
  const handL = capture("hand.L"), handR = capture("hand.R");
  const legL = capture("upper_leg.L"), legR = capture("upper_leg.R");
  if (!hips || !spine || !neck || !head || !upperL || !upperR ||
      !lowerL || !lowerR || !handL || !handR || !legL || !legR) return null;

  const seed = hashId(roomId + ":" + participantId);
  const side: "L" | "R" = seed % 2 ? "L" : "R";
  const upper = side === "L" ? upperL : upperR;
  const lower = side === "L" ? lowerL : lowerR;
  const hand = side === "L" ? handL : handR;
  const bodyHeight = new THREE.Box3().setFromObject(actor).getSize(new THREE.Vector3()).y;
  if (!Number.isFinite(bodyHeight) || bodyHeight <= 0) return null;
  actor.updateWorldMatrix(true, true);
  const headWorld = head.bone.getWorldPosition(new THREE.Vector3());
  const hipsWorld = hips.bone.getWorldPosition(new THREE.Vector3());
  const spineWorld = spine.bone.getWorldPosition(new THREE.Vector3());
  const shoulderWorld = upper.bone.getWorldPosition(new THREE.Vector3());
  // Derive rig's actual left/right placement; never infer character from ID.
  const outward = Math.sign(shoulderWorld.x - headWorld.x) || (side === "L" ? -1 : 1);

  // Geometry is proportional to world-space actor height. Hair reaches the
  // outer temple with a visibly bent elbow. Other targets keep arms below
  // shoulder/head height. Every gesture is baked into a safe rest-relative pose.
  const targets: Partial<Record<M3LobbyGesture, GesturePose>> = {};
  const bake = (name: M3LobbyGesture, target: THREE.Vector3, hint: THREE.Vector3) => {
    const arm = captureArmGesture(upper, lower, hand, target, hint);
    if (arm) targets[name] = { side, arm };
  };
  const hint = (sideAmount: number, vertical: number, forward: number) =>
    shoulderWorld.clone().add(new THREE.Vector3(outward * bodyHeight * sideAmount,
      bodyHeight * vertical, bodyHeight * forward));
  bake("hair-touch", headWorld.clone().add(new THREE.Vector3(
    outward * bodyHeight * .071, bodyHeight * .008, bodyHeight * .035)),
    hint(.12, -.055, .060));
  bake("hand-on-hip", hipsWorld.clone().add(new THREE.Vector3(
    outward * bodyHeight * .093, bodyHeight * .040, bodyHeight * .055)),
    hint(.15, -.14, .065));
  bake("adjust-outfit", spineWorld.clone().add(new THREE.Vector3(
    outward * bodyHeight * .042, bodyHeight * .032, bodyHeight * .097)),
    hint(.105, -.075, .12));
  targets["shoulder-roll"] = { side, arm: null };

  const gestureSequence = GESTURES.filter(kind => Boolean(targets[kind]));
  const hasScratchPose = Boolean(targets["hair-touch"]);
  const phase = ((seed >>> 5) % 628) / 100;
  const cycle = 4.75 + ((seed >>> 12) % 80) / 100; // 4.75-5.54s
  const tempo = 2 * Math.PI / cycle;
  const intensity = 0.92 + ((seed >>> 9) % 18) / 100;
  const temp = new THREE.Quaternion();
  const setRotation = (pose: Pose, axis: THREE.Vector3, radians: number) =>
    pose.bone.quaternion.copy(pose.rest).multiply(temp.setFromAxisAngle(axis, radians));
  const addRotation = (pose: Pose, axis: THREE.Vector3, radians: number) =>
    pose.bone.quaternion.multiply(temp.setFromAxisAngle(axis, radians));

  // Never use Math.random: the sequence is deterministic per avatar identity,
  // and doesn't restart on READY/connection metadata updates.
  let ordinal = 0;
  // The FIRST gesture must be visible during an ordinary short iPhone
  // preview; the relaxed shoulder roll is reserved for later cycles.
  let gestureStart = 3.5 + ((seed >>> 8) % 250) / 100;
  let gesture: M3LobbyGesture | null = null;
  let duration = 2.6;
  const schedule = (time: number) => {
    ordinal++;
    // 7-12s of calm idle between gestures; mixed durations 2-3s.
    const waitHash = hashId(participantId + ":" + ordinal + ":" + roomId);
    gestureStart = time + 7 + (waitHash % 501) / 100;
    duration = 2.1 + ((waitHash >>> 11) % 76) / 100;
    gesture = null;
  };

  const runtime: M3LobbyIdle = {
    elapsedSeconds: 0,
    hasScratchPose,
    currentGesture: null,
    completedGestures: 0,
    update(deltaSeconds) {
      runtime.elapsedSeconds += THREE.MathUtils.clamp(deltaSeconds, 0, .1);
      const t = runtime.elapsedSeconds;

      // 5s shifting of weight, hip/shoulder counter-rotation, shoulder
      // relaxed swing and small secondary head movement. Feet stay planted.
      const shift = Math.sin(tempo * t + phase);
      const swing = Math.sin(tempo * t + phase + .65);
      const breath = Math.sin(t * 2.0 + phase * .8);
      setRotation(hips, AXIS_Z, -.050 * shift * intensity);
      setRotation(spine, AXIS_Z, .072 * shift * intensity);
      addRotation(spine, AXIS_X, .022 * breath);
      setRotation(neck, AXIS_Z, -.032 * shift * intensity);
      setRotation(head, AXIS_Y, .050 * Math.sin(t * .76 + phase));
      addRotation(head, AXIS_Z, -.018 * shift);
      setRotation(legL, AXIS_X, .027 * swing);
      setRotation(legR, AXIS_X, -.027 * swing);
      setRotation(upperL, AXIS_X, .115 * swing);
      setRotation(upperR, AXIS_X, -.115 * swing);
      addRotation(upperL, AXIS_Z, .043 * shift);
      addRotation(upperR, AXIS_Z, -.043 * shift);
      setRotation(lowerL, AXIS_Z, .036 * breath);
      setRotation(lowerR, AXIS_Z, -.036 * breath);
      handL.bone.quaternion.copy(handL.rest);
      handR.bone.quaternion.copy(handR.rest);
      // Slight pelvis translation relative to spine (not character root) is
      // avoided to prevent foot skating / sole penetration on the stage.

      if (!gestureSequence.length) return;
      if (!gesture && t >= gestureStart) {
        // Cycle the available gesture catalogue with an individual initial
        // permutation: a room of five avatars won't all choose hair touch.
        const firstGestureIndex = seed % 2; // hair-touch or hand-on-hip first
        gesture = gestureSequence[(ordinal + firstGestureIndex) % gestureSequence.length];
        runtime.currentGesture = gesture;
      }
      if (!gesture) return;

      const local = t - gestureStart;
      if (local >= duration) {
        runtime.completedGestures++;
        runtime.currentGesture = null;
        schedule(t);
        return;
      }
      // Anticipation: ease in .52s, readable hold, smooth release .8s.
      const fadeIn = ease(local / .52);
      const fadeOut = 1 - ease((local - (duration - .80)) / .80);
      const weight = fadeIn * fadeOut;
      const pose = targets[gesture];
      if (!pose || weight <= 0) return;

      if (gesture === "shoulder-roll") {
        // Both shoulders relax backward, then settle with a small nod.
        addRotation(upperL, AXIS_X, -.15 * weight);
        addRotation(upperR, AXIS_X, -.15 * weight);
        addRotation(spine, AXIS_X, -.050 * weight);
        addRotation(head, AXIS_X, .038 * weight);
        return;
      }
      if (!pose.arm) return;
      const arm = pose.side === "L" ? upperL : upperR;
      const forearm = pose.side === "L" ? lowerL : lowerR;
      const palm = pose.side === "L" ? handL : handR;
      arm.bone.quaternion.slerp(pose.arm.shoulder, weight);
      forearm.bone.quaternion.slerp(pose.arm.forearm, weight);
      palm.bone.quaternion.slerp(pose.arm.hand, weight);
      if (gesture === "hair-touch") {
        // This is a SIDE temple brush, not a straight-arm salute.
        addRotation(head, AXIS_Z, -.034 * weight * outward);
        addRotation(palm, AXIS_Z, Math.sin(local * 12) * .06 * weight);
      } else if (gesture === "hand-on-hip") {
        addRotation(spine, AXIS_Z, .065 * weight * outward);
        addRotation(head, AXIS_Y, .030 * weight * outward);
      } else if (gesture === "adjust-outfit") {
        // A small second beat at the chest, like smoothing a shirt collar.
        addRotation(palm, AXIS_X, Math.sin(local * 11) * .045 * weight);
        addRotation(head, AXIS_X, .035 * weight);
      }
    },
  };
  return runtime;
}
