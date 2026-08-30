import type { Chart, DanceTurn, Direction } from "./types";

const DIRECTIONS: Direction[] = ["left", "up", "down", "right"];
const MAX_LEVEL = 9;

export const OBSERVED_80BPM_LEVEL_TURNS = [1, 2, 3, 4, 4, 6, 6] as const;
export const STANDARD_4KEY_LEVEL_TURNS = [1, 2, 3, 4, 5, 6, 6, 6, 6] as const;

// Manual song anchor requested for the current sync test.
// At 80 BPM, 28.5s = beat 38. Subsequent Perfect targets remain exactly
// four beats apart. If the anchor must itself be on an absolute 4n beat,
// use 30.0s (beat 40) instead.
export const FIRST_PERFECT_MS = 28500;

function randomIndex(max: number) {
  if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") {
    const values = new Uint32Array(1);
    crypto.getRandomValues(values);
    return values[0] % max;
  }
  return Math.floor(Math.random() * max);
}

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
  for (let levelIndex = 0; levelIndex < levelTurnCounts.length; levelIndex += 1) {
    const level = levelIndex + 1;
    const turnCount = levelTurnCounts[levelIndex];
    for (let turnInLevel = 0; turnInLevel < turnCount; turnInLevel += 1) {
      const perfectBeat = firstPerfectBeat + id * 4;
      turns.push({
        id,
        level: Math.min(MAX_LEVEL, level),
        startBeat: perfectBeat - 4,
        directions: randomDirections(level),
      });
      id += 1;
    }
  }
  return turns;
}

function buildChart(id: string, title: string, bpm: number, levelTurnCounts: readonly number[]): Chart {
  const turns = buildTurns(bpm, levelTurnCounts);
  const firstPerfectMs = FIRST_PERFECT_MS;
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
    firstPerfectMs,
    beatTimesMs: turns.map((_, index) => firstPerfectMs + index * 4 * (60000 / bpm)),
    notes,
    turns,
  };
}

export function createDemoChart(): Chart {
  return buildChart("neon-audition-demo", "Neon Club", 128, STANDARD_4KEY_LEVEL_TURNS);
}

export function createPleaseTellMeWhyChart(): Chart {
  return buildChart("please-tell-me-why-audition-demo", "Please Tell Me Why", 80, OBSERVED_80BPM_LEVEL_TURNS);
}

export const DEMO_CHART: Chart = createPleaseTellMeWhyChart();

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
