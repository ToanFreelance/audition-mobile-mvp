import type { RoomParticipant, RoomSlot, RoomState } from "./types";

/**
 * Merge realtime presence observations into a page-session latch.
 *
 * Presence only proves that a participant has been seen online. Absence from a later
 * realtime snapshot must not evict them: iOS may suspend Safari/Chrome and drop realtime
 * presence for an arbitrary duration. Authoritative RoomState membership decides when a
 * participant actually leaves.
 */
export function latchLobbyPresence(
  confirmedParticipantIds: readonly string[],
  observedParticipantIds: readonly string[],
  localParticipantId: string,
) {
  return [...new Set([
    ...confirmedParticipantIds,
    ...observedParticipantIds,
    localParticipantId,
  ])];
}

/**
 * Builds a presentation-only room view from authoritative membership + confirmed
 * page-session presence.
 *
 * Canonical RoomState remains unchanged. A remote human guest is hidden until it has
 * been observed online once in the current page session; after that it remains visible
 * while it remains a canonical room member. Bots, host, and the local participant are
 * always visible.
 */
export function projectRoomForPresence(
  room: RoomState,
  presentParticipantIds: readonly string[],
  localParticipantId: string,
): RoomState {
  const present = new Set(presentParticipantIds);
  const visibleParticipant = (participant: RoomParticipant) => {
    if (participant.kind === "bot") return true;
    if (participant.role === "host") return true;
    if (participant.participantId === localParticipantId) return true;
    return present.has(participant.participantId);
  };

  const participants = room.participants.filter(visibleParticipant);
  const visibleIds = new Set(participants.map(item => item.participantId));

  const slots: RoomSlot[] = room.slots.map(slot => {
    if (slot.state !== "occupied") return slot;
    if (visibleIds.has(slot.participantId)) return slot;
    return { slotIndex: slot.slotIndex, state: "open" };
  });

  return {
    ...room,
    participants,
    slots,
  };
}
