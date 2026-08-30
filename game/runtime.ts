import { BeatClock } from "./clock";
import { sequenceForLevel } from "./chart";
import { RhythmEngine } from "./rhythm";
import type { Chart, Direction, GameStats, Judgement } from "./types";

export type RhythmPhase = "idle" | "countdown" | "playing" | "finish" | "finished";
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

const LEVELS = 9;
const COUNTDOWN_BEATS = 4;
const GAUGE_CYCLE_BEATS = 2;
const SCORE_ZONE_START = 75;
const SCORE_ZONE_END = 95;
const PERFECT_CENTER = 85;

export class RhythmRuntime {
  private readonly chart: Chart;
  private readonly callbacks: RhythmRuntimeCallbacks;
  private engine = new RhythmEngine();
  private clock: BeatClock;
  private timeSource: (() => number) | null = null;
  private raf = 0;
  private started = false;
  private finished = false;
  private phase: RhythmPhase = "idle";
  private levelIndex = 0;
  private commandIndex = 0;
  private awaitingSpace = false;
  private armedDeadlineMs = 0;
  private lastCountdown = -1;
  private lastStatsSignature = "";

  constructor(chart: Chart, callbacks: RhythmRuntimeCallbacks = {}) {
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
    this.engine = new RhythmEngine();
    this.clock = new BeatClock(this.chart.bpm, this.chart.offsetMs);
    this.clock.setTimeSource(this.timeSource);
    this.started = true;
    this.finished = false;
    this.phase = "countdown";
    this.levelIndex = 0;
    this.commandIndex = 0;
    this.awaitingSpace = false;
    this.armedDeadlineMs = 0;
    this.lastCountdown = -1;
    this.lastStatsSignature = "";
    this.clock.start();
    this.callbacks.onPhase?.("countdown");
    this.callbacks.onCountdown?.(3);
    this.callbacks.onLevel?.(1);
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
  get currentLevel() { return this.levelIndex + 1; }
  get currentPhase() { return this.phase; }
  get sequence() { return this.canInput() ? sequenceForLevel(this.currentLevel) : []; }
  get completedCommands() { return this.commandIndex; }
  get awaitingTiming() { return this.awaitingSpace; }

  get gaugePercent() {
    if (!this.canInput()) return 0;
    const cycleMs = this.beatDurationMs * GAUGE_CYCLE_BEATS;
    return ((this.clock.elapsedMs % cycleMs) / cycleMs) * 100;
  }

  // Compatibility alias used by the earlier GameShell implementation.
  get timingGaugePercent() { return this.gaugePercent; }

  get timingDeltaMs() {
    if (!this.canInput()) return 0;
    const cycleMs = this.beatDurationMs * GAUGE_CYCLE_BEATS;
    let distance = this.gaugePercent - PERFECT_CENTER;
    if (distance > 50) distance -= 100;
    if (distance < -50) distance += 100;
    return (distance / 100) * cycleMs;
  }

  handleDirection(direction: Direction) {
    if (!this.canInput() || this.awaitingSpace) return false;
    const sequence = sequenceForLevel(this.currentLevel);
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
      const cycleMs = this.beatDurationMs * GAUGE_CYCLE_BEATS;
      const cycleEnd = (Math.floor(this.clock.elapsedMs / cycleMs) + 1) * cycleMs;
      this.armedDeadlineMs = cycleEnd + (this.gaugePercent > SCORE_ZONE_END ? cycleMs : 0);
    }
    this.emitSequence();
    return true;
  }

  handleSpace() {
    if (!this.canInput() || !this.awaitingSpace) return null;
    const percent = this.gaugePercent;
    if (percent < SCORE_ZONE_START || percent > SCORE_ZONE_END) {
      this.engine.missMove(this.levelIndex);
      this.completeMove("miss");
      return "miss" as Judgement;
    }
    const judgement = this.engine.judgeMove(this.levelIndex, this.timingDeltaMs);
    if (!judgement) return null;
    this.completeMove(judgement);
    return judgement;
  }

  private canInput() {
    return this.started && !this.finished && (this.phase === "playing" || this.phase === "finish");
  }

  private loop = () => {
    if (!this.started || this.finished) return;
    const elapsed = this.clock.elapsedMs;

    if (this.phase === "countdown") {
      const beat = Math.floor(elapsed / this.beatDurationMs);
      const value = Math.max(0, COUNTDOWN_BEATS - 1 - beat);
      if (value !== this.lastCountdown) {
        this.lastCountdown = value;
        this.callbacks.onCountdown?.(value);
      }
      if (elapsed >= COUNTDOWN_BEATS * this.beatDurationMs) {
        this.phase = "playing";
        this.callbacks.onCountdown?.(null);
        this.callbacks.onPhase?.("playing");
        this.callbacks.onLevel?.(1);
        this.emitSequence();
      }
    } else if (this.canInput() && this.awaitingSpace && elapsed >= this.armedDeadlineMs) {
      this.engine.missMove(this.levelIndex);
      this.completeMove("miss");
    }

    this.raf = requestAnimationFrame(this.loop);
  };

  private completeMove(judgement: Judgement) {
    this.awaitingSpace = false;
    this.callbacks.onJudgement?.(judgement);
    this.callbacks.onPulse?.();
    this.emitStats(true);

    if (this.levelIndex >= LEVELS - 1) {
      this.finished = true;
      this.started = false;
      this.phase = "finished";
      this.callbacks.onSequence?.([], 0);
      this.callbacks.onFinished?.({ ...this.engine.stats });
      return;
    }

    this.levelIndex += 1;
    this.commandIndex = 0;
    this.phase = this.levelIndex === LEVELS - 1 ? "finish" : "playing";
    this.callbacks.onPhase?.(this.phase);
    this.callbacks.onLevel?.(this.currentLevel);
    this.emitSequence();
  }

  private emitSequence() {
    if (!this.canInput()) {
      this.callbacks.onSequence?.([], 0);
      return;
    }
    this.callbacks.onSequence?.(sequenceForLevel(this.currentLevel), this.commandIndex);
  }

  private emitStats(force = false) {
    const signature = JSON.stringify(this.engine.stats);
    if (force || signature !== this.lastStatsSignature) {
      this.lastStatsSignature = signature;
      this.callbacks.onStats?.({ ...this.engine.stats });
    }
  }

  private get beatDurationMs() { return 60000 / this.chart.bpm; }
}
