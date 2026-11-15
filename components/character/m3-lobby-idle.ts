import * as THREE from "three";
import type { M3RigFamily } from "./character-catalog";

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
export type M3LobbyGesture = "female-feline-guard" | "male-sleepy-recovery";

export type M3LobbyIdle = {
  elapsedSeconds: number;
  hasScratchPose: boolean; // Retained for the existing Stage3D debug contract.
  currentGesture: M3LobbyGesture | null;
  completedGestures: number;
  footDrift: number;
  maxFootDrift: number;
  animationProfile: M3LobbyGesture;
  clipDuration: number;
  poseTime: number;
  update(deltaSeconds: number): void;
  dispose(): void;
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

type M3ReferenceMotion = "female-feline-guard" | "male-sleepy-recovery";
type GuardPose = "rest" | "low" | "chest" | "cheek" | "high" | "cross";
type Frame = {
  t: number;
  x?: number; y?: number; yaw?: number;
  torso?: [number, number, number]; neck?: [number, number, number]; head?: [number, number, number];
  armL?: GuardPose; armR?: GuardPose; fist?: number;
  lSwing?: [number, number, number]; rSwing?: [number, number, number];
};

/**
 * The key timings below follow the two owner's 30fps video references, not
 * generic ambient sin waves. These are NEW animated poses authored for M3,
 * NOT imported game clips or extracted skeleton keyframes.
 *
 * Female 37–44s: planted wide guard, low bounce/weight shifts, both fists
 * move to cheek height, elbows flare, recover to a low guard.
 * Male 78–88s: upright -> drooping head/spine -> long held doze -> awake
 * shoulder/head rebound -> rest. No hand salute / random gestures.
 */
const FEMALE_REFERENCE: readonly Frame[] = [
  { t: 0,    x: -.015, y: -.032, torso: [2, -3, 5], neck: [-2, 0, -3], head: [-3, -8, 4], armL: "low", armR: "chest", fist: .80 },
  { t: .48,  x: -.020, y: -.039, torso: [5, -5, 7], neck: [-3, 0, -4], head: [-4, -5, 4], armL: "chest", armR: "low", fist: .95 },
  { t: 1.02, x: .015,  y: -.045, torso: [3, 2, -6], neck: [-2, 1, 3], head: [-3, 7, -4], armL: "low", armR: "chest", fist: 1 },
  { t: 1.47, x: .021,  y: -.052, torso: [6, 6, -9], neck: [-4, 0, 3], head: [-5, 11, -5], armL: "chest", armR: "cheek", fist: 1 },
  { t: 1.90, x: -.005, y: -.047, torso: [3, 0, 0], neck: [-4, 0, 0], head: [-7, 0, 0], armL: "cheek", armR: "cheek", fist: 1 },
  { t: 2.36, x: -.006, y: -.021, torso: [-4, -4, 4], neck: [2, 0, -2], head: [-4, -6, 4], armL: "high", armR: "high", fist: 1 },
  { t: 2.92, x: -.003, y: -.020, torso: [-6, 0, 0], neck: [3, 0, 0], head: [-4, 4, 1], armL: "high", armR: "cheek", fist: 1 },
  { t: 3.35, x: .007,  y: -.041, torso: [1, 4, -5], neck: [-2, 0, 3], head: [-2, 10, -3], armL: "cheek", armR: "chest", fist: 1 },
  { t: 3.84, x: -.016, y: -.059, torso: [7, -5, 8], neck: [-3, 2, -4], head: [-7, -8, 4], armL: "low", armR: "cheek", fist: 1 },
  { t: 4.35, x: -.020, y: -.061, torso: [6, -4, 8], neck: [-4, 0, -4], head: [-3, -8, 6], armL: "chest", armR: "low", fist: .98 },
  { t: 4.90, x: .015,  y: -.037, torso: [3, 8, -9], neck: [-3, 0, 4], head: [-4, 10, -5], armL: "cheek", armR: "low", fist: 1 },
  { t: 5.43, x: .023,  y: -.049, torso: [5, 8, -11], neck: [-5, 0, 6], head: [-5, 12, -5], armL: "chest", armR: "cheek", fist: 1 },
  { t: 5.94, x: .006,  y: -.045, torso: [6, 4, -4], neck: [-4, 0, 2], head: [-4, 7, -3], armL: "low", armR: "chest", fist: 1 },
  { t: 6.45, x: -.020, y: -.042, torso: [4, -5, 6], neck: [-3, 0, -3], head: [-4, -8, 4], armL: "chest", armR: "low", fist: .96 },
  { t: 6.96, x: -.018, y: -.036, torso: [2, -4, 6], neck: [-2, 0, -3], head: [-3, -8, 4], armL: "low", armR: "chest", fist: .88 },
  { t: 7.40, x: -.015, y: -.032, torso: [2, -3, 5], neck: [-2, 0, -3], head: [-3, -8, 4], armL: "low", armR: "chest", fist: .80 },
];

const MALE_REFERENCE: readonly Frame[] = [
  { t: 0,    y: -.006, torso: [0, 1, 0], neck: [0, 0, 0], head: [-2, 6, 0], lSwing: [0, 0, 0], rSwing: [0, 0, 0] },
  { t: .72,  y: -.008, torso: [3, 0, 1], neck: [5, 0, 0], head: [10, 2, -2], lSwing: [-2, 0, -2], rSwing: [-2, 0, 2] },
  { t: 1.28, y: -.015, torso: [11, -1, 2], neck: [18, 0, 1], head: [22, 0, -2], lSwing: [-7, 0, -4], rSwing: [-7, 0, 4] },
  { t: 1.96, y: -.019, torso: [16, -3, 4], neck: [24, 0, 1], head: [30, 0, -2], lSwing: [-9, 0, -6], rSwing: [-9, 0, 6] },
  { t: 2.48, y: -.020, torso: [17, -4, 5], neck: [25, 0, 2], head: [34, 0, -4], lSwing: [-9, 0, -7], rSwing: [-9, 0, 7] },
  { t: 3.60, y: -.021, torso: [17, -3, 5], neck: [25, 0, 2], head: [33, 1, -4], lSwing: [-9, 0, -7], rSwing: [-9, 0, 7] },
  { t: 4.42, y: -.022, torso: [18, -3, 6], neck: [24, 0, 2], head: [35, 0, -5], lSwing: [-9, 0, -7], rSwing: [-9, 0, 7] },
  { t: 5.30, y: -.020, torso: [17, -3, 5], neck: [24, 0, 2], head: [32, 0, -4], lSwing: [-9, 0, -7], rSwing: [-9, 0, 7] },
  { t: 6.05, y: -.023, torso: [18, -2, 5], neck: [25, 0, 2], head: [35, -1, -4], lSwing: [-9, 0, -7], rSwing: [-9, 0, 7] },
  { t: 7.20, y: -.020, torso: [17, -2, 5], neck: [24, 0, 2], head: [32, -1, -4], lSwing: [-9, 0, -7], rSwing: [-9, 0, 7] },
  { t: 8.25, y: -.020, torso: [16, -2, 4], neck: [23, 0, 1], head: [29, 1, -3], lSwing: [-7, 0, -6], rSwing: [-7, 0, 6] },
  { t: 8.70, y: -.013, torso: [9, 1, 2], neck: [11, 0, 0], head: [14, 2, 0], lSwing: [-3, 0, -3], rSwing: [-3, 0, 3] },
  { t: 9.10, y: -.003, torso: [-5, 5, -2], neck: [-8, 0, 1], head: [-10, 8, 2], lSwing: [-14, 0, -16], rSwing: [-14, 0, 16] },
  { t: 9.45, y: -.006, torso: [-2, 3, -1], neck: [-3, 0, 0], head: [-6, 8, 1], lSwing: [-6, 0, -8], rSwing: [-6, 0, 8] },
  { t: 9.82, y: -.006, torso: [0, 1, 0], neck: [0, 0, 0], head: [-2, 6, 0], lSwing: [0, 0, 0], rSwing: [0, 0, 0] },
  { t: 10.10,y: -.006, torso: [0, 1, 0], neck: [0, 0, 0], head: [-2, 6, 0], lSwing: [0, 0, 0], rSwing: [0, 0, 0] },
];

type AnimatedJoint = "hips" | "spine" | "neck" | "head"
  | "upper_arm.L" | "lower_arm.L" | "hand.L"
  | "upper_arm.R" | "lower_arm.R" | "hand.R";
type ReferenceJoint = Joint & { id: AnimatedJoint };
type FingerJoint = Joint & { id: string };
function poseQuaternion(joint: Joint, degrees: [number, number, number] | undefined) {
  const v = degrees ?? [0, 0, 0];
  joint.bone.quaternion.copy(joint.rotation)
    .multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(
      THREE.MathUtils.degToRad(v[0]),
      THREE.MathUtils.degToRad(v[1]),
      THREE.MathUtils.degToRad(v[2]), "XYZ",
    )));
}

function fingerJoints(skeleton: THREE.Skeleton, side: "L"|"R"): FingerJoint[] {
  const selected: FingerJoint[] = [];
  for (const digit of ["index", "middle", "ring", "thumb"]) {
    for (const segment of ["proximal", "intermediate", "distal"]) {
      const name = digit + "." + segment + "." + side;
      const joint = getJoint(skeleton, name);
      if (joint) selected.push({ ...joint, id: name });
    }
  }
  return selected;
}

function setHand(
  actor: THREE.Object3D,
  upper: Joint, forearm: Joint, wrist: Joint,
  name: GuardPose, side: "L"|"R", height: number,
  right: THREE.Vector3, up: THREE.Vector3, forward: THREE.Vector3,
  spine: Joint, head: Joint,
) {
  if (name === "rest") return;
  upper.bone.updateWorldMatrix(true, true);
  const shoulderW = upper.bone.getWorldPosition(new THREE.Vector3());
  const headW = head.bone.getWorldPosition(new THREE.Vector3());
  const outward = Math.sign(shoulderW.clone().sub(headW).dot(right)) || (side==="L"?1:-1);
  let target: THREE.Vector3;
  let hint: THREE.Vector3;
  const place = (base: THREE.Vector3,x:number,y:number,z:number) =>
    base.clone().addScaledVector(right,outward*x*height).addScaledVector(up,y*height).addScaledVector(forward,z*height);
  if (name==="cheek") {
    target=place(headW,.038,-.072,.069);
    hint=place(shoulderW,.065,-.200,.070);
  } else if (name==="high"){
    target=place(headW,.061,-.050,.064);
    hint=place(shoulderW,.077,-.160,.072);
  } else if (name==="cross"){
    target=place(shoulderW,-.065,-.085,.145);
    hint=place(shoulderW,.065,-.085,.090);
  } else if(name==="chest"){
    target=place(shoulderW,-.028,-.078,.126);
    hint=place(shoulderW,.084,-.103,.085);
  } else {
    target=place(shoulderW,-.016,-.124,.108);
    hint=place(shoulderW,.073,-.139,.087);
  }
  if (solveLimb(upper,forearm,wrist,target,hint)) {
    // Stable fist-facing pose; fingers are keyed independently.
    wrist.bone.quaternion.multiply(
      new THREE.Quaternion().setFromAxisAngle(Z,outward*-.24),
    );
  }
}

function appendQuaternionTrack(
  tracks: THREE.KeyframeTrack[], joint: Joint, times: number[], samples: THREE.Quaternion[],
) {
  const values: number[]=[];
  let previous: THREE.Quaternion|null=null;
  for (const value of samples) {
    const q=value.clone();
    if (previous&&previous.dot(q)<0) q.set(-q.x,-q.y,-q.z,-q.w);
    values.push(q.x,q.y,q.z,q.w);
    previous=q;
  }
  tracks.push(new THREE.QuaternionKeyframeTrack(joint.bone.uuid+".quaternion",times,values));
}

function buildReferenceClip(
  actor: THREE.Object3D, skeleton: THREE.Skeleton,
  rigFamily: M3RigFamily,
  joints: Record<AnimatedJoint,Joint>,
  localHeight: number, worldHeight: number,
): THREE.AnimationClip {
  const isFemale = rigFamily==="drophunter";
  const frames=isFemale?FEMALE_REFERENCE:MALE_REFERENCE;
  const times=frames.map(f=>f.t);
  const animated = Object.values(joints);
  const fingers = isFemale
    ? [...fingerJoints(skeleton,"L"),...fingerJoints(skeleton,"R")]
    : [];
  const all=[...animated,...fingers];
  const rotations=new Map<THREE.Bone,THREE.Quaternion[]>(
    all.map(j=>[j.bone,[]])
  );
  const pelvisPositions:number[]=[];
  const right=X.clone().transformDirection(actor.matrixWorld);
  const up=Y.clone().transformDirection(actor.matrixWorld);
  const forward=Z.clone().transformDirection(actor.matrixWorld);

  for (const frame of frames) {
    for (const joint of all) restore(joint);
    const pelvis=joints.hips;
    pelvis.bone.position.copy(pelvis.position).add(new THREE.Vector3(
      localHeight*(frame.x??0),
      localHeight*(frame.y??0),
      0,
    ));
    poseQuaternion(pelvis,[0,frame.yaw??0,0]);
    poseQuaternion(joints.spine,frame.torso);
    poseQuaternion(joints.neck,frame.neck);
    poseQuaternion(joints.head,frame.head);
    if (isFemale) {
      actor.updateWorldMatrix(true,true);
      setHand(actor,joints["upper_arm.L"],joints["lower_arm.L"],joints["hand.L"],frame.armL??"low","L",worldHeight,right,up,forward,joints.spine,joints.head);
      setHand(actor,joints["upper_arm.R"],joints["lower_arm.R"],joints["hand.R"],frame.armR??"low","R",worldHeight,right,up,forward,joints.spine,joints.head);
      const flex=frame.fist??0;
      for (const finger of fingers) {
        const isThumb=finger.bone.name.startsWith("thumb.");
        const isProx=finger.bone.name.includes(".proximal.");
        const isMid=finger.bone.name.includes(".intermediate.");
        const radians = flex*(isThumb?.38:isProx?.75:isMid?.85:.39);
        finger.bone.quaternion.copy(finger.rotation)
          .multiply(new THREE.Quaternion().setFromAxisAngle(X,radians));
      }
    } else {
      poseQuaternion(joints["upper_arm.L"],frame.lSwing);
      poseQuaternion(joints["upper_arm.R"],frame.rSwing);
      poseQuaternion(joints["lower_arm.L"],[(frame.t>=1.2&&frame.t<=8.5)?-6:0,0,-3]);
      poseQuaternion(joints["lower_arm.R"],[(frame.t>=1.2&&frame.t<=8.5)?-6:0,0,3]);
      poseQuaternion(joints["hand.L"],[3,0,0]);
      poseQuaternion(joints["hand.R"],[3,0,0]);
    }
    pelvisPositions.push(
      pelvis.bone.position.x,pelvis.bone.position.y,pelvis.bone.position.z,
    );
    for(const joint of all)rotations.get(joint.bone)!.push(joint.bone.quaternion.clone());
  }
  // The animation track data is copied; restore the source rest pose before
  // mixer playback starts. Never modify the shared M3 catalog asset.
  for (const joint of all) restore(joint);
  actor.updateWorldMatrix(true,true);
  const tracks:THREE.KeyframeTrack[]=[
    new THREE.VectorKeyframeTrack(joints.hips.bone.uuid+".position",times,pelvisPositions),
  ];
  for(const joint of all)appendQuaternionTrack(tracks,joint,times,rotations.get(joint.bone)!);
  const clip=new THREE.AnimationClip(
    isFemale?"m3-ref-feline-boxer-37-44":"m3-ref-sleepy-recover-78-88",
    frames[frames.length-1].t,
    tracks,
  );
  return clip;
}

export function createM3LobbyIdle(
  actor:THREE.Object3D,participantId:string,roomId:string,rigFamily:M3RigFamily,
):M3LobbyIdle|null{
  let skeleton:THREE.Skeleton|null=null;
  actor.traverse(object=>{
    const mesh=object as THREE.SkinnedMesh;
    if(mesh.isSkinnedMesh&&(!skeleton||mesh.skeleton.bones.length>skeleton.bones.length))
      skeleton=mesh.skeleton;
  });
  if(!skeleton)return null;
  const rig=skeleton as THREE.Skeleton;
  const names:readonly AnimatedJoint[]=[
    "hips","spine","neck","head",
    "upper_arm.L","lower_arm.L","hand.L",
    "upper_arm.R","lower_arm.R","hand.R",
  ];
  const mapped:Partial<Record<AnimatedJoint,Joint>>={};
  for (const name of names) {
    const joint=getJoint(rig,name);
    if(!joint)return null;
    mapped[name]=joint;
  }
  const joints=mapped as Record<AnimatedJoint,Joint>;
  const leftLeg=getJoint(rig,"upper_leg.L"),rightLeg=getJoint(rig,"upper_leg.R");
  const leftShin=getJoint(rig,"lower_leg.L"),rightShin=getJoint(rig,"lower_leg.R");
  const leftFoot=getJoint(rig,"foot.L"),rightFoot=getJoint(rig,"foot.R");
  if(!leftLeg||!rightLeg||!leftShin||!rightShin||!leftFoot||!rightFoot)return null;
  actor.updateWorldMatrix(true,true);
  const worldHeight=new THREE.Box3().setFromObject(actor).getSize(new THREE.Vector3()).y;
  const worldScale=actor.getWorldScale(new THREE.Vector3());
  if(!(worldHeight>0)||!(worldScale.y>0))return null;
  const localHeight=worldHeight/worldScale.y;
  const leftContact=makeContact(actor,leftLeg,leftShin,leftFoot,worldHeight,1);
  const rightContact=makeContact(actor,rightLeg,rightShin,rightFoot,worldHeight,-1);
  // Reference female keeps a boxer-wide, planted stance. We widen BOTH
  // contact anchors once at actor creation, never continuously slide them.
  const hipLocal=actor.worldToLocal(joints.hips.bone.getWorldPosition(new THREE.Vector3()));
  const widen=localHeight*(rigFamily==="drophunter"?.042:.012);
  for(const contact of [leftContact,rightContact]){
    const side=Math.sign(contact.localAnchor.x-hipLocal.x)||1;
    contact.localAnchor.x+=side*widen;
  }
  const clip=buildReferenceClip(actor,rig,rigFamily,joints,localHeight,worldHeight);
  const mixer=new THREE.AnimationMixer(actor);
  const action=mixer.clipAction(clip);
  action.setLoop(THREE.LoopRepeat,Infinity);
  action.clampWhenFinished=false;
  action.enabled=true;
  action.play();

  const seed=hashId(roomId+":"+participantId);
  // Small deterministic desynchronization in multiplayer while single-avatar
  // preview starts at the reference's neutral first pose.
  const phase=((seed>>>5)%220)/100;
  const runtime:M3LobbyIdle={
    elapsedSeconds:0,hasScratchPose:false,
    currentGesture:null,completedGestures:0,footDrift:0,maxFootDrift:0,
    animationProfile:rigFamily==="drophunter"?"female-feline-guard":"male-sleepy-recovery",
    clipDuration:clip.duration,
    poseTime:0,
    update(deltaSeconds){
      const delta=THREE.MathUtils.clamp(deltaSeconds,0,.10);
      runtime.elapsedSeconds+=delta;
      const before=mixer.time;
      mixer.update(delta);
      runtime.poseTime=mixer.time%clip.duration;
      if(Math.floor((before+delta)/clip.duration)>Math.floor(before/clip.duration))
        runtime.completedGestures++;
      runtime.currentGesture=rigFamily==="drophunter"
        ? (runtime.poseTime>1.45&&runtime.poseTime<5.90?"female-feline-guard":null)
        : (runtime.poseTime>1.20&&runtime.poseTime<9.18?"male-sleepy-recovery":null);
      // The clip does not animate thighs: only pelvis is translated; foot IK
      // runs after the clip to keep both shoes planted on existing stage rings.
      const driftL=solvePlantedFoot(actor,leftContact);
      const driftR=solvePlantedFoot(actor,rightContact);
      runtime.footDrift=Math.max(driftL,driftR);
      runtime.maxFootDrift=Math.max(runtime.maxFootDrift,runtime.footDrift);
    },
    dispose(){
      mixer.stopAllAction();
      mixer.uncacheClip(clip);
      mixer.uncacheRoot(actor);
    },
  };
  // The first frames are deterministic, but 5-player fixtures are staggered
  // by a small offset without rebuilding actor/AnimationMixer on READY.
  if(phase>0){
    // update() is intentionally limited to 100 ms per render frame.
    // Seed the mixer directly or different participants collapse to the
    // same initial frame and dance in unwanted synchrony.
    mixer.setTime(phase);
    runtime.elapsedSeconds=phase;
    runtime.poseTime=phase;
  }
  runtime.update(0); // Set planted feet before the very first visible frame.
  return runtime;
}
