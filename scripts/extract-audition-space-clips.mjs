#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

function argValue(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

const source = argValue("--source");
const manifestPath = argValue("--manifest");
const outputDir = argValue("--out") ?? "tmp/audition-space-clips";
const execute = process.argv.includes("--execute");

if (!source || !manifestPath) {
  console.error(
    "Usage: node scripts/extract-audition-space-clips.mjs --source <video.mp4> --manifest <turns.json> [--out <dir>] [--execute]"
  );
  process.exit(1);
}

const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
const guard = Number(manifest.guardSeconds ?? 0);
const turns = Array.isArray(manifest.turns) ? manifest.turns : [];

if (!turns.length) {
  throw new Error("Manifest has no turns.");
}

fs.mkdirSync(outputDir, { recursive: true });

for (const turn of turns) {
  const start = Number(turn.spaceStartSec) + guard;
  const end = Number(turn.nextSpaceSec) - guard;

  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
    throw new Error(`Invalid turn timing for ${turn.id}`);
  }

  const duration = end - start;
  const fileName = `${turn.id}.mp4`;
  const outputPath = path.join(outputDir, fileName);

  const args = [
    "-hide_banner",
    "-loglevel", "error",
    "-ss", start.toFixed(6),
    "-i", source,
    "-t", duration.toFixed(6),
    "-map", "0:v:0",
    "-map", "0:a:0?",
    "-c:v", "libx264",
    "-preset", "medium",
    "-crf", "18",
    "-pix_fmt", "yuv420p",
    "-c:a", "aac",
    "-b:a", "192k",
    "-movflags", "+faststart",
    "-y",
    outputPath,
  ];

  const printable = ["ffmpeg", ...args]
    .map((part) => (part.includes(" ") ? JSON.stringify(part) : part))
    .join(" ");

  if (!execute) {
    console.log(printable);
    continue;
  }

  const result = spawnSync("ffmpeg", args, { stdio: "inherit" });
  if (result.status !== 0) {
    throw new Error(`ffmpeg failed for ${turn.id}`);
  }

  console.log(
    JSON.stringify({
      id: turn.id,
      startSec: start,
      endSec: end,
      durationSec: duration,
      output: outputPath,
    })
  );
}
