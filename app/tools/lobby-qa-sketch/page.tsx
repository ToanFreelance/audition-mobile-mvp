import WaitingRoomPanel from "../../../components/multiplayer/WaitingRoomPanel";

type LobbyQaSketchPageProps = {
  searchParams: Promise<{
    sync?: string;
    client?: string;
    room?: string;
    calibrate?: string;
  }>;
};

export default async function LobbyQaSketchPage({ searchParams }: LobbyQaSketchPageProps) {
  const params = await searchParams;
  const initialSync = params.sync === "1"
    ? {
        roomId: params.room?.trim() || "p53-room",
        role: params.client === "guest" ? "guest" as const : "host" as const,
      }
    : null;

  return (
    <WaitingRoomPanel
      initialSync={initialSync}
      calibrationMode={params.calibrate === "1"}
      visualPreset="sketch"
    />
  );
}
