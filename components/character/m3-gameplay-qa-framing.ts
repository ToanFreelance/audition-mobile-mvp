import * as THREE from "three";

/**
 * Step 3 presentation-only QA framing. The canonical M3 garments are
 * detached-bound to the skeleton: NEVER translate/scale the actor hierarchy.
 *
 * Render-geometry Box3 bounds are not reliable anchors for detached skinned
 * meshes. Frame from the *same canonical skeleton* used by the M3 actor.
 * This also keeps the horizontal center stable with asymmetric garments.
 */
/** One frozen neutral reference; resize must not sample dancing toes as ground. */
export type M3GameplayQaReferencePose = Readonly<{
  hips: THREE.Vector3;
  head: THREE.Vector3;
  hands: readonly [THREE.Vector3, THREE.Vector3];
  feet: readonly [THREE.Vector3, THREE.Vector3, THREE.Vector3, THREE.Vector3];
}>;

export function captureM3GameplayQaReferencePose(skeleton: THREE.Skeleton): M3GameplayQaReferencePose {
  const joint = (name: string) => {
    const sanitized = THREE.PropertyBinding.sanitizeNodeName(name);
    const matches = skeleton.bones.filter(b => b.name === name || b.name === sanitized);
    if (matches.length !== 1) throw new Error("M3 QA framing missing or ambiguous joint: " + name);
    return matches[0].getWorldPosition(new THREE.Vector3());
  };
  return {
    hips: joint("hips"),
    head: joint("head"),
    hands: [joint("hand.L"), joint("hand.R")],
    feet: [joint("foot.L"), joint("foot.R"), joint("toes.L"), joint("toes.R")],
  };
}

export function frameM3GameplayQaCamera(
  actor: THREE.Object3D,
  pose: M3GameplayQaReferencePose,
  camera: THREE.PerspectiveCamera,
  floor: THREE.Object3D,
  grid: THREE.Object3D,
): { height: number; distance: number; center: THREE.Vector3; floorY: number } {
  actor.updateWorldMatrix(true, true);
  const originalWorld = actor.matrixWorld.clone();
  const { hips, head, hands, feet } = pose;
  const anchors = [hips, head, ...hands, ...feet];
  if (anchors.some(p => ![p.x, p.y, p.z].every(Number.isFinite))) {
    throw new Error("M3 QA framing invalid skeleton anchors");
  }

  const footY = Math.min(...feet.map(p => p.y));
  const height = head.y - footY;
  if (!Number.isFinite(height) || height <= 0.001) {
    throw new Error("M3 QA framing invalid skeleton height");
  }

  // Crown/shoes need space beyond head and toe joints; reserve enough extra
  // room to observe ground clearance, rather than placing feet on the edge.
  const floorY = footY - height * 0.045;
  const lowerY = floorY - height * 0.10;
  const crownY = head.y + height * 0.18;
  const center = new THREE.Vector3(hips.x, (crownY + lowerY) / 2, hips.z);
  const vFov = THREE.MathUtils.degToRad(camera.fov);
  const aspect = camera.aspect;
  if (!(aspect > 0) || !Number.isFinite(aspect)) {
    throw new Error("M3 QA framing invalid camera aspect");
  }
  const tanHalfVertical = Math.tan(vFov / 2);
  const halfHeight = (crownY - lowerY) / 2;
  const handReach = Math.max(...hands.map(p => Math.abs(p.x - center.x)));
  // Static safety margin for horizontal dance-arm poses without making the
  // standing character tiny in portrait. Camera stays fixed during QA motion.
  const halfWidth = Math.max(height * 0.56, handReach + height * 0.12);
  const depthAhead = Math.max(0, ...anchors.map(p => p.z - center.z));
  const distance = Math.max(
    halfHeight / tanHalfVertical,
    halfWidth / (tanHalfVertical * aspect),
  ) * 1.15 + depthAhead + height * 0.08;

  camera.position.set(center.x, center.y, center.z + distance);
  camera.lookAt(center);
  camera.near = Math.max(0.001, height * 0.004);
  camera.far = Math.max(100, distance * 10);
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld(true);

  // Ground marker is a separate scene decoration, not a character transform.
  const decorationScale = height / 4;
  floor.scale.setScalar(decorationScale);
  floor.position.set(center.x, floorY, center.z);
  grid.scale.setScalar(decorationScale);
  grid.position.set(center.x, floorY - height * 0.006, center.z);

  actor.updateWorldMatrix(true, true);
  if (!actor.matrixWorld.equals(originalWorld)) {
    throw new Error("M3 bind space changed during QA camera framing");
  }
  return { height, distance, center, floorY };
}

/**
 * Model-space bones are NOT a reliable proxy for final visible M3 pixels:
 * detached skinned outfits and baked geometry may draw away from joint pivots.
 * A single small alpha-only offscreen render gives the *actual* rendered
 * silhouette. Convert that frozen neutral capture into a world-space frame,
 * then refit camera-only when Safari changes preview dimensions.
 */
export type M3QaSilhouetteBounds = Readonly<{
  left: number; right: number; bottom: number; top: number;
}>;
export type M3QaVisualFrame = Readonly<{
  center: THREE.Vector3;
  width: number;
  height: number;
  depth: number;
}>;

export function measureM3QaSilhouette(
  pixels: Uint8Array, width: number, height: number,
): M3QaSilhouetteBounds {
  if (width <= 2 || height <= 2 || pixels.length !== width * height * 4) {
    throw new Error("M3 QA silhouette invalid pixel buffer");
  }
  let left = width, right = -1, bottom = height, top = -1, count = 0;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (pixels[(y * width + x) * 4 + 3] < 32) continue;
      left = Math.min(left, x);
      right = Math.max(right, x);
      bottom = Math.min(bottom, y);
      top = Math.max(top, y);
      count++;
    }
  }
  if (count < 20 || right <= left || top <= bottom ||
      (left === 0 && right === width - 1 && bottom === 0 && top === height - 1)) {
    throw new Error("M3 QA silhouette unreadable or clipped");
  }
  return {
    left: left / width, right: (right + 1) / width,
    bottom: bottom / height, top: (top + 1) / height,
  };
}

export function deriveM3QaVisualFrame(
  bounds: M3QaSilhouetteBounds, camera: THREE.PerspectiveCamera, depth: number,
): M3QaVisualFrame {
  const distance = camera.position.z - depth;
  const halfV = Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2) * distance;
  const halfH = halfV * camera.aspect;
  if (!(distance > 0) || !Number.isFinite(halfH) || !(halfH > 0)) {
    throw new Error("M3 QA silhouette invalid camera projection");
  }
  const center = new THREE.Vector3(
    camera.position.x + (bounds.left + bounds.right - 1) * halfH,
    camera.position.y + (bounds.bottom + bounds.top - 1) * halfV,
    depth,
  );
  const width = (bounds.right - bounds.left) * 2 * halfH;
  const height = (bounds.top - bounds.bottom) * 2 * halfV;
  if (!(width > 0) || !(height > 0) || ![center.x,center.y,width,height].every(Number.isFinite)) {
    throw new Error("M3 QA silhouette invalid dimensions");
  }
  return { center, width, height, depth };
}

export function fitM3QaVisualFrame(
  camera: THREE.PerspectiveCamera, frame: M3QaVisualFrame,
): void {
  // Keep enough space for shoes, floor contact and dancing limbs.
  const halfV = Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2);
  const distance = Math.max(
    frame.height / (2 * halfV * 0.78),
    frame.width / (2 * halfV * camera.aspect * 0.68),
  ) * 1.14;
  camera.position.set(frame.center.x, frame.center.y, frame.depth + distance);
  camera.lookAt(frame.center);
  camera.near = Math.max(0.001, frame.height * 0.002);
  camera.far = Math.max(100, distance * 10);
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld(true);
}
