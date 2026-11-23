"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import type { CharacterPresentationEvent } from "../../../components/character/character-types";
import type { CharacterAssetId } from "../../../components/character/character-catalog";
import type { M3GameplayRetargetReport } from "../../../components/character/m3-gameplay-retarget";
import type { M3GameplayQaActor } from "../../../components/character/M3GameplayQaActor";
import {
  captureM3GameplayQaReferencePose, frameM3GameplayQaCamera,
  measureM3QaSilhouette, deriveM3QaVisualFrame, fitM3QaVisualFrame,
  type M3GameplayQaReferencePose, type M3QaVisualFrame,
} from "../../../components/character/m3-gameplay-qa-framing";

type Rig = "m3-drophunter" | "m3-neurohacker";
const QA_ACTIONS = [
  ["dance-01", "Dance 01"], ["dance-02", "Dance 02"],
  ["dance-03", "Dance 03"], ["dance-04", "Dance 04"],
  ["dance-05", "Dance 05"], ["dance-06", "Dance 06"],
  ["dance-07", "Dance 07"], ["dance-08", "Dance 08"],
  ["miss", "Miss"], ["finish-special", "Finish L9"],
] as const;
type QaAction = (typeof QA_ACTIONS)[number][0];
const AUTO_QA_GAP_MS = 350; // Visual breathing room only; not a gameplay turn.
type AutoQaRun = { nextIndex: number; nextSongTimeMs: number };
const LOOKS = {
  "m3-drophunter": { hairStyle: "short", hairColor: "red",
    skinTone: "originalskin", m3Outfit: { top: "shirt", bottom: "casualshorts" } },
  "m3-neurohacker": { hairStyle: "hair1", hairColor: "yellow",
    skinTone: "originalskin", m3Outfit: { top: "simpleshirt", bottom: "shorts" } },
} as const;

export default function M3GameplayStep3Qa() {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const actorRef = useRef<M3GameplayQaActor | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);
  const clockOriginRef = useRef(0);
  const eventRef = useRef(0);
  const dispatchQaRef = useRef<((action: QaAction) => number | null) | null>(null);
  const autoRunRef = useRef<AutoQaRun | null>(null);
  const autoEnabledRef = useRef(false);
  const [rig, setRig] = useState<Rig>("m3-drophunter");
  const [ready, setReady] = useState(false);
  const [started, setStarted] = useState(false);
  const [report, setReport] = useState<M3GameplayRetargetReport | null>(null);
  const [choreographySource, setChoreographySource] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [current, setCurrent] = useState("Idle");
  const [songMs, setSongMs] = useState(0);
  const [autoPlayAll, setAutoPlayAll] = useState(false);
  const [autoRunning, setAutoRunning] = useState(false);
  const [autoStatus, setAutoStatus] = useState("");

  const stopAutoRun = () => {
    autoRunRef.current = null;
    setAutoRunning(false);
    setAutoStatus("");
  };
  const startAutoRun = () => {
    if (!ready || !ctxRef.current || ctxRef.current.state !== "running") return;
    // The first action starts at the next animation frame's current audio song time.
    autoRunRef.current = { nextIndex: 0, nextSongTimeMs: 0 };
    setAutoRunning(true);
    setAutoStatus("Chuẩn bị phát 10 động tác");
  };
  const toggleAutoPlay = (enabled: boolean) => {
    autoEnabledRef.current = enabled;
    setAutoPlayAll(enabled);
    if (!enabled) stopAutoRun();
    else if (started) startAutoRun();
  };

  // Preview clock ONLY. Gameplay uses frozen MatchManifest and WebAudio track
  // clock; this isolated route cannot issue Host START or modify room status.
  useEffect(() => {
    const element = mountRef.current;
    if (!element) return;
    let destroyed = false, raf = 0;
    autoRunRef.current = null;
    setAutoRunning(false); setAutoStatus("");
    setReady(false); setStarted(false); setReport(null);
    setChoreographySource(null); setError(""); setCurrent("Idle");
    void ctxRef.current?.close().catch(() => {});
    ctxRef.current = null;
    let actor: M3GameplayQaActor | null = null;
    let framingPose: M3GameplayQaReferencePose | null = null;
    let visualFrame: M3QaVisualFrame | null = null;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x13162f);
    const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
    camera.position.set(0, 3.7, 10.8);
    camera.lookAt(0, 1.8, 0);
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false,
      powerPreference: "high-performance" });
    renderer.setPixelRatio(Math.min(1.4, window.devicePixelRatio || 1));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.3;
    // setPixelRatio(1.4) + setSize(w, h, false) updates the canvas backing
    // attributes, but NOT its CSS dimensions. Without explicit CSS sizing,
    // Safari displays the backing dimensions as intrinsic CSS pixels (~1.4x
    // the host), so overflow:hidden cuts the right and bottom of the actor.
    // This exactly matches the owner's persistent ~134px rightward offset.
    const canvas = renderer.domElement;
    canvas.style.display = "block";
    canvas.style.width = "100%";
    canvas.style.height = "100%";
    element.appendChild(canvas);
    const hemi = new THREE.HemisphereLight(0xdce4ff, 0x29306d, 2.1);
    const key = new THREE.DirectionalLight(0xffefff, 3.8); key.position.set(4, 7, 6);
    const fill = new THREE.DirectionalLight(0x93e7ff, 2); fill.position.set(-5, 3, 3);
    scene.add(hemi, key, fill);
    const floorGeo = new THREE.CircleGeometry(5.7, 64);
    const floorMat = new THREE.MeshStandardMaterial({ color: 0x332764, roughness: 0.65 });
    const floor = new THREE.Mesh(floorGeo, floorMat); floor.rotation.x = -Math.PI / 2;
    floor.position.y = -0.012; scene.add(floor);
    const grid = new THREE.GridHelper(10, 10, 0x8d8ae9, 0x454463);
    scene.add(grid);

    function fitCamera() {
      if (!actor || !framingPose) return;
      const frame = frameM3GameplayQaCamera(actor.root, framingPose, camera, floor, grid);
      if (visualFrame) {
        fitM3QaVisualFrame(camera, visualFrame);
        // Floor contact is measured from the actual neutral shoe silhouette,
        // not from a possibly offset VRM toe pivot. Freeze for all actions.
        const shoeBottomY = visualFrame.center.y - visualFrame.height * 0.5;
        const soleGroundY = shoeBottomY - visualFrame.height * 0.012;
        floor.position.set(visualFrame.center.x, soleGroundY, visualFrame.center.z);
        grid.position.set(visualFrame.center.x, soleGroundY - visualFrame.height * 0.006,
          visualFrame.center.z);
      }
      element!.dataset.m3BindSpace = "native";
      element!.dataset.m3ActorScale = actor.root.scale.x.toFixed(4);
      element!.dataset.m3WorldHeight = frame.height.toFixed(4);
      element!.dataset.m3FloorY = frame.floorY.toFixed(4);
    }
    function calibrateRenderedSilhouette() {
      if (!actor || !framingPose) throw new Error("M3 QA silhouette actor not loaded");
      // The bone frame is only an initial coarse position. Back away before
      // measuring to avoid clipped feet biasing our rendered silhouette.
      const baseline = frameM3GameplayQaCamera(actor.root, framingPose, camera, floor, grid);
      camera.position.set(baseline.center.x, baseline.center.y, baseline.center.z + baseline.distance * 3);
      camera.lookAt(baseline.center);
      camera.updateMatrixWorld(true);

      const side = 192;
      const target = new THREE.WebGLRenderTarget(side, side, {
        format: THREE.RGBAFormat, type: THREE.UnsignedByteType,
        depthBuffer: true, stencilBuffer: false,
      });
      const pixels = new Uint8Array(side * side * 4);
      const originalTarget = renderer.getRenderTarget();
      const originalBackground = scene.background;
      const originalColor = renderer.getClearColor(new THREE.Color()).clone();
      const originalAlpha = renderer.getClearAlpha();
      const floorVisible = floor.visible;
      const gridVisible = grid.visible;
      try {
        // Read just visible M3 pixels, not floor/grid or the preview backdrop.
        // This avoids guessed skeleton/mesh offsets and does not touch rig.
        floor.visible = false;
        grid.visible = false;
        scene.background = null;
        renderer.setRenderTarget(target);
        renderer.setClearColor(0x000000, 0);
        renderer.clear(true, true, true);
        renderer.render(scene, camera);
        renderer.readRenderTargetPixels(target, 0, 0, side, side, pixels);
      } finally {
        renderer.setRenderTarget(originalTarget);
        renderer.setClearColor(originalColor, originalAlpha);
        floor.visible = floorVisible;
        grid.visible = gridVisible;
        scene.background = originalBackground;
        target.dispose();
      }
      let bounds = measureM3QaSilhouette(pixels, side, side);
      visualFrame = deriveM3QaVisualFrame(bounds, camera, baseline.center.z);
      fitCamera();

      // One corrective read at the fitted perspective removes residual
      // parallax from the deliberately distant first capture. Both reads
      // sample the same neutral pose, never a song-time action frame.
      const correctionTarget = new THREE.WebGLRenderTarget(side, side, {
        format: THREE.RGBAFormat, type: THREE.UnsignedByteType,
        depthBuffer: true, stencilBuffer: false,
      });
      const oldTarget = renderer.getRenderTarget();
      const oldBackground = scene.background;
      const oldColor = renderer.getClearColor(new THREE.Color()).clone();
      const oldAlpha = renderer.getClearAlpha();
      const oldFloorVisible = floor.visible, oldGridVisible = grid.visible;
      try {
        floor.visible = false;
        grid.visible = false;
        scene.background = null;
        renderer.setRenderTarget(correctionTarget);
        renderer.setClearColor(0x000000, 0);
        renderer.clear(true, true, true);
        renderer.render(scene, camera);
        renderer.readRenderTargetPixels(correctionTarget, 0, 0, side, side, pixels);
      } finally {
        renderer.setRenderTarget(oldTarget);
        renderer.setClearColor(oldColor, oldAlpha);
        floor.visible = oldFloorVisible;
        grid.visible = oldGridVisible;
        scene.background = oldBackground;
        correctionTarget.dispose();
      }
      bounds = measureM3QaSilhouette(pixels, side, side);
      if (bounds.left < .025 || bounds.right > .975 ||
          bounds.bottom < .025 || bounds.top > .975) {
        throw new Error("M3 QA silhouette still clipped after camera fit");
      }
      visualFrame = deriveM3QaVisualFrame(bounds, camera, baseline.center.z);
      fitCamera();
      element!.dataset.m3VisualFrame = "rendered-silhouette-v2";
      element!.dataset.m3VisualCenterX = visualFrame.center.x.toFixed(4);
      element!.dataset.m3VisualHeight = visualFrame.height.toFixed(4);
      element!.dataset.m3SilhouetteX = ((bounds.left + bounds.right) / 2).toFixed(4);
      element!.dataset.m3SilhouetteY = ((bounds.bottom + bounds.top) / 2).toFixed(4);
      // Safari resizing uses the calibrated neutral pixels, never dancing toes.
    }
    function resize() {
      const w = Math.max(1, element!.clientWidth), h = Math.max(1, element!.clientHeight);
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      // Mobile Safari can change the visual viewport after asset loading or
      // browser-bar collapse. Always re-fit the *camera*, never the M3 actor.
      fitCamera();
    }
    const observer = new ResizeObserver(resize); observer.observe(element);
    resize();
    // Every QA action uses the existing song-time presentation controller.
    // Report actual clip duration so the automatic review shows full clips.
    const dispatchQa = (choreography: QaAction): number | null => {
      const context = ctxRef.current;
      if (!actor || !context || context.state !== "running") return null;
      const songAt = Math.max(0, (context.currentTime - clockOriginRef.current) * 1000);
      const id = ++eventRef.current;
      const isFinish = choreography === "finish-special";
      const base = { eventId: id, absoluteTurn: id, level: isFinish ? 9 : 1,
        isFinish, actionStartSongTimeMs: songAt };
      const event: CharacterPresentationEvent = choreography === "miss"
        ? { ...base, kind: "fail", judgement: "miss" }
        : { ...base, kind: "dance", judgement: "perfect",
            choreographyId: choreography, presentationVariantKey: id };
      if (!actor.handlePresentationEvent(event)) {
        setError("Không áp dụng được clip " + choreography + "; kiểm tra asset retarget.");
        return null;
      }
      const duration = actor.getQaActiveClipDurationMs();
      if (!duration) {
        setError("Không lấy được thời lượng thực của clip " + choreography);
        return null;
      }
      setError("");
      setCurrent(choreography);
      return duration;
    };
    dispatchQaRef.current = dispatchQa;

    let previous = performance.now(), uiAt = 0;
    const tick = (now: number) => {
      if (destroyed) return;
      const delta = Math.min(0.1, Math.max(0, (now - previous) / 1000));
      previous = now;
      const context = ctxRef.current;
      const songTime = context && context.state === "running"
        ? Math.max(0, (context.currentTime - clockOriginRef.current) * 1000) : 0;
      const run = autoRunRef.current;
      if (run && context?.state === "running" && songTime >= run.nextSongTimeMs) {
        if (run.nextIndex < QA_ACTIONS.length) {
          const [action, label] = QA_ACTIONS[run.nextIndex];
          const durationMs = dispatchQa(action);
          if (durationMs === null) {
            autoRunRef.current = null;
            setAutoRunning(false);
            setAutoStatus("Auto QA dừng vì clip lỗi");
          } else {
            run.nextIndex++;
            run.nextSongTimeMs = songTime + durationMs + AUTO_QA_GAP_MS;
            setAutoStatus(run.nextIndex + "/10 · " + label);
          }
        } else {
          autoRunRef.current = null;
          setAutoRunning(false);
          setAutoStatus("Hoàn tất 10/10 · Có thể phát lại");
        }
      }
      actor?.update(delta, now / 1000, songTime);
      if (now - uiAt > 250) { uiAt = now; setSongMs(Math.round(songTime)); }
      renderer.render(scene, camera);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    void (async () => {
      try {
        const { M3GameplayQaActor } = await import("../../../components/character/M3GameplayQaActor");
        if (destroyed) return;
        actor = new M3GameplayQaActor(rig as CharacterAssetId, LOOKS[rig]);
        actorRef.current = actor;
        scene.add(actor.root);
        await actor.load();
        if (destroyed) return;
        // Freeze a single neutral-foot reference, even if Safari resizes
        // during Dance/Miss/Finish. A viewport change must never move ground.
        framingPose = captureM3GameplayQaReferencePose(actor.getQaFramingSkeleton());
        calibrateRenderedSilhouette();
        setReport(actor.report);
        setChoreographySource(actor.choreographySource);
        setReady(true);
      } catch (cause) {
        if (!destroyed) setError(cause instanceof Error ? cause.message : "M3 QA asset failed");
      }
    })();

    return () => {
      destroyed = true;
      cancelAnimationFrame(raf); observer.disconnect();
      actor?.dispose();
      autoRunRef.current = null;
      if (dispatchQaRef.current === dispatchQa) dispatchQaRef.current = null;
      if (actorRef.current === actor) actorRef.current = null;
      void ctxRef.current?.close().catch(() => {});
      ctxRef.current = null;
      floorGeo.dispose(); floorMat.dispose();
      renderer.dispose(); renderer.forceContextLoss();
      if (renderer.domElement.parentElement === element) element.removeChild(renderer.domElement);
      scene.clear();
    };
  }, [rig]);

  const begin = async () => {
    if (!ready || started) return;
    try {
      const context = new AudioContext();
      await context.resume();
      clockOriginRef.current = context.currentTime;
      ctxRef.current = context;
      actorRef.current?.setGameActive(true);
      setStarted(true);
      if (autoEnabledRef.current) {
        autoRunRef.current = { nextIndex: 0, nextSongTimeMs: 0 };
        setAutoRunning(true);
        setAutoStatus("Chuẩn bị phát 10 động tác");
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "AudioContext unavailable");
    }
  };
  const trigger = (choreography: QaAction) => {
    const actor = actorRef.current, context = ctxRef.current;
    if (!ready || !started || !actor || !context) return;
    const songAt = Math.max(0, (context.currentTime - clockOriginRef.current) * 1000);
    const id = ++eventRef.current;
    const isFinish = choreography === "finish-special";
    const base = { eventId: id, absoluteTurn: id, level: isFinish ? 9 : 1,
      isFinish, actionStartSongTimeMs: songAt };
    const event: CharacterPresentationEvent = choreography === "miss"
      ? { ...base, kind: "fail", judgement: "miss" }
      : { ...base, kind: "dance", judgement: "perfect",
          choreographyId: choreography, presentationVariantKey: id };
    if (!actor.handlePresentationEvent(event)) {
      setError("Không áp dụng được clip " + choreography + "; kiểm tra asset retarget.");
      return;
    }
    setError("");
    setCurrent(choreography);
  };

  return (
    <main style={{ background: "#0e1129", color: "#f5f1ff", minHeight: "100dvh",
      padding: "20px 12px", fontFamily: "system-ui,sans-serif" }}>
      <div style={{ maxWidth: 650, margin: "auto", display: "grid", gap: 12 }}>
        <a href="/rooms" style={{ color: "#bde9ff" }}>← Room Browser</a>
        <h1 style={{ fontSize: 24, margin: 0 }}>M3 Gameplay · Step 3 QA</h1>
        <p style={{ fontSize: 13, lineHeight: 1.5, margin: 0 }}>
          Kiểm tra đủ Dance 01–08, Miss và Finish trên model M3 thật. Đồng hồ của màn
          thử nghiệm lấy từ AudioContext; <strong>không phải gameplay trận đấu</strong>.
          START M3 vẫn khóa, chưa có đánh giá foot contact hoặc Finish trên iPhone.
        </p>
        <section data-testid="m3-gameplay-sticky" style={{
          position: "sticky", top: "env(safe-area-inset-top, 0px)", zIndex: 10,
          display: "grid", gap: 10, padding: "6px 0 10px",
          background: "#0e1129",
        }}>
        <div role="group" aria-label="Chọn rig M3" style={{ display: "flex", gap: 8 }}>
          {(["m3-drophunter", "m3-neurohacker"] as const).map(id => (
            <button key={id} type="button" aria-pressed={rig === id}
              onClick={() => setRig(id)} style={{
                flex: 1, minHeight: 46, borderRadius: 9, fontWeight: 700,
                border: rig === id ? "2px solid #f6c9ff" : "1px solid #776baa",
                background: rig === id ? "#633fa5" : "#2b2b57", color: "#fff",
              }}>{id === "m3-drophunter" ? "Nữ · Drophunter" : "Nam · Neurohacker"}</button>
          ))}
        </div>
        <div ref={mountRef} data-testid="m3-gameplay-preview" style={{
          width: "100%", height: "clamp(230px, 40dvh, 440px)",
          overflow: "hidden", borderRadius: 14, border: "1px solid #6661a5",
        }}/>
        <div role="status" data-testid="m3-gameplay-status" style={{
          fontSize: 13, padding: 8, borderRadius: 9, background: "#29264c",
        }}>
          {error ? "LỖI: " + error : !ready ? "Đang tải rig và retarget animation…" :
            !started ? "Đã tải xong; hãy khởi động AudioContext thử nghiệm." :
              "AudioContext " + songMs + " ms · " + current}
        </div>
        </section>
        {error && <p role="alert">{error}</p>}
        <button type="button" disabled={!ready || started} onClick={() => void begin()}
          style={{ background: "#7752c4", color: "#fff", minHeight: 45, borderRadius: 9,
            fontWeight: 800, opacity: ready && !started ? 1 : 0.5 }}>
          START QA AUDIOCONTEXT (không START phòng)
        </button>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2,minmax(0,1fr))", gap: 9 }}>
          {QA_ACTIONS.map(([id, title]) => (
            <button key={id} type="button" disabled={!ready || !started}
              onClick={() => trigger(id)} style={{
                background: id === "finish-special" ? "#9c3549" : "#3b4e93",
                color: "#fff", border: "1px solid #7f8ee5", minHeight: 46,
                borderRadius: 9, opacity: ready && started ? 1 : 0.5,
              }}>{title}</button>
          ))}
        </div>
        {report && <div style={{ fontSize: 12, lineHeight: 1.65, background: "#242344",
          borderRadius: 10, padding: 14 }}>
          <div><b>Animation source:</b> {choreographySource ?? "unknown"}</div>
          <b>Retarget:</b> {report.clipCount} clips · {report.boneTrackCount} bone tracks
          · {report.fps} FPS
          <div>Clip names: {report.clips.map(x => x.name).join(", ")}</div>
        </div>}
        <p style={{ fontSize: 12, lineHeight: 1.6, color: "#c9c0ec" }}>
          Nghiệm thu còn mở: pose/feet sliding, self-intersection, Freeze/REST,
          Finish continuous motion, 5 người, performance Safari và đồng bộ
          WebAudio thật. Route chỉ phục vụ kiểm tra visual adapter.
        </p>
      </div>
    </main>
  );
}
