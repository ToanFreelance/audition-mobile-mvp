import { expect, test } from "@playwright/test";
import { DEFAULT_SOLO_SETTINGS } from "../game/solo-easy";
import {
  beginLobbyPreload,
  restoreRoomMatchStartSession,
} from "../multiplayer/lobby-start-handoff";
import {
  freezeLobbyMatch,
  type LobbyMatchFreezeInput,
} from "../multiplayer/lobby-match-freeze";
import {
  addParticipant,
  changeStage,
  setGuestReady,
} from "../multiplayer/room-state";
import {
  createP53QaGuestParticipant,
  createP53SyncedWaitingRoomBase,
} from "../multiplayer/waiting-room-qa";

function freezeInput(): LobbyMatchFreezeInput {
  return {
    matchId: "p52-match",
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

function readyRoom(roomId: string) {
  let room = addParticipant(
    createP53SyncedWaitingRoomBase(roomId),
    createP53QaGuestParticipant(),
  );
  room = setGuestReady(room, "p51-guest", true);
  return room;
}

test("P5.2 host freezes one manifest and persists one P4.4 preloading session", () => {
  const waiting = readyRoom("p52-handoff");
  const manifest = freezeLobbyMatch(
    waiting,
    waiting.hostParticipantId,
    freezeInput(),
  );

  const transition = beginLobbyPreload(
    waiting,
    waiting.hostParticipantId,
    manifest,
    1,
  );

  expect(transition.room.status).toBe("preloading");
  expect(transition.room.revision).toBe(waiting.revision + 1);
  expect(transition.room.matchStart).toBeTruthy();
  expect(transition.room.matchStart?.matchId).toBe(manifest.matchId);
  expect(transition.room.matchStart?.roomRevision).toBe(waiting.revision);
  expect(transition.room.matchStart?.startRevision).toBe(1);
  expect(transition.session.phase).toBe("preloading");
  expect(transition.session.startAtServerMs).toBeNull();
  expect(transition.session.participants.every(item => item.state === "idle")).toBe(true);

  const restored = restoreRoomMatchStartSession(transition.room.matchStart!);
  expect(restored.matchId).toBe(transition.session.matchId);
  expect(restored.roomRevision).toBe(transition.session.roomRevision);
  expect(restored.startRevision).toBe(transition.session.startRevision);
  expect(restored.manifest).toBe(transition.room.matchStart!.manifest);
});

test("P5.2 guest cannot create the start session and double Start cannot replace it", () => {
  const waiting = readyRoom("p52-host-only");
  const manifest = freezeLobbyMatch(
    waiting,
    waiting.hostParticipantId,
    freezeInput(),
  );

  expect(() => beginLobbyPreload(waiting, "p51-guest", manifest, 1))
    .toThrow("Only the room host can create a start session");

  const first = beginLobbyPreload(
    waiting,
    waiting.hostParticipantId,
    manifest,
    1,
  );
  expect(() => beginLobbyPreload(
    first.room,
    first.room.hostParticipantId,
    manifest,
    2,
  )).toThrow();
});

test("P5.2 stale MatchManifest cannot hand off after room config changes", () => {
  const waiting = readyRoom("p52-stale");
  const manifest = freezeLobbyMatch(
    waiting,
    waiting.hostParticipantId,
    freezeInput(),
  );
  const changed = changeStage(waiting, waiting.hostParticipantId, "purple-hall");

  expect(() => beginLobbyPreload(
    changed,
    changed.hostParticipantId,
    manifest,
    1,
  )).toThrow("MatchManifest does not match the authoritative waiting room");
});
