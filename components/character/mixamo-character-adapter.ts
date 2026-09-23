import * as THREE from "three";

// Source is the existing Quaternius animation rig; target is the skinned
// Casual Grace Mixamo rig. Never copy local quaternions between these rigs.
const BONE_PAIRS = [
  ["pelvis", "Hips"],
  ["spine_01", "Spine"],
  ["spine_02", "Spine1"],
  ["spine_03", "Spine2"],
  ["neck_01", "Neck"],
  ["Head", "Head"],
  ["clavicle_l", "LeftShoulder"],
  ["upperarm_l", "LeftArm"],
  ["lowerarm_l", "LeftForeArm"],
  ["hand_l", "LeftHand"],
  ["clavicle_r", "RightShoulder"],
  ["upperarm_r", "RightArm"],
  ["lowerarm_r", "RightForeArm"],
  ["hand_r", "RightHand"],
  ["thigh_l", "LeftUpLeg"],
  ["calf_l", "LeftLeg"],
  ["foot_l", "LeftFoot"],
  ["ball_l", "LeftToeBase"],
  ["thigh_r", "RightUpLeg"],
  ["calf_r", "RightLeg"],
  ["foot_r", "RightFoot"],
  ["ball_r", "RightToeBase"],
] as const;

export const C1_CASUAL_GRACE_ASSET_URL = "/characters/c1-casual-grace/character.glb";

type RestBone = {
  bone: THREE.Bone;
  position: THREE.Vector3;
  quaternion: THREE.Quaternion;
  localQuaternion: THREE.Quaternion;
  axis: THREE.Vector3;
};

function updateWorld(skeleton: THREE.Skeleton) {
  let top: THREE.Object3D = skeleton.bones[0];
  if (!top) throw new Error("Empty humanoid skeleton");
  while (top.parent) top = top.parent;
  top.updateMatrixWorld(true);
}

function captureRest(skeleton: THREE.Skeleton) {
  skeleton.pose();
  updateWorld(skeleton);
  const byName = new Map<string, RestBone>();
  for (const bone of skeleton.bones) {
    if (byName.has(bone.name)) throw new Error(`Duplicate humanoid bone: ${bone.name}`);
    byName.set(bone.name, {
      bone,
      position: bone.getWorldPosition(new THREE.Vector3()),
      quaternion: bone.getWorldQuaternion(new THREE.Quaternion()).normalize(),
      localQuaternion: bone.quaternion.clone().normalize(),
      axis: bone.children.find((child): child is THREE.Bone => (child as THREE.Bone).isBone)
        ?.position.clone().normalize() ?? new THREE.Vector3(0, 1, 0),
    });
  }
  return byName;
}

type ArmDirectionSetting = {
  sourceChild: string;
  targetChild: string;
  blend: number;
  maxSwingDegrees: number;
};

// Quaternius and Mixamo use different arm bone roll/rest axes. For the arm
// chain, transfer *segment direction* (swing) instead of the full world
// quaternion delta. This deliberately keeps the target rig's own bind-pose
// roll and avoids corkscrew forearms/wrists.
const ARM_DIRECTION_SETTINGS: Record<string, ArmDirectionSetting> = {
  LeftShoulder: { sourceChild: "upperarm_l", targetChild: "LeftArm", blend: 0.35, maxSwingDegrees: 38 },
  RightShoulder: { sourceChild: "upperarm_r", targetChild: "RightArm", blend: 0.35, maxSwingDegrees: 38 },
  LeftArm: { sourceChild: "lowerarm_l", targetChild: "LeftForeArm", blend: 0.95, maxSwingDegrees: 135 },
  RightArm: { sourceChild: "lowerarm_r", targetChild: "RightForeArm", blend: 0.95, maxSwingDegrees: 135 },
  LeftForeArm: { sourceChild: "hand_l", targetChild: "LeftHand", blend: 0.95, maxSwingDegrees: 145 },
  RightForeArm: { sourceChild: "hand_r", targetChild: "RightHand", blend: 0.95, maxSwingDegrees: 145 },
};

const LOCKED_HANDS = new Set(["LeftHand", "RightHand"]);

const HEAD_STABILIZATION: Record<string, { blend: number; swing: number; twist: number }> = {
  Neck: { blend: 0.75, swing: 35, twist: 30 },
  Head: { blend: 0.75, swing: 45, twist: 35 },
};

function semanticMixamoName(value: string) {
  return value.replace(/^mixamorig[:_]?/i, "");
}

function restDirection(from: RestBone, to: RestBone) {
  const direction = to.position.clone().sub(from.position);
  if (direction.lengthSq() < 1e-8) throw new Error(`C1.2 degenerate rest segment: ${from.bone.name}`);
  return direction.normalize();
}

function animatedDirection(from: RestBone, to: RestBone) {
  const direction = to.bone.getWorldPosition(new THREE.Vector3())
    .sub(from.bone.getWorldPosition(new THREE.Vector3()));
  if (direction.lengthSq() < 1e-8) throw new Error(`C1.2 degenerate animated segment: ${from.bone.name}`);
  return direction.normalize();
}

function clampSwing(swing: THREE.Quaternion, maxDegrees: number) {
  const identity = new THREE.Quaternion();
  const angle = identity.angleTo(swing);
  const maximum = THREE.MathUtils.degToRad(maxDegrees);
  if (!(angle > maximum)) return swing;
  return identity.slerp(swing, maximum / angle).normalize();
}

function solveArmDirectionWorld(
  source: RestBone,
  sourceChild: RestBone,
  target: RestBone,
  targetChild: RestBone,
  alignment: THREE.Quaternion,
  alignmentInverse: THREE.Quaternion,
  settings: ArmDirectionSetting,
) {
  const sourceRestDirection = restDirection(source, sourceChild);
  const sourceAnimatedDirection = animatedDirection(source, sourceChild);

  // Transfer only the physical swing of the source segment into the target
  // anatomical world frame. The target's rest quaternion supplies its own
  // bone roll, so Quaternius roll never leaks into Mixamo.
  const sourceSwing = new THREE.Quaternion()
    .setFromUnitVectors(sourceRestDirection, sourceAnimatedDirection)
    .normalize();
  const alignedSwing = alignment.clone()
    .multiply(sourceSwing)
    .multiply(alignmentInverse)
    .normalize();

  const targetRestDirection = restDirection(target, targetChild);
  const targetDesiredDirection = targetRestDirection.clone()
    .applyQuaternion(alignedSwing)
    .normalize();
  let targetSwing = new THREE.Quaternion()
    .setFromUnitVectors(targetRestDirection, targetDesiredDirection)
    .normalize();

  if (settings.blend < 1) {
    targetSwing = new THREE.Quaternion().slerp(targetSwing, settings.blend).normalize();
  }
  targetSwing = clampSwing(targetSwing, settings.maxSwingDegrees);

  return targetSwing.multiply(target.quaternion).normalize();
}

// Face/head quality improved in C1.1, so retain its conservative neck/head
// limiter. Arms no longer use this quaternion swing/twist clamp.
function stabilizeHeadLocal(target: RestBone, candidate: THREE.Quaternion): THREE.Quaternion {
  const settings = HEAD_STABILIZATION[semanticMixamoName(target.bone.name)];
  if (!settings) return candidate;
  const delta = target.localQuaternion.clone().invert().multiply(candidate).normalize();
  const blended = new THREE.Quaternion().slerp(delta, settings.blend).normalize();
  const axis = target.axis.lengthSq() > 0.25 ? target.axis : new THREE.Vector3(0, 1, 0);
  const projection = blended.x * axis.x + blended.y * axis.y + blended.z * axis.z;
  const twist = new THREE.Quaternion(axis.x * projection, axis.y * projection, axis.z * projection, blended.w).normalize();
  const swing = blended.clone().multiply(twist.clone().invert()).normalize();
  const maxSwing = THREE.MathUtils.degToRad(settings.swing);
  const swingAngle = swing.angleTo(new THREE.Quaternion());
  if (swingAngle > maxSwing) {
    swing.slerp(new THREE.Quaternion(), 1 - maxSwing / swingAngle);
  }
  const angle = THREE.MathUtils.euclideanModulo(2 * Math.atan2(projection, blended.w) + Math.PI, 2 * Math.PI) - Math.PI;
  const half = THREE.MathUtils.clamp(angle, -THREE.MathUtils.degToRad(settings.twist),
    THREE.MathUtils.degToRad(settings.twist)) * 0.5;
  const clampedTwist = new THREE.Quaternion(
    axis.x * Math.sin(half), axis.y * Math.sin(half), axis.z * Math.sin(half), Math.cos(half),
  );
  return target.localQuaternion.clone().multiply(swing).multiply(clampedTwist).normalize();
}

function required(rest: Map<string, RestBone>, name: string) {
  const result = rest.get(name);
  if (!result) throw new Error(`C1 retarget skeleton is missing ${name}`);
  return result;
}

function requiredMixamo(rest: Map<string, RestBone>, name: string) {
  // GLTFLoader sanitizes ':' from glTF node names (mixamorig:Hips becomes
  // mixamorigHips); FBX/other loaders may retain it. Always use actual names
  // for output track binding, and canonical names only for lookup.
  const canonical = (value: string) => value.toLowerCase().replace(/^mixamorig[:_]?/, "").replace(/[^a-z0-9]/g, "");
  const matches = [...rest].filter(([candidate]) => canonical(candidate) === canonical(name));
  if (matches.length !== 1) throw new Error(`C1 Mixamo bone ${name}: expected one match, got ${matches.length}`);
  return matches[0][1];
}

function anatomicalBasis(rest: Map<string, RestBone>, hips: string, head: string, leftArm: string, rightArm: string) {
  const up = required(rest, head).position.clone().sub(required(rest, hips).position).normalize();
  const left = required(rest, leftArm).position.clone().sub(required(rest, rightArm).position);
  left.addScaledVector(up, -left.dot(up)).normalize();
  if (up.lengthSq() < 0.9 || left.lengthSq() < 0.9) throw new Error("C1 humanoid anatomical basis is degenerate");
  const forward = left.clone().cross(up).normalize();
  return new THREE.Quaternion().setFromRotationMatrix(
    new THREE.Matrix4().makeBasis(up.clone().cross(forward).normalize(), up, forward),
  ).normalize();
}

/** Bakes canonical presentation clips at 30 FPS into Mixamo bone-local rotations.
 * Neither root nor pelvis translation is output, so the song clock and actor
 * stage position stay independent of the source motion. */
export function retargetQuaterniusClipsToMixamo(
  sourceRoot: THREE.Object3D,
  sourceSkeleton: THREE.Skeleton,
  targetSkeleton: THREE.Skeleton,
  clips: readonly THREE.AnimationClip[],
  fps = 30,
): THREE.AnimationClip[] {
  if (!(fps > 0 && fps <= 60)) throw new Error("Invalid C1 retarget sample rate");
  const sourceRest = captureRest(sourceSkeleton);
  const targetRest = captureRest(targetSkeleton);
  const pairs = BONE_PAIRS.map(([source, target]) => ({
    source: required(sourceRest, source),
    target: requiredMixamo(targetRest, target),
  }));
  const sourceBasis = anatomicalBasis(sourceRest, "pelvis", "Head", "upperarm_l", "upperarm_r");
  const targetBasis = anatomicalBasis(targetRest,
    requiredMixamo(targetRest, "Hips").bone.name,
    requiredMixamo(targetRest, "Head").bone.name,
    requiredMixamo(targetRest, "LeftArm").bone.name,
    requiredMixamo(targetRest, "RightArm").bone.name,
  );
  const alignment = targetBasis.clone().multiply(sourceBasis.clone().invert()).normalize();
  const alignmentInverse = alignment.clone().invert();
  const mixer = new THREE.AnimationMixer(sourceRoot);

  try {
    return clips.map(clip => {
      if (!(clip.duration > 0 && Number.isFinite(clip.duration))) throw new Error(`Invalid C1 clip ${clip.name}`);
      const action = mixer.clipAction(clip);
      action.setLoop(THREE.LoopOnce, 1);
      action.clampWhenFinished = true;
      action.play();
      const frameCount = Math.ceil(clip.duration * fps) + 1;
      const times: number[] = [];
      const values = pairs.map(() => [] as number[]);
      const previous = pairs.map(() => null as THREE.Quaternion | null);

      for (let frame = 0; frame < frameCount; frame += 1) {
        const time = frame === frameCount - 1 ? clip.duration : Math.min(clip.duration, frame / fps);
        times.push(time);
        mixer.setTime(time);
        sourceRoot.updateMatrixWorld(true);
        const desiredWorld = new Map<THREE.Bone, THREE.Quaternion>();

        pairs.forEach(({ source, target }, index) => {
          const parent = target.bone.parent;
          const parentWorld = parent && (parent as THREE.Bone).isBone
            ? desiredWorld.get(parent as THREE.Bone)?.clone()
              ?? required(targetRest, parent.name).quaternion.clone()
            : parent?.getWorldQuaternion(new THREE.Quaternion()).normalize() ?? new THREE.Quaternion();

          const targetName = semanticMixamoName(target.bone.name);
          let local: THREE.Quaternion;

          if (LOCKED_HANDS.has(targetName)) {
            // C1.2 Mode A: do not transfer Quaternius wrist roll. Holding the
            // Mixamo hand at its authored local rest orientation still inherits
            // all forearm motion and removes the visible palm/wrist inversion.
            local = target.localQuaternion.clone();
          } else {
            const armSettings = ARM_DIRECTION_SETTINGS[targetName];
            if (armSettings) {
              const sourceChild = required(sourceRest, armSettings.sourceChild);
              const targetChild = requiredMixamo(targetRest, armSettings.targetChild);
              const desired = solveArmDirectionWorld(
                source, sourceChild, target, targetChild,
                alignment, alignmentInverse, armSettings,
              );
              local = parentWorld.clone().invert().multiply(desired).normalize();
            } else {
              const animated = source.bone.getWorldQuaternion(new THREE.Quaternion()).normalize();
              const worldDelta = animated.multiply(source.quaternion.clone().invert()).normalize();
              const alignedDelta = alignment.clone().multiply(worldDelta).multiply(alignmentInverse).normalize();
              const desired = alignedDelta.multiply(target.quaternion).normalize();
              local = stabilizeHeadLocal(
                target,
                parentWorld.clone().invert().multiply(desired).normalize(),
              );
            }
          }
          if (previous[index] && previous[index].dot(local) < 0) {
            local.set(-local.x, -local.y, -local.z, -local.w);
          }
          previous[index] = local.clone();
          values[index].push(local.x, local.y, local.z, local.w);
          desiredWorld.set(target.bone, parentWorld.clone().multiply(local).normalize());
        });
      }

      action.stop();
      mixer.uncacheClip(clip);
      sourceSkeleton.pose();
      updateWorld(sourceSkeleton);
      return new THREE.AnimationClip(clip.name, clip.duration,
        pairs.map(({ target }, index) => new THREE.QuaternionKeyframeTrack(
          `${target.bone.name}.quaternion`, times, values[index],
        )),
      );
    });
  } finally {
    mixer.stopAllAction();
    mixer.uncacheRoot(sourceRoot);
    sourceSkeleton.pose();
    targetSkeleton.pose();
    updateWorld(sourceSkeleton);
    updateWorld(targetSkeleton);
  }
}
