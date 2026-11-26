import { getCharacterCatalogEntry } from "../character/character-catalog";
import type { CharacterCreationProfileV1 } from "../character/character-profile";
import { parseM3LobbyAppearance } from "../character/m3-lobby-appearance";
import { M3_ASSET_CACHE_REVISION } from "../character/m3-asset-cache";

// Single, bounded tab-local derived image; no account identifiers or profile names.
export const ROOM_PORTRAIT_STORAGE_KEY = "audition.room-portrait.v1";
export function roomPortraitKey(profile: CharacterCreationProfileV1): string | null {
  const entry = getCharacterCatalogEntry(profile.characterAssetId);
  const look = entry?.m3RigFamily ? parseM3LobbyAppearance(entry.id, profile) : null;
  if (!entry || !look || !entry.appearance.faces.some(face => face.available && face.id === profile.face)) return null;
  return JSON.stringify(["portrait-v1", M3_ASSET_CACHE_REVISION, entry.id, look.hairStyle,
    look.hairColor, look.skinTone, profile.face, look.m3Outfit.top, look.m3Outfit.bottom]);
}
function isPortraitImage(value: unknown): value is string {
  return typeof value === "string" && value.length < 150_000
    && /^data:image\/png;base64,[A-Za-z0-9+/]+=*$/.test(value);
}
export function readRoomPortrait(storage: Pick<Storage, "getItem">, key: string): string | null {
  try {
    const value = JSON.parse(storage.getItem(ROOM_PORTRAIT_STORAGE_KEY) || "null");
    return value?.key === key && isPortraitImage(value.image) ? value.image : null;
  } catch { return null; }
}
export function writeRoomPortrait(storage: Pick<Storage, "setItem">, key: string, image: string): void {
  if (!isPortraitImage(image)) return;
  try { storage.setItem(ROOM_PORTRAIT_STORAGE_KEY, JSON.stringify({ key, image })); }
  catch { /* private browsing or quota must not block room entry */ }
}
