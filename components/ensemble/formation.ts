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

// Stage-space formation, viewed from the audience (camera at positive Z):
// 1–3: a single evenly spaced row; 4: symmetric two rear + two front;
// 5: three rear + two front. Front row has *larger* Z.
// Front performers sit between rear silhouettes, rather than directly in
// front of a rear actor. This prevents the depth rows from hiding each other.
// Single-player placement and portrait camera are unchanged.
const POSITIONS: Readonly<Record<number, ReadonlyArray<readonly [number, number]>>> = {
  1: [[0, 0.25]],
  2: [[-1.55, 0.50], [1.55, 0.50]],
  3: [[-2.35, 0.55], [0, 0.55], [2.35, 0.55]],
  // Owner-approved 2+2: rear pair wider, front pair centered in the gaps.
  // Stage-space clearance is >2 units even for the unscaled Bright/Classroom.
  4: [[-2.50, 0.45], [2.50, 0.45], [-1.05, 1.95], [1.05, 1.95]],
  // Three rear actors, two front actors in the left/right gaps.
  5: [[-3.00, 0.45], [0, 0.45], [3.00, 0.45], [-1.65, 1.95], [1.65, 1.95]],
};

const PROFILES: Readonly<Record<string, Readonly<{
  scaleX: number;
  zOffset: number;
  floorY: number;
  cameraExtraZ: number;
}>>> = {
  "bright-stage-v1": { scaleX: 1, zOffset: 0, floorY: 0.02, cameraExtraZ: 1.3 },
  // Owner iPhone QA: remove the prior 0.94 horizontal squeeze for 3/5 actors.
  // Neon has safe lateral space in the accepted stage artwork.
  "neon-stage-v1": { scaleX: 1.12, zOffset: 2, floorY: 0.02, cameraExtraZ: 1.5 },
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
  // Owner iPhone visual follow-up: only five-person Neon needs a little
  // more shoulder clearance. Keep 1–4 actor formations and every other
  // stage profile untouched; never widen the camera or move environment props.
  const xScale = stageId === "neon-stage-v1" && sorted.length === 5
    ? 1.20 : stage.scaleX;
  return sorted.map((person, formationSlot) => ({
    ...person,
    formationSlot,
    x: layout[formationSlot][0] * xScale,
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
