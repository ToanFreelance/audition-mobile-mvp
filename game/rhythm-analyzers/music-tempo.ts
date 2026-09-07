import { finiteNumbers, normalizeResult } from "./metrics";
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

function failed(input: BenchmarkInput, started: number, error: unknown): RhythmEngineResult {
  return normalizeResult({
    id: "music-tempo-beatroot",
    engine: "music-tempo",
    variant: "Beatroot default",
    version: VERSION,
    kind: "package",
    beatGridKind: "none",
    bpm: null,
    confidence: null,
    beatTimesMs: [],
    processingTimeMs: performance.now() - started,
    error: error instanceof Error ? error.message : String(error || "music-tempo failed"),
    notes: "music-tempo failed independently; the other benchmark engines remain usable.",
  }, input);
}

/**
 * Reproduces the package's official browser-demo path as closely as practical:
 * mono WebAudio PCM at 44.1 kHz -> new MusicTempo(audioData) with default
 * Beatroot parameters. The package exposes an actual tracked beat list rather
 * than a tempo+offset synthetic grid, which makes it useful for phase/drift
 * comparison in the benchmark.
 */
export async function runMusicTempo(input: BenchmarkInput, progress?: BenchmarkProgress): Promise<RhythmEngineResult> {
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

    const bpm = Number(result.tempo);
    if (!Number.isFinite(bpm) || bpm <= 0) throw new Error(`Invalid tempo returned: ${String(result.tempo)}`);

    const beatTimesMs = finiteNumbers(result.beats).map(value => value * 1000);
    const onsetTimesMs = finiteNumbers(result.events).map(value => value * 1000);
    const rawAgentScore = result.bestAgent?.score;

    return normalizeResult({
      id: "music-tempo-beatroot",
      engine: "music-tempo",
      variant: "Beatroot default",
      version: VERSION,
      kind: "package",
      beatGridKind: beatTimesMs.length ? "detected" : "none",
      bpm,
      confidence: null,
      confidenceRaw: typeof rawAgentScore === "number" && Number.isFinite(rawAgentScore) ? rawAgentScore : null,
      confidenceScale: "Package exposes a raw Beatroot agent score, not a normalized confidence value.",
      beatTimesMs,
      onsetTimesMs,
      processingTimeMs: performance.now() - started,
      notes: `Official-demo style run: mono PCM ${input.sampleRate}Hz${input.sampleRate === TARGET_SAMPLE_RATE ? "" : ` resampled to ${TARGET_SAMPLE_RATE}Hz`} and default MusicTempo parameters. BPM is coerced from the package's 3-decimal tempo value. beats[] is the tracked Beatroot beat list (not synthesized); events[] contains spectral-flux onset candidates. MIT license; benchmark-only until cross-track evidence is strong.`,
      raw: {
        tempo: result.tempo,
        beatInterval: result.beatInterval,
        beatCount: beatTimesMs.length,
        onsetCount: onsetTimesMs.length,
        tempoList: finiteNumbers(result.tempoList),
        bestAgentScore: rawAgentScore ?? null,
        bestAgentBeatInterval: result.bestAgent?.beatInterval ?? null,
        inputSampleRate: input.sampleRate,
        analysisSampleRate: TARGET_SAMPLE_RATE,
      },
    }, input);
  } catch (error) {
    return failed(input, started, error);
  }
}
