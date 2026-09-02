import { beatTrack, combTempo, tempo } from "@audio/beat";

export type TempoCandidate = {
  bpm: number;
  source: "tempo" | "comb" | "beatTrack";
  confidence: number;
};

export type TempoAnalysis = {
  bpmExact: number;
  displayBpm: number;
  confidence: number;
  candidates: TempoCandidate[];
  beats: number[];
};

function monoSamples(buffer: AudioBuffer) {
  if (buffer.numberOfChannels === 1) return buffer.getChannelData(0);
  const length = buffer.length;
  const output = new Float32Array(length);
  for (let i = 0; i < length; i += 1) {
    let sum = 0;
    for (let channel = 0; channel < buffer.numberOfChannels; channel += 1) {
      sum += buffer.getChannelData(channel)[i] ?? 0;
    }
    output[i] = sum / buffer.numberOfChannels;
  }
  return output;
}

function finite(values: ArrayLike<number> | undefined) {
  if (!values) return [];
  return Array.from(values).filter(value => Number.isFinite(value) && value > 0);
}

function regressionBpm(beats: number[], fallback: number) {
  if (beats.length < 8) return fallback;
  const start = Math.floor(beats.length * 0.1);
  const end = Math.ceil(beats.length * 0.9);
  const points = beats.slice(start, Math.max(start + 8, end));
  if (points.length < 8) return fallback;

  const xMean = (points.length - 1) / 2;
  const yMean = points.reduce((sum, value) => sum + value, 0) / points.length;
  let numerator = 0;
  let denominator = 0;
  for (let i = 0; i < points.length; i += 1) {
    const x = i - xMean;
    numerator += x * (points[i] - yMean);
    denominator += x * x;
  }
  if (denominator <= 0) return fallback;
  const secondsPerBeat = numerator / denominator;
  if (!Number.isFinite(secondsPerBeat) || secondsPerBeat <= 0) return fallback;
  return 60 / secondsPerBeat;
}

function median(values: number[]) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function cluster(values: TempoCandidate[]) {
  const clusters: Array<{ members: TempoCandidate[]; center: number }> = [];
  for (const candidate of values) {
    const existing = clusters.find(item => Math.abs(item.center - candidate.bpm) <= 0.8);
    if (existing) {
      existing.members.push(candidate);
      existing.center = median(existing.members.map(item => item.bpm));
    } else {
      clusters.push({ members: [candidate], center: candidate.bpm });
    }
  }
  return clusters.sort((a, b) => {
    const scoreA = a.members.length * 10 + a.members.reduce((sum, item) => sum + item.confidence, 0);
    const scoreB = b.members.length * 10 + b.members.reduce((sum, item) => sum + item.confidence, 0);
    return scoreB - scoreA;
  });
}

export async function analyzeTempo(audioUrl: string): Promise<TempoAnalysis> {
  if (typeof window === "undefined") throw new Error("Tempo analysis is browser-only.");

  const response = await fetch(audioUrl, { cache: "no-store" });
  if (!response.ok) throw new Error(`Không đọc được audio (HTTP ${response.status}).`);
  const bytes = await response.arrayBuffer();

  const AudioContextCtor = window.AudioContext ?? (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextCtor) throw new Error("Thiết bị không hỗ trợ Web Audio API.");

  const context = new AudioContextCtor();
  try {
    const buffer = await context.decodeAudioData(bytes.slice(0));
    const samples = monoSamples(buffer);
    const baseOptions = { fs: buffer.sampleRate, minBpm: 40, maxBpm: 220 } as const;

    const tempoResult = tempo(samples, { ...baseOptions, candidates: 8 });
    const combResult = combTempo(samples, baseOptions);
    const detected = beatTrack(samples, baseOptions);

    const rawTempoCandidates = finite((tempoResult as { candidates?: ArrayLike<number> }).candidates)
      .map(bpm => ({ bpm, source: "tempo" as const, confidence: Number(tempoResult.confidence) || 0 }));

    const candidates: TempoCandidate[] = [
      ...rawTempoCandidates,
      { bpm: Number(tempoResult.bpm), source: "tempo", confidence: Number(tempoResult.confidence) || 0 },
      { bpm: Number(combResult.bpm), source: "comb", confidence: Number(combResult.confidence) || 0 },
      { bpm: Number(detected.bpm), source: "beatTrack", confidence: Number(detected.confidence) || 0 },
    ].filter(item => Number.isFinite(item.bpm) && item.bpm >= 40 && item.bpm <= 220);

    const bestCluster = cluster(candidates)[0];
    const clusterCenter = bestCluster?.center || Number(tempoResult.bpm) || Number(detected.bpm) || 120;

    const tracked = beatTrack(samples, {
      ...baseOptions,
      bpm: clusterCenter,
      tightness: 900,
    });
    const beats = finite(tracked.beats);
    const fittedBpm = regressionBpm(beats, clusterCenter);
    const bpmExact = Number(Math.max(40, Math.min(220, fittedBpm)).toFixed(4));
    const displayBpm = Math.round(bpmExact);
    const confidence = Number(Math.min(1, Math.max(0, (Number(tracked.confidence) || 0) + (Number(combResult.confidence) || 0) * 0.25)).toFixed(4));

    return {
      bpmExact,
      displayBpm,
      confidence,
      candidates: cluster(candidates).slice(0, 6).map(item => ({
        bpm: Number(item.center.toFixed(4)),
        source: item.members[0]?.source ?? "tempo",
        confidence: Number((item.members.reduce((sum, member) => sum + member.confidence, 0) / item.members.length).toFixed(4)),
      })),
      beats,
    };
  } finally {
    if (context.state !== "closed") void context.close().catch(() => undefined);
  }
}
