import type { MultiplayerGameplayJudgementEvent } from "./gameplay-runtime";
import type { MatchLoadedAck } from "./match-start-protocol";
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
      kind: "client-load-state";
      roomRevision: number;
      matchId: string;
      startRevision: number;
      participantId: string;
      state: "loading" | "failed";
      detail?: string;
    }
  | {
      kind: "match-loaded-ack";
      ack: MatchLoadedAck;
    }
  | {
      kind: "match-start-cancelled";
      roomRevision: number;
      matchId: string;
      startRevision: number;
      reason: string;
    }
  | {
      /** P4.3 legacy start-epoch metadata retained for transport regression QA. */
      kind: "match-start-epoch";
      roomRevision: number;
      matchId: string;
      startAtServerMs: number;
    }
  | {
      /** P4.4 versioned start epoch bound to one preload/start session. */
      kind: "match-start-epoch-v2";
      roomRevision: number;
      matchId: string;
      startRevision: number;
      startAtServerMs: number;
    }
  | {
      /** P4.5 player-local result metadata. Never a shared timeline command. */
      kind: "player-judgement";
      roomRevision: number;
      matchId: string;
      startRevision: number;
      event: MultiplayerGameplayJudgementEvent;
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
