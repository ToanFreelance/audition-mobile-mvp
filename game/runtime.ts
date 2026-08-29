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

const cloneStats = (stats: GameStats): GameStats => ({ ...stats });

export class RhythmRuntime {
  private readonly chart: Chart;
  private readonly callbacks: RhythmRuntimeCallbacks;
  private engine: RhythmEngine;
  private clock: BeatClock;
  private commandCursor = 0;
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

  get timingGaugePercent() {
    const note = this.engine.nextNote;
    if (!note) return 100;
    const deltaMs = this.clock.elapsedMs - this.beatToMs(note.beat);
    return Math.max(0, Math.min(100, 85 + deltaMs / 10));
  }

  get timingDeltaMs() {
    const note = this.engine.nextNote;
    if (!note) return 0;
    return this.clock.elapsedMs - this.beatToMs(note.beat);
  }

  handleDirection(direction: Direction) {
    if (!this.started || this.finished) return false;

    const target = this.getCommandDirection(this.commandCursor);
    if (!target) return false;

    if (direction !== target) {
      // A wrong arrow restarts the command sequence from the beginning.
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
