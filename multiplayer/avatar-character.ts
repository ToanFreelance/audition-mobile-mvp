import type { AvatarSnapshot } from "./types";

/**
 * Canonical runtime character identity for lobby presentation.
 *
 * P5.6 introduces characterAssetId while retaining characterId as a migration
 * fallback for older persisted RoomState snapshots. New snapshots should write
 * both until the stored-room migration is complete.
 */
export function avatarCharacterAssetId(avatar: AvatarSnapshot) {
  return avatar.characterAssetId?.trim() || avatar.characterId.trim();
}
