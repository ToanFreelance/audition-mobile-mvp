/** Isolated QA consumer of the actual shared gameplay runtime, never a second level planner. */
import { DEFAULT_SOLO_SETTINGS, targetSpaceMs, turnDurationMs } from "../../game/solo-easy";
import { describeSharedTurn, firstFinishTurn, repeatCycleTurns } from "../../multiplayer/determinism";
import { MultiplayerGameplayRuntime, type MultiplayerGameplayJudgementEvent } from "../../multiplayer/gameplay-runtime";
import type { MatchManifest } from "../../multiplayer/types";
export type PreviewOutcome = "perfect" | "miss";
export type PreviewTurn = ReturnType<typeof describeSharedTurn> & {
  status: "NORMAL" | "FINISH" | "HIDDEN" | "REST";
  cycle: number; levelBudget: number; nextFinish: number; eligible: boolean;
};
/** Presentation label only. TurnCursor also counts the QA preroll boundary. */
export function previewTurnCounter(mode: string, current: PreviewTurn | null | undefined, boundaryIndex: number) {
  return mode === "gameplay" ? { label: "GAMEPLAY TURN (0-based)", value: current?.absoluteTurn ?? null }
    : { label: "BEAT BOUNDARY (0-based)", value: boundaryIndex };
}
export function qaManifest(bpm: number, seed: number): MatchManifest {
  return {
    manifestVersion: 1, matchId: "animation-qa", roomId: "isolated-tool", roomRevision: 0,
    participants: [{ participantId: "qa", displayName: "QA", kind: "human", role: "host", slotIndex: 0,
      avatar: { characterId: "default-female", outfit: {}, accessoryIds: [], petId: null, titleId: null } }],
    content: { songId: "synthetic-qa-clock", audioVersion: "qa", audioHash: "qa", chartVersion: "qa", chartHash: "qa", characterRuntimeVersion: "qa", animationReleaseVersion: 0, animationReleaseHash: "qa" },
    gameplay: { configVersion: "qa-shared-default", configHash: "qa", modeId: "solo-easy-battle", seed,
      bpmExact: bpm, spaceStartMs: turnDurationMs(bpm), sequenceCounts: DEFAULT_SOLO_SETTINGS.sequenceCounts,
      commandLengths: DEFAULT_SOLO_SETTINGS.commandLengths, finishRestTurns: DEFAULT_SOLO_SETTINGS.finishRestTurns },
  };
}
export class GameplayPreview {
  readonly manifest: MatchManifest;
  readonly runtime: MultiplayerGameplayRuntime;
  readonly turns: PreviewTurn[] = [];
  readonly judgements: MultiplayerGameplayJudgementEvent[] = [];
  private timeMs = 0;
  private nextTurn = 0;
  constructor(bpm: number, seed: number, readonly onDance: (event: MultiplayerGameplayJudgementEvent, beat: number) => void) {
    this.manifest = qaManifest(bpm, seed);
    this.runtime = new MultiplayerGameplayRuntime(this.manifest, "qa", { onJudgement: event => {
      this.judgements.push(event);
      if (event.judgement !== "miss" && event.judgement !== "bad") this.onDance(event, event.atSongTimeMs * bpm / 60000);
    } });
    this.runtime.setTimeSource(() => this.timeMs); this.runtime.start();
  }
  /** Visit exact target instants during catch-up, so dropped frames cannot lose Auto inputs. */
  advance(beat: number, auto: boolean, outcome: PreviewOutcome) {
    if (this.runtime.isAudioEnded) return;
    const { bpmExact, spaceStartMs } = this.manifest.gameplay;
    const now = beat * 60000 / bpmExact;
    while (targetSpaceMs(spaceStartMs, bpmExact, this.nextTurn) <= now + 1e-6) {
      this.timeMs = targetSpaceMs(spaceStartMs, bpmExact, this.nextTurn); this.runtime.advance();
      const state = this.runtime.snapshot(), shared = describeSharedTurn(this.manifest, this.nextTurn);
      const eligible = state.activeCommandTurn === this.nextTurn && state.commandVisible && !shared.roomRest;
      const first = firstFinishTurn(this.manifest), repeat = repeatCycleTurns(this.manifest);
      this.turns.push({ ...shared, eligible,
        status: shared.roomRest ? "REST" : shared.isFinish ? "FINISH" : eligible ? "NORMAL" : "HIDDEN",
        cycle: this.nextTurn <= first ? 1 : 2 + Math.floor((this.nextTurn - first - 1) / repeat),
        levelBudget: this.manifest.gameplay.sequenceCounts[shared.level - 1],
        nextFinish: this.nextTurn <= first ? first : first + Math.ceil((this.nextTurn - first) / repeat) * repeat });
      if (eligible && auto && outcome === "perfect") {
        for (const token of shared.command) this.runtime.handleDirection(token.requiredDirection);
        this.runtime.handleSpace();
      }
      this.nextTurn++;
    }
    this.timeMs = now; this.runtime.advance();
  }
  snapshot() { return { reference: "shared-multiplayer-qa-loop", current: this.turns.at(-1) ?? null, runtime: this.runtime.snapshot(), turnCount: this.turns.length }; }
  /** Resolve the shared REST interval using the actual manifest/helpers, not a
   * fixed wall-clock delay or an independent five-turn planner. */
  resumeBeatAfterFinish(absoluteTurn:number) {
    if(!describeSharedTurn(this.manifest,absoluteTurn).isFinish)throw Error('Expected canonical Finish turn');
    let next=absoluteTurn+1;
    while(describeSharedTurn(this.manifest,next).roomRest)next++;
    const {spaceStartMs,bpmExact}=this.manifest.gameplay;
    return targetSpaceMs(spaceStartMs,bpmExact,next)*bpmExact/60000;
  }
  audioEnd() { this.runtime.markAudioEnded(); }
  finishWindow(absoluteTurn:number) {
    const {spaceStartMs,bpmExact}=this.manifest.gameplay;
    const requestedBeat=targetSpaceMs(spaceStartMs,bpmExact,absoluteTurn)*bpmExact/60000;
    const resumeBeat=this.resumeBeatAfterFinish(absoluteTurn);
    return {requestedBeat,resumeBeat,totalBeats:resumeBeat-requestedBeat};
  }
}
