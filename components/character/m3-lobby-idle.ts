import * as THREE from "three";
import drophunter from "./motion/drophunter.json";
import neurohacker from "./motion/neurohacker.json";
import type { M3RigFamily } from "./character-catalog";

/**
 * M3 Waiting Room Idle V1.7 — offline-reconstructed empty-hand performances.
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
  readonly instanceId: string;
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
  const bone = skeleton.bones.find(item => item.name === name || item.name === safe);
  return bone ? { bone, rotation: bone.quaternion.clone(), position: bone.position.clone() } : null;
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


type BakedTrack = { frames: number[]; values: number[] };
type BakedMotion = { fps: number; lastFrame: number; tracks: Record<string, BakedTrack> };

function buildPerformanceClip(rig: THREE.Skeleton, family: M3RigFamily): THREE.AnimationClip {
  const source: BakedMotion = family === "drophunter" ? drophunter : neurohacker;
  const tracks: THREE.KeyframeTrack[] = [];
  for (const [name, track] of Object.entries(source.tracks)) {
    const times = track.frames.map(frame => frame / source.fps);
    if (name.startsWith("curl.")) {
      const side = name.slice(-1);
      // Both M3 bind poses have fingers along local +/-X, with the palm
      // facing -Y. Bend towards the palm, progressively down the chain.
      const axis = new THREE.Vector3(0, 0, side === "L" ? -1 : 1);
      for (const [digit, flex] of Object.entries({index:.68, middle:.88, ring:1.1, little:1.25, thumb:.36})) {
        for (const [segment, gain] of Object.entries({proximal:1, intermediate:.76, distal:.48})) {
          const joint = getJoint(rig, [digit, segment, side].join("."));
          if (!joint) continue;
          const values = track.values.flatMap(curl => joint.rotation.clone().multiply(
            new THREE.Quaternion().setFromAxisAngle(axis, curl * flex * gain)
          ).toArray());
          tracks.push(new THREE.QuaternionKeyframeTrack(joint.bone.uuid + ".quaternion", times, values));
        }
      }
    } else if (name === "hips.position") {
      const hips = getJoint(rig, "hips");
      if (!hips) continue;
      const origin = hips.position.toArray();
      const positions = track.values.map((offset, index) => origin[index % 3] + offset);
      tracks.push(new THREE.VectorKeyframeTrack(hips.bone.uuid + ".position", times, positions));
    } else {
      const joint = getJoint(rig, name);
      if (joint) {
        // Storage rounds components. Restore unit quaternions before slerp.
        const rotations = new Float32Array(track.values.length);
        const q = new THREE.Quaternion();
        for (let i = 0; i < rotations.length; i += 4) {
          q.fromArray(track.values, i).normalize().toArray(rotations, i);
        }
        tracks.push(new THREE.QuaternionKeyframeTrack(joint.bone.uuid + ".quaternion", times, rotations));
      }
    }
  }
  return new THREE.AnimationClip("m3-v17-" + family, source.lastFrame / source.fps, tracks);
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
  const hips = getJoint(rig, "hips");
  if (!hips || !["spine", "neck", "head", "upper_arm.L", "upper_arm.R", "hand.L", "hand.R"]
    .every(name => getJoint(rig, name))) return null;
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
  // Preserve the accepted planted stance. Offset both
  // contact anchors once at actor creation, never continuously slide them.
  const hipLocal=actor.worldToLocal(hips.bone.getWorldPosition(new THREE.Vector3()));
  const widen=localHeight*(rigFamily==="drophunter"?.026:.012);
  for(const contact of [leftContact,rightContact]){
    const side=Math.sign(contact.localAnchor.x-hipLocal.x)||1;
    contact.localAnchor.x+=side*widen;
  }
  const clip=buildPerformanceClip(rig,rigFamily);
  const mixer=new THREE.AnimationMixer(actor);
  const action=mixer.clipAction(clip);
  action.setLoop(THREE.LoopRepeat,Infinity);
  action.clampWhenFinished=false;
  action.enabled=true;
  action.play();

  const seed=hashId(roomId+":"+participantId);
  // Sample the full cycle so multiple participants can enter different action phases.
  const phase=(seed / 0x100000000) * clip.duration;
  const runtime:M3LobbyIdle={
    instanceId: THREE.MathUtils.generateUUID(),
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
        : (runtime.poseTime>1.30&&runtime.poseTime<10.35?"male-neck-led-slump":null);
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
  // Set the initial phase once, when the actor is created.
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
