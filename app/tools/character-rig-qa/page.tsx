"use client";

import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

const MODELS = {
  male: { label: "Nam_co_ban" },
  female: { label: "Nu_co_ban" },
} as const;

type ModelId = keyof typeof MODELS;

export default function CharacterRigQaPage() {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const modelRef = useRef<THREE.Object3D | null>(null);
  const mixerRef = useRef<THREE.AnimationMixer | null>(null);
  const clipsRef = useRef<Map<string, THREE.AnimationClip>>(new Map());
  const actionRef = useRef<THREE.AnimationAction | null>(null);
  const helperRef = useRef<THREE.SkeletonHelper | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const playingRef = useRef(true);
  const speedRef = useRef(1);
  const localFilesRef = useRef<Record<ModelId, ArrayBuffer | null>>({ male: null, female: null });

  const [modelId, setModelId] = useState<ModelId>("male");
  const [loadedFiles, setLoadedFiles] = useState<Record<ModelId, string | null>>({ male: null, female: null });
  const [loadNonce, setLoadNonce] = useState(0);
  const [selectedClip, setSelectedClip] = useState("");
  const [availableClips, setAvailableClips] = useState<string[]>([]);
  const [status, setStatus] = useState("Choose the rigged QA GLB files below.");
  const [rigStats, setRigStats] = useState("—");
  const [playing, setPlaying] = useState(true);
  const [showBones, setShowBones] = useState(false);
  const [speed, setSpeed] = useState(1);

  const stopCurrentModel = useCallback(() => {
    const scene = sceneRef.current;
    const model = modelRef.current;
    const helper = helperRef.current;
    const mixer = mixerRef.current;
    if (mixer) {
      mixer.stopAllAction();
      if (model) mixer.uncacheRoot(model);
    }
    if (helper && scene) scene.remove(helper);
    if (model && scene) scene.remove(model);
    if (helper) helper.dispose();
    if (model) disposeObjectTree(model);
    actionRef.current = null;
    helperRef.current = null;
    modelRef.current = null;
    mixerRef.current = null;
    clipsRef.current = new Map();
  }, []);

  const playClip = useCallback((name: string) => {
    const mixer = mixerRef.current;
    const clip = clipsRef.current.get(name);
    if (!mixer || !clip) return false;
    actionRef.current?.stop();
    const oneShot = /miss|finish|reaction/i.test(name);
    const action = mixer.clipAction(clip);
    action.reset();
    action.enabled = true;
    action.clampWhenFinished = oneShot;
    action.setLoop(oneShot ? THREE.LoopOnce : THREE.LoopRepeat, oneShot ? 1 : Infinity);
    action.setEffectiveTimeScale(speedRef.current);
    action.setEffectiveWeight(1);
    action.play();
    action.paused = !playingRef.current;
    actionRef.current = action;
    return true;
  }, []);

  const showRestPose = useCallback(() => {
    actionRef.current?.stop();
    actionRef.current = null;
    mixerRef.current?.stopAllAction();
    modelRef.current?.traverse(object => {
      const mesh = object as THREE.SkinnedMesh;
      if (mesh.isSkinnedMesh && mesh.skeleton) mesh.skeleton.pose();
    });
    modelRef.current?.updateMatrixWorld(true);
    setSelectedClip("");
    setPlaying(false);
    playingRef.current = false;
  }, []);

  const handleLocalFile = useCallback(async (id: ModelId, file: File | undefined) => {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".glb")) {
      setStatus("Please choose a .glb file.");
      return;
    }
    setStatus("Reading " + file.name + "…");
    try {
      localFilesRef.current[id] = await file.arrayBuffer();
      setLoadedFiles(current => ({ ...current, [id]: file.name }));
      setModelId(id);
      setPlaying(true);
      setLoadNonce(value => value + 1);
    } catch (error) {
      setStatus("File read failed: " + (error instanceof Error ? error.message : "unknown error"));
    }
  }, []);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a0d14);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(36, 1, 0.01, 50);
    camera.position.set(0, 0.55, 2.25);
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("webgl2") ?? canvas.getContext("webgl");
    if (!context) {
      setStatus("WebGL is unavailable on this device.");
      return;
    }

    const renderer = new THREE.WebGLRenderer({ canvas, context, antialias: true, alpha: false });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.08;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    host.appendChild(renderer.domElement);

    scene.add(new THREE.HemisphereLight(0xcad4ff, 0x17131e, 1.8));
    const key = new THREE.DirectionalLight(0xffffff, 2.3);
    key.position.set(2.5, 4.5, 4);
    scene.add(key);
    const rim = new THREE.DirectionalLight(0xa982ff, 1.4);
    rim.position.set(-3, 2.2, -2.5);
    scene.add(rim);

    const floor = new THREE.Mesh(
      new THREE.CircleGeometry(0.72, 64),
      new THREE.MeshStandardMaterial({ color: 0x151b28, roughness: 0.72, metalness: 0.14 }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -0.003;
    scene.add(floor);
    const grid = new THREE.GridHelper(1.5, 12, 0x8a70c8, 0x283148);
    grid.position.y = 0.002;
    (grid.material as THREE.Material).transparent = true;
    (grid.material as THREE.Material).opacity = 0.22;
    scene.add(grid);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.target.set(0, 0.52, 0);
    controls.minDistance = 1.15;
    controls.maxDistance = 4;
    controls.enablePan = false;
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
    const animate = () => {
      raf = requestAnimationFrame(animate);
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
    animate();

    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
      stopCurrentModel();
      controls.dispose();
      controlsRef.current = null;
      disposeObjectTree(scene);
      renderer.dispose();
      if (renderer.domElement.parentElement === host) host.removeChild(renderer.domElement);
      sceneRef.current = null;
    };
  }, [stopCurrentModel]);

  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;
    let cancelled = false;
    stopCurrentModel();
    setRigStats("—");
    setAvailableClips([]);

    const sourceBuffer = localFilesRef.current[modelId];
    if (!sourceBuffer) {
      setStatus("Choose the rigged QA GLB for " + MODELS[modelId].label + ".");
      return;
    }

    setStatus("Loading " + (loadedFiles[modelId] ?? MODELS[modelId].label) + "…");
    void new GLTFLoader().parseAsync(sourceBuffer.slice(0), "").then(gltf => {
      if (cancelled) {
        disposeObjectTree(gltf.scene);
        return;
      }
      const model = gltf.scene;
      model.updateMatrixWorld(true);
      const bounds = new THREE.Box3().setFromObject(model, true);
      const size = bounds.getSize(new THREE.Vector3());
      if (!(size.y > 0)) throw new Error("model has invalid bounds");
      const center = bounds.getCenter(new THREE.Vector3());
      model.position.x -= center.x;
      model.position.y -= bounds.min.y;
      model.position.z -= center.z;
      model.updateMatrixWorld(true);

      let skinnedCount = 0;
      let boneCount = 0;
      model.traverse(object => {
        const mesh = object as THREE.SkinnedMesh;
        if (!mesh.isSkinnedMesh) return;
        skinnedCount += 1;
        boneCount = Math.max(boneCount, mesh.skeleton.bones.length);
        mesh.frustumCulled = false;
      });
      if (!skinnedCount || !boneCount) throw new Error("QA model has no usable skin/skeleton");

      const clipMap = new Map(gltf.animations.map(clip => [clip.name, clip] as const));

      const mixer = new THREE.AnimationMixer(model);
      modelRef.current = model;
      mixerRef.current = mixer;
      clipsRef.current = clipMap;
      scene.add(model);

      const helper = new THREE.SkeletonHelper(model);
      helper.visible = showBones;
      helperRef.current = helper;
      scene.add(helper);

      const fitted = new THREE.Box3().setFromObject(model, true);
      const fittedSize = fitted.getSize(new THREE.Vector3());
      const fittedCenter = fitted.getCenter(new THREE.Vector3());
      const controls = controlsRef.current;
      if (controls) {
        controls.target.copy(fittedCenter);
        const camera = controls.object as THREE.PerspectiveCamera;
        camera.position.set(fittedCenter.x, fittedCenter.y + fittedSize.y * 0.04, fittedCenter.z + Math.max(1.35, fittedSize.y * 1.65));
        camera.lookAt(fittedCenter);
        controls.update();
      }

      const clipNames = gltf.animations.map(clip => clip.name);
      setAvailableClips(clipNames);
      const initial = selectedClip && clipMap.has(selectedClip) ? selectedClip : (clipNames[0] ?? "");
      setSelectedClip(initial);
      setRigStats(skinnedCount + " skinned mesh · " + boneCount + " bones · " + gltf.animations.length + " clips");
      const fileName = loadedFiles[modelId] ?? MODELS[modelId].label;
      const flavor = fileName.includes("MESHY_TEXTURED_RIG")
        ? "Meshy auto-rig · original PBR restored"
        : "rigged GLB";
      setStatus(fileName + " ready · " + flavor);
      if (initial) playClip(initial);
      else showRestPose();
    }).catch(error => {
      if (!cancelled) setStatus("Load failed: " + (error instanceof Error ? error.message : "unknown error"));
    });

    return () => { cancelled = true; };
  }, [modelId, loadNonce, playClip, showRestPose, stopCurrentModel]);

  useEffect(() => {
    if (helperRef.current) helperRef.current.visible = showBones;
  }, [showBones]);

  useEffect(() => {
    playingRef.current = playing;
    speedRef.current = speed;
    const action = actionRef.current;
    if (!action) return;
    action.paused = !playing;
    action.setEffectiveTimeScale(speed);
  }, [playing, speed]);

  const chooseClip = (name: string) => {
    setSelectedClip(name);
    setPlaying(true);
    playingRef.current = true;
    playClip(name);
  };

  return (
    <main style={styles.page}>
      <div style={styles.shell}>
        <header style={styles.header}>
          <div>
            <p style={styles.eyebrow}>CHARACTER · RIG QA</p>
            <h1 style={styles.title}>Nam / Nữ Meshy rig test</h1>
            <p style={styles.lead}>Load any rigged GLB, inspect the rest pose and every embedded animation clip, and verify skin deformation + restored materials before Character Catalog integration. This route remains isolated from gameplay.</p>
          </div>
          <span style={styles.badge}>QA ONLY</span>
        </header>

        <section style={styles.card}>
          <p style={styles.sectionLabel}>LOCAL QA FILES</p>
          <div style={styles.fileGrid}>
            {(Object.keys(MODELS) as ModelId[]).map(id => (
              <label key={id} style={fileLabelStyle(Boolean(loadedFiles[id]))}>
                <strong>{id === "male" ? "♂ Nam" : "♀ Nữ"}</strong>
                <span style={styles.fileName}>{loadedFiles[id] ?? "Choose rigged .glb"}</span>
                <input type="file" style={{ display: "none" }} onChange={event => void handleLocalFile(id, event.target.files?.[0])} />
              </label>
            ))}
          </div>
          <div style={styles.segmented}>
            {(Object.keys(MODELS) as ModelId[]).map(id => (
              <button key={id} type="button" disabled={!loadedFiles[id]} onClick={() => setModelId(id)} style={segmentStyle(modelId === id && Boolean(loadedFiles[id]), !loadedFiles[id])}>
                View {id === "male" ? "Nam" : "Nữ"}
              </button>
            ))}
          </div>
        </section>

        <section style={styles.previewCard}>
          <div ref={hostRef} style={styles.canvasHost} aria-label="Rig animation QA preview" />
          <div style={styles.statusRow}><span>{status}</span><span>{rigStats}</span></div>
        </section>

        <section style={styles.card}>
          <p style={styles.sectionLabel}>ANIMATION</p>
          <div style={styles.clipGrid}>
            <button type="button" onClick={showRestPose} style={clipButtonStyle(selectedClip === "")}>
              Rest Pose
            </button>
            {availableClips.map(name => (
              <button key={name} type="button" onClick={() => chooseClip(name)} style={clipButtonStyle(selectedClip === name)}>
                {name}
              </button>
            ))}
            {availableClips.length === 0 ? <span style={styles.emptyClip}>No embedded animation clips</span> : null}
          </div>
          <div style={styles.controls}>
            <button type="button" onClick={() => setPlaying(value => !value)} style={styles.controlButton}>{playing ? "Ⅱ Pause" : "▶ Play"}</button>
            <button type="button" onClick={() => playClip(selectedClip)} style={styles.controlButton}>↺ Restart</button>
            <button type="button" onClick={() => setShowBones(value => !value)} style={showBones ? styles.controlActive : styles.controlButton}>{showBones ? "✓ Bones" : "Bones"}</button>
            <label style={styles.speedLabel}>Speed
              <select value={speed} onChange={event => setSpeed(Number(event.target.value))} style={styles.select}>
                <option value={0.5}>0.5×</option><option value={0.75}>0.75×</option><option value={1}>1×</option><option value={1.25}>1.25×</option>
              </select>
            </label>
          </div>
        </section>

        <section style={styles.notes}>
          <strong>Inspect</strong>
          <p style={styles.noteText}>Check shoulders/armpits · elbows · wrists · neck/head · hips/crotch · knees · ankles, then compare Rest Pose against each embedded clip. The current Meshy files embed Running (Nam) / Walking (Nữ); Audition dance clips will be added only after motion extraction is validated.</p>
        </section>
      </div>
    </main>
  );
}

function disposeObjectTree(root: THREE.Object3D) {
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  const textures = new Set<THREE.Texture>();
  const skeletons = new Set<THREE.Skeleton>();
  root.traverse(object => {
    const mesh = object as THREE.Mesh;
    if (mesh.geometry) geometries.add(mesh.geometry);
    const list = Array.isArray(mesh.material) ? mesh.material : mesh.material ? [mesh.material] : [];
    for (const material of list) {
      materials.add(material);
      for (const value of Object.values(material)) if (value instanceof THREE.Texture) textures.add(value);
    }
    const skinned = object as THREE.SkinnedMesh;
    if (skinned.isSkinnedMesh && skinned.skeleton) skeletons.add(skinned.skeleton);
  });
  for (const texture of textures) texture.dispose();
  for (const material of materials) material.dispose();
  for (const geometry of geometries) geometry.dispose();
  for (const skeleton of skeletons) skeleton.dispose();
}

const fileLabelStyle = (loaded: boolean): CSSProperties => ({ display: "grid", gap: 4, minWidth: 0, cursor: "pointer", border: loaded ? "1px solid #66cdb5" : "1px dashed #465064", background: loaded ? "#14332f" : "#151a23", color: loaded ? "#dffbf4" : "#c2c9d5", borderRadius: 12, padding: "11px 12px" });
const segmentStyle = (active: boolean, disabled = false): CSSProperties => ({ flex: 1, border: active ? "1px solid #a880ff" : "1px solid #343c4c", background: active ? "#2b2145" : "#171c26", color: disabled ? "#596273" : active ? "#f2ebff" : "#aab3c3", opacity: disabled ? 0.55 : 1, borderRadius: 11, padding: "11px 12px", fontWeight: 900 });
const clipButtonStyle = (active: boolean): CSSProperties => ({ border: active ? "1px solid #8ee7cf" : "1px solid #3a4251", background: active ? "#153a35" : "#181d27", color: active ? "#dffcf4" : "#c3cad6", borderRadius: 11, minHeight: 44, padding: "10px 8px", fontWeight: 850 });

const styles: Record<string, CSSProperties> = {
  page: { minHeight: "100vh", background: "#090c12", color: "#f5f7fb", padding: "16px 12px 40px", fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" },
  shell: { width: "100%", maxWidth: 760, margin: "0 auto", display: "grid", gap: 12 },
  header: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 },
  eyebrow: { margin: 0, color: "#a985ef", fontSize: 10, fontWeight: 950, letterSpacing: ".13em" },
  title: { margin: "5px 0 6px", fontSize: "clamp(25px, 7vw, 36px)", lineHeight: 1.05 },
  lead: { margin: 0, maxWidth: 590, color: "#929cad", fontSize: 12, lineHeight: 1.48 },
  badge: { flex: "0 0 auto", border: "1px solid #6f527d", background: "#241b2d", color: "#dbb9e5", borderRadius: 999, padding: "6px 9px", fontSize: 9, fontWeight: 950, letterSpacing: ".1em" },
  card: { display: "grid", gap: 9, padding: 11, border: "1px solid #293140", borderRadius: 15, background: "#11161f" },
  previewCard: { display: "grid", gap: 8, padding: 8, border: "1px solid #293140", borderRadius: 16, background: "#11161f" },
  sectionLabel: { margin: 0, color: "#7f899a", fontSize: 9, fontWeight: 950, letterSpacing: ".12em" },
  fileGrid: { display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 8 },
  fileName: { minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "#8f99aa", fontSize: 10 },
  segmented: { display: "flex", gap: 8 },
  canvasHost: { width: "100%", height: "min(62vh, 560px)", minHeight: 390, overflow: "hidden", borderRadius: 12, background: "#0a0d14", touchAction: "none" },
  statusRow: { display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap", padding: "2px 4px 3px", color: "#8f9aab", fontSize: 10 },
  clipGrid: { display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 7 },
  emptyClip: { gridColumn: "1 / -1", color: "#7f899a", fontSize: 11, padding: "8px 4px" },
  controls: { display: "flex", gap: 7, alignItems: "center", flexWrap: "wrap" },
  controlButton: { border: "1px solid #3a4352", background: "#1a202a", color: "#d8deea", borderRadius: 10, padding: "10px 11px", fontWeight: 850 },
  controlActive: { border: "1px solid #9a7ee4", background: "#2b2242", color: "#f0e9ff", borderRadius: 10, padding: "10px 11px", fontWeight: 850 },
  speedLabel: { display: "flex", alignItems: "center", gap: 6, marginLeft: "auto", color: "#8f99aa", fontSize: 11, fontWeight: 800 },
  select: { border: "1px solid #3a4352", background: "#171c25", color: "#e1e6ef", borderRadius: 9, padding: "8px 9px", fontWeight: 800 },
  notes: { padding: 11, borderRadius: 13, border: "1px solid #302b42", background: "#151320", color: "#c9bedf", fontSize: 11, lineHeight: 1.45 },
  noteText: { margin: "4px 0 0", color: "#8f94a7" },
};
