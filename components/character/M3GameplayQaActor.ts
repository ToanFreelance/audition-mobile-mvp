import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { M3CharacterAssembler, type M3Appearance } from "./m3-character-assembler";
import { CharacterAnimationController } from "./CharacterAnimationController";
import { getCharacterCatalogEntry, type CharacterAssetId } from "./character-catalog";
import type {
  CharacterLoadResult, CharacterPresentation, CharacterPresentationEvent,
} from "./character-types";
import { HUMAN_CHARACTER_ASSET_URL, loadHumanAnimationLibrary } from "./human-animation-library";
import { applyPublishedDanceRelease, loadPublishedDanceRelease } from "./published-animation-library";
import { retargetQuaterniusToM3, type M3GameplayRetargetReport } from "./m3-gameplay-retarget";

/**
 * Step 3 preview-only actor using the existing CharacterAnimationController.
 * It has no independent timeline and accepts only externally supplied song time.
 * Not wired to MatchManifest / START until choreography fidelity is approved.
 */
export class M3GameplayQaActor implements CharacterPresentation {
  readonly root = new THREE.Group();
  private assembly: M3CharacterAssembler | null = null;
  private mixer: THREE.AnimationMixer | null = null;
  private controller: CharacterAnimationController | null = null;
  private clips: THREE.AnimationClip[] = [];
  private disposed = false;
  private active = false;
  private pendingEvent: CharacterPresentationEvent | null = null;
  report: M3GameplayRetargetReport | null = null;
  choreographySource: string | null = null;

  constructor(private readonly assetId: CharacterAssetId, private readonly appearance: M3Appearance) {
    const entry = getCharacterCatalogEntry(assetId);
    if (!entry?.m3RigFamily) throw new Error("Step 3 QA requires M3 catalog rig");
    this.root.name = "M3GameplayQaRoot:" + assetId;
  }

  async load(): Promise<CharacterLoadResult> {
    const sourceLoader = new GLTFLoader();
    let sourceScene: THREE.Group | null = null;
    try {
      const assembly = await M3CharacterAssembler.create(this.assetId, this.appearance);
      if (this.disposed) { assembly.dispose(); throw Error("QA actor disposed"); }
      this.assembly = assembly;
      // CRITICAL: M3 wardrobe uses detached SkinnedMesh bindings. Scaling or
      // translating ANY ancestor of the canonical VRM rig makes garments and
      // shoes explode (the owner's iPhone Step 3 screenshots). The accepted
      // Creator preserves the VRM transform; Step 3 must do the same.
      // Frame the character by camera/floor only in the isolated QA route.
      assembly.root.updateMatrixWorld(true);
      const bounds = new THREE.Box3().setFromObject(assembly.root);
      const height = bounds.getSize(new THREE.Vector3()).y;
      if (!Number.isFinite(height) || height <= 0) throw Error("Invalid M3 model bounds");
      if (this.root.scale.x !== 1 || this.root.scale.y !== 1 || this.root.scale.z !== 1 ||
          this.root.position.lengthSq() !== 0 ||
          this.root.rotation.x !== 0 || this.root.rotation.y !== 0 || this.root.rotation.z !== 0) {
        throw Error("M3 QA presentation root must keep native bind space");
      }
      this.root.add(assembly.root);

      const [gltf, published] = await Promise.all([
        sourceLoader.loadAsync(HUMAN_CHARACTER_ASSET_URL),
        loadPublishedDanceRelease(),
      ]);
      sourceScene = gltf.scene;
      if (this.disposed) throw Error("QA actor disposed");
      const sourceMeshes: THREE.SkinnedMesh[] = [];
      sourceScene.traverse(node => {
        if ((node as THREE.SkinnedMesh).isSkinnedMesh)
          sourceMeshes.push(node as THREE.SkinnedMesh);
      });
      const sourceMesh = sourceMeshes[0];
      if (!sourceMesh) throw Error("Quaternius source skeleton missing");
      const library = await loadHumanAnimationLibrary(sourceMesh, {
        skipLegacyNormalDanceMocap: Boolean(published),
        skipLegacyFinishMocap: Boolean(published?.finalSourceClips.length),
      });
      // A published release is the preferred authored gameplay choreography.
      // If the provider is unavailable, mark the legacy library explicitly
      // instead of claiming the fallback is the final gameplay motion set.
      this.choreographySource = published
        ? "Published dance release v" + published.info.releaseVersion
        : "Legacy Quaternius/CMU fallback · NOT final gameplay acceptance";
      const clips = published ? applyPublishedDanceRelease(library, published).clips : library;
      if (!assembly.skeleton) throw Error("M3 target skeleton missing");
      const baked = retargetQuaterniusToM3(sourceScene, sourceMesh.skeleton, assembly.skeleton, clips);
      const required = [
        "Idle", "HumanMiss", "HumanFinish",
        ...Array.from({ length: 8 }, (_, i) => "HumanDance0" + (i + 1)),
      ];
      const names = new Set(baked.clips.map(c => c.name));
      if (required.some(name => !names.has(name))) {
        throw Error("Missing required M3 gameplay choreography clips");
      }
      if (this.disposed) throw Error("QA actor disposed");
      this.report = baked.report;
      this.clips = baked.clips;
      this.mixer = new THREE.AnimationMixer(assembly.root);
      this.controller = new CharacterAnimationController(this.mixer, this.clips);
      this.controller.setGameActive(this.active);
      if (this.pendingEvent) this.controller.handlePresentationEvent(this.pendingEvent);
      // Critical QA camera-ordering fix: clipAction().play() alone does NOT
      // evaluate the skeleton. The first RAF used to apply the Idle clip only
      // AFTER silhouette/camera calibration, so the visible dressed avatar
      // moved away from the measured pose (owner iPhone screenshots).
      // Evaluate frame zero synchronously BEFORE the QA route measures pixels.
      // Zero song-time is a presentation sample, not an independent clock.
      this.controller.update(0, 0);
      assembly.root.updateMatrixWorld(true);
      return {
        source: "gltf", assetUrl: getCharacterCatalogEntry(this.assetId)!.assetUrl,
        idleClip: "Idle",
        metrics: { triangles: 0, materials: 0, textures: 0, textureDimensions: [],
          meshes: 0, skinnedMeshes: 1, animationClips: this.clips.map(c => c.name) },
      };
    } catch (error) {
      // Fail visibly; never substitute a wrong-gender character in gameplay QA.
      this.dispose();
      throw error;
    } finally {
      if (sourceScene) {
        const { disposeObjectResources } = await import("./CharacterActor");
        disposeObjectResources(sourceScene);
      }
    }
  }

  /** Read-only QA framing reference; do not modify the canonical bind-space rig. */
  getQaFramingSkeleton(): THREE.Skeleton {
    if (!this.assembly?.skeleton) throw new Error("M3 QA framing skeleton not loaded");
    return this.assembly.skeleton;
  }

  update(deltaSeconds: number, _renderTimeSeconds: number, songTimeMs: number) {
    this.controller?.update(deltaSeconds, songTimeMs);
  }
  setGameActive(value: boolean) {
    this.active = value;
    this.controller?.setGameActive(value);
  }
  handlePresentationEvent(event: CharacterPresentationEvent) {
    this.pendingEvent = event;
    return this.controller?.handlePresentationEvent(event) ?? false;
  }
  setVisible(value: boolean) { this.root.visible = value; }
  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.controller?.dispose();
    this.controller = null;
    if (this.mixer) {
      this.mixer.stopAllAction();
      this.mixer.uncacheRoot(this.assembly?.root ?? this.root);
    }
    this.mixer = null;
    this.clips = [];
    this.root.clear();
    this.assembly?.dispose();
    this.assembly = null;
  }
}
