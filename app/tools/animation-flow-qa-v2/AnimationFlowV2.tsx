"use client";

import { useEffect, useRef, useState } from "react";
import * as T from "three";
import { BVHLoader } from "three/examples/jsm/loaders/BVHLoader.js";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { CharacterActor, disposeObjectResources } from "@/components/character/CharacterActor";
import { CORE_PHRASES, FAILING_PAIRS, FIXTURE_PHRASES, MOONWALK_PHRASE, SOURCE_PIN, type ExitPolicy } from "@/lib/animation-flow-v2/catalog";
import { makeCanonicalRig, preparePhrase, SourceFlowEngine, type PreparedPhrase, type SourceMotion } from "@/lib/animation-flow-v2/engine";
import { DemoBeatClock, TurnCursor } from "@/lib/animation-flow-v2/clock";
import { PhraseBag } from "@/lib/animation-flow-v2/shuffle";
import { CanvasSourcePreview } from "@/lib/animation-flow-v2/canvas-preview";
import styles from "./animation-flow-v2.module.css";

type View = "source" | "c1-casual-grace" | "c4-casual-boy";
type Telemetry = ReturnType<SourceFlowEngine["snapshot"]> & {
  beat: number; turn: number; bpm: number; seed: number; auto: boolean; audioState: string;
  view: View; referenceStatus: string; triggerCount: number; processedBoundaries: number[];
  referenceAnchor: number[] | null; measurementsDomain: string;
  renderBackend: "webgl" | "canvas2d-projection";
};
type Commands = { toggle(): Promise<void>; reset(): Promise<void>; space(): void; replay(id: string): Promise<void>; moonwalk(): Promise<void>; export(): void; record(): void };
const emptyCommands: Commands = { toggle: async () => {}, reset: async () => {}, space: () => {}, replay: async () => {}, moonwalk: async () => {}, export: () => {}, record: () => {} };
const f = (n: number | undefined) => (n ?? 0).toFixed(4);

export default function AnimationFlowV2() {
  const host = useRef<HTMLDivElement>(null);
  const commands = useRef<Commands>({ ...emptyCommands });
  const [bpm, setBpm] = useState(120), [fade, setFade] = useState(0.35);
  const [auto, setAuto] = useState(true), [view, setView] = useState<View>("source");
  const [policy, setPolicy] = useState<"metadata" | ExitPolicy>("metadata");
  const [status, setStatus] = useState("Đang chuẩn bị sáu phrase upright…");
  const [running, setRunning] = useState(false), [ready, setReady] = useState(false);
  const [recording, setRecording] = useState(false), [error, setError] = useState("");
  const [seed, setSeed] = useState(20261018);
  const [telemetry, setTelemetry] = useState<Telemetry | null>(null);
  const [history, setHistory] = useState<{ a: string | null; b: string; policy: string; delayBeats: number }[]>([]);
  const [pair, setPair] = useState<string>(FAILING_PAIRS[0].id);
  const [backend, setBackend] = useState<"webgl" | "canvas2d-projection">("webgl");
  const options = useRef({ bpm, fade, auto, view, policy });
  useEffect(() => { options.current = { bpm, fade, auto, view, policy }; }, [bpm, fade, auto, view, policy]);

  useEffect(() => {
    const hostElement = host.current; if (!hostElement) return;
    const element: HTMLDivElement = hostElement;
    let disposed = false, raf = 0, audio: AudioContext | null = null;
    let engine: SourceFlowEngine | null = null, bag = new PhraseBag(CORE_PHRASES, 20261018);
    let runSeed = 20261018, reference: CharacterActor | null = null, referenceVersion = 0;
    let referenceView: View = "source", referenceStatus = "Chưa tải", referenceEvent = 0;
    let triggerCount = 0, processedBoundaries: number[] = [], lastUi = 0, replayTarget: string | null = null;
    let samples: Telemetry[] = [], recorder: MediaRecorder | null = null;
    const clock = new DemoBeatClock(), turns = new TurnCursor();
    const sources = new Map<string, SourceMotion>(), loading = new Map<string, Promise<SourceMotion>>();
    const scene = new T.Scene(); scene.background = new T.Color("#0c101a");
    const camera = new T.PerspectiveCamera(34, 1, 0.01, 30); camera.position.set(2.65, 1.9, 3.7);
    let renderer: T.WebGLRenderer | CanvasSourcePreview;
    let renderBackend: "webgl" | "canvas2d-projection" = "webgl";
    try { renderer = new T.WebGLRenderer({ antialias: true, alpha: false }); }
    catch { renderer = new CanvasSourcePreview(); renderBackend = "canvas2d-projection"; queueMicrotask(() => { if (!disposed) setBackend("canvas2d-projection"); }); }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5)); renderer.outputColorSpace = T.SRGBColorSpace;
    renderer.domElement.setAttribute("aria-label", "Sân thử chuyển động 3D"); element.appendChild(renderer.domElement);
    const controls = new OrbitControls(camera, renderer.domElement); controls.target.set(0, 0.8, 0); controls.enableDamping = true; controls.enablePan = false; controls.minDistance = 2; controls.maxDistance = 8;
    scene.add(new T.HemisphereLight(0xdbdeff, 0x20243d, 2.8));
    const key = new T.DirectionalLight(0xffffff, 3); key.position.set(2, 4, 3); scene.add(key);
    const rim = new T.DirectionalLight(0x9776ff, 2); rim.position.set(-3, 2, -2); scene.add(rim);
    const floor = new T.Mesh(new T.CircleGeometry(1.8, 96), new T.MeshStandardMaterial({ color: 0x1c2233, roughness: 0.65 }));
    floor.rotation.x = -Math.PI / 2; floor.position.y = -0.025; scene.add(floor);
    for (const [radius, color] of [[1.35, 0xa78bfa], [0.14, 0x60e3bb]] as const) {
      const ring = new T.Mesh(new T.RingGeometry(radius - 0.007, radius + 0.007, 96), new T.MeshBasicMaterial({ color, side: T.DoubleSide }));
      ring.rotation.x = -Math.PI / 2; ring.position.y = -0.012; scene.add(ring);
    }
    const grid = new T.GridHelper(3.6, 18, 0x454d68, 0x242c40); grid.position.y = -0.018; scene.add(grid);
    const body = new T.InstancedMesh(new T.CylinderGeometry(0.018, 0.026, 1, 7), new T.MeshStandardMaterial({ color: 0xc9bbff, metalness: 0.2, roughness: 0.45 }), 64);
    const joints = new T.InstancedMesh(new T.SphereGeometry(0.034, 10, 8), new T.MeshStandardMaterial({ color: 0xf0e8ff, roughness: 0.5 }), 64);
    body.name = "QA-V2-bones"; joints.name = "QA-V2-joints";
    body.count = 0; joints.count = 0; body.frustumCulled = false; joints.frustumCulled = false; scene.add(body, joints);
    const trailPoints: T.Vector3[] = [];
    const trailGeometry = new T.BufferGeometry();
    const trailPositions = new T.BufferAttribute(new Float32Array(180 * 3), 3);
    trailGeometry.setAttribute("position", trailPositions); trailGeometry.setDrawRange(0, 0);
    const trail = new T.Line(trailGeometry, new T.LineBasicMaterial({ color: 0x67d9b8, transparent: true, opacity: 0.55 })); trail.frustumCulled = false; scene.add(trail);
    const resize = () => { const width = element.clientWidth, height = element.clientHeight; renderer.setSize(width, height, false); camera.aspect = width / Math.max(1, height); camera.updateProjectionMatrix(); };
    const observer = new ResizeObserver(resize); observer.observe(element); resize();

    async function source(id: string): Promise<SourceMotion> {
      if (sources.has(id)) return sources.get(id)!;
      if (loading.has(id)) return loading.get(id)!;
      const pending = (async () => {
        const response = await fetch(`/api/animation-flow-qa-v2/source/${id}`, { cache: "force-cache" });
        if (!response.ok) throw new Error(`Không tải được ${id} (${response.status}).`);
        const result = new BVHLoader().parse(await response.text()); sources.set(id, result); return result;
      })();
      loading.set(id, pending);
      try { return await pending; } finally { loading.delete(id); }
    }
    async function prepare(specs = CORE_PHRASES) {
      const canonicalSource = await source("111_05");
      if (!engine) engine = new SourceFlowEngine(makeCanonicalRig(canonicalSource), new Map<string, PreparedPhrase>());
      const target = engine;
      for (const spec of specs) {
        if (target.phrases.has(spec.id)) continue;
        const motion = await source(spec.source);
        target.phrases.set(spec.id, preparePhrase(spec, motion, target.rig, canonicalSource));
      }
    }
    const audioSeconds = () => audio?.currentTime ?? 0;
    const currentBeat = () => clock.beat(audioSeconds());
    const download = (blob: Blob, name: string) => { const a = document.createElement("a"); const url = URL.createObjectURL(blob); a.href = url; a.download = name; a.click(); window.setTimeout(() => URL.revokeObjectURL(url), 1000); };
    const reportError = (e: unknown) => { if (!disposed) setError(e instanceof Error ? e.message : String(e)); };
    async function ensureAudio() { if (!audio) { audio = new AudioContext(); clock.reset(audio.currentTime); clock.setBpm(options.current.bpm, audio.currentTime); } await audio.resume(); if (!disposed) setRunning(true); }
    function referenceSpace(beat: number) {
      reference?.handlePresentationEvent({ kind: "dance", eventId: ++referenceEvent, absoluteTurn: Math.floor(beat / 4), level: 4, isFinish: false, judgement: "perfect", choreographyId: `dance-0${referenceEvent % 8 + 1}` as "dance-01", actionStartSongTimeMs: audioSeconds() * 1000 });
    }
    function space(beat: number, trigger: "auto" | "manual") {
      if (!engine) return; triggerCount++;
      if (trigger === "manual") replayTarget = null;
      if (options.current.view !== "source") { referenceSpace(beat); return; }
      if (replayTarget && trigger === "auto") {
        if (engine.current?.phrase.spec.id === replayTarget) replayTarget = null;
        else { if (engine.pending?.id !== replayTarget) engine.request(replayTarget, beat); return; }
      }
      const selected = bag.next(p => Boolean(engine!.placement(p.id)) && p.source !== engine!.current?.phrase.spec.source && p.group !== engine!.current?.phrase.spec.group);
      if (selected) {
        const accepted = engine.request(selected.id, beat);
        setStatus(accepted ? "Đã nhận SPACE · phrase được căn entry và kiểm tra toàn đường đi." : "Phrase được hoãn vì đường đi vượt vùng sân; timeline vẫn chạy.");
      } else setStatus("Chờ phrase phù hợp vùng sân / anti-repeat; timeline vẫn chạy.");
    }
    function advance(beat: number) {
      if (!engine) return;
      const config = options.current;
      engine.bpm = config.bpm; engine.blendBeats = config.fade; engine.policyOverride = config.policy === "metadata" ? undefined : config.policy;
      for (const boundary of turns.consume(beat)) { processedBoundaries.push(boundary); engine.update(boundary); if (config.auto) space(boundary, "auto"); }
      engine.update(beat);
    }
    async function resetRun() {
      if (!engine) return;
      const random = new Uint32Array(1); crypto.getRandomValues(random); runSeed = random[0];
      setSeed(runSeed); bag = new PhraseBag(CORE_PHRASES, runSeed);
      clock.reset(audioSeconds()); turns.reset(); processedBoundaries = []; triggerCount = 0; samples = []; trailPoints.length = 0; replayTarget = null;
      const first = bag.next(); if (first) engine.start(first.id, 0); setError(""); setStatus("Sáu phrase upright · đường root có giới hạn · không loop raw.");
      reference?.setGameActive(false); reference?.setGameActive(true); referenceSpace(0);
    }
    commands.current = {
      toggle: async () => { try { if (audio?.state === "running") { await audio.suspend(); setRunning(false); } else await ensureAudio(); } catch (e) { reportError(e); } },
      reset: async () => { await resetRun(); },
      space: () => { if (audio?.state === "running") { const beat = currentBeat(); advance(beat); space(beat, "manual"); } },
      replay: async id => {
        try {
          const p = FAILING_PAIRS.find(p => p.id === id); if (!p) return;
          if (audio?.state === "running") await audio.suspend(); setRunning(false); setStatus("Đang tải fixture đối chứng…");
          await prepare(FIXTURE_PHRASES.filter(s => s.source === p.a || s.source === p.b));
          if (disposed || !engine) return;
          clock.reset(audioSeconds()); turns.reset(); processedBoundaries = []; samples = []; triggerCount = 0; trailPoints.length = 0;
          engine.start("fixture-" + p.a); replayTarget = "fixture-" + p.b;
          setView("source"); options.current.view = "source"; setAuto(true); options.current.auto = true;
          setStatus("Đối chứng: SPACE ở beat 4; floor/inversion đợi recovery marker."); await ensureAudio();
        } catch (e) { reportError(e); }
      },
      moonwalk: async () => {
        try { await prepare([MOONWALK_PHRASE]); if (disposed || !engine) return; engine.request(MOONWALK_PHRASE.id, currentBeat()); setStatus("Phrase Moonwalk riêng: giữ chuyển động trượt, không thuộc shuffle core."); } catch (e) { reportError(e); }
      },
      export: () => download(new Blob([JSON.stringify({ schemaVersion: 2, sourcePin: SOURCE_PIN, seed: runSeed, view: options.current.view, renderBackend, tempoBasis: "testing-assumption", settings: options.current, transitions: engine?.history, processedBoundaries, samples, snapshot: engine?.snapshot(), referenceStatus, limitations: ["CMU canonical skeleton, not accepted-character retarget", "reference path retains production controller timing", "technical exit markers await visual acceptance"] }, null, 2)], { type: "application/json" }), `animation-flow-v2-${runSeed}.json`),
      record: () => {
        if (recorder && recorder.state !== "inactive") { recorder.stop(); return; }
        if (!renderer.domElement.captureStream || typeof MediaRecorder === "undefined") { setError("Browser này không hỗ trợ ghi canvas; dùng xuất telemetry JSON."); return; }
        const chunks: BlobPart[] = [], stream = renderer.domElement.captureStream(30);
        const mimeType = ["video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/mp4"].find(type => MediaRecorder.isTypeSupported(type));
        try {
          recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
          recorder.ondataavailable = event => { if (event.data.size) chunks.push(event.data); };
          recorder.onstop = () => { stream.getTracks().forEach(t => t.stop()); if (!disposed) { setRecording(false); download(new Blob(chunks, { type: recorder!.mimeType }), `animation-flow-v2-${runSeed}.${recorder!.mimeType.includes("mp4") ? "mp4" : "webm"}`); } };
          recorder.start(); setRecording(true);
        } catch (e) { stream.getTracks().forEach(t => t.stop()); reportError(e); }
      },
    };

    const matrix = new T.Object3D(), p = new T.Vector3(), q = new T.Vector3();
    function drawRig() {
      if (!engine) return;
      let segment = 0, joint = 0;
      for (const bone of engine.rig.bones) {
        bone.getWorldPosition(p); matrix.position.copy(p); matrix.quaternion.identity(); matrix.scale.setScalar(bone.name === "Head" ? 1.8 : 1); matrix.updateMatrix(); joints.setMatrixAt(joint++, matrix.matrix);
        if (bone.parent && (bone.parent as T.Bone).isBone) {
          bone.parent.getWorldPosition(q); const length = p.distanceTo(q);
          if (length > 0.005) { matrix.position.copy(p).add(q).multiplyScalar(0.5); matrix.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), q.clone().sub(p).normalize()); matrix.scale.set(1, length, 1); matrix.updateMatrix(); body.setMatrixAt(segment++, matrix.matrix); }
        }
      }
      body.count = segment; joints.count = joint; body.instanceMatrix.needsUpdate = true; joints.instanceMatrix.needsUpdate = true;
    }
    async function selectReference(next: View) {
      const version = ++referenceVersion; reference?.dispose(); reference = null; referenceView = next;
      if (next === "source") return;
      referenceStatus = "Đang tải actor/published clips…";
      const actor = CharacterActor.fromAssetId(next); reference = actor; scene.add(actor.root); actor.setGameActive(true);
      const result = await actor.load();
      if (disposed || version !== referenceVersion) { actor.dispose(); return; }
      referenceStatus = result?.source === "gltf" ? "Actor GLTF · published/fallback qua đường hiện hành" : "FALLBACK — không tính character PASS";
      referenceSpace(currentBeat());
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.code !== "Space" || event.repeat || (event.target as HTMLElement)?.closest("input,select,button,textarea")) return;
      event.preventDefault(); commands.current.space();
    };
    window.addEventListener("keydown", onKey);
    function render(now: number) {
      if (disposed) return; raf = requestAnimationFrame(render);
      const config = options.current, seconds = audioSeconds();
      if (config.bpm !== clock.bpm) clock.setBpm(config.bpm, seconds);
      const beat = clock.beat(seconds);
      if (engine) {
        advance(beat);
        if (referenceView !== config.view) void selectReference(config.view).catch(reportError);
        const isSource = config.view === "source"; body.visible = isSource; joints.visible = isSource; trail.visible = isSource;
        if (isSource) drawRig(); else reference?.update(0, seconds, seconds * 1000);
        if (now - lastUi > 95) {
          const state = engine.snapshot();
          const data: Telemetry = { ...state, beat, turn: turns.index + 1, bpm: config.bpm, seed: runSeed, auto: config.auto, audioState: audio?.state ?? "chưa bắt đầu", view: config.view, referenceStatus, triggerCount, processedBoundaries: [...processedBoundaries], referenceAnchor: reference?.root.position.toArray() ?? null, measurementsDomain: config.view === "source" ? "canonical-CMU" : "CMU-hidden; reference has separate referenceAnchor", renderBackend };
          element.dataset.telemetry = JSON.stringify(data);
          setTelemetry(data); setHistory(engine.history.slice(-8).reverse()); samples.push(data); if (samples.length > 12000) samples.shift();
          trailPoints.push(new T.Vector3(state.root[0], 0.004, state.root[2])); if (trailPoints.length > 180) trailPoints.shift();
          trailPoints.forEach((point, index) => trailPositions.setXYZ(index, point.x, point.y, point.z));
          trailPositions.needsUpdate = true; trailGeometry.setDrawRange(0, trailPoints.length); lastUi = now;
        }
      }
      controls.update(); renderer.render(scene, camera);
    }
    raf = requestAnimationFrame(render);
    void prepare().then(() => {
      if (disposed || !engine) return;
      const requestedSeed = new URLSearchParams(window.location.search).get("seed");
      const random = new Uint32Array(1); crypto.getRandomValues(random);
      runSeed = requestedSeed && /^\d{1,10}$/.test(requestedSeed) ? Number(requestedSeed) >>> 0 : random[0];
      bag = new PhraseBag(CORE_PHRASES, runSeed); setSeed(runSeed);
      scene.add(engine.stageAnchor); engine.start(bag.next()!.id); setReady(true);
      setStatus("Sáu phrase upright đã sẵn sàng. Bấm Bắt đầu để mở đồng hồ âm thanh.");
    }).catch(reportError);
    return () => {
      disposed = true; commands.current = { ...emptyCommands }; cancelAnimationFrame(raf); observer.disconnect(); window.removeEventListener("keydown", onKey);
      if (recorder?.state === "recording") recorder.stop(); void audio?.close(); reference?.dispose(); controls.dispose();
      disposeObjectResources(scene); renderer.dispose(); renderer.domElement.remove();
    };
  }, []);

  const progress = telemetry ? telemetry.beat % 4 / 4 : 0;
  const currentSpec = CORE_PHRASES.find(p => p.id === telemetry?.current);
  return <main className={styles.page}>
    <div className={styles.shell}>
      <header className={styles.header}><div><p className={styles.eyebrow}>AUDITION / MOTION LAB</p><h1>Animation Flow <span>V2</span></h1><p className={styles.lead}>Một vị trí sân. Nhiều động tác. Chuyển ở SPACE.</p></div><span className={styles.qa}>DEMO CÔ LẬP</span></header>
      <div className={styles.tabs} role="group" aria-label="Đường phát animation">
        {([["source", "Nguồn BVH · V2"], ["c1-casual-grace", "Tham chiếu nữ"], ["c4-casual-boy", "Tham chiếu nam"]] as const).map(([id, label]) => <button key={id} disabled={id !== "source" && backend !== "webgl"} title={id !== "source" && backend !== "webgl" ? "Cần WebGL để xem mesh accepted" : undefined} aria-pressed={view === id} onClick={() => setView(id)}>{label}</button>)}
      </div>
      <div className={styles.layout}>
        <section className={styles.stageCard}>
          <div className={styles.stageHeader}><span><i className={ready ? styles.dot : styles.loadingDot} />{view === "source" ? backend === "webgl" ? "CMU · CANONICAL SKELETON" : "CMU · CHIẾU SKELETON 2D" : "PUBLISHED · NHÂN VẬT HIỆN HÀNH"}</span><span>{bpm} BPM · {view === "source" ? "tempo giả định" : "controller gốc"}</span></div>
          <div ref={host} className={styles.canvas} data-testid="animation-flow-stage" />
          <div className={styles.canvasCaption}>{view === "source" ? "Vòng tím = vùng root 1,35 · tâm xanh = stage anchor cố định · kéo để xoay camera" : "Đường tham chiếu giữ controller production (150 ms / tốc độ gốc). Chưa retarget sáu phrase CMU vào actor này."}</div>
          <div className={styles.rhythm}>
            <div className={styles.counters}><span>TURN <b data-testid="turn-counter">{telemetry?.turn ?? 1}</b></span><div className={styles.beats}>{[0, 1, 2, 3].map(n => <i key={n} data-active={Math.floor(telemetry?.beat ?? 0) % 4 === n}>{n + 1}</i>)}</div><span>{running ? "ĐANG CHẠY" : "TẠM DỪNG"}</span></div>
            <div className={styles.gauge} role="progressbar" aria-label="Gauge mô phỏng bốn beat" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress * 100)}><div style={{ transform: `scaleX(${progress})` }} />{[1, 2, 3].map(n => <i key={n} style={{ left: `${n * 25}%` }} />)}</div>
            <button className={styles.space} disabled={!ready || !running} onClick={() => commands.current.space()}><span>SPACE</span><small>Đổi động tác · giữ nguyên timeline</small></button>
          </div>
        </section>
        <aside className={styles.sidebar}>
          <section className={styles.panel}><p className={styles.eyebrow}>ĐANG TRÌNH BÀY</p><h2>{view === "source" ? currentSpec?.label ?? telemetry?.current ?? "Chuẩn bị…" : view === "c1-casual-grace" ? "Casual Grace" : "Casual Boy"}</h2><div className={styles.sourceId}>{view === "source" ? telemetry?.source ?? "—" : view}</div><p className={styles.muted}>{view === "source" ? `Phrase ${telemetry?.sourcePhrase?.map(n => n.toFixed(2)).join("–") ?? "—"} giây nguồn · ${telemetry?.policy ?? "FREE"}` : telemetry?.referenceStatus ?? "Chưa tải"}</p>{telemetry?.pending && view === "source" && <p className={styles.pending}>Đã nhận SPACE · đợi exit tại beat {telemetry.pending.dueBeat.toFixed(2)}</p>}<p className={styles.muted}>Trước: {view === "source" ? telemetry?.previous ?? "—" : "xem đường published hiện hành"}</p></section>
          <section className={styles.panel}>
            <div className={styles.buttons}><button className={styles.primary} disabled={!ready} onClick={() => void commands.current.toggle()}>{running ? "Tạm dừng" : "Bắt đầu"}</button><button disabled={!ready} onClick={() => void commands.current.reset()}>Lượt ngẫu nhiên mới</button></div>
            <label className={styles.control}>BPM <strong>{bpm}</strong><input aria-label="BPM" type="range" min={80} max={180} step={1} value={bpm} onChange={e => setBpm(+e.target.value)} /></label>
            <div className={styles.presets}><button onClick={() => setBpm(120)}>120 BPM</button><button onClick={() => setBpm(160)}>160 BPM</button></div>
            <label className={styles.control}>Crossfade <select aria-label="Crossfade" value={fade} disabled={view !== "source"} onChange={e => setFade(+e.target.value)}>{[0.15, 0.35, 0.7, 1].map(v => <option key={v} value={v}>{v} beat · {(v * 60 / bpm).toFixed(3)} giây</option>)}</select></label>
            <label className={styles.control}>Exit policy <select aria-label="Exit policy" value={policy} disabled={view !== "source"} onChange={e => setPolicy(e.target.value as typeof policy)}><option value="metadata">Theo phrase metadata</option><option value="FREE">FREE · nếu không trong protected phase</option><option value="BEAT_WINDOW">BEAT_WINDOW</option><option value="PROTECTED">PROTECTED · thử chờ marker</option></select></label>
            <label className={styles.checkbox}><input type="checkbox" checked={auto} onChange={e => setAuto(e.target.checked)} />Tự SPACE mỗi bốn beat</label>
          </section>
          <section className={styles.panel}><p className={styles.eyebrow}>ĐỐI CHỨNG LỖI CŨ</p><label className={styles.control}>Cặp xác định <select aria-label="Cặp lỗi" value={pair} onChange={e => setPair(e.target.value)}>{FAILING_PAIRS.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}</select></label><div className={styles.buttons}><button disabled={!ready} onClick={() => void commands.current.replay(pair)}>Phát lại cặp</button><button disabled={!ready || view !== "source"} onClick={() => void commands.current.moonwalk()}>Thử Moonwalk</button></div><p className={styles.muted}>Fixture ballet/floor chỉ để QA; không nằm trong pool ngẫu nhiên.</p></section>
        </aside>
      </div>
      <section className={styles.measurements} aria-label="Đo không gian">
        {[["ROOT X / Z", view === "source" ? `${f(telemetry?.root[0])} / ${f(telemetry?.root[2])}` : "không đo Hips"], ["ANCHOR X / Z", view === "source" ? `${f(telemetry?.stageAnchor[0])} / ${f(telemetry?.stageAnchor[2])}` : telemetry?.referenceAnchor ? `${f(telemetry.referenceAnchor[0])} / ${f(telemetry.referenceAnchor[2])}` : "chưa tải"], ["ENTRY ΔXZ", view === "source" ? f(telemetry?.entryDisplacement) : "không áp dụng"], ["ĐỘ LỆCH TỪ ĐẦU", view === "source" ? f(telemetry?.cumulativeDisplacement) : "không áp dụng"], ["BÁN KÍNH LỚN NHẤT", view === "source" ? f(telemetry?.maxRadius) : "không áp dụng"], ["LOOP SEAM", view === "source" ? telemetry?.heldAtEnd ? "Giữ pose cuối" : "One-shot · không loop" : "controller gốc"]].map(([label, value]) => <div key={label}><small>{label}</small><strong>{value}</strong></div>)}
      </section>
      <section className={styles.panel}><div className={styles.historyHeader}><div><p className={styles.eyebrow}>LỊCH SỬ CHUYỂN</p><p className={styles.muted}>Seed {seed} · {telemetry?.transitionCount ?? 0} chuyển · {telemetry?.audioState ?? "chưa bắt đầu"}</p></div><div className={styles.buttons}><button disabled={!ready} onClick={() => commands.current.export()}>Xuất JSON</button><button disabled={!ready} onClick={() => commands.current.record()}>{recording ? "Dừng / tải video" : "Ghi video sân"}</button></div></div><div className={styles.history}>{history.map((row, i) => <div key={`${row.b}-${history.length - i}`}><b>{row.a ?? "Bắt đầu"} → {row.b}</b><span>{row.policy} · đợi {row.delayBeats.toFixed(2)} beat</span></div>)}</div></section>
      <p className={styles.status} role="status">{status}</p>{error && <p className={styles.error} role="alert">{error}</p>}
      <footer className={styles.footer}>{backend === "canvas2d-projection" && "WebGL bị vô hiệu hóa: đang dùng projection 2D để thử logic/telemetry, không tính WebGL hay mesh PASS. "}Tooling V2 · tempo CMU chưa được xác nhận âm nhạc · marker exit là ứng viên QA · chưa có nghiệm thu retarget CMU hoặc iPhone thật. Gauge này chỉ mô phỏng, không chỉnh gauge gameplay.</footer>
    </div>
  </main>;
}
