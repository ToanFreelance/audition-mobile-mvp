type AudioSessionLike = { type: string };

type RunState = {
  startContextTime: number;
  offsetSeconds: number;
};

function getAudioSession(): AudioSessionLike | null {
  if (typeof navigator === "undefined") return null;
  return (navigator as Navigator & { audioSession?: AudioSessionLike }).audioSession ?? null;
}

function getOutputContextTime(context: AudioContext): number {
  const stamped = context as AudioContext & {
    getOutputTimestamp?: () => { contextTime?: number };
  };
  const value = stamped.getOutputTimestamp?.()?.contextTime;
  return typeof value === "number" && Number.isFinite(value) ? value : context.currentTime;
}

export class WebAudioTransport {
  private context: AudioContext | null = null;
  private buffer: AudioBuffer | null = null;
  private source: AudioBufferSourceNode | null = null;
  private run: RunState | null = null;
  private offsetSeconds = 0;
  private preparing: Promise<void> | null = null;
  private destroyed = false;

  constructor(private url: string) {}

  get durationMs() {
    return (this.buffer?.duration ?? 0) * 1000;
  }

  get ready() {
    return Boolean(this.buffer);
  }

  get playing() {
    return Boolean(this.source && this.run);
  }

  private ensureContext() {
    if (this.context && this.context.state !== "closed") return this.context;
    const Ctor = window.AudioContext ?? (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) throw new Error("Web Audio API is unavailable.");
    this.context = new Ctor();
    return this.context;
  }

  async prepare() {
    if (this.buffer) return;
    if (this.preparing) return this.preparing;
    this.preparing = (async () => {
      const context = this.ensureContext();
      const response = await fetch(this.url, { cache: "no-store" });
      if (!response.ok) throw new Error(`Audio HTTP ${response.status}`);
      const bytes = await response.arrayBuffer();
      const decoded = await context.decodeAudioData(bytes.slice(0));
      if (this.destroyed) return;
      this.buffer = decoded;
      this.offsetSeconds = Math.min(this.offsetSeconds, decoded.duration);
    })().finally(() => {
      this.preparing = null;
    });
    return this.preparing;
  }

  private stopSource() {
    const source = this.source;
    this.source = null;
    this.run = null;
    if (!source) return;
    source.onended = null;
    try { source.stop(); } catch {}
    try { source.disconnect(); } catch {}
  }

  getCurrentTimeMs() {
    const context = this.context;
    const run = this.run;
    if (!context || !run) return this.offsetSeconds * 1000;
    const outputContextTime = getOutputContextTime(context);
    const seconds = run.offsetSeconds + Math.max(0, outputContextTime - run.startContextTime);
    const duration = this.buffer?.duration ?? Number.POSITIVE_INFINITY;
    return Math.min(seconds, duration) * 1000;
  }

  async play() {
    await this.prepare();
    const context = this.ensureContext();
    const buffer = this.buffer;
    if (!buffer) throw new Error("Decoded AudioBuffer is unavailable.");

    const session = getAudioSession();
    if (session) {
      try { session.type = "playback"; } catch {}
    }
    if (context.state !== "running") await context.resume();

    this.stopSource();
    const offset = Math.min(Math.max(0, this.offsetSeconds), Math.max(0, buffer.duration - 0.001));
    const source = context.createBufferSource();
    source.buffer = buffer;
    source.connect(context.destination);
    const when = context.currentTime + 0.06;
    this.run = { startContextTime: when, offsetSeconds: offset };
    this.source = source;
    source.onended = () => {
      if (this.source !== source) return;
      this.offsetSeconds = buffer.duration;
      this.source = null;
      this.run = null;
    };
    source.start(when, offset);
  }

  pause() {
    if (this.playing) this.offsetSeconds = this.getCurrentTimeMs() / 1000;
    this.stopSource();
  }

  seek(ms: number) {
    const durationMs = this.durationMs;
    const nextMs = Math.max(0, durationMs > 0 ? Math.min(durationMs, ms) : ms);
    const wasPlaying = this.playing;
    this.pause();
    this.offsetSeconds = nextMs / 1000;
    if (wasPlaying) void this.play();
  }

  reset() {
    this.stopSource();
    this.offsetSeconds = 0;
  }

  async destroy() {
    this.destroyed = true;
    this.stopSource();
    this.buffer = null;
    const context = this.context;
    this.context = null;
    if (context && context.state !== "closed") {
      try { await context.close(); } catch {}
    }
  }
}
