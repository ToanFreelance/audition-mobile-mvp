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

/**
 * Cinematic shot profiles are pure presentation. The frozen matchId picks a
 * consistent style on every client; neither gameplay turns nor WebAudio depends
 * on this value. Repeat matches naturally rotate through styles.
 */
export const MATCH_CAMERA_STYLES = ["crane", "orbit", "spotlight", "side-sweep", "front-dolly"] as const;
export type MatchCameraStyle = typeof MATCH_CAMERA_STYLES[number];

export function selectMatchCameraStyle(matchId: string): MatchCameraStyle {
  let hash = 2166136261;
  for (let i = 0; i < matchId.length; i++) {
    hash = Math.imul(hash ^ matchId.charCodeAt(i), 16777619);
  }
  return MATCH_CAMERA_STYLES[(hash >>> 0) % MATCH_CAMERA_STYLES.length];
}

function blendPose(a: StageCameraPose, b: StageCameraPose, t: number): StageCameraPose {
  return {
    preset: b.preset,
    fov: mix(a.fov, b.fov, t),
    x: mix(a.x, b.x, t),
    y: mix(a.y, b.y, t),
    z: mix(a.z, b.z, t),
    targetX: mix(a.targetX, b.targetX, t),
    targetY: mix(a.targetY, b.targetY, t),
    targetZ: mix(a.targetZ, b.targetZ, t),
  };
}

type MatchShot = Omit<StageCameraPose, "preset">;
const shot = (x: number, y: number, z: number, fov: number,
  targetY = 1.75): MatchShot => ({
    x, y, z, fov, targetX: 0, targetY, targetZ: 0.25,
  });

/**
 * Every style has a distinct travelling path through the safe FRONT volume.
 * Never use the old behind-the-LED / deep-inside-character intro positions.
 * Cinematic beats are 100% derived from WebAudio song time, without timers.
 */
export function getMatchStageCameraPose(
  songTimeMs: number,
  isPlaying: boolean,
  portrait: boolean,
  gameplayPreset: CharacterCameraPreset,
  matchId: string,
): StageCameraPose {
  const gameplay = gameplayPose(getCharacterCameraFrame(gameplayPreset, portrait));
  if (!isPlaying || !Number.isFinite(songTimeMs) || songTimeMs < 0) return gameplay;
  const style = selectMatchCameraStyle(matchId);
  if (songTimeMs < STAGE_INTRO_DURATION_MS) {
    const authored: Record<MatchCameraStyle, [MatchShot, MatchShot, MatchShot]> = {
      crane: [shot(-2, 8.3, 15, 48, 1.3), shot(2.3, 5.2, 18, 43), shot(-.5, 3.9, 20, 40)],
      orbit: [shot(-5.2, 4.2, 20, 44), shot(3.5, 4.4, 19, 42), shot(1.2, 3.8, 21, 39)],
      spotlight: [shot(0, 7.5, 18, 46, 1.3), shot(-2.5, 4.7, 18, 41), shot(2.5, 4.0, 20, 39)],
      "side-sweep": [shot(4.6, 5.3, 21, 46), shot(-3.8, 4.1, 20, 42), shot(-1.5, 3.7, 21, 39)],
      "front-dolly": [shot(0, 4.7, 27, 48), shot(1.7, 4.0, 23, 42), shot(-1.5, 3.8, 21, 40)],
    };
    const [one, two, three] = authored[style];
    const first = { preset: "intro_oblique_wide" as const, ...one };
    const second = { preset: "intro_front_push" as const, ...two };
    const third = { preset: "intro_front_push" as const, ...three };
    if (songTimeMs < 1400) return blendPose(first, second, songTimeMs / 1400);
    if (songTimeMs < 2850) return blendPose(second, third, (songTimeMs - 1400) / 1450);
    return blendPose(third, gameplay, (songTimeMs - 2850) / 1150);
  }

  // One occasional, extremely restrained camera drift (~2.5 sec per 32 sec).
  // A stable front camera always remains in command and keeps the actor visible.
  // Use style-specific phase so consecutive matches don't feel identical.
  const windowMs = 32_000;
  const moment = (songTimeMs + MATCH_CAMERA_STYLES.indexOf(style) * 5_000) % windowMs;
  if (moment < 6_000 || moment > 8_700) return gameplay;
  const envelope = Math.sin(Math.PI * (moment - 6_000) / 2_700);
  const direction = style === "orbit" || style === "side-sweep" ? -1 : 1;
  return {
    ...gameplay,
    x: gameplay.x + direction * envelope * (portrait ? 0.34 : 0.55),
    y: gameplay.y + envelope * 0.14,
    z: gameplay.z + envelope * .22,
    targetX: gameplay.targetX + direction * envelope * 0.09,
  };
}
