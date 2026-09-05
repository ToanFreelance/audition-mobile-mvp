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
 * The slider traverses the complete 0..100 gauge once every four beats and
 * wraps back to 0. Space Start is the musical Perfect boundary, so the phase
 * is chosen such that the slider is exactly at `perfectCenterPercent` there
 * and at every following four-beat boundary.
 *
 * Position is calculated from absolute media time on every sample. No frame
 * delta is accumulated, so dropped frames cannot introduce timing drift.
 */
export function getGaugeTiming(config: GaugeTimingConfig, nowMs: number): GaugeTimingState {
  const bpm = Math.max(1, config.bpm);
  const beatsPerCycle = Math.max(1, config.beatsPerCycle ?? 4);
  const cycleMs = (60000 / bpm) * beatsPerCycle;
  const spaceStartMs = Math.max(0, config.spaceStartMs);
  const perfectCenterPercent = Math.max(0, Math.min(100, config.perfectCenterPercent ?? 80));

  // First non-negative timestamp on the same four-beat grid as Space Start.
  const firstGaugeStartMs = ((spaceStartMs % cycleMs) + cycleMs) % cycleMs;
  const visible = nowMs >= firstGaugeStartMs;

  // Musical phase relative to the authoritative Perfect anchor.
  const elapsedFromSpaceStart = nowMs - spaceStartMs;
  const rawCycleElapsedMs = ((elapsedFromSpaceStart % cycleMs) + cycleMs) % cycleMs;
  const boundaryToleranceMs = Math.max(1e-7, cycleMs * Number.EPSILON * 8);
  const cycleElapsedMs = rawCycleElapsedMs >= cycleMs - boundaryToleranceMs ? 0 : rawCycleElapsedMs;
  const cycleIndex = Math.floor((nowMs - firstGaugeStartMs) / cycleMs);
  const phase = cycleElapsedMs / cycleMs;

  // Continuous full-width sweep. At Space Start phase=0, therefore the
  // slider is at Perfect. It then continues 80 -> 100 -> 0 -> ... -> 80.
  const sliderPercent = ((perfectCenterPercent + phase * 100) % 100 + 100) % 100;

  // Kept for compatibility with older consumers. Realtime visuals now sample
  // the deterministic phase instead of running an independent CSS clock.
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
