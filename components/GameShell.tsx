"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Stage3D from "./Stage3D";
import { createDemoChart, createPleaseTellMeWhyChart } from "@/game/chart";
import { RhythmRuntime } from "@/game/runtime";
import type { Direction, GameStats, Judgement } from "@/game/types";

const initialStats: GameStats = { score: 0, combo: 0, maxCombo: 0, perfect: 0, great: 0, cool: 0, bad: 0, miss: 0 };
const directions: Direction[] = ["left", "up", "down", "right"];
const fallbackSequence: Direction[] = ["left", "up", "down", "right", "left", "right", "up", "down"];
type ChartKey = "neon" | "pleaseTellMeWhy";

export default function GameShell() {
  const [chartKey, setChartKey] = useState<ChartKey>("neon");
  const chart = useMemo(() => chartKey === "pleaseTellMeWhy" ? createPleaseTellMeWhyChart() : createDemoChart(), [chartKey]);
  const runtimeRef = useRef<RhythmRuntime | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const activeTimer = useRef<number | null>(null);
  const [started, setStarted] = useState(false);
  const [finished, setFinished] = useState(false);
  const [stats, setStats] = useState<GameStats>(initialStats);
  const [sequence, setSequence] = useState<Direction[]>(fallbackSequence);
  const [completedCommands, setCompletedCommands] = useState(0);
  const [activeDirection, setActiveDirection] = useState<Direction | null>(null);
  const [wrongDirection, setWrongDirection] = useState<Direction | null>(null);
  const [judgement, setJudgement] = useState<Judgement | null>(null);
  const [spacePressed, setSpacePressed] = useState(false);
  const [pulseToken, setPulseToken] = useState(0);
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [timingPercent, setTimingPercent] = useState(0);
  const [timingDelta, setTimingDelta] = useState(0);

  useEffect(() => {
    const runtime = new RhythmRuntime(chart, {
      onStats: setStats,
      onSequence: (next, filled) => { setSequence(next.length ? next : fallbackSequence); setCompletedCommands(filled); },
      onJudgement: (next) => { setJudgement(next); window.setTimeout(() => setJudgement(null), 420); },
      onFinished: (next) => { setStats(next); setFinished(true); audioRef.current?.pause(); },
      onPulse: () => setPulseToken((value) => value + 1),
    });
    runtimeRef.current = runtime;
    return () => { runtime.destroy(); runtimeRef.current = null; audioRef.current?.pause(); };
  }, [chart]);

  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const runtime = runtimeRef.current;
      if (runtime?.isStarted) {
        setTimingPercent(runtime.timingGaugePercent);
        setTimingDelta(runtime.timingDeltaMs);
      } else {
        setTimingPercent(0);
        setTimingDelta(0);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  useEffect(() => () => { if (activeTimer.current !== null) window.clearTimeout(activeTimer.current); }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.repeat) return;
      const map: Record<string, Direction | undefined> = { ArrowLeft: "left", ArrowUp: "up", ArrowDown: "down", ArrowRight: "right", a: "left", w: "up", s: "down", d: "right" };
      const direction = map[event.key];
      if (direction) { event.preventDefault(); pressDirection(direction); return; }
      if (event.code === "Space") { event.preventDefault(); pressSpace(); }
    };
    window.addEventListener("keydown", onKeyDown, { passive: false });
    return () => window.removeEventListener("keydown", onKeyDown);
  });

  function startGame() {
    setStarted(true); setFinished(false); setStats(initialStats); setSequence(fallbackSequence); setCompletedCommands(0); setJudgement(null); setWrongDirection(null);
    const audio = audioRef.current;
    if (audio) {
      audio.pause();
      audio.currentTime = 0;
      if (chartKey === "pleaseTellMeWhy" && audioEnabled) void audio.play().catch(() => {});
    }
    runtimeRef.current?.start();
    if (chartKey === "neon" && audioEnabled) playMetronome(chart.bpm, 4);
  }

  function toggleAudio() {
    const nextEnabled = !audioEnabled;
    setAudioEnabled(nextEnabled);
    const audio = audioRef.current;
    if (!nextEnabled) {
      audio?.pause();
      return;
    }
    if (started && !finished && chartKey === "pleaseTellMeWhy" && audio) {
      void audio.play().catch(() => {});
    }
  }

  function pressDirection(direction: Direction) {
    if (!started || finished) return;
    setActiveDirection(direction);
    if (activeTimer.current !== null) window.clearTimeout(activeTimer.current);
    activeTimer.current = window.setTimeout(() => setActiveDirection(null), 105);
    const target = sequence[completedCommands];
    const correct = runtimeRef.current?.handleDirection(direction) ?? false;
    if (target && !correct) {
      setWrongDirection(direction);
      window.setTimeout(() => setWrongDirection((current) => current === direction ? null : current), 220);
    } else if (correct) setWrongDirection(null);
  }

  function pressSpace() {
    if (!started || finished) return;
    setSpacePressed(true);
    window.setTimeout(() => setSpacePressed(false), 110);
    runtimeRef.current?.handleSpace();
  }

  const visibleSequence = sequence.length ? sequence : fallbackSequence;
  const target = visibleSequence[completedCommands] ?? visibleSequence[0];

  return (
    <main className="shell">
      <header className="header">
        <div className="brand"><div className="brand-mark">A</div><div><h1>Audition Mobile — Rhythm Prototype</h1><p>3D rhythm gameplay · mobile + multiplayer presentation</p></div></div>
        <div className="header-actions">
          <select className="pill chart-select" value={chartKey} onChange={(event) => { setChartKey(event.target.value as ChartKey); setStarted(false); setFinished(false); setStats(initialStats); audioRef.current?.pause(); }} disabled={started && !finished} aria-label="Timing test song">
            <option value="neon">128 BPM</option>
            <option value="pleaseTellMeWhy">80 BPM</option>
          </select>
          <button className="pill" onClick={toggleAudio}>{audioEnabled ? "🔊 Beat ON" : "🔇 Beat OFF"}</button>
          <span className="pill">BPM {chart.bpm}</span>
        </div>
      </header>

      <section className="game-card">
        <div className="game-wrap">
          <div id="game-container" aria-hidden="true"><Stage3D pulseToken={pulseToken} /></div>
          <div className="hud audition-ui">
            <div className="hud-top">
              <div className="hud-left-column">
                <div className="song-box sketch-card"><div className="song-icon">♫</div><div><div className="song-title">{chart.title}</div><div className="song-meta">{chart.bpm} BPM · Timing Test</div></div></div>
                <div className="rank-panel sketch-card"><div className="rank-title">RANKING</div>{[["1ST", "ToanDev", stats.score], ["2ND", "Luna", 198765], ["3RD", "Kenzo", 176543], ["4TH", "Miyuki", 165231]].map(([rank, name, score]) => <div className="rank-row" key={String(rank)}><span>{rank}</span><b>{name}</b><strong>{Number(score).toLocaleString()}</strong></div>)}</div>
              </div>
              <div className="my-score sketch-card"><div className="my-score-title">MY SCORE</div><div className="my-score-value">{stats.score.toLocaleString()}</div><div className="my-score-bottom"><div><span>COMBO</span><b>{stats.combo}x</b></div><div><span>MAX</span><b>{stats.maxCombo}</b></div></div><div className="mini-judgements"><span className="perfect-text">P {stats.perfect}</span><span className="great-text">G {stats.great}</span><span className="cool-text">C {stats.cool}</span><span className="bad-text">B {stats.bad}</span><span className="miss-text">M {stats.miss}</span></div></div>
            </div>

            {judgement && <div className={`judgement ${judgement}`}>{judgement.toUpperCase()}!</div>}

            <div className="command-area">
              <div className="command-heading"><span>CHUỖI COMMAND</span><small>{Math.min(completedCommands + 1, visibleSequence.length)} / {visibleSequence.length}</small></div>
              <div className="command-bar-v2" aria-label="Upcoming commands">
                {visibleSequence.map((direction, index) => {
                  const isCompleted = index < completedCommands;
                  const isTarget = index === completedCommands;
                  const isWrong = isTarget && wrongDirection !== null;
                  return <div className={["command-step", isTarget ? "command-target" : "", isCompleted ? "command-completed" : "", isWrong ? "command-wrong" : "", activeDirection === direction && isTarget ? "command-pressed" : ""].filter(Boolean).join(" ")} key={`${direction}-${index}`}><ArrowIcon direction={direction} filled={isCompleted} target={isTarget} />{isTarget && <i className="command-target-line" aria-hidden="true" />}</div>;
                })}
                <span className="command-more">•••</span>
              </div>

              <div className="timing-gauge-wrap">
                <div className="timing-gauge-label"><span>TIMING GAUGE · LOOP</span><b>{Math.round(timingDelta)} ms</b></div>
                <div className="timing-gauge" aria-label="Timing gauge 0 to 100 percent looping">
                  <span className="timing-score-zone" aria-hidden="true" />
                  <i className="timing-marker" style={{ left: `${timingPercent}%` }} aria-hidden="true" />
                </div>
                <div className="timing-scale"><span>0%</span><b>75%</b><b>85%</b><b>95%</b><span>100%</span></div>
              </div>
            </div>

            <div className="controls-row-v2">
              <button className={`space-button-v2 ${spacePressed ? "space-pressed" : ""}`} onPointerDown={(event) => { event.preventDefault(); pressSpace(); }} aria-label="Space timing button"><span>SPACE</span><small>TAP ON BEAT</small></button>
              <div className="dpad-v2" aria-label="Direction controls">
                {directions.map((direction) => <button key={direction} className={`${`dpad-${direction}`} ${target === direction ? "dpad-target" : ""} ${activeDirection === direction ? "dpad-active" : ""}`} onPointerDown={(event) => { event.preventDefault(); pressDirection(direction); }} aria-label={direction}><ArrowIcon direction={direction} filled={false} target={target === direction} compact /></button>)}
                <span className="dpad-center-v2" aria-hidden="true" />
              </div>
            </div>
          </div>

          <audio ref={audioRef} preload="auto" playsInline src="/audio/Please%20tell%20me%20why.mp3" aria-label="Please Tell Me Why reference audio" />

          {!started && !finished && <div className="start-overlay"><div className="start-panel"><div className="ready-kicker">AUDITION MOBILE · 3D RHYTHM</div><h2>Ready to dance?</h2><p>Nhấn đúng command theo chuỗi. SPACE chỉ được chấm một lần cho mỗi move và timing chạy theo BPM.</p><div className="row"><button className="button primary" onPointerDown={(event) => { event.preventDefault(); startGame(); }}>Start Demo</button><button className="button" onClick={toggleAudio}>{audioEnabled ? "Sound on" : "Sound off"}</button></div></div></div>}

          {finished && <div className="results"><div className="results-card"><h2>Dance Complete ✨</h2><div className="results-score">{stats.score.toLocaleString()}</div><div className="stats"><div className="stat"><b>{stats.perfect}</b><span>Perfect</span></div><div className="stat"><b>{stats.great}</b><span>Great</span></div><div className="stat"><b>{stats.maxCombo}</b><span>Max Combo</span></div></div><button className="button primary" onClick={() => { setFinished(false); setStarted(false); setStats(initialStats); setCompletedCommands(0); setSequence(fallbackSequence); audioRef.current?.pause(); }}>Play Again</button></div></div>}
        </div>
      </section>

      <section className="info-grid"><div className="panel"><h3>🎮 3D Runtime</h3><p>Three.js owns the stage and animation. React owns the HUD. RhythmRuntime owns input, timing, judgement, score and combo.</p></div><div className="panel"><h3>🎯 Audition Timing</h3><p>The bead traverses the complete 0–100% gauge and loops. The PERFECT target remains four beats after the move starts, with the current 85% white-zone reference.</p></div></section>
    </main>
  );
}

function ArrowIcon({ direction, filled, target, compact = false }: { direction: Direction; filled: boolean; target: boolean; compact?: boolean }) {
  const color = direction === "left" || direction === "right" ? "#ff62d9" : "#5edcff";
  const rotation = direction === "right" ? 0 : direction === "down" ? 90 : direction === "left" ? 180 : 270;
  return <svg className={compact ? "dpad-arrow-icon" : "command-arrow-icon command-arrow-v2"} viewBox="0 0 42 40" aria-hidden="true" style={{ width: compact ? 28 : 34, height: compact ? 28 : 34, display: "block", overflow: "visible", flex: "0 0 auto", transform: `rotate(${rotation}deg)`, transformOrigin: "center", filter: filled ? `drop-shadow(0 0 4px ${color}) drop-shadow(0 0 10px ${color})` : `drop-shadow(0 0 2px ${color})`, opacity: target || filled ? 1 : 0.78, transition: "filter 120ms ease, opacity 120ms ease" }}><path d="M5 14H22V8L36 20L22 32V26H5V14Z" fill={filled ? color : "rgba(0,0,0,0.01)"} stroke={color} strokeWidth={filled ? 0 : 1.8} strokeLinejoin="miter" /></svg>;
}

function playMetronome(bpm: number, bars: number) {
  try {
    const AudioContextClass = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    const interval = 60 / bpm;
    const start = ctx.currentTime + 0.08;
    const total = bars * 4;
    for (let i = 0; i < total; i += 1) {
      const osc = ctx.createOscillator(); const gain = ctx.createGain(); const t = start + i * interval;
      osc.frequency.value = i % 4 === 0 ? 880 : 660;
      gain.gain.setValueAtTime(0.0001, t); gain.gain.exponentialRampToValueAtTime(0.09, t + 0.006); gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.055);
      osc.connect(gain).connect(ctx.destination); osc.start(t); osc.stop(t + 0.06);
    }
    window.setTimeout(() => ctx.close(), (total * interval + 300) * 1.1);
  } catch { /* Audio is optional. */ }
}
