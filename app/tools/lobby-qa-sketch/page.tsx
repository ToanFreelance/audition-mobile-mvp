import WaitingRoomPanel from "../../../components/multiplayer/WaitingRoomPanel";
import { createRoomState } from "../../../multiplayer/room-state";
import type { HumanHostParticipant } from "../../../multiplayer/types";
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
      characterId: "default-female",
      characterAssetId: "c1-casual-grace",
      outfit: {},
      accessoryIds: [],
      petId: null,
      titleId: null,
    },
  };
  const soloRoom = params.solo === "1"
    ? createRoomState({
        roomId: "c3-ring-fixture",
        roomName: "C3 Single Host",
        host: soloHost,
        maxPlayers: 5,
        modeId: "solo-easy-battle",
        selectedSongId: "aloha",
      })
    : undefined;

  return (
    <WaitingRoomPanel
      initialRoom={soloRoom}
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
  );
}
