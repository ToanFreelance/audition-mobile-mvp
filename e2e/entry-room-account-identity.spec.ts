import { expect, test } from "@playwright/test";
import { resolveWaitingRoomIdentity, roomAvatarMatchesSavedIdentity } from "../components/entry/entry-room-identity";
import type { RoomParticipant } from "../multiplayer/types";
import type { EntryIdentity } from "../components/entry/entry-session";

const userId = "11111111-1111-4111-8111-111111111111";
const maleLook = {
  hairStyle: "hair2", hairColor: "yellow", skinTone: "tone3skin",
  m3Outfit: { top: "simpleshirt", bottom: "shorts" },
};
const femaleLook = {
  hairStyle: "curledbangs", hairColor: "red", skinTone: "tone4skin",
  m3Outfit: { top: "lightshirt", bottom: "sportshorts" },
};
const identity: EntryIdentity = {
  participantId: "player-" + userId,
  profile: { name: "QA Male", characterAssetId: "m3-neurohacker",
    gender: "male", face: "original", ...maleLook } as EntryIdentity["profile"],
};
function participant(assetId: string, appearance: unknown = maleLook): RoomParticipant {
  return {
    participantId: identity.participantId, role: "host", kind: "human", slotIndex: 0,
    displayName: "QA Male", readyState: "not-applicable",
    loadState: "idle", connectionState: "connected",
    avatar: { characterId: assetId, characterAssetId: assetId,
      m3Appearance: appearance as RoomParticipant["avatar"]["m3Appearance"],
      outfit: {}, accessoryIds: [] },
  };
}
test("Waiting Room authenticates account and uses its exact Room Browser participant ID", async () => {
  const original = globalThis.fetch;
  const called: string[] = [];
  globalThis.fetch = async (request, init) => {
    const path = String(request);
    called.push(path);
    expect(init?.cache).toBe("no-store");
    if (path === "/api/auth") return new Response(JSON.stringify({
      authenticated: true, user: { id: userId },
    }), { status: 200 });
    if (path === "/api/account/character") return new Response(JSON.stringify({
      ok: true, profile: identity.profile,
    }), { status: 200 });
    throw new Error("Unexpected request");
  };
  try {
    const data = await resolveWaitingRoomIdentity();
    expect(data.kind).toBe("account");
    expect(data.identity?.participantId).toBe(identity.participantId);
    expect(data.identity?.profile.characterAssetId).toBe("m3-neurohacker");
    expect(called).toEqual(["/api/auth", "/api/account/character"]);
  } finally { globalThis.fetch = original; }
});

test("Waiting Room fails closed if auth service fails; never falls back to stale guest data", async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async () => new Response("Unavailable", { status: 503 });
  try {
    await expect(resolveWaitingRoomIdentity()).rejects.toThrow("Không thể kiểm tra");
  } finally { globalThis.fetch = original; }
});

test("saved male rig/appearance rejects historical female RoomState actor", () => {
  expect(roomAvatarMatchesSavedIdentity(participant("m3-neurohacker"), identity)).toBe(true);
  expect(roomAvatarMatchesSavedIdentity(participant("m3-drophunter", femaleLook), identity)).toBe(false);
  expect(roomAvatarMatchesSavedIdentity(participant("m3-neurohacker", { ...maleLook,
    m3Outfit: { top: "logotee", bottom: "shorts" } }), identity)).toBe(false);
});


import { roomPortraitKey, readRoomPortrait, writeRoomPortrait } from "../components/entry/room-profile-portrait";
import type { CharacterCreationProfileV1 } from "../components/character/character-profile";

test("room portrait cache is exact to rig and look, not account name", () => {
  const p: CharacterCreationProfileV1 = {
    version: 1, name: "First", gender: "female", characterAssetId: "m3-drophunter",
    hairStyle: "short", hairColor: "red", skinTone: "originalskin", face: "basic-01",
    m3Outfit: { top: "lightshirt", bottom: "sportshorts" },
  };
  const key = roomPortraitKey(p)!;
  expect(key).toBeTruthy();
  expect(roomPortraitKey({ ...p, name: "Other" })).toBe(key);
  expect(roomPortraitKey({ ...p, hairColor: "black" })).not.toBe(key);
  expect(roomPortraitKey({ ...p, skinTone: "tone2skin" })).not.toBe(key);
  expect(roomPortraitKey({ ...p, hairStyle: "invalid" })).toBeNull();
  const stored = new Map<string, string>();
  const storage = { getItem: (k: string) => stored.get(k) ?? null, setItem: (k: string, v: string) => { stored.set(k, v); } };
  const image = "data:image/png;base64,AA==";
  writeRoomPortrait(storage, key, image);
  expect(readRoomPortrait(storage, key)).toBe(image);
  expect(readRoomPortrait(storage, roomPortraitKey({ ...p, hairColor: "black" })!)).toBeNull();
  expect([...stored.values()].join("")).not.toContain("First");
});
