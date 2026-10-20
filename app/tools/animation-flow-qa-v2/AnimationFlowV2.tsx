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
import { INITIAL_CAMERA, STAGE_FRONT } from "@/lib/animation-flow-v2/heading";
import styles from "./animation-flow-v2.module.css";
import { NORMAL_PHRASES, FINISH_PHRASES, REST_PHRASES, type PhraseSpec } from "@/lib/animation-flow-v2/catalog";
import { GameplayPreview, previewTurnCounter, type PreviewOutcome } from "@/lib/animation-flow-v2/gameplay-preview";
import { SessionChoreography } from "@/lib/animation-flow-v2/session-choreography";
import { closeStandingIdle, type FinishPresentation } from "@/lib/animation-flow-v2/finish-presentation";
import { describeSharedTurn, firstFinishTurn } from "@/multiplayer/determinism";
import { FLARE_SPEC, FLARE_RISE_SPEC, FlareLibrary } from "@/lib/animation-flow-v2/flare-performance";
import type { FlareSource } from "@/lib/animation-flow-v2/flare-source";
import { FINISH_CHOREOGRAPHY } from "@/components/character/choreography";

type View = "source" | "c1-casual-grace" | "c4-casual-boy";
type Mode = "gameplay" | "lab" | "finish";
type Telemetry = ReturnType<SourceFlowEngine["snapshot"]> & {
  beat: number; turn: number | null; beatBoundary: number; bpm: number; seed: number; auto: boolean; audioState: string;
  finishPresentation: ReturnType<FinishPresentation["snapshot"]> | null;
  view: View; referenceStatus: string; triggerCount: number; processedBoundaries: number[];
  referenceAnchor: number[] | null; measurementsDomain: string;
  renderBackend: "webgl" | "canvas2d-projection";
  gameplay: ReturnType<GameplayPreview["snapshot"]> | null; mode: Mode;
};
type Commands = { toggle(): Promise<void>; reset(): Promise<void>; space(): void; replay(id: string): Promise<void>; moonwalk(): Promise<void>; export(): void; record(): void; mode(mode: Mode): Promise<void>; preview(id: string, finish: boolean): Promise<void> };
const emptyCommands: Commands = { toggle: async () => {}, reset: async () => {}, space: () => {}, replay: async () => {}, moonwalk: async () => {}, export: () => {}, record: () => {}, mode: async () => {}, preview: async () => {} };
const f = (n: number | undefined) => (n ?? 0).toFixed(4);

export default function AnimationFlowV2() {
  const host = useRef<HTMLDivElement>(null);
  const commands = useRef<Commands>({ ...emptyCommands });
  const [bpm, setBpm] = useState(120), [fade, setFade] = useState(0.35);
  const [auto, setAuto] = useState(true), [view, setView] = useState<View>("source");
  const [policy, setPolicy] = useState<"metadata" | ExitPolicy>("metadata");
  const [status, setStatus] = useState("Đang chuẩn bị choreography và Finish…");
  const [mode, setMode] = useState<Mode>("gameplay"), [outcome, setOutcome] = useState<PreviewOutcome>("perfect");
  const [previewPhrase, setPreviewPhrase] = useState(NORMAL_PHRASES[0].id), [finishPhrase, setFinishPhrase] = useState(FLARE_SPEC.id);
  const [running, setRunning] = useState(false), [ready, setReady] = useState(false);
  const [recording, setRecording] = useState(false), [error, setError] = useState("");
  const [seed, setSeed] = useState(20261018);
  const [telemetry, setTelemetry] = useState<Telemetry | null>(null);
  const [history, setHistory] = useState<{ a: string | null; b: string; policy: string; delayBeats: number }[]>([]);
  const [pair, setPair] = useState<string>(FAILING_PAIRS[0].id);
  const [backend, setBackend] = useState<"webgl" | "canvas2d-projection">("webgl");
  const options = useRef({ bpm, fade, auto, view, policy, mode, outcome, finishPhrase });
  useEffect(() => { options.current = { bpm, fade, auto, view, policy, mode, outcome, finishPhrase }; }, [bpm, fade, auto, view, policy, mode, outcome, finishPhrase]);

  useEffect(() => {
    const hostElement = host.current; if (!hostElement) return;
    const element: HTMLDivElement = hostElement;
    let disposed = false, raf = 0, audio: AudioContext | null = null;
    let engine: SourceFlowEngine | null = null, bag = new PhraseBag(CORE_PHRASES, 20261018);
    let runSeed = 20261018, reference: CharacterActor | null = null, referenceVersion = 0;
    let referenceView: View = "source", referenceStatus = "Chưa tải", referenceEvent = 0;
    let triggerCount = 0, processedBoundaries: number[] = [], lastUi = 0, replayTarget: string | null = null;
    let samples: Telemetry[] = [], recorder: MediaRecorder | null = null;
    let gameplay: GameplayPreview | null = null, choreography: SessionChoreography | null = null;
    let flare:FlareLibrary|undefined,flareReplayResume:number|null=null,flareSourceStatus="Chưa tải";
    const videoCanvas = document.createElement("canvas"); videoCanvas.width = 720; videoCanvas.height = 840;
    const selectionEvents: { beat: number; eligibleIds: string[]; selected: string | null; decisions: unknown[] }[] = [];
    const clock = new DemoBeatClock(), turns = new TurnCursor();
    const sources = new Map<string, SourceMotion>(), loading = new Map<string, Promise<SourceMotion>>();
    const scene = new T.Scene(); scene.background = new T.Color("#0c101a");
    const camera = new T.PerspectiveCamera(34, 1, 0.01, 30); camera.position.set(...INITIAL_CAMERA);
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
    const stageFront = new T.ArrowHelper(new T.Vector3(Math.sin(STAGE_FRONT), 0, Math.cos(STAGE_FRONT)), new T.Vector3(0, .035, 0), .7, 0x60e3bb, .14, .09);
    const dancerFront = new T.ArrowHelper(new T.Vector3(0, 0, 1), new T.Vector3(), .5, 0xffc56d, .12, .08);
    stageFront.name = "QA-stage-front"; dancerFront.name = "QA-dancer-front"; scene.add(stageFront, dancerFront);
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
    async function prepare(specs: readonly PhraseSpec[] = [...NORMAL_PHRASES, ...FINISH_PHRASES, ...REST_PHRASES]) {
      const canonicalSource = await source("111_05");
      if (!engine) engine = new SourceFlowEngine(makeCanonicalRig(canonicalSource), new Map<string, PreparedPhrase>());
      const target = engine;
      for (const spec of specs) {
        if (target.phrases.has(spec.id)) continue;
        const motion = await source(spec.source);
        target.phrases.set(spec.id, closeStandingIdle(preparePhrase(spec, motion, target.rig, canonicalSource)));
      }
    }
    async function prepareFlare(){
      if(!engine)return;
      try{
        const response=await fetch('/qa/animation-flow-v2/flare-source.json',{cache:'force-cache'});
        if(!response.ok)throw Error(`Flare ${response.status}`);
        const data:FlareSource=await response.json(),base=await source('111_05'),rise=preparePhrase(FLARE_RISE_SPEC,await source(FLARE_RISE_SPEC.source),engine.rig,base);
        flare=new FlareLibrary(data,engine,rise);flareSourceStatus='GLB kehel · Mixamo → CMU · thử nghiệm';
      }catch(e){flareSourceStatus=`Flare không tải được: ${String(e)}; dùng Finish cũ dự phòng.`;}
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
      const eligibleIds = CORE_PHRASES.filter(p => Boolean(engine!.placement(p.id)) && p.source !== engine!.current?.phrase.spec.source && p.group !== engine!.current?.phrase.spec.group).map(p => p.id);
      const selected = bag.next(p => eligibleIds.includes(p.id));
      selectionEvents.push({ beat, eligibleIds, selected: selected?.id ?? null, decisions: [...engine.placementDecisions.values()] });
      if (selectionEvents.length > 12000) selectionEvents.shift();
      if (selected) {
        const accepted = engine.request(selected.id, beat);
        setStatus(accepted ? "Đã nhận SPACE · căn vị trí và hướng, kiểm tra toàn phrase." : "Hoãn visual: vị trí / hướng tại exit chưa tương thích; timeline vẫn chạy.");
      } else setStatus("Không có phrase phù hợp vị trí / hướng / anti-repeat: giữ one-shot hiện tại; timeline vẫn chạy.");
    }
    function createGameplay() {
      if (!engine) return;
      choreography = new SessionChoreography(engine, runSeed, true,flare);
      choreography.instantGameplay = true;
      engine.loopIdle = true;
      choreography.finishChoice=options.current.finishPhrase;
      gameplay = new GameplayPreview(options.current.bpm, runSeed, (event, beat) => {
        triggerCount++;
        if (options.current.view === "source") {
          const accepted = choreography!.select(beat, event.absoluteTurn, event.isFinish, !event.isFinish && describeSharedTurn(gameplay!.manifest, event.absoluteTurn + 1).isFinish,event.isFinish?gameplay!.resumeBeatAfterFinish(event.absoluteTurn):undefined);
          setStatus(accepted ? `${event.isFinish ? "FINISH" : "Perfect"} · global turn ${event.absoluteTurn}` : "Không có placement phù hợp; giữ pose, timeline vẫn chạy. Xem JSON.");
        } else reference?.handlePresentationEvent({ kind: "dance", eventId: ++referenceEvent, absoluteTurn: event.absoluteTurn, level: event.level, isFinish: event.isFinish, judgement: "perfect", choreographyId: event.isFinish ? FINISH_CHOREOGRAPHY : `dance-0${event.absoluteTurn % 8 + 1}` as "dance-01", actionStartSongTimeMs: audioSeconds() * 1000 });
      });
    }
    function advance(beat: number) {
      if (!engine) return;
      const config = options.current;
      if(choreography)choreography.finishChoice=config.finishPhrase;
      engine.bpm = config.bpm; engine.blendBeats = config.fade;
      // Exit overrides are laboratory diagnostics; Gameplay SPACE stays immediate.
      engine.policyOverride = config.mode === "lab" && config.policy !== "metadata" ? config.policy : undefined;
      if (config.mode === "gameplay" && gameplay?.manifest.gameplay.bpmExact !== config.bpm && beat === 0) createGameplay();
      for (const boundary of turns.consume(beat)) {
        processedBoundaries.push(boundary);
        if (config.mode === "gameplay") gameplay?.advance(boundary, config.auto, config.outcome);
        else { engine.update(boundary); if (config.mode === "lab" && config.auto) space(boundary, "auto");
          if (config.mode === "finish" && replayTarget) {
            if(replayTarget===FLARE_SPEC.id&&gameplay){
              flareReplayResume=boundary+gameplay.finishWindow(firstFinishTurn(gameplay.manifest)).totalBeats;
              if(!choreography?.presentation?.requestFlare(boundary,null,flareReplayResume))setStatus('Flare không đủ điều kiện; xem nguồn và không gian trong JSON.');
            }else if (engine.request(replayTarget, boundary)) choreography?.presentation?.begin(replayTarget, boundary, null);
            replayTarget = null;
          }
          if(config.mode==='finish'&&flareReplayResume!==null&&boundary>=flareReplayResume){choreography?.select(flareReplayResume,null);flareReplayResume=null;}
        }
        // Consume exact authoritative targets before sampling the final visual
        // pose. A sparse frame must not idle past an unprocessed L6 command.
        if (config.view === "source" && config.mode !== "lab") choreography?.update(boundary);
      }
      if (config.mode === "gameplay") gameplay?.advance(beat, config.auto, config.outcome);
      if (config.view === "source" && config.mode !== "lab") choreography?.update(beat);
      engine.update(beat);
    }
    async function resetRun() {
      if (!engine) return;
      const random = new Uint32Array(1); crypto.getRandomValues(random); runSeed = random[0];
      setSeed(runSeed); bag = new PhraseBag(CORE_PHRASES, runSeed);
      clock.reset(audioSeconds()); turns.reset(); processedBoundaries = []; triggerCount = 0; samples = []; trailPoints.length = 0; replayTarget = null;flareReplayResume=null;
      selectionEvents.length = 0;
      const first = bag.next(); if (first) engine.start(options.current.mode === "gameplay" ? "143-party" : first.id, 0);
      createGameplay(); setError(""); setStatus("QA loop · shared multiplayer · 4 beat/turn · Finish không kết thúc phiên.");
      reference?.setGameActive(false); reference?.setGameActive(true); referenceSpace(0);
    }
    commands.current = {
      toggle: async () => { try { if (audio?.state === "running") { await audio.suspend(); setRunning(false); } else await ensureAudio(); } catch (e) { reportError(e); } },
      reset: async () => { await resetRun(); },
      space: () => { if (audio?.state === "running") { const beat = currentBeat(); advance(beat);
        if (options.current.mode === "gameplay") {
          const row = gameplay?.snapshot().current;
          const reserved = row && gameplay && describeSharedTurn(gameplay.manifest, row.absoluteTurn + 1).isFinish;
          if (!choreography?.manual(beat, reserved ? "FINISH_PREP" : row?.status)) setStatus("SPACE tay chỉ thử visual; FINISH / REST / HIDDEN và lượt chuẩn bị Finish giữ choreography.");
        } else if (options.current.mode === "lab") space(beat, "manual");
      } },
      mode: async next => { if (audio?.state === "running") await audio.suspend(); setRunning(false); setMode(next); options.current.mode = next; if (next === "gameplay") { setAuto(true); options.current.auto = true; setOutcome("perfect"); options.current.outcome = "perfect"; } await resetRun(); },
      preview: async (id, finish) => {
        if (audio?.state === "running") await audio.suspend(); setRunning(false);
        setMode(finish ? "finish" : "lab"); options.current.mode = finish ? "finish" : "lab";
        setView("source"); options.current.view = "source"; setAuto(false); options.current.auto = false;
        await resetRun(); if (!engine) return;
        engine.start(finish ? "143-party" : id); replayTarget = finish ? id : null;
        setStatus(finish ? "REPLAY FINISH RIÊNG · reset phiên QA; normal → Finish beat 4, Flare về dance beat 24." : "PREVIEW PHRASE RIÊNG · reset phiên QA; one-shot rồi giữ pose cuối.");
        await ensureAudio();
      },
      replay: async id => {
        try {
          const p = FAILING_PAIRS.find(p => p.id === id); if (!p) return;
          if (audio?.state === "running") await audio.suspend(); setRunning(false); setStatus("Đang tải fixture đối chứng…");
          setMode("lab"); options.current.mode = "lab";
          await prepare(FIXTURE_PHRASES.filter(s => s.source === p.a || s.source === p.b));
          if (disposed || !engine) return;
          clock.reset(audioSeconds()); turns.reset(); processedBoundaries = []; samples = []; triggerCount = 0; trailPoints.length = 0;
          engine.start("fixture-" + p.a); replayTarget = "fixture-" + p.b;
          setView("source"); options.current.view = "source"; setAuto(true); options.current.auto = true;
          setStatus("Đối chứng: SPACE ở beat 4; floor/inversion đợi recovery marker."); await ensureAudio();
        } catch (e) { reportError(e); }
      },
      moonwalk: async () => {
        if (options.current.mode !== "lab") { setStatus("Chọn Free Animation Lab trước khi thử Moonwalk riêng."); return; }
        try { await prepare([MOONWALK_PHRASE]); if (disposed || !engine) return; engine.request(MOONWALK_PHRASE.id, currentBeat()); setStatus("Phrase Moonwalk riêng: giữ chuyển động trượt, không thuộc shuffle core."); } catch (e) { reportError(e); }
      },
      export: () => download(new Blob([JSON.stringify({ schemaVersion: 6, implementation: "2.2.3", flareSourceStatus, flareSource:flare?.retarget.diagnostics, sourcePin: SOURCE_PIN, seed: runSeed, view: options.current.view, renderBackend, clockMode: "synthetic-AudioContext-QA-loop-no-real-song", tempoBasis: "testing-assumption", settings: options.current, catalog: [...NORMAL_PHRASES,FLARE_SPEC,...FINISH_PHRASES,...REST_PHRASES], gameplayTurns: gameplay?.turns, judgements: gameplay?.judgements, choreographySelections: choreography?.selections, continuityEvents: choreography?.continuityEvents, finishPresentation: choreography?.presentation?.snapshot(), finishPresentationEvents: choreography?.presentation?.events, flareAttempts:choreography?.presentation?.flareAttempts, transitions: engine?.history, processedBoundaries, selectionEvents, samples, snapshot: engine?.snapshot(), referenceStatus, limitations: ["CMU canonical skeleton, not accepted-character retarget", "shared multiplayer schedule, not duration-dependent Solo ending planner", "no Music Config selected; no real-song acceptance", "technical exit markers await visual acceptance", "fixture-spatial-only replay is not a facing acceptance test"] }, null, 2)], { type: "application/json" }), `animation-flow-v222-${runSeed}.json`),
      record: () => {
        if (recorder && recorder.state !== "inactive") { recorder.stop(); return; }
        if (!renderer.domElement.captureStream || typeof MediaRecorder === "undefined") { setError("Browser này không hỗ trợ ghi canvas; dùng xuất telemetry JSON."); return; }
        const chunks: BlobPart[] = [], stream = videoCanvas.captureStream(30);
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
      dancerFront.position.copy(engine.motionRoot.position); dancerFront.position.y = .04;
      const front = new T.Vector3(0, 0, 1).applyQuaternion(engine.rig.bones[0].quaternion); front.y = 0;
      dancerFront.setDirection(front.normalize());
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
        stageFront.visible = isSource; dancerFront.visible = isSource;
        if (isSource) drawRig(); else reference?.update(0, seconds, seconds * 1000);
        if (now - lastUi > 95) {
          const state = engine.snapshot();
          const data: Telemetry = { ...state, gameplay: config.mode === "gameplay" ? gameplay?.snapshot() ?? null : null, finishPresentation: choreography?.presentation?.snapshot() ?? null, mode: config.mode, beat, turn: previewTurnCounter(config.mode, gameplay?.snapshot().current, turns.index).value, beatBoundary: turns.index, bpm: config.bpm, seed: runSeed, auto: config.auto, audioState: audio?.state ?? "chưa bắt đầu", view: config.view, referenceStatus, triggerCount, processedBoundaries: [...processedBoundaries], referenceAnchor: reference?.root.position.toArray() ?? null, measurementsDomain: config.view === "source" ? "canonical-CMU" : "CMU-hidden; reference has separate referenceAnchor", renderBackend };
          element.dataset.telemetry = JSON.stringify(data);
          setTelemetry(data); setHistory(engine.history.slice(-8).reverse()); samples.push(data); if (samples.length > 12000) samples.shift();
          trailPoints.push(new T.Vector3(state.root[0], 0.004, state.root[2])); if (trailPoints.length > 180) trailPoints.shift();
          trailPoints.forEach((point, index) => trailPositions.setXYZ(index, point.x, point.y, point.z));
          trailPositions.needsUpdate = true; trailGeometry.setDrawRange(0, trailPoints.length); lastUi = now;
        }
      }
      controls.update(); renderer.render(scene, camera);
      if(options.current.view==='source')choreography?.presentation?.markRendered(currentBeat());
      if (recorder?.state === "recording") {
        const ctx = videoCanvas.getContext("2d");
        if (ctx) {
          ctx.fillStyle = "#0c101a"; ctx.fillRect(0, 0, 720, 840); ctx.drawImage(renderer.domElement, 0, 100, 720, 660);
          const row = options.current.mode === "gameplay" ? gameplay?.snapshot().current : null;
          ctx.fillStyle = row?.isFinish ? "#ff646d" : "#f0e8ff"; ctx.font = "bold 24px sans-serif";
          ctx.fillText(row ? `L${row.level} · TURN ${row.absoluteTurn} · ${row.status} · ${row.sequenceIndex + 1}/${row.levelBudget}` : `${options.current.mode.toUpperCase()} · QA ISOLATED`, 22, 35);
          ctx.fillStyle = "#c9bbff"; ctx.font = "18px sans-serif"; ctx.fillText(`${options.current.bpm} BPM · beat ${beat.toFixed(2)} · ${engine?.snapshot().current ?? ""}`, 22, 68);
          ctx.fillText(`${renderBackend} · synthetic AudioContext QA loop`, 22, 790); ctx.fillText("CMU source skeleton · NOT accepted mesh / iPhone validation", 22, 820);
        }
      }
    }
    raf = requestAnimationFrame(render);
    void prepare().then(prepareFlare).then(() => {
      if (disposed || !engine) return;
      const requestedSeed = new URLSearchParams(window.location.search).get("seed");
      const random = new Uint32Array(1); crypto.getRandomValues(random);
      runSeed = requestedSeed && /^\d{1,10}$/.test(requestedSeed) ? Number(requestedSeed) >>> 0 : random[0];
      bag = new PhraseBag(CORE_PHRASES, runSeed); setSeed(runSeed);
      scene.add(engine.stageAnchor); engine.start("143-party"); createGameplay(); setReady(true);
      setStatus(`${NORMAL_PHRASES.length} phrase thường + ${FINISH_PHRASES.length} Finish sẵn sàng. Bấm Bắt đầu: QA loop dùng lịch shared multiplayer gốc.`);
    }).catch(reportError);
    return () => {
      disposed = true; commands.current = { ...emptyCommands }; cancelAnimationFrame(raf); observer.disconnect(); window.removeEventListener("keydown", onKey);
      if (recorder?.state === "recording") recorder.stop(); void audio?.close(); reference?.dispose(); controls.dispose();
      disposeObjectResources(scene); renderer.dispose(); renderer.domElement.remove();
    };
  }, []);

  const progress = telemetry ? telemetry.beat % 4 / 4 : 0;
  const currentSpec = [...NORMAL_PHRASES,FLARE_SPEC,...FINISH_PHRASES,...REST_PHRASES].find(p => p.id === telemetry?.current);
  const gameplayRow = telemetry?.gameplay?.current;
  const turnCounter = previewTurnCounter(mode, gameplayRow, telemetry?.beatBoundary ?? 0);
  const tempoLocked = (mode === "gameplay" || mode === "finish") && (telemetry?.beat ?? 0) > 0;
  return <main className={styles.page}>
    <div className={styles.shell}>
      <header className={styles.header}><div><p className={styles.eyebrow}>AUDITION / MOTION LAB</p><h1>Animation Flow <span>V2.2.3</span></h1><p className={styles.lead}>L1–9 → Flare liên hoàn trong REST → đứng dậy → L6. {NORMAL_PHRASES.length} phrase thường, giữ hai Finish cũ để so sánh.</p></div><span className={styles.qa}>DEMO CÔ LẬP</span></header>
      <div className={styles.tabs} role="group" aria-label="Chế độ QA"><button aria-pressed={mode === "gameplay"} disabled={!ready} onClick={() => void commands.current.mode("gameplay")}>Gameplay Preview · reset phiên</button><button aria-pressed={mode === "lab"} disabled={!ready} onClick={() => void commands.current.mode("lab")}>Free Animation Lab · V2.1</button></div>
      <p className={styles.muted}>QA loop · AudioContext tổng hợp, không phát bài hát thật / Music Config. BPM khóa sau khi bắt đầu Gameplay; reset phiên để đổi BPM. Lịch shared multiplayer, không dùng Solo ending planner theo độ dài bài.</p>
      <div className={styles.tabs} role="group" aria-label="Đường phát animation">
        {([["source", "Nguồn BVH · V2"], ["c1-casual-grace", "Tham chiếu nữ"], ["c4-casual-boy", "Tham chiếu nam"]] as const).map(([id, label]) => <button key={id} disabled={id !== "source" && backend !== "webgl"} title={id !== "source" && backend !== "webgl" ? "Cần WebGL để xem mesh accepted" : undefined} aria-pressed={view === id} onClick={() => setView(id)}>{label}</button>)}
      </div>
      <div className={styles.layout}>
        <section className={styles.stageCard}>
          <div className={styles.stageHeader}><span><i className={ready ? styles.dot : styles.loadingDot} />{view === "source" ? backend === "webgl" ? "CMU · CANONICAL SKELETON" : "CMU · CHIẾU SKELETON 2D" : "PUBLISHED · NHÂN VẬT HIỆN HÀNH"}</span><span>{bpm} BPM · {view === "source" ? "tempo giả định" : "controller gốc"}</span></div>
          <div ref={host} className={styles.canvas} data-testid="animation-flow-stage" />
          <div className={styles.canvasCaption}>{view === "source" ? "Vòng tím = root 1,35 · mũi tên xanh = khán giả cố định · vàng = hướng Hips +Z · orbit không đổi hướng sân" : "Đường tham chiếu giữ controller production (150 ms / tốc độ gốc). Chưa retarget sáu phrase CMU vào actor này."}</div>
          {view === "source" && <div className={styles.canvasCaption} data-testid="facing-indicator">{telemetry?.samplingDomain ? "Flare: hướng Hips khi chống sàn không phải hướng đứng" : `Lệch hướng: ${(telemetry?.orientation.facingErrorDeg ?? 0).toFixed(1)}°`} · {Math.abs(telemetry?.orientation.facingErrorDeg ?? 0) <= 45 ? "Chính diện" : Math.abs(telemetry?.orientation.facingErrorDeg ?? 0) <= 90 ? "Nghiêng" : "Quay lưng"} · {telemetry?.orientation.policy === "fixture-spatial-only" ? "Fixture: chỉ kiểm vị trí" : "Ưu tiên khán giả"}</div>}
          <div className={styles.rhythm}>
            {mode === "gameplay" && <div className={styles.gameplayHud} data-testid="gameplay-hud" data-finish={gameplayRow?.isFinish}>
              <strong>{gameplayRow ? `L${gameplayRow.level} · ${gameplayRow.status === "FINISH" ? "FINISH ⇄ MŨI TÊN ĐẢO" : gameplayRow.status}` : "L1 · CHUẨN BỊ 4 BEAT"}</strong>
              <span>Global turn (0-based): {gameplayRow?.absoluteTurn ?? "—"} · trong cấp: {gameplayRow ? `${gameplayRow.sequenceIndex + 1}/${gameplayRow.levelBudget}` : "1/1"}</span>
              <span>Chu kỳ {gameplayRow?.cycle ?? 1} · Finish tiếp: {gameplayRow?.nextFinish ?? 38} · SPACE {auto ? `Auto ${outcome}` : "Manual visual"}</span>
              <span>Nhóm: {currentSpec?.group ?? "—"} · {currentSpec?.id ?? "—"}</span>
              <span data-testid="finish-phase">Trình bày: {telemetry?.finishPresentation?.phase ?? "DANCE"}</span>{telemetry?.finishPresentation?.flare && <span data-testid="flare-progress">Vòng {telemetry.finishPresentation.completedLoops}/{telemetry.finishPresentation.loopCount} · {telemetry.finishPresentation.playbackRate?.toFixed(3)}× · còn {telemetry.finishPresentation.remainingBeats?.toFixed(2)} beat tới L6</span>}
            </div>}
            <div className={styles.counters}><span>{turnCounter.label} <b data-testid="turn-counter">{turnCounter.value ?? "—"}</b></span><div className={styles.beats}>{[0, 1, 2, 3].map(n => <i key={n} data-active={Math.floor(telemetry?.beat ?? 0) % 4 === n}>{n + 1}</i>)}</div><span>{running ? "ĐANG CHẠY" : "TẠM DỪNG"}</span></div>
            <div className={styles.gauge} role="progressbar" aria-label="Gauge mô phỏng bốn beat" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress * 100)}><div style={{ transform: `scaleX(${progress})` }} />{[1, 2, 3].map(n => <i key={n} style={{ left: `${n * 25}%` }} />)}</div>
            <button className={styles.space} disabled={!ready || !running || mode === "finish"} onClick={() => commands.current.space()}><span>SPACE</span><small>Thử visual, không nhập arrow / chấm điểm · giữ timeline</small></button>
          </div>
        </section>
        <aside className={styles.sidebar}>
          <section className={styles.panel}><p className={styles.eyebrow}>ĐANG TRÌNH BÀY</p><h2>{view === "source" ? currentSpec?.label ?? telemetry?.current ?? "Chuẩn bị…" : view === "c1-casual-grace" ? "Casual Grace" : "Casual Boy"}</h2><div className={styles.sourceId}>{view === "source" ? telemetry?.source ?? "—" : view}</div>{telemetry?.finishPresentation?.flare && <p className={styles.muted}>Rig Mixamo → CMU · {backend} · entry/đứng dậy thử nghiệm</p>}<p className={styles.muted}>{view === "source" ? `Phrase ${telemetry?.sourcePhrase?.map(n => n.toFixed(2)).join("–") ?? "—"} giây nguồn · ${telemetry?.policy ?? "FREE"}` : telemetry?.referenceStatus ?? "Chưa tải"}</p>{telemetry?.pending && view === "source" && <p className={styles.pending}>Đã nhận SPACE · đợi exit tại beat {telemetry.pending.dueBeat.toFixed(2)}</p>}<p className={styles.muted} data-testid="presentation-phase">Pha: {telemetry?.finishPresentation?.phase ?? "DANCE"}{telemetry?.finishPresentation?.flare && ` · vòng ${telemetry.finishPresentation.completedLoops}/${telemetry.finishPresentation.loopCount} · còn ${telemetry.finishPresentation.remainingBeats?.toFixed(2)} beat · ${telemetry.finishPresentation.playbackRate?.toFixed(3)}×`}</p><p className={styles.muted}>Trước: {view === "source" ? telemetry?.previous ?? "—" : "xem đường published hiện hành"}</p></section>
          <section className={styles.panel}>
            <div className={styles.buttons}><button className={styles.primary} disabled={!ready} onClick={() => void commands.current.toggle()}>{running ? "Tạm dừng" : "Bắt đầu"}</button><button disabled={!ready} onClick={() => void commands.current.reset()}>Lượt ngẫu nhiên mới</button></div>
            <label className={styles.control}>BPM <strong>{bpm}</strong><input aria-label="BPM" disabled={tempoLocked} type="range" min={80} max={200} step={1} value={bpm} onChange={e => setBpm(+e.target.value)} /></label>
            <div className={styles.presets}>{[110,120,160,200].map(rate=><button key={rate} disabled={tempoLocked} onClick={() => setBpm(rate)}>{rate} BPM</button>)}</div>
            <label className={styles.control}>Crossfade <select aria-label="Crossfade" value={fade} disabled={view !== "source"} onChange={e => setFade(+e.target.value)}>{[0.15, 0.35, 0.7, 1].map(v => <option key={v} value={v}>{v} beat · {(v * 60 / bpm).toFixed(3)} giây</option>)}</select></label>
            <label className={styles.control}>Exit policy <select aria-label="Exit policy" value={policy} disabled={view !== "source"} onChange={e => setPolicy(e.target.value as typeof policy)}><option value="metadata">Theo phrase metadata</option><option value="FREE">FREE · nếu không trong protected phase</option><option value="BEAT_WINDOW">BEAT_WINDOW</option><option value="PROTECTED">PROTECTED · thử chờ marker</option></select></label>
            <label className={styles.checkbox}><input type="checkbox" checked={auto} onChange={e => setAuto(e.target.checked)} />{mode === "gameplay" ? "Auto command tại target gốc; bỏ qua HIDDEN / REST" : "Tự SPACE mỗi bốn beat (Lab)"}</label>
            {mode === "gameplay" && <label className={styles.control}>Kết quả tự động <select aria-label="Auto outcome" value={outcome} onChange={e => setOutcome(e.target.value as PreviewOutcome)}><option value="perfect">Perfect · nhập đúng arrow + SPACE</option><option value="miss">Miss · không nhập, runtime xử lý</option></select></label>}
          </section>
          <section className={styles.panel}><p className={styles.eyebrow}>FINISH RIÊNG · CHƯA DUYỆT PRODUCTION</p><select aria-label="Finish candidate" value={finishPhrase} onChange={e => setFinishPhrase(e.target.value)}>{[FLARE_SPEC,...FINISH_PHRASES].map(p => <option key={p.id} value={p.id}>{p.label}</option>)}</select><div className={styles.buttons}><button disabled={!ready} onClick={() => void commands.current.preview(FLARE_SPEC.id, true)}>Replay Flare Finish</button><button disabled={!ready} onClick={() => void commands.current.preview(finishPhrase, true)}>Xem Finish đã chọn</button></div><p className={styles.muted}>Flare mặc định trong Gameplay. Replay reset một phiên riêng: beat 4 → Flare nhiều vòng → đứng dậy → dance ở beat 24. Hai Finish cũ giữ recovery/idle V2.2.1.</p></section>
          <section className={styles.panel}><p className={styles.eyebrow}>CATALOG · {NORMAL_PHRASES.length} PHRASE</p><select aria-label="Phrase preview" value={previewPhrase} onChange={e => setPreviewPhrase(e.target.value)}>{NORMAL_PHRASES.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}</select><div className={styles.buttons}><button disabled={!ready} onClick={() => void commands.current.preview(previewPhrase, false)}>Xem phrase · reset phiên riêng</button></div><p className={styles.muted}>Sáu phrase V2.1 giữ nguyên; mười phrase mới chờ duyệt pose/contact. Không gán style hip-hop cho nguồn Unknown.</p></section>
          <section className={styles.panel}><p className={styles.eyebrow}>ĐỐI CHỨNG LỖI CŨ</p><label className={styles.control}>Cặp xác định <select aria-label="Cặp lỗi" value={pair} onChange={e => setPair(e.target.value)}>{FAILING_PAIRS.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}</select></label><div className={styles.buttons}><button disabled={!ready} onClick={() => void commands.current.replay(pair)}>Phát lại cặp</button><button disabled={!ready || view !== "source"} onClick={() => void commands.current.moonwalk()}>Thử Moonwalk</button></div><p className={styles.muted}>Fixture ballet/floor chỉ để QA; không nằm trong pool ngẫu nhiên.</p></section>
        </aside>
      </div>
      <section className={styles.measurements} aria-label="Đo không gian">
        {[["ROOT X / Z", view === "source" ? `${f(telemetry?.root[0])} / ${f(telemetry?.root[2])}` : "không đo Hips"], ["ANCHOR X / Z", view === "source" ? `${f(telemetry?.stageAnchor[0])} / ${f(telemetry?.stageAnchor[2])}` : telemetry?.referenceAnchor ? `${f(telemetry.referenceAnchor[0])} / ${f(telemetry.referenceAnchor[2])}` : "chưa tải"], ["ENTRY ΔXZ", view === "source" ? f(telemetry?.entryDisplacement) : "không áp dụng"], ["ĐỘ LỆCH TỪ ĐẦU", view === "source" ? f(telemetry?.cumulativeDisplacement) : "không áp dụng"], ["BÁN KÍNH LỚN NHẤT", view === "source" ? f(telemetry?.maxRadius) : "không áp dụng"], ["LOOP SEAM", view === "source" ? currentSpec?.id === FLARE_SPEC.id ? "Flare · pha liên tục" : currentSpec?.role === "idle" ? "Idle · seam đóng" : telemetry?.heldAtEnd ? "Giữ pose cuối" : "One-shot · không loop" : "controller gốc"]].map(([label, value]) => <div key={label}><small>{label}</small><strong>{value}</strong></div>)}
      </section>
      <section className={styles.panel}><div className={styles.historyHeader}><div><p className={styles.eyebrow}>LỊCH SỬ CHUYỂN</p><p className={styles.muted}>Seed {seed} · {telemetry?.transitionCount ?? 0} chuyển · {telemetry?.audioState ?? "chưa bắt đầu"}</p></div><div className={styles.buttons}><button disabled={!ready} onClick={() => commands.current.export()}>Xuất JSON</button><button disabled={!ready} onClick={() => commands.current.record()}>{recording ? "Dừng / tải video" : "Ghi video sân"}</button></div></div><div className={styles.history}>{history.map((row, i) => <div key={`${row.b}-${history.length - i}`}><b>{row.a ?? "Bắt đầu"} → {row.b}</b><span>{row.policy} · đợi {row.delayBeats.toFixed(2)} beat</span></div>)}</div></section>
      <p className={styles.status} role="status">{status}</p>{error && <p className={styles.error} role="alert">{error}</p>}
      <p className={styles.muted}>Flare: <a href="https://sketchfab.com/3d-models/kabal-flair-d001bbb3ba2b40909af9a71383afffdb" target="_blank" rel="noreferrer">Kabal_Flair — kehel</a> · <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noreferrer">CC BY 4.0</a>. Trích motion từ GLB chủ dự án gửi; đổi rig, sửa seam và thêm entry/dismount. Không dùng mesh Kabal, chưa duyệt production.</p><footer className={styles.footer}>{backend === "canvas2d-projection" && "WebGL bị vô hiệu hóa: đang dùng projection 2D để thử logic/telemetry, không tính WebGL hay mesh PASS. "}Tooling V2 · tempo CMU chưa được xác nhận âm nhạc · marker exit là ứng viên QA · chưa có nghiệm thu retarget CMU hoặc iPhone thật. Gauge này chỉ mô phỏng, không chỉnh gauge gameplay.</footer>
    </div>
  </main>;
}
