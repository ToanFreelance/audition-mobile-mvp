import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

/** QA-only: do not promote uploaded clothes/body to production without owner acceptance. */
export const MODULAR_QA_SLOTS = ["top", "bottom", "shoes", "hair", "headwear", "accessory"] as const;
export type ModularQaSlot = (typeof MODULAR_QA_SLOTS)[number];
export type ModularQaGender = "female" | "male";
export type ModularQaAssetFiles = { base?: File; equipment: Partial<Record<ModularQaSlot, File>> };

const requiredBones = [
  "hips", "spine", "head", "leftarm", "rightarm",
  "leftupleg", "rightupleg", "leftleg", "rightleg",
  "leftfoot", "rightfoot",
] as const;

export function modularBoneKey(name: string): string {
  return name.replace(/^mixamorig[:_]?/i, "").replace(/[^a-z0-9]/gi, "").toLowerCase();
}

export function validateModularBase(root: THREE.Object3D): THREE.SkinnedMesh {
  const skins: THREE.SkinnedMesh[] = [];
  root.traverse((o) => { if ((o as THREE.SkinnedMesh).isSkinnedMesh) skins.push(o as THREE.SkinnedMesh); });
  if (skins.length !== 1) throw Error("Modular base phải có đúng 1 SkinnedMesh body/innerwear; có " + skins.length + ".");
  const skin = skins[0], names = new Set(skin.skeleton.bones.map(b => modularBoneKey(b.name)));
  for (const bone of requiredBones) if (!names.has(bone)) throw Error("Base rig thiếu bone " + bone + ".");
  if (!skin.geometry.getAttribute("skinIndex") || !skin.geometry.getAttribute("skinWeight"))
    throw Error("Base GLB thiếu skinIndex/skinWeight.");
  return skin;
}

export async function readQaGlb(file: File): Promise<THREE.Object3D> {
  if (!file.name.toLowerCase().endsWith(".glb")) throw Error("Chỉ nhận GLB thật (không dùng ảnh hoặc OBJ).");
  if (file.size > 70 * 1024 * 1024) throw Error("GLB vượt ngân sách QA 70 MiB.");
  const gltf = await new GLTFLoader().parseAsync(await file.arrayBuffer(), "");
  return gltf.scene;
}

function maxMatrixError(a: THREE.Matrix4, b: THREE.Matrix4) {
  return a.elements.reduce((max, value, i) => Math.max(max, Math.abs(value - b.elements[i])), 0);
}

function disposeMeshesOnly(root: THREE.Object3D) {
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  const textures = new Set<THREE.Texture>();
  root.traverse(o => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    geometries.add(mesh.geometry);
    for (const mat of (Array.isArray(mesh.material) ? mesh.material : [mesh.material])) {
      if (!mat) continue;
      materials.add(mat);
      for (const prop of Object.values(mat)) if (prop instanceof THREE.Texture) textures.add(prop);
    }
  });
  for (const texture of textures) texture.dispose();
  for (const mat of materials) mat.dispose();
  for (const geom of geometries) geom.dispose();
}

/**
 * Bind a separately authored garment GLB to the EXISTING base rig.
 * Requires identical rest/bind-space (same exported body template), not merely
 * similarly named Mixamo bones. Fails closed for independently generated rigs.
 * A garment does not get its own AnimationMixer or animation clock.
 */
export class ModularQaEquipment {
  private readonly attachments = new Map<ModularQaSlot, THREE.Object3D>();
  constructor(
    private readonly bodyRoot: THREE.Object3D,
    private readonly base: THREE.SkinnedMesh,
  ) {}

  async equip(slot: ModularQaSlot, file: File): Promise<number> {
    const garment = await readQaGlb(file);
    let skins: THREE.SkinnedMesh[] = [];
    garment.traverse(o => { if ((o as THREE.SkinnedMesh).isSkinnedMesh) skins.push(o as THREE.SkinnedMesh); });
    try {
      if (skins.length === 0) throw Error(slot + ": GLB không có SkinnedMesh; không giả PASS attachment.");
      const baseByName = new Map(this.base.skeleton.bones.map((b, i) => [
        modularBoneKey(b.name), { bone: b, inverse: this.base.skeleton.boneInverses[i] },
      ]));
      for (const skin of skins) {
        if (!skin.geometry.getAttribute("skinIndex") || !skin.geometry.getAttribute("skinWeight"))
          throw Error(slot + ": skinIndex/skinWeight không hợp lệ.");
        const matched: THREE.Bone[] = [];
        for (let i = 0; i < skin.skeleton.bones.length; i++) {
          const key = modularBoneKey(skin.skeleton.bones[i].name);
          const target = baseByName.get(key);
          if (!target) throw Error(slot + ": bone không tương thích: " + key);
          // Entries of inverse bind matrices must match the template within
          // 2 cm / approximately 0.02 matrix-unit tolerance.
          if (maxMatrixError(skin.skeleton.boneInverses[i], target.inverse) > .02)
            throw Error(slot + ": inverse bind pose khác base tại " + key + ". Cần skin transfer trong Blender.");
          matched.push(target.bone);
        }
        const sharedSkeleton = new THREE.Skeleton(
          matched, skin.skeleton.boneInverses.map(m => m.clone()),
        );
        skin.bind(sharedSkeleton, skin.bindMatrix.clone());
        skin.frustumCulled = false; // QA: keep floor/power moves visible despite incorrect bounds.
      }
      // Both base and garment must be exported from the SAME template origin.
      this.bodyRoot.add(garment);
      const previous = this.attachments.get(slot);
      if (previous) { previous.removeFromParent(); disposeMeshesOnly(previous); }
      this.attachments.set(slot, garment);
      return skins.length;
    } catch (err) {
      disposeMeshesOnly(garment);
      throw err;
    }
  }

  unequip(slot: ModularQaSlot) {
    const previous = this.attachments.get(slot);
    if (!previous) return;
    previous.removeFromParent();
    disposeMeshesOnly(previous);
    this.attachments.delete(slot);
  }

  slots(): ModularQaSlot[] { return [...this.attachments.keys()]; }
  dispose() {
    for (const root of this.attachments.values()) {
      root.removeFromParent();
      disposeMeshesOnly(root); // never dispose shared base skeleton
    }
    this.attachments.clear();
  }
}
