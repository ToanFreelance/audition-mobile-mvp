"use client";

import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import type * as Phaser from "phaser";
import { createDemoChart } from "@/game/chart";
import type { Direction, GameStats, Judgement } from "@/game/types";

const initialStats: GameStats = {
  score: 0, combo: 0, maxCombo: 0,
  perfect: 0, great: 0, cool: 0, bad: 0, miss: 0
};

const buttons: { direction: Direction; label: string }[] = [
  { direction: "left", label: "←" },
  { direction: "up", label: "↑" },
  { direction: "down", label: "↓" },
  { direction: "right", label: "→" }
];

export default function GameShell() {
  const chart = useMemo(() => createDemoChart(), []);
  const gameRef = useRef<Phaser.Game | null>(null);
  const sceneRef = useRef<any>(null);
  const [stats, setStats] = useState<GameStats>(initialStats);
  const [judgement, setJudgement] = useState<Judgement | null>(null);
  const [started, setStarted] = useState(false);
  const [finished, setFinished] = useState(false);
  const [audioEnabled, setAudioEnabled] = useState(true);

  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!mounted) return;
      const { createPhaserGame } =
       await import("@/game/GameScene");
     if (!mounted) return
      const game = createPhaserGame("game-container", chart, {
        onStats: (next) => setStats(next),
        onJudgement: (next) => {
          setJudgement(next);
          window.setTimeout(() => setJudgement(null), 220);
        },
        onFinished: (next) => {
          setStats(next);
          setFinished(true);
        }
      });
      gameRef.current = game;
      sceneRef.current = game.scene.getScene("GameScene");
    })();

    return () => {
      mounted = false;
      gameRef.current?.destroy(true);
      gameRef.current = null;
    };
  }, [chart]);

  function startGame() {
    setStats(initialStats);
    setFinished(false);
    setStarted(true);
    sceneRef.current?.startRound();
    if (audioEnabled) playMetronome(chart.bpm, 5);
  }

  function restart() {
    window.location.reload();
  }

  function press(direction: Direction) {
    sceneRef.current?.handleInput(direction);
  }

  function onKeyDown(e: KeyboardEvent<HTMLButtonElement>, direction: Direction) {
    if (e.repeat) return;
    e.preventDefault();
    press(direction);
  }

  return (
    <main className="shell">
      <header className="header">
        <div className="brand">
          <div className="brand-mark">A</div>
          <div>
            <h1>Audition Mobile — Rhythm Prototype</h1>
            <p>Frontend-only MVP · Phaser + Next.js · mobile-first</p>
          </div>
        </div>
        <div className="header-actions">
          <button className="pill" onClick={() => setAudioEnabled(v => !v)}>
            {audioEnabled ? "🔊 Beat ON" : "🔇 Beat OFF"}
          </button>
          <span className="pill">BPM {chart.bpm}</span>
        </div>
      </header>

      <section className="game-card">
        <div className="game-wrap">
          <div id="game-container" />

          <div className="hud">
            <div className="hud-top">
              <div className="score-box">
                <div className="score-label">Score</div>
                <div className="score">{stats.score.toLocaleString()}</div>
              </div>
              <div className="combo-box">
                <div className="combo-label">Combo</div>
                <div className="combo">{stats.combo}x</div>
              </div>
            </div>

            {judgement && <div className={`judgement ${judgement}`}>{judgement.toUpperCase()}</div>}

            <div className="song-box">
              <div className="song-title">{chart.title}</div>
              <div className="song-meta">128 BPM · Demo chart · keyboard / touch</div>
            </div>

            <div className="mobile-controls">
              {buttons.map(button => (
                <button
                  key={button.direction}
                  className="control"
                  aria-label={button.direction}
                  onPointerDown={(e) => { e.preventDefault(); press(button.direction); }}
                  onKeyDown={(e) => onKeyDown(e, button.direction)}
                >
                  {button.label}
                </button>
              ))}
            </div>
          </div>

          {!started && !finished && (
            <div className="start-overlay">
              <div className="start-panel">
                <h2>Ready to dance?</h2>
                <p>
                  Hit the arrows when the notes reach the glowing receptors. Try to keep your combo alive.
                  On desktop use <span className="kbd">← ↑ ↓ →</span> or <span className="kbd">WASD</span>.
                </p>
                <div className="row">
                  <button className="button primary" onClick={startGame}>Start Demo</button>
                  <button className="button" onClick={() => setAudioEnabled(v => !v)}>
                    {audioEnabled ? "Sound on" : "Sound off"}
                  </button>
                </div>
              </div>
            </div>
          )}

          {finished && (
            <div className="results">
              <div className="results-card">
                <h2>Dance Complete ✨</h2>
                <div className="results-score">{stats.score.toLocaleString()}</div>
                <div className="stats">
                  <div className="stat"><b>{stats.perfect}</b><span>Perfect</span></div>
                  <div className="stat"><b>{stats.great}</b><span>Great</span></div>
                  <div className="stat"><b>{stats.maxCombo}</b><span>Max Combo</span></div>
                </div>
                <button className="button primary" onClick={restart}>Play Again</button>
              </div>
            </div>
          )}
        </div>
      </section>

      <section className="info-grid">
        <div className="panel">
          <h3>🎯 What this prototype already tests</h3>
          <p>
            Fixed-BPM beat clock, note spawning, 4-direction input, Perfect/Great/Cool/Bad/Miss windows,
            combo + score, touch controls, keyboard controls, responsive Phaser canvas and a lightweight dance avatar.
          </p>
        </div>
        <div className="panel">
          <h3>🧱 Next engineering step</h3>
          <p>
            Replace the procedural demo chart with a real chart format, add audio-time synchronization,
            hit effects, character animation states, song selection and a chart editor. Backend/multiplayer can come later.
          </p>
        </div>
      </section>
    </main>
  );
}

function playMetronome(bpm: number, bars: number) {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    const ctx = new AudioContextClass();
    const interval = 60 / bpm;
    const start = ctx.currentTime + 0.08;
    const total = bars * 4;

    for (let i = 0; i < total; i++) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const t = start + i * interval;
      osc.frequency.value = i % 4 === 0 ? 880 : 660;
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(0.09, t + 0.006);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.055);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.06);
    }

    window.setTimeout(() => ctx.close(), (total * interval + 300) * 1.1);
  } catch {
    // Audio is optional. The rhythm engine still works without it.
  }
}
