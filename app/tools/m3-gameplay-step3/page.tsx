"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import type { CharacterPresentationEvent } from "../../../components/character/character-types";
import type { CharacterAssetId } from "../../../components/character/character-catalog";
import type { M3GameplayRetargetReport } from "../../../components/character/m3-gameplay-retarget";
import type { M3GameplayQaActor } from "../../../components/character/M3GameplayQaActor";

type Rig = "m3-drophunter" | "m3-neurohacker";
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
  const [rig, setRig] = useState<Rig>("m3-drophunter");
  const [ready, setReady] = useState(false);
  const [started, setStarted] = useState(false);
  const [report, setReport] = useState<M3GameplayRetargetReport | null>(null);
  const [choreographySource, setChoreographySource] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [current, setCurrent] = useState("Idle");
  const [songMs, setSongMs] = useState(0);

  // Preview clock ONLY. Gameplay uses frozen MatchManifest and WebAudio track
  // clock; this isolated route cannot issue Host START or modify room status.
  useEffect(() => {
    const element = mountRef.current;
    if (!element) return;
    let destroyed = false, raf = 0;
    setReady(false); setStarted(false); setReport(null);
    setChoreographySource(null); setError(""); setCurrent("Idle");
    void ctxRef.current?.close().catch(() => {});
    ctxRef.current = null;
    let actor: M3GameplayQaActor | null = null;

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
    element.appendChild(renderer.domElement);
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

    function resize() {
      const w = Math.max(1, element!.clientWidth), h = Math.max(1, element!.clientHeight);
      renderer.setSize(w, h, false);
      camera.aspect = w / h; camera.updateProjectionMatrix();
    }
    const observer = new ResizeObserver(resize); observer.observe(element);
    resize();
    let previous = performance.now(), uiAt = 0;
    const tick = (now: number) => {
      if (destroyed) return;
      const delta = Math.min(0.1, Math.max(0, (now - previous) / 1000));
      previous = now;
      const context = ctxRef.current;
      const songTime = context && context.state === "running"
        ? Math.max(0, (context.currentTime - clockOriginRef.current) * 1000) : 0;
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
        // Character Creator's accepted M3 rule: the assembled VRM and ALL
        // ancestors remain in original native bind space. ONLY camera and
        // stage decorations are allowed to move or scale.
        actor.root.updateMatrixWorld(true);
        const bounds = new THREE.Box3().setFromObject(actor.root);
        const center = bounds.getCenter(new THREE.Vector3());
        const size = bounds.getSize(new THREE.Vector3());
        if (!Number.isFinite(size.y) || size.y <= 0 ||
            !Number.isFinite(size.x) || !Number.isFinite(size.z)) {
          throw Error("Cannot frame M3 avatar: invalid bounds");
        }
        const verticalFov = THREE.MathUtils.degToRad(camera.fov);
        // Fit width in portrait and preserve head/feet with margin, without
        // modifying the detached SkinnedMesh hierarchy.
        const framedHeight = Math.max(size.y, size.x / Math.max(camera.aspect, 0.1));
        const distance = framedHeight / (2 * Math.tan(verticalFov / 2)) * 1.42;
        camera.position.set(center.x, center.y + size.y * 0.04, center.z + distance);
        camera.lookAt(center);
        camera.near = Math.max(0.001, size.y * 0.005);
        camera.far = Math.max(100, size.y * 100);
        camera.updateProjectionMatrix();
        // Decorations are independent of the actor skeleton and safe to move.
        const floorRatio = size.y / 4.0;
        floor.scale.setScalar(floorRatio);
        floor.position.set(center.x, bounds.min.y - size.y * 0.005, center.z);
        grid.scale.setScalar(floorRatio);
        grid.position.set(center.x, bounds.min.y - size.y * 0.01, center.z);
        element.dataset.m3BindSpace = "native";
        element.dataset.m3ActorScale = actor.root.scale.x.toFixed(4);
        element.dataset.m3WorldHeight = size.y.toFixed(4);
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
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "AudioContext unavailable");
    }
  };
  const trigger = (choreography: "dance-01" | "dance-08" | "finish-special" | "miss") => {
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
    actor.handlePresentationEvent(event);
    setCurrent(choreography);
  };

  return (
    <main style={{ background: "#0e1129", color: "#f5f1ff", minHeight: "100dvh",
      padding: "20px 12px", fontFamily: "system-ui,sans-serif" }}>
      <div style={{ maxWidth: 650, margin: "auto", display: "grid", gap: 12 }}>
        <a href="/rooms" style={{ color: "#bde9ff" }}>← Room Browser</a>
        <h1 style={{ fontSize: 24, margin: 0 }}>M3 Gameplay · Step 3 QA</h1>
        <p style={{ fontSize: 13, lineHeight: 1.5, margin: 0 }}>
          Thử retarget Dance/Miss/Finish trên model M3 thật. Đồng hồ của màn
          thử nghiệm lấy từ AudioContext; <strong>không phải gameplay trận đấu</strong>.
          START M3 vẫn khóa, chưa có đánh giá foot contact hoặc Finish trên iPhone.
        </p>
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
          width: "100%", aspectRatio: "3 / 4", maxHeight: "66dvh", minHeight: 280,
          overflow: "hidden", borderRadius: 14, border: "1px solid #6661a5",
        }}/>
        <div role="status" data-testid="m3-gameplay-status" style={{
          fontSize: 13, padding: 10, borderRadius: 9, background: "#29264c",
        }}>
          {error ? "LỖI: " + error : !ready ? "Đang tải rig và retarget animation…" :
            !started ? "Đã tải xong; hãy khởi động AudioContext thử nghiệm." :
              "AudioContext " + songMs + " ms · " + current}
        </div>
        {error && <p role="alert">{error}</p>}
        <button type="button" disabled={!ready || started} onClick={() => void begin()}
          style={{ background: "#7752c4", color: "#fff", minHeight: 45, borderRadius: 9,
            fontWeight: 800, opacity: ready && !started ? 1 : 0.5 }}>
          START QA AUDIOCONTEXT (không START phòng)
        </button>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2,minmax(0,1fr))", gap: 9 }}>
          {([
            ["dance-01", "Dance 01"], ["dance-08", "Dance 08"],
            ["miss", "Miss"], ["finish-special", "Finish L9"],
          ] as const).map(([id, title]) => (
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
