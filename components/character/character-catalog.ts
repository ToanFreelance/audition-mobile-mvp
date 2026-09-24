import {
  C1_CASUAL_GRACE_ASSET_URL,
  C4_CASUAL_BOY_ASSET_URL,
} from "./mixamo-character-adapter";

export const CHARACTER_CATALOG_VERSION = 1 as const;

export type CharacterAssetId = "c1-casual-grace" | "c4-casual-boy";
export type CharacterGender = "female" | "male";
export type CharacterAnimationProfile = "mixamo-c1" | "canonical";
export type CharacterAppearanceSlot = "hairStyle" | "hairColor" | "skinTone" | "face";
export type CharacterEquipmentSlot = "outfit" | "accessory" | "shoes";

export type CharacterCatalogChoice = {
  id: string;
  label: string;
  available: boolean;
  note?: string;
};

export type CharacterCatalogEntry = {
  id: CharacterAssetId;
  label: string;
  gender: CharacterGender;
  assetUrl: string;
  animationProfile: CharacterAnimationProfile;
  runtimeReady: boolean;
  creatorBadge: string;
  creatorVersionLabel: string;
  appearance: {
    hairStyles: readonly CharacterCatalogChoice[];
    hairColors: readonly CharacterCatalogChoice[];
    skinTones: readonly CharacterCatalogChoice[];
    faces: readonly CharacterCatalogChoice[];
  };
  defaultAppearance: {
    hairStyle: string;
    hairColor: string;
    skinTone: string;
    face: string;
  };
  equipmentSlots: readonly CharacterEquipmentSlot[];
};

const CASUAL_GRACE: CharacterCatalogEntry = {
  id: "c1-casual-grace",
  label: "Casual Grace",
  gender: "female",
  assetUrl: C1_CASUAL_GRACE_ASSET_URL,
  animationProfile: "mixamo-c1",
  runtimeReady: true,
  creatorBadge: "FEMALE STARTER",
  creatorVersionLabel: "C1.3 · playable MVP",
  appearance: {
    hairStyles: [
      { id: "female-bob-01", label: "Bob ngắn", available: true },
      { id: "female-long-01", label: "Tóc dài", available: false, note: "Cần asset" },
      { id: "female-braid-01", label: "Tóc tết", available: false, note: "Cần asset" },
    ],
    hairColors: [
      { id: "brown", label: "Nâu", available: true },
      { id: "black", label: "Đen", available: false, note: "Cần texture variant" },
      { id: "violet", label: "Tím", available: false, note: "Cần texture variant" },
      { id: "silver", label: "Bạc", available: false, note: "Cần texture variant" },
    ],
    skinTones: [
      { id: "warm", label: "Ấm", available: true },
      { id: "light", label: "Sáng", available: false, note: "Cần texture variant" },
      { id: "tan", label: "Nâu", available: false, note: "Cần texture variant" },
      { id: "deep", label: "Đậm", available: false, note: "Cần texture variant" },
    ],
    faces: [
      { id: "basic-01", label: "Cơ bản 01", available: true },
      { id: "basic-02", label: "Cơ bản 02", available: false, note: "Cần face variant" },
    ],
  },
  defaultAppearance: {
    hairStyle: "female-bob-01",
    hairColor: "brown",
    skinTone: "warm",
    face: "basic-01",
  },
  equipmentSlots: ["outfit", "accessory", "shoes"],
};

const CASUAL_BOY: CharacterCatalogEntry = {
  id: "c4-casual-boy",
  label: "Casual Boy",
  gender: "male",
  assetUrl: C4_CASUAL_BOY_ASSET_URL,
  animationProfile: "mixamo-c1",
  runtimeReady: true,
  creatorBadge: "MALE STARTER",
  creatorVersionLabel: "C4 · Mixamo playable MVP",
  appearance: {
    hairStyles: [
      { id: "male-short-01", label: "Tóc ngắn", available: true },
      { id: "male-medium-01", label: "Tóc dài hơn", available: false, note: "Cần asset" },
      { id: "male-bald-01", label: "Đầu trọc", available: false, note: "Cần asset" },
    ],
    hairColors: [
      { id: "male-default", label: "Mặc định", available: true },
      { id: "black", label: "Đen", available: false, note: "Cần texture variant" },
      { id: "brown", label: "Nâu", available: false, note: "Cần texture variant" },
    ],
    skinTones: [
      { id: "male-default", label: "Mặc định", available: true },
      { id: "light", label: "Sáng", available: false, note: "Cần texture variant" },
      { id: "tan", label: "Nâu", available: false, note: "Cần texture variant" },
    ],
    faces: [
      { id: "male-basic-01", label: "Cơ bản 01", available: true },
      { id: "male-basic-02", label: "Cơ bản 02", available: false, note: "Cần face variant" },
    ],
  },
  defaultAppearance: {
    hairStyle: "male-short-01",
    hairColor: "male-default",
    skinTone: "male-default",
    face: "male-basic-01",
  },
  equipmentSlots: ["outfit", "accessory", "shoes"],
};

export const CHARACTER_CATALOG_V1: readonly CharacterCatalogEntry[] = [CASUAL_GRACE, CASUAL_BOY];

export const DEFAULT_CHARACTER_ASSET_ID: CharacterAssetId = CASUAL_GRACE.id;

export function getCharacterCatalogEntry(assetId: string): CharacterCatalogEntry | null {
  return CHARACTER_CATALOG_V1.find(entry => entry.id === assetId) ?? null;
}

export function getCharacterCatalogEntryByAssetUrl(assetUrl: string): CharacterCatalogEntry | null {
  return CHARACTER_CATALOG_V1.find(entry => entry.assetUrl === assetUrl) ?? null;
}

export function resolveCharacterAssetUrl(assetId: string): string {
  return getCharacterCatalogEntry(assetId)?.assetUrl ?? CASUAL_GRACE.assetUrl;
}

export function isCharacterAssetId(value: unknown): value is CharacterAssetId {
  return typeof value === "string" && getCharacterCatalogEntry(value) !== null;
}

export function isAvailableCharacterChoice(
  choices: readonly CharacterCatalogChoice[],
  id: unknown,
): id is string {
  return typeof id === "string" && choices.some(choice => choice.id === id && choice.available);
}
