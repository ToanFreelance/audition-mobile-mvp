"use client";

import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import type * as Phaser from "phaser";
import { createDemoChart } from "@/game/chart";
import type { Direction, GameStats, Judgement } from "@/game/types";

const initialStats: GameStats = {
  score: 0, combo: 0, maxCombo: 0,
  perfect: 0, great: 0, cool: 0, bad: 0, miss: 0
};

const fallbackSequence: Direction[] = [
  "left",
  "up",
  "down",
  "right",
  "left",
  "right",
  "up",
  "down"
];

export default function GameShell() {
  const chart = useMemo(() => createDemoChart(), []);
  const gameRef = useRef<Phaser.Game | null>(null);
  const sceneRef = useRef<any>(null);

  const [stats, setStats] = useState<GameStats>(initialStats);
  const [judgement, setJudgement] = useState<Judgement | null>(null);
  const [sequence, setSequence] = useState<Direction[]>(fallbackSequence);
  const [started, setStarted] = useState(false);
  const [finished, setFinished] = useState(false);
  const [audioEnabled, setAudioEnabled] = useState(true);

  useEffect(() => {
    let mounted = true;

    (async () => {
      const { createPhaserGame } = await import("@/game/GameScene");

      if (!mounted) return;

      const game = createPhaserGame("game-container", chart, {
        onStats: (next) => setStats(next),

        onJudgement: (next) => {
          setJudgement(next);

          window.setTimeout(() => {
            setJudgement(null);
          }, 320);
        },

        onSequence: (next) => {
          if (next.length) {
            setSequence(next);
          }
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
      sceneRef.current = null;
    };
  }, [chart]);

  function startGame() {
    setStats(initialStats);
    setFinished(false);
    setStarted(true);

    sceneRef.current?.startRound();

    if (audioEnabled) {
      playMetronome(chart.bpm, 4);
    }
  }

  function restart() {
    window.location.reload();
  }

  function press(direction: Direction) {
    sceneRef.current?.handleInput(direction);
  }

  function pressSpace() {
    // SPACE is intentionally visual-only in Part 1.
    // Part 2 will move the timing/judgement mechanic here.
  }

  function onKeyDown(
    e: KeyboardEvent<HTMLButtonElement>,
    direction: Direction
  ) {
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
            <h1>Audition Mobile — Stage Prototype</h1>

            <p>
              Part 1 · Stage + responsive gameplay HUD · frontend only
            </p>
          </div>
        </div>

        <div className="header-actions">
          <button
            className="pill"
            onClick={() => setAudioEnabled(v => !v)}
          >
            {audioEnabled ? "🔊 Beat ON" : "🔇 Beat OFF"}
          </button>

          <span className="pill">
            BPM {chart.bpm}
          </span>
        </div>
      </header>

      <section className="game-card">
        <div className="game-wrap">
          <div id="game-container" />

          <div className="hud">
            <div className="hud-top">
              <div className="rank-panel">
                <div className="rank-title">
                  RANKING
                </div>

                <div className="rank-row">
                  <span>1ST</span>
                  <b>ToanDev</b>
                  <strong>235,432</strong>
                </div>

                <div className="rank-row">
                  <span>2ND</span>
                  <b>Luna</b>
                  <strong>198,765</strong>
                </div>

                <div className="rank-row">
                  <span>3RD</span>
                  <b>Kenzo</b>
                  <strong>176,543</strong>
                </div>

                <div className="rank-row">
                  <span>4TH</span>
                  <b>Miyuki</b>
                  <strong>165,231</strong>
                </div>
              </div>

              <div className="player-score">
                <div>
                  <span>SCORE</span>
                  <b>{stats.score.toLocaleString()}</b>
                </div>

                <div className="score-divider" />

                <div className="combo-display">
                  <span>COMBO</span>
                  <b>{stats.combo}x</b>
                </div>
              </div>
            </div>

            {judgement && (
              <div className={`judgement ${judgement}`}>
                {judgement.toUpperCase()}!
              </div>
            )}

            <div className="song-box">
              <div className="song-icon">
                ♫
              </div>

              <div>
                <div className="song-title">
                  {chart.title}
                </div>

                <div className="song-meta">
                  {chart.bpm} BPM · Demo Stage
                </div>
              </div>
            </div>

            <div className="gameplay-hud">
              <div className="command-section">
                <div className="hud-caption">
                  CHUỖI COMMAND
                </div>

                <div
                  className="command-bar"
                  aria-label="Upcoming commands"
                >
                  {sequence.map((direction, index) => (
                    <span
                      key={`${direction}-${index}`}
                      className={`command-arrow ${direction}`}
                    >
                      {directionToArrow(direction)}
                    </span>
                  ))}

                  {sequence.length < 8 && (
                    <span className="command-more">
                      •••
                    </span>
                  )}
                </div>
              </div>

              <div className="controls-row">
                <button
                  className="space-button"
                  onPointerDown={(e) => {
                    e.preventDefault();
                    pressSpace();
                  }}
                  aria-label="Space timing button"
                >
                  SPACE

                  <small>
                    TIMING · PART 2
                  </small>
                </button>

                <div
                  className="dpad"
                  aria-label="Direction controls"
                >
                  <button
                    className="dpad-up"
                    onPointerDown={(e) => {
                      e.preventDefault();
                      press("up");
                    }}
                    onKeyDown={(e) =>
                      onKeyDown(e, "up")
                    }
                  >
                    ↑
                  </button>

                  <button
                    className="dpad-left"
                    onPointerDown={(e) => {
                      e.preventDefault();
                      press("left");
                    }}
                    onKeyDown={(e) =>
                      onKeyDown(e, "left")
                    }
                  >
                    ←
                  </button>

                  <button
                    className="dpad-center"
                    aria-hidden="true"
                  >
                    •
                  </button>

                  <button
                    className="dpad-right"
                    onPointerDown={(e) => {
                      e.preventDefault();
                      press("right");
                    }}
                    onKeyDown={(e) =>
                      onKeyDown(e, "right")
                    }
                  >
                    →
                  </button>

                  <button
                    className="dpad-down"
                    onPointerDown={(e) => {
                      e.preventDefault();
                      press("down");
                    }}
                    onKeyDown={(e) =>
                      onKeyDown(e, "down")
                    }
                  >
                    ↓
                  </button>
                </div>
              </div>
            </div>
          </div>

          {!started && !finished && (
            <div className="start-overlay">
              <div className="start-panel">
                <div className="ready-kicker">
                  STAGE PROTOTYPE · PART 1
                </div>

                <h2>
                  Ready to dance?
                </h2>

                <p>
                  This pass focuses on the stage,
                  responsive HUD, command bar and
                  two-thumb controls. Arrow input is
                  already connected to the existing
                  rhythm engine.
                </p>

                <div className="row">
                  <button
                    className="button primary"
                    onClick={startGame}
                  >
                    Start Demo
                  </button>

                  <button
                    className="button"
                    onClick={() =>
                      setAudioEnabled(v => !v)
                    }
                  >
                    {audioEnabled
                      ? "Sound on"
                      : "Sound off"}
                  </button>
                </div>
              </div>
            </div>
          )}

          {finished && (
            <div className="results">
              <div className="results-card">
                <h2>
                  Dance Complete ✨
                </h2>

                <div className="results-score">
                  {stats.score.toLocaleString()}
                </div>

                <div className="stats">
                  <div className="stat">
                    <b>{stats.perfect}</b>
                    <span>Perfect</span>
                  </div>

                  <div className="stat">
                    <b>{stats.great}</b>
                    <span>Great</span>
                  </div>

                  <div className="stat">
                    <b>{stats.maxCombo}</b>
                    <span>Max Combo</span>
                  </div>
                </div>

                <button
                  className="button primary"
                  onClick={restart}
                >
                  Play Again
                </button>
              </div>
            </div>
          )}
        </div>
      </section>

      <section className="info-grid">
        <div className="panel">
          <h3>
            ✅ Part 1 implemented
          </h3>

          <p>
            New club stage composition, five dancer
            placeholders, ranking HUD, command bar,
            landscape/portrait responsive layout,
            left-hand SPACE control and right-hand
            D-pad. Existing beat clock, scoring and
            directional input remain intact.
          </p>
        </div>

        <div className="panel">
          <h3>
            ➡️ Next part
          </h3>

          <p>
            The next isolated pass will replace the
            old note timing with the Audition-style
            command sequence + 75–95% score zone,
            including the white-gradient PERFECT
            center and MISS outside the zone.
          </p>
        </div>
      </section>
    </main>
  );
}

function directionToArrow(direction: Direction) {
  return direction === "left"
    ? "←"
    : direction === "up"
      ? "↑"
      : direction === "down"
        ? "↓"
        : "→";
}

function playMetronome(
  bpm: number,
  bars: number
) {
  try {
    const AudioContextClass =
      window.AudioContext ||
      (window as any).webkitAudioContext;

    const ctx = new AudioContextClass();

    const interval = 60 / bpm;
    const start = ctx.currentTime + 0.08;
    const total = bars * 4;

    for (let i = 0; i < total; i++) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      const t = start + i * interval;

      osc.frequency.value =
        i % 4 === 0 ? 880 : 660;

      gain.gain.setValueAtTime(
        0.0001,
        t
      );

      gain.gain.exponentialRampToValueAtTime(
        0.09,
        t + 0.006
      );

      gain.gain.exponentialRampToValueAtTime(
        0.0001,
        t + 0.055
      );

      osc.connect(gain).connect(ctx.destination);

      osc.start(t);
      osc.stop(t + 0.06);
    }

    window.setTimeout(
      () => ctx.close(),
      (total * interval + 300) * 1.1
    );
  } catch {
    // Audio is optional.
  }
}