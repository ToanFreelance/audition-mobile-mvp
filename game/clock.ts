export type ClockTimeSource = () => number;

export class BeatClock {
  private startPerf = 0;
  private paused = false;
  private elapsedBeforePause = 0;
  private timeSource: ClockTimeSource | null = null;
  private sourceStartMs = 0;

  constructor(private readonly bpm: number, private readonly offsetMs = 0) {}

  setTimeSource(source: ClockTimeSource | null) { this.timeSource = source; }

  private get activeTimeSource(): ClockTimeSource | null {
    if (this.timeSource) return this.timeSource;
    if (typeof document === "undefined") return null;
    const audio = document.querySelector<HTMLAudioElement>("audio[data-rhythm-clock]");
    return audio ? () => audio.currentTime * 1000 : null;
  }

  start() {
    this.startPerf = performance.now();
    this.paused = false;
    this.elapsedBeforePause = 0;
    this.sourceStartMs = this.activeTimeSource?.() ?? 0;
  }

  get elapsedMs() {
    if (!this.startPerf) return 0;
    if (this.paused) return this.elapsedBeforePause;
    const source = this.activeTimeSource;
    if (source) return Math.max(0, source() - this.sourceStartMs);
    return performance.now() - this.startPerf;
  }

  get currentBeat() {
    const adjustedMs = this.elapsedMs + this.offsetMs;
    return Math.max(0, adjustedMs / (60000 / this.bpm));
  }

  get running() { return !!this.startPerf && !this.paused; }
  get ended() { return false; }
}
