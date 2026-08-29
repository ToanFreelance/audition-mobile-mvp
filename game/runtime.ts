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
};

export type RhythmPhase = "intro" | "countdown" | "playing" | "finished";

const DEMO_COMMANDS: Direction[] = ["left", "up", "down", "right", "left", "right", "up", "down"];
const BEATS_PER_MOVE = 4;
const COMMANDS_PER_MOVE = 8;
const COUNTDOWN_BEATS = 4;
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
    this.callbacks.onPhase?.("intro");
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

  destroy() {
    this.stop();
  }

  get isStarted() { return this.started; }
  get isFinished() { return this.finished; }
  get stats() { return cloneStats(this.engine.stats); }
  get sequence() { return this.phase === "playing" ? this.getVisibleSequence() : []; }
  get completedCommands() { return this.commandCursor % COMMANDS_PER_MOVE; }
  get currentStep() { return this.commandCursor; }
  get totalCommands() { return this.chart.notes.length; }
  get currentLevel() { return this.getMoveLevel(this.timingMoveIndex); }
  get currentPhase() { return this.phase; }
  get countdownNumber() {
    if (this.phase !== "countdown") return null;
    const elapsed = Math.max(0, this.clock.elapsedMs - this.countdownStartedAtMs);
    return Math.max(1, 3 - Math.floor(elapsed / this.beatDurationMs));
  }

  get timingGaugePercent() {
    if (!this.started || this.phase !== "playing") return 0;
    const targetMs = this.beatToMs(this.getTargetBeat(this.timingMoveIndex));
    const moveStartMs = targetMs - this.moveDurationMs;
    const progress = (this.clock.elapsedMs - moveStartMs) / this.moveDurationMs;
    return Math.max(0, Math.min(100, progress * 100));
  }

  get timingDeltaMs() {
    if (!this.started || this.phase !== "playing") return 0;
    return this.clock.elapsedMs - this.beatToMs(this.getTargetBeat(this.timingMoveIndex));
  }

  handleDirection(direction: Direction) {
    if (!this.started || this.finished || this.phase !== "playing") return false;
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
    if (!this.started || this.finished || this.phase !== "playing" || this.commandCursor === 0 || this.commandCursor % COMMANDS_PER_MOVE !== 0) return null;
    const deltaMs = this.timingDeltaMs;
    const judgement = this.engine.judgeMove(this.timingMoveIndex, deltaMs);
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
      if (this.clock.elapsedMs >= this.beatDurationMs) {
        this.phase = "countdown";
        this.countdownStartedAtMs = this.clock.elapsedMs;
        this.callbacks.onPhase?.("countdown");
      }
    } else if (this.phase === "countdown") {
      const elapsed = this.clock.elapsedMs - this.countdownStartedAtMs;
      if (elapsed >= COUNTDOWN_BEATS * this.beatDurationMs) {
        this.phase = "playing";
        this.callbacks.onPhase?.("playing");
        this.callbacks.onLevel?.(this.currentLevel);
        this.emitSequence();
      }
    } else if (this.phase === "playing") {
      const deltaMs = this.timingDeltaMs;
      if (deltaMs > WINDOWS_MS.bad && this.engine.missMove(this.timingMoveIndex)) {
        this.advanceAfterJudgement("miss");
        if (this.finished) return;
      }
    }

    this.raf = requestAnimationFrame(this.loop);
  };

  private advanceAfterJudgement(judgement: Judgement) {
    this.timingMoveIndex += 1;
    this.commandCursor = 0;
    this.callbacks.onJudgement?.(judgement);
    this.callbacks.onPulse?.();
    this.emitStats(true);
    this.emitSequence();
    this.callbacks.onLevel?.(this.currentLevel);

    if (this.timingMoveIndex >= this.totalMoves) {
      this.finished = true;
      this.phase = "finished";
      this.callbacks.onPhase?.("finished");
      this.callbacks.onFinished?.(cloneStats(this.engine.stats));
    }
  }

  private get totalMoves() {
    return Math.ceil(this.chart.notes.length / COMMANDS_PER_MOVE);
  }

  private get beatDurationMs() {
    return 60000 / this.chart.bpm;
  }

  private get moveDurationMs() {
    return BEATS_PER_MOVE * this.beatDurationMs;
  }

  private getTargetBeat(moveIndex: number) {
    return COUNTDOWN_BEATS + moveIndex * BEATS_PER_MOVE + BEATS_PER_MOVE;
  }

  private getMoveLevel(moveIndex: number) {
    if (moveIndex < 1) return 1;
    if (moveIndex < 3) return 2;
    if (moveIndex < 6) return 3;
    if (moveIndex < 10) return 4;
    if (moveIndex < 15) return 5;
    if (moveIndex < 21) return 6;
    if (moveIndex < 27) return 7;
    if (moveIndex < 33) return 8;
    return 9;
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
    this.callbacks.onSequence?.(this.getVisibleSequence(), this.completedCommands);
  }

  private getVisibleSequence() {
    const blockStart = Math.floor(this.commandCursor / COMMANDS_PER_MOVE) * COMMANDS_PER_MOVE;
    return Array.from({ length: COMMANDS_PER_MOVE }, (_, index) => this.getCommandDirection(blockStart + index)).filter((direction): direction is Direction => Boolean(direction));
  }

  private getCommandDirection(index: number): Direction | undefined {
    if (index < DEMO_COMMANDS.length) return DEMO_COMMANDS[index];
    return this.chart.notes[index]?.direction;
  }

  private beatToMs(beat: number) {
    return beat * this.beatDurationMs + this.chart.offsetMs;
  }
}
