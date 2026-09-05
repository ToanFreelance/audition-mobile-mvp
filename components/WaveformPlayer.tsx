"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";

export const WAVEFORM_MEDIA_TIME_EVENT = "audition:media-time";
export type WaveformMarker = { ms: number; beatIndex: number };
export type WaveformPlayerHandle = {
  seekTo: (ms: number) => void;
  previewFrom: (ms: number) => void;
  playFromBegin: () => void;
  getCurrentTimeMs: () => number;
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

const SimpleAudioPlayer = forwardRef<WaveformPlayerHandle, WaveformPlayerProps>(function SimpleAudioPlayer({
  url,
  title,
  compact = false,
  onTimeChange,
  onDurationChange,
  onPlay,
  onPause,
  onReady,
}, ref) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const callbacksRef = useRef({ onTimeChange, onDurationChange, onPlay, onPause, onReady });
  const rafRef = useRef<number | null>(null);
  const lastReactEmitRef = useRef(0);
  const [durationMs, setDurationMs] = useState(0);
  const [currentMs, setCurrentMs] = useState(0);
  const [ready, setReady] = useState(false);
  const [playing, setPlaying] = useState(false);

  callbacksRef.current = { onTimeChange, onDurationChange, onPlay, onPause, onReady };

  const publishMediaTime = (ms: number) => {
    window.dispatchEvent(new CustomEvent<number>(WAVEFORM_MEDIA_TIME_EVENT, { detail: ms }));
  };

  const emitTime = (ms: number) => {
    const rounded = Math.round(ms);
    setCurrentMs(rounded);
    callbacksRef.current.onTimeChange?.(rounded);
    publishMediaTime(ms);
  };

  const getDurationMs = () => {
    const audio = audioRef.current;
    return audio && Number.isFinite(audio.duration) && audio.duration > 0 ? audio.duration * 1000 : durationMs;
  };

  const setNativeTime = (ms: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    const max = getDurationMs();
    const next = Math.max(0, max > 0 ? Math.min(max, ms) : ms);
    audio.currentTime = next / 1000;
    emitTime(next);
  };

  const seekTo = (ms: number) => setNativeTime(ms);
  const startPlayback = async () => {
    const audio = audioRef.current;
    if (!audio) return;
    // Explicitly restore audible state on every user-triggered play. Earlier iOS
    // resync experiments temporarily muted the media element; Safari can retain
    // that element state across React/deployment updates in the same tab.
    audio.muted = false;
    audio.volume = 1;
    try {
      await audio.play();
    } catch (error) {
      console.warn("Native audio playback failed", error);
    }
  };
  const previewFrom = (ms: number) => {
    if (!audioRef.current) return;
    setNativeTime(ms);
    void startPlayback();
  };
  const playFromBegin = () => {
    if (!audioRef.current) return;
    setNativeTime(0);
    void startPlayback();
  };

  useImperativeHandle(ref, () => ({
    seekTo,
    previewFrom,
    playFromBegin,
    getCurrentTimeMs: () => (audioRef.current?.currentTime ?? 0) * 1000,
  }));

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !url) return;
    audio.muted = false;
    audio.volume = 1;

    const stopClock = () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };

    const syncClock = () => {
      if (audio.paused || audio.ended) {
        rafRef.current = null;
        return;
      }
      const ms = audio.currentTime * 1000;
      publishMediaTime(ms);
      const now = performance.now();
      if (now - lastReactEmitRef.current >= 25) {
        const rounded = Math.round(ms);
        setCurrentMs(rounded);
        callbacksRef.current.onTimeChange?.(rounded);
        lastReactEmitRef.current = now;
      }
      rafRef.current = requestAnimationFrame(syncClock);
    };

    const startClock = () => {
      stopClock();
      lastReactEmitRef.current = 0;
      rafRef.current = requestAnimationFrame(syncClock);
    };

    const markReady = () => {
      if (!Number.isFinite(audio.duration) || audio.duration <= 0) return;
      const total = Math.round(audio.duration * 1000);
      setDurationMs(total);
      setReady(true);
      setCurrentMs(Math.round(audio.currentTime * 1000));
      callbacksRef.current.onDurationChange?.(total);
      callbacksRef.current.onReady?.(total);
    };

    const onPlayNative = () => {
      setPlaying(true);
      callbacksRef.current.onPlay?.();
      startClock();
    };
    const onPauseNative = () => {
      setPlaying(false);
      stopClock();
      emitTime(audio.currentTime * 1000);
      callbacksRef.current.onPause?.();
    };
    const onEndedNative = () => {
      setPlaying(false);
      stopClock();
      emitTime(audio.currentTime * 1000);
      callbacksRef.current.onPause?.();
    };
    const onTimeUpdateNative = () => emitTime(audio.currentTime * 1000);

    audio.addEventListener("loadedmetadata", markReady);
    audio.addEventListener("durationchange", markReady);
    audio.addEventListener("play", onPlayNative);
    audio.addEventListener("pause", onPauseNative);
    audio.addEventListener("ended", onEndedNative);
    audio.addEventListener("timeupdate", onTimeUpdateNative);

    if (audio.readyState >= 1) markReady();
    else audio.load();

    return () => {
      stopClock();
      audio.removeEventListener("loadedmetadata", markReady);
      audio.removeEventListener("durationchange", markReady);
      audio.removeEventListener("play", onPlayNative);
      audio.removeEventListener("pause", onPauseNative);
      audio.removeEventListener("ended", onEndedNative);
      audio.removeEventListener("timeupdate", onTimeUpdateNative);
    };
  }, [url]);

  const seekBy = (deltaMs: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    setNativeTime(audio.currentTime * 1000 + deltaMs);
  };

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) void startPlayback();
    else audio.pause();
  };

  const currentPercent = durationMs ? Math.min(100, Math.max(0, currentMs / durationMs * 100)) : 0;

  return (
    <div className={`waveform-player simple-audio-player ${compact ? "is-compact" : "is-expanded"}`}>
      <audio ref={audioRef} src={url} preload="auto" playsInline muted={false} />

      <div className="waveform-compact-bar">
        <button className="waveform-compact-play" type="button" onClick={togglePlay} disabled={!ready} aria-label={playing ? "Pause" : "Play"}>{playing ? "Ⅱ" : "▶"}</button>
        <div className="waveform-compact-copy"><strong>{title || "Untitled track"}</strong><span>{formatTime(currentMs)} / {formatTime(durationMs)}</span></div>
        <div className="waveform-compact-progress"><span style={{ width: `${currentPercent}%` }} /></div>
      </div>

      <div className="waveform-expanded-ui">
        <div className="waveform-player-head">
          <div className="waveform-player-title">
            <span className={`waveform-live-dot ${playing ? "is-playing" : ""}`} aria-hidden="true" />
            <div><strong>{title || "Untitled track"}</strong><small>native audio only · original media timeline · no waveform / no auto trim</small></div>
          </div>
        </div>

        <div className="simple-audio-time">
          <strong>{formatTime(currentMs)}</strong>
          <span>/ {formatTime(durationMs)}</span>
        </div>

        <input
          className="simple-audio-range"
          type="range"
          min={0}
          max={Math.max(1, durationMs)}
          step={1}
          value={Math.min(currentMs, Math.max(1, durationMs))}
          onChange={event => setNativeTime(Number(event.currentTarget.value))}
          disabled={!ready}
          aria-label="Audio position"
        />

        <div className="waveform-controls">
          <button className="waveform-play-button" type="button" onClick={togglePlay} disabled={!ready} aria-label={playing ? "Pause" : "Play"}>{playing ? "Ⅱ" : "▶"}</button>
          <button className="waveform-nudge" type="button" onClick={playFromBegin} disabled={!ready} aria-label="Play from file beginning" title="Play from file beginning">⏮</button>
          {[-1000, -100, -10, 10, 100, 1000].map(delta => (
            <button key={delta} className="waveform-nudge" type="button" onClick={() => seekBy(delta)} disabled={!ready}>
              {delta > 0 ? "+" : "−"}{Math.abs(delta) >= 1000 ? `${Math.abs(delta) / 1000}s` : Math.abs(delta)}
            </button>
          ))}
        </div>

        <div className="waveform-footer"><span>listen → pause on the desired Space beat → USE CURRENT saves this exact native currentTime</span></div>
      </div>
    </div>
  );
});

export default SimpleAudioPlayer;
