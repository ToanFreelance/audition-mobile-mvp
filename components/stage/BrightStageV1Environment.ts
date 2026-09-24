import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import type { StagePresentationCameraPreset } from "./stageCamera";

type RuntimeUrlResponse = {
  stageId: string;
  url: string;
  expiresInSeconds: number;
  bytes: number;
  sha256: string;
  embeddedAnimations: number;
};

export type BrightStageV1LoadResult = {
  stageId: string;
  meshes: number;
  materials: number;
  textures: number;
  triangles: number;
  embeddedAnimations: number;
  reactiveMaterials: number;
};

type ReactiveMaterialState = {
  material: THREE.MeshStandardMaterial;
  baseIntensity: number;
};

const TARGET_STAGE_WIDTH = 13.5;

function disposeObject(root: THREE.Object3D) {
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  const textures = new Set<THREE.Texture>();

  root.traverse(object => {
    const mesh = object as THREE.Mesh;
    if (!mesh.isMesh) return;
    if (mesh.geometry) geometries.add(mesh.geometry);
    const meshMaterials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const material of meshMaterials) {
      if (!material) continue;
      materials.add(material);
      for (const value of Object.values(material)) {
        if (value instanceof THREE.Texture) textures.add(value);
      }
    }
  });

  textures.forEach(texture => texture.dispose());
  materials.forEach(material => material.dispose());
  geometries.forEach(geometry => geometry.dispose());
}

function normalizeEnvironment(model: THREE.Object3D) {
  model.updateMatrixWorld(true);
  const initialBounds = new THREE.Box3().setFromObject(model);
  const size = initialBounds.getSize(new THREE.Vector3());
  if (!(size.x > 0) || !(size.y > 0) || !Number.isFinite(size.x) || !Number.isFinite(size.y)) {
    throw new Error("Bright Stage V1 has invalid bounds.");
  }

  model.scale.multiplyScalar(TARGET_STAGE_WIDTH / size.x);
  model.updateMatrixWorld(true);

  const bounds = new THREE.Box3().setFromObject(model);
  const center = bounds.getCenter(new THREE.Vector3());
  model.position.x -= center.x;

  // The playable dancer owns y≈0. Do not align the environment by its lowest
  // mesh bound: the floor slab has thickness below the dance surface, and
  // doing so would lift the slab over the dancer's shoes. Instead align the
  // highest authored dance-floor accent to y=0 so all playable feet remain
  // above environment geometry.
  let floorDatumY = bounds.min.y;
  model.traverse(object => {
    if (!/^(DanceFloor_|FloorRay_)/.test(object.name)) return;
    const objectBounds = new THREE.Box3().setFromObject(object);
    if (Number.isFinite(objectBounds.max.y)) floorDatumY = Math.max(floorDatumY, objectBounds.max.y);
  });
  model.position.y -= floorDatumY;
  model.updateMatrixWorld(true);
}

function inspectStage(root: THREE.Object3D, animations: readonly THREE.AnimationClip[]) {
  const materials = new Set<THREE.Material>();
  const textures = new Set<THREE.Texture>();
  let meshes = 0;
  let triangles = 0;

  root.traverse(object => {
    const mesh = object as THREE.Mesh;
    if (!mesh.isMesh || !mesh.geometry) return;
    meshes += 1;
    const position = mesh.geometry.getAttribute("position");
    const elements = mesh.geometry.index?.count ?? position?.count ?? 0;
    triangles += Math.floor(elements / 3);
    const meshMaterials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const material of meshMaterials) {
      if (!material) continue;
      materials.add(material);
      for (const value of Object.values(material)) {
        if (value instanceof THREE.Texture) textures.add(value);
      }
    }
  });

  return {
    meshes,
    materials: materials.size,
    textures: textures.size,
    triangles,
    embeddedAnimations: animations.length,
  };
}

function beatEnvelope(songTimeMs: number, bpm: number, active: boolean) {
  if (!active || !(bpm > 0) || !Number.isFinite(songTimeMs)) return 0;
  const beat = Math.max(0, songTimeMs) * bpm / 60000;
  const phase = beat - Math.floor(beat);
  return Math.exp(-phase * 8.5);
}

export class BrightStageV1Environment {
  readonly root = new THREE.Group();

  private readonly loader = new GLTFLoader();
  private readonly fxRoot = new THREE.Group();
  private readonly reactiveMaterials: ReactiveMaterialState[] = [];
  private readonly beamGroups: THREE.Group[] = [];
  private readonly beamMaterials: THREE.MeshBasicMaterial[] = [];
  private accentLights: THREE.SpotLight[] = [];
  private readonly frontCameraOccluders: Array<{ object: THREE.Object3D; visible: boolean }> = [];
  private readonly overheadCameraOccluders: Array<{ object: THREE.Object3D; visible: boolean }> = [];
  private loadedModel: THREE.Object3D | null = null;
  private disposed = false;

  constructor() {
    this.root.name = "BrightStageV1Environment";
    this.fxRoot.name = "BrightStageV1PresentationFX";
    this.root.add(this.fxRoot);
    this.createPresentationFx();
  }

  async load(): Promise<BrightStageV1LoadResult> {
    const response = await fetch("/api/stage-runtime?stageId=bright-stage-v1", { cache: "no-store" });
    if (!response.ok) throw new Error(`Bright Stage V1 URL HTTP ${response.status}`);
    const runtime = await response.json() as RuntimeUrlResponse;
    if (!runtime.url || runtime.stageId !== "bright-stage-v1") {
      throw new Error("Bright Stage V1 runtime URL response is invalid.");
    }

    const gltf = await this.loader.loadAsync(runtime.url);
    if (this.disposed) {
      disposeObject(gltf.scene);
      throw new Error("Bright Stage V1 was disposed before load completed.");
    }

    normalizeEnvironment(gltf.scene);
    this.prepareReactiveMaterials(gltf.scene);
    this.prepareCameraOccluders(gltf.scene);
    this.loadedModel = gltf.scene;
    this.root.add(gltf.scene);

    const metrics = inspectStage(gltf.scene, gltf.animations);
    return {
      stageId: runtime.stageId,
      ...metrics,
      reactiveMaterials: this.reactiveMaterials.length,
    };
  }

  setPresentationCamera(preset: StagePresentationCameraPreset) {
    const gameplay = preset === "gameplay_portrait_locked";
    const topDown = preset === "intro_top_down";

    // Foreground portals are useful framing in gameplay, but they must never
    // sweep across the dancer during cinematic intro shots. Top-down also
    // temporarily removes the suspended halo / fixture cluster above the
    // dance floor so the camera has a clean vertical sight line.
    for (const state of this.frontCameraOccluders) state.object.visible = gameplay ? state.visible : false;
    for (const state of this.overheadCameraOccluders) state.object.visible = topDown ? false : state.visible;
  }

  update(renderTimeSeconds: number, songTimeMs: number, bpm: number, isPlaying: boolean) {
    const beat = beatEnvelope(songTimeMs, bpm, isPlaying);
    const ambient = 0.5 + Math.sin(renderTimeSeconds * 0.76) * 0.5;
    const sweep = Math.sin(renderTimeSeconds * 0.38);

    for (const state of this.reactiveMaterials) {
      state.material.emissiveIntensity = state.baseIntensity + ambient * 0.14 + beat * 0.72;
    }

    this.beamGroups.forEach((group, index) => {
      const direction = index % 2 === 0 ? 1 : -1;
      group.rotation.z = direction * (0.08 + sweep * 0.13 + index * 0.01);
      group.rotation.x = Math.sin(renderTimeSeconds * 0.25 + index * 1.4) * 0.028;
    });

    this.beamMaterials.forEach((material, index) => {
      material.opacity = 0.025 + ambient * 0.018 + beat * (index % 2 ? 0.055 : 0.045);
    });

    this.accentLights.forEach((light, index) => {
      const wave = 0.74 + 0.26 * Math.sin(renderTimeSeconds * 0.58 + index * Math.PI);
      light.intensity = 5.5 + wave * 4 + beat * 9;
    });
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.root.removeFromParent();
    if (this.loadedModel) disposeObject(this.loadedModel);
    disposeObject(this.fxRoot);
    this.root.clear();
    this.loadedModel = null;
    this.reactiveMaterials.length = 0;
    this.beamGroups.length = 0;
    this.beamMaterials.length = 0;
    this.accentLights = [];
    this.frontCameraOccluders.length = 0;
    this.overheadCameraOccluders.length = 0;
  }

  private prepareCameraOccluders(root: THREE.Object3D) {
    const front = /^(Front_Arch_|FrontPylon_)/;
    const overhead = /^(Overhead_Halo_|Center_Halo_|Ceiling_Light_|Ceiling_Lens_)/;

    root.traverse(object => {
      if (front.test(object.name)) this.frontCameraOccluders.push({ object, visible: object.visible });
      if (overhead.test(object.name)) this.overheadCameraOccluders.push({ object, visible: object.visible });
    });
  }

  private prepareReactiveMaterials(root: THREE.Object3D) {
    const reactiveName = /(led|screen|light|movinghead|glow|halo|ribbon|spark|emiss|sign)/i;

    root.traverse(object => {
      const mesh = object as THREE.Mesh;
      if (!mesh.isMesh) return;

      const sourceMaterials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      let changed = false;
      const nextMaterials = sourceMaterials.map(material => {
        if (!(material instanceof THREE.MeshStandardMaterial)) return material;

        const hint = `${object.name} ${material.name}`;
        if (!reactiveName.test(hint)) return material;

        const clone = material.clone();
        if (clone.emissive.getHex() === 0) clone.emissive.copy(clone.color).multiplyScalar(0.48);
        const isPrimaryScreen = /(led|screen)/i.test(hint);
        clone.emissiveIntensity = Math.max(isPrimaryScreen ? 0.72 : 0.30, clone.emissiveIntensity || 0);
        this.reactiveMaterials.push({ material: clone, baseIntensity: clone.emissiveIntensity });
        changed = true;
        return clone;
      });

      if (!changed) return;
      mesh.material = Array.isArray(mesh.material) ? nextMaterials : nextMaterials[0];
    });
  }

  private createPresentationFx() {
    const beamSpecs = [
      { x: -4.4, y: 5.6, z: -1.6, color: 0x68e6ff },
      { x: -1.5, y: 5.8, z: -1.8, color: 0xff74cf },
      { x: 1.5, y: 5.8, z: -1.8, color: 0xffc45f },
      { x: 4.4, y: 5.6, z: -1.6, color: 0x8e7bff },
    ];

    beamSpecs.forEach((spec, index) => {
      const group = new THREE.Group();
      group.position.set(spec.x, spec.y, spec.z);
      const material = new THREE.MeshBasicMaterial({
        color: spec.color,
        transparent: true,
        opacity: 0.032,
        side: THREE.DoubleSide,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      });
      const beam = new THREE.Mesh(new THREE.ConeGeometry(0.62, 5.7, 16, 1, true), material);
      beam.position.y = -2.65;
      group.add(beam);
      group.rotation.z = (index % 2 === 0 ? 1 : -1) * 0.09;
      this.fxRoot.add(group);
      this.beamGroups.push(group);
      this.beamMaterials.push(material);
    });

    const left = new THREE.SpotLight(0x66e7ff, 8, 17, Math.PI / 10, 0.76, 1.3);
    left.position.set(-4.4, 5.8, -0.8);
    left.target.position.set(-1.0, 1.1, 0.2);

    const right = new THREE.SpotLight(0xff72ce, 8, 17, Math.PI / 10, 0.76, 1.3);
    right.position.set(4.4, 5.8, -0.8);
    right.target.position.set(1.0, 1.1, 0.2);

    this.fxRoot.add(left, left.target, right, right.target);
    this.accentLights = [left, right];
  }
}
