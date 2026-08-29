"use client";

import "../app/audition-overrides.css";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DEMO_CHART } from "../game/chart";
import { RhythmRuntime } from "../game/runtime";
import type { Direction, GameStats, Judgement } from "../game/types";
import Stage3D from "./Stage3D";

const DIRECTION_SYMBOL: Record<Direction, string> = { left: "←", up: "↑", down: "↓", right: "→" };
const DIRECTIONS: Direction[] = ["left", "up", "down", "right"];
const INITIAL_STATS: GameStats = { score: 0, combo: 0, maxCombo: 0, perfect: 0, great: 0, cool: 0, bad: 0, miss: 0 };

export default function GameShell() {
  const [stats, setStats] = useState<GameStats>(INITIAL_STATS);
  const [sequence, setSequence] = useState<Direction[]>([]);
  const [filledCount, setFilledCount] = useState(0);
  const [judgement, setJudgement] = useState<Judgement | null>(null);
  const [gauge, setGauge] = useState(0);
  const [started, setStarted] = useState(false);
  const [level, setLevel] = useState(1);
  const [phase, setPhase] = useState("idle");
  const [countdown, setCountdown] = useState<number | null>(null);
  const runtimeRef = useRef<RhythmRuntime | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const runtime = useMemo(() => new RhythmRuntime(DEMO_CHART, {
    onStats: setStats,
    onJudgement: setJudgement,
    onSequence: (next, filled) => { setSequence(next); setFilledCount(filled); },
    onFinished: () => setStarted(false),
    onLevel: setLevel,
    onPhase: setPhase,
    onCountdown: setCountdown,
  }), []);

  useEffect(() => {
    runtimeRef.current = runtime;
    return () => runtime.destroy();
  }, [runtime]);

  useEffect(() => {
    let raf = 0;
    const tick = () => { setGauge(runtime.timingGaugePercent); raf = requestAnimationFrame(tick); };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [runtime]);

  const start = useCallback(async () => {
    const audio = audioRef.current;
    if (!audio) return;
    setJudgement(null);
    audio.pause();
    audio.currentTime = 0;
    try {
      await audio.play();
    } catch {
      // The round can still be exercised if the reference track is unavailable.
    }
    setStarted(true);
    runtime.start();
  }, [runtime]);

  const pressDirection = useCallback((direction: Direction) => runtime.handleDirection(direction), [runtime]);
  const pressSpace = useCallback(() => { const result = runtime.handleSpace(); if (result) setJudgement(result); }, [runtime]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.code === "Space") { event.preventDefault(); pressSpace(); return; }
      const keyMap: Record<string, Direction> = { ArrowLeft: "left", ArrowUp: "up", ArrowDown: "down", ArrowRight: "right" };
      const direction = keyMap[event.code];
      if (direction) { event.preventDefault(); pressDirection(direction); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [pressDirection, pressSpace]);

  return (
    <main className="game-shell">
      <audio
        ref={audioRef}
        data-rhythm-clock
        preload="auto"
        playsInline
        src="/audio/Please%20tell%20me%20why.mp3"
        onEnded={() => { runtime.stop(); setStarted(false); }}
      />
      <header className="game-header">
        <div className="brand-mark">A</div>
        <div>
          <h1>Audition Mobile — Rhythm Prototype</h1>
          <p>{DEMO_CHART.bpm} BPM · {phase === "countdown" && countdown ? `Starting ${countdown}` : phase === "playing" ? `Level ${level}` : phase === "finish" ? "FINISH" : "Timing Test"}</p>
        </div>
        <button className="start-button" onClick={start}>{started ? "RESTART" : "PLAY"}</button>
      </header>

      <section className="game-stage-wrap">
        <Stage3D />
        <div className="game-hud">
          <div className="song-card">
            <div className="music-icon">♫</div>
            <div><strong>{DEMO_CHART.title}</strong><span>{DEMO_CHART.bpm} BPM · Timing Test</span></div>
          </div>

          <div className="score-card">
            <span>MY SCORE</span>
            <strong>{stats.score}</strong>
            <div className="score-divider" />
            <div className="score-meta">
              <div><small>COMBO</small><b>{stats.combo}x</b></div>
              <div><small>MAX</small><b>{stats.maxCombo}</b></div>
            </div>
            <div className="judgement-counts">
              <span>P {stats.perfect}</span><span>G {stats.great}</span><span>C {stats.cool}</span><span>B {stats.bad}</span><span>M {stats.miss}</span>
            </div>
          </div>

          {countdown && <div className="judgement">{countdown}</div>}

          <div className="sequence-label">
            <span>{phase === "finish" ? "FINISH · CHUỖI COMMAND" : `LEVEL ${level} · CHUỖI COMMAND`}</span>
            <span>{sequence.length ? `${Math.min(8, filledCount + 1)} / 8` : "—"}</span>
          </div>

          <div className="command-row">
            {sequence.map((direction, index) => (
              <span key={`${direction}-${index}`} className={`command ${index < filledCount ? "filled" : ""}`}>
                {DIRECTION_SYMBOL[direction]}
              </span>
            ))}
          </div>

          <div className="timing-label">
            <span>TIMING GAUGE · 4 BEATS</span>
            <span>{runtime.timingDeltaMs.toFixed(0)} ms</span>
          </div>
          <div className="timing-gauge">
            <div className="timing-score-zone" aria-hidden="true" />
            <div className="timing-marker" style={{ left: `${gauge}%` }} />
          </div>

          <div className="mobile-controls">
            <button className="space-button" onPointerDown={(event) => { event.preventDefault(); pressSpace(); }}>
              <b>SPACE</b><span>TAP ON BEAT</span>
            </button>
            <div className="dpad" aria-label="Direction controls">
              {DIRECTIONS.map((direction) => (
                <button key={direction} onPointerDown={(event) => { event.preventDefault(); pressDirection(direction); }}>
                  {DIRECTION_SYMBOL[direction]}
                </button>
              ))}
            </div>
          </div>

          {judgement && !countdown && <div className={`judgement judgement-${judgement}`}>{judgement.toUpperCase()}</div>}
        </div>
      </section>
    </main>
  );
}
