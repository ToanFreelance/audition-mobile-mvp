import { getGaugeTiming } from './gauge-timing';
import { RhythmEngine, PERFECT_CENTER, SCORE_ZONE_END, SCORE_ZONE_START } from './rhythm';
import { createArrowCommand, DEFAULT_SOLO_SETTINGS, lastPlayableTurn, minimumRemainingTurns, missPenaltyTurns, planAfterFinish, seededRandom, soloCycle, successHiddenTurns, targetSpaceMs, turnDurationMs, zoneEntryMs, zoneExitMs, type SoloAppearance } from './solo-easy';
import type { ArrowToken, Chart, Direction, GameStats, Judgement, SoloTurn } from './types';

export { PERFECT_CENTER, SCORE_ZONE_END, SCORE_ZONE_START } from './rhythm';
export type RhythmPhase = 'idle' | 'intro' | 'countdown' | 'playing-command' | 'awaiting-space' | 'command-hidden' | 'miss-penalty' | 'finish' | 'post-finish-rest' | 'ending' | 'song-finished';
export type RhythmRuntimeCallbacks = {
  onStats?: (stats: GameStats) => void;
  onJudgement?: (judgement: Judgement, perfectStreak: number) => void;
  onArrowCommand?: (arrowCommand: ArrowToken[], filled: number) => void;
  onFinished?: (stats: GameStats) => void;
  onLevel?: (level: number) => void;
  onPhase?: (phase: RhythmPhase) => void;
  onCountdown?: (value: number | null) => void;
  onPulse?: () => void;
};

/** Rhythm transitions only consume the authoritative absolute WebAudio song time.
 * advance() is public so deterministic QA can supply that clock without RAF. */
export class RhythmRuntime {
  private engine = new RhythmEngine();
  private timeSource: (() => number) | null = null;
  private raf = 0;
  private started = false;
  private ended = false;
  private phase: RhythmPhase = 'idle';
  private appearances: SoloAppearance[] = [];
  private appearanceIndex = 0;
  private turn!: SoloTurn;
  private visible = false;
  private commandIndex = 0;
  private awaitingSpace = false;
  private revealAtMs = 0;
  private hiddenFromTurn = -1;
  private penaltyCount = 0;
  private countdown: number | null = null;
  private random: () => number = Math.random;
  private levelTurnsConsumed = 0;
  private songDurationMs: number;
  private streak = 0;
  private cycle = 1;
  private final = false;
  private lastJudgement: Judgement | null = null;
  private judgementAtMs = -Infinity;

  constructor(private readonly chart: Chart, private readonly callbacks: RhythmRuntimeCallbacks = {}, private readonly options: { seed?: number } = {}) {
    this.songDurationMs = chart.durationMs ?? Infinity;
  }
  setTimeSource(source: (() => number) | null) { this.timeSource = source; }
  setSongDuration(ms: number) { if (Number.isFinite(ms) && ms > 0) this.songDurationMs = ms; }
  get songTimeMs() { return Math.max(0, this.timeSource?.() ?? 0); }
  private get settings() { return this.chart.soloSettings ?? DEFAULT_SOLO_SETTINGS; }
  private get firstPerfectMs() { return this.chart.firstPerfectMs!; }
  private get lastTurn() { return lastPlayableTurn(Math.min(this.chart.durationMs ?? this.songDurationMs, this.songDurationMs), this.firstPerfectMs, this.chart.bpm, this.settings.endingReserveTurns); }
  private target(index: number) { return targetSpaceMs(this.firstPerfectMs, this.chart.bpm, index); }
  private exit(index: number) { return zoneExitMs(this.target(index), this.chart.bpm); }

  start(animate = true) {
    if (!this.timeSource) throw new Error('Solo Easy requires a WebAudio song-time source.');
    if (!(this.chart.bpm > 0) || !(this.firstPerfectMs > 0) || !Number.isFinite(this.songDurationMs)) throw new Error('Solo Easy requires saved exact timing and duration.');
    this.stop();
    this.engine = new RhythmEngine();
    this.random = this.options.seed === undefined ? Math.random : seededRandom(this.options.seed);
    this.appearances = soloCycle(1, this.settings);
    this.appearanceIndex = 0;
    this.started = true; this.ended = false; this.streak = 0; this.cycle = 1; this.final = false;
    this.penaltyCount = 0; this.countdown = null; this.lastJudgement = null; this.judgementAtMs = -Infinity;
    this.levelTurnsConsumed = 0;
    this.setTurn(0, Math.max(0, this.firstPerfectMs - turnDurationMs(this.chart.bpm)));
    this.setPhase('intro');
    this.callbacks.onStats?.(this.stats);
    this.callbacks.onCountdown?.(null);
    this.advance();
    if (animate && typeof requestAnimationFrame !== 'undefined') this.raf = requestAnimationFrame(this.loop);
  }
  stop() {
    if (this.raf && typeof cancelAnimationFrame !== 'undefined') cancelAnimationFrame(this.raf);
    this.raf = 0; this.started = false; this.visible = false;
    this.setPhase('idle'); this.emitCommand();
  }
  destroy() { this.stop(); }
  private loop = () => {
    this.advance();
    if (this.started && !this.ended) this.raf = requestAnimationFrame(this.loop);
  };
  get isStarted() { return this.started; }
  get isFinished() { return this.ended; }
  get stats() { return { ...this.engine.stats }; }
  get currentLevel() { return this.turn?.level ?? 1; }
  get currentTurn() { return this.turn; }
  get currentPhase() { return this.phase; }
  get arrowCommand() { return this.visible ? this.turn.arrowCommand : []; }
  get completedCommands() { return this.commandIndex; }
  get awaitingTiming() { return this.awaitingSpace; }
  get perfectStreak() { return this.streak; }
  get finalFinish() { return this.final; }
  get gaugeTiming() { return getGaugeTiming({ bpm: this.chart.bpm, spaceStartMs: this.firstPerfectMs, perfectCenterPercent: PERFECT_CENTER }, this.songTimeMs); }
  get gaugePercent() { return this.gaugeTiming.sliderPercent; }
  get timingDeltaMs() { return this.turn ? this.songTimeMs - this.turn.targetSpaceMs : 0; }
  get penaltyTurnsRemaining() {
    if (!this.penaltyCount) return 0;
    let passed = 0;
    for (let i = 1; i <= this.penaltyCount; i++) if (this.songTimeMs > this.exit(this.hiddenFromTurn + i)) passed++;
    return this.penaltyCount - passed;
  }
  get debug() {
    return { songTimeMs: this.songTimeMs, durationMs: this.songDurationMs, lastTurn: this.lastTurn, earliestFinishTurn: this.turn ? this.turn.absoluteTurn + minimumRemainingTurns(this.appearances, this.appearanceIndex) : null, finishPlan: this.turn ? planAfterFinish(this.turn.absoluteTurn + minimumRemainingTurns(this.appearances, this.appearanceIndex), this.lastTurn, this.settings) : null, globalAbsoluteTurnIndex: Math.floor((this.songTimeMs - this.firstPerfectMs) / turnDurationMs(this.chart.bpm)), BPM_exact: this.chart.bpm, spaceStartMs: this.firstPerfectMs,
      absoluteTurnIndex: Math.floor((this.songTimeMs - this.firstPerfectMs) / turnDurationMs(this.chart.bpm)),
      playableAbsoluteTurn: this.turn?.absoluteTurn, level: this.currentLevel, sequenceIndex: this.turn?.sequenceIndex,
      targetSpaceMs: this.turn?.targetSpaceMs, deltaToTargetMs: this.timingDeltaMs, gaugePercent: this.gaugePercent,
      runtimeState: this.phase, commandVisible: this.visible, commandIndex: this.commandIndex,
      commandCompleted: this.awaitingSpace, awaitingSpace: this.awaitingSpace, penaltyTurnsRemaining: this.penaltyTurnsRemaining,
      perfectStreak: this.streak, finishCycle: this.cycle, finalFinish: this.final, gameEnded: this.ended,
      isFinish: this.turn?.isFinish, revealAtMs: this.revealAtMs, lastJudgement: this.lastJudgement, judgementAtMs: this.judgementAtMs };
  }

  advance() {
    if (!this.started || this.ended) return;
    const now = this.songTimeMs;
    const until = Math.min(now, this.songDurationMs);
    // Catch up deterministically after dropped frames. Penalty/rest turns never
    // create chart objects and cannot recursively produce a Miss.
    for (let guard = 0; guard < 10000 && this.phase !== 'ending'; guard++) {
      if (!this.visible && until > this.revealAtMs) {
        this.visible = true; this.penaltyCount = 0;
        this.setPhase(this.turn.isFinish ? 'finish' : 'playing-command'); this.emitCommand();
      }
      const countdownStart = this.firstPerfectMs - 3 * 60000 / this.chart.bpm;
      if (until >= countdownStart && until < this.firstPerfectMs && this.turn.absoluteTurn === 0 && this.visible) {
        const count = Math.ceil((this.firstPerfectMs - until) / (60000 / this.chart.bpm));
        this.setCountdown(count); this.setPhase('countdown');
      } else if (this.countdown !== null) {
        this.setCountdown(null);
        if (this.visible) this.setPhase(this.awaitingSpace ? 'awaiting-space' : this.turn.isFinish ? 'finish' : 'playing-command');
      }
      const expired = zoneExitMs(this.turn.targetSpaceMs, this.chart.bpm);
      if (this.visible && until > expired) { this.resolve('miss', expired); continue; }
      break;
    }
    if (now >= this.songDurationMs) this.endSong();
  }
  handleDirection(direction: Direction) {
    this.advance();
    if (!this.started || this.ended || !this.visible || this.awaitingSpace || this.phase === 'ending') return false;
    const token = this.turn.arrowCommand[this.commandIndex];
    if (!token) return false;
    if (token.requiredDirection !== direction) { this.commandIndex = 0; this.emitCommand(); return false; }
    this.commandIndex++;
    this.awaitingSpace = this.commandIndex === this.turn.arrowCommand.length;
    if (this.awaitingSpace) this.setPhase('awaiting-space');
    this.callbacks.onPulse?.(); this.emitCommand(); return true;
  }
  handleSpace(): Judgement | null {
    this.advance();
    if (!this.started || this.ended || !this.visible || this.phase === 'ending') return null;
    // Incomplete commands never score. The authored opportunity still expires.
    if (!this.awaitingSpace) return null;
    const now = this.songTimeMs;
    // Judge against this playable target, not a previous scoring-zone pass.
    if (now < zoneEntryMs(this.turn.targetSpaceMs, this.chart.bpm) || now > zoneExitMs(this.turn.targetSpaceMs, this.chart.bpm)) {
      this.resolve('miss', now); return 'miss';
    }
    const judgement = this.engine.judgeMove(this.turn.absoluteTurn, this.gaugePercent);
    if (judgement) this.resolve(judgement, now);
    return judgement;
  }
  private resolve(judgement: Judgement, atMs: number) {
    if (judgement === 'miss' && !this.engine.missMove(this.turn.absoluteTurn)) return;
    this.streak = judgement === 'perfect' ? this.streak + 1 : 0;
    this.lastJudgement = judgement; this.judgementAtMs = atMs;
    this.callbacks.onStats?.(this.stats); this.callbacks.onJudgement?.(judgement, this.streak);
    this.setCountdown(null);
    const previous = this.turn;
    this.visible = false; this.commandIndex = 0; this.awaitingSpace = false;
    const requestedHidden = judgement === 'miss' ? missPenaltyTurns(previous.level) : successHiddenTurns(previous.level);
    const budget = this.settings.sequenceCounts[previous.level - 1] ?? 1;
    const remainingAfterTurn = Math.max(0, budget - this.levelTurnsConsumed - 1);
    // Level 9's final global turn is reserved for Finish. Suppression can
    // never consume or hide that designated turn.
    const reserveFinishTurn = previous.level === 9 && !previous.isFinish ? 1 : 0;
    const hidden = Math.min(requestedHidden, Math.max(0, remainingAfterTurn - reserveFinishTurn));
    this.levelTurnsConsumed += 1 + hidden;
    this.hiddenFromTurn = previous.absoluteTurn;
    this.penaltyCount = judgement === 'miss' ? hidden : 0;
    let nextAbsolute = previous.absoluteTurn + hidden + 1;
    let reveal = hidden ? this.exit(previous.absoluteTurn + hidden) : atMs;
    let hiddenPhase: RhythmPhase = judgement === 'miss' ? 'miss-penalty' : 'command-hidden';

    if (previous.isFinish) {
      const plan = planAfterFinish(previous.absoluteTurn, this.lastTurn, this.settings, judgement === 'miss');
      if (this.final || plan.finalFinish) { this.beginEnding(); return; }
      this.cycle++; this.appearances = soloCycle(6, this.settings); this.appearanceIndex = 0;
      this.levelTurnsConsumed = 0;
      nextAbsolute = plan.nextAbsoluteTurn;
      reveal = this.exit(nextAbsolute - 1);
      hiddenPhase = judgement === 'miss' ? 'miss-penalty' : 'post-finish-rest';
    } else {
      this.appearanceIndex++;
      if (this.levelTurnsConsumed >= budget) {
        this.levelTurnsConsumed = 0;
        while (this.appearances[this.appearanceIndex]?.level === previous.level) this.appearanceIndex++;
      } else if (previous.level === 9 && this.levelTurnsConsumed === budget - 1) {
        // Keep the final turn of Level 9 reserved for its designated Finish,
        // even when an earlier command consumed hidden/penalty turns.
        while (this.appearances[this.appearanceIndex]?.level === 9 && !this.appearances[this.appearanceIndex]?.isFinish) this.appearanceIndex++;
      }
    }
    const next = this.appearances[this.appearanceIndex];
    if (next?.isFinish) {
      const plan = planAfterFinish(nextAbsolute, this.lastTurn, this.settings);
      this.final = plan.finalFinish;
      if (this.final) nextAbsolute = Math.max(nextAbsolute, this.lastTurn);
      if (nextAbsolute > previous.absoluteTurn + hidden + 1) reveal = this.exit(nextAbsolute - 1);
    }
    if (zoneExitMs(this.target(nextAbsolute), this.chart.bpm) >= Math.min(this.songDurationMs, this.chart.durationMs ?? Infinity)) {
      this.beginEnding(); return;
    }
    this.setTurn(nextAbsolute, reveal);
    if (hidden === 0 && reveal <= atMs) { this.visible = true; this.setPhase('playing-command'); }
    else this.setPhase(hiddenPhase);
    this.emitCommand();
  }
  private setTurn(absoluteTurn: number, revealAtMs: number) {
    const appearance = this.appearances[this.appearanceIndex];
    this.turn = { ...appearance, absoluteTurn, targetSpaceMs: this.target(absoluteTurn),
      arrowCommand: createArrowCommand(appearance.level, appearance.isFinish, this.random, this.settings.commandLengths) };
    this.commandIndex = 0; this.awaitingSpace = false; this.visible = false; this.revealAtMs = revealAtMs;
    this.callbacks.onLevel?.(appearance.level); this.emitCommand();
  }
  private beginEnding() {
    this.final = true; this.visible = false; this.awaitingSpace = false; this.penaltyCount = 0;
    this.setPhase('ending'); this.emitCommand();
  }
  endSong() {
    if (this.ended || !this.started) return;
    this.ended = true; this.started = false; this.visible = false; this.awaitingSpace = false;
    this.setCountdown(null); this.setPhase('song-finished'); this.emitCommand(); this.callbacks.onFinished?.(this.stats);
  }
  private setCountdown(value: number | null) { if (value !== this.countdown) { this.countdown = value; this.callbacks.onCountdown?.(value); } }
  private setPhase(phase: RhythmPhase) { if (this.phase !== phase) { this.phase = phase; this.callbacks.onPhase?.(phase); } }
  private emitCommand() { this.callbacks.onArrowCommand?.(this.arrowCommand, this.commandIndex); }
}
