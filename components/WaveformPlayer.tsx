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
  const totalSeconds = Math.max(0, ms) / 1000;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds - minutes * 60;
  return `${minutes}:${seconds.toFixed(precision).padStart(precision === 0 ? 2 : precision + 3, "0")}`;
};

const getZoomPxPerSecond = (zoom: number) => zoom === 1 ? 12 : zoom * 30;
const clampZoom = (zoom: number) => Math.max(1, Math.min(6, zoom));
const IOS_RESYNC_DELAY_MS = 1200;
const IOS_RESYNC_BACK_MS = 1000;

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
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const wavesurferRef = useRef<WaveSurfer | null>(null);
  const callbacksRef = useRef({ onTimeChange, onDurationChange, onPlay, onPause, onReady });
  const trimStartMsRef = useRef(0);
  const zoomRef = useRef(1);
  const rafRef = useRef<number | null>(null);
  const lastReactEmitRef = useRef(0);
  const decoderPrimedRef = useRef(false);
  const resyncTimerRef = useRef<number | null>(null);
  const resyncReturnMsRef = useRef<number | null>(null);
  const resyncStageRef = useRef<"idle" | "back" | "return">("idle");
  const resyncWasMutedRef = useRef(false);
  const [durationMs, setDurationMs] = useState(0);
  const [currentMs, setCurrentMs] = useState(0);
  const [trimStartMs, setTrimStartMs] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [ready, setReady] = useState(false);
  const [playing, setPlaying] = useState(false);

  callbacksRef.current = { onTimeChange, onDurationChange, onPlay, onPause, onReady };
  zoomRef.current = zoom;

  const publishMediaTime = (ms: number) => {
    window.dispatchEvent(new CustomEvent<number>(WAVEFORM_MEDIA_TIME_EVENT, { detail: ms }));
  };

  const emitTime = (ms: number) => {
    const rounded = Math.round(ms);
    setCurrentMs(rounded);
    callbacksRef.current.onTimeChange?.(rounded);
    publishMediaTime(ms);
  };

  const scrollToTime = (seconds: number) => {
    const wavesurfer = wavesurferRef.current as (WaveSurfer & { setScrollTime?: (time: number) => void }) | null;
    wavesurfer?.setScrollTime?.(Math.max(trimStartMsRef.current / 1000, seconds));
  };

  const getDurationMs = () => {
    const audio = audioRef.current;
    return audio && Number.isFinite(audio.duration) && audio.duration > 0 ? audio.duration * 1000 : durationMs;
  };

  const clampMediaMs = (ms: number) => {
    const max = getDurationMs();
    return Math.max(trimStartMsRef.current, max > 0 ? Math.min(max, ms) : ms);
  };

  const setNativeTime = (ms: number) => {
    const audio = audioRef.current;
    if (!audio) return 0;
    const next = clampMediaMs(ms);
    audio.currentTime = next / 1000;
    scrollToTime(next / 1000);
    emitTime(next);
    return next;
  };

  const playNative = (requestedMs?: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    if (requestedMs !== undefined) setNativeTime(requestedMs);
    void audio.play();
  };

  const seekTo = (ms: number) => setNativeTime(ms);
  const previewFrom = (ms: number) => playNative(ms);
  const playFromBegin = () => playNative(trimStartMsRef.current);

  useImperativeHandle(ref, () => ({
    seekTo,
    previewFrom,
    playFromBegin,
    getCurrentTimeMs: () => (audioRef.current?.currentTime ?? trimStartMsRef.current / 1000) * 1000,
  }));

  useEffect(() => {
    const audio = audioRef.current;
    const container = containerRef.current;
    if (!audio || !container || !url) return;
    let cancelled = false;
    let wavesurfer: WaveSurfer | null = null;
    let cleanupNative: (() => void) | undefined;

    const clearResyncTimer = () => {
      if (resyncTimerRef.current !== null) window.clearTimeout(resyncTimerRef.current);
      resyncTimerRef.current = null;
    };

    const cancelResync = () => {
      clearResyncTimer();
      resyncStageRef.current = "idle";
      resyncReturnMsRef.current = null;
      audio.muted = resyncWasMutedRef.current;
    };

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
      scrollToTime(audio.currentTime);
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

    const startRealInPlayResync = () => {
      if (decoderPrimedRef.current || audio.paused || audio.ended || resyncStageRef.current !== "idle") return;
      clearResyncTimer();
      resyncTimerRef.current = window.setTimeout(() => {
        if (decoderPrimedRef.current || audio.paused || audio.ended) return;
        const resumeMs = clampMediaMs(audio.currentTime * 1000);
        const backMs = Math.max(trimStartMsRef.current, resumeMs - IOS_RESYNC_BACK_MS);
        if (Math.abs(resumeMs - backMs) < 20) {
          decoderPrimedRef.current = true;
          return;
        }

        resyncWasMutedRef.current = audio.muted;
        audio.muted = true;
        resyncReturnMsRef.current = resumeMs;
        resyncStageRef.current = "back";
        audio.currentTime = backMs / 1000;
      }, IOS_RESYNC_DELAY_MS);
    };

    const setup = async () => {
      setReady(false);
      setPlaying(false);
      setCurrentMs(0);
      setDurationMs(0);
      setTrimStartMs(0);
      trimStartMsRef.current = 0;
      decoderPrimedRef.current = false;
      resyncStageRef.current = "idle";
      resyncReturnMsRef.current = null;
      clearResyncTimer();

      const detectedTrimMs = await detectTrimStartMs(url);
      if (cancelled || !containerRef.current || !audioRef.current) return;
      trimStartMsRef.current = detectedTrimMs;
      setTrimStartMs(detectedTrimMs);

      const instance = WaveSurfer.create({
        container: containerRef.current,
        media: audio,
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
      });
      wavesurfer = instance;
      wavesurferRef.current = instance;

      const markReady = () => {
        if (!Number.isFinite(audio.duration) || audio.duration <= 0) return;
        const total = Math.round(audio.duration * 1000);
        const startMs = Math.min(trimStartMsRef.current, total);
        setDurationMs(total);
        setReady(true);
        scrollToTime(startMs / 1000);
        setCurrentMs(startMs);
        callbacksRef.current.onTimeChange?.(startMs);
        callbacksRef.current.onDurationChange?.(total);
        callbacksRef.current.onReady?.(total);
      };

      const onPlayNative = () => {
        setPlaying(true);
        callbacksRef.current.onPlay?.();
        startClock();
      };

      const onPlayingNative = () => {
        startRealInPlayResync();
      };

      const onSeekedNative = () => {
        if (resyncStageRef.current === "back") {
          const returnMs = resyncReturnMsRef.current;
          if (returnMs === null) {
            cancelResync();
            return;
          }
          resyncStageRef.current = "return";
          audio.currentTime = clampMediaMs(returnMs) / 1000;
          return;
        }

        if (resyncStageRef.current === "return") {
          const returnMs = resyncReturnMsRef.current;
          decoderPrimedRef.current = true;
          resyncStageRef.current = "idle";
          resyncReturnMsRef.current = null;
          audio.muted = resyncWasMutedRef.current;
          if (returnMs !== null) {
            scrollToTime(returnMs / 1000);
            emitTime(returnMs);
          }
        }
      };

      const onPauseNative = () => {
        setPlaying(false);
        if (resyncStageRef.current !== "idle") cancelResync();
        stopClock();
        emitTime(audio.currentTime * 1000);
        callbacksRef.current.onPause?.();
      };

      const onEndedNative = () => {
        setPlaying(false);
        cancelResync();
        stopClock();
        emitTime(audio.currentTime * 1000);
        callbacksRef.current.onPause?.();
      };

      const onTimeUpdateNative = () => emitTime(audio.currentTime * 1000);

      audio.addEventListener("loadedmetadata", markReady);
      audio.addEventListener("durationchange", markReady);
      audio.addEventListener("play", onPlayNative);
      audio.addEventListener("playing", onPlayingNative);
      audio.addEventListener("seeked", onSeekedNative);
      audio.addEventListener("pause", onPauseNative);
      audio.addEventListener("ended", onEndedNative);
      audio.addEventListener("timeupdate", onTimeUpdateNative);

      instance.on("ready", () => {
        markReady();
        scrollToTime(Math.max(trimStartMsRef.current / 1000, audio.currentTime));
      });

      if (audio.readyState >= 1) markReady();
      else audio.load();

      cleanupNative = () => {
        audio.removeEventListener("loadedmetadata", markReady);
        audio.removeEventListener("durationchange", markReady);
        audio.removeEventListener("play", onPlayNative);
        audio.removeEventListener("playing", onPlayingNative);
        audio.removeEventListener("seeked", onSeekedNative);
        audio.removeEventListener("pause", onPauseNative);
        audio.removeEventListener("ended", onEndedNative);
        audio.removeEventListener("timeupdate", onTimeUpdateNative);
      };
    };

    void setup();

    return () => {
      cancelled = true;
      stopClock();
      cancelResync();
      cleanupNative?.();
      wavesurfer?.destroy();
      if (wavesurferRef.current === wavesurfer) wavesurferRef.current = null;
    };
  }, [url]);

  useEffect(() => {
    const wavesurfer = wavesurferRef.current;
    if (!wavesurfer || !ready) return;
    wavesurfer.setOptions({ minPxPerSec: getZoomPxPerSecond(zoom) });
    scrollToTime(Math.max(trimStartMsRef.current / 1000, audioRef.current?.currentTime ?? 0));
  }, [zoom, ready]);

  const seekBy = (deltaMs: number) => setNativeTime(currentMs + deltaMs);

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) {
      const target = Math.max(trimStartMsRef.current, audio.currentTime * 1000);
      playNative(target);
    } else {
      audio.pause();
    }
  };

  const currentPercent = durationMs ? Math.min(100, Math.max(0, currentMs / durationMs * 100)) : 0;

  return (
    <div className={`waveform-player ${compact ? "is-compact" : "is-expanded"}`}>
      <audio ref={audioRef} src={url} preload="auto" playsInline />

      <div className="waveform-compact-bar">
        <button className="waveform-compact-play" type="button" onClick={togglePlay} disabled={!ready} aria-label={playing ? "Pause" : "Play"}>{playing ? "Ⅱ" : "▶"}</button>
        <div className="waveform-compact-copy"><strong>{title || "Untitled track"}</strong><span>{formatTime(currentMs)} / {formatTime(durationMs)}</span></div>
        <div className="waveform-compact-progress"><span style={{ width: `${currentPercent}%` }} /></div>
      </div>

      <div className="waveform-expanded-ui">
        <div className="waveform-player-head">
          <div className="waveform-player-title">
            <span className={`waveform-live-dot ${playing ? "is-playing" : ""}`} aria-hidden="true" />
            <div><strong>{title || "Untitled track"}</strong><small>{ready ? `Trimmed begin ${formatTime(trimStartMs)} · native audio master · one-time real in-play resync` : "Detecting audio start…"}</small></div>
          </div>
        </div>

        <div ref={viewportRef} className="waveform-viewport">
          <div className="waveform-zoom-controls" aria-label="Waveform zoom controls">
            <button type="button" onClick={() => setZoom(current => clampZoom(current - 1))} disabled={zoom <= 1} aria-label="Zoom out">−</button>
            <span>{zoom % 1 === 0 ? zoom : zoom.toFixed(1)}×</span>
            <button type="button" onClick={() => setZoom(current => clampZoom(current + 1))} aria-label="Zoom in">＋</button>
          </div>
          <div ref={containerRef} className="waveform-canvas" aria-label="Waveform visualization" />
          {!ready && <div className="waveform-loading">Detecting audio start…</div>}
        </div>

        <div className="waveform-controls">
          <button className="waveform-play-button" type="button" onClick={togglePlay} disabled={!ready} aria-label={playing ? "Pause" : "Play"}>{playing ? "Ⅱ" : "▶"}</button>
          <button className="waveform-nudge" type="button" onClick={playFromBegin} disabled={!ready} aria-label="Play from audible beginning" title="Play from audible beginning">⏮</button>
          {[-1000, -100, -10, 10, 100, 1000].map(delta => (
            <button key={delta} className="waveform-nudge" type="button" onClick={() => seekBy(delta)} disabled={!ready}>
              {delta > 0 ? "+" : "−"}{Math.abs(delta) >= 1000 ? `${Math.abs(delta) / 1000}s` : Math.abs(delta)}
            </button>
          ))}
        </div>

        <div className="waveform-footer"><span>native audio timing master · automatic real −1s→return seek once after playback is running</span></div>
      </div>
    </div>
  );
});

export default WaveformPlayer;
