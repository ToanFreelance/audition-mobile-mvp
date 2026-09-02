"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { DEFAULT_MUSIC_CONFIG, type MusicConfig } from "../../../game/music-config";
import { getGaugeTiming } from "../../../game/gauge-timing";
import { analyzeFourBeatAnchors, type BeatAnchor } from "../../../game/beat-anchor";
import AuditionGauge from "../../../components/AuditionGauge";
import "./music-config.css";

type StorageAudioFile = {
  name: string;
  publicUrl: string;
  updatedAt: string | null;
  size: number | null;
  mimeType: string | null;
};

type SaveDialog = {
  title: string;
  message: string;
  audioUrl: string;
};

const SUPABASE_BUCKET = "audio";
const AUDIO_EXTENSIONS = new Set(["mp3", "wav", "m4a", "ogg", "aac", "flac"]);
const MAX_UPLOAD_BYTES = 100 * 1024 * 1024;

function cloneDefault(): MusicConfig {
  return JSON.parse(JSON.stringify(DEFAULT_MUSIC_CONFIG)) as MusicConfig;
}
function msToParts(ms: number) {
  const value = Math.max(0, Math.floor(ms));
  return { m: Math.floor(value / 60000), s: Math.floor((value % 60000) / 1000), ms: value % 1000 };
}
function partsToMs(m: number, s: number, ms: number) { return Math.max(0, m * 60000 + s * 1000 + ms); }
function formatTime(ms: number) { const p = msToParts(ms); return `${String(p.m).padStart(2, "0")}:${String(p.s).padStart(2, "0")}.${String(p.ms).padStart(3, "0")}`; }
function slugFromAudio(name: string) { return name.replace(/\.[^.]+$/, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""); }
function titleFromAudio(name: string) {
  const base = name.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ").replace(/\b\d+(?:\.\d+)?\s*bpm\b/gi, "").replace(/\s+/g, " ").trim();
  return base.replace(/\b\w/g, letter => letter.toUpperCase()) || "New Song";
}
function bpmFromAudio(name: string) {
  const match = name.match(/(?:^|[-_\s])(\d+(?:\.\d+)?)\s*bpm(?:[-_\s]|$)/i);
  return match ? Number(match[1]) : DEFAULT_MUSIC_CONFIG.bpm;
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
  let configError = "";
  let storageError = "";
  if (configResult.status === "fulfilled" && configResult.value.ok) {
    const data = await configResult.value.json() as { configs?: MusicConfig[] };
    configs = data.configs ?? [];
  } else configError = "Không đọc được music_charts";
  if (storageResult.status === "fulfilled" && storageResult.value.ok) {
    const data = await storageResult.value.json() as { files?: StorageAudioFile[] };
    storage = data.files ?? [];
  } else storageError = "Không đọc được Storage audio";
  return { configs, storage, configError, storageError };
}
async function uploadLocalAudio(file: File) {
  const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!baseUrl || !key) throw new Error("Thiếu NEXT_PUBLIC_SUPABASE_URL hoặc NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.");
  if (file.size > MAX_UPLOAD_BYTES) throw new Error("File audio vượt quá giới hạn 100 MB.");
  const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
  if (!AUDIO_EXTENSIONS.has(extension)) throw new Error("Định dạng audio chưa được hỗ trợ.");
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
    if (response.status === 409) throw new Error(`File "${objectPath}" đã tồn tại trong Storage.`);
    throw new Error(detail || `Upload failed (${response.status})`);
  }
  return publicStorageUrl(baseUrl, objectPath);
}

export default function MusicConfigPage() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const localPreviewRef = useRef<string | null>(null);
  const anchorPreviewEndRef = useRef<number | null>(null);
  const beatAnalysisRequestRef = useRef(0);
  const [config, setConfig] = useState<MusicConfig>(() => cloneDefault());
  const [library, setLibrary] = useState<MusicConfig[]>([]);
  const [storageFiles, setStorageFiles] = useState<StorageAudioFile[]>([]);
  const [localFile, setLocalFile] = useState<File | null>(null);
  const [currentMs, setCurrentMs] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [beatAnchors, setBeatAnchors] = useState<BeatAnchor[]>([]);
  const [selectedBeatAnchor, setSelectedBeatAnchor] = useState("");
  const [analyzingBeats, setAnalyzingBeats] = useState(false);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveDialog, setSaveDialog] = useState<SaveDialog | null>(null);

  useEffect(() => {
    let cancelled = false;
    const loadLibrary = async () => {
      const result = await fetchLibraries();
      if (cancelled) return;
      setLibrary(result.configs);
      setStorageFiles(result.storage);
      const selected = result.configs.find(item => item.id === DEFAULT_MUSIC_CONFIG.id) ?? result.configs[0];
      if (selected) setConfig(selected);
      setMessage([`Chart: ${result.configs.length}`, `Audio: ${result.storage.length}`, result.configError, result.storageError].filter(Boolean).join(" · "));
    };
    void loadLibrary();
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

  const timingBpm = Number(config.BPM_exact ?? config.bpm);
  const previewCycleMs = (60000 / Math.max(1, timingBpm)) * config.gauge.beatsPerCycle;
  const perfectCenter = (config.gauge.perfectStartPercent + config.gauge.perfectEndPercent) / 2;
  const previewGauge = useMemo(() => {
    if (!previewCycleMs) return perfectCenter;
    const raw = perfectCenter + ((currentMs - config.spaceStartMs) / previewCycleMs) * 100;
    return ((raw % 100) + 100) % 100;
  }, [config.spaceStartMs, currentMs, perfectCenter, previewCycleMs]);
  const previewAnimationDelayMs = useMemo(() => getGaugeTiming({
    bpm: timingBpm,
    beatsPerCycle: config.gauge.beatsPerCycle,
    spaceStartMs: config.spaceStartMs,
    perfectCenterPercent: perfectCenter,
  }, 0).breathAnimationDelayMs, [config.gauge.beatsPerCycle, config.spaceStartMs, perfectCenter, timingBpm]);
  const previewTiming = useMemo(() => getGaugeTiming({
    bpm: timingBpm,
    beatsPerCycle: config.gauge.beatsPerCycle,
    spaceStartMs: config.spaceStartMs,
    perfectCenterPercent: perfectCenter,
  }, currentMs), [config.gauge.beatsPerCycle, config.spaceStartMs, currentMs, perfectCenter, timingBpm]);

  const parts = useMemo(() => msToParts(config.spaceStartMs), [config.spaceStartMs]);

  const patch = <K extends keyof MusicConfig>(key: K, value: MusicConfig[K]) => setConfig(prev => ({ ...prev, [key]: value, updatedAt: new Date().toISOString() }));
  const patchGauge = (key: keyof MusicConfig["gauge"], value: number) => setConfig(prev => ({ ...prev, gauge: { ...prev.gauge, [key]: value }, updatedAt: new Date().toISOString() }));
  const patchGameplay = <K extends keyof MusicConfig["gameplay"]>(key: K, value: MusicConfig["gameplay"][K]) => setConfig(prev => ({ ...prev, gameplay: { ...prev.gameplay, [key]: value }, updatedAt: new Date().toISOString() }));
  const clearBeatAnalysis = () => { beatAnalysisRequestRef.current += 1; setBeatAnchors([]); setSelectedBeatAnchor(""); setAnalyzingBeats(false); anchorPreviewEndRef.current = null; };

  const loadAudio = () => {
    clearBeatAnalysis();
    window.setTimeout(() => {
      const audio = audioRef.current;
      if (audio) { audio.pause(); audio.currentTime = 0; audio.load(); }
      setCurrentMs(0); setPlaying(false);
    }, 0);
  };
  const chooseTrack = (track: MusicConfig) => { setLocalFile(null); setConfig(track); loadAudio(); setMessage(`Đã chọn ${track.title}.`); };
  const chooseStorageFile = (file: StorageAudioFile) => {
    const existing = library.find(track => track.audioUrl === file.publicUrl);
    if (existing) { chooseTrack(existing); return; }
    const next = cloneDefault();
    next.id = slugFromAudio(file.name) || `track-${Date.now()}`;
    next.title = titleFromAudio(file.name);
    next.audioUrl = file.publicUrl;
    next.bpm = bpmFromAudio(file.name);
    next.BPM_exact = undefined;
    next.durationMs = 0;
    next.updatedAt = new Date().toISOString();
    setLocalFile(null); setConfig(next); loadAudio();
    setMessage(`Đã chọn ${file.name}. Đây là audio chưa có chart; SAVE TO DB để thêm vào Music.`);
  };
  const chooseLocalFile = (file: File | undefined) => {
    if (!file) return;
    const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
    if (!file.type.startsWith("audio/") && !AUDIO_EXTENSIONS.has(ext)) { setMessage("File không phải audio được hỗ trợ."); return; }
    if (file.size > MAX_UPLOAD_BYTES) { setMessage("File vượt quá giới hạn 100 MB."); return; }
    if (localPreviewRef.current) URL.revokeObjectURL(localPreviewRef.current);
    const previewUrl = URL.createObjectURL(file);
    localPreviewRef.current = previewUrl;
    const next = cloneDefault();
    next.id = `${slugFromAudio(file.name) || "track"}-${Date.now()}`;
    next.title = titleFromAudio(file.name);
    next.audioUrl = previewUrl;
    next.bpm = bpmFromAudio(file.name);
    next.BPM_exact = undefined;
    next.durationMs = 0;
    next.updatedAt = new Date().toISOString();
    setLocalFile(file); setConfig(next); setCurrentMs(0); setPlaying(false); clearBeatAnalysis();
    window.setTimeout(() => audioRef.current?.load(), 0);
    setMessage(`Đã chọn ${file.name}. File sẽ tự upload lên Supabase khi SAVE TO DB.`);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };
  const addTrack = () => fileInputRef.current?.click();
  const togglePlay = async () => { const audio = audioRef.current; if (!audio) return; if (audio.paused) await audio.play(); else audio.pause(); };
  const handleAudioTimeUpdate = () => {
    const audio = audioRef.current;
    if (!audio) return;
    const nextMs = audio.currentTime * 1000;
    setCurrentMs(nextMs);
    const endMs = anchorPreviewEndRef.current;
    if (endMs != null && nextMs >= endMs) {
      anchorPreviewEndRef.current = null;
      audio.pause();
      audio.currentTime = endMs / 1000;
      setCurrentMs(endMs);
    }
  };
  const usePlayerTime = () => patch("spaceStartMs", Math.round((audioRef.current?.currentTime ?? 0) * 1000));
  const seek = (ms: number) => {
    anchorPreviewEndRef.current = null;
    const safeMs = Math.max(0, Math.min(ms, Math.max(config.durationMs, 1)));
    setCurrentMs(safeMs);
    if (audioRef.current) audioRef.current.currentTime = safeMs / 1000;
  };
  const adjustPlayerTime = (deltaMs: number) => seek(Math.round(currentMs + deltaMs));
  const adjustSpaceStart = (deltaMs: number) => patch("spaceStartMs", Math.max(0, Math.round(config.spaceStartMs + deltaMs)));

  const analyzeBeatAnchors = async () => {
    if (analyzingBeats || saving || !config.audioUrl) return;
    const requestId = ++beatAnalysisRequestRef.current;
    setAnalyzingBeats(true);
    setMessage("Đang phân tích nhịp 4 bằng beat tracker…");
    try {
      const result = await analyzeFourBeatAnchors(config.audioUrl);
      if (requestId !== beatAnalysisRequestRef.current) return;
      const exactBpm = Number(result.bpm.toFixed(4));
      setConfig(prev => ({ ...prev, BPM_exact: exactBpm, updatedAt: new Date().toISOString() }));
      setBeatAnchors(result.anchors);
      setSelectedBeatAnchor("");
      setMessage(`Đã phân tích ${result.anchors.length} mốc 4-beat · BPM exact ${exactBpm} · confidence ${(result.confidence * 100).toFixed(0)}%.`);
    } catch (error) {
      if (requestId !== beatAnalysisRequestRef.current) return;
      setMessage(`Phân tích thất bại: ${error instanceof Error ? error.message : "unknown error"}`);
    } finally {
      if (requestId === beatAnalysisRequestRef.current) setAnalyzingBeats(false);
    }
  };

  const selectBeatAnchor = (value: string) => {
    setSelectedBeatAnchor(value);
    const anchorIndex = Number(value);
    const anchor = beatAnchors[anchorIndex];
    if (!anchor) return;
    patch("spaceStartMs", anchor.ms);
    seek(anchor.ms);
    setMessage(`Đã chọn mốc 4-beat #${anchorIndex + 1} tại ${formatTime(anchor.ms)}. Slider đang ở Perfect.`);
  };

  const previewSelectedAnchor = async () => {
    const anchor = beatAnchors[Number(selectedBeatAnchor)];
    const audio = audioRef.current;
    if (!anchor || !audio) return;
    const startMs = Math.max(0, anchor.ms - 5000);
    anchorPreviewEndRef.current = anchor.ms;
    audio.currentTime = startMs / 1000;
    setCurrentMs(startMs);
    try {
      await audio.play();
      setMessage(`Nghe kiểm tra ${formatTime(startMs)} → ${formatTime(anchor.ms)}.`);
    } catch (error) {
      anchorPreviewEndRef.current = null;
      setMessage(`Không phát được audio preview: ${error instanceof Error ? error.message : "unknown error"}`);
    }
  };

  const reset = () => { setLocalFile(null); const next = cloneDefault(); setConfig(next); setCurrentMs(0); setPlaying(false); clearBeatAnalysis(); setMessage("Đã reset về cấu hình mặc định."); window.setTimeout(() => audioRef.current?.load(), 0); };
  const refreshLibraries = async () => { const result = await fetchLibraries(); setLibrary(result.configs); setStorageFiles(result.storage); };

  const deleteTrack = async (track: MusicConfig) => {
    if (saving) return;
    if (!window.confirm(`Xóa \"${track.title}\" khỏi Music library?\n\nFile audio trong Supabase Storage sẽ được giữ lại.`)) return;
    setSaving(true);
    try {
      const response = await fetch(`/api/music-config?id=${encodeURIComponent(track.id)}`, { method: "DELETE" });
      if (!response.ok) {
        const detail = await response.json().catch(() => ({})) as { detail?: string; error?: string };
        throw new Error(detail.detail || detail.error || `HTTP ${response.status}`);
      }
      const result = await fetchLibraries();
      setLibrary(result.configs); setStorageFiles(result.storage);
      if (config.id === track.id) {
        const fallback = result.configs.find(item => item.id === DEFAULT_MUSIC_CONFIG.id) ?? result.configs[0];
        setLocalFile(null);
        setConfig(fallback ?? cloneDefault());
        clearBeatAnalysis();
        loadAudio();
      }
      setMessage(`Đã xóa ${track.title} khỏi Music library.`);
    } catch (error) {
      setMessage(`Xóa thất bại: ${error instanceof Error ? error.message : "unknown error"}`);
    } finally { setSaving(false); }
  };

  const save = async () => {
    if (saving) return;
    setSaving(true);
    try {
      let audioUrl = config.audioUrl;
      let uploaded = false;
      if (localFile) { setMessage(`Đang upload ${localFile.name} lên Supabase…`); audioUrl = await uploadLocalAudio(localFile); uploaded = true; }
      const normalized: MusicConfig = { ...config, audioUrl, updatedAt: new Date().toISOString() };
      const response = await fetch("/api/music-config", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(normalized) });
      if (!response.ok) {
        const detail = await response.json().catch(() => ({})) as { detail?: string; error?: string };
        throw new Error(detail.detail || detail.error || `HTTP ${response.status}`);
      }
      const result = await response.json() as { config?: MusicConfig };
      const savedConfig = result.config ?? normalized;
      setConfig(savedConfig); setLocalFile(null); await refreshLibraries(); setMessage("Đã lưu vào Supabase music_charts.");
      setSaveDialog({ title: "Đã lưu bài nhạc", message: uploaded ? "Chart đã lưu vào database và audio đã được upload vào Supabase Storage. Bài này đã xuất hiện trong Music library." : "Chart đã lưu vào database và xuất hiện trong Music library.", audioUrl: savedConfig.audioUrl });
    } catch (error) {
      setMessage(`Lưu thất bại: ${error instanceof Error ? error.message : "unknown error"}`);
    } finally { setSaving(false); }
  };

  const currentStorageUrl = config.audioUrl.startsWith("blob:") ? null : config.audioUrl;

  return (
    <main className="music-config-page">
      <input ref={fileInputRef} className="visually-hidden-file-input" type="file" accept="audio/*,.mp3,.wav,.m4a,.ogg,.aac,.flac" onChange={event => chooseLocalFile(event.target.files?.[0])} />

      <header className="config-header">
        <div><span className="eyebrow">CLUB AUDITION / TOOL</span><h1>Music Chart Config</h1><p>Canh audio và khai báo rule để runtime chơi đúng từng bài nhạc.</p></div>
      </header>

      <div className="config-layout">
        <aside className="config-panel library-panel">
          <div className="panel-heading"><div><span>LIBRARY</span><h2>Music</h2></div><button disabled={saving} onClick={addTrack}>＋ ADD MUSIC</button></div>
          {library.length === 0 && <div className="storage-note"><b>Supabase connected</b><br />Chưa có chart trong <code>music_charts</code>. Hãy ADD MUSIC để chọn file local.</div>}
          {library.map(track => (
            <div key={track.id} className={`library-track ${config.id === track.id ? "active" : ""}`}>
              <button className="library-select" disabled={saving} onClick={() => chooseTrack(track)}><span className="track-cover">♫</span><span><b>{track.title}</b><small>{track.artist || "Unknown artist"} · {track.bpm} BPM</small></span></button>
              <button className="library-delete" disabled={saving} onClick={() => void deleteTrack(track)} aria-label={`Xóa ${track.title} khỏi Music library`} title="Xóa khỏi Music library">×</button>
            </div>
          ))}
          <div className="storage-note"><b>Storage Audio · {storageFiles.length}</b><br />Audio: Supabase Storage / <code>audio</code>
            <div className="storage-files">
              {storageFiles.length === 0 && <small>Chưa tìm thấy file audio.</small>}
              {storageFiles.map(file => { const configured = library.some(track => track.audioUrl === file.publicUrl); const active = currentStorageUrl === file.publicUrl; return <button key={file.publicUrl} className={`storage-file ${active ? "active" : ""}`} disabled={saving} onClick={() => chooseStorageFile(file)}><span>♫</span><span><b>{file.name}</b><small>{configured ? "Configured chart" : "Audio chưa có chart"}{file.size ? ` · ${formatBytes(file.size)}` : ""}</small></span></button>; })}
            </div>
            <br />Chart: Supabase <code>music_charts</code>.<br /><br />ADD MUSIC từ local → chọn file → SAVE TO DB → tự upload + lưu chart.<br /><br />Xóa khỏi Music chỉ xóa chart; file audio trong Storage được giữ lại.
          </div>
        </aside>

        <section className="config-panel editor-panel">
          <div className="panel-heading"><div><span>EDITOR</span><h2>{config.title}</h2></div><span className="clock-badge">● {formatTime(currentMs)}</span></div>
          <audio ref={audioRef} src={config.audioUrl} preload="metadata" onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onTimeUpdate={handleAudioTimeUpdate} onEnded={() => { anchorPreviewEndRef.current = null; setPlaying(false); }} onLoadedMetadata={event => { const duration = event.currentTarget.duration; if (Number.isFinite(duration)) patch("durationMs", Math.round(duration * 1000)); }} />
          <div className="audio-player">
            <button className="play-button" onClick={() => void togglePlay()}>{playing ? "❚❚" : "▶"}</button>
            <div className="audio-timeline"><input min="0" max={Math.max(config.durationMs, 1)} value={Math.min(currentMs, Math.max(config.durationMs, 1))} type="range" onChange={event => seek(Number(event.target.value))} /><div><span>{formatTime(currentMs)}</span><span>{formatTime(config.durationMs)}</span></div></div>
            <button onClick={() => adjustPlayerTime(-5000)}>−5s</button><button onClick={() => adjustPlayerTime(5000)}>+5s</button>
          </div>
          <div className="fine-time-controls" aria-label="Fine audio timing controls">
            <span>FINE</span>
            <button onClick={() => adjustPlayerTime(-10)}>−10 ms</button>
            <button onClick={() => adjustPlayerTime(-1)}>−1 ms</button>
            <button onClick={() => adjustPlayerTime(1)}>+1 ms</button>
            <button onClick={() => adjustPlayerTime(10)}>+10 ms</button>
          </div>

          <div className="player-gauge-card">
            <div className="card-heading"><div><span>LIVE PHASE</span><h3>Timing gauge</h3></div><span className="exact-bpm-badge">System {timingBpm.toFixed(4)} BPM</span></div>
            <div className="player-gauge-preview"><AuditionGauge bpm={timingBpm} value={previewGauge} animationDelayMs={previewAnimationDelayMs} zoneStart={config.gauge.zoneStartPercent} zoneEnd={config.gauge.zoneEndPercent} perfectStart={config.gauge.perfectStartPercent} perfectEnd={config.gauge.perfectEndPercent} /></div>
            <div className="player-gauge-meta"><span>Anchor {formatTime(config.spaceStartMs)}</span><span>Phase {previewTiming.cycleElapsedMs.toFixed(0)} / {previewTiming.cycleMs.toFixed(0)} ms</span></div>
            <small>Chọn mốc nhịp 4 bên dưới → slider nhảy thẳng vào Perfect; khi phát nhạc, phase chạy từ anchor đó bằng BPM_exact.</small>
          </div>

          <div className="space-card"><div className="card-heading"><div><span>AI 4-BEAT ANCHOR</span><h3>Find reliable Space start candidates</h3></div><button className="accent-button" disabled={analyzingBeats || saving} onClick={() => void analyzeBeatAnchors()}>{analyzingBeats ? "ANALYZING…" : "ANALYZE 4-BEAT"}</button></div>
            <div className="beat-anchor-tools">
              <label>Detected 4-beat markers<select value={selectedBeatAnchor} onChange={event => selectBeatAnchor(event.target.value)} disabled={analyzingBeats || beatAnchors.length === 0}>
                <option value="">Chọn mốc để làm Space start…</option>
                {beatAnchors.map(anchor => <option key={anchor.index} value={anchor.index}>{formatTime(anchor.ms)} · 4-beat #{anchor.index + 1} · beat {anchor.beatIndex + 1}</option>)}
              </select></label>
              <button disabled={!selectedBeatAnchor || analyzingBeats || saving} onClick={() => void previewSelectedAnchor()}>▶ −5s → MỐC</button>
            </div>
            <div className="beat-anchor-status">{beatAnchors.length ? `Package đã trả về ${beatAnchors.length} mốc chu kỳ 4 beat. Hãy nghe preview 5 giây trước mốc rồi xác nhận tai người.` : "Chưa có mốc AI. Bấm ANALYZE 4-BEAT để tạo danh sách candidate; cách chỉnh Space start thủ công phía dưới vẫn giữ nguyên."}</div>
          </div>

          <div className="space-card"><div className="card-heading"><div><span>TIMING ANCHOR</span><h3>Space start</h3></div><button className="accent-button" onClick={usePlayerTime}>USE PLAYER TIME</button></div><div className="time-editor"><label>MIN<input type="number" min="0" value={parts.m} onChange={e => patch("spaceStartMs", partsToMs(Number(e.target.value), parts.s, parts.ms))} /></label><label>SEC<input type="number" min="0" max="59" value={parts.s} onChange={e => patch("spaceStartMs", partsToMs(parts.m, Number(e.target.value), parts.ms))} /></label><label>MS<input type="number" min="0" max="999" value={parts.ms} onChange={e => patch("spaceStartMs", partsToMs(parts.m, parts.s, Number(e.target.value)))} /></label><output>{formatTime(config.spaceStartMs)}</output></div><div className="space-fine-controls"><button onClick={() => adjustSpaceStart(-10)}>−10 ms</button><button onClick={() => adjustSpaceStart(-1)}>−1 ms</button><button onClick={() => adjustSpaceStart(1)}>+1 ms</button><button onClick={() => adjustSpaceStart(10)}>+10 ms</button></div><p>Đây là <b>space start</b>: SPACE đầu tiên sau countdown, ngay tại zone perfect. Từ space start đến space start kế tiếp = <b>4 beat</b>. Bạn vẫn có thể chỉnh tay từng 1 ms như trước.</p></div>

          <div className="section-grid"><div className="sub-card"><div className="card-heading"><div><span>SONG</span><h3>Track info</h3></div></div><label>Title<input value={config.title} onChange={e => patch("title", e.target.value)} /></label><label>Artist<input value={config.artist ?? ""} onChange={e => patch("artist", e.target.value)} /></label><label>BPM<select className="bpm-mobile-picker" value={Math.round(config.bpm)} onChange={e => patch("bpm", Number(e.target.value))}>{Array.from({ length: 151 }, (_, index) => index + 50).map(value => <option key={value} value={value}>{value}</option>)}</select><input className="bpm-desktop-input" type="number" min="50" max="200" step="1" value={config.bpm} onChange={e => patch("bpm", Math.max(50, Math.min(200, Number(e.target.value))))} /></label><div className="exact-bpm-row"><span>Display BPM</span><b>{config.bpm} BPM</b><span>System BPM_exact</span><b>{Number.isFinite(config.BPM_exact) ? config.BPM_exact!.toFixed(4) : "—"}</b></div><label>Audio URL<input value={config.audioUrl} onChange={e => { setLocalFile(null); patch("audioUrl", e.target.value); }} /></label></div>
            <div className="sub-card"><div className="card-heading"><div><span>GAUGE</span><h3>Timing zones</h3></div></div><div className="number-grid"><label>Zone start<input type="number" min="0" max="100" value={config.gauge.zoneStartPercent} onChange={e => patchGauge("zoneStartPercent", Number(e.target.value))} /></label><label>Zone end<input type="number" min="0" max="100" value={config.gauge.zoneEndPercent} onChange={e => patchGauge("zoneEndPercent", Number(e.target.value))} /></label><label>Perfect start<input type="number" min="0" max="100" value={config.gauge.perfectStartPercent} onChange={e => patchGauge("perfectStartPercent", Number(e.target.value))} /></label><label>Perfect end<input type="number" min="0" max="100" value={config.gauge.perfectEndPercent} onChange={e => patchGauge("perfectEndPercent", Number(e.target.value))} /></label></div><div className="gauge-config-preview"><AuditionGauge bpm={timingBpm} value={previewGauge} animationDelayMs={previewAnimationDelayMs} zoneStart={config.gauge.zoneStartPercent} zoneEnd={config.gauge.zoneEndPercent} perfectStart={config.gauge.perfectStartPercent} perfectEnd={config.gauge.perfectEndPercent} /></div><div className="gauge-explanation"><b>Gauge này dùng để làm gì?</b><span>• Cyan = timing zone có thể hit.</span><span>• Vùng trắng ở giữa = Perfect window.</span><span>• Chấm đỏ = phase của audio hiện tại trong chu kỳ 4 beat.</span><span>• Khi <b>player time = Space start</b>, chấm đỏ sẽ nằm trong tâm Perfect. Sau đó nó chạy theo nhịp và quay lại điểm đó mỗi 4 beat.</span><span>• Nếu player đang ở 00:00 mà Space start là 00:28.870 thì chấm đỏ <b>không cần</b> nằm trong cyan; đó là phase hiện tại của bài. Hãy dùng player + Fine để đưa đúng thời điểm SPACE vào Perfect.</span><span>• Gauge dưới player là visualization trực tiếp; BPM_exact được dùng cho phase/timing.</span></div><small>Breath = {config.gauge.breathCycleBeats} beats · stretch = beat {config.gauge.edgeStretchBeat} · phase {previewTiming.cycleElapsedMs.toFixed(0)} ms / {previewTiming.cycleMs.toFixed(0)} ms</small></div></div>

          <div className="sub-card gameplay-card"><div className="card-heading"><div><span>GAMEPLAY</span><h3>Turn / sequence rules</h3></div></div><div className="number-grid six"><label>L1–5 reveal pass<input type="number" value={config.gameplay.commandRevealPasses["1-5"]} onChange={e => patchGameplay("commandRevealPasses", { ...config.gameplay.commandRevealPasses, "1-5": Number(e.target.value) })} /></label><label>L6–9 reveal pass<input type="number" value={config.gameplay.commandRevealPasses["6-9"]} onChange={e => patchGameplay("commandRevealPasses", { ...config.gameplay.commandRevealPasses, "6-9": Number(e.target.value) })} /></label><label>L1–5 miss penalty<input type="number" value={config.gameplay.missPenaltyTurns["1-5"]} onChange={e => patchGameplay("missPenaltyTurns", { ...config.gameplay.missPenaltyTurns, "1-5": Number(e.target.value) })} /></label><label>L6–9 miss penalty<input type="number" value={config.gameplay.missPenaltyTurns["6-9"]} onChange={e => patchGameplay("missPenaltyTurns", { ...config.gameplay.missPenaltyTurns, "6-9": Number(e.target.value) })} /></label><label>Finish hide turns<input type="number" min="0" value={config.gameplay.finishHideTurns} onChange={e => patchGameplay("finishHideTurns", Number(e.target.value))} /></label><label>Resume level<input type="number" min="1" max="9" value={config.gameplay.finishResumeLevel} onChange={e => patchGameplay("finishResumeLevel", Number(e.target.value))} /></label></div><label className="checkbox-row"><input type="checkbox" checked={config.gameplay.finishReverseRequired} onChange={e => patchGameplay("finishReverseRequired", e.target.checked)} /> finish arrow-command bắt buộc có ít nhất 1 reverse arrow</label></div>

          <div className="json-card"><div className="card-heading"><div><span>OUTPUT</span><h3>Chart JSON</h3></div><span>{message}</span></div><pre>{JSON.stringify(config, null, 2)}</pre></div>
        </section>
      </div>

      <div className="sticky-actions" role="region" aria-label="Chart actions"><div className="sticky-status">{message || "Sẵn sàng"}</div><button disabled={saving} onClick={reset}>RESET</button><button className="primary" disabled={saving} onClick={() => void save()}>{saving ? "SAVING…" : "SAVE TO DB"}</button></div>

      {saveDialog && <div className="save-dialog-backdrop" role="presentation" onMouseDown={() => setSaveDialog(null)}><div className="save-dialog" role="dialog" aria-modal="true" aria-labelledby="save-dialog-title" onMouseDown={event => event.stopPropagation()}><div className="save-dialog-icon">✓</div><span className="eyebrow">SAVE COMPLETE</span><h2 id="save-dialog-title">{saveDialog.title}</h2><p>{saveDialog.message}</p><div className="save-dialog-url"><span>Audio</span><b>{saveDialog.audioUrl}</b></div><button className="primary save-dialog-close" onClick={() => setSaveDialog(null)}>OK</button></div></div>}
    </main>
  );
}
