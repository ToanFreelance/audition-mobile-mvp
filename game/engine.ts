import type { Chart, DanceTurn, Direction, GamePhase, GameSnapshot, GameStats, Judgement } from "./types";

const EMPTY_STATS: GameStats = { score: 0, combo: 0, maxCombo: 0, perfect: 0, great: 0, cool: 0, bad: 0, miss: 0 };
const BASE_SCORE: Record<Judgement, number> = { perfect: 3000, great: 2250, cool: 1500, bad: 750, miss: 0 };

export class AuditionEngine {
  private readonly chart: Chart;
  private turnIndex = 0;
  private inputIndex = 0;
  private phase: GamePhase = "idle";
  private judgement: Judgement | null = null;
  private actionId: string | null = null;
  private wrongDirection: Direction | null = null;
  private judgedBeat = -Infinity;
  private nextTurnAt = 0;
  private stats: GameStats = { ...EMPTY_STATS };

  constructor(chart: Chart) { this.chart = chart; }

  reset() {
    this.turnIndex = 0;
    this.inputIndex = 0;
    this.phase = "idle";
    this.judgement = null;
    this.actionId = null;
    this.wrongDirection = null;
    this.judgedBeat = -Infinity;
    this.nextTurnAt = 0;
    this.stats = { ...EMPTY_STATS };
  }

  start() {
    this.reset();
    this.phase = "input";
  }

  getStats() { return { ...this.stats }; }
  getPhase() { return this.phase; }
  getTurn(): DanceTurn | undefined { return this.chart.turns[this.turnIndex]; }

  snapshot(currentBeat: number): GameSnapshot {
    const turn = this.getTurn();
    const timingPercent = turn ? this.getTimingPercent(turn, currentBeat) : 0;
    return {
      phase: this.phase,
      turn,
      completedCommands: this.inputIndex,
      timingPercent,
      stats: this.getStats(),
      judgement: this.judgement,
      actionId: this.actionId,
      wrongDirection: this.wrongDirection,
    };
  }

  consumeTransient() {
    const result = { judgement: this.judgement, actionId: this.actionId, wrongDirection: this.wrongDirection };
    this.judgement = null;
    this.actionId = null;
    this.wrongDirection = null;
    return result;
  }

  update(currentBeat: number) {
    if (this.phase === "idle" || this.phase === "finished") return;
    const turn = this.getTurn();
    if (!turn) { this.phase = "finished"; return; }

    if (this.phase === "input") {
      if (currentBeat < turn.startBeat) return;
      if (currentBeat >= turn.spaceBeat && this.inputIndex < turn.directions.length) {
        this.applyJudgement("miss", currentBeat);
        return;
      }
      if (this.inputIndex >= turn.directions.length) {
        this.phase = "timing";
      }
      return;
    }

    if (this.phase === "timing") {
      const end = turn.spaceBeat + 0.75;
      if (currentBeat > end) this.applyJudgement("miss", currentBeat);
      return;
    }

    if (this.phase === "judged" && currentBeat >= this.nextTurnAt) {
      this.advanceTurn();
    }
  }

  handleDirection(direction: Direction, currentBeat: number) {
    if (this.phase !== "input") return false;
    const turn = this.getTurn();
    if (!turn || currentBeat < turn.startBeat || currentBeat >= turn.spaceBeat) return false;
    const target = turn.directions[this.inputIndex];
    if (direction !== target) {
      this.wrongDirection = direction;
      return false;
    }
    this.inputIndex += 1;
    if (this.inputIndex >= turn.directions.length) this.phase = "timing";
    return true;
  }

  handleSpace(currentBeat: number) {
    if (this.phase !== "timing") return null;
    const turn = this.getTurn();
    if (!turn || this.judgedBeat === currentBeat) return null;
    const percent = this.getTimingPercent(turn, currentBeat);
    const judgement = classifyPercent(percent);
    this.applyJudgement(judgement, currentBeat);
    return judgement;
  }

  private getTimingPercent(turn: DanceTurn, beat: number) {
    const start = turn.spaceBeat - 0.75;
    const end = turn.spaceBeat + 0.75;
    return Math.max(0, Math.min(100, ((beat - start) / (end - start)) * 100));
  }

  private applyJudgement(judgement: Judgement, currentBeat: number) {
    if (this.phase === "judged" || this.phase === "finished") return;
    const turn = this.getTurn();
    this.phase = "judged";
    this.judgedBeat = currentBeat;
    this.judgement = judgement;
    this.actionId = judgement === "miss" ? null : turn?.actionId ?? null;
    this.stats[judgement] += 1;
    if (judgement === "miss") {
      this.stats.combo = 0;
    } else {
      this.stats.combo += 1;
      this.stats.maxCombo = Math.max(this.stats.maxCombo, this.stats.combo);
      const multiplier = 1 + Math.min(0.75, this.stats.combo * 0.015);
      this.stats.score += Math.round(BASE_SCORE[judgement] * multiplier);
    }
    this.nextTurnAt = currentBeat + 0.38;
  }

  private advanceTurn() {
    this.turnIndex += 1;
    this.inputIndex = 0;
    this.judgement = null;
    this.actionId = null;
    this.wrongDirection = null;
    if (this.turnIndex >= this.chart.turns.length) {
      this.phase = "finished";
      return;
    }
    this.phase = "input";
  }
}

function classifyPercent(percent: number): Judgement {
  if (percent < 80 || percent > 90) return "miss";
  if (percent < 82 || percent > 88) return "bad";
  if (percent < 84 || percent > 86) return "cool";
  if (percent < 84.5 || percent > 85.5) return "great";
  return "perfect";
}
