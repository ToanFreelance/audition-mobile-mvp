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
      <style>{`
        .audition-shell { max-width: 1380px; }
        .audition-header { margin-bottom: 10px; }
        .audition-game-card { overflow: hidden; }
        .audition-game-wrap { min-height: 620px; }
        .battle-hud { position: absolute; top: 14px; left: 16px; right: 16px; z-index: 5; display: grid; grid-template-columns: 1fr minmax(220px, .8fr) 1fr; align-items: center; gap: 12px; pointer-events: none; }
        .player-badge, .level-badge, .score-hud, .mini-stats { border: 1px solid rgba(255,255,255,.14); background: rgba(8,10,25,.72); backdrop-filter: blur(8px); }
        .player-badge { justify-self: start; padding: 7px 12px; border-radius: 9px; min-width: 120px; }
        .player-badge b { display:block; font-size: 13px; }
        .badge-label, .level-badge small, .score-hud small { display:block; color: rgba(255,255,255,.58); font-size: 9px; letter-spacing: .12em; }
        .battle-score { display:flex; align-items:center; justify-content:center; gap:12px; font-weight:900; font-size:18px; text-shadow:0 2px 14px rgba(255,79,216,.28); }
        .battle-score i { width:110px; height:7px; border-radius:99px; background:linear-gradient(90deg,#ff4fd8 0 50%,#62d8ff 50% 100%); border:1px solid rgba(255,255,255,.28); }
        .level-badge { justify-self:end; padding:7px 14px; border-radius:9px; text-align:center; }
        .level-badge strong { font-size:24px; line-height:1; }
        .score-hud { position:absolute; top:78px; right:18px; z-index:5; display:flex; gap:14px; padding:8px 11px; border-radius:9px; pointer-events:none; }
        .score-hud div { min-width:54px; text-align:center; }
        .score-hud strong { display:block; font-size:13px; }
        .audition-command-area { position:absolute; left:50%; bottom:158px; transform:translateX(-50%); width:min(760px,calc(100% - 36px)); z-index:6; }
        .audition-command-area .command-heading { display:flex; justify-content:space-between; align-items:center; color:#fff; font-weight:900; letter-spacing:.08em; margin-bottom:6px; }
        .audition-command-area .command-heading small { opacity:.62; font-weight:700; }
        .timing-gauge-real { margin-top:8px; opacity:.58; transition:opacity 120ms ease,transform 120ms ease; }
        .timing-gauge-real.is-live { opacity:1; transform:scaleY(1.05); }
        .timing-track { height:18px; display:grid; grid-template-columns:1fr 1fr 1fr 1fr .58fr 1fr 1fr 1fr 1fr; position:relative; overflow:hidden; border-radius:4px; border:1px solid rgba(255,255,255,.28); background:rgba(0,0,0,.48); }
        .timing-zone { border-right:1px solid rgba(255,255,255,.14); }
        .miss-left,.miss-right { background:rgba(255,70,100,.22); }
        .bad-zone { background:rgba(255,151,72,.30); }
        .cool-zone { background:rgba(255,220,80,.34); }
        .great-zone { background:rgba(116,238,255,.34); }
        .perfect-zone { background:rgba(255,255,255,.86); box-shadow:inset 0 0 0 1px rgba(255,255,255,.7); }
        .timing-marker { position:absolute; top:-5px; bottom:-5px; width:3px; margin-left:-1px; background:#fff; box-shadow:0 0 10px rgba(255,255,255,.9); z-index:3; transition:left 30ms linear; }
        .timing-center { position:absolute; left:50%; top:0; bottom:0; width:1px; background:rgba(20,20,30,.65); z-index:2; }
        .timing-labels { display:grid; grid-template-columns:1fr 1fr 1fr 1fr .58fr 1fr 1fr 1fr 1fr; margin-top:3px; font-size:7px; color:rgba(255,255,255,.54); text-align:center; }
        .timing-labels strong { color:#fff; font-size:8px; }
        .space-ready { box-shadow:0 0 0 2px rgba(255,255,255,.24),0 8px 32px rgba(255,79,216,.25); }
        .mini-stats { position:absolute; left:18px; bottom:24px; z-index:6; display:flex; gap:10px; padding:7px 10px; border-radius:8px; font-size:10px; pointer-events:none; }
        .start-overlay { z-index:20; }
        .result-overlay .start-panel h2 { font-size:42px; }
        #game-container[data-judgement="perfect"] canvas { animation:audition-perfect .42s ease-out; }
        #game-container[data-judgement="great"] canvas { animation:audition-great .32s ease-out; }
        #game-container[data-judgement="cool"] canvas { animation:audition-cool .25s ease-out; }
        @keyframes audition-perfect { 0%{transform:scale(1)} 35%{transform:scale(1.018)} 100%{transform:scale(1)} }
        @keyframes audition-great { 0%{transform:translateY(0)} 40%{transform:translateY(-4px)} 100%{transform:translateY(0)} }
        @keyframes audition-cool { 0%{transform:translateX(0)} 50%{transform:translateX(2px)} 100%{transform:translateX(0)} }
        @media (max-width:700px) {
          .audition-game-wrap { min-height:570px; }
          .battle-hud { top:9px; left:9px; right:9px; grid-template-columns:1fr auto 1fr; gap:6px; }
          .player-badge { min-width:0; padding:5px 8px; }
          .battle-score { gap:5px; font-size:12px; }
          .battle-score i { width:54px; height:5px; }
          .level-badge { padding:5px 8px; }
          .level-badge strong { font-size:18px; }
          .score-hud { top:53px; right:9px; gap:6px; padding:5px 6px; }
          .score-hud div { min-width:42px; }
          .score-hud strong { font-size:11px; }
          .audition-command-area { bottom:150px; width:calc(100% - 18px); }
          .command-step { min-width:28px; }
          .mini-stats { left:9px; bottom:15px; gap:6px; font-size:8px; padding:5px 7px; }
          .timing-track { height:14px; }
          .timing-labels { font-size:6px; }
        }
        @media (prefers-reduced-motion:reduce) {
          #game-container[data-judgement="perfect"] canvas,#game-container[data-judgement="great"] canvas,#game-container[data-judgement="cool"] canvas { animation:none; }
        }
      `}</style>

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
            {audioEnabled ? "🔊 Beat ON" : "🔇 Beat OFF"}
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
                <button className="button primary" onClick={startGame}>Start Demo</button>
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
