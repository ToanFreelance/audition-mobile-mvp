"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createChartFromMusicConfig, DEMO_CHART } from "../game/chart";
import { DEFAULT_MUSIC_CONFIG, type MusicConfig } from "../game/music-config";
import { RhythmRuntime, SCORE_ZONE_END, SCORE_ZONE_START } from "../game/runtime";
import type { Direction, GameStats, Judgement } from "../game/types";
import Stage3D from "./Stage3D";
import AuditionGauge from "./AuditionGauge";

const INITIAL_STATS: GameStats = { score: 0, combo: 0, maxCombo: 0, perfect: 0, great: 0, cool: 0, bad: 0, miss: 0 };
const DIRECTIONS: Direction[] = ["left", "up", "down", "right"];
const READY_START_SECONDS = 4;
const START_CUE_MS = 850;

type MusicApiResponse = { configs?: MusicConfig[] };

export default function GameShell() {
  const [musicLibrary, setMusicLibrary] = useState<MusicConfig[]>([]);
  const [selectedMusic, setSelectedMusic] = useState<MusicConfig>(DEFAULT_MUSIC_CONFIG);
  const [musicLoading, setMusicLoading] = useState(true);
  const [songPickerOpen, setSongPickerOpen] = useState(false);
  const [stats, setStats] = useState(INITIAL_STATS);
  const [sequence, setSequence] = useState<Direction[]>([]);
  const [completed, setCompleted] = useState(0);
  const [level, setLevel] = useState(1);
  const [judgement, setJudgement] = useState<Judgement | null>(null);
  const [gauge, setGauge] = useState(0);
  const [delta, setDelta] = useState(0);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [startCue, setStartCue] = useState(false);
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
  const startCueTimer = useRef<number | null>(null);
  const audioAlertedRef = useRef(false);

  const activeChart = useMemo(() => createChartFromMusicConfig(selectedMusic), [selectedMusic]);

  const runtime = useMemo(() => new RhythmRuntime(activeChart, {
    onStats: setStats,
    onSequence: (next, filled) => { setSequence(next); setCompleted(filled); },
    onLevel: setLevel,
    onCountdown: (value) => {
      setCountdown(value);
      if (value === 0) {
        if (startCueTimer.current) window.clearTimeout(startCueTimer.current);
        setStartCue(true);
        startCueTimer.current = window.setTimeout(() => setStartCue(false), START_CUE_MS);
      }
    },
    onJudgement: (value) => {
      if (judgementTimer.current) window.clearTimeout(judgementTimer.current);
      setJudgement(value);
      judgementTimer.current = window.setTimeout(() => setJudgement(null), 1000);
    },
    onFinished: (next) => { setStats(next); setFinished(true); setStarted(false); },
  }), [activeChart]);

  useEffect(() => {
    let cancelled = false;
    const loadMusic = async () => {
      try {
        const response = await fetch("/api/music-config", { cache: "no-store" });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json() as MusicApiResponse;
        if (cancelled) return;
        const configs = data.configs ?? [];
        setMusicLibrary(configs);
        const preferred = configs.find(item => item.id === DEFAULT_MUSIC_CONFIG.id) ?? configs[0];
        if (preferred) setSelectedMusic(preferred);
      } catch {
        if (!cancelled) setMusicLibrary([DEFAULT_MUSIC_CONFIG]);
      } finally {
        if (!cancelled) setMusicLoading(false);
      }
    };
    void loadMusic();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => () => {
    runtime.destroy();
    if (directionTimer.current) window.clearTimeout(directionTimer.current);
    if (judgementTimer.current) window.clearTimeout(judgementTimer.current);
    if (startCueTimer.current) window.clearTimeout(startCueTimer.current);
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

  const chooseMusic = useCallback((music: MusicConfig) => {
    if (started) return;
    runtime.stop();
    setStarted(false);
    setFinished(false);
    setSongPickerOpen(false);
    setSelectedMusic(music);
    setAudioError(null);
    setAudioDetails("");
    setSongTime(0);
    setStats(INITIAL_STATS);
    setSequence([]);
    setCompleted(0);
    setLevel(1);
    setJudgement(null);
    setCountdown(null);
    setStartCue(false);
    window.setTimeout(() => {
      const audio = audioRef.current;
      if (audio) { audio.pause(); audio.currentTime = 0; audio.load(); }
    }, 0);
  }, [runtime, started]);

  const openSongPicker = useCallback(() => {
    if (!started && !musicLoading) setSongPickerOpen(true);
  }, [started, musicLoading]);

  const reportAudioError = useCallback((reason: string) => {
    setAudioState("error");
    setAudioError(reason);
    const audio = audioRef.current;
    const media = audio?.error;
    const details = [`code=${media?.code ?? "n/a"}`, `readyState=${audio?.readyState ?? "n/a"}`, `networkState=${audio?.networkState ?? "n/a"}`, `src=${audio?.currentSrc || selectedMusic.audioUrl}`].join(" · ");
    setAudioDetails(details);
    if (!audioAlertedRef.current) {
      audioAlertedRef.current = true;
      window.setTimeout(() => window.alert(`AUDITION MOBILE – AUDIO ERROR\n\n${reason}\n\n${details}`), 0);
    }
  }, [selectedMusic.audioUrl]);

  const playAudio = useCallback(async (restart = true) => {
    const audio = audioRef.current;
    if (!audio) { reportAudioError("Không tìm thấy HTMLAudioElement."); return false; }
    try {
      setAudioError(null); setAudioDetails(""); setAudioState("loading");
      if (restart) audio.currentTime = 0;
      audio.muted = false; audio.volume = 1; audio.load();
      runtime.setTimeSource(() => audio.currentTime * 1000);
      await audio.play();
      setAudioState("playing");
      return true;
    } catch (error) {
      const err = error as DOMException | undefined;
      const reason = err?.name === "NotAllowedError" ? "iOS/browser đã chặn playback vì thao tác chưa được coi là user gesture." : err?.name === "NotSupportedError" ? "Browser không decode được source audio đang deploy." : err?.message || "Browser báo lỗi playback không xác định.";
      reportAudioError(reason); runtime.setTimeSource(null); return false;
    }
  }, [reportAudioError, runtime]);

  const startGame = useCallback(async () => {
    audioAlertedRef.current = false;
    setStats(INITIAL_STATS); setSequence([]); setCompleted(0); setLevel(1); setJudgement(null); setFinished(false); setStarted(false); setCountdown(null); setStartCue(false); setAudioError(null); setSongTime(0);
    const audio = audioRef.current;
    if (!audio) return;
    try {
      audio.pause();
      audio.currentTime = 0;
      audio.load();
      runtime.setTimeSource(() => audio.currentTime * 1000);
      runtime.start();
      const playPromise = audio.play();
      setAudioState("loading");
      await playPromise;
      setAudioState("playing");
      setStarted(true);
    } catch (error) {
      runtime.stop();
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

  const progress = Math.min(100, (songTime / Math.max(0.001, selectedMusic.durationMs / 1000 || 1)) * 100);
  const firstPerfectSeconds = (activeChart.firstPerfectMs ?? 15000) / 1000;
  const countdownStartSeconds = firstPerfectSeconds - (3 * 60000 / activeChart.bpm) / 1000;
  const showIntro = started && songTime < READY_START_SECONDS && countdown === null;
  const showReady = started && songTime >= READY_START_SECONDS && songTime < countdownStartSeconds && countdown === null;
  const showCommandStrip = started && songTime >= READY_START_SECONDS;

  return (
    <main className="audition-page">
      <audio ref={audioRef} preload="auto" playsInline src={selectedMusic.audioUrl} onCanPlay={() => setAudioState("ready")} onPlaying={() => setAudioState("playing")} onPause={() => setAudioState(current => current === "playing" ? "paused" : current)} onEnded={() => setAudioState("ended")} onError={() => { const code = audioRef.current?.error?.code; reportAudioError(code === 2 ? "Không thể tải file audio." : code === 3 ? "File audio đã tải nhưng browser không decode được." : code === 4 ? "Browser không hỗ trợ source audio này." : "Media element báo lỗi audio không xác định."); }} />
      <section className="audition-stage">
        <Stage3D />
        <div className="audition-hud">
          <button className="hud-song" onClick={openSongPicker} disabled={started || musicLoading} aria-label="Chọn bài nhạc"><div className="song-cover">♫</div><div className="song-copy"><strong>{selectedMusic.title}</strong><span>BPM <b>{selectedMusic.bpm}</b></span><div className="song-progress"><i style={{ width: `${progress}%` }} /></div><small>{formatTime(songTime)} / {formatTime(selectedMusic.durationMs)}</small></div></button>
          <div className="battle-score"><div className="score-number red">{stats.score.toLocaleString()}</div><b>VS</b><div className="score-number blue">179,342</div><div className="battle-bar"><i style={{ width: `${Math.min(100, 50 + stats.score / 10000)}%` }} /></div><span>RED</span><span>BLUE</span></div>
          <div className="top-actions"><button onClick={retryAudio}>↻ REPLAY</button><button onClick={retryAudio}>ESC<small>ON/OFF</small></button></div>
          <div className="level-panel"><div className="level-title">LEVEL <b>{level}</b></div><div className="mission"><strong>MISSION</strong><span>Perfect more than 20</span><small>({stats.perfect} / 20) {stats.perfect >= 20 ? "✓" : ""}</small></div><div className="function-key">F10&nbsp;&nbsp; ON/OFF</div></div>
          <div className="leaderboard">{[["1st", "ToanDev", stats.score, "gold"], ["2nd", "Audition King", 179342, "silver"], ["3rd", "Dancer Pro", 165230, "bronze"], ["4th", "Cool Girl", 142587, "blue"]].map(([rank, name, score, tone]) => <div className={`rank-line ${tone}`} key={String(rank)}><b>{rank}</b><span className="avatar">●</span><span>{name}</span><strong>{Number(score).toLocaleString()}</strong></div>)}</div>
          <div className="combo-panel"><span>COMBO</span><strong>{stats.combo}</strong><b>{judgement ? `${judgement.toUpperCase()} x${stats.combo}` : stats.perfect ? `Perfect x${stats.perfect}` : "Ready"}</b></div>
          {showIntro && <div className="intro-cue"><span>CLUB</span><strong>AUDITION</strong></div>}
          {showReady && <div className="ready-cue"><span>SẴN SÀNG</span><small>GET READY</small></div>}
          {countdown !== null && countdown > 0 && <div key={`countdown-${countdown}`} className="countdown">{countdown}</div>}
          {startCue && <div className="start-cue"><span>BẮT ĐẦU</span><strong>GO!</strong></div>}
          {judgement && <div key={`judgement-${judgement}`} className={`judgement judgement-${judgement}`}>{judgement.toUpperCase()}</div>}
          {audioError && <div className="audio-error"><strong>🔇 SOUND ERROR</strong><span>{audioError}</span><small>{audioDetails}</small><button onClick={retryAudio}>RETRY SOUND</button></div>}
          <div className={`command-zone ${showCommandStrip ? "visible" : "pre-intro"}`}>
            <div className="command-label"><span>LEVEL <b>{level}</b></span><small>{completed} / {sequence.length}</small></div>
            <div className="command-strip">{sequence.map((direction, index) => { const isCompleted = index < completed; const isTarget = index === completed; const isWrong = isTarget && wrongDirection !== null && wrongDirection !== direction; return <div key={`${level}-${index}-${direction}`} className={`command-key ${isCompleted ? "done" : ""} ${isTarget ? "target" : ""} ${isWrong ? "wrong" : ""}`} style={{ background: isCompleted ? "linear-gradient(145deg,#3fca72,#168a4d)" : "linear-gradient(145deg,#3b8eea,#1458a6)", opacity: 1 }}><ArrowIcon direction={direction} filled={isCompleted} target={isTarget} /></div>; })}</div>
            <AuditionGauge bpm={activeChart.bpm} value={gauge} zoneStart={SCORE_ZONE_START} zoneEnd={SCORE_ZONE_END} perfectStart={79} perfectEnd={81} onPointerDown={pressGauge} />
            <div className="gauge-readout">{delta >= 0 ? "+" : ""}{delta.toFixed(0)} ms</div>
          </div>
          <div className="bottom-chat"><small>&lt;Public&gt;</small><span>Welcome to Audition Mobile!</span><span>Show your moves!</span><b>All <i>▶</i></b></div><div className="bottom-mode"><strong>Audition - Club Dance</strong><span>{selectedMusic.bpm} BPM <b>Hard</b></span><div>★★★☆☆</div></div><button className="exit-button">⇥<small>EXIT</small></button>
          <div className="mobile-controls"><button className={`space-control ${spacePressed ? "pressed" : ""}`} onPointerDown={(event) => { event.preventDefault(); pressSpace(); }}><strong>SPACE</strong><small>PRESS IN SCORE ZONE</small></button><div className="dpad-control">{DIRECTIONS.map(direction => <button key={direction} className={`dpad-${direction} ${activeDirection === direction ? "pressed" : ""} ${sequence[completed] === direction ? "target" : ""}`} onPointerDown={(event) => { event.preventDefault(); pressDirection(direction); }} aria-label={direction}><ArrowIcon direction={direction} filled={false} target={sequence[completed] === direction} compact /></button>)}<span /></div></div>
          {!started && !finished && !audioError && <div className="start-overlay"><div className="ready-card"><span>CLUB AUDITION</span><h1>READY?</h1><p>Song: <b>{selectedMusic.title}</b><br />Intro → Sẵn sàng → 3 · 2 · 1 → Bắt đầu → first beat.</p><button onClick={startGame}>START</button><button className="song-select-button" onClick={openSongPicker} disabled={musicLoading}>♫ SELECT SONG</button><button className="configure-button" onClick={() => { window.location.href = "/tools/music-config"; }}>⚙ CONFIGURE MUSIC</button><button className="sound-button" onClick={() => { window.location.href = "/tools/audio-timing"; }}>🧪 AUDIO TIMING</button><button className="sound-button" onClick={retryAudio}>TEST SOUND</button></div></div>}
          {finished && <div className="start-overlay"><div className="ready-card results-card"><span>DANCE COMPLETE</span><h1>{stats.score.toLocaleString()}</h1><p>P {stats.perfect} · G {stats.great} · C {stats.cool} · B {stats.bad} · M {stats.miss}</p><button onClick={startGame}>PLAY AGAIN</button><button onClick={openSongPicker}>SELECT SONG</button></div></div>}
          {songPickerOpen && <SongPicker songs={musicLibrary.length ? musicLibrary : [selectedMusic]} selectedId={selectedMusic.id} onSelect={chooseMusic} onClose={() => setSongPickerOpen(false)} />}
        </div>
      </section>
    </main>
  );
}

function SongPicker({ songs, selectedId, onSelect, onClose }: { songs: MusicConfig[]; selectedId: string; onSelect: (song: MusicConfig) => void; onClose: () => void }) {
  return <div className="song-picker-backdrop" role="presentation" onMouseDown={onClose}><div className="song-picker" role="dialog" aria-modal="true" aria-labelledby="song-picker-title" onMouseDown={event => event.stopPropagation()}><div className="song-picker-head"><div><span>SONG LIBRARY</span><h2 id="song-picker-title">Select Music</h2></div><button onClick={onClose}>×</button></div><div className="song-picker-list">{songs.map(song => <button key={song.id} className={`song-picker-item ${song.id === selectedId ? "active" : ""}`} onClick={() => onSelect(song)}><span className="song-picker-cover">♫</span><span><strong>{song.title}</strong><small>{song.artist || "Unknown artist"} · {song.bpm} BPM</small></span><b>{song.id === selectedId ? "✓" : ""}</b></button>)}</div></div></div>;
}

function formatTime(value: number) { const total = Math.max(0, Math.floor(value)); return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`; }

function ArrowIcon({ direction, filled, target, compact = false }: { direction: Direction; filled: boolean; target: boolean; compact?: boolean }) {
  const rotation = direction === "right" ? 0 : direction === "down" ? 90 : direction === "left" ? 180 : 270;
  const size = compact ? 32 : 42;
  return <svg viewBox="0 0 42 40" aria-hidden="true" style={{ width: size, height: size, position: "absolute", left: "50%", top: "50%", transform: `translate(-50%, -50%) rotate(${rotation}deg)`, filter: `drop-shadow(0 0 ${target || filled ? 6 : 2}px rgba(255,255,255,.75))`, opacity: 1 }}><path d="M5 14H22V8L36 20L22 32V26H5V14Z" fill="#fff" stroke="#fff" strokeWidth="0" strokeLinejoin="miter" /></svg>;
}