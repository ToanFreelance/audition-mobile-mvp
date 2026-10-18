import type { GameStats } from "../game/types";
import type { MatchManifest } from "./types";

export type LiveScoreSnapshot = {
  matchId: string;
  participantId: string;
  lastResolvedTurn: number;
  stats: GameStats;
  audioEnded: boolean;
};

const SCORE_VALUES = { perfect: 1000, great: 800, cool: 600, bad: 400 } as const;

function validStats(stats: GameStats, lastTurn: number): boolean {
  if (!stats || typeof stats !== "object") return false;
  const values = [
    stats.score, stats.combo, stats.maxCombo, stats.perfect,
    stats.great, stats.cool, stats.bad, stats.miss,
  ];
  if (!values.every(value => Number.isSafeInteger(value) && value >= 0)) return false;
  const successes = stats.perfect + stats.great + stats.cool + stats.bad;
  const judged = successes + stats.miss;
  return stats.score === stats.perfect * SCORE_VALUES.perfect
    + stats.great * SCORE_VALUES.great
    + stats.cool * SCORE_VALUES.cool
    + stats.bad * SCORE_VALUES.bad
    && stats.combo <= stats.maxCombo
    && stats.maxCombo <= successes
    && judged <= lastTurn + 1
    && (lastTurn >= 0 || judged === 0);
}

/**
 * Client-reported score display, NOT a server-verified competitive score.
 * Accept only the frozen match's sender, with cumulative/monotonic judgement
 * data. A newer cumulative snapshot repairs missed Realtime broadcasts.
 * No score event can write RoomState or change the shared gameplay clock.
 */
export function acceptLiveScoreSnapshot(input: {
  manifest: MatchManifest;
  localParticipantId: string;
  senderParticipantId: string;
  candidate: LiveScoreSnapshot;
  previous?: LiveScoreSnapshot;
}): LiveScoreSnapshot | null {
  const { manifest, localParticipantId, senderParticipantId, candidate, previous } = input;
  if (!candidate || typeof candidate !== "object") return null;
  if (candidate.matchId !== manifest.matchId
    || candidate.participantId !== senderParticipantId
    || candidate.participantId === localParticipantId) return null;
  if (!manifest.participants.some(member =>
    member.participantId === candidate.participantId && member.kind === "human"
  )) return null;
  if (!Number.isSafeInteger(candidate.lastResolvedTurn) || candidate.lastResolvedTurn < -1
    || typeof candidate.audioEnded !== "boolean"
    || !validStats(candidate.stats, candidate.lastResolvedTurn)) return null;
  if (previous) {
    if (previous.matchId !== candidate.matchId || previous.participantId !== candidate.participantId) return null;
    if (candidate.lastResolvedTurn < previous.lastResolvedTurn) return null;
    const counters: (keyof GameStats)[] = ["score", "maxCombo", "perfect", "great", "cool", "bad", "miss"];
    if (counters.some(key => candidate.stats[key] < previous.stats[key])) return null;
    if (previous.audioEnded && !candidate.audioEnded) return null;
    if (candidate.lastResolvedTurn === previous.lastResolvedTurn) {
      // Duplicate/resend of the same turn is idempotent. AUDIO END may set
      // the final marker on the same turn, but cannot change its score.
      if (counters.some(key => candidate.stats[key] !== previous.stats[key])
        || candidate.stats.combo !== previous.stats.combo
        || candidate.audioEnded === previous.audioEnded) return null;
    }
  }
  return {
    matchId: candidate.matchId,
    participantId: candidate.participantId,
    lastResolvedTurn: candidate.lastResolvedTurn,
    stats: { ...candidate.stats },
    audioEnded: candidate.audioEnded,
  };
}
