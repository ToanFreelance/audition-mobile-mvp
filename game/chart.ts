import type { Chart, DanceTurn, Direction } from "./types";

const DIRECTIONS: Direction[] = ["left", "up", "down", "right"];
const LEVELS = 9;
const TOTAL_TURNS = 50;

// Exact audio time (ms) where the first SPACE should be PERFECT (85%).
export const FIRST_PERFECT_MS = 8000;

const LEVEL_PATTERN = [1, 2, 3, 4, 5, 6, 7, 8, 9, 6, 7, 8, 9];

function randomIndex(max: number) {
  if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") {
    const values = new Uint32Array(1);
    crypto.getRandomValues(values);
    return values[0] % max;
  }
  return Math.floor(Math.random() * max);
}

/**
 * Generate a fresh arrow sequence for one turn.
 * The length is determined by the level; the actual arrows are random.
 * Avoiding an immediate duplicate keeps the sequence readable without
 * making it predictable or manually charted.
 */
export function randomDirections(level: number): Direction[] {
  const length = Math.max(1, Math.min(LEVELS, level));
  const result: Direction[] = [];

  for (let index = 0; index < length; index += 1) {
    let direction = DIRECTIONS[randomIndex(DIRECTIONS.length)];
    if (result.length > 0 && direction === result[result.length - 1]) {
      const alternatives = DIRECTIONS.filter((item) => item !== direction);
      direction = alternatives[randomIndex(alternatives.length)];
    }
    result.push(direction);
  }

  return result;
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
      directions: randomDirections(level),
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

/** Create a completely fresh chart while preserving the song/timing data. */
export function randomizeChart(source: Chart): Chart {
  const turns = (source.turns ?? []).map((turn) => ({
    ...turn,
    directions: randomDirections(turn.level),
  }));

  const notes = turns.flatMap((turn) =>
    turn.directions.map((direction, index) => ({
      direction,
      beat: turn.startBeat + index * (4 / Math.max(1, turn.directions.length)),
    })),
  );

  return { ...source, notes, turns };
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
