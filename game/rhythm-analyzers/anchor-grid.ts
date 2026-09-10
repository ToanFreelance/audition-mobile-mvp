import { normalizeResult, synthesizeBeatGrid } from "./metrics";
import type { BenchmarkInput, RhythmEngineResult } from "./types";

function buildEnergyFlux(mono: Float32Array, sampleRate: number) {
  const frameSize = Math.max(128, Math.round(sampleRate * 0.02));
  const frameCount = Math.floor(mono.length / frameSize);
  const flux = new Float32Array(frameCount);
  let previousRms = 0;
  let previousFlux = 0;
  for (let frame = 0; frame < frameCount; frame += 1) {
    const start = frame * frameSize;
    const end = Math.min(mono.length, start + frameSize);
    let sumSquares = 0;
    for (let index = start; index < end; index += 1) {
      const sample = mono[index] ?? 0;
      sumSquares += sample * sample;
    }
    const rms = Math.sqrt(sumSquares / Math.max(1, end - start));
    const rawFlux = Math.max(0, rms - previousRms);
    flux[frame] = (rawFlux + previousFlux) * 0.5;
    previousFlux = rawFlux;
    previousRms = rms;
  }
  return { flux, frameSeconds: frameSize / sampleRate };
}

function scoreAnchorGrid(flux: Float32Array, frameSeconds: number, anchorSeconds: number, bpm: number, durationSeconds: number) {
  const beatSeconds = 60 / bpm;
  const radiusFrames = Math.max(1, Math.round(0.06 / frameSeconds));
  const lastTime = Math.min(durationSeconds - 0.5, flux.length * frameSeconds - 0.5);
  let sum = 0;
  let count = 0;
  for (let beat = 0; beat < 1200; beat += 1) {
    const time = anchorSeconds + beat * beatSeconds;
    if (time > lastTime) break;
    if (time < 0) continue;
    const centerFrame = Math.round(time / frameSeconds - 0.5);
    let localMax = 0;
    for (let frame = Math.max(0, centerFrame - radiusFrames); frame <= Math.min(flux.length - 1, centerFrame + radiusFrames); frame += 1) {
      localMax = Math.max(localMax, flux[frame] ?? 0);
    }
    sum += localMax;
    count += 1;
  }
  return count >= 24 ? sum / count : Number.NEGATIVE_INFINITY;
}

export function runAnchorGrid(input: BenchmarkInput, coarseBpm: number): RhythmEngineResult {
  const started = performance.now();
  const anchorMs = input.spaceStartMs;
  if (!Number.isFinite(anchorMs) || (anchorMs ?? 0) <= 0) {
    return normalizeResult({
      id: "custom-anchor-grid",
      engine: "Custom",
      variant: "anchorGrid",
      version: "internal",
      kind: "custom",
      beatGridKind: "none",
      bpm: null,
      confidence: null,
      beatTimesMs: [],
      processingTimeMs: performance.now() - started,
      notes: "Requires authored Space Start. CUSTOM remains diagnostic and is excluded from package consensus.",
    }, input);
  }

  try {
    const { flux, frameSeconds } = buildEnergyFlux(input.mono, input.sampleRate);
    let bestBpm = coarseBpm;
    let bestScore = Number.NEGATIVE_INFINITY;
    for (let bpm = Math.max(40, coarseBpm - 2); bpm <= Math.min(220, coarseBpm + 2) + 1e-9; bpm += 0.005) {
      const score = scoreAnchorGrid(flux, frameSeconds, (anchorMs ?? 0) / 1000, bpm, input.buffer.duration);
      if (score > bestScore) { bestScore = score; bestBpm = bpm; }
    }
    const rounded = Number(bestBpm.toFixed(4));
    const beats = synthesizeBeatGrid((anchorMs ?? 0) / 1000, rounded, input.buffer.duration);
    return normalizeResult({
      id: "custom-anchor-grid",
      engine: "Custom",
      variant: "anchorGrid",
      version: "internal",
      kind: "custom",
      beatGridKind: "synthetic",
      bpm: rounded,
      confidence: 0.95,
      confidenceRaw: 0.95,
      confidenceScale: "internal heuristic; not comparable",
      beatTimesMs: beats,
      processingTimeMs: performance.now() - started,
      notes: "Project-specific anchor-fit. Beat grid is synthesized from authored Space Start + fitted BPM; it is not an independent detected beat list.",
      raw: { coarseBpm, bestScore, scanStepBpm: 0.005 },
    }, input);
  } catch (error) {
    return normalizeResult({
      id: "custom-anchor-grid",
      engine: "Custom",
      variant: "anchorGrid",
      version: "internal",
      kind: "custom",
      beatGridKind: "none",
      bpm: null,
      confidence: null,
      beatTimesMs: [],
      processingTimeMs: performance.now() - started,
      error: error instanceof Error ? error.message : "CUSTOM anchor-grid failed",
    }, input);
  }
}
