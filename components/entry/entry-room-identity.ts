"use client";

import { resolveGuestEntryIdentity, type EntryIdentity } from "./entry-session";
import { avatarCharacterAssetId } from "../../multiplayer/avatar-character";
import { parseM3LobbyAppearance } from "../character/m3-lobby-appearance";
import { getCharacterCatalogEntry } from "../character/character-catalog";
import type { RoomParticipant } from "../../multiplayer/types";

export type WaitingRoomIdentity = {
  identity: EntryIdentity | null;
  kind: "account" | "guest";
};

/**
 * Room Browser uses player-<Supabase user ID> for authenticated accounts.
 * Waiting Room MUST resolve that same identity instead of reading the
 * legacy guest-only localStorage identity (which caused Creator redirects).
 */
export async function resolveWaitingRoomIdentity(): Promise<WaitingRoomIdentity> {
  const authResponse = await fetch("/api/auth", {
    credentials: "same-origin", cache: "no-store",
  });
  if (!authResponse.ok) throw new Error("Không thể kiểm tra phiên tài khoản.");
  const auth = await authResponse.json() as {
    authenticated?: boolean; user?: { id?: string };
  };
  if (auth.authenticated) {
    const userId = auth.user?.id;
    if (!userId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(userId)) {
      throw new Error("Danh tính tài khoản không hợp lệ.");
    }
    const response = await fetch("/api/account/character", {
      credentials: "same-origin", cache: "no-store",
    });
    if (!response.ok) throw new Error("Không đọc được nhân vật đã lưu của tài khoản.");
    const result = await response.json() as {
      ok?: boolean; profile?: EntryIdentity["profile"] | null;
    };
    if (!result.ok) throw new Error("Hồ sơ nhân vật tài khoản chưa sẵn sàng.");
    return {
      kind: "account",
      identity: result.profile ? { participantId: "player-" + userId, profile: result.profile } : null,
    };
  }
  return { kind: "guest", identity: await resolveGuestEntryIdentity() };
}

/** Prevent wrong 3D rig/outfit after account reset, migration or old room links.
 * The server-owned current account profile is authoritative; room snapshots
 * are historical and must not override the player's current character.
 */
export function roomAvatarMatchesSavedIdentity(
  member: RoomParticipant,
  identity: EntryIdentity,
): boolean {
  const savedId = identity.profile.characterAssetId;
  const roomId = avatarCharacterAssetId(member.avatar);
  if (roomId !== savedId) return false;
  const catalog = getCharacterCatalogEntry(savedId);
  if (!catalog?.m3RigFamily) return true;
  const savedLook = parseM3LobbyAppearance(savedId, identity.profile);
  const roomLook = parseM3LobbyAppearance(savedId, member.avatar.m3Appearance);
  if (!savedLook || !roomLook) return false;
  return JSON.stringify(savedLook) === JSON.stringify(roomLook);
}
