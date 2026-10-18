import { expect, test } from "@playwright/test";
import { DEFAULT_SOLO_SETTINGS } from "../game/solo-easy";
import {
  applyLobbyLoadedAck,
  beginLobbyPreload,
  markLobbyParticipantLoading,
  restoreRoomMatchStartSession,
} from "../multiplayer/lobby-start-handoff";
import { freezeLobbyMatch } from "../multiplayer/lobby-match-freeze";
import { allClientsLoaded, createLoadedAckForSession } from "../multiplayer/match-start-protocol";
import { retryPreloadCas as productionRetryPreloadCas } from "../multiplayer/preload-cas-retry";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import * as ts from "typescript";
import { addParticipant, canStartRoom, createRoomState } from "../multiplayer/room-state";
import { createP53SyncedWaitingRoomBase } from "../multiplayer/waiting-room-qa";
import type { HumanGuestParticipant, RoomSlotIndex, RoomState } from "../multiplayer/types";
import { RoomMetadataTransportError } from "../multiplayer/room-metadata-retry";

// QA can replay these regressions against the exact pre-fix helper without
// replacing the working tree. Only the baseline helper (type-only imports) is evaluated.
const selectedRetry: typeof productionRetryPreloadCas = process.env.PR18_PRELOAD_SOURCE
  ? runInNewContext(ts.transpileModule(readFileSync(process.env.PR18_PRELOAD_SOURCE, "utf8"), {
      compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
    }).outputText + "\nexports.retryPreloadCas;", { exports: {}, Error, Date, Math, setTimeout })
  : productionRetryPreloadCas;
const retryPreloadCas: typeof productionRetryPreloadCas = options => Promise.resolve(selectedRetry(options));

function fiveHumanPreload(): RoomState {
  const host = createP53SyncedWaitingRoomBase("preload-cas-five").participants[0];
  if (host.kind !== "human" || host.role !== "host") throw new Error("Missing fixture host");
  let room = createRoomState({
    roomId: "preload-cas-five", roomName: "CAS Five Human",
    host, maxPlayers: 5, modeId: "solo-easy-battle", selectedSongId: "aloha",
  });
  for (let index = 1; index < 5; index += 1) {
    const guest: HumanGuestParticipant = {
      ...host,
      participantId: `p-cas-${index}`,
      displayName: `Human ${index}`,
      role: "guest",
      readyState: "ready",
      slotIndex: index as RoomSlotIndex,
      loadState: "idle",
    };
    room = addParticipant(room, guest);
  }
  expect(room.participants).toHaveLength(5);
  expect(canStartRoom(room).allowed).toBe(true);
  const manifest = freezeLobbyMatch(room, room.hostParticipantId, {
    matchId: "preload-cas-match",
    audioVersion: "audio-v1", audioHash: "sha256:audio-v1",
    chartVersion: "chart-v1", chartHash: "sha256:chart-v1",
    characterRuntimeVersion: "character-v1",
    animationReleaseVersion: 3, animationReleaseHash: "sha256:animation-v3",
    gameplayConfigVersion: "solo-easy-locked-v1", gameplayConfigHash: "sha256:config",
    seed: 123, bpmExact: 101.0504, spaceStartMs: 10083,
    sequenceCounts: DEFAULT_SOLO_SETTINGS.sequenceCounts,
    commandLengths: DEFAULT_SOLO_SETTINGS.commandLengths,
    finishRestTurns: DEFAULT_SOLO_SETTINGS.finishRestTurns,
  });
  return beginLobbyPreload(room, room.hostParticipantId, manifest, 1).room;
}

function identity(room: RoomState) {
  const binding = room.matchStart;
  if (!binding) throw new Error("Missing frozen session");
  return {
    matchId: binding.matchId,
    roomRevision: binding.roomRevision,
    startRevision: binding.startRevision,
  };
}

test("5 Human concurrent loading/LOADED ACKs survive repeated canonical CAS collisions", async () => {
  let canonical = fiveHumanPreload();
  const frozen = identity(canonical);
  const ids = canonical.participants.map(participant => participant.participantId);
  const clients = new Map(ids.map(id => [id, canonical]));
  let conflicts = 0;
  let failures = 0;

  const runPhase = async (action: "preload-loading" | "loaded") => {
    await Promise.all(ids.map(async participantId => {
      const result = await retryPreloadCas({
        action, identity: frozen, participantId,
        readCurrent: () => clients.get(participantId)!,
        refreshCanonical: async () => canonical,
        cancelled: () => false,
        maxAttempts: 40,
        wait: async () => { await Promise.resolve(); },
        mutate: async snapshot => {
          // All five independent clients initially read the same revision.
          await Promise.resolve();
          if (snapshot.revision !== canonical.revision) {
            conflicts += 1;
            clients.set(participantId, canonical);
            return { snapshot: canonical, conflict: true };
          }
          if (action === "preload-loading") {
            canonical = markLobbyParticipantLoading(canonical, participantId, frozen).room;
          } else {
            const session = restoreRoomMatchStartSession(canonical.matchStart!, canonical.participants);
            const ack = createLoadedAckForSession(session, participantId);
            const loaded = applyLobbyLoadedAck(canonical, participantId, ack);
            if (!loaded.accepted) throw new Error(loaded.reason);
            canonical = loaded.room;
          }
          clients.set(participantId, canonical);
          return { snapshot: canonical, conflict: false };
        },
      });
      if (!result) failures += 1;
    }));
  };

  await runPhase("preload-loading");
  await runPhase("loaded");

  expect(conflicts).toBeGreaterThan(3); // Previous 3-attempt budget would strand a client.
  expect(failures).toBe(0);
  expect(canonical.participants.map(item => item.loadState)).toEqual([
    "loaded", "loaded", "loaded", "loaded", "loaded",
  ]);
  expect(allClientsLoaded(
    restoreRoomMatchStartSession(canonical.matchStart!, canonical.participants),
  )).toBe(true);
  expect(canonical.status).toBe("preloading");
  expect(canonical.matchStart?.startAtServerMs ?? null).toBeNull();
  expect(identity(canonical)).toEqual(frozen);
});

test("CAS exhaustion does not mark an asset FAILED; manual retry of same identity can succeed", async () => {
  let canonical = fiveHumanPreload();
  const frozen = identity(canonical);
  const participantId = canonical.hostParticipantId;
  let local = canonical;
  let attempts = 0;
  const run = (maxAttempts: number) => retryPreloadCas({
    action: "preload-loading",
    identity: frozen,
    participantId,
    readCurrent: () => local,
    refreshCanonical: async () => canonical,
    cancelled: () => false,
    maxAttempts,
    wait: async () => undefined,
    mutate: async snapshot => {
      attempts += 1;
      if (attempts <= 4) {
        // Another participant won the CAS between our read and write.
        canonical = { ...canonical, revision: canonical.revision + 1 };
        local = canonical;
        return { snapshot: canonical, conflict: true };
      }
      canonical = markLobbyParticipantLoading(canonical, participantId, frozen).room;
      local = canonical;
      return { snapshot: canonical, conflict: false };
    },
  });
  await expect(run(3)).rejects.toThrow("Preload CAS contention");
  expect(canonical.participants.find(item => item.participantId === participantId)?.loadState).toBe("idle");
  const result = await run(6);
  expect(result?.participants.find(item => item.participantId === participantId)?.loadState).toBe("loading");
  expect(attempts).toBeGreaterThan(4);
});

test("stale session and cancellation never send a preload mutation", async () => {
  const initial = fiveHumanPreload();
  let current = initial;
  let sent = 0;
  let cancelled = false;
  const options = {
    action: "loaded" as const,
    identity: identity(initial),
    participantId: initial.hostParticipantId,
    readCurrent: () => current,
    refreshCanonical: async () => current,
    cancelled: () => cancelled,
    wait: async () => undefined,
    mutate: async () => {
      sent += 1;
      return { snapshot: current, conflict: true };
    },
  };

  cancelled = true;
  expect(await retryPreloadCas(options)).toBeNull();
  cancelled = false;
  current = {
    ...initial,
    matchStart: { ...initial.matchStart!, matchId: "replacement-match" },
  };
  expect(await retryPreloadCas(options)).toBeNull();
  expect(sent).toBe(0);
});

for (const failure of ["timeout-before-execution", "committed-response-lost", "http-failure-revision-advanced"] as const) {
  test(`preload recovers ${failure} by canonical verification, not stale replay`, async () => {
    let server = fiveHumanPreload(), local = server;
    const frozen = identity(server), participantId = server.hostParticipantId;
    const events: string[] = [];
    let posts = 0;
    const result = await retryPreloadCas({
      action: "preload-loading", identity: frozen, participantId,
      readCurrent: () => local, cancelled: () => false, wait: async () => undefined,
      refreshCanonical: async () => { events.push("GET"); local = server; return server; },
      mutate: async snapshot => {
        events.push(`POST:${snapshot.revision}`); posts++;
        expect(snapshot.revision).toBe(server.revision);
        if (posts === 1) {
          if (failure === "committed-response-lost") server = markLobbyParticipantLoading(server, participantId, frozen).room;
          if (failure === "http-failure-revision-advanced") server = { ...server, revision: server.revision + 1 };
          throw failure === "timeout-before-execution" ? new DOMException("timeout", "AbortError") : new RoomMetadataTransportError("503/lost body");
        }
        server = markLobbyParticipantLoading(server, participantId, frozen).room;
        local = server;
        return { snapshot: server, conflict: false };
      },
    });
    expect(events[1]).toBe("GET");
    expect(posts).toBe(failure === "committed-response-lost" ? 1 : 2);
    expect(result?.participants[0].loadState).toBe("loading");
    expect(identity(server)).toEqual(frozen);
    expect(server.matchStart?.startAtServerMs ?? null).toBeNull();
  });
}

test("already LOADED and duplicate retry issue no mutation, even after reconnect", async () => {
  let current = fiveHumanPreload();
  const frozen = identity(current), participantId = current.hostParticipantId;
  const ack = createLoadedAckForSession(restoreRoomMatchStartSession(current.matchStart!, current.participants), participantId);
  current = applyLobbyLoadedAck(current, participantId, ack).room;
  let posts = 0;
  const options = { action: "loaded" as const, identity: frozen, participantId,
    readCurrent: () => current, refreshCanonical: async () => current, cancelled: () => false,
    mutate: async () => { posts++; return { snapshot: current, conflict: false }; } };
  expect(await retryPreloadCas(options)).toEqual(current);
  expect(await retryPreloadCas(options)).toEqual(current);
  expect(posts).toBe(0);
});

for (const change of ["match", "participant", "room"] as const) {
  test(`uncertain preload stops when ${change} changes during recovery`, async () => {
    let current = fiveHumanPreload();
    const frozen = identity(current), participantId = current.hostParticipantId;
    let posts = 0;
    const result = await retryPreloadCas({
      action: "loaded", identity: frozen, participantId, readCurrent: () => current,
      cancelled: () => false, wait: async () => undefined,
      refreshCanonical: async () => {
        current = { ...current, revision: current.revision + 1,
          ...(change === "match" ? { matchStart: { ...current.matchStart!, matchId: "new-match" } } : {}),
          ...(change === "participant" ? { participants: current.participants.slice(1) } : {}),
          ...(change === "room" ? { roomId: "other-room" } : {}) };
        return current;
      },
      mutate: async () => { posts++; throw new TypeError("offline"); },
    });
    expect(result).toBeNull(); expect(posts).toBe(1);
  });
}

test("transport exhaustion is bounded; same frozen manual retry reuses readiness", async () => {
  let current = fiveHumanPreload(), time = 0, offline = true, gets = 0, posts = 0;
  const frozen = identity(current), participantId = current.hostParticipantId;
  const readiness = createLoadedAckForSession(restoreRoomMatchStartSession(current.matchStart!, current.participants), participantId);
  const run = () => retryPreloadCas({
    action: "loaded", identity: frozen, participantId, readCurrent: () => current,
    cancelled: () => false, maxDurationMs: 100, now: () => time,
    wait: async ms => { time += ms; },
    refreshCanonical: async () => { gets++; return current; },
    mutate: async (snapshot, timeout) => {
      posts++; expect(timeout).toBeLessThanOrEqual(100);
      if (offline) throw new TypeError("offline");
      current = applyLobbyLoadedAck(snapshot, participantId, readiness).room;
      return { snapshot: current, conflict: false };
    },
  });
  await expect(run()).rejects.toThrow("retry exhausted");
  expect(time).toBe(100); expect(posts).toBe(1); expect(gets).toBe(0);
  expect(current.participants.every(p => p.loadState !== "failed")).toBe(true);
  offline = false;
  expect((await run())?.participants[0].loadState).toBe("loaded");
  expect(identity(current)).toEqual(frozen);
});

test("genuine content/domain rejection is not retried as metadata network failure", async () => {
  const current = fiveHumanPreload(); let posts = 0;
  await expect(retryPreloadCas({ action: "loaded", identity: identity(current), participantId: current.hostParticipantId,
    readCurrent: () => current, refreshCanonical: async () => current, cancelled: () => false,
    mutate: async () => { posts++; throw new Error("Frozen audio hash mismatch"); },
  })).rejects.toThrow("Frozen audio hash mismatch");
  expect(posts).toBe(1);
});
