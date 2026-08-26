import * as Phaser from "phaser";
import type { Chart, Direction, Judgement, GameStats } from "./types";
import { RhythmEngine } from "./rhythm";
import { BeatClock } from "./clock";

const W = 960;
const H = 540;
const DIRS: Direction[] = ["left", "up", "down", "right"];

export type GameCallbacks = {
  onStats: (stats: GameStats) => void;
  onJudgement: (judgement: Judgement) => void;
  onFinished: (stats: GameStats) => void;
  onSequence: (directions: Direction[]) => void;
};

export class GameScene extends Phaser.Scene {
  private chart!: Chart;
  private engine!: RhythmEngine;
  private clock!: BeatClock;
  private callbacks!: GameCallbacks;
  private started = false;
  private finished = false;
  private player!: Phaser.GameObjects.Container;
  private dancers: Phaser.GameObjects.Container[] = [];
  private stageGlow!: Phaser.GameObjects.Graphics;
  private lastBeat = -1;

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
    this.createStage();
    this.createDancers();
    this.createStageFx();
    this.input.keyboard?.on("keydown-LEFT", () => this.handleInput("left"));
    this.input.keyboard?.on("keydown-UP", () => this.handleInput("up"));
    this.input.keyboard?.on("keydown-DOWN", () => this.handleInput("down"));
    this.input.keyboard?.on("keydown-RIGHT", () => this.handleInput("right"));
    this.input.keyboard?.on("keydown-A", () => this.handleInput("left"));
    this.input.keyboard?.on("keydown-W", () => this.handleInput("up"));
    this.input.keyboard?.on("keydown-S", () => this.handleInput("down"));
    this.input.keyboard?.on("keydown-D", () => this.handleInput("right"));

  }

  startRound() {
    if (this.started) return;
    this.started = true;
    this.finished = false;
    this.clock.start();
  }

  handleInput(direction: Direction) {
    if (!this.started || this.finished) return;
    const judgement = this.engine.judge(direction, this.clock.currentBeat);
    if (judgement) {
      this.callbacks.onJudgement(judgement);
      this.punchCharacter(direction, judgement);
      this.callbacks.onStats({ ...this.engine.stats });
    }
  }

  update() {
    if (!this.started || this.finished) return;

    const beat = this.clock.currentBeat;
    this.engine.update(beat);
    this.callbacks.onStats({ ...this.engine.stats });
    this.callbacks.onSequence(
      this.engine.allNotes
        .filter((note) => !this.engine.isJudged(note.id) && note.beat >= beat - 0.05)
        .slice(0, 8)
        .map((note) => note.direction)
    );

    if (Math.floor(beat) !== this.lastBeat) {
      this.lastBeat = Math.floor(beat);
      this.pulseStage();
    }

    if (this.engine.completed && beat > (this.chart.notes[this.chart.notes.length - 1]?.beat ?? 0) + 2) {
      this.finished = true;
      this.callbacks.onFinished({ ...this.engine.stats });
    }
  }

  private createStage() {
    const bg = this.add.graphics();
    bg.fillStyle(0x070713, 1);
    bg.fillRect(0, 0, W, H);

    // Deep club gradient bands.
    bg.fillGradientStyle(0x17122e, 0x09091a, 0x080817, 0x19122f, 1);
    bg.fillRect(0, 0, W, H);

    // Back wall panels.
    bg.fillStyle(0x101022, 0.96);
    bg.fillRect(70, 72, 820, 250);
    bg.lineStyle(2, 0x6f3f9d, 0.35);
    bg.strokeRect(70, 72, 820, 250);

    // Side speaker stacks.
    this.createSpeakerStack(115, 175, -1);
    this.createSpeakerStack(845, 175, 1);

    // Neon stage sign.
    this.add.text(W / 2, 94, "CLUB", {
      fontFamily: "Arial Black, Arial",
      fontSize: "22px",
      color: "#d8b6ff",
      stroke: "#120a21",
      strokeThickness: 6
    }).setOrigin(0.5);
    this.add.text(W / 2, 124, "AUDITION", {
      fontFamily: "Arial Black, Arial",
      fontSize: "46px",
      color: "#ff74e7",
      stroke: "#5a1c66",
      strokeThickness: 8,
      shadow: { offsetX: 0, offsetY: 0, color: "#ff3bd9", blur: 18, stroke: true, fill: true }
    }).setOrigin(0.5);

    // Crowd silhouettes.
    for (let i = 0; i < 28; i++) {
      const x = 90 + i * 29;
      const y = 300 + (i % 3) * 8;
      this.add.circle(x, y, 9, i % 2 ? 0x25233f : 0x30243d, 0.95);
      this.add.rectangle(x, y + 22, 24, 38, i % 2 ? 0x1b1b31 : 0x231b35, 0.95);
    }

    // Dance floor.
    const floor = this.add.graphics();
    floor.fillStyle(0x0e1024, 1);
    floor.fillRect(0, 322, W, 218);
    floor.fillGradientStyle(0x25113b, 0x0d0e20, 0x0d0e20, 0x241038, 1);
    floor.fillRect(0, 322, W, 218);

    for (let i = 0; i < 6; i++) {
      floor.lineStyle(2, i % 2 ? 0x5d6dff : 0xff4fd8, 0.16);
      floor.strokeEllipse(W / 2, 480, 260 + i * 90, 70 + i * 28);
    }

    // Perspective floor lines.
    for (let i = 0; i < 9; i++) {
      const x = 120 + i * 90;
      floor.lineStyle(1, 0x9a6cff, 0.09);
      floor.strokeLineShape(new Phaser.Geom.Line(W / 2, 340, x, H));
    }
  }

  private createSpeakerStack(x: number, y: number, side: number) {
    const g = this.add.graphics();
    g.fillStyle(0x111124, 0.98);
    g.fillRoundedRect(x - 30, y - 70, 60, 150, 8);
    g.lineStyle(2, 0x8a55c9, 0.25);
    g.strokeRoundedRect(x - 30, y - 70, 60, 150, 8);
    for (let i = 0; i < 4; i++) {
      g.fillStyle(i % 2 ? 0x2c2a59 : 0x191735, 1);
      g.fillCircle(x, y - 42 + i * 38, 14 - i * 1.5);
      g.lineStyle(2, side < 0 ? 0x62d8ff : 0xff4fd8, 0.24);
      g.strokeCircle(x, y - 42 + i * 38, 14 - i * 1.5);
    }
  }

  private createDancers() {
    const positions = [
      { x: 290, y: 302, scale: 0.72, accent: 0x62d8ff, role: "side" },
      { x: 410, y: 290, scale: 0.86, accent: 0xff76c8, role: "side" },
      { x: 480, y: 266, scale: 1.12, accent: 0xff4fd8, role: "main" },
      { x: 550, y: 290, scale: 0.86, accent: 0x8c7dff, role: "side" },
      { x: 670, y: 302, scale: 0.72, accent: 0x62d8ff, role: "side" }
    ] as const;

    for (const position of positions) {
      const dancer = this.createDancer(position.accent, position.role === "main");
      dancer.setPosition(position.x, position.y);
      dancer.setScale(position.scale);
      this.dancers.push(dancer);
      if (position.role === "main") this.player = dancer;
    }
  }

  private createDancer(accent: number, main: boolean) {
    const container = this.add.container(0, 0);
    const shadow = this.add.ellipse(0, 106, main ? 92 : 68, 18, 0x000000, 0.36);

    const body = this.add.graphics();
    body.fillStyle(0x16152a, 1);
    body.fillRoundedRect(-23, 25, 46, 70, 18);
    body.fillStyle(accent, 0.92);
    body.fillRoundedRect(-25, 42, 50, 48, 15);
    body.fillStyle(0xf2b59d, 1);
    body.fillCircle(0, 0, 28);
    body.fillStyle(0x241a2b, 1);
    body.fillEllipse(0, -15, 55, 24);
    body.fillStyle(0x161525, 1);
    body.fillCircle(-9, 1, 3.8);
    body.fillCircle(9, 1, 3.8);
    body.lineStyle(2.5, 0x5a2948, 1);
    body.beginPath();
    body.arc(0, 8, 9, 0.15, Math.PI - 0.15, false);
    body.strokePath();

    body.lineStyle(main ? 8 : 6, 0xf2b59d, 1);
    body.beginPath(); body.moveTo(-19, 48); body.lineTo(-48, 82); body.strokePath();
    body.beginPath(); body.moveTo(19, 48); body.lineTo(48, 82); body.strokePath();
    body.lineStyle(main ? 9 : 7, 0x62d8ff, 1);
    body.beginPath(); body.moveTo(-14, 88); body.lineTo(-28, 126); body.strokePath();
    body.beginPath(); body.moveTo(14, 88); body.lineTo(30, 126); body.strokePath();

    const aura = this.add.circle(0, 80, main ? 105 : 75, accent, main ? 0.045 : 0.025);
    container.add([aura, shadow, body]);
    return container;
  }

  private createStageFx() {
    this.stageGlow = this.add.graphics();
    this.stageGlow.fillStyle(0xff4fd8, 0.06);
    this.stageGlow.fillEllipse(W / 2, 360, 430, 230);

    // Static spotlights; their opacity pulses with the beat.
    const lights = [
      { x: 230, color: 0x62d8ff },
      { x: 360, color: 0xff4fd8 },
      { x: 600, color: 0x8c7dff },
      { x: 730, color: 0xff4fd8 }
    ];
    for (const light of lights) {
      const g = this.add.graphics();
      g.fillStyle(light.color, 0.045);
      g.beginPath();
      g.moveTo(light.x - 18, 0);
      g.lineTo(light.x + 18, 0);
      g.lineTo(light.x + 110, 360);
      g.lineTo(light.x - 110, 360);
      g.closePath();
      g.fillPath();
    }
  }

  private pulseStage() {
    this.tweens.add({
      targets: this.dancers,
      scaleY: "+=0.025",
      duration: 65,
      yoyo: true,
      ease: "Sine.easeOut"
    });
    this.tweens.add({
      targets: this.stageGlow,
      alpha: 0.14,
      duration: 70,
      yoyo: true,
      ease: "Sine.easeOut"
    });
  }

  private punchCharacter(direction: Direction, judgement: Judgement) {
    const amount = judgement === "perfect" ? 1.12 : judgement === "great" ? 1.08 : 1.04;
    const dx = direction === "left" ? -16 : direction === "right" ? 16 : 0;
    const dy = direction === "up" ? -10 : direction === "down" ? 8 : 0;
    this.tweens.add({
      targets: this.player,
      x: this.player.x + dx,
      y: this.player.y + dy,
      scale: this.player.scaleX * amount,
      duration: 90,
      yoyo: true,
      ease: "Back.easeOut"
    });
  }

}

export function createPhaserGame(parent: string, chart: Chart, callbacks: GameCallbacks) {
  const config: Phaser.Types.Core.GameConfig = {
    type: Phaser.AUTO,
    parent,
    width: W,
    height: H,
    transparent: false,
    backgroundColor: "#070713",
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    render: { antialias: true, pixelArt: false },
    input: { activePointers: 4 },
    scene: []
  };

  const game = new Phaser.Game(config);
  game.scene.add("GameScene", GameScene, true, { chart, callbacks });
  return game;
}
