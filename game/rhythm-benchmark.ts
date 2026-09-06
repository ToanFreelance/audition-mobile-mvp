import { beatTrack, combTempo, tempo } from "@audio/beat";
import { guess as guessWebAudioBeat } from "web-audio-beat-detector";

type BeatTrackOptions = Parameters<typeof beatTrack>[1];

export type RhythmEngineKind = "package" | "custom";

export type RhythmEngineResult = {
  id: string;
  engine: string;
  variant: string;
  kind: RhythmEngineKind;
  bpm: number | null;
  /** Normalized to 0..1 only for display. Values are still not comparable across engines. */
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
const ESSENTIA_SAMPLE_RATE = 44_100;
// Essentia documents RhythmExtractor2013 multifeature confidence on a 0..5.32 scale.
const ESSENTIA_CONFIDENCE_MAX = 5.32;
const ESSENTIA_WASM_SCRIPT = `https://cdn.jsdelivr.net/npm/essentia.js@${ESSENTIA_VERSION}/dist/essentia-wasm.web.js`;
const ESSENTIA_CORE_SCRIPT = `https://cdn.jsdelivr.net/npm/essentia.js@${ESSENTIA_VERSION}/dist/essentia.js-core.js`;

const finite = (values: ArrayLike<number> | undefined): number[] => {
  if (!values) return [];
  return Array.from(values).filter(Number.isFinite);
};

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

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
  return normalizeResult({ id: "custom-anchor-grid", engine: "Custom", variant: "anchorGrid", kind: "custom", bpm: rounded, confidence: 0.95, beatTimesMs: beats, processingTimeMs: performance.now() - started, notes: "Project-specific anchor-fit; confidence is internal and not comparable to package confidence." }, anchorMs);
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

function resampleLinear(input: Float32Array, fromSampleRate: number, toSampleRate: number): Float32Array {
  if (!input.length || fromSampleRate <= 0 || toSampleRate <= 0 || fromSampleRate === toSampleRate) return input;
  const outputLength = Math.max(1, Math.round(input.length * toSampleRate / fromSampleRate));
  const output = new Float32Array(outputLength);
  const ratio = fromSampleRate / toSampleRate;
  for (let index = 0; index < outputLength; index += 1) {
    const source = index * ratio;
    const left = Math.floor(source);
    const right = Math.min(input.length - 1, left + 1);
    const fraction = source - left;
    output[index] = (input[left] ?? 0) * (1 - fraction) + (input[right] ?? 0) * fraction;
  }
  return output;
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
    script.onload = () => { script.dataset.loaded = "true"; resolve(); };
    script.onerror = () => reject(new Error(`Failed to load ${src}`));
    document.head.appendChild(script);
  });
}

async function createEssentiaBrowserInstance(): Promise<EssentiaInstance> {
  const browserWindow = window as EssentiaWindow;
  if (!browserWindow.EssentiaWASM) await loadBrowserScript("essentia-wasm-web", ESSENTIA_WASM_SCRIPT);
  if (!browserWindow.Essentia) await loadBrowserScript("essentia-core", ESSENTIA_CORE_SCRIPT);
  if (!browserWindow.EssentiaWASM || !browserWindow.Essentia) throw new Error("Essentia browser globals were not initialized.");
  const wasm = await browserWindow.EssentiaWASM();
  return new browserWindow.Essentia(wasm);
}

async function runEssentiaVariants(input: BenchmarkInput): Promise<RhythmEngineResult[]> {
  const overallStarted = performance.now();
  try {
    const essentia = await createEssentiaBrowserInstance();
    const essentiaMono = resampleLinear(input.mono, input.sampleRate, ESSENTIA_SAMPLE_RATE);
    const signal = essentia.arrayToVector(essentiaMono);
    try {
      const runVariant = (method: "multifeature" | "degara") => {
        const started = performance.now();
        const raw = essentia.RhythmExtractor2013(signal, 220, method, 40);
        const ticks = vectorToNumbers(essentia, raw.ticks).map(seconds => seconds * 1000);
        const rawConfidence = Number(raw.confidence);
        const normalizedConfidence = method === "multifeature" && Number.isFinite(rawConfidence)
          ? clamp(rawConfidence / ESSENTIA_CONFIDENCE_MAX, 0, 1)
          : null;
        return normalizeResult({
          id: `essentia-${method}`,
          engine: "Essentia.js",
          variant: `RhythmExtractor2013 ${method}`,
          kind: "package",
          bpm: Number.isFinite(Number(raw.bpm)) ? Number(raw.bpm) : null,
          confidence: normalizedConfidence,
          beatTimesMs: ticks,
          processingTimeMs: performance.now() - started,
          notes: method === "multifeature"
            ? `Essentia raw confidence ${Number.isFinite(rawConfidence) ? rawConfidence.toFixed(3) : "n/a"}/5.32 · input ${input.sampleRate}Hz${input.sampleRate === ESSENTIA_SAMPLE_RATE ? "" : ` resampled to ${ESSENTIA_SAMPLE_RATE}Hz`}.`
            : `Degara variant · confidence intentionally N/A · input ${input.sampleRate}Hz${input.sampleRate === ESSENTIA_SAMPLE_RATE ? "" : ` resampled to ${ESSENTIA_SAMPLE_RATE}Hz`}.`,
        }, input.spaceStartMs);
      };
      return [runVariant("multifeature"), runVariant("degara")];
    } finally {
      try { (signal as { delete?: () => void }).delete?.(); } catch {}
      try { essentia.delete?.(); } catch {}
    }
  } catch (error) {
    const elapsed = performance.now() - overallStarted;
    const message = error instanceof Error ? error.message : "Essentia failed";
    return [
      normalizeResult({ id: "essentia-multifeature", engine: "Essentia.js", variant: "RhythmExtractor2013 multifeature", kind: "package", bpm: null, confidence: null, beatTimesMs: [], processingTimeMs: elapsed, error: message }, input.spaceStartMs),
      normalizeResult({ id: "essentia-degara", engine: "Essentia.js", variant: "RhythmExtractor2013 degara", kind: "package", bpm: null, confidence: null, beatTimesMs: [], processingTimeMs: elapsed, error: message }, input.spaceStartMs),
    ];
  }
}

async function runWebAudioBeatDetectorVariant(
  input: BenchmarkInput,
  id: string,
  variant: string,
  tempoSettings?: { minTempo: number; maxTempo: number },
): Promise<RhythmEngineResult> {
  const started = performance.now();
  try {
    const guessed = tempoSettings
      ? await guessWebAudioBeat(input.buffer, tempoSettings)
      : await guessWebAudioBeat(input.buffer);
    const bpm = Number(guessed.bpm);
    const tempo = Number((guessed as { tempo?: number }).tempo);
    const offset = Number(guessed.offset);
    const beats = synthesizeBeatGrid(Number.isFinite(offset) ? offset : 0, bpm, input.buffer.duration);
    return normalizeResult({
      id,
      engine: "web-audio-beat-detector",
      variant,
      kind: "package",
      bpm: Number.isFinite(bpm) ? bpm : null,
      confidence: null,
      beatTimesMs: beats,
      processingTimeMs: performance.now() - started,
      notes: `Rounded bpm=${Number.isFinite(bpm) ? bpm : "n/a"}; raw tempo=${Number.isFinite(tempo) ? tempo.toFixed(4) : "n/a"}; first-beat offset=${Number.isFinite(offset) ? `${offset.toFixed(3)}s` : "n/a"}.`,
    }, input.spaceStartMs);
  } catch (error) {
    return normalizeResult({ id, engine: "web-audio-beat-detector", variant, kind: "package", bpm: null, confidence: null, beatTimesMs: [], processingTimeMs: performance.now() - started, error: error instanceof Error ? error.message : "web-audio-beat-detector failed" }, input.spaceStartMs);
  }
}

export async function runRhythmBenchmark(input: BenchmarkInput): Promise<RhythmEngineResult[]> {
  const baseOptions = { fs: input.sampleRate, minBpm: 40, maxBpm: 220 } as const;

  const tempoStarted = performance.now();
  const tempoResult = tempo(input.mono, { ...baseOptions, candidates: 8 });
  const tempoMs = performance.now() - tempoStarted;
  const tempoBpm = Number(tempoResult.bpm);
  const tempoRow = normalizeResult({ id: "audio-beat-tempo", engine: "@audio/beat", variant: "tempo", kind: "package", bpm: Number.isFinite(tempoBpm) ? tempoBpm : null, confidence: Number.isFinite(Number(tempoResult.confidence)) ? clamp(Number(tempoResult.confidence), 0, 1) : null, beatTimesMs: [], processingTimeMs: tempoMs, notes: "Global tempo candidate only; no beat timestamps." }, input.spaceStartMs);

  const combStarted = performance.now();
  const combResult = combTempo(input.mono, baseOptions);
  const combRow = normalizeResult({ id: "audio-beat-comb", engine: "@audio/beat", variant: "combTempo", kind: "package", bpm: Number.isFinite(Number(combResult.bpm)) ? Number(combResult.bpm) : null, confidence: Number.isFinite(Number(combResult.confidence)) ? clamp(Number(combResult.confidence), 0, 1) : null, beatTimesMs: [], processingTimeMs: performance.now() - combStarted, notes: "Comb-filter tempo candidate only." }, input.spaceStartMs);

  const freeTrackStarted = performance.now();
  const freeTracked = beatTrack(input.mono, baseOptions);
  const freeTrackedBeats = finite(freeTracked.beats).map(seconds => seconds * 1000);
  const freeTrackedRow = normalizeResult({ id: "audio-beat-track-free", engine: "@audio/beat", variant: "beatTrack free", kind: "package", bpm: Number.isFinite(Number(freeTracked.bpm)) ? Number(freeTracked.bpm) : null, confidence: Number.isFinite(Number(freeTracked.confidence)) ? clamp(Number(freeTracked.confidence), 0, 1) : null, beatTimesMs: freeTrackedBeats, processingTimeMs: performance.now() - freeTrackStarted, notes: "Free-running beat tracker." }, input.spaceStartMs);

  const seededTrackStarted = performance.now();
  const seededOptions: BeatTrackOptions = {
    ...baseOptions,
    bpm: Number.isFinite(tempoBpm) && tempoBpm > 0 ? tempoBpm : undefined,
    tightness: 5000,
  };
  const seededTracked = beatTrack(input.mono, seededOptions);
  const seededTrackedBeats = finite(seededTracked.beats).map(seconds => seconds * 1000);
  const seededTrackedRow = normalizeResult({ id: "audio-beat-track-seeded", engine: "@audio/beat", variant: "beatTrack seeded by tempo", kind: "package", bpm: Number.isFinite(Number(seededTracked.bpm)) ? Number(seededTracked.bpm) : null, confidence: Number.isFinite(Number(seededTracked.confidence)) ? clamp(Number(seededTracked.confidence), 0, 1) : null, beatTimesMs: seededTrackedBeats, processingTimeMs: performance.now() - seededTrackStarted, notes: `Seed=${Number.isFinite(tempoBpm) ? tempoBpm.toFixed(4) : "n/a"} BPM · tightness=5000.` }, input.spaceStartMs);

  const coarseBpm = Number.isFinite(tempoBpm) && tempoBpm > 0 ? tempoBpm : 120;
  const customRow = runAnchorGrid(input, coarseBpm);

  const [essentiaRows, webDefaultRow, webBroadRow] = await Promise.all([
    runEssentiaVariants(input),
    runWebAudioBeatDetectorVariant(input, "web-audio-beat-detector-default", "guess default 90–180"),
    runWebAudioBeatDetectorVariant(input, "web-audio-beat-detector-broad", "guess broad 40–220", { minTempo: 40, maxTempo: 220 }),
  ]);

  return [
    ...essentiaRows,
    tempoRow,
    combRow,
    freeTrackedRow,
    seededTrackedRow,
    webDefaultRow,
    webBroadRow,
    customRow,
  ];
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
  /** Best matching beat modulo 4, expressed as 1..4. */
  spacePhase: number | null;
};

function scoreMarksAgainstGrid(gridMs: number[], marksMs: number[]) {
  if (!gridMs.length || !marksMs.length) return null;
  const signed = marksMs.map(mark => {
    let nearest = gridMs[0] ?? 0;
    for (const beat of gridMs) if (Math.abs(beat - mark) < Math.abs(nearest - mark)) nearest = beat;
    return nearest - mark;
  });
  const absolute = signed.map(Math.abs);
  const maeMs = absolute.reduce((sum, value) => sum + value, 0) / absolute.length;
  const medianErrorMs = median(absolute);
  const maxErrorMs = Math.max(...absolute);
  let signedDriftMsPerMark: number | null = null;
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
    signedDriftMsPerMark = denominator > 0 ? numerator / denominator : null;
  }
  return { maeMs, medianErrorMs, maxErrorMs, signedDriftMsPerMark };
}

export function scoreManualMarks(result: RhythmEngineResult, marksMs: number[]): ManualScore {
  if (!result.beatTimesMs.length || !marksMs.length) {
    return { maeMs: null, medianErrorMs: null, maxErrorMs: null, signedDriftMsPerMark: null, spacePhase: null };
  }

  // Audition SPACE occurs once every four beats. Score each modulo-4 phase and
  // keep the phase that best matches the user's manual SPACE marks. Scoring
  // against every beat would make a wrong phase look artificially accurate.
  const phaseCandidates = result.beatTimesMs.length >= 4
    ? [0, 1, 2, 3].map(phase => ({ phase, grid: result.beatTimesMs.filter((_, index) => index % 4 === phase) }))
    : [{ phase: 0, grid: result.beatTimesMs }];

  let best: (ReturnType<typeof scoreMarksAgainstGrid> & { phase: number }) | null = null;
  for (const candidate of phaseCandidates) {
    const score = scoreMarksAgainstGrid(candidate.grid, marksMs);
    if (!score) continue;
    if (!best || score.maeMs < best.maeMs) best = { ...score, phase: candidate.phase };
  }

  if (!best) return { maeMs: null, medianErrorMs: null, maxErrorMs: null, signedDriftMsPerMark: null, spacePhase: null };
  return { ...best, spacePhase: best.phase + 1 };
}

export type ManualMarkSummary = {
  markCount: number;
  medianSpaceIntervalMs: number | null;
  derivedBpm: number | null;
  intervalJitterMs: number | null;
};

export function summarizeManualMarks(marksMs: number[]): ManualMarkSummary {
  if (marksMs.length < 2) return { markCount: marksMs.length, medianSpaceIntervalMs: null, derivedBpm: null, intervalJitterMs: null };
  const intervals = marksMs
    .slice(1)
    .map((value, index) => value - marksMs[index])
    .filter(value => Number.isFinite(value) && value > 800 && value < 8000);
  const center = median(intervals);
  if (!center) return { markCount: marksMs.length, medianSpaceIntervalMs: null, derivedBpm: null, intervalJitterMs: null };
  const trimmed = intervals.filter(value => Math.abs(value - center) / center <= 0.25);
  const stable = trimmed.length >= 2 ? trimmed : intervals;
  const robustCenter = median(stable);
  if (!robustCenter) return { markCount: marksMs.length, medianSpaceIntervalMs: null, derivedBpm: null, intervalJitterMs: null };
  return {
    markCount: marksMs.length,
    medianSpaceIntervalMs: robustCenter,
    // Consecutive Audition SPACE marks are four beats apart.
    derivedBpm: 240000 / robustCenter,
    intervalJitterMs: standardDeviation(stable),
  };
}
