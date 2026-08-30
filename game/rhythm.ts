import type { Chart, DanceTurn, GameStats, Judgement } from "./types";

export const WINDOWS_MS: Record<Judgement, number> = {
  perfect: 45,
  great: 85,
  cool: 130,
  bad: 185,
  miss: Infinity,
};

// Calibrated starting values for the reference result range.
// Final values should be tuned against more complete result-screen samples.
export const SCORE: Record<Judgement, number> = {
  perfect: 3200,
  great: 2400,
  cool: 1500,
  bad: 550,
  miss: 0,
};

export class RhythmEngine {
  readonly chart: Chart;
  readonly stats: GameStats = {
    score: 0,
    combo: 0,
    maxCombo: 0,
    perfect: 0,
    great: 0,
    cool: 0,
    bad: 0,
    miss: 0,
  };

  private judgedTurns = new Set<number>();

  constructor(chart: Chart) {
    this.chart = chart;
  }

  get nextTurn(): DanceTurn | undefined {
    return this.chart.turns.find((turn) => !this.judgedTurns.has(turn.id));
  }

  get allTurns() {
    return this.chart.turns;
  }

  isJudged(turnId: number) {
    return this.judgedTurns.has(turnId);
  }

  get completed() {
    return this.judgedTurns.size >= this.chart.turns.length;
  }

  judgeTurn(turn: DanceTurn, currentBeat: number): Judgement {
    if (this.judgedTurns.has(turn.id)) {
      return "miss";
    }

    const deltaMs = Math.abs(
      this.beatToMs(currentBeat) - this.beatToMs(turn.spaceBeat)
    );
    const judgement = this.classify(deltaMs);
    this.apply(turn, judgement);
    return judgement;
  }

  autoMiss(turn: DanceTurn) {
    if (this.judgedTurns.has(turn.id)) return;
    this.apply(turn, "miss");
  }

  getTimingDeltaMs(turn: DanceTurn, currentBeat: number) {
    return this.beatToMs(currentBeat) - this.beatToMs(turn.spaceBeat);
  }

  getTimingRatio(turn: DanceTurn, currentBeat: number) {
    const delta = this.getTimingDeltaMs(turn, currentBeat);
    const window = WINDOWS_MS.bad;
    return Math.max(-1, Math.min(1, delta / window));
  }

  private classify(deltaMs: number): Judgement {
    if (deltaMs <= WINDOWS_MS.perfect) return "perfect";
    if (deltaMs <= WINDOWS_MS.great) return "great";
    if (deltaMs <= WINDOWS_MS.cool) return "cool";
    if (deltaMs <= WINDOWS_MS.bad) return "bad";
    return "miss";
  }

  private apply(turn: DanceTurn, judgement: Judgement) {
    if (this.judgedTurns.has(turn.id)) return;

    this.judgedTurns.add(turn.id);
    this.stats[judgement]++;

    if (judgement === "miss") {
      this.stats.combo = 0;
      return;
    }

    this.stats.combo++;
    this.stats.maxCombo = Math.max(this.stats.maxCombo, this.stats.combo);

    const levelMultiplier = 1 + Math.max(0, turn.level - 4) * 0.06;
    const comboMultiplier = 1 + Math.min(1.5, Math.floor(this.stats.combo / 10) * 0.1);
    const value = SCORE[judgement] * levelMultiplier * comboMultiplier;

    this.stats.score += Math.round(value);
  }

  private beatToMs(beat: number) {
    return beat * 60000 / this.chart.bpm;
  }
}
