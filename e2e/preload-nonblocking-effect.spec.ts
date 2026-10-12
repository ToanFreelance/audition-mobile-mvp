import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { expect, test } from "@playwright/test";
import * as ts from "typescript";

// Execute the actual WaitingRoomPanel preload effect, not a duplicate
// implementation. The old effect stalls these tests waiting for LOADING.
const panelSource = readFileSync(
  "components/multiplayer/WaitingRoomPanel.tsx", "utf8",
);
const begin = panelSource.indexOf(
  '  useEffect(() => {\n    if (!syncOptions || room.status !== "preloading"',
);
const end = panelSource.indexOf("  // D01:", begin);
if (begin < 0 || end <= begin) throw new Error("Production preload effect not found");
const effect = ts.transpileModule(panelSource.slice(begin, end), {
  compilerOptions: { target: ts.ScriptTarget.ES2022 },
}).outputText;

type Scenario = {
  events: string[];
  roomRef: { current: any };
  preloadReadinessRef: { current: any };
  preloadAttemptRef: { current: string | null };
  contentFailure: () => any;
  casFailure: () => any;
  assetCalls: () => number;
  mount: () => void;
  unmount: () => void;
};

const flush = async () => {
  for (let i = 0; i < 60; i++) await Promise.resolve();
};

function scenario(options: {
  asset?: () => Promise<{ characterReadiness: string }>;
  failLoadedOnce?: boolean;
} = {}): Scenario {
  const identity = { matchId: "frozen-match", roomRevision: 4, startRevision: 1 };
  const participant = {
    participantId: "frozen-human", displayName: "QA Host",
    kind: "human", role: "host", loadState: "idle",
  };
  const roomRef = { current: {
    roomId: "mvp-preload-effect-qa", revision: 5, status: "preloading",
    matchStart: { ...identity }, participants: [participant],
  } };
  const preloadAttemptRef = { current: null as string | null };
  const preloadReadinessRef = { current: null as any };
  const events: string[] = [];
  let assetCalls = 0;
  let contentFailure: any = null;
  let casFailure: any = null;
  let clean: (() => void) | null = null;
  let rejectLoadedOnce = Boolean(options.failLoadedOnce);

  const env: Record<string, unknown> = {
    syncOptions: { roomId: roomRef.current.roomId, participantId: participant.participantId },
    room: roomRef.current,
    roomRef,
    matchStartSession: { ...identity, manifest: { matchId: identity.matchId } },
    preloadAttemptRef, preloadReadinessRef, preloadRetryNonce: 0,
    retryPreloadCas: async ({ action }: { action: string }) => {
      events.push(action);
      // A status-only LOADING request can hang indefinitely without blocking
      // resource readiness or the authoritative LOADED acknowledgement.
      if (action === "preload-loading") return new Promise(() => {});
      if (action === "loaded" && rejectLoadedOnce) {
        rejectLoadedOnce = false;
        throw new Error("LOADED metadata timed out");
      }
      if (action === "loaded") {
        roomRef.current = {
          ...roomRef.current, revision: roomRef.current.revision + 1,
          participants: [{ ...roomRef.current.participants[0], loadState: "loaded" }],
        };
      }
      return roomRef.current;
    },
    preloadFrozenLobbyMatch: async () => {
      events.push("asset-start");
      assetCalls += 1;
      return options.asset ? options.asset() : { characterReadiness: "ready" };
    },
    restoreRoomMatchStartSession: () => ({
      ...identity, participants: roomRef.current.participants,
    }),
    createLoadedAckForSession: () => ({ participantId: participant.participantId }),
    allClientsLoaded: () => true,
    setPreloadContentFailure: (next: any) => {
      contentFailure = typeof next === "function" ? next(contentFailure) : next;
    },
    setPreloadCasFailure: (next: any) => {
      casFailure = typeof next === "function" ? next(casFailure) : next;
    },
    setSyncDetail: () => {},
    fetchRoomSnapshot: () => { throw new Error("Unexpected canonical fetch"); },
    adoptServerSnapshot: () => {},
    runServerMutation: () => { throw new Error("Unexpected direct room mutation"); },
    useEffect: (fn: () => () => void) => { clean = fn(); },
  };

  return {
    events, roomRef, preloadReadinessRef, preloadAttemptRef,
    contentFailure: () => contentFailure, casFailure: () => casFailure,
    assetCalls: () => assetCalls,
    mount: () => { runInNewContext(effect, env); },
    unmount: () => { if (clean) clean(); },
  };
}

test("stalled LOADING metadata does not prevent actual content preload and LOADED", async () => {
  const h = scenario();
  h.mount();
  await flush();
  expect(h.events).toEqual(["preload-loading", "asset-start", "loaded"]);
  expect(h.roomRef.current.participants[0].loadState).toBe("loaded");
  expect(h.assetCalls()).toBe(1);
  expect(h.casFailure()).toBeNull();
  h.unmount();
});

test("LOADED remains gated by genuine asset readiness, not by LOADING status", async () => {
  let complete!: (value: { characterReadiness: string }) => void;
  const readiness = new Promise<{ characterReadiness: string }>(resolve => { complete = resolve; });
  const h = scenario({ asset: () => readiness });
  h.mount();
  await flush();
  expect(h.events).toEqual(["preload-loading", "asset-start"]);
  expect(h.events).not.toContain("loaded");
  complete({ characterReadiness: "ready" });
  await flush();
  expect(h.events).toContain("loaded");
  h.unmount();
});

test("real content failure remains visible and reports preload-failed despite LOADING stall", async () => {
  const h = scenario({ asset: () => Promise.reject(new Error("Frozen asset 503")) });
  h.mount();
  await flush();
  expect(h.events).toEqual(["preload-loading", "asset-start", "preload-failed"]);
  expect(h.events).not.toContain("loaded");
  expect(h.contentFailure()?.message).toContain("Frozen asset 503");
  h.unmount();
});

test("manual metadata retry after LOADED timeout reuses already prepared assets", async () => {
  const h = scenario({ failLoadedOnce: true });
  h.mount();
  await flush();
  expect(h.events).toEqual(["preload-loading", "asset-start", "loaded"]);
  expect(h.casFailure()?.message).toContain("LOADED metadata timed out");
  expect(h.preloadReadinessRef.current).not.toBeNull();
  h.unmount();
  h.mount();
  await flush();
  expect(h.assetCalls()).toBe(1);
  expect(h.events.filter(event => event === "loaded")).toHaveLength(2);
  expect(h.roomRef.current.participants[0].loadState).toBe("loaded");
  expect(h.casFailure()).toBeNull();
  h.unmount();
});
