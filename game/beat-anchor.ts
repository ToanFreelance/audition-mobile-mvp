import { beatTrack } from "@audio/beat";

export type BeatAnchor = {
  index: number;
  ms: number;
  beatIndex: number;
};

export type FourBeatAnalysis = {
  bpm: number;
  confidence: number;
  beats: number[];
  anchors: BeatAnchor[];
};

function monoSamples(buffer: AudioBuffer) {
  if (buffer.numberOfChannels === 1) return buffer.getChannelData(0);

  const length = buffer.length;
  const output = new Float32Array(length);
  const channels = Array.from({ length: buffer.numberOfChannels }, (_, index) => buffer.getChannelData(index));
  const divisor = channels.length || 1;

  for (let i = 0; i < length; i += 1) {
    let sum = 0;
    for (const channel of channels) sum += channel[i] ?? 0;
    output[i] = sum / divisor;
  }

  return output;
}

function closeAudioContext(context: AudioContext) {
  if (context.state !== "closed") void context.close().catch(() => undefined);
}

export async function analyzeFourBeatAnchors(audioUrl: string, bpmHint?: number): Promise<FourBeatAnalysis> {
  if (typeof window === "undefined") throw new Error("Beat analysis is browser-only.");

  const response = await fetch(audioUrl, { cache: "no-store" });
  if (!response.ok) throw new Error(`Không đọc được audio (HTTP ${response.status}).`);

  const bytes = await response.arrayBuffer();
  const AudioContextCtor = window.AudioContext ?? (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextCtor) throw new Error("Thiết bị không hỗ trợ Web Audio API.");

  const context = new AudioContextCtor();
  try {
    const buffer = await context.decodeAudioData(bytes.slice(0));
    const samples = monoSamples(buffer);
    const result = beatTrack(samples, {
      fs: buffer.sampleRate,
      minBpm: 40,
      maxBpm: 220,
      ...(Number.isFinite(bpmHint) && (bpmHint ?? 0) > 0 ? { bpm: bpmHint } : {}),
    });

    const beats = Array.from(result.beats)
      .filter(Number.isFinite)
      .map(seconds => Math.max(0, Number(seconds)));

    const anchors: BeatAnchor[] = [];
    for (let beatIndex = 0; beatIndex < beats.length; beatIndex += 4) {
      const seconds = beats[beatIndex];
      if (!Number.isFinite(seconds)) continue;
      anchors.push({
        index: anchors.length,
        ms: Math.round(seconds * 1000),
        beatIndex,
      });
    }

    return {
      bpm: Number(result.bpm),
      confidence: Number.isFinite(result.confidence) ? Number(result.confidence) : 0,
      beats,
      anchors,
    };
  } finally {
    closeAudioContext(context);
  }
}
