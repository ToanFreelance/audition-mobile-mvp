import { CHARACTER_CATALOG_VERSION, getCharacterCatalogEntry, isCharacterAssetId, type CharacterAssetId } from "./character-catalog";
import { parseM3LobbyAppearance } from "./m3-lobby-appearance";
import { avatarCharacterAssetId } from "../../multiplayer/avatar-character";
import type { AvatarSnapshot, M3LobbyAppearance } from "../../multiplayer/types";

/** Frozen QA handshake; does not unlock Character Catalog runtimeReady. */
export const M3_STAGE3D_QA_RUNTIME_VERSION =
  "character-catalog:v" + CHARACTER_CATALOG_VERSION + ":m3-stage3d-step3.1-qa";

/** Per-device opt-in only on the M3 work-branch Preview and local development. */
export function isM3Stage3dQaOptIn(hostname: string, search: string): boolean {
  const isolated = /^audition-mobile-mvp-git-work-m3-[a-z0-9-]+\.vercel\.app$/.test(hostname)
    || hostname === "localhost" || hostname === "127.0.0.1";
  return isolated && new URLSearchParams(search).get("m3GameplayQa") === "1";
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
