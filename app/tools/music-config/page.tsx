"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import AuditionGauge from "../../../components/AuditionGauge";
import { DEFAULT_MUSIC_CONFIG, type MusicConfig } from "../../../game/music-config";
import { analyzeTempo, type TempoAnalysis } from "../../../game/tempo-analysis";
import "./music-config.css";
import "./music-config-overrides.css";

type EditableConfig = MusicConfig;
type Theme = "dark" | "light";

type LibraryResponse = {
  configs: MusicConfig[];
  storage: Array<{ path: string; name: string; url: string; size?: number; updatedAt?: string }>;
};

type MusicConfigApiResponse = { config?: MusicConfig; error?: string; detail?: string };

const cloneDefault = (): EditableConfig => ({ ...DEFAULT_MUSIC_CONFIG, BPM_exact: DEFAULT_MUSIC_CONFIG.BPM_exact });

const formatTime = (ms: number, precision = 2) => {
  const totalSeconds = Math.max(0, ms) / 1000;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds - minutes * 60;
  return `${minutes}:${seconds.toFixed(precision).padStart(precision === 0 ? 2 : precision + 3, "0")}`;
};

export default function MusicConfigPage() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const objectUrlRef = useRef<string | null>(null);
  const rafRef = useRef<number | null>(null);

  const [config, setConfig] = useState<EditableConfig>(cloneDefault);
  const [library, setLibrary] = useState<MusicConfig[]>([]);
  const [storageFiles, setStorageFiles] = useState<LibraryResponse["storage"]>([]);
  const [analysis, setAnalysis] = useState<TempoAnalysis | null>(null);
  const [selectedAnchorMs, setSelectedAnchorMs] = useState<number | null>(null);
  const [currentTimeMs, setCurrentTimeMs] = useState(0);
  const [audioDurationMs, setAudioDurationMs] = useState(0);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [dockExpanded, setDockExpanded] = useState(true);
  const [theme, setTheme] = useState<Theme>("dark");

  const patch = useCallback(<K extends keyof EditableConfig>(key: K, value: EditableConfig[K]) => {
    setConfig(current => ({ ...current, [key]: value }));
  }, []);

  const fetchLibraries = useCallback(async (): Promise<LibraryResponse> => {
    const [configsResponse, storageResponse] = await Promise.all([
      fetch("/api/music-config", { cache: "no-store" }),
      fetch("/api/music-library", { cache: "no-store" }),
    ]);
    const configsJson = await configsResponse.json().catch(() => ({}));
    const storageJson = await storageResponse.json().catch(() => ({}));
    if (!configsResponse.ok) throw new Error(configsJson.detail || configsJson.error || `Music config HTTP ${configsResponse.status}`);
    if (!storageResponse.ok) throw new Error(storageJson.detail || storageJson.error || `Music library HTTP ${storageResponse.status}`);
    return {
      configs: Array.isArray(configsJson) ? configsJson : configsJson.configs ?? [],
      storage: Array.isArray(storageJson.files) ? storageJson.files.map((item: { name?: string; publicUrl?: string; url?: string; updatedAt?: string; size?: number }) => ({
        path: item.name ?? "",
        name: item.name ?? "",
        url: item.publicUrl ?? item.url ?? "",
        updatedAt: item.updatedAt,
        size: item.size,
      })) : [],
    };
  }, []);

  const resetAudioState = useCallback(() => {
    const audio = audioRef.current;
    if (audio) {
      audio.pause();
      audio.currentTime = 0;
    }
    setCurrentTimeMs(0);
    setAudioDurationMs(0);
  }, []);

  const loadConfig = useCallback((nextConfig: MusicConfig) => {
    setConfig({ ...nextConfig });
    setAnalysis(null);
    setSelectedAnchorMs(nextConfig.spaceStartMs ?? null);
    resetAudioState();
  }, [resetAudioState]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchLibraries()
      .then(data => {
        if (cancelled) return;
        setLibrary(data.configs);
        setStorageFiles(data.storage);
        if (data.configs.length) loadConfig(data.configs[0]);
      })
      .catch(error => {
        if (!cancelled) setMessage(`Load failed: ${error instanceof Error ? error.message : "unknown error"}`);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [fetchLibraries, loadConfig]);

  useEffect(() => {
    const storedTheme = window.localStorage.getItem("audition-music-config-theme");
    if (storedTheme === "light" || storedTheme === "dark") setTheme(storedTheme);
  }, []);

  useEffect(() => {
    window.localStorage.setItem("audition-music-config-theme", theme);
  }, [theme]);

  useEffect(() => () => {
    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
  }, []);

  const syncPlayerTime = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    setCurrentTimeMs(Math.round(audio.currentTime * 1000));
    if (!audio.paused && !audio.ended) {
      rafRef.current = requestAnimationFrame(syncPlayerTime);
    } else {
      rafRef.current = null;
    }
  }, []);

  const startPlayerClock = useCallback(() => {
    if (rafRef.current === null) rafRef.current = requestAnimationFrame(syncPlayerTime);
  }, [syncPlayerTime]);

  const setAudioSource = useCallback((url: string) => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.pause();
    audio.src = url;
    audio.load();
    setCurrentTimeMs(0);
  }, []);

  useEffect(() => {
    if (config.audioUrl) setAudioSource(config.audioUrl);
  }, [config.audioUrl, setAudioSource]);

  const seekTo = useCallback((ms: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    const duration = Number.isFinite(audio.duration) ? audio.duration * 1000 : Infinity;
    audio.currentTime = Math.max(0, Math.min(duration, ms)) / 1000;
    setCurrentTimeMs(Math.round(audio.currentTime * 1000));
  }, []);

  const seekBy = useCallback((deltaMs: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    const next = Math.max(0, Math.min(Number.isFinite(audio.duration) ? audio.duration * 1000 : Infinity, audio.currentTime * 1000 + deltaMs));
    audio.currentTime = next / 1000;
    setCurrentTimeMs(Math.round(next));
  }, []);

  const usePlayerTime = () => {
    const value = Math.round((audioRef.current?.currentTime ?? 0) * 1000);
    patch("spaceStartMs", value);
    patch("spaceStartBeat", 1);
    setSelectedAnchorMs(value);
    setMessage(`Space Start = ${formatTime(value, 3)}.`);
  };

  const chooseLocalFile = (file?: File) => {
    if (!file) return;
    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    const objectUrl = URL.createObjectURL(file);
    objectUrlRef.current = objectUrl;
    patch("audioUrl", objectUrl);
    patch("title", file.name.replace(/\.[^/.]+$/, ""));
    patch("durationMs", 0);
    setAnalysis(null);
    setSelectedAnchorMs(null);
    setMessage(`Loaded ${file.name}. Analyze the audio to detect tempo automatically.`);
  };

  const chooseStorageFile = (file: LibraryResponse["storage"][number]) => {
    patch("audioUrl", file.url);
    patch("title", file.name.replace(/\.[^/.]+$/, ""));
    setAnalysis(null);
    setSelectedAnchorMs(null);
    setMessage(`Selected ${file.name}.`);
  };

  const analyze = async () => {
    if (!config.audioUrl) {
      setMessage("Select or upload an audio file first.");
      return;
    }
    setLoading(true);
    setMessage("Analyzing tempo and beat positions…");
    try {
      const result = await analyzeTempo(config.audioUrl);
      setAnalysis(result);
      patch("bpm", result.displayBpm);
      patch("BPM_exact", result.bpmExact);
      setSelectedAnchorMs(config.spaceStartMs ?? (result.beats[0] !== undefined ? Math.round(result.beats[0] * 1000) : 0));
      setMessage(`Detected ${result.bpmExact.toFixed(4)} BPM.`);
    } catch (error) {
      setMessage(`Analysis failed: ${error instanceof Error ? error.message : "unknown error"}`);
    } finally {
      setLoading(false);
    }
  };

  const anchors = useMemo(() => {
    if (!analysis?.beats?.length) return [];
    return analysis.beats
      .map((seconds, index) => ({ ms: Math.round(seconds * 1000), beatIndex: index + 1 }))
      .filter((_, index) => index % 4 === 0)
      .slice(0, 128);
  }, [analysis]);

  const selectAnchor = (ms: number, beatIndex: number, preview = false) => {
    patch("spaceStartMs", Math.round(ms));
    patch("spaceStartBeat", beatIndex);
    setSelectedAnchorMs(Math.round(ms));
    seekTo(preview ? Math.max(0, ms - 5000) : ms);
    if (preview) void audioRef.current?.play();
  };

  const selectTempoCandidate = (bpm: number) => {
    const exact = Number(bpm);
    if (!Number.isFinite(exact) || exact <= 0) return;
    patch("bpm", Math.round(exact));
    patch("BPM_exact", Number(exact.toFixed(4)));
  };

  const deleteChart = async (track: MusicConfig) => {
    setSaving(true);
    try {
      const response = await fetch(`/api/music-config?id=${encodeURIComponent(track.id)}`, { method: "DELETE" });
      const data = await response.json().catch(() => ({})) as { error?: string; detail?: string };
      if (!response.ok) throw new Error(data.detail || data.error || `HTTP ${response.status}`);
      const refreshed = await fetchLibraries();
      setLibrary(refreshed.configs);
      setStorageFiles(refreshed.storage);
      if (config.id === track.id) {
        const next = refreshed.configs[0] ?? cloneDefault();
        loadConfig(next);
      }
      setMessage(`Deleted ${track.title}. Storage audio retained.`);
    } catch (error) {
      setMessage(`Delete failed: ${error instanceof Error ? error.message : "unknown error"}`);
    } finally {
      setSaving(false);
    }
  };

  const deleteStorageFile = async (file: LibraryResponse["storage"][number]) => {
    if (!window.confirm(`Delete ${file.name} from Storage?`)) return;
    setSaving(true);
    try {
      const response = await fetch("/api/music-library", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: file.path }),
      });
      const data = await response.json().catch(() => ({})) as { error?: string; detail?: string };
      if (!response.ok) throw new Error(data.detail || data.error || `HTTP ${response.status}`);
      const refreshed = await fetchLibraries();
      setLibrary(refreshed.configs);
      setStorageFiles(refreshed.storage);
      if (config.audioUrl === file.url) loadConfig(refreshed.configs[0] ?? cloneDefault());
      setMessage(`Deleted ${file.name} from Storage.`);
    } catch (error) {
      setMessage(`Storage delete failed: ${error instanceof Error ? error.message : "unknown error"}`);
    } finally {
      setSaving(false);
    }
  };

  const save = async () => {
    const exactBpm = config.BPM_exact;
    if (!config.audioUrl) {
      setMessage("Audio URL is required.");
      return;
    }
    if (typeof exactBpm !== "number" || !Number.isFinite(exactBpm) || exactBpm <= 0) {
      setMessage("Run ANALYZE AUDIO before saving.");
      return;
    }
    setSaving(true);
    setMessage("Saving chart configuration…");
    try {
      const payload = { ...config, bpm: Math.round(config.bpm), BPM_exact: Number(exactBpm.toFixed(4)) };
      const response = await fetch("/api/music-config", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const data = await response.json().catch(() => ({})) as MusicConfigApiResponse;
      if (!response.ok) throw new Error(data.detail || data.error || `HTTP ${response.status}`);
      const refreshed = await fetchLibraries();
      setLibrary(refreshed.configs);
      setStorageFiles(refreshed.storage);
      if (data.config) loadConfig(data.config);
      setMessage("Saved to DB.");
    } catch (error) {
      setMessage(`Save failed: ${error instanceof Error ? error.message : "unknown error"}`);
    } finally {
      setSaving(false);
    }
  };

  const exactBpm = config.BPM_exact;
  const exactLabel = typeof exactBpm === "number" && Number.isFinite(exactBpm) ? exactBpm.toFixed(4) : "—";
  const timingBpm = typeof exactBpm === "number" && Number.isFinite(exactBpm) && exactBpm > 0 ? exactBpm : config.bpm;
  const currentLibraryTrack = config.id ? library.find(item => item.id === config.id) : undefined;
  const selectedStorage = storageFiles.find(item => item.url === config.audioUrl);
  const displayedDurationMs = audioDurationMs || config.durationMs;

  const renderFineSeekControls = () => (
    <div className="fine-seek-row">
      <button className="button" onClick={() => seekBy(-1000)} type="button">−1s</button>
      <button className="button" onClick={() => seekBy(-100)} type="button">−100ms</button>
      <button className="button" onClick={() => seekBy(-10)} type="button">−10ms</button>
      <button className="button button-time-readout" onClick={usePlayerTime} type="button">{formatTime(currentTimeMs, 3)}</button>
      <button className="button" onClick={() => seekBy(10)} type="button">+10ms</button>
      <button className="button" onClick={() => seekBy(100)} type="button">+100ms</button>
      <button className="button" onClick={() => seekBy(1000)} type="button">+1s</button>
    </div>
  );

  return (
    <main className={`music-config-page theme-${theme} ${dockExpanded ? "audio-dock-expanded" : "audio-dock-collapsed"}`}>
      <input ref={fileInputRef} className="visually-hidden-file-input" type="file" accept="audio/*,.mp3,.wav,.m4a,.ogg,.aac,.flac" onChange={event => chooseLocalFile(event.target.files?.[0])} />

      <header className="config-header">
        <div>
          <span className="eyebrow">CLUB AUDITION / CHART STUDIO</span>
          <h1>Music Chart Config</h1>
          <p>Analyze the track, verify the anchor, save the chart.</p>
        </div>
        <div className="header-actions">
          <button className="button theme-toggle" onClick={() => setTheme(current => current === "dark" ? "light" : "dark")} type="button" aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}>
            {theme === "dark" ? "☀ LIGHT" : "☾ DARK"}
          </button>
          <button className="button button-primary" onClick={() => fileInputRef.current?.click()} type="button">ADD MUSIC</button>
        </div>
      </header>

      <section className="studio-layout">
        <aside className="section-card library-panel">
          <div className="section-heading">
            <div><span className="eyebrow">LIBRARY</span><h2>Music</h2></div>
            <span className="count-badge">{library.length}</span>
          </div>
          <div className="library-list">
            {library.map(track => (
              <div className={`library-item ${track.id === config.id ? "is-active" : ""}`} key={track.id}>
                <button className="library-row" onClick={() => loadConfig(track)} type="button">
                  <span className="library-copy"><strong>{track.title}</strong><small>{track.bpm || "—"} BPM · {typeof track.BPM_exact === "number" && Number.isFinite(track.BPM_exact) ? `${track.BPM_exact.toFixed(2)} exact` : "needs analysis"}</small></span>
                </button>
                <button className="library-delete-button" disabled={saving} onClick={() => void deleteChart(track)} type="button" aria-label={`Delete ${track.title}`}>×</button>
              </div>
            ))}
          </div>

          <div className="storage-block">
            <div className="storage-title"><div><span className="eyebrow">STORAGE</span><b>Audio files</b></div><b>{storageFiles.length}</b></div>
            <div className="storage-files">
              {storageFiles.map(file => (
                <div className={`storage-row ${selectedStorage?.path === file.path ? "is-active" : ""}`} key={file.path}>
                  <button className="storage-file" onClick={() => chooseStorageFile(file)} type="button">
                    <span>♫</span><span><b>{file.name}</b><small>{file.size ? `${Math.round(file.size / 1024 / 1024)} MB` : "Audio"}</small></span>
                  </button>
                  <button className="storage-delete-button" disabled={saving} onClick={() => void deleteStorageFile(file)} type="button" aria-label={`Delete ${file.name} from storage`}>×</button>
                </div>
              ))}
              {!storageFiles.length && <p className="empty-state">No audio files in Storage.</p>}
            </div>
          </div>
        </aside>

        <div className="editor-column">
          <section className="section-card player-card">
            <div className="section-heading">
              <div><span className="eyebrow">AUDIO WORKSTATION</span><h2>{config.title || "Untitled track"}</h2></div>
              <span className="status-chip">{loading ? "WORKING" : analysis ? "ANALYZED" : "READY"}</span>
            </div>
            <div className="player-meta player-card-summary"><span>{formatTime(currentTimeMs, 3)} / {formatTime(displayedDurationMs, 3)}</span><span>{config.audioUrl ? "Player docked below" : "No audio"}</span></div>
          </section>

          <section className="section-card tempo-card">
            <div className="section-heading"><div><span className="eyebrow">TEMPO</span><h2>Detected timing</h2></div><div className="tempo-summary"><strong>{config.bpm || "—"}</strong><span>display BPM</span><small>{exactLabel} exact</small></div></div>
            {analysis ? (
              <div className="candidate-list">
                {analysis.candidates.map((candidate, index) => (
                  <button className={`candidate-row ${Math.abs(candidate.bpm - timingBpm) < 0.02 && candidate.source === "tempo" ? "is-selected" : ""}`} key={`${candidate.source}-${candidate.bpm}-${index}`} onClick={() => selectTempoCandidate(candidate.bpm)} type="button">
                    <span><strong>{candidate.bpm.toFixed(2)}</strong> BPM</span><small>{candidate.source} · confidence {(candidate.confidence * 100).toFixed(0)}%</small>
                  </button>
                ))}
              </div>
            ) : <p className="hint">Select or upload a track, then run ANALYZE AUDIO. Tempo is detected automatically.</p>}
          </section>

          <section className="section-card anchor-card">
            <div className="section-heading"><div><span className="eyebrow">PHASE</span><h2>4-beat Space Start</h2></div><span className="mono-value">{formatTime(config.spaceStartMs, 3)}</span></div>
            <div className="anchor-select-row">
              <label><span>4-beat anchor</span><select value={selectedAnchorMs ?? config.spaceStartMs} onChange={event => { const ms = Number(event.target.value); const anchor = anchors.find(item => item.ms === ms); if (anchor) selectAnchor(anchor.ms, anchor.beatIndex); }} disabled={!anchors.length}>
                {!anchors.length && <option value={config.spaceStartMs}>Run analysis first</option>}
                {anchors.map(anchor => <option key={`${anchor.beatIndex}-${anchor.ms}`} value={anchor.ms}>Beat {anchor.beatIndex} · {formatTime(anchor.ms, 3)}</option>)}
              </select></label>
              <button className="button" disabled={!anchors.length} onClick={() => { const ms = selectedAnchorMs ?? config.spaceStartMs; const anchor = anchors.find(item => item.ms === ms) ?? anchors[0]; if (anchor) selectAnchor(anchor.ms, anchor.beatIndex, true); }} type="button">▶ −5s</button>
              <button className="button button-primary" disabled={!anchors.length} onClick={() => { const ms = selectedAnchorMs ?? config.spaceStartMs; const anchor = anchors.find(item => item.ms === ms) ?? anchors[0]; if (anchor) selectAnchor(anchor.ms, anchor.beatIndex); }} type="button">USE</button>
            </div>
          </section>

          <section className="section-card gauge-card">
            <div className="section-heading"><div><span className="eyebrow">PREVIEW</span><h2>Gauge</h2></div><small>{timingBpm.toFixed(4)} BPM timing</small></div>
            <div className="gauge-shell"><AuditionGauge bpm={timingBpm} spaceStartMs={config.spaceStartMs} currentTimeMs={currentTimeMs} /></div>
          </section>

          <section className="section-card advanced-card">
            <div className="section-heading"><div><span className="eyebrow">CONFIG</span><h2>Chart details</h2></div></div>
            <div className="form-grid">
              <label><span>Title</span><input value={config.title} onChange={event => patch("title", event.target.value)} /></label>
              <label><span>Artist</span><input value={config.artist ?? ""} onChange={event => patch("artist", event.target.value)} /></label>
              <label><span>Display BPM</span><input type="number" min={40} max={220} value={config.bpm} onChange={event => patch("bpm", Number(event.target.value) || 0)} /></label>
              <label><span>BPM exact</span><input value={exactLabel} readOnly /></label>
              <label className="form-span-2"><span>Audio URL</span><input value={config.audioUrl} onChange={event => patch("audioUrl", event.target.value)} /></label>
            </div>
          </section>
        </div>
      </section>

      <div className={`audio-dock ${dockExpanded ? "is-expanded" : "is-collapsed"}`} aria-label="Sticky audio workstation">
        <div className="audio-dock-inner">
          <div className="audio-dock-topline">
            <span className="audio-dock-title">{config.title || "Untitled track"}</span>
            <button className="audio-dock-toggle" onClick={() => setDockExpanded(current => !current)} type="button" aria-label={dockExpanded ? "Collapse audio workstation" : "Expand audio workstation"} title={dockExpanded ? "Collapse" : "Expand"}>
              {dockExpanded ? "⌄" : "⌃"}
            </button>
          </div>
          <audio
            ref={audioRef}
            controls
            preload="metadata"
            onLoadedMetadata={event => {
              const durationMs = Number.isFinite(event.currentTarget.duration) ? Math.round(event.currentTarget.duration * 1000) : 0;
              setAudioDurationMs(durationMs);
              if (durationMs) patch("durationMs", durationMs);
            }}
            onTimeUpdate={event => setCurrentTimeMs(Math.round(event.currentTarget.currentTime * 1000))}
            onSeeked={event => setCurrentTimeMs(Math.round(event.currentTarget.currentTime * 1000))}
            onPlay={startPlayerClock}
            onPause={() => {
              setCurrentTimeMs(Math.round((audioRef.current?.currentTime ?? 0) * 1000));
              if (rafRef.current !== null) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
            }}
            onEnded={() => {
              setCurrentTimeMs(Math.round((audioRef.current?.currentTime ?? 0) * 1000));
              if (rafRef.current !== null) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
            }}
          />
          <div className="audio-dock-meta"><span>{formatTime(currentTimeMs, 3)} / {formatTime(displayedDurationMs, 3)}</span><span>{config.title || "Untitled track"}</span></div>
          <div className="audio-dock-controls">
            {renderFineSeekControls()}
            <div className="toolbar-grid secondary-toolbar">
              <button className="button" onClick={usePlayerTime} type="button">USE PLAYER TIME</button>
              <button className="button button-primary" disabled={loading || !config.audioUrl} onClick={() => void analyze()} type="button">ANALYZE AUDIO</button>
            </div>
          </div>
        </div>
      </div>

      <footer className="sticky-actions">
        <div className="sticky-status"><strong>{config.title || "Untitled track"}</strong><span>{message || "Ready"}</span></div>
        <div className="sticky-action-group">
          {currentLibraryTrack && <button className="button button-danger" disabled={saving} onClick={() => void deleteChart(currentLibraryTrack)} type="button">DELETE</button>}
          <button className="button" disabled={saving} onClick={() => { loadConfig(cloneDefault()); setMessage("Reset."); }} type="button">RESET</button>
          <button className="button button-primary save-button" disabled={saving || !config.audioUrl || typeof exactBpm !== "number" || !Number.isFinite(exactBpm) || exactBpm <= 0} onClick={() => void save()} type="button">{saving ? "SAVING…" : "SAVE TO DB"}</button>
        </div>
      </footer>
    </main>
  );
}
