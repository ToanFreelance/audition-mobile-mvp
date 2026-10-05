"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import type { CameraPreset } from "./PortraitGameMenu";
import { CharacterActor, disposeObjectResources } from "./character/CharacterActor";
import type { CharacterPresentationEvent } from "./character/character-types";
import { CHARACTER_STAGE_POSITION, getCharacterCameraFrame } from "./character/framing";
import { DEFAULT_CHARACTER_CREATION_PROFILE, loadCharacterCreationDraft } from "./character/character-profile";
import {
  DEFAULT_STAGE_ID,
  resolveRuntimeStageCatalogEntry,
  resolveStageCatalogEntry,
} from "./stage/stage-catalog";
import { createStageEnvironment } from "./stage/stage-runtime";
import { getStagePresentationCameraPose, type StageCameraPose } from "./stage/stageCamera";

const COLORS = { pink: 0xff4fd8, cyan: 0x62d8ff, violet: 0x8c7dff, floor: 0x130f28 };
const MOBILE_DPR_CAP = 1.25;
const MOBILE_NEON_DPR_CAP = 1.25;
const NEON_CHARACTER_STAGE_Z_OFFSET = 2.0;
const DESKTOP_DPR_CAP = 1.6;

function isMobileStageProfile() {
  return window.matchMedia("(pointer: coarse)").matches || window.innerWidth <= 768;
}

function getStagePixelRatio(neonPresentation: boolean) {
  const mobileProfile = isMobileStageProfile();
  const cap = mobileProfile
    ? (neonPresentation ? MOBILE_NEON_DPR_CAP : MOBILE_DPR_CAP)
    : DESKTOP_DPR_CAP;
  return Math.min(window.devicePixelRatio || 1, cap);
}

function getNeonGameplayCameraFrame(frame: ReturnType<typeof getCharacterCameraFrame>, portrait: boolean) {
  if (!portrait) return frame;
  return {
    ...frame,
    fov: Math.max(42, frame.fov + 4),
    y: frame.y + 0.72,
    z: frame.z + 9.4,
    targetY: frame.targetY + 0.08,
  };
}

function getNeonPresentationPose(
  pose: StageCameraPose,
  neonPresentation: boolean,
  portrait: boolean,
): StageCameraPose {
  if (!neonPresentation || !portrait || pose.preset !== "gameplay_portrait_locked") return pose;
  return {
    ...pose,
    fov: Math.max(42, pose.fov + 4),
    y: pose.y + 0.72,
    z: pose.z + 9.4,
    targetY: pose.targetY + 0.08,
  };
}

function applyNeonCharacterFill(root: THREE.Object3D) {
  const cloned = new Map<string, THREE.MeshStandardMaterial>();

  root.traverse(object => {
    const mesh = object as THREE.Mesh;
    if (!mesh.isMesh) return;

    const sources = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    const next = sources.map(source => {
      if (!(source instanceof THREE.MeshStandardMaterial)) return source;

      const cached = cloned.get(source.uuid);
      if (cached) return cached;

      const material = source.clone();
      if (material.map) {
        // Reuse the albedo texture as a very soft self-fill so skin, hair and
        // clothes keep their authored colors instead of receiving white emissive.
        material.emissive.setHex(0xffffff);
        material.emissiveMap = material.map;
        material.emissiveIntensity = 0.185;
      } else {
        material.emissive.copy(material.color);
        material.emissiveIntensity = Math.min(
          0.10,
          Math.max(material.emissiveIntensity, 0.065),
        );
      }
      material.needsUpdate = true;
      cloned.set(source.uuid, material);
      return material;
    });

    mesh.material = Array.isArray(mesh.material) ? next : next[0];
  });
}

type Stage3DProps = {
  cameraPreset?: CameraPreset;
  isPlaying?: boolean;
  characterEvent?: CharacterPresentationEvent | null;
  getSongTimeMs?: () => number;
  bpm?: number;
  selectedStageId?: string | null;
};

export default function Stage3D({
  cameraPreset = "center",
  isPlaying = false,
  characterEvent = null,
  getSongTimeMs,
  bpm = 110,
  selectedStageId = DEFAULT_STAGE_ID,
}: Stage3DProps) {
  const selectedStageEntry = resolveStageCatalogEntry(selectedStageId);
  const stageEntry = resolveRuntimeStageCatalogEntry(selectedStageId);
  const neonPresentation = stageEntry.presentationProfileId === "neon-stage-v1";
  const hostRef = useRef<HTMLDivElement | null>(null);
  const characterRef = useRef<CharacterActor | null>(null);
  const cameraPresetRef = useRef(cameraPreset);
  const isPlayingRef = useRef(isPlaying);
  const getSongTimeMsRef = useRef(getSongTimeMs);
  const bpmRef = useRef(bpm);
  cameraPresetRef.current = cameraPreset;
  isPlayingRef.current = isPlaying;
  getSongTimeMsRef.current = getSongTimeMs;
  bpmRef.current = bpm;

  useEffect(() => {
    characterRef.current?.setGameActive(isPlaying);
  }, [isPlaying]);

  useEffect(() => {
    if (characterEvent) characterRef.current?.handlePresentationEvent(characterEvent);
  }, [characterEvent]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(neonPresentation ? 0x020517 : 0x1b2d49);
    scene.fog = neonPresentation ? null : new THREE.FogExp2(0x6b7f9f, 0.01);

    const initialCameraFrame = getCharacterCameraFrame("center", false);
    const camera = new THREE.PerspectiveCamera(initialCameraFrame.fov, 16 / 9, 0.1, 100);
    const cameraLookTarget = new THREE.Vector3(0, initialCameraFrame.targetY, initialCameraFrame.targetZ);
    camera.position.set(0, initialCameraFrame.y, initialCameraFrame.z);
    camera.lookAt(cameraLookTarget);

    // Rendering is optional; unavailable GPU must never stop the rhythm runtime.
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("webgl2");
    if (!context) return;
    const mobileRenderProfile = isMobileStageProfile();
    const renderer = new THREE.WebGLRenderer({
      canvas,
      context,
      antialias: true,
      powerPreference: "high-performance",
    });
    renderer.setPixelRatio(getStagePixelRatio(neonPresentation));
    renderer.setSize(host.clientWidth, host.clientHeight, false);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = neonPresentation ? 1.24 : 1.28;
    renderer.domElement.className = "stage-3d-canvas";
    host.appendChild(renderer.domElement);

    const stage = new THREE.Group();
    scene.add(stage);

    scene.add(new THREE.HemisphereLight(
      neonPresentation ? 0x8f7add : 0xdceeff,
      neonPresentation ? 0x360845 : 0x737b9c,
      neonPresentation ? 0.62 : 2.2,
    ));

    const key = new THREE.DirectionalLight(
      neonPresentation ? 0xeee3ff : 0xfff3ff,
      neonPresentation ? 1.02 : 3.0,
    );
    key.position.set(-2.5, 8, 8);
    scene.add(key);

    if (neonPresentation) {
      const magentaRim = new THREE.DirectionalLight(0xff38cc, 0.55);
      magentaRim.position.set(5, 5, -2);
      scene.add(magentaRim);
    } else {
      const coolFill = new THREE.DirectionalLight(0x91dcff, 1.25);
      coolFill.position.set(-4, 5, 7);
      scene.add(coolFill);

      const warmRim = new THREE.DirectionalLight(0xffb2dd, 0.75);
      warmRim.position.set(4, 4, -3);
      scene.add(warmRim);
    }

    const accent = new THREE.SpotLight(COLORS.pink, 38, 22, Math.PI / 7, 0.58, 1.1);
    accent.position.set(0, 8, 4.5);
    accent.target.position.set(0, 1.8, 0);
    if (!neonPresentation) scene.add(accent, accent.target);

    const wall = new THREE.Mesh(new THREE.BoxGeometry(19, 8.5, 0.6), new THREE.MeshStandardMaterial({ color: 0x0c0b1c, roughness: .88, metalness: .15 }));
    wall.position.set(0, 4.2, -3.2);
    stage.add(wall);

    for (let i = -5; i <= 5; i += 1) {
      const panel = new THREE.Mesh(new THREE.BoxGeometry(1.38, 7.1, .08), new THREE.MeshStandardMaterial({ color: i % 2 === 0 ? 0x14132b : 0x0e0f20, roughness: .78, metalness: .18 }));
      panel.position.set(i * 1.7, 4.05, -2.88);
      stage.add(panel);
    }

    const frameMaterial = new THREE.MeshStandardMaterial({ color: 0x291347, emissive: 0x8c247f, emissiveIntensity: .8, metalness: .55, roughness: .35 });
    const topFrame = new THREE.Mesh(new THREE.BoxGeometry(16, .16, .18), frameMaterial);
    topFrame.position.set(0, 7.55, -2.55);
    stage.add(topFrame);
    for (const x of [-7.8, 7.8]) {
      const pillar = new THREE.Mesh(new THREE.BoxGeometry(.16, 7.6, .18), frameMaterial);
      pillar.position.set(x, 3.8, -2.55);
      stage.add(pillar);
    }

    const floor = new THREE.Mesh(new THREE.PlaneGeometry(23, 20), new THREE.MeshStandardMaterial({ color: COLORS.floor, roughness: .55, metalness: .55 }));
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(0, 0, 1.6);
    stage.add(floor);

    const grid = new THREE.GridHelper(20, 24, COLORS.pink, COLORS.violet);
    grid.position.set(0, .025, 1.6);
    (grid.material as THREE.Material).transparent = true;
    (grid.material as THREE.Material).opacity = .18;
    stage.add(grid);

    for (let i = 0; i < 7; i += 1) {
      const ring = new THREE.Mesh(new THREE.RingGeometry(1.7 + i * .68, 1.72 + i * .68, 64), new THREE.MeshBasicMaterial({ color: i % 2 ? COLORS.cyan : COLORS.pink, transparent: true, opacity: .14, side: THREE.DoubleSide }));
      ring.rotation.x = -Math.PI / 2;
      ring.position.set(0, .03, 1.6);
      stage.add(ring);
    }

    const signTexture = makeNeonSignTexture();
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(5.4, 1.5), new THREE.MeshBasicMaterial({ map: signTexture, transparent: true, depthWrite: false }));
    sign.position.set(0, 6.0, -2.5);
    stage.add(sign);

    createSpeaker(stage, -6.2, 3.0, COLORS.cyan);
    createSpeaker(stage, 6.2, 3.0, COLORS.pink);
    createSpeaker(stage, -4.7, 1.7, COLORS.violet, .7);
    createSpeaker(stage, 4.7, 1.7, COLORS.violet, .7);

    // Keep the accepted procedural room as a fail-safe only. The Stage Catalog
    // decides which runtime asset and presentation profile replaces this group.
    const placeholderEnvironment = new THREE.Group();
    placeholderEnvironment.name = "ProceduralStageFallback";
    while (stage.children.length > 0) placeholderEnvironment.add(stage.children[0]);
    stage.add(placeholderEnvironment);

    const stageEnvironment = createStageEnvironment(stageEntry);
    stageEnvironment.root.visible = false;
    stage.add(stageEnvironment.root);
    host.dataset.stageSource = "placeholder";
    host.dataset.stageEmbeddedAnimations = "0";
    void stageEnvironment.load().then(result => {
      if (disposed) return;
      stageEnvironment.root.visible = true;
      placeholderEnvironment.visible = false;
      accent.visible = false;
      host.dataset.stageSource = result.stageId;
      host.dataset.stageEmbeddedAnimations = String(result.embeddedAnimations);
      host.dataset.stageMetrics = JSON.stringify(result);
    }).catch(error => {
      if (disposed) return;
      host.dataset.stageSource = "placeholder";
      host.dataset.stageError = error instanceof Error ? error.message : String(error);
      console.warn(`[Stage3D] ${stageEntry.displayName} failed; procedural stage remains active:`, error);
    });

    let selectedCharacter = DEFAULT_CHARACTER_CREATION_PROFILE;
    try {
      selectedCharacter = loadCharacterCreationDraft(window.localStorage) ?? DEFAULT_CHARACTER_CREATION_PROFILE;
    } catch {
      selectedCharacter = DEFAULT_CHARACTER_CREATION_PROFILE;
    }

    const character = CharacterActor.fromAssetId(selectedCharacter.characterAssetId);
    characterRef.current = character;
    character.setGameActive(isPlayingRef.current);
    character.root.position.set(
      CHARACTER_STAGE_POSITION.x,
      CHARACTER_STAGE_POSITION.y,
      CHARACTER_STAGE_POSITION.z + (neonPresentation ? NEON_CHARACTER_STAGE_Z_OFFSET : 0),
    );
    stage.add(character.root);
    host.dataset.characterAssetId = selectedCharacter.characterAssetId;
    host.dataset.characterProfileVersion = String(selectedCharacter.version);
    host.dataset.characterSource = "loading";
    void character.load().then((result) => {
      if (!result || disposed) return;
      if (neonPresentation) applyNeonCharacterFill(character.root);
      host.dataset.characterSource = result.source;
      host.dataset.characterIdle = result.idleClip ?? "static";
      host.dataset.characterMetrics = JSON.stringify(result.metrics);
      if (result.error) console.warn(`[Stage3D] Character asset failed; procedural fallback active: ${result.error}`);
    });

    const cameraTarget = (portrait: boolean) => {
      const frame = getCharacterCameraFrame(cameraPresetRef.current, portrait);
      return neonPresentation ? getNeonGameplayCameraFrame(frame, portrait) : frame;
    };

    let hasSized = false;
    const resize = () => {
      const width = Math.max(1, host.clientWidth);
      const height = Math.max(1, host.clientHeight);
      const portrait = height > width;
      const target = cameraTarget(portrait);
      if (!hasSized) {
        camera.fov = target.fov;
        camera.position.set(0, target.y, target.z);
        cameraLookTarget.set(0, target.targetY, target.targetZ);
        camera.lookAt(cameraLookTarget);
        hasSized = true;
      }
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setPixelRatio(getStagePixelRatio(neonPresentation));
      renderer.setSize(width, height, false);
    };

    const observer = new ResizeObserver(resize);
    observer.observe(host);
    resize();

    const clock = new THREE.Clock();
    let lastPresentationCamera = "gameplay_portrait_locked";
    let raf = 0;
    let disposed = false;
    const scheduleFrame = () => {
      if (disposed || document.hidden || raf !== 0) return;
      raf = requestAnimationFrame(animate);
    };
    const animate = () => {
      raf = 0;
      if (disposed) return;
      if (document.hidden) return;
      const delta = Math.min(clock.getDelta(), .1);
      const t = clock.elapsedTime;
      const songTimeMs = getSongTimeMsRef.current?.() ?? 0;
      const portrait = host.clientHeight > host.clientWidth;
      const basePose = getStagePresentationCameraPose(
        songTimeMs,
        isPlayingRef.current,
        portrait,
        cameraPresetRef.current,
      );
      const pose = getNeonPresentationPose(basePose, neonPresentation, portrait);
      host.dataset.presentationCamera = pose.preset;
      const shotChanged = pose.preset !== lastPresentationCamera;
      const cutToIntroShot = shotChanged && pose.preset !== "gameplay_portrait_locked";
      const cameraEase = pose.preset === "gameplay_portrait_locked"
        ? 1 - Math.pow(1 - .14, delta * 60)
        : 1 - Math.pow(1 - .20, delta * 60);

      // Audition-style intro shots are cuts between safe compositions, not one
      // continuous camera rail through stage geometry. Snap at intro-shot
      // boundaries, then keep the subtle motion inside each shot. Blend only
      // when returning to the locked gameplay camera.
      if (cutToIntroShot) {
        camera.position.set(pose.x, pose.y, pose.z);
        camera.fov = pose.fov;
        cameraLookTarget.set(pose.targetX, pose.targetY, pose.targetZ);
      } else {
        camera.position.x += (pose.x - camera.position.x) * cameraEase;
        camera.position.y += (pose.y - camera.position.y) * cameraEase;
        camera.position.z += (pose.z - camera.position.z) * cameraEase;
        camera.fov += (pose.fov - camera.fov) * cameraEase;
        cameraLookTarget.x += (pose.targetX - cameraLookTarget.x) * cameraEase;
        cameraLookTarget.y += (pose.targetY - cameraLookTarget.y) * cameraEase;
        cameraLookTarget.z += (pose.targetZ - cameraLookTarget.z) * cameraEase;
      }
      lastPresentationCamera = pose.preset;
      camera.lookAt(cameraLookTarget);
      camera.updateProjectionMatrix();
      character.update(delta, t, songTimeMs);
      if (stageEnvironment.root.visible) {
        stageEnvironment.setPresentationCamera(pose.preset);
        stageEnvironment.update(t, songTimeMs, bpmRef.current, isPlayingRef.current);
      } else {
        const signPulse = 1 + Math.max(0, Math.sin(t * Math.PI * 4.266)) * .008;
        sign.scale.set(signPulse, signPulse, signPulse);
      }
      renderer.render(scene, camera);
      scheduleFrame();
    };
    const handleVisibilityChange = () => {
      if (document.hidden) {
        cancelAnimationFrame(raf);
        raf = 0;
        return;
      }
      scheduleFrame();
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    scheduleFrame();

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      observer.disconnect();
      character.dispose();
      stageEnvironment.dispose();
      if (characterRef.current === character) characterRef.current = null;
      disposeObjectResources(scene);
      renderer.dispose();
      if (renderer.domElement.parentElement === host) host.removeChild(renderer.domElement);
      scene.clear();
    };
  }, [stageEntry, neonPresentation]);

  return (
    <div
      ref={hostRef}
      className="stage-3d"
      data-camera-preset={cameraPreset}
      data-selected-stage-id={selectedStageId ?? DEFAULT_STAGE_ID}
      data-stage-catalog-id={selectedStageEntry.id}
      data-stage-environment-kind={selectedStageEntry.kind}
      data-stage-catalog-status={selectedStageEntry.status}
      data-stage-selectable={String(selectedStageEntry.selectable)}
      data-stage-runtime-fallback={String(selectedStageEntry.id !== stageEntry.id)}
      data-stage-runtime-catalog-id={stageEntry.id}
      data-stage-runtime-asset-id={stageEntry.runtimeAssetId}
      data-stage-presentation-profile={stageEntry.presentationProfileId}
      aria-label="3D music performance stage"
    />
  );
}

function createSpeaker(parent: THREE.Group, x: number, y: number, accent: number, scale = 1) {
  const group = new THREE.Group(); group.position.set(x, y, -1.55); group.scale.setScalar(scale);
  const cabinet = new THREE.Mesh(new THREE.BoxGeometry(.9, 3.3, .8), new THREE.MeshStandardMaterial({ color: 0x101020, roughness: .6 }));
  cabinet.position.y = -1.25; group.add(cabinet);
  for (const [yy, size] of [[-.35, .34], [-1.05, .25]] as const) {
    const cone = new THREE.Mesh(new THREE.CylinderGeometry(size, size * 1.15, .12, 24), new THREE.MeshStandardMaterial({ color: accent, emissive: accent, emissiveIntensity: .75 }));
    cone.rotation.x = Math.PI / 2; cone.position.set(0, yy, .43); group.add(cone);
  }
  parent.add(group);
}

function makeNeonSignTexture() {
  const canvas = document.createElement("canvas"); canvas.width = 900; canvas.height = 260;
  const ctx = canvas.getContext("2d")!; ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.font = "900 78px Arial Black, Arial, sans-serif";
  ctx.shadowColor = "#ff4fd8"; ctx.shadowBlur = 28; ctx.fillStyle = "#f67ce8"; ctx.fillText("AUDITION", 450, 145);
  ctx.shadowBlur = 12; ctx.font = "700 34px Arial, sans-serif"; ctx.fillStyle = "#f2dcff"; ctx.fillText("CLUB", 450, 62);
  const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace; return texture;
}
