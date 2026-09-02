"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import AuditionGauge from "../../../components/AuditionGauge";
import { DEFAULT_MUSIC_CONFIG, type MusicConfig } from "../../../game/music-config";
import { analyzeTempo, type TempoAnalysis } from "../../../game/tempo-analysis";
import "./music-config.css";

// Keep the editor state structurally aligned with MusicConfig while allowing
// temporary blob URLs during local-file analysis/preview.
type EditableConfig = MusicConfig;

type LibraryResponse = {
  configs: MusicConfig[];
  storage: Array<{
    path: string;
    name: string;
    url: string;
    size?: number;
    updatedAt?: string;
  }>;
};

type MusicConfigApiResponse = {
  config?: MusicConfig;
  error?: string;
  detail?: string;
};

const cloneDefault = (): EditableConfig => ({
  ...DEFAULT_MUSIC_CONFIG,
  BPM_exact: DEFAULT_MUSIC_CONFIG.BPM_exact,
});

const formatTime = (ms: number) => {
  const totalSeconds = Math.max(0, ms) / 1000;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds - minutes * 60;
  return `${minutes}:${seconds.toFixed(2).padStart(5, "0")}`;
};

export default function MusicConfigPage() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const objectUrlRef = useRef<string | null>(null);

  const [config, setConfig] = useState<EditableConfig>(cloneDefault);
  const [library, setLibrary] = useState<MusicConfig[]>([]);
  const [storageFiles, setStorageFiles] = useState<LibraryResponse["storage"]>([]);
  const [analysis, setAnalysis] = useState<TempoAnalysis | null>(null);
  const [selectedCandidate, setSelectedCandidate] = useState<number | null>(null);
  const [currentTimeMs, setCurrentTimeMs] = useState(0);
  const [audioDurationMs, setAudioDurationMs] = useState(0);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

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
      storage: storageJson.files ?? storageJson.storage ?? [],
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
    setSelectedCandidate(nextConfig.spaceStartMs ?? null);
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
    return () => {
      cancelled = true;
    };
  }, [fetchLibraries, loadConfig]);

  useEffect(() => {
    return () => {
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    };
  }, []);

  const setAudioSource = useCallback((url: string) => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.pause();
    audio.src = url;
    audio.load();
    setCurrentTimeMs(0);
  }, []);

  useEffect(() => {
    if (!config.audioUrl) return;
    setAudioSource(config.audioUrl);
  }, [config.audioUrl, setAudioSource]);

  const usePlayerTime = () => {
    const value = Math.round((audioRef.current?.currentTime ?? 0) * 1000);
    patch("spaceStartMs", value);
    setSelectedCandidate(value);
    setMessage(`Space Start = ${formatTime(value)}.`);
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
    setSelectedCandidate(null);
    setMessage(`Loaded ${file.name}. Analyze the audio to detect tempo automatically.`);
  };

  const seekBy = (deltaSeconds: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = Math.max(0, Math.min(audio.duration || Infinity, audio.currentTime + deltaSeconds));
  };

  const seekTo = (ms: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = Math.max(0, ms / 1000);
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
      setSelectedCandidate(config.spaceStartMs ?? result.beats[0] * 1000 ?? 0);
      setMessage(`Detected ${result.bpmExact.toFixed(4)} BPM (${result.displayBpm} display BPM).`);
    } catch (error) {
      setMessage(`Analysis failed: ${error instanceof Error ? error.message : "unknown error"}`);
    } finally {
      setLoading(false);
    }
  };

  const selectCandidate = (bpm: number) => {
    const exact = Number(bpm);
    if (!Number.isFinite(exact)) return;
    patch("bpm", Math.round(exact));
    patch("BPM_exact", Number(exact.toFixed(4)));
  };

  const anchors = useMemo(() => {
    if (!analysis?.beats?.length) return [];
    const result: Array<{ ms: number; beatIndex: number }> = [];
    for (let index = 0; index + 3 < analysis.beats.length; index += 4) {
      result.push({ ms: Math.round(analysis.beats[index] * 1000), beatIndex: index + 1 });
    }
    return result.slice(0, 32);
  }, [analysis]);

  const chooseAnchor = (ms: number, beatIndex?: number) => {
    patch("spaceStartMs", Math.round(ms));
    patch("spaceStartBeat", beatIndex ?? 1);
    setSelectedCandidate(Math.round(ms));
    seekTo(ms);
    setMessage(`Space Start = ${formatTime(ms)}.`);
  };

  const previewAnchor = (ms: number, beatIndex?: number) => {
    chooseAnchor(ms, beatIndex);
    seekTo(Math.max(0, ms - 5000));
    void audioRef.current?.play();
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
      const response = await fetch("/api/music-config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json().catch(() => ({})) as MusicConfigApiResponse;
      if (!response.ok) throw new Error(data.detail || data.error || `HTTP ${response.status}`);
      if (data.config) {
        setConfig(data.config);
        setLibrary(current => {
          const index = current.findIndex(item => item.id === data.config!.id);
          if (index < 0) return [data.config!, ...current];
          return current.map(item => item.id === data.config!.id ? data.config! : item);
        });
      }
      setMessage("Saved to DB.");
      const refreshed = await fetchLibraries();
      setLibrary(refreshed.configs);
      setStorageFiles(refreshed.storage);
    } catch (error) {
      setMessage(`Save failed: ${error instanceof Error ? error.message : "unknown error"}`);
    } finally {
      setSaving(false);
    }
  };

  const deleteMusic = async (track: MusicConfig) => {
    setSaving(true);
    try {
      const response = await fetch(`/api/music-config?id=${encodeURIComponent(track.id)}`, { method: "DELETE" });
      const data = await response.json().catch(() => ({})) as { error?: string; detail?: string };
      if (!response.ok) throw new Error(data.detail || data.error || `HTTP ${response.status}`);
      const refreshed = await fetchLibraries();
      setLibrary(refreshed.configs);
      setStorageFiles(refreshed.storage);
      if (config.id === track.id) {
        const next = refreshed.configs.find(item => item.id === DEFAULT_MUSIC_CONFIG.id) ?? refreshed.configs[0] ?? cloneDefault();
        setConfig(next);
        setAnalysis(null);
        setSelectedCandidate(null);
        resetAudioState();
      }
      setMessage(`Deleted ${track.title}. Audio file retained in Storage.`);
    } catch (error) {
      setMessage(`Delete failed: ${error instanceof Error ? error.message : "unknown error"}`);
    } finally {
      setSaving(false);
    }
  };

  const exactBpm = config.BPM_exact;
  const exactLabel = typeof exactBpm === "number" && Number.isFinite(exactBpm) ? exactBpm.toFixed(4) : "—";
  const canSave = Boolean(config.audioUrl) && typeof exactBpm === "number" && Number.isFinite(exactBpm) && exactBpm > 0;
  const timingBpm = typeof exactBpm === "number" && Number.isFinite(exactBpm) && exactBpm > 0 ? exactBpm : config.bpm;

  return (
    <main className="music-config-page">
      <input
        ref={fileInputRef}
        className="visually-hidden-file-input"
        type="file"
        accept="audio/*,.mp3,.wav,.m4a,.ogg,.aac,.flac"
        onChange={event => chooseLocalFile(event.target.files?.[0])}
      />

      <header className="config-header">
        <div>
          <span className="eyebrow">CLUB AUDITION / CHART STUDIO</span>
          <h1>Music Chart Config</h1>
          <p>Analyze the track, verify the anchor, save the chart.</p>
        </div>
        <button className="button button-primary" onClick={() => fileInputRef.current?.click()} type="button">ADD MUSIC</button>
      </header>

      <section className="studio-layout">
        <aside className="section-card library-panel">
          <div className="section-heading">
            <div>
              <span className="eyebrow">LIBRARY</span>
              <h2>Music</h2>
            </div>
            <span className="count-badge">{library.length}</span>
          </div>
          <div className="library-list">
            {library.map(track => (
              <button
                key={track.id}
                className={`library-row ${track.id === config.id ? "is-active" : ""}`}
                onClick={() => loadConfig(track)}
                type="button"
              >
                <span>
                  <strong>{track.title}</strong>
                  <small>{track.bpm || "—"} BPM · {typeof track.BPM_exact === "number" && Number.isFinite(track.BPM_exact) ? `${track.BPM_exact.toFixed(2)} exact` : "needs analysis"}</small>
                </span>
              </button>
            ))}
            {!library.length && <p className="empty-state">No charts yet.</p>}
          </div>
        </aside>

        <div className="editor-column">
          <section className="section-card player-card">
            <div className="section-heading">
              <div>
                <span className="eyebrow">AUDIO</span>
                <h2>{config.title || "Untitled track"}</h2>
              </div>
              <span className="status-chip">{loading ? "WORKING" : analysis ? "ANALYZED" : "READY"}</span>
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
            />
            <div className="player-meta">
              <span>{formatTime(currentTimeMs)} / {formatTime(audioDurationMs || config.durationMs)}</span>
              <span>{config.audioUrl ? "Audio loaded" : "No audio"}</span>
            </div>
            <div className="toolbar-grid">
              <button className="button" onClick={() => seekBy(-5)} type="button">−5s</button>
              <button className="button" onClick={() => seekBy(5)} type="button">+5s</button>
              <button className="button" onClick={usePlayerTime} type="button">USE PLAYER TIME</button>
              <button className="button button-primary" disabled={loading || !config.audioUrl} onClick={() => void analyze()} type="button">ANALYZE AUDIO</button>
            </div>
          </section>

          <section className="section-card tempo-card">
            <div className="section-heading">
              <div>
                <span className="eyebrow">TEMPO</span>
                <h2>Detected timing</h2>
              </div>
              <div className="tempo-summary">
                <strong>{config.bpm || "—"}</strong>
                <span>display BPM</span>
                <small>{exactLabel} exact</small>
              </div>
            </div>

            {analysis ? (
              <>
                <div className="candidate-list">
                  {analysis.candidates.map((candidate, index) => (
                    <button
                      className={`candidate-row ${Math.abs(candidate.bpm - timingBpm) < 0.01 ? "is-selected" : ""}`}
                      key={`${candidate.source}-${candidate.bpm}-${index}`}
                      onClick={() => selectCandidate(candidate.bpm)}
                      type="button"
                    >
                      <span><strong>{candidate.bpm.toFixed(2)}</strong> BPM</span>
                      <small>{candidate.source} · confidence {(candidate.confidence * 100).toFixed(0)}%</small>
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <p className="hint">Select or upload a track, then run ANALYZE AUDIO. No manual BPM entry is required.</p>
            )}
          </section>

          <section className="section-card anchor-card">
            <div className="section-heading">
              <div>
                <span className="eyebrow">PHASE</span>
                <h2>4-beat Space Start anchors</h2>
              </div>
              <span className="mono-value">{formatTime(config.spaceStartMs)}</span>
            </div>
            {anchors.length ? (
              <div className="anchor-grid">
                {anchors.map(anchor => (
                  <div className={`anchor-row ${selectedCandidate === anchor.ms ? "is-selected" : ""}`} key={`${anchor.beatIndex}-${anchor.ms}`}>
                    <div>
                      <strong>Beat {anchor.beatIndex}</strong>
                      <small>{formatTime(anchor.ms)}</small>
                    </div>
                    <div className="anchor-actions">
                      <button className="button button-small" onClick={() => previewAnchor(anchor.ms, anchor.beatIndex)} type="button">▶ −5s</button>
                      <button className="button button-small" onClick={() => chooseAnchor(anchor.ms, anchor.beatIndex)} type="button">USE</button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="hint">Beat anchors appear after analysis.</p>
            )}
          </section>

          <section className="section-card gauge-card">
            <div className="section-heading">
              <div>
                <span className="eyebrow">PREVIEW</span>
                <h2>Gauge</h2>
              </div>
              <small>{timingBpm.toFixed(4)} BPM timing</small>
            </div>
            <div className="gauge-shell">
              <AuditionGauge bpm={timingBpm} spaceStartMs={config.spaceStartMs} currentTimeMs={currentTimeMs} />
            </div>
          </section>

          <section className="section-card advanced-card">
            <div className="section-heading">
              <div>
                <span className="eyebrow">CONFIG</span>
                <h2>Chart details</h2>
              </div>
            </div>
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

      <footer className="sticky-actions">
        <div>
          <strong>{config.title || "Untitled track"}</strong>
          <span>{message || "Ready"}</span>
        </div>
        <div className="sticky-action-group">
          {config.id && library.some(item => item.id === config.id) && (
            <button className="button button-danger" disabled={saving} onClick={() => void deleteMusic(config)} type="button">DELETE</button>
          )}
          <button className="button" disabled={saving} onClick={() => {
            setConfig(cloneDefault());
            setAnalysis(null);
            setSelectedCandidate(null);
            resetAudioState();
            setMessage("Reset.");
          }} type="button">RESET</button>
          <button className="button button-primary" disabled={saving || !canSave} onClick={() => void save()} type="button">{saving ? "SAVING…" : "SAVE TO DB"}</button>
        </div>
      </footer>
    </main>
  );
}
