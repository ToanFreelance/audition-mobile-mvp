import { expect, test } from "@playwright/test";
import { simulateSharedStartClock } from "../multiplayer/clock-sync-simulation";
import { describeSharedTurn } from "../multiplayer/determinism";
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
} from "../multiplayer/match-start-protocol";
import { createP41QaFixture } from "../multiplayer/simulated-room";

test.describe("P4.4 preload/start protocol", () => {
  test("host has no Ready gate but still must Loaded; bots pass through the same ACK gate", () => {
    const { manifest } = createP41QaFixture();
    let session = createMatchStartSession({ manifest, startRevision: 1 });

    for (const participant of manifest.participants.filter(item => item.kind === "bot")) {
      const result = applyLoadedAck(session, createLoadedAckForSession(session, participant.participantId));
      expect(result.accepted).toBe(true);
      session = result.session;
    }

    expect(allClientsLoaded(session)).toBe(false);
    const host = manifest.participants.find(item => item.role === "host");
    expect(host).toBeTruthy();
    const hostResult = applyLoadedAck(session, createLoadedAckForSession(session, host!.participantId));
    expect(hostResult.accepted).toBe(true);
    expect(allClientsLoaded(hostResult.session)).toBe(true);
  });

  test("stale match/revision/start ACKs and content mismatches cannot satisfy the current gate", () => {
    const { manifest } = createP41QaFixture();
    const session = createMatchStartSession({ manifest, startRevision: 7 });
    const valid = createLoadedAckForSession(session, manifest.participants[0].participantId);

    expect(applyLoadedAck(session, { ...valid, matchId: "old-match" })).toMatchObject({
      accepted: false,
      reason: "wrong-match",
    });
    expect(applyLoadedAck(session, { ...valid, roomRevision: valid.roomRevision - 1 })).toMatchObject({
      accepted: false,
      reason: "wrong-room-revision",
    });
    expect(applyLoadedAck(session, { ...valid, startRevision: 6 })).toMatchObject({
      accepted: false,
      reason: "wrong-start-revision",
    });
    expect(applyLoadedAck(session, {
      ...valid,
      content: { ...valid.content, audioHash: "stale-audio-hash" },
    })).toMatchObject({ accepted: false, reason: "content-mismatch" });
    expect(allClientsLoaded(session)).toBe(false);
  });

  test("fallback-ready character/animation presentation can ACK while exact beat-critical content must match", () => {
    const { manifest } = createP41QaFixture();
    const session = createMatchStartSession({ manifest, startRevision: 2 });
    const ack = createLoadedAckForSession(session, manifest.participants[0].participantId, {
      characterReadiness: "fallback-ready",
      animationReadiness: "fallback-ready",
    });
    const result = applyLoadedAck(session, ack);
    expect(result.accepted).toBe(true);
  });

  test("epoch cannot issue until every active participant Loaded and is then immutable", () => {
    const { manifest } = createP41QaFixture();
    let session = createMatchStartSession({ manifest, startRevision: 3 });
    expect(() => beginServerClockSampling(session)).toThrow("Every active participant must be Loaded");

    for (const participant of manifest.participants) {
      const result = applyLoadedAck(session, createLoadedAckForSession(session, participant.participantId));
      expect(result.accepted).toBe(true);
      session = result.session;
    }

    session = beginServerClockSampling(session);
    const countdown = issueSharedStartEpoch(session, 1_000_000.25);
    expect(countdown.startAtServerMs).toBe(1_004_501);
    expect(countdown.phase).toBe("countdown");
    expect(() => issueSharedStartEpoch(countdown, 1_000_100)).toThrow();
  });

  test("countdown and AudioContext scheduling derive from the same shared epoch", () => {
    const { manifest } = createP41QaFixture();
    let session = createMatchStartSession({ manifest, startRevision: 4 });
    for (const participant of manifest.participants) {
      const result = applyLoadedAck(session, createLoadedAckForSession(session, participant.participantId));
      if (!result.accepted) throw new Error(result.reason);
      session = result.session;
    }
    session = issueSharedStartEpoch(beginServerClockSampling(session), 2_000_000);

    expect(deriveSharedCountdown(session.startAtServerMs!, session.startAtServerMs! - 2_900).label).toBe(3);
    expect(deriveSharedCountdown(session.startAtServerMs!, session.startAtServerMs! - 1_900).label).toBe(2);
    expect(deriveSharedCountdown(session.startAtServerMs!, session.startAtServerMs! - 900).label).toBe(1);
    expect(deriveSharedCountdown(session.startAtServerMs!, session.startAtServerMs!).label).toBe("GO");

    const hostPlan = planMatchAudioStart(session, {
      estimatedServerOffsetMs: 100,
      localNowMonotonicMs: session.startAtServerMs! - 100 - 1_000,
      audioContextNowSec: 20,
    });
    const guestPlan = planMatchAudioStart(session, {
      estimatedServerOffsetMs: -80,
      localNowMonotonicMs: session.startAtServerMs! + 80 - 1_000,
      audioContextNowSec: 30,
    });
    expect(hostPlan.startAtServerMs).toBe(session.startAtServerMs);
    expect(guestPlan.startAtServerMs).toBe(session.startAtServerMs);
    expect(hostPlan.status).toBe("scheduled");
    expect(guestPlan.status).toBe("scheduled");
  });

  test("cancel/restart invalidates an old startRevision without moving gameplay content", () => {
    const { manifest } = createP41QaFixture();
    const first = createMatchStartSession({ manifest, startRevision: 10 });
    const staleAck = createLoadedAckForSession(first, manifest.participants[0].participantId);
    const cancelled = cancelMatchStart(first, "owner-restart");
    expect(applyLoadedAck(cancelled, staleAck)).toMatchObject({ accepted: false, reason: "session-cancelled" });

    const restarted = createMatchStartSession({ manifest, startRevision: 11 });
    expect(applyLoadedAck(restarted, staleAck)).toMatchObject({ accepted: false, reason: "wrong-start-revision" });
    expect(restarted.manifest).toBe(manifest);
  });

  test("preload/start metadata contains no judgement authority and latency does not alter deterministic gameplay", () => {
    const { manifest } = createP41QaFixture();
    const session = createMatchStartSession({ manifest, startRevision: 12 });
    expect(JSON.stringify(session)).not.toContain("judgement");
    expect(JSON.stringify(createLoadedAckForSession(session, manifest.participants[0].participantId))).not.toContain("judgement");

    const zeroLatency = simulateSharedStartClock({ manifest, latencyProfileMs: 0 });
    const highLatency = simulateSharedStartClock({ manifest, latencyProfileMs: 200 });
    const finishZero = describeSharedTurn(manifest, 38);
    const resumeHigh = describeSharedTurn(manifest, 43);

    expect(zeroLatency.startAtServerMs).toBe(highLatency.startAtServerMs);
    expect(manifest.gameplay.seed).toBe(123);
    expect(manifest.gameplay.finishRestTurns).toBe(4);
    expect(finishZero.isFinish).toBe(true);
    expect(resumeHigh.level).toBe(6);
    expect([...manifest.gameplay.sequenceCounts]).toEqual([...session.manifest.gameplay.sequenceCounts]);
  });
});
