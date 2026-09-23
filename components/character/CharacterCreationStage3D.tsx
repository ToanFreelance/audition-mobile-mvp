"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { C1_CASUAL_GRACE_ASSET_URL } from "./mixamo-character-adapter";
import { disposeObjectResources } from "./CharacterActor";
import { NORMALIZED_CHARACTER_HEIGHT } from "./framing";
import styles from "./CharacterCreationStage3D.module.css";

export type CharacterCreatorFocus = "hair" | "face" | "body" | "outfit" | "accessory" | "shoes";

type Props = {
  yaw: number;
  focus: CharacterCreatorFocus;
};

type PreviewFrame = {
  fov: number;
  cameraY: number;
  cameraZ: number;
  targetY: number;
};

type DetailAnchors = {
  topY: number;
  neckY: number;
  shoulderY: number;
  bodyHeight: number;
};

// Body / outfit / accessory / shoes were owner-reviewed as acceptable in C2.1.
// Hair and face are calibrated dynamically from the loaded character below.
const BASE_PREVIEW_FRAMES: Record<CharacterCreatorFocus, PreviewFrame> = {
  hair: { fov: 26, cameraY: 3.0, cameraZ: 2.25, targetY: 3.0 },
  face: { fov: 24, cameraY: 3.05, cameraZ: 1.85, targetY: 3.05 },
  body: { fov: 34, cameraY: 2.25, cameraZ: 7.2, targetY: 1.72 },
  outfit: { fov: 30, cameraY: 2.18, cameraZ: 5.05, targetY: 1.88 },
  accessory: { fov: 28, cameraY: 2.42, cameraZ: 4.55, targetY: 2.18 },
  shoes: { fov: 28, cameraY: 1.02, cameraZ: 4.45, targetY: 0.72 },
};

function normalizePreview(model: THREE.Object3D) {
  model.updateMatrixWorld(true);
  const initial = new THREE.Box3().setFromObject(model, true);
  const size = initial.getSize(new THREE.Vector3());
  if (!(size.y > 0) || !Number.isFinite(size.y)) throw new Error("Character preview has invalid bounds.");

  model.scale.multiplyScalar(NORMALIZED_CHARACTER_HEIGHT / size.y);
  model.updateMatrixWorld(true);

  const bounds = new THREE.Box3().setFromObject(model, true);
  const center = bounds.getCenter(new THREE.Vector3());
  model.position.set(-center.x, -bounds.min.y, -center.z);
  model.updateMatrixWorld(true);
}

function canonicalMixamoName(value: string) {
  return value.toLowerCase().replace(/^mixamorig[:_]?/, "").replace(/[^a-z0-9]/g, "");
}

function findBone(root: THREE.Object3D, semanticName: string) {
  const wanted = canonicalMixamoName(semanticName);
  let result: THREE.Bone | null = null;
  root.traverse(object => {
    if (result || !(object as THREE.Bone).isBone) return;
    if (canonicalMixamoName(object.name) === wanted) result = object as THREE.Bone;
  });
  return result;
}

function collectDetailAnchors(model: THREE.Object3D): DetailAnchors | null {
  model.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(model, true);
  const size = bounds.getSize(new THREE.Vector3());
  const neck = findBone(model, "Neck");
  const leftShoulder = findBone(model, "LeftShoulder");
  const rightShoulder = findBone(model, "RightShoulder");
  if (!neck || !leftShoulder || !rightShoulder || !(size.y > 0)) return null;

  const neckY = neck.getWorldPosition(new THREE.Vector3()).y;
  const leftShoulderY = leftShoulder.getWorldPosition(new THREE.Vector3()).y;
  const rightShoulderY = rightShoulder.getWorldPosition(new THREE.Vector3()).y;

  return {
    topY: bounds.max.y,
    neckY,
    shoulderY: (leftShoulderY + rightShoulderY) * 0.5,
    bodyHeight: size.y,
  };
}

function distanceForVerticalView(viewHeight: number, verticalFovDegrees: number) {
  const halfFov = THREE.MathUtils.degToRad(verticalFovDegrees * 0.5);
  return (viewHeight * 0.5) / Math.tan(halfFov);
}

function resolvePreviewFrame(focus: CharacterCreatorFocus, anchors: DetailAnchors | null): PreviewFrame {
  const base = BASE_PREVIEW_FRAMES[focus];
  if (!anchors || (focus !== "hair" && focus !== "face")) return base;

  const { topY, neckY, shoulderY, bodyHeight } = anchors;

  if (focus === "hair") {
    // Hair customization should show the complete hairstyle and shoulder line,
    // not the torso. Keep a small amount below the shoulder bones so the
    // silhouette remains readable while rotating side/back views.
    const lowerY = shoulderY - bodyHeight * 0.035;
    const regionHeight = Math.max(bodyHeight * 0.18, topY - lowerY);
    const viewHeight = regionHeight / 0.80;
    const targetY = (topY + lowerY) * 0.5;
    return {
      fov: 26,
      cameraY: targetY,
      cameraZ: distanceForVerticalView(viewHeight, 26),
      targetY,
    };
  }

  // Face customization intentionally uses a tighter head/neck crop. The mesh
  // top includes the hairstyle, while the neck bone gives a stable lower
  // anatomical anchor independent of screen/device aspect ratio.
  const lowerY = neckY - bodyHeight * 0.012;
  const regionHeight = Math.max(bodyHeight * 0.14, topY - lowerY);
  const viewHeight = regionHeight / 0.91;
  const targetY = (topY + lowerY) * 0.5;
  return {
    fov: 24,
    cameraY: targetY,
    cameraZ: distanceForVerticalView(viewHeight, 24),
    targetY,
  };
}

function easeOutCubic(value: number) {
  return 1 - Math.pow(1 - value, 3);
}

export default function CharacterCreationStage3D({ yaw, focus }: Props) {
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
    let detailAnchors: DetailAnchors | null = null;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x08091f);
    scene.fog = new THREE.FogExp2(0x08091f, 0.055);

    const initialFrame = BASE_PREVIEW_FRAMES[focus];
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
      const frame = resolvePreviewFrame(nextFocus, detailAnchors);
      cancelAnimationFrame(focusRaf);

      host.dataset.cameraFocus = nextFocus;
      host.dataset.cameraTargetY = frame.targetY.toFixed(3);
      host.dataset.cameraDistance = frame.cameraZ.toFixed(3);

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
    void loader.loadAsync(C1_CASUAL_GRACE_ASSET_URL)
      .then(gltf => {
        if (disposed) {
          disposeObjectResources(gltf.scene);
          return;
        }
        normalizePreview(gltf.scene);
        gltf.scene.rotation.y = yaw;
        modelRef.current = gltf.scene;
        scene.add(gltf.scene);
        detailAnchors = collectDetailAnchors(gltf.scene);
        host.dataset.characterSource = "c1-casual-grace";
        host.dataset.framingSource = detailAnchors ? "skeleton-bounds" : "fallback-presets";
        setState("ready");
        applyFocus(focus, false);
      })
      .catch(error => {
        if (disposed) return;
        console.warn("[C2] Character creation preview failed", error);
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
  }, []);

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
