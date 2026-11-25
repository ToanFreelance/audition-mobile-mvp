/** Read-only Waiting Room connection recovery. Never retries RoomState CAS,
 * READY/START, preload acknowledgements or WebAudio scheduling. */
export const WAITING_ROOM_SYNC_BASE_RETRY_MS = 750;
export const WAITING_ROOM_SYNC_MAX_RETRY_MS = 30_000;

export function waitingRoomSyncRetryDelay(attempt: number): number {
  if (!Number.isFinite(attempt) || attempt < 0) throw new Error("Invalid Waiting Room sync retry count.");
  return Math.min(
    WAITING_ROOM_SYNC_MAX_RETRY_MS,
    WAITING_ROOM_SYNC_BASE_RETRY_MS * 2 ** Math.min(6, Math.floor(attempt)),
  );
}

/** Terminal membership errors cannot be repaired by a background GET/reconnect.
 * A kicked Guest must NEVER be auto-joined or silently resurrected. */
export function isWaitingRoomSyncTerminalError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  return /room not found|phòng không tồn tại|không còn trong phòng|participant was removed|participant is unavailable|guest could not join the current room state/i.test(error.message);
}

export function shouldAutoRecoverWaitingRoom(
  status: string, online: boolean, visible: boolean, error?: unknown,
): boolean {
  return status === "waiting" && online && visible
    && !isWaitingRoomSyncTerminalError(error);
}

export type WaitingRoomSyncIndicatorState = "synced" | "syncing" | "reconnecting" | "offline";
export function waitingRoomSyncIndicatorState(
  canonical: "checking" | "verified" | "error" | null,
  transportConnected: boolean,
  online: boolean,
): WaitingRoomSyncIndicatorState {
  if (!online) return "offline";
  if (canonical === "verified" && transportConnected) return "synced";
  if (canonical === "error" || (canonical === "verified" && !transportConnected)) return "reconnecting";
  return "syncing";
}
