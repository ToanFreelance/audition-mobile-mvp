"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type MusicConfig = { id: string; title: string; audioUrl: string };
type Mode = "idle" | "native" | "webaudio";
type AudioSessionLike = { type: string };
type WebRun = { startContextTime: number; offset: number };
type OutputStamp = { contextTime: number; performanceTime: number | null };
type Mark = { mode: "native" | "webaudio"; seconds: number };

const fmt = (seconds: number) => {
  if (!Number.isFinite(seconds)) return "—";
  const value = Math.max(0, seconds);
  const minutes = Math.floor(value / 60);
  const rest = value - minutes * 60;
  return `${minutes}:${rest.toFixed(3).padStart(6, "0")}`;
};

const getAudioSession = (): AudioSessionLike | null => {
  if (typeof navigator === "undefined") return null;
  return (navigator as Navigator & { audioSession?: AudioSessionLike }).audioSession ?? null;
};

const median = (values: number[]) => {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};

export default function AudioTimingLabPage() {
  const nativeRef = useRef<HTMLAudioElement | null>(null);
  const contextRef = useRef<AudioContext | null>(null);
  const bufferRef = useRef<AudioBuffer | null>(null);
  const sourceRef = useRef<AudioBufferSourceNode | null>(null);
  const rafRef = useRef<number | null>(null);
  const modeRef = useRef<Mode>("idle");
  const runRef = useRef<WebRun | null>(null);
  const webPausedOffsetRef = useRef(0);

  const [configs, setConfigs] = useState<MusicConfig[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [loading, setLoading] = useState(true);
  const [decoding, setDecoding] = useState(false);
  const [readyToTest, setReadyToTest] = useState(false);
  const [mode, setMode] = useState<Mode>("idle");
  const [nativeTime, setNativeTime] = useState(0);
  const [webTime, setWebTime] = useState(0);
  const [contextTime, setContextTime] = useState(0);
  const [outputContextTime, setOutputContextTime] = useState<number | null>(null);
  const [outputPerformanceTime, setOutputPerformanceTime] = useState<number | null>(null);
  const [scheduledContextTime, setScheduledContextTime] = useState<number | null>(null);
  const [baseLatency, setBaseLatency] = useState<number | null>(null);
  const [outputLatency, setOutputLatency] = useState<number | null>(null);
  const [audioSessionType, setAudioSessionType] = useState("unsupported");
  const [marks, setMarks] = useState<Mark[]>([]);
  const [message, setMessage] = useState("Loading music charts…");

  const selected = useMemo(() => configs.find(item => item.id === selectedId) ?? configs[0], [configs, selectedId]);
  const nativeMedian = useMemo(() => median(marks.filter(mark => mark.mode === "native").map(mark => mark.seconds)), [marks]);
  const webMedian = useMemo(() => median(marks.filter(mark => mark.mode === "webaudio").map(mark => mark.seconds)), [marks]);

  const setCurrentMode = (next: Mode) => {
    modeRef.current = next;
    setMode(next);
  };

  const stopRaf = () => {
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
  };

  const getOutputStamp = (context: AudioContext): OutputStamp => {
    const withTimestamp = context as AudioContext & {
      getOutputTimestamp?: () => { contextTime?: number; performanceTime?: number };
    };
    const stamp = withTimestamp.getOutputTimestamp?.();
    const contextValue = stamp?.contextTime;
    const performanceValue = stamp?.performanceTime;
    return {
      contextTime: typeof contextValue === "number" && Number.isFinite(contextValue) ? contextValue : context.currentTime,
      performanceTime: typeof performanceValue === "number" && Number.isFinite(performanceValue) ? performanceValue : null,
    };
  };

  const readWebSongTime = (context = contextRef.current) => {
    const run = runRef.current;
    if (!context || !run) return webPausedOffsetRef.current;
    const stamp = getOutputStamp(context);
    return run.offset + Math.max(0, stamp.contextTime - run.startContextTime);
  };

  const forcePlaybackAudioSession = () => {
    const session = getAudioSession();
    if (!session) {
      setAudioSessionType("unsupported");
      return false;
    }
    try {
      session.type = "playback";
      setAudioSessionType(session.type || "playback");
      return true;
    } catch (error) {
      setAudioSessionType(`error: ${error instanceof Error ? error.message : "unknown"}`);
      return false;
    }
  };

  const tick = () => {
    const context = contextRef.current;
    const native = nativeRef.current;
    if (native) setNativeTime(native.currentTime);
    if (context) {
      const stamp = getOutputStamp(context);
      setContextTime(context.currentTime);
      setOutputContextTime(stamp.contextTime);
      setOutputPerformanceTime(stamp.performanceTime);
      if (modeRef.current === "webaudio") setWebTime(readWebSongTime(context));
    }
    rafRef.current = requestAnimationFrame(tick);
  };

  useEffect(() => {
    setAudioSessionType(getAudioSession()?.type ?? "unsupported");
    let cancelled = false;
    setLoading(true);
    fetch("/api/music-config", { cache: "no-store" })
      .then(async response => {
        const json = await response.json();
        if (!response.ok) throw new Error(json?.error || `HTTP ${response.status}`);
        const list: MusicConfig[] = Array.isArray(json) ? json : json.configs ?? [];
        if (cancelled) return;
        setConfigs(list);
        const aloha = list.find(item => item.title.toLowerCase().includes("aloha"));
        setSelectedId((aloha ?? list[0])?.id ?? "");
      })
      .catch(error => !cancelled && setMessage(`Load failed: ${error instanceof Error ? error.message : "unknown"}`))
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, []);

  useEffect(() => () => {
    stopRaf();
    try { sourceRef.current?.stop(); } catch {}
    sourceRef.current?.disconnect();
    void contextRef.current?.close();
  }, []);

  useEffect(() => {
    if (!selected?.audioUrl) return;
    let cancelled = false;
    const prepare = async () => {
      try {
        setReadyToTest(false);
        setDecoding(true);
        setMessage("Preparing AudioBuffer before the timing test…");
        try { sourceRef.current?.stop(); } catch {}
        sourceRef.current?.disconnect();
        sourceRef.current = null;
        runRef.current = null;
        webPausedOffsetRef.current = 0;
        setCurrentMode("idle");
        setWebTime(0);
        setNativeTime(0);
        setScheduledContextTime(null);
        setMarks([]);
        bufferRef.current = null;
        if (nativeRef.current) { nativeRef.current.pause(); nativeRef.current.currentTime = 0; }

        let context = contextRef.current;
        if (!context || context.state === "closed") {
          const Ctor = window.AudioContext ?? (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
          if (!Ctor) throw new Error("Web Audio API is unavailable.");
          context = new Ctor();
          contextRef.current = context;
        }

        const response = await fetch(selected.audioUrl, { cache: "no-store" });
        if (!response.ok) throw new Error(`Audio HTTP ${response.status}`);
        const bytes = await response.arrayBuffer();
        const decoded = await context.decodeAudioData(bytes.slice(0));
        if (cancelled) return;
        bufferRef.current = decoded;
        setReadyToTest(true);
        setMessage("READY TO TEST · refresh → wait READY → PLAY WEBAUDIO or PLAY NATIVE → use MARK BEAT.");
      } catch (error) {
        if (!cancelled) setMessage(`Prepare failed: ${error instanceof Error ? error.message : "unknown"}`);
      } finally {
        if (!cancelled) setDecoding(false);
      }
    };
    void prepare();
    return () => { cancelled = true; };
  }, [selected?.audioUrl]);

  const updateLatencyInfo = (context: AudioContext) => {
    setBaseLatency(Number.isFinite(context.baseLatency) ? context.baseLatency : null);
    const measuredOutputLatency = (context as AudioContext & { outputLatency?: number }).outputLatency;
    setOutputLatency(typeof measuredOutputLatency === "number" && Number.isFinite(measuredOutputLatency) ? measuredOutputLatency : null);
  };

  const stopSourceOnly = () => {
    try { sourceRef.current?.stop(); } catch {}
    sourceRef.current?.disconnect();
    sourceRef.current = null;
    runRef.current = null;
  };

  const stopAll = () => {
    const previousMode = modeRef.current;
    if (previousMode === "webaudio") {
      const captured = readWebSongTime();
      webPausedOffsetRef.current = captured;
      setWebTime(captured);
    }
    nativeRef.current?.pause();
    stopSourceOnly();
    stopRaf();
    setCurrentMode("idle");
    setMessage(`Paused · Native ${fmt(nativeRef.current?.currentTime ?? 0)} · WebAudio song ${fmt(previousMode === "webaudio" ? webPausedOffsetRef.current : webTime)}.`);
  };

  const playNative = async () => {
    const audio = nativeRef.current;
    if (!audio || !readyToTest) return;
    stopAll();
    try {
      audio.muted = false;
      audio.volume = 1;
      await audio.play();
      setCurrentMode("native");
      setMessage("Native playing · tap MARK BEAT on the target beat; audio keeps playing.");
      rafRef.current = requestAnimationFrame(tick);
    } catch (error) {
      setMessage(`Native play failed: ${error instanceof Error ? error.message : "unknown"}`);
    }
  };

  const playWebAudio = async () => {
    if (!readyToTest) return;
    stopAll();
    const sessionForced = forcePlaybackAudioSession();
    try {
      const context = contextRef.current;
      const buffer = bufferRef.current;
      if (!context || !buffer) throw new Error("Prepared AudioBuffer is unavailable.");
      if (context.state !== "running") await context.resume();
      updateLatencyInfo(context);

      const source = context.createBufferSource();
      source.buffer = buffer;
      source.connect(context.destination);
      const offset = Math.min(webPausedOffsetRef.current, Math.max(0, buffer.duration - 0.001));
      const when = context.currentTime + 0.10;
      runRef.current = { startContextTime: when, offset };
      setScheduledContextTime(when);
      source.start(when, offset);
      sourceRef.current = source;
      setWebTime(offset);
      setCurrentMode("webaudio");
      setMessage(`WebAudio playing · audioSession=${sessionForced ? "playback" : getAudioSession()?.type ?? "unsupported"} · tap MARK BEAT on the target beat.`);
      rafRef.current = requestAnimationFrame(tick);
      source.onended = () => {
        if (sourceRef.current === source) {
          sourceRef.current = null;
          runRef.current = null;
          stopRaf();
          setCurrentMode("idle");
        }
      };
    } catch (error) {
      setMessage(`Web Audio failed: ${error instanceof Error ? error.message : "unknown"}`);
    }
  };

  const markBeat = () => {
    const activeMode = modeRef.current;
    if (activeMode === "native") {
      const seconds = nativeRef.current?.currentTime ?? 0;
      setNativeTime(seconds);
      setMarks(current => [...current, { mode: "native", seconds }]);
      setMessage(`MARK native ${fmt(seconds)} · keep listening and mark again if needed.`);
      return;
    }
    if (activeMode === "webaudio") {
      const seconds = readWebSongTime();
      setWebTime(seconds);
      setMarks(current => [...current, { mode: "webaudio", seconds }]);
      setMessage(`MARK WebAudio song ${fmt(seconds)} · derived from output context clock minus scheduled source start.`);
    }
  };

  const reset = () => {
    stopAll();
    webPausedOffsetRef.current = 0;
    setWebTime(0);
    setMarks([]);
    setScheduledContextTime(null);
    const native = nativeRef.current;
    if (native) native.currentTime = 0;
    setNativeTime(0);
    setMessage("Reset to 0:00. For a clean first-play test, refresh the page and wait for READY TO TEST.");
  };

  return <main style={{ minHeight: "100vh", padding: 24, background: "#111016", color: "#f7f3fb", fontFamily: "system-ui, sans-serif" }}>
    <div style={{ maxWidth: 760, margin: "0 auto" }}>
      <p style={{ color: "#cf51ff", fontWeight: 800, letterSpacing: ".12em", fontSize: 12 }}>AUDIO TIMING LAB · TRACK-RELATIVE CLOCK</p>
      <h1 style={{ margin: "8px 0" }}>Native vs Web Audio song time</h1>
      <p style={{ color: "#aaa1b0", lineHeight: 1.5 }}>AudioContext clock is diagnostic only. The WebAudio song clock below subtracts the exact scheduled source-start context time.</p>
      <label style={{ display: "grid", gap: 8, margin: "24px 0" }}><span style={{ fontSize: 12, color: "#aaa1b0", fontWeight: 700 }}>TRACK</span><select value={selected?.id ?? ""} disabled={loading || mode !== "idle"} onChange={event => setSelectedId(event.target.value)} style={{ width: "100%", padding: 14, borderRadius: 12, background: "#1b1820", color: "white", border: "1px solid #403747" }}>{configs.map(item => <option value={item.id} key={item.id}>{item.title}</option>)}</select></label>
      <audio ref={nativeRef} src={selected?.audioUrl ?? ""} preload="auto" playsInline />

      <section style={{ display: "grid", gap: 12, padding: 18, border: "1px solid #3a3340", borderRadius: 18, background: "#18151c" }}>
        <Clock label="NATIVE currentTime" value={fmt(nativeTime)} />
        <Clock label="OUTPUT SONG TIME" value={fmt(webTime)} strong />
        <Clock label="Source scheduled at ctx" value={scheduledContextTime != null ? fmt(scheduledContextTime) : "—"} />
        <Clock label="AudioContext.currentTime" value={contextTime ? fmt(contextTime) : "—"} />
        <Clock label="Output contextTime" value={outputContextTime != null ? fmt(outputContextTime) : "—"} />
        <Clock label="Output performanceTime" value={outputPerformanceTime != null ? `${outputPerformanceTime.toFixed(1)} ms` : "—"} />
        <Clock label="performance.now()" value={typeof performance !== "undefined" ? `${performance.now().toFixed(1)} ms` : "—"} />
        <Clock label="audioSession.type" value={audioSessionType} />
        <Clock label="baseLatency" value={baseLatency != null ? `${(baseLatency * 1000).toFixed(1)} ms` : "—"} />
        <Clock label="outputLatency" value={outputLatency != null ? `${(outputLatency * 1000).toFixed(1)} ms` : "—"} />
      </section>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 16 }}>
        <button onClick={() => void playWebAudio()} disabled={decoding || !readyToTest || mode !== "idle"} style={buttonStyle(true)}>{decoding ? "PREPARING…" : "▶ PLAY WEBAUDIO"}</button>
        <button onClick={() => void playNative()} disabled={decoding || !readyToTest || mode !== "idle"} style={buttonStyle(false)}>▶ PLAY NATIVE</button>
        <button onClick={markBeat} disabled={mode === "idle"} style={buttonStyle(true)}>🎯 MARK BEAT</button>
        <button onClick={stopAll} disabled={mode === "idle"} style={buttonStyle(false)}>Ⅱ PAUSE</button>
        <button onClick={reset} disabled={mode !== "idle"} style={{ ...buttonStyle(false), gridColumn: "1 / -1" }}>RESET 0:00 + MARKS</button>
      </div>

      <section style={{ marginTop: 16, padding: 16, borderRadius: 14, background: "#18151c", border: "1px solid #3a3340" }}>
        <strong style={{ display: "block", marginBottom: 8 }}>MARKS</strong>
        <div style={{ color: "#c9c0cf", fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", lineHeight: 1.6 }}>
          {marks.length ? marks.map((mark, index) => <div key={`${mark.mode}-${index}`}>#{index + 1} {mark.mode.toUpperCase()} · {fmt(mark.seconds)}</div>) : <div>No marks yet.</div>}
          <div style={{ marginTop: 8 }}>Native median: {nativeMedian != null ? fmt(nativeMedian) : "—"}</div>
          <div>WebAudio median: {webMedian != null ? fmt(webMedian) : "—"}</div>
        </div>
      </section>

      <p style={{ marginTop: 18, padding: 14, borderRadius: 12, background: "#211a26", color: "#d7c9df", lineHeight: 1.45 }}>{message}</p>
      <p style={{ color: "#8f8795", fontSize: 13, lineHeight: 1.5 }}><strong>Clean test:</strong> refresh → wait READY TO TEST → PLAY WEBAUDIO first → do not touch Native → tap MARK BEAT on the known Aloha beat. Repeat 3–5 times, then compare medians.</p>
    </div>
  </main>;
}

function Clock({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return <div style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "baseline", borderBottom: "1px solid #2c2730", paddingBottom: 10 }}><span style={{ color: strong ? "#d969ff" : "#a9a0ae", fontSize: 12, fontWeight: 800 }}>{label}</span><strong style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", fontSize: strong ? 24 : 18 }}>{value}</strong></div>;
}

function buttonStyle(primary: boolean): React.CSSProperties {
  return { minHeight: 52, borderRadius: 13, border: primary ? "1px solid #e278ff" : "1px solid #4a414f", background: primary ? "linear-gradient(135deg,#c62af0,#6f35df)" : "#1b1820", color: "white", fontWeight: 800, fontSize: 14 };
}
