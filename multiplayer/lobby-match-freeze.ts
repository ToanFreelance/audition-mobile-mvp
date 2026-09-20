import { createMatchManifest } from "./match-manifest";
import { canStartRoom } from "./room-state";
import type { MatchManifest, RoomState } from "./types";

export type LobbyMatchFreezeInput = Parameters<typeof createMatchManifest>[1];

export function freezeLobbyMatch(
  room: RoomState,
  actorParticipantId: string,
  input: LobbyMatchFreezeInput,
): MatchManifest {
  if (room.status !== "waiting") {
    throw new Error("Only a waiting room can be frozen for Start.");
  }
  if (actorParticipantId !== room.hostParticipantId) {
    throw new Error("Only the room host can freeze a match.");
  }

  const gate = canStartRoom(room);
  if (!gate.allowed) {
    throw new Error(`Room cannot start: ${gate.reason}.`);
  }

  return createMatchManifest(room, input);
}

export function matchManifestMatchesRoom(
  manifest: MatchManifest,
  room: RoomState,
) {
  return manifest.roomId === room.roomId
    && manifest.roomRevision === room.revision
    && manifest.gameplay.modeId === room.modeId
    && manifest.content.songId === room.selectedSongId;
}
