import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import type { DanceCandidateAsset } from "./asset-catalog";
import { P37_DANCE_CANDIDATES, P37_REFERENCE_CHARACTERS } from "./asset-catalog";
import type { LocalAssetZip } from "./asset-lab-local-package";
import {
  bakeMixamoRuntimeClip,
  RUNTIME_ANIMATION_FPS,
  serializeRuntimeAnimationClip,
} from "./runtime-animation-baker";
import type { RuntimeAnimationBundleClipJson } from "./runtime-animation-bundle";

export class P37AssetLabRuntimeProcessor {
  private scene: THREE.Object3D | null = null;
  private skinned: THREE.SkinnedMesh | null = null;
  private loading: Promise<void> | null = null;

  async process(archive: LocalAssetZip, asset: DanceCandidateAsset): Promise<RuntimeAnimationBundleClipJson> {
    await this.ensureTarget();
    const skinned = this.skinned;
    if (!skinned) throw new Error("Canonical target rig is unavailable");

    const candidateIndex = P37_DANCE_CANDIDATES.findIndex(candidate => candidate.id === asset.id);
    if (candidateIndex < 0) throw new Error(`Unknown P3.7 animation asset ${asset.id}`);

    const sourceBuffer = await archive.extract(`mixamo/${asset.sourceFileName}`);
    const runtimeClipName = `MixamoDance${String(candidateIndex + 1).padStart(3, "0")}`;
    const baked = bakeMixamoRuntimeClip(
      skinned.skeleton,
      sourceBuffer,
      runtimeClipName,
      RUNTIME_ANIMATION_FPS,
    );

    return {
      assetId: asset.id,
      name: asset.name,
      runtimeClipName,
      sourceSha256: asset.sha256,
      sourceDurationSeconds: baked.sourceDurationSeconds,
      outputDurationSeconds: baked.outputDurationSeconds,
      fps: baked.fps,
      trackCount: baked.trackCount,
      strippedRootTranslation: baked.strippedRootTranslation,
      clip: serializeRuntimeAnimationClip(baked.clip),
    };
  }

  dispose() {
    if (this.scene) disposeObjectTree(this.scene);
    this.scene = null;
    this.skinned = null;
    this.loading = null;
  }

  private async ensureTarget() {
    if (this.skinned) return;
    if (this.loading) return this.loading;
    this.loading = this.loadTarget();
    try {
      await this.loading;
    } finally {
      this.loading = null;
    }
  }

  private async loadTarget() {
    const reference = P37_REFERENCE_CHARACTERS[0];
    const gltf = await new GLTFLoader().loadAsync(reference.sourceUrl);
    const skinned = findPrimarySkinnedMesh(gltf.scene);
    this.scene = gltf.scene;
    this.skinned = skinned;
  }
}

function findPrimarySkinnedMesh(root: THREE.Object3D): THREE.SkinnedMesh {
  const matches: THREE.SkinnedMesh[] = [];
  root.traverse(object => {
    const mesh = object as THREE.SkinnedMesh;
    if (mesh.isSkinnedMesh) matches.push(mesh);
  });
  const result = matches[0];
  if (!result) throw new Error("Reference character has no skinned mesh");
  return result;
}

function disposeObjectTree(root: THREE.Object3D) {
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  const textures = new Set<THREE.Texture>();
  root.traverse(object => {
    const mesh = object as THREE.Mesh;
    if (mesh.geometry) geometries.add(mesh.geometry);
    const materialList = Array.isArray(mesh.material) ? mesh.material : mesh.material ? [mesh.material] : [];
    for (const material of materialList) {
      materials.add(material);
      for (const value of Object.values(material)) if (value instanceof THREE.Texture) textures.add(value);
    }
  });
  for (const texture of textures) texture.dispose();
  for (const material of materials) material.dispose();
  for (const geometry of geometries) geometry.dispose();
}
