import * as THREE from "three";

/**
 * Visual-only Premium garment layers copied from the source VRoid SkinnedMesh.
 *
 * This is ACTUAL skinning: clones use the same source skeleton/bind matrix,
 * skinIndex/skinWeight buffers and material UVs. They are siblings of the
 * corresponding source meshes to preserve mesh-to-skeleton transforms.
 *
 * A cloned source outfit is NOT an author-created independent wardrobe asset.
 * For production: prepare original garment topology, occlusion masks, LOD and
 * shared bind-pose skinning in Blender, then enforce inventory entitlements.
 */
export type WardrobeResult = {
  overlays: THREE.SkinnedMesh[];
  sourceSkinnedMeshes: number;
  skinnedGarments: number;
  garments: string[];
};

const CLOTH = /(cloth|outfit|shirt|jacket|hood|skirt|dress|pants|uniform|tops?|bottoms?|socks?|shoes?|cardigan|sweater|fabric|服|衣装)/i;
const EXCLUDE = /(hair|髪|face|body|skin|eyelash|eyelid|eyeiris|pupil)/i;

function garmentMaterial(mesh: THREE.SkinnedMesh, material: THREE.Material): boolean {
  const materialName = material.name ?? "";
  const meshName = mesh.name ?? "";
  if (CLOTH.test(materialName) && !EXCLUDE.test(materialName)) return true;
  // Some VRoid materials have generic names but their skinned mesh is Clothing.
  return CLOTH.test(meshName) && !EXCLUDE.test(meshName) && !EXCLUDE.test(materialName);
}

function premiumMaterial(source: THREE.Material): THREE.Material {
  const material = source.clone();
  material.name = source.name + "_FashionPremiumSkinnedDemo";
  const colorMaterial = material as THREE.Material & {
    color?: THREE.Color;
    emissive?: THREE.Color;
    emissiveIntensity?: number;
  };
  if (colorMaterial.color) {
    // Preserve the original textures and UVs; tint only the overlay.
    colorMaterial.color.multiply(new THREE.Color(0xd5adf4));
  }
  if (colorMaterial.emissive) {
    colorMaterial.emissive.add(new THREE.Color(0x12071d));
    colorMaterial.emissiveIntensity = Math.min(0.22, colorMaterial.emissiveIntensity ?? 0.12);
  }
  material.polygonOffset = true;
  material.polygonOffsetFactor = -1.5;
  material.polygonOffsetUnits = -2;
  material.depthWrite = true;
  material.needsUpdate = true;
  return material;
}

export function buildSkinnedWardrobe(root: THREE.Group): WardrobeResult {
  const sources: THREE.SkinnedMesh[] = [];
  root.traverse((object) => {
    if (!(object instanceof THREE.SkinnedMesh) || object.userData.modularPreviewOverlay) return;
    sources.push(object);
  });

  const overlays: THREE.SkinnedMesh[] = [];
  const names: string[] = [];

  for (const source of sources) {
    if (!source.parent || !source.skeleton || !source.geometry.getAttribute("skinIndex") ||
      !source.geometry.getAttribute("skinWeight")) continue;

    const materials = Array.isArray(source.material) ? source.material : [source.material];
    const matched = materials.map((material, i) => garmentMaterial(source, material) ? i : -1)
      .filter((i) => i >= 0);
    if (matched.length === 0) continue;

    const geometry = source.geometry.clone();
    if (materials.length > 1) {
      const valid = new Set(matched);
      const groups = geometry.groups.filter((group) => valid.has(group.materialIndex));
      if (!groups.length) {
        geometry.dispose();
        continue;
      }
      geometry.clearGroups();
      for (const group of groups) {
        geometry.addGroup(group.start, group.count, group.materialIndex);
      }
    }
    // clone(false) retains the native VRoid bind matrix and skeleton. Do not
    // construct a new Skeleton or regenerate weights: both would misalign.
    const copy = source.clone(false);
    copy.name = source.name + "_PremiumSkinnedOverlay";
    copy.geometry = geometry;
    copy.material = Array.isArray(source.material)
      ? materials.map((material) => premiumMaterial(material))
      : premiumMaterial(materials[0]);
    copy.skeleton = source.skeleton;
    copy.bindMode = source.bindMode;
    copy.bindMatrix.copy(source.bindMatrix);
    copy.bindMatrixInverse.copy(source.bindMatrixInverse);
    copy.userData.modularPreviewOverlay = true;
    copy.castShadow = false;
    copy.receiveShadow = false;
    copy.frustumCulled = false;
    // Attach under the same parent; the skeleton world matrix is unchanged.
    source.parent.add(copy);
    overlays.push(copy);
    names.push(source.name || materials[matched[0]]?.name || "Unnamed garment");
  }

  return { overlays, sourceSkinnedMeshes: sources.length, skinnedGarments: overlays.length, garments: names };
}

export function disposeSkinnedWardrobe(overlays: THREE.SkinnedMesh[] | undefined): void {
  for (const mesh of overlays ?? []) {
    mesh.parent?.remove(mesh);
    mesh.geometry.dispose();
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    materials.forEach((material) => material.dispose());
    // The skeleton is shared with the source and MUST NOT be disposed.
  }
}
