import type { AvatarSnapshot } from "./types";

const LEGACY_CHARACTER_ASSET_IDS: Readonly<Record<string, string>> = {
  "default-female": "c1-casual-grace",
  "default-male": "c4-casual-boy",
};

/**
 * Canonical runtime character identity for lobby presentation.
 *
 * P5.6 introduces characterAssetId while retaining characterId as a migration
 * fallback for older persisted RoomState snapshots. Known P5 legacy starter
 * ids are translated to their accepted Character Catalog entries.
 */
export function avatarCharacterAssetId(avatar: AvatarSnapshot) {
  const explicitAssetId = avatar.characterAssetId?.trim();
  if (explicitAssetId) return explicitAssetId;

  const legacyId = avatar.characterId.trim();
  return LEGACY_CHARACTER_ASSET_IDS[legacyId] ?? legacyId;
}
