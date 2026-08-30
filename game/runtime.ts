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

const GAUGE_CYCLE_BEATS = 4;
const COUNTDOWN_BEATS = 4;
const LATE_EDGE = 0.10;
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
  private penaltyEndsMs = 0;
  private finishMove = false;
  private finishDirections: Direction[] = [];
  private lastCountdown: number | null = null;
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
    this.targetMs = this.firstPerfectMs;
    this.penaltyEndsMs = 0;
    this.finishMove = false;
    this.finishDirections = [];
    this.lastCountdown = null;
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
  get currentLevel() { return this.finishMove ? 9 : (this.chart.turns?.[this.turnIndex]?.level ?? 1); }
  get currentTurn() { return this.turnIndex + 1; }
  get currentPhase() { return this.phase; }
  get isPenaltyTurn() { return this.penaltyEndsMs > this.clock.elapsedMs; }
  get currentDirections() {
    if (this.isPenaltyTurn || this.finishMove === false && this.turnIndex >= (this.chart.turns?.length ?? 0)) return this.finishMove ? this.finishDirections.slice() : [];
    return this.finishMove ? this.finishDirections.slice() : (this.chart.turns?.[this.turnIndex]?.directions?.slice() ?? []);
  }
  get sequence() { return this.started && !this.finished ? this.currentDirections : []; }
  get completedCommands() { return this.commandIndex; }
  get awaitingTiming() { return this.awaitingSpace; }

  /** Fixed-speed gauge: one full sweep is exactly four beats. */
  get gaugePercent() {
    if (!this.started || this.finished) return 0;
    const cycleMs = this.perfectIntervalMs;
    const phaseStart = this.firstPerfectMs - cycleMs * (PERFECT_CENTER / 100);
    return ((((this.clock.elapsedMs - phaseStart) / cycleMs) % 1 + 1) % 1) * 100;
  }

  get timingGaugePercent() { return this.gaugePercent; }
  get timingDeltaMs() { return !this.started || !this.targetMs ? 0 : this.clock.elapsedMs - this.targetMs; }

  handleDirection(direction: Direction) {
    if (!this.canInputDirections() || this.awaitingSpace) return false;
    const sequence = this.currentDirections;
    if (!sequence.length || this.commandIndex >= sequence.length) return false;

    const elapsed = this.clock.elapsedMs;
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
    if (!this.started || this.finished || this.isPenaltyTurn || !this.awaitingSpace) return null;

    const elapsed = this.clock.elapsedMs;
    if (this.phase === "countdown" && elapsed >= this.targetMs) {
      this.phase = "playing";
      this.callbacks.onCountdown?.(0);
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
    return this.started && !this.finished && !this.isPenaltyTurn && (
      this.phase === "countdown" || this.phase === "playing" || this.phase === "finish"
    );
  }

  private canInputSpace() {
    return this.started && !this.finished && !this.isPenaltyTurn && (
      this.phase === "playing" || this.phase === "finish"
    );
  }

  private loop = () => {
    if (!this.started || this.finished) return;

    const elapsed = this.clock.elapsedMs;
    const countdownStart = this.targetMs - this.perfectIntervalMs;

    if (this.phase === "intro" && elapsed >= countdownStart) {
      this.phase = "countdown";
      this.lastCountdown = null;
      this.callbacks.onPhase?.("countdown");
    }

    if (this.phase === "countdown") {
      const remaining = this.targetMs - elapsed;
      let value: number | null = null;
      if (remaining > this.beatDurationMs * 3) value = 3;
      else if (remaining > this.beatDurationMs * 2) value = 2;
      else if (remaining > this.beatDurationMs) value = 1;
      else if (remaining > 0) value = null;
      else value = 0;

      if (value !== this.lastCountdown) {
        this.lastCountdown = value;
        this.callbacks.onCountdown?.(value);
      }

      if (elapsed >= this.targetMs) {
        this.phase = "playing";
        this.callbacks.onCountdown?.(0);
        this.callbacks.onPhase?.("playing");
        requestAnimationFrame(() => this.callbacks.onCountdown?.(null));
      }
    }

    if (this.penaltyEndsMs > 0 && elapsed >= this.penaltyEndsMs) {
      this.penaltyEndsMs = 0;
      this.commandIndex = 0;
      this.awaitingSpace = false;

      if (this.turnIndex >= (this.chart.turns?.length ?? 0)) {
        this.beginFinishMove();
        return;
      }

      this.phase = "playing";
      this.targetMs = this.penaltyEndsMs + this.perfectIntervalMs;
      // penaltyEndsMs is cleared above; use the current audio position as the
      // start of the next four-beat turn so it can never get stuck in penalty.
      this.targetMs = elapsed + this.perfectIntervalMs;
      this.callbacks.onPhase?.("playing");
      this.callbacks.onLevel?.(this.currentLevel);
      this.emitSequence();
      this.raf = requestAnimationFrame(this.loop);
      return;
    }

    if (!this.isPenaltyTurn && (this.phase === "playing" || this.phase === "finish") && elapsed >= this.targetMs + this.perfectIntervalMs * LATE_EDGE) {
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
    if (lastTurn && judgement !== "miss") {
      this.beginFinishMove();
      return;
    }

    if (judgement === "miss") {
      // Immediately select the next normal chart turn, but hide it for exactly
      // one full four-beat penalty cycle. This prevents the old "never returns"
      // dead state while still applying the requested one-turn penalty.
      this.turnIndex += 1;
      this.penaltyEndsMs = this.targetMs + this.perfectIntervalMs;
      this.targetMs = this.penaltyEndsMs + this.perfectIntervalMs;
      this.phase = "penalty";
      this.callbacks.onPhase?.("penalty");
      this.callbacks.onSequence?.([], 0);
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
    this.callbacks.onSequence?.(this.currentDirections, this.commandIndex);
  }

  private emitStats(force = false) {
    const signature = JSON.stringify(this.engine.stats);
    if (force || signature !== this.lastStatsSignature) {
      this.lastStatsSignature = signature;
      this.callbacks.onStats?.({ ...this.engine.stats });
    }
  }

  private get moveId() { return this.finishMove ? (this.chart.turns?.length ?? 0) : this.turnIndex; }
  private get firstPerfectMs() { return this.chart.firstPerfectMs ?? this.beatDurationMs * COUNTDOWN_BEATS; }
  private get perfectIntervalMs() { return this.beatDurationMs * GAUGE_CYCLE_BEATS; }
  private get perfectOffsetMs() { return this.perfectIntervalMs; }
  private get beatDurationMs() { return 60000 / this.chart.bpm; }
}
