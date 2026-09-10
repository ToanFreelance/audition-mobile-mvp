import { guess as guessWebAudioBeat } from "web-audio-beat-detector";
import { normalizeResult, synthesizeBeatGrid } from "./metrics";
import type { BenchmarkInput, BenchmarkProgress, RhythmEngineResult } from "./types";

const VERSION = "8.2.39";
const yieldToBrowser = () => new Promise<void>(resolve => setTimeout(resolve, 0));

type Settings = { minTempo: number; maxTempo: number };

async function runVariant(input: BenchmarkInput, id: string, variant: string, settings?: Settings): Promise<RhythmEngineResult> {
  const started = performance.now();
  try {
    const raw = settings ? await guessWebAudioBeat(input.buffer, settings) : await guessWebAudioBeat(input.buffer);
    const roundedBpm = Number(raw.bpm);
    const exactTempo = Number((raw as { tempo?: number }).tempo);
    const bpm = Number.isFinite(exactTempo) && exactTempo > 0 ? exactTempo : roundedBpm;
    const offset = Number(raw.offset);
    const beats = synthesizeBeatGrid(Number.isFinite(offset) ? offset : 0, bpm, input.buffer.duration);
    return normalizeResult({
      id,
      engine: "web-audio-beat-detector",
      variant,
      version: VERSION,
      kind: "package",
      beatGridKind: "synthetic",
      bpm: Number.isFinite(bpm) && bpm > 0 ? bpm : null,
      confidence: null,
      beatTimesMs: beats,
      processingTimeMs: performance.now() - started,
      notes: `Package returns tempo + first-beat offset, not a detected beat list. Grid is synthesized for comparison. Rounded bpm=${Number.isFinite(roundedBpm) ? roundedBpm : "n/a"}; exact tempo=${Number.isFinite(exactTempo) ? exactTempo.toFixed(4) : "n/a"}; offset=${Number.isFinite(offset) ? `${offset.toFixed(3)}s` : "n/a"}.`,
      raw,
    }, input);
  } catch (error) {
    return normalizeResult({
      id,
      engine: "web-audio-beat-detector",
      variant,
      version: VERSION,
      kind: "package",
      beatGridKind: "none",
      bpm: null,
      confidence: null,
      beatTimesMs: [],
      processingTimeMs: performance.now() - started,
      error: error instanceof Error ? error.message : "web-audio-beat-detector failed",
    }, input);
  }
}

export async function runWebAudioBeatDetectorVariants(input: BenchmarkInput, progress?: BenchmarkProgress) {
  const rows: RhythmEngineResult[] = [];
  progress?.("Running web-audio-beat-detector · default 90–180…");
  await yieldToBrowser();
  rows.push(await runVariant(input, "web-audio-beat-detector-default", "guess default 90–180"));
  progress?.("Running web-audio-beat-detector · broad 40–220…");
  await yieldToBrowser();
  rows.push(await runVariant(input, "web-audio-beat-detector-broad", "guess broad 40–220", { minTempo: 40, maxTempo: 220 }));
  return rows;
}
