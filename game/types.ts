export type Direction = "left" | "up" | "down" | "right";
export type Judgement = "perfect" | "great" | "cool" | "bad" | "miss";
export type GamePhase = "idle" | "input" | "timing" | "judged" | "finished";

export type DanceTurn = {
  id: number;
  startBeat: number;
  spaceBeat: number;
  level: number;
  directions: Direction[];
  actionId: string;
};

export type Chart = {
  title: string;
  bpm: number;
  audioSrc: string;
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

export type GameSnapshot = {
  phase: GamePhase;
  turn?: DanceTurn;
  completedCommands: number;
  timingPercent: number;
  stats: GameStats;
  judgement: Judgement | null;
  actionId: string | null;
  wrongDirection: Direction | null;
};
