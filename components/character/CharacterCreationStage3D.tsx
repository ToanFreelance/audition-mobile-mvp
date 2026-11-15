"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { getCharacterCatalogEntry, resolveCharacterAssetUrl, type CharacterAssetId } from "./character-catalog";
import { M3CharacterAssembler, type M3Appearance } from "./m3-character-assembler";
import { disposeObjectResources } from "./CharacterActor";
import { NORMALIZED_CHARACTER_HEIGHT } from "./framing";
import styles from "./CharacterCreationStage3D.module.css";

export type CharacterCreatorFocus = "hair" | "face" | "body" | "outfit" | "accessory" | "shoes";

type Props = {
  yaw: number;
  focus: CharacterCreatorFocus;
  assetId: CharacterAssetId;
  appearance?: M3Appearance;
  onReadyChange?: (ready: boolean) => void;
};

type QualityPreset = "A" | "B" | "C" | "D";
type RenderDiagnostics = {
  deviceDpr: number; cap: number; requestedDpr: number; actualDpr: number;
  cssSize: string; bufferSize: string; megapixels: string;
  geometries: number; textures: number; faceMaps: string; faceSampling: string;
};
const QUALITY_LABELS: Record<QualityPreset, string> = {
  A: "A · Gốc — DPR 1.25, ACES, đèn gốc",
  B: "B · Nét — DPR 1.5, đèn/ACES như A",
  C: "C · Đèn — DPR 1.5, ánh sáng hiệu chỉnh, ACES",
  D: "D · Tone — DPR 1.5, đèn gốc, Neutral thay ACES",
};

type PreviewFrame = {
  fov: number;
  cameraY: number;
  cameraZ: number;
  targetY: number;
};

const PREVIEW_FRAMES: Record<CharacterCreatorFocus, PreviewFrame> = {
  hair: { fov: 26, cameraY: 3.02, cameraZ: 2.25, targetY: 3.02 },
  face: { fov: 24, cameraY: 3.08, cameraZ: 1.78, targetY: 3.08 },
  body: { fov: 34, cameraY: 2.25, cameraZ: 7.2, targetY: 1.72 },
  outfit: { fov: 30, cameraY: 2.18, cameraZ: 5.05, targetY: 1.88 },
  accessory: { fov: 28, cameraY: 2.42, cameraZ: 4.55, targetY: 2.18 },
  shoes: { fov: 28, cameraY: 1.02, cameraZ: 4.45, targetY: 0.72 },
};

function normalizePreview(model: THREE.Object3D) {
  model.updateMatrixWorld(true);
  const initial = new THREE.Box3().setFromObject(model);
  const size = initial.getSize(new THREE.Vector3());
  if (!(size.y > 0) || !Number.isFinite(size.y)) throw new Error("Character preview has invalid bounds.");

  model.scale.multiplyScalar(NORMALIZED_CHARACTER_HEIGHT / size.y);
  model.updateMatrixWorld(true);

  const bounds = new THREE.Box3().setFromObject(model);
  const center = bounds.getCenter(new THREE.Vector3());
  model.position.set(-center.x, -bounds.min.y, -center.z);
  model.updateMatrixWorld(true);
}

/**
 * Screen-space studio backdrop: light lavender behind the silhouette and dark
 * violet around the edges. Readable for both light and deep skin / dark outfits.
 * One small texture per creator preview; never touches avatar materials.
 */
function makeM3StudioBackground(): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 512;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Unable to create M3 preview background");
  const base = ctx.createLinearGradient(0, 0, 0, canvas.height);
  base.addColorStop(0, "#302946");
  base.addColorStop(0.38, "#524963");
  base.addColorStop(0.68, "#44415f");
  base.addColorStop(1, "#1b1939");
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  const halo = ctx.createRadialGradient(128, 205, 8, 128, 205, 290);
  halo.addColorStop(0, "rgba(210,196,224,0.50)");
  halo.addColorStop(0.38, "rgba(175,156,202,0.36)");
  halo.addColorStop(0.75, "rgba(100,94,145,0.11)");
  halo.addColorStop(1, "rgba(100,94,145,0)");
  ctx.fillStyle = halo;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function easeOutCubic(value: number) {
  return 1 - Math.pow(1 - value, 3);
}

export default function CharacterCreationStage3D({ yaw, focus, assetId, appearance, onReadyChange }: Props) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const modelRef = useRef<THREE.Object3D | null>(null);
  const assemblerRef = useRef<M3CharacterAssembler | null>(null);
  const appearanceRef = useRef<M3Appearance | undefined>(appearance);
  const onReadyRef = useRef(onReadyChange);
  onReadyRef.current = onReadyChange;
  const yawRef = useRef(yaw);
  yawRef.current = yaw;
  appearanceRef.current = appearance;
  const renderRef = useRef<(() => void) | null>(null);
  const focusRef = useRef<((nextFocus: CharacterCreatorFocus, animate?: boolean) => void) | null>(null);
  const orbitRef = useRef<((nextYaw: number) => void) | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "fallback">("loading");
  // Removable in-preview QA presets: never persisted in avatar/profile.
  const [qualityPreset, setQualityPreset] = useState<QualityPreset>("A");
  const presetRef = useRef(qualityPreset);
  presetRef.current = qualityPreset;
  const applyQualityRef = useRef<((preset: QualityPreset) => void) | null>(null);
  const readDiagnosticsRef = useRef<(() => void) | null>(null);
  const [showDiagnostics, setShowDiagnostics] = useState(false);
  const showDiagnosticsRef = useRef(showDiagnostics);
  showDiagnosticsRef.current = showDiagnostics;
  const [diagnostics, setDiagnostics] = useState<RenderDiagnostics | null>(null);
  const m3Preview = Boolean(getCharacterCatalogEntry(assetId)?.m3RigFamily);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    let disposed = false;
    let focusRaf = 0;
    setState("loading");
    onReadyRef.current?.(false);
    const isM3Creator = Boolean(getCharacterCatalogEntry(assetId)?.m3RigFamily);
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x08091f);
    scene.fog = new THREE.FogExp2(0x08091f, 0.055);

    const initialFrame = PREVIEW_FRAMES[focus];
    const camera = new THREE.PerspectiveCamera(initialFrame.fov, 1, 0.1, 50);
    camera.position.set(0, initialFrame.cameraY, initialFrame.cameraZ);
    const lookTarget = new THREE.Vector3(0, initialFrame.targetY, 0);
    camera.lookAt(lookTarget);
    let activeFocus: CharacterCreatorFocus = focus;
    // M3 uses detached SkinnedMesh binding: NEVER scale, translate or rotate
    // its canonical VRM rig after assembly. Frame it using the camera only.
    let m3View: { centerX: number; centerZ: number; minY: number; ratio: number } | null = null;

    // A portrait tablet uses a tall, narrow stage pane beside its controls.
    // Increase only its presentation distance to prevent head cropping.
    // The accepted iPhone framing and all normal/wide desktop frames are unchanged.
    const cameraDistance = (baselineZ: number) => {
      if (window.innerWidth < 768 || camera.aspect >= 0.68) return baselineZ;
      return baselineZ * Math.min(1.4, 0.68 / Math.max(0.1, camera.aspect));
    };

    const canvas = document.createElement("canvas");
    const context = canvas.getContext("webgl2");
    if (!context) {
      setState("fallback");
      onReadyRef.current?.(false);
      return;
    }

    const renderer = new THREE.WebGLRenderer({
      canvas,
      context,
      antialias: true,
      alpha: false,
      powerPreference: "high-performance",
    });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.03;
    renderer.domElement.className = styles.canvas;
    host.appendChild(renderer.domElement);

    // Presentation-only lighting. A lighter, neutral studio halo gives real
    // dark skin, hair and black garments enough silhouette contrast without
    // recoloring M3 textures or modifying source garment materials.
    const studioBackground = isM3Creator ? makeM3StudioBackground() : null;
    if (studioBackground) {
      scene.background = studioBackground;
      scene.fog = new THREE.FogExp2(0x403a59, 0.028);
    }
    const hemisphere = new THREE.HemisphereLight(
      isM3Creator ? 0xf3edff : 0xbec8ff,
      isM3Creator ? 0x635e79 : 0x130923,
      isM3Creator ? 1.75 : 1.65,
    );
    scene.add(hemisphere);
    const key = new THREE.DirectionalLight(isM3Creator ? 0xfff3eb : 0xffe6f7, isM3Creator ? 2.2 : 2.4);
    key.position.set(3, 6, 5);
    scene.add(key);

    let faceFill: THREE.DirectionalLight | null = null;
    if (isM3Creator) {
      // Neutral forward fill is important for dark-skin material visibility.
      faceFill = new THREE.DirectionalLight(0xeae9ff, 1.25);
      faceFill.position.set(-2.6, 2.5, 5);
      scene.add(faceFill);
    }
    const rim = new THREE.DirectionalLight(isM3Creator ? 0xa8d9ff : 0x63dfff, isM3Creator ? 1.6 : 1.7);
    rim.position.set(-4, 3, -1);
    scene.add(rim);

    const floor = new THREE.Mesh(
      new THREE.CircleGeometry(2.35, 64),
      new THREE.MeshStandardMaterial({
        color: 0x111034,
        emissive: 0x24105c,
        emissiveIntensity: 0.42,
        roughness: 0.48,
        metalness: 0.42,
      }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -0.01;
    scene.add(floor);

    const ring = new THREE.Mesh(
      new THREE.RingGeometry(1.42, 1.49, 72),
      new THREE.MeshBasicMaterial({
        color: 0x5fe9ff,
        transparent: true,
        opacity: 0.62,
        side: THREE.DoubleSide,
      }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.006;
    scene.add(ring);

    const pinkRing = new THREE.Mesh(
      new THREE.RingGeometry(1.72, 1.76, 72),
      new THREE.MeshBasicMaterial({
        color: 0xff56d9,
        transparent: true,
        opacity: 0.26,
        side: THREE.DoubleSide,
      }),
    );
    pinkRing.rotation.x = -Math.PI / 2;
    pinkRing.position.y = 0.008;
    scene.add(pinkRing);

    const render = () => {
      if (disposed) return;
      host.dataset.previewCameraDistance = camera.position.z.toFixed(3);
      renderer.render(scene, camera);
    };
    renderRef.current = render;

    const viewFrame = (key: CharacterCreatorFocus) => {
      const frame = PREVIEW_FRAMES[key];
      const ratio = m3View?.ratio ?? 1;
      const minY = m3View?.minY ?? 0;
      return {
        cameraY: minY + frame.cameraY * ratio,
        cameraZ: cameraDistance(frame.cameraZ * ratio),
        targetY: minY + frame.targetY * ratio,
        fov: frame.fov,
      };
    };
    const setOrbit = (distance: number, nextYaw: number) => {
      if (!m3View) {
        camera.position.x = 0;
        camera.position.z = distance;
        lookTarget.x = 0;
        lookTarget.z = 0;
        return;
      }
      // Camera-orbit rotation does not touch the SkinnedMesh bind space.
      camera.position.x = m3View.centerX + Math.sin(nextYaw) * distance;
      camera.position.z = m3View.centerZ + Math.cos(nextYaw) * distance;
      lookTarget.x = m3View.centerX;
      lookTarget.z = m3View.centerZ;
    };
    orbitRef.current = nextYaw => {
      if (!m3View) return;
      const distance = Math.hypot(camera.position.x - m3View.centerX, camera.position.z - m3View.centerZ);
      setOrbit(distance, nextYaw);
      camera.lookAt(lookTarget);
      render();
    };

    const applyFocus = (nextFocus: CharacterCreatorFocus, animate = true) => {
      activeFocus = nextFocus;
      const frame = viewFrame(nextFocus);
      const fittedZ = frame.cameraZ;
      cancelAnimationFrame(focusRaf);

      const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (!animate || reducedMotion) {
        camera.position.y = frame.cameraY;
        setOrbit(fittedZ, yawRef.current);
        camera.fov = frame.fov;
        lookTarget.y = frame.targetY;
        camera.lookAt(lookTarget);
        camera.updateProjectionMatrix();
        render();
        return;
      }

      const startPosition = camera.position.clone();
      const startTargetY = lookTarget.y;
      const startFov = camera.fov;
      const startedAt = performance.now();
      const durationMs = 340;

      const step = (now: number) => {
        if (disposed) return;
        const progress = Math.min(1, (now - startedAt) / durationMs);
        const eased = easeOutCubic(progress);
        camera.position.y = THREE.MathUtils.lerp(startPosition.y, frame.cameraY, eased);
        const desiredX = m3View ? m3View.centerX + Math.sin(yawRef.current) * fittedZ : 0;
        const desiredZ = m3View ? m3View.centerZ + Math.cos(yawRef.current) * fittedZ : fittedZ;
        camera.position.x = THREE.MathUtils.lerp(startPosition.x, desiredX, eased);
        camera.position.z = THREE.MathUtils.lerp(startPosition.z, desiredZ, eased);
        camera.fov = THREE.MathUtils.lerp(startFov, frame.fov, eased);
        lookTarget.y = THREE.MathUtils.lerp(startTargetY, frame.targetY, eased);
        camera.lookAt(lookTarget);
        camera.updateProjectionMatrix();
        render();
        if (progress < 1) focusRaf = requestAnimationFrame(step);
      };

      focusRaf = requestAnimationFrame(step);
    };
    focusRef.current = applyFocus;

    // Event-driven canvas; FPS sampling would be misleading.
    // WebGL object counts below are not actual GPU memory allocations.
    const mobileViewport = () => window.matchMedia("(pointer: coarse)").matches || host.clientWidth <= 768;
    const pixelRatioCap = () => mobileViewport() ? (presetRef.current === "A" ? 1.25 : 1.5) : 1.6;
    const configureResolution = () => {
      const width = Math.max(1, host.clientWidth);
      const height = Math.max(1, host.clientHeight);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, pixelRatioCap()));
      renderer.setSize(width, height, false);
    };
    const readDiagnostics = () => {
      if (disposed || !showDiagnosticsRef.current) return;
      const buffer = renderer.getDrawingBufferSize(new THREE.Vector2());
      const faceMaps = new Set<string>();
      const faceSampling = new Set<string>();
      modelRef.current?.traverse(node => {
        const mesh = node as THREE.Mesh;
        if (!mesh.isMesh || !/headbaked|head_geobaked|headgeobaked/i.test(mesh.name)) return;
        const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        for (const material of materials) {
          const map = (material as THREE.MeshStandardMaterial).map;
          if (!map) continue;
          const image = map.image as { width?: number; height?: number } | undefined;
          if (image?.width && image?.height) faceMaps.add(String(image.width) + "×" + String(image.height));
          const minFilter = map.minFilter === THREE.LinearMipmapLinearFilter ? "trilinear" :
            map.minFilter === THREE.LinearMipmapNearestFilter ? "linear / nearest mip" :
            map.minFilter === THREE.LinearFilter ? "linear" : String(map.minFilter);
          const magFilter = map.magFilter === THREE.LinearFilter ? "linear" : String(map.magFilter);
          faceSampling.add(minFilter + "/" + magFilter + ", mip=" + String(map.generateMipmaps) + ", " + map.colorSpace);
        }
      });
      const width = Math.max(1, host.clientWidth);
      const height = Math.max(1, host.clientHeight);
      setDiagnostics({
        deviceDpr: window.devicePixelRatio || 1,
        cap: pixelRatioCap(),
        requestedDpr: Math.min(window.devicePixelRatio || 1, pixelRatioCap()),
        actualDpr: renderer.getPixelRatio(),
        cssSize: width + "×" + height,
        bufferSize: buffer.x + "×" + buffer.y,
        megapixels: ((buffer.x * buffer.y) / 1_000_000).toFixed(2),
        geometries: renderer.info.memory.geometries,
        textures: renderer.info.memory.textures,
        faceMaps: [...faceMaps].join(", ") || "chưa đọc được",
        faceSampling: [...faceSampling].join("; ") || "chưa đọc được",
      });
    };
    readDiagnosticsRef.current = readDiagnostics;
    const applyQuality = (preset: QualityPreset) => {
      // Do not change camera, model, skeleton, garments or actor lifecycle.
      presetRef.current = preset;
      const calibrated = isM3Creator && preset === "C";
      hemisphere.intensity = calibrated ? 1.35 : (isM3Creator ? 1.75 : 1.65);
      key.intensity = calibrated ? 1.95 : (isM3Creator ? 2.2 : 2.4);
      if (faceFill) faceFill.intensity = calibrated ? 1.05 : 1.25;
      rim.intensity = calibrated ? 1.45 : (isM3Creator ? 1.6 : 1.7);
      renderer.toneMapping = isM3Creator && preset === "D" ? THREE.NeutralToneMapping : THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.03;
      configureResolution();
      render();
      readDiagnostics();
    };
    applyQualityRef.current = applyQuality;

    const resize = () => {
      const width = Math.max(1, host.clientWidth);
      const height = Math.max(1, host.clientHeight);
      camera.aspect = width / height;
      const frame = viewFrame(activeFocus);
      setOrbit(frame.cameraZ, yawRef.current);
      camera.lookAt(lookTarget);
      camera.updateProjectionMatrix();
      configureResolution();
      render();
      readDiagnostics();
    };
    const observer = new ResizeObserver(resize);
    observer.observe(host);
    applyQuality(presetRef.current);
    resize();

    const loader = new GLTFLoader();
    const entry = getCharacterCatalogEntry(assetId);
    const assetUrl = resolveCharacterAssetUrl(assetId);
    host.dataset.characterAssetId = assetId;
    const loadModel: Promise<{ root: THREE.Object3D; assembly: M3CharacterAssembler | null }> =
      entry?.m3RigFamily
        ? M3CharacterAssembler.create(assetId, appearanceRef.current ?? entry.defaultAppearance)
            .then(assembly => ({ root: assembly.root, assembly }))
        : loader.loadAsync(assetUrl).then(gltf => ({ root: gltf.scene, assembly: null }));
    void loadModel
      .then(async ({ root, assembly }) => {
        if (disposed) {
          if (assembly) assembly.dispose();
          else disposeObjectResources(root);
          return;
        }
        try {
          if (assembly && appearanceRef.current) await assembly.updateAppearance(appearanceRef.current);
          if (disposed) {
            if (assembly) assembly.dispose();
            else disposeObjectResources(root);
            return;
          }
          if (assembly) {
            // Regression root cause: detached SkinnedMesh bind + scaling an
            // ancestor doubles the transform on clothing/eyes. The owner-PASS
            // M3 demo keeps the rig at its original VRM world scale.
            root.updateMatrixWorld(true);
            const box = new THREE.Box3().setFromObject(root);
            const height = box.getSize(new THREE.Vector3()).y;
            if (!(height > 0) || !Number.isFinite(height)) throw new Error("M3 avatar has invalid world bounds");
            const center = box.getCenter(new THREE.Vector3());
            const ratio = height / NORMALIZED_CHARACTER_HEIGHT;
            m3View = { centerX: center.x, centerZ: center.z, minY: box.min.y, ratio };
            // Stage decorations can scale independently; NEVER the M3 actor.
            floor.scale.setScalar(ratio);
            floor.position.set(center.x, box.min.y - 0.01 * ratio, center.z);
            ring.scale.setScalar(ratio);
            ring.position.set(center.x, box.min.y + 0.006 * ratio, center.z);
            pinkRing.scale.setScalar(ratio);
            pinkRing.position.set(center.x, box.min.y + 0.008 * ratio, center.z);
            host.dataset.m3WorldHeight = height.toFixed(3);
            host.dataset.m3CameraScale = ratio.toFixed(4);
          } else {
            normalizePreview(root);
            root.rotation.y = yawRef.current;
          }
          modelRef.current = root;
          assemblerRef.current = assembly;
          scene.add(root);
          host.dataset.characterSource = assetId;
          host.dataset.m3Bones = String(assembly?.skeleton?.bones.length ?? 0);
          host.dataset.m3BaseLoads = String(assembly?.baseLoads ?? 0);
          host.dataset.m3BindDelta = String(assembly?.maxBindDelta ?? 0);
          setState("ready");
          onReadyRef.current?.(true);
          applyFocus(activeFocus, false);
          readDiagnostics();
        } catch (error) {
          if (assembly) assembly.dispose();
          else disposeObjectResources(root);
          throw error;
        }
      })
      .catch(error => {
        if (disposed) return;
        console.warn("[C3] Character creation preview failed", error);
        host.dataset.previewError = error instanceof Error ? error.message : String(error);
        setState("fallback");
        onReadyRef.current?.(false);
      });

    return () => {
      disposed = true;
      cancelAnimationFrame(focusRaf);
      observer.disconnect();
      focusRef.current = null;
      orbitRef.current = null;
      renderRef.current = null;
      applyQualityRef.current = null;
      readDiagnosticsRef.current = null;
      modelRef.current = null;
      assemblerRef.current?.dispose();
      assemblerRef.current = null;
      disposeObjectResources(scene);
      studioBackground?.dispose();
      renderer.dispose();
      if (renderer.domElement.parentElement === host) host.removeChild(renderer.domElement);
      scene.clear();
    };
  }, [assetId]);

  useEffect(() => {
    const assembly = assemblerRef.current;
    if (!assembly || !appearance) return;
    let active = true;
    onReadyRef.current?.(false); // Prevent saving an appearance still loading.
    void assembly.updateAppearance(appearance).then(() => {
      if (!active) return;
      if (hostRef.current) delete hostRef.current.dataset.previewError;
      setState("ready");
      onReadyRef.current?.(true);
      renderRef.current?.();
      readDiagnosticsRef.current?.();
    }).catch(error => {
      if (!active) return;
      console.warn("[C3] M3 appearance update failed", error);
      if (hostRef.current) hostRef.current.dataset.previewError = error instanceof Error ? error.message : String(error);
      setState("fallback");
      onReadyRef.current?.(false);
    });
    return () => { active = false; };
  }, [assetId, appearance?.hairStyle, appearance?.hairColor, appearance?.skinTone, appearance?.m3Outfit?.top, appearance?.m3Outfit?.bottom]);

  useEffect(() => {
    if (!modelRef.current) return;
    if (assemblerRef.current) {
      orbitRef.current?.(yaw);
      return;
    }
    modelRef.current.rotation.y = yaw;
    modelRef.current.updateMatrixWorld(true);
    renderRef.current?.();
  }, [yaw]);

  useEffect(() => {
    focusRef.current?.(focus, true);
  }, [focus]);

  useEffect(() => {
    applyQualityRef.current?.(qualityPreset);
  }, [qualityPreset]);

  useEffect(() => {
    if (showDiagnostics) readDiagnosticsRef.current?.();
  }, [showDiagnostics]);

  return (
    <div
      className={styles.host}
      data-focus={focus}
      data-preview-state={state}
      data-testid="c2-character-stage"
      ref={hostRef}
    >
      {m3Preview && (
        <div
          className={styles.qualityTest}
          data-testid="m3-facial-quality-test"
          onPointerDown={event => event.stopPropagation()}
          onPointerMove={event => event.stopPropagation()}
          onPointerUp={event => event.stopPropagation()}
          onPointerCancel={event => event.stopPropagation()}
        >
          <div className={styles.qualityControls} aria-label="Thử chất lượng render khuôn mặt">
            {(["A", "B", "C", "D"] as const).map(preset => (
              <button
                key={preset}
                type="button"
                aria-label={QUALITY_LABELS[preset]}
                aria-pressed={qualityPreset === preset}
                title={QUALITY_LABELS[preset]}
                data-testid={"m3-facial-preset-" + preset}
                className={qualityPreset === preset ? styles.qualityActive : ""}
                onClick={() => setQualityPreset(preset)}
              >{preset}</button>
            ))}
            <button
              type="button"
              aria-label={showDiagnostics ? "Ẩn chẩn đoán render" : "Hiện chẩn đoán render"}
              aria-expanded={showDiagnostics}
              className={showDiagnostics ? styles.qualityActive : ""}
              onClick={() => setShowDiagnostics(current => !current)}
            >i</button>
          </div>
          {showDiagnostics && (
            <div className={styles.qualityDiagnostics} role="status" data-testid="m3-facial-diagnostics">
              <strong>Facial Fidelity V1.7 · {qualityPreset}</strong>
              <span>A: gốc · B: nét · C: đèn · D: Neutral</span>
              {diagnostics ? (
                <>
                  <span>DPR máy {diagnostics.deviceDpr} · cap {diagnostics.cap}</span>
                  <span>DPR yêu cầu {diagnostics.requestedDpr} · renderer {diagnostics.actualDpr}</span>
                  <span>CSS {diagnostics.cssSize} · buffer {diagnostics.bufferSize}</span>
                  <span>Pixels {diagnostics.megapixels} MP · geometry {diagnostics.geometries} · texture {diagnostics.textures}</span>
                  <span>Face map: {diagnostics.faceMaps}</span>
                  <span>Face filter: {diagnostics.faceSampling}</span>
                  <small>Đếm WebGL ≠ VRAM. Không đo FPS/GPU time.</small>
                </>
              ) : <span>Đang đọc renderer…</span>}
            </div>
          )}
        </div>
      )}
      {state === "loading" && <div className={styles.status}>Đang tải nhân vật…</div>}
      {state === "fallback" && <div className={styles.status}>Không thể mở 3D preview</div>}
    </div>
  );
}
