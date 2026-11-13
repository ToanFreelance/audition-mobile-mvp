import * as THREE from "three";

/**
 * Isolated, reversible Cyber Blue TOP visual try-on.
 *
 * This is NOT a VRoid Studio export and NOT the exact N00_005_01_Tops /
 * N00_010_01_OnePiece template geometry or its UVs. The creator's image is
 * read only from a user-selected ZIP in the browser; it is never bundled here.
 *
 * Prefer a separately identifiable, already skinned TOP mesh and re-use its
 * existing weights. If one cannot be isolated safely, fall back to a clearly
 * marked, segmented torso/arm shell that follows local humanoid bones.
 */
export type CyberBlueTryOn = {
  kind: "existing-skinned-top" | "approx-bone-follow-shell";
  meshCount: number;
  dispose(): void;
};

function nameOf(o: THREE.Object3D, material?: THREE.Material) {
  return (o.name + " " + (material?.name || "")).toLowerCase();
}
function isUpperGarment(label: string) {
  return /top|shirt|coat|jacket|hoodie|outer|vest|blouse|upperwear|upper_cloth|costume_top/i.test(label);
}
function isUnsafe(label: string) {
  return /hair|skin|face|head|eye|brow|mouth|tooth|body|pants|skirt|bottom|shoe|sock|stocking|leg|glove|accessory/i.test(label);
}
function findBone(root: THREE.Object3D, pattern: RegExp): THREE.Bone | null {
  let found: THREE.Bone | null = null;
  root.traverse(node => {
    if (!found && node instanceof THREE.Bone && pattern.test(node.name.replace(/[_\s.-]/g, ""))) found = node;
  });
  return found;
}

export async function attachCyberBlueTop(root: THREE.Object3D, sourcePngUrl: string): Promise<CyberBlueTryOn> {
  const texture = await new THREE.TextureLoader().loadAsync(sourcePngUrl);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.flipY = false;
  texture.anisotropy = 2;
  root.updateMatrixWorld(true);
  const total = new THREE.Box3().setFromObject(root);
  const size = total.getSize(new THREE.Vector3());
  const h = Math.max(size.y, 0.1);
  const originals: Array<{ mesh: THREE.Mesh; material: THREE.Material | THREE.Material[] }> = [];
  const created: THREE.Object3D[] = [];
  const owned: Array<THREE.Material | THREE.BufferGeometry> = [];
  let applied = 0;

  // Never re-skin the accepted avatar or recolor its merged skin/face mesh.
  root.traverse(node => {
    if (!(node instanceof THREE.Mesh) || applied >= 6) return;
    const mesh = node as THREE.Mesh;
    const all = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    const label = nameOf(mesh);
    if (isUnsafe(label)) return;
    const eligible = all.some(mat => isUpperGarment(nameOf(mesh, mat)) && !isUnsafe(nameOf(mesh, mat)));
    if (!eligible) return;
    const bounds = new THREE.Box3().setFromObject(mesh);
    const span = bounds.getSize(new THREE.Vector3());
    const center = bounds.getCenter(new THREE.Vector3());
    if (span.y > h * 0.65 || center.y < total.min.y + h * 0.34 || center.y > total.min.y + h * 0.87) return;
    originals.push({ mesh, material: mesh.material });
    const swap = () => {
      const material = new THREE.MeshStandardMaterial({
        map: texture, color: 0xffffff, roughness: 0.93, metalness: 0.01,
        side: THREE.DoubleSide
      });
      material.name = "CyberBlue_UserTexture_ApproxUV";
      owned.push(material);
      return material;
    };
    // If several original materials share one mesh, only change the explicitly
    // identified garment slots; never overpaint a face/skin/hair material.
    mesh.material = Array.isArray(mesh.material) ?
      mesh.material.map(mat => (isUpperGarment(nameOf(mesh, mat)) && !isUnsafe(nameOf(mesh, mat)) ? swap() : mat)) :
      swap();
    applied++;
  });

  if (applied === 0) {
    // Reference shell has geometry and follows bones but is NOT a skinned VRoid
    // garment. Its UVs are cylindrical approximations, not original template UV.
    const body = new THREE.MeshStandardMaterial({
      map: texture, side: THREE.DoubleSide, roughness: 0.9, metalness: 0.02
    });
    const blue = new THREE.MeshStandardMaterial({ color: "#5387bf", roughness: 0.87, side: THREE.DoubleSide });
    const navy = new THREE.MeshStandardMaterial({ color: "#35374e", roughness: 0.9, side: THREE.DoubleSide });
    owned.push(body, blue, navy);

    const torsoHeight = h * 0.285;
    const torsoGeom = new THREE.CylinderGeometry(h * 0.150, h * 0.143, torsoHeight, 24, 6, true);
    const torso = new THREE.Mesh(torsoGeom, body);
    torso.name = "CyberBlue_ApproxTop_Torso";
    owned.push(torsoGeom);
    const wcenter = new THREE.Vector3(
      (total.min.x + total.max.x) / 2,
      total.min.y + h * 0.643,
      (total.min.z + total.max.z) / 2
    );
    torso.position.copy(root.worldToLocal(wcenter.clone()));
    root.add(torso);
    created.push(torso);

    const chest = findBone(root, /(?:chest|spine2|upperchest|spine3)$/i);
    if (chest) { root.updateMatrixWorld(true); chest.attach(torso); }

    // Separate shoulder segments retain roughly the model's upper-arm motion.
    for (const sign of [-1, 1]) {
      const sleeveGeom = new THREE.CylinderGeometry(h * 0.075, h * 0.071, h * 0.222, 16, 1, false);
      const sleeve = new THREE.Mesh(sleeveGeom, blue);
      sleeve.name = "CyberBlue_ApproxTop_" + (sign < 0 ? "Left" : "Right") + "Sleeve";
      owned.push(sleeveGeom);
      const sleeveWorld = wcenter.clone().add(new THREE.Vector3(sign * h * 0.205, h * 0.105, 0));
      sleeve.position.copy(root.worldToLocal(sleeveWorld));
      sleeve.rotation.z = Math.PI / 2;
      root.add(sleeve);
      created.push(sleeve);
      const arm = sign < 0 ?
        findBone(root, /(?:leftupperarm|leftarm|upperarml|lupperarm)$/i) :
        findBone(root, /(?:rightupperarm|rightarm|upperarmr|rupperarm)$/i);
      if (arm) { root.updateMatrixWorld(true); arm.attach(sleeve); }
    }

    const collarGeo = new THREE.TorusGeometry(h * 0.065, h * 0.013, 8, 22);
    const collar = new THREE.Mesh(collarGeo, navy);
    collar.name = "CyberBlue_ApproxTop_Collar";
    collar.position.set(0, torsoHeight * 0.5, 0);
    collar.rotation.x = Math.PI / 2;
    torso.add(collar);
    owned.push(collarGeo);
    created.push(collar);
  }

  let closed = false;
  return {
    kind: applied ? "existing-skinned-top" : "approx-bone-follow-shell",
    meshCount: applied || created.filter(o => o instanceof THREE.Mesh).length,
    dispose() {
      if (closed) return;
      closed = true;
      for (const item of originals) item.mesh.material = item.material;
      for (const node of created) node.parent?.remove(node);
      for (const resource of owned) resource.dispose();
      texture.dispose();
    }
  };
}
