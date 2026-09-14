import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

const QUATERNIUS_PACK_COMMIT = "122378c422148390c781adc6d7019eda7b5d07f3";
const QUATERNIUS_PACK_BASE_URL =
  `https://cdn.jsdelivr.net/gh/Ashen-Skool/Aot-Fable-5.1@${QUATERNIUS_PACK_COMMIT}/assets/staged/anim`;

// These two assets come from the same current Quaternius UBC/UAL export family
// and share the same 65-bone UE-style skeleton. Keeping model and animation rig
// identical avoids runtime cross-rig retargeting and its bind-axis/rest-pose
// ambiguity on Safari/Three.js.
export const HUMAN_CHARACTER_ASSET_URL =
  `${QUATERNIUS_PACK_BASE_URL}/UBC_Superhero_Male_FullBody.glb`;
export const HUMAN_ANIMATION_LIBRARY_URL =
  `${QUATERNIUS_PACK_BASE_URL}/UAL1_Standard.glb`;

export type HumanMotionSpec = {
  clipName: string;
  sourceClipName: string;
  label: string;
};

// P3.7 still uses a deliberately compact presentation pool. Some UAL1 clips
// are emotes/combat accents rather than final Audition choreography; the key
// invariant here is that every clip is authored on the exact same skeleton as
// the active human character. Richer final dance art can replace these clips
// later without changing song-time ownership or the animation controller.
export const HUMAN_MOTION_SPECS = [
  { clipName: "HumanDance01", sourceClipName: "Dance_Loop", label: "dance loop" },
  { clipName: "HumanDance02", sourceClipName: "Walk_Formal_Loop", label: "formal step loop" },
  { clipName: "HumanDance03", sourceClipName: "Idle_Talking_Loop", label: "talking groove" },
  { clipName: "HumanDance04", sourceClipName: "Punch_Jab", label: "jab accent" },
  { clipName: "HumanDance05", sourceClipName: "Punch_Cross", label: "cross accent" },
  { clipName: "HumanDance06", sourceClipName: "Interact", label: "interaction accent" },
  { clipName: "HumanDance07", sourceClipName: "Sword_Attack", label: "swing accent" },
  { clipName: "HumanDance08", sourceClipName: "Pistol_Shoot", label: "shoot accent" },
  { clipName: "HumanMiss", sourceClipName: "Hit_Head", label: "failure / hit reaction" },
  { clipName: "HumanFinish", sourceClipName: "Roll", label: "special acrobatic finish" },
] as const satisfies readonly HumanMotionSpec[];

const IDLE_MOTION: HumanMotionSpec = {
  clipName: "Idle",
  sourceClipName: "Idle_Loop",
  label: "idle loop",
};

const REQUIRED_HUMAN_BONES = [
  "root",
  "pelvis",
  "spine_01",
  "spine_02",
  "spine_03",
  "neck_01",
  "Head",
  "clavicle_l",
  "upperarm_l",
  "lowerarm_l",
  "hand_l",
  "thigh_l",
  "calf_l",
  "foot_l",
  "ball_l",
  "clavicle_r",
  "upperarm_r",
  "lowerarm_r",
  "hand_r",
  "thigh_r",
  "calf_r",
  "foot_r",
  "ball_r",
] as const;

export async function loadHumanAnimationLibrary(target: THREE.SkinnedMesh): Promise<THREE.AnimationClip[]> {
  assertCompatibleHumanRig(target.skeleton, "character");

  const loader = new GLTFLoader();
  const library = await loader.loadAsync(HUMAN_ANIMATION_LIBRARY_URL);

  try {
    const source = findPrimarySkinnedMesh(library.scene);
    assertCompatibleHumanRig(source.skeleton, "animation library");
    assertSkeletonCompatibility(target.skeleton, source.skeleton);

    const clipsByName = new Map(
      library.animations.map((clip) => [clip.name.toLowerCase(), clip] as const),
    );
    const specs = [IDLE_MOTION, ...HUMAN_MOTION_SPECS];

    return specs.map((spec) => {
      const sourceClip = clipsByName.get(spec.sourceClipName.toLowerCase());
      if (!sourceClip) {
        throw new Error(`Quaternius animation library is missing ${spec.sourceClipName}`);
      }
      const clip = sourceClip.clone();
      clip.name = spec.clipName;
      return clip;
    });
  } finally {
    disposeLibraryScene(library.scene);
  }
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

function assertCompatibleHumanRig(skeleton: THREE.Skeleton, label: string) {
  const names = new Set(skeleton.bones.map((bone) => bone.name));
  const missing = REQUIRED_HUMAN_BONES.filter((name) => !names.has(name));
  if (missing.length) {
    throw new Error(`${label} rig is missing required bones: ${missing.join(", ")}`);
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
