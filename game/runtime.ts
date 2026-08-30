import { BeatClock } from "./clock";
import { randomizeChart, randomDirections } from "./chart";
import { RhythmEngine } from "./rhythm";
import type { Chart, Direction, GameStats, Judgement } from "./types";

export type RhythmPhase = "idle" | "intro" | "countdown" | "playing" | "penalty" | "finish" | "finished";
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

const COUNTDOWN_BEATS = 4;
const GAUGE_CYCLE_BEATS = 4;
const LATE_EDGE = 0.10;
export const SCORE_ZONE_START = 70;
export const SCORE_ZONE_END = 90;
// The 70–90 score zone has its exact center at 80%, so PERFECT sits at 80%.
export const PERFECT_CENTER = 80;

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
  private targetOrdinal = 0;
  private penaltyActive = false;
  private finishMove = false;
  private finishDirections: Direction[] = [];
  private lastCountdown = -1;
  private lastStatsSignature = "";
  private zeroVisible = false;

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
    this.targetOrdinal = 0;
    this.penaltyActive = false;
    this.finishMove = false;
    this.finishDirections = [];
    this.targetMs = this.firstPerfectMs;
    this.lastCountdown = -1;
    this.lastStatsSignature = "";
    this.zeroVisible = false;
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

  /** The gauge runs at one fixed BPM speed. Every Perfect target is exactly 4 beats apart. */
  get gaugePercent() {
    if (!this.started || this.finished) return 0;
    const cycleMs = this.perfectIntervalMs;
    const phaseStart = this.firstPerfectMs - cycleMs * (PERFECT_CENTER / 100);
    const raw = (this.clock.elapsedMs - phaseStart) / cycleMs;
    return ((((raw % 1) + 1) % 1) * 100);
  }

  get timingGaugePercent() { return this.gaugePercent; }

  /** Signed milliseconds from the current 4-beat Perfect target. */
  get timingDeltaMs() {
    if (!this.started || !this.targetMs) return 0;
    return this.clock.elapsedMs - this.targetMs;
  }

  handleDirection(direction: Direction) {
    if (!this.canInputDirections() || this.awaitingSpace || this.penaltyActive) return false;
    const sequence = this.currentDirections;
    if (!sequence.length || this.commandIndex >= sequence.length) return false;

    const elapsed = this.clock.elapsedMs;
    const lateLimit = this.perfectIntervalMs * LATE_EDGE;
    if (elapsed > this.targetMs + lateLimit) {
      this.resolveMiss();
      return false;
    }
    if (elapsed >= this.targetMs) {
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
    if (!this.started || this.finished || this.penaltyActive || !this.awaitingSpace) return null;

    const elapsed = this.clock.elapsedMs;
    // Before the first Perfect target, SPACE is deliberately ignored.
    if (elapsed < this.targetMs) return null;

    // The user can tap at the exact 0/Perfect frame before RAF transitions phase.
    if (this.phase === "countdown") {
      this.phase = "playing";
      this.zeroVisible = false;
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
    return this.started && !this.finished && !this.penaltyActive && (
      this.phase === "countdown" || this.phase === "playing" || this.phase === "finish"
    );
  }

  private canInputSpace() {
    return this.started && !this.finished && !this.penaltyActive && (
      this.phase === "playing" || this.phase === "finish"
    );
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
      const step = Math.min(COUNTDOWN_BEATS - 1, Math.floor(progress * COUNTDOWN_BEATS));
      const value = COUNTDOWN_BEATS - 1 - step;
      if (value !== this.lastCountdown) {
        this.lastCountdown = value;
        this.callbacks.onCountdown?.(value);
      }

      if (elapsed >= this.targetMs) {
        this.phase = "playing";
        this.zeroVisible = true;
        this.callbacks.onCountdown?.(0);
        this.callbacks.onPhase?.("playing");
        requestAnimationFrame(() => {
          if (!this.started || this.finished || !this.zeroVisible) return;
          this.zeroVisible = false;
          this.callbacks.onCountdown?.(null);
        });
      }
    }

    if (this.penaltyActive && elapsed >= this.targetMs) {
      this.finishPenaltyCycle();
      return;
    }

    const lateLimit = this.perfectIntervalMs * LATE_EDGE;
    if ((this.phase === "playing" || this.phase === "finish") && elapsed >= this.targetMs + lateLimit) {
      this.resolveMiss();
      return;
    }

    this.raf = requestAnimationFrame(this.loop);
  };

  private completeMove(judgement: Judgement) {
    this.awaitingSpace = false;
    this.commandIndex = 0;
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

    if (judgement === "miss") {
      // One blank penalty cycle. The current chart turn is retained and will
      // advance only after that blank cycle completes.
      this.penaltyActive = true;
      this.phase = "penalty";
      this.targetOrdinal += 1;
      this.targetMs = this.firstPerfectMs + this.targetOrdinal * this.perfectIntervalMs;
      this.callbacks.onPhase?.("penalty");
      this.callbacks.onSequence?.([], 0);
      return;
    }

    if (lastTurn) {
      this.beginFinishMove();
      return;
    }

    this.turnIndex += 1;
    this.targetOrdinal += 1;
    this.targetMs = this.firstPerfectMs + this.targetOrdinal * this.perfectIntervalMs;
    this.phase = "playing";
    this.callbacks.onPhase?.("playing");
    this.callbacks.onLevel?.(this.currentLevel);
    this.emitSequence();
  }

  private resolveMiss() {
    const moveId = this.moveId;
    if (!this.engine.missMove(moveId)) return;
    this.completeMove("miss");
  }

  private finishPenaltyCycle() {
    this.penaltyActive = false;
    this.turnIndex += 1;
    this.commandIndex = 0;
    this.awaitingSpace = false;
    this.targetOrdinal += 1;
    this.targetMs = this.firstPerfectMs + this.targetOrdinal * this.perfectIntervalMs;

    if (this.turnIndex >= (this.chart.turns?.length ?? 0)) {
      this.beginFinishMove();
      return;
    }

    this.phase = "playing";
    this.callbacks.onPhase?.("playing");
    this.callbacks.onLevel?.(this.currentLevel);
    this.emitSequence();
  }

  private beginFinishMove() {
    this.finishMove = true;
    this.penaltyActive = false;
    this.awaitingSpace = false;
    this.commandIndex = 0;
    this.finishDirections = randomDirections(6);
    this.targetOrdinal += 1;
    this.targetMs = this.firstPerfectMs + this.targetOrdinal * this.perfectIntervalMs;
    this.phase = "finish";
    this.callbacks.onPhase?.("finish");
    this.emitSequence();
  }

  private emitSequence() {
    if (!this.started || this.finished) {
      this.callbacks.onSequence?.([], 0);
      return;
    }
    this.callbacks.onSequence?.(this.currentDirections, this.commandIndex);
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

  private get firstPerfectMs() {
    return this.chart.firstPerfectMs ?? this.beatDurationMs * GAUGE_CYCLE_BEATS;
  }

  private get perfectIntervalMs() {
    return this.beatDurationMs * GAUGE_CYCLE_BEATS;
  }

  private get perfectOffsetMs() {
    return this.perfectIntervalMs;
  }

  private get beatDurationMs() {
    return 60000 / this.chart.bpm;
  }
}
