import type { Judgement } from "./types";

// 80 BPM / 4-beat gauge => 3000 ms per sweep.
// The visual score zone is 70%..90%, with Perfect centered at 85%.
// Judgement windows are deliberately inside that zone so anything outside
// the score zone is always a MISS.
export const WINDOWS_MS = {
  perfect: 18,
  great: 42,
  cool: 72,
  bad: 120,
} as const;

export class RhythmEngine {
  readonly stats = { score: 0, combo: 0, maxCombo: 0, perfect: 0, great: 0, cool: 0, bad: 0, miss: 0 };
  private judged = new Set<number>();

  judgeMove(moveIndex: number, deltaMs: number): Judgement | null {
    if (this.judged.has(moveIndex)) return null;
    const abs = Math.abs(deltaMs);
    const judgement: Judgement | null =
      abs <= WINDOWS_MS.perfect ? "perfect" :
      abs <= WINDOWS_MS.great ? "great" :
      abs <= WINDOWS_MS.cool ? "cool" :
      abs <= WINDOWS_MS.bad ? "bad" : null;
    if (!judgement) return null;
    this.apply(judgement, moveIndex);
    return judgement;
  }

  missMove(moveIndex: number) {
    if (this.judged.has(moveIndex)) return false;
    this.apply("miss", moveIndex);
    return true;
  }

  private apply(judgement: Judgement, moveIndex: number) {
    this.judged.add(moveIndex);
    this.stats[judgement] += 1;
    if (judgement === "miss") {
      this.stats.combo = 0;
      return;
    }
    this.stats.combo += 1;
    this.stats.maxCombo = Math.max(this.stats.maxCombo, this.stats.combo);
    this.stats.score += { perfect: 1000, great: 800, cool: 600, bad: 400 }[judgement];
  }
}
