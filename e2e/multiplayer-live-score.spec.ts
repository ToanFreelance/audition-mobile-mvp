import { expect, test } from "@playwright/test";
import type { GameStats } from "../game/types";
import { acceptLiveScoreSnapshot, type LiveScoreSnapshot } from "../multiplayer/live-score";
import type { MatchManifest } from "../multiplayer/types";

const manifest = {
  matchId: "live-match-A",
  roomId: "mvp-live-A",
  roomRevision: 12,
  participants: [
    { participantId: "human-host", kind: "human", role: "host" },
    { participantId: "human-guest", kind: "human", role: "guest" },
    { participantId: "human-third", kind: "human", role: "guest" },
  ],
} as MatchManifest;

function score(stats?: Partial<GameStats>): GameStats {
  return {
    score: 0, combo: 0, maxCombo: 0,
    perfect: 0, great: 0, cool: 0, bad: 0, miss: 0,
    ...stats,
  };
}

function update(lastResolvedTurn: number, stats: GameStats, audioEnded = false): LiveScoreSnapshot {
  return {
    matchId: manifest.matchId,
    participantId: "human-guest",
    lastResolvedTurn,
    stats,
    audioEnded,
  };
}

function accept(candidate: LiveScoreSnapshot, previous?: LiveScoreSnapshot, senderParticipantId = "human-guest") {
  return acceptLiveScoreSnapshot({
    manifest,
    localParticipantId: "human-host",
    senderParticipantId,
    candidate,
    previous,
  });
}

test.describe("RC02 client-reported live score envelope", () => {
  test("adopts real cumulative score from other frozen Human", () => {
    const first = accept(update(0, score({
      perfect: 1, score: 1000, combo: 1, maxCombo: 1,
    })));
    expect(first?.stats.score).toBe(1000);
    expect(first?.participantId).toBe("human-guest");
  });

  test("rejects duplicate/stale judgement turn; later cumulative snapshot repairs missed messages", () => {
    const first = accept(update(0, score({
      perfect: 1, score: 1000, combo: 1, maxCombo: 1,
    })))!;
    expect(accept(first, first)).toBeNull();
    expect(accept(update(-1, score()), first)).toBeNull();

    // Turn 1 update was lost. Turn 3 cumulative counters still recover.
    const recovered = accept(update(3, score({
      perfect: 2, miss: 1, score: 2000, combo: 1, maxCombo: 1,
    })), first);
    expect(recovered?.stats).toMatchObject({ score: 2000, miss: 1, perfect: 2 });
  });

  test("rejects self, forged sender, wrong match and unknown frozen participant", () => {
    const candidate = update(0, score({ great: 1, score: 800, combo: 1, maxCombo: 1 }));
    expect(accept(candidate, undefined, "human-host")).toBeNull();
    expect(accept({ ...candidate, participantId: "human-host" })).toBeNull();
    expect(accept({ ...candidate, matchId: "other-match" })).toBeNull();
    expect(accept({ ...candidate, participantId: "unlisted-human" }, undefined, "unlisted-human")).toBeNull();
  });

  test("invalid stats cannot fake score or negative counters; cannot roll back cumulative values", () => {
    expect(accept(update(0, score({ score: 99999, perfect: 1, combo: 1, maxCombo: 1 })))).toBeNull();
    expect(accept(update(0, score({ perfect: -1 })))).toBeNull();
    expect(accept(update(0, score({ perfect: 2, score: 2000, combo: 2, maxCombo: 2 })))).toBeNull();

    const first = accept(update(2, score({ perfect: 1, miss: 1, score: 1000, maxCombo: 1 })))!;
    expect(accept(update(4, score({ miss: 2 })), first)).toBeNull();
  });

  test("resends are idempotent and only AUDIO END may set final flag on same turn", () => {
    const first = accept(update(2, score({ perfect: 1, score: 1000, combo: 1, maxCombo: 1 })))!;
    const ended = accept(update(2, first.stats, true), first);
    expect(ended?.audioEnded).toBe(true);
    expect(accept(update(2, first.stats, true), ended!)).toBeNull();
    expect(accept(update(3, score({ perfect: 1, score: 1000, combo: 1, maxCombo: 1 })), ended!)).toBeNull();
  });

  test("initial 0 score and later genuine MISS remain valid, not synthetic opponent scores", () => {
    const initial = accept(update(-1, score()));
    expect(initial?.stats.score).toBe(0);
    const miss = accept(update(0, score({ miss: 1 })), initial!);
    expect(miss?.stats.miss).toBe(1);
    expect(miss?.stats.score).toBe(0);
  });
});
