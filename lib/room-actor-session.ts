import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { hasAccountCredentials, resolveAccountSession, type AccountSession } from "./account-auth";

export const GUEST_COOKIE = "audition_room_guest_v1";
const TTL_SECONDS = 30 * 24 * 60 * 60;
const guestPattern = /^guest-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
function secret() {
  const key = process.env.ROOM_GUEST_SESSION_SECRET;
  if (!key || Buffer.byteLength(key) < 32) throw new Error("Guest session configuration unavailable.");
  return key;
}
function signature(payload: string) {
  return createHmac("sha256", secret()).update("audition-room-guest-v1:" + payload).digest("base64url");
}

export function readGuestActor(request: NextRequest): string | null {
  const token = request.cookies.get(GUEST_COOKIE)?.value;
  if (!token || token.length > 256) return null;
  const parts = token.split(".");
  if (parts.length !== 3 || !guestPattern.test(parts[0]) || !/^\d{1,12}$/.test(parts[1])) return null;
  const expiry = Number(parts[1]);
  const now = Math.floor(Date.now() / 1000);
  if (expiry <= now || expiry > now + TTL_SECONDS) return null;
  const expected = Buffer.from(signature(parts[0] + "." + parts[1]));
  const supplied = Buffer.from(parts[2]);
  return supplied.length === expected.length && timingSafeEqual(supplied, expected) ? parts[0] : null;
}

// Never adopt a caller-supplied or legacy localStorage ID. Issue a new
// server-generated ID in a disjoint namespace from authenticated accounts.
export function issueGuestActor(response: NextResponse, participantId: string) {
  if (!guestPattern.test(participantId)) throw new Error("Invalid guest identity.");
  const payload = participantId + "." + (Math.floor(Date.now() / 1000) + TTL_SECONDS);
  response.cookies.set(GUEST_COOKIE, payload + "." + signature(payload), {
    httpOnly: true, secure: process.env.NODE_ENV === "production",
    sameSite: "lax", path: "/", maxAge: TTL_SECONDS,
  });
  return response;
}
export function newGuestActor() { return "guest-" + randomUUID(); }

export type RoomActor = { participantId: string; account: AccountSession | null };
export async function resolveRoomActor(request: NextRequest): Promise<RoomActor | null> {
  // Never fall back from an invalid/expired account cookie to a guest.
  if (hasAccountCredentials(request)) {
    const account = await resolveAccountSession(request);
    return account ? { participantId: "player-" + account.user.id, account } : null;
  }
  const participantId = readGuestActor(request);
  return participantId ? { participantId, account: null } : null;
}

// Every mutation uses one of these explicit identity fields. KICK's
// participantId is the target, not the caller. Fixture bootstrap is not public.
export function claimedRoomActor(body: Record<string, unknown>): string | null {
  switch (body.action) {
    case "create": case "join": case "ready": case "leave":
      return typeof body.participantId === "string" ? body.participantId : null;
    case "close": case "host-leave": case "recover-host": case "transfer-host":
    case "heartbeat": case "song": case "stage": case "mode":
    case "open-slot": case "close-slot": case "kick": case "start-preload":
    case "preload-loading": case "preload-failed": case "loaded":
    case "issue-countdown": case "enter-playing":
      return typeof body.actorParticipantId === "string" ? body.actorParticipantId : null;
    default: return null;
  }
}
