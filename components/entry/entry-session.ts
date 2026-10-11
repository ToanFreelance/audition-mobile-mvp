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
