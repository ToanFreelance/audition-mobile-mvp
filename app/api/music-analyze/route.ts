import { NextRequest, NextResponse } from "next/server";
import { spawn } from "node:child_process";
import ffmpegPath from "ffmpeg-static";
import { detect } from "@audio/beat";

export const runtime = "nodejs";

const SAMPLE_RATE = 22050;
const MAX_AUDIO_BYTES = 120 * 1024 * 1024;

function normalizeToDisplayedBpm(detected: number, displayed: number) {
  let value = detected;
  if (!Number.isFinite(value) || value <= 0) return displayed;
  if (!Number.isFinite(displayed) || displayed <= 0) return value;

  // Tempo trackers can report a metrical octave (half/double tempo).
  // Keep the detected tempo closest to the human-facing BPM without changing
  // the measured fractional tempo within that octave.
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
      "-ar", String(SAMPLE_RATE),
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

export async function POST(request: NextRequest) {
  let body: { audioUrl?: string; bpm?: number };
  try {
    body = await request.json() as { audioUrl?: string; bpm?: number };
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const audioUrl = body.audioUrl?.trim();
  const displayedBpm = Number(body.bpm);
  if (!audioUrl || !/^https?:\/\//i.test(audioUrl)) {
    return NextResponse.json({ error: "A public audio URL is required." }, { status: 400 });
  }

  try {
    const response = await fetch(audioUrl, { cache: "no-store" });
    if (!response.ok) {
      return NextResponse.json({ error: "Audio download failed", detail: `HTTP ${response.status}` }, { status: 502 });
    }

    const contentLength = Number(response.headers.get("content-length") ?? 0);
    if (contentLength > MAX_AUDIO_BYTES) {
      return NextResponse.json({ error: "Audio file is too large for BPM analysis." }, { status: 413 });
    }

    const input = Buffer.from(await response.arrayBuffer());
    if (input.byteLength > MAX_AUDIO_BYTES) {
      return NextResponse.json({ error: "Audio file is too large for BPM analysis." }, { status: 413 });
    }

    const mono = await decodeToMonoPcm(input);
    const result = detect(mono, {
      fs: SAMPLE_RATE,
      minBpm: 40,
      maxBpm: 220,
    });

    const normalized = normalizeToDisplayedBpm(Number(result.bpm), displayedBpm);
    const bpmExact = Number(normalized.toFixed(4));
    const confidence = Number.isFinite(result.confidence) ? Number(result.confidence.toFixed(4)) : 0;

    if (!Number.isFinite(bpmExact) || bpmExact <= 0) {
      return NextResponse.json({ error: "BPM analysis returned an invalid result." }, { status: 422 });
    }

    return NextResponse.json({
      BPM_exact: bpmExact,
      confidence,
      beatCount: result.beats.length,
      sampleRate: SAMPLE_RATE,
    });
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : "BPM analysis failed",
    }, { status: 500 });
  }
}
