import type { Chart, Judgement, Note } from "./types";

export const WINDOWS_MS: Record<Judgement, number> = {
  perfect: 45,
  great: 85,
  cool: 130,
  bad: 185,
  miss: Infinity
};

export const SCORE: Record<Judgement, number> = {
  perfect: 1000,
  great: 700,
  cool: 400,
  bad: 100,
  miss: 0
};

export class RhythmEngine {
  readonly chart: Chart;
  readonly stats: GameStats = {
    score: 0,
    combo: 0,
    maxCombo: 0,
    perfect: 0,
    great: 0,
    cool: 0,
    bad: 0,
    miss: 0
  };

  private readonly judgedMoves = new Set<number>();
  private readonly judgedNotes = new Set<number>();

  constructor(chart: Chart) {
    this.chart = chart;
  }

  get allNotes() {
    return this.chart.notes;
  }

  isJudged(noteId: number) {
    return this.judgedNotes.has(noteId);
  }

  get completed() {
    const totalMoves = Math.ceil(this.chart.notes.length / 8);
    return this.judgedMoves.size >= totalMoves;
  }

  /**
   * Score one Audition-style move. The move is resolved exactly once for its
   * 4-beat target, so repeatedly tapping SPACE cannot score the same move or
   * accidentally score the next arrow in the command sequence.
   */
  judgeMove(moveIndex: number, deltaMs: number): Judgement | null {
    if (this.judgedMoves.has(moveIndex)) return null;

    const judgement = this.classify(Math.abs(deltaMs));
    if (judgement === "miss") return null;

    this.judgedMoves.add(moveIndex);
    this.applyMove(moveIndex, judgement);
    return judgement;
  }

  missMove(moveIndex: number) {
    if (this.judgedMoves.has(moveIndex)) return false;
    this.judgedMoves.add(moveIndex);
    this.applyMove(moveIndex, "miss");
    return true;
  }

  /** Legacy note-level API retained for isolated engine tests. */
  get nextNote(): Note | undefined {
    return this.chart.notes.find((note) => !this.judgedNotes.has(note.id));
  }

  judge(direction: Note["direction"], currentBeat: number): Judgement | null {
    const note = this.findCandidate(direction, currentBeat);
    if (!note) return null;

    const delta = this.beatToMs(currentBeat) - this.beatToMs(note.beat);
    const judgement = this.classify(Math.abs(delta));
    if (judgement === "miss") return null;

    this.judgedNotes.add(note.id);
    this.applyMove(note.id, judgement);
    return judgement;
  }

  /** No automatic note misses in the move-based runtime. */
  update(_currentBeat: number) {
    // Intentionally empty. RhythmRuntime resolves one move every 4 beats.
  }

  getProgress(currentBeat: number) {
    const lastBeat = this.chart.notes[this.chart.notes.length - 1]?.beat ?? 1;
    return Math.min(1, Math.max(0, currentBeat / (lastBeat + 2)));
  }

  private findCandidate(direction: Note["direction"], currentBeat: number): Note | undefined {
    const currentMs = this.beatToMs(currentBeat);
    let best: Note | undefined;
    let bestDelta = Infinity;

    for (const note of this.chart.notes) {
      if (this.judgedNotes.has(note.id) || note.direction !== direction) continue;
      const delta = Math.abs(currentMs - this.beatToMs(note.beat));
      if (delta < bestDelta && delta <= WINDOWS_MS.bad) {
        best = note;
        bestDelta = delta;
      }
    }
    return best;
  }

  private classify(deltaMs: number): Judgement {
    if (deltaMs <= WINDOWS_MS.perfect) return "perfect";
    if (deltaMs <= WINDOWS_MS.great) return "great";
    if (deltaMs <= WINDOWS_MS.cool) return "cool";
    if (deltaMs <= WINDOWS_MS.bad) return "bad";
    return "miss";
  }

  private applyMove(moveId: number, judgement: Judgement) {
    if (judgement === "miss") {
      this.stats.miss++;
      this.stats.combo = 0;
      return;
    }

    this.stats[judgement]++;
    this.stats.combo++;
    this.stats.maxCombo = Math.max(this.stats.maxCombo, this.stats.combo);
    const comboMultiplier = 1 + Math.min(2, Math.floor(this.stats.combo / 10) * 0.1);
    this.stats.score += Math.round(SCORE[judgement] * comboMultiplier);
    void moveId;
  }

  private beatToMs(beat: number) {
    return beat * 60000 / this.chart.bpm;
  }
}

type GameStats = {
  score: number;
  combo: number;
  maxCombo: number;
  perfect: number;
  great: number;
  cool: number;
  bad: number;
  miss: number;
};
