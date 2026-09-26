import { WAITING_ROOM_MAX_PLAYERS } from "./types";
import type {
  BotParticipant,
  HumanGuestParticipant,
  HumanHostParticipant,
  LoadState,
  RoomParticipant,
  RoomSlot,
  RoomSlotIndex,
  RoomState,
  RoomMatchStartBinding,
} from "./types";

const ALL_SLOT_INDEXES: readonly RoomSlotIndex[] = [0, 1, 2, 3, 4, 5];

function bump(room: RoomState, patch: Partial<RoomState>): RoomState {
  return { ...room, ...patch, revision: room.revision + 1 };
}

function resetHumanGuests(participants: readonly RoomParticipant[]): RoomParticipant[] {
  return participants.map(participant => {
    if (participant.kind === "human" && participant.role === "guest") {
      return { ...participant, readyState: "not-ready" };
    }
    return participant;
  });
}

export function createRoomState(input: {
  roomId: string;
  roomName: string;
  host: HumanHostParticipant;
  maxPlayers?: 2 | 3 | 4 | 5 | 6;
  modeId: string;
  selectedSongId?: string | null;
  selectedStageId?: string;
}): RoomState {
  const maxPlayers = input.maxPlayers ?? WAITING_ROOM_MAX_PLAYERS;
  if (input.host.slotIndex >= maxPlayers) throw new Error("Host slot must be inside maxPlayers.");

  const slots: RoomSlot[] = ALL_SLOT_INDEXES.map(slotIndex => {
    if (slotIndex === input.host.slotIndex) {
      return { slotIndex, state: "occupied", participantId: input.host.participantId };
    }
    return slotIndex < maxPlayers ? { slotIndex, state: "open" } : { slotIndex, state: "closed" };
  });

  return {
    roomId: input.roomId,
    roomName: input.roomName,
    status: "waiting",
    hostParticipantId: input.host.participantId,
    maxPlayers,
    modeId: input.modeId,
    selectedSongId: input.selectedSongId ?? null,
    selectedStageId: input.selectedStageId ?? "studio-81",
    slots,
    participants: [input.host],
    matchStart: null,
    revision: 1,
  };
}

export function occupiedParticipants(room: RoomState): RoomParticipant[] {
  const occupiedIds = new Set(
    room.slots.filter(slot => slot.state === "occupied").map(slot => slot.participantId),
  );
  return room.participants.filter(participant => occupiedIds.has(participant.participantId));
}

export function canStartRoom(room: RoomState): { allowed: boolean; reason: string | null } {
  if (room.status !== "waiting") return { allowed: false, reason: "room-not-waiting" };
  if (!room.selectedSongId) return { allowed: false, reason: "song-required" };

  const occupied = occupiedParticipants(room);
  const host = occupied.find(participant => participant.participantId === room.hostParticipantId);
  if (!host || host.role !== "host" || host.connectionState !== "connected") {
    return { allowed: false, reason: "host-unavailable" };
  }

  const nonHost = occupied.filter(participant => participant.participantId !== room.hostParticipantId);
  if (nonHost.length === 0) return { allowed: false, reason: "opponent-required" };

  const allReady = nonHost.every(participant => {
    if (participant.kind === "bot") return participant.readyState === "ready";
    return participant.role === "guest" && participant.readyState === "ready";
  });

  return allReady
    ? { allowed: true, reason: null }
    : { allowed: false, reason: "participants-not-ready" };
}

export function addParticipant(room: RoomState, participant: HumanGuestParticipant | BotParticipant): RoomState {
  if (room.status !== "waiting") throw new Error("Participants can only join a waiting room.");
  if (room.participants.some(item => item.participantId === participant.participantId)) {
    throw new Error(`Duplicate participant ${participant.participantId}.`);
  }

  const slot = room.slots.find(item => item.slotIndex === participant.slotIndex);
  if (!slot || slot.state !== "open") throw new Error(`Slot ${participant.slotIndex + 1} is not open.`);

  const slots = room.slots.map(item => item.slotIndex === participant.slotIndex
    ? { slotIndex: item.slotIndex, state: "occupied" as const, participantId: participant.participantId }
    : item);

  return bump(room, { slots, participants: [...room.participants, participant] });
}

export function removeParticipant(room: RoomState, participantId: string): RoomState {
  if (participantId === room.hostParticipantId) throw new Error("Host removal requires a host-transfer/room-close flow.");
  const participant = room.participants.find(item => item.participantId === participantId);
  if (!participant) return room;

  const slots = room.slots.map(slot => slot.state === "occupied" && slot.participantId === participantId
    ? { slotIndex: slot.slotIndex, state: "open" as const }
    : slot);
  const participants = room.participants.filter(item => item.participantId !== participantId);
  return bump(room, { slots, participants });
}

export function setGuestReady(room: RoomState, participantId: string, ready: boolean): RoomState {
  if (room.status !== "waiting") throw new Error("Ready state can only change while waiting.");
  const participant = room.participants.find(item => item.participantId === participantId);
  if (!participant) throw new Error(`Unknown participant ${participantId}.`);
  if (participant.role === "host") throw new Error("Host does not have Ready state.");
  if (participant.kind === "bot") throw new Error("Bots are always Ready.");

  const participants: RoomParticipant[] = room.participants.map(item => {
    if (item.participantId !== participantId) return item;
    if (item.kind !== "human" || item.role !== "guest") return item;
    const updated: HumanGuestParticipant = {
      ...item,
      readyState: ready ? "ready" : "not-ready",
    };
    return updated;
  });
  return bump(room, { participants });
}

export function changeSong(room: RoomState, hostParticipantId: string, songId: string): RoomState {
  if (hostParticipantId !== room.hostParticipantId) throw new Error("Only the host can change song.");
  if (room.status !== "waiting") throw new Error("Song can only change while waiting.");
  if (room.selectedSongId === songId) return room;
  return bump(room, { selectedSongId: songId, participants: resetHumanGuests(room.participants) });
}

export function changeStage(room: RoomState, hostParticipantId: string, stageId: string): RoomState {
  if (hostParticipantId !== room.hostParticipantId) throw new Error("Only the host can change stage.");
  if (room.status !== "waiting") throw new Error("Stage can only change while waiting.");
  if (room.selectedStageId === stageId) return room;
  return bump(room, { selectedStageId: stageId, participants: resetHumanGuests(room.participants) });
}

export function changeMode(room: RoomState, hostParticipantId: string, modeId: string): RoomState {
  if (hostParticipantId !== room.hostParticipantId) throw new Error("Only the host can change mode.");
  if (room.status !== "waiting") throw new Error("Mode can only change while waiting.");
  if (room.modeId === modeId) return room;
  return bump(room, { modeId, participants: resetHumanGuests(room.participants) });
}

export function closeSlot(room: RoomState, hostParticipantId: string, slotIndex: RoomSlotIndex): RoomState {
  if (hostParticipantId !== room.hostParticipantId) throw new Error("Only the host can close slots.");
  if (room.status !== "waiting") throw new Error("Slots can only change while waiting.");
  const slot = room.slots.find(item => item.slotIndex === slotIndex);
  if (!slot) throw new Error(`Unknown slot ${slotIndex + 1}.`);
  if (slot.state === "occupied") throw new Error("Occupied slots cannot be closed.");
  if (slot.state === "closed") return room;
  const slots = room.slots.map(item => item.slotIndex === slotIndex ? { slotIndex, state: "closed" as const } : item);
  return bump(room, { slots });
}

export function openSlot(room: RoomState, hostParticipantId: string, slotIndex: RoomSlotIndex): RoomState {
  if (hostParticipantId !== room.hostParticipantId) throw new Error("Only the host can open slots.");
  if (room.status !== "waiting") throw new Error("Slots can only change while waiting.");
  const slot = room.slots.find(item => item.slotIndex === slotIndex);
  if (!slot) throw new Error(`Unknown slot ${slotIndex + 1}.`);
  if (slot.state === "occupied") return room;
  if (slotIndex >= room.maxPlayers) throw new Error("Slot is outside the room maxPlayers setting.");
  if (slot.state === "open") return room;
  const slots = room.slots.map(item => item.slotIndex === slotIndex ? { slotIndex, state: "open" as const } : item);
  return bump(room, { slots });
}


export function beginRoomPreloading(
  room: RoomState,
  hostParticipantId: string,
  matchStart: RoomMatchStartBinding,
): RoomState {
  if (hostParticipantId !== room.hostParticipantId) {
    throw new Error("Only the host can start preloading.");
  }
  const eligibility = canStartRoom(room);
  if (!eligibility.allowed) {
    throw new Error(`Room cannot start preloading: ${eligibility.reason}.`);
  }
  if (matchStart.phase !== "preloading") {
    throw new Error("Lobby handoff must begin in preloading phase.");
  }
  if (matchStart.roomRevision !== room.revision
    || matchStart.manifest.roomRevision !== room.revision
    || matchStart.manifest.roomId !== room.roomId
    || matchStart.manifest.matchId !== matchStart.matchId) {
    throw new Error("Match start binding does not match the waiting-room revision.");
  }
  const participants: RoomParticipant[] = room.participants.map(participant => (
    participant.kind === "bot"
      ? participant
      : { ...participant, loadState: "idle" as const }
  ));

  return bump(room, {
    status: "preloading",
    matchStart,
    participants,
  });
}

export function setParticipantLoadState(
  room: RoomState,
  participantId: string,
  loadState: LoadState,
): RoomState {
  if (room.status !== "preloading" || !room.matchStart) {
    throw new Error("Participant load state can only change during active preloading.");
  }

  const participant = room.participants.find(item => item.participantId === participantId);
  if (!participant) throw new Error(`Unknown participant ${participantId}.`);

  if (participant.kind === "bot") {
    if (loadState !== "loaded") throw new Error("Bot preload state is server-owned and remains loaded.");
    return room;
  }
  if (participant.loadState === loadState) return room;

  const participants: RoomParticipant[] = room.participants.map(item => {
    if (item.participantId !== participantId) return item;
    if (item.kind === "bot") return item;
    return { ...item, loadState };
  });
  return bump(room, { participants });
}

export function beginRoomCountdown(
  room: RoomState,
  matchStart: RoomMatchStartBinding,
): RoomState {
  if (room.status !== "preloading" || !room.matchStart) {
    throw new Error("Countdown can only begin from active preloading.");
  }
  if (!room.participants.length || room.participants.some(participant => participant.loadState !== "loaded")) {
    throw new Error("Countdown requires every frozen participant to be Loaded.");
  }
  if (matchStart.phase !== "countdown"
    || !Number.isFinite(matchStart.startAtServerMs)
    || (matchStart.startAtServerMs as number) <= 0) {
    throw new Error("Countdown requires an immutable future server epoch.");
  }

  const current = room.matchStart;
  if (matchStart.protocolVersion !== current.protocolVersion
    || matchStart.matchId !== current.matchId
    || matchStart.roomRevision !== current.roomRevision
    || matchStart.startRevision !== current.startRevision
    || matchStart.safeLeadTimeMs !== current.safeLeadTimeMs
    || matchStart.manifest.matchId !== current.manifest.matchId
    || matchStart.manifest.roomId !== current.manifest.roomId
    || matchStart.manifest.roomRevision !== current.manifest.roomRevision) {
    throw new Error("Countdown binding does not match the active preload session.");
  }

  return bump(room, {
    status: "countdown",
    matchStart,
  });
}

export function beginRoomPlaying(room: RoomState): RoomState {
  if (room.status === "playing") return room;
  if (room.status !== "countdown" || !room.matchStart) {
    throw new Error("Playing can only begin from the canonical countdown.");
  }
  if (room.matchStart.phase !== "countdown"
    || !Number.isFinite(room.matchStart.startAtServerMs)
    || (room.matchStart.startAtServerMs as number) <= 0) {
    throw new Error("Playing requires the issued shared start epoch.");
  }
  if (!room.participants.length || room.participants.some(participant => participant.loadState !== "loaded")) {
    throw new Error("Playing requires every frozen participant to remain Loaded.");
  }
  return bump(room, { status: "playing" });
}
