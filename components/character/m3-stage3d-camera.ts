import { NORMALIZED_CHARACTER_HEIGHT } from "./framing";
import type { StageCameraPose } from "../stage/stageCamera";

/**
 * Step 3.1 portrait QA camera-only correction.
 *
 * Stage3D was composed for the accepted normalized 3.4-unit C1/C4 actor,
 * whereas the M3 bind-space rig renders at its smaller native height.
 * Never scale/translate the live M3 actor: detached skinned wardrobe bindings
 * must stay native. Adjust only the gameplay camera's projection and aim.
 *
 * Preserving the ground-anchored vertical composition matters: narrowing FOV
 * without reducing the look target would crop the avatar's shoes at the
 * gameplay command rail. Only gameplay poses change; cinematic shots,
 * C1/C4, compare routes, landscape and the WebAudio clock are untouched.
 */
export function frameM3Stage3dGameplayCamera(
  pose: StageCameraPose, portrait: boolean, nativeHeight: number | null,
): StageCameraPose {
  if (!portrait || pose.preset !== "gameplay_portrait_locked" || nativeHeight === null) {
    return pose;
  }
  if (!Number.isFinite(nativeHeight) || nativeHeight <= 0) {
    throw new Error("Invalid native M3 Stage3D skeleton height.");
  }
  const factor = Math.min(2.4, Math.max(1, NORMALIZED_CHARACTER_HEIGHT / nativeHeight));
  const halfFov = pose.fov * Math.PI / 360;
  return {
    ...pose,
    fov: Math.atan(Math.tan(halfFov) / factor) * 360 / Math.PI,
    // Feet stay near their former screen-space ground anchor while the
    // native head/torso become readable, without moving the actual model.
    targetY: pose.targetY / factor,
  };
}
