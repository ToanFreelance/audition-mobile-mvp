import type { Chart, DanceTurn, Direction } from "./types";

const PATTERNS: Direction[][] = [
  ["left", "up", "right", "down", "left", "right", "up"],
  ["right", "right", "left", "down", "up", "left", "down"],
  ["up", "down", "up", "right", "left", "right", "down"],
  ["left", "down", "right", "up", "right", "down", "left"],
  ["down", "right", "down", "left", "up", "right", "up"],
  ["right", "up", "left", "up", "down", "left", "right"],
];

const LEVELS = [4, 5, 6, 5, 7, 6, 5, 7, 6, 4];

function makeDirections(turnIndex: number, level: number): Direction[] {
  const pattern = PATTERNS[turnIndex % PATTERNS.length];
  const rotation = turnIndex % pattern.length;

  return Array.from({ length: level }, (_, index) => {
    return pattern[(rotation + index) % pattern.length];
  });
}

export function createDemoChart(bpm = 80): Chart {
  const turns: DanceTurn[] = Array.from({ length: 50 }, (_, index) => {
    const startBeat = 4 + index * 4;
    const level = LEVELS[index % LEVELS.length];

    return {
      id: index + 1,
      startBeat,
      level,
      directions: makeDirections(index, level),
      spaceBeat: startBeat + 4,
      actionId: `dance_${((index % 8) + 1).toString().padStart(2, "0")}`,
    };
  });

  return {
    title: "Please Tell Me Why — Audition Level 1",
    bpm,
    offsetMs: 0,
    turns,
  };
}
