import { BeatClock } from "./clock";
import { RhythmEngine, WINDOWS_MS } from "./rhythm";
import type { Chart, Direction, GameStats, Judgement } from "./types";

export type RhythmRuntimeCallbacks = {
  onStats?: (stats: GameStats) => void;
  onJudgement?: (judgement: Judgement) => void;
  onSequence?: (directions: Direction[], filledCount: number) => void;
  onFinished?: (stats: GameStats) => void;
  onPulse?: () => void;
};

const DEMO_COMMANDS: Direction[] = [
  "left", "up", "down", "right", "left", "right", "up", "down",
];

const BEATS_TO_PERFECT = 4;
const PERFECT_GAUGE_PERCENT = 85;
const GAUGE_DURATION_BEATS = BEATS_TO_PERFECT / (PERFECT_GAUGE_PERCENT / 100);
const COMMANDS_PER_MOVE = 8;

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
  get sequence() { return this.getVisibleSequence(); }
  get completedCommands() { return this.commandCursor % COMMANDS_PER_MOVE; }
  get currentStep() { return this.commandCursor; }
  get totalCommands() { return this.chart.notes.length; }

  /**
   * Audition-style rhythm bead: it traverses the entire gauge and loops.
   * PERFECT is at 85% of the visual sweep, exactly 4 beats after the move
   * starts. The remaining 15% completes the bar before it loops again.
   */
  get timingGaugePercent() {
    if (!this.started) return 0;

    const currentBeat = this.clock.currentBeat;
    const cycleBeat = currentBeat % GAUGE_DURATION_BEATS;
    return Math.max(0, Math.min(100, (cycleBeat / GAUGE_DURATION_BEATS) * 100));
  }

  get timingDeltaMs() {
    if (!this.started) return 0;
    const targetBeat = this.getTargetBeat(this.timingMoveIndex);
    return this.clock.elapsedMs - this.beatToMs(targetBeat);
  }

  handleDirection(direction: Direction) {
    if (!this.started || this.finished) return false;

    const target = this.getCommandDirection(this.commandCursor);
    if (!target) return false;

    if (direction !== target) {
      const moveStart = Math.floor(this.commandCursor / COMMANDS_PER_MOVE) * COMMANDS_PER_MOVE;
      this.commandCursor = moveStart;
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
    if (!this.started || this.finished) return null;

    // The current command sequence must be completed before SPACE can
    // resolve the move, matching the classic Audition flow.
    if (this.commandCursor === 0 || this.commandCursor % COMMANDS_PER_MOVE !== 0) {
      return null;
    }

    const targetBeat = this.getTargetBeat(this.timingMoveIndex);
    const deltaMs = this.clock.elapsedMs - this.beatToMs(targetBeat);
    const judgement = this.engine.judgeMove(this.timingMoveIndex, deltaMs);

    if (judgement) {
      this.timingMoveIndex += 1;
      this.callbacks.onJudgement?.(judgement);
      this.callbacks.onPulse?.();
      this.emitStats(true);

      if (this.timingMoveIndex >= this.totalMoves) {
        this.finished = true;
        this.callbacks.onFinished?.(cloneStats(this.engine.stats));
      }
    }

    return judgement;
  }

  private loop = () => {
    if (!this.started || this.finished) return;

    const targetBeat = this.getTargetBeat(this.timingMoveIndex);
    const deltaMs = this.clock.elapsedMs - this.beatToMs(targetBeat);

    // Once the 185 ms BAD window is passed, the move becomes MISS and the
    // next gauge cycle starts. Repeated SPACE presses can no longer score it.
    if (deltaMs > WINDOWS_MS.bad) {
      if (this.engine.missMove(this.timingMoveIndex)) {
        this.timingMoveIndex += 1;
        this.commandCursor = Math.min(
          this.timingMoveIndex * COMMANDS_PER_MOVE,
          this.chart.notes.length
        );
        this.emitSequence();
        this.emitStats(true);

        if (this.timingMoveIndex >= this.totalMoves) {
          this.finished = true;
          this.callbacks.onFinished?.(cloneStats(this.engine.stats));
          return;
        }
      }
    }

    this.raf = requestAnimationFrame(this.loop);
  };

  private get totalMoves() {
    return Math.ceil(this.chart.notes.length / COMMANDS_PER_MOVE);
  }

  private getTargetBeat(moveIndex: number) {
    return moveIndex * GAUGE_DURATION_BEATS + BEATS_TO_PERFECT;
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
    return Array.from({ length: COMMANDS_PER_MOVE }, (_, index) => this.getCommandDirection(blockStart + index)).filter(
      (direction): direction is Direction => Boolean(direction),
    );
  }

  private getCommandDirection(index: number): Direction | undefined {
    if (index < DEMO_COMMANDS.length) return DEMO_COMMANDS[index];
    return this.chart.notes[index]?.direction;
  }

  private beatToMs(beat: number) {
    return beat * 60000 / this.chart.bpm;
  }
}
