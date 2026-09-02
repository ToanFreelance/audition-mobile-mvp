"use client";

import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import WaveSurfer from "wavesurfer.js";

export type WaveformMarker = { ms: number; beatIndex: number };
export type WaveformPlayerHandle = {
  seekTo: (ms: number) => void;
  previewFrom: (ms: number) => void;
};

type WaveformPlayerProps = {
  url: string;
  title?: string;
  markers?: WaveformMarker[];
  selectedMarkerMs?: number | null;
  compact?: boolean;
  onTimeChange?: (ms: number) => void;
  onDurationChange?: (ms: number) => void;
  onPlay?: () => void;
  onPause?: () => void;
  onReady?: (durationMs: number) => void;
};

const formatTime = (ms: number, precision = 3) => {
  const totalSeconds = Math.max(0, ms) / 1000;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds - minutes * 60;
  return `${minutes}:${seconds.toFixed(precision).padStart(precision === 0 ? 2 : precision + 3, "0")}`;
};

const WaveformPlayer = forwardRef<WaveformPlayerHandle, WaveformPlayerProps>(function WaveformPlayer({
  url,
  title,
  markers = [],
  selectedMarkerMs,
  compact = false,
  onTimeChange,
  onDurationChange,
  onPlay,
  onPause,
  onReady,
}, ref) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const wavesurferRef = useRef<WaveSurfer | null>(null);
  const selectedMarkerRef = useRef<number | null | undefined>(selectedMarkerMs);
  const callbacksRef = useRef({ onTimeChange, onDurationChange, onPlay, onPause, onReady });
  const [durationMs, setDurationMs] = useState(0);
  const [currentMs, setCurrentMs] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [ready, setReady] = useState(false);
  const [playing, setPlaying] = useState(false);

  callbacksRef.current = { onTimeChange, onDurationChange, onPlay, onPause, onReady };
  selectedMarkerRef.current = selectedMarkerMs;

  const markerList = useMemo(() => {
    const sorted = markers.filter(marker => marker.ms >= 0).sort((a, b) => a.ms - b.ms);
    if (zoom <= 1) return sorted.filter((_, index) => index % 32 === 0);
    if (zoom === 2) return sorted.filter((_, index) => index % 16 === 0);
    if (zoom === 3) return sorted.filter((_, index) => index % 8 === 0);
    if (zoom === 4) return sorted.filter((_, index) => index % 4 === 0);
    if (zoom === 5) return sorted.filter((_, index) => index % 2 === 0);
    return sorted;
  }, [markers, zoom]);

  const emitTime = (ms: number) => {
    const rounded = Math.round(ms);
    setCurrentMs(rounded);
    callbacksRef.current.onTimeChange?.(rounded);
  };

  const seekTo = (ms: number) => {
    const wavesurfer = wavesurferRef.current;
    if (!wavesurfer) return;
    const duration = wavesurfer.getDuration() * 1000;
    const next = Math.max(0, Math.min(duration || Infinity, ms));
    wavesurfer.setTime(next / 1000);
    emitTime(next);
  };

  const previewFrom = (ms: number) => {
    const wavesurfer = wavesurferRef.current;
    if (!wavesurfer || !wavesurfer.getDuration()) return;
    const next = Math.max(0, Math.min(wavesurfer.getDuration() * 1000, ms));
    wavesurfer.setTime(next / 1000);
    emitTime(next);
    // Keep play() directly in the caller's click/tap call stack for iOS Safari.
    void wavesurfer.play();
  };

  useImperativeHandle(ref, () => ({ seekTo, previewFrom }), [url, ready]);

  useEffect(() => {
    if (!containerRef.current || !url) return;
    const wavesurfer = WaveSurfer.create({
      container: containerRef.current,
      height: 132,
      waveColor: "#a983bd",
      progressColor: "#c32df1",
      cursorColor: "#ff4fa3",
      cursorWidth: 2,
      barWidth: 1,
      barGap: 1,
      barRadius: 2,
      normalize: true,
      dragToSeek: true,
      interact: true,
      autoScroll: true,
      autoCenter: true,
      hideScrollbar: true,
      url,
    });
    wavesurferRef.current = wavesurfer;
    setReady(false);
    setPlaying(false);
    setCurrentMs(0);
    setDurationMs(0);

    const updateTime = (seconds: number) => emitTime(seconds * 1000);
    wavesurfer.on("ready", duration => {
      const ms = Math.round(duration * 1000);
      setDurationMs(ms);
      setReady(true);
      callbacksRef.current.onDurationChange?.(ms);
      callbacksRef.current.onReady?.(ms);
    });
    wavesurfer.on("timeupdate", updateTime);
    wavesurfer.on("interaction", () => updateTime(wavesurfer.getCurrentTime()));
    wavesurfer.on("play", () => {
      setPlaying(true);
      callbacksRef.current.onPlay?.();
    });
    wavesurfer.on("pause", () => {
      setPlaying(false);
      callbacksRef.current.onPause?.();
    });
    wavesurfer.on("finish", () => {
      setPlaying(false);
      callbacksRef.current.onPause?.();
    });

    // iOS can still treat the page as the scroll target when a touch starts
    // over a nested waveform. Explicitly cancel the page's touch-pan here;
    // WaveSurfer continues to receive pointer events for drag-to-seek.
    const viewport = viewportRef.current;
    const preventPagePan = (event: TouchEvent) => {
      if (event.cancelable) event.preventDefault();
    };
    viewport?.addEventListener("touchmove", preventPagePan, { passive: false });
    viewport?.addEventListener("touchstart", preventPagePan, { passive: false });

    return () => {
      viewport?.removeEventListener("touchmove", preventPagePan);
      viewport?.removeEventListener("touchstart", preventPagePan);
      wavesurfer.destroy();
      wavesurferRef.current = null;
    };
  }, [url]);

  useEffect(() => {
    const wavesurfer = wavesurferRef.current;
    if (!wavesurfer || !ready) return;
    wavesurfer.setOptions({ minPxPerSec: zoom === 1 ? 0 : zoom * 30 });
  }, [zoom, ready]);

  const seekBy = (deltaMs: number) => seekTo(currentMs + deltaMs);
  const togglePlay = () => { void wavesurferRef.current?.playPause(); };
  const currentPercent = durationMs ? Math.min(100, Math.max(0, currentMs / durationMs * 100)) : 0;

  return <div className={`waveform-player ${compact ? "is-compact" : "is-expanded"}`}>
    <div className="waveform-compact-bar"><button className="waveform-compact-play" type="button" onClick={togglePlay} disabled={!ready} aria-label={playing ? "Pause" : "Play"}>{playing ? "Ⅱ" : "▶"}</button><div className="waveform-compact-copy"><strong>{title || "Untitled track"}</strong><span>{formatTime(currentMs)} / {formatTime(durationMs)}</span></div><div className="waveform-compact-progress"><span style={{ width: `${currentPercent}%` }} /></div></div>
    <div className="waveform-expanded-ui">
      <div className="waveform-player-head"><div className="waveform-player-title"><span className={`waveform-live-dot ${playing ? "is-playing" : ""}`} aria-hidden="true" /><div><strong>{title || "Untitled track"}</strong><small>{ready ? "Interactive waveform" : "Preparing waveform…"}</small></div></div><div className="waveform-time"><strong>{formatTime(currentMs)}</strong><span>/ {formatTime(durationMs)}</span></div></div>
      <div ref={viewportRef} className="waveform-viewport">
        <div ref={containerRef} className="waveform-canvas" aria-label="Interactive audio waveform" />
        <div className="waveform-marker-layer">
          {durationMs > 0 && markerList.map(marker => <button key={`${marker.beatIndex}-${marker.ms}`} className={`waveform-marker ${selectedMarkerMs === marker.ms ? "is-selected" : ""}`} style={{ left: `${Math.min(100, Math.max(0, marker.ms / durationMs * 100))}%` }} onClick={() => seekTo(marker.ms)} type="button" aria-label={`Beat ${marker.beatIndex} at ${formatTime(marker.ms)}`}><span>{marker.beatIndex}</span></button>)}
          {durationMs > 0 && selectedMarkerMs != null && <div className="waveform-anchor-line" style={{ left: `${Math.min(100, Math.max(0, selectedMarkerMs / durationMs * 100))}%` }}><span>SPACE START</span></div>}
          <div className="waveform-position-line" style={{ left: `${currentPercent}%` }} />
        </div>
        {!ready && <div className="waveform-loading">Preparing waveform…</div>}
      </div>
      <div className="waveform-controls"><button className="waveform-play-button" type="button" onClick={togglePlay} disabled={!ready} aria-label={playing ? "Pause" : "Play"}>{playing ? "Ⅱ" : "▶"}</button><button className="waveform-nudge" type="button" onClick={() => seekBy(-1000)} disabled={!ready}>−1s</button><button className="waveform-nudge" type="button" onClick={() => seekBy(-100)} disabled={!ready}>−100</button><button className="waveform-nudge" type="button" onClick={() => seekBy(-10)} disabled={!ready}>−10</button><button className="waveform-current" type="button" onClick={() => callbacksRef.current.onTimeChange?.(currentMs)} disabled={!ready}>{formatTime(currentMs)}</button><button className="waveform-nudge" type="button" onClick={() => seekBy(10)} disabled={!ready}>+10</button><button className="waveform-nudge" type="button" onClick={() => seekBy(100)} disabled={!ready}>+100</button><button className="waveform-nudge" type="button" onClick={() => seekBy(1000)} disabled={!ready}>+1s</button></div>
      <div className="waveform-footer"><div className="waveform-zoom"><span>ZOOM</span><button type="button" onClick={() => setZoom(current => Math.max(1, current - 1))} disabled={zoom <= 1}>−</button><span>{zoom}×</span><button type="button" onClick={() => setZoom(current => Math.min(6, current + 1))}>+</button></div><span>Drag to seek · markers adapt to zoom</span></div>
    </div>
  </div>;
});

export default WaveformPlayer;
