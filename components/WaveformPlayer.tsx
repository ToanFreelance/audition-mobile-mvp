"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { WebAudioTransport } from "../game/web-audio-transport";

export const WAVEFORM_MEDIA_TIME_EVENT = "audition:media-time";
export type WaveformMarker = { ms: number; beatIndex: number };
export type WaveformPlayerHandle = {
  seekTo: (ms: number) => void;
  previewFrom: (ms: number) => void;
  playFromBegin: () => void;
  getCurrentTimeMs: () => number;
  isPrimed: () => boolean;
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
  const secondsTotal = Math.max(0, ms) / 1000;
  const minutes = Math.floor(secondsTotal / 60);
  const seconds = secondsTotal - minutes * 60;
  return `${minutes}:${seconds.toFixed(precision).padStart(precision === 0 ? 2 : precision + 3, "0")}`;
};

const WebAudioChartPlayer = forwardRef<WaveformPlayerHandle, WaveformPlayerProps>(function WebAudioChartPlayer({
  url,
  title,
  compact = false,
  onTimeChange,
  onDurationChange,
  onPlay,
  onPause,
  onReady,
}, ref) {
  const transportRef = useRef<WebAudioTransport | null>(null);
  const callbacksRef = useRef({ onTimeChange, onDurationChange, onPlay, onPause, onReady });
  const rafRef = useRef<number | null>(null);
  const [durationMs, setDurationMs] = useState(0);
  const [currentMs, setCurrentMs] = useState(0);
  const [ready, setReady] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [preparing, setPreparing] = useState(false);

  callbacksRef.current = { onTimeChange, onDurationChange, onPlay, onPause, onReady };

  const publishTime = (ms: number) => {
    window.dispatchEvent(new CustomEvent<number>(WAVEFORM_MEDIA_TIME_EVENT, { detail: ms }));
  };

  const emitTime = (ms: number) => {
    const rounded = Math.round(ms);
    setCurrentMs(rounded);
    callbacksRef.current.onTimeChange?.(rounded);
    publishTime(ms);
  };

  const stopClock = () => {
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
  };

  const tick = () => {
    const transport = transportRef.current;
    if (!transport) { rafRef.current = null; return; }
    const ms = transport.getCurrentTimeMs();
    emitTime(ms);
    if (!transport.playing) {
      setPlaying(false);
      rafRef.current = null;
      callbacksRef.current.onPause?.();
      return;
    }
    rafRef.current = requestAnimationFrame(tick);
  };

  const startClock = () => {
    stopClock();
    rafRef.current = requestAnimationFrame(tick);
  };

  const play = async () => {
    const transport = transportRef.current;
    if (!transport || preparing) return;
    try {
      await transport.play();
      setPlaying(true);
      callbacksRef.current.onPlay?.();
      startClock();
    } catch (error) {
      console.warn("WebAudio chart playback failed", error);
    }
  };

  const pause = () => {
    const transport = transportRef.current;
    if (!transport) return;
    transport.pause();
    stopClock();
    setPlaying(false);
    emitTime(transport.getCurrentTimeMs());
    callbacksRef.current.onPause?.();
  };

  const seekTo = (ms: number) => {
    const transport = transportRef.current;
    if (!transport) return;
    transport.seek(ms);
    emitTime(transport.getCurrentTimeMs());
    if (transport.playing) startClock();
  };

  const previewFrom = (ms: number) => {
    seekTo(ms);
    void play();
  };

  const playFromBegin = () => {
    const transport = transportRef.current;
    if (!transport) return;
    transport.reset();
    emitTime(0);
    void play();
  };

  useImperativeHandle(ref, () => ({
    seekTo,
    previewFrom,
    playFromBegin,
    getCurrentTimeMs: () => transportRef.current?.getCurrentTimeMs() ?? 0,
    isPrimed: () => Boolean(transportRef.current?.ready),
  }));

  useEffect(() => {
    let cancelled = false;
    stopClock();
    setReady(false);
    setPlaying(false);
    setPreparing(Boolean(url));
    setDurationMs(0);
    setCurrentMs(0);

    const previous = transportRef.current;
    transportRef.current = null;
    if (previous) void previous.destroy();
    if (!url) { setPreparing(false); return; }

    const transport = new WebAudioTransport(url);
    transportRef.current = transport;
    void transport.prepare().then(() => {
      if (cancelled || transportRef.current !== transport) return;
      const total = Math.round(transport.durationMs);
      setDurationMs(total);
      setReady(true);
      setPreparing(false);
      callbacksRef.current.onDurationChange?.(total);
      callbacksRef.current.onReady?.(total);
      emitTime(0);
    }).catch(error => {
      if (cancelled) return;
      setPreparing(false);
      console.warn("WebAudio chart prepare failed", error);
    });

    return () => {
      cancelled = true;
      stopClock();
      if (transportRef.current === transport) transportRef.current = null;
      void transport.destroy();
    };
  }, [url]);

  const seekBy = (deltaMs: number) => seekTo((transportRef.current?.getCurrentTimeMs() ?? 0) + deltaMs);

  const togglePlay = () => {
    const transport = transportRef.current;
    if (!transport || !ready || preparing) return;
    if (transport.playing) pause(); else void play();
  };

  const currentPercent = durationMs ? Math.min(100, Math.max(0, currentMs / durationMs * 100)) : 0;
  const statusText = preparing ? "decoding chart audio…" : ready ? "WEB AUDIO · chart timeline ready" : "waiting for audio";

  return (
    <div className={`waveform-player simple-audio-player ${compact ? "is-compact" : "is-expanded"}`}>
      <div className="waveform-compact-bar">
        <button className="waveform-compact-play" type="button" onClick={togglePlay} disabled={!ready || preparing} aria-label={playing ? "Pause" : "Play"}>{preparing ? "…" : playing ? "Ⅱ" : "▶"}</button>
        <div className="waveform-compact-copy"><strong>{title || "Untitled track"}</strong><span>{formatTime(currentMs)} / {formatTime(durationMs)}</span></div>
        <div className="waveform-compact-progress"><span style={{ width: `${currentPercent}%` }} /></div>
      </div>

      <div className="waveform-expanded-ui">
        <div className="waveform-player-head"><div className="waveform-player-title"><span className={`waveform-live-dot ${playing ? "is-playing" : ""}`} aria-hidden="true" /><div><strong>{title || "Untitled track"}</strong><small>{statusText}</small></div></div></div>
        <div className="simple-audio-time"><strong>{formatTime(currentMs)}</strong><span>/ {formatTime(durationMs)}</span></div>
        <input className="simple-audio-range" type="range" min={0} max={Math.max(1, durationMs)} step={1} value={Math.min(currentMs, Math.max(1, durationMs))} onChange={event => seekTo(Number(event.currentTarget.value))} disabled={!ready || preparing} aria-label="Audio position" />
        <div className="waveform-controls">
          <button className="waveform-play-button" type="button" onClick={togglePlay} disabled={!ready || preparing} aria-label={playing ? "Pause" : "Play"}>{preparing ? "…" : playing ? "Ⅱ" : "▶"}</button>
          <button className="waveform-nudge" type="button" onClick={playFromBegin} disabled={!ready || preparing} aria-label="Play from file beginning" title="Play from file beginning">⏮</button>
          {[-1000, -100, -10, 10, 100, 1000].map(delta => <button key={delta} className="waveform-nudge" type="button" onClick={() => seekBy(delta)} disabled={!ready || preparing}>{delta > 0 ? "+" : "−"}{Math.abs(delta) >= 1000 ? `${Math.abs(delta) / 1000}s` : Math.abs(delta)}</button>)}
        </div>
        <div className="waveform-footer"><span>Web Audio chart clock · choose the exact moment for the first SPACE, then BPM drives every next 4-beat turn</span></div>
      </div>
    </div>
  );
});

export default WebAudioChartPlayer;
