import {
  allClientsLoaded,
  applyLoadedAck,
  beginServerClockSampling,
  cancelMatchStart,
  createLoadedAckForSession,
  createMatchStartSession,
  deriveSharedCountdown,
  issueSharedStartEpoch,
  planMatchAudioStart,
  type MatchStartSession,
} from "./match-start-protocol";
import { createP41QaFixture } from "./simulated-room";

export type P44QaScenarioId =
  | "normal"
  | "delayed"
  | "stale-ack"
  | "bot-auto-load"
  | "late-client"
  | "cancel-restart"
  | "identical-epoch";

export type P44QaClientRow = {
  participantId: string;
  displayName: string;
  kind: "human" | "bot";
  role: "host" | "guest";
  state: "idle" | "loading" | "loaded" | "failed";
  mappedStartAtServerMs: number | null;
  audioContextStartTimeSec: number | null;
  late: boolean;
};

export type P44QaScenarioResult = {
  scenarioId: P44QaScenarioId;
  title: string;
  pass: boolean;
  detail: string;
  matchId: string;
  roomRevision: number;
  startRevision: number;
  staleAckRejected: boolean | null;
  allClientsLoaded: boolean;
  clockSampleStatus: "waiting" | "ready";
  startAtServerMs: number | null;
  countdownLabel: 3 | 2 | 1 | "GO" | null;
  clients: readonly P44QaClientRow[];
};

const SERVER_NOW_MS = 1_000_000;
const CLIENT_OFFSETS_MS = [120, -75, 33, -145, 210, -18] as const;

function ackParticipant(session: MatchStartSession, participantId: string) {
  const result = applyLoadedAck(session, createLoadedAckForSession(session, participantId));
  if (!result.accepted) throw new Error(`QA ACK rejected: ${result.reason}.`);
  return result.session;
}

function ackAll(session: MatchStartSession) {
  let next = session;
  for (const participant of session.manifest.participants) next = ackParticipant(next, participant.participantId);
  return next;
}

function issueEpoch(session: MatchStartSession) {
  return issueSharedStartEpoch(beginServerClockSampling(session), SERVER_NOW_MS);
}

function rows(session: MatchStartSession, lateParticipantId?: string): P44QaClientRow[] {
  return session.participants.map((participant, index) => {
    let mappedStartAtServerMs: number | null = null;
    let audioContextStartTimeSec: number | null = null;
    let late = false;
    if (session.startAtServerMs !== null) {
      const offset = CLIENT_OFFSETS_MS[index % CLIENT_OFFSETS_MS.length];
      const localStartMs = session.startAtServerMs - offset;
      const localNowMonotonicMs = lateParticipantId === participant.participantId
        ? localStartMs + 250
        : localStartMs - 1_250;
      const plan = planMatchAudioStart(session, {
        estimatedServerOffsetMs: offset,
        localNowMonotonicMs,
        audioContextNowSec: 20 + index,
      });
      mappedStartAtServerMs = plan.startAtServerMs;
      audioContextStartTimeSec = plan.audioContextStartTimeSec;
      late = plan.status === "late";
    }
    const manifestParticipant = session.manifest.participants.find(item => item.participantId === participant.participantId)!;
    return {
      participantId: participant.participantId,
      displayName: manifestParticipant.displayName,
      kind: participant.kind,
      role: participant.role,
      state: participant.state,
      mappedStartAtServerMs,
      audioContextStartTimeSec,
      late,
    };
  });
}

function baseResult(
  scenarioId: P44QaScenarioId,
  title: string,
  session: MatchStartSession,
  input: {
    pass: boolean;
    detail: string;
    staleAckRejected?: boolean | null;
    clockSampleStatus?: "waiting" | "ready";
    lateParticipantId?: string;
  },
): P44QaScenarioResult {
  const countdown = session.startAtServerMs === null
    ? null
    : deriveSharedCountdown(session.startAtServerMs, session.startAtServerMs - 2_500).label;
  return {
    scenarioId,
    title,
    pass: input.pass,
    detail: input.detail,
    matchId: session.matchId,
    roomRevision: session.roomRevision,
    startRevision: session.startRevision,
    staleAckRejected: input.staleAckRejected ?? null,
    allClientsLoaded: allClientsLoaded(session),
    clockSampleStatus: input.clockSampleStatus ?? (allClientsLoaded(session) ? "ready" : "waiting"),
    startAtServerMs: session.startAtServerMs,
    countdownLabel: countdown,
    clients: rows(session, input.lateParticipantId),
  };
}

export function runP44QaScenario(scenarioId: P44QaScenarioId): P44QaScenarioResult {
  const { manifest } = createP41QaFixture();
  let session = createMatchStartSession({ manifest, startRevision: 1 });

  if (scenarioId === "normal") {
    session = issueEpoch(ackAll(session));
    return baseResult(scenarioId, "A. All clients load normally", session, {
      pass: allClientsLoaded(session) && session.startAtServerMs !== null,
      detail: "All six active participants ACK the frozen match, then one shared future epoch is issued.",
      clockSampleStatus: "ready",
    });
  }

  if (scenarioId === "delayed") {
    for (const participant of manifest.participants.slice(0, -1)) {
      session = ackParticipant(session, participant.participantId);
    }
    const pass = !allClientsLoaded(session) && session.startAtServerMs === null;
    return baseResult(scenarioId, "B. One client delayed", session, {
      pass,
      detail: "One active participant remains IDLE, so the allClientsLoaded gate blocks clock sampling and epoch issue.",
    });
  }

  if (scenarioId === "stale-ack") {
    const currentAck = createLoadedAckForSession(session, manifest.participants[0].participantId);
    const stale = { ...currentAck, startRevision: currentAck.startRevision - 1 };
    const result = applyLoadedAck(session, stale);
    const rejected = !result.accepted && result.reason === "wrong-start-revision";
    return baseResult(scenarioId, "C. Stale LOADED ACK", session, {
      pass: rejected && !allClientsLoaded(session),
      detail: "An ACK from an older startRevision is rejected and cannot satisfy the current gate.",
      staleAckRejected: rejected,
    });
  }

  if (scenarioId === "bot-auto-load") {
    for (const participant of manifest.participants.filter(item => item.kind === "bot")) {
      session = ackParticipant(session, participant.participantId);
    }
    const botsLoaded = session.participants
      .filter(participant => participant.kind === "bot")
      .every(participant => participant.state === "loaded");
    const hostStillRequired = session.participants.find(participant => participant.role === "host")?.state !== "loaded";
    return baseResult(scenarioId, "D. Bot auto-load", session, {
      pass: botsLoaded && hostStillRequired && !allClientsLoaded(session),
      detail: "Bots ACK immediately through the same logical gate; the human host still must become LOADED.",
    });
  }

  if (scenarioId === "late-client") {
    session = issueEpoch(ackAll(session));
    const lateParticipantId = manifest.participants.at(-1)!.participantId;
    const lateDetected = rows(session, lateParticipantId)
      .some(row => row.participantId === lateParticipantId && row.late);
    return baseResult(scenarioId, "E. Late client detection", session, {
      pass: lateDetected && session.startAtServerMs !== null,
      detail: "A late client is reported late against the immutable room epoch; the epoch is not moved.",
      clockSampleStatus: "ready",
      lateParticipantId,
    });
  }

  if (scenarioId === "cancel-restart") {
    const staleAck = createLoadedAckForSession(session, manifest.participants[0].participantId);
    const cancelled = cancelMatchStart(session, "qa-restart");
    session = createMatchStartSession({ manifest, startRevision: cancelled.startRevision + 1 });
    const staleResult = applyLoadedAck(session, staleAck);
    const rejected = !staleResult.accepted && staleResult.reason === "wrong-start-revision";
    return baseResult(scenarioId, "F. Cancelled/restarted start revision", session, {
      pass: rejected && !allClientsLoaded(session),
      detail: "Restart creates a new startRevision; delayed ACKs from the cancelled attempt cannot unlock it.",
      staleAckRejected: rejected,
    });
  }

  session = issueEpoch(ackAll(session));
  const plans = rows(session);
  const everyClientHasSameEpoch = session.startAtServerMs !== null
    && plans.every(row => row.mappedStartAtServerMs === session.startAtServerMs);
  const allScheduled = plans.every(row => row.audioContextStartTimeSec !== null && !row.late);
  return baseResult(scenarioId, "G. Identical shared start epoch", session, {
    pass: everyClientHasSameEpoch && allScheduled,
    detail: "Every logical client maps the exact same startAtServerMs through its own local clock offset to AudioContext time.",
    clockSampleStatus: "ready",
  });
}
