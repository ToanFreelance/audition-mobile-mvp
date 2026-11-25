"use client";

import {
  loadCharacterCreationDraft,
  type CharacterCreationProfileV1,
} from "../character/character-profile";

const PARTICIPANT_KEY = "audition.entryParticipantId.v1";
const ID_PATTERN = /^player-[0-9a-f-]{36}$/;

export type EntryIdentity = {
  participantId: string;
  profile: CharacterCreationProfileV1;
};

/**
 * Local MVP identity until account/auth Phase 7.
 * The same browser keeps one participant ID through room switches/reloads.
 * This is NOT a verified account credential or an authorization token.
 */
export function getEntryIdentity(): EntryIdentity | null {
  try {
    const profile = loadCharacterCreationDraft(window.localStorage);
    if (!profile) return null;
    let participantId = window.localStorage.getItem(PARTICIPANT_KEY) ?? "";
    if (!ID_PATTERN.test(participantId)) {
      participantId = "player-" + crypto.randomUUID();
      window.localStorage.setItem(PARTICIPANT_KEY, participantId);
    }
    return { participantId, profile };
  } catch {
    return null;
  }
}

export function isEntryRoomId(roomId: string) {
  return /^mvp-[a-zA-Z0-9_-]{1,60}$/.test(roomId);
}

/** The local draft is presentation data; guest authority is the HttpOnly
 * cookie issued by the server. Old unsigned IDs cannot be claimed. */
export async function resolveGuestEntryIdentity(): Promise<EntryIdentity | null> {
  const local = getEntryIdentity();
  if (!local) return null;
  const response = await fetch("/api/multiplayer/guest-session", {
    method: "POST", credentials: "same-origin", cache: "no-store",
  });
  const data = await response.json() as { ok?: boolean; participantId?: string; error?: string };
  if (!response.ok || !data.ok || !data.participantId || !/^guest-[0-9a-f-]{36}$/.test(data.participantId)) {
    throw new Error(data.error ?? "Không thể xác minh phiên khách.");
  }
  return { participantId: data.participantId, profile: local.profile };
}
