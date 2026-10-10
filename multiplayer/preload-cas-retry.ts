import type { RoomState } from "./types";

export type PreloadCasAction = "preload-loading" | "loaded" | "preload-failed";
export type PreloadCasIdentity = {
  matchId: string;
  roomRevision: number;
  startRevision: number;
};

/**
 * Retry only the metadata CAS for one frozen preload session.
 * No preload assets, gameplay clock, shared epoch or server authority lives here.
 * A conflict is NOT a failed asset load.
 */
export async function retryPreloadCas(options: {
  action: PreloadCasAction;
  identity: PreloadCasIdentity;
  participantId: string;
  readCurrent: () => RoomState;
  mutate: (snapshot: RoomState) => Promise<{ snapshot: RoomState; conflict: boolean }>;
  cancelled: () => boolean;
  wait?: (delayMs: number) => Promise<void>;
  maxAttempts?: number;
}): Promise<RoomState | null> {
  const {
    action, identity, participantId, readCurrent, mutate, cancelled,
    maxAttempts = 24,
    wait = ms => new Promise<void>(resolve => setTimeout(resolve, ms)),
  } = options;

  const startedAtMs = Date.now(); // Bounds metadata retries, NOT song/global-turn time.
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    if (attempt > 0 && Date.now() - startedAtMs > 20_000) break;
    if (cancelled()) return null;
    const current = readCurrent();
    const binding = current.matchStart;
    // A stale async task must not mutate a different frozen MatchManifest.
    if (!binding || binding.matchId !== identity.matchId
      || binding.roomRevision !== identity.roomRevision
      || binding.startRevision !== identity.startRevision) return null;

    const participant = current.participants.find(item => item.participantId === participantId);
    if (!participant || participant.kind !== "human") return null;
    const settled = participant.loadState === "loaded"
      || (action === "preload-loading" && participant.loadState === "loading")
      || (action === "preload-failed" && participant.loadState === "failed");
    if (settled) return current;
    // Countdown/PLAYING cannot receive new preload mutations.
    if (current.status !== "preloading") return null;

    const result = await mutate(current);
    if (cancelled()) return null;
    // The server response might be newer than our local render. Re-read
    // canonical state on every conflict; never reuse a stale revision.
    if (!result.conflict) {
      const settledBinding = result.snapshot.matchStart;
      if (!settledBinding || settledBinding.matchId !== identity.matchId
        || settledBinding.roomRevision !== identity.roomRevision
        || settledBinding.startRevision !== identity.startRevision) return null;
      return result.snapshot;
    }

    if (attempt + 1 < maxAttempts) {
      // Metadata backoff/jitter only, never an independent gameplay timer.
      const backoffMs = Math.min(350, 45 * (attempt + 1));
      await wait(backoffMs + Math.floor(Math.random() * 35));
    }
  }

  // The caller exposes a manual retry without turning an ACK conflict into
  // preload-failed. Preserve the same frozen session and cached asset readiness.
  throw new Error("Preload CAS contention persists; retry ACK for the same match.");
}
