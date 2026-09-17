import { expect, test } from "@playwright/test";
import { createP41QaFixture } from "../multiplayer/simulated-room";
import { simulateSharedStartClock } from "../multiplayer/clock-sync-simulation";
import {
  estimateServerClockOffset,
  estimateServerNowMs,
  measureClockSyncSample,
  measureSongDriftMs,
  planSharedAudioStart,
  sharedSongTimeMs,
} from "../multiplayer/shared-clock";

test("NTP-style clock sample removes server processing time", () => {
  const metrics = measureClockSyncSample({
    clientSendMonotonicMs: 1_000,
    serverReceiveMs: 1_160,
    serverSendMs: 1_165,
    clientReceiveMonotonicMs: 1_105,
  });

  expect(metrics.roundTripMs).toBe(100);
  expect(metrics.offsetMs).toBeCloseTo(110, 8);
});

test("impossible negative network RTT samples are rejected instead of winning best-sample selection", () => {
  expect(() => measureClockSyncSample({
    clientSendMonotonicMs: 1_000,
    serverReceiveMs: 1_100,
    serverSendMs: 1_200,
    clientReceiveMonotonicMs: 1_050,
  })).toThrow("Clock-sync sample has impossible negative network RTT");
});

test("asymmetric one-way latency exposes the expected bounded offset bias", () => {
  const outboundHeavy = measureClockSyncSample({
    clientSendMonotonicMs: 1_000,
    serverReceiveMs: 1_210,
    serverSendMs: 1_215,
    clientReceiveMonotonicMs: 1_105,
  });
  const inboundHeavy = measureClockSyncSample({
    clientSendMonotonicMs: 1_000,
    serverReceiveMs: 1_130,
    serverSendMs: 1_135,
    clientReceiveMonotonicMs: 1_105,
  });

  expect(outboundHeavy.roundTripMs).toBe(100);
  expect(inboundHeavy.roundTripMs).toBe(100);
  expect(outboundHeavy.offsetMs).toBe(160); // true offset 120ms + 40ms path asymmetry bias
  expect(inboundHeavy.offsetMs).toBe(80); // true offset 120ms - 40ms path asymmetry bias
});

test("offset estimator prefers low-RTT samples and uses their median", () => {
  const estimate = estimateServerClockOffset([
    { clientSendMonotonicMs: 0, serverReceiveMs: 160, serverSendMs: 162, clientReceiveMonotonicMs: 102 },
    { clientSendMonotonicMs: 1_000, serverReceiveMs: 1_151, serverSendMs: 1_153, clientReceiveMonotonicMs: 1_102 },
    { clientSendMonotonicMs: 2_000, serverReceiveMs: 2_155, serverSendMs: 2_157, clientReceiveMonotonicMs: 2_102 },
    // Deliberately bad/high RTT outlier; it should not control the estimate.
    { clientSendMonotonicMs: 3_000, serverReceiveMs: 3_500, serverSendMs: 3_502, clientReceiveMonotonicMs: 3_402 },
  ]);

  expect(estimate.selectedSampleCount).toBe(3);
  expect(estimate.maxSelectedRoundTripMs).toBe(100);
  expect(estimate.offsetMs).toBeCloseTo(105, 8);
});

test("one immutable server epoch maps to a future AudioContext start without moving the epoch", () => {
  const plan = planSharedAudioStart({
    startAtServerMs: 50_000,
    estimatedServerOffsetMs: 120,
    localNowMonotonicMs: 45_000,
    audioContextNowSec: 10,
  });

  expect(plan.startAtServerMs).toBe(50_000);
  expect(plan.localStartMonotonicMs).toBe(49_880);
  expect(plan.leadTimeMs).toBe(4_880);
  expect(plan.audioContextStartTimeSec).toBeCloseTo(14.88, 8);
  expect(plan.status).toBe("scheduled");
});

test("late client is reported late instead of shifting the room start epoch", () => {
  const plan = planSharedAudioStart({
    startAtServerMs: 50_000,
    estimatedServerOffsetMs: 120,
    localNowMonotonicMs: 50_250,
    audioContextNowSec: 10,
  });

  expect(plan.startAtServerMs).toBe(50_000);
  expect(plan.status).toBe("late");
  expect(plan.lateByMs).toBe(370);
  expect(plan.audioContextStartTimeSec).toBe(10);
});

test("server-time mapping and drift measurement are pure observations", () => {
  expect(estimateServerNowMs(9_900, 100)).toBe(10_000);
  expect(sharedSongTimeMs(12_500, 10_000)).toBe(2_500);
  expect(measureSongDriftMs(2_507, 2_500)).toBe(7);
});

for (const latencyProfileMs of [0, 50, 100, 200]) {
  test(`1 human + 5 bots share the same start epoch under simulated ${latencyProfileMs}ms RTT`, () => {
    const fixture = createP41QaFixture();
    const result = simulateSharedStartClock({ manifest: fixture.manifest, latencyProfileMs });

    expect(result.clients).toHaveLength(6);
    expect(result.startMappingPass).toBe(true);
    expect(result.maxAbsoluteDriftMs).toBeLessThanOrEqual(20);
    expect(result.clients.every(client => client.scheduleStatus === "scheduled")).toBe(true);
    expect(new Set(result.clients.map(() => result.startAtServerMs)).size).toBe(1);
  });
}

test("network latency never mutates match seed, Finish cadence, or global gameplay timeline", () => {
  const fixture = createP41QaFixture();
  const baselineSeed = fixture.manifest.gameplay.seed;
  const baselineRest = fixture.manifest.gameplay.finishRestTurns;

  for (const latencyProfileMs of [0, 50, 100, 200]) {
    const result = simulateSharedStartClock({ manifest: fixture.manifest, latencyProfileMs });
    expect(result.startMappingPass).toBe(true);
    expect(fixture.manifest.gameplay.seed).toBe(baselineSeed);
    expect(fixture.manifest.gameplay.finishRestTurns).toBe(baselineRest);
  }
});
