import type { Chart, Direction } from "./types";

const DIRECTIONS: Direction[] = ["left", "up", "down", "right"];
const LEVELS = 9;
const NOTES_PER_LEVEL = 9;

function buildChart(id: string, title: string, bpm: number): Chart {
  return {
    id,
    title,
    bpm,
    offsetMs: 0,
    notes: Array.from({ length: LEVELS * NOTES_PER_LEVEL }, (_, index) => ({
      direction: DIRECTIONS[(index * 7 + 1) % DIRECTIONS.length],
      beat: index,
    })),
  };
}

/** Default 128 BPM timing-test chart. */
export function createDemoChart(): Chart {
  return buildChart("neon-audition-demo", "Neon Club", 128);
}

/** 80 BPM chart used by the supplied Please Tell Me Why audio. */
export function createPleaseTellMeWhyChart(): Chart {
  return buildChart("please-tell-me-why-audition-demo", "Please Tell Me Why", 80);
}

/** Backwards-compatible chart constant for the current 80 BPM demo. */
export const DEMO_CHART: Chart = createPleaseTellMeWhyChart();

export function sequenceForLevel(level: number): Direction[] {
  const safeLevel = Math.max(1, Math.min(LEVELS, level));
  return Array.from({ length: safeLevel }, (_, index) => {
    const noteIndex = (safeLevel - 1) * NOTES_PER_LEVEL + index;
    return DEMO_CHART.notes[noteIndex]?.direction ?? DIRECTIONS[noteIndex % DIRECTIONS.length];
  });
}
