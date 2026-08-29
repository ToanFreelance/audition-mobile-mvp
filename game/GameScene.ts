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
  onStats: (stats: GameStats) => void;
  onJudgement: (judgement: Judgement) => void;
  onFinished: (stats: GameStats) => void;
  onSequence: (directions: Direction[], filledCount: number) => void;
};

export class GameScene extends Phaser.Scene {
  private chart!: Chart;
  private engine!: RhythmEngine;
  private clock!: BeatClock;
  private callbacks!: GameCallbacks;
  private initialized = false;
  private pendingRoundStart = false;
  private roundRequested = false;
  private started = false;
  private finished = false;
  private commandCursor = 0;
  private queuedInputs: Direction[] = [];

  constructor() {
    super("GameScene");
  }

  init(data: { chart: Chart; callbacks: GameCallbacks }) {
    this.chart = data.chart;
    this.callbacks = data.callbacks;
    this.engine = new RhythmEngine(this.chart);
    this.clock = new BeatClock(this.chart.bpm, this.chart.offsetMs);
    this.initialized = true;

    if (this.pendingRoundStart) {
      this.pendingRoundStart = false;
      this.startRound();
    }
  }

  startRound() {
    this.roundRequested = true;

    if (!this.initialized) {
      this.pendingRoundStart = true;
      return;
    }

    if (this.started && !this.finished) {
      return;
    }

    this.started = true;
    this.finished = false;
    this.commandCursor = 0;
    this.queuedInputs = [];

    this.clock.start();
    this.emitCommandState();
  }

  handleInput(direction: Direction) {
    if (this.finished) {
      return;
    }

    if (!this.initialized) {
      if (this.roundRequested) {
        this.queuedInputs.push(direction);
      }
      return;
    }

    if (!this.started) {
      if (!this.roundRequested) {
        return;
      }
      this.startRound();
    }

    if (!this.started || this.finished) {
      return;
    }

    const targetDirection = this.getCommandDirection(this.commandCursor);

    if (!targetDirection || direction !== targetDirection) {
      return;
    }

    this.commandCursor += 1;
    this.emitCommandState();

    if (this.commandCursor >= DEMO_COMMANDS.length) {
      this.finished = true;
      this.callbacks.onFinished({ ...this.engine.stats });
    }
  }

  handleSpace() {
    if (!this.started || this.finished) {
      return;
    }
  }

  update() {
    if (!this.started || this.finished) {
      return;
    }

    this.callbacks.onStats({ ...this.engine.stats });
  }

  private getCommandDirection(index: number): Direction | undefined {
    if (index < DEMO_COMMANDS.length) {
      return DEMO_COMMANDS[index];
    }

    return this.chart.notes[index]?.direction;
  }

  private emitCommandState() {
    const blockStart = Math.floor(this.commandCursor / 8) * 8;
    const directions = Array.from({ length: 8 }, (_, index) =>
      this.getCommandDirection(blockStart + index)
    ).filter((direction): direction is Direction => Boolean(direction));

    const filledCount = this.commandCursor - blockStart;

    this.callbacks.onSequence(
      directions,
      Math.max(0, Math.min(directions.length, filledCount))
    );
  }
}

export type PhaserGameWithScene = Phaser.Game & {
  __auditionGameScene?: GameScene;
};

export function createPhaserGame(
  parent: string,
  chart: Chart,
  callbacks: GameCallbacks
): PhaserGameWithScene {
  const config: Phaser.Types.Core.GameConfig = {
    type: Phaser.AUTO,
    parent,
    width: W,
    height: H,
    transparent: true,
    backgroundColor: "rgba(0,0,0,0)",
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
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

  const game = new Phaser.Game(config) as PhaserGameWithScene;
  const gameScene = new GameScene();

  // Keep the exact Scene instance used by Phaser. React must not discover the
  // input target through SceneManager.getScene while Phaser is still booting.
  game.__auditionGameScene = gameScene;
  game.scene.add("GameScene", gameScene, false, {
    chart,
    callbacks,
  });
  game.scene.start("GameScene", {
    chart,
    callbacks,
  });

  return game;
}
