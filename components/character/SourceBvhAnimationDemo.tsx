"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { BVHLoader } from "three/examples/jsm/loaders/BVHLoader.js";

const CMU_SOURCE_PIN = "09a07f54f3bbb58797325f009282d0b2048a2871";
const CMU_RAW_BASE =
  "https://raw.githubusercontent.com/una-dinosauria/cmu-mocap/" + CMU_SOURCE_PIN + "/data";

type DemoRole = "normal" | "backup" | "finish";

type CuratedMotion = {
  id: string;
  title: string;
  genre: string;
  duration: number;
  fps: number;
  role: DemoRole;
  rank: number;
  retargetRisk: "Low" | "Low-Med" | "Med" | "Med-High" | "High" | "Very High";
};

const CURATED_MOTIONS: readonly CuratedMotion[] = [
  { id: "90_30", title: "Russian dance", genre: "Freestyle", duration: 11.93, fps: 120, role: "normal", rank: 1, retargetRisk: "High" },
  { id: "93_08", title: "xtra fancY charleston", genre: "Charleston", duration: 4.63, fps: 120, role: "normal", rank: 2, retargetRisk: "Med" },
  { id: "85_03", title: "UpRightSequence", genre: "Break", duration: 27.03, fps: 120, role: "normal", rank: 3, retargetRisk: "Med-High" },
  { id: "94_07", title: "Indian dance take 94_07", genre: "Indian", duration: 19.27, fps: 120, role: "normal", rank: 4, retargetRisk: "Med" },
  { id: "120_06", title: "Mickey Dance", genre: "Freestyle", duration: 11.93, fps: 120, role: "normal", rank: 5, retargetRisk: "Med" },
  { id: "05_07", title: "jetes / arabesque / pirouette", genre: "Modern / Ballet", duration: 9.92, fps: 120, role: "normal", rank: 6, retargetRisk: "High" },
  { id: "55_01", title: "dance, whirl", genre: "Freestyle", duration: 15.04, fps: 120, role: "normal", rank: 7, retargetRisk: "Med" },
  { id: "94_14", title: "Indian dance take 94_14", genre: "Indian", duration: 24.95, fps: 120, role: "normal", rank: 8, retargetRisk: "Med" },
  { id: "05_04", title: "sideways arabesque / back bend", genre: "Modern / Ballet", duration: 9.98, fps: 120, role: "normal", rank: 9, retargetRisk: "Med" },
  { id: "111_05", title: "Dance", genre: "Freestyle", duration: 7.71, fps: 120, role: "normal", rank: 10, retargetRisk: "Low-Med" },
  { id: "94_03", title: "Indian dance take 94_03", genre: "Indian", duration: 31.09, fps: 120, role: "normal", rank: 11, retargetRisk: "Med" },
  { id: "141_12", title: "Dance, Twist", genre: "Freestyle", duration: 4.72, fps: 120, role: "normal", rank: 12, retargetRisk: "Low-Med" },
  { id: "93_03", title: "charleston_01", genre: "Charleston", duration: 3.67, fps: 120, role: "normal", rank: 13, retargetRisk: "Low-Med" },
  { id: "94_13", title: "Indian dance take 94_13", genre: "Indian", duration: 16.62, fps: 120, role: "normal", rank: 14, retargetRisk: "Low-Med" },
  { id: "05_02", title: "expressive arms / pirouette", genre: "Modern / Ballet", duration: 9.35, fps: 120, role: "normal", rank: 15, retargetRisk: "Med-High" },
  { id: "143_35", title: "Macarena Dance", genre: "Freestyle", duration: 10.65, fps: 120, role: "normal", rank: 16, retargetRisk: "Low" },

  { id: "90_31", title: "Russian dance", genre: "Freestyle", duration: 8.15, fps: 120, role: "backup", rank: 1, retargetRisk: "High" },
  { id: "120_07", title: "Mickey Dance", genre: "Freestyle", duration: 9.27, fps: 120, role: "backup", rank: 2, retargetRisk: "Low-Med" },
  { id: "94_06", title: "Indian dance take 94_06", genre: "Indian", duration: 20.94, fps: 120, role: "backup", rank: 3, retargetRisk: "Low-Med" },
  { id: "05_12", title: "arms held high / upper body rotation", genre: "Modern / Ballet", duration: 11.28, fps: 120, role: "backup", rank: 4, retargetRisk: "Low" },
  { id: "113_04", title: "Dance", genre: "Freestyle", duration: 8.08, fps: 120, role: "backup", rank: 5, retargetRisk: "Low-Med" },

  { id: "85_05", title: "HandStandKicks", genre: "Break / Floor", duration: 13.61, fps: 120, role: "finish", rank: 1, retargetRisk: "High" },
  { id: "85_14", title: "BreakSequencewithFlips", genre: "Break / Floor", duration: 24.73, fps: 120, role: "finish", rank: 2, retargetRisk: "Very High" },
  { id: "85_08", title: "Helicopter", genre: "Break / Floor", duration: 8.46, fps: 120, role: "finish", rank: 3, retargetRisk: "Very High" },
  { id: "85_10", title: "EndofBreakDance", genre: "Break / Floor", duration: 6.44, fps: 120, role: "finish", rank: 4, retargetRisk: "High" },
  { id: "85_04", title: "FancyFootWork", genre: "Break / Floor", duration: 21.28, fps: 120, role: "finish", rank: 5, retargetRisk: "Very High" },
] as const;

function bvhUrl(id: string) {
  const subject = id.split("_")[0].padStart(3, "0");
  return CMU_RAW_BASE + "/" + subject + "/" + id + ".bvh";
}

function normalizeSourceSkeleton(group: THREE.Group, bones: readonly THREE.Bone[]) {
  group.updateMatrixWorld(true);
  const bounds = new THREE.Box3();
  const point = new THREE.Vector3();
  for (const bone of bones) {
    bone.getWorldPosition(point);
    bounds.expandByPoint(point);
  }

  if (bounds.isEmpty()) return;
  const size = bounds.getSize(new THREE.Vector3());
  const center = bounds.getCenter(new THREE.Vector3());
  const height = Math.max(size.y, 1);
  const scale = 1.45 / height;

  group.scale.setScalar(scale);
  group.position.set(-center.x * scale, -bounds.min.y * scale, -center.z * scale);
  group.updateMatrixWorld(true);
}

export function SourceBvhAnimationDemo() {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const sourceGroupRef = useRef<THREE.Group | null>(null);
  const helperRef = useRef<THREE.SkeletonHelper | null>(null);
  const mixerRef = useRef<THREE.AnimationMixer | null>(null);
  const actionRef = useRef<THREE.AnimationAction | null>(null);
  const animationRootRef = useRef<THREE.Object3D | null>(null);
  const playingRef = useRef(true);
  const speedRef = useRef(1);

  const [role, setRole] = useState<DemoRole>("normal");
  const [selectedId, setSelectedId] = useState("90_30");
  const [status, setStatus] = useState("Loading curated source motion…");
  const [playing, setPlaying] = useState(true);
  const [speed, setSpeed] = useState(1);

  const visibleMotions = useMemo(
    () => CURATED_MOTIONS.filter(motion => motion.role === role),
    [role],
  );
  const selectedMotion =
    CURATED_MOTIONS.find(motion => motion.id === selectedId) ?? CURATED_MOTIONS[0];

  const clearLoadedMotion = useCallback(() => {
    actionRef.current?.stop();
    if (mixerRef.current && animationRootRef.current) {
      mixerRef.current.stopAllAction();
      mixerRef.current.uncacheRoot(animationRootRef.current);
    }
    if (helperRef.current) {
      helperRef.current.removeFromParent();
      helperRef.current.dispose();
    }
    sourceGroupRef.current?.removeFromParent();
    actionRef.current = null;
    mixerRef.current = null;
    helperRef.current = null;
    sourceGroupRef.current = null;
    animationRootRef.current = null;
  }, []);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a0d14);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(35, 1, 0.01, 50);
    camera.position.set(1.75, 1.28, 2.45);

    const canvas = document.createElement("canvas");
    const context = canvas.getContext("webgl2") ?? canvas.getContext("webgl");
    if (!context) {
      setStatus("WebGL is unavailable on this device.");
      return;
    }

    const renderer = new THREE.WebGLRenderer({ canvas, context, antialias: true });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    host.appendChild(renderer.domElement);

    const floor = new THREE.Mesh(
      new THREE.CircleGeometry(1.12, 64),
      new THREE.MeshBasicMaterial({ color: 0x151b28 }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -0.005;
    scene.add(floor);

    const grid = new THREE.GridHelper(2.3, 18, 0x876be0, 0x283148);
    grid.position.y = 0.002;
    const gridMaterial = grid.material as THREE.Material;
    gridMaterial.transparent = true;
    gridMaterial.opacity = 0.3;
    scene.add(grid);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.enablePan = false;
    controls.target.set(0, 0.72, 0);
    controls.minDistance = 1.25;
    controls.maxDistance = 4.5;
    controlsRef.current = controls;

    const resize = () => {
      const width = Math.max(1, host.clientWidth);
      const height = Math.max(1, host.clientHeight);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height, false);
      renderer.domElement.style.width = width + "px";
      renderer.domElement.style.height = height + "px";
    };
    const observer = new ResizeObserver(resize);
    observer.observe(host);
    resize();

    const clock = new THREE.Clock();
    let raf = 0;
    const render = () => {
      raf = requestAnimationFrame(render);
      const delta = Math.min(clock.getDelta(), 0.05);
      const action = actionRef.current;
      if (action) {
        action.paused = !playingRef.current;
        action.setEffectiveTimeScale(speedRef.current);
      }
      mixerRef.current?.update(delta);
      helperRef.current?.updateMatrixWorld(true);
      controls.update();
      renderer.render(scene, camera);
    };
    render();

    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
      clearLoadedMotion();
      controls.dispose();
      controlsRef.current = null;
      grid.geometry.dispose();
      gridMaterial.dispose();
      floor.geometry.dispose();
      (floor.material as THREE.Material).dispose();
      renderer.dispose();
      if (renderer.domElement.parentElement === host) host.removeChild(renderer.domElement);
      sceneRef.current = null;
    };
  }, [clearLoadedMotion]);

  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;

    let cancelled = false;
    clearLoadedMotion();
    setStatus("Loading " + selectedMotion.id + " from pinned CMU source…");

    const loader = new BVHLoader();
    void loader.loadAsync(bvhUrl(selectedMotion.id)).then(result => {
      if (cancelled) return;

      const root = result.skeleton.bones[0];
      if (!root) throw new Error("BVH has no root bone");

      const group = new THREE.Group();
      group.name = "CuratedSourceBVH-" + selectedMotion.id;
      group.add(root);
      scene.add(group);

      const endFrame = Math.max(2, Math.round(result.clip.duration * selectedMotion.fps) + 1);
      const clip = THREE.AnimationUtils.subclip(
        result.clip,
        "Source-" + selectedMotion.id,
        1,
        endFrame,
        selectedMotion.fps,
      );
      const mixer = new THREE.AnimationMixer(root);
      const action = mixer.clipAction(clip);
      const oneShot = selectedMotion.role === "finish";
      action.reset();
      action.enabled = true;
      action.clampWhenFinished = oneShot;
      action.setLoop(oneShot ? THREE.LoopOnce : THREE.LoopRepeat, oneShot ? 1 : Infinity);
      action.setEffectiveWeight(1);
      action.setEffectiveTimeScale(speedRef.current);
      action.play();
      action.paused = !playingRef.current;
      mixer.update(0);

      normalizeSourceSkeleton(group, result.skeleton.bones);

      const helper = new THREE.SkeletonHelper(root);
      const helperMaterial = helper.material as THREE.LineBasicMaterial;
      helperMaterial.transparent = true;
      helperMaterial.opacity = 0.96;
      scene.add(helper);

      sourceGroupRef.current = group;
      helperRef.current = helper;
      mixerRef.current = mixer;
      actionRef.current = action;
      animationRootRef.current = root;

      setStatus(
        selectedMotion.id +
          " · " +
          selectedMotion.genre +
          " · " +
          selectedMotion.duration.toFixed(2) +
          "s · source skeleton only",
      );
    }).catch(error => {
      if (!cancelled) {
        setStatus("BVH load failed: " + (error instanceof Error ? error.message : "unknown error"));
      }
    });

    return () => {
      cancelled = true;
      clearLoadedMotion();
    };
  }, [clearLoadedMotion, selectedMotion]);

  useEffect(() => {
    playingRef.current = playing;
    speedRef.current = speed;
    const action = actionRef.current;
    if (action) {
      action.paused = !playing;
      action.setEffectiveTimeScale(speed);
    }
  }, [playing, speed]);

  const chooseRole = (nextRole: DemoRole) => {
    setRole(nextRole);
    const first = CURATED_MOTIONS.find(motion => motion.role === nextRole);
    if (first) setSelectedId(first.id);
    setPlaying(true);
    playingRef.current = true;
  };

  const restart = () => {
    const action = actionRef.current;
    if (!action) return;
    action.reset();
    action.enabled = true;
    action.setEffectiveWeight(1);
    action.setEffectiveTimeScale(speedRef.current);
    action.play();
    action.paused = !playingRef.current;
  };

  return (
    <section style={styles.card}>
      <div style={styles.headingRow}>
        <div>
          <p style={styles.eyebrow}>CURATED LIBRARY · SOURCE BVH DEMO</p>
          <h2 style={styles.title}>Visual curation selector</h2>
          <p style={styles.lead}>
            Preview the curated CMU source choreography directly. This is intentionally a source skeleton viewer:
            no Nam/Nữ retarget, no runtime publishing, and no gameplay integration.
          </p>
        </div>
        <span style={styles.badge}>SOURCE ONLY</span>
      </div>

      <div style={styles.segmented}>
        <button type="button" onClick={() => chooseRole("normal")} style={segmentStyle(role === "normal")}>
          Top 16
        </button>
        <button type="button" onClick={() => chooseRole("backup")} style={segmentStyle(role === "backup")}>
          Backup 5
        </button>
        <button type="button" onClick={() => chooseRole("finish")} style={segmentStyle(role === "finish")}>
          Finish 5
        </button>
      </div>

      <label style={styles.selectorLabel}>
        Animation
        <select value={selectedId} onChange={event => setSelectedId(event.target.value)} style={styles.select}>
          {visibleMotions.map(motion => (
            <option key={motion.id} value={motion.id}>
              #{motion.rank} · {motion.id} · {motion.title}
            </option>
          ))}
        </select>
      </label>

      <div style={styles.metaGrid}>
        <span><strong>{selectedMotion.genre}</strong><small>Genre</small></span>
        <span><strong>{selectedMotion.duration.toFixed(2)}s</strong><small>Duration</small></span>
        <span><strong>{selectedMotion.fps} fps</strong><small>Source</small></span>
        <span><strong>{selectedMotion.retargetRisk}</strong><small>Retarget risk</small></span>
      </div>

      <div ref={hostRef} style={styles.canvasHost} aria-label="Curated BVH source animation preview" />
      <div style={styles.status}>{status}</div>

      <div style={styles.controls}>
        <button type="button" onClick={() => setPlaying(value => !value)} style={styles.controlButton}>
          {playing ? "Ⅱ Pause" : "▶ Play"}
        </button>
        <button type="button" onClick={restart} style={styles.controlButton}>↺ Restart</button>
        <label style={styles.speedLabel}>
          Speed
          <select value={speed} onChange={event => setSpeed(Number(event.target.value))} style={styles.speedSelect}>
            <option value={0.5}>0.5×</option>
            <option value={0.75}>0.75×</option>
            <option value={1}>1×</option>
            <option value={1.25}>1.25×</option>
          </select>
        </label>
      </div>

      <p style={styles.note}>
        BVH is fetched from the immutable CMU mirror pin used by Acquisition V1. The converter reference T-pose
        sample is omitted for preview only. Finish candidates play once; Normal/Backup candidates loop. Animation
        duration never drives gameplay timing.
      </p>
    </section>
  );
}

const segmentStyle = (active: boolean): CSSProperties => ({
  flex: 1,
  border: active ? "1px solid #9e80ed" : "1px solid #343c4c",
  background: active ? "#2b2145" : "#171c26",
  color: active ? "#f2ebff" : "#aab3c3",
  borderRadius: 11,
  padding: "10px 9px",
  fontWeight: 900,
});

const styles: Record<string, CSSProperties> = {
  card: { display: "grid", gap: 10, padding: 11, border: "1px solid #3a3153", borderRadius: 15, background: "#12101b" },
  headingRow: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 },
  eyebrow: { margin: 0, color: "#b99af6", fontSize: 9, fontWeight: 950, letterSpacing: ".12em" },
  title: { margin: "4px 0 5px", fontSize: 18, lineHeight: 1.1 },
  lead: { margin: 0, color: "#929cad", fontSize: 11, lineHeight: 1.45 },
  badge: { flex: "0 0 auto", border: "1px solid #685983", background: "#241d32", color: "#ddcff8", borderRadius: 999, padding: "5px 8px", fontSize: 8, fontWeight: 950, letterSpacing: ".08em" },
  segmented: { display: "flex", gap: 7 },
  selectorLabel: { display: "grid", gap: 5, color: "#9da7b8", fontSize: 10, fontWeight: 850 },
  select: { width: "100%", minWidth: 0, border: "1px solid #45405a", background: "#171520", color: "#edf0f6", borderRadius: 10, padding: "11px 10px", fontWeight: 800 },
  metaGrid: { display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 6 },
  canvasHost: { width: "100%", height: "min(52vh, 460px)", minHeight: 320, overflow: "hidden", borderRadius: 12, background: "#0a0d14", touchAction: "none" },
  status: { minHeight: 16, padding: "0 3px", color: "#8f9aab", fontSize: 10 },
  controls: { display: "flex", gap: 7, alignItems: "center", flexWrap: "wrap" },
  controlButton: { border: "1px solid #3a4352", background: "#1a202a", color: "#d8deea", borderRadius: 10, padding: "10px 11px", fontWeight: 850 },
  speedLabel: { display: "flex", alignItems: "center", gap: 6, marginLeft: "auto", color: "#8f99aa", fontSize: 11, fontWeight: 800 },
  speedSelect: { border: "1px solid #3a4352", background: "#171c25", color: "#e1e6ef", borderRadius: 9, padding: "8px 9px", fontWeight: 800 },
  note: { margin: 0, padding: 9, borderRadius: 10, background: "#171521", color: "#8f94a7", fontSize: 10, lineHeight: 1.45 },
};

for (const value of Object.values(styles.metaGrid ? {} : {})) void value;
