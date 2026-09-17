"use client";

import { useMemo, useState } from "react";
import { canStartRoom, changeMode, changeSong, closeSlot, openSlot, setGuestReady } from "../../multiplayer/room-state";
import { createP51WaitingRoomFixture } from "../../multiplayer/waiting-room-qa";
import type { RoomSlotIndex } from "../../multiplayer/types";
import WaitingRoomStage3D from "./WaitingRoomStage3D";
import styles from "./WaitingRoomPanel.module.css";

function initials(name: string) {
  return name.split(/\s+/).map(part => part[0]).join("").slice(0, 2).toUpperCase();
}

export default function WaitingRoomPanel() {
  const [room, setRoom] = useState(createP51WaitingRoomFixture);
  const [viewParticipantId, setViewParticipantId] = useState(room.hostParticipantId);
  const viewer = room.participants.find(item => item.participantId === viewParticipantId) ?? room.participants[0];
  const hostView = viewer.participantId === room.hostParticipantId;
  const startGate = useMemo(() => canStartRoom(room), [room]);
  const participantById = useMemo(() => new Map(room.participants.map(item => [item.participantId, item])), [room]);

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

  return (
    <main className={styles.shell}>
      <section className={styles.phone}>
        <header className={styles.header}>
          <button className={styles.iconButton} type="button" aria-label="Back">‹</button>
          <div className={styles.titleBlock}>
            <strong>{room.roomName}</strong>
            <span>ID: {room.roomId} · {room.modeId} · {room.participants.length}/{room.maxPlayers}</span>
          </div>
          <button className={styles.iconButton} type="button" aria-label="Settings">⚙</button>
        </header>

        <WaitingRoomStage3D participants={room.participants} />

        <section className={styles.slots}>
          {room.slots.map(slot => {
            const participant = slot.state === "occupied" ? participantById.get(slot.participantId) : null;
            return (
              <button
                className={`${styles.slot} ${styles[slot.state]}`}
                disabled={!hostView || slot.state === "occupied"}
                key={slot.slotIndex}
                onClick={() => toggleSlot(slot.slotIndex)}
                type="button"
              >
                <b>{slot.slotIndex + 1}</b>
                <span>{participant ? initials(participant.displayName) : slot.state.toUpperCase()}</span>
              </button>
            );
          })}
        </section>

        <section className={styles.songCard}>
          <div className={styles.cover}>♪</div>
          <div>
            <span className={styles.muted}>Selected song</span>
            <strong>{room.selectedSongId === "aloha" ? "Aloha" : "Cannon Groove"}</strong>
            <small>Mode · {room.modeId}</small>
          </div>
          {hostView && <button className={styles.smallButton} onClick={changeSongQa} type="button">Đổi nhạc</button>}
        </section>

        <section className={styles.debugBar}>
          <span>View as</span>
          {room.participants.filter(item => item.kind === "human").map(participant => (
            <button className={participant.participantId === viewer.participantId ? styles.selectedView : styles.viewButton} key={participant.participantId} onClick={() => setViewParticipantId(participant.participantId)} type="button">
              {participant.role === "host" ? "HOST" : "GUEST"}
            </button>
          ))}
          {hostView && <button className={styles.viewButton} onClick={changeModeQa} type="button">MODE QA</button>}
        </section>

        <footer className={styles.actions}>
          <button className={styles.leaveButton} type="button">Rời phòng</button>
          {viewer.kind === "human" && viewer.role === "guest" ? (
            <button className={viewer.readyState === "ready" ? styles.readyButtonActive : styles.readyButton} onClick={toggleReady} type="button">
              {viewer.readyState === "ready" ? "✓ Đã sẵn sàng" : "✓ Sẵn sàng"}
            </button>
          ) : (
            <div className={styles.hostNoReady}>HOST · NO READY</div>
          )}
          <button className={startGate.allowed ? styles.startButton : styles.startButtonDisabled} disabled={!hostView || !startGate.allowed} type="button">
            ▶ Bắt đầu
          </button>
        </footer>

        <section className={styles.contract}>
          <strong>P5.1 DOMAIN + 3D BINDING</strong>
          <span>Start gate: {startGate.allowed ? "PASS / ENABLED" : startGate.reason}</span>
          <span>Room revision: {room.revision}</span>
          <span>Host Ready state: not-applicable</span>
          <span>Waiting-stage clock owner: none</span>
        </section>
      </section>
    </main>
  );
}
