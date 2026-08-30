"use client";

import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import type * as Phaser from "phaser";
import { createDemoChart } from "@/game/chart";
import type { DanceTurn, Direction, GamePhase, GameStats, Judgement } from "@/game/types";

const initialStats: GameStats = {
  score: 0,
  combo: 0,
  maxCombo: 0,
  perfect: 0,
  great: 0,
  cool: 0,
  bad: 0,
  miss: 0,
};

const directionOrder: Direction[] = ["left", "up", "down", "right"];

export default function GameShellV2() {
  const chart = useMemo(() => createDemoChart(80), []);
  const gameRef = useRef<Phaser.Game | null>(null);
  const sceneRef = useRef<any>(null);
  const pendingStartRef = useRef(false);
  const [stats, setStats] = useState<GameStats>(initialStats);
  const [sequence, setSequence] = useState<Direction[]>([]);
  const [completedCommands, setCompletedCommands] = useState(0);
  const [judgement, setJudgement] = useState<Judgement | null>(null);
  const [phase, setPhase] = useState<GamePhase>("idle");
  const [turn, setTurn] = useState<DanceTurn | undefined>();
  const [timingRatio, setTimingRatio] = useState(1);
  const [started, setStarted] = useState(false);
  const [finished, setFinished] = useState(false);
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [activeDirection, setActiveDirection] = useState<Direction | null>(null);
  const [spacePressed, setSpacePressed] = useState(false);

  useEffect(() => {
    let mounted = true;
    void import("@/game/GameScene").then(({ createPhaserGame }) => {
      if (!mounted) return;
      const game = createPhaserGame("game-container", chart, {
        onStats: setStats,
        onJudgement: (next) => {
          setJudgement(next);
          window.setTimeout(() => setJudgement(null), 550);
        },
        onSequence: (next, filled) => {
          setSequence(next.slice(0, 8));
          setCompletedCommands(filled);
        },
        onPhase: (nextPhase, nextTurn, ratio) => {
          setPhase(nextPhase);
          setTurn(nextTurn);
          setTimingRatio(ratio);
        },
        onFinished: (next) => {
          setStats(next);
          setFinished(true);
        },
        onAction: (actionId, nextJudgement) => {
          const host = document.getElementById("game-container");
          if (host) {
            host.dataset.action = actionId;
            host.dataset.judgement = nextJudgement;
          }
        },
      });
      gameRef.current = game;
      sceneRef.current = game.scene.getScene("GameScene");
      if (pendingStartRef.current) {
        pendingStartRef.current = false;
        sceneRef.current?.startRound();
      }
    });
    return () => {
      mounted = false;
      gameRef.current?.destroy(true);
      gameRef.current = null;
      sceneRef.current = null;
    };
  }, [chart]);

  function startGame() {
    setStats(initialStats);
    setFinished(false);
    setStarted(true);
    setJudgement(null);
    sceneRef.current?.startRound();
    if (!sceneRef.current) pendingStartRef.current = true;
  }

  function pressDirection(direction: Direction) {
    setActiveDirection(direction);
    window.setTimeout(() => setActiveDirection(null), 110);
    sceneRef.current?.handleInput(direction);
  }

  function pressSpace() {
    setSpacePressed(true);
    window.setTimeout(() => setSpacePressed(false), 110);
    sceneRef.current?.handleSpace();
  }

  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>, direction: Direction) {
    if (event.repeat) return;
    event.preventDefault();
    pressDirection(direction);
  }

  const gaugePercent = Math.max(0, Math.min(100, Math.round((timingRatio + 1) * 50)));

  return (
    <main className="shell audition-shell">
      <header className="header audition-header">
        <div className="brand">
          <div className="brand-mark">A</div>
          <div>
            <h1>Audition Mobile</h1>
            <p>Rhythm Dance · {chart.title} · {chart.bpm} BPM</p>
          </div>
        </div>
        <div className="header-actions">
          <button className="pill" onClick={() => setAudioEnabled((value) => !value)}>
            {audioEnabled ? "🔊 Sound ON" : "🔇 Sound OFF"}
          </button>
          <span className="pill">TURN {turn?.id ?? 0}/50</span>
        </div>
      </header>

      <section className="game-card audition-game-card">
        <div className="game-wrap audition-game-wrap">
          <div id="game-container" aria-hidden="true" />

          <div className="hud audition-ui">
            <div className="battle-hud">
              <div className="player-badge"><span className="badge-label">PLAYER</span><b>ToanDev</b></div>
              <div className="battle-score"><span>{stats.score.toLocaleString()}</span><i /><span>198,765</span></div>
              <div className="level-badge"><small>LEVEL</small><strong>{turn?.level ?? "-"}</strong></div>
            </div>

            <div className="score-hud">
              <div><small>SCORE</small><strong>{stats.score.toLocaleString()}</strong></div>
              <div><small>COMBO</small><strong>{stats.combo}x</strong></div>
              <div><small>MAX</small><strong>{stats.maxCombo}</strong></div>
            </div>

            {judgement && <div className={`judgement ${judgement}`}>{judgement.toUpperCase()}!</div>}

            <div className="command-area audition-command-area">
              <div className="command-heading">
                <span>LEVEL {turn?.level ?? "-"}</span>
                <small>{Math.min(completedCommands + 1, Math.max(sequence.length, 1))} / {sequence.length || 0}</small>
              </div>
              <div className={`command-bar command-bar-v2 command-bar-outline phase-${phase}`} aria-label="Upcoming commands">
                {sequence.map((direction, index) => (
                  <div key={`${turn?.id ?? 0}-${index}`} className={["command-step", index < completedCommands ? "command-completed" : "", index === completedCommands ? "command-target" : ""].filter(Boolean).join(" ")}>
                    <ArrowIcon direction={direction} filled={index < completedCommands} target={index === completedCommands} />
                    {index === completedCommands && <i className="command-target-line" aria-hidden="true" />}
                  </div>
                ))}
              </div>

              <div className={`timing-gauge-real ${phase === "timing" ? "is-live" : ""}`}>
                <div className="timing-track">
                  <span className="timing-zone miss-left" />
                  <span className="timing-zone bad-zone" />
                  <span className="timing-zone cool-zone" />
                  <span className="timing-zone great-zone" />
                  <span className="timing-zone perfect-zone" />
                  <span className="timing-zone great-zone" />
                  <span className="timing-zone cool-zone" />
                  <span className="timing-zone bad-zone" />
                  <span className="timing-zone miss-right" />
                  <b className="timing-marker" style={{ left: `${gaugePercent}%` }} />
                  <i className="timing-center" />
                </div>
                <div className="timing-labels"><span>MISS</span><span>BAD</span><span>COOL</span><span>GREAT</span><strong>PERFECT</strong><span>GREAT</span><span>COOL</span><span>BAD</span><span>MISS</span></div>
              </div>
            </div>

            <div className="controls-row-v2 audition-controls">
              <button className={`space-button-v2 ${spacePressed ? "space-pressed" : ""} ${phase === "timing" ? "space-ready" : ""}`} onPointerDown={(event) => { event.preventDefault(); pressSpace(); }} aria-label="Space timing button">
                <span>SPACE</span><small>{phase === "timing" ? "TAP ON BEAT" : "READY"}</small>
              </button>
              <div className="dpad-v2" aria-label="Direction controls">
                {directionOrder.map((direction) => (
                  <button key={direction} className={`dpad-${direction} ${activeDirection === direction ? "dpad-active" : ""} ${sequence[completedCommands] === direction && phase === "input" ? "dpad-target" : ""}`} onPointerDown={(event) => { event.preventDefault(); pressDirection(direction); }} onKeyDown={(event) => onKeyDown(event, direction)} aria-label={direction}>
                    <ArrowIcon direction={direction} filled={false} target={sequence[completedCommands] === direction} compact />
                  </button>
                ))}
                <span className="dpad-center-v2" aria-hidden="true" />
              </div>
            </div>

            <div className="mini-stats"><span>P {stats.perfect}</span><span>G {stats.great}</span><span>C {stats.cool}</span><span>B {stats.bad}</span><span>M {stats.miss}</span></div>
          </div>

          {!started && !finished && (
            <div className="start-overlay">
              <div className="start-panel">
                <div className="ready-kicker">AUDITION MOBILE</div>
                <h2>Ready to dance?</h2>
                <p>Nhập chuỗi command → hoàn tất → nhấn SPACE đúng beat để thực hiện dance action.</p>
                <button className="button primary" onClick={startGame}>Start Game</button>
              </div>
            </div>
          )}

          {finished && (
            <div className="start-overlay result-overlay">
              <div className="start-panel">
                <div className="ready-kicker">RESULT</div>
                <h2>{stats.score.toLocaleString()}</h2>
                <p>PERFECT {stats.perfect} · GREAT {stats.great} · COOL {stats.cool} · BAD {stats.bad} · MISS {stats.miss}</p>
                <button className="button primary" onClick={() => window.location.reload()}>Play Again</button>
              </div>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}

function ArrowIcon({ direction, filled, target, compact = false }: { direction: Direction; filled: boolean; target: boolean; compact?: boolean }) {
  const rotation = direction === "right" ? 0 : direction === "down" ? 90 : direction === "left" ? 180 : 270;
  return (
    <svg className={`command-arrow-icon ${compact ? "dpad-arrow-icon" : "command-arrow-v2"} ${filled ? "is-filled" : "is-outline"} ${target ? "is-target" : ""}`} viewBox="0 0 42 40" aria-hidden="true" style={{ transform: `rotate(${rotation}deg)` }}>
      <path d="M5 14H22V8L36 20L22 32V26H5V14Z" fill={filled ? "currentColor" : "rgba(0,0,0,0.015)"} stroke="currentColor" strokeWidth="1.8" strokeLinejoin="miter" />
    </svg>
  );
}
