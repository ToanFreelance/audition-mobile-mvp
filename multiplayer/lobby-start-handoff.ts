import {
  allClientsLoaded,
  applyLoadedAck,
  beginServerClockSampling,
  createLoadedAckForSession,
  createMatchStartSession,
  issueSharedStartEpoch,
  markParticipantLoadFailed,
  markParticipantLoading,
  MATCH_START_PROTOCOL_VERSION,
  restoreIssuedSharedStartEpoch,
  type LoadedAckRejectionReason,
  type MatchLoadedAck,
  type MatchStartSession,
} from "./match-start-protocol";
import { matchManifestMatchesRoom } from "./lobby-match-freeze";
import { beginRoomCountdown, beginRoomPreloading, setParticipantLoadState } from "./room-state";
import type {
  MatchManifest,
  RoomMatchStartBinding,
  RoomParticipant,
  RoomState,
} from "./types";

export function createRoomMatchStartBinding(
  session: MatchStartSession,
): RoomMatchStartBinding {
  if (session.phase !== "preloading" && session.phase !== "countdown") {
    throw new Error("Lobby can persist only preloading or countdown start sessions.");
  }
  if (session.phase === "preloading" && session.startAtServerMs !== null) {
    throw new Error("Preloading cannot already own a shared start epoch.");
  }
  if (session.phase === "countdown" && session.startAtServerMs === null) {
    throw new Error("Countdown requires an immutable shared start epoch.");
  }
  return Object.freeze({
    protocolVersion: MATCH_START_PROTOCOL_VERSION,
    matchId: session.matchId,
    roomRevision: session.roomRevision,
    startRevision: session.startRevision,
    phase: session.phase,
    safeLeadTimeMs: session.safeLeadTimeMs,
    startAtServerMs: session.startAtServerMs,
    manifest: session.manifest,
  });
}

export function restoreRoomMatchStartSession(
  binding: RoomMatchStartBinding,
  participants?: readonly RoomParticipant[],
): MatchStartSession {
  if (binding.protocolVersion !== MATCH_START_PROTOCOL_VERSION
    || (binding.phase !== "preloading" && binding.phase !== "countdown")) {
    throw new Error("Unsupported lobby match-start binding.");
  }
  let session = createMatchStartSession({
    manifest: binding.manifest,
    startRevision: binding.startRevision,
    safeLeadTimeMs: binding.safeLeadTimeMs,
  });
  if (session.matchId !== binding.matchId
    || session.roomId !== binding.manifest.roomId
    || session.roomRevision !== binding.roomRevision) {
    throw new Error("Persisted match-start identity is inconsistent.");
  }

  if (participants) {
    if (participants.length !== session.participants.length) {
      throw new Error("Canonical preload participants do not match the frozen MatchManifest.");
    }

    for (const expected of session.participants) {
      const participant = participants.find(item => item.participantId === expected.participantId);
      if (!participant || participant.kind !== expected.kind || participant.role !== expected.role) {
        throw new Error(`Canonical preload participant ${expected.participantId} does not match the frozen MatchManifest.`);
      }

      if (participant.loadState === "loading") {
        session = markParticipantLoading(session, participant.participantId);
      } else if (participant.loadState === "loaded") {
        const result = applyLoadedAck(
          session,
          createLoadedAckForSession(session, participant.participantId),
        );
        if (!result.accepted) throw new Error(`Persisted Loaded state is invalid: ${result.reason}.`);
        session = result.session;
      } else if (participant.loadState === "failed") {
        session = markParticipantLoadFailed(
          session,
          participant.participantId,
          "Restored canonical preload failure.",
        );
      }
    }
  } else if (binding.phase === "countdown") {
    // Countdown is only legal after the all-loaded gate, so the binding itself
    // is sufficient to recover protocol state when participant rows are omitted.
    for (const participant of session.participants) {
      const result = applyLoadedAck(
        session,
        createLoadedAckForSession(session, participant.participantId),
      );
      if (!result.accepted) throw new Error(`Persisted Loaded state is invalid: ${result.reason}.`);
      session = result.session;
    }
  }

  if (binding.phase === "preloading") {
    if ((binding.startAtServerMs ?? null) !== null) {
      throw new Error("Preloading binding cannot contain a shared start epoch.");
    }
    return session;
  }

  if (!Number.isFinite(binding.startAtServerMs)) {
    throw new Error("Countdown binding is missing its immutable shared start epoch.");
  }
  session = beginServerClockSampling(session);
  return restoreIssuedSharedStartEpoch(session, binding.startAtServerMs as number);
}

export type LobbyPreloadIdentity = {
  matchId: string;
  roomRevision: number;
  startRevision: number;
};

function requireActivePreload(
  room: RoomState,
  identity: LobbyPreloadIdentity,
) {
  if (room.status !== "preloading" || !room.matchStart) {
    throw new Error("Room has no active preloading session.");
  }
  const binding = room.matchStart;
  if (binding.matchId !== identity.matchId
    || binding.roomRevision !== identity.roomRevision
    || binding.startRevision !== identity.startRevision) {
    throw new Error("Preload identity does not match the active match-start session.");
  }
  return restoreRoomMatchStartSession(binding, room.participants);
}

export function markLobbyParticipantLoading(
  room: RoomState,
  actorParticipantId: string,
  identity: LobbyPreloadIdentity,
) {
  const session = requireActivePreload(room, identity);
  const participant = session.participants.find(item => item.participantId === actorParticipantId);
  if (!participant) throw new Error(`Unknown participant ${actorParticipantId}.`);
  if (participant.kind !== "human") throw new Error("Bot preload state is server-owned.");
  if (participant.state === "loaded" || participant.state === "loading") return { room, session };

  const nextSession = markParticipantLoading(session, actorParticipantId);
  const nextRoom = setParticipantLoadState(room, actorParticipantId, "loading");
  return { room: nextRoom, session: nextSession };
}

export function markLobbyParticipantLoadFailed(
  room: RoomState,
  actorParticipantId: string,
  identity: LobbyPreloadIdentity,
) {
  const session = requireActivePreload(room, identity);
  const participant = session.participants.find(item => item.participantId === actorParticipantId);
  if (!participant) throw new Error(`Unknown participant ${actorParticipantId}.`);
  if (participant.kind !== "human") throw new Error("Bot preload state is server-owned.");
  if (participant.state === "loaded") return { room, session };

  const nextSession = markParticipantLoadFailed(session, actorParticipantId, "Client preload failed.");
  const nextRoom = setParticipantLoadState(room, actorParticipantId, "failed");
  return { room: nextRoom, session: nextSession };
}

export type LobbyLoadedAckResult =
  | {
      accepted: true;
      duplicate: boolean;
      allLoaded: boolean;
      room: RoomState;
      session: MatchStartSession;
    }
  | {
      accepted: false;
      reason: LoadedAckRejectionReason | "sender-mismatch";
      room: RoomState;
      session: MatchStartSession;
    };

export function applyLobbyLoadedAck(
  room: RoomState,
  actorParticipantId: string,
  ack: MatchLoadedAck,
): LobbyLoadedAckResult {
  if (room.status !== "preloading" || !room.matchStart) {
    throw new Error("Room has no active preloading session.");
  }

  const session = restoreRoomMatchStartSession(room.matchStart, room.participants);
  if (actorParticipantId !== ack.participantId) {
    return { accepted: false, reason: "sender-mismatch", room, session };
  }

  const result = applyLoadedAck(session, ack);
  if (!result.accepted) {
    return { accepted: false, reason: result.reason, room, session: result.session };
  }

  const nextRoom = setParticipantLoadState(room, ack.participantId, "loaded");
  const nextSession = restoreRoomMatchStartSession(
    nextRoom.matchStart as RoomMatchStartBinding,
    nextRoom.participants,
  );
  return {
    accepted: true,
    duplicate: nextRoom === room,
    allLoaded: allClientsLoaded(nextSession),
    room: nextRoom,
    session: nextSession,
  };
}

export function beginLobbyCountdown(
  room: RoomState,
  actorParticipantId: string,
  identity: LobbyPreloadIdentity,
  serverNowMs: number,
) {
  const session = requireActivePreload(room, identity);
  const actor = session.participants.find(participant => participant.participantId === actorParticipantId);
  if (!actor || actor.kind !== "human") {
    throw new Error("Only a frozen human participant may request the shared start epoch.");
  }
  if (!allClientsLoaded(session)) {
    throw new Error("Shared countdown requires ALL CLIENTS LOADED.");
  }

  const countdownSession = issueSharedStartEpoch(
    beginServerClockSampling(session),
    serverNowMs,
  );
  const binding = createRoomMatchStartBinding(countdownSession);
  const nextRoom = beginRoomCountdown(room, binding);
  return { room: nextRoom, session: countdownSession, binding };
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
