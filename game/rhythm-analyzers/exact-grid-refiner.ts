import { clamp, median, normalizeResult, synthesizeBeatGrid } from "./metrics";
import type { BenchmarkInput, BenchmarkProgress, RhythmEngineResult } from "./types";

const VERSION = "internal-v4-exact-grid";
const FRAME_SECONDS = 0.005;
const WINDOW_MS = 30_000;
const MIN_WINDOW_MS = 20_000;
const SEARCH_RADIUS_BPM = 0.18;
const DRIFT_BUDGET_MS = 30;
const NOMINAL_REVIEW_DRIFT_MS = 60;
const yieldToBrowser = () => new Promise<void>(resolve => setTimeout(resolve, 0));

type Envelope = {
  values: Float32Array;
  frameMs: number;
};

type WindowPhase = {
  startMs: number;
  endMs: number;
  centerSec: number;
  offsetMs: number;
  score: number;
  supportRatio: number;
};

type Regression = {
  slopeMsPerSecond: number;
  interceptMs: number;
  slopeSeMsPerSecond: number;
  residualRmseMs: number;
  residualMadMs: number;
  retained: number;
  total: number;
};

type RefinedGrid = {
  accepted: boolean;
  seedBpm: number;
  bpm: number;
  globalPhaseMs: number;
  score: number;
  supportRatio: number;
  phaseSlopeMsPerSecond: number;
  phaseSlopeSeMsPerSecond: number;
  residualRmseMs: number;
  residualMadMs: number;
  ci95Bpm: number;
  endDrift95Ms: number;
  confidence: number;
  windows: WindowPhase[];
  iterations: Array<{ bpm: number; slopeMsPerSecond: number; correctedBpm: number }>;
};

type BaseRaw = {
  status?: string;
  variable?: boolean;
  selectedMetricalBpm?: number | null;
  audioPulseBpm?: number | null;
  gameplayBpm?: number | null;
  nominalBpmCandidate?: number | null;
  nominalConfidence?: number | null;
  nominalMode?: string | null;
  nominalReasons?: string[];
  sourceSpeedStatus?: string;
  playbackRateToNominal?: number | null;
  endDriftToNominalMs?: number | null;
  gameplayAnchorMs?: number | null;
  gameplayAnchorSource?: string;
  metricalLevelConfidence?: number | null;
  exactTempoConfidence?: number | null;
  phaseCoherenceConfidence?: number | null;
  gameplayAnchorConfidence?: number | null;
  familyEstimates?: unknown[];
  retainedExactFamilies?: unknown[];
  candidates?: unknown[];
  [key: string]: unknown;
};

function finite(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function percentile(values: number[], q: number) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const position = (sorted.length - 1) * clamp(q, 0, 1);
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  const fraction = position - lower;
  const a = sorted[lower] ?? sorted[0] ?? 0;
  const b = sorted[upper] ?? a;
  return a + (b - a) * fraction;
}

function mad(values: number[], center = median(values) ?? 0) {
  return median(values.map(value => Math.abs(value - center))) ?? 0;
}

function buildEnvelope(input: BenchmarkInput): Envelope {
  const frameSize = Math.max(128, Math.round(input.sampleRate * FRAME_SECONDS));
  const frameCount = Math.max(1, Math.floor(input.mono.length / frameSize));
  const raw = new Float32Array(frameCount);
  let previousRms = 0;
  let previousTexture = 0;
  let previousSample = input.mono[0] ?? 0;

  for (let frame = 0; frame < frameCount; frame += 1) {
    const start = frame * frameSize;
    const end = Math.min(input.mono.length, start + frameSize);
    let sumSquares = 0;
    let sumDiffSquares = 0;
    for (let index = start; index < end; index += 1) {
      const sample = input.mono[index] ?? 0;
      const diff = sample - previousSample;
      previousSample = sample;
      sumSquares += sample * sample;
      sumDiffSquares += diff * diff;
    }
    const count = Math.max(1, end - start);
    const rms = Math.sqrt(sumSquares / count);
    const texture = Math.sqrt(sumDiffSquares / count);
    const attack = Math.max(0, rms - previousRms);
    const textureAttack = Math.max(0, texture - previousTexture);
    raw[frame] = attack + textureAttack * 0.24;
    previousRms = rms;
    previousTexture = texture;
  }

  const samples = Array.from(raw);
  const floor = percentile(samples, 0.50);
  const ceiling = percentile(samples, 0.96);
  const scale = Math.max(1e-9, ceiling - floor);
  const values = new Float32Array(frameCount);
  for (let index = 0; index < frameCount; index += 1) {
    values[index] = clamp(((raw[index] ?? 0) - floor) / scale, 0, 2.2);
  }
  return { values, frameMs: frameSize / input.sampleRate * 1000 };
}

function sampleEnvelope(envelope: Envelope, timeMs: number) {
  const position = timeMs / envelope.frameMs - 0.5;
  if (position < 0 || position >= envelope.values.length - 1) return 0;
  const left = Math.floor(position);
  const fraction = position - left;
  const a = envelope.values[left] ?? 0;
  const b = envelope.values[left + 1] ?? a;
  return a + (b - a) * fraction;
}

function normalizePhase(phaseMs: number, intervalMs: number) {
  let value = phaseMs % intervalMs;
  if (value < 0) value += intervalMs;
  return value;
}

function evaluateGrid(
  envelope: Envelope,
  bpm: number,
  phaseMs: number,
  startMs: number,
  endMs: number,
) {
  const intervalMs = 60000 / bpm;
  const normalizedPhase = normalizePhase(phaseMs, intervalMs);
  let firstBeat = normalizedPhase;
  while (firstBeat < startMs) firstBeat += intervalMs;
  while (firstBeat - intervalMs >= startMs) firstBeat -= intervalMs;

  let weighted = 0;
  let supported = 0;
  let count = 0;
  for (let timeMs = firstBeat; timeMs < endMs; timeMs += intervalMs) {
    if (timeMs < startMs || timeMs < 500 || timeMs > endMs - 250) continue;
    let bestStrength = 0;
    let bestOffsetMs = 0;
    for (let offsetMs = -12; offsetMs <= 12; offsetMs += 2) {
      const strength = sampleEnvelope(envelope, timeMs + offsetMs);
      const proximity = Math.exp(-0.5 * (offsetMs / 6.5) ** 2);
      const value = strength * (0.22 + 0.78 * proximity);
      if (value > bestStrength) {
        bestStrength = value;
        bestOffsetMs = offsetMs;
      }
    }
    weighted += clamp(bestStrength, 0, 1.7);
    if (bestStrength >= 0.17 && Math.abs(bestOffsetMs) <= 10) supported += 1;
    count += 1;
  }

  return {
    score: count > 0 ? weighted / count : 0,
    supportRatio: count > 0 ? supported / count : 0,
    count,
  };
}

function bestPhaseForBpm(
  envelope: Envelope,
  durationMs: number,
  bpm: number,
  phaseStepMs: number,
  aroundPhaseMs?: number,
  radiusMs?: number,
) {
  const intervalMs = 60000 / bpm;
  let bestPhaseMs = 0;
  let best = { score: -Infinity, supportRatio: 0, count: 0 };
  if (aroundPhaseMs != null && radiusMs != null) {
    for (let delta = -radiusMs; delta <= radiusMs + 1e-9; delta += phaseStepMs) {
      const phaseMs = normalizePhase(aroundPhaseMs + delta, intervalMs);
      const result = evaluateGrid(envelope, bpm, phaseMs, 0, durationMs);
      if (result.score > best.score) {
        best = result;
        bestPhaseMs = phaseMs;
      }
    }
  } else {
    for (let phaseMs = 0; phaseMs < intervalMs; phaseMs += phaseStepMs) {
      const result = evaluateGrid(envelope, bpm, phaseMs, 0, durationMs);
      if (result.score > best.score) {
        best = result;
        bestPhaseMs = phaseMs;
      }
    }
  }
  return { phaseMs: bestPhaseMs, ...best };
}

async function narrowBpmSearch(
  envelope: Envelope,
  durationMs: number,
  seedBpm: number,
  progress?: BenchmarkProgress,
) {
  let best = { bpm: seedBpm, phaseMs: 0, score: -Infinity, supportRatio: 0 };
  let scanned = 0;
  for (let bpm = seedBpm - SEARCH_RADIUS_BPM; bpm <= seedBpm + SEARCH_RADIUS_BPM + 1e-9; bpm += 0.006) {
    const phase = bestPhaseForBpm(envelope, durationMs, bpm, 10);
    if (phase.score > best.score) best = { bpm, phaseMs: phase.phaseMs, score: phase.score, supportRatio: phase.supportRatio };
    scanned += 1;
    if (scanned % 18 === 0) {
      progress?.(`EXACT GRID · narrow PCM scan ${bpm.toFixed(3)} BPM…`);
      await yieldToBrowser();
    }
  }

  const coarse = best;
  for (let bpm = coarse.bpm - 0.014; bpm <= coarse.bpm + 0.014 + 1e-9; bpm += 0.0005) {
    const phase = bestPhaseForBpm(envelope, durationMs, bpm, 1, coarse.phaseMs, 14);
    if (phase.score > best.score) best = { bpm, phaseMs: phase.phaseMs, score: phase.score, supportRatio: phase.supportRatio };
  }
  return best;
}

function windowPhases(envelope: Envelope, durationMs: number, bpm: number, globalPhaseMs: number) {
  const windows: WindowPhase[] = [];
  for (let startMs = 0; startMs < durationMs; startMs += WINDOW_MS) {
    const endMs = Math.min(durationMs, startMs + WINDOW_MS);
    if (endMs - startMs < MIN_WINDOW_MS) continue;
    let bestOffset = 0;
    let best = evaluateGrid(envelope, bpm, globalPhaseMs, startMs, endMs);
    for (let offsetMs = -28; offsetMs <= 28; offsetMs += 1) {
      const result = evaluateGrid(envelope, bpm, globalPhaseMs + offsetMs, startMs, endMs);
      if (result.score > best.score) {
        best = result;
        bestOffset = offsetMs;
      }
    }
    windows.push({
      startMs,
      endMs,
      centerSec: (startMs + endMs) / 2000,
      offsetMs: bestOffset,
      score: best.score,
      supportRatio: best.supportRatio,
    });
  }
  return windows;
}

function theilSen(xs: number[], ys: number[]) {
  const slopes: number[] = [];
  for (let i = 0; i < xs.length; i += 1) {
    for (let j = i + 1; j < xs.length; j += 1) {
      const dx = (xs[j] ?? 0) - (xs[i] ?? 0);
      if (Math.abs(dx) < 1e-9) continue;
      slopes.push(((ys[j] ?? 0) - (ys[i] ?? 0)) / dx);
    }
  }
  const slope = median(slopes) ?? 0;
  const intercepts = xs.map((x, index) => (ys[index] ?? 0) - slope * x);
  return { slope, intercept: median(intercepts) ?? 0 };
}

function robustRegression(windows: WindowPhase[]): Regression {
  if (windows.length < 3) {
    return { slopeMsPerSecond: 0, interceptMs: 0, slopeSeMsPerSecond: 1, residualRmseMs: 999, residualMadMs: 999, retained: windows.length, total: windows.length };
  }
  const xs = windows.map(window => window.centerSec);
  const ys = windows.map(window => window.offsetMs);
  const robust = theilSen(xs, ys);
  const residuals = ys.map((value, index) => value - (robust.intercept + robust.slope * (xs[index] ?? 0)));
  const residualCenter = median(residuals) ?? 0;
  const residualMad = mad(residuals, residualCenter);
  const threshold = Math.max(3.5, residualMad * 3.5);
  const kept = windows.filter((window, index) => Math.abs((residuals[index] ?? 0) - residualCenter) <= threshold);
  const source = kept.length >= 4 ? kept : windows;
  const fitXs = source.map(window => window.centerSec);
  const fitYs = source.map(window => window.offsetMs);
  const meanX = fitXs.reduce((sum, value) => sum + value, 0) / fitXs.length;
  const meanY = fitYs.reduce((sum, value) => sum + value, 0) / fitYs.length;
  let sxx = 0;
  let sxy = 0;
  for (let index = 0; index < fitXs.length; index += 1) {
    const dx = (fitXs[index] ?? 0) - meanX;
    sxx += dx * dx;
    sxy += dx * ((fitYs[index] ?? 0) - meanY);
  }
  const slope = sxx > 0 ? sxy / sxx : robust.slope;
  const intercept = meanY - slope * meanX;
  const finalResiduals = fitYs.map((value, index) => value - (intercept + slope * (fitXs[index] ?? 0)));
  const sse = finalResiduals.reduce((sum, value) => sum + value * value, 0);
  const dof = Math.max(1, fitXs.length - 2);
  const sigma2 = sse / dof;
  const slopeSe = sxx > 0 ? Math.sqrt(sigma2 / sxx) : 1;
  return {
    slopeMsPerSecond: slope,
    interceptMs: intercept,
    slopeSeMsPerSecond: slopeSe,
    residualRmseMs: Math.sqrt(sse / Math.max(1, fitXs.length)),
    residualMadMs: mad(finalResiduals),
    retained: source.length,
    total: windows.length,
  };
}

function bpmCorrectedForSlope(bpm: number, slopeMsPerSecond: number) {
  return bpm / Math.max(0.98, Math.min(1.02, 1 + slopeMsPerSecond / 1000));
}

function bpmCiFromSlopeSe(bpm: number, slopeSeMsPerSecond: number) {
  const deltaSlope = Math.max(0.002, 1.96 * slopeSeMsPerSecond);
  const low = bpmCorrectedForSlope(bpm, deltaSlope);
  const high = bpmCorrectedForSlope(bpm, -deltaSlope);
  return Math.max(0.0008, Math.abs(high - low) / 2);
}

async function refineExactGrid(
  input: BenchmarkInput,
  seedBpm: number,
  progress?: BenchmarkProgress,
): Promise<RefinedGrid> {
  const durationMs = input.buffer.duration * 1000;
  progress?.("EXACT GRID · building 5ms onset envelope…");
  const envelope = buildEnvelope(input);
  await yieldToBrowser();

  const initial = await narrowBpmSearch(envelope, durationMs, seedBpm, progress);
  let bpm = initial.bpm;
  let phaseMs = initial.phaseMs;
  const iterations: Array<{ bpm: number; slopeMsPerSecond: number; correctedBpm: number }> = [];

  for (let iteration = 0; iteration < 3; iteration += 1) {
    progress?.(`EXACT GRID · phase-drift fit ${iteration + 1}/3 at ${bpm.toFixed(6)} BPM…`);
    const windows = windowPhases(envelope, durationMs, bpm, phaseMs);
    const regression = robustRegression(windows);
    const corrected = bpmCorrectedForSlope(bpm, regression.slopeMsPerSecond);
    iterations.push({ bpm, slopeMsPerSecond: regression.slopeMsPerSecond, correctedBpm: corrected });
    if (Math.abs(corrected - bpm) < 0.00015) break;
    bpm = corrected;
    const phase = bestPhaseForBpm(envelope, durationMs, bpm, 1);
    phaseMs = phase.phaseMs;
    await yieldToBrowser();
  }

  const finalPhase = bestPhaseForBpm(envelope, durationMs, bpm, 1);
  phaseMs = finalPhase.phaseMs;
  const windows = windowPhases(envelope, durationMs, bpm, phaseMs);
  const regression = robustRegression(windows);
  const finalBpm = bpmCorrectedForSlope(bpm, regression.slopeMsPerSecond);
  if (Math.abs(finalBpm - bpm) >= 0.00015) {
    bpm = finalBpm;
    const phase = bestPhaseForBpm(envelope, durationMs, bpm, 1, phaseMs, 8);
    phaseMs = phase.phaseMs;
  }

  const finalWindows = windowPhases(envelope, durationMs, bpm, phaseMs);
  const finalRegression = robustRegression(finalWindows);
  const ci95Bpm = bpmCiFromSlopeSe(bpm, finalRegression.slopeSeMsPerSecond);
  const endDrift95Ms = durationMs * ci95Bpm / Math.max(1, bpm);
  const supportRatio = finalWindows.length
    ? finalWindows.reduce((sum, window) => sum + window.supportRatio, 0) / finalWindows.length
    : finalPhase.supportRatio;
  const supportQuality = clamp((supportRatio - 0.28) / 0.55, 0, 1);
  const slopeQuality = 1 / (1 + Math.abs(finalRegression.slopeMsPerSecond) / 0.025);
  const residualQuality = 1 / (1 + finalRegression.residualRmseMs / 7.5);
  const driftQuality = 1 / (1 + endDrift95Ms / 35);
  const windowQuality = clamp(finalRegression.retained / 6, 0, 1);
  const confidence = clamp(supportQuality * 0.20 + slopeQuality * 0.24 + residualQuality * 0.20 + driftQuality * 0.26 + windowQuality * 0.10, 0, 1);
  const accepted = finalWindows.length >= 5
    && finalRegression.retained >= 4
    && finalRegression.residualRmseMs <= 18
    && ci95Bpm <= Math.max(0.12, bpm * 0.0012)
    && confidence >= 0.48;

  return {
    accepted,
    seedBpm,
    bpm,
    globalPhaseMs: phaseMs,
    score: finalPhase.score,
    supportRatio,
    phaseSlopeMsPerSecond: finalRegression.slopeMsPerSecond,
    phaseSlopeSeMsPerSecond: finalRegression.slopeSeMsPerSecond,
    residualRmseMs: finalRegression.residualRmseMs,
    residualMadMs: finalRegression.residualMadMs,
    ci95Bpm,
    endDrift95Ms,
    confidence,
    windows: finalWindows,
    iterations,
  };
}

function sourceSpeedStatus(audioBpm: number, nominalBpm: number | null, nominalMode: string | null | undefined, durationMs: number) {
  if (nominalBpm == null) return "NO_NOMINAL_EVIDENCE" as const;
  const endDriftMs = durationMs * (audioBpm / nominalBpm - 1);
  if (Math.abs(endDriftMs) <= DRIFT_BUDGET_MS) return "MATCH" as const;
  if (nominalMode === "QUANTIZED_SOURCE_MISMATCH" && Math.abs(endDriftMs) > NOMINAL_REVIEW_DRIFT_MS) return "LIKELY_SOURCE_SPEED_MISMATCH" as const;
  if (Math.abs(endDriftMs) <= NOMINAL_REVIEW_DRIFT_MS) return "REVIEW" as const;
  return "LIKELY_SOURCE_SPEED_MISMATCH" as const;
}

export async function runExactGridRefiner(
  input: BenchmarkInput,
  baseFinal: RhythmEngineResult,
  progress?: BenchmarkProgress,
): Promise<RhythmEngineResult> {
  const started = performance.now();
  const baseRaw = baseFinal.raw && typeof baseFinal.raw === "object" ? baseFinal.raw as BaseRaw : {};
  const seedBpm = finite(baseRaw.audioPulseBpm) ? baseRaw.audioPulseBpm : baseFinal.bpm;
  if (!seedBpm || !Number.isFinite(seedBpm) || seedBpm <= 0 || baseFinal.error || baseRaw.variable) {
    return {
      ...baseFinal,
      variant: baseFinal.variant.replace("v3 quality-calibrated", "v4 exact-grid fallback"),
      version: VERSION,
      notes: `${baseFinal.notes ?? ""} EXACT GRID v4 skipped because the v3 seed was unavailable, failed, or variable-tempo review is active.`,
    };
  }

  try {
    const refined = await refineExactGrid(input, seedBpm, progress);
    const durationMs = input.buffer.duration * 1000;
    const audioPulseBpm = refined.accepted ? refined.bpm : seedBpm;
    const nominalBpm = finite(baseRaw.nominalBpmCandidate) ? baseRaw.nominalBpmCandidate : null;
    const nominalMode = typeof baseRaw.nominalMode === "string" ? baseRaw.nominalMode : null;
    const speedStatus = sourceSpeedStatus(audioPulseBpm, nominalBpm, nominalMode, durationMs);
    const endDriftToNominalMs = nominalBpm == null ? null : durationMs * (audioPulseBpm / nominalBpm - 1);
    const safeIntegerSnap = Boolean(nominalBpm != null && endDriftToNominalMs != null && Math.abs(endDriftToNominalMs) <= DRIFT_BUDGET_MS);
    const gameplayBpm = safeIntegerSnap && nominalBpm != null ? nominalBpm : audioPulseBpm;
    const playbackRateToNominal = nominalBpm == null ? null : nominalBpm / audioPulseBpm;
    const authoredAnchor = finite(input.spaceStartMs) ? input.spaceStartMs : null;
    const gameplayAnchorMs = authoredAnchor ?? (finite(baseRaw.gameplayAnchorMs) ? baseRaw.gameplayAnchorMs : refined.globalPhaseMs);
    const gameplayAnchorSource = authoredAnchor != null ? "AUTHORED SPACE #1" : "EXACT GRID PHASE";
    const beatTimesMs = synthesizeBeatGrid(gameplayAnchorMs / 1000, gameplayBpm, input.buffer.duration);

    const metricalConf = finite(baseRaw.metricalLevelConfidence) ? baseRaw.metricalLevelConfidence : 0.65;
    const phaseBase = finite(baseRaw.phaseCoherenceConfidence) ? baseRaw.phaseCoherenceConfidence : 0.60;
    const exactConf = refined.accepted ? refined.confidence : Math.min(0.55, finite(baseRaw.exactTempoConfidence) ? baseRaw.exactTempoConfidence : 0.45);
    const phaseConf = refined.accepted
      ? clamp(phaseBase * 0.35 + (1 / (1 + Math.abs(refined.phaseSlopeMsPerSecond) / 0.03)) * 0.40 + (1 / (1 + refined.residualRmseMs / 8)) * 0.25, 0, 1)
      : phaseBase;
    const anchorConf = authoredAnchor != null ? 1 : phaseConf * 0.72;
    let overallConfidence = clamp(metricalConf * 0.30 + exactConf * 0.42 + phaseConf * 0.16 + anchorConf * 0.12, 0, 1);
    if (speedStatus === "LIKELY_SOURCE_SPEED_MISMATCH") overallConfidence *= 0.94;
    if (!refined.accepted) overallConfidence *= 0.90;
    const status = overallConfidence >= 0.88 ? "VERY HIGH" : overallConfidence >= 0.74 ? "HIGH" : overallConfidence >= 0.56 ? "MEDIUM" : "LOW";

    const exactNote = refined.accepted
      ? `Dedicated PCM refiner accepted: seed=${refined.seedBpm.toFixed(6)} -> exact=${audioPulseBpm.toFixed(6)} BPM; final phase slope=${refined.phaseSlopeMsPerSecond.toFixed(5)}ms/s ±${(1.96 * refined.phaseSlopeSeMsPerSecond).toFixed(5)}; phase residual RMSE=${refined.residualRmseMs.toFixed(2)}ms, MAD=${refined.residualMadMs.toFixed(2)}ms; robust 95% BPM CI≈±${refined.ci95Bpm.toFixed(5)} => ±${refined.endDrift95Ms.toFixed(1)}ms at track end; support=${Math.round(refined.supportRatio * 100)}%, ${refined.windows.length} long windows.`
      : `Dedicated PCM refiner rejected its own fit (confidence ${Math.round(refined.confidence * 100)}%, residual RMSE=${refined.residualRmseMs.toFixed(2)}ms, CI≈±${refined.ci95Bpm.toFixed(5)} BPM); v3 audio tempo is retained instead of forcing a falsely precise value.`;
    const nominalNote = nominalBpm == null
      ? "No nominal integer evidence; decimal source tempo is retained."
      : `Nominal=${nominalBpm.toFixed(0)} BPM (${nominalMode ?? "v3 evidence"}); source-speed=${speedStatus}; playbackRate-to-nominal=${playbackRateToNominal?.toFixed(6)}; nominal end drift=${endDriftToNominalMs?.toFixed(1)}ms${safeIntegerSnap ? "; safe 30ms gameplay snap applied" : ""}.`;

    return normalizeResult({
      id: "auto-grid-validator",
      engine: "FINAL RHYTHM",
      variant: `v4 exact-grid · ${status}`,
      version: VERSION,
      kind: "custom",
      beatGridKind: "validated",
      bpm: Number(gameplayBpm.toFixed(6)),
      confidence: overallConfidence,
      confidenceRaw: overallConfidence,
      confidenceScale: "Final v4 confidence. Metrical interpretation comes from v3 multi-engine fusion; exact constant-source BPM/CI comes from a dedicated narrow PCM grid fit and phase-drift regression; authored SPACE #1 remains the gameplay phase anchor.",
      beatTimesMs,
      onsetTimesMs: baseFinal.onsetTimesMs,
      processingTimeMs: performance.now() - started,
      notes: `FINAL RHYTHM v4. ${exactNote} ${nominalNote} BPM/PCM refinement does NOT use authored Space Start. GAMEPLAY grid remains phase-locked to ${gameplayAnchorSource}=${gameplayAnchorMs.toFixed(1)}ms. v3 metrical evidence is preserved in raw for audit.`,
      raw: {
        ...baseRaw,
        version: VERSION,
        status,
        audioPulseBpm,
        gameplayBpm,
        sourceSpeedStatus: speedStatus,
        playbackRateToNominal,
        endDriftToNominalMs,
        safeIntegerSnap,
        gameplayAnchorMs,
        gameplayAnchorSource,
        exactTempoConfidence: exactConf,
        phaseCoherenceConfidence: phaseConf,
        gameplayAnchorConfidence: anchorConf,
        robust95FamilySpreadBpm: refined.accepted ? refined.ci95Bpm : baseRaw.robust95FamilySpreadBpm,
        robust95EndDriftMs: refined.accepted ? refined.endDrift95Ms : baseRaw.robust95EndDriftMs,
        exactRefiner: refined,
        exactRefinerAccepted: refined.accepted,
        exactRefinerSeedBpm: refined.seedBpm,
        exactRefinerBpm: refined.bpm,
        exactRefinerPhaseMs: refined.globalPhaseMs,
        exactRefinerPhaseSlopeMsPerSecond: refined.phaseSlopeMsPerSecond,
        exactRefinerSlopeSeMsPerSecond: refined.phaseSlopeSeMsPerSecond,
        exactRefinerResidualRmseMs: refined.residualRmseMs,
        exactRefinerResidualMadMs: refined.residualMadMs,
        exactRefinerCi95Bpm: refined.ci95Bpm,
        exactRefinerEndDrift95Ms: refined.endDrift95Ms,
        exactRefinerSupportRatio: refined.supportRatio,
        usesSpaceStartForBpm: false,
        usesSpaceStartForAudioPhase: false,
        usesSpaceStartForGameplayAnchor: authoredAnchor != null,
      },
    }, input);
  } catch (error) {
    return {
      ...baseFinal,
      variant: baseFinal.variant.replace("v3 quality-calibrated", "v4 exact-grid fallback"),
      version: VERSION,
      processingTimeMs: baseFinal.processingTimeMs + (performance.now() - started),
      notes: `${baseFinal.notes ?? ""} EXACT GRID v4 failed independently (${error instanceof Error ? error.message : "unknown error"}); v3 result is retained.`,
    };
  }
}
