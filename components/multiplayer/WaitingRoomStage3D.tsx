"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { clone as cloneSkeleton } from "three/examples/jsm/utils/SkeletonUtils.js";
import { HUMAN_CHARACTER_ASSET_URL } from "../character/human-animation-library";
import { loadPublishedDanceRelease } from "../character/published-animation-library";
import type { RoomParticipant, RoomSlot } from "../../multiplayer/types";
import {
  selectParticipantIdleClipByIndex,
  selectParticipantIdleHoldSeconds,
  selectParticipantIdlePhaseSeconds,
  selectParticipantNextIdleIndex,
  selectRoomParticipantIdleIndices,
} from "./lobby-idle-selection";
import styles from "./WaitingRoomStage3D.module.css";

export type WaitingRoomStageView = "wide" | "center" | "close";

type Props = {
  participants: readonly RoomParticipant[];
  slots: readonly RoomSlot[];
  roomId: string;
  stageId: string;
  viewMode: WaitingRoomStageView;
  pageIndex: number;
  selectedParticipantId: string | null;
  pageSize?: number;
  onSelectParticipant?: (participant: RoomParticipant) => void;
};

type StageNode = {
  participant: RoomParticipant;
  index: number;
  actor: THREE.Object3D;
  ring: THREE.Object3D;
  baseScale: THREE.Vector3;
};

type SlotPlaceholder = {
  slotIndex: number;
  group: THREE.Group;
  ringMaterial: THREE.MeshBasicMaterial;
  bodyMaterial: THREE.MeshBasicMaterial;
};

type IdleRuntime = {
  participantId: string;
  mixer: THREE.AnimationMixer;
  currentAction: THREE.AnimationAction;
  currentIndex: number;
  transitionOrdinal: number;
  elapsedSeconds: number;
  holdSeconds: number;
  retiringAction: THREE.AnimationAction | null;
  retiringSeconds: number;
};

const FEMALE_CHARACTER_ASSET_URL = HUMAN_CHARACTER_ASSET_URL.replace(
  "UBC_Superhero_Male_FullBody.glb",
  "UBC_Superhero_Female_FullBody.glb",
);
const IDLE_RENDER_FPS = 30;
const IDLE_CROSSFADE_SECONDS = 0.35;
const SLOT_ACCENTS = [0x43dfff, 0xff4fcf, 0x69efae, 0xff5fbd, 0xa968ff, 0x56b4ff] as const;

function participantAccent(participant: RoomParticipant) {
  return SLOT_ACCENTS[participant.slotIndex] ?? 0x43dfff;
}

function disposeObject(root: THREE.Object3D) {
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  const textures = new Set<THREE.Texture>();

  root.traverse(object => {
    const mesh = object as THREE.Mesh;
    if (!mesh.isMesh) return;
    if (mesh.geometry) geometries.add(mesh.geometry);
    const meshMaterials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const material of meshMaterials) {
      if (!material) continue;
      materials.add(material);
      for (const value of Object.values(material)) {
        if (value instanceof THREE.Texture) textures.add(value);
      }
    }
  });

  textures.forEach(texture => texture.dispose());
  materials.forEach(material => material.dispose());
  geometries.forEach(geometry => geometry.dispose());
}

function normalizeModel(model: THREE.Object3D) {
  model.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(model);
  const size = bounds.getSize(new THREE.Vector3());
  if (!(size.y > 0) || !Number.isFinite(size.y)) {
    throw new Error("Waiting-room character has invalid bounds.");
  }

  model.scale.multiplyScalar(4.05 / size.y);
  model.updateMatrixWorld(true);

  const scaledBounds = new THREE.Box3().setFromObject(model);
  const center = scaledBounds.getCenter(new THREE.Vector3());
  model.position.x -= center.x;
  model.position.y -= scaledBounds.min.y;
  model.position.z -= center.z;
  model.updateMatrixWorld(true);
}

function tintActor(actor: THREE.Object3D, participant: RoomParticipant, index: number) {
  const tint = new THREE.Color(
    participant.role === "host"
      ? 0x7eb8ff
      : participant.kind === "bot"
        ? 0x75e7c0
        : index % 2
          ? 0xff9acb
          : 0xba9cff,
  );

  const cloneMaterial = (material: THREE.Material) => {
    const next = material.clone();
    const colored = next as THREE.Material & { color?: THREE.Color };
    colored.color?.lerp(tint, 0.12);
    return next;
  };

  actor.traverse(object => {
    const mesh = object as THREE.Mesh;
    if (!mesh.isMesh) return;
    mesh.material = Array.isArray(mesh.material)
      ? mesh.material.map(cloneMaterial)
      : cloneMaterial(mesh.material);
  });
}

function fallbackActor(female: boolean) {
  const root = new THREE.Group();
  const material = new THREE.MeshStandardMaterial({
    color: female ? 0xf5a8cc : 0x6387d8,
    roughness: 0.72,
    metalness: 0.04,
  });
  const body = new THREE.Mesh(
    new THREE.CapsuleGeometry(female ? 0.36 : 0.41, 1.7, 5, 10),
    material,
  );
  body.position.y = 1.42;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.34, 16, 12), material);
  head.position.y = 2.76;
  root.add(body, head);
  root.scale.setScalar(1.18);
  return root;
}

function statusLabel(participant: RoomParticipant) {
  if (participant.role === "host") return "HOST";
  if (participant.kind === "bot") return "READY";
  return participant.readyState === "ready" ? "READY" : "NOT READY";
}

function statusClass(participant: RoomParticipant) {
  if (participant.role === "host") return styles.hostState;
  return statusLabel(participant) === "READY" ? styles.ready : styles.notReady;
}

function levelFor(participant: RoomParticipant) {
  if (participant.role === "host") return 25;
  if (participant.participantId === "p51-guest") return 18;
  return participant.kind === "bot" ? 16 : 12;
}

function isFemale(participant: RoomParticipant) {
  return participant.avatar.characterId.toLowerCase().includes("female");
}

function centerPosition(index: number, total: number, pageSize: number) {
  const pageStart = Math.floor(index / pageSize) * pageSize;
  const localIndex = index - pageStart;
  const localCount = Math.min(pageSize, total - pageStart);
  const centered = localIndex - (localCount - 1) / 2;
  return { x: centered * 2.42, z: Math.abs(centered) * 0.12, rotationY: centered * -0.05 };
}

function createParticipantRing(color: number, pulsePhase: number, host: boolean) {
  const group = new THREE.Group();

  const underglowMaterial = new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity: 0.045,
    side: THREE.DoubleSide,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const underglow = new THREE.Mesh(new THREE.CircleGeometry(1.08, 40), underglowMaterial);
  underglow.rotation.x = -Math.PI / 2;
  underglow.position.y = -0.018;

  const floorMaterial = new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity: 0.11,
    side: THREE.DoubleSide,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const floorGlow = new THREE.Mesh(new THREE.CircleGeometry(0.76, 40), floorMaterial);
  floorGlow.rotation.x = -Math.PI / 2;
  floorGlow.position.y = -0.006;

  const haloMaterial = new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity: 0.22,
    side: THREE.DoubleSide,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const halo = new THREE.Mesh(new THREE.RingGeometry(0.68, 1.0, 48), haloMaterial);
  halo.rotation.x = -Math.PI / 2;
  halo.position.y = 0.002;

  const outerMaterial = new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity: 0.2,
    side: THREE.DoubleSide,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const outer = new THREE.Mesh(new THREE.RingGeometry(0.95, 1.035, 48), outerMaterial);
  outer.rotation.x = -Math.PI / 2;
  outer.position.y = 0.008;

  const coreMaterial = new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity: 0.94,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const core = new THREE.Mesh(new THREE.RingGeometry(0.79, 0.875, 48), coreMaterial);
  core.rotation.x = -Math.PI / 2;
  core.position.y = 0.014;

  const innerMaterial = new THREE.MeshBasicMaterial({
    color: host ? 0xffd454 : color,
    transparent: true,
    opacity: host ? 0.66 : 0.34,
    side: THREE.DoubleSide,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const inner = new THREE.Mesh(new THREE.RingGeometry(0.55, 0.59, 40), innerMaterial);
  inner.rotation.x = -Math.PI / 2;
  inner.position.y = 0.018;

  group.add(underglow, floorGlow, halo, outer, core, inner);
  group.userData.pulsePhase = pulsePhase;
  group.userData.emphasis = host ? 0.55 : 0;
  group.userData.underglowMaterial = underglowMaterial;
  group.userData.haloMaterial = haloMaterial;
  group.userData.outerMaterial = outerMaterial;
  group.userData.coreMaterial = coreMaterial;
  group.userData.floorMaterial = floorMaterial;
  return group;
}

function setScale(node: StageNode, actorMultiplier: number, ringMultiplier = actorMultiplier) {
  node.actor.scale.copy(node.baseScale).multiplyScalar(actorMultiplier);
  node.ring.scale.setScalar(ringMultiplier);
}

export default function WaitingRoomStage3D({
  participants,
  slots,
  roomId,
  stageId,
  viewMode,
  pageIndex,
  selectedParticipantId,
  pageSize = 2,
  onSelectParticipant,
}: Props) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const stageNodesRef = useRef(new Map<string, StageNode>());
  const slotPlaceholdersRef = useRef<SlotPlaceholder[]>([]);
  const slotsRef = useRef(slots);
  const renderRef = useRef<(() => void) | null>(null);
  const layoutRef = useRef<(() => void) | null>(null);
  const selectCallbackRef = useRef(onSelectParticipant);
  const participantsRef = useRef(participants);
  const viewRef = useRef({ viewMode, pageIndex, pageSize, selectedParticipantId });
  const [loadState, setLoadState] = useState<"loading" | "ready" | "fallback">("loading");

  selectCallbackRef.current = onSelectParticipant;
  participantsRef.current = participants;
  slotsRef.current = slots;
  viewRef.current = { viewMode, pageIndex, pageSize, selectedParticipantId };

  const slotStateKey = useMemo(
    () => slots.map(slot => `${slot.slotIndex}:${slot.state}`).join("|"),
    [slots],
  );

  const identityKey = useMemo(
    () => `${roomId}|${participants.map(item => `${item.participantId}:${item.avatar.characterId}:${item.slotIndex}`).join("|")}`,
    [participants, roomId],
  );

  const visibleParticipants = useMemo(() => {
    if (viewMode === "wide") return participants;
    if (viewMode === "close") {
      const selected = participants.find(item => item.participantId === selectedParticipantId);
      return selected ? [selected] : participants.slice(0, 1);
    }
    return participants.slice(pageIndex * pageSize, pageIndex * pageSize + pageSize);
  }, [pageIndex, pageSize, participants, selectedParticipantId, viewMode]);

  useEffect(() => {
    layoutRef.current?.();
  }, [pageIndex, pageSize, selectedParticipantId, slotStateKey, viewMode]);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    let disposed = false;
    let animationFrame = 0;
    let lastFrameMs = 0;
    let accumulatedMs = 0;
    let idleClips: readonly THREE.AnimationClip[] = [];
    let releaseVersion = 0;

    const idleRuntimes: IdleRuntime[] = [];
    const disposableSources: THREE.Object3D[] = [];
    stageNodesRef.current.clear();
    slotPlaceholdersRef.current = [];

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: "high-performance",
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.15));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.16;
    renderer.setClearColor(0x000000, 0);
    mount.appendChild(renderer.domElement);

    scene.add(new THREE.HemisphereLight(0x9bb4ff, 0x050510, 1.34));

    const key = new THREE.DirectionalLight(0xf8fbff, 2.32);
    key.position.set(1.8, 6.8, 5.9);
    scene.add(key);

    const frontFill = new THREE.DirectionalLight(0xffffff, 0.82);
    frontFill.position.set(0, 3.2, 6.8);
    scene.add(frontFill);

    const cyanRim = new THREE.SpotLight(0x42dcff, 16, 16, Math.PI / 4.2, 0.72, 1.6);
    cyanRim.position.set(4.7, 6.1, 2.8);
    cyanRim.target.position.set(0.7, 1.7, 0);
    scene.add(cyanRim, cyanRim.target);

    const magentaRim = new THREE.SpotLight(0xff43cc, 15, 16, Math.PI / 4.2, 0.72, 1.6);
    magentaRim.position.set(-4.7, 5.8, 2.2);
    magentaRim.target.position.set(-0.7, 1.65, 0);
    scene.add(magentaRim, magentaRim.target);

    const overhead = new THREE.SpotLight(0xc4d4ff, 14, 16, Math.PI / 5, 0.7, 1.7);
    overhead.position.set(0, 7.5, 1.1);
    overhead.target.position.set(0, 1.2, 0);
    scene.add(overhead, overhead.target);

    const floor = new THREE.Mesh(
      new THREE.CircleGeometry(5.75, 64),
      new THREE.MeshStandardMaterial({
        color: 0x070d27,
        roughness: 0.24,
        metalness: 0.58,
      }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(0, -0.045, 0.18);
    scene.add(floor);

    const floorHaloMaterial = new THREE.MeshBasicMaterial({
      color: 0x395dff,
      transparent: true,
      opacity: 0.16,
      side: THREE.DoubleSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const floorHalo = new THREE.Mesh(new THREE.RingGeometry(3.55, 5.35, 64), floorHaloMaterial);
    floorHalo.rotation.x = -Math.PI / 2;
    floorHalo.position.set(0, -0.027, 0.18);
    scene.add(floorHalo);

    const runway = new THREE.Mesh(
      new THREE.PlaneGeometry(5.9, 2.2),
      new THREE.MeshBasicMaterial({
        color: 0x4722a8,
        transparent: true,
        opacity: 0.13,
        side: THREE.DoubleSide,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    );
    runway.rotation.x = -Math.PI / 2;
    runway.position.set(0, -0.02, 0.42);
    scene.add(runway);

    for (let slotIndex = 0; slotIndex < 6; slotIndex += 1) {
      const group = new THREE.Group();
      const ringMaterial = new THREE.MeshBasicMaterial({
        color: 0x43dfff,
        transparent: true,
        opacity: 0.45,
        side: THREE.DoubleSide,
      });
      const ring = new THREE.Mesh(new THREE.RingGeometry(0.72, 0.84, 40), ringMaterial);
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = 0.008;
      const padMaterial = new THREE.MeshBasicMaterial({
        color: 0x43dfff,
        transparent: true,
        opacity: 0.08,
        side: THREE.DoubleSide,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      });
      const pad = new THREE.Mesh(new THREE.CircleGeometry(0.88, 36), padMaterial);
      pad.rotation.x = -Math.PI / 2;
      pad.position.y = -0.005;
      group.add(pad, ring);

      const bodyMaterial = new THREE.MeshBasicMaterial({
        color: 0x4fcfff,
        transparent: true,
        opacity: 0.14,
        depthWrite: false,
      });
      const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.25, 1.05, 4, 8), bodyMaterial);
      body.position.y = 0.96;
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.2, 12, 8), bodyMaterial);
      head.position.y = 1.78;
      group.add(body, head);
      group.visible = false;
      scene.add(group);
      slotPlaceholdersRef.current.push({ slotIndex, group, ringMaterial, bodyMaterial });
    }

    const render = () => {
      const width = Math.max(1, mount.clientWidth);
      const height = Math.max(1, mount.clientHeight);
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.render(scene, camera);
    };
    renderRef.current = render;

    const applyLayout = () => {
      const current = viewRef.current;
      const selected = current.selectedParticipantId
        ?? participants[current.pageIndex * current.pageSize]?.participantId
        ?? participants[0]?.participantId
        ?? null;

      stageNodesRef.current.forEach(node => {
        const { participant, index } = node;
        let visible = false;
        let x = 0;
        let z = 0;
        let rotationY = 0;
        let actorScale = 0.88;
        let ringScale = 0.96;

        if (current.viewMode === "wide") {
          visible = true;
          const centered = participant.slotIndex - 2.5;
          x = centered * 0.94;
          z = Math.abs(centered) * 0.045;
          rotationY = centered * -0.024;
          actorScale = 0.62;
          ringScale = 0.62;
        } else if (current.viewMode === "close") {
          visible = participant.participantId === selected;
          actorScale = 0.98;
          ringScale = 1.02;
        } else {
          const pageStart = current.pageIndex * current.pageSize;
          visible = index >= pageStart && index < pageStart + current.pageSize;
          const position = centerPosition(index, participants.length, current.pageSize);
          x = position.x;
          z = position.z;
          rotationY = position.rotationY;
        }

        node.actor.visible = visible;
        node.ring.visible = visible;
        node.actor.position.x = x;
        node.actor.position.z = z;
        node.actor.rotation.y = rotationY;
        node.ring.position.set(x, 0.02, z);
        setScale(node, actorScale, ringScale);
        const selectedRing = participant.participantId === current.selectedParticipantId;
        node.ring.userData.emphasis = selectedRing ? 1 : participant.role === "host" ? 0.55 : 0;
      });

      slotPlaceholdersRef.current.forEach(placeholder => {
        const slot = slotsRef.current.find(item => item.slotIndex === placeholder.slotIndex);
        const centered = placeholder.slotIndex - 2.5;
        placeholder.group.position.set(centered * 0.94, 0.02, Math.abs(centered) * 0.045);
        placeholder.group.scale.setScalar(0.68);
        const showPlaceholder = current.viewMode === "wide" && slot?.state !== "occupied";
        placeholder.group.visible = showPlaceholder;
        const closed = slot?.state === "closed";
        placeholder.ringMaterial.color.setHex(closed ? 0xff4f7d : 0x43dfff);
        placeholder.ringMaterial.opacity = closed ? 0.3 : 0.48;
        placeholder.bodyMaterial.color.setHex(closed ? 0xff557f : 0x4fcfff);
        placeholder.bodyMaterial.opacity = closed ? 0.08 : 0.16;
      });

      if (current.viewMode === "wide") {
        camera.position.set(0, 3.12, 12.25);
        camera.lookAt(0, 1.72, 0);
      } else if (current.viewMode === "close") {
        camera.position.set(0, 3.16, 9.45);
        camera.lookAt(0, 2.08, 0);
      } else {
        camera.position.set(0, 3.08, 9.65);
        camera.lookAt(0, 2.0, 0);
      }
      render();
    };
    layoutRef.current = applyLayout;

    const switchIdleIfNeeded = (runtime: IdleRuntime, deltaSeconds: number) => {
      if (runtime.retiringAction) {
        runtime.retiringSeconds -= deltaSeconds;
        if (runtime.retiringSeconds <= 0) {
          runtime.retiringAction.stop();
          runtime.retiringAction = null;
        }
      }

      runtime.elapsedSeconds += deltaSeconds;
      if (idleClips.length <= 1 || runtime.elapsedSeconds < runtime.holdSeconds) return;

      const nextOrdinal = runtime.transitionOrdinal + 1;
      const nextIndex = selectParticipantNextIdleIndex(
        runtime.participantId,
        idleClips.length,
        releaseVersion,
        roomId,
        nextOrdinal,
        runtime.currentIndex,
      );
      const nextClip = selectParticipantIdleClipByIndex(idleClips, nextIndex);
      if (!nextClip) return;

      const nextAction = runtime.mixer.clipAction(nextClip);
      nextAction.reset();
      nextAction.setLoop(THREE.LoopRepeat, Infinity);
      nextAction.enabled = true;
      nextAction.clampWhenFinished = false;
      nextAction.setEffectiveWeight(1);
      nextAction.setEffectiveTimeScale(1);
      nextAction.play();

      runtime.retiringAction?.stop();
      runtime.currentAction.crossFadeTo(nextAction, IDLE_CROSSFADE_SECONDS, false);
      runtime.retiringAction = runtime.currentAction;
      runtime.retiringSeconds = IDLE_CROSSFADE_SECONDS + 0.05;
      runtime.currentAction = nextAction;
      runtime.currentIndex = nextIndex;
      runtime.transitionOrdinal = nextOrdinal;
      runtime.elapsedSeconds = 0;
      runtime.holdSeconds = selectParticipantIdleHoldSeconds(
        runtime.participantId,
        nextClip.duration,
        releaseVersion,
        roomId,
        nextOrdinal,
      );
    };

    const startIdleLoop = () => {
      if (idleRuntimes.length === 0 || animationFrame) return;
      const minFrameMs = 1000 / IDLE_RENDER_FPS;
      const tick = (nowMs: number) => {
        if (disposed) return;
        animationFrame = requestAnimationFrame(tick);
        if (document.hidden) {
          lastFrameMs = nowMs;
          accumulatedMs = 0;
          return;
        }
        if (!lastFrameMs) lastFrameMs = nowMs;
        accumulatedMs += Math.min(100, Math.max(0, nowMs - lastFrameMs));
        lastFrameMs = nowMs;
        if (accumulatedMs < minFrameMs) return;
        const deltaSeconds = accumulatedMs / 1000;
        accumulatedMs = 0;
        idleRuntimes.forEach(runtime => {
          runtime.mixer.update(deltaSeconds);
          switchIdleIfNeeded(runtime, deltaSeconds);
        });

        const ringTime = nowMs / 1000;
        stageNodesRef.current.forEach(node => {
          const phase = Number(node.ring.userData.pulsePhase ?? 0);
          const wave = (Math.sin(ringTime * 2.15 + phase) + 1) * 0.5;
          const emphasis = Number(node.ring.userData.emphasis ?? 0);
          const underglowMaterial = node.ring.userData.underglowMaterial as THREE.MeshBasicMaterial | undefined;
          const haloMaterial = node.ring.userData.haloMaterial as THREE.MeshBasicMaterial | undefined;
          const outerMaterial = node.ring.userData.outerMaterial as THREE.MeshBasicMaterial | undefined;
          const coreMaterial = node.ring.userData.coreMaterial as THREE.MeshBasicMaterial | undefined;
          const floorMaterial = node.ring.userData.floorMaterial as THREE.MeshBasicMaterial | undefined;
          if (underglowMaterial) underglowMaterial.opacity = 0.035 + wave * 0.035 + emphasis * 0.035;
          if (haloMaterial) haloMaterial.opacity = 0.17 + wave * 0.15 + emphasis * 0.09;
          if (outerMaterial) outerMaterial.opacity = 0.12 + wave * 0.12 + emphasis * 0.08;
          if (coreMaterial) coreMaterial.opacity = 0.86 + emphasis * 0.12;
          if (floorMaterial) floorMaterial.opacity = 0.07 + wave * 0.065 + emphasis * 0.055;
        });
        render();
      };
      animationFrame = requestAnimationFrame(tick);
    };

    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    const onPointerDown = (event: PointerEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);
      const intersections = raycaster.intersectObjects(
        [...stageNodesRef.current.values()].filter(node => node.actor.visible).map(node => node.actor),
        true,
      );
      const hit = intersections[0]?.object;
      let cursor: THREE.Object3D | null = hit ?? null;
      while (cursor && !cursor.userData.participantId) cursor = cursor.parent;
      const participantId = cursor?.userData.participantId as string | undefined;
      const participant = participantId
        ? participantsRef.current.find(item => item.participantId === participantId)
        : null;
      if (participant) selectCallbackRef.current?.(participant);
    };
    renderer.domElement.addEventListener("pointerdown", onPointerDown);

    const loader = new GLTFLoader();
    setLoadState("loading");

    const needsFemale = participants.some(isFemale);
    const needsMale = participants.some(participant => !isFemale(participant));
    const malePromise = needsMale ? loader.loadAsync(HUMAN_CHARACTER_ASSET_URL) : Promise.resolve(null);
    const femalePromise = needsFemale ? loader.loadAsync(FEMALE_CHARACTER_ASSET_URL) : Promise.resolve(null);
    const publishedPromise = loadPublishedDanceRelease(true);

    void Promise.all([malePromise, femalePromise, publishedPromise])
      .then(([maleGltf, femaleGltf, published]) => {
        if (disposed) {
          if (maleGltf) disposeObject(maleGltf.scene);
          if (femaleGltf) disposeObject(femaleGltf.scene);
          return;
        }

        const maleSource = maleGltf?.scene ?? null;
        const femaleSource = femaleGltf?.scene ?? null;
        if (maleSource) {
          normalizeModel(maleSource);
          disposableSources.push(maleSource);
        }
        if (femaleSource) {
          normalizeModel(femaleSource);
          disposableSources.push(femaleSource);
        }

        idleClips = published?.idleSourceClips ?? [];
        releaseVersion = published?.info.releaseVersion ?? 0;
        const idleIndexByParticipant = selectRoomParticipantIdleIndices(
          participants,
          idleClips.length,
          releaseVersion,
          roomId,
        );
        let usedFallback = false;

        participants.forEach((participant, index) => {
          const female = isFemale(participant);
          const source = female ? femaleSource : maleSource;
          const actor = source ? cloneSkeleton(source) : fallbackActor(female);
          if (!source) usedFallback = true;

          tintActor(actor, participant, index);
          actor.name = `WaitingRoomActor:${participant.participantId}:${participant.avatar.characterId}`;
          actor.userData.participantId = participant.participantId;
          scene.add(actor);

          const ringColor = participantAccent(participant);
          const ring = createParticipantRing(ringColor, index * 1.37, participant.role === "host");
          scene.add(ring);

          stageNodesRef.current.set(participant.participantId, {
            participant,
            index,
            actor,
            ring,
            baseScale: actor.scale.clone(),
          });

          if (source && idleClips.length > 0) {
            const idleIndex = idleIndexByParticipant.get(participant.participantId) ?? -1;
            const idleClip = selectParticipantIdleClipByIndex(idleClips, idleIndex);
            if (idleClip) {
              const mixer = new THREE.AnimationMixer(actor);
              const action = mixer.clipAction(idleClip);
              action.reset();
              action.setLoop(THREE.LoopRepeat, Infinity);
              action.enabled = true;
              action.clampWhenFinished = false;
              action.play();
              action.time = selectParticipantIdlePhaseSeconds(
                participant.participantId,
                idleClip.duration,
                releaseVersion,
                roomId,
              );
              mixer.update(0);
              idleRuntimes.push({
                participantId: participant.participantId,
                mixer,
                currentAction: action,
                currentIndex: idleIndex,
                transitionOrdinal: 0,
                elapsedSeconds: 0,
                holdSeconds: selectParticipantIdleHoldSeconds(
                  participant.participantId,
                  idleClip.duration,
                  releaseVersion,
                  roomId,
                  0,
                ),
                retiringAction: null,
                retiringSeconds: 0,
              });
            }
          }
        });

        applyLayout();
        startIdleLoop();
        setLoadState(usedFallback ? "fallback" : "ready");
      })
      .catch(error => {
        if (disposed) return;
        console.warn("[waiting-room] character/idle load failed; using fallback actors", error);
        participants.forEach((participant, index) => {
          const actor = fallbackActor(isFemale(participant));
          tintActor(actor, participant, index);
          actor.userData.participantId = participant.participantId;
          scene.add(actor);
          const ring = createParticipantRing(
            participantAccent(participant),
            index * 1.37,
            participant.role === "host",
          );
          scene.add(ring);
          stageNodesRef.current.set(participant.participantId, {
            participant,
            index,
            actor,
            ring,
            baseScale: actor.scale.clone(),
          });
        });
        applyLayout();
        setLoadState("fallback");
      });

    const observer = new ResizeObserver(render);
    observer.observe(mount);
    render();

    return () => {
      disposed = true;
      if (animationFrame) cancelAnimationFrame(animationFrame);
      observer.disconnect();
      renderer.domElement.removeEventListener("pointerdown", onPointerDown);
      idleRuntimes.forEach(runtime => runtime.mixer.stopAllAction());
      renderRef.current = null;
      layoutRef.current = null;
      stageNodesRef.current.clear();
      slotPlaceholdersRef.current = [];
      disposeObject(scene);
      disposableSources.forEach(disposeObject);
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [identityKey, roomId]);

  return (
    <div className={styles.stage} data-stage={stageId} data-view={viewMode}>
      <div className={styles.architecture} aria-hidden="true">
        <span className={styles.lightBarLeft} />
        <span className={styles.lightBarRight} />
        <div className={styles.brand}>
          <strong>AUDITION</strong>
          <small>DANCE TOGETHER</small>
        </div>
      </div>
      <div className={styles.canvas} ref={mountRef} />
      <div className={styles.badge}>{loadState === "ready" ? "3D READY" : loadState === "fallback" ? "3D FALLBACK" : "LOADING 3D"}</div>
      {viewMode === "wide" ? (
        <div className={styles.wideSlotLabels}>
          {slots.map(slot => {
            const participant = slot.state === "occupied"
              ? participants.find(item => item.participantId === slot.participantId) ?? null
              : null;
            return (
              <button
                className={`${styles.wideSlotLabel} ${participant?.participantId === selectedParticipantId ? styles.wideSlotSelected : ""}`}
                disabled={!participant}
                key={slot.slotIndex}
                onClick={() => participant && onSelectParticipant?.(participant)}
                type="button"
              >
                <span className={styles.wideSlotNumber}>{slot.slotIndex + 1}</span>
                {participant ? (
                  <>
                    <strong>{participant.displayName}</strong>
                    <b className={statusClass(participant)}>{statusLabel(participant)}</b>
                  </>
                ) : (
                  <>
                    <strong>{slot.state === "closed" ? "CLOSED" : "OPEN"}</strong>
                    <b className={slot.state === "closed" ? styles.wideClosed : styles.wideOpen}>
                      {slot.state === "closed" ? "×" : "+"}
                    </b>
                  </>
                )}
              </button>
            );
          })}
        </div>
      ) : (
        <div className={`${styles.labels} ${viewMode === "close" ? styles.labelsClose : ""}`}>
          {visibleParticipants.map((participant, visibleIndex) => (
            <button
              className={[
                styles.label,
                participant.participantId === selectedParticipantId ? styles.labelSelected : "",
                viewMode === "center"
                  ? visibleIndex === 0
                    ? styles.labelLeft
                    : styles.labelRight
                  : "",
                viewMode === "close" ? styles.labelSolo : "",
              ].filter(Boolean).join(" ")}
              key={participant.participantId}
              onClick={() => onSelectParticipant?.(participant)}
              type="button"
            >
              {participant.role === "host" ? <span className={styles.crown}>♛</span> : null}
              <strong>{participant.displayName}</strong>
              <small>Lv. {levelFor(participant)}</small>
              <b className={statusClass(participant)}>{statusLabel(participant)}</b>
            </button>
          ))}
        </div>
      )}
      {viewMode === "center" && <p className={styles.note}>Kéo ngang để xem khu vực khác</p>}
    </div>
  );
}
