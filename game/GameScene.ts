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
    console.log("QA_GAME_INIT", { notes: this.chart.notes.length });

    if (this.pendingRoundStart) {
      this.pendingRoundStart = false;
      this.startRound();
    }
  }

  startRound() {
    console.log("QA_START_ROUND", {
      initialized: this.initialized,
      started: this.started,
      roundRequested: this.roundRequested,
    });
    this.roundRequested = true;

    if (!this.initialized) {
      this.pendingRoundStart = true;
      return;
    }

    if (this.started) {
      return;
    }

    this.started = true;
    this.finished = false;
    this.commandCursor = 0;

    this.clock.start();
    this.emitCommandState();

    const queuedInputs = this.queuedInputs;
    this.queuedInputs = [];

    for (const direction of queuedInputs) {
      this.handleInput(direction);
    }
  }

  handleInput(direction: Direction) {
    console.log("QA_HANDLE_INPUT", {
      direction,
      initialized: this.initialized,
      started: this.started,
      finished: this.finished,
      roundRequested: this.roundRequested,
      cursor: this.commandCursor,
    });

    if (this.finished) {
      return;
    }

    if (!this.initialized) {
      if (this.roundRequested) {
        this.queuedInputs.push(direction);
        console.log("QA_QUEUE_INPUT", direction);
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
    console.log("QA_TARGET", {
      cursor: this.commandCursor,
      targetDirection,
      received: direction,
    });

    if (!targetDirection) {
      return;
    }

    if (direction !== targetDirection) {
      return;
    }

    this.commandCursor++;
    console.log("QA_ADVANCE", this.commandCursor);
    this.emitCommandState();

    if (this.commandCursor >= this.chart.notes.length) {
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
    console.log("QA_EMIT_SEQUENCE", { cursor: this.commandCursor, filledCount });

    this.callbacks.onSequence(
      directions,
      Math.max(0, Math.min(directions.length, filledCount))
    );
  }
}

export function createPhaserGame(
  parent: string,
  chart: Chart,
  callbacks: GameCallbacks
) {
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

  const game = new Phaser.Game(config);
  const sceneManager = game.scene;
  const gameScene = new GameScene();

  // Keep a stable Scene instance available to React immediately. Phaser may
  // queue the add/start operations until its SceneManager has booted.
  sceneManager.add("GameScene", gameScene, false, {
    chart,
    callbacks,
  });

  const originalGetScene = sceneManager.getScene.bind(sceneManager);
  sceneManager.getScene = ((key: string) =>
    originalGetScene(key) ??
    (key === "GameScene" ? gameScene : sceneManager.keys[key])) as typeof sceneManager.getScene;

  sceneManager.start("GameScene", {
    chart,
    callbacks,
  });

  return game;
}