import type { WebGLRenderer } from "three";
import type { MultiplayerGameplayJudgementEvent } from "../../multiplayer/gameplay-runtime";

const HISTORY_LIMIT = 120;
const EVENT_LIMIT = 200;
const FRAME_LIMIT = 4096;

export function performanceDiagnosticsEnabled(search: string) {
  return new URLSearchParams(search).get("perf") === "1";
}

export function summarizeFrameIntervals(intervals: readonly number[]) {
  const sorted = intervals.filter(value => Number.isFinite(value) && value > 0).sort((a, b) => a - b);
  const quantile = (q: number) => {
    if (!sorted.length) return null;
    const index = (sorted.length - 1) * q;
    const low = Math.floor(index);
    return sorted[low] + (sorted[Math.ceil(index)] - sorted[low]) * (index - low);
  };
  const averageMs = sorted.length ? sorted.reduce((sum, value) => sum + value, 0) / sorted.length : null;
  return {
    intervals: sorted.length, averageMs, fps: averageMs === null ? null : 1000 / averageMs,
    p50Ms: quantile(0.5), p95Ms: quantile(0.95), p99Ms: quantile(0.99),
    above16_7: sorted.filter(value => value > 16.7).length,
    above33_3: sorted.filter(value => value > 33.3).length,
    above50: sorted.filter(value => value > 50).length,
  };
}

function boundedPush<T>(values: T[], value: T, limit: number) {
  if (values.length === limit) values.shift();
  values.push(value);
}

export type AudioObservation = {
  context: AudioContext | null;
  songTimeMs: number;
  playing: boolean;
  audioEnded: boolean;
};

/** Opt-in observer. Never owns a clock, renderer, actor, input result or room state. */
export class PerformanceDiagnostics {
  private renderer: WebGLRenderer | null = null;
  private canvas: HTMLCanvasElement | null = null;
  private metadata: Record<string, unknown> | null = null;
  private intervals: number[] = [];
  private lastFrameMs: number | null = null;
  private frameCount = 0;
  private droppedIntervals = 0;
  private submitMs = 0;
  private hudUpdates = 0;
  private timer: ReturnType<typeof setInterval> | null = null;
  private observer: PerformanceObserver | null = null;
  private listeners = new Set<() => void>();
  private audioReader: (() => AudioObservation) | null = null;
  private contextIds = new WeakMap<AudioContext, number>();
  private contextCount = 0;
  private lastAudio: { id: number | null; wallMs: number; currentTime: number | null; songTimeMs: number } | null = null;
  private pendingInput: Record<string, unknown> | null = null;
  private rendererCreations = 0;
  private rendererDisposals = 0;
  private actorCreations = 0;
  private actorDisposals = 0;
  private samples: Record<string, unknown>[] = [];
  private inputs: Record<string, unknown>[] = [];
  private judgements: Record<string, unknown>[] = [];
  private longTasks: Record<string, unknown>[] = [];
  private visibility: { atMs: number; state: string }[] = [];
  private longTaskSupported = false;

  start() {
    if (this.timer !== null) return;
    this.visibilityChanged();
    document.addEventListener("visibilitychange", this.visibilityChanged);
    if (typeof PerformanceObserver !== "undefined" && PerformanceObserver.supportedEntryTypes?.includes("longtask")) {
      this.longTaskSupported = true;
      this.observer = new PerformanceObserver(list => {
        for (const entry of list.getEntries()) boundedPush(this.longTasks, {
          atMs: entry.startTime, durationMs: entry.duration, name: entry.name,
          // Long Tasks API exposes container attribution, not a JavaScript stack.
        }, EVENT_LIMIT);
      });
      try { this.observer.observe({ type: "longtask", buffered: false }); }
      catch { this.observer.disconnect(); this.observer = null; this.longTaskSupported = false; }
    }
    this.timer = setInterval(() => this.flush(), 2000);
  }

  private visibilityChanged = () => {
    this.lastFrameMs = null; // Hidden time must not masquerade as a rendered frame interval.
    boundedPush(this.visibility, { atMs: performance.now(), state: document.visibilityState }, EVENT_LIMIT);
  };

  bindRenderer(renderer: WebGLRenderer) {
    this.renderer = renderer;
    this.canvas = renderer.domElement;
    this.rendererCreations++;
    // Deliberately queried ONCE per actual context, never in frame/aggregation loops.
    try {
      const gl = renderer.getContext();
      const debug = gl.getExtension("WEBGL_debug_renderer_info");
      this.metadata = {
        renderer: gl.getParameter(gl.RENDERER), vendor: gl.getParameter(gl.VENDOR),
        version: gl.getParameter(gl.VERSION), attributes: gl.getContextAttributes(),
        unmaskedRenderer: debug ? gl.getParameter(debug.UNMASKED_RENDERER_WEBGL) : null,
        unmaskedVendor: debug ? gl.getParameter(debug.UNMASKED_VENDOR_WEBGL) : null,
      };
    } catch { this.metadata = { unavailable: true }; }
  }

  unbindRenderer(renderer: WebGLRenderer) {
    if (this.renderer !== renderer) return;
    this.renderer = null;
    this.canvas = null;
    this.lastFrameMs = null;
    this.rendererDisposals++;
  }

  actorCreated() { this.actorCreations++; }
  actorDisposed() { this.actorDisposals++; }

  frame(atMs: number, submissionMs: number) {
    if (this.lastFrameMs !== null) {
      if (this.intervals.length < FRAME_LIMIT) this.intervals.push(atMs - this.lastFrameMs);
      else this.droppedIntervals++;
    }
    this.lastFrameMs = atMs;
    this.frameCount++;
    this.submitMs += submissionMs;
  }

  hudCommitted() { this.hudUpdates++; }
  setAudioReader(reader: (() => AudioObservation) | null) { this.audioReader = reader; this.lastAudio = null; }

  beginInput(eventTimeStamp: number | undefined, kind: "keyboard" | "pointer", songTimeBeforeMs: number, targetSpaceMs: number, enteredAtMs = performance.now()) {
    // Some older engines expose epoch-based Event.timeStamp. Do not silently compare clock domains.
    const comparable = eventTimeStamp !== undefined && Number.isFinite(eventTimeStamp)
      && eventTimeStamp >= 0 && eventTimeStamp <= enteredAtMs;
    this.pendingInput = {
      kind, eventTimeStampMs: eventTimeStamp ?? null, handlerEntryMs: enteredAtMs,
      dispatchDelayEstimateMs: comparable ? enteredAtMs - eventTimeStamp : null,
      songTimeBeforeMs, targetSpaceBeforeMs: targetSpaceMs, targetSpaceMs: null,
      judgement: null, judgementSongTimeMs: null,
    };
  }

  recordJudgement(event: MultiplayerGameplayJudgementEvent) {
    const value = {
      observedAtMs: performance.now(), absoluteTurn: event.absoluteTurn,
      judgement: event.judgement, judgementSongTimeMs: event.atSongTimeMs,
      targetSpaceMs: event.targetSpaceMs, deltaMs: event.atSongTimeMs - event.targetSpaceMs,
    };
    boundedPush(this.judgements, value, EVENT_LIMIT);
    if (this.pendingInput) Object.assign(this.pendingInput, value);
  }

  endInput(result: string | null) {
    if (!this.pendingInput) return;
    this.pendingInput.handlerDurationMs = performance.now() - Number(this.pendingInput.handlerEntryMs);
    this.pendingInput.handleSpaceResult = result;
    if (result === null && this.pendingInput.judgement !== null) {
      // advance() may resolve an expired turn before handleSpace declines this input.
      // Preserve that callback without claiming it is this SPACE's judgement.
      this.pendingInput.judgementObservedDuringAdvance = {
        judgement: this.pendingInput.judgement,
        judgementSongTimeMs: this.pendingInput.judgementSongTimeMs,
        targetSpaceMs: this.pendingInput.targetSpaceMs,
      };
      this.pendingInput.judgement = null;
      this.pendingInput.judgementSongTimeMs = null;
      this.pendingInput.targetSpaceMs = null;
      this.pendingInput.deltaMs = null;
    }
    boundedPush(this.inputs, this.pendingInput, EVENT_LIMIT);
    this.pendingInput = null;
  }

  flush() {
    const now = performance.now();
    const renderer = this.renderer;
    const canvas = this.canvas;
    let audio: Record<string, unknown> | null = null;
    const observation = this.audioReader?.();
    if (observation) {
      const context = observation.context;
      let id: number | null = null;
      if (context) {
        id = this.contextIds.get(context) ?? ++this.contextCount;
        this.contextIds.set(context, id);
      }
      const currentTime = context?.currentTime ?? null;
      const prior = this.lastAudio;
      const same = prior && prior.id === id;
      audio = {
        contextId: id, state: context?.state ?? "unknown", currentTime,
        songTimeMs: observation.songTimeMs, playing: observation.playing, audioEnded: observation.audioEnded,
        elapsedWallMs: same ? now - prior.wallMs : null,
        contextProgressSec: same && currentTime !== null && prior.currentTime !== null ? currentTime - prior.currentTime : null,
        songProgressMs: same ? observation.songTimeMs - prior.songTimeMs : null,
      };
      this.lastAudio = { id, wallMs: now, currentTime, songTimeMs: observation.songTimeMs };
    }
    const frames = summarizeFrameIntervals(this.intervals);
    boundedPush(this.samples, {
      atMs: now, visibility: document.visibilityState, frames,
      submissionAverageMs: this.frameCount ? this.submitMs / this.frameCount : null,
      hudCommitObservations: this.hudUpdates,
      // Standard production React supplies no trustworthy commit-duration profiler data.
      reactCommitDurationMs: null,
      canvas: canvas && renderer ? {
        cssWidth: canvas.clientWidth, cssHeight: canvas.clientHeight,
        drawingBufferWidth: canvas.width, drawingBufferHeight: canvas.height,
        requestedPixelRatio: renderer.getPixelRatio(),
        effectivePixelRatioX: canvas.clientWidth ? canvas.width / canvas.clientWidth : null,
        effectivePixelRatioY: canvas.clientHeight ? canvas.height / canvas.clientHeight : null,
      } : null,
      webgl: renderer ? {
        calls: renderer.info.render.calls, triangles: renderer.info.render.triangles,
        geometries: renderer.info.memory.geometries, textures: renderer.info.memory.textures,
        programs: renderer.info.programs?.length ?? null,
      } : null, audio,
    }, HISTORY_LIMIT);
    this.intervals = [];
    this.frameCount = 0;
    this.submitMs = 0;
    this.hudUpdates = 0;
    for (const listener of this.listeners) listener();
  }

  subscribe(listener: () => void) { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; }

  summary() {
    return {
      schemaVersion: 1, mode: "read-only-opt-in", exportedAt: new Date().toISOString(),
      limits: { sampleIntervalMs: 2000, historySamples: HISTORY_LIMIT, eventsPerType: EVENT_LIMIT, frameIntervalsPerWindow: FRAME_LIMIT, droppedIntervals: this.droppedIntervals },
      browser: { userAgent: navigator.userAgent, viewportWidth: window.innerWidth, viewportHeight: window.innerHeight, devicePixelRatio: window.devicePixelRatio, visibility: document.visibilityState },
      webglMetadata: this.metadata,
      lifecycle: { rendererCreations: this.rendererCreations, rendererDisposals: this.rendererDisposals, actorCreations: this.actorCreations, actorDisposals: this.actorDisposals },
      longTaskSupported: this.longTaskSupported,
      limitations: ["FPS is render-callback cadence, not physical presented frames", "Submission duration is not GPU execution time", "HUD commit observations are passive effects, not a React profile", "No physical input/output-audio latency measurement", "No GPU memory byte estimate or native source interception"],
      samples: this.samples.slice(), inputs: this.inputs.slice(), judgements: this.judgements.slice(),
      longTasks: this.longTasks.slice(), visibilityChanges: this.visibility.slice(),
    };
  }

  dispose() {
    if (this.timer !== null) clearInterval(this.timer);
    this.timer = null;
    this.observer?.disconnect();
    this.observer = null;
    document.removeEventListener("visibilitychange", this.visibilityChanged);
    this.listeners.clear();
    this.audioReader = null;
    this.renderer = null;
    this.canvas = null;
    this.pendingInput = null;
  }
}
