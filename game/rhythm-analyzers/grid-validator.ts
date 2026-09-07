import { clamp, median, normalizeResult, synthesizeBeatGrid } from "./metrics";
import type { BenchmarkInput, BenchmarkProgress, RhythmEngineResult } from "./types";

type TempoSeed = { bpm: number; sources: string[] };
type ScanRange = { minBpm: number; maxBpm: number; sources: string[] };
type GridScore = {
  bpm: number;
  phaseMs: number;
  score: number;
  supportRatio: number;
  medianOnsetResidualMs: number | null;
  p90OnsetResidualMs: number | null;
  sources: string[];
};

type OnsetEnvelope = {
  values: Float32Array;
  frameMs: number;
  onsetTimesMs: number[];
};

const VERSION = "internal-v1";
const yieldToBrowser = () => new Promise<void>(resolve => setTimeout(resolve, 0));

function percentile(values: number[], q: number) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = clamp(Math.round((sorted.length - 1) * q), 0, sorted.length - 1);
  return sorted[index] ?? 0;
}

function normalizeHarmonicBpm(rawBpm: number): number | null {
  if (!Number.isFinite(rawBpm) || rawBpm <= 0) return null;
  const candidates = [1, 2, 0.5, 4, 0.25]
    .map(multiplier => rawBpm * multiplier)
    .filter(value => value >= 70 && value <= 160)
    .sort((a, b) => Math.abs(a - rawBpm) - Math.abs(b - rawBpm));
  return candidates[0] ?? null;
}

function collectTempoSeeds(results: RhythmEngineResult[]): TempoSeed[] {
  const collected: TempoSeed[] = [];
  const add = (rawBpm: number | null, source: string) => {
    if (rawBpm == null) return;
    const bpm = normalizeHarmonicBpm(rawBpm);
    if (bpm == null) return;
    const existing = collected.find(item => Math.abs(item.bpm - bpm) <= 0.06);
    if (existing) {
      existing.sources.push(source);
      existing.bpm = (existing.bpm + bpm) / 2;
    } else {
      collected.push({ bpm, sources: [source] });
    }
  };

  for (const result of results) {
    if (result.kind !== "package" || result.error) continue;
    const label = `${result.engine} · ${result.variant}`;
    add(result.bpm, label);
    if (result.beatGridKind === "detected") add(result.derivedBpmFromIntervals, `${label} intervals`);
  }
  return collected.sort((a, b) => a.bpm - b.bpm);
}

function buildScanRanges(seeds: TempoSeed[]): ScanRange[] {
  const rawRanges = seeds.map(seed => ({
    minBpm: Math.max(70, seed.bpm - 1.1),
    maxBpm: Math.min(160, seed.bpm + 1.1),
    sources: [...seed.sources],
  })).sort((a, b) => a.minBpm - b.minBpm);

  const merged: ScanRange[] = [];
  for (const range of rawRanges) {
    const previous = merged[merged.length - 1];
    if (previous && range.minBpm <= previous.maxBpm + 0.15) {
      previous.maxBpm = Math.max(previous.maxBpm, range.maxBpm);
      previous.sources = [...new Set([...previous.sources, ...range.sources])];
    } else {
      merged.push({ ...range });
    }
  }
  return merged;
}

function buildOnsetEnvelope(input: BenchmarkInput): OnsetEnvelope {
  const frameSize = Math.max(128, Math.round(input.sampleRate * 0.0125));
  const frameCount = Math.max(1, Math.floor(input.mono.length / frameSize));
  const raw = new Float32Array(frameCount);
  let previousRms = 0;
  let previousTexture = 0;
  let previousRaw = 0;
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
    const currentRaw = attack + textureAttack * 0.18;
    raw[frame] = currentRaw + previousRaw * 0.35;
    previousRaw = currentRaw;
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
    if (value >= 0.35 && value >= (values[index - 1] ?? 0) && value > (values[index + 1] ?? 0)) {
      onsetTimesMs.push((index + 0.5) * frameMs);
    }
  }
  return { values, frameMs, onsetTimesMs };
}

function evaluateGrid(envelope: OnsetEnvelope, durationMs: number, bpm: number, phaseMs: number, detailed = false): GridScore {
  const intervalMs = 60000 / bpm;
  const radiusFrames = Math.max(1, Math.round(55 / envelope.frameMs));
  const residuals: number[] = [];
  let weighted = 0;
  let supported = 0;
  let count = 0;

  for (let timeMs = phaseMs; timeMs < durationMs; timeMs += intervalMs) {
    if (timeMs < 500 || timeMs > durationMs - 500) continue;
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
    const proximity = Math.exp(-0.5 * (residualMs / 22) ** 2);
    const strengthScore = clamp(bestStrength, 0, 1);
    weighted += strengthScore * (0.30 + 0.70 * proximity);
    if (bestStrength >= 0.20 && residualMs <= 45) supported += 1;
    if (detailed) residuals.push(residualMs);
    count += 1;
  }

  const supportRatio = count > 0 ? supported / count : 0;
  const meanScore = count > 0 ? weighted / count : 0;
  const score = meanScore * 0.72 + supportRatio * 0.28;
  return {
    bpm,
    phaseMs,
    score,
    supportRatio,
    medianOnsetResidualMs: detailed ? median(residuals) : null,
    p90OnsetResidualMs: detailed ? percentile(residuals, 0.9) : null,
    sources: [],
  };
}

function bestPhaseForBpm(envelope: OnsetEnvelope, durationMs: number, bpm: number, phaseStepMs: number): GridScore {
  const intervalMs = 60000 / bpm;
  let best = evaluateGrid(envelope, durationMs, bpm, 0);
  for (let phaseMs = phaseStepMs; phaseMs < intervalMs; phaseMs += phaseStepMs) {
    const score = evaluateGrid(envelope, durationMs, bpm, phaseMs);
    if (score.score > best.score) best = score;
  }
  return best;
}

function selectDistinct(candidates: GridScore[], limit: number, minBpmDistance = 0.12) {
  const sorted = [...candidates].sort((a, b) => b.score - a.score);
  const selected: GridScore[] = [];
  for (const candidate of sorted) {
    if (selected.some(item => Math.abs(item.bpm - candidate.bpm) < minBpmDistance)) continue;
    selected.push(candidate);
    if (selected.length >= limit) break;
  }
  return selected;
}

async function scanRange(envelope: OnsetEnvelope, durationMs: number, range: ScanRange, progress?: BenchmarkProgress, rangeIndex = 0, rangeCount = 1) {
  const coarse: GridScore[] = [];
  const phaseStepMs = Math.max(20, envelope.frameMs * 2);
  let scanned = 0;
  for (let bpm = range.minBpm; bpm <= range.maxBpm + 1e-9; bpm += 0.01) {
    coarse.push(bestPhaseForBpm(envelope, durationMs, bpm, phaseStepMs));
    scanned += 1;
    if (scanned % 80 === 0) {
      progress?.(`AUTO GRID · scanning range ${rangeIndex + 1}/${rangeCount} · ${bpm.toFixed(2)} BPM…`);
      await yieldToBrowser();
    }
  }

  const coarsePeaks = selectDistinct(coarse, 3);
  const refined: GridScore[] = [];
  for (const seed of coarsePeaks) {
    let best = seed;
    for (let bpm = seed.bpm - 0.015; bpm <= seed.bpm + 0.015 + 1e-9; bpm += 0.001) {
      const intervalMs = 60000 / bpm;
      for (let delta = -envelope.frameMs * 2; delta <= envelope.frameMs * 2 + 1e-9; delta += envelope.frameMs) {
        let phaseMs = seed.phaseMs + delta;
        while (phaseMs < 0) phaseMs += intervalMs;
        while (phaseMs >= intervalMs) phaseMs -= intervalMs;
        const candidate = evaluateGrid(envelope, durationMs, bpm, phaseMs);
        if (candidate.score > best.score) best = candidate;
      }
    }
    const detailed = evaluateGrid(envelope, durationMs, best.bpm, best.phaseMs, true);
    detailed.sources = range.sources;
    refined.push(detailed);
    await yieldToBrowser();
  }
  return refined;
}

function confidenceFor(top: GridScore, runnerUp?: GridScore) {
  const residual = top.medianOnsetResidualMs ?? 55;
  const supportQuality = clamp((top.supportRatio - 0.20) / 0.55, 0, 1);
  const residualQuality = 1 - clamp((residual - 8) / 45, 0, 1);
  const gap = runnerUp ? Math.max(0, top.score - runnerUp.score) : 0.08;
  const gapQuality = clamp(gap / 0.08, 0, 1);
  return clamp(supportQuality * 0.45 + residualQuality * 0.35 + gapQuality * 0.20, 0, 1);
}

function statusFor(confidence: number, top: GridScore) {
  const residual = top.medianOnsetResidualMs ?? Number.POSITIVE_INFINITY;
  if (confidence >= 0.72 && top.supportRatio >= 0.45 && residual <= 28) return "HIGH";
  if (confidence >= 0.48 && top.supportRatio >= 0.32 && residual <= 38) return "MEDIUM";
  return "LOW";
}

export async function runAutoGridValidator(input: BenchmarkInput, packageResults: RhythmEngineResult[], progress?: BenchmarkProgress): Promise<RhythmEngineResult> {
  const started = performance.now();
  try {
    progress?.("AUTO GRID · building zero-mark onset envelope…");
    await yieldToBrowser();
    const envelope = buildOnsetEnvelope(input);
    const seeds = collectTempoSeeds(packageResults);
    const ranges = buildScanRanges(seeds);
    if (!ranges.length) throw new Error("No package tempo candidates are available for zero-mark grid validation.");

    const allCandidates: GridScore[] = [];
    for (let index = 0; index < ranges.length; index += 1) {
      progress?.(`AUTO GRID · validating whole-track candidate range ${index + 1}/${ranges.length}…`);
      allCandidates.push(...await scanRange(envelope, input.buffer.duration * 1000, ranges[index] as ScanRange, progress, index, ranges.length));
    }

    const ranked = selectDistinct(allCandidates, 6, 0.08);
    const top = ranked[0];
    if (!top) throw new Error("Whole-track grid scan returned no candidate.");
    const runnerUp = ranked[1];
    const confidence = confidenceFor(top, runnerUp);
    const status = statusFor(confidence, top);
    const bpm = Number(top.bpm.toFixed(4));
    const beatTimesMs = synthesizeBeatGrid(top.phaseMs / 1000, bpm, input.buffer.duration);
    const ranking = ranked.slice(0, 4).map(item => `${item.bpm.toFixed(3)} BPM score ${item.score.toFixed(3)} support ${(item.supportRatio * 100).toFixed(0)}%`).join(" > ");

    return normalizeResult({
      id: "auto-grid-validator",
      engine: "AUTO GRID",
      variant: `whole-track onset fit · ${status}`,
      version: VERSION,
      kind: "custom",
      beatGridKind: "validated",
      bpm,
      confidence,
      confidenceRaw: confidence,
      confidenceScale: "internal whole-track onset-fit heuristic; not comparable to package confidence",
      beatTimesMs,
      onsetTimesMs: envelope.onsetTimesMs,
      processingTimeMs: performance.now() - started,
      notes: `ZERO-MARK analysis. Uses package tempo candidates only as search seeds, then validates BPM + phase against PCM onset energy across the whole track. Does NOT use authored Space Start. Status=${status}; support=${(top.supportRatio * 100).toFixed(1)}%; median onset residual=${top.medianOnsetResidualMs?.toFixed(1) ?? "n/a"}ms; p90=${top.p90OnsetResidualMs?.toFixed(1) ?? "n/a"}ms; phase=${top.phaseMs.toFixed(1)}ms. Candidate ranking: ${ranking}. Phase is the strongest beat-grid phase, not a downbeat decision; user still chooses SPACE #1.`,
      raw: {
        status,
        seeds,
        ranges,
        candidates: ranked,
        frameMs: envelope.frameMs,
        onsetCount: envelope.onsetTimesMs.length,
      },
    }, input);
  } catch (error) {
    return normalizeResult({
      id: "auto-grid-validator",
      engine: "AUTO GRID",
      variant: "whole-track onset fit",
      version: VERSION,
      kind: "custom",
      beatGridKind: "none",
      bpm: null,
      confidence: null,
      beatTimesMs: [],
      processingTimeMs: performance.now() - started,
      error: error instanceof Error ? error.message : "AUTO GRID validation failed",
      notes: "Zero-mark validator failed independently; package benchmark results remain usable.",
    }, input);
  }
}
