import { expect, test } from "@playwright/test";
import { DEFAULT_SOLO_SETTINGS } from "../game/solo-easy";
import { createMatchManifest } from "../multiplayer/match-manifest";
import {
  addParticipant,
  canStartRoom,
  changeMode,
  changeSong,
  closeSlot,
  createRoomState,
  setGuestReady,
} from "../multiplayer/room-state";
import type {
  AvatarSnapshot,
  BotParticipant,
  HumanGuestParticipant,
  HumanHostParticipant,
} from "../multiplayer/types";

const avatar: AvatarSnapshot = { characterId: "qa", outfit: {}, accessoryIds: [] };

function host(): HumanHostParticipant {
  return {
    participantId: "host",
    displayName: "Host",
    kind: "human",
    role: "host",
    slotIndex: 0,
    readyState: "not-applicable",
    loadState: "loaded",
    connectionState: "connected",
    avatar,
  };
}

function guest(readyState: "ready" | "not-ready" = "not-ready"): HumanGuestParticipant {
  return {
    participantId: "guest",
    displayName: "Guest",
    kind: "human",
    role: "guest",
    slotIndex: 1,
    readyState,
    loadState: "loaded",
    connectionState: "connected",
    avatar,
  };
}

function bot(slotIndex: 1 | 2 | 3 | 4 | 5 = 1): BotParticipant {
  return {
    participantId: `bot-${slotIndex}`,
    displayName: `Bot ${slotIndex}`,
    kind: "bot",
    role: "guest",
    slotIndex,
    readyState: "ready",
    loadState: "loaded",
    connectionState: "connected",
    botProfile: "perfect",
    avatar,
  };
}

function roomWithSong() {
  return createRoomState({
    roomId: "room",
    roomName: "QA",
    host: host(),
    maxPlayers: 6,
    modeId: "solo-easy-battle",
    selectedSongId: "aloha",
  });
}

test.describe("P4.1 room domain", () => {
  test("host never owns Ready state and at least one opponent is required", () => {
    const room = roomWithSong();
    expect(canStartRoom(room)).toEqual({ allowed: false, reason: "opponent-required" });
    expect(() => setGuestReady(room, "host", true)).toThrow("Host does not have Ready state");
  });

  test("bots are auto-ready and open/closed empty slots do not block Start", () => {
    let room = addParticipant(roomWithSong(), bot(1));
    room = closeSlot(room, "host", 5);
    expect(canStartRoom(room)).toEqual({ allowed: true, reason: null });
    expect(() => setGuestReady(room, "bot-1", false)).toThrow("Bots are always Ready");
  });

  test("every occupied human guest must Ready", () => {
    let room = addParticipant(roomWithSong(), guest("not-ready"));
    expect(canStartRoom(room).reason).toBe("participants-not-ready");
    room = setGuestReady(room, "guest", true);
    expect(canStartRoom(room)).toEqual({ allowed: true, reason: null });
  });

  test("changing song or mode resets human guests but keeps bots ready", () => {
    let room = addParticipant(roomWithSong(), guest("ready"));
    room = addParticipant(room, bot(2));
    room = changeSong(room, "host", "cannon-groove");

    expect(room.participants.find(item => item.participantId === "guest")?.readyState).toBe("not-ready");
    expect(room.participants.find(item => item.participantId === "bot-2")?.readyState).toBe("ready");

    room = setGuestReady(room, "guest", true);
    room = changeMode(room, "host", "another-mode");
    expect(room.participants.find(item => item.participantId === "guest")?.readyState).toBe("not-ready");
  });

  test("MatchManifest freezes one eligible room revision and avatar-bearing participant snapshot", () => {
    const room = addParticipant(roomWithSong(), bot(1));
    const manifest = createMatchManifest(room, {
      matchId: "match",
      audioVersion: "audio-v1",
      chartVersion: "chart-v1",
      animationReleaseVersion: 3,
      seed: 123,
      bpmExact: 101.0504,
      spaceStartMs: 10083,
      sequenceCounts: DEFAULT_SOLO_SETTINGS.sequenceCounts,
      commandLengths: DEFAULT_SOLO_SETTINGS.commandLengths,
      finishRestTurns: DEFAULT_SOLO_SETTINGS.finishRestTurns,
    });

    expect(manifest.roomRevision).toBe(room.revision);
    expect(manifest.participants).toHaveLength(2);
    expect(manifest.participants[0].avatar.characterId).toBe("qa");
    expect(Object.isFrozen(manifest)).toBe(true);
    expect(Object.isFrozen(manifest.gameplay)).toBe(true);
    expect(Object.isFrozen(manifest.participants)).toBe(true);
  });
});
