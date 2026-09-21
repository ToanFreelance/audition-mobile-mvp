import { expect, test } from "@playwright/test";
import { DEFAULT_SOLO_SETTINGS } from "../game/solo-easy";
import {
  applyLobbyLoadedAck,
  beginLobbyCountdown,
  beginLobbyPreload,
  markLobbyParticipantLoading,
  restoreRoomMatchStartSession,
} from "../multiplayer/lobby-start-handoff";
import {
  freezeLobbyMatch,
  type LobbyMatchFreezeInput,
} from "../multiplayer/lobby-match-freeze";
import {
  allClientsLoaded,
  createLoadedAckForSession,
  deriveSharedCountdown,
} from "../multiplayer/match-start-protocol";
import { isCanonicalRoomSnapshot } from "../multiplayer/room-sync";
import { addParticipant, setGuestReady } from "../multiplayer/room-state";
import {
  createP53QaGuestParticipant,
  createP53SyncedWaitingRoomBase,
} from "../multiplayer/waiting-room-qa";

function freezeInput(): LobbyMatchFreezeInput {
  return {
    matchId: "p53-match",
    audioVersion: "audio-v1",
    audioHash: "sha256:audio-v1",
    chartVersion: "chart-v1",
    chartHash: "sha256:chart-v1",
    characterRuntimeVersion: "character-v1",
    animationReleaseVersion: 3,
    animationReleaseHash: "sha256:animation-v3",
    gameplayConfigVersion: "solo-easy-locked-v1",
    gameplayConfigHash: "sha256:solo-easy-locked-v1",
    seed: 123,
    bpmExact: 101.0504,
    spaceStartMs: 10083,
    sequenceCounts: DEFAULT_SOLO_SETTINGS.sequenceCounts,
    commandLengths: DEFAULT_SOLO_SETTINGS.commandLengths,
    finishRestTurns: DEFAULT_SOLO_SETTINGS.finishRestTurns,
  };
}

function startRoom() {
  let waiting = addParticipant(
    createP53SyncedWaitingRoomBase("p53-loaded"),
    createP53QaGuestParticipant(),
  );
  waiting = setGuestReady(waiting, "p51-guest", true);
  const manifest = freezeLobbyMatch(waiting, waiting.hostParticipantId, freezeInput());
  return beginLobbyPreload(waiting, waiting.hostParticipantId, manifest, 1).room;
}

function identity(room: ReturnType<typeof startRoom>) {
  if (!room.matchStart) throw new Error("missing matchStart");
  return {
    matchId: room.matchStart.matchId,
    roomRevision: room.matchStart.roomRevision,
    startRevision: room.matchStart.startRevision,
  };
}

test.describe("P5.3 all clients loaded", () => {
  test("Host and Guest load independently before the exact session becomes all-loaded", () => {
    let room = startRoom();
    const frozenRoomRevision = room.matchStart!.roomRevision;
    let session = restoreRoomMatchStartSession(room.matchStart!, room.participants);

    expect(session.phase).toBe("preloading");
    expect(session.startAtServerMs).toBeNull();
    expect(session.participants.map(item => [item.participantId, item.state])).toEqual([
      ["p51-host", "idle"],
      ["p51-bot", "loaded"],
      ["p51-guest", "idle"],
    ]);
    expect(allClientsLoaded(session)).toBe(false);

    room = markLobbyParticipantLoading(room, "p51-host", identity(room)).room;
    expect(room.revision).toBeGreaterThan(frozenRoomRevision + 1);
    expect(room.matchStart!.roomRevision).toBe(frozenRoomRevision);
    session = restoreRoomMatchStartSession(room.matchStart!, room.participants);
    expect(session.participants.find(item => item.participantId === "p51-host")?.state).toBe("loading");

    const hostAck = createLoadedAckForSession(session, "p51-host");
    const hostLoaded = applyLobbyLoadedAck(room, "p51-host", hostAck);
    expect(hostLoaded.accepted).toBe(true);
    if (!hostLoaded.accepted) throw new Error(hostLoaded.reason);
    room = hostLoaded.room;
    expect(hostLoaded.allLoaded).toBe(false);
    expect(room.participants.find(item => item.participantId === "p51-host")?.loadState).toBe("loaded");
    expect(room.participants.find(item => item.participantId === "p51-guest")?.loadState).toBe("idle");

    room = markLobbyParticipantLoading(room, "p51-guest", identity(room)).room;
    session = restoreRoomMatchStartSession(room.matchStart!, room.participants);
    const guestAck = createLoadedAckForSession(session, "p51-guest");
    const guestLoaded = applyLobbyLoadedAck(room, "p51-guest", guestAck);
    expect(guestLoaded.accepted).toBe(true);
    if (!guestLoaded.accepted) throw new Error(guestLoaded.reason);

    expect(guestLoaded.allLoaded).toBe(true);
    expect(allClientsLoaded(guestLoaded.session)).toBe(true);
    expect(guestLoaded.session.phase).toBe("preloading");
    expect(guestLoaded.session.startAtServerMs).toBeNull();
    expect(guestLoaded.room.status).toBe("preloading");
    expect(guestLoaded.room.matchStart!.roomRevision).toBe(frozenRoomRevision);
  });

  test("loading and LOADED ACKs are exact-session scoped; duplicate LOADED is idempotent", () => {
    let room = startRoom();
    const exact = identity(room);

    expect(() => markLobbyParticipantLoading(room, "p51-host", {
      ...exact,
      startRevision: exact.startRevision + 1,
    })).toThrow("Preload identity does not match");

    expect(() => markLobbyParticipantLoading(room, "p51-host", {
      ...exact,
      roomRevision: exact.roomRevision - 1,
    })).toThrow("Preload identity does not match");

    room = markLobbyParticipantLoading(room, "p51-host", exact).room;
    let session = restoreRoomMatchStartSession(room.matchStart!, room.participants);
    const valid = createLoadedAckForSession(session, "p51-host");

    expect(applyLobbyLoadedAck(room, "p51-host", {
      ...valid,
      startRevision: valid.startRevision + 1,
    })).toMatchObject({ accepted: false, reason: "wrong-start-revision" });

    expect(applyLobbyLoadedAck(room, "p51-host", {
      ...valid,
      matchId: "old-match",
    })).toMatchObject({ accepted: false, reason: "wrong-match" });

    expect(applyLobbyLoadedAck(room, "p51-guest", valid))
      .toMatchObject({ accepted: false, reason: "sender-mismatch" });

    const first = applyLobbyLoadedAck(room, "p51-host", valid);
    expect(first.accepted).toBe(true);
    if (!first.accepted) throw new Error(first.reason);
    const revisionAfterFirstAck = first.room.revision;

    session = restoreRoomMatchStartSession(first.room.matchStart!, first.room.participants);
    const duplicate = applyLobbyLoadedAck(
      first.room,
      "p51-host",
      createLoadedAckForSession(session, "p51-host"),
    );
    expect(duplicate.accepted).toBe(true);
    if (!duplicate.accepted) throw new Error(duplicate.reason);
    expect(duplicate.duplicate).toBe(true);
    expect(duplicate.room.revision).toBe(revisionAfterFirstAck);
  });

  test("canonical RoomState restores accepted load state after reload without countdown authority", () => {
    let room = startRoom();
    room = markLobbyParticipantLoading(room, "p51-host", identity(room)).room;
    const loadingSession = restoreRoomMatchStartSession(room.matchStart!, room.participants);
    const loaded = applyLobbyLoadedAck(
      room,
      "p51-host",
      createLoadedAckForSession(loadingSession, "p51-host"),
    );
    expect(loaded.accepted).toBe(true);
    if (!loaded.accepted) throw new Error(loaded.reason);

    const canonicalSnapshot = structuredClone(loaded.room);
    const reloaded = restoreRoomMatchStartSession(
      canonicalSnapshot.matchStart!,
      canonicalSnapshot.participants,
    );

    expect(reloaded.participants.find(item => item.participantId === "p51-host")?.state).toBe("loaded");
    expect(reloaded.participants.find(item => item.participantId === "p51-guest")?.state).toBe("idle");
    expect(reloaded.phase).toBe("preloading");
    expect(reloaded.startAtServerMs).toBeNull();
    expect(JSON.stringify(canonicalSnapshot)).not.toContain("startAtServerMs");
  });
});

test.describe("P5.4 shared countdown", () => {
  function loadAllHumanParticipants() {
    let room = startRoom();

    for (const participantId of ["p51-host", "p51-guest"] as const) {
      room = markLobbyParticipantLoading(room, participantId, identity(room)).room;
      const session = restoreRoomMatchStartSession(room.matchStart!, room.participants);
      const loaded = applyLobbyLoadedAck(
        room,
        participantId,
        createLoadedAckForSession(session, participantId),
      );
      expect(loaded.accepted).toBe(true);
      if (!loaded.accepted) throw new Error(loaded.reason);
      room = loaded.room;
    }

    expect(allClientsLoaded(restoreRoomMatchStartSession(room.matchStart!, room.participants))).toBe(true);
    return room;
  }

  test("ALL CLIENTS LOADED issues one canonical future epoch and restores countdown after reload", () => {
    const loadedRoom = loadAllHumanParticipants();
    const revisionBeforeCountdown = loadedRoom.revision;

    const transition = beginLobbyCountdown(
      loadedRoom,
      "p51-host",
      identity(loadedRoom),
      1_000_000.25,
    );

    expect(transition.room.revision).toBe(revisionBeforeCountdown + 1);
    expect(transition.room.status).toBe("countdown");
    expect(transition.room.matchStart?.phase).toBe("countdown");
    expect(transition.room.matchStart?.startAtServerMs).toBe(1_004_501);
    expect(transition.room.matchStart?.roomRevision).toBe(loadedRoom.matchStart?.roomRevision);
    expect(isCanonicalRoomSnapshot(transition.room)).toBe(true);

    const restored = restoreRoomMatchStartSession(
      transition.room.matchStart!,
      transition.room.participants,
    );
    expect(restored.phase).toBe("countdown");
    expect(restored.startAtServerMs).toBe(1_004_501);
    expect(allClientsLoaded(restored)).toBe(true);

    const bindingOnlyRestore = restoreRoomMatchStartSession(transition.room.matchStart!);
    expect(bindingOnlyRestore.phase).toBe("countdown");
    expect(bindingOnlyRestore.startAtServerMs).toBe(restored.startAtServerMs);

    expect(deriveSharedCountdown(restored.startAtServerMs!, restored.startAtServerMs! - 2_900).label).toBe(3);
    expect(deriveSharedCountdown(restored.startAtServerMs!, restored.startAtServerMs! - 1_900).label).toBe(2);
    expect(deriveSharedCountdown(restored.startAtServerMs!, restored.startAtServerMs! - 900).label).toBe(1);
    expect(deriveSharedCountdown(restored.startAtServerMs!, restored.startAtServerMs!).label).toBe("GO");

    const serialized = JSON.stringify(transition.room);
    expect(serialized).not.toContain("audioContext");
    expect(serialized).not.toContain("audioContextStartTimeSec");
    expect(serialized).not.toContain("gameplayNavigation");
  });

  test("countdown rejects premature, stale-session and non-participant requests", () => {
    const notLoaded = startRoom();
    expect(() => beginLobbyCountdown(
      notLoaded,
      "p51-host",
      identity(notLoaded),
      2_000_000,
    )).toThrow("ALL CLIENTS LOADED");

    const loadedRoom = loadAllHumanParticipants();
    const exact = identity(loadedRoom);

    expect(() => beginLobbyCountdown(
      loadedRoom,
      "p51-host",
      { ...exact, startRevision: exact.startRevision + 1 },
      2_000_000,
    )).toThrow("Preload identity does not match");

    expect(() => beginLobbyCountdown(
      loadedRoom,
      "intruder",
      exact,
      2_000_000,
    )).toThrow("frozen human participant");
  });
});

