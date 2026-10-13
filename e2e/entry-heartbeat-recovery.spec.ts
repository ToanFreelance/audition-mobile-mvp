import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { expect, test } from "@playwright/test";
import * as ts from "typescript";

// Run the real EntryFlow WAITING heartbeat effect with controlled HTTP,
// canonical snapshots and lifecycle events. These are deterministic contracts,
// NOT real-Supabase or five-Human integration tests.
const source = readFileSync("components/multiplayer/WaitingRoomPanel.tsx", "utf8");
const marker = source.indexOf("  // Liveness is server-owned metadata");
const begin = source.indexOf("  useEffect(() => {", marker);
const end = source.indexOf("\n  const leaveRoom =", begin);
if (marker < 0 || begin < 0 || end <= begin) {
  throw new Error("EntryFlow heartbeat effect not found in production source.");
}
const effect = ts.transpileModule(source.slice(begin, end), {
  compilerOptions: { target: ts.ScriptTarget.ES2022 },
}).outputText;

type Options = {
  host?: boolean;
  active?: boolean;
  canonicalStatus?: "waiting" | "preloading";
  removed?: boolean;
  stale?: boolean;
  failFirstRead?: boolean;
  delayedRead?: boolean;
  readyGuest?: boolean;
};
const flush = async () => {
  for (let i = 0; i < 50; i++) await Promise.resolve();
};

function scenario(options: Options = {}) {
  const local = {
    roomId: "mvp-heartbeat-contract", revision: 9, status: "waiting",
    hostParticipantId: options.host ? "local" : "host",
    participants: [{ participantId: "local", kind: "human" }],
  };
  const canonical = {
    ...local,
    revision: options.stale ? 8 : 15,
    status: options.canonicalStatus ?? "preloading",
    participants: options.removed ? []
      : options.readyGuest ? [
          ...local.participants,
          { participantId: "guest", kind: "human", readyState: "ready" },
        ] : local.participants,
  };
  const events: string[] = [];
  let interval: (() => void) | null = null;
  let cleanup: (() => void) | undefined;
  let completeRead: ((room: typeof canonical) => void) | null = null;
  let readCount = 0;
  const roomRef = { current: local };
  const env: Record<string, unknown> = {
    initialSync: { entryFlow: true },
    syncOptions: { roomId: local.roomId, participantId: "local" },
    room: local, roomRef, leftRoom: false, leaveIntentPending: false,
    document: {
      visibilityState: "visible",
      addEventListener: () => {}, removeEventListener: () => {},
    },
    window: {
      setInterval: (cb: () => void) => { interval = cb; return 1; },
      clearInterval: () => {},
      addEventListener: () => {}, removeEventListener: () => {},
    },
    fetch: async (_path: string, request: { body: string }) => {
      const action = (JSON.parse(request.body) as { action: string }).action;
      events.push(action);
      return {
        ok: true,
        json: async () => action === "heartbeat"
          ? { ok: true, active: options.active ?? false }
          : {
              ok: true, transferred: true,
              snapshot: { ...canonical, revision: canonical.revision + 1, hostParticipantId: "local" },
            },
      };
    },
    fetchRoomSnapshot: async () => {
      events.push("canonical");
      if (options.failFirstRead && readCount++ === 0) throw new Error("GET timed out");
      if (options.delayedRead) return new Promise(resolve => {
        completeRead = resolve as (room: typeof canonical) => void;
      });
      return canonical;
    },
    adoptServerSnapshot: (room: typeof canonical) => {
      events.push("adopt:" + room.status);
      roomRef.current = room as typeof local;
    },
    setSyncDetail: (message: string) => { events.push("detail:" + message); },
    isCanonicalRoomSnapshot: () => true,
    transportRef: {
      current: { status: "connected", send: async () => { events.push("send-revision"); } },
    },
    useEffect: (fn: () => (() => void) | undefined) => { cleanup = fn(); },
  };
  return {
    events, roomRef,
    mount: async () => { runInNewContext(effect, env); await flush(); },
    tick: async () => { interval?.(); await flush(); },
    unmount: () => cleanup?.(),
    completeRead: async () => { completeRead?.(canonical); await flush(); },
  };
}

test("missed START hint: inactive Guest heartbeat adopts canonical PRELOADING", async () => {
  const h = scenario();
  await h.mount();
  expect(h.events).toContain("adopt:preloading");
  expect(h.events).not.toContain("recover-host");
  expect(h.events.some(event => event.startsWith("detail:"))).toBe(false);
  expect(h.roomRef.current.status).toBe("preloading");
  h.unmount();
});

test("missed START hint: inactive Host also reconciles PRELOADING", async () => {
  const h = scenario({ host: true });
  await h.mount();
  expect(h.events).toContain("adopt:preloading");
  expect(h.events).not.toContain("recover-host");
  h.unmount();
});

test("inactive heartbeat only reports removal after canonical membership check", async () => {
  const h = scenario({ canonicalStatus: "waiting", removed: true });
  await h.mount();
  expect(h.events).toContain("canonical");
  expect(h.events.some(event => event.includes("không còn trong phòng"))).toBe(true);
  expect(h.events).not.toContain("recover-host");
  h.unmount();
});

test("transient GET failure does not eject member; next heartbeat reconciles", async () => {
  const h = scenario({ failFirstRead: true });
  await h.mount();
  expect(h.events).not.toContain("adopt:preloading");
  expect(h.events.some(event => event.startsWith("detail:"))).toBe(false);
  await h.tick();
  expect(h.events).toContain("adopt:preloading");
  h.unmount();
});

test("stale canonical response cannot remove a newer local member", async () => {
  const h = scenario({ canonicalStatus: "waiting", removed: true, stale: true });
  await h.mount();
  expect(h.events).not.toContain("adopt:waiting");
  expect(h.events.some(event => event.startsWith("detail:"))).toBe(false);
  expect(h.events).not.toContain("recover-host");
  h.unmount();
});

test("active waiting Guest still uses server-only Host recovery", async () => {
  const h = scenario({ canonicalStatus: "waiting", active: true });
  await h.mount();
  expect(h.events).toContain("recover-host");
  expect(h.events).toContain("send-revision");
  h.unmount();
});

test("active Host fetches newer canonical JOIN/READY despite missed revision hint", async () => {
  const h = scenario({ canonicalStatus: "waiting", active: true, host: true, readyGuest: true });
  await h.mount();
  expect(h.events).toContain("canonical");
  expect(h.events).toContain("adopt:waiting");
  expect(h.roomRef.current.revision).toBe(15);
  expect(h.roomRef.current.participants.some(p => p.participantId === "guest" && "readyState" in p && p.readyState === "ready")).toBe(true);
  expect(h.events).not.toContain("recover-host");
  h.unmount();
});

test("unmount before canonical response cannot adopt stale room", async () => {
  const h = scenario({ delayedRead: true });
  await h.mount();
  expect(h.events).toContain("canonical");
  h.unmount();
  await h.completeRead();
  expect(h.events.some(event => event.startsWith("adopt:"))).toBe(false);
});

test("pending GET serializes heartbeat checks instead of spawning duplicates", async () => {
  const h = scenario({ delayedRead: true });
  await h.mount();
  await h.tick();
  expect(h.events.filter(event => event === "canonical")).toHaveLength(1);
  h.unmount();
  await h.completeRead();
});
