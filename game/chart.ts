import type { Chart, Direction, Note } from "./types";

export function createDemoChart(): Chart {
  const pattern: Direction[] = [
    "right",
    "right",
    "left",
    "right",
    "up",
    "down",
    "up",
    "down",
    "left",
    "down",
    "right",
    "left",
  ];

  const notes: Note[] = Array.from({ length: 128 }, (_, index) => ({
    id: index + 1,
    beat: 4 + index * 0.5,
    direction: pattern[index % pattern.length],
  }));

  return {
    title: "Please Tell Me Why — Level 1",
    bpm: 80,
    offsetMs: 0,
    notes,
  };
}
