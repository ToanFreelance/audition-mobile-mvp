import * as Phaser from "phaser";
import type {
  Chart,
  Direction,
  Judgement,
  GameStats
} from "./types";
import { RhythmEngine } from "./rhythm";
import { BeatClock } from "./clock";

const W = 960;
const H = 540;

export type GameCallbacks = {
  onStats: (stats: GameStats) => void;
  onJudgement: (judgement: Judgement) => void;
  onFinished: (stats: GameStats) => void;
  onSequence: (directions: Direction[], filledFirst: boolean) => void;
};

/**
 * Phaser is now the rhythm/input runtime only.
 *
 * Visible stage rendering is handled by Three.js.
 * This keeps BeatClock and RhythmEngine independent
 * from the visual presentation.
 */
export class GameScene
  extends Phaser.Scene {

  private chart!: Chart;
  private engine!: RhythmEngine;
  private clock!: BeatClock;
  private callbacks!: GameCallbacks;

  private started = false;
  private finished = false;
  private lastBeat = -1;
  private lastFilledDirection: Direction | null = null;

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
    /*
     * Three.js owns the visible game world.
     * Phaser is retained for keyboard input
     * and the existing rhythm loop.
     */

    this.input.keyboard?.on(
      "keydown-LEFT",
      () => this.handleInput("left")
    );

    this.input.keyboard?.on(
      "keydown-UP",
      () => this.handleInput("up")
    );

    this.input.keyboard?.on(
      "keydown-DOWN",
      () => this.handleInput("down")
    );

    this.input.keyboard?.on(
      "keydown-RIGHT",
      () => this.handleInput("right")
    );

    this.input.keyboard?.on(
      "keydown-A",
      () => this.handleInput("left")
    );

    this.input.keyboard?.on(
      "keydown-W",
      () => this.handleInput("up")
    );

    this.input.keyboard?.on(
      "keydown-S",
      () => this.handleInput("down")
    );

    this.input.keyboard?.on(
      "keydown-D",
      () => this.handleInput("right")
    );
  }

  startRound() {
    if (this.started) return;

    this.started = true;
    this.finished = false;

    this.clock.start();
    this.lastFilledDirection = null;
  }

  handleInput(
    direction: Direction
  ) {
    if (
      !this.started ||
      this.finished
    ) {
      return;
    }

    const judgement =
      this.engine.judge(
        direction,
        this.clock.currentBeat
      );

    if (judgement) {
      this.lastFilledDirection =
        judgement === "miss"
          ? null
          : direction;

      this.callbacks.onJudgement(
        judgement
      );

      this.callbacks.onStats({
        ...this.engine.stats
      });
    }
  }

  update() {
    if (
      !this.started ||
      this.finished
    ) {
      return;
    }

    const beat =
      this.clock.currentBeat;

    const missesBefore =
      this.engine.stats.miss;

    this.engine.update(
      beat
    );

    if (
      this.engine.stats.miss >
      missesBefore
    ) {
      this.lastFilledDirection = null;
    }

    this.callbacks.onStats({
      ...this.engine.stats
    });

    const upcoming =
      this.engine.allNotes
        .filter(
          (note) =>
            !this.engine.isJudged(
              note.id
            ) &&
            note.beat >=
              beat - 0.05
        )
        .slice(0, 8)
        .map(
          (note) =>
            note.direction
        );

    const directions =
      this.lastFilledDirection
        ? [
            this.lastFilledDirection,
            ...upcoming.slice(0, 7)
          ]
        : upcoming;

    this.callbacks.onSequence(
      directions,
      Boolean(this.lastFilledDirection)
    );

    if (
      Math.floor(beat) !==
      this.lastBeat
    ) {
      this.lastBeat =
        Math.floor(beat);
    }

    const lastBeat =
      this.chart.notes[
        this.chart.notes.length - 1
      ]?.beat ?? 0;

    if (
      this.engine.completed &&
      beat > lastBeat + 2
    ) {
      this.finished = true;

      this.callbacks.onFinished({
        ...this.engine.stats
      });
    }
  }
}

export function createPhaserGame(
  parent: string,
  chart: Chart,
  callbacks: GameCallbacks
) {
  const config:
    Phaser.Types.Core.GameConfig = {
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
        Phaser.Scale.CENTER_BOTH
    },

    render: {
      antialias: true,
      pixelArt: false,
      transparent: true
    },

    input: {
      activePointers: 4
    },

    scene: []
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
      callbacks
    }
  );

  return game;
}