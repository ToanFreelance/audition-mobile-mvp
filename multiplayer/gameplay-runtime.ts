import { getGaugeTiming } from "../game/gauge-timing";
import { PERFECT_CENTER, RhythmEngine } from "../game/rhythm";
import {
  missPenaltyTurns,
  successHiddenTurns,
  targetSpaceMs,
  turnDurationMs,
  zoneEntryMs,
  zoneExitMs,
} from "../game/solo-easy";
import type { Direction, GameStats, Judgement } from "../game/types";
import { describeSharedTurn } from "./determinism";
import type { MatchManifest } from "./types";

export type MultiplayerGameplayJudgementEvent = {
  matchId: string;
  roomId: string;
  participantId: string;
  absoluteTurn: number;
  judgement: Judgement;
  atSongTimeMs: number;
  targetSpaceMs: number;
  level: number;
  isFinish: boolean;
  commandHash: string;
};

export type MultiplayerGameplaySnapshot = {
  matchId: string;
  participantId: string;
  started: boolean;
  audioEnded: boolean;
  songTimeMs: number;
  globalAbsoluteTurn: number;
  globalLevel: number | null;
  globalSequenceIndex: number | null;
  globalIsFinish: boolean;
  globalRoomRest: boolean;
  activeCommandTurn: number;
  activeCommandLevel: number;
  activeCommandIsFinish: boolean;
  activeCommandHash: string;
  activeTargetSpaceMs: number;
  commandVisible: boolean;
  completedDirections: number;
  awaitingSpace: boolean;
  hiddenThroughTurn: number;
  revealAtSongTimeMs: number;
  gaugePercent: number;
  timingDeltaMs: number;
  lastJudgement: Judgement | null;
  judgementAtSongTimeMs: number | null;
  stats: GameStats;
};

export type MultiplayerGameplayCallbacks = {
  onJudgement?: (event: MultiplayerGameplayJudgementEvent) => void;
};

function finite(value: number, name: string) {
  if (!Number.isFinite(value)) throw new Error(`${name} must be finite.`);
}

/**
 * Local multiplayer gameplay consumer.
 *
 * The shared/global turn is derived only from WebAudio song time + the frozen
 * MatchManifest. Player results own only local score/input/suppression state.
 * They never mutate the shared absolute turn, target time, command identity,
 * Finish cadence, or song clock.
 */
export class MultiplayerGameplayRuntime {
  private engine = new RhythmEngine();
  private timeSource: (() => number) | null = null;
  private started = false;
  private audioEnded = false;
  private activeCommandTurn = 0;
  private commandIndex = 0;
  private awaitingSpace = false;
  private commandVisible = false;
  private hiddenThroughTurn = -1;
  private revealAtSongTimeMs = 0;
  private resolvedActiveTurn = false;
  private lastJudgement: Judgement | null = null;
  private judgementAtSongTimeMs: number | null = null;

  constructor(
    private readonly manifest: MatchManifest,
    private readonly participantId: string,
    private readonly callbacks: MultiplayerGameplayCallbacks = {},
  ) {
    if (!manifest.participants.some(participant => participant.participantId === participantId)) {
      throw new Error(`Participant ${participantId} is not part of match ${manifest.matchId}.`);
    }
    if (!(manifest.gameplay.bpmExact > 0)) throw new Error("Multiplayer gameplay requires positive exact BPM.");
    if (!(manifest.gameplay.spaceStartMs > 0)) throw new Error("Multiplayer gameplay requires authored Space Start.");
    if (manifest.gameplay.finishRestTurns !== 4) {
      throw new Error("Multiplayer gameplay requires the locked finishRestTurns = 4 contract.");
    }
    this.revealAtSongTimeMs = Math.max(
      0,
      targetSpaceMs(manifest.gameplay.spaceStartMs, manifest.gameplay.bpmExact, 0)
        - turnDurationMs(manifest.gameplay.bpmExact),
    );
  }

  setTimeSource(source: (() => number) | null) {
    this.timeSource = source;
  }

  get songTimeMs() {
    return Math.max(0, this.timeSource?.() ?? 0);
  }

  get isStarted() {
    return this.started;
  }

  get isAudioEnded() {
    return this.audioEnded;
  }

  get stats(): GameStats {
    return { ...this.engine.stats };
  }

  start() {
    if (!this.timeSource) throw new Error("Multiplayer gameplay requires a WebAudio song-time source.");
    this.engine = new RhythmEngine();
    this.started = true;
    this.audioEnded = false;
    this.activeCommandTurn = 0;
    this.commandIndex = 0;
    this.awaitingSpace = false;
    this.commandVisible = false;
    this.hiddenThroughTurn = -1;
    this.resolvedActiveTurn = false;
    this.lastJudgement = null;
    this.judgementAtSongTimeMs = null;
    this.revealAtSongTimeMs = Math.max(
      0,
      targetSpaceMs(this.manifest.gameplay.spaceStartMs, this.manifest.gameplay.bpmExact, 0)
        - turnDurationMs(this.manifest.gameplay.bpmExact),
    );
    this.advance();
  }

  stop() {
    this.started = false;
    this.commandVisible = false;
  }

  /** AUDIO END is the only gameplay-end signal. Finish never calls this. */
  markAudioEnded() {
    if (!this.started) return;
    this.advance();
    this.audioEnded = true;
    this.started = false;
    this.commandVisible = false;
  }

  private sharedGlobalAbsoluteTurnAt(songTimeMs: number) {
    const duration = turnDurationMs(this.manifest.gameplay.bpmExact);
    return Math.floor((songTimeMs - this.manifest.gameplay.spaceStartMs) / duration);
  }

  private activeSharedTurn() {
    return describeSharedTurn(this.manifest, this.activeCommandTurn);
  }

  private updateVisibility(now: number) {
    if (!this.started || this.audioEnded || this.resolvedActiveTurn) {
      this.commandVisible = false;
      return;
    }
    const active = this.activeSharedTurn();
    this.commandVisible = !active.roomRest
      && this.activeCommandTurn > this.hiddenThroughTurn
      && now >= this.revealAtSongTimeMs;
  }

  advance() {
    if (!this.started || this.audioEnded) return;
    const now = this.songTimeMs;

    for (let guard = 0; guard < 10_000; guard += 1) {
      this.updateVisibility(now);
      const active = this.activeSharedTurn();
      const expiresAt = zoneExitMs(active.targetSpaceMs, this.manifest.gameplay.bpmExact);
      if (now <= expiresAt) break;

      if (this.commandVisible && !this.resolvedActiveTurn) {
        this.resolve("miss", expiresAt);
        continue;
      }

      // A hidden/rest slot can never recursively create a Miss. If a client
      // catches up after dropped frames, move to the next canonical slot only.
      this.moveToActiveTurn(this.activeCommandTurn + 1, expiresAt);
    }

    this.updateVisibility(now);
  }

  handleDirection(direction: Direction) {
    this.advance();
    if (!this.started || this.audioEnded || !this.commandVisible || this.awaitingSpace) return false;
    const active = this.activeSharedTurn();
    const token = active.command[this.commandIndex];
    if (!token) return false;
    if (token.requiredDirection !== direction) {
      this.commandIndex = 0;
      this.awaitingSpace = false;
      return false;
    }
    this.commandIndex += 1;
    this.awaitingSpace = this.commandIndex === active.command.length;
    return true;
  }

  handleSpace(): Judgement | null {
    this.advance();
    if (!this.started || this.audioEnded || !this.commandVisible || !this.awaitingSpace) return null;

    const now = this.songTimeMs;
    const active = this.activeSharedTurn();
    const entry = zoneEntryMs(active.targetSpaceMs, this.manifest.gameplay.bpmExact);
    const exit = zoneExitMs(active.targetSpaceMs, this.manifest.gameplay.bpmExact);
    if (now < entry || now > exit) {
      this.resolve("miss", now);
      return "miss";
    }

    const gaugePercent = getGaugeTiming({
      bpm: this.manifest.gameplay.bpmExact,
      spaceStartMs: this.manifest.gameplay.spaceStartMs,
      perfectCenterPercent: PERFECT_CENTER,
    }, now).sliderPercent;
    const judgement = this.engine.judgeMove(this.activeCommandTurn, gaugePercent);
    if (!judgement) return null;
    this.resolve(judgement, now, true);
    return judgement;
  }

  private resolve(judgement: Judgement, atSongTimeMs: number, engineAlreadyApplied = false) {
    if (this.resolvedActiveTurn) return;
    const active = this.activeSharedTurn();
    if (!engineAlreadyApplied) {
      if (judgement !== "miss") throw new Error("Only Miss may be resolved without a prior RhythmEngine judgement.");
      if (!this.engine.missMove(this.activeCommandTurn)) return;
    }

    this.lastJudgement = judgement;
    this.judgementAtSongTimeMs = atSongTimeMs;
    this.resolvedActiveTurn = true;
    this.commandVisible = false;
    this.commandIndex = 0;
    this.awaitingSpace = false;

    this.callbacks.onJudgement?.({
      matchId: this.manifest.matchId,
      roomId: this.manifest.roomId,
      participantId: this.participantId,
      absoluteTurn: this.activeCommandTurn,
      judgement,
      atSongTimeMs,
      targetSpaceMs: active.targetSpaceMs,
      level: active.level,
      isFinish: active.isFinish,
      commandHash: active.commandHash,
    });

    if (active.isFinish) {
      const nextTurn = this.activeCommandTurn + this.manifest.gameplay.finishRestTurns + 1;
      const lastRestTurn = nextTurn - 1;
      this.hiddenThroughTurn = Math.max(this.hiddenThroughTurn, lastRestTurn);
      this.moveToActiveTurn(
        nextTurn,
        targetSpaceMs(this.manifest.gameplay.spaceStartMs, this.manifest.gameplay.bpmExact, lastRestTurn),
      );
      return;
    }

    const requestedHidden = judgement === "miss"
      ? missPenaltyTurns(active.level)
      : successHiddenTurns(active.level);
    let nextTurn = this.activeCommandTurn + 1;
    let hidden = 0;
    while (hidden < requestedHidden && !describeSharedTurn(this.manifest, nextTurn).isFinish) {
      nextTurn += 1;
      hidden += 1;
    }
    this.hiddenThroughTurn = Math.max(this.hiddenThroughTurn, nextTurn - 1);

    const next = describeSharedTurn(this.manifest, nextTurn);
    let revealAt = atSongTimeMs;
    if (hidden > 0) {
      const lastSuppressedTurn = nextTurn - 1;
      revealAt = next.level >= 6
        ? targetSpaceMs(this.manifest.gameplay.spaceStartMs, this.manifest.gameplay.bpmExact, lastSuppressedTurn)
        : zoneExitMs(
            targetSpaceMs(this.manifest.gameplay.spaceStartMs, this.manifest.gameplay.bpmExact, lastSuppressedTurn),
            this.manifest.gameplay.bpmExact,
          );
    }
    this.moveToActiveTurn(nextTurn, revealAt);
  }

  private moveToActiveTurn(absoluteTurn: number, revealAtSongTimeMs: number) {
    if (!Number.isInteger(absoluteTurn) || absoluteTurn < 0) {
      throw new Error("active command turn must be a non-negative integer.");
    }
    finite(revealAtSongTimeMs, "revealAtSongTimeMs");
    this.activeCommandTurn = absoluteTurn;
    this.revealAtSongTimeMs = Math.max(0, revealAtSongTimeMs);
    this.commandIndex = 0;
    this.awaitingSpace = false;
    this.commandVisible = false;
    this.resolvedActiveTurn = false;
  }

  snapshot(): MultiplayerGameplaySnapshot {
    const now = this.songTimeMs;
    if (this.started && !this.audioEnded) this.advance();
    const globalAbsoluteTurn = this.sharedGlobalAbsoluteTurnAt(now);
    const global = globalAbsoluteTurn >= 0
      ? describeSharedTurn(this.manifest, globalAbsoluteTurn)
      : null;
    const active = this.activeSharedTurn();
    const gaugePercent = getGaugeTiming({
      bpm: this.manifest.gameplay.bpmExact,
      spaceStartMs: this.manifest.gameplay.spaceStartMs,
      perfectCenterPercent: PERFECT_CENTER,
    }, now).sliderPercent;

    return {
      matchId: this.manifest.matchId,
      participantId: this.participantId,
      started: this.started,
      audioEnded: this.audioEnded,
      songTimeMs: now,
      globalAbsoluteTurn,
      globalLevel: global?.level ?? null,
      globalSequenceIndex: global?.sequenceIndex ?? null,
      globalIsFinish: global?.isFinish ?? false,
      globalRoomRest: global?.roomRest ?? false,
      activeCommandTurn: this.activeCommandTurn,
      activeCommandLevel: active.level,
      activeCommandIsFinish: active.isFinish,
      activeCommandHash: active.commandHash,
      activeTargetSpaceMs: active.targetSpaceMs,
      commandVisible: this.commandVisible,
      completedDirections: this.commandIndex,
      awaitingSpace: this.awaitingSpace,
      hiddenThroughTurn: this.hiddenThroughTurn,
      revealAtSongTimeMs: this.revealAtSongTimeMs,
      gaugePercent,
      timingDeltaMs: now - active.targetSpaceMs,
      lastJudgement: this.lastJudgement,
      judgementAtSongTimeMs: this.judgementAtSongTimeMs,
      stats: { ...this.engine.stats },
    };
  }
}
