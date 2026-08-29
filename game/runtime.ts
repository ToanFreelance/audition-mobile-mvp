import { BeatClock } from "./clock";
import { RhythmEngine, WINDOWS_MS } from "./rhythm";
import type { Chart, Direction, GameStats, Judgement } from "./types";

export type RhythmRuntimeCallbacks = {
  onStats?: (stats: GameStats) => void;
  onJudgement?: (judgement: Judgement) => void;
  onSequence?: (directions: Direction[], filledCount: number) => void;
  onFinished?: (stats: GameStats) => void;
  onPulse?: () => void;
  onLevel?: (level: number) => void;
  onPhase?: (phase: RhythmPhase) => void;
  onCountdown?: (value: number | null) => void;
};

export type RhythmPhase = "intro" | "countdown" | "playing" | "finish" | "finished";

const DEMO_COMMANDS: Direction[] = ["left", "up", "down", "right", "left", "right", "up", "down"];
const BEATS_PER_MOVE = 4;
const COMMANDS_PER_MOVE = 8;
const COUNTDOWN_BEATS = 4;
const INTRO_BEATS = 4;
const LEVEL_MOVE_COUNTS = [1, 2, 3, 4, 5, 6, 6, 6, 6] as const;
const FIRST_FINISH_MOVE_INDEX = LEVEL_MOVE_COUNTS.reduce((sum, count) => sum + count, 0);
const POST_FINISH_MOVE_COUNTS = [6, 6, 6, 6] as const;
const cloneStats = (stats: GameStats): GameStats => ({ ...stats });

export class RhythmRuntime {
  private readonly chart: Chart;
  private readonly callbacks: RhythmRuntimeCallbacks;
  private engine: RhythmEngine;
  private clock: BeatClock;
  private commandCursor = 0;
  private timingMoveIndex = 0;
  private started = false;
  private finished = false;
  private raf = 0;
  private lastStatsSignature = "";
  private phase: RhythmPhase = "intro";
  private countdownStartedAtMs = 0;
  private lastCountdown = -1;
  private skipCurrentMove = false;

  constructor(chart: Chart, callbacks: RhythmRuntimeCallbacks = {}) {
    this.chart = chart;
    this.callbacks = callbacks;
    this.engine = new RhythmEngine(chart);
    this.clock = new BeatClock(chart.bpm, chart.offsetMs);
  }

  start() {
    this.stop();
    this.engine = new RhythmEngine(this.chart);
    this.clock = new BeatClock(this.chart.bpm, this.chart.offsetMs);
    this.commandCursor = 0;
    this.timingMoveIndex = 0;
    this.started = true;
    this.finished = false;
    this.lastStatsSignature = "";
    this.phase = "intro";
    this.countdownStartedAtMs = 0;
    this.lastCountdown = -1;
    this.skipCurrentMove = false;
    this.callbacks.onPhase?.("intro");
    this.callbacks.onCountdown?.(null);
    this.callbacks.onLevel?.(1);
    this.clock.start();
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
  get stats() { return cloneStats(this.engine.stats); }
  get sequence() { return this.phase === "playing" || this.phase === "finish" ? this.getVisibleSequence() : []; }
  get completedCommands() { return this.commandCursor % COMMANDS_PER_MOVE; }
  get currentStep() { return this.commandCursor; }
  get totalCommands() { return this.chart.notes.length; }
  get currentLevel() { return this.getMoveInfo(this.timingMoveIndex).level; }
  get currentPhase() { return this.phase; }
  get isSkippingMove() { return this.skipCurrentMove; }

  get countdownNumber() {
    if (this.phase !== "countdown") return null;
    const elapsed = Math.max(0, this.clock.elapsedMs - this.countdownStartedAtMs);
    return Math.max(1, 3 - Math.floor(elapsed / this.beatDurationMs));
  }

  get timingGaugePercent() {
    if (!this.started || (this.phase !== "playing" && this.phase !== "finish")) return 0;
    const targetMs = this.getTargetTimeMs(this.timingMoveIndex);
    const moveStartMs = targetMs - this.moveDurationMs;
    return Math.max(0, Math.min(100, ((this.clock.elapsedMs - moveStartMs) / this.moveDurationMs) * 100));
  }

  get timingDeltaMs() {
    if (!this.started || (this.phase !== "playing" && this.phase !== "finish")) return 0;
    return this.clock.elapsedMs - this.getTargetTimeMs(this.timingMoveIndex);
  }

  handleDirection(direction: Direction) {
    if (!this.started || this.finished || (this.phase !== "playing" && this.phase !== "finish") || this.skipCurrentMove) return false;
    const target = this.getCommandDirection(this.commandCursor);
    if (!target) return false;
    if (direction !== target) {
      this.commandCursor = 0;
      this.emitSequence();
      this.callbacks.onPulse?.();
      return false;
    }
    this.commandCursor += 1;
    this.callbacks.onPulse?.();
    this.emitSequence();
    return true;
  }

  handleSpace() {
    if (!this.started || this.finished || (this.phase !== "playing" && this.phase !== "finish") || this.skipCurrentMove || this.commandCursor === 0 || this.commandCursor % COMMANDS_PER_MOVE !== 0) return null;
    const judgement = this.engine.judgeMove(this.timingMoveIndex, this.timingDeltaMs);
    if (judgement) {
      this.advanceAfterJudgement(judgement);
      return judgement;
    }
    if (this.engine.missMove(this.timingMoveIndex)) {
      this.advanceAfterJudgement("miss");
      return "miss";
    }
    return null;
  }

  private loop = () => {
    if (!this.started || this.finished) return;

    if (this.phase === "intro") {
      if (this.clock.elapsedMs >= INTRO_BEATS * this.beatDurationMs) {
        this.phase = "countdown";
        this.countdownStartedAtMs = this.clock.elapsedMs;
        this.lastCountdown = -1;
        this.callbacks.onPhase?.("countdown");
      }
    } else if (this.phase === "countdown") {
      const elapsed = this.clock.elapsedMs - this.countdownStartedAtMs;
      const countdown = 3 - Math.floor(elapsed / this.beatDurationMs);
      const display = countdown >= 1 ? countdown : null;
      if ((display === null ? 0 : display) !== this.lastCountdown) {
        this.lastCountdown = display ?? 0;
        this.callbacks.onCountdown?.(display);
      }
      if (elapsed >= COUNTDOWN_BEATS * this.beatDurationMs) {
        this.phase = "playing";
        this.callbacks.onPhase?.("playing");
        this.callbacks.onCountdown?.(null);
        this.callbacks.onLevel?.(this.currentLevel);
        this.emitSequence();
      }
    } else if (this.phase === "playing" || this.phase === "finish") {
      if (this.skipCurrentMove) {
        if (this.timingDeltaMs > WINDOWS_MS.bad) this.advanceSkippedMove();
      } else if (this.timingDeltaMs > WINDOWS_MS.bad && this.engine.missMove(this.timingMoveIndex)) {
        this.advanceAfterJudgement("miss");
        if (this.finished) return;
      }
    }

    this.raf = requestAnimationFrame(this.loop);
  };

  private advanceAfterJudgement(judgement: Judgement) {
    this.timingMoveIndex += 1;
    this.commandCursor = 0;
    if (judgement === "miss") this.skipCurrentMove = true;
    this.updatePhaseForCurrentMove();
    this.callbacks.onJudgement?.(judgement);
    this.callbacks.onPulse?.();
    this.emitStats(true);
    this.emitSequence();
    this.callbacks.onLevel?.(this.currentLevel);
  }

  private advanceSkippedMove() {
    this.timingMoveIndex += 1;
    this.commandCursor = 0;
    this.skipCurrentMove = false;
    this.updatePhaseForCurrentMove();
    this.callbacks.onPulse?.();
    this.emitSequence();
    this.callbacks.onLevel?.(this.currentLevel);
  }

  private updatePhaseForCurrentMove() {
    const info = this.getMoveInfo(this.timingMoveIndex);
    if (info.kind === "finish") {
      if (this.phase !== "finish") this.callbacks.onPhase?.("finish");
      this.phase = "finish";
      return;
    }
    if (this.phase === "finish") this.callbacks.onPhase?.("playing");
    this.phase = "playing";
  }

  private getMoveInfo(moveIndex: number): { kind: "level" | "finish"; level: number } {
    if (moveIndex < FIRST_FINISH_MOVE_INDEX) {
      let cursor = 0;
      for (let level = 1; level <= LEVEL_MOVE_COUNTS.length; level += 1) {
        cursor += LEVEL_MOVE_COUNTS[level - 1];
        if (moveIndex < cursor) return { kind: "level", level };
      }
    }

    const cycleLength = POST_FINISH_MOVE_COUNTS.reduce((sum, count) => sum + count, 0) + 1;
    const cycleOffset = (moveIndex - FIRST_FINISH_MOVE_INDEX) % cycleLength;
    if (cycleOffset === 0) return { kind: "finish", level: 9 };

    let cursor = 0;
    for (let index = 0; index < POST_FINISH_MOVE_COUNTS.length; index += 1) {
      cursor += POST_FINISH_MOVE_COUNTS[index];
      if (cycleOffset <= cursor) return { kind: "level", level: 6 + index };
    }
    return { kind: "level", level: 6 };
  }

  private emitStats(force: boolean) {
    const stats = this.engine.stats;
    const signature = JSON.stringify(stats);
    if (force || signature !== this.lastStatsSignature) {
      this.lastStatsSignature = signature;
      this.callbacks.onStats?.(cloneStats(stats));
    }
  }

  private emitSequence() {
    if (this.skipCurrentMove) {
      this.callbacks.onSequence?.([], 0);
      return;
    }
    this.callbacks.onSequence?.(this.getVisibleSequence(), this.completedCommands);
  }

  private getVisibleSequence() {
    const blockStart = Math.floor(this.commandCursor / COMMANDS_PER_MOVE) * COMMANDS_PER_MOVE;
    return Array.from({ length: COMMANDS_PER_MOVE }, (_, index) => this.getCommandDirection(blockStart + index)).filter((direction): direction is Direction => Boolean(direction));
  }

  private getCommandDirection(index: number): Direction | undefined {
    if (index < DEMO_COMMANDS.length) return DEMO_COMMANDS[index];
    if (this.chart.notes.length === 0) return undefined;
    return this.chart.notes[index % this.chart.notes.length]?.direction;
  }

  private get beatDurationMs() { return 60000 / this.chart.bpm; }
  private get moveDurationMs() { return BEATS_PER_MOVE * this.beatDurationMs; }
  private getTargetTimeMs(moveIndex: number) { return (INTRO_BEATS + COUNTDOWN_BEATS + (moveIndex + 1) * BEATS_PER_MOVE) * this.beatDurationMs + this.chart.offsetMs; }
}
