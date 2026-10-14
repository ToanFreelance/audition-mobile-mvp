import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { PerformanceDiagnostics, performanceDiagnosticsEnabled, summarizeFrameIntervals } from "../components/diagnostics/performance-diagnostics";
import type { WebGLRenderer } from "three";

function environment() {
  const names = ["document", "window", "navigator", "PerformanceObserver", "setInterval", "clearInterval"];
  const original = new Map(names.map(name => [name, Object.getOwnPropertyDescriptor(globalThis, name)]));
  let callbacks: Record<string, () => void> = {};
  let timers = 0;
  let observers = 0;
  const document = { visibilityState: "visible", addEventListener: (name: string, fn: () => void) => { callbacks[name] = fn; }, removeEventListener: (name: string) => { delete callbacks[name]; } };
  class Observer {
    static supportedEntryTypes = ["longtask"];
    observe() { observers++; }
    disconnect() { observers--; }
  }
  const replacements = { document, window: { innerWidth: 390, innerHeight: 844, devicePixelRatio: 2 }, navigator: { userAgent: "QA browser" }, PerformanceObserver: Observer, setInterval: () => { timers++; return 1; }, clearInterval: () => { timers--; } };
  for (const [name, value] of Object.entries(replacements)) Object.defineProperty(globalThis, name, { configurable: true, writable: true, value });
  return {
    document, visibility: () => callbacks.visibilitychange?.(), counts: () => ({ timers, observers, listeners: Object.keys(callbacks).length }),
    restore() { for (const name of names) { const descriptor = original.get(name); if (descriptor) Object.defineProperty(globalThis, name, descriptor); else Reflect.deleteProperty(globalThis, name); } },
  };
}

function renderer() {
  let queries = 0;
  const gl = {
    RENDERER: 1, VENDOR: 2, VERSION: 3,
    getExtension() { queries++; return { UNMASKED_RENDERER_WEBGL: 4, UNMASKED_VENDOR_WEBGL: 5 }; },
    getParameter(value: number) { queries++; return `metadata-${value}`; },
    getContextAttributes() { queries++; return { powerPreference: "default" }; },
  };
  const value = {
    domElement: { clientWidth: 390, clientHeight: 844, width: 487, height: 1055 },
    getContext: () => gl, getPixelRatio: () => 1.25,
    info: { render: { calls: 76, triangles: 117454 }, memory: { geometries: 112, textures: 6 }, programs: [1, 2] },
  } as unknown as WebGLRenderer;
  return { value, queries: () => queries };
}

test("diagnostics requires exact explicit perf=1", () => {
  for (const query of ["", "?perf=0", "?perf=true", "?performance=1"]) expect(performanceDiagnosticsEnabled(query)).toBe(false);
  expect(performanceDiagnosticsEnabled("?room=x&perf=1")).toBe(true);
});

test("frame quantiles, cadence and strict thresholds are measured", () => {
  const result = summarizeFrameIntervals([10, 20, 30, 40, 60, NaN, -1]);
  expect(result).toMatchObject({ intervals: 5, averageMs: 32, p50Ms: 30, p95Ms: 56, p99Ms: 59.2, above16_7: 4, above33_3: 2, above50: 1 });
  expect(result.fps).toBe(31.25);
  expect(summarizeFrameIntervals([]).fps).toBeNull();
});

test("metadata is cached once; frame/aggregate/export never polls WebGL", () => {
  const env = environment(); const monitor = new PerformanceDiagnostics(); const r = renderer();
  try {
    monitor.bindRenderer(r.value); const initial = r.queries();
    for (let i = 0; i < 30; i++) { monitor.frame(i * 20, 2); monitor.flush(); monitor.summary(); }
    expect(r.queries()).toBe(initial); expect(initial).toBe(7);
    expect(monitor.summary().samples.at(-1)?.canvas).toMatchObject({ cssWidth: 390, drawingBufferWidth: 487, requestedPixelRatio: 1.25 });
    expect(monitor.summary().samples.at(-1)?.webgl).toMatchObject({ calls: 76, triangles: 117454 });
    expect(monitor.summary().lifecycle.rendererCreations).toBe(1);
  } finally { monitor.dispose(); env.restore(); }
});

test("read-only samples do not recreate renderer or actor", () => {
  const env = environment(); const monitor = new PerformanceDiagnostics(); const r = renderer();
  try {
    monitor.bindRenderer(r.value); monitor.actorCreated();
    for (let i = 0; i < 10; i++) { monitor.frame(i * 16, 1); monitor.hudCommitted(); monitor.flush(); }
    expect(monitor.summary().lifecycle).toEqual({ rendererCreations: 1, rendererDisposals: 0, actorCreations: 1, actorDisposals: 0 });
    monitor.unbindRenderer(r.value); monitor.actorDisposed(); monitor.flush();
    expect(monitor.summary().samples.at(-1)?.webgl).toBeNull();
    expect(monitor.summary().lifecycle.actorDisposals).toBe(1);
  } finally { monitor.dispose(); env.restore(); }
});

test("native running-but-flat clock remains flat; no wall-clock fallback", () => {
  const env = environment(); const monitor = new PerformanceDiagnostics();
  const context = { currentTime: 5, state: "running" } as AudioContext;
  let songTimeMs = 1000;
  try {
    monitor.setAudioReader(() => ({ context, songTimeMs, playing: true, audioEnded: false }));
    monitor.flush(); monitor.frame(10, 1); monitor.frame(100, 1); monitor.flush();
    expect(monitor.summary().samples.at(-1)?.audio).toMatchObject({ state: "running", contextProgressSec: 0, songProgressMs: 0, contextId: 1 });
    Object.assign(context, { currentTime: 5.5 }); songTimeMs = 1500; monitor.flush();
    expect(monitor.summary().samples.at(-1)?.audio).toMatchObject({ contextProgressSec: 0.5, songProgressMs: 500, contextId: 1 });
  } finally { monitor.dispose(); env.restore(); }
});

test("authoritative judgement sample is preserved independently of event estimates", () => {
  const env = environment(); const monitor = new PerformanceDiagnostics();
  try {
    monitor.beginInput(performance.now() - 5, "keyboard", 1000, 1010);
    monitor.recordJudgement({ judgement: "perfect", atSongTimeMs: 1007, targetSpaceMs: 1010, absoluteTurn: 3 } as any);
    monitor.endInput("perfect");
    expect(monitor.summary().inputs[0]).toMatchObject({ judgement: "perfect", judgementSongTimeMs: 1007, deltaMs: -3, handleSpaceResult: "perfect" });
    expect(Number(monitor.summary().inputs[0].dispatchDelayEstimateMs)).toBeGreaterThanOrEqual(5);
    monitor.beginInput(Date.now(), "pointer", 1200, 1210); monitor.endInput(null);
    expect(monitor.summary().inputs[1].dispatchDelayEstimateMs).toBeNull();
    expect(monitor.summary().inputs[1].judgementSongTimeMs).toBeNull();
    monitor.beginInput(undefined, "keyboard", 2000, 2010);
    monitor.recordJudgement({ judgement: "miss", atSongTimeMs: 2007, targetSpaceMs: 2010, absoluteTurn: 4 } as any);
    monitor.endInput(null);
    expect(monitor.summary().inputs[2]).toMatchObject({ judgement: null, judgementSongTimeMs: null, handleSpaceResult: null, judgementObservedDuringAdvance: { judgement: "miss" } });
  } finally { monitor.dispose(); env.restore(); }
});

test("history and event storage is bounded with explicit overflow", () => {
  const env = environment(); const monitor = new PerformanceDiagnostics();
  try {
    for (let i = 0; i < 5000; i++) monitor.frame(i * 10, 1);
    for (let i = 0; i < 250; i++) { monitor.beginInput(undefined, "pointer", i, i); monitor.endInput(null); monitor.flush(); }
    const summary = monitor.summary();
    expect(summary.inputs).toHaveLength(200); expect(summary.samples).toHaveLength(120);
    expect(summary.limits.droppedIntervals).toBe(903);
    expect(JSON.stringify(summary)).not.toMatch(/participantId|roomId|publishableKey/);
  } finally { monitor.dispose(); env.restore(); }
});

test("visibility transitions exclude background gaps from frame statistics", () => {
  const env = environment(); const monitor = new PerformanceDiagnostics();
  try {
    monitor.start(); monitor.frame(10, 1); monitor.frame(30, 1);
    env.document.visibilityState = "hidden"; env.visibility();
    env.document.visibilityState = "visible"; env.visibility();
    monitor.frame(10000, 1); monitor.frame(10020, 1); monitor.flush();
    expect(monitor.summary().samples.at(-1)?.frames).toMatchObject({ intervals: 2, averageMs: 20 });
  } finally { monitor.dispose(); env.restore(); }
});

test("idempotent start and teardown release timer, observer and listener", () => {
  const env = environment(); const monitor = new PerformanceDiagnostics();
  try {
    monitor.start(); monitor.start(); expect(env.counts()).toEqual({ timers: 1, observers: 1, listeners: 1 });
    monitor.dispose(); expect(env.counts()).toEqual({ timers: 0, observers: 0, listeners: 0 });
    monitor.dispose(); expect(env.counts().timers).toBe(0);
  } finally { env.restore(); }
});

test("real multiplayer wiring preserves disabled callback and stage effect identity", () => {
  const panel = readFileSync("components/multiplayer/WaitingRoomPanel.tsx", "utf8");
  const live = readFileSync("components/multiplayer/LiveMultiplayerGameplay.tsx", "utf8");
  const stage = readFileSync("components/Stage3D.tsx", "utf8");
  expect(panel).toContain('if (!performanceDiagnosticsEnabled(window.location.search)) return;');
  expect(panel).toContain(': setGameplayPresentationJudgement');
  expect(panel).toContain('performanceDiagnostics={performanceDiagnostics}');
  expect(live).toContain('performanceDiagnostics={props.performanceDiagnostics}');
  expect(stage).toContain('[stageEntry, neonPresentation, hideCharacter, visualCompareMode, fixedPresentationTimeSeconds, characterAssetId]');
  expect(live).toContain('props.runtime.markAudioEnded()');
  expect(live).toContain('props.transport.getCurrentTimeMs()');
});
