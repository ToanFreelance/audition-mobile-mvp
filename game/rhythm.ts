import type { Chart, GameStats, Judgement } from "./types";

export const WINDOWS_MS = { perfect: 90, great: 160, cool: 240, bad: 360 } as const;

export class RhythmEngine {
  readonly stats: GameStats = { score: 0, combo: 0, maxCombo: 0, perfect: 0, great: 0, cool: 0, bad: 0, miss: 0 };
  private judged = new Set<number>();
  constructor(private readonly chart: Chart) {}

  judgeMove(moveIndex: number, deltaMs: number): Judgement | null {
    if (this.judged.has(moveIndex)) return null;
    const abs = Math.abs(deltaMs);
    let judgement: Judgement;
    if (abs <= WINDOWS_MS.perfect) judgement = "perfect";
    else if (abs <= WINDOWS_MS.great) judgement = "great";
    else if (abs <= WINDOWS_MS.cool) judgement = "cool";
    else if (abs <= WINDOWS_MS.bad) judgement = "bad";
    else return null;
    this.apply(judgement, moveIndex);
    return judgement;
  }

  missMove(moveIndex: number) {
    if (this.judged.has(moveIndex)) return false;
    this.judged.add(moveIndex);
    this.apply("miss", moveIndex);
    return true;
  }

  private apply(judgement: Judgement, moveIndex: number) {
    this.judged.add(moveIndex);
    this.stats[judgement] += 1;
    if (judgement === "miss") this.stats.combo = 0;
    else {
      this.stats.combo += 1;
      this.stats.maxCombo = Math.max(this.stats.maxCombo, this.stats.combo);
      this.stats.score += { perfect: 1000, great: 700, cool: 500, bad: 200 }[judgement] ?? 0;
    }
  }
}
