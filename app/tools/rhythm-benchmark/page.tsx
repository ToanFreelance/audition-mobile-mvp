"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  downmixAudioBuffer,
  runRhythmBenchmark,
  scoreManualMarks,
  summarizeManualMarks,
  type RhythmEngineResult,
} from "../../../game/rhythm-benchmark";
import { WebAudioTransport } from "../../../game/web-audio-transport";

type MusicConfig = {
  id: string;
  title: string;
  artist?: string;
  audioUrl: string;
  durationMs: number;
  bpm: number;
  BPM_exact?: number;
  spaceStartMs: number;
};

type MusicApiResponse = { configs?: MusicConfig[] };

const fmtSeconds = (ms: number | null | undefined) => {
  if (ms == null || !Number.isFinite(ms)) return "—";
  const total = Math.max(0, ms) / 1000;
  const minutes = Math.floor(total / 60);
  return `${minutes}:${(total - minutes * 60).toFixed(3).padStart(6, "0")}`;
};
const fmtNumber = (value: number | null | undefined, digits = 2) => value == null || !Number.isFinite(value) ? "—" : value.toFixed(digits);
const fmtMs = (value: number | null | undefined) => value == null || !Number.isFinite(value) ? "—" : `${value >= 0 ? "+" : ""}${value.toFixed(1)}ms`;

export default function RhythmBenchmarkPage() {
  const transportRef = useRef<WebAudioTransport | null>(null);
  const rafRef = useRef<number | null>(null);
  const [configs, setConfigs] = useState<MusicConfig[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [loading, setLoading] = useState(true);
  const [preparing, setPreparing] = useState(false);
  const [running, setRunning] = useState(false);
  const [ready, setReady] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [currentMs, setCurrentMs] = useState(0);
  const [results, setResults] = useState<RhythmEngineResult[]>([]);
  const [marks, setMarks] = useState<number[]>([]);
  const [message, setMessage] = useState("Loading charts…");

  const selected = useMemo(() => configs.find(item => item.id === selectedId) ?? configs[0], [configs, selectedId]);

  const stopRaf = useCallback(() => {
    if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
  }, []);

  const startClock = useCallback(() => {
    stopRaf();
    const tick = () => {
      const transport = transportRef.current;
      if (transport) {
        setCurrentMs(transport.getCurrentTimeMs());
        setPlaying(transport.playing);
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  }, [stopRaf]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch("/api/music-config", { cache: "no-store" })
      .then(async response => {
        const json = await response.json();
        if (!response.ok) throw new Error(json?.error || `HTTP ${response.status}`);
        const list: MusicConfig[] = Array.isArray(json) ? json : (json as MusicApiResponse).configs ?? [];
        if (cancelled) return;
        setConfigs(list);
        const aloha = list.find(item => item.title.toLowerCase().includes("aloha"));
        setSelectedId((aloha ?? list[0])?.id ?? "");
        setMessage("Choose a chart, then RUN ALL ANALYZERS.");
      })
      .catch(error => !cancelled && setMessage(`Load failed: ${error instanceof Error ? error.message : "unknown"}`))
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    const previous = transportRef.current;
    transportRef.current = null;
    if (previous) void previous.destroy();
    stopRaf();
    setReady(false);
    setPlaying(false);
    setCurrentMs(0);
    setResults([]);
    setMarks([]);
    if (!selected?.audioUrl) return;
    const transport = new WebAudioTransport(selected.audioUrl);
    transportRef.current = transport;
    let cancelled = false;
    setPreparing(true);
    setMessage("Preparing shared WebAudio playback + analysis buffer…");
    void transport.prepare()
      .then(() => {
        if (cancelled || transportRef.current !== transport) return;
        setReady(true);
        setMessage("Shared AudioBuffer ready. Playback and analyzers will use the same decode.");
      })
      .catch(error => !cancelled && setMessage(`Playback prepare failed: ${error instanceof Error ? error.message : "unknown"}`))
      .finally(() => !cancelled && setPreparing(false));
    return () => {
      cancelled = true;
      if (transportRef.current === transport) transportRef.current = null;
      void transport.destroy();
    };
  }, [selected?.audioUrl, stopRaf]);

  useEffect(() => () => stopRaf(), [stopRaf]);

  const runAll = async () => {
    if (!selected?.audioUrl || running || playing) return;
    setRunning(true);
    setMessage("Preparing PCM from the shared WebAudio buffer…");
    try {
      const transport = transportRef.current;
      if (!transport) throw new Error("WebAudio transport is unavailable.");
      const buffer = await transport.getDecodedBuffer();
      const mono = downmixAudioBuffer(buffer);
      setMessage("Running @audio/beat + Essentia variants + web detector variants + custom anchor grid…");
      const next = await runRhythmBenchmark({ buffer, mono, sampleRate: buffer.sampleRate, spaceStartMs: selected.spaceStartMs });
      setResults(next);
      const succeeded = next.filter(item => !item.error).length;
      setMessage(`Benchmark complete: ${succeeded}/${next.length} analyzer variants returned results. Consecutive manual SPACE marks score the best modulo-4 phase, MAE and drift.`);
    } catch (error) {
      setMessage(`Benchmark failed: ${error instanceof Error ? error.message : "unknown"}`);
    } finally {
      setRunning(false);
    }
  };

  const play = async () => {
    const transport = transportRef.current;
    if (!transport || !ready) return;
    try {
      await transport.play();
      setPlaying(true);
      startClock();
      setMessage("Playing with the same WebAudio clock used by gameplay. Mark consecutive musical SPACE/Beat-4 points without resetting between them.");
    } catch (error) {
      setMessage(`Play failed: ${error instanceof Error ? error.message : "unknown"}`);
    }
  };

  const pause = () => {
    transportRef.current?.pause();
    setCurrentMs(transportRef.current?.getCurrentTimeMs() ?? currentMs);
    setPlaying(false);
    stopRaf();
  };

  const reset = () => {
    transportRef.current?.reset();
    setCurrentMs(0);
    setPlaying(false);
    stopRaf();
  };

  const mark = () => {
    const value = transportRef.current?.getCurrentTimeMs() ?? currentMs;
    setCurrentMs(value);
    setMarks(current => [...current, value]);
    setMessage(`Manual mark #${marks.length + 1}: ${fmtSeconds(value)}. For manual BPM, mark consecutive SPACE points in one playback.`);
  };

  const anchor = selected?.spaceStartMs ?? 0;
  const windowStart = Math.max(0, anchor - 8000);
  const windowEnd = Math.min(selected?.durationMs || anchor + 16000, anchor + 12000);
  const windowSize = Math.max(1, windowEnd - windowStart);
  const scoreRows = useMemo(() => results.map(result => ({ result, score: scoreManualMarks(result, marks) })), [results, marks]);
  const manualSummary = useMemo(() => summarizeManualMarks(marks), [marks]);
  const timelineResults = useMemo(() => results.filter(result => result.beatTimesMs.length), [results]);

  const renderTimelineTrack = (pointsMs: number[], color: string, pointWidth = 2) => (
    <div style={{ position: "relative", background: "rgba(255,255,255,.015)", minHeight: 38 }}>
      <span style={{ position: "absolute", left: `${((anchor - windowStart) / windowSize) * 100}%`, top: 0, bottom: 0, width: 2, background: "white", opacity: .9, transform: "translateX(-1px)", zIndex: 3 }} />
      {pointsMs.filter(point => point >= windowStart && point <= windowEnd).map((point, index) => <span key={`${point}-${index}`} title={fmtSeconds(point)} style={{ position: "absolute", left: `${((point - windowStart) / windowSize) * 100}%`, top: 7, bottom: 7, width: pointWidth, background: color, transform: `translateX(-${pointWidth / 2}px)`, zIndex: 4 }} />)}
    </div>
  );

  return (
    <main style={{ minHeight: "100vh", background: "#0d0b12", color: "#f8f5fb", padding: "24px 16px 80px", fontFamily: "system-ui, -apple-system, sans-serif" }}>
      <div style={{ maxWidth: 1120, margin: "0 auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start", flexWrap: "wrap" }}>
          <div><div style={eyebrow}>RHYTHM ANALYZER BENCHMARK</div><h1 style={{ margin: "8px 0", fontSize: 32 }}>Compare engines on real Audition charts</h1><p style={muted}>No engine is trusted by default. We compare BPM, beat grid, jitter, anchor error, runtime, and manual listening accuracy.</p></div>
          <button style={secondaryButton} onClick={() => { window.location.href = "/"; }}>← READY</button>
        </div>

        <section style={card}>
          <label style={{ display: "grid", gap: 8 }}><span style={eyebrow}>TRACK</span><select disabled={loading || running || playing} value={selected?.id ?? ""} onChange={event => setSelectedId(event.target.value)} style={selectStyle}>{configs.map(item => <option key={item.id} value={item.id}>{item.title} · {item.BPM_exact?.toFixed(4) ?? item.bpm} BPM</option>)}</select></label>
          {selected && <div style={{ marginTop: 14, display: "flex", gap: 18, flexWrap: "wrap", color: "#bbb1c2" }}><span>Saved BPM <b style={{ color: "white" }}>{selected.BPM_exact?.toFixed(4) ?? selected.bpm}</b></span><span>SPACE #1 <b style={{ color: "white" }}>{fmtSeconds(selected.spaceStartMs)}</b></span><span>Duration <b style={{ color: "white" }}>{fmtSeconds(selected.durationMs)}</b></span></div>}
          <button disabled={!selected || !ready || running || playing} onClick={() => void runAll()} style={{ ...primaryButton, width: "100%", marginTop: 16 }}>{running ? "RUNNING ALL ENGINES…" : "⚗ RUN ALL ANALYZERS"}</button>
        </section>

        <section style={card}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}><div><div style={eyebrow}>MANUAL GROUND TRUTH</div><strong style={{ fontSize: 24 }}>{fmtSeconds(currentMs)}</strong></div><span style={muted}>{marks.length} marks</span></div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2,minmax(0,1fr))", gap: 10, marginTop: 14 }}>
            <button disabled={!ready || preparing || playing || running} onClick={() => void play()} style={primaryButton}>▶ PLAY / RESUME</button>
            <button disabled={!playing} onClick={pause} style={secondaryButton}>Ⅱ PAUSE</button>
            <button disabled={!ready || running} onClick={mark} style={primaryButton}>🎯 MARK NEXT SPACE</button>
            <button disabled={!ready || running} onClick={reset} style={secondaryButton}>↺ RESET 0:00</button>
          </div>
          <div style={{ marginTop: 12, fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", color: "#cec4d3", fontSize: 13 }}>{marks.length ? marks.map((value, index) => <span key={`${value}-${index}`} style={{ display: "inline-block", marginRight: 12 }}>#{index + 1} {fmtSeconds(value)}</span>) : "Mark consecutive SPACE/Beat-4 points during one playback. 5–10 marks give useful manual BPM, MAE and drift."}</div>
          <div style={{ marginTop: 14, display: "grid", gridTemplateColumns: "repeat(3,minmax(0,1fr))", gap: 8 }}>
            <Metric label="Manual 4-beat interval" value={manualSummary.medianSpaceIntervalMs == null ? "—" : `${manualSummary.medianSpaceIntervalMs.toFixed(2)}ms`} />
            <Metric label="Manual derived BPM" value={fmtNumber(manualSummary.derivedBpm, 4)} />
            <Metric label="Manual interval jitter" value={manualSummary.intervalJitterMs == null ? "—" : `${manualSummary.intervalJitterMs.toFixed(1)}ms`} />
          </div>
          {marks.length > 0 && <button onClick={() => setMarks([])} disabled={running} style={{ ...secondaryButton, marginTop: 10 }}>CLEAR MANUAL MARKS</button>}
        </section>

        <section style={card}>
          <div style={eyebrow}>NORMALIZED RESULTS</div>
          <div style={{ overflowX: "auto", marginTop: 12 }}><table style={{ width: "100%", minWidth: 1140, borderCollapse: "collapse", fontSize: 13 }}><thead><tr>{["Engine", "BPM", "Conf", "Beats", "Median interval", "Derived BPM", "Jitter", "Nearest beat", "Anchor Δ", "SPACE phase", "Runtime", "SPACE MAE", "Drift/SPACE"].map(label => <th key={label} style={th}>{label}</th>)}</tr></thead><tbody>{scoreRows.length ? scoreRows.map(({ result, score }) => <tr key={result.id} style={{ opacity: result.error ? .6 : 1 }}><td style={td}><strong>{result.engine}</strong><small style={{ display: "block", color: "#9e93a5" }}>{result.variant}{result.kind === "custom" ? " · CUSTOM" : ""}</small>{result.error && <small style={{ display: "block", color: "#ff8da1" }}>{result.error}</small>}</td><td style={td}>{fmtNumber(result.bpm, 4)}</td><td style={td}>{result.confidence == null ? "—" : `${(result.confidence * 100).toFixed(0)}%`}</td><td style={td}>{result.beatCount || "—"}</td><td style={td}>{result.medianBeatIntervalMs == null ? "—" : `${result.medianBeatIntervalMs.toFixed(2)}ms`}</td><td style={td}>{fmtNumber(result.derivedBpmFromIntervals, 4)}</td><td style={td}>{result.intervalJitterMs == null ? "—" : `${result.intervalJitterMs.toFixed(1)}ms`}</td><td style={td}>{fmtSeconds(result.nearestBeatToSpaceStartMs)}</td><td style={td}>{fmtMs(result.spaceStartDeltaMs)}</td><td style={td}>{score.spacePhase == null ? "—" : `P${score.spacePhase}/4`}</td><td style={td}>{`${result.processingTimeMs.toFixed(0)}ms`}</td><td style={td}>{score.maeMs == null ? "—" : `${score.maeMs.toFixed(1)}ms`}</td><td style={td}>{score.signedDriftMsPerMark == null ? "—" : `${score.signedDriftMsPerMark >= 0 ? "+" : ""}${score.signedDriftMsPerMark.toFixed(1)}ms`}</td></tr>) : <tr><td style={td} colSpan={13}>Run the analyzers to populate the comparison.</td></tr>}</tbody></table></div>
        </section>

        {results.length > 0 && <section style={card}>
          <div style={eyebrow}>BEAT TIMELINE · AROUND SAVED SPACE #1</div>
          <p style={muted}>Window {fmtSeconds(windowStart)} → {fmtSeconds(windowEnd)}. The vertical white line is your saved SPACE #1. Manual marks use yellow ticks.</p>
          <div style={{ marginTop: 18, borderLeft: "1px solid #3e3545", borderRight: "1px solid #3e3545" }}>
            {marks.length > 0 && <div style={{ display: "grid", gridTemplateColumns: "180px 1fr", minHeight: 38, borderBottom: "1px solid #27212d" }}><div style={{ padding: "10px 8px", fontSize: 12, color: "#f2d66d" }}>Manual<small style={{ display: "block", color: "#9b8945" }}>SPACE marks</small></div>{renderTimelineTrack(marks, "#ffd65c", 4)}</div>}
            {timelineResults.map(result => <div key={result.id} style={{ display: "grid", gridTemplateColumns: "180px 1fr", minHeight: 38, borderBottom: "1px solid #27212d" }}><div style={{ padding: "10px 8px", fontSize: 12, color: "#d7cedc" }}>{result.engine}<small style={{ display: "block", color: "#827989" }}>{result.variant}</small></div>{renderTimelineTrack(result.beatTimesMs, result.kind === "custom" ? "#f45cff" : "#48d9ff")}</div>)}
          </div>
        </section>}

        {results.length > 0 && <section style={card}><div style={eyebrow}>RAW BEAT TIMESTAMPS · FIRST 16</div>{results.map(result => <div key={`${result.id}-beats`} style={{ padding: "12px 0", borderBottom: "1px solid #2b2530" }}><strong>{result.engine} · {result.variant}</strong><div style={{ marginTop: 6, fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", fontSize: 12, color: "#bdb2c4", lineHeight: 1.65 }}>{result.beatTimesMs.length ? result.beatTimesMs.slice(0, 16).map(fmtSeconds).join(" · ") : result.notes || result.error || "No beat timestamps returned."}</div>{result.notes && result.beatTimesMs.length > 0 && <small style={{ display: "block", marginTop: 5, color: "#817788" }}>{result.notes}</small>}</div>)}</section>}

        <p style={{ ...muted, padding: 14, borderRadius: 12, background: "#211a27" }}>{message}</p>
        <p style={{ ...muted, fontSize: 12 }}>Essentia.js remains benchmark-only because of AGPL-3.0. Its documented multifeature confidence range 0..5.32 is normalized to 0..100% here. Confidence values from different engines still must not be compared directly.</p>
      </div>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div style={{ padding: 10, borderRadius: 10, background: "#100d13", border: "1px solid #342b3b" }}><small style={{ display: "block", color: "#8f8497", marginBottom: 4 }}>{label}</small><strong style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", fontSize: 15 }}>{value}</strong></div>;
}

const card: React.CSSProperties = { marginTop: 18, padding: 18, borderRadius: 18, background: "#17131b", border: "1px solid #3b3143", boxShadow: "0 18px 50px rgba(0,0,0,.18)" };
const eyebrow: React.CSSProperties = { color: "#d35cff", fontSize: 12, fontWeight: 900, letterSpacing: ".14em" };
const muted: React.CSSProperties = { color: "#9f95a7", lineHeight: 1.55, margin: "6px 0" };
const selectStyle: React.CSSProperties = { width: "100%", borderRadius: 12, padding: "13px 14px", background: "#0f0d12", border: "1px solid #4b3e53", color: "white", fontSize: 16 };
const primaryButton: React.CSSProperties = { minHeight: 50, padding: "12px 14px", borderRadius: 12, border: "1px solid #ec88ff", background: "linear-gradient(135deg,#c62af0,#7138df)", color: "white", fontWeight: 900, fontSize: 14 };
const secondaryButton: React.CSSProperties = { minHeight: 46, padding: "10px 14px", borderRadius: 12, border: "1px solid #504457", background: "#19151d", color: "white", fontWeight: 800, fontSize: 13 };
const th: React.CSSProperties = { textAlign: "left", color: "#9f95a7", borderBottom: "1px solid #403648", padding: "9px 8px", whiteSpace: "nowrap" };
const td: React.CSSProperties = { borderBottom: "1px solid #29222f", padding: "10px 8px", verticalAlign: "top", whiteSpace: "nowrap", fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" };
