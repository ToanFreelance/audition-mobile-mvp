import type { Chart, DanceTurn, Direction } from "./types";

const DIRECTIONS: Direction[] = ["left", "up", "down", "right"];
const MAX_LEVEL = 9;

// Observed from the supplied Audition 80 BPM replay:
// Level 1 = 1 turn, Level 2 = 2, Level 3 = 3, Level 4 = 4,
// Level 5 = 4, Level 6 = 6, Level 7 = 6.
// The supplied replay then enters Finish Move.  The generic 4-key
// choreography plan is also kept here for future songs/modes.
export const OBSERVED_80BPM_LEVEL_TURNS = [1, 2, 3, 4, 4, 6, 6] as const;
export const STANDARD_4KEY_LEVEL_TURNS = [1, 2, 3, 4, 5, 6, 6, 6, 6] as const;

// Absolute audio time where the first SPACE target is PERFECT (85%).
// This is intentionally manual per song because intros vary.
export const FIRST_PERFECT_MS = 8000;

function randomIndex(max: number) {
  if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") {
    const values = new Uint32Array(1);
    crypto.getRandomValues(values);
    return values[0] % max;
  }
  return Math.floor(Math.random() * max);
}

/**
 * Generate a fresh sequence every time a song starts.
 * Level 6-9 use six arrow commands in standard 4-key choreography;
 * the level number is NOT the arrow count above level 5.
 */
export function randomDirections(level: number): Direction[] {
  const length = Math.max(1, Math.min(6, level));
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

function buildTurns(bpm: number, levelTurnCounts: readonly number[]) {
  const beatDurationMs = 60000 / bpm;
  const firstPerfectBeat = FIRST_PERFECT_MS / beatDurationMs;
  const turns: DanceTurn[] = [];
  let id = 0;

  levelTurnCounts.forEach((turnCount, levelIndex) => {
    const level = levelIndex + 1;
    for (let turnInLevel = 0; turnInLevel < turnCount; turnInLevel += 1) {
      const perfectBeat = firstPerfectBeat + id * 4;
      turns.push({
        id,
        level,
        startBeat: perfectBeat - 4,
        directions: randomDirections(level),
      });
      id += 1;
    }
  });

  return turns;
}

function buildChart(
  id: string,
  title: string,
  bpm: number,
  levelTurnCounts: readonly number[],
): Chart {
  const turns = buildTurns(bpm, levelTurnCounts);
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

/** Create a completely fresh chart while preserving song/timing data. */
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

/** Generic 4-key choreography chart for future testing. */
export function createDemoChart(): Chart {
  return buildChart("neon-audition-demo", "Neon Club", 128, STANDARD_4KEY_LEVEL_TURNS);
}

/** Chart matching the supplied 80 BPM replay's observed level progression. */
export function createPleaseTellMeWhyChart(): Chart {
  return buildChart(
    "please-tell-me-why-audition-demo",
    "Please Tell Me Why",
    80,
    OBSERVED_80BPM_LEVEL_TURNS,
  );
}

export const DEMO_CHART: Chart = createPleaseTellMeWhyChart();
