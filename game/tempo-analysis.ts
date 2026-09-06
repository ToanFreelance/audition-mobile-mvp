import { beatTrack, combTempo, tempo } from "@audio/beat";

type TempoResult = Awaited<ReturnType<typeof tempo>>;
type TempoSource = "tempo" | "comb" | "beatTrack" | "anchorGrid";

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
};

const finite = (values: ArrayLike<number> | undefined): number[] => {
  if (!values) return [];
  return Array.from(values).filter(Number.isFinite);
};

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

function isTempoSource(value: unknown): value is TempoSource {
  return value === "tempo" || value === "comb" || value === "beatTrack" || value === "anchorGrid";
}

function median(values: number[]): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] ?? null : ((sorted[mid - 1] ?? 0) + (sorted[mid] ?? 0)) / 2;
}

function percentile(values: number[], ratio: number): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.max(0, Math.min(sorted.length - 1, Math.floor((sorted.length - 1) * ratio)));
  return sorted[index] ?? 0;
}

async function resolvePersistedSpaceStart(audioUrl: string): Promise<number | undefined> {
  try {
    const response = await fetch("/api/music-config", { cache: "no-store" });
    if (!response.ok) return undefined;
    const json = await response.json() as { configs?: Array<{ audioUrl?: string; spaceStartMs?: number }> } | Array<{ audioUrl?: string; spaceStartMs?: number }>;
    const configs = Array.isArray(json) ? json : json.configs ?? [];
    const match = configs.find(item => item.audioUrl === audioUrl);
    const value = match?.spaceStartMs;
    return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : undefined;
  } catch {
    return undefined;
  }
}

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

function scoreAnchorGrid(
  flux: Float32Array,
  frameSeconds: number,
  anchorSeconds: number,
  bpm: number,
  durationSeconds: number,
) {
  if (!flux.length || bpm <= 0) return Number.NEGATIVE_INFINITY;
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
    const from = Math.max(0, centerFrame - radiusFrames);
    const to = Math.min(flux.length - 1, centerFrame + radiusFrames);
    for (let frame = from; frame <= to; frame += 1) localMax = Math.max(localMax, flux[frame] ?? 0);
    sum += localMax;
    count += 1;
  }

  return count >= 24 ? sum / count : Number.NEGATIVE_INFINITY;
}

function refineBpmAgainstAnchor(
  mono: Float32Array,
  sampleRate: number,
  durationSeconds: number,
  anchorMs: number | undefined,
  coarseBpm: number,
): number | null {
  if (!Number.isFinite(anchorMs) || (anchorMs ?? 0) <= 0 || !Number.isFinite(coarseBpm) || coarseBpm <= 0) return null;
  const anchorSeconds = (anchorMs ?? 0) / 1000;
  if (anchorSeconds >= durationSeconds - 8) return null;

  const { flux, frameSeconds } = buildEnergyFlux(mono, sampleRate);
  const minBpm = Math.max(40, coarseBpm - 2);
  const maxBpm = Math.min(220, coarseBpm + 2);
  const step = 0.005;
  let bestBpm = coarseBpm;
  let bestScore = Number.NEGATIVE_INFINITY;

  for (let bpm = minBpm; bpm <= maxBpm + 1e-9; bpm += step) {
    const score = scoreAnchorGrid(flux, frameSeconds, anchorSeconds, bpm, durationSeconds);
    if (score > bestScore) {
      bestScore = score;
      bestBpm = bpm;
    }
  }

  return Number.isFinite(bestScore) ? Number(bestBpm.toFixed(4)) : null;
}

function chooseCoarseBpm(args: {
  tempoBpm: number;
  tempoConfidence: number;
  combBpm: number;
  combConfidence: number;
  trackedBpm: number;
  trackedConfidence: number;
  minBpm: number;
  maxBpm: number;
}) {
  const { tempoBpm, tempoConfidence, combBpm, combConfidence, trackedBpm, trackedConfidence, minBpm, maxBpm } = args;
  const valid = (value: number) => Number.isFinite(value) && value >= minBpm && value <= maxBpm;

  // A high-confidence tempo estimate is the safest seed for local anchor-grid
  // refinement. Do not average it with a low-confidence tracker that landed on
  // a different harmonic (Aloha: tempo≈100.45 @100%, beatTrack≈119 @4%).
  if (valid(tempoBpm) && tempoConfidence >= 0.5) {
    const closeValues = [tempoBpm];
    if (valid(trackedBpm) && trackedConfidence >= 0.35 && Math.abs(trackedBpm - tempoBpm) / tempoBpm <= 0.035) closeValues.push(trackedBpm);
    if (valid(combBpm) && combConfidence >= 0.35 && Math.abs(combBpm - tempoBpm) / tempoBpm <= 0.035) closeValues.push(combBpm);
    return median(closeValues) ?? tempoBpm;
  }

  if (valid(trackedBpm) && trackedConfidence >= 0.35) {
    const closeValues = [trackedBpm];
    if (valid(combBpm) && combConfidence >= 0.35 && Math.abs(combBpm - trackedBpm) / trackedBpm <= 0.035) closeValues.push(combBpm);
    if (valid(tempoBpm) && Math.abs(tempoBpm - trackedBpm) / trackedBpm <= 0.035) closeValues.push(tempoBpm);
    return median(closeValues) ?? trackedBpm;
  }

  if (valid(tempoBpm)) return tempoBpm;
  if (valid(combBpm)) return combBpm;
  if (valid(trackedBpm)) return trackedBpm;
  return 120;
}

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

export async function analyzeTempo(audioUrl: string, authoredSpaceStartMs?: number): Promise<TempoAnalysis> {
  if (typeof window === "undefined") throw new Error("Tempo analysis is browser-only.");

  const response = await fetch(audioUrl, { cache: "no-store" });
  if (!response.ok) throw new Error(`Không đọc được audio (HTTP ${response.status}).`);

  const bytes = await response.arrayBuffer();
  const AudioContextCtor = window.AudioContext ?? (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
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
    const tempoResult = tempo(analysisMono, { ...baseOptions, candidates: 8 });
    const combResult = combTempo(analysisMono, baseOptions);
    const tracked = beatTrack(analysisMono, baseOptions);

    const tempoCandidateValues = finite((tempoResult as TempoResult & { candidates?: ArrayLike<number> }).candidates);
    const tempoBpm = Number(tempoResult.bpm);
    const combBpm = Number(combResult.bpm);
    const trackedBpm = Number(tracked.bpm);
    const tempoConfidence = clamp(Number(tempoResult.confidence) || 0, 0, 1);
    const combConfidence = clamp(Number(combResult.confidence) || 0, 0, 1);
    const trackedConfidence = clamp(Number(tracked.confidence) || 0, 0, 1);

    const coarseBpm = chooseCoarseBpm({ tempoBpm, tempoConfidence, combBpm, combConfidence, trackedBpm, trackedConfidence, minBpm, maxBpm });
    const savedSpaceStartMs = authoredSpaceStartMs ?? await resolvePersistedSpaceStart(audioUrl);
    const anchorGridBpm = refineBpmAgainstAnchor(mono, buffer.sampleRate, buffer.duration, savedSpaceStartMs, coarseBpm);
    const targetBpm = anchorGridBpm ?? coarseBpm;

    const candidates: TempoCandidate[] = [
      ...(anchorGridBpm == null ? [] : [{ bpm: anchorGridBpm, source: "anchorGrid" as const, confidence: 0.95 }]),
      ...tempoCandidateValues.map((bpm): TempoCandidate => ({ bpm, source: "tempo", confidence: tempoConfidence })),
      { bpm: tempoBpm, source: "tempo", confidence: tempoConfidence },
      { bpm: combBpm, source: "comb", confidence: combConfidence },
      { bpm: trackedBpm, source: "beatTrack", confidence: trackedConfidence },
    ].filter((item): item is TempoCandidate => Number.isFinite(item.bpm) && item.bpm >= minBpm && item.bpm <= maxBpm && isTempoSource(item.source));

    const bpmExact = Number(clamp(targetBpm, minBpm, maxBpm).toFixed(4));
    const displayBpm = Math.round(bpmExact);
    const confidence = anchorGridBpm != null ? 0.95 : Number(clamp(Math.max(trackedConfidence, tempoConfidence), 0, 1).toFixed(4));

    return {
      bpmExact,
      displayBpm,
      confidence,
      candidates,
      beats: [],
      audioStartMs,
      analysisOffsetMs: audioStartMs,
    };
  } finally {
    await context.close().catch(() => undefined);
  }
}
