import {
  C1_CASUAL_GRACE_ASSET_URL,
  C4_CASUAL_BOY_ASSET_URL,
} from "./mixamo-character-adapter";

export const CHARACTER_CATALOG_VERSION = 1 as const;

const C1_CASUAL_GRACE_PORTRAIT_URL = "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAsICAoIBwsKCQoNDAsNERwSEQ8PESIZGhQcKSQrKigkJyctMkA3LTA9MCcnOEw5PUNFSElIKzZPVU5GVEBHSEX/2wBDAQwNDREPESESEiFFLicuRUVFRUVFRUVFRUVFRUVFRUVFRUVFRUVFRUVFRUVFRUVFRUVFRUVFRUVFRUVFRUVFRUX/wAARCABAAEADASIAAhEBAxEB/8QAGgAAAgMBAQAAAAAAAAAAAAAAAwQBBQYCB//EACwQAAIBAwMDAwQBBQAAAAAAAAECAwAEEQUSIRMxQSJRYQYUFUJxMlKBkaH/xAAZAQACAwEAAAAAAAAAAAAAAAADBAECBQD/xAAeEQADAAMAAwEBAAAAAAAAAAAAAQIDESEEEjEiQf/aAAwDAQACEQMRAD8AwiijIPioDKKKritNImUEjQ57U/HGUhzjlqr5JHQLxgHsaOuoTdLY23GMZxQqzzL0MaHVGFFdjgg1EFtmz+5Mw2j/ALQoZ1k4B5o+PyIvhf2X9GuqSewqDIxGPFQEb+01Ijb2pnhH4MwtP2FsbiYLnA7mkFpiK/ELpGg5zyaz7v1kBjQa6ke6uCIoyUTgACnbPSbq6ZAsLYPnFL/lWs4mghjTc3JfHNHl+ob6GG3NnIfSMNjtSLDU+Heo3HSxaLGUWM8/JqneZll3IcGrK8u1uNt1dKQXGPT2zSZtOqw2upVv2Hio30G/g7aXbTRcscjjvTkMhMgyTScsCW6xGN1YgbWx70WJwrqSa1sF+8dJTTnRnw2KPa26z3G9SBt9/FDt0jb1StjwB7mplVCrquVY8ACkc1bK4znUHXrFYWyPLUew6k8EkIX0AbjjvXVjpj3Fqx2ltv8AutHoehTwusjRsqNwOO/80swut9DaRpH3ekTRXKhcjMZPis6kX4+8aGfKqM5zW5vdPvYoi0aE/Aqn1PTGl04y3SCOQDgnvUIoyhtrfe87jd0SpZTnzUo3pGaStbmaJhbs56ZbmmmYBzjtmtDxH9Bt+pWFP6SASBxmmtsIu4gzlYyPV/NIpcP0eioyM5+aNGHkTpSxt7hsdqHUoqqNDpLSWdysqEOFPKj2re2ut2stsGQgkd1FeY2lnql9CIraF2K8KV4yPmtNpX0xfWdk33O5ZW/XPNAuEkHx3vhrY9ftnhZ29G3ghqxH1NrK38iiB9wPAVavIdBe4tDGytGTwNx5qkl+kb/TnknMBmVeVIrscy/pSqafCjltY7cxKGJlb1MB+tBY4Yj5ptYZsTTzRs0jcYHikNrjllP+afxSp+AKrZ//2Q==";
const C4_CASUAL_BOY_PORTRAIT_URL = "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAsICAoIBwsKCQoNDAsNERwSEQ8PESIZGhQcKSQrKigkJyctMkA3LTA9MCcnOEw5PUNFSElIKzZPVU5GVEBHSEX/2wBDAQwNDREPESESEiFFLicuRUVFRUVFRUVFRUVFRUVFRUVFRUVFRUVFRUVFRUVFRUVFRUVFRUVFRUVFRUVFRUVFRUX/wAARCABAAEADASIAAhEBAxEB/8QAGwAAAgMBAQEAAAAAAAAAAAAAAwQCBQYBBwD/xAAqEAACAQMDBAEEAgMAAAAAAAABAgMABBEFEiEiMUFRMgYTFGEjQiQ0cf/EABkBAAIDAQAAAAAAAAAAAAAAAAIDAAQFAf/EAB0RAAIDAQADAQAAAAAAAAAAAAABAgMRIQQxQRL/2gAMAwEAAhEDEQA/AMHiuhcnArvbnGaaMcUCBpT8hwF5rUssUPYEY6AjhZmwBmrG2WO0AaYBz5B8UnHdNHkxY2t7FHhtZrsNJlcDkljiqMrJSfRqSSI3OyVyVOVJ7eqFJtjULGfkOqgsWjlZQ6EZ8NQnZvuUCl3UcYX7LEnapOO+KhirW2uv8cKwCRgYY4yTSLJGdzBjjxxwavV3J8YtoC6s6FVG0mp7sWywlckd2NFvL0zxJGiRx7e7jvSlvbXMyM7N0kHFVLG3Lo6KxcJrjIyat7GKOXTbxXfAwOPdUX+uvWct6907b3D/AIm4rsVjzmgRGBWwgYnJKsexoUMEwuhDIeCcBjX0+pwx/HL/APKlFeG62sGyF4APipwH6WMsE0EDR7f4z5HNds5YliMEiAqffihRXbIdu7IPcGiSywSn+RAn7WiBZW3cG0gjt6o2LqSDoBVQMACm3jBGWAO3nHukra+uI7xQynGcjI4xTb4ZIZF8ALaiNC0jAMP6seajcEvEI0c4HyFAup2lu3dz/Y4qNvl5sYOCearHC8036PutYshLbBFUHktS939OX2gsGuACjHG5e1etaHbxW+jWyxgKCgJpD6kuLE6dLFNIhcjhe5oN6EopI8ougcgqxBHkU7p+yZGLuNyjIY1XlxI5HZe1WmlaO88UrgsscfVnHDfqnRWvBTHdme4rk8P5FvtGFKjv+qZaIr8hiolMgiteytTjg9Rwy8dm354hOes4Umr5/pm+sl4hLlercPIrRaRY2F88X5CATQtkMPNbOUx/a8Y7Viz2MsYz8YzKWun6pqGlxq07QQlcbF4IpS90GLS9PmuZGeSQDgyHNegx7BGgXB4oV1DBPEVnRXX0aV9F+jxi20ee8kYiNo0IyCwxmtfqCpp2lW9hCerGXIpjX7qOSUW0PSijB28VVMVY5YFj7JrR8ehvJsGEde4f/9k=";

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
  portraitUrl: string;
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
  portraitUrl: C1_CASUAL_GRACE_PORTRAIT_URL,
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
  portraitUrl: C4_CASUAL_BOY_PORTRAIT_URL,
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
