import type { Chart, Direction, Note } from "./types";

const directions: Direction[] = ["left", "up", "down", "right"];

export function createDemoChart(): Chart {
  const notes: Note[] = [];
  let id = 1;

  // Intro: simple quarter-note pattern.
  for (let beat = 4; beat < 20; beat += 1) {
    notes.push({ id: id++, beat, direction: directions[(beat - 4) % 4] });
  }

  // Verse: eighth-note pairs.
  for (let beat = 20; beat < 52; beat += 0.5) {
    const step = Math.round((beat - 20) * 2);
    const pattern = ["left", "up", "right", "down", "left", "right", "up", "down"] as Direction[];
    notes.push({ id: id++, beat, direction: pattern[step % pattern.length] });
  }

  // Chorus: denser, symmetric sequences.
  const chorus = [
    "left", "up", "right", "down",
    "left", "up", "right", "down",
    "right", "up", "left", "down",
    "right", "down", "left", "up"
  ] as Direction[];

  for (let beat = 52; beat < 84; beat += 0.5) {
    const step = Math.round((beat - 52) * 2);
    notes.push({ id: id++, beat, direction: chorus[step % chorus.length] });
  }

  // Finale: recognizable alternating runs.
  const finale = ["left", "right", "up", "down"] as Direction[];
  for (let beat = 84; beat < 112; beat += 0.5) {
    const step = Math.round((beat - 84) * 2);
    notes.push({ id: id++, beat, direction: finale[step % finale.length] });
  }

  return {
    title: "Neon Groove — Prototype",
    bpm: 128,
    offsetMs: 0,
    notes
  };
}
