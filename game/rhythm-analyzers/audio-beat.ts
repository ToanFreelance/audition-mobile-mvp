import { beatTrack, combTempo, tempo } from "@audio/beat";
import { clamp, finiteNumbers, normalizeResult } from "./metrics";
import type { BenchmarkInput, BenchmarkProgress, RhythmEngineResult } from "./types";

type BeatTrackOptions = Parameters<typeof beatTrack>[1];
const VERSION = "2.1.3";
const yieldToBrowser = () => new Promise<void>(resolve => setTimeout(resolve, 0));

function failure(input: BenchmarkInput, id: string, variant: string, started: number, error: unknown): RhythmEngineResult {
  return normalizeResult({
    id,
    engine: "@audio/beat",
    variant,
    version: VERSION,
    kind: "package",
    beatGridKind: "none",
    bpm: null,
    confidence: null,
    beatTimesMs: [],
    processingTimeMs: performance.now() - started,
    error: error instanceof Error ? error.message : "@audio/beat failed",
  }, input);
}

export async function runAudioBeatVariants(input: BenchmarkInput, progress?: BenchmarkProgress): Promise<RhythmEngineResult[]> {
  const baseOptions = { fs: input.sampleRate, minBpm: 40, maxBpm: 220 } as const;
  const rows: RhythmEngineResult[] = [];
  let tempoBpm: number | null = null;

  progress?.("Running @audio/beat · tempo…");
  await yieldToBrowser();
  {
    const started = performance.now();
    try {
      const raw = tempo(input.mono, { ...baseOptions, candidates: 8 });
      const bpm = Number(raw.bpm);
      tempoBpm = Number.isFinite(bpm) && bpm > 0 ? bpm : null;
      const confidenceRaw = Number(raw.confidence);
      rows.push(normalizeResult({
        id: "audio-beat-tempo",
        engine: "@audio/beat",
        variant: "tempo",
        version: VERSION,
        kind: "package",
        beatGridKind: "none",
        bpm: tempoBpm,
        confidence: Number.isFinite(confidenceRaw) ? clamp(confidenceRaw, 0, 1) : null,
        confidenceRaw: Number.isFinite(confidenceRaw) ? confidenceRaw : null,
        confidenceScale: "package 0..1",
        beatTimesMs: [],
        processingTimeMs: performance.now() - started,
        notes: "Global tempo candidate only; no beat timestamps.",
        raw,
      }, input));
    } catch (error) { rows.push(failure(input, "audio-beat-tempo", "tempo", started, error)); }
  }

  progress?.("Running @audio/beat · combTempo…");
  await yieldToBrowser();
  {
    const started = performance.now();
    try {
      const raw = combTempo(input.mono, baseOptions);
      const confidenceRaw = Number(raw.confidence);
      rows.push(normalizeResult({
        id: "audio-beat-comb",
        engine: "@audio/beat",
        variant: "combTempo",
        version: VERSION,
        kind: "package",
        beatGridKind: "none",
        bpm: Number.isFinite(Number(raw.bpm)) ? Number(raw.bpm) : null,
        confidence: Number.isFinite(confidenceRaw) ? clamp(confidenceRaw, 0, 1) : null,
        confidenceRaw: Number.isFinite(confidenceRaw) ? confidenceRaw : null,
        confidenceScale: "package 0..1",
        beatTimesMs: [],
        processingTimeMs: performance.now() - started,
        notes: "Comb-filter tempo candidate only.",
        raw,
      }, input));
    } catch (error) { rows.push(failure(input, "audio-beat-comb", "combTempo", started, error)); }
  }

  progress?.("Running @audio/beat · beatTrack free…");
  await yieldToBrowser();
  {
    const started = performance.now();
    try {
      const raw = beatTrack(input.mono, baseOptions);
      const confidenceRaw = Number(raw.confidence);
      rows.push(normalizeResult({
        id: "audio-beat-track-free",
        engine: "@audio/beat",
        variant: "beatTrack free",
        version: VERSION,
        kind: "package",
        beatGridKind: "detected",
        bpm: Number.isFinite(Number(raw.bpm)) ? Number(raw.bpm) : null,
        confidence: Number.isFinite(confidenceRaw) ? clamp(confidenceRaw, 0, 1) : null,
        confidenceRaw: Number.isFinite(confidenceRaw) ? confidenceRaw : null,
        confidenceScale: "package 0..1",
        beatTimesMs: finiteNumbers(raw.beats).map(seconds => seconds * 1000),
        processingTimeMs: performance.now() - started,
        notes: "Free-running beat tracker.",
        raw,
      }, input));
    } catch (error) { rows.push(failure(input, "audio-beat-track-free", "beatTrack free", started, error)); }
  }

  progress?.("Running @audio/beat · beatTrack seeded…");
  await yieldToBrowser();
  {
    const started = performance.now();
    try {
      const seededOptions: BeatTrackOptions = { ...baseOptions, bpm: tempoBpm ?? undefined, tightness: 5000 };
      const raw = beatTrack(input.mono, seededOptions);
      const confidenceRaw = Number(raw.confidence);
      rows.push(normalizeResult({
        id: "audio-beat-track-seeded",
        engine: "@audio/beat",
        variant: "beatTrack seeded by tempo",
        version: VERSION,
        kind: "package",
        beatGridKind: "detected",
        bpm: Number.isFinite(Number(raw.bpm)) ? Number(raw.bpm) : null,
        confidence: Number.isFinite(confidenceRaw) ? clamp(confidenceRaw, 0, 1) : null,
        confidenceRaw: Number.isFinite(confidenceRaw) ? confidenceRaw : null,
        confidenceScale: "package 0..1",
        beatTimesMs: finiteNumbers(raw.beats).map(seconds => seconds * 1000),
        processingTimeMs: performance.now() - started,
        notes: `Seed=${tempoBpm?.toFixed(4) ?? "n/a"} BPM · tightness=5000.`,
        raw,
      }, input));
    } catch (error) { rows.push(failure(input, "audio-beat-track-seeded", "beatTrack seeded by tempo", started, error)); }
  }

  return rows;
}
