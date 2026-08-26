"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import type * as Phaser from "phaser";
import { createDemoChart } from "@/game/chart";
import type {
  Direction,
  GameStats,
  Judgement,
} from "@/game/types";

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

const fallbackSequence: Direction[] = [
  "left",
  "up",
  "down",
  "right",
  "left",
  "right",
  "up",
  "down",
];

const directionOrder: Direction[] = [
  "left",
  "up",
  "down",
  "right",
];

const keyToDirection: Record<
  string,
  Direction
> = {
  ArrowLeft: "left",
  ArrowUp: "up",
  ArrowDown: "down",
  ArrowRight: "right",
  a: "left",
  w: "up",
  s: "down",
  d: "right",
};

export default function GameShell() {
  const chart = useMemo(
    () => createDemoChart(),
    []
  );

  const gameRef =
    useRef<Phaser.Game | null>(null);

  const sceneRef =
    useRef<any>(null);

  const activeDirectionTimer =
    useRef<number | null>(null);

  /*
   * Number of commands already correctly
   * entered in the current command sequence.
   *
   * Example:
   *
   *   ← ↑ ↓ → ← ↑ ↓ →
   *   ✓
   *
   * becomes:
   *
   *   ← ↑ ↓ → ← ↑ ↓ →
   *     ↑
   *     TARGET
   *
   * The filled state is therefore based on
   * command INDEX, not direction.
   */
  const [
    completedCommands,
    setCompletedCommands,
  ] = useState(0);

  const [
    filledFirst,
    setFilledFirst,
  ] = useState(false);

  const [
    stats,
    setStats,
  ] = useState<GameStats>(
    initialStats
  );

  const [
    judgement,
    setJudgement,
  ] = useState<Judgement | null>(
    null
  );

  const [
    sequence,
    setSequence,
  ] = useState<Direction[]>(
    fallbackSequence
  );

  const [
    started,
    setStarted,
  ] = useState(false);

  const [
    finished,
    setFinished,
  ] = useState(false);

  const [
    audioEnabled,
    setAudioEnabled,
  ] = useState(true);

  /*
   * Temporary press feedback.
   *
   * This is NOT the completed state.
   * It is only used for the very short
   * physical button press animation.
   */
  const [
    activeDirection,
    setActiveDirection,
  ] = useState<Direction | null>(
    null
  );

  /*
   * Wrong input feedback.
   */
  const [
    wrongDirection,
    setWrongDirection,
  ] = useState<Direction | null>(
    null
  );

  const [
    spacePressed,
    setSpacePressed,
  ] = useState(false);

  useEffect(() => {
    let mounted = true;

    (async () => {
      const {
        createPhaserGame,
      } = await import(
        "@/game/GameScene"
      );

      if (!mounted) {
        return;
      }

      const game =
        createPhaserGame(
          "game-container",
          chart,
          {
            onStats: (next) =>
              setStats(next),

            onJudgement: (
              next
            ) => {
              setJudgement(
                next
              );

              window.setTimeout(
                () => {
                  setJudgement(
                    null
                  );
                },
                320
              );
            },

            onSequence: (
              next,
              nextFilledFirst
            ) => {
              const nextSequence =
                next.length
                  ? next.slice(0, 8)
                  : fallbackSequence;

              /*
               * When the engine advances the
               * command sequence, reset the
               * local visual completion state.
               *
               * The engine remains the source
               * of truth for the actual gameplay.
               */
              setSequence(
                nextSequence
              );

              setFilledFirst(
                nextFilledFirst
              );

              setCompletedCommands(
                nextFilledFirst ? 1 : 0
              );
            },

            onFinished: (
              next
            ) => {
              setStats(
                next
              );

              setFinished(
                true
              );
            },
          }
        );

      gameRef.current =
        game;

      sceneRef.current =
        game.scene.getScene(
          "GameScene"
        );
    })();

    return () => {
      mounted = false;

      gameRef.current?.destroy(
        true
      );

      gameRef.current =
        null;

      sceneRef.current =
        null;
    };
  }, [chart]);

  /*
   * Keyboard input.
   *
   * Phaser remains responsible for
   * actual gameplay processing.
   *
   * This listener only controls the
   * visual UI feedback.
   */
  useEffect(() => {
    const onKeyDown = (
      event: globalThis.KeyboardEvent
    ) => {
      const direction =
        keyToDirection[
          event.key
        ];

      if (
        !direction ||
        event.repeat
      ) {
        return;
      }

      pressDirection(
        direction
      );
    };

    window.addEventListener(
      "keydown",
      onKeyDown
    );

    return () =>
      window.removeEventListener(
        "keydown",
        onKeyDown
      );
  }, [sequence, completedCommands]);

  useEffect(() => {
    return () => {
      if (
        activeDirectionTimer.current !==
        null
      ) {
        window.clearTimeout(
          activeDirectionTimer.current
        );
      }
    };
  }, []);

  function startGame() {
    setStats(
      initialStats
    );

    setFinished(
      false
    );

    setStarted(
      true
    );

    setSequence(
      fallbackSequence
    );

    setCompletedCommands(
      0
    );

    sceneRef.current?.startRound();

    if (audioEnabled) {
      playMetronome(
        chart.bpm,
        4
      );
    }
  }

  function restart() {
    window.location.reload();
  }

  /*
   * Short physical press animation.
   */
  function flashDirection(
    direction: Direction
  ) {
    setActiveDirection(
      direction
    );

    if (
      activeDirectionTimer.current !==
      null
    ) {
      window.clearTimeout(
        activeDirectionTimer.current
      );
    }

    activeDirectionTimer.current =
      window.setTimeout(
        () => {
          setActiveDirection(
            null
          );
        },
        105
      );
  }

  /*
   * Direction input.
   *
   * IMPORTANT:
   *
   * We only mark the current arrow as
   * FILLED when it matches the current
   * target.
   *
   * Wrong direction:
   * - stays outline
   * - gets a short red feedback
   *
   * Correct direction:
   * - becomes filled
   * - glows
   * - advances to the next command
   */
  function pressDirection(
    direction: Direction
  ) {
    flashDirection(
      direction
    );

    /*
     * Do not fill an arrow from the UI alone.
     * GameScene/RhythmEngine is the source of truth.
     */
    sceneRef.current?.handleInput(
      direction
    );
  }

  function pressSpace() {
    setSpacePressed(
      true
    );

    window.setTimeout(
      () => {
        setSpacePressed(
          false
        );
      },
      100
    );

    /*
     * Timing Gauge / judgement logic
     * will be connected in Part 3.
     */
    sceneRef.current?.handleSpace?.();
  }

  function onKeyDown(
    event: KeyboardEvent<HTMLButtonElement>,
    direction: Direction
  ) {
    if (event.repeat) {
      return;
    }

    event.preventDefault();

    pressDirection(
      direction
    );
  }

  const visibleSequence =
    sequence.slice(0, 8);

  return (
    <main className="shell">

      {/* =====================================================
          HEADER
      ====================================================== */}

      <header className="header">

        <div className="brand">

          <div className="brand-mark">
            A
          </div>

          <div>

            <h1>
              Audition Mobile —
              Rhythm Prototype
            </h1>

            <p>
              Part 2 · Command UI +
              mobile controls · frontend only
            </p>

          </div>

        </div>

        <div className="header-actions">

          <button
            className="pill"
            onClick={() =>
              setAudioEnabled(
                value => !value
              )
            }
          >
            {audioEnabled
              ? "🔊 Beat ON"
              : "🔇 Beat OFF"}
          </button>

          <span className="pill">
            BPM {chart.bpm}
          </span>

        </div>

      </header>

      {/* =====================================================
          GAME
      ====================================================== */}

      <section className="game-card">

        <div className="game-wrap">

          <div
            id="game-container"
            aria-hidden="true"
          />

          <div className="hud audition-ui">

            {/* =================================================
                TOP HUD
            ================================================== */}

            <div className="hud-top">

              <div className="hud-left-column">

                <div className="song-box sketch-card">

                  <div className="song-icon">
                    ♫
                  </div>

                  <div>

                    <div className="song-title">
                      {chart.title}
                    </div>

                    <div className="song-meta">
                      {chart.bpm} BPM ·
                      Neon Groove
                    </div>

                  </div>

                </div>

                <div className="rank-panel sketch-card">

                  <div className="rank-title">
                    RANKING
                  </div>

                  <div className="rank-row rank-you">

                    <span>
                      1ST
                    </span>

                    <b>
                      ToanDev
                    </b>

                    <strong>
                      {stats.score.toLocaleString()}
                    </strong>

                  </div>

                  <div className="rank-row">

                    <span>
                      2ND
                    </span>

                    <b>
                      Luna
                    </b>

                    <strong>
                      198,765
                    </strong>

                  </div>

                  <div className="rank-row">

                    <span>
                      3RD
                    </span>

                    <b>
                      Kenzo
                    </b>

                    <strong>
                      176,543
                    </strong>

                  </div>

                  <div className="rank-row">

                    <span>
                      4TH
                    </span>

                    <b>
                      Miyuki
                    </b>

                    <strong>
                      165,231
                    </strong>

                  </div>

                </div>

              </div>

              <div className="my-score sketch-card">

                <div className="my-score-title">
                  MY SCORE
                </div>

                <div className="my-score-value">
                  {stats.score.toLocaleString()}
                </div>

                <div className="my-score-bottom">

                  <div>

                    <span>
                      COMBO
                    </span>

                    <b>
                      {stats.combo}x
                    </b>

                  </div>

                  <div>

                    <span>
                      MAX
                    </span>

                    <b>
                      {stats.maxCombo}
                    </b>

                  </div>

                </div>

                <div className="mini-judgements">

                  <span className="perfect-text">
                    P {stats.perfect}
                  </span>

                  <span className="great-text">
                    G {stats.great}
                  </span>

                  <span className="cool-text">
                    C {stats.cool}
                  </span>

                  <span className="bad-text">
                    B {stats.bad}
                  </span>

                  <span className="miss-text">
                    M {stats.miss}
                  </span>

                </div>

              </div>

            </div>

            {/* =================================================
                JUDGEMENT
            ================================================== */}

            {judgement && (

              <div
                className={`judgement ${judgement}`}
              >
                {judgement.toUpperCase()}!
              </div>

            )}

            {/* =================================================
                COMMAND AREA
            ================================================== */}

            <div className="command-area">

              <div className="command-heading">

                <span>
                  CHUỖI COMMAND
                </span>

                <small>
                  {Math.min(
                    completedCommands + 1,
                    Math.max(
                      visibleSequence.length,
                      1
                    )
                  )}
                  {" / "}
                  {visibleSequence.length}
                </small>

              </div>

              <div
                className={[
                  "command-bar",
                  "command-bar-v2",
                  "command-bar-outline",
                ]
                  .join(" ")}
                aria-label="Upcoming commands"
              >

                {visibleSequence.map(
                  (
                    direction,
                    index
                  ) => {

                    const isCompleted =
                      index <
                      completedCommands;

                    const isTarget =
                      index ===
                      completedCommands;

                    const isWrong =
                      wrongDirection !==
                        null &&
                      isTarget &&
                      wrongDirection !==
                        direction;

                    return (
                      <div
                        key={`${direction}-${index}`}
                        className={[
                          "command-step",

                          isTarget
                            ? "command-target"
                            : "",

                          isCompleted
                            ? "command-completed"
                            : "",

                          isWrong
                            ? "command-wrong"
                            : "",

                          activeDirection ===
                          direction &&
                          isTarget
                            ? "command-pressed"
                            : "",
                        ]
                          .filter(Boolean)
                          .join(" ")}
                      >

                        <ArrowIcon
                          direction={direction}
                          filled={
                            isCompleted ||
                            (filledFirst &&
                              index === 0)
                          }
                          target={isTarget}
                        />

                        {isTarget && (
                          <i
                            className="command-target-line"
                            aria-hidden="true"
                          />
                        )}

                      </div>
                    );
                  }
                )}

                <span
                  className="command-more"
                  aria-hidden="true"
                >
                  •••
                </span>

              </div>

              <div
                className="timing-preview-slot"
                aria-hidden="true"
              >
                <span>
                  TIMING GAUGE
                </span>

                <b>
                  PART 3
                </b>
              </div>

            </div>

            {/* =================================================
                MOBILE CONTROLS
            ================================================== */}

            <div className="controls-row-v2">

              <button
                className={[
                  "space-button-v2",
                  spacePressed
                    ? "space-pressed"
                    : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                onPointerDown={
                  event => {
                    event.preventDefault();
                    pressSpace();
                  }
                }
                aria-label="Space timing button"
              >

                <span>
                  SPACE
                </span>

                <small>
                  TAP ON BEAT
                </small>

              </button>

              <div
                className="dpad-v2"
                aria-label="Direction controls"
              >

                {directionOrder.map(
                  direction => {

                    const isTarget =
                      sequence[
                        completedCommands
                      ] ===
                      direction;

                    return (
                      <button
                        key={direction}
                        className={[
                          `dpad-${direction}`,
                          activeDirection ===
                          direction
                            ? "dpad-active"
                            : "",
                          isTarget
                            ? "dpad-target"
                            : "",
                        ]
                          .filter(Boolean)
                          .join(" ")}
                        onPointerDown={
                          event => {
                            event.preventDefault();
                            pressDirection(
                              direction
                            );
                          }
                        }
                        onKeyDown={
                          event =>
                            onKeyDown(
                              event,
                              direction
                            )
                        }
                        aria-label={
                          direction
                        }
                      >
                        <ArrowIcon
                          direction={direction}
                          filled={false}
                          target={isTarget}
                          compact
                        />
                      </button>
                    );
                  }
                )}

                <span
                  className="dpad-center-v2"
                  aria-hidden="true"
                />

              </div>

            </div>

          </div>

          {/* ===================================================
              START
          ==================================================== */}

          {!started &&
            !finished && (

            <div className="start-overlay">

              <div className="start-panel">

                <div className="ready-kicker">
                  AUDITION MOBILE · PART 2
                </div>

                <h2>
                  Ready to dance?
                </h2>

                <p>
                  Command sequence đã được
                  chuyển sang dạng outline.
                  Nhấn đúng command sẽ chuyển
                  sang filled + glow.
                </p>

                <div className="row">

                  <button
                    className="button primary"
                    onClick={
                      startGame
                    }
                  >
                    Start Demo
                  </button>

                  <button
                    className="button"
                    onClick={() =>
                      setAudioEnabled(
                        value => !value
                      )
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

          {/* ===================================================
              RESULTS
          ==================================================== */}

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
                    <b>
                      {stats.perfect}
                    </b>
                    <span>
                      Perfect
                    </span>
                  </div>

                  <div className="stat">
                    <b>
                      {stats.great}
                    </b>
                    <span>
                      Great
                    </span>
                  </div>

                  <div className="stat">
                    <b>
                      {stats.maxCombo}
                    </b>
                    <span>
                      Max Combo
                    </span>
                  </div>

                </div>

                <button
                  className="button primary"
                  onClick={
                    restart
                  }
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
            ✅ Part 2.1 — Command Arrow
          </h3>

          <p>
            Arrow chưa nhấn luôn ở trạng thái
            outline. Khi input đúng command,
            arrow tương ứng chuyển sang filled
            và phát glow. Input sai không làm
            arrow chuyển filled.
          </p>

        </div>

        <div className="panel">

          <h3>
            🎯 Part 3 — Timing
          </h3>

          <p>
            Timing Gauge thật sẽ được đưa vào
            slot bên dưới command: 0–75% MISS,
            75–95% SCORE ZONE, 95–100% MISS.
          </p>

        </div>

      </section>

    </main>
  );
}

function ArrowIcon({
  direction,
  filled,
  target,
  compact = false,
}: {
  direction: Direction;
  filled: boolean;
  target: boolean;
  compact?: boolean;
}) {
  const color =
    direction === "left" ||
    direction === "right"
      ? "#ff63d9"
      : "#61dcff";

  const rotation =
    direction === "right"
      ? 0
      : direction === "down"
        ? 90
        : direction === "left"
          ? 180
          : 270;

  return (
    <svg
      className={[
        compact
          ? "dpad-arrow-icon"
          : "command-arrow-icon",
        filled
          ? "is-filled"
          : "is-outline",
        target
          ? "is-target"
          : "",
      ]
        .filter(Boolean)
        .join(" ")}
      viewBox="0 0 48 40"
      aria-hidden="true"
      style={{
        width: compact ? 31 : 44,
        height: compact ? 31 : 44,
        display: "block",
        overflow: "visible",
        transform: `rotate(${rotation}deg)`,
        transformOrigin: "center",
        filter: filled
          ? `drop-shadow(0 0 4px ${color}) drop-shadow(0 0 9px ${color})`
          : `drop-shadow(0 0 2px ${color})`,
        opacity: target || filled ? 1 : 0.88,
      }}
    >
      <path
        d="M5 14H27V7L43 20L27 33V26H5V14Z"
        fill={
          filled
            ? color
            : "transparent"
        }
        stroke={color}
        strokeWidth={
          filled ? 0 : 1.8
        }
        strokeLinejoin="round"
      />
    </svg>
  );
}

function playMetronome(
  bpm: number,
  bars: number
) {
  try {
    const AudioContextClass =
      window.AudioContext ||
      (
        window as any
      ).webkitAudioContext;

    const ctx =
      new AudioContextClass();

    const interval =
      60 / bpm;

    const start =
      ctx.currentTime +
      0.08;

    const total =
      bars * 4;

    for (
      let i = 0;
      i < total;
      i++
    ) {
      const osc =
        ctx.createOscillator();

      const gain =
        ctx.createGain();

      const t =
        start +
        i * interval;

      osc.frequency.value =
        i % 4 === 0
          ? 880
          : 660;

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

      osc
        .connect(gain)
        .connect(
          ctx.destination
        );

      osc.start(t);

      osc.stop(
        t + 0.06
      );
    }

    window.setTimeout(
      () => {
        ctx.close();
      },
      (total * interval +
        300) *
        1.1
    );
  } catch {
    // Audio is optional.
  }
}