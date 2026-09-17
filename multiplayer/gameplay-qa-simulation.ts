import { zoneExitMs } from "../game/solo-easy";
import { describeSharedTurn, firstFinishTurn } from "./determinism";
import {
  MultiplayerGameplayRuntime,
  type MultiplayerGameplayJudgementEvent,
  type MultiplayerGameplaySnapshot,
} from "./gameplay-runtime";
import { createP41QaFixture } from "./simulated-room";

export type P45QaClientRow = {
  participantId: string;
  globalTurn: number;
  globalLevel: number | null;
  activeCommandTurn: number;
  commandVisible: boolean;
  score: number;
  combo: number;
  lastJudgement: string | null;
};

export type P45QaResult = {
  pass: boolean;
  divergentOutcomePass: boolean;
  sharedGlobalTurnPass: boolean;
  canonicalCommandPass: boolean;
  finishRestPass: boolean;
  droppedFrameCatchupPass: boolean;
  audioEndOnlyPass: boolean;
  resultEventPass: boolean;
  finishTurn: number;
  resumeTurn: number;
  canonicalCommandHash: string;
  clients: readonly P45QaClientRow[];
  detail: string;
};

type QaClient = {
  participantId: string;
  runtime: MultiplayerGameplayRuntime;
  events: MultiplayerGameplayJudgementEvent[];
  setSongTimeMs: (value: number) => void;
};

function createClient(participantId: string): QaClient {
  const { manifest } = createP41QaFixture();
  let songTimeMs = 0;
  const events: MultiplayerGameplayJudgementEvent[] = [];
  const runtime = new MultiplayerGameplayRuntime(manifest, participantId, {
    onJudgement: event => events.push(event),
  });
  runtime.setTimeSource(() => songTimeMs);
  runtime.start();
  return {
    participantId,
    runtime,
    events,
    setSongTimeMs: value => { songTimeMs = value; },
  };
}

function completeCurrentAtTarget(client: QaClient) {
  const { manifest } = createP41QaFixture();
  const before = client.runtime.snapshot();
  const shared = describeSharedTurn(manifest, before.activeCommandTurn);
  client.setSongTimeMs(shared.targetSpaceMs);
  client.runtime.advance();
  const active = client.runtime.snapshot();
  const command = describeSharedTurn(manifest, active.activeCommandTurn).command;
  for (const token of command) client.runtime.handleDirection(token.requiredDirection);
  return client.runtime.handleSpace();
}

function row(snapshot: MultiplayerGameplaySnapshot): P45QaClientRow {
  return {
    participantId: snapshot.participantId,
    globalTurn: snapshot.globalAbsoluteTurn,
    globalLevel: snapshot.globalLevel,
    activeCommandTurn: snapshot.activeCommandTurn,
    commandVisible: snapshot.commandVisible,
    score: snapshot.stats.score,
    combo: snapshot.stats.combo,
    lastJudgement: snapshot.lastJudgement,
  };
}

export function runP45GameplayQa(): P45QaResult {
  const { manifest } = createP41QaFixture();
  const perfect = createClient("human-host");
  const miss = createClient("bot-1");

  const first = describeSharedTurn(manifest, 0);
  perfect.setSongTimeMs(first.targetSpaceMs);
  perfect.runtime.advance();
  const firstCommand = describeSharedTurn(manifest, perfect.runtime.snapshot().activeCommandTurn).command;
  for (const token of firstCommand) perfect.runtime.handleDirection(token.requiredDirection);
  const perfectJudgement = perfect.runtime.handleSpace();

  miss.setSongTimeMs(zoneExitMs(first.targetSpaceMs, manifest.gameplay.bpmExact) + 1);
  miss.runtime.advance();
  const missSnapshotAfterTurn = miss.runtime.snapshot();
  const divergentOutcomePass = perfectJudgement === "perfect"
    && missSnapshotAfterTurn.lastJudgement === "miss"
    && perfect.runtime.stats.score !== miss.runtime.stats.score;

  const comparisonTurn = 5;
  const comparison = describeSharedTurn(manifest, comparisonTurn);
  perfect.setSongTimeMs(comparison.targetSpaceMs);
  miss.setSongTimeMs(comparison.targetSpaceMs);
  perfect.runtime.advance();
  miss.runtime.advance();
  const perfectComparison = perfect.runtime.snapshot();
  const missComparison = miss.runtime.snapshot();
  const sharedGlobalTurnPass = perfectComparison.globalAbsoluteTurn === comparisonTurn
    && missComparison.globalAbsoluteTurn === comparisonTurn
    && perfectComparison.globalLevel === missComparison.globalLevel;
  const canonicalCommandPass = describeSharedTurn(manifest, perfectComparison.globalAbsoluteTurn).commandHash
    === describeSharedTurn(manifest, missComparison.globalAbsoluteTurn).commandHash;

  const finishTurn = firstFinishTurn(manifest);
  const finish = describeSharedTurn(manifest, finishTurn);
  const finishSuccess = createClient("human-host");
  const finishMiss = createClient("bot-2");
  finishSuccess.setSongTimeMs(finish.targetSpaceMs);
  finishMiss.setSongTimeMs(finish.targetSpaceMs);
  finishSuccess.runtime.advance();
  finishMiss.runtime.advance();
  const successAtFinish = finishSuccess.runtime.snapshot();
  const missAtFinish = finishMiss.runtime.snapshot();
  let finishSuccessJudgement = null;
  if (successAtFinish.activeCommandTurn === finishTurn) {
    finishSuccessJudgement = completeCurrentAtTarget(finishSuccess);
  }
  if (missAtFinish.activeCommandTurn === finishTurn) {
    finishMiss.setSongTimeMs(zoneExitMs(finish.targetSpaceMs, manifest.gameplay.bpmExact) + 1);
    finishMiss.runtime.advance();
  }

  const resumeTurn = finishTurn + manifest.gameplay.finishRestTurns + 1;
  const resume = describeSharedTurn(manifest, resumeTurn);
  finishSuccess.setSongTimeMs(resume.targetSpaceMs);
  finishMiss.setSongTimeMs(resume.targetSpaceMs);
  finishSuccess.runtime.advance();
  finishMiss.runtime.advance();
  const successResume = finishSuccess.runtime.snapshot();
  const missResume = finishMiss.runtime.snapshot();
  const finishRestPass = finishSuccessJudgement === "perfect"
    && successResume.globalAbsoluteTurn === resumeTurn
    && missResume.globalAbsoluteTurn === resumeTurn
    && successResume.activeCommandTurn === resumeTurn
    && missResume.activeCommandTurn === resumeTurn
    && successResume.commandVisible
    && missResume.commandVisible;

  const dropped = createClient("bot-3");
  dropped.setSongTimeMs(resume.targetSpaceMs);
  dropped.runtime.advance();
  const droppedSnapshot = dropped.runtime.snapshot();
  const droppedFrameCatchupPass = droppedSnapshot.globalAbsoluteTurn === resumeTurn
    && droppedSnapshot.activeCommandTurn === resumeTurn;

  const beforeAudioEnd = finishSuccess.runtime.snapshot();
  finishSuccess.runtime.markAudioEnded();
  const afterAudioEnd = finishSuccess.runtime.snapshot();
  const audioEndOnlyPass = !beforeAudioEnd.audioEnded
    && beforeAudioEnd.started
    && afterAudioEnd.audioEnded
    && !afterAudioEnd.started;

  const resultEventPass = perfect.events.length >= 1
    && miss.events.length >= 1
    && perfect.events[0].absoluteTurn === 0
    && perfect.events[0].commandHash === first.commandHash
    && miss.events[0].commandHash === first.commandHash;

  const clients = [successResume, missResume, droppedSnapshot].map(row);
  const pass = divergentOutcomePass
    && sharedGlobalTurnPass
    && canonicalCommandPass
    && finishRestPass
    && droppedFrameCatchupPass
    && audioEndOnlyPass
    && resultEventPass;

  return {
    pass,
    divergentOutcomePass,
    sharedGlobalTurnPass,
    canonicalCommandPass,
    finishRestPass,
    droppedFrameCatchupPass,
    audioEndOnlyPass,
    resultEventPass,
    finishTurn,
    resumeTurn,
    canonicalCommandHash: resume.commandHash,
    clients,
    detail: pass
      ? "Different player outcomes remain local while WebAudio-derived global turns, Finish rest, and canonical commands stay shared."
      : "One or more P4.5 gameplay invariants diverged.",
  };
}
