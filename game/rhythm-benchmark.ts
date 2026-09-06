import { beatTrack, combTempo, tempo } from "@audio/beat";
import { guess as guessWebAudioBeat } from "web-audio-beat-detector";

export type RhythmEngineKind = "package" | "custom";

export type RhythmEngineResult = {
  id: string;
  engine: string;
  variant: string;
  kind: RhythmEngineKind;
  bpm: number | null;
  confidence: number | null;
  beatTimesMs: number[];
  beatCount: number;
  medianBeatIntervalMs: number | null;
  derivedBpmFromIntervals: number | null;
  intervalJitterMs: number | null;
  processingTimeMs: number;
  nearestBeatToSpaceStartMs: number | null;
  spaceStartDeltaMs: number | null;
  notes?: string;
  error?: string;
};

export type BenchmarkInput = {
  buffer: AudioBuffer;
  mono: Float32Array;
  sampleRate: number;
  spaceStartMs?: number;
};

type EssentiaRawRhythm = {
  bpm?: number;
  ticks?: unknown;
  confidence?: number;
  estimates?: unknown;
  bpmIntervals?: unknown;
};

type EssentiaInstance = {
  arrayToVector: (data: Float32Array) => unknown;
  vectorToArray?: (value: unknown) => Float32Array;
  RhythmExtractor2013: (
    signal: unknown,
    maxTempo?: number,
    method?: string,
    minTempo?: number,
  ) => EssentiaRawRhythm;
  delete?: () => void;
};

type EssentiaWindow = Window & {
  Essentia?: new (wasm: unknown) => EssentiaInstance;
  EssentiaWASM?: () => Promise<unknown>;
};

const ESSENTIA_VERSION = "0.1.3";
const ESSENTIA_WASM_SCRIPT = `https://cdn.jsdelivr.net/npm/essentia.js@${ESSENTIA_VERSION}/dist/essentia-wasm.web.js`;
const ESSENTIA_CORE_SCRIPT = `https://cdn.jsdelivr.net/npm/essentia.js@${ESSENTIA_VERSION}/dist/essentia.js-core.js`;

const finite = (values: ArrayLike<number> | undefined): number[] => {
  if (!values) return [];
  return Array.from(values).filter(Number.isFinite);
};

const median = (values: number[]): number | null => {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] ?? null : ((sorted[mid - 1] ?? 0) + (sorted[mid] ?? 0)) / 2;
};

const standardDeviation = (values: number[]): number | null => {
  if (values.length < 2) return null;
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  const variance = values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance);
};

const beatMetrics = (beatTimesMs: number[]) => {
  const intervals = beatTimesMs
    .slice(1)
    .map((value, index) => value - beatTimesMs[index])
    .filter(value => Number.isFinite(value) && value > 100 && value < 2000);
  const center = median(intervals);
  return {
    medianBeatIntervalMs: center,
    derivedBpmFromIntervals: center && center > 0 ? 60000 / center : null,
    intervalJitterMs: standardDeviation(intervals),
  };
};

const nearestToAnchor = (beatTimesMs: number[], spaceStartMs?: number) => {
  if (!beatTimesMs.length || !Number.isFinite(spaceStartMs)) return { nearest: null, delta: null };
  const anchor = spaceStartMs ?? 0;
  let nearest = beatTimesMs[0] ?? 0;
  for (const beat of beatTimesMs) {
    if (Math.abs(beat - anchor) < Math.abs(nearest - anchor)) nearest = beat;
  }
  return { nearest, delta: nearest - anchor };
};

function normalizeResult(
  base: Omit<RhythmEngineResult, "beatCount" | "medianBeatIntervalMs" | "derivedBpmFromIntervals" | "intervalJitterMs" | "nearestBeatToSpaceStartMs" | "spaceStartDeltaMs">,
  spaceStartMs?: number,
): RhythmEngineResult {
  const beats = base.beatTimesMs.filter(Number.isFinite).sort((a, b) => a - b);
  const metrics = beatMetrics(beats);
  const anchor = nearestToAnchor(beats, spaceStartMs);
  return {
    ...base,
    beatTimesMs: beats,
    beatCount: beats.length,
    ...metrics,
    nearestBeatToSpaceStartMs: anchor.nearest,
    spaceStartDeltaMs: anchor.delta,
  };
}

function synthesizeBeatGrid(offsetSeconds: number, bpm: number, durationSeconds: number) {
  if (!Number.isFinite(offsetSeconds) || !Number.isFinite(bpm) || bpm <= 0) return [];
  const interval = 60 / bpm;
  const beats: number[] = [];
  let time = offsetSeconds;
  while (time > interval) time -= interval;
  while (time < 0) time += interval;
  for (; time <= durationSeconds; time += interval) beats.push(time * 1000);
  return beats;
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

function runAnchorGrid(input: BenchmarkInput, coarseBpm: number): RhythmEngineResult {
  const started = performance.now();
  const anchorMs = input.spaceStartMs;
  if (!Number.isFinite(anchorMs) || (anchorMs ?? 0) <= 0) {
    return normalizeResult({ id: "custom-anchor-grid", engine: "Custom", variant: "anchorGrid", kind: "custom", bpm: null, confidence: null, beatTimesMs: [], processingTimeMs: performance.now() - started, notes: "Requires authored Space Start." }, anchorMs);
  }
  const { flux, frameSeconds } = buildEnergyFlux(input.mono, input.sampleRate);
  let bestBpm = coarseBpm;
  let bestScore = Number.NEGATIVE_INFINITY;
  for (let bpm = Math.max(40, coarseBpm - 2); bpm <= Math.min(220, coarseBpm + 2) + 1e-9; bpm += 0.005) {
    const score = scoreAnchorGrid(flux, frameSeconds, (anchorMs ?? 0) / 1000, bpm, input.buffer.duration);
    if (score > bestScore) { bestScore = score; bestBpm = bpm; }
  }
  const rounded = Number(bestBpm.toFixed(4));
  const beats = synthesizeBeatGrid((anchorMs ?? 0) / 1000, rounded, input.buffer.duration);
  return normalizeResult({ id: "custom-anchor-grid", engine: "Custom", variant: "anchorGrid", kind: "custom", bpm: rounded, confidence: 0.95, beatTimesMs: beats, processingTimeMs: performance.now() - started, notes: "Project-specific anchor-fit; confidence is internal, not comparable to package confidence." }, anchorMs);
}

function vectorToNumbers(essentia: { vectorToArray?: (value: unknown) => Float32Array }, value: unknown): number[] {
  if (!value) return [];
  try {
    const typed = essentia.vectorToArray?.(value);
    if (typed) return finite(typed);
  } catch {}
  if (Array.isArray(value)) return value.filter((item): item is number => typeof item === "number" && Number.isFinite(item));
  const vector = value as { size?: () => number; get?: (index: number) => number };
  if (typeof vector.size === "function" && typeof vector.get === "function") {
    const values: number[] = [];
    for (let index = 0; index < vector.size(); index += 1) {
      const item = vector.get(index);
      if (Number.isFinite(item)) values.push(item);
    }
    return values;
  }
  return [];
}

function loadBrowserScript(id: string, src: string): Promise<void> {
  if (typeof document === "undefined") return Promise.reject(new Error("Browser script loader is unavailable."));
  const existing = document.getElementById(id) as HTMLScriptElement | null;
  if (existing?.dataset.loaded === "true") return Promise.resolve();
  if (existing) {
    return new Promise((resolve, reject) => {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error(`Failed to load ${src}`)), { once: true });
    });
  }
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.id = id;
    script.src = src;
    script.async = true;
    script.crossOrigin = "anonymous";
    script.onload = () => {
      script.dataset.loaded = "true";
      resolve();
    };
    script.onerror = () => reject(new Error(`Failed to load ${src}`));
    document.head.appendChild(script);
  });
}

async function createEssentiaBrowserInstance(): Promise<EssentiaInstance> {
  const browserWindow = window as EssentiaWindow;
  if (!browserWindow.EssentiaWASM) {
    await loadBrowserScript("essentia-wasm-web", ESSENTIA_WASM_SCRIPT);
  }
  if (!browserWindow.Essentia) {
    await loadBrowserScript("essentia-core", ESSENTIA_CORE_SCRIPT);
  }
  if (!browserWindow.EssentiaWASM || !browserWindow.Essentia) {
    throw new Error("Essentia browser globals were not initialized.");
  }
  const wasm = await browserWindow.EssentiaWASM();
  return new browserWindow.Essentia(wasm);
}

async function runEssentia(input: BenchmarkInput): Promise<RhythmEngineResult> {
  const started = performance.now();
  try {
    const essentia = await createEssentiaBrowserInstance();
    const signal = essentia.arrayToVector(input.mono);
    try {
      const raw = essentia.RhythmExtractor2013(signal, 220, "multifeature", 40);
      const ticks = vectorToNumbers(essentia, raw.ticks).map(seconds => seconds * 1000);
      return normalizeResult({ id: "essentia-multifeature", engine: "Essentia.js", variant: "RhythmExtractor2013 multifeature", kind: "package", bpm: Number.isFinite(raw.bpm) ? Number(raw.bpm) : null, confidence: Number.isFinite(raw.confidence) ? Number(raw.confidence) : null, beatTimesMs: ticks, processingTimeMs: performance.now() - started, notes: `Browser WASM ${ESSENTIA_VERSION} · multifeature beat tracker.` }, input.spaceStartMs);
    } finally {
      try { (signal as { delete?: () => void }).delete?.(); } catch {}
      try { essentia.delete?.(); } catch {}
    }
  } catch (error) {
    return normalizeResult({ id: "essentia-multifeature", engine: "Essentia.js", variant: "RhythmExtractor2013 multifeature", kind: "package", bpm: null, confidence: null, beatTimesMs: [], processingTimeMs: performance.now() - started, error: error instanceof Error ? error.message : "Essentia failed" }, input.spaceStartMs);
  }
}

async function runWebAudioBeatDetector(input: BenchmarkInput): Promise<RhythmEngineResult> {
  const started = performance.now();
  try {
    const guessed = await guessWebAudioBeat(input.buffer, { minTempo: 40, maxTempo: 220 });
    const bpm = Number(guessed.bpm);
    const offset = Number(guessed.offset);
    const beats = synthesizeBeatGrid(Number.isFinite(offset) ? offset : 0, bpm, input.buffer.duration);
    return normalizeResult({ id: "web-audio-beat-detector", engine: "web-audio-beat-detector", variant: "guess", kind: "package", bpm: Number.isFinite(bpm) ? bpm : null, confidence: null, beatTimesMs: beats, processingTimeMs: performance.now() - started, notes: `Guessed first-beat offset ${Number.isFinite(offset) ? `${offset.toFixed(3)}s` : "n/a"}; grid is synthesized from package BPM+offset.` }, input.spaceStartMs);
  } catch (error) {
    return normalizeResult({ id: "web-audio-beat-detector", engine: "web-audio-beat-detector", variant: "guess", kind: "package", bpm: null, confidence: null, beatTimesMs: [], processingTimeMs: performance.now() - started, error: error instanceof Error ? error.message : "web-audio-beat-detector failed" }, input.spaceStartMs);
  }
}

export async function runRhythmBenchmark(input: BenchmarkInput): Promise<RhythmEngineResult[]> {
  const baseOptions = { fs: input.sampleRate, minBpm: 40, maxBpm: 220 } as const;
  const tempoStarted = performance.now();
  const tempoResult = tempo(input.mono, { ...baseOptions, candidates: 8 });
  const tempoMs = performance.now() - tempoStarted;
  const tempoBpm = Number(tempoResult.bpm);
  const tempoRow = normalizeResult({ id: "audio-beat-tempo", engine: "@audio/beat", variant: "tempo", kind: "package", bpm: Number.isFinite(tempoBpm) ? tempoBpm : null, confidence: Number.isFinite(Number(tempoResult.confidence)) ? Number(tempoResult.confidence) : null, beatTimesMs: [], processingTimeMs: tempoMs, notes: "Global tempo candidate only; no beat timestamps." }, input.spaceStartMs);

  const combStarted = performance.now();
  const combResult = combTempo(input.mono, baseOptions);
  const combRow = normalizeResult({ id: "audio-beat-comb", engine: "@audio/beat", variant: "combTempo", kind: "package", bpm: Number.isFinite(Number(combResult.bpm)) ? Number(combResult.bpm) : null, confidence: Number.isFinite(Number(combResult.confidence)) ? Number(combResult.confidence) : null, beatTimesMs: [], processingTimeMs: performance.now() - combStarted, notes: "Comb-filter tempo candidate only." }, input.spaceStartMs);

  const trackStarted = performance.now();
  const tracked = beatTrack(input.mono, baseOptions);
  const trackedBeats = finite(tracked.beats).map(seconds => seconds * 1000);
  const trackedRow = normalizeResult({ id: "audio-beat-track", engine: "@audio/beat", variant: "beatTrack", kind: "package", bpm: Number.isFinite(Number(tracked.bpm)) ? Number(tracked.bpm) : null, confidence: Number.isFinite(Number(tracked.confidence)) ? Number(tracked.confidence) : null, beatTimesMs: trackedBeats, processingTimeMs: performance.now() - trackStarted, notes: "Free-running beat tracker." }, input.spaceStartMs);

  const coarseBpm = Number.isFinite(tempoBpm) && tempoBpm > 0 ? tempoBpm : 120;
  const customRow = runAnchorGrid(input, coarseBpm);
  const [essentiaRow, webDetectorRow] = await Promise.all([runEssentia(input), runWebAudioBeatDetector(input)]);
  return [essentiaRow, tempoRow, combRow, trackedRow, webDetectorRow, customRow];
}

export function downmixAudioBuffer(buffer: AudioBuffer): Float32Array {
  const mono = new Float32Array(buffer.length);
  for (let channel = 0; channel < buffer.numberOfChannels; channel += 1) {
    const data = buffer.getChannelData(channel);
    for (let index = 0; index < buffer.length; index += 1) mono[index] += (data[index] ?? 0) / buffer.numberOfChannels;
  }
  return mono;
}

export type ManualScore = {
  maeMs: number | null;
  medianErrorMs: number | null;
  maxErrorMs: number | null;
  signedDriftMsPerMark: number | null;
};

export function scoreManualMarks(result: RhythmEngineResult, marksMs: number[]): ManualScore {
  if (!result.beatTimesMs.length || !marksMs.length) return { maeMs: null, medianErrorMs: null, maxErrorMs: null, signedDriftMsPerMark: null };
  const signed = marksMs.map(mark => {
    let nearest = result.beatTimesMs[0] ?? 0;
    for (const beat of result.beatTimesMs) if (Math.abs(beat - mark) < Math.abs(nearest - mark)) nearest = beat;
    return nearest - mark;
  });
  const absolute = signed.map(Math.abs);
  const maeMs = absolute.reduce((sum, value) => sum + value, 0) / absolute.length;
  const med = median(absolute);
  const max = Math.max(...absolute);
  let drift: number | null = null;
  if (signed.length >= 2) {
    const n = signed.length;
    const meanX = (n - 1) / 2;
    const meanY = signed.reduce((sum, value) => sum + value, 0) / n;
    let numerator = 0;
    let denominator = 0;
    for (let index = 0; index < n; index += 1) {
      numerator += (index - meanX) * ((signed[index] ?? 0) - meanY);
      denominator += (index - meanX) ** 2;
    }
    drift = denominator > 0 ? numerator / denominator : null;
  }
  return { maeMs, medianErrorMs: med, maxErrorMs: max, signedDriftMsPerMark: drift };
}
