"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { BVHLoader } from "three/examples/jsm/loaders/BVHLoader.js";
import { STYLE_LABELS, type CuratedStyleId } from "@/lib/animation/curated-source-library-v2";

type DemoModeId = "classic" | "team_battle" | "showdown";
type TransitionClass = "FREE" | "BEAT_WINDOW" | "PROTECTED";
type TriggerSource = "AUTO TURN" | "MANUAL";

type MotionSpec = {
  id: string;
  title: string;
  style: CuratedStyleId;
  transitionClass: TransitionClass;
};

type LoadedMotion = MotionSpec & {
  clip: THREE.AnimationClip;
};

const REFERENCE_BPM = 120;
const NO_REPEAT_WINDOW = 4;

const MODE_META: Record<DemoModeId, {
  label: string;
  shortLabel: string;
  description: string;
  recommendedBpm: string;
}> = {
  classic: {
    label: "Classic Dance",
    shortLabel: "CLASSIC",
    description: "Pop/Casual là trục chính, thêm solo Social, World và Modern dễ đọc. Tránh heavy floor/flip trong pool thường.",
    recommendedBpm: "90–160 BPM",
  },
  team_battle: {
    label: "Team Battle",
    shortLabel: "TEAM",
    description: "Upright, rõ silhouette và có lực hơn Classic: Pop + Modern + World + Street/Break vừa phải.",
    recommendedBpm: "110–170 BPM",
  },
  showdown: {
    label: "Showdown / Boss",
    shortLabel: "SHOWDOWN",
    description: "Stress-test transition bằng Street/Break/Special. PROTECTED motions cố ý khó blend để lộ lỗi handstand/flip/floor.",
    recommendedBpm: "120–180 BPM",
  },
};

const MODE_POOLS: Record<DemoModeId, readonly MotionSpec[]> = {
  classic: [
    { id: "111_05", title: "Dance", style: "pop_casual", transitionClass: "FREE" },
    { id: "120_06", title: "Mickey Dance", style: "pop_casual", transitionClass: "FREE" },
    { id: "141_12", title: "Dance, Twist", style: "pop_casual", transitionClass: "FREE" },
    { id: "90_32", title: "Moonwalk", style: "pop_casual", transitionClass: "FREE" },
    { id: "55_01", title: "Dance, whirl", style: "pop_casual", transitionClass: "BEAT_WINDOW" },
    { id: "93_03", title: "Charleston 01", style: "social_swing", transitionClass: "FREE" },
    { id: "93_08", title: "Fancy Charleston", style: "social_swing", transitionClass: "FREE" },
    { id: "94_13", title: "Indian dance 94_13", style: "world_folk", transitionClass: "FREE" },
    { id: "94_07", title: "Indian dance 94_07", style: "world_folk", transitionClass: "BEAT_WINDOW" },
    { id: "05_04", title: "Arabesque / back bend", style: "modern_stage", transitionClass: "BEAT_WINDOW" },
    { id: "05_02", title: "Expressive arms / pirouette", style: "modern_stage", transitionClass: "BEAT_WINDOW" },
    { id: "143_35", title: "Macarena Dance", style: "party_reaction", transitionClass: "FREE" },
  ],
  team_battle: [
    { id: "111_05", title: "Dance", style: "pop_casual", transitionClass: "FREE" },
    { id: "120_06", title: "Mickey Dance", style: "pop_casual", transitionClass: "FREE" },
    { id: "90_32", title: "Moonwalk", style: "pop_casual", transitionClass: "FREE" },
    { id: "55_01", title: "Dance, whirl", style: "pop_casual", transitionClass: "BEAT_WINDOW" },
    { id: "93_08", title: "Fancy Charleston", style: "social_swing", transitionClass: "FREE" },
    { id: "85_03", title: "UpRightSequence", style: "street_break", transitionClass: "FREE" },
    { id: "88_10", title: "Stretch and spin", style: "street_break", transitionClass: "BEAT_WINDOW" },
    { id: "90_30", title: "Russian dance", style: "world_folk", transitionClass: "BEAT_WINDOW" },
    { id: "94_07", title: "Indian dance 94_07", style: "world_folk", transitionClass: "BEAT_WINDOW" },
    { id: "94_14", title: "Indian dance 94_14", style: "world_folk", transitionClass: "BEAT_WINDOW" },
    { id: "05_04", title: "Arabesque / back bend", style: "modern_stage", transitionClass: "BEAT_WINDOW" },
    { id: "05_07", title: "Jetes / pirouette", style: "modern_stage", transitionClass: "BEAT_WINDOW" },
  ],
  showdown: [
    { id: "85_03", title: "UpRightSequence", style: "street_break", transitionClass: "FREE" },
    { id: "85_04", title: "FancyFootWork", style: "street_break", transitionClass: "BEAT_WINDOW" },
    { id: "85_05", title: "HandStandKicks", style: "street_break", transitionClass: "PROTECTED" },
    { id: "85_08", title: "Helicopter", style: "street_break", transitionClass: "PROTECTED" },
    { id: "85_10", title: "EndofBreakDance", style: "street_break", transitionClass: "PROTECTED" },
    { id: "85_14", title: "BreakSequencewithFlips", style: "street_break", transitionClass: "PROTECTED" },
    { id: "85_01", title: "JumpTwist", style: "street_break", transitionClass: "BEAT_WINDOW" },
    { id: "85_06", title: "KickFlip", style: "street_break", transitionClass: "PROTECTED" },
    { id: "88_06", title: "Jump and spin kick", style: "street_break", transitionClass: "BEAT_WINDOW" },
    { id: "88_08", title: "Backward hand flip", style: "street_break", transitionClass: "PROTECTED" },
    { id: "89_03", title: "Flip / one-hand stand", style: "street_break", transitionClass: "PROTECTED" },
    { id: "90_14", title: "Front hand flip", style: "street_break", transitionClass: "PROTECTED" },
  ],
};

function bvhUrl(id: string) {
  return "/api/curated-animation-source/" + encodeURIComponent(id);
}

function shuffle<T>(values: readonly T[]) {
  const result = [...values];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(Math.random() * (index + 1));
    [result[index], result[swap]] = [result[swap], result[index]];
  }
  return result;
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
  const scale = 1.55 / height;

  group.scale.setScalar(scale);
  group.position.set(-center.x * scale, -bounds.min.y * scale, -center.z * scale);
  group.updateMatrixWorld(true);
}

function transitionClassLabel(value: TransitionClass) {
  if (value === "FREE") return "Free crossfade";
  if (value === "BEAT_WINDOW") return "Beat-window";
  return "Protected / stress";
}

export function AnimationFlowDemo() {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const gaugeFillRef = useRef<HTMLDivElement | null>(null);
  const spaceRef = useRef<HTMLButtonElement | null>(null);

  const sceneRef = useRef<THREE.Scene | null>(null);
  const groupRef = useRef<THREE.Group | null>(null);
  const helperRef = useRef<THREE.SkeletonHelper | null>(null);
  const mixerRef = useRef<THREE.AnimationMixer | null>(null);
  const currentActionRef = useRef<THREE.AnimationAction | null>(null);
  const loadedRef = useRef<Map<string, LoadedMotion>>(new Map());
  const actionRef = useRef<Map<string, THREE.AnimationAction>>(new Map());

  const runningRef = useRef(true);
  const loadingRef = useRef(true);
  const triggerSpaceRef = useRef<(trigger: TriggerSource) => void>(() => {});
  const bpmRef = useRef(120);
  const blendBeatsRef = useRef(0.35);
  const beatElapsedRef = useRef(0);
  const lastTurnIndexRef = useRef(0);
  const currentIdRef = useRef<string | null>(null);
  const bagRef = useRef<string[]>([]);
  const recentRef = useRef<string[]>([]);
  const loadGenerationRef = useRef(0);
  const flashTimerRef = useRef<number | null>(null);

  const [mode, setMode] = useState<DemoModeId>("classic");
  const [bpm, setBpm] = useState(120);
  const [blendBeats, setBlendBeats] = useState(0.35);
  const [running, setRunning] = useState(true);
  const [loading, setLoading] = useState(true);
  const [loadStatus, setLoadStatus] = useState("Preparing Classic animation pool…");
  const [currentMotion, setCurrentMotion] = useState<MotionSpec | null>(null);
  const [previousMotion, setPreviousMotion] = useState<MotionSpec | null>(null);
  const [history, setHistory] = useState<MotionSpec[]>([]);
  const [turnNumber, setTurnNumber] = useState(1);
  const [beatNumber, setBeatNumber] = useState(1);
  const [transitionCount, setTransitionCount] = useState(0);
  const [lastTrigger, setLastTrigger] = useState<TriggerSource>("AUTO TURN");

  const pool = MODE_POOLS[mode];
  const playbackRate = bpm / REFERENCE_BPM;
  const turnSeconds = 240 / bpm;
  const blendSeconds = blendBeats * 60 / bpm;

  const styleMix = useMemo(() => {
    const counts = new Map<CuratedStyleId, number>();
    for (const motion of pool) counts.set(motion.style, (counts.get(motion.style) ?? 0) + 1);
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([style, count]) => STYLE_LABELS[style] + " " + count)
      .join(" · ");
  }, [pool]);

  const clearLoaded = useCallback(() => {
    if (flashTimerRef.current !== null) {
      window.clearTimeout(flashTimerRef.current);
      flashTimerRef.current = null;
    }
    currentActionRef.current?.stop();
    mixerRef.current?.stopAllAction();
    actionRef.current.clear();
    loadedRef.current.clear();

    if (helperRef.current) {
      helperRef.current.removeFromParent();
      helperRef.current.dispose();
      helperRef.current = null;
    }
    groupRef.current?.removeFromParent();
    groupRef.current = null;
    mixerRef.current = null;
    currentActionRef.current = null;
    currentIdRef.current = null;
  }, []);

  const refillBag = useCallback((excludeId?: string | null) => {
    const ids = MODE_POOLS[mode].map(motion => motion.id).filter(id => id !== excludeId);
    bagRef.current = shuffle(ids);
  }, [mode]);

  const pickNextId = useCallback((currentId?: string | null) => {
    if (!bagRef.current.length) refillBag(currentId);

    const recent = new Set(recentRef.current.slice(-NO_REPEAT_WINDOW));
    let chosenIndex = bagRef.current.findIndex(id => id !== currentId && !recent.has(id));
    if (chosenIndex < 0) chosenIndex = bagRef.current.findIndex(id => id !== currentId);
    if (chosenIndex < 0) {
      refillBag(currentId);
      chosenIndex = 0;
    }

    const [chosen] = bagRef.current.splice(Math.max(0, chosenIndex), 1);
    return chosen;
  }, [refillBag]);

  const applyPlaybackRate = useCallback((rate: number) => {
    for (const action of actionRef.current.values()) action.setEffectiveTimeScale(rate);
  }, []);

  const startMotion = useCallback((id: string, blend: boolean, trigger: TriggerSource) => {
    const loaded = loadedRef.current.get(id);
    const mixer = mixerRef.current;
    if (!loaded || !mixer) return;

    const nextAction = actionRef.current.get(id) ?? mixer.clipAction(loaded.clip);
    actionRef.current.set(id, nextAction);

    nextAction.reset();
    nextAction.enabled = true;
    nextAction.setLoop(THREE.LoopRepeat, Infinity);
    nextAction.setEffectiveWeight(1);
    nextAction.setEffectiveTimeScale(bpmRef.current / REFERENCE_BPM);
    nextAction.play();

    const previousId = currentIdRef.current;
    const previous = previousId ? loadedRef.current.get(previousId) ?? null : null;
    const currentAction = currentActionRef.current;

    if (blend && currentAction && currentAction !== nextAction) {
      const blendDuration = Math.max(0.045, blendBeatsRef.current * 60 / bpmRef.current);
      currentAction.crossFadeTo(nextAction, blendDuration, false);
    } else if (currentAction && currentAction !== nextAction) {
      currentAction.stop();
    }

    currentActionRef.current = nextAction;
    currentIdRef.current = id;
    recentRef.current.push(id);
    recentRef.current = recentRef.current.slice(-NO_REPEAT_WINDOW);

    setPreviousMotion(previous);
    setCurrentMotion(loaded);
    setHistory(existing => [loaded, ...existing.filter(item => item.id !== id)].slice(0, 8));
    if (previousId) setTransitionCount(value => value + 1);
    setLastTrigger(trigger);
  }, []);

  const flashSpace = useCallback(() => {
    const button = spaceRef.current;
    if (!button) return;
    button.dataset.active = "true";
    if (flashTimerRef.current !== null) window.clearTimeout(flashTimerRef.current);
    flashTimerRef.current = window.setTimeout(() => {
      button.dataset.active = "false";
      flashTimerRef.current = null;
    }, 180);
  }, []);

  const triggerSpace = useCallback((trigger: TriggerSource) => {
    if (loadingRef.current || loadedRef.current.size < 2) return;
    const nextId = pickNextId(currentIdRef.current);
    if (!nextId) return;
    flashSpace();
    startMotion(nextId, true, trigger);
  }, [flashSpace, pickNextId, startMotion]);

  const resetRun = useCallback(() => {
    beatElapsedRef.current = 0;
    lastTurnIndexRef.current = 0;
    recentRef.current = [];
    bagRef.current = [];
    setTurnNumber(1);
    setBeatNumber(1);
    setTransitionCount(0);
    setHistory([]);

    const firstId = pickNextId(null);
    if (firstId) startMotion(firstId, false, "AUTO TURN");
    if (gaugeFillRef.current) gaugeFillRef.current.style.transform = "scaleX(0)";
  }, [pickNextId, startMotion]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x070a12);
    scene.fog = new THREE.Fog(0x070a12, 3.2, 7);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(34, 1, 0.01, 30);
    camera.position.set(1.7, 1.2, 2.65);

    const canvas = document.createElement("canvas");
    const context = canvas.getContext("webgl2") ?? canvas.getContext("webgl");
    if (!context) {
      setLoadStatus("WebGL is unavailable on this device.");
      setLoading(false);
      return;
    }

    const renderer = new THREE.WebGLRenderer({ canvas, context, antialias: true });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    host.appendChild(renderer.domElement);

    const floor = new THREE.Mesh(
      new THREE.CircleGeometry(1.25, 80),
      new THREE.MeshBasicMaterial({ color: 0x111827, transparent: true, opacity: 0.92 }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -0.008;
    scene.add(floor);

    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.86, 0.9, 96),
      new THREE.MeshBasicMaterial({ color: 0x8f7aea, transparent: true, opacity: 0.35, side: THREE.DoubleSide }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = -0.004;
    scene.add(ring);

    const grid = new THREE.GridHelper(2.55, 20, 0x6e5bb5, 0x202a3c);
    grid.position.y = 0;
    const gridMaterial = grid.material as THREE.Material;
    gridMaterial.transparent = true;
    gridMaterial.opacity = 0.24;
    scene.add(grid);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.enablePan = false;
    controls.target.set(0, 0.76, 0);
    controls.minDistance = 1.6;
    controls.maxDistance = 4.6;

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
    let lastBeatVisual = 1;

    const render = () => {
      raf = requestAnimationFrame(render);
      const delta = Math.min(clock.getDelta(), 0.05);

      if (runningRef.current && !loadingRef.current) {
        beatElapsedRef.current += delta * (bpmRef.current / 60);

        const beatInTurn = beatElapsedRef.current % 4;
        const progress = beatInTurn / 4;
        if (gaugeFillRef.current) {
          gaugeFillRef.current.style.transform = "scaleX(" + Math.max(0, Math.min(1, progress)).toFixed(4) + ")";
        }

        const nextBeatVisual = Math.min(4, Math.floor(beatInTurn) + 1);
        if (nextBeatVisual !== lastBeatVisual) {
          lastBeatVisual = nextBeatVisual;
          setBeatNumber(nextBeatVisual);
        }

        const turnIndex = Math.floor(beatElapsedRef.current / 4);
        if (turnIndex > lastTurnIndexRef.current) {
          lastTurnIndexRef.current = turnIndex;
          setTurnNumber(turnIndex + 1);
          setBeatNumber(1);
          lastBeatVisual = 1;
          triggerSpaceRef.current("AUTO TURN");
        }

        mixerRef.current?.update(delta);
      }

      helperRef.current?.updateMatrixWorld(true);
      controls.update();
      renderer.render(scene, camera);
    };
    render();

    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
      clearLoaded();
      controls.dispose();
      grid.geometry.dispose();
      gridMaterial.dispose();
      floor.geometry.dispose();
      (floor.material as THREE.Material).dispose();
      ring.geometry.dispose();
      (ring.material as THREE.Material).dispose();
      renderer.dispose();
      if (renderer.domElement.parentElement === host) host.removeChild(renderer.domElement);
      sceneRef.current = null;
    };
  }, [clearLoaded]);

  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;

    const generation = ++loadGenerationRef.current;
    clearLoaded();
    setLoading(true);
    setLoadStatus("Loading " + MODE_META[mode].label + " · " + pool.length + " selected motions…");
    setCurrentMotion(null);
    setPreviousMotion(null);
    setHistory([]);
    setTransitionCount(0);
    bagRef.current = [];
    recentRef.current = [];
    beatElapsedRef.current = 0;
    lastTurnIndexRef.current = 0;
    setTurnNumber(1);
    setBeatNumber(1);

    const loader = new BVHLoader();

    void Promise.all(
      pool.map(async spec => {
        const result = await loader.loadAsync(bvhUrl(spec.id));
        const endFrame = Math.max(2, Math.round(result.clip.duration * 120) + 1);
        const clip = THREE.AnimationUtils.subclip(result.clip, "Demo-" + spec.id, 1, endFrame, 120);
        return { spec, result, clip };
      }),
    ).then(items => {
      if (generation !== loadGenerationRef.current) return;
      const first = items[0];
      const root = first?.result.skeleton.bones[0];
      if (!first || !root) throw new Error("BVH pool has no usable skeleton root");

      const group = new THREE.Group();
      group.name = "AnimationFlowDemo-" + mode;
      group.add(root);
      scene.add(group);
      normalizeSourceSkeleton(group, first.result.skeleton.bones);

      const helper = new THREE.SkeletonHelper(root);
      const helperMaterial = helper.material as THREE.LineBasicMaterial;
      helperMaterial.color.setHex(0xd8c8ff);
      helperMaterial.transparent = true;
      helperMaterial.opacity = 0.98;
      scene.add(helper);

      const mixer = new THREE.AnimationMixer(root);
      const loaded = new Map<string, LoadedMotion>();
      for (const item of items) {
        loaded.set(item.spec.id, { ...item.spec, clip: item.clip });
      }

      groupRef.current = group;
      helperRef.current = helper;
      mixerRef.current = mixer;
      loadedRef.current = loaded;
      actionRef.current.clear();
      currentActionRef.current = null;
      currentIdRef.current = null;

      setLoading(false);
      setLoadStatus(
        MODE_META[mode].label +
          " ready · " +
          loaded.size +
          " motions · shuffle-bag · no repeat " +
          NO_REPEAT_WINDOW,
      );

      refillBag(null);
      const firstId = pickNextId(null);
      if (firstId) startMotion(firstId, false, "AUTO TURN");
    }).catch(error => {
      if (generation === loadGenerationRef.current) {
        setLoading(false);
        setLoadStatus("Pool load failed: " + (error instanceof Error ? error.message : "unknown error"));
      }
    });

    return () => {
      loadGenerationRef.current += 1;
      clearLoaded();
    };
  }, [clearLoaded, mode, pickNextId, pool, refillBag, startMotion]);

  useEffect(() => {
    runningRef.current = running;
  }, [running]);

  useEffect(() => {
    loadingRef.current = loading;
  }, [loading]);

  useEffect(() => {
    triggerSpaceRef.current = triggerSpace;
  }, [triggerSpace]);

  useEffect(() => {
    bpmRef.current = bpm;
    applyPlaybackRate(bpm / REFERENCE_BPM);
  }, [applyPlaybackRate, bpm]);

  useEffect(() => {
    blendBeatsRef.current = blendBeats;
  }, [blendBeats]);

  return (
    <main style={styles.page}>
      <div style={styles.shell}>
        <header style={styles.header}>
          <div>
            <p style={styles.eyebrow}>ANIMATION FLOW LAB · SOURCE SKELETON</p>
            <h1 style={styles.title}>Gauge → SPACE → Crossfade</h1>
            <p style={styles.lead}>
              Demo cô lập để kiểm transition giữa dance motions. Gauge chỉ là giả lập 4-beat turn;
              BPM điều khiển cả gauge và animation playback. Không dùng/đổi gauge gameplay thật.
            </p>
          </div>
          <span style={styles.badge}>DEMO ONLY</span>
        </header>

        <section style={styles.modeSection}>
          <p style={styles.sectionLabel}>MODE · CURATED BY FIT</p>
          <div style={styles.modeGrid}>
            {(Object.keys(MODE_META) as DemoModeId[]).map(id => (
              <button
                key={id}
                type="button"
                onClick={() => setMode(id)}
                style={modeButton(mode === id)}
              >
                <strong>{MODE_META[id].shortLabel}</strong>
                <small>{MODE_POOLS[id].length} motions</small>
              </button>
            ))}
          </div>
          <div style={styles.modeInfo}>
            <strong>{MODE_META[mode].label}</strong>
            <span>{MODE_META[mode].recommendedBpm}</span>
            <p>{MODE_META[mode].description}</p>
            <small>{styleMix}</small>
          </div>
        </section>

        <section style={styles.stageCard}>
          <div style={styles.hudTop}>
            <div>
              <span style={styles.microLabel}>TURN</span>
              <strong style={styles.bigStat}>{turnNumber}</strong>
            </div>
            <div style={styles.centerStat}>
              <span style={styles.microLabel}>BEAT</span>
              <strong style={styles.bigStat}>{beatNumber} / 4</strong>
            </div>
            <div style={styles.rightStat}>
              <span style={styles.microLabel}>SPEED</span>
              <strong style={styles.bigStat}>{playbackRate.toFixed(2)}×</strong>
            </div>
          </div>

          <div ref={hostRef} style={styles.canvasHost} aria-label="Animation crossfade source skeleton preview" />

          <div style={styles.gaugePanel}>
            <div style={styles.gaugeHeader}>
              <span>SIMULATED GAUGE · 4 BEAT TURN</span>
              <span>{turnSeconds.toFixed(2)}s / turn</span>
            </div>
            <div style={styles.gaugeTrack}>
              <div ref={gaugeFillRef} style={styles.gaugeFill} />
              {[1, 2, 3, 4].map(value => (
                <span key={value} style={{ ...styles.beatTick, left: ((value - 1) / 4) * 100 + "%" }}>
                  {value}
                </span>
              ))}
              <span style={{ ...styles.beatTick, left: "100%", transform: "translateX(-100%)" }}>SPACE</span>
            </div>

            <button
              ref={spaceRef}
              type="button"
              data-active="false"
              disabled={loading}
              onClick={() => triggerSpace("MANUAL")}
              style={styles.spaceButton}
            >
              <span>SPACE</span>
              <small>{lastTrigger === "AUTO TURN" ? "AUTO @ TURN" : "MANUAL TEST"}</small>
            </button>
          </div>
        </section>

        <section style={styles.currentCard}>
          <div style={styles.currentHeader}>
            <div>
              <p style={styles.sectionLabel}>CURRENT MOTION</p>
              <strong style={styles.currentTitle}>
                {currentMotion ? currentMotion.id + " · " + currentMotion.title : "Loading…"}
              </strong>
            </div>
            {currentMotion ? (
              <span style={transitionBadge(currentMotion.transitionClass)}>
                {transitionClassLabel(currentMotion.transitionClass)}
              </span>
            ) : null}
          </div>

          {currentMotion ? (
            <div style={styles.motionMeta}>
              <span>{STYLE_LABELS[currentMotion.style]}</span>
              <span>{previousMotion ? previousMotion.id + " → " + currentMotion.id : "first motion"}</span>
              <span>transition #{transitionCount}</span>
            </div>
          ) : null}

          <div style={styles.history}>
            {history.length ? history.map((item, index) => (
              <span key={item.id + "-" + index} style={index === 0 ? styles.historyCurrent : styles.historyChip}>
                {item.id}
              </span>
            )) : <span style={styles.historyEmpty}>History appears after the pool loads.</span>}
          </div>
        </section>

        <section style={styles.controlsCard}>
          <div style={styles.controlRow}>
            <button type="button" onClick={() => setRunning(value => !value)} style={styles.primaryControl}>
              {running ? "Ⅱ Pause simulation" : "▶ Resume simulation"}
            </button>
            <button type="button" disabled={loading} onClick={resetRun} style={styles.secondaryControl}>
              ↺ New random run
            </button>
          </div>

          <div style={styles.controlGrid}>
            <label style={styles.controlLabel}>
              BPM
              <select value={bpm} onChange={event => setBpm(Number(event.target.value))} style={styles.select}>
                {[90, 110, 120, 130, 140, 160, 180].map(value => (
                  <option key={value} value={value}>{value} BPM</option>
                ))}
              </select>
            </label>

            <label style={styles.controlLabel}>
              Crossfade
              <select value={blendBeats} onChange={event => setBlendBeats(Number(event.target.value))} style={styles.select}>
                <option value={0.2}>0.20 beat</option>
                <option value={0.35}>0.35 beat</option>
                <option value={0.5}>0.50 beat</option>
                <option value={0.75}>0.75 beat</option>
              </select>
            </label>
          </div>

          <div style={styles.techStrip}>
            <span>{loadStatus}</span>
            <span>blend {blendSeconds.toFixed(3)}s @ {bpm} BPM</span>
          </div>
        </section>

        <section style={styles.explainCard}>
          <strong>Random policy</strong>
          <p>
            Mỗi mode dùng shuffle-bag: phải đi gần hết pool mới quay lại motion cũ, đồng thời chặn
            {NO_REPEAT_WINDOW} motion gần nhất. Vì vậy mỗi lần “New random run” có thứ tự khác nhưng không bị lặp liên tục.
          </p>
          <strong>Transition policy</strong>
          <p>
            FREE là ứng viên tốt cho Classic; BEAT_WINDOW cần chọn exit marker kỹ hơn; PROTECTED là handstand/flip/floor
            cố ý đưa vào Showdown để stress-test. Demo hiện crossfade ngay tại SPACE để bạn nhìn thấy lỗi thật nếu pose không tương thích.
          </p>
          <small>
            WebAudio/gameplay authority không được dùng trong route này. Đây chỉ là visual simulation; 8 Moonlight frozen, gauge thật,
            Finish semantics, sequenceCounts và runtime Character Catalog không bị thay đổi.
          </small>
        </section>
      </div>

      <style>{`
        button[data-active="true"] {
          background: #f4e8ff !important;
          color: #241438 !important;
          border-color: #ffffff !important;
          box-shadow: 0 0 0 3px rgba(188, 149, 255, .18), 0 0 28px rgba(166, 115, 255, .48);
          transform: translateY(-1px) scale(1.02);
        }
      `}</style>
    </main>
  );
}

const modeButton = (active: boolean): CSSProperties => ({
  display: "grid",
  gap: 3,
  minHeight: 58,
  textAlign: "left",
  border: active ? "1px solid #b99af6" : "1px solid #333c4d",
  background: active ? "#2d2148" : "#151b25",
  color: active ? "#f6f0ff" : "#b8c1cf",
  borderRadius: 12,
  padding: "10px 11px",
  fontWeight: 900,
});

const transitionBadge = (kind: TransitionClass): CSSProperties => ({
  flex: "0 0 auto",
  border: kind === "FREE" ? "1px solid #5abf9b" : kind === "BEAT_WINDOW" ? "1px solid #cfaa63" : "1px solid #ce6f7e",
  background: kind === "FREE" ? "#17332d" : kind === "BEAT_WINDOW" ? "#352b18" : "#3a1c25",
  color: kind === "FREE" ? "#b9f3df" : kind === "BEAT_WINDOW" ? "#f4deb0" : "#f5bcc7",
  borderRadius: 999,
  padding: "5px 8px",
  fontSize: 8,
  fontWeight: 900,
  whiteSpace: "nowrap",
});

const styles: Record<string, CSSProperties> = {
  page: { minHeight: "100vh", background: "radial-gradient(circle at 50% -20%, #201838 0, #0a0d14 38%, #07090f 100%)", color: "#f7f8fb", padding: "16px 11px 42px", fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" },
  shell: { width: "100%", maxWidth: 760, margin: "0 auto", display: "grid", gap: 12 },
  header: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 },
  eyebrow: { margin: 0, color: "#b99af6", fontSize: 9, fontWeight: 950, letterSpacing: ".13em" },
  title: { margin: "5px 0 6px", fontSize: "clamp(25px, 7vw, 38px)", lineHeight: 1.02 },
  lead: { margin: 0, maxWidth: 610, color: "#98a2b3", fontSize: 12, lineHeight: 1.5 },
  badge: { flex: "0 0 auto", border: "1px solid #70578a", background: "#251c31", color: "#dfc8ee", borderRadius: 999, padding: "6px 9px", fontSize: 8, fontWeight: 950, letterSpacing: ".1em" },
  sectionLabel: { margin: "0 0 5px", color: "#7f899b", fontSize: 8, fontWeight: 950, letterSpacing: ".12em" },
  modeSection: { display: "grid", gap: 8, padding: 11, borderRadius: 15, border: "1px solid #2d3545", background: "#10151e" },
  modeGrid: { display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 7 },
  modeInfo: { display: "grid", gridTemplateColumns: "1fr auto", gap: "4px 10px", padding: "9px 10px", borderRadius: 11, background: "#171c27", color: "#dce2eb", fontSize: 10 },
  stageCard: { overflow: "hidden", borderRadius: 17, border: "1px solid #34304a", background: "#0b0f18" },
  hudTop: { display: "grid", gridTemplateColumns: "repeat(3, 1fr)", alignItems: "center", padding: "9px 11px", borderBottom: "1px solid #242c3a", background: "#111621" },
  microLabel: { display: "block", color: "#707b8c", fontSize: 7, fontWeight: 950, letterSpacing: ".12em" },
  bigStat: { display: "block", marginTop: 2, fontSize: 15, color: "#f3f5f9" },
  centerStat: { textAlign: "center" },
  rightStat: { textAlign: "right" },
  canvasHost: { width: "100%", height: "min(57vh, 520px)", minHeight: 360, background: "#070a12", touchAction: "none" },
  gaugePanel: { display: "grid", gap: 8, padding: "10px 11px 12px", borderTop: "1px solid #242c3a", background: "#10151f" },
  gaugeHeader: { display: "flex", justifyContent: "space-between", gap: 8, color: "#8490a2", fontSize: 8, fontWeight: 850, letterSpacing: ".06em" },
  gaugeTrack: { position: "relative", height: 28, overflow: "hidden", border: "1px solid #3a4354", borderRadius: 9, background: "#171d28" },
  gaugeFill: { position: "absolute", inset: 0, transformOrigin: "left center", transform: "scaleX(0)", background: "linear-gradient(90deg, #5d4b9d 0%, #9b72df 62%, #d7b7ff 100%)" },
  beatTick: { position: "absolute", top: 0, bottom: 0, zIndex: 2, display: "grid", alignItems: "center", padding: "0 5px", borderLeft: "1px solid rgba(255,255,255,.14)", color: "rgba(255,255,255,.74)", fontSize: 7, fontWeight: 900 },
  spaceButton: { justifySelf: "stretch", minHeight: 52, display: "grid", placeItems: "center", gap: 1, border: "1px solid #67547e", borderRadius: 12, background: "#241c32", color: "#e8dcf7", fontWeight: 950, transition: "transform 120ms ease, background 120ms ease, color 120ms ease, box-shadow 120ms ease" },
  currentCard: { display: "grid", gap: 8, padding: 11, borderRadius: 15, border: "1px solid #2d3545", background: "#10151e" },
  currentHeader: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 },
  currentTitle: { color: "#f3f5f8", fontSize: 13 },
  motionMeta: { display: "flex", gap: 6, flexWrap: "wrap", color: "#9ca6b7", fontSize: 9 },
  history: { display: "flex", gap: 5, overflowX: "auto", paddingBottom: 2 },
  historyChip: { flex: "0 0 auto", border: "1px solid #323b4b", background: "#171d27", color: "#8f9aab", borderRadius: 999, padding: "5px 8px", fontSize: 8, fontWeight: 800 },
  historyCurrent: { flex: "0 0 auto", border: "1px solid #9c7de9", background: "#2a2142", color: "#efe8ff", borderRadius: 999, padding: "5px 8px", fontSize: 8, fontWeight: 900 },
  historyEmpty: { color: "#747f91", fontSize: 9 },
  controlsCard: { display: "grid", gap: 9, padding: 11, borderRadius: 15, border: "1px solid #2d3545", background: "#10151e" },
  controlRow: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 7 },
  primaryControl: { minHeight: 44, border: "1px solid #9a7ee4", background: "#2b2242", color: "#f0e9ff", borderRadius: 11, fontWeight: 900 },
  secondaryControl: { minHeight: 44, border: "1px solid #3c4555", background: "#1a202a", color: "#d8deea", borderRadius: 11, fontWeight: 850 },
  controlGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 7 },
  controlLabel: { display: "grid", gap: 5, color: "#929dad", fontSize: 9, fontWeight: 850 },
  select: { width: "100%", border: "1px solid #3b4454", background: "#171d27", color: "#edf1f7", borderRadius: 10, padding: "9px 10px", fontSize: 12, fontWeight: 800 },
  techStrip: { display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap", color: "#778295", fontSize: 8 },
  explainCard: { display: "grid", gap: 4, padding: 11, borderRadius: 14, border: "1px solid #2b3040", background: "#0f141d", color: "#cbd2dd", fontSize: 10, lineHeight: 1.48 },
};

