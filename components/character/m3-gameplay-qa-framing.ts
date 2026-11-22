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
