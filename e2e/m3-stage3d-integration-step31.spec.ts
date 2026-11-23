import { expect, test } from "@playwright/test";
import type { AvatarSnapshot } from "../multiplayer/types";
import { roomContainsNonPlayableCharacter } from "../components/character/m3-lobby-appearance";
import {
  isM3Stage3dQaOptIn, resolveM3Stage3dAvatar, frozenStageActorIdentityKey, M3_STAGE3D_QA_RUNTIME_VERSION,
} from "../components/character/m3-stage3d-qa-gate";
import { getCharacterCatalogEntry } from "../components/character/character-catalog";

const avatar = (id: string, look?: AvatarSnapshot["m3Appearance"]): AvatarSnapshot => ({
  characterId: id, characterAssetId: id, outfit: {}, accessoryIds: [], m3Appearance: look,
});
const female = avatar("m3-drophunter", {
  hairStyle: "short", hairColor: "red", skinTone: "originalskin",
  m3Outfit: { top: "shirt", bottom: "casualshorts" },
});
const male = avatar("m3-neurohacker", {
  hairStyle: "hair1", hairColor: "yellow", skinTone: "originalskin",
  m3Outfit: { top: "simpleshirt", bottom: "shorts" },
});

test("M3 gate is explicit and branch-only, never production", () => {
  const branch = "audition-mobile-mvp-git-work-m3-6be266-toan-freelances-projects.vercel.app";
  expect(isM3Stage3dQaOptIn(branch, "?m3GameplayQa=1")).toBe(true);
  expect(isM3Stage3dQaOptIn(branch, "")).toBe(false);
  expect(isM3Stage3dQaOptIn(branch, "?m3GameplayQa=0")).toBe(false);
  expect(isM3Stage3dQaOptIn("audition-mobile-mvp.vercel.app", "?m3GameplayQa=1")).toBe(false);
  expect(isM3Stage3dQaOptIn("localhost", "?m3GameplayQa=1")).toBe(true);
  expect(M3_STAGE3D_QA_RUNTIME_VERSION).toContain("step3.1-qa");
});
test("M3 gameplay resolves the frozen female/male Catalog identity and wardrobe", () => {
  expect(resolveM3Stage3dAvatar(female, true)).toEqual({
    assetId: "m3-drophunter", appearance: female.m3Appearance,
  });
  expect(resolveM3Stage3dAvatar(male, true)).toEqual({
    assetId: "m3-neurohacker", appearance: male.m3Appearance,
  });
  expect(resolveM3Stage3dAvatar(avatar("c1-casual-grace"), true)).toBeNull();
  expect(resolveM3Stage3dAvatar(avatar("c4-casual-boy"), false)).toBeNull();
  expect(() => resolveM3Stage3dAvatar(female, false)).toThrow(/opt-in/);
  expect(() => resolveM3Stage3dAvatar(avatar("m3-drophunter"), true)).toThrow(/appearance/);
  expect(() => resolveM3Stage3dAvatar(avatar("unknown"), true)).toThrow(/characterAssetId/);
});
test("Host START is default-locked; M3 QA only accepts complete frozen looks", () => {
  expect(roomContainsNonPlayableCharacter([female, male])).toBe(true);
  expect(roomContainsNonPlayableCharacter([female, male], true)).toBe(false);
  expect(roomContainsNonPlayableCharacter([avatar("c1-casual-grace"), female], true)).toBe(false);
  expect(roomContainsNonPlayableCharacter([avatar("m3-neurohacker")], true)).toBe(true);
  expect(roomContainsNonPlayableCharacter([avatar("unknown")], true)).toBe(true);
  expect(getCharacterCatalogEntry("m3-drophunter")?.runtimeReady).toBe(false);
  expect(getCharacterCatalogEntry("m3-neurohacker")?.runtimeReady).toBe(false);
});

test("same frozen avatar identity survives metadata snapshot rehydration", () => {
  const key = frozenStageActorIdentityKey(female);
  expect(frozenStageActorIdentityKey({ ...female, outfit: { ...female.outfit },
    m3Appearance: { ...female.m3Appearance!, m3Outfit: { ...female.m3Appearance!.m3Outfit } } })).toBe(key);
  expect(frozenStageActorIdentityKey({
    ...female, m3Appearance: { ...female.m3Appearance!, hairColor: "black" },
  })).not.toBe(key);
  expect(frozenStageActorIdentityKey(male)).not.toBe(key);
});
