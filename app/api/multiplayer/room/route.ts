import { NextRequest, NextResponse } from "next/server";
import {
  changeMode,
  changeSong,
  changeStage,
  closeSlot,
  openSlot,
  removeParticipant,
  setGuestReady,
} from "../../../../multiplayer/room-state";
import { isCanonicalRoomSnapshot } from "../../../../multiplayer/room-sync";
import type { RoomSlotIndex, RoomState } from "../../../../multiplayer/types";
import { createP51WaitingRoomFixture } from "../../../../multiplayer/waiting-room-qa";

export const dynamic = "force-dynamic";

type StoredRoomRow = {
  room_id: string;
  revision: number;
  snapshot: RoomState;
};

type CompareAndSwapRow = StoredRoomRow & {
  applied: boolean;
};

type RoomMutationBody =
  | { action: "bootstrap"; roomId: string }
  | { action: "ready"; roomId: string; expectedRevision: number; participantId: string; ready: boolean }
  | { action: "song"; roomId: string; expectedRevision: number; actorParticipantId: string; songId: string }
  | { action: "stage"; roomId: string; expectedRevision: number; actorParticipantId: string; stageId: string }
  | { action: "mode"; roomId: string; expectedRevision: number; actorParticipantId: string; modeId: string }
  | { action: "open-slot"; roomId: string; expectedRevision: number; actorParticipantId: string; slotIndex: RoomSlotIndex }
  | { action: "close-slot"; roomId: string; expectedRevision: number; actorParticipantId: string; slotIndex: RoomSlotIndex }
  | { action: "kick"; roomId: string; expectedRevision: number; actorParticipantId: string; participantId: string };

function jsonError(message: string, status: number, extra?: Record<string, unknown>) {
  return NextResponse.json({ ok: false, error: message, ...extra }, {
    status,
    headers: { "Cache-Control": "no-store, max-age=0" },
  });
}

function roomIdIsSafe(roomId: string) {
  return /^[a-zA-Z0-9_-]{1,64}$/.test(roomId);
}

function getSupabaseServerConfig() {
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return null;
  return {
    url: url.replace(/\/$/, ""),
    key,
  };
}

function dbHeaders(key: string) {
  return {
    apikey: key,
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
  };
}

async function callRoomRpc<T>(functionName: string, body: Record<string, unknown>): Promise<T[]> {
  const config = getSupabaseServerConfig();
  if (!config) throw new Error("Supabase room storage configuration is unavailable.");

  const response = await fetch(`${config.url}/rest/v1/rpc/${functionName}`, {
    method: "POST",
    cache: "no-store",
    headers: dbHeaders(config.key),
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`Room storage RPC ${functionName} failed (${response.status})${detail ? `: ${detail.slice(0, 180)}` : ""}.`);
  }

  return await response.json() as T[];
}

async function readRoom(roomId: string): Promise<StoredRoomRow | null> {
  const rows = await callRoomRpc<StoredRoomRow>("get_lobby_room", {
    p_room_id: roomId,
  });
  return rows[0] ?? null;
}

async function insertInitialRoom(room: RoomState): Promise<StoredRoomRow> {
  const rows = await callRoomRpc<StoredRoomRow>("bootstrap_lobby_room", {
    p_room_id: room.roomId,
    p_snapshot: room,
  });
  const row = rows[0];
  if (!row) throw new Error("Room bootstrap returned no row.");
  return row;
}

async function compareAndSwapRoom(
  current: StoredRoomRow,
  next: RoomState,
): Promise<{ applied: boolean; row: StoredRoomRow | null }> {
  const rows = await callRoomRpc<CompareAndSwapRow>("compare_and_swap_lobby_room", {
    p_room_id: current.room_id,
    p_expected_revision: current.revision,
    p_snapshot: next,
  });
  const result = rows[0];
  if (!result) return { applied: false, row: null };
  return {
    applied: Boolean(result.applied),
    row: {
      room_id: result.room_id,
      revision: result.revision,
      snapshot: result.snapshot,
    },
  };
}

function assertExpectedRevision(row: StoredRoomRow, expectedRevision: number) {
  if (!Number.isInteger(expectedRevision) || expectedRevision < 1) {
    throw new Error("Invalid expected room revision.");
  }
  if (row.revision !== expectedRevision) {
    const conflict = new Error("ROOM_REVISION_CONFLICT");
    (conflict as Error & { current?: RoomState }).current = row.snapshot;
    throw conflict;
  }
}

function requireHost(room: RoomState, actorParticipantId: string) {
  if (actorParticipantId !== room.hostParticipantId) {
    throw new Error("Only the room host can perform this mutation.");
  }
}

function mutateRoom(row: StoredRoomRow, body: Exclude<RoomMutationBody, { action: "bootstrap" }>) {
  assertExpectedRevision(row, body.expectedRevision);
  const room = row.snapshot;
  if (!isCanonicalRoomSnapshot(room)) throw new Error("Stored room snapshot is invalid.");

  switch (body.action) {
    case "ready":
      return setGuestReady(room, body.participantId, body.ready);
    case "song":
      return changeSong(room, body.actorParticipantId, body.songId);
    case "stage":
      return changeStage(room, body.actorParticipantId, body.stageId);
    case "mode":
      return changeMode(room, body.actorParticipantId, body.modeId);
    case "open-slot":
      return openSlot(room, body.actorParticipantId, body.slotIndex);
    case "close-slot":
      return closeSlot(room, body.actorParticipantId, body.slotIndex);
    case "kick":
      requireHost(room, body.actorParticipantId);
      return removeParticipant(room, body.participantId);
  }
}

async function bootstrap(roomId: string) {
  const existing = await readRoom(roomId);
  if (existing) return existing;
  const fixture = createP51WaitingRoomFixture(roomId);
  if (!isCanonicalRoomSnapshot(fixture)) throw new Error("Lobby QA fixture is invalid.");
  return insertInitialRoom(fixture);
}

function parseBody(value: unknown): RoomMutationBody | null {
  if (!value || typeof value !== "object") return null;
  const body = value as Record<string, unknown>;
  if (typeof body.action !== "string" || typeof body.roomId !== "string") return null;
  if (!roomIdIsSafe(body.roomId)) return null;
  return body as RoomMutationBody;
}

export async function GET(request: NextRequest) {
  const roomId = request.nextUrl.searchParams.get("roomId")?.trim() ?? "";
  if (!roomIdIsSafe(roomId)) return jsonError("Invalid roomId.", 400);
  if (!getSupabaseServerConfig()) return jsonError("Supabase room storage configuration is unavailable.", 503);

  try {
    const row = await readRoom(roomId);
    if (!row) return jsonError("Room not found.", 404);
    return NextResponse.json({ ok: true, snapshot: row.snapshot }, {
      headers: { "Cache-Control": "no-store, max-age=0" },
    });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Room read failed.", 500);
  }
}

export async function POST(request: NextRequest) {
  if (!getSupabaseServerConfig()) return jsonError("Supabase room storage configuration is unavailable.", 503);

  let body: RoomMutationBody | null = null;
  try {
    body = parseBody(await request.json());
  } catch {
    return jsonError("Invalid JSON body.", 400);
  }
  if (!body) return jsonError("Invalid room mutation payload.", 400);

  try {
    if (body.action === "bootstrap") {
      const row = await bootstrap(body.roomId);
      return NextResponse.json({ ok: true, snapshot: row.snapshot }, {
        headers: { "Cache-Control": "no-store, max-age=0" },
      });
    }

    const current = await readRoom(body.roomId);
    if (!current) return jsonError("Room not found.", 404);

    const next = mutateRoom(current, body);
    if (next === current.snapshot || next.revision === current.revision) {
      return NextResponse.json({ ok: true, snapshot: current.snapshot }, {
        headers: { "Cache-Control": "no-store, max-age=0" },
      });
    }

    if (next.roomId !== current.room_id || next.revision !== current.revision + 1 || !isCanonicalRoomSnapshot(next)) {
      throw new Error("Server mutation produced an invalid room snapshot.");
    }

    const result = await compareAndSwapRoom(current, next);
    if (!result.row) {
      return jsonError("Room disappeared during update.", 404);
    }
    if (!result.applied) {
      return jsonError("Room revision conflict.", 409, { snapshot: result.row.snapshot });
    }

    return NextResponse.json({ ok: true, snapshot: result.row.snapshot }, {
      headers: { "Cache-Control": "no-store, max-age=0" },
    });
  } catch (error) {
    const current = (error as Error & { current?: RoomState }).current;
    if (error instanceof Error && error.message === "ROOM_REVISION_CONFLICT") {
      return jsonError("Room revision conflict.", 409, { snapshot: current ?? null });
    }
    return jsonError(error instanceof Error ? error.message : "Room mutation failed.", 400);
  }
}
