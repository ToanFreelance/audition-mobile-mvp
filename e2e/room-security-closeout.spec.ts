import { expect, test } from "@playwright/test";
import { NextRequest } from "next/server";
import { POST as guestPost } from "../app/api/multiplayer/guest-session/route";
import { POST as roomPost } from "../app/api/multiplayer/room/route";
import { claimedRoomActor, GUEST_COOKIE, readGuestActor } from "../lib/room-actor-session";
import { getServerStorageConfig } from "../lib/server-storage";

function request(path: string, body: object = {}, origin = "https://game.test") {
  return new NextRequest("https://game.test" + path, {
    method: "POST", headers: { host: "game.test", origin, "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}
test("guest token is server generated, signed, HTTP-only and cannot be used to claim another participant", async () => {
  const previous = process.env.ROOM_GUEST_SESSION_SECRET;
  process.env.ROOM_GUEST_SESSION_SECRET = "test-only-guest-signing-secret-32-bytes";
  try {
    const issued = await guestPost(request("/api/multiplayer/guest-session", { participantId: "player-forged" }));
    expect(issued.status).toBe(200);
    const { participantId } = await issued.json() as { participantId: string };
    expect(participantId).toMatch(/^guest-/);
    const cookie = issued.cookies.get(GUEST_COOKIE)!;
    expect(cookie.httpOnly).toBe(true);
    const caller = request("/api/multiplayer/room", { action: "ready", roomId: "mvp-test", expectedRevision: 1, participantId: "player-victim", ready: true });
    caller.cookies.set(GUEST_COOKIE, cookie.value);
    expect(readGuestActor(caller)).toBe(participantId);
    expect((await roomPost(caller)).status).toBe(403);
    const tampered = request("/api/multiplayer/guest-session");
    tampered.cookies.set(GUEST_COOKIE, cookie.value.slice(0, -1) + (cookie.value.endsWith("a") ? "b" : "a"));
    expect(readGuestActor(tampered)).toBeNull();
    const reuse = request("/api/multiplayer/guest-session");
    reuse.cookies.set(GUEST_COOKIE, cookie.value);
    expect(await (await guestPost(reuse)).json()).toMatchObject({ participantId });
  } finally {
    if (previous === undefined) delete process.env.ROOM_GUEST_SESSION_SECRET;
    else process.env.ROOM_GUEST_SESSION_SECRET = previous;
  }
});

test("unsigned callers, cross-origin requests, and public QA bootstrap cannot mutate rooms", async () => {
  expect((await roomPost(request("/api/multiplayer/room", { action: "ready", roomId: "mvp-test", participantId: "player-victim" }))).status).toBe(401);
  expect((await roomPost(request("/api/multiplayer/room", { action: "bootstrap", roomId: "qa-test" }))).status).toBe(403);
  expect((await roomPost(request("/api/multiplayer/room", { action: "ready" }, "https://foreign.test"))).status).toBe(403);
  expect((await guestPost(request("/api/multiplayer/guest-session", {}, "https://foreign.test"))).status).toBe(403);
});

test("actor selector distinguishes KICK target and refuses unknown actions", () => {
  expect(claimedRoomActor({ action: "kick", actorParticipantId: "host", participantId: "target" })).toBe("host");
  for (const action of ["create", "join", "ready", "leave"]) expect(claimedRoomActor({ action, participantId: "self" })).toBe("self");
  for (const action of ["close", "host-leave", "recover-host", "transfer-host", "heartbeat", "song", "stage", "mode", "open-slot", "close-slot", "start-preload", "preload-loading", "preload-failed", "loaded", "issue-countdown", "enter-playing"]) {
    expect(claimedRoomActor({ action, actorParticipantId: "self" })).toBe("self");
    expect(claimedRoomActor({ action, participantId: "victim" })).toBeNull();
  }
  expect(claimedRoomActor({ action: "bootstrap" })).toBeNull();
  expect(claimedRoomActor({ action: "unknown", actorParticipantId: "self" })).toBeNull();
});

test("missing or publishable server credential is rejected", () => {
  const prior = process.env.SUPABASE_SERVICE_ROLE_KEY;
  try {
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    expect(getServerStorageConfig()).toBeNull();
    process.env.SUPABASE_SERVICE_ROLE_KEY = "sb_publishable_not_authorized";
    expect(getServerStorageConfig()).toBeNull();
  } finally {
    if (prior === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    else process.env.SUPABASE_SERVICE_ROLE_KEY = prior;
  }
});

test("a signed guest can create only its own valid room through backend storage; invalid mode is rejected before RPC", async () => {
  const prior = {
    secret: process.env.ROOM_GUEST_SESSION_SECRET, key: process.env.SUPABASE_SERVICE_ROLE_KEY,
    url: process.env.SUPABASE_URL, fetch: globalThis.fetch,
  };
  process.env.ROOM_GUEST_SESSION_SECRET = "fixture-only-guest-signing-secret-32";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "sb_secret_fixture_not_a_real_key";
  process.env.SUPABASE_URL = "https://storage-fixture.test";
  let writes = 0;
  globalThis.fetch = async (url, init) => {
    expect(String(url)).toBe("https://storage-fixture.test/rest/v1/rpc/bootstrap_lobby_room");
    expect(new Headers(init?.headers).get("apikey")).toBe("sb_secret_fixture_not_a_real_key");
    const payload = JSON.parse(String(init?.body)) as { p_room_id: string; p_snapshot: { revision: number; hostParticipantId: string } };
    writes++;
    return new Response(JSON.stringify([{ room_id: payload.p_room_id, revision: payload.p_snapshot.revision, snapshot: payload.p_snapshot }]), { status: 200 });
  };
  try {
    const issue = await guestPost(request("/api/multiplayer/guest-session"));
    const identity = await issue.json() as { participantId: string };
    const cookie = issue.cookies.get(GUEST_COOKIE)!;
    const body = { action: "create", roomName: "QA only", participantId: identity.participantId,
      displayName: "QA", characterAssetId: "c1-casual-grace", modeId: "boss-preview" };
    const invalid = request("/api/multiplayer/room", body);
    invalid.cookies.set(GUEST_COOKIE, cookie.value);
    expect((await roomPost(invalid)).status).toBe(400);
    expect(writes).toBe(0);
    const valid = request("/api/multiplayer/room", { ...body, modeId: "solo-easy-battle" });
    valid.cookies.set(GUEST_COOKIE, cookie.value);
    const result = await roomPost(valid);
    expect(result.status).toBe(200);
    expect(await result.json()).toMatchObject({ ok: true, snapshot: { hostParticipantId: identity.participantId } });
    expect(writes).toBe(1);
  } finally {
    globalThis.fetch = prior.fetch;
    for (const [key, value] of Object.entries({ ROOM_GUEST_SESSION_SECRET: prior.secret, SUPABASE_SERVICE_ROLE_KEY: prior.key, SUPABASE_URL: prior.url })) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
  }
});

test("verified account cannot impersonate another member and invalid account token never falls back to guest cookie", async () => {
  const prior = { url: process.env.NEXT_PUBLIC_SUPABASE_URL, key: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    secret: process.env.ROOM_GUEST_SESSION_SECRET, fetch: globalThis.fetch };
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://auth-fixture.test";
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "sb_publishable_fixture";
  process.env.ROOM_GUEST_SESSION_SECRET = "fixture-only-guest-signing-secret-32";
  const uid = "11111111-1111-4111-8111-111111111111";
  let valid = true;
  globalThis.fetch = async url => {
    expect(String(url)).toBe("https://auth-fixture.test/auth/v1/user");
    return new Response(JSON.stringify(valid ? { id: uid, email: null } : {}), { status: valid ? 200 : 401 });
  };
  try {
    const guest = await guestPost(request("/api/multiplayer/guest-session"));
    const identity = await guest.json() as { participantId: string };
    const cookie = guest.cookies.get(GUEST_COOKIE)!;
    const forged = request("/api/multiplayer/room", { action: "heartbeat", roomId: "mvp-test", actorParticipantId: "player-victim" });
    forged.cookies.set("audition_account_access", "fixture");
    expect((await roomPost(forged)).status).toBe(403);
    valid = false;
    const fallback = request("/api/multiplayer/room", { action: "heartbeat", roomId: "mvp-test", actorParticipantId: identity.participantId });
    fallback.cookies.set("audition_account_access", "expired");
    fallback.cookies.set(GUEST_COOKIE, cookie.value);
    expect((await roomPost(fallback)).status).toBe(401);
  } finally {
    globalThis.fetch = prior.fetch;
    for (const [key, value] of Object.entries({ NEXT_PUBLIC_SUPABASE_URL: prior.url, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: prior.key, ROOM_GUEST_SESSION_SECRET: prior.secret })) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
  }
});

test("same host but different scheme and non-origin URL cannot mutate", async () => {
  for (const origin of ["http://game.test", "https://game.test/path", "null", "https://game.test:444"]) {
    expect((await guestPost(request("/api/multiplayer/guest-session", {}, origin))).status).toBe(403);
    expect((await roomPost(request("/api/multiplayer/room", { action: "ready" }, origin))).status).toBe(403);
  }
});
