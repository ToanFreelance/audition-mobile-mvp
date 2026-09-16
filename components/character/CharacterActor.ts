import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { CharacterAnimationController } from "./CharacterAnimationController";
import { createFallbackCharacter, updateFallbackCharacter, type FallbackCharacter } from "./FallbackCharacter";
import type { CharacterAssetMetrics, CharacterLoadResult, CharacterPresentation, CharacterPresentationEvent } from "./character-types";
import { NORMALIZED_CHARACTER_HEIGHT } from "./framing";
import { HUMAN_CHARACTER_ASSET_URL, loadHumanAnimationLibrary } from "./human-animation-library";
import { applyPublishedDanceRelease, loadPublishedDanceRelease } from "./published-animation-library";

export const DEFAULT_CHARACTER_ASSET_URL = HUMAN_CHARACTER_ASSET_URL;

export class CharacterActor implements CharacterPresentation {
  readonly root = new THREE.Group();

  private readonly loader = new GLTFLoader();
  private model: THREE.Object3D | null = null;
  private animationRoot: THREE.Object3D | null = null;
  private mixer: THREE.AnimationMixer | null = null;
  private animationController: CharacterAnimationController | null = null;
  private clips: THREE.AnimationClip[] = [];
  private fallback: FallbackCharacter | null = null;
  private gameActive = false;
  private presentationEvent: CharacterPresentationEvent | null = null;
  private loadVersion = 0;
  private disposed = false;

  constructor(private readonly assetUrl = DEFAULT_CHARACTER_ASSET_URL) {
    this.root.name = "CharacterActor";
  }

  async load(): Promise<CharacterLoadResult | null> {
    const version = ++this.loadVersion;
    this.releaseCurrentCharacter();

    try {
      // Resolve the canonical published pool in parallel with the character GLB.
      // When available, the human library can skip downloading/parsing/retargeting
      // the legacy CMU FancyFootWork source that would be replaced immediately.
      const publishedDancePromise = loadPublishedDanceRelease();
      const gltf = await this.loader.loadAsync(this.assetUrl);
      const model = gltf.scene;
      normalizeHumanoid(model);
      const skinnedMesh = findPrimarySkinnedMesh(model);
      const publishedDance = await publishedDancePromise;
      const baseClips = gltf.animations.length > 0
        ? gltf.animations
        : await loadHumanAnimationLibrary(skinnedMesh, {
          skipLegacyNormalDanceMocap: publishedDance !== null,
        });
      const { clips } = publishedDance
        ? applyPublishedDanceRelease(baseClips, publishedDance)
        : { clips: baseClips };

      if (this.disposed || version !== this.loadVersion) {
        disposeObjectResources(model);
        return null;
      }

      // Direct Quaternius UAL clips and the baked P3.7 runtime clips address
      // bones by node name. Their mixer root must therefore be the whole
      // character hierarchy, not an isolated SkinnedMesh.
      const animationRoot: THREE.Object3D = model;
      this.model = model;
      this.animationRoot = animationRoot;
      this.clips = clips;
      this.root.add(this.model);

      const idleClip = this.clips.find((clip) => clip.name.toLowerCase() === "idle") ?? null;
      this.mixer = new THREE.AnimationMixer(animationRoot);
      this.animationController = new CharacterAnimationController(this.mixer, this.clips);
      this.animationController.setGameActive(this.gameActive);
      if (this.presentationEvent) this.animationController.handlePresentationEvent(this.presentationEvent);

      return {
        source: "gltf",
        assetUrl: this.assetUrl,
        idleClip: idleClip?.name ?? null,
        metrics: inspectCharacter(this.model, this.clips),
      };
    } catch (error) {
      if (this.disposed || version !== this.loadVersion) return null;
      return this.installFallback(error);
    }
  }

  update(deltaSeconds: number, renderTimeSeconds: number, songTimeMs: number) {
    this.animationController?.update(deltaSeconds, songTimeMs);
    if (this.fallback) updateFallbackCharacter(this.fallback, renderTimeSeconds);
  }

  setGameActive(active: boolean) {
    this.gameActive = active;
    if (!active) this.presentationEvent = null;
    this.animationController?.setGameActive(active);
  }

  handlePresentationEvent(event: CharacterPresentationEvent) {
    this.presentationEvent = event;
    return this.animationController?.handlePresentationEvent(event) ?? false;
  }

  setVisible(visible: boolean) {
    this.root.visible = visible;
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.loadVersion += 1;
    this.releaseCurrentCharacter();
    this.root.removeFromParent();
  }

  private installFallback(error: unknown): CharacterLoadResult {
    this.fallback = createFallbackCharacter();
    this.model = this.fallback.root;
    this.root.add(this.model);

    return {
      source: "fallback",
      assetUrl: this.assetUrl,
      idleClip: null,
      metrics: inspectCharacter(this.model, []),
      error: error instanceof Error ? error.message : "Unknown character asset error",
    };
  }

  private releaseCurrentCharacter() {
    this.animationController?.dispose();
    this.animationController = null;
    if (this.mixer && this.animationRoot) {
      for (const clip of this.clips) this.mixer.uncacheClip(clip);
      this.mixer.uncacheRoot(this.animationRoot);
    }
    this.mixer = null;
    this.animationRoot = null;
    this.clips = [];

    if (this.model) {
      this.root.remove(this.model);
      disposeObjectResources(this.model);
    }
    this.model = null;
    this.fallback = null;
  }
}

function findPrimarySkinnedMesh(root: THREE.Object3D): THREE.SkinnedMesh {
  let target: THREE.SkinnedMesh | null = null;
  root.traverse((object) => {
    if (!target && (object as THREE.SkinnedMesh).isSkinnedMesh) target = object as THREE.SkinnedMesh;
  });
  if (!target) throw new Error("Human character asset has no skinned mesh");
  return target;
}

function normalizeHumanoid(model: THREE.Object3D) {
  model.updateMatrixWorld(true);
  const initialBounds = new THREE.Box3().setFromObject(model);
  const initialSize = initialBounds.getSize(new THREE.Vector3());
  if (!Number.isFinite(initialSize.y) || initialSize.y <= 0) throw new Error("Character asset has invalid bounds");

  model.scale.multiplyScalar(NORMALIZED_CHARACTER_HEIGHT / initialSize.y);
  model.updateMatrixWorld(true);

  const bounds = new THREE.Box3().setFromObject(model);
  const center = bounds.getCenter(new THREE.Vector3());
  model.position.x -= center.x;
  model.position.y -= bounds.min.y;
  model.position.z -= center.z;
  model.updateMatrixWorld(true);
}

function inspectCharacter(root: THREE.Object3D, clips: THREE.AnimationClip[]): CharacterAssetMetrics {
  const materials = new Set<THREE.Material>();
  const textures = new Set<THREE.Texture>();
  const textureDimensions: Array<{ width: number; height: number }> = [];
  let triangles = 0;
  let meshes = 0;
  let skinnedMeshes = 0;

  root.traverse((object) => {
    const mesh = object as THREE.Mesh;
    if (!mesh.isMesh || !mesh.geometry) return;
    meshes += 1;
    if ((mesh as THREE.SkinnedMesh).isSkinnedMesh) skinnedMeshes += 1;
    const position = mesh.geometry.getAttribute("position");
    const elementCount = mesh.geometry.index?.count ?? position?.count ?? 0;
    triangles += Math.floor(elementCount / 3);

    const meshMaterials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const material of meshMaterials) {
      if (!material) continue;
      materials.add(material);
      for (const value of Object.values(material)) {
        if (value instanceof THREE.Texture) textures.add(value);
      }
    }
  });

  for (const texture of textures) {
    const image = texture.image as { width?: number; height?: number } | undefined;
    if (image?.width && image?.height) textureDimensions.push({ width: image.width, height: image.height });
  }

  return {
    triangles,
    materials: materials.size,
    textures: textures.size,
    textureDimensions,
    meshes,
    skinnedMeshes,
    animationClips: clips.map((clip) => clip.name),
  };
}

export function disposeObjectResources(root: THREE.Object3D) {
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  const textures = new Set<THREE.Texture>();
  const skeletons = new Set<THREE.Skeleton>();

  root.traverse((object) => {
    const mesh = object as THREE.Mesh;
    if (mesh.geometry) geometries.add(mesh.geometry);
    const meshMaterials = Array.isArray(mesh.material) ? mesh.material : mesh.material ? [mesh.material] : [];
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
