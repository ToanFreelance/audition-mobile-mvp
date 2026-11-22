import * as THREE from "three";

/**
 * A static character-creator rest stance. No animation, timer or AnimationMixer.
 * Transforms the already assembled canonical VRM skeleton in world space,
 * rather than relying on rig-specific local Euler axes.
 */
export type CreatorPoseReport = Readonly<{ positionedArms: number; positionedForearms: number }>;

function boneByName(skeleton: THREE.Skeleton, rawName: string): THREE.Bone | undefined {
  const sanitized = THREE.PropertyBinding.sanitizeNodeName(rawName);
  return skeleton.bones.find(b => b.name === sanitized || b.name === rawName);
}

function aimBoneToward(bone: THREE.Bone, child: THREE.Bone, desiredWorldDirection: THREE.Vector3): boolean {
  bone.updateWorldMatrix(true, true);
  const from = bone.getWorldPosition(new THREE.Vector3());
  const to = child.getWorldPosition(new THREE.Vector3());
  const current = to.sub(from);
  if (current.lengthSq() < 1e-8) return false;
  current.normalize();

  // Convert world-space direction change into the parent's coordinate space.
  // This remains correct when left/right arms have opposite authored bone axes.
  const desired = desiredWorldDirection.clone().normalize();
  const worldDelta = new THREE.Quaternion().setFromUnitVectors(current, desired);
  const parentWorld = bone.parent?.getWorldQuaternion(new THREE.Quaternion()) ?? new THREE.Quaternion();
  const localDelta = parentWorld.clone().invert().multiply(worldDelta).multiply(parentWorld);
  bone.quaternion.premultiply(localDelta).normalize();
  bone.updateWorldMatrix(true, true);
  return true;
}

export function applyM3CreatorNeutralPose(skeleton: THREE.Skeleton): CreatorPoseReport {
  let positionedArms = 0;
  let positionedForearms = 0;
  for (const side of ["L", "R"] as const) {
    const upper = boneByName(skeleton, `upper_arm.${side}`);
    const lower = boneByName(skeleton, `lower_arm.${side}`);
    const hand = boneByName(skeleton, `hand.${side}`);
    if (!upper || !lower) continue;

    upper.updateWorldMatrix(true, true);
    const shoulderPosition = upper.getWorldPosition(new THREE.Vector3());
    const elbowPosition = lower.getWorldPosition(new THREE.Vector3());
    const signedSide = Math.sign(elbowPosition.x - shoulderPosition.x) || (side === "L" ? 1 : -1);

    // Relaxed arms close to the torso instead of a T-pose. Small X offset
    // avoids shoulder clipping; forward Z reduces intersection with hips.
    if (aimBoneToward(upper, lower, new THREE.Vector3(signedSide * 0.18, -0.98, 0.045))) {
      positionedArms++;
    }
    if (hand && aimBoneToward(lower, hand, new THREE.Vector3(signedSide * 0.10, -0.965, 0.24))) {
      positionedForearms++;
    }
  }
  skeleton.bones[0]?.updateWorldMatrix(true, true);
  return { positionedArms, positionedForearms };
}
