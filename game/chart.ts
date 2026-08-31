import type { Chart, DanceTurn, Direction } from "./types";

const DIRECTIONS: Direction[] = ["left", "up", "down", "right"];
const MAX_LEVEL = 9;

// Reference progression observed in the supplied Audition replay.
// A level is held for multiple turns; it does not increase every success.
export const OBSERVED_80BPM_LEVEL_TURNS = [1, 2, 3, 4, 4, 6, 6] as const;
export const STANDARD_4KEY_LEVEL_TURNS = [1, 2, 3, 4, 5, 6, 6, 6, 6] as const;

// Default/demo chart anchor. Song-specific charts can use an exact millisecond
// anchor when the vocal onset does not fall exactly on the nominal beat grid.
export const FIRST_PERFECT_BEAT = 12;

// Measured against the supplied "Please Tell Me Why" reference/audio: the
// first SPACE/Perfect is the opening vocal "My" at about 28.87s in the
// deployed 4:26 gameplay audio. At 80 BPM this is beat 38.4933..., so we
// keep the exact vocal anchor and retain the 3-second (4-beat) spacing after it.
export const PLEASE_TELL_ME_WHY_FIRST_PERFECT_MS = 28_870;

function firstPerfectMsForBpm(bpm: number) {
  return FIRST_PERFECT_BEAT * (60000 / bpm);
}

function randomIndex(max: number) {
  if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") {
    const values = new Uint32Array(1);
    crypto.getRandomValues(values);
    return values[0] % max;
  }
  return Math.floor(Math.random() * max);
}

/** Fresh random arrows for each normal turn. Level 1..5 use N arrows; 6+ uses six. */
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

function buildTurns(bpm: number, levelTurnCounts: readonly number[], firstPerfectMs: number) {
  const beatDurationMs = 60000 / bpm;
  const firstPerfectBeat = firstPerfectMs / beatDurationMs;
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

function buildChart(
  id: string,
  title: string,
  bpm: number,
  levelTurnCounts: readonly number[],
  firstPerfectMs = firstPerfectMsForBpm(bpm),
): Chart {
  const turns = buildTurns(bpm, levelTurnCounts, firstPerfectMs);
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
  return buildChart(
    "please-tell-me-why-audition-demo",
    "Please Tell Me Why",
    80,
    OBSERVED_80BPM_LEVEL_TURNS,
    PLEASE_TELL_ME_WHY_FIRST_PERFECT_MS,
  );
}

export const DEMO_CHART: Chart = createPleaseTellMeWhyChart();

/** Re-randomize arrow content only; level/timing progression remains deterministic. */
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
