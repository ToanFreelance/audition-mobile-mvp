import { expect, test } from "@playwright/test";
import { parseM3LobbyAppearance, roomContainsNonPlayableCharacter } from "../components/character/m3-lobby-appearance";
import type { AvatarSnapshot, RoomParticipant } from "../multiplayer/types";
import { lobbyStageParticipantIdentity } from "../multiplayer/lobby-stage-identity";

const female = {
  hairStyle: "curledbangs", hairColor: "red", skinTone: "tone4skin",
  m3Outfit: { top: "lightshirt", bottom: "sportshorts" },
};
const avatar = (id: string, appearance?: AvatarSnapshot["m3Appearance"]): AvatarSnapshot => ({
  characterId: id, characterAssetId: id, outfit: {}, accessoryIds: [],
  m3Appearance: appearance,
});

test("validates complete family-specific M3 lobby appearance", () => {
  expect(parseM3LobbyAppearance("m3-drophunter", female)).toEqual(female);
  expect(parseM3LobbyAppearance("m3-neurohacker", female)).toBeNull();
  expect(parseM3LobbyAppearance("m3-neurohacker", {
    hairStyle: "hair2", hairColor: "yellow", skinTone: "tone3skin",
    m3Outfit: { top: "simpleshirt", bottom: "shorts" },
  })).not.toBeNull();
  expect(parseM3LobbyAppearance("m3-drophunter", { ...female, hairColor: "fake" })).toBeNull();
  expect(parseM3LobbyAppearance("m3-drophunter", { ...female, m3Outfit: { top: "shirt", bottom: "cargoshorts" } })).toBeNull();
  expect(parseM3LobbyAppearance("m3-drophunter", { ...female, m3Outfit: null })).toBeNull();
  expect(parseM3LobbyAppearance("m3-drophunter", null)).toBeNull();
});

test("blocks M3 gameplay while retaining legacy default-female/male compatibility", () => {
  expect(roomContainsNonPlayableCharacter([avatar("m3-drophunter", female)])).toBe(true);
  expect(roomContainsNonPlayableCharacter([avatar("c1-casual-grace"), avatar("c4-casual-boy")])).toBe(false);
  const legacy = [{ characterId: "default-female", outfit: {}, accessoryIds: [] },
    { characterId: "default-male", outfit: {}, accessoryIds: [] }];
  expect(roomContainsNonPlayableCharacter(legacy)).toBe(false);
  expect(roomContainsNonPlayableCharacter([avatar("c1-casual-grace"), avatar("m3-neurohacker")])).toBe(true);
});

test("READY / connection / loadState metadata never changes actor identity", () => {
  const avatarSnapshot = avatar("m3-drophunter", female);
  const member: RoomParticipant = {
    participantId: "m3-player", kind: "human", role: "guest", slotIndex: 1,
    displayName: "M3 Dancer", avatar: avatarSnapshot,
    readyState: "not-ready", connectionState: "connected", loadState: "idle",
  };
  const original = lobbyStageParticipantIdentity(member);
  expect(lobbyStageParticipantIdentity({
    ...member, readyState: "ready", connectionState: "disconnected",
    loadState: "loaded", displayName: "Updated",
  })).toBe(original);
  expect(lobbyStageParticipantIdentity({
    ...member, avatar: { ...avatarSnapshot, characterAssetId: "m3-neurohacker" },
  })).not.toBe(original);
});
