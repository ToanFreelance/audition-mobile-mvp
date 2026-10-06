"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { BVHLoader } from "three/examples/jsm/loaders/BVHLoader.js";

type DemoRole = "normal" | "backup" | "finish" | "utility" | "partner" | "explore";
type StyleId =
  | "pop_casual"
  | "social_swing"
  | "modern_stage"
  | "world_folk"
  | "street_break"
  | "party_reaction";
type StyleFilter = "all" | StyleId;
type RoleFilter = "all" | DemoRole;

type CuratedMotion = {
  id: string;
  title: string;
  genre: string;
  duration: number;
  fps: number;
  role: DemoRole;
  rank: number;
  style: StyleId;
  tier: "A" | "B" | "SPECIAL" | "UTILITY" | "EXPLORE";
  retargetRisk: "Low" | "Low-Med" | "Med" | "Med-High" | "High" | "Very High";
  modeHints: readonly string[];
  partnerDependent?: boolean;
};

const STYLE_LABELS: Record<StyleId, string> = {
  pop_casual: "Pop / Casual",
  social_swing: "Khiêu vũ / Social",
  modern_stage: "Modern / Stage",
  world_folk: "World / Folk",
  street_break: "Street / Break",
  party_reaction: "Party / Reaction",
};

const ROLE_LABELS: Record<DemoRole, string> = {
  normal: "Normal A",
  backup: "Backup",
  finish: "Finish / Special",
  utility: "Utility",
  partner: "Partner-dependent",
  explore: "Explore V2",
};

const CURATED_MOTIONS: readonly CuratedMotion[] = [
  { id: "90_30", title: "Russian dance", genre: "Freestyle / folk", duration: 11.93, fps: 120, role: "normal", rank: 1, style: "world_folk", tier: "A", retargetRisk: "High", modeHints: ["boss", "world", "performance"] },
  { id: "93_08", title: "xtra fancY charleston", genre: "Charleston", duration: 4.63, fps: 120, role: "normal", rank: 2, style: "social_swing", tier: "A", retargetRisk: "Med", modeHints: ["social", "retro", "party"] },
  { id: "85_03", title: "UpRightSequence", genre: "Break", duration: 27.03, fps: 120, role: "normal", rank: 3, style: "street_break", tier: "A", retargetRisk: "Med-High", modeHints: ["boss", "battle", "performance"] },
  { id: "94_07", title: "Indian dance take 94_07", genre: "Indian", duration: 19.27, fps: 120, role: "normal", rank: 4, style: "world_folk", tier: "A", retargetRisk: "Med", modeHints: ["world", "performance"] },
  { id: "120_06", title: "Mickey Dance", genre: "Freestyle", duration: 11.93, fps: 120, role: "normal", rank: 5, style: "pop_casual", tier: "A", retargetRisk: "Med", modeHints: ["pop", "casual", "party"] },
  { id: "05_07", title: "jetes / arabesque / pirouette", genre: "Modern / Ballet", duration: 9.92, fps: 120, role: "normal", rank: 6, style: "modern_stage", tier: "A", retargetRisk: "High", modeHints: ["modern", "boss", "performance"] },
  { id: "55_01", title: "dance, whirl", genre: "Freestyle", duration: 15.04, fps: 120, role: "normal", rank: 7, style: "pop_casual", tier: "A", retargetRisk: "Med", modeHints: ["pop", "party", "performance"] },
  { id: "94_14", title: "Indian dance take 94_14", genre: "Indian", duration: 24.95, fps: 120, role: "normal", rank: 8, style: "world_folk", tier: "A", retargetRisk: "Med", modeHints: ["world", "performance"] },
  { id: "05_04", title: "sideways arabesque / back bend", genre: "Modern / Ballet", duration: 9.98, fps: 120, role: "normal", rank: 9, style: "modern_stage", tier: "A", retargetRisk: "Med", modeHints: ["modern", "stage"] },
  { id: "111_05", title: "Dance", genre: "Freestyle", duration: 7.71, fps: 120, role: "normal", rank: 10, style: "pop_casual", tier: "A", retargetRisk: "Low-Med", modeHints: ["pop", "casual"] },
  { id: "94_03", title: "Indian dance take 94_03", genre: "Indian", duration: 31.09, fps: 120, role: "normal", rank: 11, style: "world_folk", tier: "A", retargetRisk: "Med", modeHints: ["world", "stage"] },
  { id: "141_12", title: "Dance, Twist", genre: "Freestyle", duration: 4.72, fps: 120, role: "normal", rank: 12, style: "pop_casual", tier: "A", retargetRisk: "Low-Med", modeHints: ["pop", "retro", "casual"] },
  { id: "93_03", title: "charleston_01", genre: "Charleston", duration: 3.67, fps: 120, role: "normal", rank: 13, style: "social_swing", tier: "A", retargetRisk: "Low-Med", modeHints: ["social", "retro"] },
  { id: "94_13", title: "Indian dance take 94_13", genre: "Indian", duration: 16.62, fps: 120, role: "normal", rank: 14, style: "world_folk", tier: "A", retargetRisk: "Low-Med", modeHints: ["world", "casual"] },
  { id: "05_02", title: "expressive arms / pirouette", genre: "Modern / Ballet", duration: 9.35, fps: 120, role: "normal", rank: 15, style: "modern_stage", tier: "A", retargetRisk: "Med-High", modeHints: ["modern", "stage"] },
  { id: "143_35", title: "Macarena Dance", genre: "Freestyle / novelty", duration: 10.65, fps: 120, role: "normal", rank: 16, style: "party_reaction", tier: "A", retargetRisk: "Low", modeHints: ["pop", "party", "event"] },

  { id: "90_31", title: "Russian dance", genre: "Freestyle / folk", duration: 8.15, fps: 120, role: "backup", rank: 1, style: "world_folk", tier: "B", retargetRisk: "High", modeHints: ["boss", "world"] },
  { id: "120_07", title: "Mickey Dance", genre: "Freestyle", duration: 9.27, fps: 120, role: "backup", rank: 2, style: "pop_casual", tier: "B", retargetRisk: "Low-Med", modeHints: ["pop", "casual"] },
  { id: "94_06", title: "Indian dance take 94_06", genre: "Indian", duration: 20.94, fps: 120, role: "backup", rank: 3, style: "world_folk", tier: "B", retargetRisk: "Low-Med", modeHints: ["world", "casual"] },
  { id: "05_12", title: "arms held high / upper body rotation", genre: "Modern / Ballet", duration: 11.28, fps: 120, role: "backup", rank: 4, style: "modern_stage", tier: "B", retargetRisk: "Low", modeHints: ["relaxed", "modern", "stage"] },
  { id: "113_04", title: "Dance", genre: "Freestyle", duration: 8.08, fps: 120, role: "backup", rank: 5, style: "pop_casual", tier: "B", retargetRisk: "Low-Med", modeHints: ["pop", "casual"] },

  { id: "85_05", title: "HandStandKicks", genre: "Break / Floor", duration: 13.61, fps: 120, role: "finish", rank: 1, style: "street_break", tier: "SPECIAL", retargetRisk: "High", modeHints: ["finish", "boss", "battle"] },
  { id: "85_14", title: "BreakSequencewithFlips", genre: "Break / Floor", duration: 24.73, fps: 120, role: "finish", rank: 2, style: "street_break", tier: "SPECIAL", retargetRisk: "Very High", modeHints: ["finish", "boss", "battle"] },
  { id: "85_08", title: "Helicopter", genre: "Break / Floor", duration: 8.46, fps: 120, role: "finish", rank: 3, style: "street_break", tier: "SPECIAL", retargetRisk: "Very High", modeHints: ["finish", "boss"] },
  { id: "85_10", title: "EndofBreakDance", genre: "Break / Floor", duration: 6.44, fps: 120, role: "finish", rank: 4, style: "street_break", tier: "SPECIAL", retargetRisk: "High", modeHints: ["finish", "battle"] },
  { id: "85_04", title: "FancyFootWork", genre: "Break / Floor", duration: 21.28, fps: 120, role: "finish", rank: 5, style: "street_break", tier: "SPECIAL", retargetRisk: "Very High", modeHints: ["finish", "boss"] },

  { id: "143_34", title: "Chicken Dance", genre: "Novelty", duration: 6.52, fps: 120, role: "utility", rank: 1, style: "party_reaction", tier: "UTILITY", retargetRisk: "Low-Med", modeHints: ["party", "waiting-room", "reaction"] },
  { id: "55_12", title: "Dancing Bear", genre: "Novelty", duration: 17.28, fps: 120, role: "utility", rank: 2, style: "party_reaction", tier: "UTILITY", retargetRisk: "Med", modeHints: ["party", "waiting-room", "reaction"] },
  { id: "55_25", title: "Dancing Animal", genre: "Novelty", duration: 26.56, fps: 120, role: "utility", rank: 3, style: "party_reaction", tier: "UTILITY", retargetRisk: "Med-High", modeHints: ["party", "reaction", "celebration"] },
  { id: "55_02", title: "Lambada Dance", genre: "Latin / freestyle", duration: 18.16, fps: 120, role: "utility", rank: 4, style: "social_swing", tier: "UTILITY", retargetRisk: "Med", modeHints: ["social", "latin", "waiting-room"] },

  { id: "60_01", title: "Salsa take 60_01", genre: "Salsa", duration: 18.68, fps: 120, role: "partner", rank: 1, style: "social_swing", tier: "EXPLORE", retargetRisk: "High", modeHints: ["social", "latin", "duet"], partnerDependent: true },
  { id: "60_03", title: "Salsa take 60_03", genre: "Salsa", duration: 15.24, fps: 120, role: "partner", rank: 2, style: "social_swing", tier: "EXPLORE", retargetRisk: "Med-High", modeHints: ["social", "latin", "duet"], partnerDependent: true },
  { id: "60_05", title: "Salsa take 60_05", genre: "Salsa", duration: 13.98, fps: 120, role: "partner", rank: 3, style: "social_swing", tier: "EXPLORE", retargetRisk: "Med", modeHints: ["social", "latin", "duet"], partnerDependent: true },
  { id: "61_05", title: "Salsa take 61_05", genre: "Salsa", duration: 13.98, fps: 120, role: "partner", rank: 4, style: "social_swing", tier: "EXPLORE", retargetRisk: "High", modeHints: ["social", "latin", "duet"], partnerDependent: true },
  { id: "93_04", title: "Charleston side-by-side female", genre: "Charleston", duration: 4.21, fps: 120, role: "partner", rank: 5, style: "social_swing", tier: "EXPLORE", retargetRisk: "Med", modeHints: ["social", "retro", "duet"], partnerDependent: true },
  { id: "93_05", title: "Charleston side-by-side male", genre: "Charleston", duration: 4.54, fps: 120, role: "partner", rank: 6, style: "social_swing", tier: "EXPLORE", retargetRisk: "Med", modeHints: ["social", "retro", "duet"], partnerDependent: true },
  { id: "93_06", title: "Lindy Hop", genre: "Lindy", duration: 3.34, fps: 120, role: "partner", rank: 7, style: "social_swing", tier: "EXPLORE", retargetRisk: "High", modeHints: ["social", "swing", "duet"], partnerDependent: true },

  { id: "120_05", title: "Mickey Dance", genre: "Freestyle", duration: 11.27, fps: 120, role: "explore", rank: 1, style: "pop_casual", tier: "EXPLORE", retargetRisk: "Low-Med", modeHints: ["pop", "casual"] },
  { id: "94_16", title: "Indian dance take 94_16", genre: "Indian", duration: 16.92, fps: 120, role: "explore", rank: 2, style: "world_folk", tier: "EXPLORE", retargetRisk: "Low-Med", modeHints: ["world", "casual"] },
  { id: "94_09", title: "Indian dance take 94_09", genre: "Indian", duration: 33.11, fps: 120, role: "explore", rank: 3, style: "world_folk", tier: "EXPLORE", retargetRisk: "Med", modeHints: ["world", "stage"] },
  { id: "94_05", title: "Indian dance take 94_05", genre: "Indian", duration: 43.93, fps: 120, role: "explore", rank: 4, style: "world_folk", tier: "EXPLORE", retargetRisk: "Med", modeHints: ["world", "stage"] },
  { id: "85_11", title: "UpRightSequence", genre: "Break", duration: 15.01, fps: 120, role: "explore", rank: 5, style: "street_break", tier: "EXPLORE", retargetRisk: "Med-High", modeHints: ["boss", "battle"] },
  { id: "85_12", title: "LongSequenceGood", genre: "Break / Floor", duration: 37.48, fps: 120, role: "explore", rank: 6, style: "street_break", tier: "EXPLORE", retargetRisk: "Very High", modeHints: ["boss", "battle", "special"] },
  { id: "05_06", title: "cartwheel-like start / pirouettes / jete", genre: "Modern / Ballet", duration: 7.37, fps: 120, role: "explore", rank: 7, style: "modern_stage", tier: "EXPLORE", retargetRisk: "Very High", modeHints: ["modern", "boss", "performance"] },
  { id: "05_13", title: "small jetes / pirouette", genre: "Modern / Ballet", duration: 9.12, fps: 120, role: "explore", rank: 8, style: "modern_stage", tier: "EXPLORE", retargetRisk: "High", modeHints: ["modern", "stage"] },
] as const;

function bvhUrl(id: string) {
  return "/api/curated-animation-source/" + encodeURIComponent(id);
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

  const [styleFilter, setStyleFilter] = useState<StyleFilter>("all");
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("all");
  const [selectedId, setSelectedId] = useState("90_30");
  const [status, setStatus] = useState("Loading curated source motion…");
  const [playing, setPlaying] = useState(true);
  const [speed, setSpeed] = useState(1);

  const visibleMotions = useMemo(
    () => CURATED_MOTIONS.filter(motion =>
      (styleFilter === "all" || motion.style === styleFilter) &&
      (roleFilter === "all" || motion.role === roleFilter),
    ),
    [roleFilter, styleFilter],
  );

  const selectedMotion =
    CURATED_MOTIONS.find(motion => motion.id === selectedId) ?? CURATED_MOTIONS[0];

  useEffect(() => {
    if (visibleMotions.some(motion => motion.id === selectedId)) return;
    if (visibleMotions[0]) setSelectedId(visibleMotions[0].id);
  }, [selectedId, visibleMotions]);

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
          STYLE_LABELS[selectedMotion.style] +
          " · " +
          selectedMotion.duration.toFixed(2) +
          "s · " +
          (selectedMotion.partnerDependent ? "PARTNER DEPENDENT · " : "") +
          "source skeleton only",
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
    <section id="source-animation-demo" style={styles.card}>
      <div style={styles.headingRow}>
        <div>
          <p style={styles.eyebrow}>ANIMATION LIBRARY · STYLE CATALOG</p>
          <h2 style={styles.title}>Source animation demo — 45 motions</h2>
          <p style={styles.lead}>
            Group source choreography by reusable dance style instead of hard-wiring motions to one game mode.
            Mode hints are metadata only: no Nam/Nữ retarget, runtime publishing or gameplay integration.
          </p>
        </div>
        <span style={styles.badge}>SOURCE ONLY</span>
      </div>

      <div>
        <p style={styles.sectionLabel}>STYLE</p>
        <div style={styles.styleGrid}>
          <button type="button" onClick={() => setStyleFilter("all")} style={styleButton(styleFilter === "all")}>
            Tất cả · {CURATED_MOTIONS.length}
          </button>
          {(Object.keys(STYLE_LABELS) as StyleId[]).map(style => {
            const count = CURATED_MOTIONS.filter(motion => motion.style === style).length;
            return (
              <button key={style} type="button" onClick={() => setStyleFilter(style)} style={styleButton(styleFilter === style)}>
                {STYLE_LABELS[style]} · {count}
              </button>
            );
          })}
        </div>
      </div>

      <div style={styles.filterRow}>
        <label style={styles.selectorLabel}>
          Pool / trạng thái
          <select value={roleFilter} onChange={event => setRoleFilter(event.target.value as RoleFilter)} style={styles.select}>
            <option value="all">Tất cả pool</option>
            {(Object.keys(ROLE_LABELS) as DemoRole[]).map(role => (
              <option key={role} value={role}>{ROLE_LABELS[role]}</option>
            ))}
          </select>
        </label>

        <label style={styles.selectorLabel}>
          Animation · {visibleMotions.length} kết quả
          <select value={selectedId} onChange={event => setSelectedId(event.target.value)} style={styles.select}>
            {visibleMotions.map(motion => (
              <option key={motion.id} value={motion.id}>
                {motion.id} · {motion.title}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div style={styles.metaGrid}>
        <span style={styles.metaCell}><strong style={styles.metaValue}>{STYLE_LABELS[selectedMotion.style]}</strong><small style={styles.metaLabel}>Style</small></span>
        <span style={styles.metaCell}><strong style={styles.metaValue}>{selectedMotion.tier} · {ROLE_LABELS[selectedMotion.role]}</strong><small style={styles.metaLabel}>Pool</small></span>
        <span style={styles.metaCell}><strong style={styles.metaValue}>{selectedMotion.genre}</strong><small style={styles.metaLabel}>Genre</small></span>
        <span style={styles.metaCell}><strong style={styles.metaValue}>{selectedMotion.duration.toFixed(2)}s · {selectedMotion.fps}fps</strong><small style={styles.metaLabel}>Source</small></span>
        <span style={styles.metaCell}><strong style={styles.metaValue}>{selectedMotion.retargetRisk}</strong><small style={styles.metaLabel}>Retarget risk</small></span>
        <span style={styles.metaCell}><strong style={styles.metaValue}>{selectedMotion.modeHints.join(" · ")}</strong><small style={styles.metaLabel}>Mode hints</small></span>
      </div>

      {selectedMotion.partnerDependent ? (
        <div style={styles.partnerWarning}>
          PARTNER_DEPENDENT — source này có choreography giả định performer thứ hai. Chỉ xem để đánh giá mode khiêu vũ/duet; không đưa vào solo Normal.
        </div>
      ) : null}

      {selectedMotion.role === "explore" ? (
        <div style={styles.exploreWarning}>
          EXPLORE V2 — motion đã có source preview/contact evidence nhưng chưa được nâng lên curated A/B. Dùng để mở rộng style pool, chưa phải retarget acceptance.
        </div>
      ) : null}

      <div ref={hostRef} style={styles.canvasHost} aria-label="Style-grouped BVH source animation preview" />
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
        Current demo exposes 45 motions from the already acquired CMU pool: 16 A Normal, 5 Backup, 5 Finish,
        4 utility/reaction, 7 partner-dependent social motions and 8 Explore V2 candidates. Style and mode hints
        are presentation metadata only. Animation duration never owns gameplay timing.
      </p>
    </section>
  );
}

const styleButton = (active: boolean): CSSProperties => ({
  border: active ? "1px solid #9e80ed" : "1px solid #343c4c",
  background: active ? "#2b2145" : "#171c26",
  color: active ? "#f2ebff" : "#aab3c3",
  borderRadius: 10,
  padding: "9px 8px",
  fontWeight: 850,
  fontSize: 10,
});

const styles: Record<string, CSSProperties> = {
  card: { display: "grid", gap: 11, padding: 11, border: "1px solid #3a3153", borderRadius: 15, background: "#12101b" },
  headingRow: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 },
  eyebrow: { margin: 0, color: "#b99af6", fontSize: 9, fontWeight: 950, letterSpacing: ".12em" },
  title: { margin: "4px 0 5px", fontSize: 18, lineHeight: 1.1 },
  lead: { margin: 0, color: "#929cad", fontSize: 11, lineHeight: 1.45 },
  badge: { flex: "0 0 auto", border: "1px solid #685983", background: "#241d32", color: "#ddcff8", borderRadius: 999, padding: "5px 8px", fontSize: 8, fontWeight: 950, letterSpacing: ".08em" },
  sectionLabel: { margin: "0 0 6px", color: "#7f899a", fontSize: 8, fontWeight: 950, letterSpacing: ".12em" },
  styleGrid: { display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 6 },
  filterRow: { display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 7 },
  selectorLabel: { display: "grid", gap: 5, minWidth: 0, color: "#9da7b8", fontSize: 10, fontWeight: 850 },
  select: { width: "100%", minWidth: 0, border: "1px solid #45405a", background: "#171520", color: "#edf0f6", borderRadius: 10, padding: "10px 9px", fontWeight: 800 },
  metaGrid: { display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 6 },
  metaCell: { display: "grid", gap: 2, minWidth: 0, padding: "8px 9px", borderRadius: 9, background: "#171520" },
  metaValue: { minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "#e8e3f4", fontSize: 11 },
  metaLabel: { color: "#7f899a", fontSize: 8, fontWeight: 800, textTransform: "uppercase", letterSpacing: ".08em" },
  partnerWarning: { padding: "8px 9px", borderRadius: 9, border: "1px solid #705c32", background: "#2b2416", color: "#f1d99b", fontSize: 10, lineHeight: 1.4, fontWeight: 750 },
  exploreWarning: { padding: "8px 9px", borderRadius: 9, border: "1px solid #405a75", background: "#152332", color: "#b8d5ef", fontSize: 10, lineHeight: 1.4, fontWeight: 750 },
  canvasHost: { width: "100%", height: "min(52vh, 460px)", minHeight: 320, overflow: "hidden", borderRadius: 12, background: "#0a0d14", touchAction: "none" },
  status: { minHeight: 16, padding: "0 3px", color: "#8f9aab", fontSize: 10 },
  controls: { display: "flex", gap: 7, alignItems: "center", flexWrap: "wrap" },
  controlButton: { border: "1px solid #3a4352", background: "#1a202a", color: "#d8deea", borderRadius: 10, padding: "10px 11px", fontWeight: 850 },
  speedLabel: { display: "flex", alignItems: "center", gap: 6, marginLeft: "auto", color: "#8f99aa", fontSize: 11, fontWeight: 800 },
  speedSelect: { border: "1px solid #3a4352", background: "#171c25", color: "#e1e6ef", borderRadius: 9, padding: "8px 9px", fontWeight: 800 },
  note: { margin: 0, padding: 9, borderRadius: 10, background: "#171521", color: "#8f94a7", fontSize: 10, lineHeight: 1.45 },
};
