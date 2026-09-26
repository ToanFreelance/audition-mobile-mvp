import { expect, test } from "@playwright/test";
import { avatarCharacterAssetId } from "../multiplayer/avatar-character";
import { lobbyStageParticipantIdentity } from "../multiplayer/lobby-stage-identity";
import { createP53QaGuestParticipant } from "../multiplayer/waiting-room-qa";

test("ready and connection metadata do not change 3D actor identity", () => {
  const guest = createP53QaGuestParticipant();
  const identity = lobbyStageParticipantIdentity(guest);

  expect(lobbyStageParticipantIdentity({
    ...guest,
    readyState: "ready",
  })).toBe(identity);

  expect(lobbyStageParticipantIdentity({
    ...guest,
    connectionState: "disconnected",
  })).toBe(identity);
});

test("avatar or slot changes do change 3D actor identity", () => {
  const guest = createP53QaGuestParticipant();

  expect(lobbyStageParticipantIdentity({
    ...guest,
    avatar: { ...guest.avatar, characterAssetId: "c4-casual-boy" },
  })).not.toBe(lobbyStageParticipantIdentity(guest));

  expect(lobbyStageParticipantIdentity({
    ...guest,
    slotIndex: 2,
  })).not.toBe(lobbyStageParticipantIdentity(guest));
});


test("legacy starter avatar ids migrate to accepted Character Catalog ids", () => {
  expect(avatarCharacterAssetId({
    characterId: "default-female",
    outfit: {},
    accessoryIds: [],
  })).toBe("c1-casual-grace");

  expect(avatarCharacterAssetId({
    characterId: "default-male",
    outfit: {},
    accessoryIds: [],
  })).toBe("c4-casual-boy");
});
