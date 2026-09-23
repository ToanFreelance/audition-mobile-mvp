import {
  DEFAULT_CHARACTER_ASSET_ID,
  getCharacterCatalogEntry,
  isAvailableCharacterChoice,
  isCharacterAssetId,
  type CharacterAssetId,
  type CharacterGender,
} from "./character-catalog";

export const CHARACTER_CREATION_DRAFT_KEY = "audition.characterCreationDraft.v1";

export type CharacterCreationProfileV1 = {
  version: 1;
  gender: CharacterGender;
  characterAssetId: CharacterAssetId;
  hairStyle: string;
  hairColor: string;
  skinTone: string;
  face: string;
  name: string;
};

const DEFAULT_CHARACTER = getCharacterCatalogEntry(DEFAULT_CHARACTER_ASSET_ID);
if (!DEFAULT_CHARACTER) throw new Error("Default character catalog entry is missing.");

export const DEFAULT_CHARACTER_CREATION_PROFILE: CharacterCreationProfileV1 = {
  version: 1,
  gender: DEFAULT_CHARACTER.gender,
  characterAssetId: DEFAULT_CHARACTER.id,
  hairStyle: DEFAULT_CHARACTER.defaultAppearance.hairStyle,
  hairColor: DEFAULT_CHARACTER.defaultAppearance.hairColor,
  skinTone: DEFAULT_CHARACTER.defaultAppearance.skinTone,
  face: DEFAULT_CHARACTER.defaultAppearance.face,
  name: "Luna",
};

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

export function parseCharacterCreationDraft(raw: string | null): CharacterCreationProfileV1 | null {
  if (!raw) return null;

  try {
    const value = JSON.parse(raw) as Partial<CharacterCreationProfileV1>;
    if (
      value.version !== 1
      || !isCharacterAssetId(value.characterAssetId)
      || !isNonEmptyString(value.name)
    ) {
      return null;
    }

    const character = getCharacterCatalogEntry(value.characterAssetId);
    if (!character || value.gender !== character.gender) return null;

    if (
      !isAvailableCharacterChoice(character.appearance.hairStyles, value.hairStyle)
      || !isAvailableCharacterChoice(character.appearance.hairColors, value.hairColor)
      || !isAvailableCharacterChoice(character.appearance.skinTones, value.skinTone)
      || !isAvailableCharacterChoice(character.appearance.faces, value.face)
    ) {
      return null;
    }

    return {
      version: 1,
      gender: character.gender,
      characterAssetId: character.id,
      hairStyle: value.hairStyle,
      hairColor: value.hairColor,
      skinTone: value.skinTone,
      face: value.face,
      name: value.name.trim().slice(0, 14),
    };
  } catch {
    return null;
  }
}

export function loadCharacterCreationDraft(storage: Pick<Storage, "getItem">) {
  return parseCharacterCreationDraft(storage.getItem(CHARACTER_CREATION_DRAFT_KEY));
}

export function saveCharacterCreationDraft(
  storage: Pick<Storage, "setItem">,
  profile: CharacterCreationProfileV1,
) {
  storage.setItem(CHARACTER_CREATION_DRAFT_KEY, JSON.stringify(profile));
}
