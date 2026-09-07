import { clamp, median, normalizeResult, synthesizeBeatGrid } from "./metrics";
import type { BenchmarkInput, BenchmarkProgress, RhythmEngineResult } from "./types";

type TempoSeed = { bpm: number; sources: string[] };
type ScanRange = { minBpm: number; maxBpm: number; sources: string[] };
type OnsetEnvelope = { values: Float32Array; frameMs: number; onsetTimesMs: number[] };
type PhaseWindow = { startMs: number; endMs: number; phaseOffsetMs: number; score: number };
type Candidate = {
  bpm: number;
  phaseMs: number;
  score: number;
  supportRatio: number;
  medianResidualMs: number | null;
  p90ResidualMs: number | null;
  phaseDriftMsPerSecond: number | null;
  phaseWindows: PhaseWindow[];
  sources: string[];
};

const VERSION = "internal-v1";
const MIN_BPM = 60;
const MAX_BPM = 180;
const WINDOW_MS = 30_000;
const yieldToBrowser = () => new Promise<void>(resolve => setTimeout(resolve, 0));

function percentile(values: number[], q: number) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = clamp(Math.round((sorted.length - 1) * q), 0, sorted.length - 1);
  return sorted[index] ?? 0;
}

function standardDeviation(values: number[]) {
  if (values.length < 2) return null;
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  const variance = values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

function linearSlope(xs: number[], ys: number[]) {
  if (xs.length < 2 || xs.length !== ys.length) return null;
  const meanX = xs.reduce((sum, value) => sum + value, 0) / xs.length;
  const meanY = ys.reduce((sum, value) => sum + value, 0) / ys.length;
  let numerator = 0;
  let denominator = 0;
  for (let index = 0; index < xs.length; index += 1) {
    numerator += ((xs[index] ?? 0) - meanX) * ((ys[index] ?? 0) - meanY);
    denominator += ((xs[index] ?? 0) - meanX) ** 2;
  }
  return denominator > 0 ? numerator / denominator : null;
}

function harmonicCandidates(rawBpm: number) {
  if (!Number.isFinite(rawBpm) || rawBpm <= 0) return [];
  return [1, 0.5, 2, 0.25, 4]
    .map(multiplier => rawBpm * multiplier)
    .filter(value => value >= MIN_BPM && value <= MAX_BPM);
}

function collectSeeds(results: RhythmEngineResult[]): TempoSeed[] {
  const seeds: TempoSeed[] = [];
  const add = (rawBpm: number | null, source: string) => {
    if (rawBpm == null || !Number.isFinite(rawBpm) || rawBpm <= 0) return;
    for (const bpm of harmonicCandidates(rawBpm)) {
      const existing = seeds.find(item => Math.abs(item.bpm - bpm) <= 0.04);
      if (existing) {
        existing.sources = [...new Set([...existing.sources, source])];
        existing.bpm = (existing.bpm + bpm) / 2;
      } else {
        seeds.push({ bpm, sources: [source] });
      }
    }
  };

  for (const result of results) {
    if (result.kind !== "package" || result.error) continue;
    const label = `${result.engine} · ${result.variant}`;
    add(result.bpm, label);
    if (result.beatGridKind === "detected") add(result.derivedBpmFromIntervals, `${label} intervals`);
  }
  return seeds.sort((a, b) => a.bpm - b.bpm);
}

function buildRanges(seeds: TempoSeed[]): ScanRange[] {
  const raw = seeds.map(seed => ({
    minBpm: Math.max(MIN_BPM, seed.bpm - 0.8),
    maxBpm: Math.min(MAX_BPM, seed.bpm + 0.8),
    sources: [...seed.sources],
  })).sort((a, b) => a.minBpm - b.minBpm);

  const merged: ScanRange[] = [];
  for (const range of raw) {
    const previous = merged[merged.length - 1];
    if (previous && range.minBpm <= previous.maxBpm + 0.08) {
      previous.maxBpm = Math.max(previous.maxBpm, range.maxBpm);
      previous.sources = [...new Set([...previous.sources, ...range.sources])];
    } else {
      merged.push({ ...range });
    }
  }
  return merged;
}

function buildOnsetEnvelope(input: BenchmarkInput): OnsetEnvelope {
  const frameSize = Math.max(128, Math.round(input.sampleRate * 0.01));
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
    raw[frame] = attack + textureAttack * 0.22;
    previousRms = rms;
    previousTexture = texture;
  }

  const samples = Array.from(raw);
  const floor = percentile(samples, 0.5);
  const ceiling = percentile(samples, 0.95);
  const scale = Math.max(1e-9, ceiling - floor);
  const values = new Float32Array(frameCount);
  for (let index = 0; index < frameCount; index += 1) {
    values[index] = clamp(((raw[index] ?? 0) - floor) / scale, 0, 2);
  }

  const frameMs = frameSize / input.sampleRate * 1000;
  const onsetTimesMs: number[] = [];
  for (let index = 1; index < frameCount - 1; index += 1) {
    const value = values[index] ?? 0;
    if (value >= 0.32 && value >= (values[index - 1] ?? 0) && value > (values[index + 1] ?? 0)) {
      onsetTimesMs.push((index + 0.5) * frameMs);
    }
  }
  return { values, frameMs, onsetTimesMs };
}

function evaluateWindow(
  envelope: OnsetEnvelope,
  bpm: number,
  phaseMs: number,
  startMs: number,
  endMs: number,
  detailed = false,
) {
  const intervalMs = 60000 / bpm;
  const radiusFrames = Math.max(1, Math.round(12 / envelope.frameMs));
  let firstBeat = phaseMs;
  while (firstBeat < startMs) firstBeat += intervalMs;
  while (firstBeat - intervalMs >= startMs) firstBeat -= intervalMs;

  const residuals: number[] = [];
  let weighted = 0;
  let supported = 0;
  let count = 0;
  for (let timeMs = firstBeat; timeMs < endMs; timeMs += intervalMs) {
    if (timeMs < startMs || timeMs < 500 || timeMs > endMs - 250) continue;
    const center = Math.round(timeMs / envelope.frameMs - 0.5);
    if (center < 0 || center >= envelope.values.length) continue;
    let bestFrame = center;
    let bestStrength = envelope.values[center] ?? 0;
    for (let frame = Math.max(0, center - radiusFrames); frame <= Math.min(envelope.values.length - 1, center + radiusFrames); frame += 1) {
      const strength = envelope.values[frame] ?? 0;
      if (strength > bestStrength) {
        bestStrength = strength;
        bestFrame = frame;
      }
    }
    const residualMs = Math.abs(bestFrame - center) * envelope.frameMs;
    const proximity = Math.exp(-0.5 * (residualMs / 7.5) ** 2);
    weighted += clamp(bestStrength, 0, 1.5) * (0.2 + 0.8 * proximity);
    if (bestStrength >= 0.18 && residualMs <= 15) supported += 1;
    if (detailed) residuals.push(residualMs);
    count += 1;
  }

  const supportRatio = count > 0 ? supported / count : 0;
  const score = count > 0 ? weighted / count : 0;
  return {
    score,
    supportRatio,
    medianResidualMs: detailed ? median(residuals) : null,
    p90ResidualMs: detailed ? percentile(residuals, 0.9) : null,
    residualJitterMs: detailed ? standardDeviation(residuals) : null,
  };
}

function bestPhaseForBpm(envelope: OnsetEnvelope, durationMs: number, bpm: number, phaseStepMs: number) {
  const intervalMs = 60000 / bpm;
  let bestPhaseMs = 0;
  let best = evaluateWindow(envelope, bpm, 0, 0, durationMs);
  for (let phaseMs = phaseStepMs; phaseMs < intervalMs; phaseMs += phaseStepMs) {
    const score = evaluateWindow(envelope, bpm, phaseMs, 0, durationMs);
    if (score.score > best.score) {
      best = score;
      bestPhaseMs = phaseMs;
    }
  }
  return { phaseMs: bestPhaseMs, ...best };
}

function wrapPhaseDelta(deltaMs: number, intervalMs: number) {
  let value = deltaMs;
  while (value > intervalMs / 2) value -= intervalMs;
  while (value < -intervalMs / 2) value += intervalMs;
  return value;
}

function phaseStability(envelope: OnsetEnvelope, durationMs: number, bpm: number, globalPhaseMs: number) {
  const intervalMs = 60000 / bpm;
  const phaseStepMs = Math.max(envelope.frameMs, 8);
  const windows: PhaseWindow[] = [];

  for (let startMs = 0; startMs < durationMs; startMs += WINDOW_MS) {
    const endMs = Math.min(durationMs, startMs + WINDOW_MS);
    if (endMs - startMs < 20_000) continue;
    let bestPhase = globalPhaseMs;
    let best = evaluateWindow(envelope, bpm, globalPhaseMs, startMs, endMs);
    for (let phaseMs = 0; phaseMs < intervalMs; phaseMs += phaseStepMs) {
      const score = evaluateWindow(envelope, bpm, phaseMs, startMs, endMs);
      if (score.score > best.score) {
        best = score;
        bestPhase = phaseMs;
      }
    }
    const rawOffset = wrapPhaseDelta(bestPhase - globalPhaseMs, intervalMs);
    let unwrapped = rawOffset;
    const previous = windows[windows.length - 1]?.phaseOffsetMs;
    if (previous != null) {
      while (unwrapped - previous > intervalMs / 2) unwrapped -= intervalMs;
      while (unwrapped - previous < -intervalMs / 2) unwrapped += intervalMs;
    }
    windows.push({ startMs, endMs, phaseOffsetMs: unwrapped, score: best.score });
  }

  const xs = windows.map(window => ((window.startMs + window.endMs) / 2) / 1000);
  const ys = windows.map(window => window.phaseOffsetMs);
  return { windows, driftMsPerSecond: linearSlope(xs, ys) };
}

function distinct(candidates: Candidate[], limit: number, minBpmDistance = 0.08) {
  const sorted = [...candidates].sort((a, b) => b.score - a.score);
  const selected: Candidate[] = [];
  for (const candidate of sorted) {
    if (selected.some(item => Math.abs(item.bpm - candidate.bpm) < minBpmDistance)) continue;
    selected.push(candidate);
    if (selected.length >= limit) break;
  }
  return selected;
}

async function scanRange(
  envelope: OnsetEnvelope,
  durationMs: number,
  range: ScanRange,
  progress?: BenchmarkProgress,
  rangeIndex = 0,
  rangeCount = 1,
) {
  const coarse: Candidate[] = [];
  const phaseStepMs = Math.max(20, envelope.frameMs * 2);
  let scanned = 0;
  for (let bpm = range.minBpm; bpm <= range.maxBpm + 1e-9; bpm += 0.01) {
    const best = bestPhaseForBpm(envelope, durationMs, bpm, phaseStepMs);
    coarse.push({
      bpm,
      phaseMs: best.phaseMs,
      score: best.score,
      supportRatio: best.supportRatio,
      medianResidualMs: null,
      p90ResidualMs: null,
      phaseDriftMsPerSecond: null,
      phaseWindows: [],
      sources: range.sources,
    });
    scanned += 1;
    if (scanned % 70 === 0) {
      progress?.(`PHASE GRID · scanning range ${rangeIndex + 1}/${rangeCount} · ${bpm.toFixed(2)} BPM…`);
      await yieldToBrowser();
    }
  }

  const peaks = distinct(coarse, 3, 0.12);
  const refined: Candidate[] = [];
  for (const seed of peaks) {
    let best = seed;
    for (let bpm = seed.bpm - 0.02; bpm <= seed.bpm + 0.02 + 1e-9; bpm += 0.001) {
      const intervalMs = 60000 / bpm;
      for (let delta = -envelope.frameMs * 2; delta <= envelope.frameMs * 2 + 1e-9; delta += envelope.frameMs) {
        let phaseMs = seed.phaseMs + delta;
        while (phaseMs < 0) phaseMs += intervalMs;
        while (phaseMs >= intervalMs) phaseMs -= intervalMs;
        const score = evaluateWindow(envelope, bpm, phaseMs, 0, durationMs, true);
        if (score.score > best.score) {
          best = {
            bpm,
            phaseMs,
            score: score.score,
            supportRatio: score.supportRatio,
            medianResidualMs: score.medianResidualMs,
            p90ResidualMs: score.p90ResidualMs,
            phaseDriftMsPerSecond: null,
            phaseWindows: [],
            sources: range.sources,
          };
        }
      }
    }
    const detailed = evaluateWindow(envelope, best.bpm, best.phaseMs, 0, durationMs, true);
    const stability = phaseStability(envelope, durationMs, best.bpm, best.phaseMs);
    const drift = stability.driftMsPerSecond;
    const driftQuality = drift == null ? 0.5 : 1 / (1 + Math.abs(drift) / 0.35);
    refined.push({
      ...best,
      score: detailed.score * (0.65 + 0.35 * driftQuality),
      supportRatio: detailed.supportRatio,
      medianResidualMs: detailed.medianResidualMs,
      p90ResidualMs: detailed.p90ResidualMs,
      phaseDriftMsPerSecond: drift,
      phaseWindows: stability.windows,
    });
    await yieldToBrowser();
  }
  return refined;
}

function confidenceFor(top: Candidate, runnerUp?: Candidate) {
  const drift = Math.abs(top.phaseDriftMsPerSecond ?? Number.POSITIVE_INFINITY);
  const driftQuality = clamp(1 - drift / 1.2, 0, 1);
  const supportQuality = clamp((top.supportRatio - 0.15) / 0.55, 0, 1);
  const residual = top.medianResidualMs ?? 20;
  const residualQuality = clamp(1 - residual / 20, 0, 1);
  const gap = runnerUp ? Math.max(0, top.score - runnerUp.score) : 0.05;
  const gapQuality = clamp(gap / 0.08, 0, 1);
  return clamp(driftQuality * 0.42 + supportQuality * 0.25 + residualQuality * 0.18 + gapQuality * 0.15, 0, 1);
}

function statusFor(confidence: number, candidate: Candidate) {
  const drift = Math.abs(candidate.phaseDriftMsPerSecond ?? Number.POSITIVE_INFINITY);
  if (confidence >= 0.72 && drift <= 0.35 && candidate.supportRatio >= 0.35) return "HIGH";
  if (confidence >= 0.5 && drift <= 0.9 && candidate.supportRatio >= 0.25) return "MEDIUM";
  return "LOW";
}

export async function runPhaseGridValidator(
  input: BenchmarkInput,
  packageResults: RhythmEngineResult[],
  progress?: BenchmarkProgress,
): Promise<RhythmEngineResult> {
  const started = performance.now();
  try {
    progress?.("PHASE GRID · building fixed-phase onset envelope…");
    await yieldToBrowser();
    const envelope = buildOnsetEnvelope(input);
    const seeds = collectSeeds(packageResults);
    const ranges = buildRanges(seeds);
    if (!ranges.length) throw new Error("No package tempo candidates are available for fixed-phase validation.");

    const candidates: Candidate[] = [];
    for (let index = 0; index < ranges.length; index += 1) {
      candidates.push(...await scanRange(envelope, input.buffer.duration * 1000, ranges[index] as ScanRange, progress, index, ranges.length));
    }

    const ranked = distinct(candidates, 6, 0.08);
    const top = ranked[0];
    if (!top) throw new Error("Fixed-phase scan returned no candidate.");
    const confidence = confidenceFor(top, ranked[1]);
    const status = statusFor(confidence, top);
    const bpm = Number(top.bpm.toFixed(4));
    const beatTimesMs = synthesizeBeatGrid(top.phaseMs / 1000, bpm, input.buffer.duration);
    const ranking = ranked.slice(0, 4).map(item => {
      const drift = item.phaseDriftMsPerSecond == null ? "n/a" : `${item.phaseDriftMsPerSecond >= 0 ? "+" : ""}${item.phaseDriftMsPerSecond.toFixed(3)}ms/s`;
      return `${item.bpm.toFixed(3)} BPM score ${item.score.toFixed(3)} drift ${drift}`;
    }).join(" > ");

    return normalizeResult({
      id: "phase-grid-validator",
      engine: "PHASE GRID",
      variant: `fixed-phase spectral coherence · ${status}`,
      version: VERSION,
      kind: "custom",
      beatGridKind: "validated",
      bpm,
      confidence,
      confidenceRaw: confidence,
      confidenceScale: "Internal absolute-phase coherence heuristic; not comparable to package confidence.",
      beatTimesMs,
      onsetTimesMs: envelope.onsetTimesMs,
      processingTimeMs: performance.now() - started,
      notes: `ZERO-MARK fixed-phase validator. Unlike AUTO GRID's broad local-onset support, one global phase must remain coherent across the whole track. Status=${status}; support=${(top.supportRatio * 100).toFixed(1)}%; median narrow residual=${top.medianResidualMs?.toFixed(1) ?? "n/a"}ms; p90=${top.p90ResidualMs?.toFixed(1) ?? "n/a"}ms; phase drift=${top.phaseDriftMsPerSecond == null ? "n/a" : `${top.phaseDriftMsPerSecond >= 0 ? "+" : ""}${top.phaseDriftMsPerSecond.toFixed(4)}ms/s`}; phase=${top.phaseMs.toFixed(1)}ms. Candidate ranking: ${ranking}. Does NOT use authored Space Start.`,
      raw: {
        status,
        seeds,
        ranges,
        frameMs: envelope.frameMs,
        onsetCount: envelope.onsetTimesMs.length,
        candidates: ranked,
        phaseWindows: top.phaseWindows,
      },
    }, input);
  } catch (error) {
    return normalizeResult({
      id: "phase-grid-validator",
      engine: "PHASE GRID",
      variant: "fixed-phase spectral coherence",
      version: VERSION,
      kind: "custom",
      beatGridKind: "none",
      bpm: null,
      confidence: null,
      beatTimesMs: [],
      processingTimeMs: performance.now() - started,
      error: error instanceof Error ? error.message : "PHASE GRID validation failed",
      notes: "Fixed-phase validator failed independently; package and AUTO GRID rows remain usable.",
    }, input);
  }
}
