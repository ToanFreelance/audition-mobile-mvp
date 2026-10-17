"use client";

import type { ReactNode } from "react";
import type { MatchStartSession } from "../../multiplayer/match-start-protocol";
import type { RoomParticipant, RoomState } from "../../multiplayer/types";
import { avatarCharacterAssetId } from "../../multiplayer/avatar-character";
import { getCharacterCatalogEntry } from "../character/character-catalog";
import styles from "./PreparingStagePanel.module.css";

type Props = {
  phase: "start-intent" | "preloading" | "countdown" | "playing";
  room: RoomState;
  session: MatchStartSession | null;
  localParticipantId: string;
  progressPercent: number;
  allParticipantsLoaded: boolean;
  audioScheduled: boolean;
  startDetail?: string | null;
  children?: ReactNode;
};

function PulseLine() {
  return (
    <svg className={styles.wave} viewBox="0 0 64 28" fill="none" aria-hidden="true">
      <path d="M1 14h15l5-8 7 16 7-20 7 24 5-12h16" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M1 14h15l5-8 7 16 7-20 7 24 5-12h16" stroke="currentColor" strokeWidth="4.5" opacity=".3" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

function CheckMark() {
  return (
    <svg viewBox="0 0 28 28" fill="none" aria-hidden="true">
      <circle cx="14" cy="14" r="11.1" stroke="currentColor" strokeWidth="2"/>
      <path d="m8.5 14 3.7 3.8 7.7-8.2" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

function Spinner() {
  return (
    <svg className={styles.spinner} viewBox="0 0 28 28" fill="none" aria-hidden="true">
      <circle cx="14" cy="14" r="10" stroke="currentColor" strokeWidth="4" opacity=".24"/>
      <path d="M14 4a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="4" strokeLinecap="round"/>
    </svg>
  );
}

function Crown() {
  return (
    <svg className={styles.crown} viewBox="0 0 28 19" fill="none" aria-hidden="true">
      <path d="m2 5 6 5 6-8 6 8 6-5-2.5 11h-19L2 5Z" fill="#ffcf47" stroke="#fff5b4" strokeWidth="1.2" strokeLinejoin="round"/>
    </svg>
  );
}

function availableLevel(participant: RoomParticipant | undefined): string {
  // RoomState does not yet persist level. Never manufacture the sketch's Lv.25.
  if (participant && "level" in participant
    && typeof participant.level === "number" && Number.isFinite(participant.level)) {
    return `Lv. ${participant.level}`;
  }
  return "DANCER";
}

export default function PreparingStagePanel({
  phase, room, session, localParticipantId, progressPercent,
  allParticipantsLoaded, audioScheduled, startDetail, children,
}: Props) {
  const dancers = session?.participants ?? [];
  const loaded = dancers.filter(person => person.state === "loaded").length;
  const localLoaded = dancers.some(person => person.participantId === localParticipantId && person.state === "loaded");
  const epochReady = session?.startAtServerMs != null;
  // Stage readiness is reported by Stage3D after a painted frame. It is not
  // known while the lobby panel is mounted: never display a fake green 04.
  const milestones = [
    { number: "01", label: "PRELOAD", done: localLoaded, active: Boolean(session) && !localLoaded },
    { number: "02", label: "LOADED", done: allParticipantsLoaded, active: localLoaded && !allParticipantsLoaded },
    { number: "03", label: "SYNC", done: epochReady, active: allParticipantsLoaded && !epochReady },
    { number: "04", label: "STAGE READY", done: false, active: false },
  ];
  const boundedProgress = Math.max(0, Math.min(100, progressPercent));
  return (
    <section
      className={styles.panel}
      data-phase={phase}
      data-audio-scheduled={audioScheduled ? "1" : "0"}
      data-testid={session ? "preload-state" : "start-intent-state"}
      role="status"
    >
      <div className={styles.heading}>
        <PulseLine />
        <h2>PREPARING STAGE</h2>
        <PulseLine />
      </div>
      <p className={styles.subtitle}>
        {session ? "Loading stage, characters, animations, and shared epoch…" :
          "Loading stage, characters, animations, and shared epoch…"}
      </p>
      <div className={styles.steps} data-testid="preload-steps" aria-label="Tiến trình chuẩn bị">
        {milestones.map(({ number, label, done, active }, index) => (
          <div
            key={number}
            className={`${styles.step} ${done ? styles.stepDone : ""} ${active ? styles.stepActive : ""} ${index === 1 ? styles.stepMagenta : ""}`}
            data-step-state={done ? "done" : active ? "active" : "pending"}
            data-testid={`preload-step-${number}`}
          >
            <div className={styles.stepCopy}><b>{number}</b><small>{label}</small></div>
            <div className={styles.stepMark}>{done ? <CheckMark/> : active ? <Spinner/> : null}</div>
          </div>
        ))}
      </div>
      <div className={styles.meterRow}>
        <div className={styles.meter} role="progressbar" aria-label="Tỷ lệ chuẩn bị thật"
          aria-valuemin={0} aria-valuemax={100} aria-valuenow={boundedProgress}>
          <div className={styles.meterFill} style={{ width: `${boundedProgress}%` }} />
        </div>
        <output className={styles.percent}>{boundedProgress}%</output>
      </div>
      {session ? (
        <div className={styles.metadata}>
          <span data-testid="preload-match-id" title={session.matchId}>{session.matchId}</span>
          <small>
            room r<span data-testid="preload-room-revision">{session.roomRevision}</span>
            {" · "}start r<span data-testid="preload-start-revision">{session.startRevision}</span>
            {epochReady && <>
              {" · "}epoch <span data-testid="start-at-server-ms">{Math.round(session.startAtServerMs as number)}</span>
            </>}
          </small>
        </div>
      ) : <div className={styles.metadata} data-testid="start-intent-detail">{startDetail ?? "Đang xác nhận START…"}</div>}
      {session && (
        <div className={styles.roster}>
          <div className={styles.rosterHeading}>
            <div className={styles.rosterHeadingMain}>
              <svg viewBox="0 0 32 24" fill="currentColor" aria-hidden="true">
                <circle cx="8" cy="6" r="3.6"/><circle cx="24" cy="6" r="3.6"/><circle cx="16" cy="4" r="4.2"/>
                <path d="M.8 21v-7c0-4 4.2-5.1 7.2-5.1 2.2 0 3.4.6 4.4 1.8-3.4 1.6-4 4-4 6.9V21Zm30.4 0v-7c0-4-4.2-5.1-7.2-5.1-2.2 0-3.4.6-4.4 1.8 3.4 1.6 4 4 4 6.9V21ZM10.6 22v-7c0-4.5 3-6 5.4-6 2.4 0 5.4 1.5 5.4 6v7Z"/>
              </svg>
              <strong>DANCERS READY</strong>
              <b data-testid="dancers-loaded-count">{loaded}/{dancers.length}</b>
            </div>
            <span className={styles.rosterStatus}>{allParticipantsLoaded ? "All clients loaded" : `${loaded}/${dancers.length} loaded`}
              {allParticipantsLoaded && <CheckMark />}
            </span>
          </div>
          <div className={styles.rosterGrid} data-testid="preload-participants"
            style={{ gridTemplateColumns: `repeat(${Math.max(1,dancers.length)}, minmax(0,${dancers.length === 1 ? "110px" : "1fr"}))` }}>
            {dancers.map(person => {
              const member = room.participants.find(p => p.participantId === person.participantId);
              const portrait = member
                ? getCharacterCatalogEntry(avatarCharacterAssetId(member.avatar))?.portraitUrl
                : undefined;
              return (
                <div className={styles.dancer} data-load-state={person.state}
                  data-testid={`preload-participant-${person.participantId}`} key={person.participantId}>
                  <div className={styles.avatarRing}>
                    {portrait ? <img src={portrait} alt="" aria-hidden="true" /> :
                      <span>{(member?.displayName ?? person.participantId).slice(0,2).toUpperCase()}</span>}
                    {person.role === "host" && <Crown />}
                  </div>
                  <strong title={member?.displayName ?? person.participantId}>{member?.displayName ?? person.participantId}</strong>
                  <small>{availableLevel(member)}</small>
                  <div className={`${styles.loadBadge} ${person.state === "loaded" ? styles.loadBadgeDone : ""}`}>
                    {person.state === "loaded" && <CheckMark />}
                    {person.state === "loaded" ? "LOADED" : person.state.toUpperCase()}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
      <div className={styles.recovery}>{children}</div>
    </section>
  );
}
