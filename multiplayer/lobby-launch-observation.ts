/** Presentation benchmark only. Never feeds scheduling, the gameplay clock,
 * server offsets, or the shared epoch. A reload cannot reuse a prior origin. */
export function localLaunchElapsedMs(startMs: number, endMs: number): number | null {
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || startMs < 0 || endMs < startMs) return null;
  return Math.round(endMs - startMs);
}
