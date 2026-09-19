import type { RoomParticipant, RoomSlot, RoomState } from "./types";

/**
 * Builds a presentation-only room view from authoritative membership + realtime presence.
 *
 * Canonical RoomState remains unchanged so transient iOS backgrounding cannot evict a
 * participant from the server-owned room. Remote human guests are only projected into
 * the visible lobby while they have active realtime presence. Bots, host, and the local
 * participant remain visible.
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
