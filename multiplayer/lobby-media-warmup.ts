import type { MusicConfig } from "../game/music-config";
import { measureClockSyncSample, type ClockSyncEstimate, type ClockSyncSample } from "./shared-clock";

/** Same audio metadata fields as the frozen manifest fingerprint. Never
 * treats a URL alone as the decoded-buffer identity. */
export function lobbyAudioWarmupIdentity(music: MusicConfig): string {
  return JSON.stringify([music.id, music.audioUrl, music.durationMs, music.updatedAt || "unversioned"]);
}

export type WarmClockEstimate = {
  scope: string;
  estimate: ClockSyncEstimate;
  sampledAtMs: number;
  sampledAtWallMs: number;
};

export const WARM_CLOCK_MAX_AGE_MS = 20_000;

export function usableWarmClock(
  cached: WarmClockEstimate | null, scope: string, nowMs: number, wallMs: number,
): cached is WarmClockEstimate {
  if (!cached || cached.scope !== scope) return false;
  const age = nowMs - cached.sampledAtMs;
  const wallAge = wallMs - cached.sampledAtWallMs;
  const e = cached.estimate;
  return Number.isFinite(age) && age >= 0 && age <= WARM_CLOCK_MAX_AGE_MS
    && Math.abs(wallAge - age) <= 100
    && Number.isFinite(e.offsetMs) && e.sampleCount >= 3 && e.selectedSampleCount >= 3
    && e.selectedOffsetsMs.length >= 3 && e.selectedOffsetsMs.every(Number.isFinite)
    && e.maxSelectedRoundTripMs >= 0 && e.maxSelectedRoundTripMs <= 150
    && Math.max(...e.selectedOffsetsMs) - Math.min(...e.selectedOffsetsMs) <= 50;
}

export function warmClockMatchesProbe(cached: WarmClockEstimate, probe: ClockSyncSample): boolean {
  try {
    const fresh = measureClockSyncSample(probe);
    return fresh.roundTripMs <= 150 && Math.abs(fresh.offsetMs - cached.estimate.offsetMs) <= 25;
  } catch { return false; }
}

type WarmTransport = { ready: boolean; prepare(): Promise<void>; destroy(): Promise<void> };
type Candidate<C, T> = { identity: string; context: C; transport: T; pending: Promise<boolean> };

/** At most one speculative decoded song; the matching prepared transport
 * is transferred exactly once into the authoritative match. No source is
 * created here. A superseded decode may finish but never retains its buffer. */
export class LobbyAudioWarmupCache<C, T extends WarmTransport> {
  private candidate: Candidate<C, T> | null = null;
  private tail: Promise<void> = Promise.resolve();

  clear() {
    const old = this.candidate;
    this.candidate = null;
    if (old) void old.transport.destroy();
  }

  prepare(identity: string, context: C, factory: () => T): Promise<boolean> {
    const current = this.candidate;
    if (current?.identity === identity && current.context === context) return current.pending;
    this.clear();
    const transport = factory();
    const next: Candidate<C, T> = { identity, context, transport, pending: Promise.resolve(false) };
    this.candidate = next;
    next.pending = this.tail.then(async () => {
      if (this.candidate !== next) return false;
      try {
        await transport.prepare();
        return this.candidate === next && transport.ready;
      } catch {
        if (this.candidate === next) this.clear();
        return false;
      }
    });
    this.tail = next.pending.then(() => undefined, () => undefined);
    return next.pending;
  }

  async take(identity: string, context: C): Promise<T | null> {
    const entry = this.candidate;
    if (!entry || entry.identity !== identity || entry.context !== context) {
      this.clear();
      // A non-abortable decode must settle before another is allocated.
      await this.tail;
      return null;
    }
    const ready = await entry.pending;
    if (!ready || this.candidate !== entry) return null;
    this.candidate = null;
    return entry.transport;
  }
}
