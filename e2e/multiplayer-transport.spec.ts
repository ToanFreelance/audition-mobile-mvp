import { expect, test } from "@playwright/test";
import {
  SupabaseRealtimeRoomTransport,
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

test("P4.4 transport carries versioned Loaded/start metadata without gameplay authority", () => {
  const loadedAck = {
    transportVersion: MULTIPLAYER_TRANSPORT_VERSION,
    roomId: "qa-room",
    senderParticipantId: "guest",
    messageId: "message-3",
    payload: {
      kind: "match-loaded-ack",
      ack: {
        protocolVersion: 1,
        roomId: "qa-room",
        matchId: "match",
        roomRevision: 7,
        startRevision: 2,
        participantId: "guest",
        content: {
          manifestVersion: 1,
          audioVersion: "audio-v1",
          audioHash: "sha256:audio-v1",
          chartVersion: "chart-v1",
          chartHash: "sha256:chart-v1",
          gameplayConfigVersion: "solo-easy-v1",
          gameplayConfigHash: "sha256:solo-easy-v1",
          characterRuntimeVersion: "character-runtime-v1",
          animationReleaseVersion: 3,
          animationReleaseHash: "sha256:animation-v3",
          characterReadiness: "ready",
          animationReadiness: "fallback-ready",
        },
      },
    },
  };

  const versionedEpoch = {
    transportVersion: MULTIPLAYER_TRANSPORT_VERSION,
    roomId: "qa-room",
    senderParticipantId: "host",
    messageId: "message-4",
    payload: {
      kind: "match-start-epoch-v2",
      roomRevision: 7,
      matchId: "match",
      startRevision: 2,
      startAtServerMs: 1_005_000,
    },
  };

  expect(isRoomTransportEnvelope(loadedAck)).toBe(true);
  expect(isRoomTransportEnvelope(versionedEpoch)).toBe(true);
  expect("absoluteTurn" in loadedAck.payload).toBe(false);
  expect("judgement" in loadedAck.payload).toBe(false);
  expect("absoluteTurn" in versionedEpoch.payload).toBe(false);
  expect("songTimeMs" in versionedEpoch.payload).toBe(false);
});


test("foreground reconnect ignores delayed close from the superseded realtime socket", async () => {
  class FakeWebSocket {
    static readonly CONNECTING = 0;
    static readonly OPEN = 1;
    static readonly CLOSING = 2;
    static readonly CLOSED = 3;
    static readonly instances: FakeWebSocket[] = [];

    readonly url: string;
    readyState = FakeWebSocket.CONNECTING;
    onopen: ((event: Event) => void) | null = null;
    onmessage: ((event: MessageEvent<string>) => void) | null = null;
    onclose: ((event: CloseEvent) => void) | null = null;
    onerror: ((event: Event) => void) | null = null;
    sent: string[] = [];

    constructor(url: string | URL) {
      this.url = String(url);
      FakeWebSocket.instances.push(this);
      queueMicrotask(() => {
        this.readyState = FakeWebSocket.OPEN;
        this.onopen?.(new Event("open"));
      });
    }

    send(data: string | ArrayBufferLike | Blob | ArrayBufferView) {
      const text = String(data);
      this.sent.push(text);
      const frame = JSON.parse(text) as {
        topic: string;
        event: string;
        payload: unknown;
        ref: string | null;
        join_ref: string | null;
      };

      if (frame.event === "phx_join" || frame.event === "presence" || frame.event === "broadcast") {
        queueMicrotask(() => {
          this.onmessage?.({
            data: JSON.stringify({
              topic: frame.topic,
              event: "phx_reply",
              payload: { status: "ok", response: {} },
              ref: frame.ref,
              join_ref: frame.join_ref,
            }),
          } as MessageEvent<string>);
        });
      }
    }

    close() {
      this.readyState = FakeWebSocket.CLOSING;
    }

    emitClose() {
      this.readyState = FakeWebSocket.CLOSED;
      this.onclose?.({} as CloseEvent);
    }
  }

  const originalWebSocket = globalThis.WebSocket;
  globalThis.WebSocket = FakeWebSocket as unknown as typeof WebSocket;

  try {
    const transport = new SupabaseRealtimeRoomTransport({
      supabaseUrl: "https://example.supabase.co",
      publishableKey: "sb_publishable_test",
      roomId: "foreground-resume-room",
      presence: {
        participantId: "p51-host",
        displayName: "Toan",
        kind: "human",
        role: "host",
        roomRevision: 1,
      },
    });

    await transport.connect();
    const firstSocket = FakeWebSocket.instances[0];
    expect(transport.status).toBe("connected");

    transport.disconnect();
    await transport.connect();

    const replacementSocket = FakeWebSocket.instances[1];
    expect(replacementSocket).not.toBe(firstSocket);
    expect(transport.status).toBe("connected");

    // iOS may deliver socket A's close only after socket B is already live.
    firstSocket.emitClose();

    expect(transport.status).toBe("connected");
    await transport.send({ kind: "qa-ping", nonce: "after-foreground-resume" });
    expect(replacementSocket.sent.some(frame => JSON.parse(frame).event === "broadcast")).toBe(true);

    transport.disconnect();
    replacementSocket.emitClose();
    expect(transport.status).toBe("disconnected");
  } finally {
    globalThis.WebSocket = originalWebSocket;
    FakeWebSocket.instances.length = 0;
  }
});
