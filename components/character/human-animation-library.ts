import * as THREE from "three";
import { BVHLoader } from "three/examples/jsm/loaders/BVHLoader.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

const QUATERNIUS_PACK_COMMIT = "122378c422148390c781adc6d7019eda7b5d07f3";
const QUATERNIUS_PACK_BASE_URL =
  `https://cdn.jsdelivr.net/gh/Ashen-Skool/Aot-Fable-5.1@${QUATERNIUS_PACK_COMMIT}/assets/staged/anim`;

const CMU_MOCAP_COMMIT = "09a07f54f3bbb58797325f009282d0b2048a2871";
const CMU_MOCAP_BASE_URL =
  `https://cdn.jsdelivr.net/gh/una-dinosauria/cmu-mocap@${CMU_MOCAP_COMMIT}/data`;
const RETARGET_FPS = 30;

export const HUMAN_CHARACTER_ASSET_URL =
  `${QUATERNIUS_PACK_BASE_URL}/UBC_Superhero_Male_FullBody.glb`;
export const HUMAN_ANIMATION_LIBRARY_URL =
  `${QUATERNIUS_PACK_BASE_URL}/UAL1_Standard.glb`;

type MocapMotionSpec = {
  clipName: string;
  sourceId: string;
  sourceClipName: string;
  label: string;
  url: string;
  trim: readonly [number, number];
};

export type HumanMotionSpec = {
  clipName: string;
  sourceId: string;
  sourceClipName: string;
  label: string;
};

export type HumanAnimationLibraryOptions = {
  skipLegacyNormalDanceMocap?: boolean;
};

function cmuMotion(
  clipName: string,
  label: string,
  trim: readonly [number, number],
): MocapMotionSpec {
  return {
    clipName,
    sourceId: "85_04",
    sourceClipName: "CMU 85_04 FancyFootWork",
    label,
    url: `${CMU_MOCAP_BASE_URL}/085/85_04.bvh`,
    trim,
  };
}

// One long genuine dance take is split into eight bounded presentation clips.
// This keeps the download/parse budget small while removing all gun/combat
// placeholders from normal successful turns.
const DANCE_MOTIONS = [
  cmuMotion("HumanDance01", "FancyFootWork 01", [0.25, 2.75]),
  cmuMotion("HumanDance02", "FancyFootWork 02", [2.75, 5.25]),
  cmuMotion("HumanDance03", "FancyFootWork 03", [5.25, 7.75]),
  cmuMotion("HumanDance04", "FancyFootWork 04", [7.75, 10.25]),
  cmuMotion("HumanDance05", "FancyFootWork 05", [10.25, 12.75]),
  cmuMotion("HumanDance06", "FancyFootWork 06", [12.75, 15.25]),
  cmuMotion("HumanDance07", "FancyFootWork 07", [15.25, 17.75]),
  cmuMotion("HumanDance08", "FancyFootWork 08", [17.75, 20.25]),
] as const satisfies readonly MocapMotionSpec[];

const FINISH_MOTION: MocapMotionSpec = {
  clipName: "HumanFinish",
  sourceId: "87_01",
  sourceClipName: "CMU 87_01 jump with kick and spin",
  label: "jump with kick and spin",
  url: `${CMU_MOCAP_BASE_URL}/087/87_01.bvh`,
  trim: [0.15, 4.15],
};

export const HUMAN_FINISH_MOCAP_URL = FINISH_MOTION.url;

export const HUMAN_MOTION_SPECS = [
  ...DANCE_MOTIONS.map(({ clipName, sourceId, sourceClipName, label }) => ({
    clipName,
    sourceId,
    sourceClipName,
    label,
  })),
  {
    clipName: "HumanMiss",
    sourceId: "quaternius-ual1",
    sourceClipName: "Hit_Head",
    label: "failure / hit reaction",
  },
  {
    clipName: "HumanFinish",
    sourceId: FINISH_MOTION.sourceId,
    sourceClipName: FINISH_MOTION.sourceClipName,
    label: FINISH_MOTION.label,
  },
] as const satisfies readonly HumanMotionSpec[];

const TARGET_TO_SOURCE_BONES = [
  ["pelvis", "Hips"],
  ["spine_01", "LowerBack"],
  ["spine_02", "Spine"],
  ["spine_03", "Spine1"],
  ["neck_01", "Neck1"],
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

const REQUIRED_HUMAN_BONES = [
  "root",
  ...TARGET_TO_SOURCE_BONES.map(([targetName]) => targetName),
] as const;

type RestPose = {
  bone: THREE.Bone;
  worldQuaternion: THREE.Quaternion;
  worldPosition: THREE.Vector3;
};

type RigSnapshot = {
  restByName: Map<string, RestPose>;
  basis: THREE.Quaternion;
};

export async function loadHumanAnimationLibrary(
  target: THREE.SkinnedMesh,
  options: HumanAnimationLibraryOptions = {},
): Promise<THREE.AnimationClip[]> {
  assertCompatibleHumanRig(target.skeleton, "character");
  const targetRig = captureTargetRig(target.skeleton);

  const gltfLoader = new GLTFLoader();
  const library = await gltfLoader.loadAsync(HUMAN_ANIMATION_LIBRARY_URL);

  try {
    const source = findPrimarySkinnedMesh(library.scene);
    assertCompatibleHumanRig(source.skeleton, "animation library");
    assertSkeletonCompatibility(target.skeleton, source.skeleton);

    const clipsByName = new Map(
      library.animations.map((clip) => [clip.name.toLowerCase(), clip] as const),
    );
    const idle = cloneRequiredClip(clipsByName, "Idle_Loop", "Idle");
    const miss = cloneRequiredClip(clipsByName, "Hit_Head", "HumanMiss");
    const fallbackDance = cloneRequiredClip(clipsByName, "Dance_Loop", "HumanDanceFallback");
    const fallbackFinish = cloneRequiredClip(clipsByName, "Roll", "HumanFinish");

    const resolved = new Map<string, THREE.AnimationClip>();
    for (const spec of DANCE_MOTIONS) {
      resolved.set(spec.clipName, cloneAs(fallbackDance, spec.clipName));
    }
    resolved.set("HumanFinish", fallbackFinish);

    if (!options.skipLegacyNormalDanceMocap) {
      await tryLoadMocapSet(targetRig, DANCE_MOTIONS, resolved);
    } else {
      console.info("[character] published dance pool available; skipping legacy CMU FancyFootWork load");
    }
    await tryLoadMocapSet(targetRig, [FINISH_MOTION], resolved);

    target.skeleton.pose();
    updateSkeletonWorld(target.skeleton);

    return [
      idle,
      ...DANCE_MOTIONS.map((spec) => resolved.get(spec.clipName) as THREE.AnimationClip),
      miss,
      resolved.get("HumanFinish") as THREE.AnimationClip,
    ];
  } finally {
    disposeLibraryScene(library.scene);
  }
}

async function tryLoadMocapSet(
  targetRig: RigSnapshot,
  specs: readonly MocapMotionSpec[],
  resolved: Map<string, THREE.AnimationClip>,
) {
  if (specs.length === 0) return;

  const loader = new BVHLoader();
  loader.animateBonePositions = false;

  try {
    const source = await loader.loadAsync(specs[0].url);
    assertSourceBones(source.skeleton);

    const sourceRig = captureSourceRig(source.skeleton);
    const alignment = targetRig.basis
      .clone()
      .multiply(sourceRig.basis.clone().invert())
      .normalize();

    const root = source.skeleton.bones[0];
    const mixer = new THREE.AnimationMixer(root);
    const action = mixer.clipAction(source.clip);
    action.setLoop(THREE.LoopOnce, 1);
    action.clampWhenFinished = true;
    action.play();

    try {
      for (const spec of specs) {
        const clip = bakeWorldSpaceClip(
          targetRig,
          sourceRig,
          source.skeleton,
          mixer,
          source.clip,
          alignment,
          spec,
        );
        resolved.set(spec.clipName, clip);
      }
    } finally {
      mixer.stopAllAction();
      mixer.uncacheClip(source.clip);
      source.skeleton.dispose();
    }
  } catch (error) {
    console.warn(
      `[character] keeping rig-safe fallback for ${specs.map((spec) => spec.clipName).join(", ")}`,
      error,
    );
  }
}

function bakeWorldSpaceClip(
  targetRig: RigSnapshot,
  sourceRig: RigSnapshot,
  sourceSkeleton: THREE.Skeleton,
  mixer: THREE.AnimationMixer,
  sourceClip: THREE.AnimationClip,
  alignment: THREE.Quaternion,
  spec: MocapMotionSpec,
) {
  const safeStart = THREE.MathUtils.clamp(spec.trim[0], 0, Math.max(0, sourceClip.duration - 1 / RETARGET_FPS));
  const safeEnd = THREE.MathUtils.clamp(spec.trim[1], safeStart + 1 / RETARGET_FPS, sourceClip.duration);
  if (!(safeEnd > safeStart)) {
    throw new Error(`CMU ${spec.sourceId} has no usable window for ${spec.clipName}`);
  }

  setSourceTime(mixer, sourceSkeleton, safeStart);

  const sourceRootRest = requiredRest(sourceRig, "Hips");
  const sourceRootAnimated = requiredBone(sourceSkeleton, "Hips")
    .getWorldQuaternion(new THREE.Quaternion())
    .normalize();
  const rootStartDelta = sourceRootAnimated
    .clone()
    .multiply(sourceRootRest.worldQuaternion.clone().invert())
    .normalize();
  const rootStartDeltaInverse = rootStartDelta.clone().invert();
  const alignmentInverse = alignment.clone().invert();

  const duration = safeEnd - safeStart;
  const frameCount = Math.max(2, Math.round(duration * RETARGET_FPS) + 1);
  const times: number[] = [];
  const valuesByTarget = new Map<string, number[]>();
  const previousByTarget = new Map<string, THREE.Quaternion>();

  for (const [targetName] of TARGET_TO_SOURCE_BONES) {
    valuesByTarget.set(targetName, []);
  }

  for (let frame = 0; frame < frameCount; frame += 1) {
    const relativeTime = frame === frameCount - 1
      ? duration
      : Math.min(duration, frame / RETARGET_FPS);
    const sourceTime = safeStart + relativeTime;
    times.push(relativeTime);
    setSourceTime(mixer, sourceSkeleton, sourceTime);

    const desiredWorldByTarget = new Map<string, THREE.Quaternion>();

    for (const [targetName, sourceName] of TARGET_TO_SOURCE_BONES) {
      const sourceBone = requiredBone(sourceSkeleton, sourceName);
      const sourceRest = requiredRest(sourceRig, sourceName);
      const targetRest = requiredRest(targetRig, targetName);

      const sourceAnimatedWorld = sourceBone
        .getWorldQuaternion(new THREE.Quaternion())
        .normalize();

      // Convert each source bone to a rest-relative world-space delta, remove
      // the segment's initial global heading, then express that physical delta
      // in the target rig's anatomical world frame. This avoids applying CMU
      // local-axis quaternions directly to Quaternius bones.
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
          desiredParentWorld =
            desiredWorldByTarget.get(parentBone.name)?.clone()
            ?? requiredRest(targetRig, parentBone.name).worldQuaternion.clone();
        } else {
          desiredParentWorld = parent.getWorldQuaternion(new THREE.Quaternion()).normalize();
        }
      }

      const local = desiredParentWorld
        .invert()
        .multiply(desiredWorld)
        .normalize();

      const previous = previousByTarget.get(targetName);
      if (previous && previous.dot(local) < 0) {
        local.set(-local.x, -local.y, -local.z, -local.w);
      }
      previousByTarget.set(targetName, local.clone());

      const values = valuesByTarget.get(targetName) as number[];
      values.push(local.x, local.y, local.z, local.w);
      desiredWorldByTarget.set(targetName, desiredWorld.clone());
    }
  }

  const tracks = TARGET_TO_SOURCE_BONES.map(([targetName]) =>
    new THREE.QuaternionKeyframeTrack(
      `${targetName}.quaternion`,
      times,
      valuesByTarget.get(targetName) as number[],
    ),
  );

  return new THREE.AnimationClip(spec.clipName, duration, tracks);
}

function captureTargetRig(skeleton: THREE.Skeleton): RigSnapshot {
  skeleton.pose();
  updateSkeletonWorld(skeleton);
  return captureRig(
    skeleton,
    { hips: "pelvis", head: "Head", leftArm: "upperarm_l", rightArm: "upperarm_r" },
  );
}

function captureSourceRig(skeleton: THREE.Skeleton): RigSnapshot {
  skeleton.pose();
  updateSkeletonWorld(skeleton);
  return captureRig(
    skeleton,
    { hips: "Hips", head: "Head", leftArm: "LeftArm", rightArm: "RightArm" },
  );
}

function captureRig(
  skeleton: THREE.Skeleton,
  anatomy: { hips: string; head: string; leftArm: string; rightArm: string },
): RigSnapshot {
  const restByName = new Map<string, RestPose>();

  for (const bone of skeleton.bones) {
    if (restByName.has(bone.name)) continue;
    restByName.set(bone.name, {
      bone,
      worldQuaternion: bone.getWorldQuaternion(new THREE.Quaternion()).normalize(),
      worldPosition: bone.getWorldPosition(new THREE.Vector3()),
    });
  }

  const basis = deriveAnatomicalBasis(restByName, anatomy);
  return { restByName, basis };
}

function deriveAnatomicalBasis(
  restByName: Map<string, RestPose>,
  anatomy: { hips: string; head: string; leftArm: string; rightArm: string },
) {
  const hips = requiredRestByName(restByName, anatomy.hips).worldPosition;
  const head = requiredRestByName(restByName, anatomy.head).worldPosition;
  const leftArm = requiredRestByName(restByName, anatomy.leftArm).worldPosition;
  const rightArm = requiredRestByName(restByName, anatomy.rightArm).worldPosition;

  const up = head.clone().sub(hips).normalize();
  const left = leftArm.clone().sub(rightArm);
  left.addScaledVector(up, -left.dot(up));

  if (left.lengthSq() < 1e-8 || up.lengthSq() < 1e-8) {
    throw new Error("Cannot derive humanoid anatomical basis");
  }

  left.normalize();
  const forward = left.clone().cross(up).normalize();
  const orthogonalLeft = up.clone().cross(forward).normalize();

  const matrix = new THREE.Matrix4().makeBasis(orthogonalLeft, up, forward);
  return new THREE.Quaternion().setFromRotationMatrix(matrix).normalize();
}

function setSourceTime(
  mixer: THREE.AnimationMixer,
  skeleton: THREE.Skeleton,
  timeSeconds: number,
) {
  mixer.setTime(timeSeconds);
  updateSkeletonWorld(skeleton);
}

function updateSkeletonWorld(skeleton: THREE.Skeleton) {
  const root = skeleton.bones[0];
  if (!root) return;

  let top: THREE.Object3D = root;
  while (top.parent) top = top.parent;
  top.updateMatrixWorld(true);
}

function assertCompatibleHumanRig(skeleton: THREE.Skeleton, label: string) {
  const names = new Set(skeleton.bones.map((bone) => bone.name));
  const missing = REQUIRED_HUMAN_BONES.filter((name) => !names.has(name));
  if (missing.length) {
    throw new Error(`${label} rig is missing required bones: ${missing.join(", ")}`);
  }
}

function assertSourceBones(skeleton: THREE.Skeleton) {
  const names = new Set(skeleton.bones.map((bone) => bone.name));
  const required = [...new Set(TARGET_TO_SOURCE_BONES.map(([, sourceName]) => sourceName))];
  const missing = required.filter((name) => !names.has(name));
  if (missing.length) {
    throw new Error(`CMU source rig is missing required bones: ${missing.join(", ")}`);
  }
}

function assertSkeletonCompatibility(target: THREE.Skeleton, source: THREE.Skeleton) {
  const targetNames = new Set(target.bones.map((bone) => bone.name));
  const missing = source.bones
    .map((bone) => bone.name)
    .filter((name) => !targetNames.has(name));
  if (missing.length) {
    throw new Error(`Character rig does not match Quaternius UAL skeleton: ${missing.join(", ")}`);
  }
}

function requiredBone(skeleton: THREE.Skeleton, name: string) {
  const bone = skeleton.bones.find((candidate) => candidate.name === name);
  if (!bone) throw new Error(`Missing bone ${name}`);
  return bone;
}

function requiredRest(rig: RigSnapshot, name: string) {
  return requiredRestByName(rig.restByName, name);
}

function requiredRestByName(restByName: Map<string, RestPose>, name: string) {
  const rest = restByName.get(name);
  if (!rest) throw new Error(`Missing rest pose for ${name}`);
  return rest;
}

function cloneRequiredClip(
  clipsByName: Map<string, THREE.AnimationClip>,
  sourceName: string,
  targetName: string,
) {
  const source = clipsByName.get(sourceName.toLowerCase());
  if (!source) throw new Error(`Quaternius animation library is missing ${sourceName}`);
  return cloneAs(source, targetName);
}

function cloneAs(source: THREE.AnimationClip, name: string) {
  const clip = source.clone();
  clip.name = name;
  return clip;
}

function findPrimarySkinnedMesh(root: THREE.Object3D): THREE.SkinnedMesh {
  let target: THREE.SkinnedMesh | null = null;
  root.traverse((object) => {
    if (!target && (object as THREE.SkinnedMesh).isSkinnedMesh) {
      target = object as THREE.SkinnedMesh;
    }
  });
  if (!target) throw new Error("Quaternius animation library has no skinned mesh");
  return target;
}

function disposeLibraryScene(root: THREE.Object3D) {
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  const textures = new Set<THREE.Texture>();
  const skeletons = new Set<THREE.Skeleton>();

  root.traverse((object) => {
    const mesh = object as THREE.Mesh;
    if (mesh.geometry) geometries.add(mesh.geometry);
    const meshMaterials = Array.isArray(mesh.material)
      ? mesh.material
      : mesh.material
        ? [mesh.material]
        : [];
    for (const material of meshMaterials) {
      materials.add(material);
      for (const value of Object.values(material)) {
        if (value instanceof THREE.Texture) textures.add(value);
      }
    }
    const skinnedMesh = object as THREE.SkinnedMesh;
    if (skinnedMesh.isSkinnedMesh && skinnedMesh.skeleton) skeletons.add(skinnedMesh.skeleton);
  });

  for (const texture of textures) texture.dispose();
  for (const material of materials) material.dispose();
  for (const geometry of geometries) geometry.dispose();
  for (const skeleton of skeletons) skeleton.dispose();
}
