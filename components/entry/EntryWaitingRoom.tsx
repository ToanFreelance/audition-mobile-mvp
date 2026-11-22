"use client";

import { useEffect, useState } from "react";
import type { RoomState } from "../../multiplayer/types";
import WaitingRoomPanel from "../multiplayer/WaitingRoomPanel";
import StageLaunchArtwork from "../multiplayer/StageLaunchArtwork";
import styles from "./EntryWaitingRoom.module.css";
import { isEntryRoomId } from "./entry-session";
import { resolveWaitingRoomIdentity, roomAvatarMatchesSavedIdentity } from "./entry-room-identity";

type ActiveEntry = {
  snapshot: RoomState;
  role: "host" | "guest";
  participantId: string;
};

export default function EntryWaitingRoom({ roomId }: { roomId: string }) {
  const [entry, setEntry] = useState<ActiveEntry | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    if (!isEntryRoomId(roomId)) {
      setError("Mã phòng không hợp lệ.");
      return;
    }
    let canceled = false;
    void (async () => {
      try {
        // Authenticated participants use the SAME server identity as Room
        // Browser; legacy localStorage is used only for true guests.
        const resolved = await resolveWaitingRoomIdentity();
        if (canceled) return;
        const identity = resolved.identity;
        if (!identity) {
          window.location.replace("/character/create");
          return;
        }
        const response = await fetch(
          "/api/multiplayer/room?roomId=" + encodeURIComponent(roomId),
          { credentials: "same-origin", cache: "no-store" },
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
          // Do not treat a mismatch as a missing account character. It may be
          // a stale room from a prior profile or a wrong participant ID.
          setError("Tài khoản hiện tại không có mặt trong phòng này. Hãy quay lại Room Browser và tạo hoặc tham gia phòng mới.");
          return;
        }
        if (!roomAvatarMatchesSavedIdentity(member, identity)) {
          setError("Nhân vật trong RoomState không khớp với nhân vật đã lưu. Hãy quay lại Room Browser và tạo phòng mới.");
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

  if (error || !entry) return (
    <main className={styles.cover} data-testid="entry-room-cover">
      <StageLaunchArtwork />
      <section className={styles.status} role="status" aria-live="polite">
        <strong>{error ? "KHÔNG VÀO ĐƯỢC PHÒNG" : "ĐANG KẾT NỐI PHÒNG"}</strong>
        <p>{error || "Đang xác nhận thành viên và trạng thái phòng…"}</p>
        {error && <a href="/rooms">← Quay lại sảnh phòng</a>}
      </section>
    </main>
  );
  return (
    <WaitingRoomPanel
      // P5.6 owner-accepted golden-sketch stage, including reflective floor.
      // The fallback/default preset is only for isolated QA experiments.
      visualPreset="sketch"
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
