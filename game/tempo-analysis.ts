import { beatTrack, combTempo, tempo } from "@audio/beat";

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

function median(values: number[]): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] ?? null : ((sorted[mid - 1] ?? 0) + (sorted[mid] ?? 0)) / 2;
}

/**
 * Derive a robust constant BPM from tracked beat positions without using the
 * beat phase itself. This is intentionally phase-agnostic: the user still
 * authors Space Start by ear, while this value only controls long-run grid
 * spacing so the gauge cannot accumulate drift from a weak tempo estimate.
 */
function bpmFromTrackedBeats(beats: number[], minBpm: number, maxBpm: number): number | null {
  if (beats.length < 8) return null;

  const minInterval = 60 / maxBpm;
  const maxInterval = 60 / minBpm;
  const intervals: number[] = [];

  for (let index = 1; index < beats.length; index += 1) {
    const interval = (beats[index] ?? 0) - (beats[index - 1] ?? 0);
    if (Number.isFinite(interval) && interval >= minInterval && interval <= maxInterval) intervals.push(interval);
  }

  const center = median(intervals);
  if (!center || center <= 0) return null;

  // Reject skipped/doubled beats and local tracker outliers, then use the
  // median again. A 12% band is wide enough for real recordings but narrow
  // enough to reject phase jumps.
  const trimmed = intervals.filter(interval => Math.abs(interval - center) / center <= 0.12);
  const robustInterval = median(trimmed.length >= 4 ? trimmed : intervals);
  if (!robustInterval || robustInterval <= 0) return null;

  const bpm = 60 / robustInterval;
  return Number.isFinite(bpm) && bpm >= minBpm && bpm <= maxBpm ? bpm : null;
}

function percentile(values: number[], ratio: number): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.max(0, Math.min(sorted.length - 1, Math.floor((sorted.length - 1) * ratio)));
  return sorted[index] ?? 0;
}

/**
 * Detect the first sustained audible region for tempo analysis. This remains
 * intentionally conservative and includes a short pre-roll so transients are
 * not removed from the BPM detector. It is NOT used to crop playback anymore.
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

  const baselineFrames = rmsFrames.slice(0, Math.max(1, Math.min(frameCount, Math.round(2 / frameSeconds))));
  const noiseFloor = percentile(baselineFrames, 0.2);
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
      const detectedSample = frame * frameSize;
      const preRollSamples = Math.round(sampleRate * 0.05);
      return Math.max(0, detectedSample - preRollSamples);
    }
  }

  return 0;
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

    const minBpm = 40;
    const maxBpm = 220;
    const baseOptions = { fs: buffer.sampleRate, minBpm, maxBpm } as const;

    // Use three independent signals. tempo() is useful as a candidate, but it
    // must not be the sole authority: on some real tracks its autocorrelation
    // peak is slightly off, which creates visible cumulative gauge drift.
    const tempoResult = tempo(analysisMono, { ...baseOptions, candidates: 8 });
    const combResult = combTempo(analysisMono, baseOptions);
    const tracked = beatTrack(analysisMono, baseOptions);

    const tempoCandidateValues = finite(
      (tempoResult as TempoResult & { candidates?: ArrayLike<number> }).candidates,
    );
    const trackedBeats = finite(tracked.beats);

    const tempoBpm = Number(tempoResult.bpm);
    const combBpm = Number(combResult.bpm);
    const trackedBpm = Number(tracked.bpm);
    const gridBpm = bpmFromTrackedBeats(trackedBeats, minBpm, maxBpm);

    // Prefer the median of comb-filter tempo, free-running beat-track tempo,
    // and the robust period measured from the tracked beat sequence. These
    // methods are less prone to the small autocorrelation bias that previously
    // produced Aloha=100.4464 and caused ~20ms drift every four beats.
    const strongValues = [combBpm, trackedBpm, gridBpm ?? Number.NaN].filter(
      value => Number.isFinite(value) && value >= minBpm && value <= maxBpm,
    );
    const strongMedian = median(strongValues);
    const fallbackValues = [tempoBpm, ...tempoCandidateValues].filter(
      value => Number.isFinite(value) && value >= minBpm && value <= maxBpm,
    );
    const targetBpm = strongMedian ?? median(fallbackValues) ?? 120;

    const candidates: TempoCandidate[] = [
      ...tempoCandidateValues.map((bpm): TempoCandidate => ({
        bpm,
        source: "tempo",
        confidence: Number(tempoResult.confidence) || 0,
      })),
      { bpm: tempoBpm, source: "tempo", confidence: Number(tempoResult.confidence) || 0 },
      { bpm: combBpm, source: "comb", confidence: Number(combResult.confidence) || 0 },
      { bpm: trackedBpm, source: "beatTrack", confidence: Number(tracked.confidence) || 0 },
      ...(gridBpm == null ? [] : [{ bpm: gridBpm, source: "beatTrack" as const, confidence: Number(tracked.confidence) || 0 }]),
    ].filter(
      (item): item is TempoCandidate =>
        Number.isFinite(item.bpm) && item.bpm >= minBpm && item.bpm <= maxBpm && isTempoSource(item.source),
    );

    const bpmExact = Number(clamp(targetBpm, minBpm, maxBpm).toFixed(4));
    const displayBpm = Math.round(bpmExact);
    const confidence = Number(
      clamp(
        Math.max(Number(combResult.confidence) || 0, Number(tracked.confidence) || 0, Number(tempoResult.confidence) || 0),
        0,
        1,
      ).toFixed(4),
    );

    return {
      bpmExact,
      displayBpm,
      confidence,
      candidates,
      // Beat phase remains deliberately disabled. The user authors the first
      // Space Start by ear on the same WebAudio timeline used by gameplay;
      // BPM_exact only determines the spacing of subsequent four-beat cycles.
      beats: [],
      audioStartMs,
      analysisOffsetMs: audioStartMs,
    };
  } finally {
    await context.close().catch(() => undefined);
  }
}
