import * as THREE from "three";
import { NORMALIZED_CHARACTER_HEIGHT } from "./framing";
import { captureM3GameplayQaReferencePose } from "./m3-gameplay-qa-framing";

export type M3Stage3dNormalization = Readonly<{
  nativeHeight: number;
  normalizedHeight: number;
  scale: number;
  attachedMeshes: number;
}>;

/**
 * Gameplay-only M3 presentation scaling. Do not use in Creator or the isolated
 * Step 3 QA route. M3 donor garments are detached-bound by the assembler:
 * scaling their ancestor first double-applies the skin transform, exploding
 * shorts and shoes. Match the accepted Waiting Room's order: switch all
 * SkinnedMeshes to attached binding BEFORE any ancestor scale.
 *
 * The authoritative M3 skeleton/animation/mixer remain the same instance;
 * no rebind, clone, independent animation clock or geometry alteration.
 */
export function normalizeM3Stage3dActor(
  actorRoot: THREE.Object3D, skeleton: THREE.Skeleton,
): M3Stage3dNormalization {
  if (actorRoot.scale.distanceTo(new THREE.Vector3(1, 1, 1)) > 0.00001
    || actorRoot.position.lengthSq() > 0.00001
    || actorRoot.rotation.x !== 0 || actorRoot.rotation.y !== 0 || actorRoot.rotation.z !== 0) {
    throw new Error("M3 Gameplay stage normalization requires an untransformed source actor.");
  }

  actorRoot.updateWorldMatrix(true, true);
  const reference = captureM3GameplayQaReferencePose(skeleton);
  const nativeHeight = reference.head.y - Math.min(...reference.feet.map(foot => foot.y));
  if (!(nativeHeight > 0) || !Number.isFinite(nativeHeight)) {
    throw new Error("M3 Gameplay stage normalization requires a valid skeleton height.");
  }
  const scale = NORMALIZED_CHARACTER_HEIGHT / nativeHeight;
  if (!Number.isFinite(scale) || scale <= 0 || scale > 6) {
    throw new Error("M3 Gameplay stage scale is outside its validated range.");
  }

  let attachedMeshes = 0;
  actorRoot.traverse(node => {
    const skinned = node as THREE.SkinnedMesh;
    if (!skinned.isSkinnedMesh) return;
    if (skinned.skeleton !== skeleton) {
      throw new Error("M3 Gameplay stage contains a foreign wardrobe skeleton.");
    }
    skinned.bindMode = "attached";
    attachedMeshes++;
  });
  if (!attachedMeshes) throw new Error("M3 Gameplay stage has no skinned geometry.");

  // In-place private gameplay assembly, not a shared Creator/Waiting Room source.
  actorRoot.scale.setScalar(scale);
  actorRoot.updateWorldMatrix(true, true);
  const normalized = captureM3GameplayQaReferencePose(skeleton);
  const normalizedHeight = normalized.head.y - Math.min(...normalized.feet.map(foot => foot.y));
  if (Math.abs(normalizedHeight - NORMALIZED_CHARACTER_HEIGHT) > 0.01) {
    throw new Error("M3 Gameplay stage normalization did not preserve the intended height.");
  }
  return { nativeHeight, normalizedHeight, scale, attachedMeshes };
}
