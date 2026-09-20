import { setGuestReady } from "./room-state";
import type { RoomTransportPayload } from "./transport";
import type { RoomParticipant, RoomState } from "./types";

type RoomSnapshotPayload = Extract<RoomTransportPayload, { kind: "room-snapshot" }>;
type ServerRoomSnapshotPayload = Extract<RoomTransportPayload, { kind: "server-room-snapshot" }>;
type GuestReadyIntentPayload = Extract<RoomTransportPayload, { kind: "guest-ready-intent" }>;

export type RoomSnapshotApplyResult =
  | { accepted: true; room: RoomState }
  | {
      accepted: false;
      reason:
        | "wrong-room"
        | "non-host-sender"
        | "invalid-host"
        | "revision-mismatch"
        | "stale-revision"
        | "invalid-room-shape";
      room: RoomState;
    };

export type GuestReadyIntentResult =
  | { accepted: true; changed: boolean; room: RoomState }
  | {
      accepted: false;
      reason:
        | "sender-mismatch"
        | "stale-revision"
        | "room-not-waiting"
        | "unknown-participant"
        | "not-human-guest"
        | "guest-disconnected";
      room: RoomState;
    };

function validSlotIndexes(room: RoomState) {
  if (room.slots.length !== 6) return false;
  const indexes = new Set(room.slots.map(slot => slot.slotIndex));
  return indexes.size === 6 && [0, 1, 2, 3, 4, 5].every(index => indexes.has(index as 0 | 1 | 2 | 3 | 4 | 5));
}

function validMatchStartBinding(room: RoomState) {
  const binding = room.matchStart ?? null;
  if (room.status === "waiting") return binding === null;
  if (room.status !== "preloading") return true;
  if (!binding || binding.protocolVersion !== 1 || binding.phase !== "preloading") return false;
  if (!binding.matchId || !Number.isInteger(binding.startRevision) || binding.startRevision < 1) return false;
  if (!Number.isInteger(binding.roomRevision) || binding.roomRevision < 1) return false;
  if (!(binding.safeLeadTimeMs >= 3_000)) return false;
  if (binding.roomRevision + 1 > room.revision) return false;
  if (binding.manifest?.manifestVersion !== 1
    || binding.manifest.matchId !== binding.matchId
    || binding.manifest.roomId !== room.roomId
    || binding.manifest.roomRevision !== binding.roomRevision) {
    return false;
  }

  if (binding.manifest.participants.length !== room.participants.length) return false;
  const manifestById = new Map(
    binding.manifest.participants.map(participant => [participant.participantId, participant] as const),
  );
  return room.participants.every(participant => {
    const frozen = manifestById.get(participant.participantId);
    if (!frozen
      || frozen.kind !== participant.kind
      || frozen.role !== participant.role
      || frozen.slotIndex !== participant.slotIndex) {
      return false;
    }
    if (!["idle", "loading", "loaded", "failed"].includes(participant.loadState)) return false;
    return participant.kind !== "bot" || participant.loadState === "loaded";
  });
}

function participantMap(room: RoomState) {
  const map = new Map<string, RoomParticipant>();
  for (const participant of room.participants) {
    if (!participant.participantId || map.has(participant.participantId)) return null;
    map.set(participant.participantId, participant);
  }
  return map;
}

function validOccupiedSlots(room: RoomState, participants: ReadonlyMap<string, RoomParticipant>) {
  const occupiedIds = new Set<string>();
  for (const slot of room.slots) {
    if (slot.state !== "occupied") continue;
    const participant = participants.get(slot.participantId);
    if (!participant || participant.slotIndex !== slot.slotIndex || occupiedIds.has(slot.participantId)) return false;
    occupiedIds.add(slot.participantId);
  }
  return room.participants.every(participant => occupiedIds.has(participant.participantId));
}

export function isCanonicalRoomSnapshot(room: RoomState) {
  if (!room.roomId || !room.roomName) return false;
  if (!Number.isInteger(room.revision) || room.revision < 1) return false;
  if (![2, 3, 4, 5, 6].includes(room.maxPlayers)) return false;
  if (!validSlotIndexes(room)) return false;
  if (!validMatchStartBinding(room)) return false;

  const participants = participantMap(room);
  if (!participants || !validOccupiedSlots(room, participants)) return false;

  const host = participants.get(room.hostParticipantId);
  return Boolean(
    host
    && host.kind === "human"
    && host.role === "host"
    && host.readyState === "not-applicable",
  );
}

export function applyServerRoomSnapshot(
  current: RoomState,
  senderParticipantId: string,
  payload: ServerRoomSnapshotPayload,
): RoomSnapshotApplyResult {
  const snapshot = payload.snapshot;
  if (senderParticipantId !== "server") {
    return { accepted: false, reason: "non-host-sender", room: current };
  }
  if (snapshot.roomId !== current.roomId) return { accepted: false, reason: "wrong-room", room: current };
  if (payload.roomRevision !== snapshot.revision) {
    return { accepted: false, reason: "revision-mismatch", room: current };
  }
  if (snapshot.revision < current.revision) {
    return { accepted: false, reason: "stale-revision", room: current };
  }
  if (!isCanonicalRoomSnapshot(snapshot)) {
    return { accepted: false, reason: "invalid-room-shape", room: current };
  }
  return { accepted: true, room: snapshot };
}

/**
 * Guests consume only canonical snapshots sent by the declared room host.
 * Equal revisions are accepted so a reconnecting guest can recover state.
 */
export function applyHostRoomSnapshot(
  current: RoomState,
  senderParticipantId: string,
  payload: RoomSnapshotPayload,
): RoomSnapshotApplyResult {
  const snapshot = payload.snapshot;
  if (snapshot.roomId !== current.roomId) return { accepted: false, reason: "wrong-room", room: current };
  if (payload.roomRevision !== snapshot.revision) {
    return { accepted: false, reason: "revision-mismatch", room: current };
  }
  if (snapshot.hostParticipantId !== senderParticipantId) {
    return { accepted: false, reason: "non-host-sender", room: current };
  }
  const host = snapshot.participants.find(participant => participant.participantId === senderParticipantId);
  if (!host || host.kind !== "human" || host.role !== "host" || host.readyState !== "not-applicable") {
    return { accepted: false, reason: "invalid-host", room: current };
  }
  if (snapshot.revision < current.revision) {
    return { accepted: false, reason: "stale-revision", room: current };
  }
  if (!isCanonicalRoomSnapshot(snapshot)) {
    return { accepted: false, reason: "invalid-room-shape", room: current };
  }
  return { accepted: true, room: snapshot };
}

/**
 * A guest never publishes RoomState. It sends intent at one known revision;
 * the host validates identity/revision and applies the existing room-domain rule.
 */
export function applyGuestReadyIntent(
  current: RoomState,
  senderParticipantId: string,
  payload: GuestReadyIntentPayload,
): GuestReadyIntentResult {
  if (senderParticipantId !== payload.participantId) {
    return { accepted: false, reason: "sender-mismatch", room: current };
  }
  if (payload.roomRevision !== current.revision) {
    return { accepted: false, reason: "stale-revision", room: current };
  }
  if (current.status !== "waiting") {
    return { accepted: false, reason: "room-not-waiting", room: current };
  }

  const participant = current.participants.find(item => item.participantId === payload.participantId);
  if (!participant) return { accepted: false, reason: "unknown-participant", room: current };
  if (participant.kind !== "human" || participant.role !== "guest") {
    return { accepted: false, reason: "not-human-guest", room: current };
  }
  if (participant.connectionState !== "connected") {
    return { accepted: false, reason: "guest-disconnected", room: current };
  }

  const nextReady = payload.ready ? "ready" : "not-ready";
  if (participant.readyState === nextReady) {
    return { accepted: true, changed: false, room: current };
  }

  return {
    accepted: true,
    changed: true,
    room: setGuestReady(current, participant.participantId, payload.ready),
  };
}
