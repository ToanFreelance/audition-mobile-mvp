export type ClockSyncSample = {
  /** performance.now()-style monotonic timestamp before the request leaves the client. */
  clientSendMonotonicMs: number;
  /** Server clock timestamp when the request arrives. */
  serverReceiveMs: number;
  /** Server clock timestamp immediately before the reply leaves. */
  serverSendMs: number;
  /** Client monotonic timestamp when the reply arrives. */
  clientReceiveMonotonicMs: number;
};

export type ClockSyncSampleMetrics = {
  roundTripMs: number;
  offsetMs: number;
};

export type ClockSyncEstimate = {
  offsetMs: number;
  sampleCount: number;
  selectedSampleCount: number;
  minRoundTripMs: number;
  maxSelectedRoundTripMs: number;
  selectedOffsetsMs: readonly number[];
};

export type SharedStartPlan = {
  startAtServerMs: number;
  localStartMonotonicMs: number;
  audioContextStartTimeSec: number;
  leadTimeMs: number;
  lateByMs: number;
  status: "scheduled" | "late";
};

export const P42_QA_DRIFT_GOOD_MS = 20;
export const P42_QA_DRIFT_WARNING_MS = 50;

function finite(value: number, name: string) {
  if (!Number.isFinite(value)) throw new Error(`${name} must be finite.`);
}

export function measureClockSyncSample(sample: ClockSyncSample): ClockSyncSampleMetrics {
  finite(sample.clientSendMonotonicMs, "clientSendMonotonicMs");
  finite(sample.serverReceiveMs, "serverReceiveMs");
  finite(sample.serverSendMs, "serverSendMs");
  finite(sample.clientReceiveMonotonicMs, "clientReceiveMonotonicMs");
  if (sample.clientReceiveMonotonicMs < sample.clientSendMonotonicMs) {
    throw new Error("Client receive time cannot precede client send time.");
  }
  if (sample.serverSendMs < sample.serverReceiveMs) {
    throw new Error("Server send time cannot precede server receive time.");
  }

  // NTP-style four-timestamp estimate. Server processing time is removed from
  // RTT; network asymmetry remains the bounded source of offset error.
  const roundTripMs = Math.max(0,
    (sample.clientReceiveMonotonicMs - sample.clientSendMonotonicMs)
      - (sample.serverSendMs - sample.serverReceiveMs));
  const offsetMs = (
    (sample.serverReceiveMs - sample.clientSendMonotonicMs)
      + (sample.serverSendMs - sample.clientReceiveMonotonicMs)
  ) / 2;
  return { roundTripMs, offsetMs };
}

function median(values: readonly number[]) {
  if (!values.length) throw new Error("Cannot calculate median of an empty list.");
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1
    ? sorted[middle]
    : (sorted[middle - 1] + sorted[middle]) / 2;
}

export function estimateServerClockOffset(
  samples: readonly ClockSyncSample[],
  bestSampleCount = 3,
): ClockSyncEstimate {
  if (!samples.length) throw new Error("At least one clock-sync sample is required.");
  if (!Number.isInteger(bestSampleCount) || bestSampleCount < 1) {
    throw new Error("bestSampleCount must be a positive integer.");
  }

  const measured = samples
    .map(sample => measureClockSyncSample(sample))
    .sort((a, b) => a.roundTripMs - b.roundTripMs);
  const selected = measured.slice(0, Math.min(bestSampleCount, measured.length));
  const offsets = selected.map(sample => sample.offsetMs);

  return {
    offsetMs: median(offsets),
    sampleCount: measured.length,
    selectedSampleCount: selected.length,
    minRoundTripMs: measured[0].roundTripMs,
    maxSelectedRoundTripMs: selected[selected.length - 1].roundTripMs,
    selectedOffsetsMs: offsets,
  };
}

/** Map a local monotonic timestamp onto the shared server clock. */
export function estimateServerNowMs(localMonotonicMs: number, offsetMs: number) {
  finite(localMonotonicMs, "localMonotonicMs");
  finite(offsetMs, "offsetMs");
  return localMonotonicMs + offsetMs;
}

/**
 * Map one immutable server start epoch onto the local AudioContext timeline.
 * The epoch is never moved to accommodate one slow client. A late client is
 * reported as late so the room-start protocol can decide what to do in P4.4.
 */
export function planSharedAudioStart(input: {
  startAtServerMs: number;
  estimatedServerOffsetMs: number;
  localNowMonotonicMs: number;
  audioContextNowSec: number;
}): SharedStartPlan {
  finite(input.startAtServerMs, "startAtServerMs");
  finite(input.estimatedServerOffsetMs, "estimatedServerOffsetMs");
  finite(input.localNowMonotonicMs, "localNowMonotonicMs");
  finite(input.audioContextNowSec, "audioContextNowSec");

  const localStartMonotonicMs = input.startAtServerMs - input.estimatedServerOffsetMs;
  const leadTimeMs = localStartMonotonicMs - input.localNowMonotonicMs;
  const lateByMs = Math.max(0, -leadTimeMs);

  return {
    startAtServerMs: input.startAtServerMs,
    localStartMonotonicMs,
    audioContextStartTimeSec: input.audioContextNowSec + Math.max(0, leadTimeMs) / 1000,
    leadTimeMs,
    lateByMs,
    status: leadTimeMs >= 0 ? "scheduled" : "late",
  };
}

/** Shared room/song position derived from the server epoch, never from player state. */
export function sharedSongTimeMs(serverNowMs: number, startAtServerMs: number) {
  finite(serverNowMs, "serverNowMs");
  finite(startAtServerMs, "startAtServerMs");
  return Math.max(0, serverNowMs - startAtServerMs);
}

/** Positive drift means the local WebAudio song position is ahead of the room reference. */
export function measureSongDriftMs(localWebAudioSongTimeMs: number, roomSongTimeMs: number) {
  finite(localWebAudioSongTimeMs, "localWebAudioSongTimeMs");
  finite(roomSongTimeMs, "roomSongTimeMs");
  return localWebAudioSongTimeMs - roomSongTimeMs;
}

/** QA-only bands. P4.2 observes drift; it does not seek/stretch live audio. */
export function classifyP42Drift(driftMs: number): "good" | "warning" | "fail" {
  finite(driftMs, "driftMs");
  const absolute = Math.abs(driftMs);
  if (absolute <= P42_QA_DRIFT_GOOD_MS) return "good";
  if (absolute <= P42_QA_DRIFT_WARNING_MS) return "warning";
  return "fail";
}
