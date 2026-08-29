import type { Chart, Direction, Note } from "./types";

const directions: Direction[] = ["left", "up", "down", "right"];

function buildNotes(startBeat: number, totalNotes: number, pattern: Direction[]): Note[] {
  return Array.from({ length: totalNotes }, (_, index) => ({
    id: index + 1,
    beat: startBeat + index * 0.5,
    direction: pattern[index % pattern.length]
  }));
}

export function createDemoChart(): Chart {
  const pattern: Direction[] = [
    "left", "up", "down", "right",
    "left", "right", "up", "down"
  ];

  return {
    title: "Neon Groove — Prototype",
    bpm: 128,
    offsetMs: 0,
    notes: buildNotes(4, 128, pattern)
  };
}

/**
 * Slow timing reference for manual QA.
 * Please Tell Me Why by Freestyle is widely documented at 80 BPM.
 * The repository does not bundle the copyrighted recording; this chart
 * uses the title/BPM and an equivalent test command pattern so the timing
 * engine can be checked against a slow 80 BPM reference.
 */
export function createPleaseTellMeWhyChart(): Chart {
  const pattern: Direction[] = [
    "left", "up", "right", "down",
    "left", "right", "up", "down"
  ];

  return {
    title: "Please Tell Me Why — Timing Test",
    bpm: 80,
    offsetMs: 0,
    notes: buildNotes(4, 128, pattern)
  };
}

export const CHARTS = {
  neon: createDemoChart,
  pleaseTellMeWhy: createPleaseTellMeWhyChart
} as const;
