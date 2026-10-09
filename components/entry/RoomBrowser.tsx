"use client";

import { useCallback, useEffect, useState } from "react";
import type { RoomState } from "../../multiplayer/types";
import { getEntryIdentity, isEntryRoomId, type EntryIdentity } from "./entry-session";
import styles from "./RoomBrowser.module.css";

type RoomSummary = {
  roomId: string;
  roomName: string;
  modeId: string;
  playerCount: number;
  maxPlayers: number;
  openSlots: number;
};

type RoomResponse = { ok: boolean; error?: string; conflict?: boolean; snapshot?: RoomState };
const API = "/api/multiplayer/room";

async function readResponse(response: Response): Promise<RoomResponse> {
  const data = await response.json() as RoomResponse;
  if (!response.ok || !data.ok || !data.snapshot) {
    throw new Error(data.error ?? `Room request failed (${response.status})`);
  }
  return data;
}

export default function RoomBrowser() {
  const [identity, setIdentity] = useState<EntryIdentity | null>(null);
  const [initialized, setInitialized] = useState(false);
  const [rooms, setRooms] = useState<RoomSummary[]>([]);
  const [roomName, setRoomName] = useState("");
  const [joinId, setJoinId] = useState("");
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const response = await fetch(API + "?browse=1", { cache: "no-store" });
      const data = await response.json() as {
        ok: boolean; rooms?: RoomSummary[]; error?: string;
      };
      if (!response.ok || !data.ok) throw new Error(data.error ?? "Không tải được phòng.");
      setRooms(data.rooms ?? []);
      setError("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Không tải được danh sách phòng.");
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    setIdentity(getEntryIdentity());
    setInitialized(true);
    const params = new URLSearchParams(window.location.search);
    setJoinId(params.get("room")?.trim() ?? "");
    void refresh();
  }, [refresh]);

  // Rooms can close/expire while the browser is parked. Refresh when the
  // user returns to the tab, plus a low-frequency foreground poll.
  useEffect(() => {
    const refreshVisible = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    const timer = window.setInterval(refreshVisible, 30_000);
    document.addEventListener("visibilitychange", refreshVisible);
    window.addEventListener("pageshow", refreshVisible);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", refreshVisible);
      window.removeEventListener("pageshow", refreshVisible);
    };
  }, [refresh]);

  const create = async () => {
    if (!identity || loading) return;
    const title = roomName.trim() || `Phòng của ${identity.profile.name}`;
    setLoading(true);
    setError("");
    try {
      const result = await readResponse(await fetch(API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create",
          participantId: identity.participantId,
          displayName: identity.profile.name,
          characterAssetId: identity.profile.characterAssetId,
          roomName: title,
        }),
      }));
      window.location.assign("/rooms/" + encodeURIComponent(result.snapshot!.roomId));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Không tạo được phòng.");
      setLoading(false);
    }
  };

  const join = async (value: string) => {
    if (!identity || loading) return;
    const roomId = value.trim();
    if (!isEntryRoomId(roomId)) {
      setError("Mã phòng không hợp lệ. Hãy chọn phòng từ danh sách.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      for (let attempt = 0; attempt < 4; attempt++) {
        const response = await readResponse(await fetch(
          API + "?roomId=" + encodeURIComponent(roomId), { cache: "no-store" },
        ));
        const snapshot = response.snapshot!;
        const existing = snapshot.participants.find(
          member => member.participantId === identity.participantId,
        );
        if (existing) {
          if (existing.kind !== "human") throw new Error("Participant không hợp lệ.");
          window.location.assign("/rooms/" + encodeURIComponent(roomId));
          return;
        }
        if (snapshot.status !== "waiting") throw new Error("Phòng đã bắt đầu.");
        const free = snapshot.slots.find(slot =>
          slot.state === "open" && slot.slotIndex > 0 && slot.slotIndex < 5
        );
        if (!free) throw new Error("Phòng đã đầy hoặc không có slot mở.");
        const joined = await readResponse(await fetch(API, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "join",
            roomId,
            expectedRevision: snapshot.revision,
            participantId: identity.participantId,
            displayName: identity.profile.name,
            slotIndex: free.slotIndex,
            characterId: identity.profile.characterAssetId,
            characterAssetId: identity.profile.characterAssetId,
          }),
        }));
        if (joined.conflict) continue; // authoritative CAS; retry using new snapshot
        if (!joined.snapshot!.participants.some(
          member => member.participantId === identity.participantId
        )) throw new Error("Room join chưa được xác nhận.");
        window.location.assign("/rooms/" + encodeURIComponent(roomId));
        return;
      }
      throw new Error("Phòng thay đổi liên tục. Vui lòng thử lại.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Không thể tham gia phòng.");
      setLoading(false);
    }
  };

  if (!initialized) return <main className={styles.shell}><p>Đang tải sảnh phòng…</p></main>;
  if (!identity) return (
    <main className={styles.shell}>
      <section className={styles.panel}>
        <h1>Hãy tạo nhân vật trước</h1>
        <p>Sảnh phòng sử dụng nhân vật đã lưu trên thiết bị.</p>
        <a className={styles.primary} href="/character/create">Tạo nhân vật</a>
      </section>
    </main>
  );

  return (
    <main className={styles.shell} data-testid="entry-room-browser">
      <section className={styles.panel}>
        <header className={styles.header}>
          <div>
            <span className={styles.eyebrow}>AUDITION · MULTIPLAYER</span>
            <h1>Sảnh phòng</h1>
            <p>Chào <strong>{identity.profile.name}</strong> · Chọn phòng để bắt đầu nhảy</p>
          </div>
          <a href="/character/create" className={styles.secondary}>Sửa nhân vật</a>
        </header>
        <section className={styles.creation}>
          <h2>Tạo phòng mới</h2>
          <label htmlFor="roomName">Tên phòng</label>
          <input
            id="roomName"
            data-testid="entry-room-name"
            maxLength={32}
            placeholder={`Phòng của ${identity.profile.name}`}
            value={roomName}
            onChange={event => setRoomName(event.target.value)}
          />
          <button data-testid="entry-create-room" disabled={loading} className={styles.primary}
            onClick={() => void create()} type="button">
            {loading ? "Đang xử lý…" : "＋ TẠO PHÒNG"}
          </button>
        </section>
        <section className={styles.join}>
          <h2>Vào bằng mã phòng</h2>
          <div className={styles.joinRow}>
            <input
              aria-label="Mã phòng"
              data-testid="entry-room-code"
              maxLength={64}
              placeholder="mvp-..."
              value={joinId}
              onChange={event => setJoinId(event.target.value)}
            />
            <button disabled={loading} className={styles.secondary}
              onClick={() => void join(joinId)} type="button">Tham gia</button>
          </div>
        </section>
        <section className={styles.browser}>
          <div className={styles.listHeader}>
            <h2>Phòng đang chờ</h2>
            <button type="button" className={styles.secondary} disabled={refreshing}
              onClick={() => void refresh()}>{refreshing ? "Đang tải…" : "↻ Làm mới"}</button>
          </div>
          {rooms.length === 0 && !refreshing
            ? <p className={styles.empty}>Chưa có phòng MVP gần đây. Bạn có thể tạo phòng đầu tiên.</p>
            : <div className={styles.roomList}>
              {rooms.map(room => (
                <article key={room.roomId} className={styles.room}>
                  <div>
                    <strong>{room.roomName}</strong>
                    <small>{room.roomId} · {room.playerCount}/{room.maxPlayers} người</small>
                  </div>
                  <button type="button" className={styles.primary}
                    data-testid="entry-join-room"
                    disabled={loading || room.openSlots < 1}
                    onClick={() => void join(room.roomId)}>
                    {room.openSlots > 0 ? "VÀO PHÒNG" : "ĐÃ ĐẦY"}
                  </button>
                </article>
              ))}
            </div>}
        </section>
        {error && <p className={styles.error} role="alert">{error}</p>}
        <footer className={styles.note}>
          MVP dùng hồ sơ lưu trên thiết bị. Account, mật khẩu và phân quyền đăng nhập thuộc Phase 7.
        </footer>
      </section>
    </main>
  );
}
