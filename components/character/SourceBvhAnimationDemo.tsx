"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { BVHLoader } from "three/examples/jsm/loaders/BVHLoader.js";
import {
  MODE_DESCRIPTIONS,
  MODE_LABELS,
  MODE_RELEASE_LABELS,
  STATUS_LABELS,
  STYLE_LABELS,
  type CuratedGameModeId,
  type CuratedSourceMotion,
  type CuratedStatus,
  type CuratedStyleId,
} from "@/lib/animation/curated-source-library-v2";

type StyleFilter = "all" | CuratedStyleId;
type StatusFilter = "all" | CuratedStatus;
type ModeFilter = "all" | CuratedGameModeId;
type ReviewDecision = "keep" | "reject";
type ReviewFilter = "all" | "unreviewed" | ReviewDecision;
type ReviewMap = Record<string, ReviewDecision>;
type ModeFitDecision = "fit" | "exclude";
type ModeFitFilter = "all" | "unreviewed" | ModeFitDecision;
type ModeFitMap = Record<string, ModeFitDecision>;

const REVIEW_STORAGE_KEY = "audition:animation-library:curation-v2:owner-review";
const MODE_FIT_STORAGE_KEY = "audition:animation-library:curation-v2:mode-fit-review";

function bvhUrl(id: string) {
  return "/api/curated-animation-source/" + encodeURIComponent(id);
}

function modeFitKey(mode: CuratedGameModeId, id: string) {
  return mode + ":" + id;
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

function reviewSymbol(decision?: ReviewDecision) {
  if (decision === "keep") return "✓";
  if (decision === "reject") return "✕";
  return "·";
}

export function SourceBvhAnimationDemo() {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const sourceGroupRef = useRef<THREE.Group | null>(null);
  const helperRef = useRef<THREE.SkeletonHelper | null>(null);
  const mixerRef = useRef<THREE.AnimationMixer | null>(null);
  const actionRef = useRef<THREE.AnimationAction | null>(null);
  const animationRootRef = useRef<THREE.Object3D | null>(null);
  const playingRef = useRef(true);
  const speedRef = useRef(1);

  const [motions, setMotions] = useState<CuratedSourceMotion[]>([]);
  const [catalogStatus, setCatalogStatus] = useState("Loading 73 retained V2 motions…");
  const [modeFilter, setModeFilter] = useState<ModeFilter>("all");
  const [styleFilter, setStyleFilter] = useState<StyleFilter>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [reviewFilter, setReviewFilter] = useState<ReviewFilter>("all");
  const [modeFitFilter, setModeFitFilter] = useState<ModeFitFilter>("all");
  const [selectedId, setSelectedId] = useState("");
  const [playerStatus, setPlayerStatus] = useState("Waiting for curated catalog…");
  const [playing, setPlaying] = useState(true);
  const [speed, setSpeed] = useState(1);
  const [review, setReview] = useState<ReviewMap>({});
  const [modeFit, setModeFit] = useState<ModeFitMap>({});
  const [reviewReady, setReviewReady] = useState(false);
  const [reviewMessage, setReviewMessage] = useState("");

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/curated-animation-catalog", { cache: "force-cache" })
      .then(async response => {
        if (!response.ok) throw new Error("catalog HTTP " + response.status);
        return response.json() as Promise<{
          motions: CuratedSourceMotion[];
          choreographyGroups: number;
          unassignedUtilityTakes: number;
        }>;
      })
      .then(data => {
        if (cancelled) return;
        setMotions(data.motions);
        setSelectedId(current => current || data.motions[0]?.id || "");
        setCatalogStatus(
          data.motions.length +
            " retained takes · " +
            data.choreographyGroups +
            " choreography groups · " +
            data.unassignedUtilityTakes +
            " utility ngoài gameplay mode",
        );
      })
      .catch(error => {
        if (!cancelled) {
          setCatalogStatus("Catalog load failed: " + (error instanceof Error ? error.message : "unknown error"));
        }
      });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    try {
      const rawReview = window.localStorage.getItem(REVIEW_STORAGE_KEY);
      if (rawReview) {
        const parsed = JSON.parse(rawReview) as Record<string, unknown>;
        const valid: ReviewMap = {};
        for (const [id, value] of Object.entries(parsed)) {
          if (value === "keep" || value === "reject") valid[id] = value;
        }
        setReview(valid);
      }

      const rawModeFit = window.localStorage.getItem(MODE_FIT_STORAGE_KEY);
      if (rawModeFit) {
        const parsed = JSON.parse(rawModeFit) as Record<string, unknown>;
        const valid: ModeFitMap = {};
        for (const [key, value] of Object.entries(parsed)) {
          if (value === "fit" || value === "exclude") valid[key] = value;
        }
        setModeFit(valid);
      }
    } catch {
      setReviewMessage("Không đọc được review cũ trên thiết bị này.");
    } finally {
      setReviewReady(true);
    }
  }, []);

  useEffect(() => {
    if (!reviewReady) return;
    try {
      window.localStorage.setItem(REVIEW_STORAGE_KEY, JSON.stringify(review));
      window.localStorage.setItem(MODE_FIT_STORAGE_KEY, JSON.stringify(modeFit));
    } catch {
      setReviewMessage("Không lưu được review vào local storage.");
    }
  }, [modeFit, review, reviewReady]);

  const modePool = useMemo(
    () => modeFilter === "all"
      ? motions
      : motions.filter(motion => motion.modes.includes(modeFilter)),
    [modeFilter, motions],
  );

  const modeFitCounts = useMemo(() => {
    if (modeFilter === "all") return { fit: 0, exclude: 0, unreviewed: 0 };
    let fit = 0;
    let exclude = 0;
    for (const motion of modePool) {
      const decision = modeFit[modeFitKey(modeFilter, motion.id)];
      if (decision === "fit") fit += 1;
      if (decision === "exclude") exclude += 1;
    }
    return { fit, exclude, unreviewed: modePool.length - fit - exclude };
  }, [modeFilter, modeFit, modePool]);

  const visibleMotions = useMemo(
    () => motions.filter(motion => {
      if (modeFilter !== "all" && !motion.modes.includes(modeFilter)) return false;
      if (styleFilter !== "all" && motion.style !== styleFilter) return false;
      if (statusFilter !== "all" && motion.status !== statusFilter) return false;

      const sourceDecision = review[motion.id];
      if (reviewFilter === "unreviewed" && sourceDecision) return false;
      if (reviewFilter === "keep" && sourceDecision !== "keep") return false;
      if (reviewFilter === "reject" && sourceDecision !== "reject") return false;

      if (modeFilter !== "all") {
        const fitDecision = modeFit[modeFitKey(modeFilter, motion.id)];
        if (modeFitFilter === "unreviewed" && fitDecision) return false;
        if (modeFitFilter === "fit" && fitDecision !== "fit") return false;
        if (modeFitFilter === "exclude" && fitDecision !== "exclude") return false;
      }
      return true;
    }),
    [modeFilter, modeFit, modeFitFilter, motions, review, reviewFilter, statusFilter, styleFilter],
  );

  const selectedMotion =
    visibleMotions.find(motion => motion.id === selectedId) ??
    visibleMotions[0] ??
    null;

  useEffect(() => {
    if (!selectedMotion) return;
    if (selectedId !== selectedMotion.id) setSelectedId(selectedMotion.id);
  }, [selectedId, selectedMotion]);

  useEffect(() => {
    if (modeFilter === "all") setModeFitFilter("all");
  }, [modeFilter]);

  const reviewCounts = useMemo(() => {
    let keep = 0;
    let reject = 0;
    for (const motion of motions) {
      if (review[motion.id] === "keep") keep += 1;
      if (review[motion.id] === "reject") reject += 1;
    }
    return { keep, reject, unreviewed: motions.length - keep - reject };
  }, [motions, review]);

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
      setPlayerStatus("WebGL is unavailable on this device.");
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

    if (!selectedMotion) {
      clearLoadedMotion();
      setPlayerStatus("Không có animation khớp bộ lọc hiện tại.");
      return;
    }

    let cancelled = false;
    clearLoadedMotion();
    setPlayerStatus("Loading " + selectedMotion.id + " from pinned CMU source…");

    const loader = new BVHLoader();
    void loader.loadAsync(bvhUrl(selectedMotion.id)).then(result => {
      if (cancelled) return;

      const root = result.skeleton.bones[0];
      if (!root) throw new Error("BVH has no root bone");

      const group = new THREE.Group();
      group.name = "CuratedSourceBVH-" + selectedMotion.id;
      group.add(root);
      scene.add(group);

      const fps = 120;
      const endFrame = Math.max(2, Math.round(result.clip.duration * fps) + 1);
      const clip = THREE.AnimationUtils.subclip(
        result.clip,
        "Source-" + selectedMotion.id,
        1,
        endFrame,
        fps,
      );

      const mixer = new THREE.AnimationMixer(root);
      const action = mixer.clipAction(clip);
      action.reset();
      action.enabled = true;
      action.clampWhenFinished = selectedMotion.finishCandidate;
      action.setLoop(selectedMotion.finishCandidate ? THREE.LoopOnce : THREE.LoopRepeat, selectedMotion.finishCandidate ? 1 : Infinity);
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

      setPlayerStatus(
        selectedMotion.id +
          " · " +
          STYLE_LABELS[selectedMotion.style] +
          " · " +
          clip.duration.toFixed(2) +
          "s · " +
          (selectedMotion.partner ? "PARTNER · " : "") +
          (selectedMotion.finishCandidate ? "FINISH CANDIDATE · " : "") +
          "source skeleton only",
      );
    }).catch(error => {
      if (!cancelled) {
        setPlayerStatus("BVH load failed: " + (error instanceof Error ? error.message : "unknown error"));
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

  const moveSelection = (delta: number) => {
    if (!selectedMotion || visibleMotions.length < 2) return;
    const index = visibleMotions.findIndex(motion => motion.id === selectedMotion.id);
    const nextIndex = (index + delta + visibleMotions.length) % visibleMotions.length;
    setSelectedId(visibleMotions[nextIndex].id);
    setPlaying(true);
  };

  const markDecision = (decision: ReviewDecision) => {
    if (!selectedMotion) return;
    const currentId = selectedMotion.id;
    const index = visibleMotions.findIndex(motion => motion.id === currentId);
    const next = visibleMotions[index + 1] ?? visibleMotions.find(motion => motion.id !== currentId);

    setReview(previous => ({ ...previous, [currentId]: decision }));
    setReviewMessage(decision === "keep" ? "Đã giữ source " + currentId : "Đã loại source " + currentId);
    if (next) {
      setSelectedId(next.id);
      setPlaying(true);
    }
  };

  const clearCurrentDecision = () => {
    if (!selectedMotion) return;
    setReview(previous => {
      const next = { ...previous };
      delete next[selectedMotion.id];
      return next;
    });
    setReviewMessage("Đã bỏ đánh dấu source " + selectedMotion.id);
  };

  const markModeFit = (decision: ModeFitDecision) => {
    if (!selectedMotion || modeFilter === "all") return;
    const key = modeFitKey(modeFilter, selectedMotion.id);
    setModeFit(previous => ({ ...previous, [key]: decision }));
    setReviewMessage(
      decision === "fit"
        ? selectedMotion.id + " → hợp " + MODE_LABELS[modeFilter]
        : selectedMotion.id + " → loại khỏi " + MODE_LABELS[modeFilter] + " (source vẫn được giữ nếu chưa reject)",
    );
  };

  const clearModeFit = () => {
    if (!selectedMotion || modeFilter === "all") return;
    const key = modeFitKey(modeFilter, selectedMotion.id);
    setModeFit(previous => {
      const next = { ...previous };
      delete next[key];
      return next;
    });
    setReviewMessage("Đã bỏ đánh dấu mode-fit cho " + selectedMotion.id);
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

  const copyReview = async () => {
    const modeDecisions = (Object.keys(MODE_LABELS) as CuratedGameModeId[]).flatMap(mode =>
      motions.flatMap(motion => {
        const decision = modeFit[modeFitKey(mode, motion.id)];
        return decision ? [{ id: motion.id, mode, decision }] : [];
      }),
    );

    const payload = JSON.stringify({
      schemaVersion: 2,
      catalog: "Animation Library Curation V2 + MVP Mode Policy V1",
      reviewedAt: new Date().toISOString(),
      sourceReviewSummary: reviewCounts,
      sourceDecisions: motions
        .filter(motion => review[motion.id])
        .map(motion => ({
          id: motion.id,
          decision: review[motion.id],
          style: motion.style,
          status: motion.status,
          choreographyGroup: motion.choreographyGroup,
        })),
      suggestedModePools: Object.fromEntries(
        (Object.keys(MODE_LABELS) as CuratedGameModeId[]).map(mode => [
          mode,
          motions.filter(motion => motion.modes.includes(mode)).map(motion => motion.id),
        ]),
      ),
      modeFitDecisions: modeDecisions,
    }, null, 2);

    try {
      await navigator.clipboard.writeText(payload);
      setReviewMessage("Đã copy review JSON gồm source + mode-fit — bạn có thể dán gửi lại cho tôi.");
    } catch {
      const blob = new Blob([payload], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = "Audition_Animation_Curation_V2_Mode_Review.json";
      anchor.click();
      URL.revokeObjectURL(url);
      setReviewMessage("Clipboard không khả dụng; đã tạo file review JSON.");
    }
  };

  const resetReview = () => {
    if (!window.confirm("Xóa toàn bộ quyết định Source Giữ/Loại và Mode-fit trên thiết bị này?")) return;
    setReview({});
    setModeFit({});
    setReviewMessage("Đã xóa toàn bộ owner review trên thiết bị này.");
  };

  const currentDecision = selectedMotion ? review[selectedMotion.id] : undefined;
  const currentModeFit =
    selectedMotion && modeFilter !== "all"
      ? modeFit[modeFitKey(modeFilter, selectedMotion.id)]
      : undefined;

  return (
    <section id="source-animation-demo" style={styles.card}>
      <div style={styles.headingRow}>
        <div>
          <p style={styles.eyebrow}>CURATION V2 · MVP MODE POLICY</p>
          <h2 style={styles.title}>Animation mode demo — 73 retained</h2>
          <p style={styles.lead}>
            {catalogStatus}. Mode pool là metadata đề xuất để review; không phải runtime Game Mode implementation
            và không thay đổi gameplay/WebAudio.
          </p>
        </div>
        <span style={styles.badge}>SOURCE ONLY</span>
      </div>

      <div>
        <p style={styles.sectionLabel}>GAME MODE POOL</p>
        <div style={styles.modeGrid}>
          <button type="button" onClick={() => setModeFilter("all")} style={modeButton(modeFilter === "all")}>
            <strong>Tất cả library</strong>
            <small>{motions.length} source</small>
          </button>
          {(Object.keys(MODE_LABELS) as CuratedGameModeId[]).map(mode => {
            const count = motions.filter(motion => motion.modes.includes(mode)).length;
            return (
              <button key={mode} type="button" onClick={() => setModeFilter(mode)} style={modeButton(modeFilter === mode)}>
                <strong>{MODE_LABELS[mode]}</strong>
                <small>{count} source · {MODE_RELEASE_LABELS[mode]}</small>
              </button>
            );
          })}
        </div>
      </div>

      {modeFilter !== "all" ? (
        <div style={styles.modePanel}>
          <div style={styles.modePanelHeader}>
            <div>
              <p style={styles.sectionLabel}>ĐỀ XUẤT · {MODE_RELEASE_LABELS[modeFilter]}</p>
              <strong style={styles.modeTitle}>{MODE_LABELS[modeFilter]}</strong>
            </div>
            <span style={styles.modeCount}>{modePool.length} motions</span>
          </div>
          <p style={styles.modeDescription}>{MODE_DESCRIPTIONS[modeFilter]}</p>
          <div style={styles.modeFitSummary}>
            <span>✓ Hợp {modeFitCounts.fit}</span>
            <span>✕ Loại {modeFitCounts.exclude}</span>
            <span>· Chưa {modeFitCounts.unreviewed}</span>
          </div>
          <div style={styles.modeFitFilters}>
            {([
              ["all", "Tất cả"],
              ["unreviewed", "Chưa đánh giá"],
              ["fit", "Hợp mode"],
              ["exclude", "Không hợp"],
            ] as const).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setModeFitFilter(value)}
                style={reviewFilterButton(modeFitFilter === value)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div style={styles.modeNote}>
          8 Utility/Reaction source hiện cố ý không gán vào gameplay mode. Chúng vẫn nằm trong library cho Waiting Room,
          reaction/event và có thể được dùng sau.
        </div>
      )}

      <div style={styles.reviewPanel}>
        <div style={styles.reviewHeader}>
          <div>
            <p style={styles.sectionLabel}>SOURCE QUALITY REVIEW</p>
            <strong style={styles.reviewHeadline}>
              ✓ {reviewCounts.keep} giữ · ✕ {reviewCounts.reject} loại · {reviewCounts.unreviewed} chưa xem
            </strong>
          </div>
          <span style={styles.reviewSaved}>{reviewReady ? "Auto-saved" : "Loading…"}</span>
        </div>

        <div style={styles.decisionButtons}>
          <button
            type="button"
            disabled={!selectedMotion}
            onClick={() => markDecision("keep")}
            style={decisionButton("keep", currentDecision === "keep")}
          >
            ✓ GIỮ SOURCE
          </button>
          <button
            type="button"
            disabled={!selectedMotion}
            onClick={() => markDecision("reject")}
            style={decisionButton("reject", currentDecision === "reject")}
          >
            ✕ LOẠI SOURCE
          </button>
          <button type="button" disabled={!currentDecision} onClick={clearCurrentDecision} style={styles.clearDecisionButton}>
            Bỏ
          </button>
        </div>

        {modeFilter !== "all" ? (
          <div style={styles.modeDecisionRow}>
            <button
              type="button"
              disabled={!selectedMotion}
              onClick={() => markModeFit("fit")}
              style={modeFitButton("fit", currentModeFit === "fit")}
            >
              ✓ HỢP {MODE_LABELS[modeFilter]}
            </button>
            <button
              type="button"
              disabled={!selectedMotion}
              onClick={() => markModeFit("exclude")}
              style={modeFitButton("exclude", currentModeFit === "exclude")}
            >
              ✕ KHÔNG HỢP MODE
            </button>
            <button type="button" disabled={!currentModeFit} onClick={clearModeFit} style={styles.clearDecisionButton}>
              Bỏ
            </button>
          </div>
        ) : null}

        <div style={styles.reviewFilters}>
          {([
            ["all", "Tất cả " + motions.length],
            ["unreviewed", "Chưa " + reviewCounts.unreviewed],
            ["keep", "Giữ " + reviewCounts.keep],
            ["reject", "Loại " + reviewCounts.reject],
          ] as const).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setReviewFilter(value)}
              style={reviewFilterButton(reviewFilter === value)}
            >
              {label}
            </button>
          ))}
        </div>

        <div style={styles.reviewActions}>
          <button type="button" onClick={copyReview} style={styles.secondaryButton}>Copy review JSON</button>
          <button type="button" onClick={resetReview} style={styles.dangerLink}>Xóa review</button>
        </div>
        {reviewMessage ? <div style={styles.reviewMessage}>{reviewMessage}</div> : null}
      </div>

      <div>
        <p style={styles.sectionLabel}>STYLE FILTER</p>
        <div style={styles.styleGrid}>
          <button type="button" onClick={() => setStyleFilter("all")} style={styleButton(styleFilter === "all")}>
            Tất cả style
          </button>
          {(Object.keys(STYLE_LABELS) as CuratedStyleId[]).map(style => {
            const count = modePool.filter(motion => motion.style === style).length;
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
          Curation status
          <select value={statusFilter} onChange={event => setStatusFilter(event.target.value as StatusFilter)} style={styles.select}>
            <option value="all">Tất cả retained status</option>
            {(Object.keys(STATUS_LABELS) as CuratedStatus[]).map(status => (
              <option key={status} value={status}>{STATUS_LABELS[status]}</option>
            ))}
          </select>
        </label>

        <label style={styles.selectorLabel}>
          Animation · {visibleMotions.length} kết quả
          <select
            value={selectedMotion?.id ?? ""}
            disabled={!visibleMotions.length}
            onChange={event => setSelectedId(event.target.value)}
            style={styles.select}
          >
            {visibleMotions.map(motion => (
              <option key={motion.id} value={motion.id}>
                {reviewSymbol(review[motion.id])} {motion.id} · {motion.title}
              </option>
            ))}
          </select>
        </label>
      </div>

      {selectedMotion ? (
        <>
          <div style={styles.metaGrid}>
            <span style={styles.metaCell}><strong style={styles.metaValue}>{STYLE_LABELS[selectedMotion.style]}</strong><small style={styles.metaLabel}>Style</small></span>
            <span style={styles.metaCell}><strong style={styles.metaValue}>{STATUS_LABELS[selectedMotion.status]}</strong><small style={styles.metaLabel}>Curation</small></span>
            <span style={styles.metaCell}><strong style={styles.metaValue}>{selectedMotion.origin}</strong><small style={styles.metaLabel}>Source batch</small></span>
            <span style={styles.metaCell}><strong style={styles.metaValue}>{selectedMotion.choreographyGroup}</strong><small style={styles.metaLabel}>Choreography group</small></span>
            <span style={styles.metaCellWide}>
              <strong style={styles.metaValueWrap}>
                {selectedMotion.modes.length
                  ? selectedMotion.modes.map(mode => MODE_LABELS[mode]).join(" · ")
                  : "Utility / Reaction only"}
              </strong>
              <small style={styles.metaLabel}>Suggested modes</small>
            </span>
          </div>

          {selectedMotion.partner ? (
            <div style={styles.partnerWarning}>
              PARTNER — choreography này giả định performer thứ hai; chỉ phù hợp Social/Couple review, không phải solo Normal.
            </div>
          ) : null}

          {selectedMotion.finishCandidate ? (
            <div style={styles.finishWarning}>
              FINISH CANDIDATE — chỉ là animation role cho Showdown/Special. Finish vẫn là Level 9 command; AUDIO END mới kết thúc game.
            </div>
          ) : null}
        </>
      ) : (
        <div style={styles.emptyState}>Không có animation khớp bộ lọc. Đổi Mode / Style / Status / Review filter để tiếp tục.</div>
      )}

      <div ref={hostRef} style={styles.canvasHost} aria-label="Curation V2 mode-aware source animation preview" />
      <div style={styles.status}>{playerStatus}</div>

      <div style={styles.controls}>
        <button type="button" onClick={() => moveSelection(-1)} disabled={visibleMotions.length < 2} style={styles.controlButton}>← Trước</button>
        <button type="button" onClick={() => setPlaying(value => !value)} style={styles.controlButton}>
          {playing ? "Ⅱ Pause" : "▶ Play"}
        </button>
        <button type="button" onClick={restart} style={styles.controlButton}>↺ Restart</button>
        <button type="button" onClick={() => moveSelection(1)} disabled={visibleMotions.length < 2} style={styles.controlButton}>Sau →</button>
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
        Mode policy V1 chỉ phân loại source để review: Classic / Team Battle / Showdown cho MVP và Couple sau MVP.
        Một animation có thể thuộc nhiều mode. Không retarget, không sửa 8 Moonlight frozen, không thay Character Catalog,
        không implement Game Mode runtime và không chạm gameplay timeline.
      </p>
    </section>
  );
}

const modeButton = (active: boolean): CSSProperties => ({
  minWidth: 0,
  display: "grid",
  gap: 3,
  textAlign: "left",
  border: active ? "1px solid #a486ef" : "1px solid #3b4352",
  background: active ? "#2c2247" : "#171c26",
  color: active ? "#f3edff" : "#c3cad6",
  borderRadius: 11,
  padding: "10px 9px",
  fontSize: 10,
});

const styleButton = (active: boolean): CSSProperties => ({
  border: active ? "1px solid #9e80ed" : "1px solid #343c4c",
  background: active ? "#2b2145" : "#171c26",
  color: active ? "#f2ebff" : "#aab3c3",
  borderRadius: 10,
  padding: "9px 8px",
  fontWeight: 850,
  fontSize: 10,
});

const reviewFilterButton = (active: boolean): CSSProperties => ({
  border: active ? "1px solid #9e80ed" : "1px solid #3a4352",
  background: active ? "#2b2145" : "#171c25",
  color: active ? "#f2ebff" : "#b8c0cf",
  borderRadius: 999,
  padding: "7px 9px",
  fontSize: 9,
  fontWeight: 850,
});

const decisionButton = (kind: ReviewDecision, active: boolean): CSSProperties => ({
  flex: 1,
  minHeight: 46,
  border: active ? (kind === "keep" ? "2px solid #68d391" : "2px solid #fc8181") : "1px solid #414958",
  background: active ? (kind === "keep" ? "#183828" : "#3d1c21") : "#171c25",
  color: active ? "#ffffff" : "#dfe5ef",
  borderRadius: 11,
  fontWeight: 950,
  fontSize: 11,
});

const modeFitButton = (kind: ModeFitDecision, active: boolean): CSSProperties => ({
  flex: 1,
  minHeight: 42,
  border: active ? (kind === "fit" ? "2px solid #63b3ed" : "2px solid #f6ad55") : "1px solid #414958",
  background: active ? (kind === "fit" ? "#17314a" : "#3b2817") : "#171c25",
  color: active ? "#ffffff" : "#dfe5ef",
  borderRadius: 10,
  fontWeight: 900,
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
  modeGrid: { display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 6 },
  modePanel: { display: "grid", gap: 8, padding: 10, border: "1px solid #4c4363", borderRadius: 12, background: "#171421" },
  modePanelHeader: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 },
  modeTitle: { color: "#f2edfb", fontSize: 13 },
  modeCount: { borderRadius: 999, background: "#242b3a", color: "#b8c4d6", padding: "5px 7px", fontSize: 8, fontWeight: 850 },
  modeDescription: { margin: 0, color: "#a4adbd", fontSize: 10, lineHeight: 1.45 },
  modeFitSummary: { display: "flex", flexWrap: "wrap", gap: 8, color: "#c5cedb", fontSize: 9, fontWeight: 800 },
  modeFitFilters: { display: "flex", flexWrap: "wrap", gap: 5 },
  modeNote: { padding: "9px 10px", borderRadius: 10, background: "#171c25", color: "#9aa5b6", fontSize: 10, lineHeight: 1.4 },
  reviewPanel: { display: "grid", gap: 9, padding: 10, border: "1px solid #49405d", borderRadius: 12, background: "#171421" },
  reviewHeader: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 },
  reviewHeadline: { color: "#f2eef9", fontSize: 12 },
  reviewSaved: { borderRadius: 999, background: "#202637", color: "#a9b5c7", padding: "5px 7px", fontSize: 8, fontWeight: 800 },
  decisionButtons: { display: "flex", gap: 7 },
  modeDecisionRow: { display: "flex", gap: 7, paddingTop: 3, borderTop: "1px solid #302b3c" },
  clearDecisionButton: { minHeight: 42, border: "1px solid #414958", background: "#202632", color: "#aeb8c8", borderRadius: 10, padding: "0 9px", fontSize: 9, fontWeight: 800 },
  reviewFilters: { display: "flex", gap: 5, flexWrap: "wrap" },
  reviewActions: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 },
  secondaryButton: { border: "1px solid #4b5669", background: "#202735", color: "#e2e8f1", borderRadius: 9, padding: "8px 9px", fontSize: 9, fontWeight: 850 },
  dangerLink: { border: 0, background: "transparent", color: "#a88f93", padding: 7, fontSize: 9, fontWeight: 800 },
  reviewMessage: { color: "#aeb9ca", fontSize: 9, lineHeight: 1.4 },
  styleGrid: { display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 6 },
  filterRow: { display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 7 },
  selectorLabel: { display: "grid", gap: 5, minWidth: 0, color: "#9da7b8", fontSize: 10, fontWeight: 850 },
  select: { width: "100%", minWidth: 0, border: "1px solid #45405a", background: "#171520", color: "#edf0f6", borderRadius: 10, padding: "10px 9px", fontWeight: 800 },
  metaGrid: { display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 6 },
  metaCell: { display: "grid", gap: 2, minWidth: 0, padding: "8px 9px", borderRadius: 9, background: "#171520" },
  metaCellWide: { gridColumn: "1 / -1", display: "grid", gap: 2, minWidth: 0, padding: "8px 9px", borderRadius: 9, background: "#171520" },
  metaValue: { minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "#e8e3f4", fontSize: 11 },
  metaValueWrap: { color: "#e8e3f4", fontSize: 10, lineHeight: 1.35 },
  metaLabel: { color: "#7f899a", fontSize: 8, fontWeight: 800, textTransform: "uppercase", letterSpacing: ".08em" },
  partnerWarning: { padding: "8px 9px", borderRadius: 9, border: "1px solid #705c32", background: "#2b2416", color: "#f1d99b", fontSize: 10, lineHeight: 1.4, fontWeight: 750 },
  finishWarning: { padding: "8px 9px", borderRadius: 9, border: "1px solid #713d4b", background: "#2b1720", color: "#f4bac8", fontSize: 10, lineHeight: 1.4, fontWeight: 750 },
  emptyState: { padding: 14, borderRadius: 10, background: "#171c25", color: "#a7b0bf", fontSize: 10, textAlign: "center" },
  canvasHost: { width: "100%", height: "min(52vh, 460px)", minHeight: 320, overflow: "hidden", borderRadius: 12, background: "#0a0d14", touchAction: "none" },
  status: { minHeight: 16, padding: "0 3px", color: "#8f9aab", fontSize: 10 },
  controls: { display: "flex", gap: 7, alignItems: "center", flexWrap: "wrap" },
  controlButton: { border: "1px solid #3a4352", background: "#1a202a", color: "#d8deea", borderRadius: 10, padding: "10px 11px", fontWeight: 850 },
  speedLabel: { display: "flex", alignItems: "center", gap: 6, marginLeft: "auto", color: "#8f99aa", fontSize: 11, fontWeight: 800 },
  speedSelect: { border: "1px solid #3a4352", background: "#171c25", color: "#e1e6ef", borderRadius: 9, padding: "8px 9px", fontWeight: 800 },
  note: { margin: 0, padding: 9, borderRadius: 10, background: "#171521", color: "#8f94a7", fontSize: 10, lineHeight: 1.45 },
};
