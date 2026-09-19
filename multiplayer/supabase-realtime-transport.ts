import {
  MULTIPLAYER_TRANSPORT_VERSION,
  isRoomTransportEnvelope,
  type MultiplayerRoomTransport,
  type RoomTransportEnvelope,
  type RoomTransportEventListener,
  type RoomTransportPayload,
  type RoomTransportPresence,
  type RoomTransportPresenceListener,
  type RoomTransportStatus,
  type RoomTransportStatusListener,
} from "./transport";

type RealtimeFrame = {
  topic: string;
  event: string;
  payload: unknown;
  ref: string | null;
  join_ref: string | null;
};

type RealtimeReplyPayload = {
  status?: string;
  response?: unknown;
};

type PresenceStatePayload = Record<string, {
  metas?: Array<Record<string, unknown>>;
}>;

type PresenceDiffPayload = {
  joins?: PresenceStatePayload;
  leaves?: PresenceStatePayload;
};

type PendingReply = {
  resolve: () => void;
  reject: (error: Error) => void;
  timeoutId: ReturnType<typeof setTimeout>;
};

export type SupabaseRealtimeTransportConfig = {
  supabaseUrl: string;
  publishableKey: string;
  roomId: string;
  presence: RoomTransportPresence;
};

const JOIN_TIMEOUT_MS = 8_000;
const PUSH_TIMEOUT_MS = 6_000;
const HEARTBEAT_MS = 25_000;

let messageCounter = 0;

function nextMessageId(prefix: string) {
  messageCounter = (messageCounter + 1) >>> 0;
  return `${prefix}-${Date.now().toString(36)}-${messageCounter.toString(36)}`;
}

export function sanitizeRealtimeRoomId(roomId: string) {
  const normalized = roomId.trim().replace(/[^a-zA-Z0-9_-]+/g, "-").replace(/-+/g, "-");
  if (!normalized) throw new Error("roomId must contain at least one safe character.");
  return normalized.slice(0, 64);
}

export function realtimeTopicForRoom(roomId: string) {
  return `realtime:audition-room:${sanitizeRealtimeRoomId(roomId)}`;
}

export function buildSupabaseRealtimeWebSocketUrl(supabaseUrl: string, publishableKey: string) {
  const parsed = new URL(supabaseUrl);
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    throw new Error("Supabase URL must use http or https.");
  }
  if (!publishableKey.trim()) throw new Error("Supabase publishable key is required.");
  parsed.protocol = parsed.protocol === "https:" ? "wss:" : "ws:";
  parsed.pathname = "/realtime/v1/websocket";
  parsed.search = "";
  parsed.searchParams.set("apikey", publishableKey.trim());
  parsed.searchParams.set("vsn", "1.0.0");
  return parsed.toString();
}

function presenceFromMeta(key: string, meta: Record<string, unknown>): RoomTransportPresence | null {
  const participantId = typeof meta.participantId === "string" && meta.participantId
    ? meta.participantId
    : key;
  const displayName = typeof meta.displayName === "string" ? meta.displayName : participantId;
  const kind = meta.kind === "bot" ? "bot" : meta.kind === "human" ? "human" : null;
  const role = meta.role === "host" ? "host" : meta.role === "guest" ? "guest" : null;
  const roomRevision = Number(meta.roomRevision);
  if (!kind || !role || !Number.isInteger(roomRevision) || roomRevision < 0) return null;
  return { participantId, displayName, kind, role, roomRevision };
}

export class SupabaseRealtimeRoomTransport implements MultiplayerRoomTransport {
  readonly roomId: string;
  readonly participantId: string;

  private readonly websocketUrl: string;
  private readonly topic: string;
  private readonly presencePayload: RoomTransportPresence;
  private socket: WebSocket | null = null;
  private currentStatus: RoomTransportStatus = "idle";
  private refCounter = 0;
  private joinRef: string | null = null;
  private heartbeatId: ReturnType<typeof setInterval> | null = null;
  private explicitlyClosed = false;
  private readonly pending = new Map<string, PendingReply>();
  private readonly eventListeners = new Set<RoomTransportEventListener>();
  private readonly presenceListeners = new Set<RoomTransportPresenceListener>();
  private readonly statusListeners = new Set<RoomTransportStatusListener>();
  private readonly presenceByKey = new Map<string, RoomTransportPresence>();

  constructor(config: SupabaseRealtimeTransportConfig) {
    this.roomId = sanitizeRealtimeRoomId(config.roomId);
    this.participantId = config.presence.participantId;
    this.websocketUrl = buildSupabaseRealtimeWebSocketUrl(config.supabaseUrl, config.publishableKey);
    this.topic = realtimeTopicForRoom(this.roomId);
    this.presencePayload = { ...config.presence };
  }

  get status() {
    return this.currentStatus;
  }

  onEvent(listener: RoomTransportEventListener) {
    this.eventListeners.add(listener);
    return () => this.eventListeners.delete(listener);
  }

  onPresence(listener: RoomTransportPresenceListener) {
    this.presenceListeners.add(listener);
    listener([...this.presenceByKey.values()]);
    return () => this.presenceListeners.delete(listener);
  }

  onStatus(listener: RoomTransportStatusListener) {
    this.statusListeners.add(listener);
    listener(this.currentStatus);
    return () => this.statusListeners.delete(listener);
  }

  async connect() {
    if (this.currentStatus === "connected") return;
    if (this.currentStatus === "connecting") throw new Error("Transport is already connecting.");
    if (typeof WebSocket === "undefined") throw new Error("WebSocket is unavailable in this environment.");

    this.explicitlyClosed = false;
    this.setStatus("connecting");

    const socket = new WebSocket(this.websocketUrl);
    this.socket = socket;

    await new Promise<void>((resolve, reject) => {
      const timeoutId = setTimeout(() => reject(new Error("Realtime WebSocket open timed out.")), JOIN_TIMEOUT_MS);
      socket.onopen = () => {
        clearTimeout(timeoutId);
        resolve();
      };
      socket.onerror = () => {
        clearTimeout(timeoutId);
        reject(new Error("Realtime WebSocket connection failed."));
      };
    }).catch(error => {
      this.setStatus("error", error instanceof Error ? error.message : "WebSocket connection failed.");
      socket.close();
      throw error;
    });

    // A backgrounded iOS browser can resume after the old socket has already
    // started closing. If we reconnect immediately, late events from that old
    // socket must never clobber the replacement connection.
    socket.onmessage = event => {
      if (this.socket !== socket) return;
      this.handleMessage(event.data);
    };
    socket.onclose = () => this.handleSocketClosed(socket);
    socket.onerror = () => {
      if (this.socket === socket) {
        this.setStatus("error", "Realtime WebSocket error.");
      }
    };

    const joinRef = this.nextRef();
    this.joinRef = joinRef;
    await this.pushWithAck("phx_join", {
      config: {
        broadcast: { ack: true, self: false },
        presence: { enabled: true, key: this.participantId },
        postgres_changes: [],
        private: false,
      },
    }, JOIN_TIMEOUT_MS, joinRef);

    this.setStatus("connected");
    this.startHeartbeat();

    await this.pushWithAck("presence", {
      type: "presence",
      event: "track",
      payload: this.presencePayload,
    });
  }

  disconnect() {
    this.explicitlyClosed = true;
    this.stopHeartbeat();
    this.rejectPending(new Error("Transport disconnected."));
    if (this.socket?.readyState === WebSocket.OPEN) {
      this.sendFrame("phx_leave", {}, this.nextRef());
    }
    this.socket?.close(1000, "client disconnect");
    this.socket = null;
    this.joinRef = null;
    this.presenceByKey.clear();
    this.emitPresence();
    this.setStatus("disconnected");
  }

  async send(payload: RoomTransportPayload) {
    if (this.currentStatus !== "connected") throw new Error("Transport is not connected.");
    const envelope: RoomTransportEnvelope = {
      transportVersion: MULTIPLAYER_TRANSPORT_VERSION,
      roomId: this.roomId,
      senderParticipantId: this.participantId,
      messageId: nextMessageId(this.participantId),
      payload,
    };
    await this.pushWithAck("broadcast", {
      type: "broadcast",
      event: "room-event",
      payload: envelope,
    });
  }

  private nextRef() {
    this.refCounter += 1;
    return String(this.refCounter);
  }

  private setStatus(status: RoomTransportStatus, detail?: string) {
    this.currentStatus = status;
    for (const listener of this.statusListeners) listener(status, detail);
  }

  private sendFrame(event: string, payload: unknown, ref: string) {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      throw new Error("Realtime WebSocket is not open.");
    }
    const frame: RealtimeFrame = {
      topic: event === "heartbeat" ? "phoenix" : this.topic,
      event,
      payload,
      ref,
      join_ref: event === "heartbeat" || event === "phx_join" ? null : this.joinRef,
    };
    if (event === "phx_join") frame.join_ref = ref;
    this.socket.send(JSON.stringify(frame));
  }

  private pushWithAck(event: string, payload: unknown, timeoutMs = PUSH_TIMEOUT_MS, forcedRef?: string) {
    const ref = forcedRef ?? this.nextRef();
    return new Promise<void>((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        this.pending.delete(ref);
        reject(new Error(`${event} acknowledgement timed out.`));
      }, timeoutMs);
      this.pending.set(ref, { resolve, reject, timeoutId });
      try {
        this.sendFrame(event, payload, ref);
      } catch (error) {
        clearTimeout(timeoutId);
        this.pending.delete(ref);
        reject(error instanceof Error ? error : new Error(`${event} send failed.`));
      }
    });
  }

  private handleMessage(raw: unknown) {
    if (typeof raw !== "string") return;
    let frame: RealtimeFrame;
    try {
      frame = JSON.parse(raw) as RealtimeFrame;
    } catch {
      return;
    }

    if (frame.event === "phx_reply" && frame.ref) {
      const pending = this.pending.get(frame.ref);
      if (!pending) return;
      clearTimeout(pending.timeoutId);
      this.pending.delete(frame.ref);
      const reply = frame.payload as RealtimeReplyPayload;
      if (reply?.status === "ok") pending.resolve();
      else pending.reject(new Error(`Realtime ${frame.ref} rejected: ${JSON.stringify(reply?.response ?? {})}`));
      return;
    }

    if (frame.event === "broadcast" && frame.topic === this.topic) {
      const broadcast = frame.payload as { event?: unknown; payload?: unknown };
      if (broadcast?.event !== "room-event" || !isRoomTransportEnvelope(broadcast.payload)) return;
      if (broadcast.payload.roomId !== this.roomId) return;
      for (const listener of this.eventListeners) listener(broadcast.payload);
      return;
    }

    if (frame.event === "presence_state" && frame.topic === this.topic) {
      this.replacePresence(frame.payload as PresenceStatePayload);
      return;
    }

    if (frame.event === "presence_diff" && frame.topic === this.topic) {
      this.applyPresenceDiff(frame.payload as PresenceDiffPayload);
      return;
    }

    if (frame.event === "phx_error") {
      this.setStatus("error", "Realtime channel error.");
    }
  }

  private replacePresence(payload: PresenceStatePayload) {
    this.presenceByKey.clear();
    for (const [key, value] of Object.entries(payload ?? {})) {
      const meta = value?.metas?.at(-1);
      if (!meta) continue;
      const presence = presenceFromMeta(key, meta);
      if (presence) this.presenceByKey.set(key, presence);
    }
    this.emitPresence();
  }

  private applyPresenceDiff(payload: PresenceDiffPayload) {
    for (const key of Object.keys(payload?.leaves ?? {})) this.presenceByKey.delete(key);
    for (const [key, value] of Object.entries(payload?.joins ?? {})) {
      const meta = value?.metas?.at(-1);
      if (!meta) continue;
      const presence = presenceFromMeta(key, meta);
      if (presence) this.presenceByKey.set(key, presence);
    }
    this.emitPresence();
  }

  private emitPresence() {
    const snapshot = [...this.presenceByKey.values()].sort((a, b) => a.participantId.localeCompare(b.participantId));
    for (const listener of this.presenceListeners) listener(snapshot);
  }

  private startHeartbeat() {
    this.stopHeartbeat();
    this.heartbeatId = setInterval(() => {
      if (!this.socket || this.socket.readyState !== WebSocket.OPEN) return;
      try {
        this.sendFrame("heartbeat", {}, this.nextRef());
      } catch {
        // onclose/onerror owns connection state; heartbeat is best-effort.
      }
    }, HEARTBEAT_MS);
  }

  private stopHeartbeat() {
    if (this.heartbeatId) clearInterval(this.heartbeatId);
    this.heartbeatId = null;
  }

  private rejectPending(error: Error) {
    for (const pending of this.pending.values()) {
      clearTimeout(pending.timeoutId);
      pending.reject(error);
    }
    this.pending.clear();
  }

  private handleSocketClosed(socket: WebSocket) {
    // Ignore a delayed close from a superseded socket. This is common on
    // iOS Safari/Chrome when the app is backgrounded and then foregrounded:
    // reconnect() can establish socket B before socket A dispatches onclose.
    if (this.socket !== socket) return;

    this.stopHeartbeat();
    this.rejectPending(new Error("Realtime WebSocket closed."));
    this.socket = null;
    this.joinRef = null;
    this.presenceByKey.clear();
    this.emitPresence();
    if (!this.explicitlyClosed) this.setStatus("disconnected", "Realtime socket closed.");
  }
}
