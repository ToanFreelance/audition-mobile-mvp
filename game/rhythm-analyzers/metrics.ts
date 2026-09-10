import type {
  BaseRhythmResult,
  BenchmarkInput,
  LocalTempoWindow,
  ManualMarkSummary,
  ManualScore,
  RhythmEngineResult,
  TempoConsensus,
  TempoConsensusCluster,
  TempoConsensusMember,
  TempoMode,
} from "./types";

export const finiteNumbers = (values: ArrayLike<number> | undefined): number[] => {
  if (!values) return [];
  return Array.from(values).filter(Number.isFinite);
};

export const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

export const median = (values: number[]): number | null => {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] ?? null : ((sorted[mid - 1] ?? 0) + (sorted[mid] ?? 0)) / 2;
};

export const standardDeviation = (values: number[]): number | null => {
  if (values.length < 2) return null;
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  const variance = values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance);
};

export function beatMetrics(beatTimesMs: number[]) {
  const intervals = beatTimesMs
    .slice(1)
    .map((value, index) => value - beatTimesMs[index])
    .filter(value => Number.isFinite(value) && value > 100 && value < 2000);
  const center = median(intervals);
  return {
    medianBeatIntervalMs: center,
    derivedBpmFromIntervals: center && center > 0 ? 60000 / center : null,
    intervalJitterMs: standardDeviation(intervals),
  };
}

function nearestToAnchor(beatTimesMs: number[], spaceStartMs?: number) {
  if (!beatTimesMs.length || !Number.isFinite(spaceStartMs)) return { nearest: null, delta: null };
  const anchor = spaceStartMs ?? 0;
  let nearest = beatTimesMs[0] ?? 0;
  for (const beat of beatTimesMs) {
    if (Math.abs(beat - anchor) < Math.abs(nearest - anchor)) nearest = beat;
  }
  return { nearest, delta: nearest - anchor };
}

function buildLocalTempo(beatTimesMs: number[], durationMs: number, windowMs = 30_000): LocalTempoWindow[] {
  if (beatTimesMs.length < 4 || durationMs <= 0) return [];
  const windows: LocalTempoWindow[] = [];
  for (let startMs = 0; startMs < durationMs; startMs += windowMs) {
    const endMs = Math.min(durationMs, startMs + windowMs);
    const beats = beatTimesMs.filter(beat => beat >= startMs && beat < endMs);
    const metrics = beatMetrics(beats);
    windows.push({
      startMs,
      endMs,
      beatCount: beats.length,
      bpm: metrics.derivedBpmFromIntervals,
      medianBeatIntervalMs: metrics.medianBeatIntervalMs,
      intervalJitterMs: metrics.intervalJitterMs,
    });
  }
  return windows;
}

function classifyTempoMode(localTempo: LocalTempoWindow[]): TempoMode {
  const substantial = localTempo.filter(item =>
    item.bpm != null && Number.isFinite(item.bpm) && item.beatCount >= 8 && item.endMs - item.startMs >= 20_000,
  );
  const fallback = localTempo.filter(item => item.bpm != null && Number.isFinite(item.bpm) && item.beatCount >= 8);
  const source = substantial.length >= 2 ? substantial : fallback;
  const bpms = source.map(item => item.bpm).filter((value): value is number => value != null && Number.isFinite(value));
  if (bpms.length < 2) return "UNKNOWN";
  const center = median(bpms);
  if (!center || center <= 0) return "UNKNOWN";
  const maxRelativeDeviation = Math.max(...bpms.map(value => Math.abs(value - center) / center));
  return maxRelativeDeviation <= 0.015 ? "CONSTANT" : "VARIABLE";
}

export function normalizeResult(base: BaseRhythmResult, input: Pick<BenchmarkInput, "buffer" | "spaceStartMs">): RhythmEngineResult {
  const beats = base.beatTimesMs.filter(Number.isFinite).sort((a, b) => a - b);
  const metrics = beatMetrics(beats);
  const anchor = nearestToAnchor(beats, input.spaceStartMs);
  const localTempo = buildLocalTempo(beats, input.buffer.duration * 1000);
  return {
    ...base,
    beatTimesMs: beats,
    beatCount: beats.length,
    ...metrics,
    localTempo,
    tempoMode: classifyTempoMode(localTempo),
    nearestBeatToSpaceStartMs: anchor.nearest,
    spaceStartDeltaMs: anchor.delta,
  };
}

export function synthesizeBeatGrid(offsetSeconds: number, bpm: number, durationSeconds: number) {
  if (!Number.isFinite(offsetSeconds) || !Number.isFinite(bpm) || bpm <= 0) return [];
  const interval = 60 / bpm;
  const beats: number[] = [];
  let time = offsetSeconds;
  while (time > interval) time -= interval;
  while (time < 0) time += interval;
  for (; time <= durationSeconds; time += interval) beats.push(time * 1000);
  return beats;
}

export function downmixAudioBuffer(buffer: AudioBuffer): Float32Array {
  const mono = new Float32Array(buffer.length);
  for (let channel = 0; channel < buffer.numberOfChannels; channel += 1) {
    const data = buffer.getChannelData(channel);
    for (let index = 0; index < buffer.length; index += 1) mono[index] += (data[index] ?? 0) / buffer.numberOfChannels;
  }
  return mono;
}

function linearSlope(xs: number[], ys: number[]): number | null {
  if (xs.length < 2 || xs.length !== ys.length) return null;
  const meanX = xs.reduce((sum, value) => sum + value, 0) / xs.length;
  const meanY = ys.reduce((sum, value) => sum + value, 0) / ys.length;
  let numerator = 0;
  let denominator = 0;
  for (let index = 0; index < xs.length; index += 1) {
    numerator += ((xs[index] ?? 0) - meanX) * ((ys[index] ?? 0) - meanY);
    denominator += ((xs[index] ?? 0) - meanX) ** 2;
  }
  return denominator > 0 ? numerator / denominator : null;
}

function scoreMarksAgainstGrid(gridMs: number[], marksMs: number[]) {
  if (!gridMs.length || !marksMs.length) return null;
  const signed = marksMs.map(mark => {
    let nearest = gridMs[0] ?? 0;
    for (const beat of gridMs) if (Math.abs(beat - mark) < Math.abs(nearest - mark)) nearest = beat;
    return nearest - mark;
  });
  const absolute = signed.map(Math.abs);
  return {
    maeMs: absolute.reduce((sum, value) => sum + value, 0) / absolute.length,
    medianErrorMs: median(absolute),
    maxErrorMs: Math.max(...absolute),
    signedDriftMsPerMark: linearSlope(marksMs.map((_, index) => index), signed),
    driftSlopeMsPerSecond: linearSlope(marksMs.map(value => value / 1000), signed),
  };
}

export function scoreManualMarks(result: RhythmEngineResult, marksMs: number[]): ManualScore {
  const empty: ManualScore = { maeMs: null, medianErrorMs: null, maxErrorMs: null, signedDriftMsPerMark: null, driftSlopeMsPerSecond: null, spacePhase: null };
  if (!result.beatTimesMs.length || !marksMs.length) return empty;

  const phaseCandidates = result.beatTimesMs.length >= 4
    ? [0, 1, 2, 3].map(phase => ({ phase, grid: result.beatTimesMs.filter((_, index) => index % 4 === phase) }))
    : [{ phase: 0, grid: result.beatTimesMs }];

  let best: (NonNullable<ReturnType<typeof scoreMarksAgainstGrid>> & { phase: number }) | null = null;
  for (const candidate of phaseCandidates) {
    const score = scoreMarksAgainstGrid(candidate.grid, marksMs);
    if (!score) continue;
    if (!best || score.maeMs < best.maeMs) best = { ...score, phase: candidate.phase };
  }
  if (!best) return empty;
  return { ...best, spacePhase: best.phase + 1 };
}

export function summarizeManualMarks(marksMs: number[]): ManualMarkSummary {
  if (marksMs.length < 2) return { markCount: marksMs.length, medianSpaceIntervalMs: null, derivedBpm: null, intervalJitterMs: null };
  const intervals = marksMs
    .slice(1)
    .map((value, index) => value - marksMs[index])
    .filter(value => Number.isFinite(value) && value > 800 && value < 8000);
  const center = median(intervals);
  if (!center) return { markCount: marksMs.length, medianSpaceIntervalMs: null, derivedBpm: null, intervalJitterMs: null };
  const trimmed = intervals.filter(value => Math.abs(value - center) / center <= 0.25);
  const stable = trimmed.length >= 2 ? trimmed : intervals;
  const robustCenter = median(stable);
  if (!robustCenter) return { markCount: marksMs.length, medianSpaceIntervalMs: null, derivedBpm: null, intervalJitterMs: null };
  return {
    markCount: marksMs.length,
    medianSpaceIntervalMs: robustCenter,
    derivedBpm: 240000 / robustCenter,
    intervalJitterMs: standardDeviation(stable),
  };
}

function normalizeHarmonic(rawBpm: number) {
  if (rawBpm >= 70 && rawBpm <= 160) return { normalizedBpm: rawBpm, harmonicMultiplier: 1 };
  const candidates = [0.5, 2, 0.25, 4]
    .map(multiplier => ({ normalizedBpm: rawBpm * multiplier, harmonicMultiplier: multiplier }))
    .filter(item => item.normalizedBpm >= 70 && item.normalizedBpm <= 160)
    .sort((a, b) => Math.abs(a.normalizedBpm - 105) - Math.abs(b.normalizedBpm - 105));
  return candidates[0] ?? { normalizedBpm: rawBpm, harmonicMultiplier: 1 };
}

function clusterCenter(members: TempoConsensusMember[]) {
  const perEngine = new Map<string, number[]>();
  for (const member of members) {
    const values = perEngine.get(member.engine) ?? [];
    values.push(member.normalizedBpm);
    perEngine.set(member.engine, values);
  }
  const engineCenters = [...perEngine.values()].map(values => median(values)).filter((value): value is number => value != null);
  return median(engineCenters) ?? median(members.map(member => member.normalizedBpm)) ?? 0;
}

export function buildTempoConsensus(results: RhythmEngineResult[]): TempoConsensus {
  const members: TempoConsensusMember[] = results
    .filter(result => result.kind === "package" && !result.error && result.bpm != null && Number.isFinite(result.bpm))
    .map(result => {
      const rawBpm = result.bpm as number;
      const harmonic = normalizeHarmonic(rawBpm);
      return {
        id: result.id,
        label: `${result.engine} · ${result.variant}`,
        engine: result.engine,
        rawBpm,
        ...harmonic,
      };
    })
    .sort((a, b) => a.normalizedBpm - b.normalizedBpm);

  if (!members.length) return { status: "NO_DATA", bpm: null, clusters: [], note: "No package tempo candidates are available." };

  const clusters: TempoConsensusCluster[] = [];
  for (const member of members) {
    let best: TempoConsensusCluster | null = null;
    let bestDistance = Number.POSITIVE_INFINITY;
    for (const cluster of clusters) {
      const distance = Math.abs(member.normalizedBpm - cluster.centerBpm) / Math.max(1, cluster.centerBpm);
      if (distance <= 0.022 && distance < bestDistance) { best = cluster; bestDistance = distance; }
    }
    if (!best) {
      clusters.push({ centerBpm: member.normalizedBpm, engineCount: 1, members: [member] });
      continue;
    }
    best.members.push(member);
    best.centerBpm = clusterCenter(best.members);
    best.engineCount = new Set(best.members.map(item => item.engine)).size;
  }

  for (const cluster of clusters) {
    cluster.centerBpm = clusterCenter(cluster.members);
    cluster.engineCount = new Set(cluster.members.map(item => item.engine)).size;
  }
  clusters.sort((a, b) => b.engineCount - a.engineCount || b.members.length - a.members.length || a.centerBpm - b.centerBpm);

  const top = clusters[0];
  const second = clusters[1];
  const hasIndependentAgreement = Boolean(top && top.engineCount >= 2 && (!second || top.engineCount > second.engineCount));
  return {
    status: hasIndependentAgreement ? "CONSENSUS" : "TEMPO_DISAGREEMENT",
    bpm: hasIndependentAgreement && top ? Number(top.centerBpm.toFixed(4)) : null,
    clusters,
    note: hasIndependentAgreement
      ? "Consensus uses only independent package families after explicit harmonic normalization; CUSTOM is excluded."
      : "Package families do not form a unique dominant tempo cluster. Do not average these candidates.",
  };
}
