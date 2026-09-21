"use client";

import { useEffect, useMemo, useState } from "react";
import type { WebAudioTransport } from "../../game/web-audio-transport";
import type { Direction } from "../../game/types";
import { describeSharedTurn } from "../../multiplayer/determinism";
import type {
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

function rounded(value: number) {
  return Math.round(value);
}

export default function LiveMultiplayerGameplay(props: {
  manifest: MatchManifest;
  participantId: string;
  runtime: MultiplayerGameplayRuntime;
  transport: WebAudioTransport;
  startAtServerMs: number;
  roomStatus: string;
}) {
  const [snapshot, setSnapshot] = useState<MultiplayerGameplaySnapshot>(() => props.runtime.snapshot());

  useEffect(() => {
    let raf = 0;
    let disposed = false;

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

  const active = useMemo(
    () => describeSharedTurn(props.manifest, snapshot.activeCommandTurn),
    [props.manifest, snapshot.activeCommandTurn],
  );
  const visibleCommand = snapshot.commandVisible ? active.command : [];

  return (
    <main
      className={styles.shell}
      data-audio-ended={snapshot.audioEnded ? "1" : "0"}
      data-match-id={props.manifest.matchId}
      data-room-status={props.roomStatus}
      data-testid="multiplayer-gameplay-live"
    >
      <section className={styles.hero}>
        <div>
          <span className={styles.eyebrow}>P5.5 · LIVE MULTIPLAYER GAMEPLAY</span>
          <h1>{active.isFinish ? "FINISH" : `LEVEL ${snapshot.activeCommandLevel}`}</h1>
          <p>Shared WebAudio epoch → local WebAudio song clock → deterministic global turn.</p>
        </div>
        <div className={styles.clock}>
          <span>SONG</span>
          <strong data-testid="gameplay-song-time-ms">{rounded(snapshot.songTimeMs)} ms</strong>
          <small data-testid="gameplay-start-at-server-ms">{props.startAtServerMs}</small>
        </div>
      </section>

      <section className={styles.metrics}>
        <div><span>Participant</span><strong>{props.participantId}</strong></div>
        <div><span>Global turn</span><strong data-testid="gameplay-global-turn">T{snapshot.globalAbsoluteTurn}</strong></div>
        <div><span>Global level</span><strong data-testid="gameplay-global-level">{snapshot.globalLevel === null ? "PRE" : `L${snapshot.globalLevel}`}</strong></div>
        <div><span>Score</span><strong>{snapshot.stats.score}</strong></div>
        <div><span>Combo</span><strong>{snapshot.stats.combo}</strong></div>
        <div><span>Last</span><strong>{snapshot.lastJudgement?.toUpperCase() ?? "—"}</strong></div>
      </section>

      <section
        className={`${styles.command} ${active.isFinish ? styles.finish : ""}`}
        data-command-hash={snapshot.activeCommandHash}
        data-command-visible={snapshot.commandVisible ? "1" : "0"}
        data-testid="gameplay-command"
      >
        <span>{active.isFinish ? "FINISH" : snapshot.commandVisible ? "COMMAND" : active.roomRest ? "ROOM REST" : "WAIT"}</span>
        <div className={styles.arrows}>
          {visibleCommand.length
            ? visibleCommand.map((token, index) => (
                <b className={token.reverse ? styles.reverse : ""} key={`${snapshot.activeCommandTurn}-${index}`}>
                  {directionSymbol(token.displayDirection)}
                </b>
              ))
            : <b className={styles.hiddenCommand}>•••</b>}
        </div>
        <small>target {rounded(snapshot.activeTargetSpaceMs)} ms · gauge {snapshot.gaugePercent.toFixed(1)}%</small>
      </section>

      <section className={styles.controls} aria-label="Gameplay controls">
        {DIRECTIONS.map(direction => (
          <button
            data-testid={`gameplay-${direction}`}
            key={direction}
            onClick={() => props.runtime.handleDirection(direction)}
            type="button"
          >
            {directionSymbol(direction)}
          </button>
        ))}
        <button
          className={styles.space}
          data-testid="gameplay-space"
          onClick={() => props.runtime.handleSpace()}
          type="button"
        >
          SPACE
        </button>
      </section>

      <footer className={styles.footer}>
        <span>Audio authority: <b>WEBAUDIO</b></span>
        <span>Room status: <b>{props.roomStatus.toUpperCase()}</b></span>
        <span>{snapshot.audioEnded ? "AUDIO END" : snapshot.started ? "RUNNING" : "STOPPED"}</span>
      </footer>
    </main>
  );
}
