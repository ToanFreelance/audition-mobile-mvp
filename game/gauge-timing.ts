export type GaugeTimingConfig = {
  bpm: number;
  beatsPerCycle?: number;
  spaceStartMs: number;
  perfectCenterPercent?: number;
};

export type GaugeTimingState = {
  cycleMs: number;
  firstGaugeStartMs: number;
  visible: boolean;
  cycleElapsedMs: number;
  cycleIndex: number;
  sliderPercent: number;
  breathAnimationDelayMs: number;
};

/**
 * Deterministic gauge trajectory derived entirely from BPM + Space Start.
 *
 * Space Start is a Perfect boundary. Every `beatsPerCycle` beats after (and
 * before) that anchor is also a Perfect boundary. Between boundaries the
 * slider travels from the left edge toward the Perfect center and reaches it
 * exactly on beat 4, then starts the next cycle from the left again.
 *
 * No frame-to-frame delta is accumulated, so a dropped render frame cannot
 * introduce timing drift: the position is recalculated from absolute time.
 */
export function getGaugeTiming(config: GaugeTimingConfig, nowMs: number): GaugeTimingState {
  const bpm = Math.max(1, config.bpm);
  const beatsPerCycle = Math.max(1, config.beatsPerCycle ?? 4);
  const cycleMs = (60000 / bpm) * beatsPerCycle;
  const spaceStartMs = Math.max(0, config.spaceStartMs);
  const perfectCenterPercent = Math.max(0, Math.min(100, config.perfectCenterPercent ?? 80));

  // First non-negative timestamp that belongs to the same four-beat boundary
  // grid as Space Start. Kept for consumers that use the old visibility hint.
  const firstGaugeStartMs = ((spaceStartMs % cycleMs) + cycleMs) % cycleMs;
  const visible = nowMs >= firstGaugeStartMs;

  // Phase is always calculated from the authoritative musical anchor itself.
  const elapsedFromSpaceStart = nowMs - spaceStartMs;
  const rawCycleElapsedMs = ((elapsedFromSpaceStart % cycleMs) + cycleMs) % cycleMs;
  const boundaryToleranceMs = Math.max(1e-7, cycleMs * Number.EPSILON * 8);
  const onPerfectBoundary = rawCycleElapsedMs <= boundaryToleranceMs || rawCycleElapsedMs >= cycleMs - boundaryToleranceMs;
  const cycleElapsedMs = onPerfectBoundary ? 0 : rawCycleElapsedMs;
  const cycleIndex = Math.floor((nowMs - firstGaugeStartMs) / cycleMs);

  // The requested Audition trajectory: left -> Perfect over one complete
  // four-beat cycle. Perfect itself is an exact boundary; immediately after
  // it the next cycle starts again near the left edge.
  const phase = cycleElapsedMs / cycleMs;
  const sliderPercent = onPerfectBoundary ? perfectCenterPercent : phase * perfectCenterPercent;

  // Retained for API compatibility. Realtime visuals no longer run a CSS
  // animation clock; they sample deterministic phase from media time instead.
  const breathAnimationDelayMs = -cycleElapsedMs;

  return {
    cycleMs,
    firstGaugeStartMs,
    visible,
    cycleElapsedMs,
    cycleIndex,
    sliderPercent,
    breathAnimationDelayMs,
  };
}

export function getFirstGaugeStartMs(bpm: number, spaceStartMs: number, beatsPerCycle = 4) {
  return getGaugeTiming({ bpm, spaceStartMs, beatsPerCycle }, 0).firstGaugeStartMs;
}

export function getCycleMs(bpm: number, beatsPerCycle = 4) {
  return (60000 / Math.max(1, bpm)) * Math.max(1, beatsPerCycle);
}
