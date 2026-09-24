import type { CharacterCameraPreset, CharacterCameraFrame } from "../character/framing";
import { getCharacterCameraFrame } from "../character/framing";

export type StagePresentationCameraPreset =
  | "gameplay_portrait_locked"
  | "intro_top_down"
  | "intro_back_to_front"
  | "intro_oblique_wide"
  | "intro_front_push";

export type StageCameraPose = {
  preset: StagePresentationCameraPreset;
  fov: number;
  x: number;
  y: number;
  z: number;
  targetX: number;
  targetY: number;
  targetZ: number;
};

export const STAGE_INTRO_DURATION_MS = 4000;

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));
const smooth = (value: number) => {
  const t = clamp01(value);
  return t * t * (3 - 2 * t);
};
const mix = (a: number, b: number, t: number) => a + (b - a) * smooth(t);

function gameplayPose(frame: CharacterCameraFrame): StageCameraPose {
  return {
    preset: "gameplay_portrait_locked",
    fov: frame.fov,
    x: 0,
    y: frame.y,
    z: frame.z,
    targetX: 0,
    targetY: frame.targetY,
    targetZ: frame.targetZ,
  };
}

export function getStagePresentationCameraPose(
  songTimeMs: number,
  isPlaying: boolean,
  portrait: boolean,
  gameplayPreset: CharacterCameraPreset,
): StageCameraPose {
  const gameplay = gameplayPose(getCharacterCameraFrame(gameplayPreset, portrait));
  if (!isPlaying || !Number.isFinite(songTimeMs) || songTimeMs < 0 || songTimeMs >= STAGE_INTRO_DURATION_MS) {
    return gameplay;
  }

  if (songTimeMs < 1100) {
    const t = songTimeMs / 1100;
    return {
      preset: "intro_top_down",
      fov: mix(50, 46, t),
      x: mix(-2.4, -1.1, t),
      y: mix(13.5, 11.4, t),
      z: mix(7.6, 6.3, t),
      targetX: 0,
      targetY: mix(0.45, 0.9, t),
      targetZ: 0.3,
    };
  }

  if (songTimeMs < 2100) {
    const t = (songTimeMs - 1100) / 1000;
    return {
      preset: "intro_back_to_front",
      fov: mix(47, 43, t),
      x: mix(-1.7, 1.0, t),
      y: mix(4.8, 4.25, t),
      z: mix(-6.6, -4.1, t),
      targetX: 0,
      targetY: 1.55,
      targetZ: mix(1.0, 1.9, t),
    };
  }

  if (songTimeMs < 3100) {
    const t = (songTimeMs - 2100) / 1000;
    return {
      preset: "intro_oblique_wide",
      fov: mix(45, 41, t),
      x: mix(8.4, 6.2, t),
      y: mix(6.2, 5.0, t),
      z: mix(11.0, 12.8, t),
      targetX: mix(-0.4, 0, t),
      targetY: mix(2.0, 1.8, t),
      targetZ: 0.35,
    };
  }

  const t = (songTimeMs - 3100) / 900;
  return {
    preset: "intro_front_push",
    fov: mix(44, gameplay.fov, t),
    x: mix(-1.8, gameplay.x, t),
    y: mix(4.8, gameplay.y, t),
    z: mix(24.5, gameplay.z, t),
    targetX: 0,
    targetY: mix(2.0, gameplay.targetY, t),
    targetZ: mix(0.3, gameplay.targetZ, t),
  };
}
