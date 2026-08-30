export type Direction = "left" | "up" | "down" | "right";
export type Judgement = "perfect" | "great" | "cool" | "bad" | "miss";

export interface ChartNote {
  direction: Direction;
  beat: number;
}

export interface Chart {
  id: string;
  title: string;
  bpm: number;
  offsetMs: number;
  beatTimesMs?: number[];
  notes: ChartNote[];
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
