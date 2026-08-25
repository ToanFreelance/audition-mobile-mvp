export type Direction = "left" | "up" | "down" | "right";
export type Judgement = "perfect" | "great" | "cool" | "bad" | "miss";

export type Note = {
  id: number;
  beat: number;
  direction: Direction;
};

export type Chart = {
  title: string;
  bpm: number;
  offsetMs: number;
  notes: Note[];
};

export type GameStats = {
  score: number;
  combo: number;
  maxCombo: number;
  perfect: number;
  great: number;
  cool: number;
  bad: number;
  miss: number;
};
