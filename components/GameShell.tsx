"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DEMO_CHART } from "../game/chart";
import { RhythmRuntime } from "../game/runtime";
import type { Direction, GameStats, Judgement } from "../game/types";
import Stage3D from "./Stage3D";

const INITIAL_STATS: GameStats = { score: 0, combo: 0, maxCombo: 0, perfect: 0, great: 0, cool: 0, bad: 0, miss: 0 };
const DIRECTIONS: Direction[] = ["left", "up", "down", "right"];

export default function GameShell() {
  const [stats, setStats] = useState(INITIAL_STATS);
  const [sequence, setSequence] = useState<Direction[]>([]);
  const [completed, setCompleted] = useState(0);
  const [level, setLevel] = useState(1);
  const [judgement, setJudgement] = useState<Judgement | null>(null);
  const [gauge, setGauge] = useState(0);
  const [delta, setDelta] = useState(0);
  const [phase, setPhase] = useState("idle");
  const [countdown, setCountdown] = useState<number | null>(null);
  const [started, setStarted] = useState(false);
  const [finished, setFinished] = useState(false);
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [activeDirection, setActiveDirection] = useState<Direction | null>(null);
  const [wrongDirection, setWrongDirection] = useState<Direction | null>(null);
  const [spacePressed, setSpacePressed] = useState(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const directionTimer = useRef<number | null>(null);
  const audioEnabledRef = useRef(true);

  const runtime = useMemo(() => new RhythmRuntime(DEMO_CHART, {
    onStats: setStats,
    onSequence: (next, filled) => { setSequence(next); setCompleted(filled); },
    onLevel: setLevel,
    onPhase: setPhase,
    onCountdown: setCountdown,
    onJudgement: (value) => {
      setJudgement(value);
      window.setTimeout(() => setJudgement(null), 360);
    },
    onFinished: (next) => { setStats(next); setFinished(true); setStarted(false); },
  }), []);

  useEffect(() => { audioEnabledRef.current = audioEnabled; }, [audioEnabled]);
  useEffect(() => () => { runtime.destroy(); if (directionTimer.current) window.clearTimeout(directionTimer.current); }, [runtime]);

  useEffect(() => {
    let raf = 0;
    const tick = () => {
      setGauge(runtime.gaugePercent);
      setDelta(runtime.timingDeltaMs);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [runtime]);

  const startGame = useCallback(() => {
    setStats(INITIAL_STATS);
    setSequence([]);
    setCompleted(0);
    setLevel(1);
    setJudgement(null);
    setFinished(false);
    setStarted(true);
    setPhase("countdown");
    setCountdown(3);

    const audio = audioRef.current;
    runtime.setTimeSource(null);
    runtime.start();

    if (audio && audioEnabledRef.current) {
      audio.pause();
      audio.currentTime = 0;
      audio.volume = 1;
      audio.muted = false;
      void audio.play().then(() => {
        runtime.setTimeSource(() => audio.currentTime * 1000);
        runtime.syncToTimeSource();
      }).catch(() => runtime.setTimeSource(null));
    }
  }, [runtime]);

  const pressDirection = useCallback((direction: Direction) => {
    setActiveDirection(direction);
    if (directionTimer.current) window.clearTimeout(directionTimer.current);
    directionTimer.current = window.setTimeout(() => setActiveDirection(null), 100);
    const target = sequence[completed];
    if (target && target !== direction) {
      setWrongDirection(direction);
      window.setTimeout(() => setWrongDirection(current => current === direction ? null : current), 180);
    } else setWrongDirection(null);
    runtime.handleDirection(direction);
  }, [runtime, sequence, completed]);

  const pressSpace = useCallback(() => {
    setSpacePressed(true);
    window.setTimeout(() => setSpacePressed(false), 100);
    runtime.handleSpace();
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

  const toggleAudio = useCallback(() => {
    const next = !audioEnabledRef.current;
    audioEnabledRef.current = next;
    setAudioEnabled(next);
    const audio = audioRef.current;
    if (!audio) return;
    if (!next) { audio.pause(); audio.muted = true; runtime.setTimeSource(null); return; }
    audio.muted = false;
    audio.volume = 1;
    if (started) void audio.play().then(() => { runtime.setTimeSource(() => audio.currentTime * 1000); runtime.syncToTimeSource(); });
  }, [runtime, started]);

  return (
    <main className="shell">
      <audio ref={audioRef} preload="auto" playsInline src="/audio/Please%20tell%20me%20why.mp3" />
      <header className="header">
        <div className="brand"><div className="brand-mark">A</div><div><h1>Audition Mobile — Rhythm Prototype</h1><p>Audition-style command + timing gameplay</p></div></div>
        <div className="header-actions"><button className="pill" onClick={toggleAudio}>{audioEnabled ? "🔊 Beat ON" : "🔇 Beat OFF"}</button><span className="pill">BPM {DEMO_CHART.bpm}</span></div>
      </header>

      <section className="game-card">
        <div className="game-wrap" data-phase={phase}>
          <Stage3D />
          <div className="hud audition-ui">
            <div className="hud-top">
              <div className="song-box sketch-card"><div className="song-icon">♫</div><div><div className="song-title">{DEMO_CHART.title}</div><div className="song-meta">{DEMO_CHART.bpm} BPM · Audition Gameplay</div></div></div>
              <div className="my-score sketch-card"><div className="my-score-title">MY SCORE</div><div className="my-score-value">{stats.score.toLocaleString()}</div><div className="my-score-bottom"><div><span>COMBO</span><b>{stats.combo}x</b></div><div><span>MAX</span><b>{stats.maxCombo}</b></div></div><div className="mini-judgements"><span className="perfect-text">P {stats.perfect}</span><span className="great-text">G {stats.great}</span><span className="cool-text">C {stats.cool}</span><span className="bad-text">B {stats.bad}</span><span className="miss-text">M {stats.miss}</span></div></div>
            </div>

            {countdown !== null && <div className="judgement perfect">{countdown}</div>}
            {countdown === null && judgement && <div className={`judgement ${judgement}`}>{judgement.toUpperCase()}!</div>}

            <div className="command-area">
              <div className="command-heading"><span>LEVEL {level} · CHUỖI COMMAND</span><small>{sequence.length ? `${Math.min(completed + 1, sequence.length)} / ${sequence.length}` : "—"}</small></div>
              <div className="command-bar command-bar-v2 command-bar-outline" aria-label="Upcoming commands">
                {sequence.map((direction, index) => {
                  const isCompleted = index < completed;
                  const isTarget = index === completed;
                  const isWrong = isTarget && wrongDirection !== null && wrongDirection !== direction;
                  return <div key={`${level}-${index}-${direction}`} className={["command-step", isCompleted ? "command-completed" : "", isTarget ? "command-target" : "", isWrong ? "command-wrong" : ""].filter(Boolean).join(" ")}><ArrowIcon direction={direction} filled={isCompleted} target={isTarget} /></div>;
                })}
              </div>

              <div className="timing-gauge-wrap">
                <div className="timing-gauge-label"><span>TIMING GAUGE · {Math.round(gauge)}%</span><b>{delta >= 0 ? "+" : ""}{delta.toFixed(0)} ms</b></div>
                <div className="timing-gauge audition-timing-gauge" data-timing-delta-ms={Math.round(delta)}>
                  <div className="timing-zone zone-bad-left" /><div className="timing-zone zone-cool-left" /><div className="timing-zone zone-great-left" /><div className="timing-zone zone-perfect" /><div className="timing-zone zone-great-right" /><div className="timing-zone zone-cool-right" /><div className="timing-zone zone-bad-right" />
                  <div className="timing-marker" style={{ left: `${gauge}%` }} />
                </div>
                <div className="timing-scale"><span>0%</span><b>75%</b><b>85% PERFECT</b><b>95%</b><span>100%</span></div>
              </div>
            </div>

            <div className="controls-row-v2">
              <button className={`space-button-v2 ${spacePressed ? "space-pressed" : ""}`} onPointerDown={(event) => { event.preventDefault(); pressSpace(); }} aria-label="Space timing button"><span>SPACE</span><small>PRESS IN SCORE ZONE</small></button>
              <div className="dpad-v2" aria-label="Direction controls">
                {DIRECTIONS.map(direction => { const isTarget = sequence[completed] === direction; return <button key={direction} className={[`dpad-${direction}`, activeDirection === direction ? "dpad-active" : "", isTarget ? "dpad-target" : ""].filter(Boolean).join(" ")} onPointerDown={(event) => { event.preventDefault(); pressDirection(direction); }} aria-label={direction}><ArrowIcon direction={direction} filled={false} target={isTarget} compact /></button>; })}
                <span className="dpad-center-v2" aria-hidden="true" />
              </div>
            </div>
          </div>

          {!started && !finished && <div className="start-overlay"><div className="start-panel"><div className="ready-kicker">AUDITION MOBILE · GAMEPLAY REBUILD</div><h2>Ready to dance?</h2><p>Nhập đúng chuỗi mũi tên trước, sau đó nhấn SPACE khi marker đi vào SCORE ZONE. Sai hướng sẽ reset chuỗi hiện tại.</p><div className="row"><button className="button primary" onClick={startGame}>Start Demo</button><button className="button" onClick={toggleAudio}>{audioEnabled ? "Sound on" : "Sound off"}</button></div></div></div>}
          {finished && <div className="results"><div className="results-card"><h2>Dance Complete ✨</h2><div className="results-score">{stats.score.toLocaleString()}</div><div className="stats"><div className="stat"><b>{stats.perfect}</b><span>Perfect</span></div><div className="stat"><b>{stats.great}</b><span>Great</span></div><div className="stat"><b>{stats.cool}</b><span>Cool</span></div><div className="stat"><b>{stats.maxCombo}</b><span>Max Combo</span></div></div><button className="button primary" onClick={startGame}>Play Again</button></div></div>}
        </div>
      </section>
    </main>
  );
}

function ArrowIcon({ direction, filled, target, compact = false }: { direction: Direction; filled: boolean; target: boolean; compact?: boolean }) {
  const color = direction === "left" || direction === "right" ? "#ff63d9" : "#61dcff";
  const rotation = direction === "right" ? 0 : direction === "down" ? 90 : direction === "left" ? 180 : 270;
  const size = compact ? 26 : 30;
  return <svg className={compact ? "dpad-arrow-icon" : "command-arrow-icon command-arrow-v2"} viewBox="0 0 42 40" aria-hidden="true" style={{ width: size, height: size, position: "absolute", left: "50%", top: "50%", transform: `translate(-50%, -50%) rotate(${rotation}deg)`, transformOrigin: "center", filter: `drop-shadow(0 0 ${target || filled ? 5 : 2}px ${color})`, opacity: target || filled ? 1 : .72 }}><path d="M5 14H22V8L36 20L22 32V26H5V14Z" fill={filled ? color : "rgba(0,0,0,.02)"} stroke={color} strokeWidth={filled ? 0 : 1.8} strokeLinejoin="miter" /></svg>;
}
