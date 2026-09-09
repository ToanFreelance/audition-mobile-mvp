import { runAudioBeatVariants } from "./rhythm-analyzers/audio-beat";
import { runExactGridRefiner } from "./rhythm-analyzers/exact-grid-refiner";
import { runFinalRhythmEstimator } from "./rhythm-analyzers/final-rhythm-estimator-v3";
import { runAutoGridValidator } from "./rhythm-analyzers/grid-validator";
import { downmixAudioBuffer } from "./rhythm-analyzers/metrics";
import { runMusicTempoVariants } from "./rhythm-analyzers/music-tempo";
import { runPhaseGridValidator } from "./rhythm-analyzers/phase-grid-validator";
import type { BenchmarkInput, RhythmEngineResult } from "./rhythm-analyzers/types";
import { runWebAudioBeatDetectorVariants } from "./rhythm-analyzers/web-audio-beat-detector";

export type TempoSource = "final-v4" | "audio-pulse" | "onset" | "phase" | "package";

export type TempoCandidate = {
  bpm: number;
  source: TempoSource;
  confidence: number;
};

export type TempoAnalysis = {
  bpmExact: number;
  displayBpm: number;
  confidence: number;
  candidates: TempoCandidate[];
  beats: number[];
  audioStartMs: number;
  analysisOffsetMs: number;
  audioPulseBpm?: number;
  gameplayBpm?: number;
  nominalBpm?: number;
  sourceSpeedStatus?: string;
  playbackRateToNominal?: number;
  metricalConfidence?: number;
  exactTempoConfidence?: number;
  phaseCoherenceConfidence?: number;
  gridFitEnvelopeBpm?: number;
  gridFitEndDriftMs?: number;
  safeIntegerSnap?: boolean;
  analyzerVersion?: string;
};

const yieldToBrowser = () => new Promise<void>(resolve => setTimeout(resolve, 0));

function finite(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function rawRecord(row: RhythmEngineResult): Record<string, unknown> {
  return row.raw && typeof row.raw === "object" ? row.raw as Record<string, unknown> : {};
}

function pushUniqueCandidate(target: TempoCandidate[], candidate: TempoCandidate) {
  if (!Number.isFinite(candidate.bpm) || candidate.bpm < 40 || candidate.bpm > 220) return;
  if (target.some(item => Math.abs(item.bpm - candidate.bpm) <= 0.01 && item.source === candidate.source)) return;
  target.push(candidate);
}

export function detectLeadingAudioStart(mono: Float32Array, sampleRate: number): number {
  if (!mono.length || !Number.isFinite(sampleRate) || sampleRate <= 0) return 0;
  const frameSeconds = 0.02;
  const frameSize = Math.max(64, Math.round(sampleRate * frameSeconds));
  const frameCount = Math.floor(mono.length / frameSize);
  if (frameCount < 4) return 0;

  const rmsFrames = new Float32Array(frameCount);
  for (let frame = 0; frame < frameCount; frame += 1) {
    const start = frame * frameSize;
    const end = Math.min(mono.length, start + frameSize);
    let sumSquares = 0;
    for (let index = start; index < end; index += 1) {
      const sample = mono[index] ?? 0;
      sumSquares += sample * sample;
    }
    rmsFrames[frame] = Math.sqrt(sumSquares / Math.max(1, end - start));
  }

  const baselineCount = Math.max(1, Math.min(frameCount, Math.round(2 / frameSeconds)));
  const baseline = Array.from(rmsFrames.slice(0, baselineCount)).sort((a, b) => a - b);
  const noiseFloor = baseline[Math.floor((baseline.length - 1) * 0.2)] ?? 0;
  const threshold = Math.max(0.0035, noiseFloor * 4.5);
  const sustainFrames = Math.max(4, Math.round(0.12 / frameSeconds));
  const durationSeconds = mono.length / sampleRate;
  const maxSearchSeconds = Math.min(durationSeconds, Math.min(15, Math.max(5, durationSeconds * 0.25)));
  const maxSearchFrames = Math.min(frameCount, Math.round(maxSearchSeconds / frameSeconds));

  for (let frame = 0; frame + sustainFrames <= maxSearchFrames; frame += 1) {
    let audible = 0;
    let peak = 0;
    for (let offset = 0; offset < sustainFrames; offset += 1) {
      const rms = rmsFrames[frame + offset] ?? 0;
      if (rms >= threshold) audible += 1;
      peak = Math.max(peak, rms);
    }
    if (audible >= sustainFrames - 1 && peak >= threshold * 1.35) {
      return Math.max(0, frame * frameSize - Math.round(sampleRate * 0.05));
    }
  }

  return 0;
}

async function runProductionFinal(input: BenchmarkInput): Promise<{ final: RhythmEngineResult; onset: RhythmEngineResult; phase: RhythmEngineResult; packages: RhythmEngineResult[] }> {
  // Production path deliberately excludes Essentia.js. Essentia remains benchmark-only.
  const audioBeatRows = await runAudioBeatVariants(input);
  await yieldToBrowser();
  const webRows = await runWebAudioBeatDetectorVariants(input);
  await yieldToBrowser();
  const musicTempoRows = await runMusicTempoVariants(input);
  await yieldToBrowser();

  const packageRows = [...audioBeatRows, ...webRows, ...musicTempoRows];
  const onsetGridRow = await runAutoGridValidator(input, packageRows);
  await yieldToBrowser();
  const phaseGridRow = await runPhaseGridValidator(input, packageRows);
  await yieldToBrowser();
  const v3 = await runFinalRhythmEstimator(input, packageRows, onsetGridRow, phaseGridRow);
  await yieldToBrowser();
  const final = await runExactGridRefiner(input, v3);
  return { final, onset: onsetGridRow, phase: phaseGridRow, packages: packageRows };
}

export async function analyzeTempo(audioUrl: string, authoredSpaceStartMs?: number): Promise<TempoAnalysis> {
  if (typeof window === "undefined") throw new Error("Rhythm analysis is browser-only.");

  const response = await fetch(audioUrl, { cache: "no-store" });
  if (!response.ok) throw new Error(`Không đọc được audio (HTTP ${response.status}).`);

  const bytes = await response.arrayBuffer();
  const AudioContextCtor = window.AudioContext ?? (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextCtor) throw new Error("Thiết bị không hỗ trợ Web Audio API.");

  const context = new AudioContextCtor();
  try {
    const buffer = await context.decodeAudioData(bytes.slice(0));
    const mono = downmixAudioBuffer(buffer);
    const startSample = detectLeadingAudioStart(mono, buffer.sampleRate);
    const audioStartMs = Math.round(startSample / buffer.sampleRate * 1000);
    const input: BenchmarkInput = {
      buffer,
      mono,
      sampleRate: buffer.sampleRate,
      spaceStartMs: finite(authoredSpaceStartMs) && authoredSpaceStartMs > 0 ? authoredSpaceStartMs : undefined,
    };

    const { final, onset, phase, packages } = await runProductionFinal(input);
    if (final.error || !finite(final.bpm) || final.bpm <= 0) {
      throw new Error(final.error || "FINAL RHYTHM v4 did not return a valid BPM.");
    }

    const raw = rawRecord(final);
    const gameplayBpm = finite(raw.gameplayBpm) ? raw.gameplayBpm : final.bpm;
    const audioPulseBpm = finite(raw.audioPulseBpm) ? raw.audioPulseBpm : gameplayBpm;
    const bpmExact = Number(gameplayBpm.toFixed(4));
    const candidates: TempoCandidate[] = [];

    pushUniqueCandidate(candidates, {
      bpm: gameplayBpm,
      source: "final-v4",
      confidence: clamp(final.confidence ?? 0.5, 0, 1),
    });
    if (Math.abs(audioPulseBpm - gameplayBpm) > 0.001) {
      pushUniqueCandidate(candidates, {
        bpm: audioPulseBpm,
        source: "audio-pulse",
        confidence: clamp(finite(raw.exactTempoConfidence) ? raw.exactTempoConfidence : final.confidence ?? 0.5, 0, 1),
      });
    }
    if (finite(onset.bpm) && onset.bpm > 0) {
      pushUniqueCandidate(candidates, { bpm: onset.bpm, source: "onset", confidence: clamp(onset.confidence ?? 0.5, 0, 1) });
    }
    if (finite(phase.bpm) && phase.bpm > 0) {
      pushUniqueCandidate(candidates, { bpm: phase.bpm, source: "phase", confidence: clamp(phase.confidence ?? 0.5, 0, 1) });
    }
    for (const row of packages
      .filter(row => !row.error && finite(row.bpm) && row.bpm > 0)
      .sort((a, b) => (b.confidence ?? 0) - (a.confidence ?? 0))
      .slice(0, 3)) {
      pushUniqueCandidate(candidates, { bpm: row.bpm as number, source: "package", confidence: clamp(row.confidence ?? 0.35, 0, 1) });
    }

    return {
      bpmExact,
      displayBpm: Math.round(gameplayBpm),
      confidence: clamp(final.confidence ?? 0.5, 0, 1),
      candidates,
      beats: final.beatTimesMs.map(ms => ms / 1000),
      audioStartMs,
      analysisOffsetMs: audioStartMs,
      audioPulseBpm,
      gameplayBpm,
      nominalBpm: finite(raw.nominalBpmCandidate) ? raw.nominalBpmCandidate : undefined,
      sourceSpeedStatus: typeof raw.sourceSpeedStatus === "string" ? raw.sourceSpeedStatus : undefined,
      playbackRateToNominal: finite(raw.playbackRateToNominal) ? raw.playbackRateToNominal : undefined,
      metricalConfidence: finite(raw.metricalLevelConfidence) ? raw.metricalLevelConfidence : undefined,
      exactTempoConfidence: finite(raw.exactTempoConfidence) ? raw.exactTempoConfidence : undefined,
      phaseCoherenceConfidence: finite(raw.phaseCoherenceConfidence) ? raw.phaseCoherenceConfidence : undefined,
      gridFitEnvelopeBpm: finite(raw.robust95FamilySpreadBpm) ? raw.robust95FamilySpreadBpm : undefined,
      gridFitEndDriftMs: finite(raw.robust95EndDriftMs) ? raw.robust95EndDriftMs : undefined,
      safeIntegerSnap: typeof raw.safeIntegerSnap === "boolean" ? raw.safeIntegerSnap : undefined,
      analyzerVersion: typeof final.version === "string" ? final.version : "internal-v4-exact-grid",
    };
  } finally {
    await context.close().catch(() => undefined);
  }
}
