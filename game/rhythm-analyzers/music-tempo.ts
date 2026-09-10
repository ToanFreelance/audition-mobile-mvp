import { beatMetrics, clamp, finiteNumbers, median, normalizeResult, synthesizeBeatGrid } from "./metrics";
import type { BenchmarkInput, BenchmarkProgress, RhythmEngineResult } from "./types";

const VERSION = "1.0.3";
const TARGET_SAMPLE_RATE = 44_100;
const yieldToBrowser = () => new Promise<void>(resolve => setTimeout(resolve, 0));

type IndexedBeat = { index: number; timeMs: number };
type LineFit = { interceptMs: number; intervalMs: number };
type RobustMetricalFit = {
  parity: 0 | 1;
  bpm: number;
  intervalMs: number;
  phaseMs: number;
  startMs: number;
  endMs: number;
  spanMs: number;
  beatCount: number;
  indexedBeatCount: number;
  inlierCount: number;
  inlierRatio: number;
  maeMs: number;
  rmseMs: number;
  p90Ms: number;
  medianAbsResidualMs: number;
  clippingThresholdMs: number;
  qualityScore: number;
};

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

function failed(input: BenchmarkInput, started: number, error: unknown): RhythmEngineResult[] {
  return [normalizeResult({
    id: "music-tempo-beatroot",
    engine: "music-tempo",
    variant: "Beatroot raw",
    version: VERSION,
    kind: "package",
    beatGridKind: "none",
    bpm: null,
    confidence: null,
    beatTimesMs: [],
    processingTimeMs: performance.now() - started,
    error: error instanceof Error ? error.message : String(error || "music-tempo failed"),
    notes: "music-tempo failed independently; the other benchmark engines remain usable.",
  }, input)];
}

function parityGrid(beatsMs: number[], parity: 0 | 1) {
  return beatsMs.filter((_, index) => index % 2 === parity);
}

function longSpanBpm(beatsMs: number[]) {
  if (beatsMs.length < 2) return null;
  const first = beatsMs[0] ?? 0;
  const last = beatsMs[beatsMs.length - 1] ?? first;
  const interval = (last - first) / (beatsMs.length - 1);
  return interval > 0 ? 60000 / interval : null;
}

function percentile(values: number[], q: number) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = clamp(Math.round((sorted.length - 1) * q), 0, sorted.length - 1);
  return sorted[index] ?? 0;
}

function linearFit(points: IndexedBeat[]): LineFit | null {
  if (points.length < 2) return null;
  const meanIndex = points.reduce((sum, point) => sum + point.index, 0) / points.length;
  const meanTime = points.reduce((sum, point) => sum + point.timeMs, 0) / points.length;
  let numerator = 0;
  let denominator = 0;
  for (const point of points) {
    const dx = point.index - meanIndex;
    numerator += dx * (point.timeMs - meanTime);
    denominator += dx * dx;
  }
  if (denominator <= 0) return null;
  const intervalMs = numerator / denominator;
  if (!Number.isFinite(intervalMs) || intervalMs <= 0) return null;
  return { intervalMs, interceptMs: meanTime - intervalMs * meanIndex };
}

function indexDetectedBeats(beatsMs: number[], intervalHintMs: number): IndexedBeat[] {
  if (beatsMs.length < 2 || !Number.isFinite(intervalHintMs) || intervalHintMs <= 0) return [];
  const origin = beatsMs[0] ?? 0;
  const byIndex = new Map<number, number>();
  for (const timeMs of beatsMs) {
    const index = Math.round((timeMs - origin) / intervalHintMs);
    if (index < 0) continue;
    const previous = byIndex.get(index);
    if (previous == null) {
      byIndex.set(index, timeMs);
      continue;
    }
    const expected = origin + index * intervalHintMs;
    if (Math.abs(timeMs - expected) < Math.abs(previous - expected)) byIndex.set(index, timeMs);
  }
  return [...byIndex.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([index, timeMs]) => ({ index, timeMs }));
}

function robustFitForStart(beatsMs: number[], parity: 0 | 1, startMs: number): RobustMetricalFit | null {
  const selected = beatsMs.filter(timeMs => timeMs >= startMs);
  if (selected.length < 48) return null;
  const initialMetrics = beatMetrics(selected);
  const intervalHintMs = initialMetrics.medianBeatIntervalMs;
  if (!intervalHintMs || intervalHintMs <= 0) return null;

  let indexed = indexDetectedBeats(selected, intervalHintMs);
  if (indexed.length < 48) return null;
  let fit = linearFit(indexed);
  if (!fit) return null;
  let thresholdMs = 45;

  for (let iteration = 0; iteration < 4; iteration += 1) {
    const residuals = indexed.map(point => point.timeMs - (fit!.interceptMs + point.index * fit!.intervalMs));
    const residualCenter = median(residuals) ?? 0;
    const absDeviations = residuals.map(value => Math.abs(value - residualCenter));
    const mad = median(absDeviations) ?? 0;
    const robustSigma = mad * 1.4826;
    thresholdMs = clamp(Math.max(18, robustSigma * 3.5), 18, 65);
    const next = indexed.filter((_, index) => Math.abs((residuals[index] ?? 0) - residualCenter) <= thresholdMs);
    if (next.length < 36 || next.length === indexed.length) break;
    indexed = next;
    fit = linearFit(indexed);
    if (!fit) return null;
  }

  const allIndexed = indexDetectedBeats(selected, intervalHintMs);
  const residuals = indexed.map(point => point.timeMs - (fit!.interceptMs + point.index * fit!.intervalMs));
  const absResiduals = residuals.map(Math.abs);
  const maeMs = absResiduals.reduce((sum, value) => sum + value, 0) / Math.max(1, absResiduals.length);
  const rmseMs = Math.sqrt(residuals.reduce((sum, value) => sum + value * value, 0) / Math.max(1, residuals.length));
  const firstTime = indexed[0]?.timeMs ?? selected[0] ?? startMs;
  const lastTime = indexed[indexed.length - 1]?.timeMs ?? selected[selected.length - 1] ?? firstTime;
  const spanMs = Math.max(0, lastTime - firstTime);
  const inlierRatio = indexed.length / Math.max(1, allIndexed.length);
  const bpm = 60000 / fit.intervalMs;
  const phaseMs = ((fit.interceptMs % fit.intervalMs) + fit.intervalMs) % fit.intervalMs;
  const spanQuality = clamp(spanMs / 150_000, 0, 1);
  const residualQuality = 1 / (1 + rmseMs / 18);
  const trimPenalty = 1 - clamp(startMs / Math.max(lastTime, 1), 0, 0.35) * 0.30;
  const qualityScore = inlierRatio * 0.45 + residualQuality * 0.35 + spanQuality * 0.20;

  return {
    parity,
    bpm,
    intervalMs: fit.intervalMs,
    phaseMs,
    startMs,
    endMs: lastTime,
    spanMs,
    beatCount: selected.length,
    indexedBeatCount: allIndexed.length,
    inlierCount: indexed.length,
    inlierRatio,
    maeMs,
    rmseMs,
    p90Ms: percentile(absResiduals, 0.9),
    medianAbsResidualMs: median(absResiduals) ?? 0,
    clippingThresholdMs: thresholdMs,
    qualityScore: qualityScore * trimPenalty,
  };
}

function bestRobustMetricalFit(beatsMs: number[], parity: 0 | 1): RobustMetricalFit | null {
  if (beatsMs.length < 48) return null;
  const last = beatsMs[beatsMs.length - 1] ?? 0;
  const candidateStarts = [0, 10_000, 20_000, 30_000, 45_000, 60_000]
    .filter(startMs => last - startMs >= 120_000);
  const fits = candidateStarts
    .map(startMs => robustFitForStart(beatsMs, parity, startMs))
    .filter((fit): fit is RobustMetricalFit => fit != null);
  if (!fits.length) return robustFitForStart(beatsMs, parity, 0);
  return fits.sort((a, b) => b.qualityScore - a.qualityScore || a.startMs - b.startMs)[0] ?? null;
}

function robustFitRow(input: BenchmarkInput, parityRows: RhythmEngineResult[]): RhythmEngineResult | null {
  const candidates = parityRows
    .map((row, index) => bestRobustMetricalFit(row.beatTimesMs, index === 0 ? 0 : 1))
    .filter((fit): fit is RobustMetricalFit => fit != null)
    .sort((a, b) => b.qualityScore - a.qualityScore || a.rmseMs - b.rmseMs);
  const best = candidates[0];
  if (!best) return null;

  const bpm = Number(best.bpm.toFixed(6));
  const fitGrid = synthesizeBeatGrid(best.phaseMs / 1000, bpm, input.buffer.duration);
  const confidence = clamp(
    best.inlierRatio * 0.50 +
    clamp(1 - best.rmseMs / 40, 0, 1) * 0.35 +
    clamp(best.spanMs / 180_000, 0, 1) * 0.15,
    0,
    1,
  );
  const parityLabel = best.parity === 0 ? "A" : "B";

  return normalizeResult({
    id: "music-tempo-beatroot-robust-fit",
    engine: "music-tempo FIT",
    variant: `robust metrical regression · parity ${parityLabel} · auto-trim ${Math.round(best.startMs / 1000)}s`,
    version: `${VERSION}+internal-fit-v1`,
    kind: "custom",
    beatGridKind: "validated",
    bpm,
    confidence,
    confidenceRaw: confidence,
    confidenceScale: "Internal robust regression quality over detected Beatroot metrical ticks; not package confidence.",
    beatTimesMs: fitGrid,
    processingTimeMs: 0,
    notes: `Robust long-baseline fit over actual Beatroot parity-${parityLabel} metrical ticks. Auto-trim selected ${Math.round(best.startMs / 1000)}s to reduce intro noise; detected times are re-indexed against the median pulse so isolated missing/extra ticks do not permanently shift beat indices, then iteratively MAD-clipped before linear regression. Fitted interval=${best.intervalMs.toFixed(6)}ms => BPM=${best.bpm.toFixed(6)}. Residual MAE=${best.maeMs.toFixed(2)}ms, RMSE=${best.rmseMs.toFixed(2)}ms, p90=${best.p90Ms.toFixed(2)}ms; inliers=${best.inlierCount}/${best.indexedBeatCount} (${(best.inlierRatio * 100).toFixed(1)}%); fitted span=${(best.spanMs / 1000).toFixed(1)}s. This fit does NOT use authored Space Start and is CUSTOM/diagnostic, so it is excluded from package consensus.`,
    raw: {
      ...best,
      candidateFits: candidates,
      source: "music-tempo Beatroot detected metrical ticks",
      usesSpaceStart: false,
    },
  }, input);
}

/**
 * Runs Beatroot exactly once, then exposes the raw detected subdivision plus
 * two ×0.5 metrical variants made from alternate detected ticks. The metrical
 * rows are NOT synthesized: parity A uses ticks 0,2,4… and parity B uses
 * ticks 1,3,5… from the same Beatroot result.
 */
export async function runMusicTempoVariants(input: BenchmarkInput, progress?: BenchmarkProgress): Promise<RhythmEngineResult[]> {
  const started = performance.now();
  try {
    progress?.("music-tempo · preparing 44.1 kHz PCM to match the official demo…");
    await yieldToBrowser();
    const audioData = resampleLinear(input.mono, input.sampleRate, TARGET_SAMPLE_RATE);
    await yieldToBrowser();

    progress?.("music-tempo · running Beatroot tempo induction + beat tracking…");
    const module = await import("music-tempo");
    const MusicTempo = module.default;
    const result = new MusicTempo(audioData);

    const rawBpm = Number(result.tempo);
    if (!Number.isFinite(rawBpm) || rawBpm <= 0) throw new Error(`Invalid tempo returned: ${String(result.tempo)}`);

    const beatTimesMs = finiteNumbers(result.beats).map(value => value * 1000);
    const onsetTimesMs = finiteNumbers(result.events).map(value => value * 1000);
    const rawAgentScore = result.bestAgent?.score;
    const analysisMs = performance.now() - started;
    const sharedRaw = {
      tempo: result.tempo,
      beatInterval: result.beatInterval,
      beatCount: beatTimesMs.length,
      onsetCount: onsetTimesMs.length,
      tempoList: finiteNumbers(result.tempoList),
      bestAgentScore: rawAgentScore ?? null,
      bestAgentBeatInterval: result.bestAgent?.beatInterval ?? null,
      inputSampleRate: input.sampleRate,
      analysisSampleRate: TARGET_SAMPLE_RATE,
    };

    const raw = normalizeResult({
      id: "music-tempo-beatroot",
      engine: "music-tempo",
      variant: "Beatroot raw",
      version: VERSION,
      kind: "package",
      beatGridKind: beatTimesMs.length ? "detected" : "none",
      bpm: rawBpm,
      confidence: null,
      confidenceRaw: typeof rawAgentScore === "number" && Number.isFinite(rawAgentScore) ? rawAgentScore : null,
      confidenceScale: "Package exposes a raw Beatroot agent score, not a normalized confidence value.",
      beatTimesMs,
      onsetTimesMs,
      processingTimeMs: analysisMs,
      notes: `Official-demo style Beatroot run: mono PCM ${input.sampleRate}Hz${input.sampleRate === TARGET_SAMPLE_RATE ? "" : ` resampled to ${TARGET_SAMPLE_RATE}Hz`}. beats[] is the actual detected tick list, not a synthesized grid. The raw row may represent a subdivision such as double-time.`,
      raw: sharedRaw,
    }, input);

    const nominalMetricalBpm = rawBpm / 2;
    const metricalRows = ([0, 1] as const).map(parity => {
      const detected = parityGrid(beatTimesMs, parity);
      const detectedMetrics = beatMetrics(detected);
      const detectedMetricalBpm = detectedMetrics.derivedBpmFromIntervals ?? nominalMetricalBpm;
      const spanBpm = longSpanBpm(detected);
      return normalizeResult({
        id: `music-tempo-beatroot-half-${parity === 0 ? "a" : "b"}`,
        engine: "music-tempo",
        variant: `Beatroot metrical ×0.5 · parity ${parity === 0 ? "A" : "B"}`,
        version: VERSION,
        kind: "package",
        beatGridKind: detected.length ? "detected" : "none",
        bpm: detectedMetricalBpm,
        confidence: null,
        confidenceRaw: typeof rawAgentScore === "number" && Number.isFinite(rawAgentScore) ? rawAgentScore : null,
        confidenceScale: "Same Beatroot run as RAW; this row is a metrical interpretation, not an independent confidence vote.",
        beatTimesMs: detected,
        onsetTimesMs,
        processingTimeMs: 0,
        notes: `Detected metrical ×0.5 variant derived directly from Beatroot ticks ${parity === 0 ? "0,2,4,6…" : "1,3,5,7…"}. No second Beatroot pass and no synthesized timestamps. Raw package tempo ${rawBpm.toFixed(3)} BPM → nominal half-level ${nominalMetricalBpm.toFixed(3)} BPM, but this row reports the detected-grid median interval BPM ${detectedMetricalBpm.toFixed(4)}. Long-span endpoint BPM=${spanBpm?.toFixed(4) ?? "n/a"}; compare it with the median-derived BPM to expose cumulative missing/extra-tick bias.`,
        raw: {
          parentId: "music-tempo-beatroot",
          parity,
          rawTempo: rawBpm,
          nominalMetricalBpm,
          detectedMedianBpm: detectedMetricalBpm,
          longSpanBpm: spanBpm,
          parentBeatCount: beatTimesMs.length,
          metricalBeatCount: detected.length,
          bestAgentScore: rawAgentScore ?? null,
        },
      }, input);
    });

    progress?.("music-tempo FIT · robust long-baseline regression over metrical ticks…");
    await yieldToBrowser();
    const fitted = robustFitRow(input, metricalRows);

    return fitted ? [raw, ...metricalRows, fitted] : [raw, ...metricalRows];
  } catch (error) {
    return failed(input, started, error);
  }
}

/** Backwards-compatible single-row helper. */
export async function runMusicTempo(input: BenchmarkInput, progress?: BenchmarkProgress): Promise<RhythmEngineResult> {
  return (await runMusicTempoVariants(input, progress))[0] as RhythmEngineResult;
}
