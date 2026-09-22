import * as Phaser from "phaser";
import type {
  Chart,
  DanceTurn,
  Direction,
  GamePhase,
  GameStats,
  Judgement,
} from "./types";
import { BeatClock } from "./clock";
import { RhythmEngine, WINDOWS_MS } from "./rhythm";

const W = 960;
const H = 540;
const TURN_LEAD_BEATS = 0.02;

export type GameCallbacks = {
  onStats: (stats: GameStats) => void;
  onJudgement: (judgement: Judgement) => void;
  onFinished: (stats: GameStats) => void;
  onSequence: (directions: Direction[], filledCount: number) => void;
  onPhase?: (phase: GamePhase, turn: DanceTurn | undefined, timingRatio: number) => void;
  onAction?: (actionId: string, judgement: Judgement) => void;
};

export class GameScene extends Phaser.Scene {
  private chart!: Chart;
  private engine!: RhythmEngine;
  private clock!: BeatClock;
  private callbacks!: GameCallbacks;

  private started = false;
  private finished = false;
  private phase: GamePhase = "idle";
  private turnIndex = 0;
  private commandCursor = 0;
  private lastPublishedTiming = 2;

  constructor() {
    super("GameScene");
  }

  init(data: { chart: Chart; callbacks: GameCallbacks }) {
    this.chart = data.chart;
    this.callbacks = data.callbacks;
    this.engine = new RhythmEngine(this.chart);
    this.clock = new BeatClock(this.chart.bpm, this.chart.offsetMs);
  }

  create() {
    const keyboard = this.input.keyboard;
    if (!keyboard) return;

    keyboard.on("keydown-LEFT", () => this.handleInput("left"));
    keyboard.on("keydown-UP", () => this.handleInput("up"));
    keyboard.on("keydown-DOWN", () => this.handleInput("down"));
    keyboard.on("keydown-RIGHT", () => this.handleInput("right"));
    keyboard.on("keydown-A", () => this.handleInput("left"));
    keyboard.on("keydown-W", () => this.handleInput("up"));
    keyboard.on("keydown-S", () => this.handleInput("down"));
    keyboard.on("keydown-D", () => this.handleInput("right"));
    keyboard.on("keydown-SPACE", () => this.handleSpace());
  }

  startRound() {
    if (this.started) return;

    this.started = true;
    this.finished = false;
    this.phase = "input";
    this.turnIndex = 0;
    this.commandCursor = 0;
    this.lastPublishedTiming = 2;
    this.clock.start();
    this.emitCommandState();
    this.publishPhase();
  }

  handleInput(direction: Direction) {
    if (!this.started || this.finished || this.phase !== "input") return;

    const turn = this.currentTurn;
    if (!turn) return;
    if (this.clock.currentBeat >= turn.spaceBeat + TURN_LEAD_BEATS) return;

    const target = turn.directions[this.commandCursor];
    if (!target) return;

    if (direction !== target) {
      this.flashWrong(direction);
      return;
    }

    this.commandCursor += 1;
    this.emitCommandState();

    if (this.commandCursor >= turn.directions.length) {
      this.phase = "timing";
      this.publishPhase();
    }
  }

  handleSpace() {
    if (!this.started || this.finished || this.phase !== "timing") return;

    const turn = this.currentTurn;
    if (!turn) return;

    const judgement = this.engine.judgeTurn(turn, this.clock.currentBeat);
    this.phase = "judged";
    this.callbacks.onJudgement(judgement);
    this.callbacks.onStats({ ...this.engine.stats });
    this.callbacks.onAction?.(turn.actionId, judgement);
    this.publishPhase();

    if (this.engine.completed) this.finish();
  }

  update() {
    if (!this.started || this.finished) return;

    const beat = this.clock.currentBeat;
    const turn = this.currentTurn;
    if (!turn) {
      this.finish();
      return;
    }

    if (this.phase === "input" && beat >= turn.spaceBeat + TURN_LEAD_BEATS) {
      this.engine.autoMiss(turn);
      this.phase = "judged";
      this.callbacks.onJudgement("miss");
      this.callbacks.onStats({ ...this.engine.stats });
      this.callbacks.onAction?.(turn.actionId, "miss");
      this.publishPhase();
    }

    if (this.phase === "timing") {
      const ratio = this.engine.getTimingRatio(turn, beat);
      this.publishTiming(ratio);

      const lateMs = this.engine.getTimingDeltaMs(turn, beat);
      if (lateMs > WINDOWS_MS.bad) {
        this.engine.autoMiss(turn);
        this.phase = "judged";
        this.callbacks.onJudgement("miss");
        this.callbacks.onStats({ ...this.engine.stats });
        this.callbacks.onAction?.(turn.actionId, "miss");
        this.publishPhase();
      }
    }

    if (this.phase === "judged") {
      const next = this.chart.turns[this.turnIndex + 1];
      if (!next) {
        if (this.engine.completed) this.finish();
        return;
      }

      if (beat >= next.startBeat - TURN_LEAD_BEATS) {
        this.turnIndex += 1;
        this.commandCursor = 0;
        this.phase = "input";
        this.lastPublishedTiming = 2;
        this.emitCommandState();
        this.publishPhase();
      }
    }

    this.callbacks.onStats({ ...this.engine.stats });
  }

  private get currentTurn(): DanceTurn | undefined {
    return this.chart.turns[this.turnIndex];
  }

  private finish() {
    if (this.finished) return;
    this.finished = true;
    this.phase = "finished";
    this.callbacks.onStats({ ...this.engine.stats });
    this.callbacks.onFinished({ ...this.engine.stats });
    this.publishPhase();
  }

  private emitCommandState() {
    const turn = this.currentTurn;
    if (!turn) {
      this.callbacks.onSequence([], 0);
      return;
    }

    this.callbacks.onSequence(turn.directions, this.commandCursor);
    this.publishTiming(2);
  }

  private publishPhase() {
    this.callbacks.onPhase?.(this.phase, this.currentTurn, this.lastPublishedTiming);
    const host = document.getElementById("game-container");
    if (!host) return;
    host.dataset.gamePhase = this.phase;
    host.dataset.level = String(this.currentTurn?.level ?? 0);
    host.dataset.turn = String(this.turnIndex + 1);
    host.dataset.action = this.currentTurn?.actionId ?? "";
  }

  private publishTiming(ratio: number) {
    const clamped = Math.max(-1, Math.min(1, ratio));
    if (Math.abs(clamped - this.lastPublishedTiming) < 0.015) return;
    this.lastPublishedTiming = clamped;
    this.callbacks.onPhase?.(this.phase, this.currentTurn, clamped);

    const host = document.getElementById("game-container");
    if (!host) return;
    host.style.setProperty("--timing-ratio", String(clamped));
    host.dataset.timing = clamped.toFixed(3);

    const slot = document.querySelector<HTMLElement>(".timing-preview-slot");
    if (!slot) return;
    const label = slot.querySelector("span");
    const value = slot.querySelector("b");
    if (label) label.textContent = this.phase === "timing" ? "TIMING GAUGE" : "NEXT ACTION";
    if (value) value.textContent = this.phase === "timing" ? `${Math.round((clamped + 1) * 50)}%` : `LEVEL ${this.currentTurn?.level ?? "-"}`;
  }

  private flashWrong(direction: Direction) {
    const host = document.getElementById("game-container");
    host?.setAttribute("data-wrong-direction", direction);
    window.setTimeout(() => {
      if (host?.getAttribute("data-wrong-direction") === direction) {
        host.removeAttribute("data-wrong-direction");
      }
    }, 160);
  }
}

export function createPhaserGame(
  parent: string,
  chart: Chart,
  callbacks: GameCallbacks,
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
  game.scene.add("GameScene", GameScene, true, { chart, callbacks });
  return game;
}
