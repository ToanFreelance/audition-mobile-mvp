import * as THREE from "three";

/**
 * M3 Step 3 isolated QA camera framing. SkinnedMesh garments are detached
 * bound to the canonical VRM skeleton; any ancestor scale or translation
 * duplicates transforms and explodes shoes/shorts/hair. Do NOT modify actor.
 *
 * This helper intentionally mutates only camera + independent floor/grid.
 */
export function frameM3GameplayQaCamera(
  actor: THREE.Object3D,
  camera: THREE.PerspectiveCamera,
  floor: THREE.Object3D,
  grid: THREE.Object3D,
): { height: number; distance: number; center: THREE.Vector3 } {
  actor.updateWorldMatrix(true, true);
  const originalWorld = actor.matrixWorld.clone();
  const bounds = new THREE.Box3().setFromObject(actor);
  const center = bounds.getCenter(new THREE.Vector3());
  const size = bounds.getSize(new THREE.Vector3());
  if (!Number.isFinite(size.y) || size.y <= 0 ||
      !Number.isFinite(size.x) || !Number.isFinite(size.z) ||
      !Number.isFinite(center.x) || !Number.isFinite(center.y) || !Number.isFinite(center.z)) {
    throw new Error("Cannot frame M3 avatar: invalid bounds");
  }
  const vFov = THREE.MathUtils.degToRad(camera.fov);
  const height = Math.max(size.y, size.x / Math.max(camera.aspect, 0.1));
  const distance = height / (2 * Math.tan(vFov / 2)) * 1.42;
  camera.position.set(center.x, center.y + size.y * 0.04, center.z + distance);
  camera.lookAt(center);
  camera.near = Math.max(0.001, size.y * 0.005);
  camera.far = Math.max(100, size.y * 100);
  camera.updateProjectionMatrix();

  const decorationScale = size.y / 4;
  floor.scale.setScalar(decorationScale);
  floor.position.set(center.x, bounds.min.y - size.y * 0.005, center.z);
  grid.scale.setScalar(decorationScale);
  grid.position.set(center.x, bounds.min.y - size.y * 0.01, center.z);

  actor.updateWorldMatrix(true, true);
  if (!actor.matrixWorld.equals(originalWorld)) {
    throw new Error("M3 bind space changed during QA camera framing");
  }
  return { height: size.y, distance, center };
}
