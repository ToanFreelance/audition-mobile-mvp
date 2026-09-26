import { NextRequest, NextResponse } from "next/server";
import {
  addParticipant,
  changeMode,
  changeSong,
  changeStage,
  closeSlot,
  openSlot,
  removeParticipant,
  setGuestReady,
} from "../../../../multiplayer/room-state";
import {
  applyLobbyLoadedAck,
  beginLobbyCountdown,
  beginLobbyPlaying,
  beginLobbyPreload,
  markLobbyParticipantLoadFailed,
  markLobbyParticipantLoading,
} from "../../../../multiplayer/lobby-start-handoff";
import type { MatchLoadedAck } from "../../../../multiplayer/match-start-protocol";
import { isCanonicalRoomSnapshot } from "../../../../multiplayer/room-sync";
import type { HumanGuestParticipant, MatchManifest, RoomSlotIndex, RoomState } from "../../../../multiplayer/types";
import { createP53SyncedWaitingRoomBase } from "../../../../multiplayer/waiting-room-qa";

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
  | {
      action: "join";
      roomId: string;
      expectedRevision: number;
      participantId: string;
      displayName: string;
      slotIndex: RoomSlotIndex;
      characterId: string;
      characterAssetId?: string;
    }
  | { action: "ready"; roomId: string; expectedRevision: number; participantId: string; ready: boolean }
  | { action: "leave"; roomId: string; expectedRevision: number; participantId: string }
  | { action: "song"; roomId: string; expectedRevision: number; actorParticipantId: string; songId: string }
  | { action: "stage"; roomId: string; expectedRevision: number; actorParticipantId: string; stageId: string }
  | { action: "mode"; roomId: string; expectedRevision: number; actorParticipantId: string; modeId: string }
  | { action: "open-slot"; roomId: string; expectedRevision: number; actorParticipantId: string; slotIndex: RoomSlotIndex }
  | { action: "close-slot"; roomId: string; expectedRevision: number; actorParticipantId: string; slotIndex: RoomSlotIndex }
  | { action: "kick"; roomId: string; expectedRevision: number; actorParticipantId: string; participantId: string }
  | {
      action: "start-preload";
      roomId: string;
      expectedRevision: number;
      actorParticipantId: string;
      startRevision: number;
      manifest: MatchManifest;
    }
  | {
      action: "preload-loading";
      roomId: string;
      expectedRevision: number;
      actorParticipantId: string;
      matchId: string;
      roomRevision: number;
      startRevision: number;
    }
  | {
      action: "preload-failed";
      roomId: string;
      expectedRevision: number;
      actorParticipantId: string;
      matchId: string;
      roomRevision: number;
      startRevision: number;
    }
  | {
      action: "loaded";
      roomId: string;
      expectedRevision: number;
      actorParticipantId: string;
      ack: MatchLoadedAck;
    }
  | {
      action: "issue-countdown";
      roomId: string;
      expectedRevision: number;
      actorParticipantId: string;
      matchId: string;
      roomRevision: number;
      startRevision: number;
    }
  | {
      action: "enter-playing";
      roomId: string;
      expectedRevision: number;
      actorParticipantId: string;
      matchId: string;
      roomRevision: number;
      startRevision: number;
    };

function jsonError(message: string, status: number, extra?: Record<string, unknown>) {
  return NextResponse.json({ ok: false, error: message, ...extra }, {
    status,
    headers: { "Cache-Control": "no-store, max-age=0" },
  });
}

function jsonConflict(snapshot: RoomState) {
  return NextResponse.json({
    ok: true,
    conflict: true,
    snapshot,
  }, {
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

function joinHumanGuest(
  room: RoomState,
  body: Extract<RoomMutationBody, { action: "join" }>,
): RoomState {
  if (room.status !== "waiting") throw new Error("Participants can only join a waiting room.");
  if (!body.participantId.trim() || body.participantId === room.hostParticipantId) {
    throw new Error("Invalid guest participant id.");
  }
  if (!body.displayName.trim()) throw new Error("Guest display name is required.");
  if (!Number.isInteger(body.slotIndex) || body.slotIndex < 0 || body.slotIndex > 5) {
    throw new Error("Invalid guest slot.");
  }

  const existing = room.participants.find(item => item.participantId === body.participantId);
  if (existing) {
    if (existing.kind === "human" && existing.role === "guest" && existing.slotIndex === body.slotIndex) {
      return room;
    }
    throw new Error("Participant id is already used by another room member.");
  }

  const participant: HumanGuestParticipant = {
    participantId: body.participantId,
    displayName: body.displayName.trim().slice(0, 32),
    kind: "human",
    role: "guest",
    slotIndex: body.slotIndex,
    readyState: "not-ready",
    loadState: "idle",
    connectionState: "connected",
    avatar: {
      characterId: body.characterId.trim() || "default-female",
      characterAssetId: body.characterAssetId?.trim() || undefined,
      outfit: {},
      accessoryIds: [],
      petId: null,
      titleId: null,
    },
  };

  return addParticipant(room, participant);
}

function leaveHumanGuest(
  room: RoomState,
  body: Extract<RoomMutationBody, { action: "leave" }>,
): RoomState {
  if (room.status !== "waiting") throw new Error("Participants can only leave a waiting room.");
  const participant = room.participants.find(item => item.participantId === body.participantId);
  if (!participant) return room;
  if (participant.kind !== "human" || participant.role !== "guest") {
    throw new Error("Only a human guest can leave through this action.");
  }
  return removeParticipant(room, participant.participantId);
}

function mutateRoom(row: StoredRoomRow, body: Exclude<RoomMutationBody, { action: "bootstrap" }>) {
  assertExpectedRevision(row, body.expectedRevision);
  const room = row.snapshot;
  if (!isCanonicalRoomSnapshot(room)) throw new Error("Stored room snapshot is invalid.");

  switch (body.action) {
    case "join":
      return joinHumanGuest(room, body);
    case "ready":
      return setGuestReady(room, body.participantId, body.ready);
    case "leave":
      return leaveHumanGuest(room, body);
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
    case "start-preload":
      return beginLobbyPreload(
        room,
        body.actorParticipantId,
        body.manifest,
        body.startRevision,
      ).room;
    case "preload-loading":
      return markLobbyParticipantLoading(
        room,
        body.actorParticipantId,
        {
          matchId: body.matchId,
          roomRevision: body.roomRevision,
          startRevision: body.startRevision,
        },
      ).room;
    case "preload-failed":
      return markLobbyParticipantLoadFailed(
        room,
        body.actorParticipantId,
        {
          matchId: body.matchId,
          roomRevision: body.roomRevision,
          startRevision: body.startRevision,
        },
      ).room;
    case "loaded": {
      const result = applyLobbyLoadedAck(room, body.actorParticipantId, body.ack);
      if (!result.accepted) throw new Error(`LOADED_ACK_REJECTED:${result.reason}`);
      return result.room;
    }
    case "issue-countdown":
      return beginLobbyCountdown(
        room,
        body.actorParticipantId,
        {
          matchId: body.matchId,
          roomRevision: body.roomRevision,
          startRevision: body.startRevision,
        },
        Date.now(),
      ).room;
    case "enter-playing":
      return beginLobbyPlaying(
        room,
        body.actorParticipantId,
        {
          matchId: body.matchId,
          roomRevision: body.roomRevision,
          startRevision: body.startRevision,
        },
        Date.now(),
      ).room;
  }
}

async function bootstrap(roomId: string) {
  const existing = await readRoom(roomId);
  if (existing) return existing;
  const baseRoom = createP53SyncedWaitingRoomBase(roomId);
  if (!isCanonicalRoomSnapshot(baseRoom)) throw new Error("Synced lobby bootstrap is invalid.");
  return insertInitialRoom(baseRoom);
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
      return jsonConflict(result.row.snapshot);
    }

    return NextResponse.json({ ok: true, snapshot: result.row.snapshot }, {
      headers: { "Cache-Control": "no-store, max-age=0" },
    });
  } catch (error) {
    const current = (error as Error & { current?: RoomState }).current;
    if (error instanceof Error && error.message === "ROOM_REVISION_CONFLICT" && current) {
      return jsonConflict(current);
    }
    return jsonError(error instanceof Error ? error.message : "Room mutation failed.", 400);
  }
}
