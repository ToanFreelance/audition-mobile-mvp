import type { MatchManifest, RoomState } from "./types";

export const MULTIPLAYER_TRANSPORT_VERSION = 1 as const;

export type RoomTransportStatus = "idle" | "connecting" | "connected" | "disconnected" | "error";

export type RoomTransportPresence = {
  participantId: string;
  displayName: string;
  kind: "human" | "bot";
  role: "host" | "guest";
  roomRevision: number;
};

export type RoomTransportPayload =
  | {
      kind: "room-snapshot";
      roomRevision: number;
      snapshot: RoomState;
    }
  | {
      kind: "room-revision";
      roomRevision: number;
      reason: "participant" | "song" | "mode" | "slot" | "other";
    }
  | {
      kind: "match-manifest";
      roomRevision: number;
      manifest: MatchManifest;
    }
  | {
      kind: "match-start-epoch";
      roomRevision: number;
      matchId: string;
      startAtServerMs: number;
    }
  | {
      kind: "qa-ping";
      nonce: string;
    }
  | {
      kind: "qa-pong";
      nonce: string;
    };

export type RoomTransportEnvelope = {
  transportVersion: typeof MULTIPLAYER_TRANSPORT_VERSION;
  roomId: string;
  senderParticipantId: string;
  messageId: string;
  payload: RoomTransportPayload;
};

export type RoomTransportEventListener = (event: RoomTransportEnvelope) => void;
export type RoomTransportPresenceListener = (presence: readonly RoomTransportPresence[]) => void;
export type RoomTransportStatusListener = (status: RoomTransportStatus, detail?: string) => void;

export interface MultiplayerRoomTransport {
  readonly roomId: string;
  readonly participantId: string;
  readonly status: RoomTransportStatus;

  connect(): Promise<void>;
  disconnect(): void;
  send(payload: RoomTransportPayload): Promise<void>;

  onEvent(listener: RoomTransportEventListener): () => void;
  onPresence(listener: RoomTransportPresenceListener): () => void;
  onStatus(listener: RoomTransportStatusListener): () => void;
}

export function isRoomTransportEnvelope(value: unknown): value is RoomTransportEnvelope {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<RoomTransportEnvelope>;
  if (candidate.transportVersion !== MULTIPLAYER_TRANSPORT_VERSION) return false;
  if (typeof candidate.roomId !== "string" || !candidate.roomId) return false;
  if (typeof candidate.senderParticipantId !== "string" || !candidate.senderParticipantId) return false;
  if (typeof candidate.messageId !== "string" || !candidate.messageId) return false;
  if (!candidate.payload || typeof candidate.payload !== "object") return false;
  return typeof (candidate.payload as { kind?: unknown }).kind === "string";
}
