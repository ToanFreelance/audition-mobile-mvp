import * as THREE from "three";

/**
 * Step 3 opt-in animation QA. Quaternius source clips are sampled in world
 * space, aligned with the M3 native bind rest, and baked to per-actor local
 * bone quaternions. No root translation, stage motion or song clock is owned
 * by this adapter. Full contact/Finish visual QA is required before START.
 */
export const M3_GAMEPLAY_BONE_PAIRS = [
  ["pelvis", "hips"],
  ["spine_01", "spine"], ["spine_02", "chest"], ["spine_03", "upper_chest"],
  ["neck_01", "neck"], ["Head", "head"],
  ["clavicle_l", "shoulder.L"], ["upperarm_l", "upper_arm.L"],
  ["lowerarm_l", "lower_arm.L"], ["hand_l", "hand.L"],
  ["clavicle_r", "shoulder.R"], ["upperarm_r", "upper_arm.R"],
  ["lowerarm_r", "lower_arm.R"], ["hand_r", "hand.R"],
  ["thigh_l", "upper_leg.L"], ["calf_l", "lower_leg.L"],
  ["foot_l", "foot.L"], ["ball_l", "toes.L"],
  ["thigh_r", "upper_leg.R"], ["calf_r", "lower_leg.R"],
  ["foot_r", "foot.R"], ["ball_r", "toes.R"],
] as const;

type Rest = { bone: THREE.Bone; local: THREE.Quaternion; world: THREE.Quaternion;
  position: THREE.Vector3 };
function findBone(skeleton: THREE.Skeleton, name: string) {
  const sanitized = THREE.PropertyBinding.sanitizeNodeName(name);
  const found = skeleton.bones.filter(x => x.name === name || x.name === sanitized);
  if (found.length !== 1) throw new Error("M3 gameplay retarget: missing or ambiguous bone " + name);
  return found[0];
}
function capture(skeleton: THREE.Skeleton) {
  const bones = new Map<THREE.Bone, Rest>();
  for (const bone of skeleton.bones) {
    bones.set(bone, { bone, local: bone.quaternion.clone(),
      world: bone.getWorldQuaternion(new THREE.Quaternion()).normalize(),
      position: bone.getWorldPosition(new THREE.Vector3()) });
  }
  return bones;
}
function basis(skeleton: THREE.Skeleton, rest: Map<THREE.Bone, Rest>,
  hip: string, head: string, left: string, right: string) {
  const pos = (name: string) => rest.get(findBone(skeleton, name))!.position;
  const up = pos(head).clone().sub(pos(hip)).normalize();
  const side = pos(left).clone().sub(pos(right));
  side.addScaledVector(up, -side.dot(up));
  if (up.lengthSq() < 0.98 || side.lengthSq() < 1e-6) {
    throw new Error("Degenerate gameplay retarget anatomical frame");
  }
  side.normalize();
  const forward = side.clone().cross(up).normalize();
  return new THREE.Quaternion().setFromRotationMatrix(
    new THREE.Matrix4().makeBasis(up.clone().cross(forward).normalize(), up, forward),
  ).normalize();
}
function updateWorld(skeleton: THREE.Skeleton) {
  let root: THREE.Object3D = skeleton.bones[0];
  if (!root) throw new Error("M3 gameplay retarget: empty skeleton");
  while (root.parent) root = root.parent;
  root.updateMatrixWorld(true);
}

export type M3GameplayRetargetReport = {
  clipCount: number; boneTrackCount: number; fps: number;
  clips: { name: string; seconds: number; tracks: number }[];
};

/** No clip substitution: output keeps the canonical gameplay clip names. */
export function retargetQuaterniusToM3(
  sourceRoot: THREE.Object3D,
  sourceSkeleton: THREE.Skeleton,
  targetSkeleton: THREE.Skeleton,
  clips: readonly THREE.AnimationClip[],
  fps = 30,
): { clips: THREE.AnimationClip[]; report: M3GameplayRetargetReport } {
  if (!Number.isFinite(fps) || fps < 10 || fps > 60) throw new Error("Invalid M3 retarget FPS");
  const saved = targetSkeleton.bones.map(b => ({
    position: b.position.clone(), quaternion: b.quaternion.clone(), scale: b.scale.clone(),
  }));
  const mixer = new THREE.AnimationMixer(sourceRoot);
  try {
    sourceSkeleton.pose();
    targetSkeleton.pose();
    updateWorld(sourceSkeleton);
    updateWorld(targetSkeleton);
    const sourceRest = capture(sourceSkeleton);
    const targetRest = capture(targetSkeleton);
    const pairs = M3_GAMEPLAY_BONE_PAIRS.map(([src, dst]) => ({
      src: findBone(sourceSkeleton, src), dst: findBone(targetSkeleton, dst),
    }));
    if (new Set(pairs.map(x => x.dst.uuid)).size !== pairs.length) {
      throw new Error("M3 retarget duplicate destination bone");
    }
    const sourceBasis = basis(sourceSkeleton, sourceRest,
      "pelvis", "Head", "upperarm_l", "upperarm_r");
    const targetBasis = basis(targetSkeleton, targetRest,
      "hips", "head", "upper_arm.L", "upper_arm.R");
    const align = targetBasis.clone().multiply(sourceBasis.invert()).normalize();
    const unalign = align.clone().invert();

    const output = clips.map(clip => {
      if (!Number.isFinite(clip.duration) || !(clip.duration > 0)) {
        throw new Error("M3 retarget invalid clip duration: " + clip.name);
      }
      const action = mixer.clipAction(clip);
      action.setLoop(THREE.LoopOnce, 1);
      action.clampWhenFinished = true;
      action.play();
      const frames = Math.ceil(clip.duration * fps) + 1;
      const times = new Float32Array(frames);
      const data = pairs.map(() => new Float32Array(frames * 4));
      const previous = pairs.map(() => null as THREE.Quaternion | null);
      for (let frame = 0; frame < frames; frame++) {
        const at = frame === frames - 1 ? clip.duration : Math.min(clip.duration, frame / fps);
        times[frame] = at;
        mixer.setTime(at);
        sourceRoot.updateMatrixWorld(true);
        const animatedWorld = new Map<THREE.Bone, THREE.Quaternion>();
        pairs.forEach(({ src, dst }, index) => {
          const srcRest = sourceRest.get(src)!;
          const dstRest = targetRest.get(dst)!;
          const delta = src.getWorldQuaternion(new THREE.Quaternion())
            .multiply(srcRest.world.clone().invert()).normalize();
          const desiredWorld = align.clone().multiply(delta).multiply(unalign)
            .multiply(dstRest.world).normalize();
          const parent = dst.parent;
          const parentWorld = parent && (parent as THREE.Bone).isBone
            ? animatedWorld.get(parent as THREE.Bone)
              ?? targetRest.get(parent as THREE.Bone)?.world
              ?? parent.getWorldQuaternion(new THREE.Quaternion())
            : parent?.getWorldQuaternion(new THREE.Quaternion()) ?? new THREE.Quaternion();
          const local = parentWorld.clone().invert().multiply(desiredWorld).normalize();
          if (previous[index] && local.dot(previous[index]!) < 0) {
            local.set(-local.x, -local.y, -local.z, -local.w);
          }
          previous[index] = local.clone();
          local.toArray(data[index], frame * 4);
          animatedWorld.set(dst, parentWorld.clone().multiply(local).normalize());
        });
      }
      action.stop();
      mixer.uncacheClip(clip);
      // The M3 skeleton has a different bind translation from Quaternius.
      // Root motion/foot contacts need owner-approved correction in the NEXT
      // isolated pass, never hidden offsets in gameplay scheduling.
      return new THREE.AnimationClip(clip.name, clip.duration, pairs.map(({ dst }, i) =>
        new THREE.QuaternionKeyframeTrack(dst.uuid + ".quaternion", times, data[i])));
    });
    return {
      clips: output,
      report: { clipCount: output.length, boneTrackCount: pairs.length, fps,
        clips: output.map(clip => ({ name: clip.name, seconds: clip.duration,
          tracks: clip.tracks.length })) },
    };
  } finally {
    mixer.stopAllAction();
    mixer.uncacheRoot(sourceRoot);
    sourceSkeleton.pose();
    targetSkeleton.bones.forEach((b, i) => {
      b.position.copy(saved[i].position);
      b.quaternion.copy(saved[i].quaternion);
      b.scale.copy(saved[i].scale);
    });
    updateWorld(sourceSkeleton);
    updateWorld(targetSkeleton);
  }
}
