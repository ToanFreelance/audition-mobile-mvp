import type { RoomState } from "./types";

/** An uncertain HTTP outcome is not a rejected domain operation. */
export class RoomMetadataTransportError extends Error {}
export function isRetryableRoomMetadataError(error: unknown) {
  return error instanceof RoomMetadataTransportError || error instanceof TypeError
    || (error instanceof Error && error.name === "AbortError");
}
export type RoomMetadataRetryOptions = {
  readCurrent: () => RoomState;
  // Implementations must honour timeoutMs, including response body reads.
  refreshCanonical: (timeoutMs: number) => Promise<RoomState>;
  mutate: (snapshot: RoomState, timeoutMs: number) => Promise<{ snapshot: RoomState; conflict: boolean }>;
  cancelled: () => boolean;
  inspect: (snapshot: RoomState) => "pending" | "satisfied" | "stop";
  maxAttempts?: number; maxDurationMs?: number;
  wait?: (delayMs: number) => Promise<void>; now?: () => number;
};

/** Bounded desired-state CAS recovery. Owns metadata, never song time. */
export async function retryRoomMetadata(options: RoomMetadataRetryOptions): Promise<RoomState | null> {
  const { readCurrent, refreshCanonical, mutate, cancelled, inspect,
    maxAttempts = 24, maxDurationMs = 30_000,
    wait = ms => new Promise<void>(resolve => setTimeout(resolve, ms)), now = Date.now } = options;
  const deadline = now() + maxDurationMs;
  const roomId = readCurrent().roomId;
  let current = readCurrent(), uncertain = false;
  const remaining = () => Math.max(0, deadline - now());
  const latest = (snapshot: RoomState) => {
    const local = readCurrent();
    return local.roomId !== roomId || local.revision > snapshot.revision ? local : snapshot;
  };
  const state = () => current.roomId === roomId ? inspect(current) : "stop";
  for (let attempt = 0; attempt < maxAttempts && remaining() > 0; attempt++) {
    if (cancelled()) return null;
    current = latest(current);
    if (state() === "stop") return null;
    // Adopted validated server broadcasts can prove a lost response committed.
    if (state() === "satisfied") return current;
    try {
      if (uncertain) {
        // Never blindly replay a timed-out POST: first resolve canonical state.
        current = latest(await refreshCanonical(Math.min(8000, remaining())));
        if (cancelled() || state() === "stop") return null;
        uncertain = false;
      }
      if (state() === "satisfied") return current;
      if (remaining() <= 0) break;
      const result = await mutate(current, Math.min(8000, remaining()));
      if (cancelled()) return null;
      current = latest(result.snapshot);
      if (state() === "stop") return null;
      if (state() === "satisfied") return current;
      uncertain = !result.conflict;
    } catch (error) {
      if (cancelled()) return null;
      if (!isRetryableRoomMetadataError(error)) throw error;
      uncertain = true;
    }
    if (attempt + 1 < maxAttempts && remaining() > 0) {
      const backoff = uncertain ? Math.min(2500, 1000 * (attempt + 1))
        : Math.min(800, 80 * 2 ** Math.min(attempt, 4));
      await wait(Math.min(remaining(), backoff + Math.floor(Math.random() * 80)));
    }
  }
  throw new Error("Room metadata retry exhausted. Check connection and retry the same action.");
}
