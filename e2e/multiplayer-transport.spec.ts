import { expect, test } from "@playwright/test";
import {
  buildSupabaseRealtimeWebSocketUrl,
  realtimeTopicForRoom,
  sanitizeRealtimeRoomId,
} from "../multiplayer/supabase-realtime-transport";
import {
  MULTIPLAYER_TRANSPORT_VERSION,
  isRoomTransportEnvelope,
} from "../multiplayer/transport";

test("P4.3 room ids are sanitized deterministically before becoming realtime topics", () => {
  expect(sanitizeRealtimeRoomId(" Room / QA : 42 ")).toBe("Room-QA-42");
  expect(realtimeTopicForRoom(" Room / QA : 42 ")).toBe("realtime:audition-room:Room-QA-42");
  expect(() => sanitizeRealtimeRoomId("///")).toThrow("roomId must contain at least one safe character");
});

test("Supabase Realtime URL uses native websocket protocol 1.0 with a publishable key", () => {
  const url = new URL(buildSupabaseRealtimeWebSocketUrl(
    "https://example.supabase.co/",
    "sb_publishable_test",
  ));
  expect(url.protocol).toBe("wss:");
  expect(url.pathname).toBe("/realtime/v1/websocket");
  expect(url.searchParams.get("apikey")).toBe("sb_publishable_test");
  expect(url.searchParams.get("vsn")).toBe("1.0.0");
});

test("transport envelope rejects wrong protocol versions and malformed payloads", () => {
  const valid = {
    transportVersion: MULTIPLAYER_TRANSPORT_VERSION,
    roomId: "qa-room",
    senderParticipantId: "host",
    messageId: "message-1",
    payload: { kind: "qa-ping", nonce: "abc" },
  };

  expect(isRoomTransportEnvelope(valid)).toBe(true);
  expect(isRoomTransportEnvelope({ ...valid, transportVersion: 2 })).toBe(false);
  expect(isRoomTransportEnvelope({ ...valid, payload: null })).toBe(false);
  expect(isRoomTransportEnvelope({ ...valid, roomId: "" })).toBe(false);
});

test("P4.3 transport payloads carry room metadata only, not gameplay-turn authority", () => {
  const startEpoch = {
    transportVersion: MULTIPLAYER_TRANSPORT_VERSION,
    roomId: "qa-room",
    senderParticipantId: "host",
    messageId: "message-2",
    payload: {
      kind: "match-start-epoch",
      roomRevision: 7,
      matchId: "match",
      startAtServerMs: 1_000_000,
    },
  };

  expect(isRoomTransportEnvelope(startEpoch)).toBe(true);
  expect("absoluteTurn" in startEpoch.payload).toBe(false);
  expect("songTimeMs" in startEpoch.payload).toBe(false);
});
