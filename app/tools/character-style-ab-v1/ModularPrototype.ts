import * as THREE from "three";
import { buildSkinnedWardrobe, disposeSkinnedWardrobe } from "./SkinnedWardrobe";

/**
 * An isolated, removable visual sample for testing the future Fashion B catalog UX.
 * Clothing shells, eye colors and hair accents are intentionally NOT production garments.
 * Eye tint requires a separable iris material; failures are shown explicitly in the UI.
 * No modification to the source VRM buffers, skeleton or gameplay animation pipeline.
 */
export type EyeLook = "natural" | "doll" | "idol";
export type HairLook = "classic" | "pony";
export type OutfitLook = "basic" | "premium";
export type ModularLook = {
  eye: EyeLook;
  hair: HairLook;
  outfit: OutfitLook;
  glasses: boolean;
};

export type ModularResult = {
  group: THREE.Group;
  irisMaterialCount: number;
  hairMaterialCount: number;
  outfitMaterialCount: number;
  skinnedSources: number;
  skinnedGarments: number;
  alteredVertices: number;
};

const EYE_COLOR: Record<EyeLook, number | null> = {
  natural: null,
  doll: 0xc88afa,
  idol: 0x8bcfff,
};
const HAIR_COLOR: Record<HairLook, number | null> = {
  classic: null,
  pony: 0xa65c79,
};
const ORIGINAL_COLOR = "__abOriginalColor";

function sphere(
  radius: number,
  color: number,
  metalness = 0,
  roughness = 0.48,
): THREE.Mesh {
  return new THREE.Mesh(
    new THREE.SphereGeometry(radius, 18, 12),
    new THREE.MeshStandardMaterial({ color, metalness, roughness }),
  );
}
function faceLocator(root: THREE.Group): { x: number; y: number; z: number } {
  root.updateMatrixWorld(true);
  let headBone: THREE.Bone | undefined;
  root.traverse((object) => {
    if (object instanceof THREE.Bone && /(?:^|[_\W])head$|J_Bip_C_Head/i.test(object.name)) {
      headBone = object;
    }
  });
  const local = new THREE.Vector3(0, 2.39, 0.16);
  if (headBone) {
    headBone.getWorldPosition(local);
    root.worldToLocal(local);
    local.y += 0.105;
    local.z += 0.13;
  }

  // A named Face mesh can give us a better front surface for glasses.
  let forward = local.z;
  root.traverse((object) => {
    if (!(object instanceof THREE.Mesh) || !/(?:^|[_\W])face(?:$|[_\W])|Face_00|FaceMouth/i.test(object.name)) return;
    const bounds = new THREE.Box3().setFromObject(object);
    const maxPoint = new THREE.Vector3(0, 0, bounds.max.z);
    root.worldToLocal(maxPoint);
    if (Number.isFinite(maxPoint.z) && Math.abs(maxPoint.z - local.z) < 0.5) {
      forward = Math.max(forward, maxPoint.z + 0.025);
    }
  });
  if (local.y < 1.7 || local.y > 2.9) local.set(0, 2.42, 0.16);
  return { x: local.x, y: local.y, z: forward };
}

/** Restore original material tint on EVERY preset swap, rather than stacking tint multipliers. */
function applyMaterialLooks(root: THREE.Group, look: ModularLook) {
  const seen = new Set<THREE.Material>();
  let irisMaterialCount = 0;
  let hairMaterialCount = 0;
  let outfitMaterialCount = 0;
  root.traverse((object) => {
    if (!(object instanceof THREE.Mesh) || object.userData.modularPreviewOverlay) return;
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    for (const mat of materials) {
      if (seen.has(mat)) continue;
      seen.add(mat);
      const material = mat as THREE.MeshStandardMaterial;
      if (!material.color || !(material.color instanceof THREE.Color)) continue;
      if (typeof material.userData[ORIGINAL_COLOR] !== "number") {
        material.userData[ORIGINAL_COLOR] = material.color.getHex();
      }
      const color = material.userData[ORIGINAL_COLOR] as number;
      material.color.setHex(color);
      const combined = (material.name + " " + object.name).toLowerCase();

      // VRoid iris is generally a separate material. Never tint sclera or face skin.
      if (/(iris|eyeiris|pupil|瞳)/i.test(combined) && !/sclera|white|eyelash|eyelid/.test(combined)) {
        irisMaterialCount++;
        if (EYE_COLOR[look.eye] !== null) material.color.setHex(EYE_COLOR[look.eye] as number);
      } else if (/hair|髪/.test(combined) && !/accessory/.test(combined)) {
        hairMaterialCount++;
        if (HAIR_COLOR[look.hair] !== null) material.color.setHex(HAIR_COLOR[look.hair] as number);
      } else if (/cloth|outfit|shirt|jacket|hood|skirt|dress|pants|uniform|tops|bottoms|socks|shoes/i.test(combined)) {
        outfitMaterialCount++;
        // Premium has its own skinned garment materials: leave Basic color untouched.
      }
      material.needsUpdate = true;
    }
  });
  return { irisMaterialCount, hairMaterialCount, outfitMaterialCount };
}

type AccessoryFit = { bone: THREE.Bone | null; x: number; y: number; front: number; rear: number; unit: number };

/** VRM0 faces -Z. Position headwear relative to the skeleton, not scene origin. */
function fitAccessories(root: THREE.Group): AccessoryFit {
  const anchor = faceLocator(root);
  let bone: THREE.Bone | undefined;
  root.traverse((object) => {
    if (object instanceof THREE.Bone && /J_Bip_C_Head|(?:^|[_-])head$/i.test(object.name)) bone = object;
  });
  const p = new THREE.Vector3(anchor.x, anchor.y - 0.105, 0);
  if (bone) {
    bone.getWorldPosition(p);
    root.worldToLocal(p);
  }
  const bounds = new THREE.Box3().setFromObject(root);
  const unit = THREE.MathUtils.clamp(bounds.getSize(new THREE.Vector3()).y / 2.65, 0.75, 1.3);
  return {
    bone: bone ?? null, x: anchor.x, y: anchor.y,
    front: p.z - 0.205 * unit, rear: p.z + 0.19 * unit, unit,
  };
}

function addGlasses(group: THREE.Group, fit: AccessoryFit) {
  const s = fit.unit, y = fit.y, z = fit.front - 0.017 * s;
  const metal = new THREE.MeshStandardMaterial({ color: 0xe1c7eb, metalness: 0.55, roughness: 0.25 });
  for (const sign of [-1, 1]) {
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.071*s, 0.005*s, 7, 48), metal);
    rim.scale.y = 0.72;
    rim.position.set(fit.x + sign*0.084*s, y, z);
    group.add(rim);
    const side = new THREE.Mesh(new THREE.TubeGeometry(new THREE.LineCurve3(
      new THREE.Vector3(fit.x+sign*0.153*s,y,z),
      new THREE.Vector3(fit.x+sign*0.179*s,y-0.013*s,z+0.070*s)), 6, 0.0035*s, 5, false), metal);
    group.add(side);
  }
  group.add(new THREE.Mesh(new THREE.TubeGeometry(
    new THREE.QuadraticBezierCurve3(
      new THREE.Vector3(fit.x-0.012*s,y,z),
      new THREE.Vector3(fit.x,y+0.024*s,z-0.009*s),
      new THREE.Vector3(fit.x+0.012*s,y,z)),
    10, 0.0045*s, 5, false), metal));
}

/** Compact rear ponytail: three slim strands and ribbon behind the skull (+Z). */
function addPonytail(group: THREE.Group, fit: AccessoryFit) {
  const s = fit.unit, x = fit.x, y = fit.y+0.17*s, z = fit.rear+0.035*s;
  const hair = new THREE.MeshStandardMaterial({ color: 0x884568, roughness: 0.76 });
  for (let n=0; n<3; n++) {
    const side=n-1;
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(x+side*0.025*s, y, z),
      new THREE.Vector3(x+side*0.050*s+0.025*s, y-0.13*s, z+0.08*s),
      new THREE.Vector3(x+side*0.065*s+0.045*s, y-0.31*s, z+0.12*s),
      new THREE.Vector3(x+side*0.065*s+0.020*s, y-0.48*s, z+0.16*s),
    ]);
    group.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 20, (n===1?0.033:0.026)*s, 8, false), hair));
  }
  const band=sphere(0.044*s,0xeec9ef,0.20,0.38);
  band.position.set(x,y,z);group.add(band);
  for (const sign of [-1,1]) {
    const bow=new THREE.Mesh(new THREE.SphereGeometry(0.045*s,12,8),
      new THREE.MeshStandardMaterial({color:0xcaa0df,roughness:0.5}));
    bow.scale.set(1.25,0.55,0.38);
    bow.position.set(x+sign*0.055*s,y,z-0.015*s);
    bow.rotation.z=sign*0.42;
    group.add(bow);
  }
}

export function disposeOverlay(group: THREE.Group | null) {
  if (!group) return;
  // Premium overlays are sibling SkinnedMeshes on the original VRoid rig.
  // Their geometry/materials are disposable; the shared skeleton is not.
  disposeSkinnedWardrobe(group.userData.skinnedWardrobe as ReturnType<typeof buildSkinnedWardrobe>["pieces"] | undefined);
  const headParts = group.userData.headParts as THREE.Group | undefined;
  if (headParts) {
    headParts.parent?.remove(headParts);
    headParts.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      object.geometry.dispose();
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      materials.forEach((material) => material.dispose());
    });
  }
  group.parent?.remove(group);
  group.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    object.geometry.dispose();
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    materials.forEach((material) => material.dispose());
  });
}

export function rebuildModularPreview(
  model: THREE.Group,
  previous: THREE.Group | null,
  look: ModularLook,
): ModularResult {
  disposeOverlay(previous);
  const stats = applyMaterialLooks(model, look);
  const group = new THREE.Group();
  group.name = "FashionB_ModularPrototype_VisualOnly";
  group.userData.modularPreviewOverlay = true;
  const head = faceLocator(model);

  if (look.glasses || look.hair === "pony") {
    const fit = fitAccessories(model);
    const headParts = new THREE.Group();
    headParts.name = "AB_head_accessories_V11";
    headParts.userData.modularPreviewOverlay = true;
    if (look.glasses) addGlasses(headParts, fit);
    if (look.hair === "pony") addPonytail(headParts, fit);
    model.add(headParts);
    model.updateMatrixWorld(true);
    if (fit.bone) fit.bone.attach(headParts);
    group.userData.headParts = headParts;
  }
  const wardrobe = look.outfit === "premium" ? buildSkinnedWardrobe(model) : null;
  if (wardrobe) group.userData.skinnedWardrobe = wardrobe.pieces;

  // Differentiated, detachable sparkle decals. Source VRM iris tint is only
  // applied when GLTFLoader exposes a dedicated iris/pupil material.
  if (look.eye !== "natural") {
    const hue = look.eye === "doll" ? 0xefc7ff : 0xb8efff;
    for (const sign of [-1, 1]) {
      const sparkle = sphere(0.014, hue, 0.5, 0.18);
      sparkle.position.set(head.x + sign * 0.087, head.y + 0.034, head.z + 0.026);
      group.add(sparkle);
    }
  }

  model.add(group);
  return {
    group,
    ...stats,
    skinnedSources: wardrobe?.sourceSkinnedMeshes ?? 0,
    skinnedGarments: wardrobe?.skinnedGarments ?? 0,
    alteredVertices: wardrobe?.alteredVertexCount ?? 0,
  };
}
