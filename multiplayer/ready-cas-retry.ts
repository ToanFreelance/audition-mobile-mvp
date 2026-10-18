import { retryRoomMetadata, type RoomMetadataRetryOptions } from "./room-metadata-retry";

/** Consent is a frozen boolean, never a toggle replayed after a conflict. */
export function retryReadyCas(options: Omit<RoomMetadataRetryOptions, "inspect"> & {
  participantId: string; desiredReady: boolean; hostParticipantId: string;
}) {
  return retryRoomMetadata({
    ...options, maxAttempts: options.maxAttempts ?? 8,
    inspect: room => {
      // Host transfer resets consent. Never implicitly consent to a new Host.
      if (room.status !== "waiting" || room.matchStart
        || room.hostParticipantId !== options.hostParticipantId) return "stop";
      const participant = room.participants.find(p => p.participantId === options.participantId);
      if (!participant || participant.kind !== "human" || participant.role !== "guest") return "stop";
      return (participant.readyState === "ready") === options.desiredReady ? "satisfied" : "pending";
    },
  });
}
