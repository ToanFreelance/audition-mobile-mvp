"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { DEFAULT_MUSIC_CONFIG, type MusicConfig } from "../../../game/music-config";
import { getGaugeTiming } from "../../../game/gauge-timing";
import { analyzeTempo, type TempoAnalysis } from "../../../game/tempo-analysis";
import AuditionGauge from "../../../components/AuditionGauge";
import "./music-config.css";

type StorageAudioFile = {
  name: string;
  publicUrl: string;
  updatedAt: string | null;
  size: number | null;
  mimeType: string | null;
};

type SaveDialog = { title: string; message: string; audioUrl: string };

const SUPABASE_BUCKET = "audio";
const AUDIO_EXTENSIONS = new Set(["mp3", "wav", "m4a", "ogg", "aac", "flac"]);
const MAX_UPLOAD_BYTES = 100 * 1024 * 1024;

function cloneDefault(): MusicConfig {
  return JSON.parse(JSON.stringify(DEFAULT_MUSIC_CONFIG)) as MusicConfig;
}
function formatTime(ms: number) {
  const value = Math.max(0, Math.round(ms));
  const m = Math.floor(value / 60000);
  const s = Math.floor((value % 60000) / 1000);
  const milli = value % 1000;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}.${String(milli).padStart(3, "0")}`;
}
function slugFromAudio(name: string) {
  return name.replace(/\.[^.]+$/, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}
function titleFromAudio(name: string) {
  const base = name.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ").replace(/\b\d+(?:\.\d+)?\s*bpm\b/gi, "").replace(/\s+/g, " ").trim();
  return base.replace(/\b\w/g, letter => letter.toUpperCase()) || "New Song";
}
function formatBytes(bytes: number | null) {
  if (bytes == null) return "";
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
function publicStorageUrl(baseUrl: string, path: string) {
  const encodedPath = path.split("/").map(segment => encodeURIComponent(segment)).join("/");
  return `${baseUrl}/storage/v1/object/public/${SUPABASE_BUCKET}/${encodedPath}`;
}

async function fetchLibraries() {
  const [configResult, storageResult] = await Promise.allSettled([
    fetch("/api/music-config", { cache: "no-store" }),
    fetch("/api/music-library", { cache: "no-store" }),
  ]);
  let configs: MusicConfig[] = [];
  let storage: StorageAudioFile[] = [];
  if (configResult.status === "fulfilled" && configResult.value.ok) {
    const data = await configResult.value.json() as { configs?: MusicConfig[] };
    configs = data.configs ?? [];
  }
  if (storageResult.status === "fulfilled" && storageResult.value.ok) {
    const data = await storageResult.value.json() as { files?: StorageAudioFile[] };
    storage = data.files ?? [];
  }
  return { configs, storage };
}

async function uploadLocalAudio(file: File) {
  const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!baseUrl || !key) throw new Error("Thiếu cấu hình Supabase.");
  const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
  if (!AUDIO_EXTENSIONS.has(extension)) throw new Error("Định dạng audio chưa được hỗ trợ.");
  if (file.size > MAX_UPLOAD_BYTES) throw new Error("Audio vượt quá 100 MB.");

  const safeBase = file.name.replace(/\.[^.]+$/, "").normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9_-]+/g, "-").replace(/^-|-$/g, "").toLowerCase() || "audio";
  const objectPath = `${safeBase}.${extension}`;
  const uploadUrl = `${baseUrl}/storage/v1/object/${SUPABASE_BUCKET}/${objectPath.split("/").map(segment => encodeURIComponent(segment)).join("/")}`;
  const response = await fetch(uploadUrl, {
    method: "POST",
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": file.type || "application/octet-stream",
      "x-upsert": "false",
      "cache-control": "3600",
    },
    body: file,
  });
  if (!response.ok) {
    const detail = await response.text();
    if (response.status === 409) throw new Error(`File "${objectPath}" đã tồn tại.`);
    throw new Error(detail || `Upload failed (${response.status})`);
  }
  return publicStorageUrl(baseUrl, objectPath);
}

export default function MusicConfigPage() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const localPreviewRef = useRef<string | null>(null);
  const analysisIdRef = useRef(0);
  const previewEndRef = useRef<number | null>(null);

  const [config, setConfig] = useState<MusicConfig>(() => cloneDefault());
  const [library, setLibrary] = useState<MusicConfig[]>([]);
  const [storageFiles, setStorageFiles] = useState<StorageAudioFile[]>([]);
  const [localFile, setLocalFile] = useState<File | null>(null);
  const [currentMs, setCurrentMs] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [analysis, setAnalysis] = useState<TempoAnalysis | null>(null);
  const [selectedCandidate, setSelectedCandidate] = useState<number | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [saveDialog, setSaveDialog] = useState<SaveDialog | null>(null);

  const refresh = async () => {
    const result = await fetchLibraries();
    setLibrary(result.configs);
    setStorageFiles(result.storage);
    return result;
  };

  useEffect(() => {
    let cancelled = false;
    void fetchLibraries().then(result => {
      if (cancelled) return;
      setLibrary(result.configs);
      setStorageFiles(result.storage);
      const selected = result.configs.find(item => item.id === DEFAULT_MUSIC_CONFIG.id) ?? result.configs[0];
      if (selected) setConfig(selected);
    });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    const preventPinch = (event: Event) => event.preventDefault();
    const preventMultiTouch = (event: TouchEvent) => { if (event.touches.length > 1) event.preventDefault(); };
    const preventCtrlWheelZoom = (event: WheelEvent) => { if (event.ctrlKey) event.preventDefault(); };
    document.addEventListener("gesturestart", preventPinch, { passive: false });
    document.addEventListener("gesturechange", preventPinch, { passive: false });
    document.addEventListener("gestureend", preventPinch, { passive: false });
    document.addEventListener("touchmove", preventMultiTouch, { passive: false });
    document.addEventListener("wheel", preventCtrlWheelZoom, { passive: false });
    return () => {
      document.removeEventListener("gesturestart", preventPinch);
      document.removeEventListener("gesturechange", preventPinch);
      document.removeEventListener("gestureend", preventPinch);
      document.removeEventListener("touchmove", preventMultiTouch);
      document.removeEventListener("wheel", preventCtrlWheelZoom);
    };
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => {
      const audio = audioRef.current;
      if (audio) setCurrentMs(audio.currentTime * 1000);
    }, 30);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => () => {
    if (localPreviewRef.current) URL.revokeObjectURL(localPreviewRef.current);
  }, []);

  const timingBpm = Number(config.BPM_exact ?? config.bpm ?? 80);
  const perfectCenter = (config.gauge.perfectStartPercent + config.gauge.perfectEndPercent) / 2;
  const previewCycleMs = (60000 / Math.max(1, timingBpm)) * config.gauge.beatsPerCycle;
  const previewGauge = useMemo(() => {
    if (!previewCycleMs) return perfectCenter;
    const raw = perfectCenter + ((currentMs - config.spaceStartMs) / previewCycleMs) * 100;
    return ((raw % 100) + 100) % 100;
  }, [currentMs, config.spaceStartMs, perfectCenter, previewCycleMs]);
  const previewAnimationDelayMs = useMemo(() => getGaugeTiming({
    bpm: timingBpm,
    beatsPerCycle: config.gauge.beatsPerCycle,
    spaceStartMs: config.spaceStartMs,
    perfectCenterPercent: perfectCenter,
  }, 0).breathAnimationDelayMs, [config.gauge.beatsPerCycle, config.spaceStartMs, perfectCenter, timingBpm]);

  const patch = <K extends keyof MusicConfig>(key: K, value: MusicConfig[K]) =>
    setConfig(prev => ({ ...prev, [key]: value, updatedAt: new Date().toISOString() }));

  const resetAudioState = () => {
    previewEndRef.current = null;
    window.setTimeout(() => {
      const audio = audioRef.current;
      if (audio) { audio.pause(); audio.currentTime = 0; audio.load(); }
      setCurrentMs(0);
      setPlaying(false);
    }, 0);
  };

  const chooseTrack = (track: MusicConfig) => {
    setLocalFile(null);
    setAnalysis(null);
    setSelectedCandidate(null);
    setConfig(track);
    resetAudioState();
    setMessage(`Đã chọn ${track.title}.`);
  };

  const chooseStorageFile = (file: StorageAudioFile) => {
    const existing = library.find(track => track.audioUrl === file.publicUrl);
    if (existing) { chooseTrack(existing); return; }
    const next = cloneDefault();
    next.id = slugFromAudio(file.name) || `track-${Date.now()}`;
    next.title = titleFromAudio(file.name);
    next.audioUrl = file.publicUrl;
    next.bpm = 0;
    next.BPM_exact = undefined;
    next.durationMs = 0;
    setLocalFile(null);
    setAnalysis(null);
    setSelectedCandidate(null);
    setConfig(next);
    resetAudioState();
    setMessage(`${file.name} chưa có chart. Phân tích audio để tạo tempo và beat grid.`);
  };

  const chooseLocalFile = (file: File | undefined) => {
    if (!file) return;
    const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
    if (!file.type.startsWith("audio/") && !AUDIO_EXTENSIONS.has(extension)) { setMessage("File không phải audio được hỗ trợ."); return; }
    if (file.size > MAX_UPLOAD_BYTES) { setMessage("Audio vượt quá 100 MB."); return; }
    if (localPreviewRef.current) URL.revokeObjectURL(localPreviewRef.current);
    const previewUrl = URL.createObjectURL(file);
    localPreviewRef.current = previewUrl;
    const next = cloneDefault();
    next.id = `${slugFromAudio(file.name) || "track"}-${Date.now()}`;
    next.title = titleFromAudio(file.name);
    next.audioUrl = previewUrl;
    next.bpm = 0;
    next.BPM_exact = undefined;
    next.durationMs = 0;
    setLocalFile(file);
    setAnalysis(null);
    setSelectedCandidate(null);
    setConfig(next);
    resetAudioState();
    setMessage(`Đã chọn ${file.name}. Nhấn ANALYZE AUDIO.`);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const togglePlay = async () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) await audio.play(); else audio.pause();
  };

  const seek = (ms: number) => {
    previewEndRef.current = null;
    const max = Math.max(config.durationMs, 1);
    const safe = Math.max(0, Math.min(Math.round(ms), max));
    if (audioRef.current) audioRef.current.currentTime = safe / 1000;
    setCurrentMs(safe);
  };

  const previewAnchor = async (anchorMs: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    previewEndRef.current = anchorMs;
    audio.currentTime = Math.max(0, anchorMs - 5000) / 1000;
    setCurrentMs(Math.max(0, anchorMs - 5000));
    await audio.play();
  };

  const selectAnchor = (anchorMs: number) => {
    patch("spaceStartMs", anchorMs);
    setSelectedCandidate(anchorMs);
    seek(anchorMs);
    setMessage(`Space Start = ${formatTime(anchorMs)}. Slider đã về Perfect.`);
  };

  const analyzeAudio = async (): Promise<TempoAnalysis> => {
    if (!config.audioUrl) throw new Error("Chưa có audio.");
    const requestId = ++analysisIdRef.current;
    setAnalyzing(true);
    setMessage("Đang phân tích tempo + beat grid trên thiết bị…");
    try {
      const result = await analyzeTempo(config.audioUrl);
      if (requestId !== analysisIdRef.current) throw new Error("Track đã thay đổi trong lúc phân tích.");
      setAnalysis(result);
      setConfig(prev => ({ ...prev, bpm: result.displayBpm, BPM_exact: result.bpmExact, updatedAt: new Date().toISOString() }));
      setMessage(`Detected ${result.bpmExact.toFixed(4)} BPM.`);
      return result;
    } finally {
      if (requestId === analysisIdRef.current) setAnalyzing(false);
    }
  };

  const anchors = useMemo(() => {
    if (!analysis?.beats?.length) return [];
    const result: number[] = [];
    for (let index = 0; index < analysis.beats.length; index += 4) {
      const ms = Math.round(analysis.beats[index] * 1000);
      if (ms > 0 && (!config.durationMs || ms < config.durationMs)) result.push(ms);
    }
    return result.slice(0, 48);
  }, [analysis?.beats, config.durationMs]);

  const save = async () => {
    if (saving) return;
    setSaving(true);
    try {
      let latest = { ...config };
      if (!Number.isFinite(latest.BPM_exact) || (latest.BPM_exact ?? 0) <= 0) {
        const result = await analyzeAudio();
        latest = { ...latest, bpm: result.displayBpm, BPM_exact: result.bpmExact };
      }

      let audioUrl = latest.audioUrl;
      let uploaded = false;
      if (localFile) {
        setMessage(`Đang upload ${localFile.name}…`);
        audioUrl = await uploadLocalAudio(localFile);
        uploaded = true;
      }

      latest = { ...latest, audioUrl, updatedAt: new Date().toISOString() };
      const response = await fetch("/api/music-config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(latest),
      });
      const data = await response.json().catch(() => ({})) as { error?: string; detail?: string; config?: MusicConfig };
      if (!response.ok) throw new Error(data.detail || data.error || `HTTP ${response.status}`);

      const saved = data.config ?? latest;
      setConfig(saved);
      setLocalFile(null);
      await refresh();
      setMessage("Đã lưu chart.");
      setSaveDialog({
        title: "Chart saved",
        message: uploaded ? "Audio đã upload và chart đã lưu." : "Chart đã lưu vào Music library.",
        audioUrl: saved.audioUrl,
      });
    } catch (error) {
      setMessage(`Lưu thất bại: ${error instanceof Error ? error.message : "unknown error"}`);
    } finally {
      setSaving(false);
    }
  };

  const deleteTrack = async (track: MusicConfig) => {
    if (saving) return;
    if (!window.confirm(`Xóa "${track.title}" khỏi Music library?\n\nAudio trong Storage sẽ được giữ lại.`)) return;
    setSaving(true);
    try {
      const response = await fetch(`/api/music-config?id=${encodeURIComponent(track.id)}`, { method: "DELETE" });
      const data = await response.json().catch(() => ({})) as { error?: string; detail?: string };
      if (!response.ok) throw new Error(data.detail || data.error || `HTTP ${response.status}`);
      const result = await refresh();
      if (config.id === track.id) {
        const fallback = result.configs.find(item => item.id === DEFAULT_MUSIC_CONFIG.id) ?? result.configs[0];
        setConfig(fallback ?? cloneDefault());
        setAnalysis(null);
        setSelectedCandidate(null);
        resetAudioState();
      }
      setMessage(`Đã xóa ${track.title}.`);
    } catch (error) {
      setMessage(`Xóa thất bại: ${error instanceof Error ? error.message : "unknown error"}`);
    } finally {
      setSaving(false);
    }
  };

  const exactLabel = Number.isFinite(config.BPM_exact) ? (config.BPM_exact as number).toFixed(4) : "—";
  const currentStorageUrl = config.audioUrl.startsWith("blob:") ? null : config.audioUrl;
  const canSave = Boolean(config.audioUrl) && Number.isFinite(config.BPM_exact) && (config.BPM_exact ?? 0) > 0;

  return (
    <main className="music-config-page">
      <input ref={fileInputRef} className="visually-hidden-file-input" type="file" accept="audio/*,.mp3,.wav,.m4a,.ogg,.aac,.flac" onChange={event => chooseLocalFile(event.target.files?.[0])} />

      <header className="config-header">
        <div><span className="eyebrow">CLUB AUDITION / CHART STUDIO</span><h1>Music Chart Config</h1><p>Analyze the track, verify the beat anchor, then save.</p></div>
        <button className="primary header-add" disabled={saving} onClick={() => fileInputRef.current?.click()}>＋ ADD MUSIC</button>
      </header>

      <div className="studio-layout">
        <aside className="config-panel library-panel">
          <div className="panel-heading"><div><span>LIBRARY</span><h2>Music</h2></div><span className="count-badge">{library.length}</span></div>
          <div className="library-list">
            {library.length === 0 && <div className="empty-state">Chưa có chart. Chọn audio bên dưới hoặc ADD MUSIC.</div>}
            {library.map(track => (
              <div key={track.id} className={`library-track ${config.id === track.id ? "active" : ""}`}>
                <button className="library-select" disabled={saving} onClick={() => chooseTrack(track)}><span className="track-cover">♫</span><span className="track-copy"><b>{track.title}</b><small>{track.bpm || "—"} BPM · {Number.isFinite(track.BPM_exact) ? `${track.BPM_exact.toFixed(2)} exact` : "needs analysis"}</small></span></button>
                <button className="library-delete" disabled={saving} onClick={() => void deleteTrack(track)} aria-label={`Xóa ${track.title}`}>×</button>
              </div>
            ))}
          </div>
          <div className="storage-block">
            <div className="storage-title"><span>STORAGE AUDIO</span><b>{storageFiles.length}</b></div>
            <div className="storage-files">
              {storageFiles.length === 0 && <small>Chưa tìm thấy file audio.</small>}
              {storageFiles.map(file => {
                const configured = library.some(track => track.audioUrl === file.publicUrl);
                const active = currentStorageUrl === file.publicUrl;
                return <button key={file.publicUrl} className={`storage-file ${active ? "active" : ""}`} disabled={saving} onClick={() => chooseStorageFile(file)}><span>♫</span><span><b>{file.name}</b><small>{configured ? "Configured" : "Ready to chart"}{file.size ? ` · ${formatBytes(file.size)}` : ""}</small></span></button>;
              })}
            </div>
          </div>
        </aside>

        <section className="config-panel editor-panel">
          <div className="editor-heading"><div><span className="eyebrow">EDITOR</span><h2>{config.title}</h2></div><div className="time-badge">{formatTime(currentMs)}</div></div>

          <audio ref={audioRef} src={config.audioUrl} preload="metadata" onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onEnded={() => { setPlaying(false); previewEndRef.current = null; }} onTimeUpdate={() => {
            const audio = audioRef.current;
            if (!audio) return;
            const ms = audio.currentTime * 1000;
            setCurrentMs(ms);
            const endMs = previewEndRef.current;
            if (endMs != null && ms >= endMs) {
              previewEndRef.current = null;
              audio.pause();
              audio.currentTime = endMs / 1000;
              setCurrentMs(endMs);
            }
          }} onLoadedMetadata={event => {
            const duration = event.currentTarget.duration;
            if (Number.isFinite(duration)) patch("durationMs", Math.round(duration * 1000));
          }} />

          <div className="player-card">
            <button className="play-button" onClick={() => void togglePlay()}>{playing ? "❚❚" : "▶"}</button>
            <div className="timeline-wrap"><input className="timeline" min="0" max={Math.max(config.durationMs, 1)} value={Math.min(currentMs, Math.max(config.durationMs, 1))} type="range" onChange={event => seek(Number(event.target.value))} /><div className="timeline-labels"><span>{formatTime(currentMs)}</span><span>{formatTime(config.durationMs)}</span></div></div>
            <button onClick={() => seek(currentMs - 5000)}>−5s</button><button onClick={() => seek(currentMs + 5000)}>+5s</button>
          </div>

          <div className="section-card analysis-card">
            <div className="section-head"><div><span>1 · TEMPO</span><h3>Auto analysis</h3></div><button className="primary" disabled={analyzing || saving || !config.audioUrl} onClick={() => void analyzeAudio()}>{analyzing ? "ANALYZING…" : "ANALYZE AUDIO"}</button></div>
            <div className="tempo-summary"><div><span>Display</span><strong>{config.bpm > 0 ? config.bpm : "—"} <em>BPM</em></strong></div><div><span>System BPM exact</span><strong>{exactLabel}</strong></div><div><span>Confidence</span><strong>{analysis ? `${Math.round(analysis.confidence * 100)}%` : "—"}</strong></div></div>
            {analysis && <div className="candidate-list"><div className="candidate-head"><span>Detected candidates</span><small>ranked by independent tempo signals</small></div>{analysis.candidates.map((candidate, index) => <button key={`${candidate.bpm}-${index}`} className={`candidate-row ${index === 0 ? "recommended" : ""}`} onClick={() => { patch("BPM_exact", candidate.bpm); patch("bpm", Math.round(candidate.bpm)); setMessage(`Đã chọn ${candidate.bpm.toFixed(4)} BPM.`); }}><span className="candidate-rank">{index === 0 ? "★" : String(index + 1)}</span><span><b>{candidate.bpm.toFixed(4)} BPM</b><small>{candidate.source} · {Math.round(candidate.confidence * 100)}% signal</small></span>{index === 0 && <strong>RECOMMENDED</strong>}</button>)}</div>}
            <p className="helper">Không cần biết BPM trước. Hệ thống đọc toàn bộ audio, lấy beat timestamps và fit lại tempo liên tục; BPM hiển thị chỉ là giá trị rounded cho người chơi.</p>
          </div>

          <div className="section-card timing-card">
            <div className="section-head"><div><span>2 · SPACE START</span><h3>Choose the 4-beat anchor</h3></div><button onClick={usePlayerTime}>USE PLAYER TIME</button></div>
            <div className="anchor-current"><div><span>Current Space Start</span><strong>{formatTime(config.spaceStartMs)}</strong></div><div className="anchor-shifts"><button onClick={() => manualShiftSpace(-10)}>−10ms</button><button onClick={() => manualShiftSpace(-1)}>−1ms</button><button onClick={() => manualShiftSpace(1)}>+1ms</button><button onClick={() => manualShiftSpace(10)}>+10ms</button></div></div>
            {analysis ? <div className="anchor-grid"><div className="candidate-head"><span>Detected 4-beat anchors</span><small>Chọn mốc → slider về Perfect</small></div>{anchors.map((anchorMs, index) => <div key={anchorMs} className={`anchor-row ${selectedCandidate === anchorMs || config.spaceStartMs === anchorMs ? "active" : ""}`}><button onClick={() => selectAnchor(anchorMs)}><span>{index === 0 ? "★" : "○"}</span><b>{formatTime(anchorMs)}</b><small>4-beat #{index + 1}</small></button><button className="preview-button" onClick={() => void previewAnchor(anchorMs)}>▶ −5s</button></div>)}</div> : <div className="analysis-placeholder"><span>○</span><div><b>Chưa có beat grid</b><small>ANALYZE AUDIO để tìm tempo và mốc 4-beat.</small></div></div>}
            <p className="helper">Mốc được chọn sẽ tự seek về đúng anchor. Preview phát 5 giây trước đó rồi dừng tại anchor để admin xác nhận bằng tai.</p>
          </div>

          <div className="section-card gauge-card">
            <div className="section-head"><div><span>3 · GAUGE</span><h3>Timing preview</h3></div><span className="status-chip">4 BEAT CYCLE</span></div>
            <div className="gauge-shell"><AuditionGauge bpm={timingBpm} value={previewGauge} animationDelayMs={previewAnimationDelayMs} zoneStart={config.gauge.zoneStartPercent} zoneEnd={config.gauge.zoneEndPercent} perfectStart={config.gauge.perfectStartPercent} perfectEnd={config.gauge.perfectEndPercent} /></div>
            <div className="gauge-meta"><span>Anchor <b>{formatTime(config.spaceStartMs)}</b></span><span>Exact <b>{timingBpm.toFixed(4)} BPM</b></span><span>Phase <b>{formatTime(((currentMs - config.spaceStartMs) % previewCycleMs + previewCycleMs) % previewCycleMs)}</b></span></div>
          </div>

          <details className="advanced-card"><summary>Advanced chart settings</summary><div className="advanced-grid"><label>Title<input value={config.title} onChange={event => patch("title", event.target.value)} /></label><label>Artist<input value={config.artist ?? ""} onChange={event => patch("artist", event.target.value)} /></label><label>Display BPM<input type="number" min="1" step="1" value={config.bpm || 0} onChange={event => patch("bpm", Math.max(1, Number(event.target.value) || 1))} /></label><label>Audio URL<input value={config.audioUrl} onChange={event => { setLocalFile(null); patch("audioUrl", event.target.value); }} /></label><label>Zone start<input type="number" min="0" max="100" value={config.gauge.zoneStartPercent} onChange={event => patch("gauge", { ...config.gauge, zoneStartPercent: Number(event.target.value) })} /></label><label>Zone end<input type="number" min="0" max="100" value={config.gauge.zoneEndPercent} onChange={event => patch("gauge", { ...config.gauge, zoneEndPercent: Number(event.target.value) })} /></label><label>Perfect start<input type="number" min="0" max="100" value={config.gauge.perfectStartPercent} onChange={event => patch("gauge", { ...config.gauge, perfectStartPercent: Number(event.target.value) })} /></label><label>Perfect end<input type="number" min="0" max="100" value={config.gauge.perfectEndPercent} onChange={event => patch("gauge", { ...config.gauge, perfectEndPercent: Number(event.target.value) })} /></label></div><pre>{JSON.stringify(config, null, 2)}</pre></details>
        </section>
      </div>

      <div className="sticky-actions"><div className="sticky-status"><span className={saving ? "live-dot saving" : "live-dot"} />{message || "Ready"}</div><button disabled={saving} onClick={() => { const next = cloneDefault(); setConfig(next); setAnalysis(null); setSelectedCandidate(null); setCurrentMs(0); setPlaying(false); setMessage("Đã reset."); resetAudioState(); }}>RESET</button><button className="primary save-button" disabled={saving || !canSave} onClick={() => void save()}>{saving ? "SAVING…" : "SAVE TO DB"}</button></div>

      {saveDialog && <div className="save-dialog-backdrop" onMouseDown={() => setSaveDialog(null)}><div className="save-dialog" role="dialog" aria-modal="true" onMouseDown={event => event.stopPropagation()}><div className="save-dialog-icon">✓</div><span className="eyebrow">SAVE COMPLETE</span><h2>{saveDialog.title}</h2><p>{saveDialog.message}</p><div className="save-dialog-url"><span>Audio</span><b>{saveDialog.audioUrl}</b></div><button className="primary save-dialog-close" onClick={() => setSaveDialog(null)}>OK</button></div></div>}
    </main>
  );
}
