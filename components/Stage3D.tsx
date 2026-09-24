"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import type { CameraPreset } from "./PortraitGameMenu";
import { CharacterActor, disposeObjectResources } from "./character/CharacterActor";
import type { CharacterPresentationEvent } from "./character/character-types";
import { CHARACTER_STAGE_POSITION, getCharacterCameraFrame } from "./character/framing";
import { DEFAULT_CHARACTER_CREATION_PROFILE, loadCharacterCreationDraft } from "./character/character-profile";
import { BrightStageV1Environment } from "./stage/BrightStageV1Environment";
import { getStagePresentationCameraPose } from "./stage/stageCamera";

const COLORS = { pink: 0xff4fd8, cyan: 0x62d8ff, violet: 0x8c7dff, floor: 0x130f28 };
const MOBILE_DPR_CAP = 1.25;
const DESKTOP_DPR_CAP = 1.6;

function getStagePixelRatio() {
  const mobileProfile = window.matchMedia("(pointer: coarse)").matches || window.innerWidth <= 768;
  return Math.min(window.devicePixelRatio || 1, mobileProfile ? MOBILE_DPR_CAP : DESKTOP_DPR_CAP);
}

type Stage3DProps = {
  cameraPreset?: CameraPreset;
  isPlaying?: boolean;
  characterEvent?: CharacterPresentationEvent | null;
  getSongTimeMs?: () => number;
  bpm?: number;
};

export default function Stage3D({ cameraPreset = "center", isPlaying = false, characterEvent = null, getSongTimeMs, bpm = 110 }: Stage3DProps) {
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
    scene.background = new THREE.Color(0x03040a);
    scene.fog = new THREE.FogExp2(0x05050e, 0.032);

    const initialCameraFrame = getCharacterCameraFrame("center", false);
    const camera = new THREE.PerspectiveCamera(initialCameraFrame.fov, 16 / 9, 0.1, 100);
    const cameraLookTarget = new THREE.Vector3(0, initialCameraFrame.targetY, initialCameraFrame.targetZ);
    camera.position.set(0, initialCameraFrame.y, initialCameraFrame.z);
    camera.lookAt(cameraLookTarget);

    // Rendering is optional; unavailable GPU must never stop the rhythm runtime.
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("webgl2");
    if (!context) return;
    const renderer = new THREE.WebGLRenderer({ canvas, context, antialias: true, powerPreference: "high-performance" });
    renderer.setPixelRatio(getStagePixelRatio());
    renderer.setSize(host.clientWidth, host.clientHeight, false);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.08;
    renderer.domElement.className = "stage-3d-canvas";
    host.appendChild(renderer.domElement);

    const stage = new THREE.Group();
    scene.add(stage);
    scene.add(new THREE.HemisphereLight(0xaaa6ff, 0x05040d, 1.55));

    const key = new THREE.DirectionalLight(0xffeaff, 2.1);
    key.position.set(2, 8, 8);
    scene.add(key);

    // One static key accent is enough for the placeholder stage. The cyan and
    // violet accents remain in emissive/basic materials without adding lights
    // to every MeshStandardMaterial shader or mutating intensities per frame.
    const accent = new THREE.SpotLight(COLORS.pink, 38, 22, Math.PI / 7, 0.58, 1.1);
    accent.position.set(0, 8, 4.5);
    accent.target.position.set(0, 1.8, 0);
    scene.add(accent, accent.target);

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

    // Keep the accepted procedural room as a fail-safe only. Bright Stage V1
    // replaces this group after its private Storage asset loads.
    const placeholderEnvironment = new THREE.Group();
    placeholderEnvironment.name = "ProceduralStageFallback";
    while (stage.children.length > 0) placeholderEnvironment.add(stage.children[0]);
    stage.add(placeholderEnvironment);

    const brightStage = new BrightStageV1Environment();
    brightStage.root.visible = false;
    stage.add(brightStage.root);
    host.dataset.stageSource = "placeholder";
    host.dataset.stageEmbeddedAnimations = "0";
    void brightStage.load().then(result => {
      if (disposed) return;
      brightStage.root.visible = true;
      placeholderEnvironment.visible = false;
      accent.visible = false;
      host.dataset.stageSource = result.stageId;
      host.dataset.stageEmbeddedAnimations = String(result.embeddedAnimations);
      host.dataset.stageMetrics = JSON.stringify(result);
    }).catch(error => {
      if (disposed) return;
      host.dataset.stageSource = "placeholder";
      host.dataset.stageError = error instanceof Error ? error.message : String(error);
      console.warn("[Stage3D] Bright Stage V1 failed; procedural stage remains active:", error);
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
      CHARACTER_STAGE_POSITION.z,
    );
    stage.add(character.root);
    host.dataset.characterAssetId = selectedCharacter.characterAssetId;
    host.dataset.characterProfileVersion = String(selectedCharacter.version);
    host.dataset.characterSource = "loading";
    void character.load().then((result) => {
      if (!result || disposed) return;
      host.dataset.characterSource = result.source;
      host.dataset.characterIdle = result.idleClip ?? "static";
      host.dataset.characterMetrics = JSON.stringify(result.metrics);
      if (result.error) console.warn(`[Stage3D] Character asset failed; procedural fallback active: ${result.error}`);
    });

    const cameraTarget = (portrait: boolean) => getCharacterCameraFrame(cameraPresetRef.current, portrait);

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
      renderer.setPixelRatio(getStagePixelRatio());
      renderer.setSize(width, height, false);
    };

    const observer = new ResizeObserver(resize);
    observer.observe(host);
    resize();

    const clock = new THREE.Clock();
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
      const pose = getStagePresentationCameraPose(
        songTimeMs,
        isPlayingRef.current,
        host.clientHeight > host.clientWidth,
        cameraPresetRef.current,
      );
      host.dataset.presentationCamera = pose.preset;
      const cameraEase = pose.preset === "gameplay_portrait_locked"
        ? 1 - Math.pow(1 - .14, delta * 60)
        : 1 - Math.pow(1 - .22, delta * 60);
      camera.position.x += (pose.x - camera.position.x) * cameraEase;
      camera.position.y += (pose.y - camera.position.y) * cameraEase;
      camera.position.z += (pose.z - camera.position.z) * cameraEase;
      camera.fov += (pose.fov - camera.fov) * cameraEase;
      cameraLookTarget.x += (pose.targetX - cameraLookTarget.x) * cameraEase;
      cameraLookTarget.y += (pose.targetY - cameraLookTarget.y) * cameraEase;
      cameraLookTarget.z += (pose.targetZ - cameraLookTarget.z) * cameraEase;
      camera.lookAt(cameraLookTarget);
      camera.updateProjectionMatrix();
      character.update(delta, t, songTimeMs);
      if (brightStage.root.visible) {
        brightStage.update(t, songTimeMs, bpmRef.current, isPlayingRef.current);
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
      brightStage.dispose();
      if (characterRef.current === character) characterRef.current = null;
      disposeObjectResources(scene);
      renderer.dispose();
      if (renderer.domElement.parentElement === host) host.removeChild(renderer.domElement);
      scene.clear();
    };
  }, []);

  return <div ref={hostRef} className="stage-3d" data-camera-preset={cameraPreset} aria-label="3D music performance stage" />;
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
