export type RhythmEngineKind = "package" | "custom";
export type BeatGridKind = "detected" | "synthetic" | "none";
export type TempoMode = "CONSTANT" | "VARIABLE" | "UNKNOWN";

export type LocalTempoWindow = {
  startMs: number;
  endMs: number;
  beatCount: number;
  bpm: number | null;
  medianBeatIntervalMs: number | null;
  intervalJitterMs: number | null;
};

export type RhythmEngineResult = {
  id: string;
  engine: string;
  variant: string;
  version?: string;
  kind: RhythmEngineKind;
  beatGridKind: BeatGridKind;
  bpm: number | null;
  /** Display-normalized only. Values are not comparable across engines. */
  confidence: number | null;
  confidenceRaw?: number | null;
  confidenceScale?: string;
  beatTimesMs: number[];
  onsetTimesMs?: number[];
  beatCount: number;
  medianBeatIntervalMs: number | null;
  derivedBpmFromIntervals: number | null;
  intervalJitterMs: number | null;
  localTempo: LocalTempoWindow[];
  tempoMode: TempoMode;
  processingTimeMs: number;
  nearestBeatToSpaceStartMs: number | null;
  spaceStartDeltaMs: number | null;
  notes?: string;
  raw?: unknown;
  error?: string;
};

export type BaseRhythmResult = Omit<RhythmEngineResult,
  "beatCount" |
  "medianBeatIntervalMs" |
  "derivedBpmFromIntervals" |
  "intervalJitterMs" |
  "localTempo" |
  "tempoMode" |
  "nearestBeatToSpaceStartMs" |
  "spaceStartDeltaMs"
>;

export type BenchmarkInput = {
  buffer: AudioBuffer;
  mono: Float32Array;
  sampleRate: number;
  spaceStartMs?: number;
};

export type BenchmarkProgress = (message: string) => void;

export type ManualScore = {
  maeMs: number | null;
  medianErrorMs: number | null;
  maxErrorMs: number | null;
  signedDriftMsPerMark: number | null;
  driftSlopeMsPerSecond: number | null;
  /** Best matching beat modulo 4, expressed as 1..4. */
  spacePhase: number | null;
};

export type ManualMarkSummary = {
  markCount: number;
  medianSpaceIntervalMs: number | null;
  derivedBpm: number | null;
  intervalJitterMs: number | null;
};

export type TempoConsensusMember = {
  id: string;
  label: string;
  engine: string;
  rawBpm: number;
  normalizedBpm: number;
  harmonicMultiplier: number;
};

export type TempoConsensusCluster = {
  centerBpm: number;
  engineCount: number;
  members: TempoConsensusMember[];
};

export type TempoConsensus = {
  status: "NO_DATA" | "CONSENSUS" | "TEMPO_DISAGREEMENT";
  bpm: number | null;
  clusters: TempoConsensusCluster[];
  note: string;
};
