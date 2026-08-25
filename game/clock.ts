export class BeatClock {
  private startPerf = 0;
  private paused = false;
  private pausePerf = 0;
  private elapsedBeforePause = 0;

  constructor(private readonly bpm: number, private readonly offsetMs = 0) {}

  start() {
    this.startPerf = performance.now();
    this.paused = false;
    this.pausePerf = 0;
    this.elapsedBeforePause = 0;
  }

  get elapsedMs() {
    if (!this.startPerf) return 0;
    if (this.paused) return this.elapsedBeforePause;
    return performance.now() - this.startPerf;
  }

  get currentBeat() {
    const adjustedMs = this.elapsedMs + this.offsetMs;
    return Math.max(0, adjustedMs / (60000 / this.bpm));
  }

  get running() { return !!this.startPerf && !this.paused; }
  get ended() { return false; }
}
