import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { expect, test } from "@playwright/test";
import * as ts from "typescript";
import { addParticipant, canStartRoom } from "../multiplayer/room-state";
import { createP53SyncedWaitingRoomBase } from "../multiplayer/waiting-room-qa";
import { retryReadyCas } from "../multiplayer/ready-cas-retry";

// As in D01, execute the production effect/handlers, not a parallel implementation.
// Optional baseline path lets QA demonstrate failure against the previous source.
const source = readFileSync(process.env.PR18_PANEL_SOURCE ?? "components/multiplayer/WaitingRoomPanel.tsx", "utf8");
const marker = source.indexOf("let transport: SupabaseRealtimeRoomTransport | null");
const begin = source.lastIndexOf("  useEffect(() => {", marker);
const end = source.indexOf("  const displayRoom =", marker);
if (begin < 0 || end < begin) throw Error("Production sync effect not found");
const compile = (code: string) => ts.transpileModule(code, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
const effect = compile(source.slice(begin, end));
const gateBegin = source.indexOf("  const startGate =");
const gateEnd = source.indexOf("  const participantById", gateBegin);
const gate = compile(`${source.slice(gateBegin, gateEnd)}\nstartGate;`);
const flush = async () => { for (let i = 0; i < 60; i++) await Promise.resolve(); };

function harness() {
  const base = createP53SyncedWaitingRoomBase("sync-recovery");
  const host = base.participants[0];
  if (host.kind !== "human") throw Error("Missing fixture host");
  let canonical = addParticipant(base, { ...host, participantId: "guest", slotIndex: 1, role: "guest", readyState: "not-ready" });
  const listeners = new Map<string, Set<() => void>>(), timers = new Map<number, () => void>();
  let timer = 0, cleanup: (() => void) | undefined;
  const target = { visibilityState: "visible", addEventListener(name: string, f: () => void) { if (!listeners.has(name)) listeners.set(name, new Set()); listeners.get(name)!.add(f); }, removeEventListener(name: string, f: () => void) { listeners.get(name)?.delete(f); } };
  const transports: FakeTransport[] = [];
  const controls = { configFail: false, readFail: false, connectFail: false, reads: 0, configs: 0 };
  class FakeTransport {
    status = "disconnected"; connects = 0; disconnects = 0;
    statusListener: any; presenceListener: any; eventListener: any;
    constructor() { transports.push(this); }
    onStatus(f: any) { this.statusListener = f; return () => { this.statusListener = null; }; }
    onPresence(f: any) { this.presenceListener = f; return () => { this.presenceListener = null; }; }
    onEvent(f: any) { this.eventListener = f; return () => { this.eventListener = null; }; }
    async connect() { this.connects++; if (controls.connectFail) throw Error("WS connect failed"); this.status = "connected"; this.statusListener?.("connected"); }
    disconnect() { this.disconnects++; this.status = "disconnected"; this.statusListener?.("disconnected"); }
  }
  const env: any = {
    syncOptions: { roomId: base.roomId, participantId: host.participantId, role: "host" },
    initialSync: { entryFlow: true }, room: base, displayRoom: base, roomRef: { current: base },
    transportRef: { current: null }, recoverRoomSyncRef: { current: null }, readyAttemptRef: { current: null },
    canonicalSyncRef: { current: null }, canonicalSync: null, syncStatus: "idle", readyPending: false,
    setCanonicalHealth(value: any) { env.canonicalSyncRef.current = value; env.canonicalSync = value; },
    setRoom(value: any) { env.room = value; }, setSyncStatus(value: string) { env.syncStatus = value; },
    setReadyIntentPending(value: boolean) { env.readyPending = value; }, setReadyFailure() {},
    setSyncDetail() {}, setPresentParticipantIds() {}, setViewMode() {}, setStagePage() {}, setSelectedParticipantId() {},
    setSyncOptions(update: any) { env.syncOptions = update(env.syncOptions); },
    fetch: async () => { controls.configs++; if (controls.configFail) throw Error("config offline"); return { ok: true, json: async () => ({}) }; },
    fetchRoomSnapshot: async () => { controls.reads++; if (controls.readFail) throw new DOMException("read timed out", "AbortError"); return canonical; },
    isCanonicalRoomSnapshot: () => true,
    applyServerRoomSnapshot: (_room: any, _sender: any, payload: any) => ({ accepted: true, room: payload.snapshot }),
    latchLobbyPresence: (_a: any, b: any) => b,
    SupabaseRealtimeRoomTransport: FakeTransport,
    AbortController, Error, DOMException,
    window: { ...target, setTimeout: (f: () => void) => { timers.set(++timer, f); return timer; }, clearTimeout: (id: number) => timers.delete(id) },
    document: target,
    setTimeout: (f: () => void) => { timers.set(++timer, f); return timer; }, clearTimeout: (id: number) => timers.delete(id),
    useEffect: (f: () => () => void) => { cleanup = f(); },
  };
  return {
    env, controls, listeners, timers, transports,
    mount() { runInNewContext(effect, env); }, unmount() { cleanup?.(); },
    update(value: typeof canonical) { canonical = value; }, canonical: () => canonical,
    event(name: string) { for (const f of listeners.get(name) ?? []) f(); },
    retryTimer() { const pending = [...timers.values()]; timers.clear(); pending.forEach(f => f()); },
    gate() {
      const key = `${env.syncOptions.roomId}:${env.syncOptions.participantId}:${env.syncOptions.role}`;
      const canonicalVerified = env.canonicalSync?.key === key && env.canonicalSync.state === "verified" && env.syncStatus === "connected";
      return runInNewContext(gate, { ...env, canonicalVerified, canStartRoom, useMemo: (f: any) => f() });
    },
  };
}

test("initial failure locks cached Host START and keeps focus/manual recovery registered", async () => {
  const h = harness(); h.controls.configFail = true; h.mount(); await flush();
  expect(h.gate().allowed).toBe(false);
  expect(h.listeners.get("focus")?.size).toBe(1);
  expect(typeof h.env.recoverRoomSyncRef.current).toBe("function");
  h.controls.configFail = false; h.event("focus"); await flush();
  expect(h.env.canonicalSync?.state).toBe("verified");
  expect(h.transports).toHaveLength(1); h.unmount();
});

test("canonical unready Guest cannot disappear from START gate through cached/presence presentation", async () => {
  const h = harness(); h.mount(); await flush();
  expect(h.env.displayRoom.participants.some((p: any) => p.participantId === "guest")).toBe(false);
  expect(h.env.room.participants.some((p: any) => p.participantId === "guest")).toBe(true);
  expect(h.gate().allowed).toBe(false); h.unmount();
});

test("canonical refresh timeout disables START; explicit refresh recovers without another socket", async () => {
  const h = harness(); h.update({ ...h.canonical(), participants: h.canonical().participants.map(p => p.role === "guest" ? { ...p, readyState: "ready" } : p) });
  h.mount(); await flush(); expect(h.gate().allowed).toBe(true);
  h.controls.readFail = true; h.event("focus"); await flush();
  expect(h.gate().allowed).toBe(false); expect(h.env.canonicalSync?.state).toBe("error");
  h.controls.readFail = false; await h.env.recoverRoomSyncRef.current(); await flush();
  expect(h.gate().allowed).toBe(true); expect(h.transports).toHaveLength(1); expect(h.transports[0].connects).toBe(1); h.unmount();
});

test("initial attempts are bounded and manual recovery remains usable", async () => {
  const h = harness(); h.controls.configFail = true; h.mount(); await flush();
  h.retryTimer(); await flush(); h.retryTimer(); await flush(); h.retryTimer(); await flush();
  expect(h.controls.configs).toBe(3); expect(h.timers.size).toBe(0);
  h.controls.configFail = false; await h.env.recoverRoomSyncRef.current();
  expect(h.env.canonicalSync?.state).toBe("verified"); h.unmount();
});

test("repeated focus/online deduplicates refresh and cleans up every listener", async () => {
  const h = harness(); h.mount(); await flush(); const before = h.controls.reads;
  for (let i = 0; i < 10; i++) { h.event("focus"); h.event("online"); }
  await flush(); expect(h.controls.reads - before).toBe(1);
  expect(h.transports).toHaveLength(1); expect(h.transports[0].connects).toBe(1);
  h.unmount(); expect([...h.listeners.values()].every(s => s.size === 0)).toBe(true);
  expect(h.env.transportRef.current).toBeNull(); expect(h.env.recoverRoomSyncRef.current).toBeNull();
  expect(h.transports[0].statusListener).toBeNull(); expect(h.timers.size).toBe(0);
});

test("disconnected browser reconnects once, reusing the transport", async () => {
  const h = harness(); h.mount(); await flush(); h.transports[0].disconnect();
  expect(h.gate().allowed).toBe(false); h.event("online"); h.event("focus"); await flush();
  expect(h.env.canonicalSync?.state).toBe("verified"); expect(h.transports).toHaveLength(1); expect(h.transports[0].connects).toBe(2); h.unmount();
});

test("Host transfer invalidates old session health until role rebind is verified", async () => {
  const h = harness(); h.mount(); await flush();
  const next = { ...h.canonical(), revision: h.canonical().revision + 1, hostParticipantId: "guest",
    participants: h.canonical().participants.map(p => ({ ...p, role: p.participantId === "guest" ? "host" : "guest" })) };
  h.transports[0].eventListener({ senderParticipantId: "server", payload: { kind: "server-room-snapshot", snapshot: next } });
  expect(h.env.syncOptions.role).toBe("guest"); expect(h.gate().allowed).toBe(false); h.unmount();
});

test("unrelated canonical broadcast cannot release an in-flight READY tap latch", async () => {
  const h = harness(); h.mount(); await flush(); const attempt = {};
  h.env.readyAttemptRef.current = attempt; h.env.readyPending = true;
  h.transports[0].eventListener({ senderParticipantId: "server", payload: { kind: "server-room-snapshot", snapshot: { ...h.canonical(), revision: 10 } } });
  expect(h.env.readyPending).toBe(true); expect(h.env.readyAttemptRef.current).toBe(attempt); h.unmount();
});

test("production READY handler ignores repeated taps and preserves pending desired state", async () => {
  const start = source.indexOf("  const requestReady =");
  expect(start, "desired-state handler missing on old implementation").toBeGreaterThan(0);
  const finish = source.indexOf("  const toggleReady =", start);
  const h = harness(); const current = h.canonical(); let posts = 0, resolve: any;
  Object.assign(h.env, { syncOptions: { roomId: current.roomId, participantId: "guest", role: "guest" }, roomRef: { current }, leftRoom: false,
    retryReadyCas, setActionNotice() {}, adoptServerSnapshot(value: any) { h.env.roomRef.current = value; },
    runServerMutation: (payload: any) => { posts++; expect(payload.ready).toBe(true); return new Promise(r => { resolve = r; }); },
  });
  runInNewContext(compile(`${source.slice(start, finish)}\nrequestReady(true); requestReady(false);`), h.env);
  expect(posts).toBe(1); expect(h.env.readyPending).toBe(true);
  resolve({ snapshot: { ...current, revision: current.revision + 1, participants: current.participants.map(p => p.participantId === "guest" ? { ...p, readyState: "ready" } : p) }, conflict: false });
  await flush(); expect(h.env.readyPending).toBe(false); expect(h.env.readyAttemptRef.current).toBeNull(); expect(posts).toBe(1);
});
