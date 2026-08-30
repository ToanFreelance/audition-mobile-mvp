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

const COUNTDOWN_BEATS = 3;
const TURN_INTERVAL_BEATS = 4;
export const SCORE_ZONE_START = 70;
export const SCORE_ZONE_END = 90;
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
  private penaltyUntilMs = 0;
  private finishMove = false;
  private finishDirections: Direction[] = [];
  private countdownValue: number | null = null;
  private lastStatsSignature = "";
  private judgementId = 0;

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
    this.targetMs = this.firstPerfectMs;
    this.penaltyUntilMs = 0;
    this.finishMove = false;
    this.finishDirections = [];
    this.countdownValue = null;
    this.lastStatsSignature = "";
    this.judgementId = 0;
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
  get currentLevel() { return this.finishMove ? 0 : (this.chart.turns?.[this.turnIndex]?.level ?? 1); }
  get currentTurn() { return this.turnIndex + 1; }
  get currentPhase() { return this.phase; }
  get isPenaltyTurn() { return this.phase === "penalty"; }
  get currentDirections() {
    if (this.phase === "penalty") return [];
    return this.finishMove
      ? this.finishDirections.slice()
      : (this.chart.turns?.[this.turnIndex]?.directions?.slice() ?? []);
  }
  get sequence() { return this.started && !this.finished ? this.currentDirections : []; }
  get completedCommands() { return this.commandIndex; }
  get awaitingTiming() { return this.awaitingSpace; }

  /** Gauge speed is fixed by BPM: one sweep = exactly four beats. */
  get gaugePercent() {
    if (!this.started || this.finished) return 0;
    const cycleMs = this.perfectIntervalMs;
    const phaseStart = this.firstPerfectMs - cycleMs * (PERFECT_CENTER / 100);
    const raw = (this.clock.elapsedMs - phaseStart) / cycleMs;
    return ((((raw % 1) + 1) % 1) * 100);
  }

  get timingGaugePercent() { return this.gaugePercent; }
  get timingDeltaMs() { return !this.started || !this.targetMs ? 0 : this.clock.elapsedMs - this.targetMs; }

  handleDirection(direction: Direction) {
    if (!this.canInputDirections() || this.awaitingSpace) return false;
    const sequence = this.currentDirections;
    if (!sequence.length || this.commandIndex >= sequence.length) return false;
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
    if (!this.started || this.finished || this.phase === "intro" || this.phase === "penalty" || !this.awaitingSpace) return null;

    // Countdown remains tappable. A rushed early tap is judged using the same
    // gauge coordinate as the visible marker, so early/late taps get lower
    // grades rather than being silently ignored when they land in the zone.
    const judgement = this.engine.judgeMove(this.moveId, this.gaugePercent);
    if (!judgement) {
      this.resolveMiss();
      return "miss" as Judgement;
    }
    this.completeMove(judgement);
    return judgement;
  }

  private canInputDirections() {
    return this.started && !this.finished && this.phase !== "penalty" && (
      this.phase === "intro" ||
      this.phase === "countdown" ||
      this.phase === "playing" ||
      this.phase === "finish"
    );
  }

  private loop = () => {
    if (!this.started || this.finished) return;
    const elapsed = this.clock.elapsedMs;

    if (this.phase === "intro") {
      const countdownStart = this.targetMs - this.countdownDurationMs;
      if (elapsed >= countdownStart) {
        this.phase = "countdown";
        this.countdownValue = null;
        this.callbacks.onPhase?.("countdown");
      }
    }

    if (this.phase === "countdown") {
      const countdownStart = this.targetMs - this.countdownDurationMs;
      const relative = Math.max(0, elapsed - countdownStart);
      const step = Math.min(COUNTDOWN_BEATS - 1, Math.floor(relative / this.beatDurationMs));
      const value = COUNTDOWN_BEATS - step;
      if (value !== this.countdownValue) {
        this.countdownValue = value;
        this.callbacks.onCountdown?.(value);
      }

      if (elapsed >= this.targetMs) {
        this.phase = "playing";
        this.countdownValue = 0;
        this.callbacks.onCountdown?.(0);
        this.callbacks.onPhase?.("playing");
        window.setTimeout(() => this.callbacks.onCountdown?.(null), 120);
      }
    }

    if (this.phase === "penalty") {
      if (elapsed >= this.penaltyUntilMs) {
        // Consume exactly one blank four-beat penalty interval, then reveal
        // the next normal turn. The next turn keeps the same deterministic
        // 4-beat schedule and is never skipped.
        this.phase = "playing";
        this.penaltyUntilMs = 0;
        this.commandIndex = 0;
        this.awaitingSpace = false;

        if (this.turnIndex >= (this.chart.turns?.length ?? 0)) {
          this.beginFinishMove();
          return;
        }

        this.targetMs += this.perfectIntervalMs;
        this.callbacks.onPhase?.("playing");
        this.callbacks.onLevel?.(this.currentLevel);
        this.emitSequence();
      }
      this.raf = requestAnimationFrame(this.loop);
      return;
    }

    if ((this.phase === "playing" || this.phase === "finish") && elapsed >= this.targetMs + this.lateWindowMs) {
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

    if (judgement === "miss") {
      const hasNextTurn = this.turnIndex + 1 < (this.chart.turns?.length ?? 0);
      this.phase = "penalty";
      this.penaltyUntilMs = this.targetMs + this.perfectIntervalMs;
      this.callbacks.onPhase?.("penalty");
      this.callbacks.onSequence?.([], 0);
      // Keep current turn index during penalty; advance exactly once when the
      // blank cycle completes so arrows are guaranteed to return.
      if (!hasNextTurn) this.turnIndex = this.chart.turns?.length ?? this.turnIndex + 1;
      else this.turnIndex += 1;
      return;
    }

    const lastTurn = this.turnIndex >= ((this.chart.turns?.length ?? 1) - 1);
    if (lastTurn) {
      this.beginFinishMove();
      return;
    }

    this.turnIndex += 1;
    this.targetMs += this.perfectIntervalMs;
    this.phase = "playing";
    this.callbacks.onPhase?.("playing");
    this.callbacks.onLevel?.(this.currentLevel);
    this.emitSequence();
  }

  private resolveMiss() {
    const moveId = this.moveId;
    if (!this.engine.missMove(moveId)) return;
    this.callbacks.onJudgement?.("miss");
    this.completeMove("miss");
  }

  private beginFinishMove() {
    this.finishMove = true;
    this.penaltyEndsMs = 0;
    this.awaitingSpace = false;
    this.commandIndex = 0;
    this.finishDirections = randomDirections(6);
    this.targetMs = Math.max(this.targetMs, this.clock.elapsedMs) + this.perfectIntervalMs;
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
    return this.finishMove ? (this.chart.turns?.length ?? 0) + 1 : this.turnIndex;
  }

  private get firstPerfectMs() { return this.chart.firstPerfectMs ?? this.beatDurationMs * 4; }
  private get perfectIntervalMs() { return this.beatDurationMs * TURN_INTERVAL_BEATS; }
  private get countdownDurationMs() { return this.beatDurationMs * COUNTDOWN_BEATS; }
  private get lateWindowMs() { return this.perfectIntervalMs * (SCORE_ZONE_END - PERFECT_CENTER) / 100; }
  private get beatDurationMs() { return 60000 / this.chart.bpm; }
}
