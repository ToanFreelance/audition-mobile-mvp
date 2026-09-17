import {
  estimateServerClockOffset,
  type ClockSyncEstimate,
  type ClockSyncSample,
} from "./shared-clock";

type ServerClockResponse = {
  protocolVersion: 1;
  serverReceiveMs: number;
  serverSendMs: number;
};

function monotonicNowMs() {
  if (typeof performance === "undefined") throw new Error("performance.now() is unavailable.");
  return performance.now();
}

function assertServerClockResponse(value: unknown): asserts value is ServerClockResponse {
  if (!value || typeof value !== "object") throw new Error("Invalid server clock response.");
  const response = value as Partial<ServerClockResponse>;
  if (response.protocolVersion !== 1) throw new Error("Unsupported server clock protocol version.");
  if (!Number.isFinite(response.serverReceiveMs) || !Number.isFinite(response.serverSendMs)) {
    throw new Error("Server clock timestamps must be finite.");
  }
  if (Number(response.serverSendMs) < Number(response.serverReceiveMs)) {
    throw new Error("Server clock response has invalid timestamp order.");
  }
}

export async function sampleNetworkServerClock(endpoint = "/api/multiplayer/clock"): Promise<ClockSyncSample> {
  const clientSendMonotonicMs = monotonicNowMs();
  const response = await fetch(endpoint, {
    method: "POST",
    cache: "no-store",
    headers: { "Content-Type": "application/json" },
    body: "{}",
  });
  const clientReceiveMonotonicMs = monotonicNowMs();
  if (!response.ok) throw new Error(`Server clock request failed (${response.status}).`);
  const payload = await response.json() as unknown;
  assertServerClockResponse(payload);
  return {
    clientSendMonotonicMs,
    serverReceiveMs: payload.serverReceiveMs,
    serverSendMs: payload.serverSendMs,
    clientReceiveMonotonicMs,
  };
}

export async function estimateNetworkServerClock(input?: {
  endpoint?: string;
  sampleCount?: number;
  bestSampleCount?: number;
}): Promise<{ estimate: ClockSyncEstimate; samples: readonly ClockSyncSample[] }> {
  const sampleCount = input?.sampleCount ?? 5;
  if (!Number.isInteger(sampleCount) || sampleCount < 1 || sampleCount > 12) {
    throw new Error("sampleCount must be an integer between 1 and 12.");
  }
  const samples: ClockSyncSample[] = [];
  for (let index = 0; index < sampleCount; index += 1) {
    samples.push(await sampleNetworkServerClock(input?.endpoint));
  }
  return {
    estimate: estimateServerClockOffset(samples, input?.bestSampleCount ?? Math.min(3, sampleCount)),
    samples,
  };
}
