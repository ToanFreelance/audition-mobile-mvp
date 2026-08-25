import Phaser from "phaser";
import type { Chart, Direction, Judgement } from "./types";
import { RhythmEngine } from "./rhythm";
import { BeatClock } from "./clock";

const W = 960;
const H = 540;
const LANE_X = [330, 430, 530, 630];
const DIRS: Direction[] = ["left", "up", "down", "right"];

export type GameCallbacks = {
  onStats: (stats: RhythmEngine["stats"]) => void;
  onJudgement: (judgement: Judgement) => void;
  onFinished: (stats: RhythmEngine["stats"]) => void;
};

export class GameScene extends Phaser.Scene {
  private chart!: Chart;
  private engine!: RhythmEngine;
  private clock!: BeatClock;
  private callbacks!: GameCallbacks;
  private noteGraphics = new Map<number, Phaser.GameObjects.Container>();
  private started = false;
  private finished = false;
  private player!: Phaser.GameObjects.Container;
  private glow!: Phaser.GameObjects.Graphics;
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
    this.createBackground();
    this.createLanes();
    this.createCharacter();
    this.createNotes();
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

    if (Math.floor(beat) !== this.lastBeat) {
      this.lastBeat = Math.floor(beat);
      this.pulseCharacter();
    }

    const pixelsPerBeat = 82;
    const hitY = 445;
    const spawnBeat = beat + 5.2;

    for (const note of this.chart.notes) {
      if (this.engine.isJudged(note.id)) {
        const judgedGraphic = this.noteGraphics.get(note.id);
        judgedGraphic?.destroy();
        this.noteGraphics.delete(note.id);
        continue;
      }
      if (note.beat > spawnBeat || note.beat < beat - 1.2) continue;
      if (!this.noteGraphics.has(note.id)) {
        const x = LANE_X[DIRS.indexOf(note.direction)];
        const container = this.createNote(x, hitY - (note.beat - beat) * pixelsPerBeat, note.direction);
        this.noteGraphics.set(note.id, container);
      }
      const graphic = this.noteGraphics.get(note.id);
      if (graphic) {
        graphic.y = hitY - (note.beat - beat) * pixelsPerBeat;
        if (graphic.y > H + 80) {
          graphic.destroy();
          this.noteGraphics.delete(note.id);
        }
      }
    }

    if (this.engine.completed && beat > (this.chart.notes[this.chart.notes.length - 1]?.beat ?? 0) + 2) {
      this.finished = true;
      this.callbacks.onFinished({ ...this.engine.stats });
    }
  }

  private createBackground() {
    const bg = this.add.graphics();
    bg.fillStyle(0x080914, 1);
    bg.fillRect(0, 0, W, H);
    bg.fillGradientStyle(0x15183a, 0x090a19, 0x090a19, 0x15183a, 0.9);
    bg.fillRect(0, 0, W, H);

    for (let i = 0; i < 24; i++) {
      const x = (i * 137) % W;
      const y = 30 + ((i * 79) % 330);
      this.add.circle(x, y, i % 3 === 0 ? 2 : 1, 0xffffff, i % 3 === 0 ? 0.35 : 0.18);
    }

    this.glow = this.add.graphics();
    this.glow.fillStyle(0xff4fd8, 0.07);
    this.glow.fillCircle(W / 2, 340, 240);
  }

  private createLanes() {
    const line = this.add.graphics();
    line.lineStyle(2, 0xffffff, 0.12);
    line.strokeLineShape(new Phaser.Geom.Line(260, 440, 700, 440));

    for (let i = 0; i < 4; i++) {
      const x = LANE_X[i];
      line.lineStyle(1, 0xffffff, 0.055);
      line.strokeLineShape(new Phaser.Geom.Line(x, 80, x, 455));

      const receptor = this.add.graphics();
      receptor.lineStyle(3, i % 2 === 0 ? 0xff4fd8 : 0x62d8ff, 0.65);
      receptor.strokeRoundedRect(x - 34, 410, 68, 68, 18);
      receptor.fillStyle(0xffffff, 0.035);
      receptor.fillRoundedRect(x - 34, 410, 68, 68, 18);
      this.add.text(x, 444, this.arrowFor(DIRS[i]), {
        fontFamily: "Arial",
        fontSize: "30px",
        color: "#ffffff",
        fontStyle: "bold"
      }).setOrigin(.5);
    }
  }

  private createCharacter() {
    this.player = this.add.container(W / 2, 205);
    const shadow = this.add.ellipse(0, 128, 120, 25, 0x000000, 0.25);
    const body = this.add.graphics();
    body.fillStyle(0xff4fd8, 1);
    body.fillRoundedRect(-28, 25, 56, 82, 22);
    body.fillStyle(0x62d8ff, 1);
    body.fillCircle(0, 0, 34);
    body.fillStyle(0x111326, 1);
    body.fillCircle(-11, -4, 5);
    body.fillCircle(11, -4, 5);
    body.lineStyle(4, 0xffffff, .8);
    body.beginPath(); body.arc(0, 4, 14, 0.25, Math.PI - .25, false); body.strokePath();
    body.lineStyle(10, 0xff4fd8, 1);
    body.beginPath(); body.moveTo(-20, 55); body.lineTo(-60, 92); body.strokePath();
    body.beginPath(); body.moveTo(20, 55); body.lineTo(60, 92); body.strokePath();
    body.lineStyle(10, 0x62d8ff, 1);
    body.beginPath(); body.moveTo(-15, 100); body.lineTo(-40, 137); body.strokePath();
    body.beginPath(); body.moveTo(15, 100); body.lineTo(40, 137); body.strokePath();
    this.player.add([shadow, body]);
  }

  private createNotes() {
    // Notes are created lazily in update for performance.
  }

  private createNote(x: number, y: number, direction: Direction) {
    const c = this.add.container(x, y);
    const g = this.add.graphics();
    const color = direction === "left" || direction === "right" ? 0xff4fd8 : 0x62d8ff;
    g.fillStyle(color, .92);
    g.fillRoundedRect(-26, -26, 52, 52, 15);
    g.lineStyle(2, 0xffffff, .5);
    g.strokeRoundedRect(-26, -26, 52, 52, 15);
    c.add(g);
    c.add(this.add.text(0, 0, this.arrowFor(direction), { fontFamily: "Arial", fontSize: "28px", color: "#ffffff", fontStyle: "bold" }).setOrigin(.5));
    return c;
  }

  private arrowFor(direction: Direction) {
    return direction === "left" ? "←" : direction === "up" ? "↑" : direction === "down" ? "↓" : "→";
  }

  private pulseCharacter() {
    this.tweens.add({ targets: this.player, scaleX: 1.03, scaleY: .97, duration: 70, yoyo: true, ease: "Sine.easeOut" });
    this.tweens.add({ targets: this.glow, alpha: .18, duration: 80, yoyo: true });
  }

  private punchCharacter(direction: Direction, judgement: Judgement) {
    const amount = judgement === "perfect" ? 1.14 : judgement === "great" ? 1.09 : 1.05;
    const dx = direction === "left" ? -18 : direction === "right" ? 18 : 0;
    const dy = direction === "up" ? -12 : direction === "down" ? 12 : 0;
    this.tweens.add({ targets: this.player, x: W / 2 + dx, y: 205 + dy, scale: amount, duration: 80, yoyo: true, ease: "Back.easeOut" });
  }
}

export function createPhaserGame(parent: string, chart: Chart, callbacks: GameCallbacks) {
  const config: Phaser.Types.Core.GameConfig = {
    type: Phaser.AUTO,
    parent,
    width: W,
    height: H,
    transparent: false,
    backgroundColor: "#080914",
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    render: { antialias: true, pixelArt: false },
    input: { activePointers: 4 },
    scene: []
  };

  const game = new Phaser.Game(config);
  game.scene.add("GameScene", GameScene, true, { chart, callbacks });
  return game;
}
