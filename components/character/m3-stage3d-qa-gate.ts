import { CHARACTER_CATALOG_VERSION, getCharacterCatalogEntry, isCharacterAssetId, type CharacterAssetId } from "./character-catalog";
import { parseM3LobbyAppearance, roomContainsNonPlayableCharacter } from "./m3-lobby-appearance";
import { avatarCharacterAssetId } from "../../multiplayer/avatar-character";
import type { AvatarSnapshot, M3LobbyAppearance, MatchManifest, RoomState } from "../../multiplayer/types";

/** Frozen QA handshake; does not unlock Character Catalog runtimeReady. */
export const M3_STAGE3D_QA_RUNTIME_VERSION =
  "character-catalog:v" + CHARACTER_CATALOG_VERSION + ":m3-stage3d-step3.1-qa";

/** Only the M3 work-branch Preview hostname or localhost can use this QA contract. */
export function isM3Stage3dQaPreviewHost(hostname: string): boolean {
  return /^audition-mobile-mvp-git-work-m3-[a-z0-9-]+\.vercel\.app$/.test(hostname)
    || hostname === "localhost" || hostname === "127.0.0.1";
}

/** Per-device opt-in only on the M3 work-branch Preview and local development. */
export function isM3Stage3dQaOptIn(hostname: string, search: string): boolean {
  return isM3Stage3dQaPreviewHost(hostname)
    && new URLSearchParams(search).get("m3GameplayQa") === "1";
}

export function isM3CatalogAvatar(avatar: AvatarSnapshot): boolean {
  return Boolean(getCharacterCatalogEntry(avatarCharacterAssetId(avatar))?.m3RigFamily);
}

/** Canonical MatchManifest identity/look, never player name, gender or local draft. */
export function resolveM3Stage3dAvatar(
  avatar: AvatarSnapshot, qaEnabled: boolean,
): { assetId: CharacterAssetId; appearance: M3LobbyAppearance } | null {
  const rawId = avatarCharacterAssetId(avatar);
  if (!isCharacterAssetId(rawId)) throw new Error("Unknown frozen MatchManifest characterAssetId.");
  const entry = getCharacterCatalogEntry(rawId);
  if (!entry?.m3RigFamily) {
    if (!entry?.runtimeReady) throw new Error("Character is not available in gameplay.");
    return null;
  }
  if (!qaEnabled) throw new Error("M3 Stage3D requires explicit Step 3.1 QA opt-in.");
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
 * The API POST does not inherit the Waiting Room URL query. Its M3 QA gate
 * must verify the frozen manifest marker on the server against the actual
 * Preview hostname and authoritative RoomState. Production stays locked.
 */
export function assertM3Stage3dServerStartGate(
  hostname: string, room: RoomState, manifest: MatchManifest,
): void {
  const roomAvatars = room.participants.map(participant => participant.avatar);
  const hasM3 = roomAvatars.some(isM3CatalogAvatar);
  const frozenQa = manifest.content.characterRuntimeVersion === M3_STAGE3D_QA_RUNTIME_VERSION;

  if (!hasM3) {
    if (roomContainsNonPlayableCharacter(roomAvatars)) {
      throw new Error("Character gameplay runtime is not ready.");
    }
    if (frozenQa) throw new Error("M3 QA MatchManifest cannot start without M3 participants.");
    return;
  }

  if (!isM3Stage3dQaPreviewHost(hostname) || !frozenQa) {
    throw new Error("M3 START requires the isolated Preview hostname and frozen Step 3.1 QA marker.");
  }
  if (roomContainsNonPlayableCharacter(roomAvatars, true)) {
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
    const canonicalM3 = resolveM3Stage3dAvatar(participant.avatar, true);
    const frozenM3 = resolveM3Stage3dAvatar(frozen.avatar, true);
    if (Boolean(canonicalM3) !== Boolean(frozenM3)
      || (canonicalM3 && frozenM3
        && JSON.stringify(canonicalM3.appearance) !== JSON.stringify(frozenM3.appearance))) {
      throw new Error("M3 START blocked: frozen M3 wardrobe differs from RoomState.");
    }
  }
}
