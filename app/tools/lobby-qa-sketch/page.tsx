import RosterProbe from "./RosterProbe";
import MotionControls from "./MotionControls";
import WaitingRoomPanel from "../../../components/multiplayer/WaitingRoomPanel";
import { createRoomState, addParticipant } from "../../../multiplayer/room-state";
import type { HumanHostParticipant, HumanGuestParticipant } from "../../../multiplayer/types";
import type { WaitingRoomGoldenTraceMode } from "../../../components/multiplayer/WaitingRoomGoldenTraceSvg";

type LobbyQaSketchPageProps = {
  searchParams: Promise<{
    sync?: string;
    client?: string;
    room?: string;
    calibrate?: string;
    blueprint?: string;
    fixmap?: string;
    goldenTrace?: string;
    traceOpacity?: string;
    traceMode?: string;
    solo?: string;
    m3?: "female" | "male" | "five";
    allM3?: string;
    rosterProbe?: string;
    f01Pilot?: string;
    mixamo?: string;
    footLock?: string;
    contactV4?: string;
    pelvisFix?: string;
    sideStepV5?: string;
    sideStepV6?: string;
    contactV7?: string;
    contactV8?: string;
    stationaryOnly?: string;
    sideStepDemo?: string;
  }>;
};

function traceOpacity(value: string | undefined) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0.72;
  return Math.min(1, Math.max(0.1, parsed));
}

function traceMode(value: string | undefined): WaitingRoomGoldenTraceMode {
  if (value === "color" || value === "all") return value;
  return "geometry";
}

export default async function LobbyQaSketchPage({ searchParams }: LobbyQaSketchPageProps) {
  const params = await searchParams;
  const initialSync = params.sync === "1"
    ? {
        roomId: params.room?.trim() || "p53-room",
        role: params.client === "guest" ? "guest" as const : "host" as const,
      }
    : null;
  const goldenTraceEnabled = params.goldenTrace === "1" || params.fixmap === "1";
  // Read-only 1/5 fixture for ring/reflection QA. Never connects to Supabase.
  // Isolated owner QA view: real M3 actor in the existing golden-sketch Waiting
  // Room renderer without Supabase, START, or canonical room mutation.
  const m3Id = params.m3 === "female" || params.m3 === "five" ? "m3-drophunter"
    : params.m3 === "male" ? "m3-neurohacker" : null;
  const maleAppearance = { hairStyle: "short", hairColor: "original", skinTone: "originalskin", m3Outfit: { top: "logotee", bottom: "cargoshorts" } };
  const m3Appearance = m3Id === "m3-drophunter"
    ? { hairStyle: "short", hairColor: "original", skinTone: "originalskin", m3Outfit: { top: "shirt", bottom: "casualshorts" } }
    : maleAppearance;
  const soloHost: HumanHostParticipant = {
    participantId: "c3-single-host",
    displayName: "Luna",
    kind: "human",
    role: "host",
    slotIndex: 2,
    readyState: "not-applicable",
    loadState: "idle",
    connectionState: "connected",
    avatar: {
      characterId: m3Id ?? "default-female",
      characterAssetId: m3Id ?? "c1-casual-grace",
      ...(m3Id ? { m3Appearance } : {}),
      outfit: {},
      accessoryIds: [],
      petId: null,
      titleId: null,
    },
  };
  const soloRoom = params.solo === "1" || m3Id
    ? createRoomState({
        roomId: "c3-ring-fixture",
        roomName: "C3 Single Host",
        host: soloHost,
        maxPlayers: 5,
        modeId: "solo-easy-battle",
        selectedSongId: "aloha",
      })
    : undefined;

  const guests: HumanGuestParticipant[] = params.m3 === "five" ? (
    [
      { participantId: "m3-fixture-guest-male", slotIndex: 0, displayName: "Kai", characterId: "m3-neurohacker",
        m3Appearance: maleAppearance },
      { participantId: "m3-fixture-guest-female", slotIndex: 1, displayName: "Mia", characterId: "m3-drophunter", m3Appearance },
      { participantId: "m3-fixture-guest-c1", slotIndex: 3, displayName: "Grace", characterId: params.allM3 === "1" ? "m3-drophunter" : "c1-casual-grace", m3Appearance: params.allM3 === "1" ? m3Appearance : undefined },
      { participantId: "m3-fixture-guest-c4", slotIndex: 4, displayName: "Boy", characterId: params.allM3 === "1" ? "m3-neurohacker" : "c4-casual-boy", m3Appearance: params.allM3 === "1" ? maleAppearance : undefined },
    ] as const).map(guest => ({
      participantId: guest.participantId,
      displayName: guest.displayName,
      slotIndex: guest.slotIndex,
      kind: "human" as const,
      role: "guest" as const,
      readyState: "not-ready" as const,
      loadState: "idle" as const,
      connectionState: "connected" as const,
      avatar: {
        characterId: guest.characterId,
        characterAssetId: guest.characterId,
        ...("m3Appearance" in guest && guest.m3Appearance ? { m3Appearance: guest.m3Appearance } : {}),
        outfit: {}, accessoryIds: [],
      },
    })) : [];
  const visualRoom = soloRoom && guests.length
    ? guests.reduce((room, guest) => addParticipant(room, guest), soloRoom)
    : soloRoom;

  if (params.rosterProbe === "1" && params.m3 === "five" && visualRoom) return <RosterProbe room={visualRoom} />;

  return (
    <>
    <WaitingRoomPanel
      initialRoom={visualRoom}
      initialSync={initialSync}
      calibrationMode={params.calibrate === "1"}
      blueprintMode={params.blueprint === "1"}
      fixMapMode={params.fixmap === "1"}
      goldenTrace={goldenTraceEnabled ? {
        enabled: true,
        opacity: traceOpacity(params.traceOpacity),
        mode: traceMode(params.traceMode),
      } : null}
      visualPreset="sketch"
    />
    {m3Id && <MotionControls
      mixed={params.m3 === "five"}
      family={params.m3 === "male" ? "neurohacker" : "drophunter"}
      pilot={params.f01Pilot === "1" && params.m3 === "female"}
      mixamo={params.mixamo === "1"}
      footLock={params.footLock === "1"}
      contactV4={params.contactV4 !== "0"}
      pelvisFix={params.pelvisFix === "1"}
      sideStepV5={params.sideStepV5 === "1"}
      sideStepV6={params.sideStepV6 === "1"}
      contactV7={params.contactV7 === "1"}
      contactV8={params.contactV8 === "1"}
      stationaryOnly={params.stationaryOnly === "1"}
      sideStepDemo={params.sideStepDemo === "1"}
    />}
    </>
  );
}
