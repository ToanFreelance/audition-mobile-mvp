import { getCharacterCatalogEntry, type CharacterAssetId } from "./character-catalog";
import { getM3CreatorWardrobeForFamily } from "./m3-creator-outfits";
import type { AvatarSnapshot, M3LobbyAppearance } from "../../multiplayer/types";
import { avatarCharacterAssetId } from "../../multiplayer/avatar-character";

/**
 * Validate a creator-selected M3 look before it enters authoritative RoomState.
 * Only IDs from the matching rig family are permitted (never arbitrary URLs).
 * Null is an invalid payload; callers must reject it rather than silently
 * replacing the saved look with another character or cosmetic.
 */
export function parseM3LobbyAppearance(
  characterAssetId: CharacterAssetId,
  value: unknown,
): M3LobbyAppearance | null {
  const catalog = getCharacterCatalogEntry(characterAssetId);
  if (!catalog?.m3RigFamily || !value || typeof value !== "object") return null;
  const input = value as Record<string, unknown>;
  const wardrobe = getM3CreatorWardrobeForFamily(catalog.m3RigFamily);
  const outfit = input.m3Outfit;
  if (!outfit || typeof outfit !== "object") return null;
  const item = outfit as Record<string, unknown>;
  if (
    typeof input.hairStyle !== "string" ||
    typeof input.hairColor !== "string" ||
    typeof input.skinTone !== "string" ||
    typeof item.top !== "string" ||
    typeof item.bottom !== "string" ||
    !catalog.appearance.hairStyles.some(x => x.id === input.hairStyle && x.available) ||
    !catalog.appearance.hairColors.some(x => x.id === input.hairColor && x.available) ||
    !catalog.appearance.skinTones.some(x => x.id === input.skinTone && x.available) ||
    !wardrobe.top.some(x => x.id === item.top) ||
    !wardrobe.bottom.some(x => x.id === item.bottom)
  ) return null;
  return {
    hairStyle: input.hairStyle,
    hairColor: input.hairColor,
    skinTone: input.skinTone,
    m3Outfit: { top: item.top, bottom: item.bottom },
  };
}

/** Runtime-ready M3 still requires a complete, canonical wardrobe snapshot. */
export function roomContainsNonPlayableCharacter(avatars: readonly AvatarSnapshot[]): boolean {
  return avatars.some(avatar => {
    const entry = getCharacterCatalogEntry(avatarCharacterAssetId(avatar));
    if (!entry?.runtimeReady) return true;
    return Boolean(entry.m3RigFamily && !parseM3LobbyAppearance(entry.id, avatar.m3Appearance));
  });
}
