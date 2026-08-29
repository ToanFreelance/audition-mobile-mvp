import { BeatClock } from "./clock";
import { RhythmEngine } from "./rhythm";
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
  get completedCommands() { return this.commandCursor % 8; }
  get currentStep() { return this.commandCursor; }
  get totalCommands() { return this.chart.notes.length; }

  /**
   * Audition-style timing window:
   * the command sequence appears, then PERFECT is four beats later.
   * The approved UI places PERFECT at 85%, so the full visual sweep is
   * 4 / 0.85 = 4.7059 beats. At 128 BPM that is ~2206 ms per sweep.
   */
  get timingGaugePercent() {
    if (!this.started) return 0;

    const currentBeat = this.clock.currentBeat;
    const perfectBeat = (this.timingMoveIndex + 1) * BEATS_TO_PERFECT;
    const gaugeStartBeat = perfectBeat - BEATS_TO_PERFECT;
    const gaugeBeat = currentBeat - gaugeStartBeat;
    return Math.max(0, Math.min(100, (gaugeBeat / GAUGE_DURATION_BEATS) * 100));
  }

  get timingDeltaMs() {
    if (!this.started) return 0;
    const perfectBeat = (this.timingMoveIndex + 1) * BEATS_TO_PERFECT;
    return this.clock.elapsedMs - this.beatToMs(perfectBeat);
  }

  handleDirection(direction: Direction) {
    if (!this.started || this.finished) return false;

    const target = this.getCommandDirection(this.commandCursor);
    if (!target) return false;

    if (direction !== target) {
      // Wrong arrow restarts the command sequence from the first command.
      this.commandCursor = 0;
      this.emitSequence();
      this.callbacks.onPulse?.();
      return false;
    }

    this.commandCursor += 1;
    this.callbacks.onPulse?.();
    this.emitSequence();

    if (this.commandCursor >= this.chart.notes.length) {
      this.finished = true;
      this.callbacks.onFinished?.(cloneStats(this.engine.stats));
    }

    return true;
  }

  handleSpace() {
    if (!this.started || this.finished) return null;

    const note = this.engine.nextNote;
    if (!note) return null;

    const judgement = this.engine.judge(note.direction, this.clock.currentBeat);
    if (judgement) {
      this.timingMoveIndex += 1;
      this.callbacks.onJudgement?.(judgement);
      this.callbacks.onPulse?.();
      this.emitStats(true);
    }
    return judgement;
  }

  private loop = () => {
    if (!this.started || this.finished) return;
    this.engine.update(this.clock.currentBeat);
    this.emitStats(false);
    this.raf = requestAnimationFrame(this.loop);
  };

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
    const blockStart = Math.floor(this.commandCursor / 8) * 8;
    return Array.from({ length: 8 }, (_, index) => this.getCommandDirection(blockStart + index)).filter(
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
