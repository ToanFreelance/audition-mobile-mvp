import { CHARACTER_CATALOG_VERSION, getCharacterCatalogEntry, isCharacterAssetId, type CharacterAssetId } from "./character-catalog";
import { parseM3LobbyAppearance, roomContainsNonPlayableCharacter } from "./m3-lobby-appearance";
import { avatarCharacterAssetId } from "../../multiplayer/avatar-character";
import type { AvatarSnapshot, M3LobbyAppearance, MatchManifest, RoomState } from "../../multiplayer/types";

/** Legacy frozen QA version; retained for already-created matches/older Preview clients. */
export const M3_STAGE3D_QA_RUNTIME_VERSION =
  "character-catalog:v" + CHARACTER_CATALOG_VERSION + ":m3-stage3d-step3.1-qa";

/** Only the M3 work-branch Preview hostname or localhost can use this QA contract. */
export function isM3Stage3dQaPreviewHost(hostname: string): boolean {
  return /^audition-mobile-mvp-git-work-m3-[a-z0-9-]+\.vercel\.app$/.test(hostname)
    || hostname === "localhost" || hostname === "127.0.0.1";
}

/** Owner-approved normal M3 runtime; new manifests never require a URL flag. */
export const M3_STAGE3D_RUNTIME_VERSION =
  "character-catalog:v" + CHARACTER_CATALOG_VERSION + ":m3-stage3d-v1";

export function isM3Stage3dRuntimeVersion(version: string): boolean {
  return version === M3_STAGE3D_RUNTIME_VERSION || version === M3_STAGE3D_QA_RUNTIME_VERSION;
}

export function isM3CatalogAvatar(avatar: AvatarSnapshot): boolean {
  return Boolean(getCharacterCatalogEntry(avatarCharacterAssetId(avatar))?.m3RigFamily);
}

/** Canonical MatchManifest identity/look, never player name, gender or local draft. */
export function resolveM3Stage3dAvatar(
  avatar: AvatarSnapshot,
): { assetId: CharacterAssetId; appearance: M3LobbyAppearance } | null {
  const rawId = avatarCharacterAssetId(avatar);
  if (!isCharacterAssetId(rawId)) throw new Error("Unknown frozen MatchManifest characterAssetId.");
  const entry = getCharacterCatalogEntry(rawId);
  if (!entry?.m3RigFamily) {
    if (!entry?.runtimeReady) throw new Error("Character is not available in gameplay.");
    return null;
  }
  if (!entry.runtimeReady) throw new Error("M3 Stage3D runtime is not available in gameplay.");
  const appearance = parseM3LobbyAppearance(rawId, avatar.m3Appearance);
  if (!appearance) throw new Error("Invalid frozen M3 wardrobe/appearance in MatchManifest.");
  return { assetId: rawId, appearance };
}

/** Stable actor key across cloned/Reatime-frozen snapshots; status updates do not remount mixers. */
export function frozenStageActorIdentityKey(avatar: AvatarSnapshot): string {
  const look = avatar.m3Appearance;
  return JSON.stringify([
    avatarCharacterAssetId(avatar),
    look?.hairStyle ?? null,
    look?.hairColor ?? null,
    look?.skinTone ?? null,
    look?.m3Outfit.top ?? null,
    look?.m3Outfit.bottom ?? null,
  ]);
}

/**
 * Validate normal M3 runtime identity and exact authoritative wardrobe.
 * The old QA marker is only accepted on its original Preview/local origin.
 * No URL opt-in is needed for a normal runtime-ready M3 match.
 */
export function assertM3Stage3dServerStartGate(
  hostname: string, room: RoomState, manifest: MatchManifest,
): void {
  const roomAvatars = room.participants.map(participant => participant.avatar);
  const hasM3 = roomAvatars.some(isM3CatalogAvatar);
  const version = manifest.content.characterRuntimeVersion;
  const frozenQa = version === M3_STAGE3D_QA_RUNTIME_VERSION;

  if (!hasM3) {
    if (roomContainsNonPlayableCharacter(roomAvatars)) {
      throw new Error("Character gameplay runtime is not ready.");
    }
    if (isM3Stage3dRuntimeVersion(version)) throw new Error("M3 MatchManifest cannot start without M3 participants.");
    return;
  }

  if (!isM3Stage3dRuntimeVersion(version) || (frozenQa && !isM3Stage3dQaPreviewHost(hostname))) {
    throw new Error("M3 START requires a supported frozen M3 runtime version.");
  }
  if (roomContainsNonPlayableCharacter(roomAvatars)) {
    throw new Error("M3 START blocked: invalid canonical character or wardrobe.");
  }
  if (manifest.participants.length !== room.participants.length) {
    throw new Error("M3 START blocked: frozen participant count differs from RoomState.");
  }

  for (const participant of room.participants) {
    const frozen = manifest.participants.find(item => item.participantId === participant.participantId);
    if (!frozen || frozen.kind !== participant.kind || frozen.role !== participant.role
      || frozen.slotIndex !== participant.slotIndex
      || avatarCharacterAssetId(frozen.avatar) !== avatarCharacterAssetId(participant.avatar)) {
      throw new Error("M3 START blocked: frozen participant identity differs from RoomState.");
    }
    const canonicalM3 = resolveM3Stage3dAvatar(participant.avatar);
    const frozenM3 = resolveM3Stage3dAvatar(frozen.avatar);
    if (Boolean(canonicalM3) !== Boolean(frozenM3)
      || (canonicalM3 && frozenM3
        && JSON.stringify(canonicalM3.appearance) !== JSON.stringify(frozenM3.appearance))) {
      throw new Error("M3 START blocked: frozen M3 wardrobe differs from RoomState.");
    }
  }
}
