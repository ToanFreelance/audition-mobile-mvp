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
import { retryPreloadCas } from "../multiplayer/preload-cas-retry";
import { addParticipant, canStartRoom, createRoomState } from "../multiplayer/room-state";
import { createP53SyncedWaitingRoomBase } from "../multiplayer/waiting-room-qa";
import type { HumanGuestParticipant, RoomSlotIndex, RoomState } from "../multiplayer/types";

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
