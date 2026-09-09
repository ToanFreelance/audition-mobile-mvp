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

const controlBase = "inline-flex h-10 shrink-0 items-center justify-center rounded-xl border text-[11px] font-black transition active:scale-95 disabled:pointer-events-none disabled:opacity-35";
const darkControl = `${controlBase} border-white/10 bg-slate-950 text-slate-100 shadow-sm hover:bg-slate-900`;
const nudgeControl = `${darkControl} min-w-[52px] px-2 font-mono tracking-tight`;

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
    if (!transport) {
      rafRef.current = null;
      return;
    }
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
    if (!url) {
      setPreparing(false);
      return;
    }

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
    if (transport.playing) pause();
    else void play();
  };

  const currentPercent = durationMs ? Math.min(100, Math.max(0, currentMs / durationMs * 100)) : 0;
  const statusText = preparing ? "Decoding chart audio…" : ready ? "Web Audio · chart timeline ready" : "Waiting for audio";
  const disabled = !ready || preparing;

  if (compact) {
    return (
      <div className="flex min-w-0 items-center gap-2.5">
        <button
          className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-violet-400/40 bg-violet-500/15 text-sm font-black text-violet-300 disabled:opacity-35"
          type="button"
          onClick={togglePlay}
          disabled={disabled}
          aria-label={playing ? "Pause" : "Play"}
        >
          {preparing ? "…" : playing ? "Ⅱ" : "▶"}
        </button>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <strong className="truncate text-[11px] font-extrabold">{title || "Untitled track"}</strong>
            <span className="shrink-0 font-mono text-[9px] text-slate-500">{formatTime(currentMs)} / {formatTime(durationMs)}</span>
          </div>
          <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-slate-500/20">
            <span className="block h-full rounded-full bg-gradient-to-r from-fuchsia-500 to-violet-500" style={{ width: `${currentPercent}%` }} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-w-0">
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <span className={`mt-1 h-2 w-2 shrink-0 rounded-full ${playing ? "bg-fuchsia-400 shadow-[0_0_10px_rgba(232,121,249,.8)]" : "bg-slate-400/50"}`} aria-hidden="true" />
          <div className="min-w-0">
            <strong className="block truncate text-xs font-extrabold">{title || "Untitled track"}</strong>
            <small className="mt-0.5 block truncate text-[9px] text-slate-500">{statusText}</small>
          </div>
        </div>
        <span className="shrink-0 font-mono text-[10px] font-bold text-slate-500">{formatTime(currentMs)} / {formatTime(durationMs)}</span>
      </div>

      <div className="mt-2 flex items-baseline gap-1 font-mono">
        <strong className="text-lg font-black tracking-tight">{formatTime(currentMs)}</strong>
        <span className="text-xs text-slate-500">/ {formatTime(durationMs)}</span>
      </div>

      <input
        className="mt-2 h-5 w-full cursor-pointer accent-fuchsia-500 disabled:cursor-not-allowed disabled:opacity-40"
        type="range"
        min={0}
        max={Math.max(1, durationMs)}
        step={1}
        value={Math.min(currentMs, Math.max(1, durationMs))}
        onChange={event => seekTo(Number(event.currentTarget.value))}
        disabled={disabled}
        aria-label="Audio position"
      />

      <div className="mt-2 grid grid-cols-[42px_42px_minmax(0,1fr)] items-center gap-2">
        <button
          className={`${controlBase} border-fuchsia-400/70 bg-gradient-to-br from-fuchsia-500 to-violet-600 text-white shadow-md shadow-violet-600/20`}
          type="button"
          onClick={togglePlay}
          disabled={disabled}
          aria-label={playing ? "Pause" : "Play"}
          title={playing ? "Pause" : "Play"}
        >
          {preparing ? "…" : playing ? "Ⅱ" : "▶"}
        </button>
        <button className={`${darkControl} w-[42px] px-0`} type="button" onClick={playFromBegin} disabled={disabled} aria-label="Play from beginning" title="Play from beginning">↤</button>

        <div className="min-w-0 overflow-x-auto overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" aria-label="Fine seek controls">
          <div className="flex w-max gap-1.5 pr-1">
            {[-1000, -100, -10, 10, 100, 1000].map(delta => (
              <button
                key={delta}
                className={nudgeControl}
                type="button"
                onClick={() => seekBy(delta)}
                disabled={disabled}
                aria-label={`Seek ${delta > 0 ? "forward" : "back"} ${Math.abs(delta)} milliseconds`}
              >
                {delta > 0 ? "+" : "−"}{Math.abs(delta) >= 1000 ? `${Math.abs(delta) / 1000}s` : Math.abs(delta)}
              </button>
            ))}
          </div>
        </div>
      </div>

      <p className="mt-2 text-[8px] leading-relaxed text-slate-500">Web Audio clock · use ±10/100ms for fine positioning, ±1s for fast listening.</p>
    </div>
  );
});

export default WebAudioChartPlayer;
