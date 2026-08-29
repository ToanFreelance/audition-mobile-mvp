"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DEMO_CHART } from "../game/chart";
import { RhythmRuntime } from "../game/runtime";
import type { Direction, GameStats, Judgement } from "../game/types";
import Stage3D from "./Stage3D";

const DIRECTIONS: Direction[] = ["left", "up", "down", "right"];
const INITIAL_STATS: GameStats = { score: 0, combo: 0, maxCombo: 0, perfect: 0, great: 0, cool: 0, bad: 0, miss: 0 };

export default function GameShell() {
  const [stats, setStats] = useState<GameStats>(INITIAL_STATS);
  const [sequence, setSequence] = useState<Direction[]>([]);
  const [completedCommands, setCompletedCommands] = useState(0);
  const [judgement, setJudgement] = useState<Judgement | null>(null);
  const [gauge, setGauge] = useState(0);
  const [delta, setDelta] = useState(0);
  const [started, setStarted] = useState(false);
  const [finished, setFinished] = useState(false);
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [activeDirection, setActiveDirection] = useState<Direction | null>(null);
  const [wrongDirection, setWrongDirection] = useState<Direction | null>(null);
  const [spacePressed, setSpacePressed] = useState(false);
  const [level, setLevel] = useState(1);
  const [phase, setPhase] = useState("idle");
  const [countdown, setCountdown] = useState<number | null>(null);
  const runtimeRef = useRef<RhythmRuntime | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const markerRef = useRef<HTMLDivElement | null>(null);
  const flashTimer = useRef<number | null>(null);
  const judgementTimer = useRef<number | null>(null);

  const runtime = useMemo(() => new RhythmRuntime(DEMO_CHART, {
    onStats: setStats,
    onJudgement: (value) => {
      setJudgement(value);
      if (judgementTimer.current !== null) window.clearTimeout(judgementTimer.current);
      judgementTimer.current = window.setTimeout(() => setJudgement(null), 320);
    },
    onSequence: (next, filled) => { setSequence(next.slice(0, 8)); setCompletedCommands(Math.max(0, Math.min(8, filled))); },
    onFinished: (next) => { setStats(next); setFinished(true); setStarted(false); },
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
    const tick = () => {
      const nextGauge = runtime.timingGaugePercent;
      const nextDelta = runtime.timingDeltaMs;
      setGauge(nextGauge);
      setDelta(nextDelta);
      if (markerRef.current) markerRef.current.style.left = `${nextGauge}%`;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [runtime]);

  useEffect(() => () => {
    if (flashTimer.current !== null) window.clearTimeout(flashTimer.current);
    if (judgementTimer.current !== null) window.clearTimeout(judgementTimer.current);
  }, []);

  const startGame = useCallback(async () => {
    setStats(INITIAL_STATS);
    setSequence([]);
    setCompletedCommands(0);
    setJudgement(null);
    setFinished(false);
    setStarted(true);
    setLevel(1);
    setPhase("intro");
    setCountdown(null);
    const audio = audioRef.current;
    if (audio) {
      audio.pause();
      audio.currentTime = 0;
      if (audioEnabled) {
        try { await audio.play(); } catch { /* browser autoplay policy */ }
      }
    }
    runtime.start();
  }, [runtime, audioEnabled]);

  const pressDirection = useCallback((direction: Direction) => {
    setActiveDirection(direction);
    if (flashTimer.current !== null) window.clearTimeout(flashTimer.current);
    flashTimer.current = window.setTimeout(() => setActiveDirection(null), 105);
    const target = sequence[completedCommands];
    if (target !== direction) {
      setWrongDirection(direction);
      window.setTimeout(() => setWrongDirection((current) => current === direction ? null : current), 180);
    } else setWrongDirection(null);
    runtime.handleDirection(direction);
  }, [runtime, sequence, completedCommands]);

  const pressSpace = useCallback(() => {
    setSpacePressed(true);
    window.setTimeout(() => setSpacePressed(false), 100);
    const result = runtime.handleSpace();
    if (result) setJudgement(result);
  }, [runtime]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.code === "Space") { event.preventDefault(); pressSpace(); return; }
      const map: Record<string, Direction> = { ArrowLeft: "left", ArrowUp: "up", ArrowDown: "down", ArrowRight: "right" };
      const direction = map[event.code];
      if (direction) { event.preventDefault(); pressDirection(direction); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [pressDirection, pressSpace]);

  const visibleSequence = sequence.slice(0, 8);

  return (
    <main className="shell">
      <audio ref={audioRef} data-rhythm-clock preload="auto" playsInline src="/audio/Please%20tell%20me%20why.mp3" onEnded={() => { runtime.stop(); setStarted(false); }} />
      <header className="header">
        <div className="brand"><div className="brand-mark">A</div><div><h1>Audition Mobile — Rhythm Prototype</h1><p>Part 2 · Command UI + mobile controls · frontend only</p></div></div>
        <div className="header-actions"><button className="pill" onClick={() => setAudioEnabled((value) => !value)}>{audioEnabled ? "🔊 Beat ON" : "🔇 Beat OFF"}</button><span className="pill">BPM {DEMO_CHART.bpm}</span></div>
      </header>

      <section className="game-card">
        <div className="game-wrap">
          <Stage3D />
          <div className="hud audition-ui">
            <div className="hud-top">
              <div className="hud-left-column"><div className="song-box sketch-card"><div className="song-icon">♫</div><div><div className="song-title">{DEMO_CHART.title}</div><div className="song-meta">{DEMO_CHART.bpm} BPM · Timing Test</div></div></div></div>
              <div className="my-score sketch-card"><div className="my-score-title">MY SCORE</div><div className="my-score-value">{stats.score.toLocaleString()}</div><div className="my-score-bottom"><div><span>COMBO</span><b>{stats.combo}x</b></div><div><span>MAX</span><b>{stats.maxCombo}</b></div></div><div className="mini-judgements"><span className="perfect-text">P {stats.perfect}</span><span className="great-text">G {stats.great}</span><span className="cool-text">C {stats.cool}</span><span className="bad-text">B {stats.bad}</span><span className="miss-text">M {stats.miss}</span></div></div>
            </div>

            {judgement && !countdown && <div className={`judgement ${judgement}`}>{judgement.toUpperCase()}!</div>}
            {countdown && <div className="judgement perfect">{countdown}</div>}

            <div className="command-area">
              <div className="command-heading"><span>LEVEL {level} · CHUỖI COMMAND</span><small>{visibleSequence.length ? `${Math.min(8, completedCommands + 1)} / 8` : "—"}</small></div>
              <div className="command-bar command-bar-v2 command-bar-outline" aria-label="Upcoming commands">
                {visibleSequence.map((direction, index) => { const isCompleted = index < completedCommands; const isTarget = index === completedCommands; const isWrong = isTarget && wrongDirection !== null && wrongDirection !== direction; return <div key={`${direction}-${index}`} className={["command-step", isTarget ? "command-target" : "", isCompleted ? "command-completed" : "", isWrong ? "command-wrong" : ""].filter(Boolean).join(" ")}><ArrowIcon direction={direction} filled={isCompleted} target={isTarget} />{isTarget && <i className="command-target-line" aria-hidden="true" />}</div>; })}
                {visibleSequence.length > 0 && <span className="command-more" aria-hidden="true">•••</span>}
              </div>
              <div className="timing-gauge-wrap">
                <div className="timing-gauge-label"><span>TIMING GAUGE · {Math.round(gauge)}%</span><b>{delta.toFixed(0)} ms</b></div>
                <div className="timing-gauge"><div className="timing-score-zone" aria-hidden="true" /><div ref={markerRef} className="timing-marker" /></div>
                <div className="timing-scale"><span>0%</span><b>75%</b><b>85%</b><b>95%</b><span>100%</span></div>
              </div>
            </div>

            <div className="controls-row-v2">
              <button className={`space-button-v2 ${spacePressed ? "space-pressed" : ""}`} onPointerDown={(event) => { event.preventDefault(); pressSpace(); }} aria-label="Space timing button"><span>SPACE</span><small>TAP ON BEAT</small></button>
              <div className="dpad-v2" aria-label="Direction controls">
                {DIRECTIONS.map((direction) => { const isTarget = sequence[completedCommands] === direction; return <button key={direction} className={[`dpad-${direction}`, activeDirection === direction ? "dpad-active" : "", isTarget ? "dpad-target" : ""].filter(Boolean).join(" ")} onPointerDown={(event) => { event.preventDefault(); pressDirection(direction); }} aria-label={direction}><ArrowIcon direction={direction} filled={false} target={isTarget} compact /></button>; })}
                <span className="dpad-center-v2" aria-hidden="true" />
              </div>
            </div>
          </div>

          {!started && !finished && <div className="start-overlay"><div className="start-panel"><div className="ready-kicker">AUDITION MOBILE · RHYTHM PROTOTYPE</div><h2>Ready to dance?</h2><p>Follow the command sequence, then tap SPACE on the beat. Wrong direction resets the current command sequence.</p><div className="row"><button className="button primary" onClick={startGame}>Start Demo</button><button className="button" onClick={() => setAudioEnabled((value) => !value)}>{audioEnabled ? "Sound on" : "Sound off"}</button></div></div></div>}
          {finished && <div className="results"><div className="results-card"><h2>Dance Complete ✨</h2><div className="results-score">{stats.score.toLocaleString()}</div><div className="stats"><div className="stat"><b>{stats.perfect}</b><span>Perfect</span></div><div className="stat"><b>{stats.great}</b><span>Great</span></div><div className="stat"><b>{stats.maxCombo}</b><span>Max Combo</span></div></div><button className="button primary" onClick={startGame}>Play Again</button></div></div>}
        </div>
      </section>
    </main>
  );
}

function ArrowIcon({ direction, filled, target, compact = false }: { direction: Direction; filled: boolean; target: boolean; compact?: boolean }) {
  const color = direction === "left" || direction === "right" ? "#ff63d9" : "#61dcff";
  const rotation = direction === "right" ? 0 : direction === "down" ? 90 : direction === "left" ? 180 : 270;
  const width = compact ? 26 : 30;
  const height = compact ? 26 : 30;
  return <svg className={compact ? "dpad-arrow-icon" : "command-arrow-icon command-arrow-v2"} viewBox="0 0 42 40" aria-hidden="true" style={{ width, height, display: "block", overflow: "visible", flex: "0 0 auto", transform: `rotate(${rotation}deg)`, transformOrigin: "center", filter: filled ? `drop-shadow(0 0 4px ${color}) drop-shadow(0 0 10px ${color})` : `drop-shadow(0 0 2px ${color})`, opacity: target || filled ? 1 : 0.86, transition: "filter 120ms ease, opacity 120ms ease" }}><path d="M5 14H22V8L36 20L22 32V26H5V14Z" fill={filled ? color : "rgba(0,0,0,0.015)"} stroke={color} strokeWidth={filled ? 0 : 1.8} strokeLinejoin="miter" /></svg>;
}
