"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import WaveSurfer from "wavesurfer.js";
import { detectLeadingAudioStart } from "../game/tempo-analysis";

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

const getZoomPxPerSecond = (zoom: number) => zoom === 1 ? 12 : zoom * 30;
const clampZoom = (zoom: number) => Math.max(1, Math.min(6, zoom));

async function detectTrimStartMs(url: string): Promise<number> {
  if (typeof window === "undefined") return 0;
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) return 0;
  const bytes = await response.arrayBuffer();
  const AudioContextCtor = window.AudioContext ?? (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextCtor) return 0;
  const context = new AudioContextCtor();
  try {
    const buffer = await context.decodeAudioData(bytes.slice(0));
    const mono = new Float32Array(buffer.length);
    for (let channel = 0; channel < buffer.numberOfChannels; channel += 1) {
      const source = buffer.getChannelData(channel);
      for (let index = 0; index < buffer.length; index += 1) mono[index] += source[index] / buffer.numberOfChannels;
    }
    const sample = detectLeadingAudioStart(mono, buffer.sampleRate);
    return Math.max(0, Math.round(sample / buffer.sampleRate * 1000));
  } catch {
    return 0;
  } finally {
    await context.close().catch(() => undefined);
  }
}

const WaveformPlayer = forwardRef<WaveformPlayerHandle, WaveformPlayerProps>(function WaveformPlayer({
  url,
  title,
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
  const callbacksRef = useRef({ onTimeChange, onDurationChange, onPlay, onPause, onReady });
  const gestureRef = useRef<{ mode: "seek" | "pan"; startX: number; startScroll: number } | null>(null);
  const zoomRef = useRef(1);
  const currentMsRef = useRef(0);
  const trimStartMsRef = useRef(0);
  const animationFrameRef = useRef<number | null>(null);
  const lastClockEmitRef = useRef(0);
  const [durationMs, setDurationMs] = useState(0);
  const [currentMs, setCurrentMs] = useState(0);
  const [trimStartMs, setTrimStartMs] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [ready, setReady] = useState(false);
  const [playing, setPlaying] = useState(false);

  callbacksRef.current = { onTimeChange, onDurationChange, onPlay, onPause, onReady };
  zoomRef.current = zoom;
  currentMsRef.current = currentMs;

  const publishMediaTime = (ms: number) => {
    if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent<number>(WAVEFORM_MEDIA_TIME_EVENT, { detail: ms }));
  };

  const emitTime = (ms: number) => {
    const rounded = Math.round(ms);
    currentMsRef.current = rounded;
    setCurrentMs(rounded);
    callbacksRef.current.onTimeChange?.(rounded);
    publishMediaTime(ms);
  };

  const scrollToTime = (wavesurfer: WaveSurfer, seconds: number) => {
    const instance = wavesurfer as WaveSurfer & { setScrollTime?: (time: number) => void };
    instance.setScrollTime?.(Math.max(trimStartMsRef.current / 1000, seconds));
  };

  const seekTo = (ms: number) => {
    const wavesurfer = wavesurferRef.current;
    if (!wavesurfer || !wavesurfer.getDuration()) return;
    const min = trimStartMsRef.current;
    const max = wavesurfer.getDuration() * 1000;
    const next = Math.max(min, Math.min(max, ms));
    wavesurfer.setTime(next / 1000);
    scrollToTime(wavesurfer, next / 1000);
    emitTime(next);
  };

  const previewFrom = (ms: number) => {
    const wavesurfer = wavesurferRef.current;
    if (!wavesurfer || !wavesurfer.getDuration()) return;
    const min = trimStartMsRef.current;
    const max = wavesurfer.getDuration() * 1000;
    const next = Math.max(min, Math.min(max, ms));
    wavesurfer.setTime(next / 1000);
    scrollToTime(wavesurfer, next / 1000);
    void wavesurfer.play();
    emitTime(next);
  };

  const playFromBegin = () => {
    const wavesurfer = wavesurferRef.current;
    if (!wavesurfer || !wavesurfer.getDuration()) return;
    const startMs = trimStartMsRef.current;
    wavesurfer.setTime(startMs / 1000);
    scrollToTime(wavesurfer, startMs / 1000);
    emitTime(startMs);
    void wavesurfer.play();
  };

  useImperativeHandle(ref, () => ({
    seekTo,
    previewFrom,
    playFromBegin,
    getCurrentTimeMs: () => (wavesurferRef.current?.getCurrentTime() ?? trimStartMsRef.current / 1000) * 1000,
  }), []);

  useEffect(() => {
    if (!containerRef.current || !url) return;
    let cancelled = false;
    let wavesurfer: WaveSurfer | null = null;

    const stopClock = () => {
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
    };

    const setup = async () => {
      setReady(false);
      setPlaying(false);
      setCurrentMs(0);
      currentMsRef.current = 0;
      setDurationMs(0);
      setTrimStartMs(0);
      trimStartMsRef.current = 0;

      const detectedTrimMs = await detectTrimStartMs(url);
      if (cancelled || !containerRef.current) return;
      trimStartMsRef.current = detectedTrimMs;
      setTrimStartMs(detectedTrimMs);

      const instance = WaveSurfer.create({
        container: containerRef.current,
        height: 92,
        waveColor: "#a983bd",
        progressColor: "#c32df1",
        cursorColor: "#ff4fa3",
        cursorWidth: 2,
        barWidth: 1,
        barGap: 1,
        barRadius: 2,
        normalize: true,
        minPxPerSec: getZoomPxPerSecond(zoomRef.current),
        fillParent: false,
        dragToSeek: false,
        interact: false,
        autoScroll: true,
        autoCenter: true,
        hideScrollbar: true,
        url,
      });
      wavesurfer = instance;
      wavesurferRef.current = instance;

      const syncClock = () => {
        if (!instance.isPlaying()) {
          animationFrameRef.current = null;
          return;
        }
        const now = performance.now();
        const seconds = Math.max(trimStartMsRef.current / 1000, instance.getCurrentTime());
        const ms = seconds * 1000;
        scrollToTime(instance, seconds);
        publishMediaTime(ms);
        if (now - lastClockEmitRef.current >= 25) {
          const rounded = Math.round(ms);
          currentMsRef.current = rounded;
          setCurrentMs(rounded);
          callbacksRef.current.onTimeChange?.(rounded);
          lastClockEmitRef.current = now;
        }
        animationFrameRef.current = requestAnimationFrame(syncClock);
      };

      const startClock = () => {
        stopClock();
        lastClockEmitRef.current = 0;
        animationFrameRef.current = requestAnimationFrame(syncClock);
      };

      const updateTime = (seconds: number) => emitTime(Math.max(trimStartMsRef.current, seconds * 1000));

      instance.on("ready", duration => {
        const durationTotalMs = Math.round(duration * 1000);
        setDurationMs(durationTotalMs);
        setReady(true);
        const startMs = Math.min(trimStartMsRef.current, durationTotalMs);
        instance.setTime(startMs / 1000);
        scrollToTime(instance, startMs / 1000);
        emitTime(startMs);
        callbacksRef.current.onDurationChange?.(durationTotalMs);
        callbacksRef.current.onReady?.(durationTotalMs);
      });
      instance.on("timeupdate", updateTime);
      instance.on("play", () => {
        if (instance.getCurrentTime() * 1000 < trimStartMsRef.current) instance.setTime(trimStartMsRef.current / 1000);
        setPlaying(true);
        callbacksRef.current.onPlay?.();
        startClock();
      });
      instance.on("pause", () => {
        setPlaying(false);
        stopClock();
        updateTime(instance.getCurrentTime());
        callbacksRef.current.onPause?.();
      });
      instance.on("finish", () => {
        setPlaying(false);
        stopClock();
        updateTime(instance.getCurrentTime());
        callbacksRef.current.onPause?.();
      });
    };

    void setup();

    return () => {
      cancelled = true;
      stopClock();
      wavesurfer?.destroy();
      if (wavesurferRef.current === wavesurfer) wavesurferRef.current = null;
    };
  }, [url]);

  useEffect(() => {
    const wavesurfer = wavesurferRef.current;
    if (!wavesurfer || !ready) return;
    wavesurfer.setOptions({ minPxPerSec: getZoomPxPerSecond(zoom) });
    scrollToTime(wavesurfer, Math.max(trimStartMsRef.current / 1000, wavesurfer.getCurrentTime()));
  }, [zoom, ready]);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;

    const getScroll = (wavesurfer: WaveSurfer) => wavesurfer.getScroll();
    const isZoomControl = (target: EventTarget | null) => target instanceof Element && Boolean(target.closest(".waveform-zoom-controls"));

    const setTimeFromClientX = (clientX: number) => {
      const wavesurfer = wavesurferRef.current;
      if (!wavesurfer || !ready) return;
      const rect = viewport.getBoundingClientRect();
      if (rect.width <= 0) return;
      const pxPerSecond = getZoomPxPerSecond(zoomRef.current);
      const contentX = Math.max(0, getScroll(wavesurfer) + clientX - rect.left);
      const rawSeconds = contentX / Math.max(0.001, pxPerSecond);
      const clamped = Math.max(trimStartMsRef.current / 1000, Math.min(wavesurfer.getDuration(), rawSeconds));
      wavesurfer.setTime(clamped);
      emitTime(clamped * 1000);
    };

    const onTouchStart = (event: TouchEvent) => {
      if (isZoomControl(event.target)) return;
      const wavesurfer = wavesurferRef.current;
      if (!wavesurfer) return;
      if (event.touches.length >= 2) {
        const a = event.touches[0];
        const b = event.touches[1];
        gestureRef.current = { mode: "pan", startX: (a.clientX + b.clientX) / 2, startScroll: getScroll(wavesurfer) };
        event.preventDefault();
        return;
      }
      const touch = event.touches[0];
      if (!touch) return;
      gestureRef.current = { mode: "seek", startX: touch.clientX, startScroll: getScroll(wavesurfer) };
      setTimeFromClientX(touch.clientX);
      event.preventDefault();
    };

    const onTouchMove = (event: TouchEvent) => {
      const gesture = gestureRef.current;
      const wavesurfer = wavesurferRef.current;
      if (!gesture || !wavesurfer) return;
      if (event.touches.length >= 2 && gesture.mode === "pan") {
        const a = event.touches[0];
        const b = event.touches[1];
        const centerX = (a.clientX + b.clientX) / 2;
        const trimPx = trimStartMsRef.current / 1000 * getZoomPxPerSecond(zoomRef.current);
        wavesurfer.setScroll(Math.max(trimPx, gesture.startScroll - (centerX - gesture.startX)));
        event.preventDefault();
        return;
      }
      const touch = event.touches[0];
      if (!touch || gesture.mode !== "seek") return;
      setTimeFromClientX(touch.clientX);
      event.preventDefault();
    };

    const onTouchEnd = () => { gestureRef.current = null; };
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      setZoom(current => clampZoom(current + (event.deltaY < 0 ? 0.5 : -0.5)));
    };

    viewport.addEventListener("touchstart", onTouchStart, { passive: false });
    viewport.addEventListener("touchmove", onTouchMove, { passive: false });
    viewport.addEventListener("touchend", onTouchEnd, { passive: true });
    viewport.addEventListener("touchcancel", onTouchEnd, { passive: true });
    viewport.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      viewport.removeEventListener("touchstart", onTouchStart);
      viewport.removeEventListener("touchmove", onTouchMove);
      viewport.removeEventListener("touchend", onTouchEnd);
      viewport.removeEventListener("touchcancel", onTouchEnd);
      viewport.removeEventListener("wheel", onWheel);
    };
  }, [ready]);

  const seekBy = (deltaMs: number) => seekTo(currentMs + deltaMs);
  const togglePlay = () => {
    const wavesurfer = wavesurferRef.current;
    if (!wavesurfer) return;
    if (!wavesurfer.isPlaying() && wavesurfer.getCurrentTime() * 1000 < trimStartMsRef.current) wavesurfer.setTime(trimStartMsRef.current / 1000);
    void wavesurfer.playPause();
  };
  const currentPercent = durationMs ? Math.min(100, Math.max(0, currentMs / durationMs * 100)) : 0;

  return <div className={`waveform-player ${compact ? "is-compact" : "is-expanded"}`}>
    <div className="waveform-compact-bar"><button className="waveform-compact-play" type="button" onClick={togglePlay} disabled={!ready} aria-label={playing ? "Pause" : "Play"}>{playing ? "Ⅱ" : "▶"}</button><div className="waveform-compact-copy"><strong>{title || "Untitled track"}</strong><span>{formatTime(currentMs)} / {formatTime(durationMs)}</span></div><div className="waveform-compact-progress"><span style={{ width: `${currentPercent}%` }} /></div></div>
    <div className="waveform-expanded-ui">
      <div className="waveform-player-head"><div className="waveform-player-title"><span className={`waveform-live-dot ${playing ? "is-playing" : ""}`} aria-hidden="true" /><div><strong>{title || "Untitled track"}</strong><small>{ready ? `Trimmed begin ${formatTime(trimStartMs)} · 1 finger seek · 2 fingers pan` : "Detecting audio start…"}</small></div></div></div>
      <div ref={viewportRef} className="waveform-viewport"><div className="waveform-zoom-controls" aria-label="Waveform zoom controls"><button type="button" onClick={() => setZoom(current => clampZoom(current - 1))} disabled={zoom <= 1} aria-label="Zoom out">−</button><span>{zoom % 1 === 0 ? zoom : zoom.toFixed(1)}×</span><button type="button" onClick={() => setZoom(current => clampZoom(current + 1))} aria-label="Zoom in">＋</button></div><div ref={containerRef} className="waveform-canvas" aria-label="Interactive audio waveform" />{!ready && <div className="waveform-loading">Detecting audio start…</div>}</div>
      <div className="waveform-controls"><button className="waveform-play-button" type="button" onClick={togglePlay} disabled={!ready} aria-label={playing ? "Pause" : "Play"}>{playing ? "Ⅱ" : "▶"}</button><button className="waveform-nudge" type="button" onClick={playFromBegin} disabled={!ready} aria-label="Play from audible beginning" title="Play from audible beginning">⏮</button>{[-1000, -100, -10, 10, 100, 1000].map(delta => <button key={delta} className="waveform-nudge" type="button" onClick={() => seekBy(delta)} disabled={!ready}>{delta > 0 ? "+" : "−"}{Math.abs(delta) >= 1000 ? `${Math.abs(delta) / 1000}s` : Math.abs(delta)}</button>)}</div>
      <div className="waveform-footer"><span>⏮ play from begin · leading silence hidden · 1 finger seek · 2 fingers pan</span></div>
    </div>
  </div>;
});

export default WaveformPlayer;
