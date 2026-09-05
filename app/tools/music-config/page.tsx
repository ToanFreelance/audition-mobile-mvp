"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import AuditionGauge from "../../../components/AuditionGauge";
import WaveformPlayer, { type WaveformMarker, type WaveformPlayerHandle } from "../../../components/WaveformPlayer";
import { DEFAULT_MUSIC_CONFIG, type MusicConfig } from "../../../game/music-config";
import { analyzeTempo, type TempoAnalysis } from "../../../game/tempo-analysis";
import "./music-config.css";
import "./music-config-overrides.css";

type Theme = "dark" | "light";
type AudioAsset = { path: string; name: string; url: string; size?: number; updatedAt?: string };
type LibraryResponse = { configs: MusicConfig[]; storage: AudioAsset[] };
type MusicConfigApiResponse = { config?: MusicConfig; error?: string; detail?: string };

const cloneDefault = (overrides: Partial<MusicConfig> = {}): MusicConfig => ({ ...DEFAULT_MUSIC_CONFIG, BPM_exact: DEFAULT_MUSIC_CONFIG.BPM_exact, ...overrides });
const formatTime = (ms: number, precision = 3) => { const totalSeconds = Math.max(0, ms) / 1000; const minutes = Math.floor(totalSeconds / 60); const seconds = totalSeconds - minutes * 60; return `${minutes}:${seconds.toFixed(precision).padStart(precision === 0 ? 2 : precision + 3, "0")}`; };
const makeId = () => typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `chart-${Date.now()}`;

export default function MusicConfigPage() {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const waveformRef = useRef<WaveformPlayerHandle | null>(null);
  const audioDockRef = useRef<HTMLDivElement | null>(null);
  const stickyActionsRef = useRef<HTMLElement | null>(null);
  const [config, setConfig] = useState<MusicConfig>(cloneDefault);
  const [library, setLibrary] = useState<MusicConfig[]>([]);
  const [storageFiles, setStorageFiles] = useState<AudioAsset[]>([]);
  const [analysis, setAnalysis] = useState<TempoAnalysis | null>(null);
  const [selectedAnchorMs, setSelectedAnchorMs] = useState<number | null>(null);
  const [usedAnchorMs, setUsedAnchorMs] = useState<number | null>(DEFAULT_MUSIC_CONFIG.spaceStartMs);
  const [currentTimeMs, setCurrentTimeMs] = useState(0);
  const [audioDurationMs, setAudioDurationMs] = useState(0);
  const [loading, setLoading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [dockExpanded, setDockExpanded] = useState(true);
  const [theme, setTheme] = useState<Theme>("dark");
  const [addOpen, setAddOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [assetSearch, setAssetSearch] = useState("");
  const [fixedStackHeight, setFixedStackHeight] = useState(0);
  const [previewingAnchorMs, setPreviewingAnchorMs] = useState<number | null>(null);

  const patch = useCallback(<K extends keyof MusicConfig>(key: K, value: MusicConfig[K]) => { setConfig(current => ({ ...current, [key]: value })); }, []);

  const fetchLibraries = useCallback(async (): Promise<LibraryResponse> => {
    const [configsResponse, storageResponse] = await Promise.all([fetch("/api/music-config", { cache: "no-store" }), fetch("/api/music-library", { cache: "no-store" })]);
    const configsJson = await configsResponse.json().catch(() => ({}));
    const storageJson = await storageResponse.json().catch(() => ({}));
    if (!configsResponse.ok) throw new Error(configsJson.detail || configsJson.error || `Music config HTTP ${configsResponse.status}`);
    if (!storageResponse.ok) throw new Error(storageJson.detail || storageJson.error || `Music library HTTP ${storageResponse.status}`);
    return { configs: Array.isArray(configsJson) ? configsJson : configsJson.configs ?? [], storage: Array.isArray(storageJson.files) ? storageJson.files.map((item: { name?: string; publicUrl?: string; url?: string; updatedAt?: string; size?: number }) => ({ path: item.name ?? "", name: item.name ?? "", url: item.publicUrl ?? item.url ?? "", updatedAt: item.updatedAt, size: item.size })) : [] };
  }, []);

  const loadConfig = useCallback((nextConfig: MusicConfig) => {
    setConfig({ ...nextConfig });
    setAnalysis(null);
    setSelectedAnchorMs(nextConfig.spaceStartMs ?? null);
    setUsedAnchorMs(nextConfig.spaceStartMs ?? null);
    setCurrentTimeMs(0);
    setAudioDurationMs(nextConfig.durationMs || 0);
    setPreviewingAnchorMs(null);
  }, []);

  const refresh = useCallback(async () => { const data = await fetchLibraries(); setLibrary(data.configs); setStorageFiles(data.storage); return data; }, [fetchLibraries]);

  useEffect(() => { let cancelled = false; setLoading(true); refresh().then(data => { if (!cancelled && data.configs.length) loadConfig(data.configs[0]); }).catch(error => { if (!cancelled) setMessage(`Load failed: ${error instanceof Error ? error.message : "unknown error"}`); }).finally(() => { if (!cancelled) setLoading(false); }); return () => { cancelled = true; }; }, [refresh, loadConfig]);
  useEffect(() => { const storedTheme = window.localStorage.getItem("audition-music-config-theme"); if (storedTheme === "light" || storedTheme === "dark") setTheme(storedTheme); }, []);
  useEffect(() => { window.localStorage.setItem("audition-music-config-theme", theme); }, [theme]);
  useEffect(() => {
    const dock = audioDockRef.current, sticky = stickyActionsRef.current;
    if (!dock || !sticky) return;
    const measure = () => { if (window.innerWidth > 760) { setFixedStackHeight(0); return; } setFixedStackHeight(Math.ceil(dock.getBoundingClientRect().height + sticky.getBoundingClientRect().height + 16)); };
    measure(); const observer = new ResizeObserver(measure); observer.observe(dock); observer.observe(sticky); window.addEventListener("resize", measure);
    return () => { observer.disconnect(); window.removeEventListener("resize", measure); };
  }, [dockExpanded, config.audioUrl, analysis, theme, previewingAnchorMs, currentTimeMs]);

  const handleWaveTime = useCallback((ms: number) => setCurrentTimeMs(ms), []);
  const handleWaveDuration = useCallback((ms: number) => { setAudioDurationMs(ms); patch("durationMs", ms); }, [patch]);

  const chooseAsset = useCallback((asset: AudioAsset) => { const title = asset.name.replace(/\.[^/.]+$/, ""); loadConfig(cloneDefault({ id: makeId(), title, audioUrl: asset.url, durationMs: 0 })); setAddOpen(false); setMessage(`Selected ${asset.name}. Analyze the audio, then save the chart.`); }, [loadConfig]);

  const uploadFile = async (file?: File) => {
    if (!file) return; setUploading(true); setMessage(`Uploading ${file.name}…`);
    try { const form = new FormData(); form.append("file", file); const response = await fetch("/api/music-library", { method: "POST", body: form }); const data = await response.json().catch(() => ({})) as { publicUrl?: string; name?: string; error?: string; detail?: string }; if (!response.ok || !data.publicUrl) throw new Error(data.detail || data.error || `Upload HTTP ${response.status}`); const asset: AudioAsset = { path: data.name ?? file.name, name: data.name ?? file.name, url: data.publicUrl, size: file.size }; setStorageFiles(current => [asset, ...current.filter(item => item.path !== asset.path)]); chooseAsset(asset); setMessage(`Uploaded ${file.name}. Analyze the audio, then save the chart.`); }
    catch (error) { setMessage(`Upload failed: ${error instanceof Error ? error.message : "unknown error"}`); }
    finally { setUploading(false); }
  };

  const analyze = async () => {
    if (!config.audioUrl || analyzing || analysis) return; setAnalyzing(true); setMessage("Analyzing tempo, audio start and beat positions…");
    try { const result = await analyzeTempo(config.audioUrl); setAnalysis(result); patch("bpm", result.displayBpm); patch("BPM_exact", result.bpmExact); const firstAnchor = config.spaceStartMs ?? (result.beats[0] !== undefined ? Math.round(result.beats[0] * 1000) : 0); setSelectedAnchorMs(firstAnchor); setUsedAnchorMs(config.spaceStartMs ?? null); setMessage(`Detected ${result.bpmExact.toFixed(4)} BPM · audible begin ${formatTime(result.audioStartMs, 3)}.`); }
    catch (error) { setMessage(`Analysis failed: ${error instanceof Error ? error.message : "unknown error"}`); }
    finally { setAnalyzing(false); }
  };

  const anchors = useMemo<WaveformMarker[]>(() => !analysis?.beats?.length ? [] : analysis.beats.map((seconds, index) => ({ ms: Math.round(seconds * 1000), beatIndex: index + 1 })).filter(anchor => anchor.beatIndex % 4 === 0).slice(0, 32), [analysis]);

  const selectAnchor = (anchor: WaveformMarker) => { setSelectedAnchorMs(anchor.ms); setUsedAnchorMs(null); setPreviewingAnchorMs(null); setMessage(`Selected Beat ${anchor.beatIndex} at ${formatTime(anchor.ms, 3)}. Tap USE ANCHOR to apply.`); };

  const useAnchor = () => {
    const anchor = anchors.find(item => item.ms === selectedAnchorMs) ?? anchors[0];
    if (!anchor) { setMessage("Run analysis and select an anchor first."); return; }
    patch("spaceStartMs", anchor.ms); patch("spaceStartBeat", anchor.beatIndex); setSelectedAnchorMs(anchor.ms); setUsedAnchorMs(anchor.ms); setPreviewingAnchorMs(null); waveformRef.current?.seekTo(anchor.ms); setCurrentTimeMs(anchor.ms); setMessage(`✓ Anchor applied: Beat ${anchor.beatIndex} at ${formatTime(anchor.ms, 3)}. This is now the Space Start reference.`);
  };

  const previewAnchor = (anchor: WaveformMarker) => { setSelectedAnchorMs(anchor.ms); setUsedAnchorMs(null); setPreviewingAnchorMs(anchor.ms); waveformRef.current?.previewFrom(Math.max(0, anchor.ms - 5000)); setMessage(`Previewing 5s before Beat ${anchor.beatIndex}. Listen, then use current position or this anchor.`); };

  const deleteChart = async () => {
    if (!config.id || !library.some(item => item.id === config.id)) return; if (!window.confirm(`Delete chart “${config.title}”? The audio asset will remain in Storage.`)) return; setSaving(true); setMessage("Deleting chart…");
    try { const response = await fetch(`/api/music-config?id=${encodeURIComponent(config.id)}`, { method: "DELETE" }); const data = await response.json().catch(() => ({})) as { error?: string; detail?: string }; if (!response.ok) throw new Error(data.detail || data.error || `HTTP ${response.status}`); const refreshed = await refresh(); loadConfig(refreshed.configs[0] ?? cloneDefault({ id: makeId() })); setMessage("Deleted chart. Audio asset retained."); }
    catch (error) { setMessage(`Delete failed: ${error instanceof Error ? error.message : "unknown error"}`); }
    finally { setSaving(false); }
  };

  const save = async () => {
    const exactBpm = config.BPM_exact; if (!config.audioUrl || !config.title.trim()) { setMessage("Title and audio are required."); return; } if (typeof exactBpm !== "number" || !Number.isFinite(exactBpm) || exactBpm <= 0) { setMessage("Run ANALYZE AUDIO before saving."); return; } if (saving) return; setSaving(true); setMessage("Saving chart configuration…");
    try { const payload = { ...config, bpm: Math.round(config.bpm), BPM_exact: Number(exactBpm.toFixed(4)), durationMs: audioDurationMs || config.durationMs }; const response = await fetch("/api/music-config", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) }); const data = await response.json().catch(() => ({})) as MusicConfigApiResponse; if (!response.ok) throw new Error(data.detail || data.error || `HTTP ${response.status}`); const refreshed = await refresh(); if (data.config) loadConfig(data.config); else if (refreshed.configs.length) loadConfig(refreshed.configs[0]); setMessage("Chart saved to DB."); }
    catch (error) { setMessage(`Save failed: ${error instanceof Error ? error.message : "unknown error"}`); }
    finally { setSaving(false); }
  };

  const exactBpm = config.BPM_exact;
  const timingBpm = typeof exactBpm === "number" && Number.isFinite(exactBpm) && exactBpm > 0 ? exactBpm : config.bpm;
  const isExistingChart = Boolean(config.id && library.some(item => item.id === config.id));
  const filteredAssets = useMemo(() => { const query = assetSearch.trim().toLowerCase(); return query ? storageFiles.filter(file => file.name.toLowerCase().includes(query)) : storageFiles; }, [assetSearch, storageFiles]);
  const pageStyle = { "--fixed-stack-reserve": `${fixedStackHeight}px` } as CSSProperties;
  const analyzeDisabled = loading || analyzing || Boolean(analysis) || !config.audioUrl;
  const analyzeLabel = analyzing ? "WORKING…" : analysis ? "ANALYZED" : "ANALYZE AUDIO";
  const anchorApplied = selectedAnchorMs != null && usedAnchorMs === selectedAnchorMs;

  return <main className={`music-config-page theme-${theme} ${dockExpanded ? "audio-dock-expanded" : "audio-dock-collapsed"}`} style={pageStyle}>
    <input ref={fileInputRef} className="visually-hidden-file-input" type="file" accept="audio/*,.mp3,.wav,.m4a,.ogg,.aac,.flac" onChange={event => { void uploadFile(event.target.files?.[0]); event.currentTarget.value = ""; }} />
    <header className="config-header"><div><span className="eyebrow">CLUB AUDITION / CHART STUDIO</span><h1>Music Chart Studio</h1><p>Detect BPM, listen for the Beat-4 you want, and capture Space Start.</p></div><div className="header-actions"><button className="button theme-toggle" onClick={() => setTheme(current => current === "dark" ? "light" : "dark")} type="button">{theme === "dark" ? "☀ LIGHT" : "☾ DARK"}</button></div></header>

    <section className="charts-card section-card"><div className="section-heading"><div><span className="eyebrow">MUSIC CHARTS</span><h2>Chart library</h2></div><div className="chart-library-actions"><span className="count-badge">{library.length}</span><button className="button button-primary" onClick={() => setAddOpen(true)} type="button">＋ ADD / CHANGE AUDIO</button></div></div><div className="chart-list">{library.map(track => <button key={track.id} className={`chart-row ${track.id === config.id ? "is-active" : ""}`} onClick={() => loadConfig(track)} type="button"><span className="chart-art" aria-hidden="true">♫</span><span className="chart-copy"><strong>{track.title}</strong><small>{track.artist || "Unknown artist"} · {track.bpm || "—"} BPM · {typeof track.BPM_exact === "number" ? `${track.BPM_exact.toFixed(2)} exact` : "needs analysis"}</small></span><span className="chart-file">{storageFiles.find(asset => asset.url === track.audioUrl)?.name || "audio asset"}</span><span className="chart-arrow" aria-hidden="true">›</span></button>)}{!library.length && <div className="empty-chart-state"><strong>No charts yet</strong><span>Choose an audio asset and create your first chart.</span><button className="button button-primary" onClick={() => setAddOpen(true)} type="button">＋ CREATE FIRST CHART</button></div>}</div></section>

    <section className="editor-grid"><div className="editor-main">
      <section className="section-card editor-intro"><div><span className="eyebrow">CHART EDITOR</span><h2>{config.title || "Untitled track"}</h2><p>{config.artist || "Add artist information in Chart Details."}</p></div><div className="editor-status-actions"><button className="button button-primary editor-analyze-button" disabled={analyzeDisabled} onClick={() => void analyze()} type="button">{analyzeLabel}</button></div></section>
      <section className="section-card tempo-card"><div className="section-heading"><div><span className="eyebrow">TEMPO</span><h2>Detected timing</h2></div><div className="tempo-summary"><strong>{config.bpm || "—"}</strong><span>display BPM</span><small>{typeof exactBpm === "number" ? exactBpm.toFixed(4) : "—"} exact</small></div></div>{analysis ? <><p className="hint">Analysis start: {formatTime(analysis.audioStartMs, 3)} · playback trim is detected separately from the waveform onset.</p><div className="candidate-list">{analysis.candidates.map((candidate, index) => <button className={`candidate-row ${Math.abs(candidate.bpm - timingBpm) < 0.02 && candidate.source === "tempo" ? "is-selected" : ""}`} key={`${candidate.source}-${candidate.bpm}-${index}`} onClick={() => { patch("bpm", Math.round(candidate.bpm)); patch("BPM_exact", Number(candidate.bpm.toFixed(4))); }} type="button"><span><strong>{candidate.bpm.toFixed(2)}</strong> BPM</span><small>{candidate.source} · confidence {(candidate.confidence * 100).toFixed(0)}%</small></button>)}</div></> : <p className="hint">Run ANALYZE AUDIO to build the BPM grid and candidate Beat-4 anchors.</p>}</section>
      <section className="section-card anchor-card"><div className="section-heading"><div><span className="eyebrow">PHASE</span><h2>4-beat Space Start</h2></div><span className="mono-value">{formatTime(config.spaceStartMs, 3)}</span></div><div className="anchor-editor"><div className="anchor-current"><span>Selected anchor</span><strong>{selectedAnchorMs != null ? formatTime(selectedAnchorMs, 3) : "—"}</strong><small>{anchorApplied ? `✓ Applied${config.spaceStartBeat != null ? ` · Beat ${config.spaceStartBeat}` : ""}` : "Not applied yet"}</small></div><div className="anchor-actions"><button className={`button ${previewingAnchorMs === selectedAnchorMs ? "is-previewing" : ""}`} onClick={() => { const anchor = anchors.find(item => item.ms === selectedAnchorMs) ?? anchors[0]; if (anchor) previewAnchor(anchor); else setMessage("Run analysis and select an anchor first."); }} type="button">{previewingAnchorMs === selectedAnchorMs ? "▶ PREVIEWING…" : "▶ PREVIEW −5s"}</button><button className={`button button-primary ${anchorApplied ? "is-used" : ""}`} onClick={useAnchor} type="button">{anchorApplied ? "✓ ANCHOR USED" : "USE ANCHOR"}</button></div></div>{anchors.length > 0 && <div className="anchor-strip">{anchors.map(anchor => <button key={`${anchor.beatIndex}-${anchor.ms}`} className={anchor.ms === selectedAnchorMs ? "is-selected" : ""} onClick={() => selectAnchor(anchor)} type="button"><strong>{anchor.beatIndex}</strong><small>{formatTime(anchor.ms, 2)}</small></button>)}</div>}</section>
      <section className="section-card advanced-card"><div className="section-heading"><div><span className="eyebrow">CONFIG</span><h2>Chart details</h2></div></div><div className="form-grid"><label><span>Title</span><input value={config.title} onChange={event => patch("title", event.target.value)} /></label><label><span>Artist</span><input value={config.artist ?? ""} onChange={event => patch("artist", event.target.value)} /></label><label><span>Display BPM</span><input type="number" min={40} max={220} value={config.bpm} onChange={event => patch("bpm", Number(event.target.value) || 0)} /></label><label><span>BPM exact</span><input value={typeof exactBpm === "number" ? exactBpm.toFixed(4) : "—"} readOnly /></label><label className="form-span-2"><span>Audio asset</span><input value={storageFiles.find(asset => asset.url === config.audioUrl)?.name || config.audioUrl} readOnly /></label></div></section>
    </div></section>

    <div ref={audioDockRef} className={`audio-dock ${dockExpanded ? "is-expanded" : "is-collapsed"}`}><div className="audio-dock-inner"><div className="audio-dock-topline"><span className="audio-dock-title">AUDIO WORKSTATION</span><button className="audio-dock-toggle" onClick={() => setDockExpanded(current => !current)} type="button" aria-label={dockExpanded ? "Collapse audio workstation" : "Expand audio workstation"}>{dockExpanded ? "−" : "＋"}</button></div>{config.audioUrl && <div className="audio-dock-live-time"><strong>{formatTime(currentTimeMs, 3)}</strong><span>/ {formatTime(audioDurationMs, 3)}</span></div>}{config.audioUrl ? <WaveformPlayer ref={waveformRef} url={config.audioUrl} title={config.title} markers={anchors} selectedMarkerMs={selectedAnchorMs} onTimeChange={handleWaveTime} onDurationChange={handleWaveDuration} onPause={() => setPreviewingAnchorMs(null)} /> : <div className="dock-empty">Choose an audio asset to open the waveform player.</div>}{dockExpanded && config.audioUrl && <div className="dock-gauge"><div className="dock-gauge-head"><span>GAUGE CHECK</span><small>{timingBpm.toFixed(4)} BPM · Space Start {formatTime(config.spaceStartMs, 3)}</small></div><div className="gauge-shell"><AuditionGauge bpm={timingBpm} spaceStartMs={config.spaceStartMs} currentTimeMs={currentTimeMs} /></div></div>}</div></div>

    <footer ref={stickyActionsRef} className="sticky-actions"><div className="sticky-status"><strong>{config.title || "Untitled track"}</strong><span>{message || "Listen for Beat-4, then USE CURRENT. If analysis exists, capture snaps to the nearest Beat-4."}</span></div><div className="sticky-action-group"><button className="button button-primary sticky-use-current" onClick={() => { const liveMs = waveformRef.current?.getCurrentTimeMs() ?? currentTimeMs; const rawMs = Math.max(0, Math.min(audioDurationMs, Math.round(liveMs))); const nearestAnchor = anchors.length ? anchors.reduce((best, anchor) => Math.abs(anchor.ms - rawMs) < Math.abs(best.ms - rawMs) ? anchor : best, anchors[0]) : undefined; const ms = nearestAnchor ? nearestAnchor.ms : rawMs; patch("spaceStartMs", ms); if (nearestAnchor) patch("spaceStartBeat", nearestAnchor.beatIndex); setSelectedAnchorMs(ms); setUsedAnchorMs(ms); setPreviewingAnchorMs(null); if (nearestAnchor) { waveformRef.current?.seekTo(ms); setCurrentTimeMs(ms); const delta = nearestAnchor.ms - rawMs; setMessage(`✓ Heard ${formatTime(rawMs, 3)} → snapped ${delta >= 0 ? "+" : ""}${delta}ms to nearest Beat-4 (Beat ${nearestAnchor.beatIndex}): ${formatTime(ms, 3)}.`); } else { setMessage(`✓ Current position applied as Space Start: ${formatTime(ms, 3)}. Run analysis to enable Beat-4 snapping.`); } }} type="button">USE CURRENT</button>{isExistingChart && <button className="button button-danger" disabled={saving} onClick={() => void deleteChart()} type="button">DELETE</button>}<button className="button" disabled={saving} onClick={() => { loadConfig(cloneDefault({ id: makeId() })); setMessage("New chart draft."); }} type="button">RESET</button><button className="button button-primary save-button" disabled={saving || !config.audioUrl || !config.title.trim() || typeof exactBpm !== "number" || !Number.isFinite(exactBpm) || exactBpm <= 0} onClick={() => void save()} type="button">{saving ? "SAVING…" : "SAVE CHART"}</button></div></footer>

    {addOpen && <div className="modal-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) setAddOpen(false); }}><section className="asset-modal" role="dialog" aria-modal="true" aria-labelledby="asset-modal-title"><div className="modal-head"><div><span className="eyebrow">NEW CHART</span><h2 id="asset-modal-title">Choose audio</h2><p>Use an existing asset or upload a new track.</p></div><button className="modal-close" onClick={() => setAddOpen(false)} type="button" aria-label="Close">×</button></div><button className="upload-dropzone" disabled={uploading} onClick={() => fileInputRef.current?.click()} type="button"><span className="upload-icon">↑</span><strong>{uploading ? "UPLOADING…" : "UPLOAD AUDIO"}</strong><small>MP3, WAV, M4A, OGG, AAC, FLAC</small></button><div className="asset-divider"><span>EXISTING AUDIO ASSETS</span></div><label className="asset-search"><span>⌕</span><input value={assetSearch} onChange={event => setAssetSearch(event.target.value)} placeholder="Search audio…" /></label><div className="asset-list">{filteredAssets.map(asset => <button className="asset-row" key={asset.path} onClick={() => chooseAsset(asset)} type="button"><span className="asset-icon">♫</span><span><strong>{asset.name}</strong><small>{asset.size ? `${Math.round(asset.size / 1024 / 1024)} MB` : "Audio asset"}</small></span><span className="asset-arrow">›</span></button>)}{!filteredAssets.length && <p className="empty-state">No audio assets found.</p>}</div></section></div>}
  </main>;
}
