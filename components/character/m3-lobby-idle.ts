import * as THREE from "three";
import type { M3RigFamily } from "./character-catalog";

/**
 * M3 Waiting Room Idle V1.6 — video-timed empty-hand performances.
 *
 * Only the per-participant SkeletonUtils CLONE is animated. This has no
 * relationship with WebAudio, gameplay AnimationMixer, or RoomState.
 *
 * The most important invariant is dual planted feet: heel/ankle anchors are
 * stored in actor-local space, and the two-bone legs solve for those anchors
 * after each subtle weight shift. Root/formation/camera motion remains owned
 * by WaitingRoomStage3D.
 */
export type M3LobbyGesture = "female-relaxed-greeting" | "male-neck-led-slump";

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


/**
 * V1.6: the MP4 is a sequence of rendered images, not source rig curves.
 * Two deliberately LIMITED, prop-free performances are reconstructed from
 * the owner's 89.23 s selection video:
 *   00–10.5 s relaxed pink-haired female / open palm acknowledgement
 *   55–65 s tired male / neck-led dip, hold and recovery.
 *
 * Position targets are in anatomical shoulder-relative actor directions,
 * not Euler guesses for a foreign rig. Arm IK is solved for EVERY 30 fps
 * source-time sample, not at a handful of distant key poses. Foot IK below
 * remains the accepted independent, post-mixer V1.4 implementation.
 */
type Triple = readonly [number, number, number];
type ReferenceFrame = {
  t: number;
  hipsX: number;
  hipsY: number;
  hipYaw: number;
  spine: Triple;
  neck: Triple;
  head: Triple;
  leftHand: Triple;
  rightHand: Triple;
  leftCurl: number;
  rightCurl: number;
  rightPalm: number;
};
const FEMALE_RECONSTRUCTION: readonly ReferenceFrame[] = [
  {t:0.0, hipsX:-.008,hipsY:-.009,hipYaw:-2,spine:[1,-2,3],neck:[-1,0,-1],head:[-3,-6,3],leftHand:[.065,-.185,.020],rightHand:[.060,-.185,.020],leftCurl:.20,rightCurl:.20,rightPalm:0},
  {t:1.7, hipsX:-.008,hipsY:-.009,hipYaw:-2,spine:[1,-2,3],neck:[-1,0,-1],head:[-3,-6,3],leftHand:[.065,-.185,.020],rightHand:[.060,-.185,.020],leftCurl:.20,rightCurl:.20,rightPalm:0},
  {t:2.9, hipsX:-.004,hipsY:-.013,hipYaw:0,spine:[2,1,2],neck:[-1,0,0],head:[-2,-2,2],leftHand:[.065,-.185,.020],rightHand:[.061,-.184,.030],leftCurl:.20,rightCurl:.15,rightPalm:0},
  {t:3.55,hipsX:.006,hipsY:-.014,hipYaw:3,spine:[0,3,-2],neck:[-2,0,1],head:[-2,5,-1],leftHand:[.065,-.185,.020],rightHand:[.071,-.145,.090],leftCurl:.20,rightCurl:.09,rightPalm:2},
  {t:4.18,hipsX:.011,hipsY:-.009,hipYaw:5,spine:[-1,5,-3],neck:[-2,0,1],head:[-1,10,-2],leftHand:[.064,-.184,.022],rightHand:[.085,-.084,.120],leftCurl:.18,rightCurl:.04,rightPalm:11},
  {t:4.75,hipsX:.013,hipsY:-.007,hipYaw:6,spine:[-1,5,-3],neck:[-2,0,2],head:[-1,11,-3],leftHand:[.064,-.184,.022],rightHand:[.095,-.071,.118],leftCurl:.18,rightCurl:.03,rightPalm:15},
  {t:5.45,hipsX:.013,hipsY:-.008,hipYaw:6,spine:[0,5,-3],neck:[-1,0,1],head:[0,12,-3],leftHand:[.064,-.184,.022],rightHand:[.095,-.072,.116],leftCurl:.18,rightCurl:.03,rightPalm:14},
  {t:6.40,hipsX:.011,hipsY:-.010,hipYaw:5,spine:[1,4,-2],neck:[-1,0,1],head:[0,10,-2],leftHand:[.065,-.184,.022],rightHand:[.090,-.075,.120],leftCurl:.18,rightCurl:.03,rightPalm:9},
  {t:7.18,hipsX:.010,hipsY:-.010,hipYaw:4,spine:[1,4,-2],neck:[-1,0,1],head:[0,10,-2],leftHand:[.065,-.184,.022],rightHand:[.087,-.078,.117],leftCurl:.18,rightCurl:.03,rightPalm:12},
  {t:7.75,hipsX:.003,hipsY:-.011,hipYaw:2,spine:[1,2,0],neck:[0,0,0],head:[-2,5,-1],leftHand:[.065,-.184,.022],rightHand:[.074,-.127,.094],leftCurl:.18,rightCurl:.12,rightPalm:3},
  {t:8.55,hipsX:-.005,hipsY:-.011,hipYaw:0,spine:[2,0,2],neck:[-1,0,0],head:[-3,-2,2],leftHand:[.065,-.185,.020],rightHand:[.064,-.183,.029],leftCurl:.18,rightCurl:.18,rightPalm:0},
  {t:9.40,hipsX:-.008,hipsY:-.009,hipYaw:-2,spine:[1,-2,3],neck:[-1,0,-1],head:[-3,-6,3],leftHand:[.065,-.185,.020],rightHand:[.060,-.185,.020],leftCurl:.20,rightCurl:.20,rightPalm:0},
  {t:10.40,hipsX:-.008,hipsY:-.009,hipYaw:-2,spine:[1,-2,3],neck:[-1,0,-1],head:[-3,-6,3],leftHand:[.065,-.185,.020],rightHand:[.060,-.185,.020],leftCurl:.20,rightCurl:.20,rightPalm:0},
];
const MALE_RECONSTRUCTION: readonly ReferenceFrame[] = [
  {t:0.00,hipsX:0,hipsY:-.005,hipYaw:0,spine:[0,0,0],neck:[1,0,0],head:[-2,2,0],leftHand:[.015,-.205,.065],rightHand:[.015,-.205,.065],leftCurl:.15,rightCurl:.15,rightPalm:0},
  {t:.40,hipsX:0,hipsY:-.006,hipYaw:0,spine:[2,0,0],neck:[7,0,0],head:[5,2,0],leftHand:[.017,-.210,.072],rightHand:[.017,-.210,.072],leftCurl:.15,rightCurl:.15,rightPalm:0},
  {t:1.15,hipsX:-.003,hipsY:-.009,hipYaw:-1,spine:[8,0,1],neck:[18,0,0],head:[22,2,-1],leftHand:[.022,-.212,.080],rightHand:[.022,-.212,.080],leftCurl:.15,rightCurl:.15,rightPalm:0},
  {t:1.85,hipsX:-.003,hipsY:-.012,hipYaw:-1,spine:[9,-1,2],neck:[21,0,0],head:[25,2,-2],leftHand:[.028,-.215,.085],rightHand:[.028,-.215,.085],leftCurl:.15,rightCurl:.15,rightPalm:0},
  {t:2.90,hipsX:-.003,hipsY:-.012,hipYaw:-1,spine:[9,-1,2],neck:[21,0,0],head:[25,2,-2],leftHand:[.028,-.215,.085],rightHand:[.028,-.215,.085],leftCurl:.15,rightCurl:.15,rightPalm:0},
  {t:4.55,hipsX:-.003,hipsY:-.013,hipYaw:-1,spine:[10,-1,2],neck:[21,0,0],head:[24,2,-2],leftHand:[.028,-.215,.086],rightHand:[.028,-.215,.086],leftCurl:.15,rightCurl:.15,rightPalm:0},
  {t:6.25,hipsX:-.003,hipsY:-.013,hipYaw:-1,spine:[10,-1,2],neck:[21,0,0],head:[25,2,-2],leftHand:[.028,-.215,.086],rightHand:[.028,-.215,.086],leftCurl:.15,rightCurl:.15,rightPalm:0},
  {t:7.45,hipsX:-.003,hipsY:-.011,hipYaw:-1,spine:[9,-1,2],neck:[20,0,0],head:[23,2,-2],leftHand:[.027,-.215,.086],rightHand:[.027,-.215,.086],leftCurl:.15,rightCurl:.15,rightPalm:0},
  {t:8.08,hipsX:-.002,hipsY:-.009,hipYaw:0,spine:[6,0,1],neck:[13,0,0],head:[13,2,0],leftHand:[.024,-.212,.078],rightHand:[.024,-.212,.078],leftCurl:.15,rightCurl:.15,rightPalm:0},
  {t:8.85,hipsX:0,hipsY:-.003,hipYaw:1,spine:[-2,1,-1],neck:[-3,0,0],head:[-7,5,0],leftHand:[.016,-.203,.064],rightHand:[.016,-.203,.064],leftCurl:.15,rightCurl:.15,rightPalm:0},
  {t:9.45,hipsX:0,hipsY:-.005,hipYaw:0,spine:[0,0,0],neck:[1,0,0],head:[-2,2,0],leftHand:[.015,-.205,.065],rightHand:[.015,-.205,.065],leftCurl:.15,rightCurl:.15,rightPalm:0},
  {t:10.20,hipsX:0,hipsY:-.005,hipYaw:0,spine:[0,0,0],neck:[1,0,0],head:[-2,2,0],leftHand:[.015,-.205,.065],rightHand:[.015,-.205,.065],leftCurl:.15,rightCurl:.15,rightPalm:0},
];

function easedInterval(t: number): number {
  const x = THREE.MathUtils.clamp(t, 0, 1);
  return x * x * x * (x * (x * 6 - 15) + 10);
}
function mixTriple(a: Triple, b: Triple, t: number): Triple {
  return [THREE.MathUtils.lerp(a[0], b[0], t), THREE.MathUtils.lerp(a[1], b[1], t), THREE.MathUtils.lerp(a[2], b[2], t)];
}
function sampleReference(frames: readonly ReferenceFrame[], t: number): ReferenceFrame {
  let index = 0;
  while (index < frames.length - 2 && t > frames[index + 1].t) index++;
  const a = frames[index], b = frames[index + 1];
  const blend = easedInterval((t - a.t) / (b.t - a.t));
  return {
    t,
    hipsX:THREE.MathUtils.lerp(a.hipsX,b.hipsX,blend),
    hipsY:THREE.MathUtils.lerp(a.hipsY,b.hipsY,blend),
    hipYaw:THREE.MathUtils.lerp(a.hipYaw,b.hipYaw,blend),
    spine:mixTriple(a.spine,b.spine,blend),neck:mixTriple(a.neck,b.neck,blend),head:mixTriple(a.head,b.head,blend),
    leftHand:mixTriple(a.leftHand,b.leftHand,blend),
    rightHand:mixTriple(a.rightHand,b.rightHand,blend),
    leftCurl:THREE.MathUtils.lerp(a.leftCurl,b.leftCurl,blend),
    rightCurl:THREE.MathUtils.lerp(a.rightCurl,b.rightCurl,blend),
    rightPalm:THREE.MathUtils.lerp(a.rightPalm,b.rightPalm,blend),
  };
}
type AnimatedJoint = "hips" | "spine" | "neck" | "head"
  | "upper_arm.L" | "lower_arm.L" | "hand.L"
  | "upper_arm.R" | "lower_arm.R" | "hand.R";
type FingerJoint = Joint & { id: string };
function poseQuaternion(joint: Joint, degrees: Triple) {
  joint.bone.quaternion.copy(joint.rotation)
    .multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(
      THREE.MathUtils.degToRad(degrees[0]),
      THREE.MathUtils.degToRad(degrees[1]),
      THREE.MathUtils.degToRad(degrees[2]), "XYZ",
    )));
}
function fingerJoints(skeleton: THREE.Skeleton, side: "L" | "R"): FingerJoint[] {
  const selected: FingerJoint[] = [];
  for (const digit of ["index","middle","ring","thumb"]) {
    for (const segment of ["proximal","intermediate","distal"]) {
      const name = digit+"."+segment+"."+side;
      const joint = getJoint(skeleton,name);
      if (joint) selected.push({...joint,id:name});
    }
  }
  return selected;
}

/** Closest separation from a forearm point to the pelvis/shoulder torso axis. */
function distanceToTorso(
  point: THREE.Vector3, pelvis: THREE.Vector3, chest: THREE.Vector3,
): number {
  const axis=chest.clone().sub(pelvis);
  const t=THREE.MathUtils.clamp(point.clone().sub(pelvis).dot(axis)/Math.max(axis.lengthSq(),1e-8),0,1);
  return point.distanceTo(pelvis.clone().addScaledVector(axis,t));
}
function armClearance(
  forearm: Joint, wrist: Joint, pelvis: THREE.Vector3, chest: THREE.Vector3, radius: number,
): number {
  const elbow=forearm.bone.getWorldPosition(new THREE.Vector3());
  const hand=wrist.bone.getWorldPosition(new THREE.Vector3());
  let minimum=Infinity;
  // Forearm + wrist only: upper-arm naturally originates at the torso.
  for(const fraction of [0,.25,.5,.75,1]) {
    const point=elbow.clone().lerp(hand,fraction);
    minimum=Math.min(minimum,distanceToTorso(point,pelvis,chest)-radius);
  }
  return minimum;
}
/**
 * Solve hands OUTSIDE the chest/clothing clearance proxy, by M3 anatomical
 * targets. Pole vectors keep elbows on their own sides of the rib cage.
 * A failed or unsafe solve restores the rig's safe neutral arm pose; never
 * commit an intersecting extreme to the animation curve.
 */
function poseEmptyHand(
  arm: [Joint, Joint, Joint], targetPose: Triple,
  actorAxes: [THREE.Vector3, THREE.Vector3, THREE.Vector3],
  pelvis: THREE.Vector3, chest: THREE.Vector3, bodyRadius: number, height: number,
): number {
  const [upper,forearm,wrist]=arm, [right,up,forward]=actorAxes;
  restore(upper);restore(forearm);restore(wrist);
  upper.bone.updateWorldMatrix(true,true);
  const shoulder=upper.bone.getWorldPosition(new THREE.Vector3());
  const side=Math.sign(shoulder.clone().sub(chest).dot(right)) || 1;
  let minClearance=-Infinity;
  for(let attempt=0;attempt<5;attempt++) {
    restore(upper);restore(forearm);restore(wrist);
    const extra=attempt*.017*height;
    const target=shoulder.clone()
      .addScaledVector(right,side*(targetPose[0]*height+extra))
      .addScaledVector(up,targetPose[1]*height)
      .addScaledVector(forward,targetPose[2]*height+attempt*.007*height);
    const pole=shoulder.clone()
      .addScaledVector(right,side*(.10*height+extra))
      .addScaledVector(up,-.105*height)
      .addScaledVector(forward,.11*height);
    if(!solveLimb(upper,forearm,wrist,target,pole))continue;
    upper.bone.updateWorldMatrix(true,true);
    minClearance=armClearance(forearm,wrist,pelvis,chest,bodyRadius);
    if(minClearance>=.008*height) return minClearance;
  }
  // No validated pose: avoid the V1.5 failure mode of keeping a clipped key.
  restore(upper);restore(forearm);restore(wrist);
  return minClearance;
}
function appendQuaternionTrack(
  tracks: THREE.KeyframeTrack[], joint: Joint, times: number[], samples: THREE.Quaternion[],
) {
  const values:number[]=[];
  let previous:THREE.Quaternion|null=null;
  for(const sample of samples) {
    const q=sample.clone();
    if(previous&&previous.dot(q)<0)q.set(-q.x,-q.y,-q.z,-q.w);
    values.push(q.x,q.y,q.z,q.w);previous=q;
  }
  tracks.push(new THREE.QuaternionKeyframeTrack(joint.bone.uuid+".quaternion",times,values));
}
function buildReferenceClip(
  actor: THREE.Object3D, skeleton: THREE.Skeleton,
  rigFamily: M3RigFamily,
  joints: Record<AnimatedJoint,Joint>,
  localHeight: number, worldHeight: number,
): THREE.AnimationClip {
  const female=rigFamily==="drophunter";
  const frames=female?FEMALE_RECONSTRUCTION:MALE_RECONSTRUCTION;
  const duration=frames[frames.length-1].t;
  const fingers=[
    ...fingerJoints(skeleton,"L"),...fingerJoints(skeleton,"R"),
  ];
  const all=[...Object.values(joints),...fingers];
  const rotations=new Map<THREE.Bone,THREE.Quaternion[]>(all.map(j=>[j.bone,[]]));
  const pelvisPositions:number[]=[];
  const times:number[]=[];
  const actorAxes:[THREE.Vector3,THREE.Vector3,THREE.Vector3]=[
    X.clone().transformDirection(actor.matrixWorld),
    Y.clone().transformDirection(actor.matrixWorld),
    Z.clone().transformDirection(actor.matrixWorld),
  ];
  // The hand clearance capsule is based on this specific actor's shoulder
  // width, not a female-sized hardcoded radius reused on the male outfit.
  const shoulderL=joints["upper_arm.L"].bone,shoulderR=joints["upper_arm.R"].bone;
  const width=shoulderL.getWorldPosition(new THREE.Vector3())
    .distanceTo(shoulderR.getWorldPosition(new THREE.Vector3()));
  const bodyRadius=Math.min(worldHeight*.13,width*.38)+worldHeight*.016;
  const sampleCount=Math.round(duration*30);
  for(let index=0;index<=sampleCount;index++) {
    const time=duration*index/sampleCount;
    const frame=sampleReference(frames,time);
    times.push(time);
    for(const joint of all)restore(joint);
    const hips=joints.hips;
    hips.bone.position.copy(hips.position).add(new THREE.Vector3(
      localHeight*frame.hipsX,localHeight*frame.hipsY,0,
    ));
    poseQuaternion(hips,[0,frame.hipYaw,0]);
    poseQuaternion(joints.spine,frame.spine);
    poseQuaternion(joints.neck,frame.neck);
    poseQuaternion(joints.head,frame.head);
    actor.updateWorldMatrix(true,true);
    const pelvis=hips.bone.getWorldPosition(new THREE.Vector3());
    const chest=shoulderL.getWorldPosition(new THREE.Vector3()).add(
      shoulderR.getWorldPosition(new THREE.Vector3())
    ).multiplyScalar(.5);
    // This selection video's waving/open-palm hand is viewer-right.
    // M3's anatomical .L hand appears viewer-right in the stage front view;
    // the source frame controls retain their authored gesture/rest labels.
    poseEmptyHand(
      [joints["upper_arm.L"],joints["lower_arm.L"],joints["hand.L"]],
      female?frame.rightHand:frame.leftHand,actorAxes,pelvis,chest,bodyRadius,worldHeight,
    );
    poseEmptyHand(
      [joints["upper_arm.R"],joints["lower_arm.R"],joints["hand.R"]],
      female?frame.leftHand:frame.rightHand,actorAxes,pelvis,chest,bodyRadius,worldHeight,
    );
    if(female) {
      joints["hand.L"].bone.quaternion.multiply(
        new THREE.Quaternion().setFromAxisAngle(Y,THREE.MathUtils.degToRad(frame.rightPalm)),
      );
    }
    for(const finger of fingers) {
      const side=finger.id.endsWith(".L")?"L":"R";
      const relaxed=female
        ? (side==="L"?frame.rightCurl:frame.leftCurl)
        : (side==="L"?frame.leftCurl:frame.rightCurl);
      const curl=finger.id.startsWith("thumb.")?relaxed*.45:relaxed;
      finger.bone.quaternion.copy(finger.rotation).multiply(
        new THREE.Quaternion().setFromAxisAngle(X,curl),
      );
    }
    pelvisPositions.push(hips.bone.position.x,hips.bone.position.y,hips.bone.position.z);
    for(const joint of all)rotations.get(joint.bone)!.push(joint.bone.quaternion.clone());
  }
  for(const joint of all)restore(joint);
  actor.updateWorldMatrix(true,true);
  const tracks:THREE.KeyframeTrack[]=[
    new THREE.VectorKeyframeTrack(joints.hips.bone.uuid+".position",times,pelvisPositions),
  ];
  for(const joint of all)appendQuaternionTrack(tracks,joint,times,rotations.get(joint.bone)!);
  return new THREE.AnimationClip(
    female?"m3-v16-female-relaxed-open-palm-00-10":"m3-v16-male-neck-led-slump-55-65",
    duration,tracks,
  );
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
  const widen=localHeight*(rigFamily==="drophunter"?.026:.012);
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
    animationProfile:rigFamily==="drophunter"?"female-relaxed-greeting":"male-neck-led-slump",
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
        ? (runtime.poseTime>3.55&&runtime.poseTime<8.55?"female-relaxed-greeting":null)
        : (runtime.poseTime>.40&&runtime.poseTime<9.45?"male-neck-led-slump":null);
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
