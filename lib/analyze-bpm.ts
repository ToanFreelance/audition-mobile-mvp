import { spawn } from "node:child_process";
import ffmpegPath from "ffmpeg-static";
import { detect } from "@audio/beat";

export const BPM_SAMPLE_RATE = 22050;
const MAX_AUDIO_BYTES = 120 * 1024 * 1024;

function normalizeToDisplayedBpm(detected: number, displayed: number) {
  let value = detected;
  if (!Number.isFinite(value) || value <= 0) return displayed;
  if (!Number.isFinite(displayed) || displayed <= 0) return value;

  while (value > displayed * 1.45 && value / 2 >= 40) value /= 2;
  while (value < displayed / 1.45 && value * 2 <= 240) value *= 2;
  return value;
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
  const result = detect(mono, {
    fs: BPM_SAMPLE_RATE,
    minBpm: 40,
    maxBpm: 220,
  });

  const normalized = normalizeToDisplayedBpm(Number(result.bpm), displayedBpm);
  const BPM_exact = Number(normalized.toFixed(4));
  const confidence = Number.isFinite(result.confidence) ? Number(result.confidence.toFixed(4)) : 0;

  if (!Number.isFinite(BPM_exact) || BPM_exact <= 0) throw new Error("BPM analysis returned an invalid result.");

  return {
    BPM_exact,
    confidence,
    beatCount: result.beats.length,
  };
}
