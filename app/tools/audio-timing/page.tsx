"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type MusicConfig = {
  id: string;
  title: string;
  audioUrl: string;
};

type Mode = "idle" | "native" | "webaudio";

const fmt = (seconds: number) => {
  if (!Number.isFinite(seconds)) return "—";
  const value = Math.max(0, seconds);
  const minutes = Math.floor(value / 60);
  const rest = value - minutes * 60;
  return `${minutes}:${rest.toFixed(3).padStart(6, "0")}`;
};

export default function AudioTimingLabPage() {
  const nativeRef = useRef<HTMLAudioElement | null>(null);
  const contextRef = useRef<AudioContext | null>(null);
  const bufferRef = useRef<AudioBuffer | null>(null);
  const sourceRef = useRef<AudioBufferSourceNode | null>(null);
  const rafRef = useRef<number | null>(null);
  const webStartContextRef = useRef(0);
  const webStartOffsetRef = useRef(0);
  const webPausedOffsetRef = useRef(0);

  const [configs, setConfigs] = useState<MusicConfig[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [loading, setLoading] = useState(true);
  const [decoding, setDecoding] = useState(false);
  const [mode, setMode] = useState<Mode>("idle");
  const [nativeTime, setNativeTime] = useState(0);
  const [webTime, setWebTime] = useState(0);
  const [contextTime, setContextTime] = useState(0);
  const [outputContextTime, setOutputContextTime] = useState<number | null>(null);
  const [baseLatency, setBaseLatency] = useState<number | null>(null);
  const [outputLatency, setOutputLatency] = useState<number | null>(null);
  const [message, setMessage] = useState("Loading music charts…");

  const selected = useMemo(
    () => configs.find(item => item.id === selectedId) ?? configs[0],
    [configs, selectedId],
  );

  const stopRaf = () => {
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
  };

  const getOutputContextTime = (context: AudioContext) => {
    const withTimestamp = context as AudioContext & {
      getOutputTimestamp?: () => { contextTime: number; performanceTime: number };
    };
    const stamp = withTimestamp.getOutputTimestamp?.();
    return stamp && Number.isFinite(stamp.contextTime) ? stamp.contextTime : context.currentTime;
  };

  const tick = () => {
    const context = contextRef.current;
    const native = nativeRef.current;
    if (native) setNativeTime(native.currentTime);

    if (context) {
      const outputCtx = getOutputContextTime(context);
      setContextTime(context.currentTime);
      setOutputContextTime(outputCtx);
      if (mode === "webaudio") {
        const song = webStartOffsetRef.current + Math.max(0, outputCtx - webStartContextRef.current);
        setWebTime(song);
      }
    }

    rafRef.current = requestAnimationFrame(tick);
  };

  useEffect(() => {
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
        setMessage("Choose Aloha, then test Web Audio first on a fresh page load.");
      })
      .catch(error => !cancelled && setMessage(`Load failed: ${error instanceof Error ? error.message : "unknown"}`))
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    return () => {
      stopRaf();
      sourceRef.current?.stop();
      sourceRef.current?.disconnect();
      void contextRef.current?.close();
    };
  }, []);

  useEffect(() => {
    bufferRef.current = null;
    webPausedOffsetRef.current = 0;
    setWebTime(0);
    setNativeTime(0);
    setMode("idle");
    if (nativeRef.current) {
      nativeRef.current.pause();
      nativeRef.current.currentTime = 0;
    }
  }, [selected?.audioUrl]);

  const ensureContextAndBuffer = async () => {
    if (!selected?.audioUrl) throw new Error("No audio selected.");
    let context = contextRef.current;
    if (!context || context.state === "closed") {
      const Ctor = window.AudioContext ?? (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) throw new Error("Web Audio API is unavailable.");
      context = new Ctor();
      contextRef.current = context;
    }
    if (context.state === "suspended") await context.resume();
    setBaseLatency(Number.isFinite(context.baseLatency) ? context.baseLatency : null);
    const withOutputLatency = context as AudioContext & { outputLatency?: number };
    setOutputLatency(Number.isFinite(withOutputLatency.outputLatency) ? withOutputLatency.outputLatency! : null);

    if (!bufferRef.current) {
      setDecoding(true);
      setMessage("Fetching + decoding audio into an AudioBuffer…");
      const response = await fetch(selected.audioUrl, { cache: "no-store" });
      if (!response.ok) throw new Error(`Audio HTTP ${response.status}`);
      const bytes = await response.arrayBuffer();
      bufferRef.current = await context.decodeAudioData(bytes.slice(0));
      setDecoding(false);
    }
    return context;
  };

  const stopAll = () => {
    nativeRef.current?.pause();
    if (mode === "webaudio") webPausedOffsetRef.current = webTime;
    try { sourceRef.current?.stop(); } catch {}
    sourceRef.current?.disconnect();
    sourceRef.current = null;
    stopRaf();
    setMode("idle");
    setMessage(`Paused. Native ${fmt(nativeRef.current?.currentTime ?? 0)} · WebAudio output ${fmt(webTime)}.`);
  };

  const playNative = async () => {
    const audio = nativeRef.current;
    if (!audio) return;
    stopAll();
    try {
      audio.muted = false;
      audio.volume = 1;
      await audio.play();
      setMode("native");
      setMessage("Native HTMLAudioElement is playing. Pause exactly on the heard beat and record currentTime.");
      stopRaf();
      rafRef.current = requestAnimationFrame(tick);
    } catch (error) {
      setMessage(`Native play failed: ${error instanceof Error ? error.message : "unknown"}`);
    }
  };

  const playWebAudio = async () => {
    stopAll();
    try {
      const context = await ensureContextAndBuffer();
      const buffer = bufferRef.current;
      if (!buffer) throw new Error("Decoded buffer is unavailable.");

      const source = context.createBufferSource();
      source.buffer = buffer;
      source.connect(context.destination);
      const offset = Math.min(webPausedOffsetRef.current, Math.max(0, buffer.duration - 0.001));
      const when = context.currentTime + 0.08;
      webStartOffsetRef.current = offset;
      webStartContextRef.current = when;
      source.start(when, offset);
      sourceRef.current = source;
      setWebTime(offset);
      setMode("webaudio");
      setMessage("Web Audio is playing. Pause exactly on the heard Beat-4; OUTPUT SONG TIME is the value we care about.");
      stopRaf();
      rafRef.current = requestAnimationFrame(tick);
      source.onended = () => {
        if (sourceRef.current === source) {
          sourceRef.current = null;
          setMode("idle");
          stopRaf();
        }
      };
    } catch (error) {
      setDecoding(false);
      setMessage(`Web Audio failed: ${error instanceof Error ? error.message : "unknown"}`);
    }
  };

  const reset = () => {
    stopAll();
    webPausedOffsetRef.current = 0;
    setWebTime(0);
    const native = nativeRef.current;
    if (native) native.currentTime = 0;
    setNativeTime(0);
    setMessage("Reset to 0:00. Refresh the page before the definitive fresh-start test.");
  };

  return (
    <main style={{ minHeight: "100vh", padding: "24px", background: "#111016", color: "#f7f3fb", fontFamily: "system-ui, sans-serif" }}>
      <div style={{ maxWidth: 760, margin: "0 auto" }}>
        <p style={{ color: "#cf51ff", fontWeight: 800, letterSpacing: ".12em", fontSize: 12 }}>AUDIO TIMING LAB</p>
        <h1 style={{ margin: "8px 0" }}>Native vs Web Audio output clock</h1>
        <p style={{ color: "#aaa1b0", lineHeight: 1.5 }}>Diagnostic only. No waveform, BPM, Gauge, trim, or auto-seek. For Aloha, pause on the known Beat-4 and compare the clocks.</p>

        <label style={{ display: "grid", gap: 8, margin: "24px 0" }}>
          <span style={{ fontSize: 12, color: "#aaa1b0", fontWeight: 700 }}>TRACK</span>
          <select value={selected?.id ?? ""} disabled={loading || mode !== "idle"} onChange={event => setSelectedId(event.target.value)} style={{ width: "100%", padding: 14, borderRadius: 12, background: "#1b1820", color: "white", border: "1px solid #403747" }}>
            {configs.map(item => <option value={item.id} key={item.id}>{item.title}</option>)}
          </select>
        </label>

        <audio ref={nativeRef} src={selected?.audioUrl ?? ""} preload="auto" playsInline />

        <section style={{ display: "grid", gap: 12, padding: 18, border: "1px solid #3a3340", borderRadius: 18, background: "#18151c" }}>
          <Clock label="NATIVE currentTime" value={fmt(nativeTime)} />
          <Clock label="WEBAUDIO OUTPUT SONG TIME" value={fmt(webTime)} strong />
          <Clock label="AudioContext.currentTime" value={contextTime ? fmt(contextTime) : "—"} />
          <Clock label="getOutputTimestamp().contextTime" value={outputContextTime != null ? fmt(outputContextTime) : "—"} />
          <Clock label="baseLatency" value={baseLatency != null ? `${(baseLatency * 1000).toFixed(1)} ms` : "—"} />
          <Clock label="outputLatency" value={outputLatency != null ? `${(outputLatency * 1000).toFixed(1)} ms` : "—"} />
        </section>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 16 }}>
          <button onClick={() => void playWebAudio()} disabled={decoding || mode !== "idle"} style={buttonStyle(true)}>{decoding ? "DECODING…" : "▶ PLAY WEBAUDIO"}</button>
          <button onClick={() => void playNative()} disabled={decoding || mode !== "idle"} style={buttonStyle(false)}>▶ PLAY NATIVE</button>
          <button onClick={stopAll} disabled={mode === "idle"} style={buttonStyle(false)}>Ⅱ PAUSE</button>
          <button onClick={reset} disabled={mode !== "idle"} style={buttonStyle(false)}>RESET 0:00</button>
        </div>

        <p style={{ marginTop: 18, padding: 14, borderRadius: 12, background: "#211a26", color: "#d7c9df", lineHeight: 1.45 }}>{message}</p>
        <p style={{ color: "#8f8795", fontSize: 13, lineHeight: 1.5 }}><strong>Definitive test:</strong> refresh this page → choose Aloha → PLAY WEBAUDIO → do not seek → pause exactly on the Beat-4 you know should be ~9.28–9.3s. Send me the OUTPUT SONG TIME shown here.</p>
      </div>
    </main>
  );
}

function Clock({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "baseline", borderBottom: "1px solid #2c2730", paddingBottom: 10 }}>
      <span style={{ color: strong ? "#d969ff" : "#a9a0ae", fontSize: 12, fontWeight: 800 }}>{label}</span>
      <strong style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", fontSize: strong ? 24 : 18 }}>{value}</strong>
    </div>
  );
}

function buttonStyle(primary: boolean): React.CSSProperties {
  return {
    minHeight: 52,
    borderRadius: 13,
    border: primary ? "1px solid #e278ff" : "1px solid #4a414f",
    background: primary ? "linear-gradient(135deg,#c62af0,#6f35df)" : "#1b1820",
    color: "white",
    fontWeight: 800,
    fontSize: 14,
  };
}
