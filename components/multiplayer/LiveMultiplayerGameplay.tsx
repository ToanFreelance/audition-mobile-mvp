"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import AuditionGauge from "../AuditionGauge";
import JudgementLabel from "../JudgementLabel";
import Stage3D from "../Stage3D";
import { SCORE_ZONE_END, SCORE_ZONE_START } from "../../game/runtime";
import type { WebAudioTransport } from "../../game/web-audio-transport";
import type { Direction } from "../../game/types";
import { isCharacterAssetId, DEFAULT_CHARACTER_ASSET_ID } from "../character/character-catalog";
import { createCharacterPresentationEvent } from "../character/choreography";
import { avatarCharacterAssetId } from "../../multiplayer/avatar-character";
import { describeSharedTurn } from "../../multiplayer/determinism";
import type {
  MultiplayerGameplayJudgementEvent,
  MultiplayerGameplayRuntime,
  MultiplayerGameplaySnapshot,
} from "../../multiplayer/gameplay-runtime";
import type { MatchManifest } from "../../multiplayer/types";
import styles from "./LiveMultiplayerGameplay.module.css";

const DIRECTIONS: readonly Direction[] = ["left", "up", "down", "right"];

function directionSymbol(direction: Direction) {
  if (direction === "left") return "←";
  if (direction === "right") return "→";
  if (direction === "up") return "↑";
  return "↓";
}

function formatSongTime(ms: number) {
  const seconds = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

/**
 * Presentation-only consumer of the already scheduled P5.5 runtime.
 * No local timer, animation or user interaction is allowed to own song time,
 * the global timeline, shared epoch or any frozen gameplay configuration.
 */
export default function LiveMultiplayerGameplay(props: {
  manifest: MatchManifest;
  participantId: string;
  stageId: string;
  presentationJudgement?: MultiplayerGameplayJudgementEvent | null;
  runtime: MultiplayerGameplayRuntime;
  transport: WebAudioTransport;
  startAtServerMs: number;
  roomStatus: string;
  audioContextState?: AudioContextState | null;
}) {
  const [snapshot, setSnapshot] = useState<MultiplayerGameplaySnapshot>(() => props.runtime.snapshot());
  const [audioClockStalled, setAudioClockStalled] = useState(false);
  const lastAudioProgressRef = useRef({ songMs: 0, observedAtMs: 0 });

  useEffect(() => {
    let raf = 0;
    let disposed = false;
    lastAudioProgressRef.current = { songMs: 0, observedAtMs: 0 };

    const tick = () => {
      if (disposed) return;
      const durationMs = props.transport.durationMs;
      const songTimeMs = props.transport.getCurrentTimeMs();
      if (!props.runtime.isAudioEnded
        && durationMs > 0
        && !props.transport.playing
        && songTimeMs >= durationMs - 5) {
        props.runtime.markAudioEnded();
      }
      const now = performance.now();
      const progress = lastAudioProgressRef.current;
      if (progress.observedAtMs === 0 || songTimeMs > progress.songMs + 3) {
        progress.songMs = songTimeMs;
        progress.observedAtMs = now;
        setAudioClockStalled(false);
      } else if (props.runtime.isStarted && !props.runtime.isAudioEnded
        && now - progress.observedAtMs > 3000) {
        setAudioClockStalled(true);
      }
      setSnapshot(props.runtime.snapshot());
      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
    };
  }, [props.runtime, props.transport]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.repeat) return;
      const direction: Direction | null = event.key === "ArrowLeft"
        ? "left"
        : event.key === "ArrowRight"
          ? "right"
          : event.key === "ArrowUp"
            ? "up"
            : event.key === "ArrowDown"
              ? "down"
              : null;
      if (direction) {
        event.preventDefault();
        props.runtime.handleDirection(direction);
      } else if (event.code === "Space") {
        event.preventDefault();
        props.runtime.handleSpace();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [props.runtime]);

  const localParticipant = props.manifest.participants.find(
    participant => participant.participantId === props.participantId,
  );
  const characterAssetCandidate = localParticipant
    ? avatarCharacterAssetId(localParticipant.avatar)
    : DEFAULT_CHARACTER_ASSET_ID;
  const characterAssetId = isCharacterAssetId(characterAssetCandidate)
    ? characterAssetCandidate
    : DEFAULT_CHARACTER_ASSET_ID;

  // An event is emitted only by this client's RhythmEngine judgement callback.
  // The published choreography controller consumes the same immutable song time.
  const judgementEvent = props.presentationJudgement?.matchId === props.manifest.matchId
    && props.presentationJudgement.participantId === props.participantId
    ? props.presentationJudgement
    : null;
  const characterEvent = useMemo(() => judgementEvent
    ? createCharacterPresentationEvent(
      judgementEvent.absoluteTurn + 1,
      judgementEvent.judgement,
      {
        atMs: judgementEvent.atSongTimeMs,
        absoluteTurn: judgementEvent.absoluteTurn,
        level: judgementEvent.level,
        isFinish: judgementEvent.isFinish,
      },
      props.manifest.gameplay.seed,
    )
    : null, [judgementEvent, props.manifest.gameplay.seed]);

  const getSongTimeMs = useCallback(
    () => props.transport.getCurrentTimeMs(),
    [props.transport],
  );
  const active = useMemo(
    () => describeSharedTurn(props.manifest, snapshot.activeCommandTurn),
    [props.manifest, snapshot.activeCommandTurn],
  );
  const visibleCommand = snapshot.commandVisible ? active.command : [];
  const audioInterrupted = Boolean(
    (props.audioContextState && props.audioContextState !== "running") || audioClockStalled,
  );
  const judgementVisible = snapshot.lastJudgement !== null
    && snapshot.judgementAtSongTimeMs !== null
    && snapshot.songTimeMs - snapshot.judgementAtSongTimeMs < 950;
  const songProgress = Math.min(100, 100 * snapshot.songTimeMs / Math.max(1, props.transport.durationMs));

  const pressDirection = (direction: Direction) => {
    if (!snapshot.audioEnded) props.runtime.handleDirection(direction);
  };
  const pressSpace = () => {
    if (!snapshot.audioEnded) props.runtime.handleSpace();
  };
  const pressGauge = (event: React.PointerEvent<HTMLDivElement>) => {
    if (snapshot.audioEnded) return;
    const rect = event.currentTarget.getBoundingClientRect();
    if (rect.width <= 0) return;
    const percent = 100 * (event.clientX - rect.left) / rect.width;
    if (percent < SCORE_ZONE_START || percent > SCORE_ZONE_END) return;
    event.preventDefault();
    pressSpace();
  };

  return (
    <main
      className={styles.shell}
      data-audio-ended={snapshot.audioEnded ? "1" : "0"}
      data-match-id={props.manifest.matchId}
      data-room-status={props.roomStatus}
      data-audio-context={props.audioContextState ?? "unknown"}
      data-audio-stalled={audioClockStalled ? "1" : "0"}
      data-testid="multiplayer-gameplay-live"
    >
      <section className={styles.stageViewport} aria-label="Multiplayer 3D stage">
        <Stage3D
          selectedStageId={props.stageId}
          characterAssetId={characterAssetId}
          isPlaying={snapshot.started && !snapshot.audioEnded}
          characterEvent={characterEvent}
          getSongTimeMs={getSongTimeMs}
          bpm={props.manifest.gameplay.bpmExact}
        />
      </section>

      <div className={styles.hud}>
        <header className={styles.header}>
          <div className={styles.songCard}>
            <span className={styles.brand}>CLUB AUDITION · MULTIPLAYER</span>
            <strong>{props.manifest.content.songId}</strong>
            <span>BPM {props.manifest.gameplay.bpmExact.toFixed(2)} · {formatSongTime(snapshot.songTimeMs)} / {formatSongTime(props.transport.durationMs)}</span>
            <div className={styles.songProgress}><i style={{ width: `${songProgress}%` }} /></div>
          </div>
          <div className={styles.scoreCard}>
            <small>MY SCORE</small>
            <strong data-testid="gameplay-score">{snapshot.stats.score.toLocaleString()}</strong>
            <span>COMBO {snapshot.stats.combo}</span>
          </div>
        </header>

        <div className={styles.matchInfo}>
          <span data-testid="gameplay-global-level">{snapshot.globalLevel === null ? "READY" : `LEVEL ${snapshot.globalLevel}`}</span>
          <span data-testid="gameplay-global-turn">T{snapshot.globalAbsoluteTurn}</span>
          <span>PLAYERS {props.manifest.participants.length}</span>
        </div>
        <div className={styles.roster} aria-label="Frozen match participants">
          {props.manifest.participants.map(participant => (
            <span
              key={participant.participantId}
              className={participant.participantId === props.participantId ? styles.me : ""}
              data-testid={participant.participantId === props.participantId ? "gameplay-local-player" : undefined}
            >
              {participant.participantId === props.participantId ? "★ " : ""}{participant.displayName}
            </span>
          ))}
        </div>

        {judgementVisible && snapshot.lastJudgement && (
          <JudgementLabel
            key={`judge-${snapshot.judgementAtSongTimeMs}`}
            judgement={snapshot.lastJudgement}
            perfectStreak={snapshot.lastJudgement === "perfect" ? snapshot.stats.combo : 0}
          />
        )}

        {audioInterrupted && (
          <p className={styles.audioAlert} role="alert" data-testid="multiplayer-audio-health">
            {props.audioContextState && props.audioContextState !== "running"
              ? "AudioContext bị tạm dừng. Không thay shared epoch."
              : "AUDIO STALLED · WebAudio song clock không tiến."}
          </p>
        )}

        <section
          className={`${styles.commandArea} ${active.isFinish ? styles.finish : ""}`}
          data-command-hash={snapshot.activeCommandHash}
          data-command-visible={snapshot.commandVisible ? "1" : "0"}
          data-testid="gameplay-command"
        >
          <div className={styles.commandHeader}>
            <strong>{active.isFinish ? "FINISH" : `LEVEL ${snapshot.activeCommandLevel}`}</strong>
            <span>{snapshot.commandVisible
              ? `${snapshot.completedDirections} / ${active.command.length}`
              : active.roomRest ? "ROOM REST" : "WAIT"}</span>
          </div>
          <div className={styles.commandStrip}>
            {visibleCommand.length
              ? visibleCommand.map((token, index) => (
                  <b
                    className={`${styles.commandToken} ${token.reverse ? styles.reverse : ""}
                      ${index < snapshot.completedDirections ? styles.completed : ""}
                      ${index === snapshot.completedDirections ? styles.target : ""}`}
                    data-direction={token.displayDirection}
                    data-reverse={token.reverse ? "1" : "0"}
                    key={`${snapshot.activeCommandTurn}-${index}`}
                  >
                    {directionSymbol(token.displayDirection)}
                  </b>
                ))
              : <span className={styles.waitingCommand}>{active.roomRest ? "REST" : "•••"}</span>}
          </div>
          <div className={styles.gauge} data-testid="gameplay-gauge">
            <AuditionGauge
              bpm={props.manifest.gameplay.bpmExact}
              value={snapshot.gaugePercent}
              spaceStartMs={props.manifest.gameplay.spaceStartMs}
              currentTimeMs={snapshot.songTimeMs}
              zoneStart={SCORE_ZONE_START}
              zoneEnd={SCORE_ZONE_END}
              onPointerDown={pressGauge}
            />
          </div>
        </section>

        <section className={styles.controls} aria-label="Gameplay controls">
          <button
            className={styles.spaceButton}
            data-testid="gameplay-space"
            type="button"
            disabled={snapshot.audioEnded}
            onPointerDown={event => { event.preventDefault(); pressSpace(); }}
            aria-label="SPACE"
          >SPACE</button>
          <div className={styles.dpad}>
            {DIRECTIONS.map(direction => (
              <button
                key={direction}
                className={styles[`pad${direction[0].toUpperCase()}${direction.slice(1)}`]}
                data-testid={`gameplay-${direction}`}
                type="button"
                disabled={snapshot.audioEnded}
                onPointerDown={event => { event.preventDefault(); pressDirection(direction); }}
                aria-label={direction}
              >
                {directionSymbol(direction)}
              </button>
            ))}
          </div>
        </section>

        <footer className={styles.footer}>
          <span>WEBAUDIO · {snapshot.audioEnded ? "AUDIO END"
            : snapshot.started && audioInterrupted ? "AUDIO STALLED"
              : snapshot.started ? "RUNNING" : "STOPPED"}</span>
          <span data-testid="gameplay-song-time-ms">{Math.round(snapshot.songTimeMs)} ms</span>
          <span data-testid="gameplay-start-at-server-ms">{props.startAtServerMs}</span>
        </footer>
      </div>
    </main>
  );
}
