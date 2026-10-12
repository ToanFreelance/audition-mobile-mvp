"use client";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import type { RoomState } from "../../multiplayer/types";
import { getEntryIdentity, isEntryRoomId, type EntryIdentity } from "./entry-session";
import styles from "./RoomBrowser.module.css";

type RoomSummary = { roomId: string; roomName: string; modeId: string; playerCount: number; maxPlayers: number; openSlots: number };
type RoomResponse = { ok: boolean; error?: string; conflict?: boolean; snapshot?: RoomState };
type Section = "rooms" | "entertainment" | "friends" | "shop" | "bag";
type Filter = "all" | "solo" | "team" | "playing";
type IconName = "home" | "shop" | "bag" | "friends" | "plus" | "person" | "refresh" | "enter" | "sparkle" | "music" | "settings";
type ShowcaseRoom = { title: string; bpm: number; beat: string; difficulty: "Dễ" | "Thường" | "Khó"; players: number; capacity: number; playing?: boolean; art: number; };
type DisplayRoom = { id: string; roomId: string | null; title: string; subtitle: string; difficulty: ShowcaseRoom["difficulty"] | null; players: number; capacity: number; full: boolean; playing: boolean; sample: boolean; mode: "solo" | "team"; art: number; };
/** Visual-only room cards from the owner-approved sketch. Never JOIN fake room IDs. */
const SHOWCASE_ROOMS: readonly ShowcaseRoom[] = [
  { title: "Hey Beautiful", bpm: 128, beat: "4/4", difficulty: "Dễ", players: 6, capacity: 8, playing: true, art: 1 },
  { title: "Love Scenario", bpm: 110, beat: "2/4", difficulty: "Thường", players: 2, capacity: 8, art: 2 },
  { title: "Dynamite", bpm: 124, beat: "4/8", difficulty: "Khó", players: 5, capacity: 8, art: 3 },
  { title: "Perfect Night", bpm: 120, beat: "4/4", difficulty: "Thường", players: 1, capacity: 8, art: 4 },
  { title: "Smoke", bpm: 132, beat: "4/6", difficulty: "Khó", players: 7, capacity: 8, art: 5 },
  { title: "Super Shy", bpm: 125, beat: "4/4", difficulty: "Dễ", players: 3, capacity: 8, art: 6 },
];
const API = "/api/multiplayer/room";
const NAV: { id: Section; label: string; icon: IconName }[] = [
  { id: "rooms", label: "Phòng", icon: "home" },
  { id: "shop", label: "Shop", icon: "shop" },
  { id: "bag", label: "Túi đồ", icon: "bag" },
  { id: "friends", label: "Bạn bè", icon: "friends" },
];

function Icon({ name, size = 20 }: { name: IconName; size?: number }) {
  const art: Record<IconName, ReactNode> = {
    home: <path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1Z" />,
    shop: <><path d="M3 4h2l2 12h12l2-9H6" /><circle cx="9" cy="20" r="1" /><circle cx="18" cy="20" r="1" /></>,
    bag: <><path d="M5 8h14l2 13H3L5 8Z" /><path d="M9 9V6a3 3 0 0 1 6 0v3" /></>,
    friends: <><circle cx="9" cy="7" r="3" /><path d="M3 20v-2a6 6 0 0 1 12 0v2M17 11a3 3 0 1 0-1-6M18 14c2.5.5 4 2 4 5v1" /></>,
    plus: <path d="M12 5v14M5 12h14" />,
    person: <><circle cx="12" cy="8" r="4" /><path d="M4 21v-2a8 8 0 0 1 16 0v2" /></>,
    refresh: <><path d="M20 7v5h-5M4 17v-5h5" /><path d="M5 9a8 8 0 0 1 13-3l2 1M4 17l2 1a8 8 0 0 0 13-3" /></>,
    enter: <path d="m10 7 5 5-5 5M4 12h11M19 4h2v16h-2" />,
    sparkle: <path d="m12 2 2.2 7.8L22 12l-7.8 2.2L12 22l-2.2-7.8L2 12l7.8-2.2L12 2Z" />,
    music: <><path d="M9 19V5l12-2v14M9 8l12-2" /><circle cx="6" cy="19" r="3" /><circle cx="18" cy="17" r="3" /></>,
    settings: <><circle cx="12" cy="12" r="3" /><path d="M10 2h4l.6 2.4 2 1.1 2.3-.9 2 3.5-1.9 1.7v2.3l1.9 1.7-2 3.5-2.3-.9-2 1.1L14 20h-4l-.6-2.4-2-1.1-2.3.9-2-3.5L5 12.2V9.9L3.1 8.2l2-3.5 2.3.9 2-1.1L10 2Z" /></>,
  };
  return <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">{art[name]}</svg>;
}
async function readResponse(response: Response): Promise<RoomResponse> {
  const data = await response.json() as RoomResponse;
  if (!response.ok || !data.ok || !data.snapshot) throw new Error(data.error ?? `Room request failed (${response.status})`);
  return data;
}
const isTeamMode = (modeId: string) => modeId.toLowerCase().includes("team");

export default function RoomBrowser() {
  const [identity, setIdentity] = useState<EntryIdentity | null>(null);
  const [initialized, setInitialized] = useState(false);
  const [rooms, setRooms] = useState<RoomSummary[]>([]);
  const [roomName, setRoomName] = useState("");
  const [joinId, setJoinId] = useState("");
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [walletInfoOpen, setWalletInfoOpen] = useState(false);
  const [section, setSection] = useState<Section>("rooms");
  const [filter, setFilter] = useState<Filter>("all");

  const displayRooms = useMemo(() => {
    const live: DisplayRoom[] = rooms.map((room, index) => ({
      id: room.roomId, roomId: room.roomId, title: room.roomName,
      subtitle: `Mã ${room.roomId}`, difficulty: null,
      players: room.playerCount, capacity: room.maxPlayers,
      full: room.openSlots < 1, playing: false, sample: false,
      mode: isTeamMode(room.modeId) ? "team" : "solo", art: index % 6 + 1,
    }));
    const samples: DisplayRoom[] = SHOWCASE_ROOMS.slice(0, Math.max(0, 6 - live.length))
      .map((room, index) => ({
        id: `sample-${index}`, roomId: null, title: room.title,
        subtitle: `BPM ${room.bpm}  |  ${room.beat}`, difficulty: room.difficulty,
        players: room.players, capacity: room.capacity, full: false,
        playing: Boolean(room.playing), sample: true, mode: (index === 1 || index === 5) ? "team" : "solo", art: room.art,
      }));
    return [...live, ...samples].filter(room => {
      if (filter === "playing") return room.playing;
      if (filter === "solo") return room.mode === "solo";
      if (filter === "team") return room.mode === "team";
      return true;
    });
  }, [rooms, filter]);
  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const response = await fetch(API + "?browse=1", { cache: "no-store" });
      const data = await response.json() as { ok: boolean; rooms?: RoomSummary[]; error?: string };
      if (!response.ok || !data.ok) throw new Error(data.error ?? "Không tải được phòng.");
      setRooms(data.rooms ?? []);
      setError("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Không tải được danh sách phòng.");
    } finally { setRefreshing(false); }
  }, []);
  useEffect(() => {
    setIdentity(getEntryIdentity());
    setInitialized(true);
    const params = new URLSearchParams(window.location.search);
    setJoinId(params.get("room")?.trim() ?? "");
    void refresh();
  }, [refresh]);
  useEffect(() => {
    const refreshVisible = () => { if (document.visibilityState === "visible") void refresh(); };
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
    setLoading(true); setError("");
    try {
      const result = await readResponse(await fetch(API, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create", participantId: identity.participantId,
          displayName: identity.profile.name, characterAssetId: identity.profile.characterAssetId, roomName: title,
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
    setLoading(true); setError("");
    try {
      for (let attempt = 0; attempt < 4; attempt++) {
        const response = await readResponse(await fetch(API + "?roomId=" + encodeURIComponent(roomId), { cache: "no-store" }));
        const snapshot = response.snapshot!;
        const existing = snapshot.participants.find(member => member.participantId === identity.participantId);
        if (existing) {
          if (existing.kind !== "human") throw new Error("Participant không hợp lệ.");
          window.location.assign("/rooms/" + encodeURIComponent(roomId));
          return;
        }
        if (snapshot.status !== "waiting") throw new Error("Phòng đã bắt đầu.");
        const free = snapshot.slots.find(slot => slot.state === "open" && slot.slotIndex > 0 && slot.slotIndex < 5);
        if (!free) throw new Error("Phòng đã đầy hoặc không có slot mở.");
        const joined = await readResponse(await fetch(API, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "join", roomId, expectedRevision: snapshot.revision,
            participantId: identity.participantId, displayName: identity.profile.name,
            slotIndex: free.slotIndex, characterId: identity.profile.characterAssetId,
            characterAssetId: identity.profile.characterAssetId,
          }),
        }));
        if (joined.conflict) continue;
        if (!joined.snapshot!.participants.some(member => member.participantId === identity.participantId)) {
          throw new Error("Room join chưa được xác nhận.");
        }
        window.location.assign("/rooms/" + encodeURIComponent(roomId));
        return;
      }
      throw new Error("Phòng thay đổi liên tục. Vui lòng thử lại.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Không thể tham gia phòng.");
      setLoading(false);
    }
  };

  if (!initialized) return <main className={styles.shell}><p className={styles.centerState}>Đang tải sảnh phòng…</p></main>;
  if (!identity) return (
    <main className={styles.shell}>
      <section className={styles.onboarding}>
        <span className={styles.brand}>AUDITION <em>MOBILE</em></span>
        <span className={styles.onboardingSymbol}><Icon name="sparkle" size={38} /></span>
        <h1>Hãy tạo nhân vật trước</h1>
        <p>Sảnh phòng sử dụng nhân vật đã lưu trên thiết bị.</p>
        <a className={styles.onboardingButton} href="/character/create">Tạo nhân vật</a>
      </section>
    </main>
  );

  const portrait = identity.profile.characterAssetId === "c4-casual-boy"
    ? "/characters/portraits/c4-casual-boy.jpg" : "/room-ui/demo-avatar.svg";
  const isRoomSection = section === "rooms";
  const sectionLabel = section === "entertainment" ? "Giải trí"
    : section === "friends" ? "Bạn bè" : section === "shop" ? "Shop" : "Túi đồ";

  return (
    <main className={styles.shell} data-testid="entry-room-browser">
      <div className={styles.app}>
        <div className={styles.content}>
          <header className={styles.playerBar}>
            <a href="/character/create" className={styles.avatar} aria-label="Chỉnh sửa nhân vật">
              <img src={portrait} alt="" width="52" height="52" />
            </a>
            <div className={styles.playerText}>
              <strong>{identity.profile.name}</strong>
              <span>Lv. 25</span>
            </div>
            <div className={styles.playerTokens} aria-label="Số dư mẫu chưa triển khai">
              <span className={styles.tokenGold} aria-label="0 coin"><span className={styles.coinSymbol}>◎</span><b>0</b></span>
              <span className={styles.tokenGem} aria-label="0 gem"><span className={styles.gemSymbol} aria-hidden="true"><svg viewBox="0 0 24 24" width="20" height="20" focusable="false"><path d="M7 3.75h10l5 6.3L12 21 2 10.05Z" fill="#CB72FF" stroke="#F6C9FF" strokeWidth="1.1" /><path d="M7 3.75 9.2 10h5.6L17 3.75M9.2 10 12 21l2.8-11H2m12.8 0H22" stroke="#FFF0FF" strokeOpacity=".55" strokeWidth=".7" fill="none" /></svg></span><b>0</b></span>
            </div>
            <button type="button" className={styles.profileSettings} aria-label="Thông tin coin và gem"
              aria-expanded={walletInfoOpen} onClick={() => setWalletInfoOpen(current => !current)}><svg aria-hidden="true" viewBox="0 0 24 24" width="19" height="19" fill="none"><path d="M12 4.5v15M4.5 12h15" stroke="currentColor" strokeWidth="3.6" strokeLinecap="round" /></svg></button>
          </header>
          {walletInfoOpen && <p className={styles.walletNotice} role="status">Coin và Gem: 0 (dữ liệu mẫu). Shop sẽ được mở sau.</p>}
          <nav className={styles.primaryTabs} aria-label="Mục trong sảnh">
            <button type="button" className={isRoomSection ? styles.tabActive : ""}
              aria-current={isRoomSection ? "page" : undefined} onClick={() => setSection("rooms")}>Phòng</button>
            <button type="button" className={section === "entertainment" ? styles.tabActive : ""}
              onClick={() => setSection("entertainment")}>Giải trí</button>
            <button type="button" className={section === "friends" ? styles.tabActive : ""}
              onClick={() => setSection("friends")}>Bạn bè</button>
          </nav>
          {isRoomSection ? <>
            <nav className={styles.filters} aria-label="Bộ lọc phòng">
              {([["all", "Tất cả"], ["solo", "Solo"], ["team", "Team"], ["playing", "Đang chơi"]] as const).map(([value, label]) => (
                <button type="button" key={value} aria-pressed={filter === value}
                  className={filter === value ? styles.filterActive : ""}
                  onClick={() => setFilter(value)}>{label}</button>
              ))}
            </nav>
            <button className={styles.createCard} data-testid="entry-create-room" type="button"
              disabled={loading} onClick={() => void create()}>
              <span className={styles.createIcon}><Icon name="plus" size={31} /></span>
              <span className={styles.createText}>
                <strong>{loading ? "Đang tạo phòng…" : "Tạo phòng"}</strong>
                <small>Tự do thiết lập, chơi cùng bạn bè</small>
              </span>
              <span className={styles.createSparkle}><Icon name="sparkle" size={20} /></span>
            </button>
            <details className={styles.createOptions}>
              <summary>Tùy chỉnh tên phòng <span>⌄</span></summary>
              <label htmlFor="roomName">Tên phòng mới</label>
              <input id="roomName" data-testid="entry-room-name" maxLength={32}
                placeholder={`Phòng của ${identity.profile.name}`} value={roomName}
                onChange={event => setRoomName(event.target.value)} />
            </details>
            <section className={styles.joinQuick} aria-label="Vào phòng bằng mã">
              <span className={styles.quickIcon}><Icon name="enter" size={19} /></span>
              <input aria-label="Mã phòng" data-testid="entry-room-code" maxLength={64}
                placeholder="Nhập mã phòng mvp-…" value={joinId}
                onChange={event => setJoinId(event.target.value)}
                onKeyDown={event => { if (event.key === "Enter") void join(joinId); }} />
              <button type="button" disabled={loading} onClick={() => void join(joinId)}>Tham gia</button>
            </section>
            <section className={styles.roomSection} aria-label="Danh sách phòng">
              <div className={styles.sectionHeader}>
                <h1>Danh sách phòng</h1>
                <button className={styles.refresh} type="button" disabled={refreshing}
                  onClick={() => void refresh()} aria-label="Làm mới danh sách phòng">
                  <Icon name="refresh" size={17} /><span>{refreshing ? "Đang tải" : "Làm mới"}</span>
                </button>
              </div>
              <div className={styles.roomScroll} role="region" aria-label="Danh sách phòng cuộn" data-testid="entry-room-scroll" tabIndex={0}>
                <div className={styles.roomList}>
                {displayRooms.map(room => (
                  <article key={room.id} className={room.sample ? `${styles.room} ${styles.sampleRoom}` : styles.room}>
                    <button type="button" className={styles.roomAction}
                      data-testid={room.sample ? undefined : "entry-join-room"}
                      disabled={loading || room.full || room.sample}
                      onClick={() => { if (room.roomId) void join(room.roomId); }}
                      aria-label={`${room.title} · ${room.sample ? "Phòng mẫu, không thể tham gia" : room.full ? "Đã đầy" : "Vào phòng"}`}>
                      <span className={styles.cover}>
                        <img src={`/room-ui/cover-${room.art}.svg`} alt="" loading="lazy" width="76" height="76" />
                        {room.sample && <span className={styles.sampleMark}>MẪU</span>}
                      </span>
                      <span className={styles.roomDetails}>
                        <strong>{room.title}</strong>
                        <span className={styles.roomCode}>{room.subtitle}</span>
                        <span className={styles.roomTags}>
                          {room.difficulty ? <span className={
                            room.difficulty === "Dễ" ? styles.easyTag
                              : room.difficulty === "Khó" ? styles.hardTag : styles.normalTag
                          }>{room.difficulty}</span>
                            : <span className={room.mode === "team" ? styles.teamTag : styles.soloTag}>{room.mode === "team" ? "Team" : "Solo"}</span>}
                          {room.playing && <span className={styles.playTag}>Đang chơi</span>}
                          {!room.sample && <span className={room.full ? styles.fullTag : styles.waitTag}>
                            {room.full ? "Đã đầy" : "Đang chờ"}
                          </span>}
                        </span>
                      </span>
                      <span className={styles.roomRight}>
                        <span className={styles.signal} aria-hidden="true"><i /><i /><i /><i /></span>
                        <span className={styles.capacity}><Icon name="person" size={17} /> {room.players}/{room.capacity}</span>
                      </span>
                    </button>
                  </article>
                ))}
                </div>
                {rooms.length === 0 && <p className={styles.sampleNotice}>Các phòng có nhãn MẪU chỉ minh họa giao diện. Tạo phòng để chơi thật.</p>}
              </div>
            </section>
          </> : <section className={styles.comingSoon}>
            <span className={styles.comingSoonIcon}>
              <Icon name={section === "shop" ? "shop" : section === "bag" ? "bag" : "sparkle"} size={42} />
            </span>
            <h1>{sectionLabel}</h1>
            <p>Khu vực này sẽ mở trong các giai đoạn tiếp theo. Hiện tại bạn có thể tạo phòng và chơi cùng bạn bè.</p>
            <button type="button" className={styles.backToRooms} onClick={() => setSection("rooms")}>Trở về danh sách phòng</button>
          </section>}
          {error && <p className={styles.error} role="alert">{error}</p>}
        </div>
        <footer className={styles.bottomNav} aria-label="Điều hướng chính">
          {NAV.map(item => <button key={item.id} type="button"
            aria-current={section === item.id ? "page" : undefined}
            className={section === item.id ? styles.navActive : ""}
            onClick={() => setSection(item.id)}>
            <Icon name={item.icon} size={19} /><span>{item.label}</span>
          </button>)}
        </footer>
      </div>
    </main>
  );
}
