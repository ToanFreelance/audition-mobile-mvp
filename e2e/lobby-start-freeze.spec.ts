import { expect, test } from "@playwright/test";
import { DEFAULT_SOLO_SETTINGS } from "../game/solo-easy";
import {
  freezeLobbyMatch,
  matchManifestMatchesRoom,
  type LobbyMatchFreezeInput,
} from "../multiplayer/lobby-match-freeze";
import { addParticipant, setGuestReady } from "../multiplayer/room-state";
import { selectLobbyMusicConfig } from "../multiplayer/lobby-song-config";
import type { MusicConfig } from "../game/music-config";
import {
  createP53QaGuestParticipant,
  createP53SyncedWaitingRoomBase,
} from "../multiplayer/waiting-room-qa";

function freezeInput(): LobbyMatchFreezeInput {
  return {
    matchId: "lobby-freeze-match",
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

test("lobby Start gate refuses a non-ready guest", () => {
  const room = addParticipant(
    createP53SyncedWaitingRoomBase("freeze-not-ready"),
    createP53QaGuestParticipant(),
  );

  expect(() => freezeLobbyMatch(room, room.hostParticipantId, freezeInput()))
    .toThrow("Room cannot start: participants-not-ready");
});

test("only host can freeze an eligible room into an immutable MatchManifest", () => {
  let room = addParticipant(
    createP53SyncedWaitingRoomBase("freeze-host-only"),
    createP53QaGuestParticipant(),
  );
  room = setGuestReady(room, "p51-guest", true);

  expect(() => freezeLobbyMatch(room, "p51-guest", freezeInput()))
    .toThrow("Only the room host can freeze a match");

  const manifest = freezeLobbyMatch(room, room.hostParticipantId, freezeInput());

  expect(manifest.roomRevision).toBe(room.revision);
  expect(manifest.content.songId).toBe(room.selectedSongId);
  expect(manifest.gameplay.modeId).toBe(room.modeId);
  expect(manifest.gameplay.seed).toBe(123);
  expect(manifest.participants.map(item => item.participantId)).toEqual(
    room.participants.map(item => item.participantId),
  );
  expect(Object.isFrozen(manifest)).toBe(true);
  expect(matchManifestMatchesRoom(manifest, room)).toBe(true);
});

test("a later RoomState revision makes the frozen manifest stale", () => {
  let room = addParticipant(
    createP53SyncedWaitingRoomBase("freeze-stale"),
    createP53QaGuestParticipant(),
  );
  room = setGuestReady(room, "p51-guest", true);
  const manifest = freezeLobbyMatch(room, room.hostParticipantId, freezeInput());

  room = setGuestReady(room, "p51-guest", false);

  expect(room.revision).toBeGreaterThan(manifest.roomRevision);
  expect(matchManifestMatchesRoom(manifest, room)).toBe(false);
});


test("lobby song slug resolves to the authored UUID-backed chart", () => {
  const aloha = {
    id: "61cb27d6-ce3d-4cdc-b15f-cec4932d063e",
    title: "aloha",
  } as MusicConfig;
  const pleaseTellMeWhy = {
    id: "8799f421-2729-46f0-a145-5b2e67ad32c1",
    title: "please-tell-me-why-80bpm",
  } as MusicConfig;

  expect(selectLobbyMusicConfig([aloha, pleaseTellMeWhy], "aloha")).toBe(aloha);
  expect(selectLobbyMusicConfig([aloha, pleaseTellMeWhy], "please-tell-me-why"))
    .toBe(pleaseTellMeWhy);
});
