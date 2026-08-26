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

const DEMO_COMMANDS: Direction[] = [
  "left",
  "up",
  "down",
  "right",
  "left",
  "right",
  "up",
  "down",
];

export type GameCallbacks = {
  onStats: (
    stats: GameStats
  ) => void;

  onJudgement: (
    judgement: Judgement
  ) => void;

  onFinished: (
    stats: GameStats
  ) => void;

  /*
   * directions:
   *   Current 8-command block.
   *
   * filledCount:
   *   Number of commands already entered
   *   correctly inside that block.
   */
  onSequence: (
    directions: Direction[],
    filledCount: number
  ) => void;
};

/**
 * Phaser is the rhythm/input runtime.
 *
 * Part 2:
 *
 * D-PAD = command sequence entry.
 *
 * Timing is deliberately NOT checked here.
 *
 * Part 3:
 *
 * SPACE = timing judgement.
 *
 * That part will reconnect RhythmEngine.judge()
 * and BeatClock to the SPACE button.
 */
export class GameScene
  extends Phaser.Scene {

  private chart!: Chart;

  private engine!: RhythmEngine;

  private clock!: BeatClock;

  private callbacks!: GameCallbacks;

  private started = false;

  private finished = false;

  /*
   * Absolute command cursor.
   *
   * 0 = first command
   * 1 = second command
   * ...
   */
  private commandCursor = 0;

  constructor() {
    super("GameScene");
  }

  init(data: {
    chart: Chart;
    callbacks: GameCallbacks;
  }) {
    this.chart =
      data.chart;

    this.callbacks =
      data.callbacks;

    /*
     * Keep both existing systems alive.
     *
     * RhythmEngine and BeatClock will be used
     * by Part 3.
     */
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
    /*
     * Three.js owns the visible stage.
     *
     * Phaser remains responsible for
     * keyboard input and the gameplay runtime.
     */

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
  }

  startRound() {
    if (
      this.started
    ) {
      return;
    }

    this.started =
      true;

    this.finished =
      false;

    this.commandCursor =
      0;

    /*
     * Keep BeatClock alive because Part 3
     * will use it for SPACE timing.
     *
     * It does NOT affect D-PAD input.
     */
    this.clock.start();

    this.emitCommandState();
  }

  /**
   * Handle D-PAD / keyboard command input.
   *
   * IMPORTANT:
   *
   * This method intentionally does NOT call:
   *
   *   engine.judge(...)
   *
   * because D-PAD is sequence entry.
   *
   * Correct direction:
   *   advance command cursor.
   *
   * Wrong direction:
   *   do nothing.
   *
   * SPACE will perform timing judgement later.
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

    const targetDirection =
      this.getCommandDirection(
        this.commandCursor
      );

    if (
      !targetDirection
    ) {
      return;
    }

    /*
     * Wrong command.
     *
     * Do not advance.
     * Do not fill.
     * Do not consume a note.
     */
    if (
      direction !==
      targetDirection
    ) {
      return;
    }

    /*
     * Correct command.
     */
    this.commandCursor++;

    this.emitCommandState();

    /*
     * End of command list.
     *
     * This is only a frontend demo completion.
     * Real scoring/combo/timing will be connected
     * in Part 3.
     */
    if (
      this.commandCursor >=
      this.chart.notes.length
    ) {
      this.finished =
        true;

      this.callbacks.onFinished({
        ...this.engine.stats,
      });
    }
  }

  /**
   * Placeholder for SPACE.
   *
   * Part 3 will implement:
   *
   *   SPACE
   *      ↓
   *   marker position
   *      ↓
   *   75–95% score zone
   *      ↓
   *   PERFECT / GREAT / COOL / BAD / MISS
   */
  handleSpace() {
    if (
      !this.started ||
      this.finished
    ) {
      return;
    }

    // Intentionally empty for Part 2.
  }

  update() {
    if (
      !this.started ||
      this.finished
    ) {
      return;
    }

    /*
     * DO NOT call:
     *
     *   this.engine.update(beat)
     *
     * here yet.
     *
     * That would automatically mark notes as MISS
     * while the player is only testing D-PAD input.
     *
     * Automatic MISS belongs to the timing system
     * that we will connect to SPACE in Part 3.
     */

    this.callbacks.onStats({
      ...this.engine.stats,
    });
  }

  /**
   * Demo command sequence.
   *
   * The first 8 commands intentionally match
   * the approved mobile sketch:
   *
   *   ← ↑ ↓ → ← → ↑ ↓
   *
   * After those 8 commands, the existing chart
   * continues to provide the next commands.
   */
  private getCommandDirection(
    index: number
  ): Direction | undefined {
    if (
      index <
      DEMO_COMMANDS.length
    ) {
      return DEMO_COMMANDS[
        index
      ];
    }

    return this.chart.notes[
      index
    ]?.direction;
  }

  /**
   * Emit the current 8-command block.
   *
   * Example:
   *
   * cursor = 3
   *
   *   ← ↑ ↓ → ← → ↑ ↓
   *   ✓ ✓ ✓ ↑
   *
   * filledCount = 3
   */
  private emitCommandState() {
    const blockStart =
      Math.floor(
        this.commandCursor /
          8
      ) * 8;

    const directions =
      Array.from(
        {
          length: 8,
        },
        (
          _,
          index
        ) =>
          this.getCommandDirection(
            blockStart +
              index
          )
      ).filter(
        (
          direction
        ): direction is Direction =>
          Boolean(
            direction
          )
      );

    const filledCount =
      this.commandCursor -
      blockStart;

    this.callbacks.onSequence(
      directions,
      Math.max(
        0,
        Math.min(
          directions.length,
          filledCount
        )
      )
    );
  }
}

export function createPhaserGame(
  parent: string,
  chart: Chart,
  callbacks: GameCallbacks
) {
  const config:
    Phaser.Types.Core.GameConfig =
    {
      type: Phaser.AUTO,

      parent,

      width: W,

      height: H,

      transparent: true,

      backgroundColor:
        "rgba(0,0,0,0)",

      scale: {
        mode:
          Phaser.Scale.FIT,

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