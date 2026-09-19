import WaitingRoomPanel from "../../../components/multiplayer/WaitingRoomPanel";

type LobbyQaPageProps = {
  searchParams: Promise<{
    sync?: string;
    client?: string;
    room?: string;
  }>;
};

export default async function LobbyQaPage({ searchParams }: LobbyQaPageProps) {
  const params = await searchParams;
  const initialSync = params.sync === "1"
    ? {
        roomId: params.room?.trim() || "p53-room",
        role: params.client === "guest" ? "guest" as const : "host" as const,
      }
    : null;

  return <WaitingRoomPanel initialSync={initialSync} />;
}
