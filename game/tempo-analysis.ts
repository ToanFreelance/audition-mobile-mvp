import { beatTrack, combTempo, tempo } from "@audio/beat";

type BeatTrackOptions = Parameters<typeof beatTrack>[1];
type TempoResult = Awaited<ReturnType<typeof tempo>>;
type TempoSource = "tempo" | "comb" | "beatTrack";

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
  /** First sustained non-silent audio on the original media timeline. */
  audioStartMs: number;
  /** Number of milliseconds logically skipped before tempo/beat analysis. */
  analysisOffsetMs: number;
};

const finite = (values: ArrayLike<number> | undefined): number[] => {
  if (!values) return [];
  return Array.from(values).filter(Number.isFinite);
};

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

function isTempoSource(value: unknown): value is TempoSource {
  return value === "tempo" || value === "comb" || value === "beatTrack";
}

type TempoCluster = {
  center: number;
  members: TempoCandidate[];
  score: number;
};

function cluster(candidates: TempoCandidate[]): TempoCluster[] {
  const sorted = [...candidates].sort((a, b) => a.bpm - b.bpm);
  const clusters: TempoCluster[] = [];

  for (const candidate of sorted) {
    const current = clusters[clusters.length - 1];
    if (!current || Math.abs(candidate.bpm - current.center) > 0.8) {
      clusters.push({ center: candidate.bpm, members: [candidate], score: candidate.confidence });
      continue;
    }

    current.members.push(candidate);
    const weighted = current.members.reduce((sum, item) => sum + item.bpm * Math.max(0.01, item.confidence), 0);
    const weight = current.members.reduce((sum, item) => sum + Math.max(0.01, item.confidence), 0);
    current.center = weighted / weight;
    current.score = current.members.reduce((sum, item) => sum + Math.max(0.01, item.confidence), 0);
  }

  return clusters.sort((a, b) => b.score - a.score);
}

function percentile(values: number[], ratio: number): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.max(0, Math.min(sorted.length - 1, Math.floor((sorted.length - 1) * ratio)));
  return sorted[index] ?? 0;
}

/**
 * Detect the first sustained audible region. A single click/noise spike is not
 * enough: several consecutive RMS windows must exceed the adaptive threshold.
 * The returned sample index includes a short pre-roll so the first transient is
 * preserved for beat tracking.
 */
export function detectLeadingAudioStart(mono: Float32Array, sampleRate: number): number {
  if (!mono.length || !Number.isFinite(sampleRate) || sampleRate <= 0) return 0;

  const frameSeconds = 0.02;
  const frameSize = Math.max(64, Math.round(sampleRate * frameSeconds));
  const frameCount = Math.floor(mono.length / frameSize);
  if (frameCount < 4) return 0;

  const rmsFrames: number[] = new Array(frameCount);
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

  // Estimate the noise floor from the quietest part of the first ~2 seconds.
  // Using a low percentile keeps this robust when a song begins immediately.
  const baselineFrames = rmsFrames.slice(0, Math.max(1, Math.min(frameCount, Math.round(2 / frameSeconds))));
  const noiseFloor = percentile(baselineFrames, 0.2);
  const threshold = Math.max(0.0035, noiseFloor * 4.5);

  const sustainFrames = Math.max(4, Math.round(0.12 / frameSeconds));
  const durationSeconds = mono.length / sampleRate;
  // Always inspect at least the first 5 seconds when available; long tracks are
  // capped at 15 seconds because this detector is only for leading dead-air.
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
      const detectedSample = frame * frameSize;
      const preRollSamples = Math.round(sampleRate * 0.05);
      return Math.max(0, detectedSample - preRollSamples);
    }
  }

  return 0;
}

function fitPhaseToTempo(beats: number[], period: number): number {
  if (!beats.length || !Number.isFinite(period) || period <= 0) return 0;

  const phases = beats.map(time => ((time % period) + period) % period);
  let bestPhase = phases[0] ?? 0;
  let bestError = Number.POSITIVE_INFINITY;

  for (const candidate of phases) {
    const error = phases.reduce((sum, phase) => {
      const distance = Math.abs(phase - candidate);
      return sum + Math.min(distance, period - distance) ** 2;
    }, 0);
    if (error < bestError) {
      bestError = error;
      bestPhase = candidate;
    }
  }

  return bestPhase;
}

function buildUniformBeatGrid(durationSeconds: number, bpm: number, phaseSeconds: number): number[] {
  if (!Number.isFinite(durationSeconds) || durationSeconds <= 0 || !Number.isFinite(bpm) || bpm <= 0) return [];

  const period = 60 / bpm;
  const phase = Number.isFinite(phaseSeconds) ? ((phaseSeconds % period) + period) % period : 0;

  const beats: number[] = [];
  for (let time = phase; time <= durationSeconds + 1e-6; time += period) {
    beats.push(Number(time.toFixed(6)));
  }
  return beats;
}

export async function analyzeTempo(audioUrl: string): Promise<TempoAnalysis> {
  if (typeof window === "undefined") throw new Error("Tempo analysis is browser-only.");

  const response = await fetch(audioUrl, { cache: "no-store" });
  if (!response.ok) throw new Error(`Không đọc được audio (HTTP ${response.status}).`);

  const bytes = await response.arrayBuffer();
  const AudioContextCtor =
    window.AudioContext ??
    (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextCtor) throw new Error("Thiết bị không hỗ trợ Web Audio API.");

  const context = new AudioContextCtor();

  try {
    const buffer = await context.decodeAudioData(bytes.slice(0));
    const channelCount = buffer.numberOfChannels;
    const length = buffer.length;
    const mono = new Float32Array(length);

    for (let channel = 0; channel < channelCount; channel += 1) {
      const source = buffer.getChannelData(channel);
      for (let index = 0; index < length; index += 1) mono[index] += source[index] / channelCount;
    }

    const analysisStartSample = detectLeadingAudioStart(mono, buffer.sampleRate);
    const analysisOffsetSeconds = analysisStartSample / buffer.sampleRate;
    const analysisMono = analysisStartSample > 0 ? mono.subarray(analysisStartSample) : mono;
    const audioStartMs = Math.round(analysisOffsetSeconds * 1000);

    const baseOptions = { fs: buffer.sampleRate, minBpm: 40, maxBpm: 220 } as const;
    const tempoResult = tempo(analysisMono, { ...baseOptions, candidates: 8 });
    const combResult = combTempo(analysisMono, baseOptions);
    const tempoCandidateValues = finite(
      (tempoResult as TempoResult & { candidates?: ArrayLike<number> }).candidates,
    );

    const tempoBpm = Number(tempoResult.bpm);
    const targetBpm = Number.isFinite(tempoBpm) && tempoBpm > 0
      ? tempoBpm
      : cluster([
          ...tempoCandidateValues.map((bpm): TempoCandidate => ({
            bpm,
            source: "tempo",
            confidence: Number(tempoResult.confidence) || 0,
          })),
          { bpm: Number(combResult.bpm), source: "comb", confidence: Number(combResult.confidence) || 0 },
        ])[0]?.center ?? 120;

    const trackedOptions: BeatTrackOptions = {
      ...baseOptions,
      bpm: targetBpm,
      tightness: 5000,
    };
    const tracked = beatTrack(analysisMono, trackedOptions);
    // beatTrack sees the trimmed buffer; restore every beat to the original
    // media timeline before fitting the phase used by the saved beat grid.
    const trackedBeats = finite(tracked.beats).map(time => time + analysisOffsetSeconds);
    const period = 60 / targetBpm;
    const phaseSeconds = fitPhaseToTempo(trackedBeats, period);
    const beats = buildUniformBeatGrid(buffer.duration, targetBpm, phaseSeconds);

    const candidates: TempoCandidate[] = [
      ...tempoCandidateValues.map((bpm): TempoCandidate => ({
        bpm,
        source: "tempo",
        confidence: Number(tempoResult.confidence) || 0,
      })),
      { bpm: tempoBpm, source: "tempo", confidence: Number(tempoResult.confidence) || 0 },
      { bpm: Number(combResult.bpm), source: "comb", confidence: Number(combResult.confidence) || 0 },
      { bpm: Number(tracked.bpm), source: "beatTrack", confidence: Number(tracked.confidence) || 0 },
    ].filter(
      (item): item is TempoCandidate =>
        Number.isFinite(item.bpm) && item.bpm >= 40 && item.bpm <= 220 && isTempoSource(item.source),
    );

    const bpmExact = Number(clamp(targetBpm, 40, 220).toFixed(4));
    const displayBpm = Math.round(bpmExact);
    const confidence = Number(
      clamp(
        (Number(tempoResult.confidence) || 0) + (Number(combResult.confidence) || 0) * 0.25,
        0,
        1,
      ).toFixed(4),
    );

    return {
      bpmExact,
      displayBpm,
      confidence,
      candidates,
      beats,
      audioStartMs,
      analysisOffsetMs: audioStartMs,
    };
  } finally {
    await context.close().catch(() => undefined);
  }
}
