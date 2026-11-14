import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { getCharacterCatalogEntry, type CharacterAssetId, type M3RigFamily } from "./character-catalog";

/** Shared M3 actor assembly. Does not own renderer, AnimationMixer or gameplay clock. */
export type M3Appearance = Readonly<{ hairStyle: string; hairColor: string; skinTone: string }>;
type Slot = "eyes" | "top" | "bottom" | "shoes" | "hair";
type LoadedPart = { scene: THREE.Group; meshes: THREE.SkinnedMesh[] };
type SkinLayer = "body" | "face" | "mouth";
type SkinTarget = { material: THREE.MeshStandardMaterial; originalMap: THREE.Texture | null; layer: SkinLayer };
const SOURCE = "https://raw.githubusercontent.com/memelotsqui/character-assets/main/";
const FALLBACK = "https://cdn.jsdelivr.net/gh/memelotsqui/character-assets@main/";
const FAMILIES = {
  drophunter: {
    body: "body/drophunter.vrm", eyes: "eyes/regulareyes.vrm",
    // Plain dance starter. Each VRM is a separate real SkinnedMesh trait in the Drophunter manifest.
    top: "chest/shirt.vrm", bottom: "legs/casualshorts.vrm", shoes: "feet/sneakers.vrm",
    hair: ["short", "curledbangs", "ponytail", "buns"],
  },
  neurohacker: {
    body: "body/neurohacker.vrm", eyes: "eyes/regulareyes.vrm",
    // T-shirt + casual shorts + everyday shoes, not fantasy armor.
    top: "chest/logotee.vrm", bottom: "legs/cargoshorts.vrm", shoes: "foot/simpleshoes.vrm",
    hair: ["short", "hair1", "hair2", "hair3"],
  },
} as const;
const COLORS: Readonly<Record<string, string | null>> = {
  original: null, black: "#161616", syrup: "#5A3114", purple: "#AF25FF",
};
const SKINS = ["originalskin", "tone1skin", "tone2skin", "tone3skin", "tone4skin"] as const;
function listMeshes(object: THREE.Object3D): THREE.SkinnedMesh[] {
  const meshes: THREE.SkinnedMesh[] = [];
  object.traverse(node => {
    if ((node as THREE.SkinnedMesh).isSkinnedMesh) meshes.push(node as THREE.SkinnedMesh);
  });
  return meshes;
}
function verifyRig(a: THREE.Skeleton, b: THREE.Skeleton): number {
  if (a.bones.length !== b.bones.length) throw new Error(`M3 bones: ${b.bones.length}/${a.bones.length}`);
  let delta = 0;
  for (let i = 0; i < a.bones.length; i++) {
    if (a.bones[i].name !== b.bones[i].name) throw new Error(`M3 bone order mismatch #${i}`);
    const first = a.boneInverses[i].elements, second = b.boneInverses[i].elements;
    for (let j = 0; j < 16; j++) delta = Math.max(delta, Math.abs(first[j] - second[j]));
  }
  if (delta > 0.0001) throw new Error("M3 bind pose mismatch " + delta);
  return delta;
}
function disposeMeshes(object: THREE.Object3D): void {
  object.traverse(node => {
    const mesh = node as THREE.Mesh;
    if (!mesh.isMesh) return;
    mesh.geometry.dispose();
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const material of materials) material.dispose();
  });
}
function skinFiles(family: M3RigFamily, id: string): readonly string[] {
  const i = SKINS.indexOf(id as typeof SKINS[number]);
  if (i < 0) throw new Error("M3 skin tone not in source catalog: " + id);
  const suffix = i === 0 ? "alt" : String(i);
  const files = [
    `_textureCollections/skin/Anime_Proj_base_NoClothes_skin_BaseColor${suffix}.png`,
    `_textureCollections/skin/Anime_Proj_base_NoClothes_Face_BaseColor${suffix}.png`,
  ];
  if (family === "neurohacker") files.push(`_textureCollections/skin/${i ? "skin" + i : "original"}_mouth.png`);
  return files;
}
export class M3CharacterAssembler {
  /** Canonical VRM scene itself, matching the owner-accepted M3 V1.4 rig hierarchy. */
  root: THREE.Group = new THREE.Group();
  skeleton: THREE.Skeleton | null = null;
  baseLoads = 0;
  maxBindDelta = 0;
  private readonly loader = new GLTFLoader();
  private readonly textureLoader = new THREE.TextureLoader();
  private readonly sources = new Map<string, LoadedPart>();
  private readonly textures = new Map<string, THREE.Texture>();
  private readonly equipped = new Map<Slot, THREE.SkinnedMesh[]>();
  private readonly skinTargets: SkinTarget[] = [];
  private readonly originalHairColors = new WeakMap<THREE.Material, THREE.Color>();
  private readonly family: M3RigFamily;
  private readonly bindInverse = new THREE.Matrix4();
  private body: THREE.Group | null = null;
  private hairId = "";
  private hairColor = "original";
  private skinId = "originalskin";
  private appearanceVersion = 0;
  private updateQueue: Promise<void> = Promise.resolve();
  private disposed = false;

  private constructor(family: M3RigFamily) {
    this.family = family;
    this.root.name = "M3Actor:" + family;
  }
  static async create(assetId: CharacterAssetId, appearance: M3Appearance): Promise<M3CharacterAssembler> {
    const entry = getCharacterCatalogEntry(assetId);
    if (!entry?.m3RigFamily || !entry.creatorReady) throw new Error("M3 creator-only asset not enabled");
    const actor = new M3CharacterAssembler(entry.m3RigFamily);
    try { await actor.initialize(appearance); return actor; }
    catch (error) { actor.dispose(); throw error; }
  }
  private async loadPart(file: string): Promise<LoadedPart> {
    const cached = this.sources.get(file);
    if (cached) return cached;
    let scene: THREE.Group;
    try { scene = (await this.loader.loadAsync(SOURCE + this.family + "/" + file)).scene; }
    catch { scene = (await this.loader.loadAsync(FALLBACK + this.family + "/" + file)).scene; }
    if (this.disposed) { disposeMeshes(scene); throw new Error("M3 actor disposed"); }
    const meshes = listMeshes(scene);
    if (!meshes.length) { disposeMeshes(scene); throw new Error("No M3 SkinnedMesh: " + file); }
    const loaded = { scene, meshes };
    this.sources.set(file, loaded);
    return loaded;
  }
  private async initialize(appearance: M3Appearance): Promise<void> {
    const family = FAMILIES[this.family];
    const body = await this.loadPart(family.body);
    if (this.disposed) return;
    const primary = body.meshes.reduce((a, b) => a.skeleton.bones.length >= b.skeleton.bones.length ? a : b);
    if (primary.skeleton.bones.length < 50) throw new Error("Invalid M3 body rig");
    this.skeleton = primary.skeleton;
    this.body = body.scene;
    // Critical: bind the donor meshes directly under the VRM base scene, as in
    // the owner-PASS M3 V1.4 runtime. An intermediate skeleton owner changes
    // coordinate spaces and can make clothing/eyes fly away from the actor.
    // A separate presentation-only wrapper is owned by CharacterCreationStage3D.
    this.root = body.scene;
    this.root.name = "M3Actor:" + this.family;
    this.root.updateMatrixWorld(true);
    this.bindInverse.copy(this.root.matrixWorld).invert();
    this.baseLoads++;
    this.findSkinTargets();
    for (const slot of ["eyes", "top", "bottom", "shoes"] as const) await this.attach(slot, family[slot]);
    await this.swapHair(appearance.hairStyle);
    await Promise.all([this.tintHair(appearance.hairColor), this.replaceSkin(appearance.skinTone)]);
  }
  private async attach(slot: Slot, path: string): Promise<void> {
    const source = await this.loadPart(path);
    if (this.disposed || !this.body || !this.skeleton) return;
    this.root.updateMatrixWorld(true);
    source.scene.updateMatrixWorld(true);
    const replacements: THREE.SkinnedMesh[] = [];
    for (const donor of source.meshes) {
      const delta = verifyRig(this.skeleton, donor.skeleton);
      this.maxBindDelta = Math.max(this.maxBindDelta, delta);
      const material = Array.isArray(donor.material) ? donor.material.map(item => item.clone()) : donor.material.clone();
      const worn = new THREE.SkinnedMesh(donor.geometry, material);
      worn.name = `m3-${slot}-${path}`;
      worn.frustumCulled = false;
      worn.matrixAutoUpdate = false;
      // Inverse of the original unnormalized root world matrix. The viewport
      // transforms an outer Group only; the original bind space stays stable.
      worn.matrix.copy(this.bindInverse.clone().multiply(donor.matrixWorld));
      worn.matrixWorldNeedsUpdate = true;
      worn.bindMode = "detached";
      worn.bind(this.skeleton, donor.bindMatrix);
      if (donor.morphTargetInfluences && donor.morphTargetDictionary) {
        worn.morphTargetInfluences = [...donor.morphTargetInfluences];
        worn.morphTargetDictionary = { ...donor.morphTargetDictionary };
      }
      replacements.push(worn);
    }
    // Guard against coordinate-space regressions (giant skirt/boots/legs).
    // Use the same skeleton's current rest pose; no animation or clock involved.
    this.root.updateMatrixWorld(true);
    const bodyBounds = new THREE.Box3().setFromObject(this.root);
    const bodyHeight = bodyBounds.getSize(new THREE.Vector3()).y;
    if (bodyHeight > 0 && Number.isFinite(bodyHeight)) {
      const partBounds = new THREE.Box3();
      for (const mesh of replacements) {
        // Temporary parent only for an accurate world-bounds diagnostic;
        // do not expose unvalidated garments in the live actor.
        this.root.add(mesh);
        this.root.updateMatrixWorld(true);
        partBounds.expandByObject(mesh);
        mesh.removeFromParent();
      }
      const partSize = partBounds.getSize(new THREE.Vector3());
      const bodySize = bodyBounds.getSize(new THREE.Vector3());
      if (partSize.y > bodyHeight * 2.5 || partSize.x > Math.max(bodySize.x * 3.5, bodyHeight * 1.5)) {
        replacements.forEach(mesh => {
          const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
          mats.forEach(material => material.dispose());
        });
        throw new Error(`M3 ${slot} outside canonical bind space: ${partSize.y.toFixed(2)} / body ${bodyHeight.toFixed(2)}`);
      }
    }
    for (const previous of this.equipped.get(slot) ?? []) {
      previous.removeFromParent();
      const materials = Array.isArray(previous.material) ? previous.material : [previous.material];
      materials.forEach(material => material.dispose());
    }
    for (const mesh of replacements) this.root.add(mesh);
    this.equipped.set(slot, replacements);
  }
  private async swapHair(id: string): Promise<void> {
    if (id === this.hairId) return;
    if (!FAMILIES[this.family].hair.includes(id as never)) throw new Error("Unsupported M3 hair: " + id);
    await this.attach("hair", "head/" + id + ".vrm");
    this.hairId = id;
    this.hairColor = "original";
  }
  private tintHair(id: string): void {
    if (!(id in COLORS)) throw new Error("Unknown M3 hair color: " + id);
    if (id === this.hairColor) return;
    for (const mesh of this.equipped.get("hair") ?? []) {
      const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      for (const material of materials) {
        const color = (material as THREE.MeshStandardMaterial).color;
        if (!color) continue;
        if (!this.originalHairColors.has(material)) this.originalHairColors.set(material, color.clone());
        const requested = COLORS[id];
        if (requested) color.set(requested);
        else color.copy(this.originalHairColors.get(material)!);
      }
    }
    this.hairColor = id;
  }
  private findSkinTargets(): void {
    this.body?.traverse(node => {
      const mesh = node as THREE.Mesh;
      if (!mesh.isMesh) return;
      const name = mesh.name.toLowerCase();
      let layer: SkinLayer | null = null;
      if (/^body$|^body[._(]/.test(name)) layer = "body";
      else if (/headbaked|head_geobaked|headgeobaked/.test(name)) {
        layer = this.family === "neurohacker" && /_1$/.test(name) ? "mouth" : "face";
      }
      if (!layer) return;
      const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      const clones = materials.map(mat => {
        const material = mat.clone() as THREE.MeshStandardMaterial;
        this.skinTargets.push({ material, originalMap: material.map ?? null, layer });
        return material;
      });
      mesh.material = Array.isArray(mesh.material) ? clones : clones[0];
    });
  }
  private async loadTexture(file: string): Promise<THREE.Texture> {
    const old = this.textures.get(file);
    if (old) return old;
    let texture: THREE.Texture;
    try { texture = await this.textureLoader.loadAsync(SOURCE + this.family + "/" + file); }
    catch { texture = await this.textureLoader.loadAsync(FALLBACK + this.family + "/" + file); }
    if (this.disposed) { texture.dispose(); throw new Error("M3 actor disposed"); }
    texture.flipY = false;
    texture.colorSpace = THREE.SRGBColorSpace;
    this.textures.set(file, texture);
    return texture;
  }
  private async replaceSkin(id: string): Promise<void> {
    if (id === this.skinId) return;
    const files = skinFiles(this.family, id);
    if (this.skinTargets.length === 0) throw new Error("Cannot locate M3 skin targets on base");
    const maps = id === "originalskin" ? [] : await Promise.all(files.map(file => this.loadTexture(file)));
    if (this.disposed) return;
    for (const target of this.skinTargets) {
      const index = target.layer === "body" ? 0 : target.layer === "face" ? 1 : 2;
      target.material.map = maps[index] ?? target.originalMap;
      target.material.needsUpdate = true;
    }
    this.skinId = id;
  }
  async updateAppearance(appearance: M3Appearance): Promise<void> {
    const version = ++this.appearanceVersion;
    const work = this.updateQueue.then(async () => {
      if (this.disposed || version !== this.appearanceVersion) return;
      await this.swapHair(appearance.hairStyle);
      if (this.disposed || version !== this.appearanceVersion) return;
      this.tintHair(appearance.hairColor);
      await this.replaceSkin(appearance.skinTone);
    });
    this.updateQueue = work.catch(() => {});
    return work;
  }
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.appearanceVersion++;
    for (const meshes of this.equipped.values()) {
      for (const mesh of meshes) {
        mesh.removeFromParent();
        const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        materials.forEach(material => material.dispose());
      }
    }
    this.equipped.clear();
    this.skinTargets.forEach(target => target.material.dispose());
    this.skinTargets.length = 0;
    this.sources.forEach(source => disposeMeshes(source.scene));
    this.sources.clear();
    this.textures.forEach(texture => texture.dispose());
    this.textures.clear();
    this.root.clear();
    this.skeleton = null;
    this.body = null;
  }
}
