"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  buildTempoConsensus,
  downmixAudioBuffer,
  runRhythmBenchmark,
  type RhythmEngineResult,
} from "../../../../game/rhythm-benchmark";
import { WebAudioTransport } from "../../../../game/web-audio-transport";

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

type AnalyzerSummary = {
  id: string;
  engine: string;
  variant: string;
  bpm: number | null;
  confidence: number | null;
  beatGridKind: string;
  beatCount: number;
  medianBeatIntervalMs: number | null;
  derivedBpmFromIntervals: number | null;
  intervalJitterMs: number | null;
  tempoMode: string;
  nearestBeatToSpaceStartMs: number | null;
  spaceStartDeltaMs: number | null;
  processingTimeMs: number;
  notes?: string;
  error?: string;
};

type FinalRaw = {
  selectedMetricalBpm?: number | null;
  audioPulseBpm?: number | null;
  gameplayBpm?: number | null;
  nominalBpmCandidate?: number | null;
  nominalConfidence?: number | null;
  sourceSpeedStatus?: string;
  playbackRateToNominal?: number | null;
  endDriftToNominalMs?: number | null;
  snapToleranceBpm?: number | null;
  safeIntegerSnap?: boolean;
  audioPhaseMs?: number | null;
  audioPhaseDriftMsPerSecond?: number | null;
  gameplayAnchorMs?: number | null;
  gameplayAnchorSource?: string;
  metricalLevelConfidence?: number | null;
  exactTempoConfidence?: number | null;
  phaseCoherenceConfidence?: number | null;
  gameplayAnchorConfidence?: number | null;
  robust95FamilySpreadBpm?: number | null;
  robust95EndDriftMs?: number | null;
  familyEstimates?: Array<{ family?: string; bpm?: number; spreadBpm?: number; weight?: number }>;
  candidates?: Array<{ bpm?: number; score?: number; familyScore?: number; detectedScore?: number; onsetScore?: number; phaseScore?: number; families?: string[] }>;
};

type BatchTrackResult = {
  config: MusicConfig;
  status: "DONE" | "ERROR";
  error?: string;
  elapsedMs: number;
  decodedDurationMs: number | null;
  succeeded: number;
  total: number;
  final: AnalyzerSummary | null;
  finalRaw: FinalRaw;
  onset: AnalyzerSummary | null;
  phase: AnalyzerSummary | null;
  consensusStatus: string;
  consensusBpm: number | null;
  consensusNote: string;
  analyzers: AnalyzerSummary[];
};

const sleep = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));
const fmt = (value: number | null | undefined, digits = 4) => value == null || !Number.isFinite(value) ? "—" : value.toFixed(digits);
const fmtPct = (value: number | null | undefined) => value == null || !Number.isFinite(value) ? "—" : `${Math.round(value * 100)}%`;
const fmtMs = (value: number | null | undefined, digits = 1) => value == null || !Number.isFinite(value) ? "—" : `${value >= 0 ? "+" : ""}${value.toFixed(digits)}ms`;
const fmtDuration = (ms: number | null | undefined) => {
  if (ms == null || !Number.isFinite(ms)) return "—";
  const total = Math.max(0, ms) / 1000;
  const minutes = Math.floor(total / 60);
  return `${minutes}:${(total - minutes * 60).toFixed(3).padStart(6, "0")}`;
};

const toSummary = (row: RhythmEngineResult): AnalyzerSummary => ({
  id: row.id,
  engine: row.engine,
  variant: row.variant,
  bpm: row.bpm,
  confidence: row.confidence,
  beatGridKind: row.beatGridKind,
  beatCount: row.beatCount,
  medianBeatIntervalMs: row.medianBeatIntervalMs,
  derivedBpmFromIntervals: row.derivedBpmFromIntervals,
  intervalJitterMs: row.intervalJitterMs,
  tempoMode: row.tempoMode,
  nearestBeatToSpaceStartMs: row.nearestBeatToSpaceStartMs,
  spaceStartDeltaMs: row.spaceStartDeltaMs,
  processingTimeMs: row.processingTimeMs,
  notes: row.notes,
  error: row.error,
});

const asRaw = (row: RhythmEngineResult | undefined): FinalRaw =>
  row?.raw && typeof row.raw === "object" ? row.raw as FinalRaw : {};

export default function BatchRhythmBenchmarkPage() {
  const [configs, setConfigs] = useState<MusicConfig[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState<BatchTrackResult[]>([]);
  const [progress, setProgress] = useState("Loading charts…");
  const [activeTrackId, setActiveTrackId] = useState<string | null>(null);
  const stopRequestedRef = useRef(false);

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
        setSelectedIds(new Set(list.filter(item => item.audioUrl).map(item => item.id)));
        setProgress(`${list.length} chart${list.length === 1 ? "" : "s"} loaded. Select tracks and run once; analysis is strictly sequential for Safari/iPhone stability.`);
      })
      .catch(error => !cancelled && setProgress(`Load failed: ${error instanceof Error ? error.message : "unknown"}`))
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, []);

  const selectedTracks = useMemo(() => configs.filter(item => selectedIds.has(item.id) && item.audioUrl), [configs, selectedIds]);

  const toggleTrack = useCallback((id: string) => {
    if (running) return;
    setSelectedIds(current => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, [running]);

  const analyzeOne = useCallback(async (config: MusicConfig, position: number, totalTracks: number): Promise<BatchTrackResult> => {
    const started = performance.now();
    const transport = new WebAudioTransport(config.audioUrl);
    try {
      setActiveTrackId(config.id);
      setProgress(`[${position}/${totalTracks}] ${config.title} · preparing WebAudio + decode…`);
      await transport.prepare();
      const buffer = await transport.getDecodedBuffer();
      const decodedDurationMs = buffer.duration * 1000;
      const mono = downmixAudioBuffer(buffer);
      const rows = await runRhythmBenchmark(
        { buffer, mono, sampleRate: buffer.sampleRate, spaceStartMs: config.spaceStartMs },
        stage => setProgress(`[${position}/${totalTracks}] ${config.title} · ${stage}`),
      );
      const finalRow = rows.find(row => row.engine === "FINAL RHYTHM" || row.id === "auto-grid-validator");
      const onsetRow = rows.find(row => row.id === "onset-grid-validator");
      const phaseRow = rows.find(row => row.id === "phase-grid-validator");
      const consensus = buildTempoConsensus(rows);
      return {
        config,
        status: "DONE",
        elapsedMs: performance.now() - started,
        decodedDurationMs,
        succeeded: rows.filter(row => !row.error).length,
        total: rows.length,
        final: finalRow ? toSummary(finalRow) : null,
        finalRaw: asRaw(finalRow),
        onset: onsetRow ? toSummary(onsetRow) : null,
        phase: phaseRow ? toSummary(phaseRow) : null,
        consensusStatus: consensus.status,
        consensusBpm: consensus.bpm,
        consensusNote: consensus.note,
        analyzers: rows.map(toSummary),
      };
    } catch (error) {
      return {
        config,
        status: "ERROR",
        error: error instanceof Error ? error.message : "Unknown batch analysis error",
        elapsedMs: performance.now() - started,
        decodedDurationMs: null,
        succeeded: 0,
        total: 0,
        final: null,
        finalRaw: {},
        onset: null,
        phase: null,
        consensusStatus: "NO_DATA",
        consensusBpm: null,
        consensusNote: "Track failed before a complete benchmark result was produced.",
        analyzers: [],
      };
    } finally {
      await transport.destroy();
      await sleep(80);
    }
  }, []);

  const runBatch = useCallback(async () => {
    if (running || !selectedTracks.length) return;
    stopRequestedRef.current = false;
    setRunning(true);
    setResults([]);
    setActiveTrackId(null);
    const completed: BatchTrackResult[] = [];
    try {
      for (let index = 0; index < selectedTracks.length; index += 1) {
        if (stopRequestedRef.current) break;
        const track = selectedTracks[index];
        if (!track) continue;
        const result = await analyzeOne(track, index + 1, selectedTracks.length);
        completed.push(result);
        setResults([...completed]);
        setProgress(`[${index + 1}/${selectedTracks.length}] ${track.title} · ${result.status === "DONE" ? "complete" : `failed: ${result.error}`}. ${stopRequestedRef.current ? "Stopping…" : "Releasing audio memory before next track…"}`);
        await sleep(120);
      }
      const ok = completed.filter(item => item.status === "DONE").length;
      const failed = completed.length - ok;
      setProgress(stopRequestedRef.current
        ? `Batch stopped after ${completed.length}/${selectedTracks.length} tracks. ${ok} completed, ${failed} failed.`
        : `Batch complete: ${ok}/${selectedTracks.length} tracks completed${failed ? `, ${failed} failed` : ""}. Results below are separated per track and can be printed to one PDF.`);
    } finally {
      setActiveTrackId(null);
      setRunning(false);
    }
  }, [analyzeOne, running, selectedTracks]);

  const failedIds = useMemo(() => results.filter(item => item.status === "ERROR").map(item => item.config.id), [results]);

  return (
    <main style={{ minHeight: "100vh", background: "#0d0b12", color: "#f8f5fb", padding: "24px 16px 80px", fontFamily: "system-ui, -apple-system, sans-serif" }}>
      <style>{`@media print { .batch-no-print { display:none !important; } .batch-result { break-before:page; page-break-before:always; box-shadow:none !important; } .batch-result:first-of-type { break-before:auto; page-break-before:auto; } body { background:#fff !important; } }`}</style>
      <div style={{ maxWidth: 1180, margin: "0 auto" }}>
        <div className="batch-no-print" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
          <div>
            <div style={eyebrow}>RHYTHM BENCHMARK · BATCH MODE</div>
            <h1 style={{ margin: "8px 0", fontSize: 32 }}>Analyze many tracks in one run</h1>
            <p style={muted}>Each song is decoded and analyzed one at a time. The AudioBuffer is released before the next song, so heavy analyzers never run concurrently on iPhone Safari.</p>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button style={secondaryButton} onClick={() => { window.location.href = "/tools/rhythm-benchmark"; }}>← SINGLE</button>
            <button style={secondaryButton} onClick={() => { window.location.href = "/"; }}>READY</button>
          </div>
        </div>

        <section className="batch-no-print" style={card}>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
            <div><div style={eyebrow}>TRACK QUEUE</div><strong style={{ fontSize: 22 }}>{selectedTracks.length} selected / {configs.length} total</strong></div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button disabled={running || loading} style={secondaryButton} onClick={() => setSelectedIds(new Set(configs.filter(item => item.audioUrl).map(item => item.id)))}>SELECT ALL</button>
              <button disabled={running || loading} style={secondaryButton} onClick={() => setSelectedIds(new Set())}>CLEAR</button>
              {failedIds.length > 0 && <button disabled={running} style={secondaryButton} onClick={() => setSelectedIds(new Set(failedIds))}>SELECT FAILED</button>}
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(250px,1fr))", gap: 9, marginTop: 14 }}>
            {configs.map(config => {
              const checked = selectedIds.has(config.id);
              const active = activeTrackId === config.id;
              return <label key={config.id} style={{ display: "grid", gridTemplateColumns: "22px 1fr", gap: 9, alignItems: "start", padding: 11, borderRadius: 11, border: `1px solid ${active ? "#d35cff" : checked ? "#5b4666" : "#302936"}`, background: active ? "#24152b" : checked ? "#151119" : "#100d13", opacity: config.audioUrl ? 1 : .45 }}>
                <input type="checkbox" checked={checked} disabled={running || !config.audioUrl} onChange={() => toggleTrack(config.id)} style={{ width: 18, height: 18, marginTop: 2 }} />
                <span><strong>{config.title}</strong>{config.artist && <small style={{ display: "block", color: "#978c9e" }}>{config.artist}</small>}<small style={{ display: "block", color: "#746a7b", marginTop: 3 }}>saved {config.BPM_exact?.toFixed(4) ?? config.bpm} BPM · SPACE {fmtDuration(config.spaceStartMs)}</small></span>
              </label>;
            })}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: running ? "1fr auto" : "1fr", gap: 9, marginTop: 14 }}>
            <button disabled={loading || running || selectedTracks.length === 0} style={primaryButton} onClick={() => void runBatch()}>{running ? "ANALYZING SEQUENTIALLY…" : `⚗ RUN ${selectedTracks.length || ""} SELECTED TRACK${selectedTracks.length === 1 ? "" : "S"}`}</button>
            {running && <button style={dangerButton} onClick={() => { stopRequestedRef.current = true; setProgress(current => `${current} · stop requested; current track will finish first.`); }}>STOP AFTER CURRENT</button>}
          </div>
          <p style={{ ...muted, marginTop: 12 }}>{progress}</p>
        </section>

        {results.length > 0 && <>
          <section style={card}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "baseline", flexWrap: "wrap" }}>
              <div><div style={eyebrow}>BATCH SUMMARY</div><strong style={{ fontSize: 24 }}>{results.filter(item => item.status === "DONE").length}/{results.length} completed</strong></div>
              <button className="batch-no-print" style={primaryButton} onClick={() => window.print()}>🖨 PRINT / SAVE ONE PDF</button>
            </div>
            <div style={{ overflowX: "auto", marginTop: 12 }}>
              <table style={{ width: "100%", minWidth: 1000, borderCollapse: "collapse", fontSize: 12 }}>
                <thead><tr>{["Track", "Saved", "FINAL", "Audio pulse", "Nominal", "Source speed", "Metrical", "Exact tempo", "Phase", "Anchor", "95% end drift", "Time"].map(label => <th key={label} style={th}>{label}</th>)}</tr></thead>
                <tbody>{results.map(item => <tr key={item.config.id} style={{ opacity: item.status === "ERROR" ? .55 : 1 }}>
                  <td style={td}><strong>{item.config.title}</strong>{item.error && <small style={{ display: "block", color: "#ff8da1" }}>{item.error}</small>}</td>
                  <td style={td}>{fmt(item.config.BPM_exact ?? item.config.bpm)}</td>
                  <td style={td}>{fmt(item.final?.bpm)}</td>
                  <td style={td}>{fmt(item.finalRaw.audioPulseBpm, 6)}</td>
                  <td style={td}>{fmt(item.finalRaw.nominalBpmCandidate, 3)}</td>
                  <td style={td}>{item.finalRaw.sourceSpeedStatus ?? "—"}</td>
                  <td style={td}>{fmtPct(item.finalRaw.metricalLevelConfidence)}</td>
                  <td style={td}>{fmtPct(item.finalRaw.exactTempoConfidence)}</td>
                  <td style={td}>{fmtPct(item.finalRaw.phaseCoherenceConfidence)}</td>
                  <td style={td}>{fmtPct(item.finalRaw.gameplayAnchorConfidence)}</td>
                  <td style={td}>{fmtMs(item.finalRaw.robust95EndDriftMs)}</td>
                  <td style={td}>{(item.elapsedMs / 1000).toFixed(1)}s</td>
                </tr>)}</tbody>
              </table>
            </div>
          </section>

          {results.map((item, index) => <TrackResultSection key={item.config.id} item={item} index={index} />)}
        </>}
      </div>
    </main>
  );
}

function TrackResultSection({ item, index }: { item: BatchTrackResult; index: number }) {
  const raw = item.finalRaw;
  const families = Array.isArray(raw.familyEstimates) ? raw.familyEstimates : [];
  const candidates = Array.isArray(raw.candidates) ? raw.candidates : [];
  return <section className="batch-result" style={{ ...card, border: item.status === "DONE" ? "1px solid #5d4569" : "1px solid #78404b" }}>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}>
      <div><div style={eyebrow}>TRACK {index + 1} · {item.status}</div><h2 style={{ margin: "6px 0 2px", fontSize: 27 }}>{item.config.title}</h2>{item.config.artist && <div style={{ color: "#9f95a7" }}>{item.config.artist}</div>}</div>
      <div style={{ textAlign: "right", fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}><strong style={{ fontSize: 26 }}>{item.final?.bpm == null ? "—" : `${item.final.bpm.toFixed(6)} BPM`}</strong><small style={{ display: "block", color: "#9f95a7" }}>FINAL RHYTHM · {item.final?.variant ?? item.error ?? "no result"}</small></div>
    </div>

    {item.status === "ERROR" ? <p style={{ ...muted, color: "#ff9aad" }}>{item.error}</p> : <>
      <div style={{ marginTop: 14, display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(145px,1fr))", gap: 8 }}>
        <Metric label="Saved BPM" value={fmt(item.config.BPM_exact ?? item.config.bpm)} />
        <Metric label="Audio pulse" value={fmt(raw.audioPulseBpm, 6)} />
        <Metric label="Gameplay BPM" value={fmt(raw.gameplayBpm ?? item.final?.bpm, 6)} />
        <Metric label="Nominal candidate" value={fmt(raw.nominalBpmCandidate, 3)} />
        <Metric label="Source speed" value={raw.sourceSpeedStatus ?? "—"} />
        <Metric label="Playback → nominal" value={fmt(raw.playbackRateToNominal, 6)} />
        <Metric label="SPACE anchor" value={`${fmtDuration(raw.gameplayAnchorMs)} · ${raw.gameplayAnchorSource ?? "—"}`} />
        <Metric label="Decoded duration" value={fmtDuration(item.decodedDurationMs)} />
      </div>

      <div style={{ marginTop: 10, display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(145px,1fr))", gap: 8 }}>
        <Metric label="Metrical confidence" value={fmtPct(raw.metricalLevelConfidence)} />
        <Metric label="Exact tempo confidence" value={fmtPct(raw.exactTempoConfidence)} />
        <Metric label="Phase coherence" value={fmtPct(raw.phaseCoherenceConfidence)} />
        <Metric label="Gameplay anchor" value={fmtPct(raw.gameplayAnchorConfidence)} />
        <Metric label="95% BPM envelope" value={raw.robust95FamilySpreadBpm == null ? "—" : `±${raw.robust95FamilySpreadBpm.toFixed(5)}`} />
        <Metric label="95% end drift" value={fmtMs(raw.robust95EndDriftMs)} />
        <Metric label="Nominal end drift" value={fmtMs(raw.endDriftToNominalMs)} />
        <Metric label="Safe integer snap" value={raw.safeIntegerSnap == null ? "—" : raw.safeIntegerSnap ? "YES" : "NO"} />
      </div>

      <div style={{ marginTop: 14, padding: 12, borderRadius: 12, background: "#100d13", border: "1px solid #352d3b" }}>
        <strong>FINAL diagnostic</strong>
        <p style={{ ...muted, fontSize: 12 }}>{item.final?.notes || "No final notes."}</p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))", gap: 10, marginTop: 12 }}>
        <div style={miniCard}><strong>Independent family centers</strong><div style={{ marginTop: 7, display: "grid", gap: 5 }}>{families.length ? families.map((family, familyIndex) => <span key={`${family.family}-${familyIndex}`} style={monoSmall}>{family.family ?? "unknown"}: {fmt(family.bpm, 5)} ±{fmt(family.spreadBpm, 5)} · w={fmt(family.weight, 3)}</span>) : <span style={muted}>—</span>}</div></div>
        <div style={miniCard}><strong>Metrical candidate ranking</strong><div style={{ marginTop: 7, display: "grid", gap: 5 }}>{candidates.slice(0, 5).length ? candidates.slice(0, 5).map((candidate, candidateIndex) => <span key={`${candidate.bpm}-${candidateIndex}`} style={monoSmall}>{fmt(candidate.bpm, 3)} · score {fmt(candidate.score, 3)} · families {candidate.families?.length ?? "—"} · det {fmt(candidate.detectedScore, 2)} · onset {fmt(candidate.onsetScore, 2)} · phase {fmt(candidate.phaseScore, 2)}</span>) : <span style={muted}>—</span>}</div></div>
      </div>

      <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(250px,1fr))", gap: 10 }}>
        <div style={miniCard}><strong>ONSET GRID</strong><div style={monoSmall}>{fmt(item.onset?.bpm, 6)} BPM · {fmtPct(item.onset?.confidence)} · {item.onset?.tempoMode ?? "—"}</div></div>
        <div style={miniCard}><strong>PHASE GRID</strong><div style={monoSmall}>{fmt(item.phase?.bpm, 6)} BPM · {fmtPct(item.phase?.confidence)} · {item.phase?.tempoMode ?? "—"}</div></div>
        <div style={miniCard}><strong>Package consensus</strong><div style={monoSmall}>{item.consensusStatus} · {fmt(item.consensusBpm, 6)} BPM</div><small style={{ display: "block", color: "#817788", marginTop: 5 }}>{item.consensusNote}</small></div>
      </div>

      <div style={{ overflowX: "auto", marginTop: 16 }}>
        <table style={{ width: "100%", minWidth: 1250, borderCollapse: "collapse", fontSize: 12 }}>
          <thead><tr>{["Engine", "BPM", "Conf", "Grid", "Beats", "Median", "Derived", "Jitter", "Mode", "Nearest SPACE", "Anchor Δ", "Runtime"].map(label => <th key={label} style={th}>{label}</th>)}</tr></thead>
          <tbody>{item.analyzers.map(row => <tr key={row.id} style={{ opacity: row.error ? .55 : 1 }}>
            <td style={td}><strong>{row.engine}</strong><small style={{ display: "block", color: "#8d8294" }}>{row.variant}</small>{row.error && <small style={{ display: "block", color: "#ff8da1" }}>{row.error}</small>}</td>
            <td style={td}>{fmt(row.bpm)}</td><td style={td}>{fmtPct(row.confidence)}</td><td style={td}>{row.beatGridKind}</td><td style={td}>{row.beatCount || "—"}</td><td style={td}>{row.medianBeatIntervalMs == null ? "—" : `${row.medianBeatIntervalMs.toFixed(2)}ms`}</td><td style={td}>{fmt(row.derivedBpmFromIntervals)}</td><td style={td}>{row.intervalJitterMs == null ? "—" : `${row.intervalJitterMs.toFixed(1)}ms`}</td><td style={td}>{row.tempoMode}</td><td style={td}>{fmtDuration(row.nearestBeatToSpaceStartMs)}</td><td style={td}>{fmtMs(row.spaceStartDeltaMs)}</td><td style={td}>{row.processingTimeMs.toFixed(0)}ms</td>
          </tr>)}</tbody>
        </table>
      </div>
      <p style={{ ...muted, fontSize: 11, marginTop: 12 }}>{item.succeeded}/{item.total} analyzer variants succeeded · total track analysis {(item.elapsedMs / 1000).toFixed(1)}s. Batch mode stores compact diagnostics only; decoded PCM and full beat arrays are discarded before the next track.</p>
    </>}
  </section>;
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div style={{ padding: 9, borderRadius: 10, background: "#100d13", border: "1px solid #342b3b", minWidth: 0 }}><small style={{ display: "block", color: "#8f8497", marginBottom: 4 }}>{label}</small><strong style={{ display: "block", overflowWrap: "anywhere", fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", fontSize: 13 }}>{value}</strong></div>;
}

const card: React.CSSProperties = { marginTop: 18, padding: 18, borderRadius: 18, background: "#17131b", border: "1px solid #3b3143", boxShadow: "0 18px 50px rgba(0,0,0,.18)" };
const miniCard: React.CSSProperties = { padding: 12, borderRadius: 11, background: "#100d13", border: "1px solid #342b3b", minWidth: 0 };
const eyebrow: React.CSSProperties = { color: "#d35cff", fontSize: 12, fontWeight: 900, letterSpacing: ".14em" };
const muted: React.CSSProperties = { color: "#9f95a7", lineHeight: 1.55, margin: "6px 0" };
const monoSmall: React.CSSProperties = { color: "#cfc4d5", fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", fontSize: 11, lineHeight: 1.45, overflowWrap: "anywhere" };
const primaryButton: React.CSSProperties = { minHeight: 48, padding: "11px 14px", borderRadius: 12, border: "1px solid #ec88ff", background: "linear-gradient(135deg,#c62af0,#7138df)", color: "white", fontWeight: 900, fontSize: 13 };
const secondaryButton: React.CSSProperties = { minHeight: 44, padding: "9px 13px", borderRadius: 12, border: "1px solid #504457", background: "#19151d", color: "white", fontWeight: 800, fontSize: 12 };
const dangerButton: React.CSSProperties = { ...secondaryButton, border: "1px solid #a34d5c", background: "#32161d", color: "#ffb5c0" };
const th: React.CSSProperties = { textAlign: "left", color: "#9f95a7", borderBottom: "1px solid #403648", padding: "8px 7px", whiteSpace: "nowrap" };
const td: React.CSSProperties = { borderBottom: "1px solid #29222f", padding: "9px 7px", verticalAlign: "top", whiteSpace: "nowrap", fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" };
