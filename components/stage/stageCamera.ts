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

  // Keep every intro shot inside the authored clear camera volume. The first
  // S1.2R pass placed the rear and oblique cameras outside the venue shell,
  // so interpolation crossed the LED wall / front arch on iPhone.
  if (songTimeMs < 1050) {
    const t = songTimeMs / 1050;
    return {
      preset: "intro_top_down",
      fov: mix(49, 45, t),
      x: mix(-1.0, 0.55, t),
      y: mix(11.8, 10.4, t),
      z: mix(1.8, 1.2, t),
      targetX: 0,
      targetY: mix(0.55, 0.82, t),
      targetZ: 0.25,
    };
  }

  if (songTimeMs < 2050) {
    const t = (songTimeMs - 1050) / 1000;
    return {
      preset: "intro_back_to_front",
      fov: mix(46, 42, t),
      x: mix(-1.1, 0.9, t),
      y: mix(3.9, 3.5, t),
      z: mix(-2.6, -1.8, t),
      targetX: 0,
      targetY: mix(1.6, 1.72, t),
      targetZ: mix(0.45, 1.2, t),
    };
  }

  if (songTimeMs < 3050) {
    const t = (songTimeMs - 2050) / 1000;
    return {
      preset: "intro_oblique_wide",
      fov: mix(44, 40, t),
      x: mix(4.2, 3.2, t),
      y: mix(4.6, 4.0, t),
      z: mix(8.0, 9.6, t),
      targetX: mix(-0.25, 0, t),
      targetY: mix(1.9, 1.78, t),
      targetZ: 0.25,
    };
  }

  const t = (songTimeMs - 3050) / 950;
  return {
    preset: "intro_front_push",
    fov: mix(43, gameplay.fov, t),
    x: mix(-1.35, gameplay.x, t),
    y: mix(4.35, gameplay.y, t),
    z: mix(22.0, gameplay.z, t),
    targetX: 0,
    targetY: mix(1.95, gameplay.targetY, t),
    targetZ: mix(0.28, gameplay.targetZ, t),
  };
}
