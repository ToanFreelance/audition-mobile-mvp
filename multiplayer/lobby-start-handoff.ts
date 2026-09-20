import {
  createMatchStartSession,
  MATCH_START_PROTOCOL_VERSION,
  type MatchStartSession,
} from "./match-start-protocol";
import { matchManifestMatchesRoom } from "./lobby-match-freeze";
import { beginRoomPreloading } from "./room-state";
import type {
  MatchManifest,
  RoomMatchStartBinding,
  RoomState,
} from "./types";

export function createRoomMatchStartBinding(
  session: MatchStartSession,
): RoomMatchStartBinding {
  if (session.phase !== "preloading" || session.startAtServerMs !== null) {
    throw new Error("Lobby can persist only a fresh preloading start session.");
  }
  return Object.freeze({
    protocolVersion: MATCH_START_PROTOCOL_VERSION,
    matchId: session.matchId,
    roomRevision: session.roomRevision,
    startRevision: session.startRevision,
    phase: "preloading" as const,
    safeLeadTimeMs: session.safeLeadTimeMs,
    manifest: session.manifest,
  });
}

export function restoreRoomMatchStartSession(
  binding: RoomMatchStartBinding,
): MatchStartSession {
  if (binding.protocolVersion !== MATCH_START_PROTOCOL_VERSION || binding.phase !== "preloading") {
    throw new Error("Unsupported lobby match-start binding.");
  }
  const session = createMatchStartSession({
    manifest: binding.manifest,
    startRevision: binding.startRevision,
    safeLeadTimeMs: binding.safeLeadTimeMs,
  });
  if (session.matchId !== binding.matchId
    || session.roomId !== binding.manifest.roomId
    || session.roomRevision !== binding.roomRevision) {
    throw new Error("Persisted match-start identity is inconsistent.");
  }
  return session;
}

export function beginLobbyPreload(
  room: RoomState,
  actorParticipantId: string,
  manifest: MatchManifest,
  startRevision: number,
) {
  if (actorParticipantId !== room.hostParticipantId) {
    throw new Error("Only the room host can create a start session.");
  }
  if (!matchManifestMatchesRoom(manifest, room)) {
    throw new Error("MatchManifest does not match the authoritative waiting room.");
  }

  const session = createMatchStartSession({ manifest, startRevision });
  const binding = createRoomMatchStartBinding(session);
  const nextRoom = beginRoomPreloading(room, actorParticipantId, binding);

  return { room: nextRoom, session, binding };
}
