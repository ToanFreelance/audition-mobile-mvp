"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import WaveSurfer from "wavesurfer.js";

export type WaveformMarker = { ms: number; beatIndex: number };
type WaveformPlayerProps = { url: string; title?: string; markers?: WaveformMarker[]; selectedMarkerMs?: number | null; compact?: boolean; onTimeChange?: (ms: number) => void; onDurationChange?: (ms: number) => void; onPlay?: () => void; onPause?: () => void; onReady?: (durationMs: number) => void };

const formatTime = (ms: number, precision = 3) => {
  const totalSeconds = Math.max(0, ms) / 1000;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds - minutes * 60;
  return `${minutes}:${seconds.toFixed(precision).padStart(precision === 0 ? 2 : precision + 3, "0")}`;
};

export default function WaveformPlayer({ url, title, markers = [], selectedMarkerMs, compact = false, onTimeChange, onDurationChange, onPlay, onPause, onReady }: WaveformPlayerProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const wavesurferRef = useRef<WaveSurfer | null>(null);
  const callbacksRef = useRef({ onTimeChange, onDurationChange, onPlay, onPause, onReady });
  const [durationMs, setDurationMs] = useState(0);
  const [currentMs, setCurrentMs] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [ready, setReady] = useState(false);
  const [playing, setPlaying] = useState(false);
  callbacksRef.current = { onTimeChange, onDurationChange, onPlay, onPause, onReady };
  const markerList = useMemo(() => markers.filter(marker => marker.ms >= 0), [markers]);

  useEffect(() => {
    if (!containerRef.current || !url) return;
    const wavesurfer = WaveSurfer.create({ container: containerRef.current, height: 132, waveColor: "#b78ad0", progressColor: "#c32df1", cursorColor: "#ff4fa3", cursorWidth: 2, barWidth: 2, barGap: 2, barRadius: 3, normalize: true, dragToSeek: true, interact: true, autoScroll: true, autoCenter: true, hideScrollbar: true, url });
    wavesurferRef.current = wavesurfer;
    setReady(false); setPlaying(false); setCurrentMs(0); setDurationMs(0);
    const updateTime = (seconds: number) => { const ms = Math.round(seconds * 1000); setCurrentMs(ms); callbacksRef.current.onTimeChange?.(ms); };
    wavesurfer.on("ready", duration => { const ms = Math.round(duration * 1000); setDurationMs(ms); setReady(true); callbacksRef.current.onDurationChange?.(ms); callbacksRef.current.onReady?.(ms); });
    wavesurfer.on("timeupdate", updateTime);
    wavesurfer.on("interaction", () => updateTime(wavesurfer.getCurrentTime()));
    wavesurfer.on("play", () => { setPlaying(true); callbacksRef.current.onPlay?.(); });
    wavesurfer.on("pause", () => { setPlaying(false); callbacksRef.current.onPause?.(); });
    wavesurfer.on("finish", () => { setPlaying(false); callbacksRef.current.onPause?.(); });
    return () => { wavesurfer.destroy(); wavesurferRef.current = null; };
  }, [url]);

  useEffect(() => { const wavesurfer = wavesurferRef.current; if (!wavesurfer || !ready) return; wavesurfer.setOptions({ minPxPerSec: zoom === 1 ? 0 : zoom * 30 }); }, [zoom, ready]);

  const seekBy = (deltaMs: number) => { const wavesurfer = wavesurferRef.current; if (!wavesurfer) return; const next = Math.max(0, Math.min(durationMs || Infinity, wavesurfer.getCurrentTime() * 1000 + deltaMs)); wavesurfer.setTime(next / 1000); setCurrentMs(Math.round(next)); callbacksRef.current.onTimeChange?.(Math.round(next)); };
  const seekTo = (ms: number) => { const wavesurfer = wavesurferRef.current; if (!wavesurfer) return; const next = Math.max(0, Math.min(durationMs || Infinity, ms)); wavesurfer.setTime(next / 1000); setCurrentMs(Math.round(next)); callbacksRef.current.onTimeChange?.(Math.round(next)); };
  const togglePlay = () => { void wavesurferRef.current?.playPause(); };
  const currentPercent = durationMs ? Math.min(100, Math.max(0, currentMs / durationMs * 100)) : 0;

  return <div className={`waveform-player ${compact ? "is-compact" : "is-expanded"}`}>
    <div ref={containerRef} className="waveform-engine" aria-hidden="true" />
    <div className="waveform-compact-bar">
      <button className="waveform-compact-play" type="button" onClick={togglePlay} disabled={!ready} aria-label={playing ? "Pause" : "Play"}>{playing ? "Ⅱ" : "▶"}</button>
      <div className="waveform-compact-copy"><strong>{title || "Untitled track"}</strong><span>{formatTime(currentMs)} / {formatTime(durationMs)}</span></div>
      <div className="waveform-compact-progress"><span style={{ width: `${currentPercent}%` }} /></div>
    </div>
    <div className="waveform-expanded-ui">
      <div className="waveform-player-head"><div className="waveform-player-title"><span className={`waveform-live-dot ${playing ? "is-playing" : ""}`} aria-hidden="true" /><div><strong>{title || "Untitled track"}</strong><small>{ready ? "Interactive waveform" : "Preparing waveform…"}</small></div></div><div className="waveform-time"><strong>{formatTime(currentMs)}</strong><span>/ {formatTime(durationMs)}</span></div></div>
      <div className="waveform-viewport"><div className="waveform-visual"><div className="waveform-canvas-slot" /></div><div className="waveform-marker-layer">{durationMs > 0 && markerList.map(marker => <button key={`${marker.beatIndex}-${marker.ms}`} className={`waveform-marker ${selectedMarkerMs === marker.ms ? "is-selected" : ""}`} style={{ left: `${Math.min(100, Math.max(0, marker.ms / durationMs * 100))}%` }} onClick={() => seekTo(marker.ms)} type="button" aria-label={`Beat ${marker.beatIndex} at ${formatTime(marker.ms)}`}><span>{marker.beatIndex}</span></button>)}{durationMs > 0 && selectedMarkerMs != null && <div className="waveform-anchor-line" style={{ left: `${Math.min(100, Math.max(0, selectedMarkerMs / durationMs * 100))}%` }}><span>SPACE START</span></div>}<div className="waveform-position-line" style={{ left: `${currentPercent}%` }} /></div>{!ready && <div className="waveform-loading">Preparing waveform…</div>}</div>
      <div className="waveform-controls"><button className="waveform-play-button" type="button" onClick={togglePlay} disabled={!ready} aria-label={playing ? "Pause" : "Play"}>{playing ? "Ⅱ" : "▶"}</button><button className="waveform-nudge" type="button" onClick={() => seekBy(-1000)} disabled={!ready}>−1s</button><button className="waveform-nudge" type="button" onClick={() => seekBy(-100)} disabled={!ready}>−100</button><button className="waveform-nudge" type="button" onClick={() => seekBy(-10)} disabled={!ready}>−10</button><button className="waveform-current" type="button" onClick={() => callbacksRef.current.onTimeChange?.(currentMs)} disabled={!ready}>{formatTime(currentMs)}</button><button className="waveform-nudge" type="button" onClick={() => seekBy(10)} disabled={!ready}>+10</button><button className="waveform-nudge" type="button" onClick={() => seekBy(100)} disabled={!ready}>+100</button><button className="waveform-nudge" type="button" onClick={() => seekBy(1000)} disabled={!ready}>+1s</button></div>
      <div className="waveform-footer"><div className="waveform-zoom"><span>ZOOM</span><button type="button" onClick={() => setZoom(current => Math.max(1, current - 1))} disabled={zoom <= 1}>−</button><span>{zoom}×</span><button type="button" onClick={() => setZoom(current => Math.min(6, current + 1))}>+</button></div><span>Drag to seek · tap a marker to jump</span></div>
    </div>
  </div>;
}
