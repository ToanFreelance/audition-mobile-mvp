import { clamp, median, normalizeResult, synthesizeBeatGrid } from "./metrics";
import type { BenchmarkInput, BenchmarkProgress, RhythmEngineResult } from "./types";

const VERSION = "internal-v3";
const MIN_BPM = 55;
const MAX_BPM = 210;
const CLUSTER_RELATIVE_TOLERANCE = 0.012;
const MATCH_RELATIVE_TOLERANCE = 0.014;
const DRIFT_BUDGET_MS = 30;
const NOMINAL_REVIEW_DRIFT_MS = 60;
const yieldToBrowser = () => new Promise<void>(resolve => setTimeout(resolve, 0));

const METRICAL_MULTIPLIERS = [
  { value: 1, label: "×1" },
  { value: 0.5, label: "×0.5" },
  { value: 2, label: "×2" },
  { value: 2 / 3, label: "×2/3" },
  { value: 1.5, label: "×3/2" },
  { value: 0.75, label: "×3/4" },
  { value: 4 / 3, label: "×4/3" },
] as const;

type MetricalVote = {
  family: string;
  sourceId: string;
  label: string;
  rawBpm: number;
  bpm: number;
  multiplier: number;
  weight: number;
  detected: boolean;
  direct: boolean;
};

type ValidatorCandidate = {
  bpm: number;
  phaseMs: number | null;
  score: number;
  supportRatio: number | null;
  driftMsPerSecond: number | null;
  source: "onset" | "phase";
};

type FinalCandidate = {
  bpm: number;
  familyScore: number;
  detectedScore: number;
  onsetScore: number;
  phaseScore: number;
  directScore: number;
  score: number;
  families: string[];
  votes: MetricalVote[];
};

type ExactObservation = {
  family: string;
  bpm: number;
  weight: number;
  label: string;
  longBaseline: boolean;
};

type FamilyEstimate = {
  family: string;
  bpm: number;
  spreadBpm: number;
  weight: number;
  reliability: number;
  observations: ExactObservation[];
};

type NominalEvidence = {
  bpm: number;
  confidence: number;
  reasons: string[];
  quantizedFamilies: string[];
  validatorAgreement: boolean;
  mode: "DRIFT_VALIDATED" | "QUANTIZED_SOURCE_MISMATCH";
  endDriftMs: number;
};

function finite(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function relativeDistance(a: number, b: number) {
  return Math.abs(a - b) / Math.max(1, Math.abs(b));
}

function weightedMedian<T extends { bpm: number; weight: number }>(values: T[]) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a.bpm - b.bpm);
  const total = sorted.reduce((sum, item) => sum + Math.max(0, item.weight), 0);
  if (total <= 0) return median(sorted.map(item => item.bpm));
  let cumulative = 0;
  for (const item of sorted) {
    cumulative += Math.max(0, item.weight);
    if (cumulative >= total / 2) return item.bpm;
  }
  return sorted[sorted.length - 1]?.bpm ?? null;
}

function weightedMad<T extends { bpm: number; weight: number }>(values: T[], center: number) {
  return weightedMedian(values.map(item => ({ bpm: Math.abs(item.bpm - center), weight: item.weight })));
}

function rowRaw(row: RhythmEngineResult): Record<string, unknown> {
  return row.raw && typeof row.raw === "object" ? row.raw as Record<string, unknown> : {};
}

function longLagBpm(beatsMs: number[], lag: number) {
  if (beatsMs.length <= lag + 2) return null;
  const intervals: number[] = [];
  for (let index = 0; index + lag < beatsMs.length; index += 1) {
    const start = beatsMs[index];
    const end = beatsMs[index + lag];
    if (!finite(start) || !finite(end) || end <= start) continue;
    const interval = (end - start) / lag;
    if (interval >= 180 && interval <= 1400) intervals.push(interval);
  }
  const center = median(intervals);
  return center && center > 0 ? 60000 / center : null;
}

function substantialLocalWindows(row: RhythmEngineResult) {
  return row.localTempo.filter(window =>
    window.bpm != null && Number.isFinite(window.bpm) && window.beatCount >= 8 && window.endMs - window.startMs >= 20_000,
  );
}

function stableLocalMedian(row: RhythmEngineResult) {
  const windows = substantialLocalWindows(row);
  if (windows.length < 3) return null;
  return median(windows.map(window => window.bpm as number));
}

function detectedQuality(row: RhythmEngineResult) {
  if (row.beatGridKind !== "detected" || row.beatTimesMs.length < 16) return 0;
  const jitter = row.intervalJitterMs ?? 80;
  const jitterQuality = clamp(1 - Math.max(0, jitter - 4) / 60, 0.12, 1);
  const span = (row.beatTimesMs[row.beatTimesMs.length - 1] ?? 0) - (row.beatTimesMs[0] ?? 0);
  const spanQuality = clamp(span / 150_000, 0.25, 1);
  const modeQuality = row.tempoMode === "CONSTANT" ? 1 : row.tempoMode === "UNKNOWN" ? 0.68 : 0.32;
  return jitterQuality * 0.45 + spanQuality * 0.35 + modeQuality * 0.20;
}

function metricalWeight(rawBpm: number, multiplier: number, row: RhythmEngineResult) {
  const isDerivedMetricalRow = row.variant.toLowerCase().includes("metrical ×0.5");
  if (multiplier === 1) return isDerivedMetricalRow ? 0.76 : 1;
  if (rawBpm > 160 && multiplier === 0.5) return 0.98;
  if (rawBpm < 70 && multiplier === 2) return 0.98;
  if (multiplier === 0.5 || multiplier === 2) return 0.48;
  return 0.34;
}

function candidateMappings(rawBpm: number, row: RhythmEngineResult, signalWeight: number, detected: boolean, suffix: string) {
  const votes: MetricalVote[] = [];
  for (const hypothesis of METRICAL_MULTIPLIERS) {
    const bpm = rawBpm * hypothesis.value;
    if (!Number.isFinite(bpm) || bpm < MIN_BPM || bpm > MAX_BPM) continue;
    votes.push({
      family: row.engine,
      sourceId: row.id,
      label: `${row.engine} · ${row.variant}${suffix} ${hypothesis.label}`,
      rawBpm,
      bpm,
      multiplier: hypothesis.value,
      weight: signalWeight * metricalWeight(rawBpm, hypothesis.value, row),
      detected,
      direct: hypothesis.value === 1,
    });
  }
  return votes;
}

function collectVotes(packageRows: RhythmEngineResult[]) {
  const votes: MetricalVote[] = [];
  for (const row of packageRows) {
    if (row.kind !== "package" || row.error) continue;
    if (finite(row.bpm) && row.bpm > 0) votes.push(...candidateMappings(row.bpm, row, 1, false, ""));
    const quality = detectedQuality(row);
    if (quality <= 0) continue;
    if (finite(row.derivedBpmFromIntervals) && row.derivedBpmFromIntervals > 0) {
      votes.push(...candidateMappings(row.derivedBpmFromIntervals, row, 0.72 * quality, true, " intervals"));
    }
    const local = stableLocalMedian(row);
    if (local) votes.push(...candidateMappings(local, row, 0.78 * quality, true, " local"));
    for (const lag of [8, 16, 32, 64]) {
      const bpm = longLagBpm(row.beatTimesMs, lag);
      if (bpm) votes.push(...candidateMappings(bpm, row, (0.72 + Math.min(lag, 64) / 320) * quality, true, ` lag${lag}`));
    }
    const longSpan = rowRaw(row).longSpanBpm;
    if (finite(longSpan) && longSpan > 0) votes.push(...candidateMappings(longSpan, row, 0.92 * quality, true, " long-span"));
  }
  return votes;
}

function validatorCandidates(row: RhythmEngineResult, source: "onset" | "phase"): ValidatorCandidate[] {
  const candidates = Array.isArray(rowRaw(row).candidates) ? rowRaw(row).candidates as unknown[] : [];
  return candidates.flatMap(item => {
    if (!item || typeof item !== "object") return [];
    const value = item as Record<string, unknown>;
    if (!finite(value.bpm) || !finite(value.score)) return [];
    return [{
      bpm: value.bpm,
      score: value.score,
      supportRatio: finite(value.supportRatio) ? value.supportRatio : null,
      driftMsPerSecond: finite(value.phaseDriftMsPerSecond) ? value.phaseDriftMsPerSecond : null,
      phaseMs: finite(value.phaseMs) ? value.phaseMs : null,
      source,
    }];
  });
}

function clusterCenters(votes: MetricalVote[], validators: ValidatorCandidate[]) {
  const points = [
    ...votes.filter(vote => vote.weight >= 0.3).map(vote => ({ bpm: vote.bpm, weight: vote.weight })),
    ...validators.map(candidate => ({ bpm: candidate.bpm, weight: 0.8 })),
  ].sort((a, b) => a.bpm - b.bpm);
  const clusters: Array<{ values: Array<{ bpm: number; weight: number }>; center: number }> = [];
  for (const point of points) {
    let target = clusters.find(cluster => relativeDistance(point.bpm, cluster.center) <= CLUSTER_RELATIVE_TOLERANCE);
    if (!target) {
      target = { values: [], center: point.bpm };
      clusters.push(target);
    }
    target.values.push(point);
    const weighted = target.values.reduce((sum, value) => sum + value.bpm * value.weight, 0);
    const weight = target.values.reduce((sum, value) => sum + value.weight, 0);
    target.center = weight > 0 ? weighted / weight : point.bpm;
  }
  return clusters.map(cluster => cluster.center);
}

function nearestValidator(candidates: ValidatorCandidate[], bpm: number, relativeTolerance = MATCH_RELATIVE_TOLERANCE) {
  let best: ValidatorCandidate | null = null;
  for (const candidate of candidates) {
    if (relativeDistance(candidate.bpm, bpm) > relativeTolerance) continue;
    if (!best || Math.abs(candidate.bpm - bpm) < Math.abs(best.bpm - bpm)) best = candidate;
  }
  return best;
}

function buildFinalCandidates(votes: MetricalVote[], validators: ValidatorCandidate[]) {
  const families = [...new Set(votes.map(vote => vote.family))];
  const onset = validators.filter(candidate => candidate.source === "onset");
  const phase = validators.filter(candidate => candidate.source === "phase");
  const candidates: FinalCandidate[] = [];

  for (const bpm of clusterCenters(votes, validators)) {
    const matched = votes.filter(vote => relativeDistance(vote.bpm, bpm) <= MATCH_RELATIVE_TOLERANCE);
    const familyBest = new Map<string, number>();
    const detectedBest = new Map<string, number>();
    const directBest = new Map<string, number>();
    for (const vote of matched) {
      familyBest.set(vote.family, Math.max(familyBest.get(vote.family) ?? 0, vote.weight));
      if (vote.detected) detectedBest.set(vote.family, Math.max(detectedBest.get(vote.family) ?? 0, vote.weight));
      if (vote.direct) directBest.set(vote.family, Math.max(directBest.get(vote.family) ?? 0, vote.weight));
    }
    const denominator = Math.max(1, families.length);
    const familyScore = [...familyBest.values()].reduce((sum, value) => sum + value, 0) / denominator;
    const detectedScore = [...detectedBest.values()].reduce((sum, value) => sum + value, 0) / denominator;
    const directScore = [...directBest.values()].reduce((sum, value) => sum + value, 0) / denominator;
    const onsetMatch = nearestValidator(onset, bpm);
    const phaseMatch = nearestValidator(phase, bpm);
    const onsetScore = onsetMatch ? clamp(onsetMatch.score, 0, 1) : 0;
    const driftQuality = phaseMatch?.driftMsPerSecond == null ? 0.55 : 1 / (1 + Math.abs(phaseMatch.driftMsPerSecond) / 0.45);
    const phaseScore = phaseMatch ? clamp(phaseMatch.score * (0.55 + 0.45 * driftQuality), 0, 1) : 0;
    const score = familyScore * 0.38 + detectedScore * 0.24 + onsetScore * 0.16 + phaseScore * 0.17 + directScore * 0.05;
    candidates.push({
      bpm,
      familyScore,
      detectedScore,
      onsetScore,
      phaseScore,
      directScore,
      score,
      families: [...familyBest.keys()],
      votes: matched,
    });
  }

  return candidates.sort((a, b) => b.score - a.score || b.familyScore - a.familyScore || b.bpm - a.bpm);
}

function bestMultiplierToTarget(rawBpm: number, targetBpm: number) {
  return METRICAL_MULTIPLIERS
    .map(item => ({ ...item, mapped: rawBpm * item.value }))
    .filter(item => item.mapped >= MIN_BPM && item.mapped <= MAX_BPM)
    .sort((a, b) => relativeDistance(a.mapped, targetBpm) - relativeDistance(b.mapped, targetBpm))[0] ?? null;
}

function mappedBpm(rawBpm: number | null, targetBpm: number) {
  if (!rawBpm || !Number.isFinite(rawBpm) || rawBpm <= 0) return null;
  const mapped = bestMultiplierToTarget(rawBpm, targetBpm);
  if (!mapped || relativeDistance(mapped.mapped, targetBpm) > MATCH_RELATIVE_TOLERANCE) return null;
  return mapped.mapped;
}

function rowExactQuality(row: RhythmEngineResult, targetBpm: number) {
  if (row.error) return 0;
  if (row.beatGridKind !== "detected" || row.beatTimesMs.length < 16) {
    return row.beatGridKind === "synthetic" ? 0.58 : 0.34;
  }
  const base = detectedQuality(row);
  const gridValues = [
    mappedBpm(row.derivedBpmFromIntervals, targetBpm),
    mappedBpm(stableLocalMedian(row), targetBpm),
    mappedBpm(longLagBpm(row.beatTimesMs, 16), targetBpm),
    mappedBpm(longLagBpm(row.beatTimesMs, 32), targetBpm),
    mappedBpm(longLagBpm(row.beatTimesMs, 64), targetBpm),
    mappedBpm(finite(rowRaw(row).longSpanBpm) ? rowRaw(row).longSpanBpm as number : null, targetBpm),
  ].filter((value): value is number => value != null);
  if (!gridValues.length) return base * 0.55;
  const center = median(gridValues) ?? targetBpm;
  const spread = median(gridValues.map(value => Math.abs(value - center))) ?? 0;
  const scalar = mappedBpm(row.bpm, targetBpm);
  const scalarGap = scalar == null ? 0 : Math.abs(scalar - center);
  const coherence = 1 / (1 + spread / 0.055 + scalarGap / 0.22);
  return clamp(base * (0.38 + 0.62 * coherence), 0.08, 1);
}

function addExactObservation(target: ExactObservation[], row: RhythmEngineResult, rawBpm: number | null, targetBpm: number, weight: number, label: string, longBaseline = false) {
  if (!rawBpm || !Number.isFinite(rawBpm) || rawBpm <= 0) return;
  const mapped = bestMultiplierToTarget(rawBpm, targetBpm);
  if (!mapped || relativeDistance(mapped.mapped, targetBpm) > MATCH_RELATIVE_TOLERANCE) return;
  target.push({
    family: row.engine,
    bpm: mapped.mapped,
    weight: weight * metricalWeight(rawBpm, mapped.value, row),
    label: `${label} ${mapped.label}`,
    longBaseline,
  });
}

function acceptedBeatrootFitObservation(rows: RhythmEngineResult[], targetBpm: number): ExactObservation | null {
  const row = rows.find(item => item.id === "music-tempo-beatroot-robust-fit");
  if (!row?.bpm || row.error) return null;
  const raw = rowRaw(row);
  if (!finite(raw.rmseMs) || !finite(raw.p90Ms) || !finite(raw.inlierRatio) || !finite(raw.spanMs)) return null;
  if (raw.rmseMs > 18 || raw.p90Ms > 35 || raw.inlierRatio < 0.65 || raw.spanMs < 120_000) return null;
  const mapped = bestMultiplierToTarget(row.bpm, targetBpm);
  if (!mapped || relativeDistance(mapped.mapped, targetBpm) > MATCH_RELATIVE_TOLERANCE) return null;
  const fitQuality = clamp(1 - raw.rmseMs / 24, 0.25, 1) * clamp(raw.inlierRatio, 0.5, 1);
  return {
    family: "music-tempo",
    bpm: mapped.mapped,
    weight: 0.95 * fitQuality,
    label: `music-tempo accepted robust fit ${mapped.label}`,
    longBaseline: true,
  };
}

function buildFamilyEstimates(packageRows: RhythmEngineResult[], targetBpm: number) {
  const observations: ExactObservation[] = [];
  const qualityByFamily = new Map<string, number>();
  for (const row of packageRows) {
    if (row.kind !== "package" || row.error) continue;
    const quality = rowExactQuality(row, targetBpm);
    qualityByFamily.set(row.engine, Math.max(qualityByFamily.get(row.engine) ?? 0, quality));
    const scalarWeight = row.beatGridKind === "detected" ? 0.14 : row.beatGridKind === "synthetic" ? 0.28 : 0.24;
    addExactObservation(observations, row, row.bpm, targetBpm, scalarWeight * Math.max(0.45, quality), `${row.engine} scalar tempo`);
    if (row.beatGridKind !== "detected" || quality <= 0) continue;
    addExactObservation(observations, row, row.derivedBpmFromIntervals, targetBpm, 0.34 * quality, `${row.engine} interval median`);
    addExactObservation(observations, row, stableLocalMedian(row), targetBpm, 0.52 * quality, `${row.engine} local median`);
    addExactObservation(observations, row, longLagBpm(row.beatTimesMs, 16), targetBpm, 0.64 * quality, `${row.engine} lag16`, true);
    addExactObservation(observations, row, longLagBpm(row.beatTimesMs, 32), targetBpm, 0.84 * quality, `${row.engine} lag32`, true);
    addExactObservation(observations, row, longLagBpm(row.beatTimesMs, 64), targetBpm, 1.08 * quality, `${row.engine} lag64`, true);
    const longSpan = rowRaw(row).longSpanBpm;
    addExactObservation(observations, row, finite(longSpan) ? longSpan : null, targetBpm, 1.12 * quality, `${row.engine} long-span`, true);
  }
  const fit = acceptedBeatrootFitObservation(packageRows, targetBpm);
  if (fit) observations.push(fit);

  const grouped = new Map<string, ExactObservation[]>();
  for (const observation of observations) {
    const items = grouped.get(observation.family) ?? [];
    items.push(observation);
    grouped.set(observation.family, items);
  }

  const estimates: FamilyEstimate[] = [];
  for (const [family, items] of grouped) {
    const center = weightedMedian(items);
    if (center == null) continue;
    const spread = weightedMad(items, center) ?? 0;
    const rowQuality = qualityByFamily.get(family) ?? (family === "music-tempo" && fit ? 0.8 : 0.4);
    const spreadQuality = 1 / (1 + spread / 0.045);
    const longBaselineWeight = items.filter(item => item.longBaseline).reduce((sum, item) => sum + item.weight, 0);
    const longBaselineQuality = clamp(longBaselineWeight / 1.8, 0, 1);
    const evidenceWeight = clamp(items.reduce((sum, item) => sum + item.weight, 0) / 2.8, 0.18, 1);
    const reliability = clamp(rowQuality * 0.34 + spreadQuality * 0.42 + longBaselineQuality * 0.24, 0.08, 1);
    estimates.push({
      family,
      bpm: center,
      spreadBpm: spread,
      reliability,
      weight: evidenceWeight * reliability,
      observations: items,
    });
  }
  return estimates;
}

function robustFamilyCenter(estimates: FamilyEstimate[]) {
  if (!estimates.length) return { center: null as number | null, mad: null as number | null, retained: [] as FamilyEstimate[] };
  const reliable = estimates.filter(item => item.reliability >= 0.22 && item.weight >= 0.14);
  const base = reliable.length >= 2 ? reliable : estimates;
  const initial = weightedMedian(base);
  if (initial == null) return { center: null, mad: null, retained: [] };
  const initialMad = weightedMad(base, initial) ?? 0;
  const threshold = Math.max(0.055, initialMad * 3.25);
  const retained = base.filter(item => Math.abs(item.bpm - initial) <= threshold);
  const source = retained.length >= 2 ? retained : base;
  const center = weightedMedian(source);
  if (center == null) return { center: initial, mad: initialMad, retained: source };
  return { center, mad: weightedMad(source, center) ?? initialMad, retained: source };
}

function fuseExactAudioBpm(
  familyEstimates: FamilyEstimate[],
  onsetCandidates: ValidatorCandidate[],
  phaseCandidates: ValidatorCandidate[],
  targetBpm: number,
) {
  const family = robustFamilyCenter(familyEstimates);
  const fusion: ExactObservation[] = family.retained.map(item => ({
    family: item.family,
    bpm: item.bpm,
    weight: item.weight,
    label: `${item.family} reliable family center`,
    longBaseline: true,
  }));
  const onset = nearestValidator(onsetCandidates, targetBpm);
  const phase = nearestValidator(phaseCandidates, targetBpm);
  if (onset) {
    const support = onset.supportRatio == null ? 0.72 : clamp(onset.supportRatio, 0, 1);
    fusion.push({ family: "ONSET GRID", bpm: onset.bpm, weight: 0.72 * clamp(onset.score, 0, 1) * (0.7 + 0.3 * support), label: "ONSET GRID", longBaseline: true });
  }
  if (phase) {
    const driftQuality = phase.driftMsPerSecond == null ? 0.6 : 1 / (1 + Math.abs(phase.driftMsPerSecond) / 0.30);
    const support = phase.supportRatio == null ? 0.72 : clamp(phase.supportRatio, 0, 1);
    fusion.push({ family: "PHASE GRID", bpm: phase.bpm, weight: 1.02 * clamp(phase.score, 0, 1) * (0.58 + 0.27 * driftQuality + 0.15 * support), label: "PHASE GRID", longBaseline: true });
  }
  const center = weightedMedian(fusion) ?? family.center ?? targetBpm;
  return { bpm: center, familyCenter: family.center, familyMad: family.mad ?? 0, retainedFamilies: family.retained, fusion, onset, phase };
}

function mappedValueNearInteger(rawBpm: number | null, row: RhythmEngineResult, targetBpm: number, integerBpm: number, tolerance: number) {
  if (!rawBpm || !Number.isFinite(rawBpm)) return false;
  const mapped = bestMultiplierToTarget(rawBpm, targetBpm);
  return Boolean(mapped && Math.abs(mapped.mapped - integerBpm) <= tolerance);
}

function findNominalEvidence(
  packageRows: RhythmEngineResult[],
  familyEstimates: FamilyEstimate[],
  onsetCandidates: ValidatorCandidate[],
  phaseCandidates: ValidatorCandidate[],
  targetBpm: number,
  audioBpm: number,
  durationMs: number,
): NominalEvidence | null {
  const integerBpm = Math.round(audioBpm);
  if (Math.abs(audioBpm - integerBpm) > 0.5 || integerBpm < MIN_BPM || integerBpm > MAX_BPM) return null;
  const endDriftMs = durationMs * (audioBpm / integerBpm - 1);

  const quantizedFamilies = new Set<string>();
  for (const row of packageRows) {
    if (row.kind !== "package" || row.error || row.beatGridKind !== "detected" || row.beatTimesMs.length < 32) continue;
    const local = stableLocalMedian(row);
    const intervalNear = mappedValueNearInteger(row.derivedBpmFromIntervals, row, targetBpm, integerBpm, 0.030);
    const localNear = mappedValueNearInteger(local, row, targetBpm, integerBpm, 0.030);
    if (!intervalNear || !localNear || (row.intervalJitterMs ?? 100) > 30) continue;
    const mapped = bestMultiplierToTarget(row.bpm ?? row.derivedBpmFromIntervals ?? 0, targetBpm);
    if (!mapped) continue;
    const stableWindows = substantialLocalWindows(row).filter(window =>
      window.bpm != null && Math.abs(window.bpm * mapped.value - integerBpm) <= 0.045,
    ).length;
    if (stableWindows >= 4) quantizedFamilies.add(row.engine);
  }

  const validatorTolerance = Math.max(0.018, integerBpm * NOMINAL_REVIEW_DRIFT_MS / Math.max(durationMs, 1));
  const onsetNear = onsetCandidates.some(candidate => Math.abs(candidate.bpm - integerBpm) <= validatorTolerance);
  const phaseNear = phaseCandidates.some(candidate => Math.abs(candidate.bpm - integerBpm) <= validatorTolerance);
  const familyNear = familyEstimates
    .filter(item => item.reliability >= 0.30 && Math.abs(item.bpm - integerBpm) <= Math.max(0.035, validatorTolerance * 1.5))
    .map(item => item.family);
  const validatorAgreement = onsetNear && phaseNear && new Set(familyNear).size >= 2;

  if (validatorAgreement && Math.abs(endDriftMs) <= NOMINAL_REVIEW_DRIFT_MS) {
    return {
      bpm: integerBpm,
      confidence: 0.92,
      reasons: [`ONSET+PHASE and ${new Set(familyNear).size} reliable package families resolve near ${integerBpm} BPM within ${NOMINAL_REVIEW_DRIFT_MS}ms end-drift gate`],
      quantizedFamilies: [...quantizedFamilies],
      validatorAgreement: true,
      mode: "DRIFT_VALIDATED",
      endDriftMs,
    };
  }

  if (quantizedFamilies.size) {
    const confidence = quantizedFamilies.size >= 2 ? 0.86 : 0.72;
    return {
      bpm: integerBpm,
      confidence,
      reasons: [`${[...quantizedFamilies].join(", ")} detected grid has repeated integer-spaced interval + local-window evidence; source PCM may run at a different speed from intended gameplay tempo`],
      quantizedFamilies: [...quantizedFamilies],
      validatorAgreement,
      mode: "QUANTIZED_SOURCE_MISMATCH",
      endDriftMs,
    };
  }

  return null;
}

function phaseConfidence(candidate: ValidatorCandidate | null) {
  if (!candidate) return 0.35;
  const driftQuality = candidate.driftMsPerSecond == null ? 0.55 : 1 / (1 + Math.abs(candidate.driftMsPerSecond) / 0.25);
  const support = candidate.supportRatio == null ? 0.65 : clamp(candidate.supportRatio, 0, 1);
  return clamp(clamp(candidate.score, 0, 1) * 0.5 + driftQuality * 0.3 + support * 0.2, 0, 1);
}

function metricalConfidence(top: FinalCandidate, runnerUp: FinalCandidate | undefined) {
  const gap = runnerUp ? Math.max(0, top.score - runnerUp.score) : 0.18;
  const gapQuality = clamp(gap / 0.16, 0, 1);
  return clamp(top.score * 0.48 + gapQuality * 0.24 + top.familyScore * 0.18 + top.detectedScore * 0.10, 0, 1);
}

function exactTempoConfidence(
  retainedFamilies: FamilyEstimate[],
  familyMad: number,
  durationMs: number,
  audioBpm: number,
  onset: ValidatorCandidate | null,
  phase: ValidatorCandidate | null,
) {
  const effectiveWeight = retainedFamilies.reduce((sum, item) => sum + item.weight, 0);
  const countQuality = clamp(effectiveWeight / 2.2, 0, 1);
  const spreadQuality = 1 / (1 + familyMad / 0.035);
  const validatorDeltas = [onset, phase].filter((item): item is ValidatorCandidate => item != null).map(item => Math.abs(item.bpm - audioBpm));
  const validatorSpread = validatorDeltas.length ? Math.max(...validatorDeltas) : 0.10;
  const validatorQuality = 1 / (1 + validatorSpread / 0.025);
  const robust95Bpm = Math.max(0.0015, familyMad * 2.5, validatorSpread * 1.35);
  const endDrift95Ms = durationMs > 0 && audioBpm > 0 ? durationMs * robust95Bpm / audioBpm : 999;
  const driftQuality = 1 / (1 + endDrift95Ms / 45);
  return {
    confidence: clamp(countQuality * 0.28 + spreadQuality * 0.25 + driftQuality * 0.27 + validatorQuality * 0.20, 0, 1),
    robust95Bpm,
    endDrift95Ms,
    validatorSpreadBpm: validatorSpread,
  };
}

function variableTempoEvidence(packageRows: RhythmEngineResult[]) {
  const variableFamilies = new Set<string>();
  const constantFamilies = new Set<string>();
  for (const row of packageRows) {
    if (row.kind !== "package" || row.beatGridKind !== "detected" || row.error || detectedQuality(row) < 0.55) continue;
    if (row.tempoMode === "VARIABLE") variableFamilies.add(row.engine);
    if (row.tempoMode === "CONSTANT") constantFamilies.add(row.engine);
  }
  return variableFamilies.size >= 2 && variableFamilies.size > constantFamilies.size;
}

function sourceSpeedStatus(audioBpm: number, nominal: NominalEvidence | null, snapToleranceBpm: number) {
  if (!nominal) return "NO_NOMINAL_EVIDENCE" as const;
  const delta = Math.abs(audioBpm - nominal.bpm);
  if (delta <= snapToleranceBpm) return "MATCH" as const;
  if (Math.abs(nominal.endDriftMs) <= NOMINAL_REVIEW_DRIFT_MS) return "REVIEW" as const;
  return "LIKELY_SOURCE_SPEED_MISMATCH" as const;
}

export async function runFinalRhythmEstimator(
  input: BenchmarkInput,
  packageRows: RhythmEngineResult[],
  autoGrid: RhythmEngineResult,
  phaseGrid: RhythmEngineResult,
  progress?: BenchmarkProgress,
): Promise<RhythmEngineResult> {
  const started = performance.now();
  try {
    progress?.("FINAL RHYTHM v3 · quality-gating exact tempo, nominal drift and gameplay anchor…");
    await yieldToBrowser();

    const votes = collectVotes(packageRows);
    const onsetCandidates = validatorCandidates(autoGrid, "onset");
    const phaseCandidates = validatorCandidates(phaseGrid, "phase");
    const ranked = buildFinalCandidates(votes, [...onsetCandidates, ...phaseCandidates]);
    const top = ranked[0];
    if (!top) throw new Error("No metrical candidate survived evidence fusion.");

    const familyEstimates = buildFamilyEstimates(packageRows, top.bpm);
    const exact = fuseExactAudioBpm(familyEstimates, onsetCandidates, phaseCandidates, top.bpm);
    const audioPulseBpm = exact.bpm;
    const durationMs = input.buffer.duration * 1000;
    const nominal = findNominalEvidence(packageRows, familyEstimates, onsetCandidates, phaseCandidates, top.bpm, audioPulseBpm, durationMs);
    const snapToleranceBpm = Math.max(0.003, audioPulseBpm * DRIFT_BUDGET_MS / Math.max(durationMs, 1));
    const speedStatus = sourceSpeedStatus(audioPulseBpm, nominal, snapToleranceBpm);
    const safeIntegerSnap = Boolean(nominal && Math.abs(nominal.endDriftMs) <= DRIFT_BUDGET_MS);
    const gameplayBpm = safeIntegerSnap && nominal ? nominal.bpm : audioPulseBpm;
    const playbackRateToNominal = nominal ? nominal.bpm / audioPulseBpm : null;
    const endDriftToNominalMs = nominal?.endDriftMs ?? null;

    const audioPhase = nearestValidator(phaseCandidates, audioPulseBpm) ?? nearestValidator(phaseCandidates, top.bpm);
    const authoredAnchor = finite(input.spaceStartMs) ? input.spaceStartMs : null;
    const gameplayAnchorMs = authoredAnchor ?? audioPhase?.phaseMs ?? nearestValidator(onsetCandidates, audioPulseBpm)?.phaseMs ?? 0;
    const anchorSource = authoredAnchor != null ? "AUTHORED SPACE #1" : audioPhase?.phaseMs != null ? "PHASE GRID" : "ONSET GRID/fallback";
    const beatTimesMs = synthesizeBeatGrid(gameplayAnchorMs / 1000, gameplayBpm, input.buffer.duration);

    const metricalConf = metricalConfidence(top, ranked[1]);
    const exactConf = exactTempoConfidence(exact.retainedFamilies, exact.familyMad, durationMs, audioPulseBpm, exact.onset, exact.phase);
    const phaseConf = phaseConfidence(audioPhase);
    const gameplayAnchorConf = authoredAnchor != null ? 1 : phaseConf * 0.65;
    const variable = variableTempoEvidence(packageRows);
    let overallConfidence = clamp(metricalConf * 0.34 + exactConf.confidence * 0.38 + phaseConf * 0.16 + gameplayAnchorConf * 0.12, 0, 1);
    if (variable) overallConfidence *= 0.62;
    if (speedStatus === "LIKELY_SOURCE_SPEED_MISMATCH") overallConfidence *= 0.92;
    const status = overallConfidence >= 0.88 ? "VERY HIGH" : overallConfidence >= 0.74 ? "HIGH" : overallConfidence >= 0.56 ? "MEDIUM" : "LOW";

    const familySummary = familyEstimates
      .sort((a, b) => b.weight - a.weight)
      .map(item => `${item.family}=${item.bpm.toFixed(4)}±${item.spreadBpm.toFixed(4)} rel=${Math.round(item.reliability * 100)}% w=${item.weight.toFixed(3)}`)
      .join(" · ");
    const ranking = ranked.slice(0, 5).map(candidate =>
      `${candidate.bpm.toFixed(3)} score=${candidate.score.toFixed(3)} families=${candidate.families.length} detected=${candidate.detectedScore.toFixed(2)} onset=${candidate.onsetScore.toFixed(2)} phase=${candidate.phaseScore.toFixed(2)}`,
    ).join(" > ");
    const nominalNote = nominal
      ? `Nominal candidate=${nominal.bpm.toFixed(0)} BPM (${Math.round(nominal.confidence * 100)}%, ${nominal.mode}): ${nominal.reasons.join("; ")}. Source-speed status=${speedStatus}; playbackRate-to-nominal=${playbackRateToNominal?.toFixed(6)}; nominal end-drift if unnormalized=${endDriftToNominalMs?.toFixed(1)}ms.`
      : "No nominal integer survives the v3 drift/evidence gate; decimal source tempo is retained without a source-speed warning.";
    const anchorNote = authoredAnchor != null
      ? `BPM selection and audio-phase validation do NOT use authored Space Start. The returned GAMEPLAY grid is intentionally phase-locked to authored SPACE #1=${authoredAnchor.toFixed(1)}ms.`
      : `No authored SPACE anchor supplied; gameplay grid falls back to audio phase ${gameplayAnchorMs.toFixed(1)}ms.`;

    const normalized = normalizeResult({
      id: "auto-grid-validator",
      engine: "FINAL RHYTHM",
      variant: `${variable ? "VARIABLE REVIEW" : "v3 quality-calibrated"} · ${status}`,
      version: VERSION,
      kind: "custom",
      beatGridKind: "validated",
      bpm: Number(gameplayBpm.toFixed(6)),
      confidence: overallConfidence,
      confidenceRaw: overallConfidence,
      confidenceScale: "Internal v3 calibrated confidence. Exact BPM is fused from reliability-weighted independent families plus long-baseline ONSET/PHASE validators; weak internal family disagreement reduces only that family's influence.",
      beatTimesMs,
      onsetTimesMs: autoGrid.onsetTimesMs ?? phaseGrid.onsetTimesMs,
      processingTimeMs: performance.now() - started,
      notes: `FINAL RHYTHM v3. Selected metrical cluster=${top.bpm.toFixed(4)} BPM; measured audioPulseBpm=${audioPulseBpm.toFixed(6)}; gameplayBpm=${gameplayBpm.toFixed(6)}${safeIntegerSnap ? " (safe intended-integer snap within 30ms end-of-track drift budget)" : ""}. Quality-gated independent-family evidence: ${familySummary || "n/a"}. Approx robust 95% exact envelope=±${exactConf.robust95Bpm.toFixed(4)} BPM => ${exactConf.endDrift95Ms.toFixed(1)}ms end-of-track uncertainty; validator spread=${exactConf.validatorSpreadBpm.toFixed(4)} BPM. Confidence components: metrical=${Math.round(metricalConf * 100)}%, exactTempo=${Math.round(exactConf.confidence * 100)}%, audioPhase=${Math.round(phaseConf * 100)}%, gameplayAnchor=${Math.round(gameplayAnchorConf * 100)}%. ${nominalNote} ${anchorNote} Candidate ranking: ${ranking}. ${variable ? "Multiple reliable detected-grid families report variable tempo: preserve detected beatTimes[]/human review." : "Tempo evidence is consistent with a constant source grid."}`,
      raw: {
        version: VERSION,
        status,
        variable,
        selectedMetricalBpm: top.bpm,
        audioPulseBpm,
        gameplayBpm,
        nominalBpmCandidate: nominal?.bpm ?? null,
        nominalConfidence: nominal?.confidence ?? null,
        nominalMode: nominal?.mode ?? null,
        nominalReasons: nominal?.reasons ?? [],
        sourceSpeedStatus: speedStatus,
        playbackRateToNominal,
        endDriftToNominalMs,
        driftBudgetMs: DRIFT_BUDGET_MS,
        nominalReviewDriftMs: NOMINAL_REVIEW_DRIFT_MS,
        snapToleranceBpm,
        safeIntegerSnap,
        audioPhaseMs: audioPhase?.phaseMs ?? null,
        audioPhaseDriftMsPerSecond: audioPhase?.driftMsPerSecond ?? null,
        gameplayAnchorMs,
        gameplayAnchorSource: anchorSource,
        metricalLevelConfidence: metricalConf,
        exactTempoConfidence: exactConf.confidence,
        phaseCoherenceConfidence: phaseConf,
        gameplayAnchorConfidence: gameplayAnchorConf,
        robust95FamilySpreadBpm: exactConf.robust95Bpm,
        robust95EndDriftMs: exactConf.endDrift95Ms,
        validatorSpreadBpm: exactConf.validatorSpreadBpm,
        familyEstimates: familyEstimates.map(item => ({
          family: item.family,
          bpm: item.bpm,
          spreadBpm: item.spreadBpm,
          reliability: item.reliability,
          weight: item.weight,
          observations: item.observations,
        })),
        retainedExactFamilies: exact.retainedFamilies.map(item => item.family),
        candidates: ranked,
        usesSpaceStartForBpm: false,
        usesSpaceStartForAudioPhase: false,
        usesSpaceStartForGameplayAnchor: authoredAnchor != null,
      },
    }, input);

    return variable ? { ...normalized, tempoMode: "VARIABLE" } : normalized;
  } catch (error) {
    return normalizeResult({
      id: "auto-grid-validator",
      engine: "FINAL RHYTHM",
      variant: "v3 quality-calibrated",
      version: VERSION,
      kind: "custom",
      beatGridKind: "none",
      bpm: null,
      confidence: null,
      beatTimesMs: [],
      processingTimeMs: performance.now() - started,
      error: error instanceof Error ? error.message : "Final rhythm estimator v3 failed",
      notes: "FINAL RHYTHM v3 failed independently. Package, ONSET GRID and PHASE GRID diagnostics remain available.",
    }, input);
  }
}
