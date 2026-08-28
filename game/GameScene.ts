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
      // The React start request can race Phaser's scene registration: the
      // scene object may not be discoverable by GameShell yet. Once the
      // start overlay is gone, the user has explicitly started the round;
      // recover that request here before consuming the real input.
      if (!document.querySelector(".start-overlay")) {
        this.startRound();
      } else {
        return;
      }
    }

    const targetDirection = this.getCommandDirection(this.commandCursor);
    if (!targetDirection) {
      return;
    }

    if (direction !== targetDirection) {
      return;
    }

    this.commandCursor++;
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

    // Timing judgement is intentionally reserved for Part 3.
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

  game.scene.add("GameScene", GameScene, true, {
    chart,
    callbacks,
  });

  return game;
}