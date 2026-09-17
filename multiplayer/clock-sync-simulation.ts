import type { MatchManifest } from "./types";
import {
  classifyP42Drift,
  estimateServerClockOffset,
  measureSongDriftMs,
  planSharedAudioStart,
  sharedSongTimeMs,
  type ClockSyncSample,
} from "./shared-clock";

export type ClockSimulationClient = {
  participantId: string;
  displayName: string;
  simulatedRttMs: number;
  trueServerOffsetMs: number;
  estimatedServerOffsetMs: number;
  offsetErrorMs: number;
  minRoundTripMs: number;
  scheduleLeadMs: number;
  scheduleStatus: "scheduled" | "late";
  expectedSongDriftMs: number;
  driftBand: "good" | "warning" | "fail";
};

export type SharedClockSimulation = {
  startAtServerMs: number;
  inspectedAtServerMs: number;
  latencyProfileMs: number;
  roomSongTimeMs: number;
  maxAbsoluteDriftMs: number;
  startMappingPass: boolean;
  clients: readonly ClockSimulationClient[];
};

const TRUE_OFFSETS_MS = [120, -75, 33, -145, 210, -18] as const;
const OUT_JITTER = [0, 3, -2, 5, -1] as const;
const IN_JITTER = [0, -2, 3, -4, 1] as const;

function buildSamples(input: {
  trueOffsetMs: number;
  baseRttMs: number;
  participantIndex: number;
}): ClockSyncSample[] {
  const oneWay = input.baseRttMs / 2;
  const scale = input.baseRttMs === 0 ? 0 : Math.max(1, input.baseRttMs / 100);
  const samples: ClockSyncSample[] = [];

  for (let sampleIndex = 0; sampleIndex < 5; sampleIndex += 1) {
    const participantSkew = (input.participantIndex % 3) - 1;
    const outboundMs = Math.max(0,
      oneWay + (OUT_JITTER[sampleIndex] + participantSkew) * scale);
    const inboundMs = Math.max(0,
      oneWay + (IN_JITTER[sampleIndex] - participantSkew) * scale);
    const serverProcessingMs = 2 + (sampleIndex % 2);
    const clientSendMonotonicMs = 10_000 + sampleIndex * 1_000;
    const serverReceiveMs = clientSendMonotonicMs + outboundMs + input.trueOffsetMs;
    const serverSendMs = serverReceiveMs + serverProcessingMs;
    const clientReceiveMonotonicMs = clientSendMonotonicMs
      + outboundMs + serverProcessingMs + inboundMs;

    samples.push({
      clientSendMonotonicMs,
      serverReceiveMs,
      serverSendMs,
      clientReceiveMonotonicMs,
    });
  }

  return samples;
}

/**
 * Deterministic P4.2 QA simulation. The server epoch is identical for every
 * participant; only the observed network RTT and local/server clock offset vary.
 */
export function simulateSharedStartClock(input: {
  manifest: MatchManifest;
  latencyProfileMs: number;
}): SharedClockSimulation {
  if (!Number.isFinite(input.latencyProfileMs) || input.latencyProfileMs < 0) {
    throw new Error("latencyProfileMs must be a non-negative finite number.");
  }

  const startAtServerMs = 1_000_000;
  const prepareAtServerMs = startAtServerMs - 5_000;
  const inspectedAtServerMs = startAtServerMs + 12_000;
  const roomSongTime = sharedSongTimeMs(inspectedAtServerMs, startAtServerMs);

  const clients = input.manifest.participants.map((participant, index): ClockSimulationClient => {
    const trueServerOffsetMs = TRUE_OFFSETS_MS[index % TRUE_OFFSETS_MS.length];
    const samples = buildSamples({
      trueOffsetMs: trueServerOffsetMs,
      baseRttMs: input.latencyProfileMs,
      participantIndex: index,
    });
    const estimate = estimateServerClockOffset(samples);
    const localPrepareNowMs = prepareAtServerMs - trueServerOffsetMs;
    const plan = planSharedAudioStart({
      startAtServerMs,
      estimatedServerOffsetMs: estimate.offsetMs,
      localNowMonotonicMs: localPrepareNowMs,
      audioContextNowSec: 50 + index,
    });

    // If the AudioBuffer starts at the planned local monotonic instant, its
    // song position differs from the room reference only by offset-estimation
    // error. This is what P4.2 observes; no active playback correction occurs.
    const localInspectNowMs = inspectedAtServerMs - trueServerOffsetMs;
    const plannedLocalStartMs = startAtServerMs - estimate.offsetMs;
    const localWebAudioSongTimeMs = Math.max(0, localInspectNowMs - plannedLocalStartMs);
    const expectedSongDriftMs = measureSongDriftMs(localWebAudioSongTimeMs, roomSongTime);

    return {
      participantId: participant.participantId,
      displayName: participant.displayName,
      simulatedRttMs: input.latencyProfileMs,
      trueServerOffsetMs,
      estimatedServerOffsetMs: estimate.offsetMs,
      offsetErrorMs: estimate.offsetMs - trueServerOffsetMs,
      minRoundTripMs: estimate.minRoundTripMs,
      scheduleLeadMs: plan.leadTimeMs,
      scheduleStatus: plan.status,
      expectedSongDriftMs,
      driftBand: classifyP42Drift(expectedSongDriftMs),
    };
  });

  const maxAbsoluteDriftMs = Math.max(...clients.map(client => Math.abs(client.expectedSongDriftMs)), 0);
  const startMappingPass = clients.every(client =>
    client.scheduleStatus === "scheduled" && client.driftBand !== "fail");

  return {
    startAtServerMs,
    inspectedAtServerMs,
    latencyProfileMs: input.latencyProfileMs,
    roomSongTimeMs: roomSongTime,
    maxAbsoluteDriftMs,
    startMappingPass,
    clients,
  };
}
