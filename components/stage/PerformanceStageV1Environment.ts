import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

type RuntimeUrlResponse = {
  stageId: string;
  url: string;
  expiresInSeconds: number;
  bytes: number;
  sha256: string;
  embeddedAnimations: number;
};

export type PerformanceStageV1LoadResult = {
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
    throw new Error("Performance Stage V1 has invalid bounds.");
  }

  model.scale.multiplyScalar(TARGET_STAGE_WIDTH / size.x);
  model.updateMatrixWorld(true);

  const bounds = new THREE.Box3().setFromObject(model);
  const center = bounds.getCenter(new THREE.Vector3());
  model.position.x -= center.x;
  model.position.y -= bounds.min.y;
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

export class PerformanceStageV1Environment {
  readonly root = new THREE.Group();

  private readonly loader = new GLTFLoader();
  private readonly fxRoot = new THREE.Group();
  private readonly reactiveMaterials: ReactiveMaterialState[] = [];
  private readonly beamGroups: THREE.Group[] = [];
  private readonly beamMaterials: THREE.MeshBasicMaterial[] = [];
  private accentLights: THREE.SpotLight[] = [];
  private loadedModel: THREE.Object3D | null = null;
  private disposed = false;

  constructor() {
    this.root.name = "PerformanceStageV1Environment";
    this.fxRoot.name = "PerformanceStageV1PresentationFX";
    this.root.add(this.fxRoot);
    this.createPresentationFx();
  }

  async load(): Promise<PerformanceStageV1LoadResult> {
    const response = await fetch("/api/stage-runtime?stageId=performance-stage-v1", { cache: "no-store" });
    if (!response.ok) throw new Error(`Performance Stage V1 URL HTTP ${response.status}`);
    const runtime = await response.json() as RuntimeUrlResponse;
    if (!runtime.url || runtime.stageId !== "performance-stage-v1") {
      throw new Error("Performance Stage V1 runtime URL response is invalid.");
    }

    const gltf = await this.loader.loadAsync(runtime.url);
    if (this.disposed) {
      disposeObject(gltf.scene);
      throw new Error("Performance Stage V1 was disposed before load completed.");
    }

    normalizeEnvironment(gltf.scene);
    this.prepareReactiveMaterials(gltf.scene);
    this.loadedModel = gltf.scene;
    this.root.add(gltf.scene);

    const metrics = inspectStage(gltf.scene, gltf.animations);
    return {
      stageId: runtime.stageId,
      ...metrics,
      reactiveMaterials: this.reactiveMaterials.length,
    };
  }

  update(renderTimeSeconds: number, songTimeMs: number, bpm: number, isPlaying: boolean) {
    const beat = beatEnvelope(songTimeMs, bpm, isPlaying);
    const ambient = 0.5 + Math.sin(renderTimeSeconds * 0.82) * 0.5;
    const sweep = Math.sin(renderTimeSeconds * 0.42);

    for (const state of this.reactiveMaterials) {
      state.material.emissiveIntensity = state.baseIntensity + ambient * 0.18 + beat * 0.9;
    }

    this.beamGroups.forEach((group, index) => {
      const direction = index % 2 === 0 ? 1 : -1;
      group.rotation.z = direction * (0.13 + sweep * 0.17 + index * 0.012);
      group.rotation.x = Math.sin(renderTimeSeconds * 0.29 + index * 1.7) * 0.035;
    });

    this.beamMaterials.forEach((material, index) => {
      material.opacity = 0.035 + ambient * 0.025 + beat * (index % 2 ? 0.085 : 0.065);
    });

    this.accentLights.forEach((light, index) => {
      const wave = 0.72 + 0.28 * Math.sin(renderTimeSeconds * 0.66 + index * Math.PI);
      light.intensity = 8 + wave * 6 + beat * 16;
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
  }

  private prepareReactiveMaterials(root: THREE.Object3D) {
    const reactiveName = /(led|screen|light|movinghead|accent|emiss|sign)/i;

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
        if (clone.emissive.getHex() === 0) clone.emissive.copy(clone.color).multiplyScalar(0.55);
        clone.emissiveIntensity = Math.max(0.28, clone.emissiveIntensity || 0);
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
      { x: -4.6, y: 5.15, z: -1.75, color: 0x59e2ff },
      { x: -1.9, y: 5.0, z: -1.9, color: 0xff56d2 },
      { x: 1.9, y: 5.0, z: -1.9, color: 0x9d7cff },
      { x: 4.6, y: 5.15, z: -1.75, color: 0xff56d2 },
    ];

    beamSpecs.forEach((spec, index) => {
      const group = new THREE.Group();
      group.position.set(spec.x, spec.y, spec.z);
      const material = new THREE.MeshBasicMaterial({
        color: spec.color,
        transparent: true,
        opacity: 0.045,
        side: THREE.DoubleSide,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      });
      const beam = new THREE.Mesh(new THREE.ConeGeometry(0.72, 6.2, 16, 1, true), material);
      beam.position.y = -2.9;
      group.add(beam);
      group.rotation.z = (index % 2 === 0 ? 1 : -1) * 0.15;
      this.fxRoot.add(group);
      this.beamGroups.push(group);
      this.beamMaterials.push(material);
    });

    const left = new THREE.SpotLight(0x5ce7ff, 12, 18, Math.PI / 9, 0.72, 1.25);
    left.position.set(-4.6, 5.6, -0.8);
    left.target.position.set(-1.2, 1.15, 0.15);

    const right = new THREE.SpotLight(0xff55d4, 12, 18, Math.PI / 9, 0.72, 1.25);
    right.position.set(4.6, 5.6, -0.8);
    right.target.position.set(1.2, 1.15, 0.15);

    this.fxRoot.add(left, left.target, right, right.target);
    this.accentLights = [left, right];
  }
}
