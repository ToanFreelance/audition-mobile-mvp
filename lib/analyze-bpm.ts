import { spawn } from "node:child_process";
import ffmpegPath from "ffmpeg-static";
import { beatTrack, detect } from "@audio/beat";

export const BPM_SAMPLE_RATE = 22050;
const MAX_AUDIO_BYTES = 120 * 1024 * 1024;
const BPM_TOLERANCE = 0.12;

function regressionBpm(beats: number[], fallback: number) {
  if (beats.length < 4) return fallback;

  const start = Math.floor(beats.length * 0.1);
  const end = Math.ceil(beats.length * 0.9);
  const points = beats.slice(start, Math.max(start + 4, end));
  if (points.length < 4) return fallback;

  const xMean = (points.length - 1) / 2;
  const yMean = points.reduce((sum, value) => sum + value, 0) / points.length;
  let numerator = 0;
  let denominator = 0;
  for (let i = 0; i < points.length; i += 1) {
    const x = i - xMean;
    const y = points[i] - yMean;
    numerator += x * y;
    denominator += x * x;
  }

  if (denominator <= 0) return fallback;
  const secondsPerBeat = numerator / denominator;
  if (!Number.isFinite(secondsPerBeat) || secondsPerBeat <= 0) return fallback;
  return 60 / secondsPerBeat;
}

function constrainedRange(displayed: number) {
  const safe = Number.isFinite(displayed) && displayed > 0 ? displayed : 80;
  return {
    minBpm: Math.max(40, safe * (1 - BPM_TOLERANCE)),
    maxBpm: Math.min(220, safe * (1 + BPM_TOLERANCE)),
    hint: safe,
  };
}

function decodeToMonoPcm(input: Buffer) {
  return new Promise<Float32Array>((resolve, reject) => {
    if (!ffmpegPath) {
      reject(new Error("ffmpeg binary is unavailable on this deployment."));
      return;
    }

    const child = spawn(ffmpegPath, [
      "-hide_banner",
      "-loglevel", "error",
      "-i", "pipe:0",
      "-f", "f32le",
      "-ac", "1",
      "-ar", String(BPM_SAMPLE_RATE),
      "pipe:1",
    ]);

    const chunks: Buffer[] = [];
    const errors: Buffer[] = [];
    child.stdout.on("data", (chunk: Buffer) => chunks.push(chunk));
    child.stderr.on("data", (chunk: Buffer) => errors.push(chunk));
    child.on("error", reject);
    child.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(Buffer.concat(errors).toString("utf8") || `ffmpeg exited with ${code}`));
        return;
      }
      const pcm = Buffer.concat(chunks);
      if (pcm.byteLength < 16) {
        reject(new Error("ffmpeg returned no PCM audio."));
        return;
      }
      resolve(new Float32Array(pcm.buffer, pcm.byteOffset, Math.floor(pcm.byteLength / 4)));
    });

    child.stdin.end(input);
  });
}

export async function analyzeAudioBpm(audioUrl: string, displayedBpm: number) {
  const response = await fetch(audioUrl, { cache: "no-store" });
  if (!response.ok) throw new Error(`Audio download failed (HTTP ${response.status}).`);

  const contentLength = Number(response.headers.get("content-length") ?? 0);
  if (contentLength > MAX_AUDIO_BYTES) throw new Error("Audio file is too large for BPM analysis.");

  const input = Buffer.from(await response.arrayBuffer());
  if (input.byteLength > MAX_AUDIO_BYTES) throw new Error("Audio file is too large for BPM analysis.");

  const mono = await decodeToMonoPcm(input);
  const range = constrainedRange(displayedBpm);

  // The displayed BPM defines the musical meter family. The tracker is allowed
  // to refine the exact tempo only inside a narrow neighborhood so percussion
  // subdivisions cannot turn an 80 BPM song into a different metrical tempo.
  const tracked = beatTrack(mono, {
    fs: BPM_SAMPLE_RATE,
    minBpm: range.minBpm,
    maxBpm: range.maxBpm,
    bpm: range.hint,
    tightness: 1800,
  });

  let BPM_exact = regressionBpm(
    Array.from(tracked.beats).filter(Number.isFinite),
    Number(tracked.bpm),
  );

  if (!Number.isFinite(BPM_exact) || BPM_exact <= 0 || BPM_exact < range.minBpm || BPM_exact > range.maxBpm) {
    const fallback = detect(mono, {
      fs: BPM_SAMPLE_RATE,
      minBpm: range.minBpm,
      maxBpm: range.maxBpm,
    });
    BPM_exact = Number(fallback.bpm);
  }

  BPM_exact = Math.min(range.maxBpm, Math.max(range.minBpm, BPM_exact));
  BPM_exact = Number(BPM_exact.toFixed(4));

  const confidence = Number.isFinite(tracked.confidence) ? Number(tracked.confidence.toFixed(4)) : 0;
  const beatCount = ArrayBuffer.isView(tracked.beats) ? tracked.beats.length : 0;

  if (!Number.isFinite(BPM_exact) || BPM_exact <= 0) throw new Error("BPM analysis returned an invalid result.");

  return {
    BPM_exact,
    confidence,
    beatCount,
  };
}
