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

const COUNTDOWN_BEATS = 4;
const GAUGE_CYCLE_BEATS = 4;
const LATE_EDGE = 0.10;
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
  private lastCountdown = -1;
  private lastStatsSignature = "";
  private finishDirections: Direction[] = [];
  private finishMove = false;
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

  syncToTimeSource() {
    this.clock.syncToTimeSource();
  }

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
    this.finishMove = false;
    this.finishDirections = [];
    this.targetMs = this.getTurnTargetMs(0);
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

  destroy() {
    this.stop();
  }

  get isStarted() {
    return this.started;
  }

  get isFinished() {
    return this.finished;
  }

  get stats() {
    return { ...this.engine.stats };
  }

  get currentLevel() {
    return this.finishMove
      ? (this.chart.turns?.[this.turnIndex]?.level ?? 1)
      : (this.chart.turns?.[this.turnIndex]?.level ?? 1);
  }

  get currentTurn() {
    return this.turnIndex + 1;
  }

  get currentPhase() {
    return this.phase;
  }

  get currentDirections() {
    if (this.finishMove) return this.finishDirections.slice();
    return this.chart.turns?.[this.turnIndex]?.directions?.slice() ?? [];
  }

  get sequence() {
    return this.started && !this.finished ? this.currentDirections : [];
  }

  get completedCommands() {
    return this.commandIndex;
  }

  get awaitingTiming() {
    return this.awaitingSpace;
  }

  /**
   * One continuous gauge clock for the entire song.
   * The firstPerfectMs anchor determines the phase only; it never changes
   * the gauge speed. Therefore a long intro simply produces more full
   * 0→100→0 sweeps before the first 3/2/1/0 countdown.
   */
  get gaugePercent() {
    if (!this.started || this.finished) return 0;

    const cycleMs = this.beatDurationMs * GAUGE_CYCLE_BEATS;
    const firstPerfect = this.chart.firstPerfectMs ?? this.beatDurationMs * COUNTDOWN_BEATS;
    const gaugePhaseStart = firstPerfect - cycleMs * (PERFECT_CENTER / 100);
    const raw = (this.clock.elapsedMs - gaugePhaseStart) / cycleMs;
    const wrapped = ((raw % 1) + 1) % 1;
    return wrapped * 100;
  }

  get timingGaugePercent() {
    return this.gaugePercent;
  }

  get timingDeltaMs() {
    if (!this.started || !this.targetMs) return 0;
    return this.clock.elapsedMs - this.targetMs;
  }

  handleDirection(direction: Direction) {
    if (!this.canInputDirections() || this.awaitingSpace) return false;

    const sequence = this.currentDirections;
    if (!sequence.length || this.commandIndex >= sequence.length) return false;

    const elapsed = this.clock.elapsedMs;
    const lateLimit = this.beatDurationMs * GAUGE_CYCLE_BEATS * LATE_EDGE;

    // Never leave the player in a dead state after the target passed.
    // Resolve the turn immediately and let the next turn render.
    if (elapsed > this.targetMs + lateLimit) {
      this.resolveMiss();
      return false;
    }

    // The final arrow may be entered exactly at the target. Once the target
    // has passed, the turn is no longer accepting arrows.
    if (elapsed > this.targetMs) return false;

    if (direction !== sequence[this.commandIndex]) {
      this.commandIndex = 0;
      this.callbacks.onPulse?.();
      this.emitSequence();
      return false;
    }

    this.commandIndex += 1;
    this.callbacks.onPulse?.();
    if (this.commandIndex === sequence.length) {
      this.awaitingSpace = true;
    }
    this.emitSequence();
    return true;
  }

  handleSpace() {
    // SPACE is deliberately blocked during intro and countdown. At the
    // exact target the phase changes to playing, so 0 itself is playable.
    if (!this.canInputSpace() || !this.awaitingSpace) return null;

    const delta = this.timingDeltaMs;
    const cycleMs = this.beatDurationMs * GAUGE_CYCLE_BEATS;
    const judgement = this.engine.judgeMove(this.turnIndex, delta, cycleMs);

    if (!judgement) {
      this.resolveMiss();
      return "miss" as Judgement;
    }

    this.completeMove(judgement);
    return judgement;
  }

  private canInputDirections() {
    return this.started && !this.finished && (
      this.phase === "countdown" ||
      this.phase === "playing" ||
      this.phase === "finish"
    );
  }

  private canInputSpace() {
    return this.started && !this.finished && (
      this.phase === "playing" ||
      this.phase === "finish"
    );
  }

  private loop = () => {
    if (!this.started || this.finished) return;

    const elapsed = this.clock.elapsedMs;
    const countdownStart = this.targetMs - COUNTDOWN_BEATS * this.beatDurationMs;

    // Only the first target gets 3/2/1/0. A long song intro does not slow the
    // gauge; it only delays this countdown until firstPerfectMs.
    if (this.phase === "intro" && elapsed >= countdownStart) {
      this.phase = "countdown";
      this.lastCountdown = -1;
      this.callbacks.onPhase?.("countdown");
    }

    if (this.phase === "countdown") {
      const beat = Math.floor(Math.max(0, elapsed - countdownStart) / this.beatDurationMs);
      const value = Math.max(0, COUNTDOWN_BEATS - 1 - beat);
      if (value !== this.lastCountdown) {
        this.lastCountdown = value;
        this.callbacks.onCountdown?.(value);
      }

      if (elapsed >= this.targetMs) {
        this.phase = "playing";
        this.zeroVisible = true;
        // Keep 0 visible for exactly one render tick, then remove it. This
        // avoids the persistent-zero state seen in the mobile build.
        this.callbacks.onCountdown?.(0);
        this.callbacks.onPhase?.("playing");
        requestAnimationFrame(() => {
          if (!this.started || this.finished || !this.zeroVisible) return;
          this.zeroVisible = false;
          this.callbacks.onCountdown?.(null);
        });
      }
    }

    const lateLimit = this.beatDurationMs * GAUGE_CYCLE_BEATS * LATE_EDGE;
    if ((this.phase === "playing" || this.phase === "finish") && elapsed > this.targetMs + lateLimit) {
      this.resolveMiss();
      return;
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
      // Mirror Audition's Finish Move rather than abruptly ending after the
      // last normal level turn. Bomb/Chance modifiers are intentionally off.
      this.finishMove = true;
      this.finishDirections = randomDirections(6);
      this.commandIndex = 0;
      this.awaitingSpace = false;
      this.phase = "finish";
      this.targetMs += this.beatDurationMs * GAUGE_CYCLE_BEATS;
      this.callbacks.onPhase?.("finish");
      this.emitSequence();
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
    this.completeMove("miss");
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

  private getTurnTargetMs(turnIndex: number) {
    const turn = this.chart.turns?.[turnIndex];
    if (turn) return (turn.startBeat + GAUGE_CYCLE_BEATS) * this.beatDurationMs;
    const firstPerfect = this.chart.firstPerfectMs ?? COUNTDOWN_BEATS * this.beatDurationMs;
    return firstPerfect + turnIndex * this.beatDurationMs * GAUGE_CYCLE_BEATS;
  }

  private get beatDurationMs() {
    return 60000 / this.chart.bpm;
  }
}
