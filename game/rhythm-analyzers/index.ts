import { runAnchorGrid } from "./anchor-grid";
import { runAudioBeatVariants } from "./audio-beat";
import { runFinalRhythmEstimator } from "./final-rhythm-estimator";
import { runAutoGridValidator } from "./grid-validator";
import { runEssentiaVariants } from "./essentia";
import { runMusicTempoVariants } from "./music-tempo";
import { runPhaseGridValidator } from "./phase-grid-validator";
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

  const musicTempoRows = await runMusicTempoVariants(input, progress);
  await yieldToBrowser();

  const packageRows = [...audioBeatRows, ...essentiaRows, ...webRows, ...musicTempoRows];

  const onsetGridRow = await runAutoGridValidator(input, packageRows, progress);
  await yieldToBrowser();

  const phaseGridRow = await runPhaseGridValidator(input, packageRows, progress);
  await yieldToBrowser();

  const finalRhythmRow = await runFinalRhythmEstimator(input, packageRows, onsetGridRow, phaseGridRow, progress);
  await yieldToBrowser();

  const onsetDiagnosticRow: RhythmEngineResult = {
    ...onsetGridRow,
    id: "onset-grid-validator",
    engine: "ONSET GRID",
    variant: onsetGridRow.variant.replace("whole-track onset fit", "whole-track onset periodicity"),
    notes: `${onsetGridRow.notes ?? ""} Diagnostic only: FINAL RHYTHM now owns metrical-level selection and the live gauge candidate.`,
  };

  progress?.("Running CUSTOM anchor grid…");
  const seed = audioBeatRows.find(row => row.id === "audio-beat-tempo")?.bpm;
  const anchorGridRow = runAnchorGrid(input, seed && Number.isFinite(seed) && seed > 0 ? seed : 120);
  progress?.("Finalizing normalized metrics…");
  await yieldToBrowser();

  return [
    ...essentiaRows,
    ...audioBeatRows,
    ...webRows,
    ...musicTempoRows,
    onsetDiagnosticRow,
    phaseGridRow,
    finalRhythmRow,
    anchorGridRow,
  ];
}
