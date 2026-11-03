import * as THREE from "three";

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
const PREMIUM_COLOR = 0xb98aff;
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
function cylinder(
  top: number,
  bottom: number,
  height: number,
  color: number,
  metalness = 0.05,
): THREE.Mesh {
  return new THREE.Mesh(
    new THREE.CylinderGeometry(top, bottom, height, 20),
    new THREE.MeshStandardMaterial({ color, metalness, roughness: 0.46 }),
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
        if (look.outfit === "premium") material.color.setHex(PREMIUM_COLOR);
      }
      material.needsUpdate = true;
    }
  });
  return { irisMaterialCount, hairMaterialCount, outfitMaterialCount };
}

function addGlasses(group: THREE.Group, head: { x:number;y:number;z:number }) {
  const mat = new THREE.MeshStandardMaterial({
    color: 0xf5d7ff,
    metalness: 0.75,
    roughness: 0.2,
  });
  for (const sign of [-1, 1]) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.119, 0.010, 8, 48), mat.clone());
    ring.scale.y = 0.73;
    ring.position.set(head.x + sign * 0.13, head.y - 0.018, head.z + 0.022);
    group.add(ring);
  }
  const bridge = cylinder(0.008, 0.008, 0.09, 0xf5d7ff);
  bridge.rotation.z = Math.PI / 2;
  bridge.position.set(head.x, head.y - 0.012, head.z + 0.02);
  group.add(bridge);
  for (const sign of [-1, 1]) {
    const hinge = cylinder(0.008, 0.008, 0.13, 0xf5d7ff);
    hinge.rotation.z = Math.PI / 2;
    hinge.position.set(head.x + sign * 0.245, head.y - 0.025, head.z + 0.013);
    group.add(hinge);
  }
  mat.dispose();
}

function addPonytail(group: THREE.Group, head: { x:number;y:number;z:number }) {
  const hair = new THREE.MeshStandardMaterial({ color: 0x8a3f65, roughness: 0.73 });
  const path = new THREE.CatmullRomCurve3([
    new THREE.Vector3(head.x, head.y + 0.19, head.z - 0.24),
    new THREE.Vector3(head.x + 0.17, head.y + 0.06, head.z - 0.37),
    new THREE.Vector3(head.x + 0.20, head.y - 0.19, head.z - 0.40),
    new THREE.Vector3(head.x + 0.17, head.y - 0.40, head.z - 0.38),
    new THREE.Vector3(head.x + 0.23, head.y - 0.63, head.z - 0.36),
  ]);
  const thick = new THREE.Mesh(new THREE.TubeGeometry(path, 30, 0.10, 10, false), hair);
  group.add(thick);
  const band = sphere(0.075, 0xf0b2eb, 0.15, 0.32);
  band.position.set(head.x, head.y + 0.18, head.z - 0.24);
  group.add(band);
}

function addPremiumShell(group: THREE.Group) {
  // Real 3D removable outer pieces. NOT skinned or fitted to a production garment.
  const jacketLeft = cylinder(0.15, 0.16, 0.51, 0xd7b1f9);
  const jacketRight = cylinder(0.15, 0.16, 0.51, 0xc695f3);
  jacketLeft.position.set(-0.36, 1.88, 0.012);
  jacketRight.position.set(0.36, 1.88, 0.012);
  jacketLeft.rotation.z = -0.17;
  jacketRight.rotation.z = 0.17;
  group.add(jacketLeft, jacketRight);
  for (const sign of [-1, 1]) {
    const lapel = new THREE.Mesh(
      new THREE.BoxGeometry(0.11, 0.41, 0.035),
      new THREE.MeshStandardMaterial({
        color: sign < 0 ? 0xdfbbfa : 0xb48bdb,
        roughness: 0.42,
        metalness: 0.09,
      }),
    );
    lapel.position.set(sign * 0.14, 1.94, 0.245);
    lapel.rotation.z = -sign * 0.20;
    group.add(lapel);
  }
  const belt = new THREE.Mesh(
    new THREE.TorusGeometry(0.27, 0.015, 8, 56),
    new THREE.MeshStandardMaterial({ color: 0xffe3ad, metalness: 0.70, roughness: 0.25 }),
  );
  belt.rotation.x = Math.PI / 2;
  belt.position.set(0, 1.55, 0);
  group.add(belt);
  for (const sign of [-1, 1]) {
    const charm = sphere(0.035, 0xffd6e7, 0.75, 0.23);
    charm.position.set(sign * 0.12, 1.55, 0.28);
    group.add(charm);
  }
}

export function disposeOverlay(group: THREE.Group | null) {
  if (!group) return;
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

  if (look.glasses) addGlasses(group, head);
  if (look.hair === "pony") addPonytail(group, head);
  if (look.outfit === "premium") addPremiumShell(group);

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
  return { group, ...stats };
}
