"use client";

import { useMemo, useState } from "react";
import {
  canStartRoom,
  changeMode,
  changeSong,
  changeStage,
  closeSlot,
  openSlot,
  removeParticipant,
  setGuestReady,
} from "../../multiplayer/room-state";
import { createP51WaitingRoomFixture } from "../../multiplayer/waiting-room-qa";
import type { RoomParticipant, RoomSlotIndex } from "../../multiplayer/types";
import WaitingRoomStage3D, { type WaitingRoomStageView } from "./WaitingRoomStage3D";
import styles from "./WaitingRoomPanel.module.css";

type PanelKind = "song" | "stage" | "player" | null;

type SongOption = {
  id: string;
  title: string;
  artist: string;
  bpm: number;
  duration: string;
  difficulty: "Easy" | "Normal" | "Hard";
  playable: boolean;
  accent: string;
};

const SONGS: readonly SongOption[] = [
  { id: "aloha", title: "Aloha", artist: "Audition", bpm: 101, duration: "02:45", difficulty: "Easy", playable: true, accent: "A" },
  { id: "please-tell-me-why", title: "Please Tell Me Why", artist: "Audition", bpm: 80, duration: "04:26", difficulty: "Easy", playable: true, accent: "P" },
  { id: "hey-beautiful", title: "Hey Beautiful", artist: "Audition", bpm: 128, duration: "02:45", difficulty: "Easy", playable: false, accent: "H" },
  { id: "in-my-arms", title: "In My Arms", artist: "Kylie Minogue", bpm: 128, duration: "03:20", difficulty: "Normal", playable: false, accent: "I" },
  { id: "beat-city", title: "Beat City", artist: "Audition", bpm: 120, duration: "02:30", difficulty: "Hard", playable: false, accent: "B" },
  { id: "party-summer-night", title: "Party Summer Night", artist: "Audition", bpm: 96, duration: "02:18", difficulty: "Easy", playable: false, accent: "S" },
];

const STAGES = [
  { id: "studio-81", name: "Studio 81", detail: "Classic neon club", icon: "◫" },
  { id: "neon-club", name: "Neon Club", detail: "Blue & magenta arena", icon: "◇" },
  { id: "purple-hall", name: "Purple Hall", detail: "Deep violet showcase", icon: "✦" },
  { id: "city-night", name: "City Night", detail: "Skyline dance floor", icon: "▤" },
] as const;

function initials(name: string) {
  return name.split(/\s+/).map(part => part[0]).join("").slice(0, 2).toUpperCase();
}

function statusLabel(participant: RoomParticipant) {
  if (participant.role === "host") return "HOST";
  if (participant.kind === "bot") return "READY";
  return participant.readyState === "ready" ? "READY" : "NOT READY";
}

function levelFor(participant: RoomParticipant) {
  if (participant.role === "host") return 25;
  if (participant.participantId === "p51-guest") return 18;
  return participant.kind === "bot" ? 16 : 12;
}

function modeLabel(modeId: string) {
  return modeId === "solo-easy-battle" ? "Solo Easy" : modeId === "team-easy" ? "Team Easy" : modeId;
}

export default function WaitingRoomPanel() {
  const [room, setRoom] = useState(createP51WaitingRoomFixture);
  const [viewParticipantId, setViewParticipantId] = useState(room.hostParticipantId);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [stagePage, setStagePage] = useState(0);
  const [viewMode, setViewMode] = useState<WaitingRoomStageView>("center");
  const [selectedParticipantId, setSelectedParticipantId] = useState<string | null>(room.hostParticipantId);
  const [panel, setPanel] = useState<PanelKind>(null);
  const [songDraft, setSongDraft] = useState(room.selectedSongId ?? "aloha");
  const [stageDraft, setStageDraft] = useState(room.selectedStageId);
  const [songSearch, setSongSearch] = useState("");
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  const viewer = room.participants.find(item => item.participantId === viewParticipantId) ?? room.participants[0];
  const hostView = viewer.participantId === room.hostParticipantId;
  const startGate = useMemo(() => canStartRoom(room), [room]);
  const participantById = useMemo(() => new Map(room.participants.map(item => [item.participantId, item])), [room.participants]);
  const orderedParticipants = useMemo(
    () => [...room.participants].sort((a, b) => a.slotIndex - b.slotIndex),
    [room.participants],
  );
  const selectedParticipant = selectedParticipantId
    ? room.participants.find(item => item.participantId === selectedParticipantId) ?? null
    : null;
  const stagePageCount = Math.max(1, Math.ceil(orderedParticipants.length / 2));
  const safeStagePage = Math.min(stagePage, stagePageCount - 1);
  const currentSong = SONGS.find(song => song.id === room.selectedSongId) ?? SONGS[0];
  const currentStage = STAGES.find(stage => stage.id === room.selectedStageId) ?? STAGES[0];
  const filteredSongs = SONGS.filter(song =>
    !songSearch.trim()
    || `${song.title} ${song.artist} ${song.bpm}`.toLowerCase().includes(songSearch.trim().toLowerCase()),
  );

  const toggleSlot = (slotIndex: RoomSlotIndex) => {
    if (!hostView) return;
    const slot = room.slots.find(item => item.slotIndex === slotIndex);
    if (!slot || slot.state === "occupied") return;
    setRoom(current => slot.state === "open"
      ? closeSlot(current, current.hostParticipantId, slotIndex)
      : openSlot(current, current.hostParticipantId, slotIndex));
  };

  const toggleReady = () => {
    if (viewer.kind !== "human" || viewer.role !== "guest") return;
    setRoom(current => setGuestReady(current, viewer.participantId, viewer.readyState !== "ready"));
  };

  const changeModeQa = () => setRoom(current => changeMode(
    current,
    current.hostParticipantId,
    current.modeId === "solo-easy-battle" ? "team-easy" : "solo-easy-battle",
  ));

  const previousStagePage = () => {
    if (viewMode === "close") {
      const currentIndex = Math.max(0, orderedParticipants.findIndex(item => item.participantId === selectedParticipantId));
      const nextIndex = (currentIndex - 1 + orderedParticipants.length) % orderedParticipants.length;
      setSelectedParticipantId(orderedParticipants[nextIndex]?.participantId ?? null);
      return;
    }
    setStagePage(current => (current - 1 + stagePageCount) % stagePageCount);
  };

  const nextStagePage = () => {
    if (viewMode === "close") {
      const currentIndex = Math.max(0, orderedParticipants.findIndex(item => item.participantId === selectedParticipantId));
      const nextIndex = (currentIndex + 1) % orderedParticipants.length;
      setSelectedParticipantId(orderedParticipants[nextIndex]?.participantId ?? null);
      return;
    }
    setStagePage(current => (current + 1) % stagePageCount);
  };

  const selectParticipant = (participant: RoomParticipant) => {
    setSelectedParticipantId(participant.participantId);
    setPanel("player");
    setActionNotice(null);
  };

  const openSongPicker = () => {
    if (!hostView) return;
    setSongDraft(room.selectedSongId ?? "aloha");
    setSongSearch("");
    setPanel("song");
  };

  const confirmSong = () => {
    const song = SONGS.find(item => item.id === songDraft);
    if (!hostView || !song?.playable) return;
    setRoom(current => changeSong(current, current.hostParticipantId, song.id));
    setPanel(null);
  };

  const openStagePicker = () => {
    if (!hostView) return;
    setStageDraft(room.selectedStageId);
    setPanel("stage");
  };

  const confirmStage = () => {
    if (!hostView) return;
    setRoom(current => changeStage(current, current.hostParticipantId, stageDraft));
    setPanel(null);
  };

  const kickSelectedParticipant = () => {
    if (!hostView || !selectedParticipant || selectedParticipant.participantId === room.hostParticipantId) return;
    const kickedId = selectedParticipant.participantId;
    setRoom(current => removeParticipant(current, kickedId));
    setSelectedParticipantId(room.hostParticipantId);
    setPanel(null);
    setViewMode("center");
    setStagePage(0);
  };

  const playerAction = (label: string) => setActionNotice(`${label} sẽ được nối dữ liệu thật ở milestone tương ứng.`);

  return (
    <main className={styles.shell}>
      <section className={styles.phone}>
        <header className={styles.header}>
          <button className={styles.iconButton} type="button" aria-label="Back">‹</button>
          <div className={styles.titleBlock}>
            <strong>{room.roomName}</strong>
            <span>ID: {room.roomId} <i /> {modeLabel(room.modeId)} <i /> {room.participants.length}/{room.maxPlayers}</span>
          </div>
          <div className={styles.headerRight}>
            <button className={styles.iconButton} onClick={() => setSettingsOpen(open => !open)} type="button" aria-label="Room settings">⚙</button>
            <small>{hostView ? "Host" : "Guest"}</small>
          </div>
        </header>

        {settingsOpen && (
          <aside className={styles.settingsPopover}>
            <strong>ROOM QA</strong>
            <div className={styles.settingsRow}>
              <span>View as</span>
              {room.participants.filter(item => item.kind === "human").map(participant => (
                <button
                  className={participant.participantId === viewer.participantId ? styles.settingsSelected : styles.settingsButton}
                  key={participant.participantId}
                  onClick={() => setViewParticipantId(participant.participantId)}
                  type="button"
                >
                  {participant.role === "host" ? "HOST" : "GUEST"}
                </button>
              ))}
            </div>
            {hostView && <button className={styles.settingsAction} onClick={changeModeQa} type="button">Switch mode QA</button>}
            <div className={styles.settingsMeta}>
              <span>Stage · {currentStage.name}</span>
              <span>Start gate · {startGate.allowed ? "ENABLED" : startGate.reason}</span>
              <span>Revision · {room.revision}</span>
              <span>Host Ready · not-applicable</span>
            </div>
          </aside>
        )}

        <section className={styles.stageWrap}>
          <WaitingRoomStage3D
            participants={orderedParticipants}
            slots={room.slots}
            roomId={room.roomId}
            stageId={room.selectedStageId}
            viewMode={viewMode}
            pageIndex={safeStagePage}
            pageSize={2}
            selectedParticipantId={selectedParticipantId}
            onSelectParticipant={selectParticipant}
          />

          <div className={styles.viewModeBar}>
            {(["wide", "center", "close"] as WaitingRoomStageView[]).map(mode => (
              <button
                className={viewMode === mode ? styles.viewModeActive : styles.viewModeButton}
                key={mode}
                onClick={() => {
                  setViewMode(mode);
                  if (mode === "close" && !selectedParticipantId) {
                    setSelectedParticipantId(orderedParticipants[0]?.participantId ?? null);
                  }
                }}
                type="button"
              >
                <span>{mode === "wide" ? "♟♟♟" : mode === "center" ? "♟♟" : "◎"}</span>
                {mode.toUpperCase()}
              </button>
            ))}
          </div>

          {viewMode !== "wide" && orderedParticipants.length > 1 && (
            <>
              <button className={`${styles.stageArrow} ${styles.stageArrowLeft}`} onClick={previousStagePage} type="button" aria-label="Previous participants">‹</button>
              <button className={`${styles.stageArrow} ${styles.stageArrowRight}`} onClick={nextStagePage} type="button" aria-label="Next participants">›</button>
            </>
          )}
          {viewMode === "center" && stagePageCount > 1 && (
            <div className={styles.stagePager} aria-hidden="true">
              {Array.from({ length: stagePageCount }, (_, index) => (
                <span className={index === safeStagePage ? styles.stageDotActive : styles.stageDot} key={index} />
              ))}
            </div>
          )}
        </section>

        <section className={styles.slotDock}>
          {room.slots.map(slot => {
            const participant = slot.state === "occupied" ? participantById.get(slot.participantId) : null;
            const status = participant ? statusLabel(participant) : slot.state.toUpperCase();
            const selected = participant?.participantId === selectedParticipantId;
            return (
              <button
                className={`${styles.slot} ${styles[slot.state]} ${participant?.role === "host" ? styles.slotHost : ""} ${selected ? styles.slotSelected : ""}`}
                disabled={!participant && !hostView}
                key={slot.slotIndex}
                onClick={() => participant ? selectParticipant(participant) : toggleSlot(slot.slotIndex)}
                type="button"
              >
                <span className={styles.slotNumber}>{slot.slotIndex + 1}</span>
                <span className={styles.slotAvatar}>{participant ? initials(participant.displayName) : slot.state === "open" ? "+" : "×"}</span>
                <strong>{status}</strong>
              </button>
            );
          })}
        </section>

        <section className={styles.songCard}>
          <div className={styles.cover}><span>{currentSong.accent}</span><b>{currentSong.title.slice(0, 8).toUpperCase()}</b></div>
          <div className={styles.songMeta}>
            <strong>{currentSong.title}</strong>
            <span>{currentSong.artist}</span>
            <small>BPM {currentSong.bpm} <i /> {currentSong.duration} <i /> <em>{currentSong.difficulty}</em></small>
          </div>
          {hostView && <button className={styles.changeSongButton} onClick={openSongPicker} type="button">♫ Đổi nhạc</button>}
        </section>

        <footer className={styles.actions}>
          <button className={styles.leaveButton} type="button">↪ Rời phòng</button>
          {viewer.kind === "human" && viewer.role === "guest" ? (
            <button className={viewer.readyState === "ready" ? styles.readyButtonActive : styles.readyButton} onClick={toggleReady} type="button">
              ✓ {viewer.readyState === "ready" ? "Đã sẵn sàng" : "Sẵn sàng"}
            </button>
          ) : (
            <button className={styles.stagePickerButton} onClick={openStagePicker} type="button">
              ♜ Đổi sân khấu
            </button>
          )}
          <button className={startGate.allowed && hostView ? styles.startButton : styles.startButtonDisabled} disabled={!hostView || !startGate.allowed} type="button">
            ▶ Bắt đầu
          </button>
        </footer>

        {panel && (
          <div className={styles.overlay} role="presentation" onMouseDown={event => {
            if (event.target === event.currentTarget) setPanel(null);
          }}>
            {panel === "song" && (
              <section className={`${styles.sheet} ${styles.songSheet}`}>
                <div className={styles.sheetHeader}>
                  <div><small>CHỌN NHẠC</small><strong>Song Picker</strong></div>
                  <button onClick={() => setPanel(null)} type="button">×</button>
                </div>
                <div className={styles.songTabs}>
                  <button className={styles.chipActive} type="button">Tất cả</button>
                  <button type="button">Audition</button>
                  <button type="button">Hot</button>
                  <button type="button">Yêu thích</button>
                </div>
                <label className={styles.searchBox}>⌕<input value={songSearch} onChange={event => setSongSearch(event.target.value)} placeholder="Tìm nhạc, tên bài hát, nghệ sĩ…" /></label>
                <div className={styles.filterRow}>
                  <span>BPM⌄</span><span>Độ khó⌄</span><span>Mới nhất</span><span>↝</span>
                </div>
                <div className={styles.songList}>
                  {filteredSongs.map(song => (
                    <button
                      className={songDraft === song.id ? styles.songRowSelected : styles.songRow}
                      disabled={!song.playable}
                      key={song.id}
                      onClick={() => setSongDraft(song.id)}
                      type="button"
                    >
                      <span className={styles.songThumb}>{song.accent}</span>
                      <span className={styles.songRowText}><strong>{song.title}</strong><small>{song.artist}</small><em>{song.bpm} BPM · {song.duration}</em></span>
                      <span className={`${styles.difficulty} ${styles[`difficulty${song.difficulty}`]}`}>{song.difficulty}</span>
                      {!song.playable && <span className={styles.coming}>SOON</span>}
                    </button>
                  ))}
                </div>
                <div className={styles.sheetActions}>
                  <button className={styles.randomButton} type="button">⤨ Ngẫu nhiên</button>
                  <button className={styles.confirmButton} disabled={!SONGS.find(song => song.id === songDraft)?.playable} onClick={confirmSong} type="button">✓ Xác nhận</button>
                </div>
              </section>
            )}

            {panel === "stage" && (
              <section className={styles.sheet}>
                <div className={styles.sheetHeader}>
                  <div><small>SÂN KHẤU</small><strong>Chọn sân khấu</strong></div>
                  <button onClick={() => setPanel(null)} type="button">×</button>
                </div>
                <div className={styles.stageGrid}>
                  {STAGES.map(stage => (
                    <button
                      className={stageDraft === stage.id ? styles.stageCardSelected : styles.stageCard}
                      key={stage.id}
                      onClick={() => setStageDraft(stage.id)}
                      type="button"
                    >
                      <span>{stage.icon}</span>
                      <strong>{stage.name}</strong>
                      <small>{stage.detail}</small>
                    </button>
                  ))}
                </div>
                <p className={styles.sheetHint}>Đổi sân khấu là thay đổi match config và sẽ reset Ready của guest.</p>
                <div className={styles.sheetActions}>
                  <button className={styles.cancelButton} onClick={() => setPanel(null)} type="button">Hủy</button>
                  <button className={styles.confirmButton} onClick={confirmStage} type="button">✓ Xác nhận</button>
                </div>
              </section>
            )}

            {panel === "player" && selectedParticipant && (
              <section className={`${styles.sheet} ${styles.playerSheet}`}>
                <div className={styles.sheetHeader}>
                  <div><small>NGƯỜI CHƠI</small><strong>{selectedParticipant.displayName}</strong></div>
                  <button onClick={() => setPanel(null)} type="button">×</button>
                </div>
                <div className={styles.playerIdentity}>
                  <span className={styles.playerAvatar}>{initials(selectedParticipant.displayName)}</span>
                  <div>
                    <strong>{selectedParticipant.displayName}</strong>
                    <span>Lv. {levelFor(selectedParticipant)} · {statusLabel(selectedParticipant)}</span>
                  </div>
                </div>
                <div className={styles.playerActions}>
                  <button onClick={() => playerAction("Xem avatar")} type="button">● <span>Xem avatar</span></button>
                  <button onClick={() => playerAction("Xem đồ")} type="button">◆ <span>Xem đồ</span></button>
                  <button onClick={() => playerAction("Thông tin")} type="button">▤ <span>Thông tin</span></button>
                  <button onClick={() => playerAction("Chat riêng")} type="button">● <span>Chat riêng</span></button>
                  {hostView && selectedParticipant.participantId !== room.hostParticipantId && (
                    <button className={styles.kickButton} onClick={kickSelectedParticipant} type="button">⌁ <span>Kick khỏi phòng</span></button>
                  )}
                </div>
                {actionNotice && <p className={styles.actionNotice}>{actionNotice}</p>}
              </section>
            )}
          </div>
        )}

        <div className={styles.safeBottom} />
      </section>
    </main>
  );
}
