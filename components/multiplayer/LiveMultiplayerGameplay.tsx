"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import NextImage from "next/image";
import AuditionGauge from "../AuditionGauge";
import GameCommandTokenVisual from "../GameCommandTokenVisual";
import JudgementLabel from "../JudgementLabel";
import Stage3D from "../Stage3D";
import type { EnsembleParticipant } from "../ensemble/formation";
import PortraitGameMenu, {
  CONTROL_SPACING_MAX, CONTROL_SPACING_STEP,
  type CameraPreset, type ControlLayout, type ControlSize,
} from "../PortraitGameMenu";
import { SCORE_ZONE_END, SCORE_ZONE_START } from "../../game/runtime";
import { renderedArrowDirection } from "../../game/solo-easy";
import type { WebAudioTransport } from "../../game/web-audio-transport";
import type { Direction } from "../../game/types";
import { isCharacterAssetId, DEFAULT_CHARACTER_ASSET_ID } from "../character/character-catalog";
import { createCharacterPresentationEvent } from "../character/choreography";
import { avatarCharacterAssetId } from "../../multiplayer/avatar-character";
import { describeSharedTurn } from "../../multiplayer/determinism";
import { acceptLiveScoreSnapshot, type LiveScoreSnapshot } from "../../multiplayer/live-score";
import type { MultiplayerRoomTransport } from "../../multiplayer/transport";
import type {
  MultiplayerGameplayJudgementEvent,
  MultiplayerGameplayRuntime,
  MultiplayerGameplaySnapshot,
} from "../../multiplayer/gameplay-runtime";
import type { MatchManifest } from "../../multiplayer/types";
import type { PerformanceDiagnostics } from "../diagnostics/performance-diagnostics";
import PerformanceDiagnosticsOverlay from "../diagnostics/PerformanceDiagnosticsOverlay";
import transitionStyles from "./LiveMultiplayerGameplay.module.css";
import StageLaunchArtwork from "./StageLaunchArtwork";
import PreparingStagePanel from "./PreparingStagePanel";

const DIRECTIONS: readonly Direction[] = ["left", "up", "down", "right"];
const SETTING_KEYS = {
  controlLayout: "audition.controlLayout",
  cameraPreset: "audition.cameraPreset",
  controlSize: "audition.controlSize",
  controlSpacing: "audition.controlSpacing",
} as const;
const formatTime = (timeMs: number) => {
  const total = Math.max(0, Math.floor(timeMs / 1000));
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
};

/**
 * Multiplayer runtime remains authoritative for command, timing, score and turns.
 * This view uses the *existing solo GameShell HUD classes and sketch artwork*.
 * No locally generated gameplay timeline, fake opponents or CSS gauge clock.
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
  /** Realtime score metadata only; never participates in WebAudio scheduling. */
  scoreTransport?: MultiplayerRoomTransport | null;
  startRevision?: number;
  performanceDiagnostics?: PerformanceDiagnostics | null;
  diagnosticAudioContext?: AudioContext | null;
  /** Frozen authoritative LOADED acknowledgements for the transition UI. */
  loadedParticipantIds?: readonly string[];
}) {
  const [snapshot, setSnapshot] = useState<MultiplayerGameplaySnapshot>(() => props.runtime.snapshot());
  const [stagePresentationReady, setStagePresentationReady] = useState(false);
  const [stagePresentationError, setStagePresentationError] = useState<string | null>(null);
  const [entryCurtainVisible, setEntryCurtainVisible] = useState(true);
  const loadedCount = props.manifest.participants.filter(p => props.loadedParticipantIds?.includes(p.participantId)).length;
  const allPreloaded = loadedCount === props.manifest.participants.length;
  const launchProgress = 25 * (
    Number(props.loadedParticipantIds?.includes(props.participantId))
    + Number(allPreloaded)
    + Number(Number.isFinite(props.startAtServerMs))
    + Number(stagePresentationReady)
  );
  const onStagePresentationReady = useCallback(() => setStagePresentationReady(true), []);
  // The banner never lifts until the actual 3D scene, actor, animation mixer
  // and authoritative shared start have progressed. No artificial deadline.
  useEffect(() => {
    if (!stagePresentationReady || !snapshot.started || snapshot.songTimeMs <= 0) return;
    const reveal = window.setTimeout(() => setEntryCurtainVisible(false), 350);
    return () => window.clearTimeout(reveal);
  }, [stagePresentationReady, snapshot.started, snapshot.songTimeMs > 0]);
  const [scoreReceipts, setScoreReceipts] = useState<{
    matchId: string;
    byParticipant: Record<string, LiveScoreSnapshot>;
  }>(() => ({ matchId: props.manifest.matchId, byParticipant: {} }));
  const lastResolvedScoreTurnRef = useRef<{ matchId: string; absoluteTurn: number }>({
    matchId: props.manifest.matchId,
    absoluteTurn: -1,
  });
  const [audioClockStalled, setAudioClockStalled] = useState(false);
  const [activeDirection, setActiveDirection] = useState<Direction | null>(null);
  const [wrongDirection, setWrongDirection] = useState<Direction | null>(null);
  const [spacePressed, setSpacePressed] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [exitConfirmOpen, setExitConfirmOpen] = useState(false);
  const [controlLayout, setControlLayout] = useState<ControlLayout>("space-left");
  const [cameraPreset, setCameraPreset] = useState<CameraPreset>("center");
  const [controlSize, setControlSize] = useState<ControlSize>("default");
  const [controlSpacing, setControlSpacing] = useState(0);
  const [perfectStreak, setPerfectStreak] = useState(0);
  const lastJudgementTurnRef = useRef<number | null>(null);
  const activeDirectionTimerRef = useRef<number | null>(null);
  const pressTimerRef = useRef<number | null>(null);
  const lastAudioProgressRef = useRef({ songMs: 0, observedAtMs: 0 });
  const keyboardInputRef = useRef<{
    pressSpace: (eventTimeStamp?: number, kind?: "keyboard" | "pointer", handlerEntryMs?: number) => void;
    pressDirection: (direction: Direction) => void;
    menuOpen: boolean;
    diagnostics: boolean;
  }>({ pressSpace: () => undefined, pressDirection: () => undefined, menuOpen: false, diagnostics: false });

  useEffect(() => { props.performanceDiagnostics?.hudCommitted(); });
  useEffect(() => {
    const diagnostics = props.performanceDiagnostics;
    if (!diagnostics) return;
    diagnostics.setAudioReader(() => ({
      context: props.diagnosticAudioContext ?? null,
      songTimeMs: props.transport.getCurrentTimeMs(),
      playing: props.transport.playing, audioEnded: props.runtime.isAudioEnded,
    }));
    return () => diagnostics.setAudioReader(null);
  }, [props.performanceDiagnostics, props.diagnosticAudioContext, props.transport, props.runtime]);

  useEffect(() => {
    try {
      const layout = window.localStorage.getItem(SETTING_KEYS.controlLayout);
      const camera = window.localStorage.getItem(SETTING_KEYS.cameraPreset);
      const size = window.localStorage.getItem(SETTING_KEYS.controlSize);
      const spacing = window.localStorage.getItem(SETTING_KEYS.controlSpacing);
      if (layout === "space-left" || layout === "dpad-left") setControlLayout(layout);
      if (camera === "center" || camera === "wide" || camera === "close") setCameraPreset(camera);
      if (size === "default" || size === "large") setControlSize(size);
      if (spacing !== null && Number.isFinite(Number(spacing))) {
        setControlSpacing(Math.min(CONTROL_SPACING_MAX, Math.max(0, Number(spacing))));
      }
    } catch {
      // Restricted/private browser storage does not block gameplay.
    }
  }, []);

  useEffect(() => {
    let raf = 0;
    let disposed = false;
    lastAudioProgressRef.current = { songMs: 0, observedAtMs: 0 };
    const tick = () => {
      if (disposed) return;
      const durationMs = props.transport.durationMs;
      const songTimeMs = props.transport.getCurrentTimeMs();
      if (!props.runtime.isAudioEnded && durationMs > 0
        && !props.transport.playing && songTimeMs >= durationMs - 5) {
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
    return () => { disposed = true; cancelAnimationFrame(raf); };
  }, [props.runtime, props.transport]);

  useEffect(() => () => {
    if (activeDirectionTimerRef.current !== null) window.clearTimeout(activeDirectionTimerRef.current);
    if (pressTimerRef.current !== null) window.clearTimeout(pressTimerRef.current);
  }, []);

  // Cumulative score updates repair dropped broadcasts without replaying
  // individual judgement events. The data is client-reported, never a server
  // verified score, and NEVER owns the shared WebAudio/global-turn timeline.
  const publishLocalScore = useCallback(() => {
    const transport = props.scoreTransport;
    if (!transport || transport.status !== "connected"
      || props.startRevision === undefined
      || !props.manifest.participants.some(participant =>
        participant.participantId === props.participantId && participant.kind === "human"
      )) return;

    const lastTurn = lastResolvedScoreTurnRef.current.matchId === props.manifest.matchId
      ? lastResolvedScoreTurnRef.current.absoluteTurn : -1;
    const update: LiveScoreSnapshot = {
      matchId: props.manifest.matchId,
      participantId: props.participantId,
      lastResolvedTurn: lastTurn,
      stats: props.runtime.stats,
      audioEnded: props.runtime.isAudioEnded,
    };
    void transport.send({
      kind: "player-score-snapshot",
      roomRevision: props.manifest.roomRevision,
      matchId: props.manifest.matchId,
      startRevision: props.startRevision,
      update,
    }).catch(() => {
      // Lossy score/presence telemetry. The next cumulative snapshot repairs
      // reception when Realtime reconnects; never halt local gameplay.
    });
  }, [props.manifest, props.participantId, props.runtime, props.scoreTransport, props.startRevision]);

  useEffect(() => {
    const transport = props.scoreTransport;
    if (!transport || props.startRevision === undefined) return;
    const unsubscribeEvent = transport.onEvent(envelope => {
      const payload = envelope.payload;
      if (payload.kind !== "player-score-snapshot"
        || envelope.roomId !== transport.roomId
        || payload.matchId !== props.manifest.matchId
        || payload.roomRevision !== props.manifest.roomRevision
        || payload.startRevision !== props.startRevision) return;
      setScoreReceipts(current => {
        const existing = current.matchId === props.manifest.matchId
          ? current.byParticipant : {};
        const accepted = acceptLiveScoreSnapshot({
          manifest: props.manifest,
          localParticipantId: props.participantId,
          senderParticipantId: envelope.senderParticipantId,
          candidate: payload.update,
          previous: existing[payload.update?.participantId],
        });
        if (!accepted) return current;
        return {
          matchId: props.manifest.matchId,
          byParticipant: { ...existing, [accepted.participantId]: accepted },
        };
      });
    });
    const unsubscribeStatus = transport.onStatus(status => {
      if (status === "connected") publishLocalScore();
    });
    publishLocalScore();
    const interval = window.setInterval(publishLocalScore, 2500);
    return () => {
      window.clearInterval(interval);
      unsubscribeStatus();
      unsubscribeEvent();
    };
  }, [props.scoreTransport, props.manifest, props.participantId, props.startRevision, publishLocalScore]);

  useEffect(() => {
    const event = props.presentationJudgement;
    if (!event || event.matchId !== props.manifest.matchId
      || event.participantId !== props.participantId) return;
    const previous = lastResolvedScoreTurnRef.current;
    lastResolvedScoreTurnRef.current = {
      matchId: props.manifest.matchId,
      absoluteTurn: previous.matchId === props.manifest.matchId
        ? Math.max(previous.absoluteTurn, event.absoluteTurn)
        : event.absoluteTurn,
    };
    publishLocalScore();
  }, [props.presentationJudgement, props.manifest.matchId, props.participantId, publishLocalScore]);

  const currentRemoteScores = scoreReceipts.matchId === props.manifest.matchId
    ? scoreReceipts.byParticipant : {};
  const liveRankings = props.manifest.participants.map((participant, slot) => ({
    participant,
    slot,
    stats: participant.participantId === props.participantId
      ? snapshot.stats : currentRemoteScores[participant.participantId]?.stats ?? null,
  })).sort((a, b) => {
    if (a.stats && b.stats) return b.stats.score - a.stats.score || a.slot - b.slot;
    if (a.stats) return -1;
    if (b.stats) return 1;
    return a.slot - b.slot;
  });

  const localParticipant = props.manifest.participants.find(
    participant => participant.participantId === props.participantId,
  );
  // Frozen player identity only; no player name/gender or localStorage heuristic.
  const characterCandidate = localParticipant
    ? avatarCharacterAssetId(localParticipant.avatar)
    : DEFAULT_CHARACTER_ASSET_ID;
  const characterAssetId = isCharacterAssetId(characterCandidate)
    ? characterCandidate : DEFAULT_CHARACTER_ASSET_ID;
  // P4.6A is explicitly a 1–5 formation. Preserve the existing local-only
  // rendering on historical six-occupant matches rather than hiding the local
  // player when their participantId would be truncated from the roster.
  const ensembleParticipants = useMemo<readonly EnsembleParticipant[] | undefined>(() =>
    props.manifest.participants.length > 5 ? undefined : props.manifest.participants.map(participant => {
      const candidate = avatarCharacterAssetId(participant.avatar);
      return {
        participantId: participant.participantId,
        slotIndex: participant.slotIndex,
        characterAssetId: isCharacterAssetId(candidate) ? candidate : DEFAULT_CHARACTER_ASSET_ID,
      };
    }), [props.manifest]);
  const judgementEvent = props.presentationJudgement?.matchId === props.manifest.matchId
    && props.presentationJudgement.participantId === props.participantId
    ? props.presentationJudgement : null;
  const characterEvent = useMemo(() => judgementEvent
    ? createCharacterPresentationEvent(
      judgementEvent.absoluteTurn + 1, judgementEvent.judgement,
      {
        atMs: judgementEvent.atSongTimeMs,
        absoluteTurn: judgementEvent.absoluteTurn,
        level: judgementEvent.level,
        isFinish: judgementEvent.isFinish,
      },
      props.manifest.gameplay.seed,
    ) : null, [judgementEvent, props.manifest.gameplay.seed]);

  useEffect(() => {
    if (!judgementEvent || lastJudgementTurnRef.current === judgementEvent.absoluteTurn) return;
    lastJudgementTurnRef.current = judgementEvent.absoluteTurn;
    setPerfectStreak(current => judgementEvent.judgement === "perfect" ? current + 1 : 0);
  }, [judgementEvent]);

  const getSongTimeMs = useCallback(() => props.transport.getCurrentTimeMs(), [props.transport]);
  const active = useMemo(
    () => describeSharedTurn(props.manifest, snapshot.activeCommandTurn),
    [props.manifest, snapshot.activeCommandTurn],
  );
  const arrowCommand = snapshot.commandVisible ? active.command : [];
  const nextArrow = arrowCommand[snapshot.completedDirections]?.requiredDirection ?? null;
  const audioInterrupted = Boolean(
    (props.audioContextState && props.audioContextState !== "running") || audioClockStalled,
  );
  const judgementVisible = snapshot.lastJudgement !== null
    && snapshot.judgementAtSongTimeMs !== null
    && snapshot.songTimeMs - snapshot.judgementAtSongTimeMs < 950;
  const songProgress = Math.min(100, 100 * snapshot.songTimeMs / Math.max(1, props.transport.durationMs));

  const pressDirection = (direction: Direction) => {
    if (!snapshot.started || snapshot.audioEnded || menuOpen) return;
    setActiveDirection(direction);
    if (activeDirectionTimerRef.current !== null) window.clearTimeout(activeDirectionTimerRef.current);
    activeDirectionTimerRef.current = window.setTimeout(() => setActiveDirection(null), 110);
    setWrongDirection(nextArrow && nextArrow !== direction ? direction : null);
    props.runtime.handleDirection(direction);
  };
  const pressSpace = (eventTimeStamp?: number, kind: "keyboard" | "pointer" = "keyboard", enteredAtMs?: number) => {
    const diagnostics = props.performanceDiagnostics;
    const handlerEntryMs = diagnostics ? (enteredAtMs ?? performance.now()) : undefined;
    if (!snapshot.started || snapshot.audioEnded || menuOpen) return;
    setSpacePressed(true);
    if (pressTimerRef.current !== null) window.clearTimeout(pressTimerRef.current);
    pressTimerRef.current = window.setTimeout(() => setSpacePressed(false), 110);
    diagnostics?.beginInput(eventTimeStamp, kind, props.transport.getCurrentTimeMs(), snapshot.activeTargetSpaceMs, handlerEntryMs);
    const result = props.runtime.handleSpace();
    diagnostics?.endInput(result);
  };
  const pressGauge = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!snapshot.started || snapshot.audioEnded || menuOpen) return;
    const rect = event.currentTarget.getBoundingClientRect();
    if (rect.width <= 0) return;
    const percent = 100 * (event.clientX - rect.left) / rect.width;
    if (percent < SCORE_ZONE_START || percent > SCORE_ZONE_END) return;
    event.preventDefault();
    pressSpace(event.timeStamp, "pointer");
  };

  keyboardInputRef.current = { pressSpace, pressDirection, menuOpen, diagnostics: Boolean(props.performanceDiagnostics) };
  useEffect(() => {
    // Runtime snapshots may render every RAF. Never rebind a global listener
    // each frame just because HUD numbers/gauge changed.
    const onKey = (event: KeyboardEvent) => {
      const handlerEntryMs = keyboardInputRef.current.diagnostics ? performance.now() : undefined;
      if (event.repeat || keyboardInputRef.current.menuOpen) return;
      if (event.code === "Space") {
        event.preventDefault();
        keyboardInputRef.current.pressSpace(event.timeStamp, "keyboard", handlerEntryMs);
        return;
      }
      const map: Record<string, Direction> = {
        ArrowLeft: "left", ArrowUp: "up", ArrowDown: "down", ArrowRight: "right",
      };
      const direction = map[event.code];
      if (direction) {
        event.preventDefault();
        keyboardInputRef.current.pressDirection(direction);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const saveSetting = (key: keyof typeof SETTING_KEYS, value: string) => {
    try { window.localStorage.setItem(SETTING_KEYS[key], value); } catch {}
  };
  const closeMenu = () => { setExitConfirmOpen(false); setMenuOpen(false); };

  return (
    <main
      className="audition-page"
      data-audio-ended={snapshot.audioEnded ? "1" : "0"}
      data-match-id={props.manifest.matchId}
      data-room-status={props.roomStatus}
      data-audio-context={props.audioContextState ?? "unknown"}
      data-audio-stalled={audioClockStalled ? "1" : "0"}
      data-testid="multiplayer-gameplay-live"
    >
      {props.performanceDiagnostics && <PerformanceDiagnosticsOverlay diagnostics={props.performanceDiagnostics} />}
      <section className="audition-stage">
        <div data-testid="gameplay-3d-stage" data-frozen-stage-id={props.stageId}>
          <Stage3D
            cameraPreset={cameraPreset}
            selectedStageId={props.stageId}
            characterAssetId={characterAssetId}
            ensembleParticipants={ensembleParticipants}
            ensembleLocalParticipantId={props.participantId}
            isPlaying={snapshot.started && !snapshot.audioEnded}
            characterEvent={characterEvent}
            getSongTimeMs={getSongTimeMs}
            bpm={props.manifest.gameplay.bpmExact}
            performanceDiagnostics={props.performanceDiagnostics}
            cinematicMatchId={props.manifest.matchId}
            onPresentationReady={onStagePresentationReady}
            onPresentationFailure={setStagePresentationError}
          />
        </div>
        <div
          className={`${transitionStyles.entryCurtain} ${entryCurtainVisible ? "" : transitionStyles.entryCurtainHidden}`}
          data-testid="gameplay-entry-curtain"
          data-visible={entryCurtainVisible ? "1" : "0"}
          data-stage-ready={stagePresentationReady ? "1" : "0"}
          data-stage-error={stagePresentationError ? "1" : "0"}
          aria-hidden="true"
        >
          <StageLaunchArtwork />
          <PreparingStagePanel
            phase="playing"
            room={null}
            session={{
              matchId: props.manifest.matchId,
              roomRevision: props.manifest.roomRevision,
              startRevision: props.startRevision ?? 1,
              startAtServerMs: props.startAtServerMs,
              manifest: props.manifest,
              participants: props.manifest.participants.map(participant => ({
                participantId: participant.participantId,
                kind: participant.kind,
                role: participant.role,
                state: props.loadedParticipantIds?.includes(participant.participantId) ? "loaded" : "loading",
              })),
            }}
            localParticipantId={props.participantId}
            progressPercent={launchProgress}
            allParticipantsLoaded={allPreloaded}
            audioScheduled={true}
            stageReady={stagePresentationReady}
          >
            {stagePresentationError && <small role="alert">{stagePresentationError}</small>}
            {stagePresentationReady && snapshot.songTimeMs <= 0 &&
              <small>Scene ready · Waiting for shared epoch</small>}
          </PreparingStagePanel>
        </div>
        <div className="audition-hud">
          {/* Same GameShell song widget, not the discarded custom multiplayer HUD. */}
          <div className="hud-song">
            <div className="song-cover">♫</div>
            <div className="song-copy">
              <strong>{props.manifest.content.songId}</strong>
              <span>BPM <b>{props.manifest.gameplay.bpmExact.toFixed(2)}</b></span>
              <div className="song-progress"><i style={{ width: `${songProgress}%` }} /></div>
              <small>{formatTime(snapshot.songTimeMs)} / {formatTime(props.transport.durationMs)}</small>
            </div>
          </div>
          {/* Opponent score/leaderboard in the solo mock are not authoritative.
              Never copy the placeholder numeric opponents into multiplayer. */}
          <div className="top-actions portrait-top-actions">
            <button type="button" onClick={() => setMenuOpen(true)} aria-label="Mở menu">
              <span aria-hidden="true">Ⅱ</span><small>MENU</small>
            </button>
          </div>
          <div className="level-panel">
            <div className="level-title">LEVEL <b>{snapshot.globalLevel ?? 1}</b></div>
            <div className="mission">
              <strong>{localParticipant?.displayName ?? "MY SCORE"}</strong>
              <span data-testid="gameplay-score">{snapshot.stats.score.toLocaleString()} SCORE</span>
              <small>Perfect {snapshot.stats.perfect} · Great {snapshot.stats.great}</small>
            </div>
            <div className="function-key">PLAYERS {props.manifest.participants.length} · WEB AUDIO</div>
          </div>
          {props.manifest.participants.length > 1 && (
            <div className="leaderboard" aria-label="Bảng điểm trực tiếp tạm tính, do client báo cáo" data-testid="gameplay-live-scores">
              {liveRankings.map((row, rank) => (
                <div className="rank-line blue" key={row.participant.participantId}
                  data-testid={`score-row-${row.participant.participantId}`}
                  data-score-origin={row.participant.participantId === props.participantId
                    ? "local" : row.stats ? "realtime" : "pending"}>
                  <b>{row.stats ? rank + 1 : "—"}</b>
                  <span className="avatar" aria-hidden="true" />
                  <span className="rank-copy">
                    <span>{row.participant.displayName}</span>
                    <strong data-testid={`live-score-${row.participant.participantId}`}>
                      {row.stats ? row.stats.score.toLocaleString() : "—"}
                    </strong>
                  </span>
                </div>
              ))}
            </div>
          )}
          <div className="combo-panel">
            <span>COMBO</span><strong>{snapshot.stats.combo}</strong>
            <b>{perfectStreak > 1 ? `Perfect x${perfectStreak}` : perfectStreak === 1 ? "Perfect" : ""}</b>
          </div>
          {judgementVisible && snapshot.lastJudgement && (
            <JudgementLabel
              key={`judgement-${snapshot.judgementAtSongTimeMs}`}
              judgement={snapshot.lastJudgement}
              perfectStreak={perfectStreak}
            />
          )}
          {audioInterrupted && (
            <div className="audio-error" role="alert" data-testid="multiplayer-audio-health">
              <strong>🔇 SOUND ERROR</strong>
              <span>{props.audioContextState && props.audioContextState !== "running"
                ? "AudioContext bị tạm dừng." : "AUDIO STALLED · WebAudio song clock không tiến."}</span>
              <small>Shared epoch không được phép dời hoặc phát nhạc bù.</small>
            </div>
          )}
          <div
            className={`command-zone ${snapshot.started && snapshot.songTimeMs >= 4000 ? "visible" : "pre-intro"}`}
            data-command-hash={snapshot.activeCommandHash}
            data-command-visible={snapshot.commandVisible ? "1" : "0"}
            data-testid="gameplay-command"
          >
            <div className={`command-label ${active.isFinish ? "finish" : "normal"}`}>
              <span>
                <span className="command-level-prefix">LEVEL <b>{snapshot.activeCommandLevel}</b></span>
                {active.isFinish && <strong data-testid="finish-label" style={{ color: "#ffde79", textShadow: "0 0 10px #f43" }}> FINISH MOVE</strong>}
              </span>
              <small className="command-progress">{snapshot.commandVisible
                ? snapshot.completedDirections : 0} / {arrowCommand.length}</small>
            </div>
            <div className="command-strip">
              {arrowCommand.map((token, index) => {
                const completed = index < snapshot.completedDirections;
                const direction = renderedArrowDirection(token, completed);
                const target = index === snapshot.completedDirections;
                const state = completed ? "completed" : token.reverse ? "reverse" : "normal";
                return (
                  <div
                    data-direction={direction}
                    data-reverse={token.reverse}
                    aria-label={`${token.reverse ? "reverse " : ""}${direction}`}
                    key={`${snapshot.activeCommandTurn}-${index}-${direction}`}
                    className={`command-key ${completed ? "done" : ""} ${token.reverse ? "reverse" : ""}
                      ${target ? "target" : ""} ${target && wrongDirection && wrongDirection !== token.requiredDirection ? "wrong" : ""}`}
                  >
                    <GameCommandTokenVisual
                      direction={direction}
                      state={state}
                      target={target}
                      visualId={`multi-${snapshot.activeCommandTurn}-${index}`}
                    />
                  </div>
                );
              })}
            </div>
            <div className="gameplay-gauge-hit-area" data-testid="gameplay-gauge" style={{ pointerEvents: "auto" }}>
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
          </div>

          <div
            className="mobile-controls"
            data-control-layout={controlLayout}
            data-control-size={controlSize}
            data-control-spacing={controlSpacing}
            style={{ "--portrait-control-gap-extra": `${controlSpacing}px` } as CSSProperties}
          >
            <button className={`space-control ${spacePressed ? "pressed" : ""}`}
              disabled={snapshot.audioEnded} data-testid="gameplay-space"
              onPointerDown={event => { event.preventDefault(); pressSpace(event.timeStamp, "pointer"); }} aria-label="SPACE">
              <NextImage className="portrait-space-art"
                src="/ui/controls/portrait-space-from-sketch.png"
                alt="" width={315} height={150} priority unoptimized draggable={false} aria-hidden="true" />
            </button>
            <div className="dpad-control">
              <NextImage className="portrait-dpad-art"
                src="/ui/controls/portrait-dpad-from-sketch.png"
                alt="" width={206} height={190} priority unoptimized draggable={false} aria-hidden="true" />
              {DIRECTIONS.map(direction => (
                <button
                  key={direction}
                  className={`dpad-${direction} ${activeDirection === direction ? "pressed" : ""}
                    ${nextArrow === direction ? "target" : ""}`}
                  data-testid={`gameplay-${direction}`}
                  disabled={snapshot.audioEnded}
                  onPointerDown={event => { event.preventDefault(); pressDirection(direction); }}
                  aria-label={direction}
                />
              ))}
            </div>
          </div>
          {menuOpen && (
            <PortraitGameMenu
              controlLayout={controlLayout}
              cameraPreset={cameraPreset}
              controlSize={controlSize}
              controlSpacing={controlSpacing}
              exitConfirmOpen={exitConfirmOpen}
              onControlLayoutChange={value => { setControlLayout(value); saveSetting("controlLayout", value); }}
              onCameraPresetChange={value => { setCameraPreset(value); saveSetting("cameraPreset", value); }}
              onControlSizeChange={value => { setControlSize(value); saveSetting("controlSize", value); }}
              onControlSpacingChange={value => {
                const safe = Math.max(0, Math.min(CONTROL_SPACING_MAX,
                  Math.round(value / CONTROL_SPACING_STEP) * CONTROL_SPACING_STEP));
                setControlSpacing(safe); saveSetting("controlSpacing", String(safe));
              }}
              onRequestExit={() => setExitConfirmOpen(true)}
              onCancelExit={() => setExitConfirmOpen(false)}
              onConfirmExit={() => window.location.assign("/rooms")}
              onClose={closeMenu}
            />
          )}
          {/* Legacy P5.5 E2E probes stay readable but are not a visible HUD element. */}
          <div style={{ position: "absolute", left: 0, bottom: 0, opacity: 0, pointerEvents: "none", fontSize: 1 }}>
            <span data-testid="gameplay-global-level">{snapshot.globalLevel ?? "READY"}</span>
            <span data-testid="gameplay-global-turn">T{snapshot.globalAbsoluteTurn}</span>
            <span data-testid="gameplay-song-time-ms">{Math.round(snapshot.songTimeMs)} ms</span>
            <span data-testid="gameplay-start-at-server-ms">{props.startAtServerMs}</span>
            <span data-testid="gameplay-local-player">{localParticipant?.displayName}</span>
          </div>
          {snapshot.audioEnded && (
            <div className="start-overlay" data-testid="gameplay-audio-ended">
              <div className="ready-card results-card">
                <span>DANCE COMPLETE · AUDIO END</span>
                <h1>{snapshot.stats.score.toLocaleString()}</h1>
                <p>P {snapshot.stats.perfect} · G {snapshot.stats.great} · C {snapshot.stats.cool} · B {snapshot.stats.bad} · M {snapshot.stats.miss}</p>
                <button onClick={() => window.location.assign("/rooms")}>VỀ DANH SÁCH PHÒNG</button>
              </div>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
