import type { Judgement } from "./types";

export const SCORE_ZONE_WIDTH = 0.20;
export const JUDGEMENT_SEGMENTS = 7;

/**
 * Seven equal judgement bands occupy the 70%..90% score zone.
 * Perfect is the center band at 85%. The outer edge of Bad is 70/90%;
 * outside the score zone is always Miss.
 */
export function getJudgementWindows(cycleMs: number) {
  const segmentMs = (cycleMs * SCORE_ZONE_WIDTH) / JUDGEMENT_SEGMENTS;
  return {
    perfect: segmentMs * 0.5,
    great: segmentMs * 1.5,
    cool: segmentMs * 2.5,
    bad: segmentMs * 3.5,
  } as const;
}

export class RhythmEngine {
  readonly stats = { score: 0, combo: 0, maxCombo: 0, perfect: 0, great: 0, cool: 0, bad: 0, miss: 0 };
  private judged = new Set<number>();

  judgeMove(moveIndex: number, deltaMs: number, cycleMs: number): Judgement | null {
    if (this.judged.has(moveIndex)) return null;
    const abs = Math.abs(deltaMs);
    const windows = getJudgementWindows(cycleMs);
    const judgement: Judgement | null =
      abs <= windows.perfect ? "perfect" :
      abs <= windows.great ? "great" :
      abs <= windows.cool ? "cool" :
      abs <= windows.bad ? "bad" : null;

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
