import { clamp, finiteNumbers, normalizeResult } from "./metrics";
import type { BenchmarkInput, BenchmarkProgress, RhythmEngineResult } from "./types";

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
  RhythmExtractor2013: (signal: unknown, maxTempo?: number, method?: string, minTempo?: number) => EssentiaRawRhythm;
  delete?: () => void;
};

type EssentiaWindow = Window & {
  Essentia?: new (wasm: unknown) => EssentiaInstance;
  EssentiaWASM?: () => Promise<unknown>;
};

const VERSION = "0.1.3";
const TARGET_SAMPLE_RATE = 44_100;
const CONFIDENCE_MAX = 5.32;
const WASM_SCRIPT = `https://cdn.jsdelivr.net/npm/essentia.js@${VERSION}/dist/essentia-wasm.web.js`;
const CORE_SCRIPT = `https://cdn.jsdelivr.net/npm/essentia.js@${VERSION}/dist/essentia.js-core.js`;
const yieldToBrowser = () => new Promise<void>(resolve => setTimeout(resolve, 0));

function vectorToNumbers(essentia: Pick<EssentiaInstance, "vectorToArray">, value: unknown): number[] {
  if (!value) return [];
  try {
    const typed = essentia.vectorToArray?.(value);
    if (typed) return finiteNumbers(typed);
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

async function createInstance(): Promise<EssentiaInstance> {
  const browserWindow = window as EssentiaWindow;
  if (!browserWindow.EssentiaWASM) await loadBrowserScript("essentia-wasm-web", WASM_SCRIPT);
  if (!browserWindow.Essentia) await loadBrowserScript("essentia-core", CORE_SCRIPT);
  if (!browserWindow.EssentiaWASM || !browserWindow.Essentia) throw new Error("Essentia browser globals were not initialized.");
  const wasm = await browserWindow.EssentiaWASM();
  return new browserWindow.Essentia(wasm);
}

function failed(input: BenchmarkInput, method: "multifeature" | "degara", started: number, error: unknown): RhythmEngineResult {
  return normalizeResult({
    id: `essentia-${method}`,
    engine: "Essentia.js",
    variant: `RhythmExtractor2013 ${method}`,
    version: VERSION,
    kind: "package",
    beatGridKind: "none",
    bpm: null,
    confidence: null,
    beatTimesMs: [],
    processingTimeMs: performance.now() - started,
    error: error instanceof Error ? error.message : "Essentia failed",
  }, input);
}

export async function runEssentiaVariants(input: BenchmarkInput, progress?: BenchmarkProgress): Promise<RhythmEngineResult[]> {
  const initStarted = performance.now();
  let essentia: EssentiaInstance;
  try {
    progress?.("Preparing Essentia.js WASM…");
    await yieldToBrowser();
    essentia = await createInstance();
  } catch (error) {
    return [failed(input, "multifeature", initStarted, error), failed(input, "degara", initStarted, error)];
  }

  const mono = resampleLinear(input.mono, input.sampleRate, TARGET_SAMPLE_RATE);
  const signal = essentia.arrayToVector(mono);
  const rows: RhythmEngineResult[] = [];
  try {
    for (const method of ["multifeature", "degara"] as const) {
      progress?.(`Running Essentia.js · ${method}…`);
      await yieldToBrowser();
      const started = performance.now();
      try {
        const raw = essentia.RhythmExtractor2013(signal, 220, method, 40);
        const ticks = vectorToNumbers(essentia, raw.ticks).map(seconds => seconds * 1000);
        const estimates = vectorToNumbers(essentia, raw.estimates);
        const bpmIntervals = vectorToNumbers(essentia, raw.bpmIntervals);
        const confidenceRaw = Number(raw.confidence);
        rows.push(normalizeResult({
          id: `essentia-${method}`,
          engine: "Essentia.js",
          variant: `RhythmExtractor2013 ${method}`,
          version: VERSION,
          kind: "package",
          beatGridKind: "detected",
          bpm: Number.isFinite(Number(raw.bpm)) ? Number(raw.bpm) : null,
          confidence: method === "multifeature" && Number.isFinite(confidenceRaw) ? clamp(confidenceRaw / CONFIDENCE_MAX, 0, 1) : null,
          confidenceRaw: Number.isFinite(confidenceRaw) ? confidenceRaw : null,
          confidenceScale: method === "multifeature" ? "Essentia multifeature 0..5.32" : "not defined for degara",
          beatTimesMs: ticks,
          processingTimeMs: performance.now() - started,
          notes: `${method} · input ${input.sampleRate}Hz${input.sampleRate === TARGET_SAMPLE_RATE ? "" : ` resampled to ${TARGET_SAMPLE_RATE}Hz`}.`,
          raw: { bpm: raw.bpm, confidence: raw.confidence, estimates, bpmIntervals },
        }, input));
      } catch (error) { rows.push(failed(input, method, started, error)); }
    }
  } finally {
    try { (signal as { delete?: () => void }).delete?.(); } catch {}
    try { essentia.delete?.(); } catch {}
  }
  return rows;
}
