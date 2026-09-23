export const CHARACTER_CREATION_DRAFT_KEY = "audition.characterCreationDraft.v1";

export type CharacterCreationProfileV1 = {
  version: 1;
  gender: "female";
  characterAssetId: "c1-casual-grace";
  hairStyle: string;
  hairColor: string;
  skinTone: string;
  face: string;
  name: string;
};

export const DEFAULT_CHARACTER_CREATION_PROFILE: CharacterCreationProfileV1 = {
  version: 1,
  gender: "female",
  characterAssetId: "c1-casual-grace",
  hairStyle: "female-bob-01",
  hairColor: "brown",
  skinTone: "warm",
  face: "basic-01",
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
      || value.gender !== "female"
      || value.characterAssetId !== "c1-casual-grace"
      || !isNonEmptyString(value.hairStyle)
      || !isNonEmptyString(value.hairColor)
      || !isNonEmptyString(value.skinTone)
      || !isNonEmptyString(value.face)
      || !isNonEmptyString(value.name)
    ) {
      return null;
    }

    return {
      version: 1,
      gender: "female",
      characterAssetId: "c1-casual-grace",
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
