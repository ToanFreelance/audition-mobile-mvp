"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { DEFAULT_MUSIC_CONFIG, type MusicConfig } from "../../../game/music-config";
import AuditionGauge from "../../../components/AuditionGauge";
import "./music-config.css";

function cloneDefault(): MusicConfig {
  return JSON.parse(JSON.stringify(DEFAULT_MUSIC_CONFIG)) as MusicConfig;
}
function msToParts(ms: number) {
  const value = Math.max(0, Math.floor(ms));
  return { m: Math.floor(value / 60000), s: Math.floor((value % 60000) / 1000), ms: value % 1000 };
}
function partsToMs(m: number, s: number, ms: number) { return Math.max(0, m * 60000 + s * 1000 + ms); }
function formatTime(ms: number) { const p = msToParts(ms); return `${String(p.m).padStart(2, "0")}:${String(p.s).padStart(2, "0")}.${String(p.ms).padStart(3, "0")}`; }

export default function MusicConfigPage() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [config, setConfig] = useState<MusicConfig>(() => cloneDefault());
  const [library, setLibrary] = useState<MusicConfig[]>([]);
  const [currentMs, setCurrentMs] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let cancelled = false;
    const loadConfig = async () => {
      try {
        const response = await fetch("/api/music-config", { cache: "no-store" });
        if (response.ok) {
          const data = await response.json() as { configs?: MusicConfig[] };
          const configs = data.configs ?? [];
          if (!cancelled) {
            setLibrary(configs);
            const selected = configs.find(item => item.id === DEFAULT_MUSIC_CONFIG.id) ?? configs[0];
            if (selected) {
              setConfig(selected);
              localStorage.setItem("audition-music-config", JSON.stringify(selected));
            }
            setMessage(configs.length ? `Supabase: ${configs.length} bài nhạc.` : "Supabase đã kết nối, chưa có chart nào.");
            return;
          }
        }
      } catch { /* fall back to local test storage */ }

      try {
        const raw = localStorage.getItem("audition-music-config");
        if (raw && !cancelled) setConfig(JSON.parse(raw) as MusicConfig);
      } catch { /* keep defaults */ }
    };
    void loadConfig();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => {
      const audio = audioRef.current;
      if (audio) setCurrentMs(audio.currentTime * 1000);
    }, 30);
    return () => window.clearInterval(timer);
  }, []);

  const parts = useMemo(() => msToParts(config.spaceStartMs), [config.spaceStartMs]);
  const previewCycleMs = (60000 / Math.max(1, config.bpm)) * config.gauge.beatsPerCycle;
  const previewGauge = useMemo(() => {
    if (!previewCycleMs) return config.gauge.perfectStartPercent;
    const raw = config.gauge.perfectStartPercent + ((currentMs - config.spaceStartMs) / previewCycleMs) * 100;
    return ((raw % 100) + 100) % 100;
  }, [config.gauge.perfectStartPercent, config.spaceStartMs, currentMs, previewCycleMs]);

  const patch = <K extends keyof MusicConfig>(key: K, value: MusicConfig[K]) => setConfig(prev => ({ ...prev, [key]: value, updatedAt: new Date().toISOString() }));
  const patchGauge = (key: keyof MusicConfig["gauge"], value: number) => setConfig(prev => ({ ...prev, gauge: { ...prev.gauge, [key]: value }, updatedAt: new Date().toISOString() }));
  const patchGameplay = <K extends keyof MusicConfig["gameplay"]>(key: K, value: MusicConfig["gameplay"][K]) => setConfig(prev => ({ ...prev, gameplay: { ...prev.gameplay, [key]: value }, updatedAt: new Date().toISOString() }));

  const chooseTrack = (track: MusicConfig) => {
    setConfig(track);
    setCurrentMs(0);
    window.setTimeout(() => {
      const audio = audioRef.current;
      if (audio) { audio.currentTime = 0; audio.load(); }
    }, 0);
    setMessage(`Đã chọn ${track.title}.`);
  };

  const addTrack = () => {
    const next = cloneDefault();
    next.id = `track-${Date.now()}`;
    next.title = "New Song";
    next.audioUrl = "";
    next.updatedAt = new Date().toISOString();
    setConfig(next);
    setMessage("Đã tạo chart mới. Điền Audio URL rồi SAVE JSON + DB.");
  };

  const togglePlay = async () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) await audio.play(); else audio.pause();
  };
  const usePlayerTime = () => patch("spaceStartMs", Math.round((audioRef.current?.currentTime ?? 0) * 1000));
  const seek = (ms: number) => {
    setCurrentMs(ms);
    if (audioRef.current) audioRef.current.currentTime = ms / 1000;
  };
  const reset = () => {
    const next = cloneDefault();
    setConfig(next);
    localStorage.setItem("audition-music-config", JSON.stringify(next));
    setMessage("Đã reset về cấu hình mặc định.");
  };
  const save = async () => {
    const normalized = { ...config, updatedAt: new Date().toISOString() };
    const json = JSON.stringify(normalized, null, 2);
    localStorage.setItem("audition-music-config", json);

    try {
      const response = await fetch("/api/music-config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(normalized),
      });
      if (!response.ok) {
        const detail = await response.json().catch(() => ({})) as { detail?: string; error?: string };
        throw new Error(detail.detail || detail.error || `HTTP ${response.status}`);
      }

      const listResponse = await fetch("/api/music-config", { cache: "no-store" });
      if (listResponse.ok) {
        const data = await listResponse.json() as { configs?: MusicConfig[] };
        setLibrary(data.configs ?? []);
      }
      setMessage("Đã lưu JSON + Supabase music_charts.");
    } catch (error) {
      setMessage(`Đã lưu local/JSON; Supabase lỗi: ${error instanceof Error ? error.message : "unknown error"}`);
    }

    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url; link.download = `${normalized.id || "music-chart"}.json`; link.click(); URL.revokeObjectURL(url);
    setConfig(normalized);
  };

  return (
    <main className="music-config-page">
      <header className="config-header">
        <div>
          <span className="eyebrow">CLUB AUDITION / TOOL</span>
          <h1>Music Chart Config</h1>
          <p>Canh audio và khai báo rule để runtime chơi đúng từng bài nhạc.</p>
        </div>
        <div className="header-actions"><button onClick={reset}>RESET</button><button className="primary" onClick={() => void save()}>SAVE JSON + DB</button></div>
      </header>

      <div className="config-layout">
        <aside className="config-panel library-panel">
          <div className="panel-heading"><div><span>LIBRARY</span><h2>Music</h2></div><button onClick={addTrack}>＋ ADD</button></div>
          {library.length === 0 && <div className="storage-note"><b>Supabase connected</b><br />Chưa có chart trong <code>music_charts</code>.<br />Chọn cấu hình mặc định, kiểm tra Audio URL rồi nhấn <b>SAVE JSON + DB</b> để tạo record đầu tiên.</div>}
          {library.map(track => <button key={track.id} className={`library-track ${config.id === track.id ? "active" : ""}`} onClick={() => chooseTrack(track)}><span className="track-cover">♫</span><span><b>{track.title}</b><small>{track.artist || "Unknown artist"} · {track.bpm} BPM</small></span></button>)}
          <div className="storage-note"><b>Storage</b><br />Audio: Supabase Storage / URL<br />Chart: Supabase <code>music_charts</code>.<br /><br />JSON vẫn được export local để backup.</div>
        </aside>

        <section className="config-panel editor-panel">
          <div className="panel-heading"><div><span>EDITOR</span><h2>{config.title}</h2></div><span className="clock-badge">● {formatTime(currentMs)}</span></div>
          <audio ref={audioRef} src={config.audioUrl} preload="metadata" onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onLoadedMetadata={event => patch("durationMs", Math.round(event.currentTarget.duration * 1000))} />

          <div className="audio-player">
            <button className="play-button" onClick={togglePlay}>{playing ? "❚❚" : "▶"}</button>
            <div className="audio-timeline"><input type="range" min="0" max={Math.max(config.durationMs, 1)} value={Math.min(currentMs, Math.max(config.durationMs, 1))} onChange={event => seek(Number(event.target.value))} /><div><span>{formatTime(currentMs)}</span><span>{formatTime(config.durationMs)}</span></div></div>
            <button onClick={() => seek(Math.max(0, currentMs - 5000))}>−5s</button><button onClick={() => seek(Math.min(config.durationMs, currentMs + 5000))}>+5s</button>
          </div>

          <div className="space-card">
            <div className="card-heading"><div><span>TIMING ANCHOR</span><h3>Space start</h3></div><button className="accent-button" onClick={usePlayerTime}>USE PLAYER TIME</button></div>
            <div className="time-editor"><label>MIN<input type="number" min="0" value={parts.m} onChange={e => patch("spaceStartMs", partsToMs(Number(e.target.value), parts.s, parts.ms))} /></label><label>SEC<input type="number" min="0" max="59" value={parts.s} onChange={e => patch("spaceStartMs", partsToMs(parts.m, Number(e.target.value), parts.ms))} /></label><label>MS<input type="number" min="0" max="999" value={parts.ms} onChange={e => patch("spaceStartMs", partsToMs(parts.m, parts.s, Number(e.target.value)))} /></label><output>{formatTime(config.spaceStartMs)}</output></div>
            <p>Đây là <b>space start</b>: SPACE đầu tiên sau countdown, ngay tại zone perfect. Từ space start đến space start kế tiếp = <b>4 beat</b>.</p>
          </div>

          <div className="section-grid">
            <div className="sub-card"><div className="card-heading"><div><span>SONG</span><h3>Track info</h3></div></div><label>Title<input value={config.title} onChange={e => patch("title", e.target.value)} /></label><label>Artist<input value={config.artist ?? ""} onChange={e => patch("artist", e.target.value)} /></label><label>BPM<input type="number" min="1" value={config.bpm} onChange={e => patch("bpm", Number(e.target.value))} /></label><label>Audio URL<input value={config.audioUrl} onChange={e => patch("audioUrl", e.target.value)} /></label></div>
            <div className="sub-card"><div className="card-heading"><div><span>GAUGE</span><h3>Timing zones</h3></div></div><div className="number-grid"><label>Zone start<input type="number" value={config.gauge.zoneStartPercent} onChange={e => patchGauge("zoneStartPercent", Number(e.target.value))} /></label><label>Zone end<input type="number" value={config.gauge.zoneEndPercent} onChange={e => patchGauge("zoneEndPercent", Number(e.target.value))} /></label><label>Perfect start<input type="number" value={config.gauge.perfectStartPercent} onChange={e => patchGauge("perfectStartPercent", Number(e.target.value))} /></label><label>Perfect end<input type="number" value={config.gauge.perfectEndPercent} onChange={e => patchGauge("perfectEndPercent", Number(e.target.value))} /></label></div><div className="gauge-config-preview"><AuditionGauge bpm={config.bpm} value={previewGauge} zoneStart={config.gauge.zoneStartPercent} zoneEnd={config.gauge.zoneEndPercent} perfectStart={config.gauge.perfectStartPercent} perfectEnd={config.gauge.perfectEndPercent} /></div><small>Breath = {config.gauge.breathCycleBeats} beats · stretch = beat {config.gauge.edgeStretchBeat}</small></div>
          </div>

          <div className="sub-card gameplay-card"><div className="card-heading"><div><span>GAMEPLAY</span><h3>Turn / sequence rules</h3></div></div><div className="number-grid six"><label>L1–5 reveal pass<input type="number" value={config.gameplay.commandRevealPasses["1-5"]} onChange={e => patchGameplay("commandRevealPasses", { ...config.gameplay.commandRevealPasses, "1-5": Number(e.target.value) })} /></label><label>L6–9 reveal pass<input type="number" value={config.gameplay.commandRevealPasses["6-9"]} onChange={e => patchGameplay("commandRevealPasses", { ...config.gameplay.commandRevealPasses, "6-9": Number(e.target.value) })} /></label><label>L1–5 miss penalty<input type="number" value={config.gameplay.missPenaltyTurns["1-5"]} onChange={e => patchGameplay("missPenaltyTurns", { ...config.gameplay.missPenaltyTurns, "1-5": Number(e.target.value) })} /></label><label>L6–9 miss penalty<input type="number" value={config.gameplay.missPenaltyTurns["6-9"]} onChange={e => patchGameplay("missPenaltyTurns", { ...config.gameplay.missPenaltyTurns, "6-9": Number(e.target.value) })} /></label><label>Finish hide turns<input type="number" min="0" value={config.gameplay.finishHideTurns} onChange={e => patchGameplay("finishHideTurns", Number(e.target.value))} /></label><label>Resume level<input type="number" min="1" max="9" value={config.gameplay.finishResumeLevel} onChange={e => patchGameplay("finishResumeLevel", Number(e.target.value))} /></label></div><label className="checkbox-row"><input type="checkbox" checked={config.gameplay.finishReverseRequired} onChange={e => patchGameplay("finishReverseRequired", e.target.checked)} /> finish arrow-command bắt buộc có ít nhất 1 reverse arrow</label></div>

          <div className="json-card"><div className="card-heading"><div><span>OUTPUT</span><h3>Chart JSON</h3></div><span>{message}</span></div><pre>{JSON.stringify(config, null, 2)}</pre></div>
        </section>
      </div>
    </main>
  );
}
