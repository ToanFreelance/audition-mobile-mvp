import { canStartRoom, occupiedParticipants } from "./room-state";
import type { AvatarSnapshot, MatchManifest, MatchParticipantSnapshot, RoomState } from "./types";

function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const nested of Object.values(value as Record<string, unknown>)) deepFreeze(nested);
  }
  return value;
}

function cloneAvatar(avatar: AvatarSnapshot): AvatarSnapshot {
  return {
    characterId: avatar.characterId,
    outfit: { ...avatar.outfit },
    accessoryIds: [...avatar.accessoryIds],
    petId: avatar.petId,
    titleId: avatar.titleId,
  };
}

function required(value: string, name: string) {
  if (!value.trim()) throw new Error(`${name} is required.`);
  return value;
}

export function createMatchManifest(room: RoomState, input: {
  matchId: string;
  audioVersion: string;
  audioHash: string;
  chartVersion: string;
  chartHash: string;
  characterRuntimeVersion: string;
  animationReleaseVersion: number;
  animationReleaseHash: string;
  gameplayConfigVersion: string;
  gameplayConfigHash: string;
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
  if (!Number.isInteger(input.animationReleaseVersion) || input.animationReleaseVersion < 0) {
    throw new Error("animationReleaseVersion must be a non-negative integer.");
  }

  required(input.matchId, "matchId");
  required(input.audioVersion, "audioVersion");
  required(input.audioHash, "audioHash");
  required(input.chartVersion, "chartVersion");
  required(input.chartHash, "chartHash");
  required(input.characterRuntimeVersion, "characterRuntimeVersion");
  required(input.animationReleaseHash, "animationReleaseHash");
  required(input.gameplayConfigVersion, "gameplayConfigVersion");
  required(input.gameplayConfigHash, "gameplayConfigHash");

  const participants: MatchParticipantSnapshot[] = occupiedParticipants(room).map(participant => ({
    participantId: participant.participantId,
    displayName: participant.displayName,
    kind: participant.kind,
    role: participant.role,
    slotIndex: participant.slotIndex,
    avatar: cloneAvatar(participant.avatar),
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
      audioHash: input.audioHash,
      chartVersion: input.chartVersion,
      chartHash: input.chartHash,
      characterRuntimeVersion: input.characterRuntimeVersion,
      animationReleaseVersion: input.animationReleaseVersion,
      animationReleaseHash: input.animationReleaseHash,
    },
    gameplay: {
      configVersion: input.gameplayConfigVersion,
      configHash: input.gameplayConfigHash,
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