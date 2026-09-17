"use client";

import { useMemo, useState } from "react";
import { canStartRoom, changeMode, changeSong, closeSlot, openSlot, setGuestReady } from "../../multiplayer/room-state";
import { createP51WaitingRoomFixture } from "../../multiplayer/waiting-room-qa";
import type { RoomParticipant, RoomSlotIndex } from "../../multiplayer/types";
import WaitingRoomStage3D from "./WaitingRoomStage3D";
import styles from "./WaitingRoomPanel.module.css";

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
  const viewer = room.participants.find(item => item.participantId === viewParticipantId) ?? room.participants[0];
  const hostView = viewer.participantId === room.hostParticipantId;
  const startGate = useMemo(() => canStartRoom(room), [room]);
  const participantById = useMemo(() => new Map(room.participants.map(item => [item.participantId, item])), [room]);
  const orderedParticipants = useMemo(
    () => [...room.participants].sort((a, b) => a.slotIndex - b.slotIndex),
    [room.participants],
  );
  const stagePageCount = Math.max(1, Math.ceil(orderedParticipants.length / 2));
  const safeStagePage = Math.min(stagePage, stagePageCount - 1);
  const stageParticipants = orderedParticipants.slice(safeStagePage * 2, safeStagePage * 2 + 2);

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

  const changeSongQa = () => setRoom(current => changeSong(
    current,
    current.hostParticipantId,
    current.selectedSongId === "aloha" ? "cannon-groove" : "aloha",
  ));
  const changeModeQa = () => setRoom(current => changeMode(
    current,
    current.hostParticipantId,
    current.modeId === "solo-easy-battle" ? "team-easy" : "solo-easy-battle",
  ));

  const previousStagePage = () => setStagePage(current => (current - 1 + stagePageCount) % stagePageCount);
  const nextStagePage = () => setStagePage(current => (current + 1) % stagePageCount);

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
              <span>Start gate · {startGate.allowed ? "ENABLED" : startGate.reason}</span>
              <span>Revision · {room.revision}</span>
              <span>Host Ready · not-applicable</span>
            </div>
          </aside>
        )}

        <section className={styles.stageWrap}>
          <WaitingRoomStage3D participants={stageParticipants} />
          {stagePageCount > 1 && (
            <>
              <button className={`${styles.stageArrow} ${styles.stageArrowLeft}`} onClick={previousStagePage} type="button" aria-label="Previous participants">‹</button>
              <button className={`${styles.stageArrow} ${styles.stageArrowRight}`} onClick={nextStagePage} type="button" aria-label="Next participants">›</button>
              <div className={styles.stagePager} aria-hidden="true">
                {Array.from({ length: stagePageCount }, (_, index) => (
                  <span className={index === safeStagePage ? styles.stageDotActive : styles.stageDot} key={index} />
                ))}
              </div>
            </>
          )}
        </section>

        <section className={styles.slotDock}>
          {room.slots.map(slot => {
            const participant = slot.state === "occupied" ? participantById.get(slot.participantId) : null;
            const status = participant ? statusLabel(participant) : slot.state.toUpperCase();
            return (
              <button
                className={`${styles.slot} ${styles[slot.state]}`}
                disabled={!hostView || slot.state === "occupied"}
                key={slot.slotIndex}
                onClick={() => toggleSlot(slot.slotIndex)}
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
          <div className={styles.cover}><span>A</span><b>ALOHA</b></div>
          <div className={styles.songMeta}>
            <strong>{room.selectedSongId === "aloha" ? "Aloha" : "Cannon Groove"}</strong>
            <span>Audition</span>
            <small>BPM 101 <i /> 02:45 <i /> <em>Easy</em></small>
          </div>
          {hostView && <button className={styles.changeSongButton} onClick={changeSongQa} type="button">♫ Đổi nhạc</button>}
        </section>

        <footer className={styles.actions}>
          <button className={styles.leaveButton} type="button">↪ Rời phòng</button>
          {viewer.kind === "human" && viewer.role === "guest" ? (
            <button className={viewer.readyState === "ready" ? styles.readyButtonActive : styles.readyButton} onClick={toggleReady} type="button">
              ✓ {viewer.readyState === "ready" ? "Đã sẵn sàng" : "Sẵn sàng"}
            </button>
          ) : (
            <div className={styles.hostBadge}><span>♛</span><strong>CHỦ PHÒNG</strong></div>
          )}
          <button className={startGate.allowed && hostView ? styles.startButton : styles.startButtonDisabled} disabled={!hostView || !startGate.allowed} type="button">
            ▶ Bắt đầu
          </button>
        </footer>

        <div className={styles.safeBottom} />
      </section>
    </main>
  );
}
