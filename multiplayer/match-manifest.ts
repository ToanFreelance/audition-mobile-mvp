import { canStartRoom, occupiedParticipants } from "./room-state";
import type { MatchManifest, MatchParticipantSnapshot, RoomState } from "./types";

function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const nested of Object.values(value as Record<string, unknown>)) deepFreeze(nested);
  }
  return value;
}

export function createMatchManifest(room: RoomState, input: {
  matchId: string;
  audioVersion: string;
  chartVersion: string;
  animationReleaseVersion: number;
  seed: number;
  bpmExact: number;
  spaceStartMs: number;
  sequenceCounts: readonly number[];
  commandLengths: readonly number[];
  finishRestTurns: number;
}): MatchManifest {
  const eligibility = canStartRoom(room);
  if (!eligibility.allowed) throw new Error(`Room cannot start: ${eligibility.reason}.`);
  if (!room.selectedSongId) throw new Error("Selected song is required.");
  if (!(input.bpmExact > 0) || !(input.spaceStartMs >= 0)) throw new Error("Valid authored song timing is required.");
  if (input.finishRestTurns < 0 || !Number.isInteger(input.finishRestTurns)) throw new Error("finishRestTurns must be a whole turn count.");

  const participants: MatchParticipantSnapshot[] = occupiedParticipants(room).map(participant => ({
    participantId: participant.participantId,
    displayName: participant.displayName,
    kind: participant.kind,
    role: participant.role,
    slotIndex: participant.slotIndex,
    avatar: participant.avatar,
    ...(participant.kind === "bot" ? { botProfile: participant.botProfile } : {}),
  }));

  return deepFreeze({
    manifestVersion: 1,
    matchId: input.matchId,
    roomId: room.roomId,
    roomRevision: room.revision,
    participants,
    content: {
      songId: room.selectedSongId,
      audioVersion: input.audioVersion,
      chartVersion: input.chartVersion,
      animationReleaseVersion: input.animationReleaseVersion,
    },
    gameplay: {
      modeId: room.modeId,
      seed: input.seed >>> 0,
      bpmExact: input.bpmExact,
      spaceStartMs: input.spaceStartMs,
      sequenceCounts: [...input.sequenceCounts],
      commandLengths: [...input.commandLengths],
      finishRestTurns: input.finishRestTurns,
    },
  } satisfies MatchManifest);
}
