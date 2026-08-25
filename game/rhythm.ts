import type { Chart, GameStats, Judgement, Note } from "./types";

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

  private cursor = 0;
  private judged = new Set<number>();

  constructor(chart: Chart) {
    this.chart = chart;
  }

  get nextNote(): Note | undefined {
    while (this.cursor < this.chart.notes.length && this.judged.has(this.chart.notes[this.cursor].id)) {
      this.cursor++;
    }
    return this.chart.notes[this.cursor];
  }

  get allNotes() {
    return this.chart.notes;
  }

  isJudged(noteId: number) {
    return this.judged.has(noteId);
  }

  get completed() {
    return this.stats.miss + this.stats.perfect + this.stats.great + this.stats.cool + this.stats.bad >= this.chart.notes.length;
  }

  getProgress(currentBeat: number) {
    if (this.chart.notes.length === 0) return 1;
    const lastBeat = this.chart.notes[this.chart.notes.length - 1].beat;
    return Math.min(1, Math.max(0, currentBeat / (lastBeat + 2)));
  }

  judge(direction: Note["direction"], currentBeat: number): Judgement | null {
    const note = this.findCandidate(direction, currentBeat);
    if (!note) return null;

    const noteMs = this.beatToMs(note.beat);
    const currentMs = this.beatToMs(currentBeat);
    const delta = Math.abs(currentMs - noteMs);
    const judgement = this.classify(delta);

    if (judgement === "miss") return null;
    this.apply(note, judgement);
    return judgement;
  }

  update(currentBeat: number) {
    while (this.cursor < this.chart.notes.length) {
      const note = this.chart.notes[this.cursor];
      if (this.judged.has(note.id)) {
        this.cursor++;
        continue;
      }

      const delta = this.beatToMs(currentBeat) - this.beatToMs(note.beat);
      if (delta > WINDOWS_MS.bad) {
        this.apply(note, "miss");
        continue;
      }
      break;
    }
  }

  private findCandidate(direction: Note["direction"], currentBeat: number): Note | undefined {
    const currentMs = this.beatToMs(currentBeat);
    const searchFrom = Math.max(0, this.cursor - 1);
    let best: Note | undefined;
    let bestDelta = Infinity;

    for (let i = searchFrom; i < Math.min(this.chart.notes.length, this.cursor + 12); i++) {
      const note = this.chart.notes[i];
      if (this.judged.has(note.id) || note.direction !== direction) continue;
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

  private apply(note: Note, judgement: Judgement) {
    if (this.judged.has(note.id)) return;
    this.judged.add(note.id);
    this.stats[judgement]++;

    if (judgement === "miss") {
      this.stats.combo = 0;
      return;
    }

    this.stats.combo++;
    this.stats.maxCombo = Math.max(this.stats.maxCombo, this.stats.combo);
    const comboMultiplier = 1 + Math.min(2, Math.floor(this.stats.combo / 10) * 0.1);
    this.stats.score += Math.round(SCORE[judgement] * comboMultiplier);
  }

  private beatToMs(beat: number) {
    return beat * 60000 / this.chart.bpm;
  }
}
