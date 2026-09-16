import * as THREE from "three";
import { FBXLoader } from "three/examples/jsm/loaders/FBXLoader.js";

export const RUNTIME_ANIMATION_FPS = 30;

const TARGET_TO_MIXAMO = [
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

type RestPose = {
  bone: THREE.Bone;
  worldQuaternion: THREE.Quaternion;
  worldPosition: THREE.Vector3;
};

type RigSnapshot = {
  restByCanonical: Map<string, RestPose>;
  basis: THREE.Quaternion;
};

export type RuntimeAnimationBakeResult = {
  clip: THREE.AnimationClip;
  sourceDurationSeconds: number;
  outputDurationSeconds: number;
  fps: number;
  trackCount: number;
  strippedRootTranslation: true;
};

/**
 * Bake one owner-acquired Mixamo FBX into target-rig quaternion tracks.
 *
 * This intentionally produces rotation-only clips: gameplay timing owns when a
 * presentation starts, while animation source root motion must never move or
 * stretch the authoritative rhythm/gameplay timeline.
 */
export function bakeMixamoRuntimeClip(
  targetSkeleton: THREE.Skeleton,
  sourceBuffer: ArrayBuffer,
  outputClipName: string,
  fps = RUNTIME_ANIMATION_FPS,
): RuntimeAnimationBakeResult {
  if (!Number.isFinite(fps) || fps <= 0) throw new Error("Runtime bake FPS must be positive");

  targetSkeleton.pose();
  updateSkeletonWorld(targetSkeleton);
  const targetRig = captureTargetRig(targetSkeleton);

  const sourceRoot = new FBXLoader().parse(sourceBuffer, "");
  const sourceClip = sourceRoot.animations[0];
  if (!sourceClip) throw new Error("Mixamo FBX contains no animation clip");

  sourceRoot.updateMatrixWorld(true);
  const sourceRig = captureSourceRig(sourceRoot);
  const alignment = targetRig.basis.clone().multiply(sourceRig.basis.clone().invert()).normalize();
  const alignmentInverse = alignment.clone().invert();

  const mixer = new THREE.AnimationMixer(sourceRoot);
  const action = mixer.clipAction(sourceClip);
  action.setLoop(THREE.LoopOnce, 1);
  action.clampWhenFinished = true;
  action.play();

  try {
    setSourceTime(mixer, sourceRoot, 0);
    const sourceRootRest = requiredRest(sourceRig, "hips");
    const sourceRootAnimated = requiredSourceBone(sourceRoot, "Hips")
      .getWorldQuaternion(new THREE.Quaternion())
      .normalize();
    const rootStartDeltaInverse = sourceRootAnimated
      .clone()
      .multiply(sourceRootRest.worldQuaternion.clone().invert())
      .normalize()
      .invert();

    const duration = Math.max(1 / fps, sourceClip.duration);
    const frameCount = Math.max(2, Math.ceil(duration * fps) + 1);
    const times: number[] = [];
    const valuesByTarget = new Map<string, number[]>();
    const previousByTarget = new Map<string, THREE.Quaternion>();

    for (const [targetName] of TARGET_TO_MIXAMO) valuesByTarget.set(targetName, []);

    for (let frame = 0; frame < frameCount; frame += 1) {
      const relativeTime = frame === frameCount - 1 ? duration : Math.min(duration, frame / fps);
      times.push(relativeTime);
      setSourceTime(mixer, sourceRoot, Math.min(sourceClip.duration, relativeTime));

      const desiredWorldByTarget = new Map<string, THREE.Quaternion>();

      for (const [targetName, sourceName] of TARGET_TO_MIXAMO) {
        const sourceBone = requiredSourceBone(sourceRoot, sourceName);
        const sourceRest = requiredRest(sourceRig, canonicalMixamoBoneName(sourceName));
        const targetRest = requiredRest(targetRig, targetName);

        const sourceAnimatedWorld = sourceBone
          .getWorldQuaternion(new THREE.Quaternion())
          .normalize();

        const normalizedSourceDelta = rootStartDeltaInverse
          .clone()
          .multiply(sourceAnimatedWorld)
          .multiply(sourceRest.worldQuaternion.clone().invert())
          .normalize();

        const alignedDelta = alignment
          .clone()
          .multiply(normalizedSourceDelta)
          .multiply(alignmentInverse)
          .normalize();

        const desiredWorld = alignedDelta
          .multiply(targetRest.worldQuaternion)
          .normalize();

        const parent = targetRest.bone.parent;
        let desiredParentWorld = new THREE.Quaternion();
        if (parent) {
          const parentBone = parent as THREE.Bone;
          if (parentBone.isBone) {
            const parentRest = targetRig.restByCanonical.get(parentBone.name);
            desiredParentWorld = desiredWorldByTarget.get(parentBone.name)?.clone()
              ?? parentRest?.worldQuaternion.clone()
              ?? parentBone.getWorldQuaternion(new THREE.Quaternion()).normalize();
          } else {
            desiredParentWorld = parent.getWorldQuaternion(new THREE.Quaternion()).normalize();
          }
        }

        const local = desiredParentWorld.invert().multiply(desiredWorld).normalize();
        const previous = previousByTarget.get(targetName);
        if (previous && previous.dot(local) < 0) {
          local.set(-local.x, -local.y, -local.z, -local.w);
        }
        previousByTarget.set(targetName, local.clone());
        valuesByTarget.get(targetName)?.push(local.x, local.y, local.z, local.w);
        desiredWorldByTarget.set(targetName, desiredWorld.clone());
      }
    }

    const tracks = TARGET_TO_MIXAMO.map(([targetName]) =>
      new THREE.QuaternionKeyframeTrack(
        `${targetName}.quaternion`,
        times,
        valuesByTarget.get(targetName) ?? [],
      ),
    );

    const clip = new THREE.AnimationClip(outputClipName, duration, tracks);
    clip.optimize();

    return {
      clip,
      sourceDurationSeconds: sourceClip.duration,
      outputDurationSeconds: duration,
      fps,
      trackCount: tracks.length,
      strippedRootTranslation: true,
    };
  } finally {
    mixer.stopAllAction();
    mixer.uncacheClip(sourceClip);
    mixer.uncacheRoot(sourceRoot);
    targetSkeleton.pose();
    updateSkeletonWorld(targetSkeleton);
  }
}

export function serializeRuntimeAnimationClip(clip: THREE.AnimationClip) {
  return THREE.AnimationClip.toJSON(clip);
}

function captureTargetRig(skeleton: THREE.Skeleton): RigSnapshot {
  const restByCanonical = new Map<string, RestPose>();
  for (const bone of skeleton.bones) {
    restByCanonical.set(bone.name, {
      bone,
      worldQuaternion: bone.getWorldQuaternion(new THREE.Quaternion()).normalize(),
      worldPosition: bone.getWorldPosition(new THREE.Vector3()),
    });
  }

  const basis = deriveBasis(
    requiredRest(restByCanonical, "pelvis").worldPosition,
    requiredRest(restByCanonical, "Head").worldPosition,
    requiredRest(restByCanonical, "upperarm_l").worldPosition,
    requiredRest(restByCanonical, "upperarm_r").worldPosition,
  );
  return { restByCanonical, basis };
}

function captureSourceRig(root: THREE.Object3D): RigSnapshot {
  const restByCanonical = new Map<string, RestPose>();
  root.traverse(object => {
    const bone = object as THREE.Bone;
    if (!bone.isBone) return;
    const canonical = canonicalMixamoBoneName(bone.name);
    if (!canonical || restByCanonical.has(canonical)) return;
    restByCanonical.set(canonical, {
      bone,
      worldQuaternion: bone.getWorldQuaternion(new THREE.Quaternion()).normalize(),
      worldPosition: bone.getWorldPosition(new THREE.Vector3()),
    });
  });

  for (const [, sourceName] of TARGET_TO_MIXAMO) {
    requiredRest(restByCanonical, canonicalMixamoBoneName(sourceName));
  }

  const basis = deriveBasis(
    requiredRest(restByCanonical, "hips").worldPosition,
    requiredRest(restByCanonical, "head").worldPosition,
    requiredRest(restByCanonical, "leftarm").worldPosition,
    requiredRest(restByCanonical, "rightarm").worldPosition,
  );
  return { restByCanonical, basis };
}

function deriveBasis(
  hips: THREE.Vector3,
  head: THREE.Vector3,
  leftArm: THREE.Vector3,
  rightArm: THREE.Vector3,
) {
  const up = head.clone().sub(hips).normalize();
  const left = leftArm.clone().sub(rightArm);
  left.addScaledVector(up, -left.dot(up));
  if (left.lengthSq() < 1e-8 || up.lengthSq() < 1e-8) {
    throw new Error("Cannot derive humanoid anatomical basis");
  }
  left.normalize();
  const forward = left.clone().cross(up).normalize();
  const orthogonalLeft = up.clone().cross(forward).normalize();
  return new THREE.Quaternion()
    .setFromRotationMatrix(new THREE.Matrix4().makeBasis(orthogonalLeft, up, forward))
    .normalize();
}

function requiredRest(rig: RigSnapshot | Map<string, RestPose>, name: string) {
  const map = rig instanceof Map ? rig : rig.restByCanonical;
  const result = map.get(name);
  if (!result) throw new Error(`Animation rig is missing ${name}`);
  return result;
}

function requiredSourceBone(root: THREE.Object3D, sourceName: string): THREE.Bone {
  const target = canonicalMixamoBoneName(sourceName);
  const matches: THREE.Bone[] = [];
  root.traverse(object => {
    const bone = object as THREE.Bone;
    if (bone.isBone && canonicalMixamoBoneName(bone.name) === target) matches.push(bone);
  });
  const result = matches[0];
  if (!result) throw new Error(`Mixamo rig is missing ${sourceName}`);
  return result;
}

function canonicalMixamoBoneName(name: string) {
  return name.toLowerCase().replace(/^mixamorig[:_]?/, "").replace(/[^a-z0-9]/g, "");
}

function setSourceTime(mixer: THREE.AnimationMixer, root: THREE.Object3D, seconds: number) {
  mixer.setTime(seconds);
  root.updateMatrixWorld(true);
}

function updateSkeletonWorld(skeleton: THREE.Skeleton) {
  const firstBone = skeleton.bones[0];
  if (!firstBone) return;
  let top: THREE.Object3D = firstBone;
  while (top.parent) top = top.parent;
  top.updateMatrixWorld(true);
}
