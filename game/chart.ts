import type { Chart, Direction } from "./types";

const DIRECTIONS: Direction[] = ["left", "up", "down", "right"];
const LEVELS = 9;
const NOTES_PER_LEVEL = 9;

export const DEMO_CHART: Chart = {
  id: "please-tell-me-why-audition-demo",
  title: "Please Tell Me Why",
  bpm: 80,
  offsetMs: 0,
  notes: Array.from({ length: LEVELS * NOTES_PER_LEVEL }, (_, index) => ({
    direction: DIRECTIONS[(index * 7 + 1) % DIRECTIONS.length],
    beat: index,
  })),
};

export function sequenceForLevel(level: number): Direction[] {
  const safeLevel = Math.max(1, Math.min(LEVELS, level));
  return Array.from({ length: safeLevel }, (_, index) => {
    const noteIndex = (safeLevel - 1) * NOTES_PER_LEVEL + index;
    return DEMO_CHART.notes[noteIndex]?.direction ?? DIRECTIONS[noteIndex % DIRECTIONS.length];
  });
}
