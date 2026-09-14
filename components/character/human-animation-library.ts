import * as THREE from "three";
import { BVHLoader } from "three/examples/jsm/loaders/BVHLoader.js";
import { retargetClip } from "three/examples/jsm/utils/SkeletonUtils.js";

export const HUMAN_CHARACTER_ASSET_URL =
  "https://cdn.jsdelivr.net/gh/programasweights/avatar@ddd5fc34a445bcded3cf9836607aaeebc19a5c78/public/assets/character.glb";

const CMU_MOCAP_COMMIT = "09a07f54f3bbb58797325f009282d0b2048a2871";
const CMU_MOCAP_BASE_URL = `https://cdn.jsdelivr.net/gh/una-dinosauria/cmu-mocap@${CMU_MOCAP_COMMIT}/data`;
const RETARGET_FPS = 30;

export type HumanMotionSpec = {
  clipName: string;
  sourceId: string;
  label: string;
  url: string;
  trim: [number, number];
};

function cmuMotion(folder: string, take: string, clipName: string, label: string, trim: [number, number]): HumanMotionSpec {
  const subject = String(Number(folder));
  return {
    clipName,
    sourceId: `${subject}_${take}`,
    label,
    url: `${CMU_MOCAP_BASE_URL}/${folder}/${subject}_${take}.bvh`,
    trim,
  };
}

// Curated windows keep the generated runtime clips bounded even though the
// source CMU takes are much longer. Source BVHs are pinned and are retargeted
// once during CharacterActor.load(), never per frame.
export const HUMAN_MOTION_SPECS = [
  cmuMotion("085", "04", "HumanDance01", "FancyFootWork", [0.15, 5.15]),
  cmuMotion("090", "28", "HumanDance02", "breakdance", [0.15, 5.15]),
  cmuMotion("090", "30", "HumanDance03", "russian dance A", [0.15, 5.15]),
  cmuMotion("090", "31", "HumanDance04", "russian dance B", [0.15, 5.15]),
  cmuMotion("090", "32", "HumanDance05", "moonwalk", [0.15, 5.15]),
  cmuMotion("093", "03", "HumanDance06", "charleston", [0.15, 5.15]),
  cmuMotion("093", "06", "HumanDance07", "lindy hop", [0.15, 5.15]),
  cmuMotion("093", "08", "HumanDance08", "fancy charleston", [0.15, 5.15]),
  cmuMotion("080", "45", "HumanMiss", "crying / fail reaction", [0.15, 2.15]),
  cmuMotion("087", "01", "HumanFinish", "jump with kick and spin", [0.15, 4.15]),
] as const satisfies readonly HumanMotionSpec[];

// SkeletonUtils expects target-bone -> source-bone names. This deliberately
// stays a small fixed adapter for the chosen Quaternius/CMU pair rather than a
// general-purpose runtime retargeting framework. Fingers stay in the target
// reference pose because CMU did not capture useful finger motion.
const QUATERNIUS_TO_CMU_BONES: Record<string, string> = {
  pelvis: "Hips",
  spine_01: "LowerBack",
  spine_02: "Spine",
  spine_03: "Spine1",
  neck_01: "Neck1",
  Head: "Head",
  clavicle_l: "LeftShoulder",
  upperarm_l: "LeftArm",
  lowerarm_l: "LeftForeArm",
  hand_l: "LeftHand",
  thigh_l: "LeftUpLeg",
  calf_l: "LeftLeg",
  foot_l: "LeftFoot",
  ball_l: "LeftToeBase",
  clavicle_r: "RightShoulder",
  upperarm_r: "RightArm",
  lowerarm_r: "RightForeArm",
  hand_r: "RightHand",
  thigh_r: "RightUpLeg",
  calf_r: "RightLeg",
  foot_r: "RightFoot",
  ball_r: "RightToeBase",
};

const REQUIRED_TARGET_BONES = Object.keys(QUATERNIUS_TO_CMU_BONES);

export async function loadHumanAnimationLibrary(target: THREE.SkinnedMesh): Promise<THREE.AnimationClip[]> {
  assertCompatibleHumanRig(target.skeleton);

  const clips = await Promise.all(HUMAN_MOTION_SPECS.map((spec) => retargetMotion(target, spec)));
  target.skeleton.pose();
  target.updateMatrixWorld(true);

  // A zero-track clip intentionally means "use the humanoid reference pose".
  // When weighted mocap actions fade out, AnimationMixer restores the original
  // bone transforms, making neutral Idle cheap and deterministic.
  return [new THREE.AnimationClip("Idle", 1, []), ...clips];
}

async function retargetMotion(target: THREE.SkinnedMesh, spec: HumanMotionSpec) {
  const loader = new BVHLoader();
  const source = await loader.loadAsync(spec.url);
  const safeEnd = Math.min(spec.trim[1], source.clip.duration - 1 / RETARGET_FPS);
  const safeStart = Math.min(spec.trim[0], Math.max(0, safeEnd - 0.5));

  if (!(safeEnd > safeStart)) {
    source.skeleton.dispose();
    throw new Error(`CMU motion ${spec.sourceId} is too short for its curated window`);
  }

  const clip = retargetClip(target, source.skeleton, source.clip, {
    names: QUATERNIUS_TO_CMU_BONES,
    hip: "Hips",
    fps: RETARGET_FPS,
    trim: [safeStart, safeEnd],
    useFirstFramePosition: true,
  });
  clip.name = spec.clipName;

  // Gameplay characters are stage-centered. Preserve hip/body rotations while
  // removing only global pelvis translation so moonwalk, breakdance and Finish
  // cannot move CharacterActor off its fixed stage root.
  clip.tracks = clip.tracks.filter((track) => track.name !== ".bones[pelvis].position");

  source.skeleton.dispose();
  target.skeleton.pose();
  target.updateMatrixWorld(true);
  return clip;
}

function assertCompatibleHumanRig(skeleton: THREE.Skeleton) {
  const names = new Set(skeleton.bones.map((bone) => bone.name));
  const missing = REQUIRED_TARGET_BONES.filter((name) => !names.has(name));
  if (missing.length) {
    throw new Error(`Human character rig is missing required bones: ${missing.join(", ")}`);
  }
}
