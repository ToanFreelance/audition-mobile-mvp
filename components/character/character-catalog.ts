import {
  C1_CASUAL_GRACE_ASSET_URL,
  C4_CASUAL_BOY_ASSET_URL,
} from "./mixamo-character-adapter";

export const CHARACTER_CATALOG_VERSION = 1 as const;

const C1_CASUAL_GRACE_PORTRAIT_URL = "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBAUEBAYFBQUGBgYHCQ4JCQgICRINDQoOFRIWFhUSFBQXGiEcFxgfGRQUHScdHyIjJSUlFhwpLCgkKyEkJST/2wBDAQYGBgkICREJCREkGBQYJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCT/wAARCABAAEADASIAAhEBAxEB/8QAGwAAAQUBAQAAAAAAAAAAAAAABgIEBQcIAwH/xAAyEAABAwMBBwIDCAMAAAAAAAABAgMEAAURIQYHEjFBUWETcRQikQgVFiMyQ4HBM1LR/8QAGgEAAwEBAQEAAAAAAAAAAAAAAwQFBgECAP/EACMRAAICAgEEAgMAAAAAAAAAAAECAAMEESESEzFRBRUiMoH/2gAMAwEAAhEDEQA/AK5e30397Zp7ZwsR0wHIMeGhOSS0WSCHU9lKwMjloK57T71Ju1NufifdECA7OktTLjIYKyqY82nhSSFEhI5nA6mgZKM06ZbyarCkbnRlNrUJLjtnNu+2v4tcistyfiWZXw6SfTy3w4GeeDwj60Vo3y32XtJbb49bYrsuCiU0gBxaUrQ8ScHHIp4sBQ1OBmgGMyDjSiC0QUhXqKA+XQe9MLihtRqlieTCa270L1Z5kyXBtcIOzJjUt4yFLfUoNpwG+JZJwck8XPWuULeBcbZbUwYtkt6HWzLMaUpS1LiiQfnCU5wcDQE5ps1DRkq4c8OvLnS/hBwIKk4OvMeaa+vXeo4BzqITebjcLPZLNIAEW0+sWVcRJVxnOo5achjoacNIJAHWltMIS0pWP06fWlNaLHjWnsekVAgToP7H1KmQwBjLqKeMNtD9zPsKjEGnrCqjqR6mfQSbhNtKUAOImiJ1PwMbiU4xHS0CVqfVj3wBr4obgy2YYS86ojBGABknWpGzWu4Xy5yQGC88tKhlwEhA/wBj2AGtAy801/gnmV6VIXYks5MNuShUiSlaFoS4hTSD8wOvPxTqLLbmsB9lfGgkpz1B7U4262Cm7K2+3vqkGQxLQAprGPRc6Y/ihiwIXb3FJecCWnSQE5yQodx0r7435GzuCtzsGeltKsNwpb+ZDiRroDSEr4VZ5+KbiaygKKVqJxgaUlM9tX604PdP/K0vVCCwbPoyp0Kp/CR6vqHiA4EFXvjpTEScckIH8V1RNdTnhUE5GDjtWd/shqdGEzUgwUsKkRW5KAULdQtOqkkj+jWmNktm7AzEi3OC8EsyW0FtoY4QrofJ169qy6xd2HpDRcdylxlLSwvmhScY+uKufdHMnT7XOYgOokxYzqRHU6oo9PIyRpnOO1SMittlpWqtBBWT28yxOM22YbhKZVFXgsFJPqheNB9apSdAbtSGUqfbckhxIcLSwpsnhOcHxpnzRZtNIuE2+yvvu6sS0QV8BjA8AGR0ST261Xrym0PFDJBYSria+Ujx11xRMOpu6sBa4CdRkoJXmvRJ81FB/wA0tL/mtaHiXdMDgauLdFuDk7cx0Xi+SHbfalf4koH5r47jPJPmhHdVu+e292sjwVAfAsEPS19mweXueVbOYQzb47cdhCW2mkBCEJGiUgYArNXWFeBPdab5MBIX2bN30RKSuHMlKTr+bIVr74xRjaNkrRs/HEO1wGIccfttpxk9z3NTdve+IYC85HKnXCCeVJuS3kxhT0eJWO1+42x7ZyHJhefgzV4Jdb1QogYBKTz09qDLj9lx9EVS4W0vrygk4S+xwpWagyCcVoKoXaO7i0xVvqVgIST70arIsTgGCZQxmML9s7d9mJrkO7QXozjauEqUk8Cj4VyNRodrZiBZt4VhXDuTDcqM+nCgoapPg9CKzrvN3K3fYV12fBC59lGoeH62R2WP7qvj5oc9LcGBeoqZ/9k=";
const C4_CASUAL_BOY_PORTRAIT_URL = "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBAUEBAYFBQUGBgYHCQ4JCQgICRINDQoOFRIWFhUSFBQXGiEcFxgfGRQUHScdHyIjJSUlFhwpLCgkKyEkJST/2wBDAQYGBgkICREJCREkGBQYJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCT/wAARCABAAEADASIAAhEBAxEB/8QAHAAAAQUBAQEAAAAAAAAAAAAABQABAgMGBAcI/8QAMBAAAQIEBAQFAwUBAAAAAAAAAQIDAAQFEQYSITETQVFhBxQiMnEjYoEVU5Gx0cH/xAAaAQACAwEBAAAAAAAAAAAAAAACBAEDBgUA/8QAIhEAAgIBBAIDAQAAAAAAAAAAAQIAEQMEEiExBUETIlGB/9oADAMBAAIRAxEAPwDwa0K0W5e0LLGsqKgyrJeJBA6RYE9okExIWTcpLY6QuGByi8oiJTElZNynLDZYuyw2SBInhLckPkjp4USbl1OKsCgWBJzKCRoO8GxCruMBRfEqZlVODN7UXtmOwgkDT5WUca4XHdJH17ezsOogQJ9pxttoLLqmyU5kg2F+VoMcdt6h8AvvJUp7MQheVOUC1tO5jgZ9W+Q8GhHhjCicaUy7ziZZooQTqVrPP/IjO09ySeU2ohSQbBYGivi8PTmWG5+7s0pTKUgtm2YpPQ9Y75sluTdCmkTIK86XEK9SSTtY8ot0mrdKVuRKXUdwNw4XD7R1loE+kKA6K3hcGO3VykTq8v2iD0qVtmyik7giDAlD0h/KHpF7YtwoxkadhzMspPDpikOTrLXBVndSgfUVfQf3CwtRjjKvSNAlneEh5dlA7bXJPXQbQWquGP1RlTcmEtzbhCQduKb7ExvsA+DdZpE3SK0xNtyUw5q624j6jRIsQOUZLWYTgcq0a+JmFmZjHHg+vw4kBUGKiZqTdVw3ApOUoUdiNdjGVorT8yw7nQ64W1JyOnUJB6x7vjzwoqdbppBrL868twFTk676GkgE3CRYXvblGHRS5akUBFHkErccU6XJl9SQM9vakfaNTE+PxtlyAD+yp8e40JlvLdofy3aDYpbnNIHyREhS1m/s039QjX7BPDTfpncCeQT+EiHuvn/BESByIWoGxAsIKUXDNYq9ilhaGFDR13QfIg2ZV5M6b7F7AqB1S6XRdKQlY1FtLwelsS4mDEqwHHyEuJLbzQGYjprpsY3GGsB0qRmUKqA84v7tEpPx/sHZjDbExMzTSmEBpRSUJCdAALaRmvM6nHkpVHI9wEzIbC9TM1OZr1fkpllsqYlm2yVqHucNvaP+mPNVNFGihH0PI0tEqy2y2gBKbbDQCM9i3BlGrCiZZpMtM/utCwJ7jnAeG1i4bRh37i6Z1xN9up4xkFsxKUi9tYkkJS0uykqvYaQXr+EarR27rYLzKSSXWtR+ekBmxlYSDuSTGoV1cWp4jYYZAKPFz//Z";

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
