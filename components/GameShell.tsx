"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DEMO_CHART } from "../game/chart";
import { RhythmRuntime, SCORE_ZONE_END, SCORE_ZONE_START, PERFECT_CENTER } from "../game/runtime";
import type { Direction, GameStats, Judgement } from "../game/types";
import Stage3D from "./Stage3D";

const INITIAL_STATS: GameStats = { score: 0, combo: 0, maxCombo: 0, perfect: 0, great: 0, cool: 0, bad: 0, miss: 0 };
const DIRECTIONS: Direction[] = ["left", "up", "down", "right"];
const AUDIO_SRC = "/audio/Please%20tell%20me%20why.mp3";

export default function GameShell() {
  const [stats, setStats] = useState(INITIAL_STATS);
  const [sequence, setSequence] = useState<Direction[]>([]);
  const [completed, setCompleted] = useState(0);
  const [level, setLevel] = useState(1);
  const [judgement, setJudgement] = useState<Judgement | null>(null);
  const [gauge, setGauge] = useState(0);
  const [delta, setDelta] = useState(0);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [started, setStarted] = useState(false);
  const [finished, setFinished] = useState(false);
  const [audioState, setAudioState] = useState("idle");
  const [audioError, setAudioError] = useState<string | null>(null);
  const [audioDetails, setAudioDetails] = useState("");
  const [activeDirection, setActiveDirection] = useState<Direction | null>(null);
  const [wrongDirection, setWrongDirection] = useState<Direction | null>(null);
  const [spacePressed, setSpacePressed] = useState(false);
  const [songTime, setSongTime] = useState(0);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const directionTimer = useRef<number | null>(null);
  const judgementTimer = useRef<number | null>(null);
  const audioAlertedRef = useRef(false);

  const runtime = useMemo(() => new RhythmRuntime(DEMO_CHART, {
    onStats: setStats,
    onSequence: (next, filled) => { setSequence(next); setCompleted(filled); },
    onLevel: setLevel,
    onCountdown: setCountdown,
    onJudgement: (value) => {
      if (judgementTimer.current) window.clearTimeout(judgementTimer.current);
      setJudgement(value);
      judgementTimer.current = window.setTimeout(() => setJudgement(null), 1000);
    },
    onFinished: (next) => { setStats(next); setFinished(true); setStarted(false); },
  }), []);

  useEffect(() => () => {
    runtime.destroy();
    if (directionTimer.current) window.clearTimeout(directionTimer.current);
    if (judgementTimer.current) window.clearTimeout(judgementTimer.current);
  }, [runtime]);

  useEffect(() => {
    let raf = 0;
    const tick = () => {
      setGauge(runtime.gaugePercent);
      setDelta(runtime.timingDeltaMs);
      setSongTime(audioRef.current?.currentTime ?? 0);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [runtime]);

  const reportAudioError = useCallback((reason: string) => {
    setAudioState("error");
    setAudioError(reason);
    const audio = audioRef.current;
    const media = audio?.error;
    const details = [`code=${media?.code ?? "n/a"}`, `readyState=${audio?.readyState ?? "n/a"}`, `networkState=${audio?.networkState ?? "n/a"}`, `src=${AUDIO_SRC}`].join(" · ");
    setAudioDetails(details);
    if (!audioAlertedRef.current) {
      audioAlertedRef.current = true;
      window.setTimeout(() => window.alert(`AUDITION MOBILE – AUDIO ERROR\n\n${reason}\n\n${details}`), 0);
    }
  }, []);

  const playAudio = useCallback(async (restart = true) => {
    const audio = audioRef.current;
    if (!audio) { reportAudioError("Không tìm thấy HTMLAudioElement."); return false; }
    try {
      setAudioError(null); setAudioDetails(""); setAudioState("loading");
      if (restart) audio.currentTime = 0;
      audio.muted = false; audio.volume = 1; audio.load();
      await audio.play();
      setAudioState("playing");
      runtime.setTimeSource(() => audio.currentTime * 1000);
      return true;
    } catch (error) {
      const err = error as DOMException | undefined;
      const reason = err?.name === "NotAllowedError" ? "iOS/browser đã chặn playback vì thao tác chưa được coi là user gesture." : err?.name === "NotSupportedError" ? "Browser không decode được source audio đang deploy." : err?.message || "Browser báo lỗi playback không xác định.";
      reportAudioError(reason); runtime.setTimeSource(null); return false;
    }
  }, [reportAudioError, runtime]);

  const startGame = useCallback(async () => {
    audioAlertedRef.current = false;
    setStats(INITIAL_STATS); setSequence([]); setCompleted(0); setLevel(1); setJudgement(null); setFinished(false); setStarted(false); setCountdown(null); setAudioError(null); setSongTime(0);
    const audio = audioRef.current;
    if (!audio) return;
    try {
      audio.pause(); audio.currentTime = 0; audio.load(); await audio.play();
      setAudioState("playing"); runtime.setTimeSource(() => audio.currentTime * 1000); runtime.start(); setStarted(true);
    } catch (error) {
      const err = error as DOMException | undefined;
      const reason = err?.name === "NotAllowedError" ? "iOS/browser chặn autoplay. Hãy dùng TEST SOUND/REPLAY bằng một lần chạm trực tiếp." : err?.name === "NotSupportedError" ? "Browser không decode được source MP3 đang deploy." : err?.message || "Không thể phát audio.";
      reportAudioError(reason); runtime.setTimeSource(null); setStarted(false);
    }
  }, [reportAudioError, runtime]);

  const retryAudio = useCallback(async () => { audioAlertedRef.current = false; await playAudio(true); }, [playAudio]);

  const pressDirection = useCallback((direction: Direction) => {
    if (!started) return;
    setActiveDirection(direction);
    if (directionTimer.current) window.clearTimeout(directionTimer.current);
    directionTimer.current = window.setTimeout(() => setActiveDirection(null), 110);
    const target = sequence[completed];
    if (target && target !== direction) {
      setWrongDirection(direction);
      window.setTimeout(() => setWrongDirection(current => current === direction ? null : current), 180);
    } else setWrongDirection(null);
    runtime.handleDirection(direction);
  }, [runtime, sequence, completed, started]);

  const pressSpace = useCallback(() => {
    if (!started) return;
    setSpacePressed(true); window.setTimeout(() => setSpacePressed(false), 110); runtime.handleSpace();
  }, [runtime, started]);

  const pressGauge = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (!started) return;
    const rect = event.currentTarget.getBoundingClientRect();
    if (rect.width <= 0) return;
    const percent = ((event.clientX - rect.left) / rect.width) * 100;
    if (percent < SCORE_ZONE_START || percent > SCORE_ZONE_END) return;
    event.preventDefault(); pressSpace();
  }, [pressSpace, started]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.code === "Space") { event.preventDefault(); pressSpace(); return; }
      const map: Record<string, Direction> = { ArrowLeft: "left", ArrowUp: "up", ArrowDown: "down", ArrowRight: "right" };
      const direction = map[event.code]; if (direction) { event.preventDefault(); pressDirection(direction); }
    };
    window.addEventListener("keydown", onKey); return () => window.removeEventListener("keydown", onKey);
  }, [pressDirection, pressSpace]);

  const progress = Math.min(100, (songTime / 266.4) * 100);

  return (
    <main className="audition-page">
      <audio ref={audioRef} preload="auto" playsInline src={AUDIO_SRC} onCanPlay={() => setAudioState("ready")} onPlaying={() => setAudioState("playing")} onPause={() => setAudioState(current => current === "playing" ? "paused" : current)} onEnded={() => setAudioState("ended")} onError={() => { const code = audioRef.current?.error?.code; reportAudioError(code === 2 ? "Không thể tải file MP3 từ server." : code === 3 ? "File MP3 đã tải nhưng browser không decode được." : code === 4 ? "Browser không hỗ trợ source audio này." : "Media element báo lỗi audio không xác định."); }} />
      <section className="audition-stage">
        <Stage3D />
        <div className="audition-hud">
          <div className="hud-song"><div className="song-cover">♫</div><div className="song-copy"><strong>Please Tell Me Why</strong><span>BPM <b>80</b></span><div className="song-progress"><i style={{ width: `${progress}%` }} /></div><small>{formatTime(songTime)} / 04:26</small></div></div>
          <div className="battle-score"><div className="score-number red">{stats.score.toLocaleString()}</div><b>VS</b><div className="score-number blue">179,342</div><div className="battle-bar"><i style={{ width: `${Math.min(100, 50 + stats.score / 10000)}%` }} /></div><span>RED</span><span>BLUE</span></div>
          <div className="top-actions"><button onClick={retryAudio}>↻ REPLAY</button><button onClick={retryAudio}>ESC<small>ON/OFF</small></button></div>
          <div className="level-panel"><div className="level-title">LEVEL <b>{level}</b></div><div className="mission"><strong>MISSION</strong><span>Perfect more than 20</span><small>({stats.perfect} / 20) {stats.perfect >= 20 ? "✓" : ""}</small></div><div className="function-key">F10&nbsp;&nbsp; ON/OFF</div></div>
          <div className="leaderboard">{[["1st", "ToanDev", stats.score, "gold"], ["2nd", "Audition King", 179342, "silver"], ["3rd", "Dancer Pro", 165230, "bronze"], ["4th", "Cool Girl", 142587, "blue"]].map(([rank, name, score, tone]) => <div className={`rank-line ${tone}`} key={String(rank)}><b>{rank}</b><span className="avatar">●</span><span>{name}</span><strong>{Number(score).toLocaleString()}</strong></div>)}</div>
          <div className="combo-panel"><span>COMBO</span><strong>{stats.combo}</strong><b>{judgement ? `${judgement.toUpperCase()} x${stats.combo}` : stats.perfect ? `Perfect x${stats.perfect}` : "Ready"}</b></div>
          {countdown !== null && <div key={`countdown-${countdown}`} className="countdown">{countdown}</div>}
          {judgement && <div key={`judgement-${judgement}`} className={`judgement judgement-${judgement}`}>{judgement.toUpperCase()}</div>}
          {audioError && <div className="audio-error"><strong>🔇 SOUND ERROR</strong><span>{audioError}</span><small>{audioDetails}</small><button onClick={retryAudio}>RETRY SOUND</button></div>}
          <div className="command-zone"><div className="command-label"><span>LEVEL <b>{level}</b></span><small>{completed} / {sequence.length}</small></div><div className="command-strip">{sequence.map((direction, index) => { const isCompleted = index < completed; const isTarget = index === completed; const isWrong = isTarget && wrongDirection !== null && wrongDirection !== direction; return <div key={`${level}-${index}-${direction}`} className={`command-key ${isCompleted ? "done" : ""} ${isTarget ? "target" : ""} ${isWrong ? "wrong" : ""}`} style={{ background: isCompleted ? "linear-gradient(145deg,#3fca72,#168a4d)" : "linear-gradient(145deg,#3b8eea,#1458a6)", opacity: 1 }}><ArrowIcon direction={direction} filled={isCompleted} target={isTarget} /></div>; })}</div>
            <div className="timing-gauge" onPointerDown={pressGauge} style={{ ["--zone-start" as string]: `${SCORE_ZONE_START}%`, ["--zone-width" as string]: `${SCORE_ZONE_END - SCORE_ZONE_START}%`, ["--perfect" as string]: `${PERFECT_CENTER}%` }}><div className="gauge-track"><div className="gauge-zone"><i /></div><div className="gauge-marker" style={{ left: `${gauge}%` }} /></div><div className="gauge-labels"><span>MISS</span><span>BAD</span><span>COOL</span><span>GREAT</span><b>PERFECT</b><span>GREAT</span><span>COOL</span><span>BAD</span><span>MISS</span></div><div className="gauge-readout">{delta >= 0 ? "+" : ""}{delta.toFixed(0)} ms</div></div>
          </div>
          <div className="bottom-chat"><small>&lt;Public&gt;</small><span>Welcome to Audition Mobile!</span><span>Show your moves!</span><b>All <i>▶</i></b></div><div className="bottom-mode"><strong>Audition - Club Dance</strong><span>80 BPM <b>Hard</b></span><div>★★★☆☆</div></div><button className="exit-button">⇥<small>EXIT</small></button>
          <div className="mobile-controls"><button className={`space-control ${spacePressed ? "pressed" : ""}`} onPointerDown={(event) => { event.preventDefault(); pressSpace(); }}><strong>SPACE</strong><small>PRESS IN SCORE ZONE</small></button><div className="dpad-control">{DIRECTIONS.map(direction => <button key={direction} className={`dpad-${direction} ${activeDirection === direction ? "pressed" : ""} ${sequence[completed] === direction ? "target" : ""}`} onPointerDown={(event) => { event.preventDefault(); pressDirection(direction); }} aria-label={direction}><ArrowIcon direction={direction} filled={false} target={sequence[completed] === direction} compact /></button>)}<span /></div></div>
          {!started && !finished && !audioError && <div className="start-overlay"><div className="ready-card"><span>CLUB AUDITION</span><h1>READY?</h1><p>3 · 2 · 1 · 0 → gauge chạm PERFECT → bắt đầu turn.</p><button onClick={startGame}>START</button><button className="sound-button" onClick={retryAudio}>TEST SOUND</button></div></div>}
          {finished && <div className="start-overlay"><div className="ready-card results-card"><span>DANCE COMPLETE</span><h1>{stats.score.toLocaleString()}</h1><p>P {stats.perfect} · G {stats.great} · C {stats.cool} · B {stats.bad} · M {stats.miss}</p><button onClick={startGame}>PLAY AGAIN</button></div></div>}
        </div>
      </section>
    </main>
  );
}

function formatTime(value: number) { const total = Math.max(0, Math.floor(value)); return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`; }

function ArrowIcon({ direction, filled, target, compact = false }: { direction: Direction; filled: boolean; target: boolean; compact?: boolean }) {
  const rotation = direction === "right" ? 0 : direction === "down" ? 90 : direction === "left" ? 180 : 270;
  const size = compact ? 32 : 42;
  return <svg viewBox="0 0 42 40" aria-hidden="true" style={{ width: size, height: size, position: "absolute", left: "50%", top: "50%", transform: `translate(-50%, -50%) rotate(${rotation}deg)`, filter: `drop-shadow(0 0 ${target || filled ? 6 : 2}px rgba(255,255,255,.75))`, opacity: 1 }}><path d="M5 14H22V8L36 20L22 32V26H5V14Z" fill="#fff" stroke="#fff" strokeWidth="0" strokeLinejoin="miter" /></svg>;
}
