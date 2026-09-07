import { runAnchorGrid } from "./anchor-grid";
import { runAudioBeatVariants } from "./audio-beat";
import { runAutoGridValidator } from "./grid-validator";
import { runEssentiaVariants } from "./essentia";
import { runWebAudioBeatDetectorVariants } from "./web-audio-beat-detector";
import type { BenchmarkInput, BenchmarkProgress, RhythmEngineResult } from "./types";

export * from "./types";
export { buildTempoConsensus, downmixAudioBuffer, scoreManualMarks, summarizeManualMarks } from "./metrics";

const yieldToBrowser = () => new Promise<void>(resolve => setTimeout(resolve, 0));

export async function runRhythmBenchmark(input: BenchmarkInput, progress?: BenchmarkProgress): Promise<RhythmEngineResult[]> {
  const audioBeatRows = await runAudioBeatVariants(input, progress);
  await yieldToBrowser();

  const essentiaRows = await runEssentiaVariants(input, progress);
  await yieldToBrowser();

  const webRows = await runWebAudioBeatDetectorVariants(input, progress);
  await yieldToBrowser();

  const packageRows = [...audioBeatRows, ...essentiaRows, ...webRows];
  const autoGridRow = await runAutoGridValidator(input, packageRows, progress);
  await yieldToBrowser();

  progress?.("Running CUSTOM anchor grid…");
  const seed = audioBeatRows.find(row => row.id === "audio-beat-tempo")?.bpm;
  const anchorGridRow = runAnchorGrid(input, seed && Number.isFinite(seed) && seed > 0 ? seed : 120);
  progress?.("Finalizing normalized metrics…");
  await yieldToBrowser();

  return [
    ...essentiaRows,
    ...audioBeatRows,
    ...webRows,
    autoGridRow,
    anchorGridRow,
  ];
}
