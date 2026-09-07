import { beatMetrics, finiteNumbers, normalizeResult } from "./metrics";
import type { BenchmarkInput, BenchmarkProgress, RhythmEngineResult } from "./types";

const VERSION = "1.0.3";
const TARGET_SAMPLE_RATE = 44_100;
const yieldToBrowser = () => new Promise<void>(resolve => setTimeout(resolve, 0));

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
      // For a detected metrical row, the primary BPM should describe the actual
      // detected grid, not simply rawTempo/2. This distinction matters when the
      // Beatroot tempo hypothesis is slightly biased while its tracked intervals
      // lock to a cleaner metrical pulse (e.g. 750 ms => exactly 80 BPM).
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

    return [raw, ...metricalRows];
  } catch (error) {
    return failed(input, started, error);
  }
}

/** Backwards-compatible single-row helper. */
export async function runMusicTempo(input: BenchmarkInput, progress?: BenchmarkProgress): Promise<RhythmEngineResult> {
  return (await runMusicTempoVariants(input, progress))[0] as RhythmEngineResult;
}
