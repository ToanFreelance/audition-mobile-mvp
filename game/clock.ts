export type ClockTimeSource = () => number;

export class BeatClock {
  private startPerf = 0;
  private paused = false;
  private elapsedBeforePause = 0;
  private timeSource: ClockTimeSource | null = null;
  private sourceStartMs = 0;

  constructor(private readonly bpm: number, private readonly offsetMs = 0) {}

  setTimeSource(source: ClockTimeSource | null) { this.timeSource = source; }

  syncToTimeSource() {
    if (!this.startPerf || !this.timeSource) return;
    this.sourceStartMs = this.timeSource() - (performance.now() - this.startPerf);
  }

  start() {
    this.startPerf = performance.now();
    this.paused = false;
    this.elapsedBeforePause = 0;
    this.sourceStartMs = this.timeSource?.() ?? 0;
  }

  get elapsedMs() {
    if (!this.startPerf) return 0;
    if (this.paused) return this.elapsedBeforePause;
    if (this.timeSource) return Math.max(0, this.timeSource() - this.sourceStartMs);
    return performance.now() - this.startPerf;
  }

  get currentBeat() {
    const adjustedMs = this.elapsedMs + this.offsetMs;
    return Math.max(0, adjustedMs / (60000 / this.bpm));
  }

  get running() { return !!this.startPerf && !this.paused; }
  get ended() { return false; }
}
