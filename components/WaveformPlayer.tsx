"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";

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

const PRIME_PLAY_MS = 1200;

const formatTime = (ms: number, precision = 3) => {
  const secondsTotal = Math.max(0, ms) / 1000;
  const minutes = Math.floor(secondsTotal / 60);
  const seconds = secondsTotal - minutes * 60;
  return `${minutes}:${seconds.toFixed(precision).padStart(precision === 0 ? 2 : precision + 3, "0")}`;
};

const wait = (ms: number) => new Promise<void>(resolve => window.setTimeout(resolve, ms));

const waitForSeeked = (audio: HTMLAudioElement, timeoutMs = 1000) => new Promise<void>(resolve => {
  let done = false;
  const finish = () => {
    if (done) return;
    done = true;
    audio.removeEventListener("seeked", onSeeked);
    window.clearTimeout(timer);
    resolve();
  };
  const onSeeked = () => finish();
  const timer = window.setTimeout(finish, timeoutMs);
  audio.addEventListener("seeked", onSeeked, { once: true });
});

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
  const primedRef = useRef(false);
  const primingRef = useRef(false);
  const [durationMs, setDurationMs] = useState(0);
  const [currentMs, setCurrentMs] = useState(0);
  const [ready, setReady] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [priming, setPriming] = useState(false);
  const [primed, setPrimed] = useState(false);

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

  const ensureAudible = (audio: HTMLAudioElement) => {
    audio.muted = false;
    audio.volume = 1;
  };

  const playNative = async (audio: HTMLAudioElement) => {
    ensureAudible(audio);
    try {
      await audio.play();
      return true;
    } catch (error) {
      console.warn("Native audio playback failed", error);
      return false;
    }
  };

  const primeAndPlay = async (requestedStartMs: number) => {
    const audio = audioRef.current;
    if (!audio || primingRef.current) return;

    if (primedRef.current) {
      setNativeTime(requestedStartMs);
      await playNative(audio);
      return;
    }

    primingRef.current = true;
    setPriming(true);
    const max = getDurationMs();
    const targetMs = Math.max(0, max > 0 ? Math.min(max, requestedStartMs) : requestedStartMs);

    try {
      // Prime the actual iOS media decoder/output path, not a separate WebAudio
      // clock. The first 1.2s are intentionally inaudible, then we perform a
      // real seek back to the exact requested timestamp while playback is live.
      audio.muted = true;
      audio.volume = 1;
      audio.currentTime = targetMs / 1000;
      const started = await audio.play().then(() => true).catch(error => {
        console.warn("Native audio priming failed", error);
        return false;
      });
      if (!started) return;

      await wait(PRIME_PLAY_MS);

      const seekPromise = waitForSeeked(audio);
      audio.currentTime = targetMs / 1000;
      await seekPromise;

      emitTime(targetMs);
      primedRef.current = true;
      setPrimed(true);
      ensureAudible(audio);
    } finally {
      primingRef.current = false;
      setPriming(false);
      // Never leave the element muted if priming is interrupted or Safari
      // rejects one of the media operations.
      if (audioRef.current === audio) ensureAudible(audio);
    }
  };

  const startPlayback = async () => {
    const audio = audioRef.current;
    if (!audio || primingRef.current) return;
    const targetMs = audio.currentTime * 1000;
    if (!primedRef.current) {
      await primeAndPlay(targetMs);
      return;
    }
    await playNative(audio);
  };

  const seekTo = (ms: number) => setNativeTime(ms);
  const previewFrom = (ms: number) => {
    if (!audioRef.current) return;
    if (!primedRef.current) {
      void primeAndPlay(ms);
      return;
    }
    setNativeTime(ms);
    void startPlayback();
  };
  const playFromBegin = () => {
    if (!audioRef.current) return;
    if (!primedRef.current) {
      void primeAndPlay(0);
      return;
    }
    setNativeTime(0);
    void startPlayback();
  };

  useImperativeHandle(ref, () => ({
    seekTo,
    previewFrom,
    playFromBegin,
    getCurrentTimeMs: () => (audioRef.current?.currentTime ?? 0) * 1000,
    isPrimed: () => primedRef.current,
  }));

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !url) return;

    primedRef.current = false;
    primingRef.current = false;
    setPrimed(false);
    setPriming(false);
    ensureAudible(audio);

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
      // During the muted priming window we deliberately do not propagate the
      // warm-up position into the chart UI. The editor stays at requestedStart.
      if (!primingRef.current) {
        const now = performance.now();
        if (now - lastReactEmitRef.current >= 25) {
          const rounded = Math.round(ms);
          setCurrentMs(rounded);
          callbacksRef.current.onTimeChange?.(rounded);
          lastReactEmitRef.current = now;
        }
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
      const nowMs = Math.round(audio.currentTime * 1000);
      setCurrentMs(nowMs);
      callbacksRef.current.onDurationChange?.(total);
      callbacksRef.current.onReady?.(total);
    };

    const onPlayNative = () => {
      setPlaying(true);
      if (!primingRef.current) callbacksRef.current.onPlay?.();
      startClock();
    };
    const onPauseNative = () => {
      setPlaying(false);
      stopClock();
      if (!primingRef.current) {
        emitTime(audio.currentTime * 1000);
        callbacksRef.current.onPause?.();
      }
    };
    const onEndedNative = () => {
      setPlaying(false);
      stopClock();
      if (!primingRef.current) {
        emitTime(audio.currentTime * 1000);
        callbacksRef.current.onPause?.();
      }
    };
    const onTimeUpdateNative = () => {
      if (!primingRef.current) emitTime(audio.currentTime * 1000);
    };

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
      primingRef.current = false;
      audio.muted = false;
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
    if (!audio || primingRef.current) return;
    setNativeTime(audio.currentTime * 1000 + deltaMs);
  };

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio || primingRef.current) return;
    if (audio.paused) void startPlayback();
    else audio.pause();
  };

  const currentPercent = durationMs ? Math.min(100, Math.max(0, currentMs / durationMs * 100)) : 0;
  const statusText = priming
    ? "priming iOS audio pipeline…"
    : primed
      ? "PRIMED · native audio timeline ready"
      : "native audio · first Play will prime decoder";

  return (
    <div className={`waveform-player simple-audio-player ${compact ? "is-compact" : "is-expanded"}`}>
      <audio ref={audioRef} src={url} preload="auto" playsInline muted={priming} />

      <div className="waveform-compact-bar">
        <button className="waveform-compact-play" type="button" onClick={togglePlay} disabled={!ready || priming} aria-label={playing ? "Pause" : "Play"}>{priming ? "…" : playing ? "Ⅱ" : "▶"}</button>
        <div className="waveform-compact-copy"><strong>{title || "Untitled track"}</strong><span>{formatTime(currentMs)} / {formatTime(durationMs)}</span></div>
        <div className="waveform-compact-progress"><span style={{ width: `${currentPercent}%` }} /></div>
      </div>

      <div className="waveform-expanded-ui">
        <div className="waveform-player-head">
          <div className="waveform-player-title">
            <span className={`waveform-live-dot ${playing && !priming ? "is-playing" : ""}`} aria-hidden="true" />
            <div><strong>{title || "Untitled track"}</strong><small>{statusText}</small></div>
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
          disabled={!ready || priming}
          aria-label="Audio position"
        />

        <div className="waveform-controls">
          <button className="waveform-play-button" type="button" onClick={togglePlay} disabled={!ready || priming} aria-label={playing ? "Pause" : "Play"}>{priming ? "…" : playing ? "Ⅱ" : "▶"}</button>
          <button className="waveform-nudge" type="button" onClick={playFromBegin} disabled={!ready || priming} aria-label="Play from file beginning" title="Play from file beginning">⏮</button>
          {[-1000, -100, -10, 10, 100, 1000].map(delta => (
            <button key={delta} className="waveform-nudge" type="button" onClick={() => seekBy(delta)} disabled={!ready || priming}>
              {delta > 0 ? "+" : "−"}{Math.abs(delta) >= 1000 ? `${Math.abs(delta) / 1000}s` : Math.abs(delta)}
            </button>
          ))}
        </div>

        <div className="waveform-footer"><span>first Play primes decoder for 1.2s muted → exact seek back → audible chart playback</span></div>
      </div>
    </div>
  );
});

export default SimpleAudioPlayer;
