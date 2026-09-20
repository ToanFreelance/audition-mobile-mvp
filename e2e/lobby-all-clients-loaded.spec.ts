import { expect, test } from "@playwright/test";
import { DEFAULT_SOLO_SETTINGS } from "../game/solo-easy";
import {
  applyLobbyLoadedAck,
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
} from "../multiplayer/match-start-protocol";
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
