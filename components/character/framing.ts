export type CharacterCameraPreset = "center" | "wide" | "close";

export type CharacterCameraFrame = {
  fov: number;
  y: number;
  z: number;
  targetY: number;
  targetZ: number;
};

export const NORMALIZED_CHARACTER_HEIGHT = 3.4;

export const CHARACTER_STAGE_POSITION = {
  x: 0,
  y: 0.02,
  z: 0.25,
} as const;

// Portrait presets are sized against the full animated extents of the active
// RobotExpressive clip pool, not only its neutral pose. The stable torso target
// keeps the camera from chasing animated bones.
export const PORTRAIT_CAMERA_FRAMES = {
  wide: { fov: 41, y: 3.65, z: 20.5, targetY: 1.75, targetZ: 0.25 },
  center: { fov: 38, y: 3.45, z: 18.5, targetY: 1.75, targetZ: 0.25 },
  close: { fov: 36, y: 3.3, z: 17.9, targetY: 1.8, targetZ: 0.25 },
} as const satisfies Record<CharacterCameraPreset, CharacterCameraFrame>;

// Landscape remains functional and retains the accepted pre-P3.5 framing.
export const LANDSCAPE_CAMERA_FRAMES = {
  wide: { fov: 42, y: 3.8, z: 23, targetY: 2.75, targetZ: 0.2 },
  center: { fov: 38, y: 3.65, z: 20.5, targetY: 2.7, targetZ: 0.2 },
  close: { fov: 35, y: 3.5, z: 18.2, targetY: 2.65, targetZ: 0.2 },
} as const satisfies Record<CharacterCameraPreset, CharacterCameraFrame>;

export function getCharacterCameraFrame(preset: CharacterCameraPreset, portrait: boolean): CharacterCameraFrame {
  return portrait ? PORTRAIT_CAMERA_FRAMES[preset] : LANDSCAPE_CAMERA_FRAMES[preset];
}
