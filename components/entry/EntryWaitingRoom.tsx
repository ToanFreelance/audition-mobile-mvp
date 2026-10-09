"use client";

import { useEffect, useState } from "react";
import type { RoomState } from "../../multiplayer/types";
import WaitingRoomPanel from "../multiplayer/WaitingRoomPanel";
import { getEntryIdentity, isEntryRoomId } from "./entry-session";

type ActiveEntry = {
  snapshot: RoomState;
  role: "host" | "guest";
  participantId: string;
};

export default function EntryWaitingRoom({ roomId }: { roomId: string }) {
  const [entry, setEntry] = useState<ActiveEntry | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    const identity = getEntryIdentity();
    if (!identity) {
      window.location.replace("/character/create");
      return;
    }
    if (!isEntryRoomId(roomId)) {
      setError("Mã phòng không hợp lệ.");
      return;
    }
    let canceled = false;
    void (async () => {
      try {
        const response = await fetch(
          "/api/multiplayer/room?roomId=" + encodeURIComponent(roomId),
          { cache: "no-store" },
        );
        const data = await response.json() as {
          ok: boolean; error?: string; snapshot?: RoomState;
        };
        if (!response.ok || !data.ok || !data.snapshot) {
          throw new Error(data.error ?? "Không tìm thấy phòng.");
        }
        if (canceled) return;
        const member = data.snapshot.participants.find(
          participant => participant.participantId === identity.participantId
        );
        if (!member || member.kind !== "human") {
          window.location.replace("/rooms?room=" + encodeURIComponent(roomId));
          return;
        }
        setEntry({
          snapshot: data.snapshot,
          role: member.role,
          participantId: member.participantId,
        });
      } catch (cause) {
        if (!canceled) setError(cause instanceof Error ? cause.message : "Không mở được phòng.");
      }
    })();
    return () => { canceled = true; };
  }, [roomId]);

  if (error) return (
    <main style={{ minHeight: "100dvh", background: "#101027", padding: 24, color: "#fff" }}>
      <h1>Không vào được phòng</h1>
      <p role="alert">{error}</p>
      <a href="/rooms" style={{ color: "#f0a5ff" }}>← Quay lại sảnh phòng</a>
    </main>
  );
  if (!entry) return (
    <main style={{ minHeight: "100dvh", background: "#101027", padding: 24, color: "#fff" }}>
      Đang xác nhận thành viên phòng…
    </main>
  );
  return (
    <WaitingRoomPanel
      initialRoom={entry.snapshot}
      initialSync={{
        roomId,
        role: entry.role,
        participantId: entry.participantId,
        entryFlow: true,
      }}
    />
  );
}
