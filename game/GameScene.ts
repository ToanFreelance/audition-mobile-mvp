import * as Phaser from "phaser";
import type {
  Chart,
  Direction,
  Judgement,
  GameStats,
} from "./types";
import { RhythmEngine } from "./rhythm";
import { BeatClock } from "./clock";

const W = 960;
const H = 540;
const COMMAND_SIZE = 8;

export type GameCallbacks = {
  onStats: (stats: GameStats) => void;
  onJudgement: (
    judgement: Judgement
  ) => void;
  onFinished: (
    stats: GameStats
  ) => void;

  /**
   * Current 8-step command block + number of
   * commands already entered correctly.
   *
   * Example:
   * directions = [L,U,D,R,L,R,U,D]
   * filledCount = 3
   *
   * UI renders:
   * [FILLED] [FILLED] [FILLED] [TARGET] [ ] [ ] [ ] [ ]
   */
  onSequence: (
    directions: Direction[],
    filledCount: number
  ) => void;
};

/**
 * Phaser is the rhythm/input runtime.
 *
 * IMPORTANT FOR PART 2:
 * Direction buttons are command-entry controls.
 * They are NOT judged against the beat yet.
 *
 * Timing judgement will be connected to SPACE
 * in Part 3, where the marker position is compared
 * with the 75%–95% score zone.
 */
export class GameScene extends Phaser.Scene {
  private chart!: Chart;
  private engine!: RhythmEngine;
  private clock!: BeatClock;
  private callbacks!: GameCallbacks;

  private started = false;
  private finished = false;

  /** Absolute note cursor for command entry. */
  private commandCursor = 0;

  /** Prevent duplicate input from the same touch/pointer event. */
  private lastInputAt = 0;

  constructor() {
    super("GameScene");
  }

  init(data: {
    chart: Chart;
    callbacks: GameCallbacks;
  }) {
    this.chart = data.chart;
    this.callbacks = data.callbacks;

    this.engine =
      new RhythmEngine(
        this.chart
      );

    this.clock =
      new BeatClock(
        this.chart.bpm,
        this.chart.offsetMs
      );
  }

  create() {
    this.input.keyboard?.on(
      "keydown-LEFT",
      () =>
        this.handleInput(
          "left"
        )
    );

    this.input.keyboard?.on(
      "keydown-UP",
      () =>
        this.handleInput(
          "up"
        )
    );

    this.input.keyboard?.on(
      "keydown-DOWN",
      () =>
        this.handleInput(
          "down"
        )
    );

    this.input.keyboard?.on(
      "keydown-RIGHT",
      () =>
        this.handleInput(
          "right"
        )
    );

    this.input.keyboard?.on(
      "keydown-A",
      () =>
        this.handleInput(
          "left"
        )
    );

    this.input.keyboard?.on(
      "keydown-W",
      () =>
        this.handleInput(
          "up"
        )
    );

    this.input.keyboard?.on(
      "keydown-S",
      () =>
        this.handleInput(
          "down"
        )
    );

    this.input.keyboard?.on(
      "keydown-D",
      () =>
        this.handleInput(
          "right"
        )
    );

    this.emitCommandState();
  }

  startRound() {
    if (this.started) {
      return;
    }

    this.started = true;
    this.finished = false;
    this.commandCursor = 0;
    this.lastInputAt = 0;

    this.clock.start();

    this.emitCommandState();
  }

  /**
   * Handle a D-pad / keyboard command.
   *
   * This deliberately does NOT call RhythmEngine.judge().
   * Direction entry happens before timing in the intended
   * Audition-style flow:
   *
   *   D-PAD → build command → SPACE → timing judgement
   */
  handleInput(
    direction: Direction
  ) {
    if (
      !this.started ||
      this.finished
    ) {
      return;
    }

    const now =
      typeof performance !==
      "undefined"
        ? performance.now()
        : Date.now();

    // Ignore accidental duplicate pointer/keyboard events
    // that arrive within a few milliseconds.
    if (
      now -
        this.lastInputAt <
      35
    ) {
      return;
    }

    this.lastInputAt = now;

    const expected =
      this.chart.notes[
        this.commandCursor
      ];

    if (!expected) {
      return;
    }

    if (
      direction !==
      expected.direction
    ) {
      // Wrong direction: do not advance and do not fill.
      // Timing/MISS penalties will be handled in Part 3.
      return;
    }

    // Correct command: advance immediately.
    this.commandCursor++;

    this.emitCommandState();
  }

  /**
   * Placeholder for the upcoming SPACE timing action.
   *
   * It intentionally does nothing in Part 2 so the
   * command-input behavior can be tested independently.
   */
  handleSpace() {
    if (
      !this.started ||
      this.finished
    ) {
      return;
    }

    // Part 3 will call RhythmEngine.judge() here.
  }

  private emitCommandState() {
    const total =
      this.chart.notes.length;

    if (total === 0) {
      this.callbacks.onSequence(
        [],
        0
      );

      return;
    }

    const blockStart =
      Math.floor(
        this.commandCursor /
          COMMAND_SIZE
      ) * COMMAND_SIZE;

    const directions =
      this.chart.notes
        .slice(
          blockStart,
          blockStart +
            COMMAND_SIZE
        )
        .map(
          note =>
            note.direction
        );

    const filledCount =
      Math.max(
        0,
        Math.min(
          directions.length,
          this.commandCursor -
            blockStart
        )
      );

    this.callbacks.onSequence(
      directions,
      filledCount
    );
  }

  update() {
    if (
      !this.started ||
      this.finished
    ) {
      return;
    }

    /*
     * Keep the existing rhythm runtime alive so the
     * rest of the prototype continues to function.
     *
     * We intentionally do not let it consume command
     * input. Part 3 will reconnect judgement to SPACE.
     */
    const beat =
      this.clock.currentBeat;

    this.callbacks.onStats({
      ...this.engine.stats,
    });

    const lastBeat =
      this.chart.notes[
        this.chart.notes.length -
          1
      ]?.beat ?? 0;

    if (
      this.commandCursor >=
        this.chart.notes.length &&
      beat >
        lastBeat + 2
    ) {
      this.finished = true;

      this.callbacks.onFinished({
        ...this.engine.stats,
      });
    }
  }
}

export function createPhaserGame(
  parent: string,
  chart: Chart,
  callbacks: GameCallbacks
) {
  const config: Phaser.Types.Core.GameConfig =
    {
      type: Phaser.AUTO,

      parent,

      width: W,
      height: H,

      transparent: true,

      backgroundColor:
        "rgba(0,0,0,0)",

      scale: {
        mode: Phaser.Scale.FIT,
        autoCenter:
          Phaser.Scale.CENTER_BOTH,
      },

      render: {
        antialias: true,
        pixelArt: false,
        transparent: true,
      },

      input: {
        activePointers: 4,
      },

      scene: [],
    };

  const game =
    new Phaser.Game(
      config
    );

  game.scene.add(
    "GameScene",
    GameScene,
    true,
    {
      chart,
      callbacks,
    }
  );

  return game;
}