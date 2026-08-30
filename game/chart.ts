import type { Chart, Direction, DanceTurn } from "./types";

const PATTERNS: Direction[][] = [
  ["down", "right", "down", "right"],
  ["left", "up", "right", "down", "left"],
  ["up", "right", "down", "left", "up", "right"],
  ["left", "left", "down", "right", "up", "down"],
  ["right", "up", "right", "down", "left", "up", "down"],
  ["down", "left", "up", "right", "up"],
  ["up", "down", "up", "right", "left", "down", "right"],
  ["right", "right", "left", "down", "left", "up"],
];

const ACTIONS = ["step-left", "step-right", "cross", "turn", "jump", "pose", "wave", "power"];

export function createAuditionChart(bpm = 80): Chart {
  const turns: DanceTurn[] = Array.from({ length: 50 }, (_, index) => {
    const startBeat = 4 + index * 4.5;
    const pattern = PATTERNS[(index + Math.floor(index / 4)) % PATTERNS.length];
    const directions = pattern.slice(0, 4 + ((index * 3) % 4));
    return {
      id: index + 1,
      startBeat,
      spaceBeat: startBeat + 3.5,
      level: 4 + (index % 4),
      directions,
      actionId: ACTIONS[index % ACTIONS.length],
    };
  });

  return {
    title: "Please Tell Me Why",
    bpm,
    audioSrc: "/audio/Please%20tell%20me%20why.mp3",
    turns,
  };
}
