export type Direction = "left" | "up" | "down" | "right";
export type Judgement = "perfect" | "great" | "cool" | "bad" | "miss";
export type GamePhase = "idle" | "input" | "timing" | "judged" | "finished";

export type Note = {
  id: number;
  beat: number;
  direction: Direction;
};

export type DanceTurn = {
  id: number;
  startBeat: number;
  level: number;
  directions: Direction[];
  spaceBeat: number;
  actionId: string;
};

export type Chart = {
  title: string;
  bpm: number;
  offsetMs: number;
  turns: DanceTurn[];
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
