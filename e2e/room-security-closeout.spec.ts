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
