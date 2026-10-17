import { retryRoomMetadata, type RoomMetadataRetryOptions } from "./room-metadata-retry";

export type PreloadCasAction = "preload-loading" | "loaded" | "preload-failed";
export type PreloadCasIdentity = { matchId: string; roomRevision: number; startRevision: number };

/** Retry metadata only for one frozen preload identity; never reload assets. */
export async function retryPreloadCas(options: Omit<RoomMetadataRetryOptions, "inspect"> & {
  action: PreloadCasAction; identity: PreloadCasIdentity; participantId: string;
}) {
  const { action, identity, participantId } = options;
  return retryRoomMetadata({
    ...options,
    inspect: current => {
      const binding = current.matchStart;
      if (!binding || binding.matchId !== identity.matchId
        || binding.roomRevision !== identity.roomRevision
        || binding.startRevision !== identity.startRevision) return "stop";
      const participant = current.participants.find(item => item.participantId === participantId);
      if (!participant || participant.kind !== "human") return "stop";
      if (participant.loadState === "loaded"
        || (action === "preload-loading" && participant.loadState === "loading")
        || (action === "preload-failed" && participant.loadState === "failed")) return "satisfied";
      return current.status === "preloading" ? "pending" : "stop";
    },
  }).catch(error => {
    if (error instanceof Error && error.message.startsWith("Room metadata retry exhausted")) {
      throw new Error("Preload CAS contention/network retry exhausted; retry ACK for the same match.");
    }
    throw error;
  });
}
