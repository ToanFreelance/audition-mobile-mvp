import type { Chart, DanceTurn, Direction } from "./types";

const DIRECTIONS: Direction[] = ["left", "up", "down", "right"];
const LEVELS = 9;
const TOTAL_TURNS = 50;

// Manual song anchor. Set this once per song in the chart editor:
// this is the exact audio time (ms) where the first SPACE should be PERFECT (85%).
export const FIRST_PERFECT_MS = 8000;

const LEVEL_PATTERN = [1, 2, 3, 4, 5, 6, 7, 8, 9, 6, 7, 8, 9];

function directionsForTurn(turnIndex: number, level: number): Direction[] {
  return Array.from({ length: level }, (_, index) => {
    const seed = turnIndex * 11 + index * 7 + level * 3;
    return DIRECTIONS[seed % DIRECTIONS.length];
  });
}

function buildTurns(bpm: number): DanceTurn[] {
  const beatDurationMs = 60000 / bpm;
  const firstPerfectBeat = FIRST_PERFECT_MS / beatDurationMs;

  return Array.from({ length: TOTAL_TURNS }, (_, turnIndex) => {
    const level = Math.min(LEVELS, LEVEL_PATTERN[turnIndex % LEVEL_PATTERN.length]);
    const perfectBeat = firstPerfectBeat + turnIndex * 4;
    return {
      id: turnIndex,
      level,
      startBeat: perfectBeat - 4,
      directions: directionsForTurn(turnIndex, level),
    };
  });
}

function buildChart(id: string, title: string, bpm: number): Chart {
  const turns = buildTurns(bpm);
  const notes = turns.flatMap((turn) =>
    turn.directions.map((direction, index) => ({
      direction,
      beat: turn.startBeat + index * (4 / Math.max(1, turn.directions.length)),
    })),
  );

  return {
    id,
    title,
    bpm,
    offsetMs: 0,
    firstPerfectMs: FIRST_PERFECT_MS,
    notes,
    turns,
  };
}

/** Default timing-test chart. */
export function createDemoChart(): Chart {
  return buildChart("neon-audition-demo", "Neon Club", 128);
}

/** 80 BPM chart used by the supplied Please Tell Me Why audio. */
export function createPleaseTellMeWhyChart(): Chart {
  return buildChart("please-tell-me-why-audition-demo", "Please Tell Me Why", 80);
}

export const DEMO_CHART: Chart = createPleaseTellMeWhyChart();

export function sequenceForLevel(level: number): Direction[] {
  const safeLevel = Math.max(1, Math.min(LEVELS, level));
  const turn = DEMO_CHART.turns?.find((item) => item.level === safeLevel);
  return turn?.directions?.slice(0, safeLevel) ?? DIRECTIONS.slice(0, safeLevel);
}
