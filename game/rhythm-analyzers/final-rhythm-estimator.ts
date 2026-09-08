import { clamp, median, normalizeResult, synthesizeBeatGrid } from "./metrics";
import type { BenchmarkInput, BenchmarkProgress, RhythmEngineResult } from "./types";

const VERSION = "internal-v1";
const MIN_BPM = 55;
const MAX_BPM = 210;
const CLUSTER_RELATIVE_TOLERANCE = 0.012;
const MATCH_RELATIVE_TOLERANCE = 0.014;
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

type ExactEstimate = {
  bpm: number;
  weight: number;
  family: string;
  label: string;
};

type StrongDetectedSnap = {
  row: RhythmEngineResult;
  multiplier: number;
  longLagBpm: number;
  localMedianBpm: number;
};

function finite(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function relativeDistance(a: number, b: number) {
  return Math.abs(a - b) / Math.max(1, Math.abs(b));
}

function weightedMedian(values: ExactEstimate[]) {
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

function weightedMad(values: ExactEstimate[], center: number) {
  const deviations = values.map(item => ({ ...item, bpm: Math.abs(item.bpm - center) }));
  return weightedMedian(deviations);
}

function percentile(values: number[], q: number) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const index = clamp(Math.round((sorted.length - 1) * q), 0, sorted.length - 1);
  return sorted[index] ?? null;
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

function stableLocalMedian(row: RhythmEngineResult) {
  const windows = row.localTempo.filter(window =>
    window.bpm != null && Number.isFinite(window.bpm) && window.beatCount >= 8 && window.endMs - window.startMs >= 20_000,
  );
  if (windows.length < 3) return null;
  return median(windows.map(window => window.bpm as number));
}

function detectedQuality(row: RhythmEngineResult) {
  if (row.beatGridKind !== "detected" || row.beatTimesMs.length < 16) return 0;
  const jitter = row.intervalJitterMs ?? 80;
  const jitterQuality = clamp(1 - Math.max(0, jitter - 4) / 60, 0.25, 1);
  const span = (row.beatTimesMs[row.beatTimesMs.length - 1] ?? 0) - (row.beatTimesMs[0] ?? 0);
  const spanQuality = clamp(span / 150_000, 0.35, 1);
  const modeQuality = row.tempoMode === "CONSTANT" ? 1 : row.tempoMode === "UNKNOWN" ? 0.75 : 0.45;
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
    const transformWeight = metricalWeight(rawBpm, hypothesis.value, row);
    votes.push({
      family: row.engine,
      sourceId: row.id,
      label: `${row.engine} · ${row.variant}${suffix} ${hypothesis.label}`,
      rawBpm,
      bpm,
      multiplier: hypothesis.value,
      weight: signalWeight * transformWeight,
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
    if (quality > 0) {
      if (finite(row.derivedBpmFromIntervals) && row.derivedBpmFromIntervals > 0) {
        votes.push(...candidateMappings(row.derivedBpmFromIntervals, row, 0.72 * quality, true, " intervals"));
      }
      const local = stableLocalMedian(row);
      if (local) votes.push(...candidateMappings(local, row, 0.78 * quality, true, " local"));
      for (const lag of [8, 16, 32, 64]) {
        const bpm = longLagBpm(row.beatTimesMs, lag);
        if (bpm) votes.push(...candidateMappings(bpm, row, (0.72 + Math.min(lag, 64) / 320) * quality, true, ` lag${lag}`));
      }
      const raw = rowRaw(row);
      const longSpan = raw.longSpanBpm;
      if (finite(longSpan) && longSpan > 0) votes.push(...candidateMappings(longSpan, row, 0.92 * quality, true, " long-span"));
    }
  }
  return votes;
}

function validatorCandidates(row: RhythmEngineResult, source: "onset" | "phase"): ValidatorCandidate[] {
  const raw = rowRaw(row);
  const candidates = Array.isArray(raw.candidates) ? raw.candidates : [];
  return candidates.flatMap(item => {
    if (!item || typeof item !== "object") return [];
    const value = item as Record<string, unknown>;
    const bpm = value.bpm;
    const score = value.score;
    if (!finite(bpm) || !finite(score)) return [];
    const supportRatio = finite(value.supportRatio) ? value.supportRatio : null;
    const drift = finite(value.phaseDriftMsPerSecond) ? value.phaseDriftMsPerSecond : null;
    const phaseMs = finite(value.phaseMs) ? value.phaseMs : null;
    return [{ bpm, score, supportRatio, driftMsPerSecond: drift, phaseMs, source }];
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

function nearestValidator(candidates: ValidatorCandidate[], bpm: number) {
  let best: ValidatorCandidate | null = null;
  for (const candidate of candidates) {
    if (relativeDistance(candidate.bpm, bpm) > MATCH_RELATIVE_TOLERANCE) continue;
    if (!best || Math.abs(candidate.bpm - bpm) < Math.abs(best.bpm - bpm)) best = candidate;
  }
  return best;
}

function buildFinalCandidates(votes: MetricalVote[], validators: ValidatorCandidate[]) {
  const families = [...new Set(votes.map(vote => vote.family))];
  const onset = validators.filter(candidate => candidate.source === "onset");
  const phase = validators.filter(candidate => candidate.source === "phase");
  const centers = clusterCenters(votes, validators);
  const candidates: FinalCandidate[] = [];

  for (const bpm of centers) {
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
    const driftQuality = phaseMatch?.driftMsPerSecond == null
      ? 0.55
      : 1 / (1 + Math.abs(phaseMatch.driftMsPerSecond) / 0.45);
    const phaseScore = phaseMatch ? clamp(phaseMatch.score * (0.55 + 0.45 * driftQuality), 0, 1) : 0;

    const score =
      familyScore * 0.38 +
      detectedScore * 0.24 +
      onsetScore * 0.16 +
      phaseScore * 0.17 +
      directScore * 0.05;

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

function exactEstimates(packageRows: RhythmEngineResult[], autoGrid: RhythmEngineResult, phaseGrid: RhythmEngineResult, targetBpm: number) {
  const estimates: ExactEstimate[] = [];
  const add = (rawBpm: number | null, row: RhythmEngineResult, weight: number, label: string) => {
    if (!rawBpm || !Number.isFinite(rawBpm) || rawBpm <= 0) return;
    const mapped = bestMultiplierToTarget(rawBpm, targetBpm);
    if (!mapped || relativeDistance(mapped.mapped, targetBpm) > MATCH_RELATIVE_TOLERANCE) return;
    estimates.push({
      bpm: mapped.mapped,
      weight: weight * metricalWeight(rawBpm, mapped.value, row),
      family: row.engine,
      label: `${label} ${mapped.label}`,
    });
  };

  for (const row of packageRows) {
    if (row.kind !== "package" || row.error) continue;
    add(row.bpm, row, 0.8, `${row.engine} tempo`);
    const quality = detectedQuality(row);
    if (quality > 0) {
      add(row.derivedBpmFromIntervals, row, 0.75 * quality, `${row.engine} interval median`);
      const local = stableLocalMedian(row);
      add(local, row, 0.9 * quality, `${row.engine} local median`);
      for (const lag of [16, 32, 64]) add(longLagBpm(row.beatTimesMs, lag), row, (0.9 + lag / 400) * quality, `${row.engine} lag${lag}`);
      const raw = rowRaw(row);
      add(finite(raw.longSpanBpm) ? raw.longSpanBpm : null, row, 1.0 * quality, `${row.engine} long-span`);
    }
  }

  for (const row of [autoGrid, phaseGrid]) {
    if (row.bpm && !row.error) add(row.bpm, row, row.id === "phase-grid-validator" ? 0.95 : 0.85, row.engine);
  }

  return estimates;
}

function acceptedDiagnosticFit(rows: RhythmEngineResult[], targetBpm: number): ExactEstimate | null {
  const row = rows.find(item => item.id === "music-tempo-beatroot-robust-fit");
  if (!row?.bpm || row.error) return null;
  const raw = rowRaw(row);
  const rmse = raw.rmseMs;
  const p90 = raw.p90Ms;
  const inlierRatio = raw.inlierRatio;
  const spanMs = raw.spanMs;
  if (!finite(rmse) || !finite(p90) || !finite(inlierRatio) || !finite(spanMs)) return null;
  if (rmse > 18 || p90 > 35 || inlierRatio < 0.65 || spanMs < 120_000) return null;
  const mapped = bestMultiplierToTarget(row.bpm, targetBpm);
  if (!mapped || relativeDistance(mapped.mapped, targetBpm) > MATCH_RELATIVE_TOLERANCE) return null;
  return {
    bpm: mapped.mapped,
    weight: 1.1 * clamp(1 - rmse / 24, 0.3, 1),
    family: "music-tempo-fit",
    label: `accepted Beatroot robust fit ${mapped.label}`,
  };
}

function strongDetectedIntegerSnap(packageRows: RhythmEngineResult[], targetBpm: number, integerBpm: number): StrongDetectedSnap | null {
  for (const row of packageRows) {
    if (row.kind !== "package" || row.beatGridKind !== "detected" || row.error || !row.bpm) continue;
    const mapped = bestMultiplierToTarget(row.bpm, targetBpm);
    if (!mapped || relativeDistance(mapped.mapped, targetBpm) > MATCH_RELATIVE_TOLERANCE) continue;
    const lag32 = longLagBpm(row.beatTimesMs, 32) ?? longLagBpm(row.beatTimesMs, 16);
    const local = stableLocalMedian(row);
    if (!lag32 || !local) continue;
    const mappedLag = lag32 * mapped.value;
    const mappedLocal = local * mapped.value;
    const substantial = row.localTempo.filter(window => window.bpm != null && window.beatCount >= 8 && window.endMs - window.startMs >= 20_000);
    const stableWindows = substantial.filter(window => Math.abs((window.bpm as number) * mapped.value - integerBpm) <= 0.08).length;
    if (
      Math.abs(mappedLag - integerBpm) <= 0.06 &&
      Math.abs(mappedLocal - integerBpm) <= 0.04 &&
      stableWindows >= 4 &&
      (row.intervalJitterMs ?? 100) <= 20
    ) {
      return { row, multiplier: mapped.value, longLagBpm: mappedLag, localMedianBpm: mappedLocal };
    }
  }
  return null;
}

function familyCountNearInteger(votes: MetricalVote[], integerBpm: number) {
  const families = new Set<string>();
  for (const vote of votes) {
    if (vote.weight >= 0.65 && Math.abs(vote.bpm - integerBpm) <= 0.08) families.add(vote.family);
  }
  return families.size;
}

function fitDetectedPhase(row: RhythmEngineResult, bpm: number) {
  if (!row.beatTimesMs.length || !Number.isFinite(bpm) || bpm <= 0) return null;
  const interval = 60000 / bpm;
  const samples = row.beatTimesMs.slice(0, Math.min(180, row.beatTimesMs.length));
  if (!samples.length) return null;
  const phases = samples.map(time => ((time % interval) + interval) % interval);
  let bestPhase = phases[0] ?? 0;
  let bestCost = Number.POSITIVE_INFINITY;
  for (const phase of phases.slice(0, 64)) {
    let cost = 0;
    for (const value of phases) {
      let delta = Math.abs(value - phase);
      delta = Math.min(delta, interval - delta);
      cost += Math.min(delta, 80);
    }
    if (cost < bestCost) {
      bestCost = cost;
      bestPhase = phase;
    }
  }
  return bestPhase;
}

function choosePhase(
  bpm: number,
  strongDetected: StrongDetectedSnap | null,
  phaseCandidates: ValidatorCandidate[],
  onsetCandidates: ValidatorCandidate[],
) {
  if (strongDetected && strongDetected.multiplier === 1) {
    const phase = fitDetectedPhase(strongDetected.row, bpm);
    if (phase != null) return { phaseMs: phase, source: `${strongDetected.row.engine} detected grid` };
  }
  const phase = nearestValidator(phaseCandidates, bpm);
  if (phase?.phaseMs != null) return { phaseMs: phase.phaseMs, source: "PHASE GRID" };
  const onset = nearestValidator(onsetCandidates, bpm);
  if (onset?.phaseMs != null) return { phaseMs: onset.phaseMs, source: "ONSET GRID" };
  return { phaseMs: 0, source: "zero phase fallback" };
}

function variableTempoEvidence(packageRows: RhythmEngineResult[]) {
  const variableFamilies = new Set<string>();
  const constantFamilies = new Set<string>();
  for (const row of packageRows) {
    if (row.kind !== "package" || row.beatGridKind !== "detected" || row.error) continue;
    if (detectedQuality(row) < 0.55) continue;
    if (row.tempoMode === "VARIABLE") variableFamilies.add(row.engine);
    if (row.tempoMode === "CONSTANT") constantFamilies.add(row.engine);
  }
  return variableFamilies.size >= 2 && variableFamilies.size > constantFamilies.size;
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
    progress?.("FINAL RHYTHM · fusing metrical hypotheses + long-baseline evidence…");
    await yieldToBrowser();

    const votes = collectVotes(packageRows);
    const onsetCandidates = validatorCandidates(autoGrid, "onset");
    const phaseCandidates = validatorCandidates(phaseGrid, "phase");
    const validators = [...onsetCandidates, ...phaseCandidates];
    const ranked = buildFinalCandidates(votes, validators);
    const top = ranked[0];
    if (!top) throw new Error("No metrical candidate survived evidence fusion.");

    const estimates = exactEstimates(packageRows, autoGrid, phaseGrid, top.bpm);
    const acceptedFit = acceptedDiagnosticFit(packageRows, top.bpm);
    if (acceptedFit) estimates.push(acceptedFit);
    let exactBpm = weightedMedian(estimates) ?? top.bpm;

    const nearestInteger = Math.round(exactBpm);
    const strongDetected = Math.abs(exactBpm - nearestInteger) <= 0.45
      ? strongDetectedIntegerSnap(packageRows, top.bpm, nearestInteger)
      : null;
    const onsetNearInteger = onsetCandidates.some(candidate => Math.abs(candidate.bpm - nearestInteger) <= 0.05);
    const phaseNearInteger = phaseCandidates.some(candidate => Math.abs(candidate.bpm - nearestInteger) <= 0.05);
    const familiesNearInteger = familyCountNearInteger(votes, nearestInteger);
    const validatorIntegerAgreement = onsetNearInteger && phaseNearInteger && familiesNearInteger >= 2;
    const snappedToIntendedInteger = Boolean(strongDetected || validatorIntegerAgreement);
    if (snappedToIntendedInteger) exactBpm = nearestInteger;

    const phase = choosePhase(exactBpm, strongDetected, phaseCandidates, onsetCandidates);
    const beatTimesMs = synthesizeBeatGrid(phase.phaseMs / 1000, exactBpm, input.buffer.duration);
    const runnerUp = ranked[1];
    const gap = runnerUp ? Math.max(0, top.score - runnerUp.score) : 0.18;
    const gapQuality = clamp(gap / 0.16, 0, 1);
    const mad = weightedMad(estimates, exactBpm) ?? 1;
    const precisionQuality = clamp(1 - mad / 0.45, 0, 1);
    const confidence = clamp(
      top.score * 0.42 +
      gapQuality * 0.20 +
      top.familyScore * 0.18 +
      top.detectedScore * 0.10 +
      precisionQuality * 0.10,
      0,
      1,
    );
    const variable = variableTempoEvidence(packageRows);
    const adjustedConfidence = variable ? confidence * 0.65 : confidence;
    const status = adjustedConfidence >= 0.84 ? "VERY HIGH" : adjustedConfidence >= 0.70 ? "HIGH" : adjustedConfidence >= 0.52 ? "MEDIUM" : "LOW";
    const ranking = ranked.slice(0, 5).map(candidate =>
      `${candidate.bpm.toFixed(3)} score=${candidate.score.toFixed(3)} families=${candidate.families.length} detected=${candidate.detectedScore.toFixed(2)} onset=${candidate.onsetScore.toFixed(2)} phase=${candidate.phaseScore.toFixed(2)}`,
    ).join(" > ");
    const estimateSummary = estimates
      .sort((a, b) => b.weight - a.weight)
      .slice(0, 8)
      .map(item => `${item.bpm.toFixed(4)}(${item.label})`)
      .join(" · ");
    const snapReason = strongDetected
      ? `intended-integer snap confirmed by ${strongDetected.row.engine} long-lag ${strongDetected.longLagBpm.toFixed(4)} + local ${strongDetected.localMedianBpm.toFixed(4)} BPM`
      : validatorIntegerAgreement
        ? `intended-integer snap confirmed by ONSET+PHASE and ${familiesNearInteger} package families`
        : "no integer snap; retaining evidence-weighted decimal tempo";

    const normalized = normalizeResult({
      id: "auto-grid-validator",
      engine: "FINAL RHYTHM",
      variant: `${variable ? "VARIABLE REVIEW" : "metrical selector"} · ${status}`,
      version: VERSION,
      kind: "custom",
      beatGridKind: "validated",
      bpm: Number(exactBpm.toFixed(6)),
      confidence: adjustedConfidence,
      confidenceRaw: adjustedConfidence,
      confidenceScale: "Internal evidence-fusion confidence; package family agreement + detected long-baseline + onset + phase drift.",
      beatTimesMs,
      onsetTimesMs: autoGrid.onsetTimesMs ?? phaseGrid.onsetTimesMs,
      processingTimeMs: performance.now() - started,
      notes: `FINAL zero-mark rhythm estimator. Selects metrical level before exact BPM instead of trusting the strongest onset periodicity. Winner=${top.bpm.toFixed(4)} BPM metrical cluster; final=${exactBpm.toFixed(6)} BPM; ${snapReason}; phase=${phase.phaseMs.toFixed(2)}ms from ${phase.source}. Weighted exact-estimate MAD=${mad.toFixed(4)} BPM. Candidate ranking: ${ranking}. Exact evidence: ${estimateSummary || "n/a"}. ${variable ? "Multiple independent detected-grid families report variable tempo; keep this result for review and prefer explicit beatTimes[] before production." : "Tempo evidence is consistent with a constant gameplay grid."} Does NOT use authored Space Start to choose BPM or phase.`,
      raw: {
        status,
        variable,
        selectedMetricalBpm: top.bpm,
        finalBpm: exactBpm,
        snappedToIntendedInteger,
        snapReason,
        phase,
        candidates: ranked,
        exactEstimates: estimates,
        exactEstimateMadBpm: mad,
        acceptedDiagnosticFit: acceptedFit,
        strongDetectedSnap: strongDetected ? {
          rowId: strongDetected.row.id,
          engine: strongDetected.row.engine,
          multiplier: strongDetected.multiplier,
          longLagBpm: strongDetected.longLagBpm,
          localMedianBpm: strongDetected.localMedianBpm,
        } : null,
        usesSpaceStart: false,
      },
    }, input);

    return variable ? { ...normalized, tempoMode: "VARIABLE" } : normalized;
  } catch (error) {
    return normalizeResult({
      id: "auto-grid-validator",
      engine: "FINAL RHYTHM",
      variant: "metrical selector",
      version: VERSION,
      kind: "custom",
      beatGridKind: "none",
      bpm: null,
      confidence: null,
      beatTimesMs: [],
      processingTimeMs: performance.now() - started,
      error: error instanceof Error ? error.message : "Final rhythm estimator failed",
      notes: "FINAL RHYTHM failed independently. Package, onset-grid and phase-grid benchmark rows remain available.",
    }, input);
  }
}
