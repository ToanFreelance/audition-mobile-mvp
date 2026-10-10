"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import NextImage from "next/image";
import AuditionGauge from "../AuditionGauge";
import GameCommandTokenVisual from "../GameCommandTokenVisual";
import JudgementLabel from "../JudgementLabel";
import Stage3D from "../Stage3D";
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
import type {
  MultiplayerGameplayJudgementEvent,
  MultiplayerGameplayRuntime,
  MultiplayerGameplaySnapshot,
} from "../../multiplayer/gameplay-runtime";
import type { MatchManifest } from "../../multiplayer/types";

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
}) {
  const [snapshot, setSnapshot] = useState<MultiplayerGameplaySnapshot>(() => props.runtime.snapshot());
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
    pressSpace: () => void;
    pressDirection: (direction: Direction) => void;
    menuOpen: boolean;
  }>({ pressSpace: () => undefined, pressDirection: () => undefined, menuOpen: false });

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

  const localParticipant = props.manifest.participants.find(
    participant => participant.participantId === props.participantId,
  );
  // Frozen player identity only; no player name/gender or localStorage heuristic.
  const characterCandidate = localParticipant
    ? avatarCharacterAssetId(localParticipant.avatar)
    : DEFAULT_CHARACTER_ASSET_ID;
  const characterAssetId = isCharacterAssetId(characterCandidate)
    ? characterCandidate : DEFAULT_CHARACTER_ASSET_ID;
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
  const pressSpace = () => {
    if (!snapshot.started || snapshot.audioEnded || menuOpen) return;
    setSpacePressed(true);
    if (pressTimerRef.current !== null) window.clearTimeout(pressTimerRef.current);
    pressTimerRef.current = window.setTimeout(() => setSpacePressed(false), 110);
    props.runtime.handleSpace();
  };
  const pressGauge = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!snapshot.started || snapshot.audioEnded || menuOpen) return;
    const rect = event.currentTarget.getBoundingClientRect();
    if (rect.width <= 0) return;
    const percent = 100 * (event.clientX - rect.left) / rect.width;
    if (percent < SCORE_ZONE_START || percent > SCORE_ZONE_END) return;
    event.preventDefault();
    pressSpace();
  };

  keyboardInputRef.current = { pressSpace, pressDirection, menuOpen };
  useEffect(() => {
    // Runtime snapshots may render every RAF. Never rebind a global listener
    // each frame just because HUD numbers/gauge changed.
    const onKey = (event: KeyboardEvent) => {
      if (event.repeat || keyboardInputRef.current.menuOpen) return;
      if (event.code === "Space") {
        event.preventDefault();
        keyboardInputRef.current.pressSpace();
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
      <section className="audition-stage">
        <div data-testid="gameplay-3d-stage" data-frozen-stage-id={props.stageId}>
          <Stage3D
            cameraPreset={cameraPreset}
            selectedStageId={props.stageId}
            characterAssetId={characterAssetId}
            isPlaying={snapshot.started && !snapshot.audioEnded}
            characterEvent={characterEvent}
            getSongTimeMs={getSongTimeMs}
            bpm={props.manifest.gameplay.bpmExact}
          />
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
            <div className="leaderboard">
              {props.manifest.participants.map(participant => (
                <div className="rank-line blue" key={participant.participantId}>
                  <b>{participant.role === "host" ? "H" : "P"}</b>
                  <span className="avatar" aria-hidden="true" />
                  <span className="rank-copy">
                    <span>{participant.displayName}</span>
                    <strong>{participant.participantId === props.participantId
                      ? snapshot.stats.score.toLocaleString() : "—"}</strong>
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
              onPointerDown={event => { event.preventDefault(); pressSpace(); }} aria-label="SPACE">
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
