"use client";

import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { createAuditionChart } from "@/game/chart";
import { AuditionEngine } from "@/game/engine";
import type { Direction, GamePhase, GameStats, Judgement } from "@/game/types";
import Stage3D from "./Stage3D";

const EMPTY_STATS: GameStats = { score: 0, combo: 0, maxCombo: 0, perfect: 0, great: 0, cool: 0, bad: 0, miss: 0 };
const DIRECTIONS: Direction[] = ["up", "left", "right", "down"];
const OPPONENT_SCORE = 179342;

export default function AuditionGame() {
  const chart = useMemo(() => createAuditionChart(80), []);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const engineRef = useRef<AuditionEngine | null>(null);
  const actionRef = useRef<string | null>(null);
  const fallbackStartRef = useRef(0);
  const rafRef = useRef<number | null>(null);
  const lastBeatRef = useRef(-1);
  const [started, setStarted] = useState(false);
  const [sound, setSound] = useState(true);
  const [phase, setPhase] = useState<GamePhase>("idle");
  const [turn, setTurn] = useState(chart.turns[0]);
  const [sequence, setSequence] = useState<Direction[]>(chart.turns[0].directions);
  const [completed, setCompleted] = useState(0);
  const [gauge, setGauge] = useState(0);
  const [stats, setStats] = useState<GameStats>(EMPTY_STATS);
  const [judgement, setJudgement] = useState<Judgement | null>(null);
  const [actionId, setActionId] = useState<string | null>(null);
  const [wrong, setWrong] = useState<Direction | null>(null);
  const [audioError, setAudioError] = useState(false);

  useEffect(() => {
    engineRef.current = new AuditionEngine(chart);
    const tick = () => {
      const engine = engineRef.current;
      if (!engine || !started) return;
      const audio = audioRef.current;
      const elapsed = audio && !audio.paused && Number.isFinite(audio.currentTime)
        ? audio.currentTime
        : (performance.now() - fallbackStartRef.current) / 1000;
      const beat = elapsed * chart.bpm / 60;
      engine.update(beat);
      const snapshot = engine.snapshot(beat);
      setPhase(snapshot.phase);
      setTurn(snapshot.turn ?? chart.turns[chart.turns.length - 1]);
      setSequence(snapshot.turn?.directions ?? []);
      setCompleted(snapshot.completedCommands);
      setGauge(snapshot.timingPercent);
      setStats(snapshot.stats);
      setWrong(snapshot.wrongDirection);

      const transient = engine.consumeTransient();
      if (transient.judgement) {
        setJudgement(transient.judgement);
        window.setTimeout(() => setJudgement(null), 650);
      }
      if (transient.actionId) {
        actionRef.current = transient.actionId;
        setActionId(transient.actionId);
        window.setTimeout(() => {
          actionRef.current = null;
          setActionId(null);
        }, 720);
      }
      if (transient.wrongDirection) {
        window.setTimeout(() => setWrong(null), 180);
      }
      if (snapshot.phase === "finished") {
        setStarted(false);
      }
      rafRef.current = window.requestAnimationFrame(tick);
    };
    if (started) rafRef.current = window.requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== null) window.cancelAnimationFrame(rafRef.current);
    };
  }, [chart, started]);

  const startGame = async () => {
    const engine = engineRef.current ?? new AuditionEngine(chart);
    engineRef.current = engine;
    engine.start();
    fallbackStartRef.current = performance.now();
    lastBeatRef.current = -1;
    setStats(EMPTY_STATS);
    setJudgement(null);
    setActionId(null);
    setWrong(null);
    setStarted(true);
    setPhase("input");
    setTurn(chart.turns[0]);
    setSequence(chart.turns[0].directions);
    setCompleted(0);
    setGauge(0);
    setAudioError(false);

    const audio = audioRef.current;
    if (audio && sound) {
      try {
        audio.currentTime = 0;
        await audio.play();
      } catch {
        setAudioError(true);
      }
    }
  };

  const stopGame = () => {
    audioRef.current?.pause();
    setStarted(false);
    setPhase("idle");
  };

  const toggleSound = async () => {
    const next = !sound;
    setSound(next);
    const audio = audioRef.current;
    if (!audio) return;
    if (!next) {
      audio.pause();
      return;
    }
    if (started) {
      try { await audio.play(); } catch { setAudioError(true); }
    }
  };

  const pressDirection = (direction: Direction) => {
    if (!started) return;
    const audio = audioRef.current;
    const elapsed = audio && !audio.paused ? audio.currentTime : (performance.now() - fallbackStartRef.current) / 1000;
    const beat = elapsed * chart.bpm / 60;
    engineRef.current?.handleDirection(direction, beat);
    setWrong(null);
  };

  const pressSpace = () => {
    if (!started) return;
    const audio = audioRef.current;
    const elapsed = audio && !audio.paused ? audio.currentTime : (performance.now() - fallbackStartRef.current) / 1000;
    const beat = elapsed * chart.bpm / 60;
    engineRef.current?.handleSpace(beat);
  };

  const onDirectionKey = (event: KeyboardEvent<HTMLButtonElement>, direction: Direction) => {
    if (event.repeat) return;
    event.preventDefault();
    pressDirection(direction);
  };

  return (
    <main className="audition-app">
      <audio ref={audioRef} preload="auto" playsInline src={chart.audioSrc} aria-label={chart.title} />

      <div className="game-stage">
        <Stage3D bpm={chart.bpm} audioRef={audioRef} actionRef={actionRef} />

        <div className="topbar">
          <div className="song-card hud-panel">
            <div className="song-art">♫</div>
            <div className="song-copy">
              <span>NOW PLAYING</span>
              <strong>{chart.title}</strong>
              <small>BPM <b>{chart.bpm}</b></small>
            </div>
            <div className="song-progress"><i style={{ width: started ? `${Math.min(100, Math.max(2, gauge))}%` : "18%" }} /></div>
          </div>

          <div className="battle-score">
            <strong className="red-score">{stats.score.toLocaleString()}</strong>
            <b>VS</b>
            <strong className="blue-score">{OPPONENT_SCORE.toLocaleString()}</strong>
            <div className="versus-bar"><i /></div>
          </div>

          <div className="top-actions">
            <button type="button" onClick={toggleSound}>{sound ? "🔊 SOUND" : "🔇 MUTED"}</button>
            <button type="button" onClick={stopGame}>EXIT</button>
          </div>
        </div>

        <aside className="left-hud">
          <div className="level-label">LEVEL <b>{started ? turn.level : "6"}</b></div>
          <div className="mission hud-panel">
            <span>MISSION</span>
            <strong>Perfect more than 20</strong>
            <small>{stats.perfect} / 20 <b>✓</b></small>
          </div>
          <div className="hint-key">F10&nbsp;&nbsp;ON/OFF</div>
        </aside>

        <aside className="right-hud">
          <div className="leaderboard hud-panel">
            <div className="rank-title"><span>RANK</span><small>PLAYER</small><small>SCORE</small></div>
            {[
              ["1st", "ToanDev", stats.score, "pink"],
              ["2nd", "Audition King", 179342, "blue"],
              ["3rd", "Dancer Pro", 165230, "gold"],
              ["4th", "Cool Girl", 142587, "cyan"],
            ].map(([rank, name, score, tone]) => (
              <div className={`rank-row ${tone}`} key={String(rank)}>
                <b>{rank}</b><span className="avatar">●</span><span className="rank-name">{name}</span><strong>{Number(score).toLocaleString()}</strong>
              </div>
            ))}
          </div>
        </aside>

        <div className="combo-hud">
          <span>COMBO</span>
          <strong>{stats.combo}</strong>
          <b>{judgement === "perfect" ? `Perfect ×${stats.combo}` : judgement ? judgement.toUpperCase() : "Ready"}</b>
        </div>

        <section className="play-hud">
          <div className="command-wrap">
            <div className="command-topline">
              <span>LEVEL {started ? turn.level : "6"}</span>
              <small>{started ? `${Math.min(completed + 1, sequence.length)} / ${sequence.length}` : "0 / 0"}</small>
            </div>
            <div className={`command-track phase-${phase}`}>
              {sequence.map((direction, index) => (
                <div key={`${turn?.id}-${index}`} className={`command-chip ${index < completed ? "done" : ""} ${index === completed ? "target" : ""} ${wrong && index === completed ? "wrong" : ""}`}>
                  <Arrow direction={direction} />
                </div>
              ))}
              {started && phase === "timing" && <div className="space-chip">SPACE</div>}
            </div>

            <div className={`timing-gauge ${phase === "timing" ? "live" : ""}`} style={{ ["--bpm" as string]: chart.bpm } as React.CSSProperties}>
              <div className="timing-track">
                <div className="zone miss"> </div><div className="zone bad"> </div><div className="zone cool"> </div><div className="zone great"> </div><div className="zone perfect"> </div><div className="zone great"> </div><div className="zone cool"> </div><div className="zone bad"> </div><div className="zone miss"> </div>
                <div className="gauge-marker" style={{ left: `${gauge}%` }} />
                <div className="breath" style={{ left: `${gauge}%` }} />
              </div>
              <div className="timing-labels"><span>MISS</span><span>BAD</span><span>COOL</span><span>GREAT</span><strong>PERFECT</strong><span>GREAT</span><span>COOL</span><span>BAD</span><span>MISS</span></div>
            </div>
          </div>
        </section>

        <div className="bottom-hud">
          <div className="chat hud-panel"><b>&lt;Public&gt;</b><span>Welcome to Audition Mobile!</span><small>Show your moves!</small><div>All <i>▶</i></div></div>
          <div className="song-meta hud-panel"><b>Audition · Club Dance</b><span>{chart.bpm} BPM &nbsp; <em>Hard</em></span><small>★★★☆☆</small></div>
          <button className={`space-button ${phase === "timing" ? "ready" : ""}`} type="button" onPointerDown={(event) => { event.preventDefault(); pressSpace(); }}>
            <strong>SPACE</strong><span>{phase === "timing" ? "TAP ON BEAT" : "WAIT"}</span>
          </button>
          <div className="mobile-score">P {stats.perfect} &nbsp; G {stats.great} &nbsp; C {stats.cool} &nbsp; B {stats.bad} &nbsp; M {stats.miss}</div>

          <div className="dpad" aria-label="Direction controls">
            <button type="button" className="dpad-up" aria-label="up" onPointerDown={(e) => { e.preventDefault(); pressDirection("up"); }} onKeyDown={(e) => onDirectionKey(e, "up")}><Arrow direction="up" /></button>
            <button type="button" className="dpad-left" aria-label="left" onPointerDown={(e) => { e.preventDefault(); pressDirection("left"); }} onKeyDown={(e) => onDirectionKey(e, "left")}><Arrow direction="left" /></button>
            <div className="dpad-core" />
            <button type="button" className="dpad-right" aria-label="right" onPointerDown={(e) => { e.preventDefault(); pressDirection("right"); }} onKeyDown={(e) => onDirectionKey(e, "right")}><Arrow direction="right" /></button>
            <button type="button" className="dpad-down" aria-label="down" onPointerDown={(e) => { e.preventDefault(); pressDirection("down"); }} onKeyDown={(e) => onDirectionKey(e, "down")}><Arrow direction="down" /></button>
          </div>
        </div>

        {!started && phase !== "finished" && (
          <div className="start-screen">
            <div className="start-card">
              <span>CLUB AUDITION · MOBILE</span>
              <h1>READY TO DANCE?</h1>
              <p>Enter the arrows, complete the sequence, then hit SPACE inside the highlighted timing zone.</p>
              <button type="button" onClick={startGame}>START GAME</button>
              {audioError && <small>Audio playback was blocked. The game still runs on the internal beat clock; tap Start again to retry sound.</small>}
            </div>
          </div>
        )}

        {phase === "finished" && (
          <div className="start-screen result-screen">
            <div className="start-card">
              <span>RESULT</span>
              <h1>{stats.score.toLocaleString()}</h1>
              <p>PERFECT {stats.perfect} · GREAT {stats.great} · COOL {stats.cool} · BAD {stats.bad} · MISS {stats.miss}</p>
              <button type="button" onClick={startGame}>PLAY AGAIN</button>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}

function Arrow({ direction }: { direction: Direction }) {
  const rotation = direction === "right" ? 0 : direction === "down" ? 90 : direction === "left" ? 180 : 270;
  return <svg viewBox="0 0 42 40" aria-hidden="true" style={{ transform: `rotate(${rotation}deg)` }}><path d="M5 14H22V8L36 20L22 32V26H5V14Z" /></svg>;
}
