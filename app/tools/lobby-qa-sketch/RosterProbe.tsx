"use client";

import { useState } from "react";
import WaitingRoomStage3D from "../../../components/multiplayer/WaitingRoomStage3D";
import type { ConnectionState, RoomState } from "../../../multiplayer/types";

/** Local snapshots exercise the real stage reconciliation and never connect to a room. */
export default function RosterProbe({ room }: { room: RoomState }) {
  const [ready, setReady] = useState(false);
  const [connection, setConnection] = useState<ConnectionState>("connected");
  const guest = room.participants.find(p => p.role === "guest")!;
  const participants = room.participants.map(p =>
    p.participantId === guest.participantId && p.kind === "human" && p.role === "guest"
      ? { ...p, readyState: ready ? "ready" as const : "not-ready" as const, connectionState: connection }
      : p,
  );
  return (
    <main style={{ width: "100vw", height: "100dvh", position: "relative" }}>
      <WaitingRoomStage3D participants={participants} slots={room.slots} roomId={room.roomId}
        stageId={room.selectedStageId} visualPreset="sketch" viewMode="wide" pageIndex={0}
        selectedParticipantId={room.hostParticipantId} />
      <div style={{ position: "absolute", bottom: 8, left: 8, zIndex: 50 }}>
        <button type="button" aria-pressed={ready} onClick={() => setReady(!ready)}>Sẵn sàng</button>
        <button type="button" aria-pressed={connection === "connected"}
          onClick={() => setConnection(connection === "connected" ? "disconnected" : "connected")}>
          Kết nối
        </button>
      </div>
    </main>
  );
}
