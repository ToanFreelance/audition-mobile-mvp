import { BeatClock, type ClockTimeSource } from "./clock";
import { RhythmEngine, WINDOWS_MS } from "./rhythm";
import type { Chart, Direction, GameStats, Judgement } from "./types";

export type RhythmRuntimeCallbacks = { onStats?: (stats: GameStats) => void; onJudgement?: (judgement: Judgement) => void; onSequence?: (directions: Direction[], filledCount: number) => void; onFinished?: (stats: GameStats) => void; onPulse?: () => void };
const DEMO_COMMANDS: Direction[] = ["left", "up", "down", "right", "left", "right", "up", "down"];
const BEATS_TO_PERFECT = 4;
const PERFECT_GAUGE_PERCENT = 85;
const GAUGE_DURATION_BEATS = BEATS_TO_PERFECT / (PERFECT_GAUGE_PERCENT / 100);
const COMMANDS_PER_MOVE = 8;
const cloneStats = (stats: GameStats): GameStats => ({ ...stats });

export class RhythmRuntime {
  private readonly chart: Chart; private readonly callbacks: RhythmRuntimeCallbacks; private engine: RhythmEngine; private clock: BeatClock;
  private commandCursor = 0; private timingMoveIndex = 0; private started = false; private finished = false; private raf = 0; private lastStatsSignature = ""; private timeSource: ClockTimeSource | null = null;
  constructor(chart: Chart, callbacks: RhythmRuntimeCallbacks = {}) { this.chart = chart; this.callbacks = callbacks; this.engine = new RhythmEngine(chart); this.clock = new BeatClock(chart.bpm, chart.offsetMs); }
  setTimeSource(source: ClockTimeSource | null) { this.timeSource = source; this.clock.setTimeSource(source); }
  start() { this.stop(); this.engine = new RhythmEngine(this.chart); this.clock = new BeatClock(this.chart.bpm, this.chart.offsetMs); this.clock.setTimeSource(this.timeSource); this.commandCursor = 0; this.timingMoveIndex = 0; this.started = true; this.finished = false; this.lastStatsSignature = ""; this.clock.start(); this.emitSequence(); this.emitStats(true); this.loop(); }
  stop() { if (this.raf) cancelAnimationFrame(this.raf); this.raf = 0; this.started = false; }
  destroy() { this.stop(); }
  get isStarted() { return this.started; } get isFinished() { return this.finished; } get stats() { return cloneStats(this.engine.stats); } get sequence() { return this.getVisibleSequence(); } get completedCommands() { return this.commandCursor % COMMANDS_PER_MOVE; } get currentStep() { return this.commandCursor; } get totalCommands() { return this.chart.notes.length; }
  get timingGaugePercent() { if (!this.started) return 0; const cycleBeat = this.clock.currentBeat % GAUGE_DURATION_BEATS; return Math.max(0, Math.min(100, (cycleBeat / GAUGE_DURATION_BEATS) * 100)); }
  get timingDeltaMs() { if (!this.started) return 0; return this.clock.elapsedMs - this.beatToMs(this.getTargetBeat(this.timingMoveIndex)); }
  handleDirection(direction: Direction) { if (!this.started || this.finished) return false; const target = this.getCommandDirection(this.commandCursor); if (!target) return false; if (direction !== target) { this.commandCursor = Math.floor(this.commandCursor / COMMANDS_PER_MOVE) * COMMANDS_PER_MOVE; this.emitSequence(); this.callbacks.onPulse?.(); return false; } this.commandCursor += 1; this.callbacks.onPulse?.(); this.emitSequence(); return true; }
  handleSpace() { if (!this.started || this.finished || this.commandCursor === 0 || this.commandCursor % COMMANDS_PER_MOVE !== 0) return null; const deltaMs = this.clock.elapsedMs - this.beatToMs(this.getTargetBeat(this.timingMoveIndex)); const judgement = this.engine.judgeMove(this.timingMoveIndex, deltaMs); if (judgement) { this.advanceAfterJudgement(judgement); return judgement; } if (this.engine.missMove(this.timingMoveIndex)) { this.advanceAfterJudgement("miss"); return "miss"; } return null; }
  private loop = () => { if (!this.started || this.finished) return; const deltaMs = this.clock.elapsedMs - this.beatToMs(this.getTargetBeat(this.timingMoveIndex)); if (deltaMs > WINDOWS_MS.bad && this.engine.missMove(this.timingMoveIndex)) { this.advanceAfterJudgement("miss"); if (this.finished) return; } this.raf = requestAnimationFrame(this.loop); };
  private advanceAfterJudgement(judgement: Judgement) { this.timingMoveIndex += 1; this.callbacks.onJudgement?.(judgement); this.callbacks.onPulse?.(); this.emitStats(true); if (this.timingMoveIndex >= this.totalMoves) { this.finished = true; this.callbacks.onFinished?.(cloneStats(this.engine.stats)); } }
  private get totalMoves() { return Math.ceil(this.chart.notes.length / COMMANDS_PER_MOVE); }
  private getTargetBeat(moveIndex: number) { return moveIndex * GAUGE_DURATION_BEATS + BEATS_TO_PERFECT; }
  private emitStats(force: boolean) { const stats = this.engine.stats; const signature = JSON.stringify(stats); if (force || signature !== this.lastStatsSignature) { this.lastStatsSignature = signature; this.callbacks.onStats?.(cloneStats(stats)); } }
  private emitSequence() { this.callbacks.onSequence?.(this.getVisibleSequence(), this.completedCommands); }
  private getVisibleSequence() { const blockStart = Math.floor(this.commandCursor / COMMANDS_PER_MOVE) * COMMANDS_PER_MOVE; return Array.from({ length: COMMANDS_PER_MOVE }, (_, index) => this.getCommandDirection(blockStart + index)).filter((direction): direction is Direction => Boolean(direction)); }
  private getCommandDirection(index: number): Direction | undefined { if (index < DEMO_COMMANDS.length) return DEMO_COMMANDS[index]; return this.chart.notes[index]?.direction; }
  private beatToMs(beat: number) { return beat * 60000 / this.chart.bpm; }
}
