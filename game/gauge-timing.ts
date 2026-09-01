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
 * The song's space-start is the authoritative musical anchor.
 *
 * Example: 80 BPM => 750ms/beat => 3000ms/4-beat cycle.
 * If spaceStart=30000ms, the first gauge cycle begins at 2000ms,
 * then repeats at 5000, 8000, ... and every cycle boundary is again
 * the Perfect timing point.
 */
export function getGaugeTiming(config: GaugeTimingConfig, nowMs: number): GaugeTimingState {
  const bpm = Math.max(1, config.bpm);
  const beatsPerCycle = Math.max(1, config.beatsPerCycle ?? 4);
  const cycleMs = (60000 / bpm) * beatsPerCycle;
  const spaceStartMs = Math.max(0, config.spaceStartMs);
  const perfectCenterPercent = Math.max(0, Math.min(100, config.perfectCenterPercent ?? 80));

  // Anchor the first visible cycle as the first non-negative time that is
  // congruent with space-start modulo one complete cycle.
  const firstGaugeStartMs = spaceStartMs % cycleMs;
  const visible = nowMs >= firstGaugeStartMs;

  // The SVG's strongest beat-4 stretch is defined at 87.5% of its animation
  // cycle. Solve the phase equation so that its 87.5% point lands exactly on
  // the space-start/cycle boundary. This is also valid during the lead-in,
  // when the gauge has not become visible yet.
  const animationPhaseAtNow = (((nowMs - firstGaugeStartMs + cycleMs * 0.875) % cycleMs) + cycleMs) % cycleMs;
  const breathAnimationDelayMs = -animationPhaseAtNow;

  if (!visible) {
    return {
      cycleMs,
      firstGaugeStartMs,
      visible: false,
      cycleElapsedMs: 0,
      cycleIndex: -1,
      sliderPercent: perfectCenterPercent,
      breathAnimationDelayMs,
    };
  }

  const elapsedFromFirstGauge = nowMs - firstGaugeStartMs;
  const cycleIndex = Math.floor(elapsedFromFirstGauge / cycleMs);
  const cycleElapsedMs = elapsedFromFirstGauge - cycleIndex * cycleMs;
  const phase = cycleElapsedMs / cycleMs;

  // Slider starts at Perfect and traverses one complete gauge width over one
  // 4-beat cycle. At the next cycle boundary it wraps back to Perfect.
  const sliderPercent = ((perfectCenterPercent + phase * 100) % 100 + 100) % 100;

  return {
    cycleMs,
    firstGaugeStartMs,
    visible: true,
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
