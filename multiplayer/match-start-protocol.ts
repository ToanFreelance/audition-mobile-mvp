import { planSharedAudioStart, type SharedStartPlan } from "./shared-clock";
import type { MatchManifest } from "./types";

export const MATCH_START_PROTOCOL_VERSION = 1 as const;
export const P44_DEFAULT_START_LEAD_MS = 4_500;
export const P44_MIN_START_LEAD_MS = 3_000;

export type MatchStartPhase = "preloading" | "clock-sampling" | "countdown" | "cancelled";
export type MatchStartLoadState = "idle" | "loading" | "loaded" | "failed";
export type PresentationResourceReadiness = "ready" | "fallback-ready";

export type MatchLoadedAck = {
  protocolVersion: typeof MATCH_START_PROTOCOL_VERSION;
  roomId: string;
  matchId: string;
  roomRevision: number;
  startRevision: number;
  participantId: string;
  content: {
    manifestVersion: MatchManifest["manifestVersion"];
    audioVersion: string;
    audioHash: string;
    chartVersion: string;
    chartHash: string;
    gameplayConfigVersion: string;
    gameplayConfigHash: string;
    characterRuntimeVersion: string;
    animationReleaseVersion: number;
    animationReleaseHash: string;
    characterReadiness: PresentationResourceReadiness;
    animationReadiness: PresentationResourceReadiness;
  };
};

export type MatchStartParticipantState = {
  participantId: string;
  kind: "human" | "bot";
  role: "host" | "guest";
  state: MatchStartLoadState;
  detail?: string;
};

export type MatchStartSession = {
  protocolVersion: typeof MATCH_START_PROTOCOL_VERSION;
  roomId: string;
  matchId: string;
  roomRevision: number;
  startRevision: number;
  manifest: MatchManifest;
  phase: MatchStartPhase;
  participants: readonly MatchStartParticipantState[];
  safeLeadTimeMs: number;
  startAtServerMs: number | null;
  cancelledReason?: string;
};

export type LoadedAckRejectionReason =
  | "session-cancelled"
  | "wrong-room"
  | "wrong-match"
  | "wrong-room-revision"
  | "wrong-start-revision"
  | "unknown-participant"
  | "content-mismatch";

export type LoadedAckResult =
  | { accepted: true; session: MatchStartSession }
  | { accepted: false; reason: LoadedAckRejectionReason; session: MatchStartSession };

function finite(value: number, name: string) {
  if (!Number.isFinite(value)) throw new Error(`${name} must be finite.`);
}

function freezeSession(session: MatchStartSession): MatchStartSession {
  const participants = session.participants.map(participant => Object.freeze({ ...participant }));
  return Object.freeze({ ...session, participants: Object.freeze(participants) });
}

function replaceParticipant(
  session: MatchStartSession,
  participantId: string,
  patch: Partial<MatchStartParticipantState>,
) {
  if (session.phase === "cancelled") throw new Error("Cancelled start sessions cannot change load state.");
  const existing = session.participants.find(participant => participant.participantId === participantId);
  if (!existing) throw new Error(`Unknown participant ${participantId}.`);
  return freezeSession({
    ...session,
    participants: session.participants.map(participant => participant.participantId === participantId
      ? { ...participant, ...patch }
      : participant),
  });
}

function expectedAckContent(manifest: MatchManifest): MatchLoadedAck["content"] {
  return {
    manifestVersion: manifest.manifestVersion,
    audioVersion: manifest.content.audioVersion,
    audioHash: manifest.content.audioHash,
    chartVersion: manifest.content.chartVersion,
    chartHash: manifest.content.chartHash,
    gameplayConfigVersion: manifest.gameplay.configVersion,
    gameplayConfigHash: manifest.gameplay.configHash,
    characterRuntimeVersion: manifest.content.characterRuntimeVersion,
    animationReleaseVersion: manifest.content.animationReleaseVersion,
    animationReleaseHash: manifest.content.animationReleaseHash,
    characterReadiness: "ready",
    animationReadiness: "ready",
  };
}

function contentMatchesManifest(ack: MatchLoadedAck, manifest: MatchManifest) {
  const expected = expectedAckContent(manifest);
  return ack.content.manifestVersion === expected.manifestVersion
    && ack.content.audioVersion === expected.audioVersion
    && ack.content.audioHash === expected.audioHash
    && ack.content.chartVersion === expected.chartVersion
    && ack.content.chartHash === expected.chartHash
    && ack.content.gameplayConfigVersion === expected.gameplayConfigVersion
    && ack.content.gameplayConfigHash === expected.gameplayConfigHash
    && ack.content.characterRuntimeVersion === expected.characterRuntimeVersion
    && ack.content.animationReleaseVersion === expected.animationReleaseVersion
    && ack.content.animationReleaseHash === expected.animationReleaseHash
    && (ack.content.characterReadiness === "ready" || ack.content.characterReadiness === "fallback-ready")
    && (ack.content.animationReadiness === "ready" || ack.content.animationReadiness === "fallback-ready");
}

export function createMatchStartSession(input: {
  manifest: MatchManifest;
  startRevision: number;
  safeLeadTimeMs?: number;
}): MatchStartSession {
  if (!Number.isInteger(input.startRevision) || input.startRevision < 1) {
    throw new Error("startRevision must be a positive integer.");
  }
  const safeLeadTimeMs = input.safeLeadTimeMs ?? P44_DEFAULT_START_LEAD_MS;
  finite(safeLeadTimeMs, "safeLeadTimeMs");
  if (safeLeadTimeMs < P44_MIN_START_LEAD_MS) {
    throw new Error(`safeLeadTimeMs must be at least ${P44_MIN_START_LEAD_MS} ms.`);
  }
  if (input.manifest.gameplay.finishRestTurns !== 4) {
    throw new Error("P4.4 requires the locked finishRestTurns = 4 contract.");
  }

  return freezeSession({
    protocolVersion: MATCH_START_PROTOCOL_VERSION,
    roomId: input.manifest.roomId,
    matchId: input.manifest.matchId,
    roomRevision: input.manifest.roomRevision,
    startRevision: input.startRevision,
    manifest: input.manifest,
    phase: "preloading",
    participants: input.manifest.participants.map(participant => ({
      participantId: participant.participantId,
      kind: participant.kind,
      role: participant.role,
      state: "idle",
    })),
    safeLeadTimeMs,
    startAtServerMs: null,
  });
}

export function markParticipantLoading(session: MatchStartSession, participantId: string) {
  return replaceParticipant(session, participantId, { state: "loading", detail: undefined });
}

export function markParticipantLoadFailed(
  session: MatchStartSession,
  participantId: string,
  detail: string,
) {
  return replaceParticipant(session, participantId, { state: "failed", detail });
}

export function createLoadedAckForSession(
  session: MatchStartSession,
  participantId: string,
  presentation?: {
    characterReadiness?: PresentationResourceReadiness;
    animationReadiness?: PresentationResourceReadiness;
  },
): MatchLoadedAck {
  if (!session.participants.some(participant => participant.participantId === participantId)) {
    throw new Error(`Unknown participant ${participantId}.`);
  }
  const content = expectedAckContent(session.manifest);
  return {
    protocolVersion: MATCH_START_PROTOCOL_VERSION,
    roomId: session.roomId,
    matchId: session.matchId,
    roomRevision: session.roomRevision,
    startRevision: session.startRevision,
    participantId,
    content: {
      ...content,
      characterReadiness: presentation?.characterReadiness ?? "ready",
      animationReadiness: presentation?.animationReadiness ?? "ready",
    },
  };
}

export function applyLoadedAck(session: MatchStartSession, ack: MatchLoadedAck): LoadedAckResult {
  if (session.phase === "cancelled") return { accepted: false, reason: "session-cancelled", session };
  if (ack.roomId !== session.roomId) return { accepted: false, reason: "wrong-room", session };
  if (ack.matchId !== session.matchId) return { accepted: false, reason: "wrong-match", session };
  if (ack.roomRevision !== session.roomRevision) {
    return { accepted: false, reason: "wrong-room-revision", session };
  }
  if (ack.startRevision !== session.startRevision) {
    return { accepted: false, reason: "wrong-start-revision", session };
  }
  if (!session.participants.some(participant => participant.participantId === ack.participantId)) {
    return { accepted: false, reason: "unknown-participant", session };
  }
  if (!contentMatchesManifest(ack, session.manifest)) {
    return { accepted: false, reason: "content-mismatch", session };
  }
  return {
    accepted: true,
    session: replaceParticipant(session, ack.participantId, { state: "loaded", detail: undefined }),
  };
}

export function allClientsLoaded(session: MatchStartSession) {
  return session.participants.length > 0
    && session.participants.every(participant => participant.state === "loaded");
}

export function beginServerClockSampling(session: MatchStartSession) {
  if (session.phase !== "preloading") throw new Error("Clock sampling can only begin after preloading.");
  if (!allClientsLoaded(session)) throw new Error("Every active participant must be Loaded before clock sampling.");
  return freezeSession({ ...session, phase: "clock-sampling" });
}

export function issueSharedStartEpoch(session: MatchStartSession, serverNowMs: number) {
  if (session.phase !== "clock-sampling") throw new Error("Shared start epoch requires clock-sampling phase.");
  if (!allClientsLoaded(session)) throw new Error("Every active participant must remain Loaded before epoch issue.");
  if (session.startAtServerMs !== null) throw new Error("Shared start epoch is immutable once issued.");
  finite(serverNowMs, "serverNowMs");

  const startAtServerMs = Math.ceil(serverNowMs) + session.safeLeadTimeMs;
  return freezeSession({ ...session, phase: "countdown", startAtServerMs });
}

export function cancelMatchStart(session: MatchStartSession, reason: string) {
  if (!reason.trim()) throw new Error("Cancellation reason is required.");
  if (session.phase === "cancelled") return session;
  return freezeSession({ ...session, phase: "cancelled", cancelledReason: reason });
}

export type SharedCountdownState = {
  startAtServerMs: number;
  serverNowMs: number;
  remainingMs: number;
  label: 3 | 2 | 1 | "GO" | null;
};

/** Countdown presentation is derived from the immutable shared epoch; it never owns start timing. */
export function deriveSharedCountdown(startAtServerMs: number, serverNowMs: number): SharedCountdownState {
  finite(startAtServerMs, "startAtServerMs");
  finite(serverNowMs, "serverNowMs");
  const remainingMs = startAtServerMs - serverNowMs;
  let label: SharedCountdownState["label"] = null;
  if (remainingMs <= 0) label = "GO";
  else if (remainingMs <= 3_000) label = Math.ceil(remainingMs / 1_000) as 1 | 2 | 3;
  return { startAtServerMs, serverNowMs, remainingMs, label };
}

export function planMatchAudioStart(session: MatchStartSession, input: {
  estimatedServerOffsetMs: number;
  localNowMonotonicMs: number;
  audioContextNowSec: number;
}): SharedStartPlan {
  if (session.startAtServerMs === null) throw new Error("Shared start epoch has not been issued.");
  return planSharedAudioStart({
    startAtServerMs: session.startAtServerMs,
    estimatedServerOffsetMs: input.estimatedServerOffsetMs,
    localNowMonotonicMs: input.localNowMonotonicMs,
    audioContextNowSec: input.audioContextNowSec,
  });
}
