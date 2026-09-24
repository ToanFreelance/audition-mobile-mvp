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

export type StageV3LoadResult = {
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

const TARGET_STAGE_WIDTH = 18.5;

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
    throw new Error("Stage V3 has invalid bounds.");
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
    meshMaterials.forEach(material => {
      if (!material) return;
      materials.add(material);
      for (const value of Object.values(material)) {
        if (value instanceof THREE.Texture) textures.add(value);
      }
    });
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

export class StageV3Environment {
  readonly root = new THREE.Group();

  private readonly loader = new GLTFLoader();
  private readonly fxRoot = new THREE.Group();
  private readonly reactiveMaterials: ReactiveMaterialState[] = [];
  private readonly beamMaterials: THREE.MeshBasicMaterial[] = [];
  private readonly beamGroups: THREE.Group[] = [];
  private floorPulseMaterial: THREE.MeshBasicMaterial | null = null;
  private floorPulse: THREE.Mesh | null = null;
  private accentLights: THREE.SpotLight[] = [];
  private loadedModel: THREE.Object3D | null = null;
  private disposed = false;

  constructor() {
    this.root.name = "NeonClubV3Environment";
    this.fxRoot.name = "NeonClubV3PresentationFX";
    this.root.add(this.fxRoot);
    this.createPresentationFx();
  }

  async load(): Promise<StageV3LoadResult> {
    const response = await fetch("/api/stage-v3-runtime", { cache: "no-store" });
    if (!response.ok) throw new Error(`Stage V3 URL HTTP ${response.status}`);
    const runtime = await response.json() as RuntimeUrlResponse;
    if (!runtime.url || runtime.stageId !== "neon-club-v3") throw new Error("Stage V3 runtime URL response is invalid.");

    const gltf = await this.loader.loadAsync(runtime.url);
    if (this.disposed) {
      disposeObject(gltf.scene);
      throw new Error("Stage V3 environment was disposed before load completed.");
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
    const ambient = 0.5 + Math.sin(renderTimeSeconds * 1.18) * 0.5;
    const slow = 0.5 + Math.sin(renderTimeSeconds * 0.43 + 0.7) * 0.5;

    for (const state of this.reactiveMaterials) {
      state.material.emissiveIntensity = state.baseIntensity + ambient * 0.28 + beat * 1.15;
    }

    if (this.floorPulse && this.floorPulseMaterial) {
      const scale = 1 + beat * 0.055 + slow * 0.012;
      this.floorPulse.scale.setScalar(scale);
      this.floorPulseMaterial.opacity = 0.12 + ambient * 0.06 + beat * 0.22;
    }

    this.beamGroups.forEach((group, index) => {
      const side = index % 2 === 0 ? 1 : -1;
      group.rotation.z = side * (0.17 + Math.sin(renderTimeSeconds * 0.52 + index * 1.7) * 0.18);
      group.rotation.x = Math.sin(renderTimeSeconds * 0.31 + index) * 0.04;
    });

    this.beamMaterials.forEach((material, index) => {
      material.opacity = 0.045 + ambient * 0.035 + beat * (index % 2 ? 0.11 : 0.085);
    });

    this.accentLights.forEach((light, index) => {
      const wave = 0.6 + 0.4 * Math.sin(renderTimeSeconds * 0.7 + index * Math.PI);
      light.intensity = 10 + wave * 8 + beat * 18;
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
    this.beamMaterials.length = 0;
    this.beamGroups.length = 0;
    this.accentLights = [];
    this.floorPulseMaterial = null;
    this.floorPulse = null;
  }

  private prepareReactiveMaterials(root: THREE.Object3D) {
    const reactiveName = /(neon|led|screen|display|sign|dj|panel|ring|light|laser|floor|glow|emiss)/i;

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
        if (clone.emissive.getHex() === 0) clone.emissive.copy(clone.color).multiplyScalar(0.6);
        clone.emissiveIntensity = Math.max(0.35, clone.emissiveIntensity || 0);
        this.reactiveMaterials.push({ material: clone, baseIntensity: clone.emissiveIntensity });
        changed = true;
        return clone;
      });

      if (!changed) return;
      mesh.material = Array.isArray(mesh.material) ? nextMaterials : nextMaterials[0];
    });
  }

  private createPresentationFx() {
    const floorMaterial = new THREE.MeshBasicMaterial({
      color: 0x52e6ff,
      transparent: true,
      opacity: 0.16,
      side: THREE.DoubleSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const floorPulse = new THREE.Mesh(new THREE.RingGeometry(2.05, 2.22, 72), floorMaterial);
    floorPulse.rotation.x = -Math.PI / 2;
    floorPulse.position.set(0, 0.035, 0.25);
    this.fxRoot.add(floorPulse);
    this.floorPulseMaterial = floorMaterial;
    this.floorPulse = floorPulse;

    const beamSpecs = [
      { x: -5.0, z: -1.8, color: 0x52e6ff },
      { x: -2.1, z: -2.3, color: 0xff4fd8 },
      { x: 2.1, z: -2.3, color: 0x8c7dff },
      { x: 5.0, z: -1.8, color: 0xff4fd8 },
    ];

    beamSpecs.forEach((spec, index) => {
      const group = new THREE.Group();
      group.position.set(spec.x, 6.6, spec.z);
      const material = new THREE.MeshBasicMaterial({
        color: spec.color,
        transparent: true,
        opacity: 0.065,
        side: THREE.DoubleSide,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      });
      const beam = new THREE.Mesh(new THREE.ConeGeometry(1.15, 8.5, 18, 1, true), material);
      beam.position.y = -4.1;
      group.add(beam);
      group.rotation.z = (index % 2 ? -1 : 1) * 0.2;
      this.fxRoot.add(group);
      this.beamGroups.push(group);
      this.beamMaterials.push(material);
    });

    const left = new THREE.SpotLight(0x57dfff, 14, 20, Math.PI / 8, 0.75, 1.4);
    left.position.set(-5.5, 7.2, 1.8);
    left.target.position.set(-1.4, 1.0, 0.1);
    const right = new THREE.SpotLight(0xff4fd8, 14, 20, Math.PI / 8, 0.75, 1.4);
    right.position.set(5.5, 7.2, 1.8);
    right.target.position.set(1.4, 1.0, 0.1);
    this.fxRoot.add(left, left.target, right, right.target);
    this.accentLights = [left, right];
  }
}
