import type { Judgement } from "./types";

export const SCORE_ZONE_WIDTH = 0.2;
export const SCORE_ZONE_START = 70;
export const SCORE_ZONE_END = 90;
export const PERFECT_CENTER = 85;
export const JUDGEMENT_SEGMENTS = 7;

/**
 * The visible gauge and the judge use the exact same coordinate system.
 * Seven equal bands live inside 70..90, with Perfect centered at 85.
 */
export function judgementFromGaugePercent(gaugePercent: number): Judgement | null {
  if (gaugePercent < SCORE_ZONE_START || gaugePercent > SCORE_ZONE_END) return null;

  const zoneWidth = SCORE_ZONE_END - SCORE_ZONE_START;
  const segmentWidth = zoneWidth / JUDGEMENT_SEGMENTS;
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

  judgeMove(moveIndex: number, gaugePercent: number, deltaMs = 0): Judgement | null {
    if (this.judged.has(moveIndex)) return null;
    const judgement = judgementFromGaugePercent(gaugePercent);
    if (!judgement) return null;
    this.apply(judgement, moveIndex);
    void deltaMs;
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
