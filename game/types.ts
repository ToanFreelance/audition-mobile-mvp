export type Direction = "left" | "up" | "down" | "right";
export type Judgement = "perfect" | "great" | "cool" | "bad" | "miss";

export interface ChartNote {
  direction: Direction;
  beat: number;
}

export interface DanceTurn {
  id: number;
  level: number;
  startBeat: number;
  directions: Direction[];
}

export interface Chart {
  id: string;
  title: string;
  bpm: number;
  offsetMs: number;
  /** Absolute song time (ms) at which the first SPACE target is Perfect. */
  firstPerfectMs?: number;
  beatTimesMs?: number[];
  notes: ChartNote[];
  turns?: DanceTurn[];
}

export interface GameStats {
  score: number;
  combo: number;
  maxCombo: number;
  perfect: number;
  great: number;
  cool: number;
  bad: number;
  miss: number;
}
