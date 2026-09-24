import { addParticipant, closeSlot, createRoomState } from "./room-state";
import type { AvatarSnapshot, BotParticipant, HumanGuestParticipant, HumanHostParticipant, RoomState } from "./types";

function avatar(characterId: string, characterAssetId: "c1-casual-grace" | "c4-casual-boy"): AvatarSnapshot {
  return { characterId, characterAssetId, outfit: {}, accessoryIds: [], petId: null, titleId: null };
}

export function createP53QaGuestParticipant(slotIndex: 1 = 1): HumanGuestParticipant {
  return {
    participantId: "p51-guest",
    displayName: "LinhCute",
    kind: "human",
    role: "guest",
    slotIndex,
    readyState: "not-ready",
    loadState: "idle",
    connectionState: "connected",
    avatar: avatar("default-female", "c1-casual-grace"),
  };
}

export function createP53SyncedWaitingRoomBase(roomId: string): RoomState {
  const host: HumanHostParticipant = {
    participantId: "p51-host",
    displayName: "Toan",
    kind: "human",
    role: "host",
    slotIndex: 0,
    readyState: "not-applicable",
    loadState: "idle",
    connectionState: "connected",
    avatar: avatar("default-male", "c4-casual-boy"),
  };
  const bot: BotParticipant = {
    participantId: "p51-bot",
    displayName: "ShuMar",
    kind: "bot",
    role: "guest",
    slotIndex: 3,
    readyState: "ready",
    loadState: "loaded",
    connectionState: "connected",
    botProfile: "mixed",
    avatar: avatar("default-male", "c4-casual-boy"),
  };

  let room = createRoomState({
    roomId,
    roomName: "Toan Dance Room",
    host,
    maxPlayers: 6,
    modeId: "solo-easy-battle",
    selectedSongId: "aloha",
  });
  room = addParticipant(room, bot);
  room = closeSlot(room, host.participantId, 4);
  return room;
}

export function createP51WaitingRoomFixture(roomId = "10234"): RoomState {
  const host: HumanHostParticipant = {
    participantId: "p51-host",
    displayName: "Toan",
    kind: "human",
    role: "host",
    slotIndex: 0,
    readyState: "not-applicable",
    loadState: "idle",
    connectionState: "connected",
    avatar: avatar("default-male", "c4-casual-boy"),
  };
  const guest: HumanGuestParticipant = {
    participantId: "p51-guest",
    displayName: "LinhCute",
    kind: "human",
    role: "guest",
    slotIndex: 1,
    readyState: "not-ready",
    loadState: "idle",
    connectionState: "connected",
    avatar: avatar("default-female", "c1-casual-grace"),
  };
  const bot: BotParticipant = {
    participantId: "p51-bot",
    displayName: "ShuMar",
    kind: "bot",
    role: "guest",
    slotIndex: 3,
    readyState: "ready",
    loadState: "loaded",
    connectionState: "connected",
    botProfile: "mixed",
    avatar: avatar("default-male", "c4-casual-boy"),
  };

  let room = createRoomState({
    roomId,
    roomName: "Toan Dance Room",
    host,
    maxPlayers: 6,
    modeId: "solo-easy-battle",
    selectedSongId: "aloha",
  });
  room = addParticipant(room, guest);
  room = addParticipant(room, bot);
  room = closeSlot(room, host.participantId, 4);
  return room;
}
