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
export const C4_CASUAL_BOY_ASSET_URL = "/characters/c4-casual-boy/character.glb";

type RestBone = {
  bone: THREE.Bone;
  position: THREE.Vector3;
  quaternion: THREE.Quaternion;
  localQuaternion: THREE.Quaternion;
  axis: THREE.Vector3;
};

type ArmChain = {
  sourceUpper: RestBone;
  sourceFore: RestBone;
  sourceHand: RestBone;
  targetUpper: RestBone;
  targetFore: RestBone;
  targetHand: RestBone;
  targetRestNormal: THREE.Vector3;
};

type ArmFrame = {
  upperDirection: THREE.Vector3;
  foreDirection: THREE.Vector3;
  bendNormal: THREE.Vector3;
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

const LOCKED_ARM_JOINTS = new Set(["LeftShoulder", "RightShoulder", "LeftHand", "RightHand"]);

const HEAD_STABILIZATION: Record<string, { blend: number; swing: number; twist: number }> = {
  Neck: { blend: 0.75, swing: 35, twist: 30 },
  Head: { blend: 0.75, swing: 45, twist: 35 },
};

function semanticMixamoName(value: string) {
  return value.replace(/^mixamorig[:_]?/i, "");
}

function restDirection(from: RestBone, to: RestBone) {
  const direction = to.position.clone().sub(from.position);
  if (direction.lengthSq() < 1e-8) throw new Error(`C1.3 degenerate rest segment: ${from.bone.name}`);
  return direction.normalize();
}

function animatedDirection(from: RestBone, to: RestBone) {
  const direction = to.bone.getWorldPosition(new THREE.Vector3())
    .sub(from.bone.getWorldPosition(new THREE.Vector3()));
  if (direction.lengthSq() < 1e-8) throw new Error(`C1.3 degenerate animated segment: ${from.bone.name}`);
  return direction.normalize();
}

function armPlaneNormal(
  upperDirection: THREE.Vector3,
  foreDirection: THREE.Vector3,
  fallback: THREE.Vector3,
) {
  const normal = upperDirection.clone().cross(foreDirection);
  if (normal.lengthSq() < 1e-6) return fallback.clone().normalize();
  return normal.normalize();
}

function makeFrameQuaternion(primaryInput: THREE.Vector3, normalInput: THREE.Vector3) {
  const primary = primaryInput.clone().normalize();
  const normal = normalInput.clone().addScaledVector(primary, -normalInput.dot(primary));
  if (normal.lengthSq() < 1e-6) {
    const helper = Math.abs(primary.y) < 0.9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(0, 0, 1);
    normal.copy(primary).cross(helper);
  }
  normal.normalize();
  const secondary = normal.clone().cross(primary).normalize();
  return new THREE.Quaternion().setFromRotationMatrix(
    new THREE.Matrix4().makeBasis(primary, secondary, normal),
  ).normalize();
}

function solveAbsoluteArmWorld(
  target: RestBone,
  targetRestDirection: THREE.Vector3,
  targetRestNormal: THREE.Vector3,
  desiredDirection: THREE.Vector3,
  desiredNormal: THREE.Vector3,
) {
  // C1/C1.2 incorrectly transferred a delta on top of Casual Grace's authored
  // bind arm direction. That bind pose is already bent downward, so even a
  // correct source delta kept the arm biased toward the Running/Walking bind.
  // C1.3 maps the ABSOLUTE Quaternius segment direction and elbow plane into
  // target anatomical space, then applies that world-frame delta to the
  // target bind quaternion. This removes the bad baseline without changing
  // skin weights or inverse bind matrices.
  const restFrame = makeFrameQuaternion(targetRestDirection, targetRestNormal);
  const desiredFrame = makeFrameQuaternion(desiredDirection, desiredNormal);
  const frameDelta = desiredFrame.multiply(restFrame.invert()).normalize();
  return frameDelta.multiply(target.quaternion).normalize();
}

function buildArmChain(
  sourceRest: Map<string, RestBone>,
  targetRest: Map<string, RestBone>,
  side: "Left" | "Right",
): ArmChain {
  const suffix = side === "Left" ? "l" : "r";
  const sourceUpper = required(sourceRest, `upperarm_${suffix}`);
  const sourceFore = required(sourceRest, `lowerarm_${suffix}`);
  const sourceHand = required(sourceRest, `hand_${suffix}`);
  const targetUpper = requiredMixamo(targetRest, `${side}Arm`);
  const targetFore = requiredMixamo(targetRest, `${side}ForeArm`);
  const targetHand = requiredMixamo(targetRest, `${side}Hand`);
  const targetRestNormal = armPlaneNormal(
    restDirection(targetUpper, targetFore),
    restDirection(targetFore, targetHand),
    new THREE.Vector3(0, 0, side === "Left" ? 1 : -1),
  );
  return { sourceUpper, sourceFore, sourceHand, targetUpper, targetFore, targetHand, targetRestNormal };
}

function animatedArmFrame(
  chain: ArmChain,
  alignment: THREE.Quaternion,
  previousNormal: THREE.Vector3 | null,
): ArmFrame {
  // Map ABSOLUTE source directions. Do not derive a source-rest delta and do
  // not rotate the already-bent Mixamo bind direction by that delta.
  const upperDirection = animatedDirection(chain.sourceUpper, chain.sourceFore)
    .applyQuaternion(alignment)
    .normalize();
  const foreDirection = animatedDirection(chain.sourceFore, chain.sourceHand)
    .applyQuaternion(alignment)
    .normalize();

  let bendNormal = upperDirection.clone().cross(foreDirection);
  if (bendNormal.lengthSq() < 1e-6) {
    bendNormal = previousNormal?.clone() ?? chain.targetRestNormal.clone();
  } else {
    bendNormal.normalize();
    // A plane normal and its negation describe the same plane but produce a
    // 180-degree roll difference. Preserve frame-to-frame sign continuity so
    // an almost-straight elbow cannot flip the entire arm roll.
    if (previousNormal && previousNormal.dot(bendNormal) < 0) bendNormal.negate();
  }

  return { upperDirection, foreDirection, bendNormal: bendNormal.normalize() };
}

// Face/head quality improved in C1.1, so retain its conservative neck/head
// limiter. C1.3 only changes the arm calibration/solve.
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
  const leftArm = buildArmChain(sourceRest, targetRest, "Left");
  const rightArm = buildArmChain(sourceRest, targetRest, "Right");
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
      let previousLeftNormal: THREE.Vector3 | null = null;
      let previousRightNormal: THREE.Vector3 | null = null;

      for (let frame = 0; frame < frameCount; frame += 1) {
        const time = frame === frameCount - 1 ? clip.duration : Math.min(clip.duration, frame / fps);
        times.push(time);
        mixer.setTime(time);
        sourceRoot.updateMatrixWorld(true);

        const leftFrame = animatedArmFrame(leftArm, alignment, previousLeftNormal);
        const rightFrame = animatedArmFrame(rightArm, alignment, previousRightNormal);
        previousLeftNormal = leftFrame.bendNormal.clone();
        previousRightNormal = rightFrame.bendNormal.clone();

        const desiredWorld = new Map<THREE.Bone, THREE.Quaternion>();

        pairs.forEach(({ source, target }, index) => {
          const parent = target.bone.parent;
          const parentWorld = parent && (parent as THREE.Bone).isBone
            ? desiredWorld.get(parent as THREE.Bone)?.clone()
              ?? required(targetRest, parent.name).quaternion.clone()
            : parent?.getWorldQuaternion(new THREE.Quaternion()).normalize() ?? new THREE.Quaternion();

          const targetName = semanticMixamoName(target.bone.name);
          let local: THREE.Quaternion;

          if (LOCKED_ARM_JOINTS.has(targetName)) {
            // Shoulder motion from the source can shift the upper-arm pivot and
            // amplify this asset's non-neutral bind pose. Keep shoulders in the
            // authored target local bind orientation. Hands likewise inherit
            // the solved forearm and retain the asset's own wrist roll.
            local = target.localQuaternion.clone();
          } else if (targetName === "LeftArm" || targetName === "RightArm") {
            const chain = targetName === "LeftArm" ? leftArm : rightArm;
            const armFrame = targetName === "LeftArm" ? leftFrame : rightFrame;
            const desired = solveAbsoluteArmWorld(
              chain.targetUpper,
              restDirection(chain.targetUpper, chain.targetFore),
              chain.targetRestNormal,
              armFrame.upperDirection,
              armFrame.bendNormal,
            );
            local = parentWorld.clone().invert().multiply(desired).normalize();
          } else if (targetName === "LeftForeArm" || targetName === "RightForeArm") {
            const chain = targetName === "LeftForeArm" ? leftArm : rightArm;
            const armFrame = targetName === "LeftForeArm" ? leftFrame : rightFrame;
            const desired = solveAbsoluteArmWorld(
              chain.targetFore,
              restDirection(chain.targetFore, chain.targetHand),
              chain.targetRestNormal,
              armFrame.foreDirection,
              armFrame.bendNormal,
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
