import { runAnchorGrid } from "./anchor-grid";
import { runAudioBeatVariants } from "./audio-beat";
import { runEssentiaVariants } from "./essentia";
import { runWebAudioBeatDetectorVariants } from "./web-audio-beat-detector";
import type { BenchmarkInput, BenchmarkProgress, RhythmEngineResult } from "./types";

export * from "./types";
export { buildTempoConsensus, downmixAudioBuffer, scoreManualMarks, summarizeManualMarks } from "./metrics";

const yieldToBrowser = () => new Promise<void>(resolve => setTimeout(resolve, 0));

export async function runRhythmBenchmark(input: BenchmarkInput, progress?: BenchmarkProgress): Promise<RhythmEngineResult[]> {
  const rows: RhythmEngineResult[] = [];

  const audioBeatRows = await runAudioBeatVariants(input, progress);
  rows.push(...audioBeatRows);
  await yieldToBrowser();

  const essentiaRows = await runEssentiaVariants(input, progress);
  rows.push(...essentiaRows);
  await yieldToBrowser();

  const webRows = await runWebAudioBeatDetectorVariants(input, progress);
  rows.push(...webRows);
  await yieldToBrowser();

  progress?.("Running CUSTOM anchor grid…");
  const seed = audioBeatRows.find(row => row.id === "audio-beat-tempo")?.bpm;
  rows.push(runAnchorGrid(input, seed && Number.isFinite(seed) && seed > 0 ? seed : 120));
  progress?.("Finalizing normalized metrics…");
  await yieldToBrowser();

  return [
    ...essentiaRows,
    ...audioBeatRows,
    ...webRows,
    rows[rows.length - 1] as RhythmEngineResult,
  ];
}
