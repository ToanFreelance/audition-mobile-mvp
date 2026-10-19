import type { CharacterAssetId } from "../character/character-catalog";
import type { StageCameraPose } from "../stage/stageCamera";

/** Presentation identity only. Never derives from name, score, Ready or connection state. */
export type EnsembleParticipant = Readonly<{
  participantId: string;
  slotIndex: number;
  characterAssetId: CharacterAssetId;
}>;

export type FormationPlacement = EnsembleParticipant & Readonly<{
  formationSlot: number;
  x: number;
  y: number;
  z: number;
}>;

// Center-out, shallow-stagger layout: side actors have a clear silhouette,
// and the back pair is not directly behind the central performer.
// P4.6A iPhone visual correction: 4–5 actor lineups must use the available
// lateral dance floor; do not widen the camera (which shrinks every actor).
// One-to-three-player layouts retain their previously accepted positions.
const POSITIONS: Readonly<Record<number, ReadonlyArray<readonly [number, number]>>> = {
  1: [[0, 0.25]],
  2: [[-1.15, 0.50], [1.15, 0.50]],
  3: [[0, 0.35], [-1.55, 0.80], [1.55, 0.80]],
  4: [[-1.02, 0.35], [1.02, 0.35], [-3.05, 1.00], [3.05, 1.00]],
  5: [[0, 0.30], [-1.68, 0.70], [1.68, 0.70], [-3.35, 1.15], [3.35, 1.15]],
};

const PROFILES: Readonly<Record<string, Readonly<{
  scaleX: number;
  zOffset: number;
  floorY: number;
  cameraExtraZ: number;
}>>> = {
  "bright-stage-v1": { scaleX: 1, zOffset: 0, floorY: 0.02, cameraExtraZ: 1.3 },
  "neon-stage-v1": { scaleX: 0.94, zOffset: 2, floorY: 0.02, cameraExtraZ: 1.5 },
  "basketball-court-v1": { scaleX: 1.08, zOffset: 0, floorY: 0.02, cameraExtraZ: 1.3 },
  "classroom-v1": { scaleX: 1, zOffset: 0, floorY: 0.02, cameraExtraZ: 1.0 },
};

function profile(stageId: string) {
  return PROFILES[stageId] ?? PROFILES["bright-stage-v1"];
}

/** Stable for the lifetime of a frozen MatchManifest (and for immutable QA fixtures). */
export function getEnsembleFormation(
  stageId: string,
  participants: readonly EnsembleParticipant[],
): readonly FormationPlacement[] {
  if (participants.length < 1 || participants.length > 5) {
    throw new Error("P4.6A ensemble supports one through five participants.");
  }
  const sorted = [...participants].sort((a, b) =>
    a.slotIndex - b.slotIndex || a.participantId.localeCompare(b.participantId),
  );
  if (new Set(sorted.map(p => p.participantId)).size !== sorted.length
    || new Set(sorted.map(p => p.slotIndex)).size !== sorted.length) {
    throw new Error("P4.6A ensemble requires unique participant and room slot identities.");
  }
  const layout = POSITIONS[sorted.length];
  const stage = profile(stageId);
  return sorted.map((person, formationSlot) => ({
    ...person,
    formationSlot,
    x: layout[formationSlot][0] * stage.scaleX,
    y: stage.floorY,
    z: layout[formationSlot][1] + stage.zOffset,
  }));
}

/** Camera is independent of Ready, scores, connection and remote judgements. */
export function getEnsembleCameraPose(
  stageId: string,
  portrait: boolean,
  count: number,
  pose: StageCameraPose,
): StageCameraPose {
  if (!portrait || count <= 1 || pose.preset !== "gameplay_portrait_locked") return pose;
  const spread = count >= 4 ? 2.25 : count === 3 ? 1.0 : 0.2;
  return {
    ...pose,
    fov: Math.max(pose.fov, count === 5 ? 42 : count === 4 ? 41 : 40),
    z: pose.z + profile(stageId).cameraExtraZ + spread,
    targetY: pose.targetY + 0.13,
  };
}
