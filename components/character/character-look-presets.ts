import {
  getCharacterCatalogEntry,
  isAvailableCharacterChoice,
  type CharacterAssetId,
} from "./character-catalog";
import type { CharacterCreationProfileV1 } from "./character-profile";

// Four quick appearance presets for one already-created MVP character.
// This is local device persistence, NOT an account or server character registry.
export const CHARACTER_LOOK_PRESETS_KEY = "audition.characterLookPresets.v1";

export type CharacterLook = Pick<
  CharacterCreationProfileV1,
  "hairStyle" | "hairColor" | "skinTone" | "face"
>;
export type CharacterLookSlots = [
  CharacterLook | null,
  CharacterLook | null,
  CharacterLook | null,
  CharacterLook | null,
];
export const emptyCharacterLookSlots = (): CharacterLookSlots => [null, null, null, null];

export function appearanceFromProfile(profile: CharacterCreationProfileV1): CharacterLook {
  return {
    hairStyle: profile.hairStyle,
    hairColor: profile.hairColor,
    skinTone: profile.skinTone,
    face: profile.face,
  };
}

export function validCharacterLook(assetId: CharacterAssetId, value: unknown): value is CharacterLook {
  if (!value || typeof value !== "object") return false;
  const character = getCharacterCatalogEntry(assetId);
  if (!character) return false;
  const look = value as Partial<CharacterLook>;
  return (
    isAvailableCharacterChoice(character.appearance.hairStyles, look.hairStyle)
    && isAvailableCharacterChoice(character.appearance.hairColors, look.hairColor)
    && isAvailableCharacterChoice(character.appearance.skinTones, look.skinTone)
    && isAvailableCharacterChoice(character.appearance.faces, look.face)
  );
}

export function readCharacterLookSlots(
  storage: Pick<Storage, "getItem">,
  assetId: CharacterAssetId,
): CharacterLookSlots | null {
  try {
    const raw = storage.getItem(CHARACTER_LOOK_PRESETS_KEY);
    if (!raw) return null;
    const document = JSON.parse(raw) as { version?: number; characterAssetId?: string; slots?: unknown };
    if (document.version !== 1 || document.characterAssetId !== assetId || !Array.isArray(document.slots) || document.slots.length !== 4) {
      return null;
    }
    return document.slots.map((value: unknown) => validCharacterLook(assetId, value) ? value : null) as CharacterLookSlots;
  } catch {
    return null;
  }
}

export function writeCharacterLookSlots(
  storage: Pick<Storage, "setItem">,
  assetId: CharacterAssetId,
  slots: CharacterLookSlots,
): void {
  if (slots.length !== 4 || slots.some(look => look !== null && !validCharacterLook(assetId, look))) {
    throw new Error("Invalid character appearance preset or character identity");
  }
  storage.setItem(CHARACTER_LOOK_PRESETS_KEY, JSON.stringify({ version: 1, characterAssetId: assetId, slots }));
}
