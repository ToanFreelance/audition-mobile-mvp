export type RoomSlotIndex = 0 | 1 | 2 | 3 | 4 | 5;
export type RoomStatus = "waiting" | "preloading" | "countdown" | "playing" | "results";
export type LoadState = "idle" | "loading" | "loaded" | "failed";
export type ConnectionState = "connected" | "disconnected";
export type BotProfile = "perfect" | "miss" | "mixed" | "passive";

export type AvatarSnapshot = {
  characterId: string;
  outfit: {
    hairId?: string;
    topId?: string;
    bottomId?: string;
    shoesId?: string;
  };
  accessoryIds: readonly string[];
  petId?: string | null;
  titleId?: string | null;
};

type ParticipantBase = {
  participantId: string;
  displayName: string;
  slotIndex: RoomSlotIndex;
  loadState: LoadState;
  connectionState: ConnectionState;
  avatar: AvatarSnapshot;
};

export type HumanHostParticipant = ParticipantBase & {
  kind: "human";
  role: "host";
  readyState: "not-applicable";
};

export type HumanGuestParticipant = ParticipantBase & {
  kind: "human";
  role: "guest";
  readyState: "not-ready" | "ready";
};

export type BotParticipant = ParticipantBase & {
  kind: "bot";
  role: "guest";
  readyState: "ready";
  loadState: "loaded";
  connectionState: "connected";
  botProfile: BotProfile;
};

export type RoomParticipant = HumanHostParticipant | HumanGuestParticipant | BotParticipant;

export type RoomSlot =
  | { slotIndex: RoomSlotIndex; state: "open" }
  | { slotIndex: RoomSlotIndex; state: "closed" }
  | { slotIndex: RoomSlotIndex; state: "occupied"; participantId: string };

export type RoomState = {
  roomId: string;
  roomName: string;
  status: RoomStatus;
  hostParticipantId: string;
  maxPlayers: 2 | 3 | 4 | 5 | 6;
  modeId: string;
  selectedSongId: string | null;
  selectedStageId: string;
  slots: readonly RoomSlot[];
  participants: readonly RoomParticipant[];
  revision: number;
};

export type MatchParticipantSnapshot = {
  participantId: string;
  displayName: string;
  kind: RoomParticipant["kind"];
  role: RoomParticipant["role"];
  slotIndex: RoomSlotIndex;
  avatar: AvatarSnapshot;
  botProfile?: BotProfile;
};

export type MatchManifest = {
  manifestVersion: 1;
  matchId: string;
  roomId: string;
  roomRevision: number;
  participants: readonly MatchParticipantSnapshot[];
  content: {
    songId: string;
    audioVersion: string;
    audioHash: string;
    chartVersion: string;
    chartHash: string;
    characterRuntimeVersion: string;
    animationReleaseVersion: number;
    animationReleaseHash: string;
  };
  gameplay: {
    configVersion: string;
    configHash: string;
    modeId: string;
    seed: number;
    bpmExact: number;
    spaceStartMs: number;
    sequenceCounts: readonly number[];
    commandLengths: readonly number[];
    finishRestTurns: number;
  };
};