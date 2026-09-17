import { missPenaltyTurns, successHiddenTurns, DEFAULT_SOLO_SETTINGS } from "../game/solo-easy";
import type { Judgement } from "../game/types";
import { resolveBotJudgement } from "./bot-policy";
import { describeSharedTurn } from "./determinism";
import { createMatchManifest } from "./match-manifest";
import { addParticipant, createRoomState } from "./room-state";
import type {
  AvatarSnapshot,
  BotParticipant,
  BotProfile,
  HumanHostParticipant,
  MatchManifest,
  RoomParticipant,
  RoomState,
} from "./types";

export type SimulatedClientSnapshot = {
  participantId: string;
  displayName: string;
  kind: "human" | "bot";
  role: "host" | "guest";
  absoluteTurn: number;
  level: number;
  sequenceIndex: number;
  isFinish: boolean;
  roomRest: boolean;
  commandVisible: boolean;
  judgement: Judgement | null;
  targetSpaceMs: number;
  commandHash: string;
  hiddenThroughTurn: number;
};

export type MultiplayerInvariantReport = {
  pass: boolean;
  turnSync: boolean;
  levelSync: boolean;
  finishSync: boolean;
  targetSync: boolean;
  commandSync: boolean;
  timelineOwner: "shared";
};

export type SimulationResult = {
  throughTurn: number;
  clients: readonly SimulatedClientSnapshot[];
  invariants: MultiplayerInvariantReport;
};

function same<T>(values: readonly T[]) {
  return values.length <= 1 || values.every(value => Object.is(value, values[0]));
}

function profileFor(participant: RoomParticipant, overrides: Readonly<Record<string, BotProfile>>) {
  if (participant.kind === "bot") return participant.botProfile;
  return overrides[participant.participantId] ?? "mixed";
}

export function simulateRoom(input: {
  room: RoomState;
  manifest: MatchManifest;
  throughTurn: number;
  policyOverrides?: Readonly<Record<string, BotProfile>>;
}): SimulationResult {
  if (!Number.isInteger(input.throughTurn) || input.throughTurn < 0) {
    throw new Error("throughTurn must be a non-negative integer.");
  }

  const participantsById = new Map(input.room.participants.map(participant => [participant.participantId, participant]));
  const hiddenThrough = new Map(input.manifest.participants.map(participant => [participant.participantId, -1]));
  const overrides = input.policyOverrides ?? {};
  let clients: SimulatedClientSnapshot[] = [];

  for (let absoluteTurn = 0; absoluteTurn <= input.throughTurn; absoluteTurn += 1) {
    const shared = describeSharedTurn(input.manifest, absoluteTurn);
    clients = input.manifest.participants.map(matchParticipant => {
      const participant = participantsById.get(matchParticipant.participantId);
      if (!participant) throw new Error(`Participant ${matchParticipant.participantId} missing from room state.`);

      let hiddenThroughTurn = hiddenThrough.get(participant.participantId) ?? -1;
      if (shared.isFinish) hiddenThroughTurn = absoluteTurn - 1;
      const commandVisible = !shared.roomRest && (shared.isFinish || absoluteTurn > hiddenThroughTurn);
      let judgement: Judgement | null = null;

      if (commandVisible) {
        const profile = profileFor(participant, overrides);
        judgement = resolveBotJudgement(profile, input.manifest.gameplay.seed, participant.participantId, absoluteTurn);
        if (!shared.isFinish) {
          const suppression = judgement === "miss"
            ? missPenaltyTurns(shared.level)
            : successHiddenTurns(shared.level);
          hiddenThroughTurn = Math.max(hiddenThroughTurn, absoluteTurn + suppression);
        }
      }

      hiddenThrough.set(participant.participantId, hiddenThroughTurn);
      return {
        participantId: participant.participantId,
        displayName: participant.displayName,
        kind: participant.kind,
        role: participant.role,
        absoluteTurn,
        level: shared.level,
        sequenceIndex: shared.sequenceIndex,
        isFinish: shared.isFinish,
        roomRest: shared.roomRest,
        commandVisible,
        judgement,
        targetSpaceMs: shared.targetSpaceMs,
        commandHash: shared.commandHash,
        hiddenThroughTurn,
      };
    });
  }

  const turnSync = same(clients.map(client => client.absoluteTurn));
  const levelSync = same(clients.map(client => `${client.level}:${client.sequenceIndex}`));
  const finishSync = same(clients.map(client => client.isFinish));
  const targetSync = same(clients.map(client => client.targetSpaceMs));
  const commandSync = same(clients.map(client => client.commandHash));

  return {
    throughTurn: input.throughTurn,
    clients,
    invariants: {
      pass: turnSync && levelSync && finishSync && targetSync && commandSync,
      turnSync,
      levelSync,
      finishSync,
      targetSync,
      commandSync,
      timelineOwner: "shared",
    },
  };
}

function qaAvatar(characterId: string): AvatarSnapshot {
  return { characterId, outfit: {}, accessoryIds: [], petId: null, titleId: null };
}

export function createP41QaFixture(): { room: RoomState; manifest: MatchManifest } {
  const host: HumanHostParticipant = {
    participantId: "human-host",
    displayName: "Owner iPhone",
    kind: "human",
    role: "host",
    slotIndex: 0,
    readyState: "not-applicable",
    loadState: "loaded",
    connectionState: "connected",
    avatar: qaAvatar("default-female"),
  };

  let room = createRoomState({
    roomId: "qa-room",
    roomName: "P4.1 Shared Timeline QA",
    host,
    maxPlayers: 6,
    modeId: "solo-easy-battle",
    selectedSongId: "aloha",
  });

  const profiles: readonly BotProfile[] = ["perfect", "miss", "mixed", "passive", "perfect"];
  profiles.forEach((botProfile, index) => {
    const bot: BotParticipant = {
      participantId: `bot-${index + 1}`,
      displayName: `Bot ${index + 1}`,
      kind: "bot",
      role: "guest",
      slotIndex: (index + 1) as 1 | 2 | 3 | 4 | 5,
      readyState: "ready",
      loadState: "loaded",
      connectionState: "connected",
      botProfile,
      avatar: qaAvatar(index % 2 === 0 ? "default-male" : "default-female"),
    };
    room = addParticipant(room, bot);
  });

  const manifest = createMatchManifest(room, {
    matchId: "qa-match-seed-123",
    audioVersion: "qa-audio-v1",
    chartVersion: "qa-chart-v1",
    animationReleaseVersion: 3,
    seed: 123,
    bpmExact: 101.0504,
    spaceStartMs: 10083,
    sequenceCounts: DEFAULT_SOLO_SETTINGS.sequenceCounts,
    commandLengths: DEFAULT_SOLO_SETTINGS.commandLengths,
    finishRestTurns: DEFAULT_SOLO_SETTINGS.finishRestTurns,
  });

  return { room, manifest };
}
