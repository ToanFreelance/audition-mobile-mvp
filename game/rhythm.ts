import type { Judgement } from "./types";

export const SCORE_ZONE_WIDTH = 0.2;
export const SCORE_ZONE_START = 70;
export const SCORE_ZONE_END = 90;
export const PERFECT_CENTER = 80;
export const JUDGEMENT_SEGMENTS = 7;

/**
 * Seven equal judgement bands occupy the 70..90 score zone.
 * Perfect is the exact center of the zone at 80%; outside is Miss.
 */
export function judgementFromGaugePercent(gaugePercent: number): Judgement | null {
  if (gaugePercent < SCORE_ZONE_START || gaugePercent > SCORE_ZONE_END) return null;

  const segmentWidth = (SCORE_ZONE_END - SCORE_ZONE_START) / JUDGEMENT_SEGMENTS;
  const index = Math.min(
    JUDGEMENT_SEGMENTS - 1,
    Math.floor((gaugePercent - SCORE_ZONE_START) / segmentWidth),
  );

  return ([
    "bad",
    "cool",
    "great",
    "perfect",
    "great",
    "cool",
    "bad",
  ] as Judgement[])[index];
}

export class RhythmEngine {
  readonly stats = { score: 0, combo: 0, maxCombo: 0, perfect: 0, great: 0, cool: 0, bad: 0, miss: 0 };
  private judged = new Set<number>();

  judgeMove(moveIndex: number, gaugePercent: number): Judgement | null {
    if (this.judged.has(moveIndex)) return null;
    const judgement = judgementFromGaugePercent(gaugePercent);
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
