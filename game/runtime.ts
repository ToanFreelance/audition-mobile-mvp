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
const PERFECT_GAUGE_PERCENT = 75;
const LEVEL_MOVE_COUNTS = [1, 2, 3, 4, 5, 6, 6, 6, 6] as const;
const FIRST_FINISH_MOVE_INDEX = LEVEL_MOVE_COUNTS.reduce((sum, count) => sum + count, 0);
const POST_FINISH_MOVE_COUNTS = [6, 6, 6, 6] as const;
const cloneStats = (stats: GameStats): GameStats => ({ ...stats });

export class RhythmRuntime {
  private readonly chart: Chart;
  private readonly callbacks: RhythmRuntimeCallbacks;
  private engine: RhythmEngine;
  private clock: BeatClock;
  private timeSource: (() => number) | null = null;
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

  setTimeSource(source: (() => number) | null) {
    this.timeSource = source;
    this.clock.setTimeSource(source);
  }

  syncToTimeSource() { this.clock.syncToTimeSource(); }

  start() {
    this.stop();
    this.engine = new RhythmEngine(this.chart);
    this.clock = new BeatClock(this.chart.bpm, this.chart.offsetMs);
    this.clock.setTimeSource(this.timeSource);
    this.commandCursor = 0;
    this.timingMoveIndex = 0;
    this.started = true;
    this.finished = false;
    this.lastStatsSignature = "";
    this.phase = "countdown";
    this.countdownStartedAtMs = 0;
    this.lastCountdown = -1;
    this.skipCurrentMove = false;
    this.callbacks.onPhase?.("countdown");
    this.callbacks.onCountdown?.(3);
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
    return Math.min(3, Math.max(0, 3 - Math.floor(elapsed / this.beatDurationMs)));
  }

  get timingGaugePercent() {
    if (!this.started) return PERFECT_GAUGE_PERCENT;
    if (this.phase === "intro" || this.phase === "countdown") return PERFECT_GAUGE_PERCENT;
    if (this.phase !== "playing" && this.phase !== "finish") return PERFECT_GAUGE_PERCENT;

    // The gauge is a continuous one-way sweep. Beat analysis supplies the
    // actual measure boundaries; the marker never reverses at 100%.
    const cycleMs = this.getMeasuredCycleDurationMs();
    const elapsedFromBeatZero = this.clock.elapsedMs - this.beatZeroAudioMs;
    const cycleElapsed = ((elapsedFromBeatZero % cycleMs) + cycleMs) % cycleMs;
    return (PERFECT_GAUGE_PERCENT + (cycleElapsed / cycleMs) * 100) % 100;
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

    const elapsed = this.clock.elapsedMs;
    if (this.phase === "intro") {
      this.phase = "countdown";
      this.lastCountdown = -1;
      this.callbacks.onPhase?.("countdown");
    } else if (this.phase === "countdown") {
      const countdownElapsed = Math.max(0, elapsed - this.countdownStartedAtMs);
      const countdown = Math.min(3, Math.max(0, 3 - Math.floor(countdownElapsed / this.beatDurationMs)));
      if (countdown !== this.lastCountdown) {
        this.lastCountdown = countdown;
        this.callbacks.onCountdown?.(countdown);
      }
      if (elapsed >= this.beatZeroAudioMs) {
        this.callbacks.onCountdown?.(0);
        this.phase = "playing";
        this.callbacks.onPhase?.("playing");
        this.callbacks.onCountdown?.(null);
        this.callbacks.onLevel?.(this.currentLevel);
        this.emitSequence();
      }
    } else if (this.phase === "playing" || this.phase === "finish") {
      if (this.skipCurrentMove) {
        if (this.timingDeltaMs > WINDOWS_MS.bad) this.advanceSkippedMove();
      } else if (this.commandCursor === COMMANDS_PER_MOVE && this.timingDeltaMs > WINDOWS_MS.bad && this.engine.missMove(this.timingMoveIndex)) {
        this.advanceAfterJudgement("miss");
        if (this.finished) return;
      }
    }

    this.raf = requestAnimationFrame(this.loop);
  };

  private advanceAfterJudgement(judgement: Judgement) {
    this.timingMoveIndex += 1;
    this.commandCursor = 0;
    this.skipCurrentMove = judgement === "miss";
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
  private get countdownDurationMs() { return COUNTDOWN_BEATS * this.beatDurationMs; }
  private get beatZeroAudioMs() { return this.chart.beatTimesMs?.[COUNTDOWN_BEATS] ?? this.countdownDurationMs; }
  private get moveDurationMs() { return BEATS_PER_MOVE * this.beatDurationMs; }

  private getMeasuredCycleDurationMs() {
    const beats = this.chart.beatTimesMs;
    const startIndex = COUNTDOWN_BEATS;
    const endIndex = startIndex + BEATS_PER_MOVE;
    if (beats && beats[endIndex] !== undefined && beats[startIndex] !== undefined) {
      const measured = beats[endIndex] - beats[startIndex];
      if (measured > 0) return measured;
    }
    return this.moveDurationMs;
  }

  private getTargetTimeMs(moveIndex: number) {
    const beats = this.chart.beatTimesMs;
    const targetBeatIndex = COUNTDOWN_BEATS + (moveIndex + 1) * BEATS_PER_MOVE;
    if (beats?.[targetBeatIndex] !== undefined) return beats[targetBeatIndex] + this.chart.offsetMs;
    return this.beatZeroAudioMs + (moveIndex + 1) * this.moveDurationMs + this.chart.offsetMs;
  }
}
