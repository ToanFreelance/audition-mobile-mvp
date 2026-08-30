import { BeatClock } from "./clock";
import { randomizeChart, randomDirections } from "./chart";
import { RhythmEngine } from "./rhythm";
import type { Chart, Direction, GameStats, Judgement } from "./types";

export type RhythmPhase = "idle" | "intro" | "countdown" | "playing" | "finish" | "finished";
export type RhythmRuntimeCallbacks = {
  onStats?: (stats: GameStats) => void;
  onJudgement?: (judgement: Judgement) => void;
  onSequence?: (directions: Direction[], filledCount: number) => void;
  onFinished?: (stats: GameStats) => void;
  onLevel?: (level: number) => void;
  onPhase?: (phase: RhythmPhase) => void;
  onCountdown?: (value: number | null) => void;
  onPulse?: () => void;
};

const COUNTDOWN_STEPS = 4;
const GAUGE_CYCLE_BEATS = 4;
export const SCORE_ZONE_START = 70;
export const SCORE_ZONE_END = 90;
export const PERFECT_CENTER = 85;

export class RhythmRuntime {
  private readonly baseChart: Chart;
  private chart: Chart;
  private readonly callbacks: RhythmRuntimeCallbacks;
  private engine = new RhythmEngine();
  private clock: BeatClock;
  private timeSource: (() => number) | null = null;
  private raf = 0;
  private started = false;
  private finished = false;
  private phase: RhythmPhase = "idle";
  private turnIndex = 0;
  private commandIndex = 0;
  private awaitingSpace = false;
  private targetMs = 0;
  private penaltyActive = false;
  private finishMove = false;
  private finishDirections: Direction[] = [];
  private lastCountdown = -1;
  private lastStatsSignature = "";

  constructor(chart: Chart, callbacks: RhythmRuntimeCallbacks = {}) {
    this.baseChart = chart;
    this.chart = chart;
    this.callbacks = callbacks;
    this.clock = new BeatClock(chart.bpm, chart.offsetMs);
  }

  setTimeSource(source: (() => number) | null) {
    this.timeSource = source;
    this.clock.setTimeSource(source);
  }

  syncToTimeSource() { this.clock.syncToTimeSource(); }

  start() {
    this.stop();
    this.chart = randomizeChart(this.baseChart);
    this.engine = new RhythmEngine();
    this.clock = new BeatClock(this.chart.bpm, this.chart.offsetMs);
    this.clock.setTimeSource(this.timeSource);
    this.started = true;
    this.finished = false;
    this.phase = "intro";
    this.turnIndex = 0;
    this.commandIndex = 0;
    this.awaitingSpace = false;
    this.penaltyActive = false;
    this.finishMove = false;
    this.finishDirections = [];
    this.targetMs = this.getTurnTargetMs(0);
    this.lastCountdown = -1;
    this.lastStatsSignature = "";
    this.clock.start();
    this.callbacks.onPhase?.("intro");
    this.callbacks.onCountdown?.(null);
    this.callbacks.onLevel?.(this.currentLevel);
    this.emitSequence();
    this.emitStats(true);
    this.loop();
  }

  stop() {
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;
    this.started = false;
  }

  destroy() { this.stop(); }

  get isStarted() { return this.started; }
  get isFinished() { return this.finished; }
  get stats() { return { ...this.engine.stats }; }
  get currentLevel() { return this.chart.turns?.[this.turnIndex]?.level ?? 1; }
  get currentTurn() { return this.turnIndex + 1; }
  get currentPhase() { return this.phase; }
  get isPenaltyTurn() { return this.penaltyActive; }
  get currentDirections() {
    if (this.penaltyActive) return [];
    return this.finishMove ? this.finishDirections.slice() : (this.chart.turns?.[this.turnIndex]?.directions?.slice() ?? []);
  }
  get sequence() { return this.started && !this.finished ? this.currentDirections : []; }
  get completedCommands() { return this.commandIndex; }
  get awaitingTiming() { return this.awaitingSpace; }

  /** Fixed-speed gauge driven only by the audio clock. It starts at 0%. */
  get gaugePercent() {
    if (!this.started || this.finished) return 0;
    const cycleMs = this.beatDurationMs * GAUGE_CYCLE_BEATS;
    return ((this.clock.elapsedMs % cycleMs) / cycleMs) * 100;
  }

  get timingGaugePercent() { return this.gaugePercent; }
  get timingDeltaMs() { return !this.started || !this.targetMs ? 0 : this.clock.elapsedMs - this.targetMs; }

  handleDirection(direction: Direction) {
    if (!this.canInputDirections() || this.awaitingSpace || this.penaltyActive) return false;
    const sequence = this.currentDirections;
    if (!sequence.length || this.commandIndex >= sequence.length) return false;

    // All arrows must be entered before the target moment. At the exact
    // target we stop accepting new arrows and let SPACE judge the turn.
    if (this.clock.elapsedMs >= this.targetMs) {
      this.resolveMiss();
      return false;
    }

    if (direction !== sequence[this.commandIndex]) {
      this.commandIndex = 0;
      this.callbacks.onPulse?.();
      this.emitSequence();
      return false;
    }

    this.commandIndex += 1;
    this.callbacks.onPulse?.();
    if (this.commandIndex === sequence.length) this.awaitingSpace = true;
    this.emitSequence();
    return true;
  }

  handleSpace() {
    if (!this.started || this.finished || this.penaltyActive || !this.awaitingSpace || this.phase === "intro") return null;

    // At the exact first Perfect moment, a RAF may not have changed the phase
    // yet. Promote countdown -> playing synchronously so 0 is playable.
    if (this.phase === "countdown" && this.clock.elapsedMs >= this.targetMs) {
      this.phase = "playing";
      this.callbacks.onCountdown?.(null);
      this.callbacks.onPhase?.("playing");
    }
    if (!this.canInputSpace()) return null;

    const judgement = this.engine.judgeMove(this.moveId, this.gaugePercent);
    if (!judgement) {
      this.resolveMiss();
      return "miss" as Judgement;
    }
    this.completeMove(judgement);
    return judgement;
  }

  private canInputDirections() {
    return this.started && !this.finished && (this.phase === "countdown" || this.phase === "playing" || this.phase === "finish");
  }

  private canInputSpace() {
    return this.started && !this.finished && (this.phase === "playing" || this.phase === "finish");
  }

  private loop = () => {
    if (!this.started || this.finished) return;
    const elapsed = this.clock.elapsedMs;
    const countdownStart = this.targetMs - this.perfectOffsetMs;

    if (this.phase === "intro" && elapsed >= countdownStart) {
      this.phase = "countdown";
      this.lastCountdown = -1;
      this.callbacks.onPhase?.("countdown");
    }

    if (this.phase === "countdown") {
      const progress = Math.max(0, Math.min(1, (elapsed - countdownStart) / this.perfectOffsetMs));
      const step = Math.min(COUNTDOWN_STEPS - 1, Math.floor(progress * COUNTDOWN_STEPS));
      const value = COUNTDOWN_STEPS - 1 - step;
      if (value !== this.lastCountdown) {
        this.lastCountdown = value;
        this.callbacks.onCountdown?.(value);
      }
      if (elapsed >= this.targetMs) {
        this.phase = "playing";
        this.callbacks.onCountdown?.(null);
        this.callbacks.onPhase?.("playing");
      }
    }

    if (this.penaltyActive && elapsed >= this.targetMs) {
      this.penaltyActive = false;
      this.turnIndex += 1;
      this.commandIndex = 0;
      this.awaitingSpace = false;
      this.targetMs = this.getTurnTargetMs(this.turnIndex);
      if (this.turnIndex >= (this.chart.turns?.length ?? 0)) {
        this.beginFinishMove();
        return;
      }
      this.callbacks.onPhase?.("playing");
      this.callbacks.onLevel?.(this.currentLevel);
      this.emitSequence();
    }

    if (!this.penaltyActive && (this.phase === "playing" || this.phase === "finish") && elapsed >= this.targetMs) {
      const gauge = this.gaugePercent;
      if (gauge > SCORE_ZONE_END || elapsed >= this.targetMs + this.beatDurationMs * GAUGE_CYCLE_BEATS) {
        this.resolveMiss();
        return;
      }
    }

    this.raf = requestAnimationFrame(this.loop);
  };

  private completeMove(judgement: Judgement) {
    this.awaitingSpace = false;
    this.callbacks.onJudgement?.(judgement);
    this.callbacks.onPulse?.();
    this.emitStats(true);

    if (this.finishMove) {
      this.finished = true;
      this.started = false;
      this.phase = "finished";
      this.callbacks.onSequence?.([], 0);
      this.callbacks.onFinished?.({ ...this.engine.stats });
      return;
    }

    const lastTurn = this.chart.turns ? this.turnIndex >= this.chart.turns.length - 1 : true;
    if (lastTurn) {
      this.beginFinishMove();
      return;
    }

    this.turnIndex += 1;
    this.commandIndex = 0;
    this.awaitingSpace = false;
    this.targetMs = this.getTurnTargetMs(this.turnIndex);
    this.phase = "playing";
    this.callbacks.onPhase?.("playing");
    this.callbacks.onLevel?.(this.currentLevel);
    this.emitSequence();
  }

  private resolveMiss() {
    if (this.finishMove) {
      this.completeMove("miss");
      return;
    }

    const moveId = this.moveId;
    this.engine.missMove(moveId);
    this.callbacks.onJudgement?.("miss");
    this.callbacks.onPulse?.();
    this.emitStats(true);

    // The next turn is deliberately empty as the one-turn miss penalty.
    this.penaltyActive = true;
    this.commandIndex = 0;
    this.awaitingSpace = false;
    this.targetMs = this.targetMs + this.beatDurationMs * GAUGE_CYCLE_BEATS;
    this.phase = "playing";
    this.callbacks.onPhase?.("playing");
    this.emitSequence();
  }

  private beginFinishMove() {
    this.finishMove = true;
    this.penaltyActive = false;
    this.awaitingSpace = false;
    this.commandIndex = 0;
    this.finishDirections = randomDirections(6);
    this.targetMs = this.targetMs + this.beatDurationMs * GAUGE_CYCLE_BEATS;
    this.phase = "finish";
    this.callbacks.onPhase?.("finish");
    this.emitSequence();
  }

  private emitSequence() {
    if (!this.started || this.finished) {
      this.callbacks.onSequence?.([], 0);
      return;
    }
    this.callbacks.onSequence?.(this.sequence, this.commandIndex);
  }

  private emitStats(force = false) {
    const signature = JSON.stringify(this.engine.stats);
    if (force || signature !== this.lastStatsSignature) {
      this.lastStatsSignature = signature;
      this.callbacks.onStats?.({ ...this.engine.stats });
    }
  }

  private get moveId() {
    return this.finishMove ? (this.chart.turns?.length ?? 0) : this.turnIndex;
  }

  private getTurnTargetMs(turnIndex: number) {
    const firstPerfect = this.chart.firstPerfectMs ?? this.beatDurationMs * GAUGE_CYCLE_BEATS;
    return firstPerfect + turnIndex * this.beatDurationMs * GAUGE_CYCLE_BEATS;
  }

  /** Time for gauge to travel from 0% to the 85% Perfect marker. */
  private get perfectOffsetMs() {
    return this.beatDurationMs * GAUGE_CYCLE_BEATS * (PERFECT_CENTER / 100);
  }

  private get beatDurationMs() { return 60000 / this.chart.bpm; }
}
