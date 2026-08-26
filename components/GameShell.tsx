"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent
} from "react";
import type * as Phaser from "phaser";
import { createDemoChart } from "@/game/chart";
import type { Direction, GameStats, Judgement } from "@/game/types";

const initialStats: GameStats = {
  score: 0,
  combo: 0,
  maxCombo: 0,
  perfect: 0,
  great: 0,
  cool: 0,
  bad: 0,
  miss: 0
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

const directionOrder: Direction[] = [
  "left",
  "up",
  "down",
  "right"
];

const keyToDirection: Record<string, Direction> = {
  ArrowLeft: "left",
  ArrowUp: "up",
  ArrowDown: "down",
  ArrowRight: "right",
  a: "left",
  w: "up",
  s: "down",
  d: "right"
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

  const [
    stats,
    setStats
  ] =
    useState<GameStats>(
      initialStats
    );

  const [
    judgement,
    setJudgement
  ] =
    useState<Judgement | null>(
      null
    );

  const [
    sequence,
    setSequence
  ] =
    useState<Direction[]>(
      fallbackSequence
    );

  const [
    started,
    setStarted
  ] =
    useState(false);

  const [
    finished,
    setFinished
  ] =
    useState(false);

  const [
    audioEnabled,
    setAudioEnabled
  ] =
    useState(true);

  const [
    activeDirection,
    setActiveDirection
  ] =
    useState<Direction | null>(
      null
    );

  useEffect(() => {
    let mounted = true;

    (async () => {
      const {
        createPhaserGame
      } =
        await import(
          "@/game/GameScene"
        );

      if (!mounted) return;

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
                () =>
                  setJudgement(
                    null
                  ),
                320
              );
            },

            onSequence: (
              next
            ) => {
              setSequence(
                next.length
                  ? next.slice(0, 8)
                  : fallbackSequence
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
            }
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
   * Keyboard visual feedback.
   *
   * Phaser vẫn xử lý gameplay input.
   * Listener này chỉ làm UI button/arrow sáng lên.
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

      flashDirection(
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
  }, []);

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

  function press(
    direction: Direction
  ) {
    flashDirection(
      direction
    );

    sceneRef.current?.handleInput(
      direction
    );
  }

  function pressSpace() {
    /*
     * Chưa kết nối gameplay.
     *
     * Part 3 sẽ kết nối SPACE
     * với Timing Gauge 75–95%.
     */
  }

  function onKeyDown(
    event: KeyboardEvent<HTMLButtonElement>,
    direction: Direction
  ) {
    if (event.repeat) {
      return;
    }

    event.preventDefault();

    press(
      direction
    );
  }

  const visibleSequence =
    sequence.slice(0, 8);

  const sequenceLength =
    Math.max(
      visibleSequence.length,
      1
    );

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

          {/* Three.js / Phaser visual runtime */}
          <div
            id="game-container"
            aria-hidden="true"
          />

          <div className="hud audition-ui">

            {/* =================================================
                TOP HUD
            ================================================== */}

            <div className="hud-top">

              {/* LEFT SIDE */}

              <div className="hud-left-column">

                {/* SONG INFO */}

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

                {/* RANKING */}

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

              {/* RIGHT SIDE */}

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
                  NEXT {sequenceLength}
                </small>

              </div>

              <div
                className="command-bar command-bar-v2"
                aria-label="Upcoming commands"
              >

                {visibleSequence.map(
                  (
                    direction,
                    index
                  ) => (

                    <div
                      key={`${direction}-${index}`}
                      className={[
                        "command-step",

                        index === 0
                          ? "command-target"
                          : "",

                        activeDirection ===
                        direction
                          ? "command-hit"
                          : ""
                      ]
                        .filter(Boolean)
                        .join(" ")}
                    >

                      <span
                        className={`command-arrow-v2 ${direction}`}
                      >
                        {
                          directionToArrow(
                            direction
                          )
                        }
                      </span>

                      {index === 0 && (
                        <i
                          aria-hidden="true"
                        />
                      )}

                    </div>

                  )
                )}

              </div>

              {/* Placeholder only.
                  Real gauge comes in Part 3. */}

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

              {/* SPACE */}

              <button
                className="space-button-v2"
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

              {/* D-PAD */}

              <div
                className="dpad-v2"
                aria-label="Direction controls"
              >

                {directionOrder.map(
                  direction => (

                    <button
                      key={direction}
                      className={[
                        `dpad-${direction}`,
                        activeDirection ===
                        direction
                          ? "dpad-active"
                          : ""
                      ]
                        .filter(Boolean)
                        .join(" ")}
                      onPointerDown={
                        event => {
                          event.preventDefault();
                          press(direction);
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
                      {
                        directionToArrow(
                          direction
                        )
                      }
                    </button>

                  )
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
                  Command UI đã được đưa
                  về layout gameplay:
                  stage là trung tâm,
                  sequence ở dưới và
                  hai ngón cái điều khiển
                  SPACE + D-pad.
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

      {/* =====================================================
          DEV INFO
      ====================================================== */}

      <section className="info-grid">

        <div className="panel">

          <h3>
            ✅ Part 2 implemented
          </h3>

          <p>
            HUD đã được tổ chức lại theo
            gameplay sketch: track info +
            ranking bên trái, My Score bên
            phải, command sequence ở vùng
            dưới stage, SPACE bên trái và
            D-pad bên phải. Input hiện tại
            vẫn dùng RhythmEngine cũ.
          </p>

        </div>

        <div className="panel">

          <h3>
            ➡️ Part 3
          </h3>

          <p>
            Timing Gauge thật sẽ thay slot
            hiện tại bằng score zone 75–95%,
            BAD → COOL → GREAT → PERFECT →
            GREAT → COOL → BAD và MISS ở
            ngoài zone.
          </p>

        </div>

      </section>

    </main>
  );
}

function directionToArrow(
  direction: Direction
) {
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
      (window as any)
        .webkitAudioContext;

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
      () =>
        ctx.close(),
      (total * interval +
        300) *
        1.1
    );
  } catch {
    // Audio is optional.
  }
}