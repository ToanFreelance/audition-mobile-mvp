"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { resolveCharacterAssetUrl, type CharacterAssetId } from "./character-catalog";
import { disposeObjectResources } from "./CharacterActor";
import { NORMALIZED_CHARACTER_HEIGHT } from "./framing";
import styles from "./CharacterCreationStage3D.module.css";

export type CharacterCreatorFocus = "hair" | "face" | "body" | "outfit" | "accessory" | "shoes";

type Props = {
  yaw: number;
  focus: CharacterCreatorFocus;
  assetId: CharacterAssetId;
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

function easeOutCubic(value: number) {
  return 1 - Math.pow(1 - value, 3);
}

export default function CharacterCreationStage3D({ yaw, focus, assetId }: Props) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const modelRef = useRef<THREE.Object3D | null>(null);
  const renderRef = useRef<(() => void) | null>(null);
  const focusRef = useRef<((nextFocus: CharacterCreatorFocus, animate?: boolean) => void) | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "fallback">("loading");

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    let disposed = false;
    let focusRaf = 0;
    setState("loading");
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x08091f);
    scene.fog = new THREE.FogExp2(0x08091f, 0.055);

    const initialFrame = PREVIEW_FRAMES[focus];
    const camera = new THREE.PerspectiveCamera(initialFrame.fov, 1, 0.1, 50);
    camera.position.set(0, initialFrame.cameraY, initialFrame.cameraZ);
    const lookTarget = new THREE.Vector3(0, initialFrame.targetY, 0);
    camera.lookAt(lookTarget);

    const canvas = document.createElement("canvas");
    const context = canvas.getContext("webgl2");
    if (!context) {
      setState("fallback");
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

    scene.add(new THREE.HemisphereLight(0xbec8ff, 0x130923, 1.65));
    const key = new THREE.DirectionalLight(0xffe6f7, 2.4);
    key.position.set(3, 6, 5);
    scene.add(key);

    const rim = new THREE.DirectionalLight(0x63dfff, 1.7);
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
      renderer.render(scene, camera);
    };
    renderRef.current = render;

    const applyFocus = (nextFocus: CharacterCreatorFocus, animate = true) => {
      const frame = PREVIEW_FRAMES[nextFocus];
      cancelAnimationFrame(focusRaf);

      const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (!animate || reducedMotion) {
        camera.position.y = frame.cameraY;
        camera.position.z = frame.cameraZ;
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
        camera.position.z = THREE.MathUtils.lerp(startPosition.z, frame.cameraZ, eased);
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

    const resize = () => {
      const width = Math.max(1, host.clientWidth);
      const height = Math.max(1, host.clientHeight);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      const mobile = window.matchMedia("(pointer: coarse)").matches || width <= 768;
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, mobile ? 1.25 : 1.6));
      renderer.setSize(width, height, false);
      render();
    };

    const observer = new ResizeObserver(resize);
    observer.observe(host);
    resize();

    const loader = new GLTFLoader();
    const assetUrl = resolveCharacterAssetUrl(assetId);
    host.dataset.characterAssetId = assetId;
    void loader.loadAsync(assetUrl)
      .then(gltf => {
        if (disposed) {
          disposeObjectResources(gltf.scene);
          return;
        }
        normalizePreview(gltf.scene);
        gltf.scene.rotation.y = yaw;
        modelRef.current = gltf.scene;
        scene.add(gltf.scene);
        host.dataset.characterSource = assetId;
        setState("ready");
        applyFocus(focus, false);
      })
      .catch(error => {
        if (disposed) return;
        console.warn("[C3] Character creation preview failed", error);
        setState("fallback");
      });

    return () => {
      disposed = true;
      cancelAnimationFrame(focusRaf);
      observer.disconnect();
      focusRef.current = null;
      renderRef.current = null;
      modelRef.current = null;
      disposeObjectResources(scene);
      renderer.dispose();
      if (renderer.domElement.parentElement === host) host.removeChild(renderer.domElement);
      scene.clear();
    };
  }, [assetId]);

  useEffect(() => {
    if (!modelRef.current) return;
    modelRef.current.rotation.y = yaw;
    modelRef.current.updateMatrixWorld(true);
    renderRef.current?.();
  }, [yaw]);

  useEffect(() => {
    focusRef.current?.(focus, true);
  }, [focus]);

  return (
    <div
      className={styles.host}
      data-focus={focus}
      data-preview-state={state}
      data-testid="c2-character-stage"
      ref={hostRef}
    >
      {state === "loading" && <div className={styles.status}>Đang tải nhân vật…</div>}
      {state === "fallback" && <div className={styles.status}>Không thể mở 3D preview</div>}
    </div>
  );
}
