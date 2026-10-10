import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { expect, test } from "@playwright/test";
import * as ts from "typescript";

// Exercise the actual production useEffect, rather than a reimplementation.
// The Work QA report reproduced D01 with exactly this effect extracted from
// WaitingRoomPanel.tsx: Realtime connecting→connected discarded sampling but
// retained its attempt latch; refresh PLAYING never reached LATE handling.
const source = readFileSync("components/multiplayer/WaitingRoomPanel.tsx", "utf8");
const d01 = source.indexOf("// D01: an NTP sample belongs");
const start = source.indexOf("  useEffect(() => {", d01);
const end = source.indexOf("  useEffect(() => {", start + 15);
if (d01 < 0 || start < 0 || end < 0) {
  throw new Error("Unable to extract the production D01 clock sampling effect.");
}
const actualClockEffect = ts.transpileModule(source.slice(start, end), {
  compilerOptions: { target: ts.ScriptTarget.ES2022 },
}).outputText;

type Sample = { offsetMs: number; minRoundTripMs: number };
type Pending = {
  resolve: (sample: Sample) => void;
  reject: (error: Error) => void;
};

function createEffectHarness() {
  const requests: Pending[] = [];
  const binding = { matchId: "qa-match", roomRevision: 7, startRevision: 1 };
  const room = {
    status: "playing",
    matchStart: binding,
    participants: [{ participantId: "qa-guest", kind: "human" }],
  };
  const env = {
    syncOptions: { participantId: "qa-guest" },
    matchStartSession: binding,
    matchStartSessionKey: "qa-match:7:1:qa-guest",
    allParticipantsLoaded: true,
    room,
    roomRef: { current: room },
    syncStatus: "connecting",
    clockSyncState: null as null | { sessionKey: string; estimate: Sample },
    countdownAttemptRef: { current: null as string | null },
    syncDetail: "",
    setSyncDetail(value: string) { env.syncDetail = value; },
    setClockSyncState(value: { sessionKey: string; estimate: Sample }) {
      env.clockSyncState = value;
    },
    sampleLobbyServerClock: () => new Promise<Sample>((resolve, reject) => {
      requests.push({ resolve, reject });
    }),
    runServerMutation: () => {
      throw Error("PLAYING refresh must not issue another countdown epoch.");
    },
    // Only retry backoff is accelerated. Sampling remains a deferred promise.
    window: { setTimeout(callback: () => void) {
      queueMicrotask(callback);
      return 1;
    } },
  };
  let previousDeps: readonly unknown[] | null = null;
  let cleanup: (() => void) | undefined;
  const useEffect = (
    callback: () => void | (() => void),
    deps: readonly unknown[],
  ) => {
    if (previousDeps && deps.length === previousDeps.length
      && deps.every((value, i) => Object.is(value, previousDeps![i]))) return;
    cleanup?.();
    previousDeps = [...deps];
    cleanup = callback() || undefined;
  };
  const render = () => runInNewContext(actualClockEffect, { ...env, useEffect });
  const unmount = () => cleanup?.();
  return { env, requests, render, unmount };
}

const flush = async () => {
  for (let i = 0; i < 12; i += 1) await Promise.resolve();
};

test.describe("D01 production clock-sampling effect", () => {
  test("Realtime connecting→connected and clock state rerenders retain the same in-flight sample", async () => {
    const h = createEffectHarness();
    h.render();
    expect(h.requests).toHaveLength(1);
    const identity = h.env.countdownAttemptRef.current;

    h.env.syncStatus = "connected";
    h.render();
    expect(h.requests).toHaveLength(1);
    expect(h.env.countdownAttemptRef.current).toBe(identity);

    h.requests[0].resolve({ offsetMs: 48, minRoundTripMs: 11 });
    await flush();
    expect(h.env.clockSyncState?.sessionKey).toBe(identity);
    expect(h.env.clockSyncState?.estimate.offsetMs).toBe(48);
    expect(h.env.syncDetail).toContain("PLAYING synced");

    h.render(); // React rerenders after setClockSyncState.
    expect(h.requests).toHaveLength(1);
    h.unmount();
  });

  test("failed clock sample retries within the same immutable session", async () => {
    const h = createEffectHarness();
    h.render();
    h.requests[0].reject(Error("Network clock request temporarily failed"));
    await flush();
    expect(h.requests).toHaveLength(2);
    h.requests[1].resolve({ offsetMs: 60, minRoundTripMs: 20 });
    await flush();
    expect(h.env.clockSyncState?.estimate.offsetMs).toBe(60);
    expect(h.requests).toHaveLength(2);
    h.unmount();
  });

  test("true match identity change releases latch and rejects stale sample completion", async () => {
    const h = createEffectHarness();
    h.render();
    expect(h.requests).toHaveLength(1);
    h.env.matchStartSession = { matchId: "qa-match-next", roomRevision: 8, startRevision: 2 };
    h.env.matchStartSessionKey = "qa-match-next:8:2:qa-guest";
    h.render();
    expect(h.requests).toHaveLength(2);
    expect(h.env.countdownAttemptRef.current).toBe(h.env.matchStartSessionKey);

    h.requests[0].resolve({ offsetMs: 999, minRoundTripMs: 5 });
    await flush();
    expect(h.env.clockSyncState).toBeNull();
    h.requests[1].resolve({ offsetMs: 73, minRoundTripMs: 9 });
    await flush();
    expect(h.env.clockSyncState?.sessionKey).toBe("qa-match-next:8:2:qa-guest");
    expect(h.env.clockSyncState?.estimate.offsetMs).toBe(73);
    h.unmount();
    expect(h.env.countdownAttemptRef.current).toBeNull();
  });
});
