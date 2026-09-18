import { addParticipant, closeSlot, createRoomState } from "./room-state";
import type { AvatarSnapshot, BotParticipant, HumanGuestParticipant, HumanHostParticipant, RoomState } from "./types";

function avatar(characterId: string): AvatarSnapshot {
  return { characterId, outfit: {}, accessoryIds: [], petId: null, titleId: null };
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
    avatar: avatar("default-female"),
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
    avatar: avatar("default-female"),
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
    avatar: avatar("default-male"),
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
