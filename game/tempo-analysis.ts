import { beatTrack, combTempo, tempo } from "@audio/beat";

type BeatTrackOptions = Parameters<typeof beatTrack>[1];
type TempoResult = Awaited<ReturnType<typeof tempo>>;
type TempoSource = "tempo" | "comb" | "beatTrack";

export type TempoCandidate = {
  bpm: number;
  source: TempoSource;
  confidence: number;
};

export type TempoAnalysis = {
  bpmExact: number;
  displayBpm: number;
  confidence: number;
  candidates: TempoCandidate[];
  beats: number[];
};

const finite = (values: ArrayLike<number> | undefined): number[] => {
  if (!values) return [];
  return Array.from(values).filter(Number.isFinite);
};

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

function isTempoSource(value: unknown): value is TempoSource {
  return value === "tempo" || value === "comb" || value === "beatTrack";
}

type TempoCluster = {
  center: number;
  members: TempoCandidate[];
  score: number;
};

function cluster(candidates: TempoCandidate[]): TempoCluster[] {
  const sorted = [...candidates].sort((a, b) => a.bpm - b.bpm);
  const clusters: TempoCluster[] = [];

  for (const candidate of sorted) {
    const current = clusters[clusters.length - 1];
    if (!current || Math.abs(candidate.bpm - current.center) > 0.8) {
      clusters.push({ center: candidate.bpm, members: [candidate], score: candidate.confidence });
      continue;
    }

    current.members.push(candidate);
    const weighted = current.members.reduce((sum, item) => sum + item.bpm * Math.max(0.01, item.confidence), 0);
    const weight = current.members.reduce((sum, item) => sum + Math.max(0.01, item.confidence), 0);
    current.center = weighted / weight;
    current.score = current.members.reduce((sum, item) => sum + Math.max(0.01, item.confidence), 0);
  }

  return clusters.sort((a, b) => b.score - a.score);
}

function fitPhaseToTempo(beats: number[], period: number): number {
  if (!beats.length || !Number.isFinite(period) || period <= 0) return 0;

  const phases = beats.map(time => ((time % period) + period) % period);
  let bestPhase = phases[0] ?? 0;
  let bestError = Number.POSITIVE_INFINITY;

  // Pick the phase that minimizes circular distance for the whole detected beat set.
  // This is more robust than trusting only beatTrack[0], especially after a noisy intro.
  for (const candidate of phases) {
    const error = phases.reduce((sum, phase) => {
      const distance = Math.abs(phase - candidate);
      return sum + Math.min(distance, period - distance) ** 2;
    }, 0);
    if (error < bestError) {
      bestError = error;
      bestPhase = candidate;
    }
  }

  return bestPhase;
}

function buildUniformBeatGrid(durationSeconds: number, bpm: number, phaseSeconds: number): number[] {
  if (!Number.isFinite(durationSeconds) || durationSeconds <= 0 || !Number.isFinite(bpm) || bpm <= 0) return [];

  const period = 60 / bpm;
  let phase = Number.isFinite(phaseSeconds) ? ((phaseSeconds % period) + period) % period : 0;

  // Extend the detected phase backwards so the grid covers the whole track.
  while (phase - period >= 0) phase -= period;

  const beats: number[] = [];
  for (let time = phase; time <= durationSeconds + 1e-6; time += period) {
    beats.push(Number(time.toFixed(6)));
  }
  return beats;
}

export async function analyzeTempo(audioUrl: string): Promise<TempoAnalysis> {
  if (typeof window === "undefined") throw new Error("Tempo analysis is browser-only.");

  const response = await fetch(audioUrl, { cache: "no-store" });
  if (!response.ok) throw new Error(`Không đọc được audio (HTTP ${response.status}).`);

  const bytes = await response.arrayBuffer();
  const AudioContextCtor =
    window.AudioContext ??
    (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextCtor) throw new Error("Thiết bị không hỗ trợ Web Audio API.");

  const context = new AudioContextCtor();

  try {
    const buffer = await context.decodeAudioData(bytes.slice(0));
    const channelCount = buffer.numberOfChannels;
    const length = buffer.length;
    const mono = new Float32Array(length);

    for (let channel = 0; channel < channelCount; channel += 1) {
      const source = buffer.getChannelData(channel);
      for (let index = 0; index < length; index += 1) mono[index] += source[index] / channelCount;
    }

    const baseOptions = { fs: buffer.sampleRate, minBpm: 40, maxBpm: 220 } as const;
    const tempoResult = tempo(mono, { ...baseOptions, candidates: 8 });
    const combResult = combTempo(mono, baseOptions);
    const detected = beatTrack(mono, baseOptions);

    const tempoCandidateValues = finite(
      (tempoResult as TempoResult & { candidates?: ArrayLike<number> }).candidates,
    );

    const candidates: TempoCandidate[] = [
      ...tempoCandidateValues.map((bpm): TempoCandidate => ({
        bpm,
        source: "tempo",
        confidence: Number(tempoResult.confidence) || 0,
      })),
      {
        bpm: Number(tempoResult.bpm),
        source: "tempo",
        confidence: Number(tempoResult.confidence) || 0,
      },
      {
        bpm: Number(combResult.bpm),
        source: "comb",
        confidence: Number(combResult.confidence) || 0,
      },
      {
        bpm: Number(detected.bpm),
        source: "beatTrack",
        confidence: Number(detected.confidence) || 0,
      },
    ].filter(
      (item): item is TempoCandidate =>
        Number.isFinite(item.bpm) && item.bpm >= 40 && item.bpm <= 220 && isTempoSource(item.source),
    );

    const bestCluster = cluster(candidates)[0];
    const tempoBpm = Number(tempoResult.bpm);
    const targetBpm = Number.isFinite(tempoBpm) && tempoBpm > 0
      ? tempoBpm
      : bestCluster?.center ?? Number(detected.bpm) ?? 120;

    const trackedOptions: BeatTrackOptions = {
      ...baseOptions,
      bpm: targetBpm,
      tightness: 5000,
    };
    const tracked = beatTrack(mono, trackedOptions);
    const trackedBeats = finite(tracked.beats);
    const period = 60 / targetBpm;
    const phaseSeconds = fitPhaseToTempo(trackedBeats, period);
    const beats = buildUniformBeatGrid(buffer.duration, targetBpm, phaseSeconds);
    const bpmExact = Number(clamp(targetBpm, 40, 220).toFixed(4));
    const displayBpm = Math.round(bpmExact);
    const confidence = Number(
      clamp(
        (Number(tempoResult.confidence) || 0) + (Number(combResult.confidence) || 0) * 0.25,
        0,
        1,
      ).toFixed(4),
    );

    return {
      bpmExact,
      displayBpm,
      confidence,
      candidates,
      beats,
    };
  } finally {
    await context.close().catch(() => undefined);
  }
}
