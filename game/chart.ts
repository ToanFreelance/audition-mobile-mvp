import type { Chart, Direction } from "./types";

const DEMO_COMMANDS: Direction[] = ["left", "up", "down", "right", "left", "right", "up", "down"];
const LEVEL_MOVE_COUNTS = [1, 2, 3, 4, 5, 6, 6, 6, 6] as const;

export const LEVEL_MOVE_COUNTS_EXPORT = LEVEL_MOVE_COUNTS;

export const DEMO_CHART: Chart = {
  id: "please-tell-me-why-level-1",
  title: "Please Tell Me Why — Level 1",
  bpm: 105,
  offsetMs: 0,
  notes: Array.from({ length: 39 * 8 }, (_, index) => ({
    direction: DEMO_COMMANDS[index % DEMO_COMMANDS.length],
    beat: index,
  })),
};

export function moveCountForLevel(level: number) {
  return LEVEL_MOVE_COUNTS[Math.max(1, Math.min(9, level)) - 1];
}
