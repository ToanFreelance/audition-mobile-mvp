"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { Reflector } from "three/examples/jsm/objects/Reflector.js";
import { clone as cloneSkeleton } from "three/examples/jsm/utils/SkeletonUtils.js";
import {
  CHARACTER_CATALOG_V1,
  DEFAULT_CHARACTER_ASSET_ID,
  getCharacterCatalogEntry,
  isCharacterAssetId,
  type CharacterAssetId,
} from "../character/character-catalog";
import { HUMAN_CHARACTER_ASSET_URL } from "../character/human-animation-library";
import { loadLobbyIdleLibrary } from "../character/lobby-idle-library";
import { retargetQuaterniusClipsToMixamo } from "../character/mixamo-character-adapter";
import { avatarCharacterAssetId } from "../../multiplayer/avatar-character";
import { WAITING_ROOM_MAX_PLAYERS, type RoomParticipant, type RoomSlot } from "../../multiplayer/types";
import { lobbyStageParticipantIdentity } from "../../multiplayer/lobby-stage-identity";
import {
  selectParticipantIdleClipByIndex,
  selectParticipantIdleHoldSeconds,
  selectParticipantIdlePhaseSeconds,
  selectParticipantNextIdleIndex,
  selectRoomParticipantIdleIndices,
} from "./lobby-idle-selection";
import { createSketchStageSet, sketchFixtureLayoutKey, sketchFixtureSource } from "./waiting-room-sketch-set";
import {
  WAITING_ROOM_SKETCH_BLUEPRINT,
  sketchColorCss,
  sketchColorRgba,
  sketchStagePoint,
  sketchStageRect,
} from "./waiting-room-sketch-blueprint";
import styles from "./WaitingRoomStage3D.module.css";

export type WaitingRoomStageView = "wide" | "center" | "close";
export type WaitingRoomVisualPreset = "default" | "sketch";

export type WaitingRoomCalibrationPlacement = {
  x: number;
  y: number;
  z: number;
  scale: number;
  rotationY: number;
};

export type WaitingRoomCalibrationLayout = Record<string, WaitingRoomCalibrationPlacement>;

type Props = {
  participants: readonly RoomParticipant[];
  slots: readonly RoomSlot[];
  roomId: string;
  stageId: string;
  visualPreset?: WaitingRoomVisualPreset;
  viewMode: WaitingRoomStageView;
  pageIndex: number;
  selectedParticipantId: string | null;
  pageSize?: number;
  calibrationMode?: boolean;
  blueprintMode?: boolean;
  calibrationResetToken?: number;
  onCalibrationLayoutChange?: (layout: WaitingRoomCalibrationLayout) => void;
  onSelectParticipant?: (participant: RoomParticipant) => void;
};

type StageNode = {
  participant: RoomParticipant;
  index: number;
  characterAssetId: CharacterAssetId;
  actor: THREE.Object3D;
  ring: THREE.Object3D;
  baseScale: THREE.Vector3;
  targetPosition: THREE.Vector3;
  targetRotationY: number;
  targetActorScale: number;
  targetRingScale: number;
  layoutReady: boolean;
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
  clips: readonly THREE.AnimationClip[];
  currentIndex: number;
  transitionOrdinal: number;
  elapsedSeconds: number;
  holdSeconds: number;
  retiringAction: THREE.AnimationAction | null;
  retiringSeconds: number;
};

const IDLE_RENDER_FPS = 30;
const IDLE_CROSSFADE_SECONDS = 0.35;
const SLOT_ACCENTS = [0x43dfff, 0xff4fcf, 0x69efae, 0xff5fbd, 0xa968ff, 0x56b4ff] as const;
const SKETCH_CYAN_RING_ACCENT = WAITING_ROOM_SKETCH_BLUEPRINT.palette.rings.maleCyan;
const SKETCH_PINK_RING_ACCENT = WAITING_ROOM_SKETCH_BLUEPRINT.palette.rings.femalePink;

function participantAccent(participant: RoomParticipant) {
  return SLOT_ACCENTS[participant.slotIndex] ?? 0x43dfff;
}

// Golden-sketch ring color is presentation-only, but its identity source is the
// Character Catalog. Never infer it from names, slot positions or READY state.
function participantSketchRingAccent(participant: RoomParticipant) {
  return getCharacterCatalogEntry(participantCharacterAssetId(participant))?.gender === "female"
    ? SKETCH_PINK_RING_ACCENT
    : SKETCH_CYAN_RING_ACCENT;
}

function participantCharacterAssetId(participant: RoomParticipant): CharacterAssetId {
  const candidate = avatarCharacterAssetId(participant.avatar);
  return isCharacterAssetId(candidate) ? candidate : DEFAULT_CHARACTER_ASSET_ID;
}

function participantUsesFemaleFallback(participant: RoomParticipant) {
  return getCharacterCatalogEntry(participantCharacterAssetId(participant))?.gender === "female";
}

function findPrimarySkinnedMesh(root: THREE.Object3D): THREE.SkinnedMesh {
  let target: THREE.SkinnedMesh | null = null;
  root.traverse(object => {
    if (!target && (object as THREE.SkinnedMesh).isSkinnedMesh) {
      target = object as THREE.SkinnedMesh;
    }
  });
  if (!target) throw new Error("Waiting-room character asset has no skinned mesh.");
  return target;
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

function tintActor(
  actor: THREE.Object3D,
  participant: RoomParticipant,
  index: number,
  sketchPolish = false,
) {
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
    if (colored.color && !sketchPolish) {
      // Sketch skin/clothes retain catalog albedo; key/fill/rim provide the grade.
      // A role tint plus a yellow tint on every material washed out skin detail.
      colored.color.lerp(tint, 0.12);
    }
    if (sketchPolish && next instanceof THREE.MeshStandardMaterial) {
      next.roughness = Math.min(0.82, Math.max(0.28, next.roughness * 0.92));
    }
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
  if (participant.participantId === "p56-minh") return 20;
  if (participant.participantId === "p56-mai") return 17;
  return participant.kind === "bot" ? 16 : 12;
}

function centerPosition(index: number, total: number, pageSize: number) {
  const pageStart = Math.floor(index / pageSize) * pageSize;
  const localIndex = index - pageStart;
  const localCount = Math.min(pageSize, total - pageStart);
  const centered = localIndex - (localCount - 1) / 2;
  return { x: centered * 2.42, z: Math.abs(centered) * 0.12, rotationY: centered * -0.05 };
}

const WIDE_ARC_PLACEMENTS = {
  center: { x: -0.0764, y: 0, z: 2.6, rotationY: 0, scale: 0.8682 },
  leftNear: { x: -1.7004, y: 0.08, z: 1.9872, rotationY: 0.05, scale: 0.72 },
  rightNear: { x: 1.6599, y: 0.08, z: 1.8558, rotationY: -0.05, scale: 0.72 },
  leftOuter: { x: -3.0365, y: 0.30, z: 0.2648, rotationY: 0.095, scale: 0.52 },
  rightOuter: { x: 3.0732, y: 0.30, z: 0.053, rotationY: -0.095, scale: 0.52 },
} as const;

const SKETCH_WIDE_ARC_PLACEMENTS = WAITING_ROOM_SKETCH_BLUEPRINT.scene.formation;

function wideSlotPlacement(
  slotIndex: number,
  focusSlotIndex: number,
  visualPreset: WaitingRoomVisualPreset,
) {
  const placements = visualPreset === "sketch"
    ? SKETCH_WIDE_ARC_PLACEMENTS
    : WIDE_ARC_PLACEMENTS;
  const offset = (
    (slotIndex - focusSlotIndex + 2 + WAITING_ROOM_MAX_PLAYERS)
    % WAITING_ROOM_MAX_PLAYERS
  ) - 2;
  if (offset === 1) return placements.leftNear;
  if (offset === -1) return placements.rightNear;
  if (offset === 2) return placements.leftOuter;
  if (offset === -2) return placements.rightOuter;
  return placements.center;
}

function createParticipantRing(
  color: number,
  pulsePhase: number,
  host: boolean,
  sketchPolish = false,
) {
  const group = new THREE.Group();

  const underglowMaterial = new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity: sketchPolish ? 0.018 : 0.045,
    side: THREE.DoubleSide,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    toneMapped: !sketchPolish,
  });
  const underglow = new THREE.Mesh(
    new THREE.CircleGeometry(sketchPolish ? 1.03 : 1.08, 48),
    underglowMaterial,
  );
  underglow.rotation.x = -Math.PI / 2;
  underglow.position.y = -0.018;

  const floorMaterial = new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity: sketchPolish ? 0.010 : 0.11,
    side: THREE.DoubleSide,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    toneMapped: !sketchPolish,
  });
  const floorGlow = new THREE.Mesh(
    new THREE.CircleGeometry(sketchPolish ? 0.72 : 0.76, 48),
    floorMaterial,
  );
  floorGlow.rotation.x = -Math.PI / 2;
  floorGlow.position.y = -0.006;

  const haloMaterial = new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity: sketchPolish ? 0.13 : 0.22,
    side: THREE.DoubleSide,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    toneMapped: !sketchPolish,
  });
  const halo = new THREE.Mesh(
    new THREE.RingGeometry(sketchPolish ? 0.878 : 0.68, 1.008, sketchPolish ? 128 : 96, sketchPolish ? 8 : 1),
    haloMaterial,
  );
  halo.rotation.x = -Math.PI / 2;
  halo.position.y = 0.002;
  if (sketchPolish) {
    const positions = halo.geometry.getAttribute("position");
    const falloff: number[] = [];
    for (let i = 0; i < positions.count; i += 1) {
      const radius = Math.hypot(positions.getX(i), positions.getY(i));
      const strength = Math.exp(-Math.pow((radius - 0.94) / 0.035, 2));
      falloff.push(strength, strength, strength);
    }
    halo.geometry.setAttribute("color", new THREE.Float32BufferAttribute(falloff, 3));
    haloMaterial.vertexColors = true;
  }

  const outerMaterial = new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity: sketchPolish ? 0.95 : 0.2,
    side: THREE.DoubleSide,
    depthWrite: false,
    blending: sketchPolish ? THREE.NormalBlending : THREE.AdditiveBlending,
    toneMapped: !sketchPolish,
  });
  const outer = new THREE.Mesh(
    new THREE.RingGeometry(sketchPolish ? 0.892 : 0.95, sketchPolish ? 0.982 : 1.035, sketchPolish ? 128 : 64),
    outerMaterial,
  );
  outer.rotation.x = -Math.PI / 2;
  outer.position.y = 0.008;

  const coreMaterial = new THREE.MeshBasicMaterial({
    color: sketchPolish ? new THREE.Color(color).lerp(new THREE.Color(0xffffff), 0.24) : color,
    transparent: true,
    opacity: sketchPolish ? 0.94 : 0.94,
    side: THREE.DoubleSide,
    depthWrite: false,
    blending: THREE.NormalBlending,
    toneMapped: !sketchPolish,
  });
  const core = new THREE.Mesh(
    new THREE.RingGeometry(sketchPolish ? 0.718 : 0.79, sketchPolish ? 0.804 : 0.875, sketchPolish ? 128 : 64),
    coreMaterial,
  );
  core.rotation.x = -Math.PI / 2;
  core.position.y = 0.014;

  const innerMaterial = new THREE.MeshBasicMaterial({
    color: sketchPolish ? color : host ? 0xffd454 : color,
    transparent: true,
    opacity: sketchPolish ? 0.78 : host ? 0.66 : 0.34,
    side: THREE.DoubleSide,
    depthWrite: false,
    blending: sketchPolish ? THREE.NormalBlending : THREE.AdditiveBlending,
    toneMapped: !sketchPolish,
  });
  const inner = new THREE.Mesh(
    new THREE.RingGeometry(sketchPolish ? 0.580 : 0.55, sketchPolish ? 0.593 : 0.59, sketchPolish ? 128 : 64),
    innerMaterial,
  );
  inner.rotation.x = -Math.PI / 2;
  inner.position.y = 0.018;

  const shineMaterial = new THREE.MeshBasicMaterial({
    color: sketchPolish ? new THREE.Color(color).lerp(new THREE.Color(0xffffff), 0.32) : 0xffffff,
    transparent: true,
    opacity: sketchPolish ? 0.24 : 0,
    side: THREE.DoubleSide,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    toneMapped: !sketchPolish,
  });
  const shine = new THREE.Mesh(
    new THREE.RingGeometry(sketchPolish ? 0.933 : 0.835, sketchPolish ? 0.944 : 0.86, sketchPolish ? 128 : 64),
    shineMaterial,
  );
  shine.rotation.x = -Math.PI / 2;
  shine.position.y = 0.02;

  group.add(underglow, floorGlow, halo, outer, core, inner, shine);
  group.userData.pulsePhase = pulsePhase;
  group.userData.emphasis = host ? 0.55 : 0;
  group.userData.depthBoost = 0;
  group.userData.underglowMaterial = underglowMaterial;
  group.userData.haloMaterial = haloMaterial;
  group.userData.outerMaterial = outerMaterial;
  group.userData.coreMaterial = coreMaterial;
  group.userData.innerMaterial = innerMaterial;
  group.userData.shineMaterial = shineMaterial;
  group.userData.floorMaterial = floorMaterial;
  group.userData.sketchPolish = sketchPolish;
  group.userData.depthScale = sketchPolish ? 0.70 : 1;
  group.userData.accent = color;
  if (sketchPolish) {
    // Keep decals parallel to the floor; compress depth without tilting their plane.
    // Transparent floor sorting otherwise paints over the distant rings. Render
    // decals after floor overlays, but retain depthTest against actors and risers.
    group.renderOrder = 2;
    group.children.forEach((object, index) => { object.renderOrder = index; });
    group.traverse(object => object.layers.set(1));
    // No mirror copies: the raised outer slots otherwise produce detached
    // ellipses. The radial halo supplies contact light on the floor itself.
  }
  return group;
}

function createSketchFloorTexture(maxAnisotropy: number) {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 512;
  const context = canvas.getContext("2d");
  if (!context) return null;

  const palette = WAITING_ROOM_SKETCH_BLUEPRINT.palette.floor;
  const base = context.createLinearGradient(0, 0, 0, 512);
  base.addColorStop(0, sketchColorCss(palette.baseDark));
  base.addColorStop(0.46, sketchColorCss(palette.baseMid));
  base.addColorStop(0.73, sketchColorCss(palette.baseViolet));
  base.addColorStop(1, sketchColorCss(palette.baseDark));
  context.fillStyle = base;
  context.fillRect(0, 0, 512, 512);

  const centerGlow = context.createRadialGradient(256, 318, 20, 256, 318, 250);
  centerGlow.addColorStop(0, sketchColorRgba(palette.violetReflection, 0.64));
  centerGlow.addColorStop(0.50, sketchColorRgba(palette.violetReflection, 0.38));
  centerGlow.addColorStop(1, "rgba(0,0,0,0)");
  context.fillStyle = centerGlow;
  context.fillRect(0, 0, 512, 512);

  const leftGlow = context.createRadialGradient(118, 330, 8, 118, 330, 155);
  leftGlow.addColorStop(0, sketchColorRgba(palette.cyanReflection, 0.61));
  leftGlow.addColorStop(1, "rgba(0,0,0,0)");
  context.fillStyle = leftGlow;
  context.fillRect(0, 0, 512, 512);

  const rightGlow = context.createRadialGradient(394, 330, 8, 394, 330, 155);
  rightGlow.addColorStop(0, sketchColorRgba(palette.magentaReflection, 0.60));
  rightGlow.addColorStop(1, "rgba(0,0,0,0)");
  context.fillStyle = rightGlow;
  context.fillRect(0, 0, 512, 512);

  for (let index = 0; index <= 8; index += 1) {
    const coordinate = index * 64;
    context.strokeStyle = index % 2
      ? sketchColorRgba(palette.magentaReflection, 0.33)
      : sketchColorRgba(palette.cyanReflection, 0.33);
    context.lineWidth = index === 4 ? 1.65 : 0.90;
    context.beginPath();
    context.moveTo(coordinate, 0);
    context.lineTo(coordinate, 512);
    context.stroke();
    context.beginPath();
    context.moveTo(0, coordinate);
    context.lineTo(512, coordinate);
    context.stroke();
  }

  for (const [x, tint] of [
    [116, sketchColorRgba(palette.cyanReflection, 0.64)],
    [256, sketchColorRgba(palette.violetReflection, 0.52)],
    [396, sketchColorRgba(palette.magentaReflection, 0.64)],
  ] as const) {
    const streak = context.createLinearGradient(x - 38, 0, x + 38, 0);
    streak.addColorStop(0, "rgba(255,255,255,0)");
    streak.addColorStop(0.5, tint);
    streak.addColorStop(1, "rgba(255,255,255,0)");
    context.fillStyle = streak;
    context.fillRect(x - 38, 0, 76, 512);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = Math.min(4, maxAnisotropy);
  return texture;
}

function createSketchFloorLightTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 512;
  const context = canvas.getContext("2d");
  if (!context) return null;
  // CircleGeometry UVs span the full 18-world-unit floor, not just the viewport.
  const px = (world: number) => 256 + world / WAITING_ROOM_SKETCH_BLUEPRINT.scene.floor.radius * 256;
  context.fillStyle = "#000";
  context.fillRect(0, 0, 512, 512);
  for (const [worldX, color] of [[-2.8, "50,229,255"], [0.1, "164,108,255"], [2.8, "244,90,231"]] as const) {
    const x = px(worldX);
    const across = context.createLinearGradient(x - 18, 0, x + 18, 0);
    across.addColorStop(0, `rgba(${color},0)`);
    across.addColorStop(0.34, `rgba(${color},0.26)`);
    across.addColorStop(0.50, `rgba(${color},1)`);
    across.addColorStop(0.66, `rgba(${color},0.26)`);
    across.addColorStop(1, `rgba(${color},0)`);
    context.fillStyle = across;
    context.fillRect(x - 18, 122, 36, 260);
  }
  // Real floor-plane grid; perspective is supplied by the floor plane.
  context.strokeStyle = "rgba(112,143,246,.48)";
  context.lineWidth = 0.82;
  for (let world = -8; world <= 8; world += 0.9) {
    const coordinate = px(world);
    context.beginPath();
    context.moveTo(coordinate, 0); context.lineTo(coordinate, 512);
    context.moveTo(0, coordinate); context.lineTo(512, coordinate);
    context.stroke();
  }
  const fade = context.createLinearGradient(0, 112, 0, 398);
  fade.addColorStop(0, "rgba(0,0,0,0)");
  fade.addColorStop(0.2, "rgba(0,0,0,.85)");
  fade.addColorStop(0.65, "rgba(0,0,0,.65)");
  fade.addColorStop(1, "rgba(0,0,0,0)");
  context.globalCompositeOperation = "destination-in";
  context.fillStyle = fade;
  context.fillRect(0, 0, 512, 512);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function createSketchBulbGlowTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 64;
  canvas.height = 64;
  const context = canvas.getContext("2d");
  if (!context) return null;
  const gradient = context.createRadialGradient(32, 32, 2, 32, 32, 31);
  gradient.addColorStop(0, "rgba(255,255,255,0.96)");
  gradient.addColorStop(0.18, "rgba(255,255,255,0.68)");
  gradient.addColorStop(0.46, "rgba(255,255,255,0.18)");
  gradient.addColorStop(1, "rgba(255,255,255,0)");
  context.fillStyle = gradient;
  context.fillRect(0, 0, 64, 64);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

function createSketchSpotBeam(
  source: THREE.Vector3,
  target: THREE.Vector3,
  color: number,
  radius: number,
  opacity: number,
) {
  const group = new THREE.Group();
  const direction = target.clone().sub(source);
  const length = direction.length();
  const directionNormal = direction.clone().normalize();
  const beamQuaternion = new THREE.Quaternion().setFromUnitVectors(
    new THREE.Vector3(0, -1, 0),
    directionNormal,
  );

  const beam = new THREE.Mesh(
    new THREE.ConeGeometry(radius, length, 32, 1, true),
    new THREE.ShaderMaterial({
      uniforms: {
        lightColor: { value: new THREE.Color(color) },
        lightOpacity: { value: opacity },
      },
      vertexShader: `
        varying vec2 beamUv;
        varying vec3 beamNormal;
        varying vec3 beamView;
        void main() {
          beamUv = uv;
          vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);
          beamNormal = normalize(normalMatrix * normal);
          beamView = -viewPosition.xyz;
          gl_Position = projectionMatrix * viewPosition;
        }
      `,
      fragmentShader: `
        uniform vec3 lightColor;
        uniform float lightOpacity;
        varying vec2 beamUv;
        varying vec3 beamNormal;
        varying vec3 beamView;
        void main() {
          float feather = pow(abs(dot(normalize(beamNormal), normalize(beamView))), 1.5);
          float fade = smoothstep(0.0, 0.65, beamUv.y) * (0.3 + 0.7 * beamUv.y);
          gl_FragColor = vec4(lightColor, lightOpacity * feather * fade);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }
      `,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
    }),
  );
  beam.position.copy(source).add(target).multiplyScalar(0.5);
  beam.quaternion.copy(beamQuaternion);
  group.add(beam);

  const housing = new THREE.Mesh(
    new THREE.CylinderGeometry(radius * 0.12, radius * 0.18, 0.24, 18),
    new THREE.MeshStandardMaterial({
      color: 0x11172c,
      emissive: new THREE.Color(color).multiplyScalar(0.20),
      emissiveIntensity: 0.48,
      roughness: 0.32,
      metalness: 0.54,
    }),
  );
  housing.position.copy(source);
  housing.quaternion.copy(beamQuaternion);
  group.add(housing);

  const lensQuaternion = new THREE.Quaternion().setFromUnitVectors(
    new THREE.Vector3(0, 0, 1),
    directionNormal,
  );
  const lens = new THREE.Mesh(
    new THREE.CircleGeometry(radius * 0.105, 24),
    new THREE.MeshBasicMaterial({
      color: 0xf8fdff,
      transparent: true,
      opacity: 0.78,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
    }),
  );
  lens.position.copy(source).add(directionNormal.clone().multiplyScalar(0.14));
  lens.quaternion.copy(lensQuaternion);
  group.add(lens);

  let sourceGlow: THREE.Sprite | null = null;
  const glowTexture = createSketchBulbGlowTexture();
  if (glowTexture) {
    sourceGlow = new THREE.Sprite(new THREE.SpriteMaterial({
      map: glowTexture,
      color,
      transparent: true,
      opacity: 0.34,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
    }));
    sourceGlow.position.copy(lens.position);
    sourceGlow.scale.setScalar(radius * 0.72);
    group.add(sourceGlow);
  }

  // Re-aim the existing meshes at the fixed stage target; translating a whole
  // cone would move its pool as well and disconnect the visual beam from light.
  const setEndpoints = (nextSource: THREE.Vector3, nextTarget: THREE.Vector3) => {
    const nextDirection = nextTarget.clone().sub(nextSource);
    const nextLength = nextDirection.length();
    const normal = nextDirection.normalize();
    const rotation = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, -1, 0), normal);
    beam.position.copy(nextSource).add(nextTarget).multiplyScalar(0.5);
    beam.scale.y = nextLength / length;
    beam.quaternion.copy(rotation);
    housing.position.copy(nextSource);
    housing.quaternion.copy(rotation);
    lens.position.copy(nextSource).addScaledVector(normal, 0.14);
    lens.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal);
    sourceGlow?.position.copy(lens.position);
  };
  return Object.assign(group, { setEndpoints });
}

function setScale(node: StageNode, actorMultiplier: number, ringMultiplier = actorMultiplier) {
  node.actor.scale.copy(node.baseScale).multiplyScalar(actorMultiplier);
  const depthScale = Number(node.ring.userData.depthScale ?? 1);
  node.ring.scale.set(ringMultiplier, ringMultiplier, ringMultiplier * depthScale);
}

export default function WaitingRoomStage3D({
  participants,
  slots,
  roomId,
  stageId,
  visualPreset = "default",
  viewMode,
  pageIndex,
  selectedParticipantId,
  pageSize = 2,
  calibrationMode = false,
  blueprintMode = false,
  calibrationResetToken = 0,
  onCalibrationLayoutChange,
  onSelectParticipant,
}: Props) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const identityRefs = useRef(new Map<string, HTMLButtonElement>());
  const stageNodesRef = useRef(new Map<string, StageNode>());
  const calibrationOverridesRef = useRef(new Map<string, WaitingRoomCalibrationPlacement>());
  const slotPlaceholdersRef = useRef<SlotPlaceholder[]>([]);
  const slotsRef = useRef(slots);
  const renderRef = useRef<(() => void) | null>(null);
  const layoutRef = useRef<(() => void) | null>(null);
  const reconcileParticipantsRef = useRef<(() => void) | null>(null);
  const selectCallbackRef = useRef(onSelectParticipant);
  const calibrationModeRef = useRef(calibrationMode);
  const visualPresetRef = useRef<WaitingRoomVisualPreset>(visualPreset);
  const calibrationCallbackRef = useRef(onCalibrationLayoutChange);
  const participantsRef = useRef(participants);
  const viewRef = useRef({ viewMode, pageIndex, pageSize, selectedParticipantId });
  const [loadState, setLoadState] = useState<"loading" | "ready" | "fallback">("loading");
  const [sceneGeneration, setSceneGeneration] = useState(0);
  const [renderedActorCount, setRenderedActorCount] = useState(0);
  const [idleRuntimeCount, setIdleRuntimeCount] = useState(0);
  const [idleSource, setIdleSource] = useState<"loading" | "published" | "builtin" | "none">("loading");
  const stagePresentationReady = loadState !== "loading"
    && renderedActorCount >= participants.length;

  selectCallbackRef.current = onSelectParticipant;
  calibrationModeRef.current = calibrationMode;
  visualPresetRef.current = visualPreset;
  calibrationCallbackRef.current = onCalibrationLayoutChange;
  participantsRef.current = participants;
  slotsRef.current = slots;
  viewRef.current = { viewMode, pageIndex, pageSize, selectedParticipantId };

  const slotStateKey = useMemo(
    () => slots.map(slot => `${slot.slotIndex}:${slot.state}`).join("|"),
    [slots],
  );

  const participantRenderKey = useMemo(
    () => participants.map(lobbyStageParticipantIdentity).join("|"),
    [participants],
  );

  const visibleParticipants = useMemo(() => {
    if (viewMode === "wide") return participants;
    if (viewMode === "close") {
      const selected = participants.find(item => item.participantId === selectedParticipantId);
      return selected ? [selected] : participants.slice(0, 1);
    }
    return participants.slice(pageIndex * pageSize, pageIndex * pageSize + pageSize);
  }, [pageIndex, pageSize, participants, selectedParticipantId, viewMode]);

  const hostParticipant = participants.find(participant => participant.role === "host") ?? null;
  const focusedParticipant = participants.find(participant => participant.participantId === selectedParticipantId)
    ?? hostParticipant
    ?? participants[0]
    ?? null;

  useEffect(() => {
    layoutRef.current?.();
  }, [pageIndex, pageSize, selectedParticipantId, slotStateKey, viewMode]);

  useEffect(() => {
    if (!calibrationMode) return;
    calibrationOverridesRef.current.clear();
    layoutRef.current?.();
  }, [calibrationMode, calibrationResetToken]);

  useEffect(() => {
    reconcileParticipantsRef.current?.();
  }, [participantRenderKey]);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    let disposed = false;
    setSceneGeneration(current => current + 1);
    let animationFrame = 0;
    let lastFrameMs = 0;
    let accumulatedMs = 0;
    let idleClips: readonly THREE.AnimationClip[] = [];
    let releaseVersion = 0;
    const actorSources = new Map<CharacterAssetId, THREE.Object3D>();
    const idleClipsByAssetId = new Map<CharacterAssetId, readonly THREE.AnimationClip[]>();
    let characterAssetsReady = false;

    const idleRuntimeByParticipant = new Map<string, IdleRuntime>();
    const disposableSources: THREE.Object3D[] = [];
    stageNodesRef.current.clear();
    slotPlaceholdersRef.current = [];
    setIdleRuntimeCount(0);
    setIdleSource("loading");

    const sketchVisual = visualPreset === "sketch";
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
    if (sketchVisual) camera.layers.enable(1);
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: "high-performance",
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.15));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = sketchVisual ? 1.15 : 1.16;
    renderer.setClearColor(0x000000, 0);
    mount.appendChild(renderer.domElement);

    scene.add(new THREE.HemisphereLight(
      sketchVisual ? WAITING_ROOM_SKETCH_BLUEPRINT.palette.actor.hemisphereSky : 0x9bb4ff,
      sketchVisual ? WAITING_ROOM_SKETCH_BLUEPRINT.palette.actor.hemisphereGround : 0x050510,
      sketchVisual ? WAITING_ROOM_SKETCH_BLUEPRINT.scene.lighting.hemisphereIntensity : 1.34,
    ));

    const key = new THREE.DirectionalLight(
      sketchVisual ? WAITING_ROOM_SKETCH_BLUEPRINT.palette.actor.key : 0xf8fbff,
      sketchVisual ? WAITING_ROOM_SKETCH_BLUEPRINT.scene.lighting.keyIntensity : 2.32,
    );
    key.position.set(sketchVisual ? -2.4 : 1.8, sketchVisual ? 4.8 : 6.8, 5.9);
    scene.add(key);

    const frontFill = new THREE.DirectionalLight(
      sketchVisual ? WAITING_ROOM_SKETCH_BLUEPRINT.palette.actor.fill : 0xffffff,
      sketchVisual ? WAITING_ROOM_SKETCH_BLUEPRINT.scene.lighting.fillIntensity : 0.82,
    );
    frontFill.position.set(0, 3.2, 6.8);
    scene.add(frontFill);

    const cyanRim = new THREE.SpotLight(
      sketchVisual ? 0x20e8ff : 0x42dcff,
      sketchVisual ? WAITING_ROOM_SKETCH_BLUEPRINT.scene.lighting.cyanRimIntensity : 16,
      16,
      Math.PI / 4.2,
      0.72,
      1.6,
    );
    cyanRim.position.set(-4.7, 6.1, 2.8);
    cyanRim.target.position.set(-0.8, 1.7, 0);
    scene.add(cyanRim, cyanRim.target);

    const magentaRim = new THREE.SpotLight(
      sketchVisual ? 0xff20d5 : 0xff43cc,
      sketchVisual ? WAITING_ROOM_SKETCH_BLUEPRINT.scene.lighting.magentaRimIntensity : 15,
      16,
      Math.PI / 4.2,
      0.72,
      1.6,
    );
    magentaRim.position.set(4.7, 5.8, 2.2);
    magentaRim.target.position.set(0.8, 1.65, 0);
    scene.add(magentaRim, magentaRim.target);

    const overhead = new THREE.SpotLight(
      0xcad8ff,
      sketchVisual ? WAITING_ROOM_SKETCH_BLUEPRINT.scene.lighting.overheadIntensity : 14,
      16,
      Math.PI / 5,
      0.7,
      1.7,
    );
    overhead.position.set(0, 7.5, 1.1);
    overhead.target.position.set(0, 1.2, 0);
    scene.add(overhead, overhead.target);

    const sketchFloorTexture = sketchVisual
      ? createSketchFloorTexture(renderer.capabilities.getMaxAnisotropy())
      : null;
    let sketchReflector: Reflector | null = null;
    if (sketchVisual) {
      const reflectionSize = Math.min(
        640,
        Math.max(320, Math.round(Math.min(window.innerWidth, 640) * 0.82)),
      );
      sketchReflector = new Reflector(new THREE.CircleGeometry(WAITING_ROOM_SKETCH_BLUEPRINT.scene.floor.radius, 96), {
        clipBias: 0.0025,
        textureWidth: reflectionSize,
        textureHeight: reflectionSize,
        color: WAITING_ROOM_SKETCH_BLUEPRINT.palette.floor.reflectorTint,
      });
      sketchReflector.rotation.x = -Math.PI / 2;
      sketchReflector.position.set(0, -0.056, 0.18);
      scene.add(sketchReflector);
    }

    const floor = new THREE.Mesh(
      new THREE.CircleGeometry(
        sketchVisual ? WAITING_ROOM_SKETCH_BLUEPRINT.scene.floor.radius : 5.75,
        sketchVisual ? 96 : 64,
      ),
      sketchVisual
        ? new THREE.MeshPhysicalMaterial({
            color: WAITING_ROOM_SKETCH_BLUEPRINT.palette.floor.surface,
            map: sketchFloorTexture ?? undefined,
            transparent: true,
            opacity: WAITING_ROOM_SKETCH_BLUEPRINT.material.floor.opacity,
            emissive: WAITING_ROOM_SKETCH_BLUEPRINT.palette.floor.emissive,
            emissiveIntensity: WAITING_ROOM_SKETCH_BLUEPRINT.material.floor.emissiveIntensity,
            roughness: WAITING_ROOM_SKETCH_BLUEPRINT.material.floor.roughness,
            metalness: WAITING_ROOM_SKETCH_BLUEPRINT.material.floor.metalness,
            clearcoat: WAITING_ROOM_SKETCH_BLUEPRINT.material.floor.clearcoat,
            clearcoatRoughness: WAITING_ROOM_SKETCH_BLUEPRINT.material.floor.clearcoatRoughness,
            depthWrite: false,
          })
        : new THREE.MeshStandardMaterial({
            color: 0x76567f,
            emissive: 0x2f183c,
            emissiveIntensity: 0.34,
            roughness: 0.42,
            metalness: 0.18,
          }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(0, sketchVisual ? -0.043 : -0.045, 0.18);
    scene.add(floor);
    if (sketchVisual) {
      const lightMap = createSketchFloorLightTexture();
      if (lightMap) {
        const lightDecal = new THREE.Mesh(
          new THREE.CircleGeometry(WAITING_ROOM_SKETCH_BLUEPRINT.scene.floor.radius, 96),
          new THREE.MeshBasicMaterial({
            map: lightMap, transparent: true, opacity: 0.82,
            blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false,
          }),
        );
        lightDecal.name = "SketchFloorLocalReflections";
        lightDecal.rotation.x = -Math.PI / 2;
        lightDecal.position.set(0, -0.032, 0.18);
        lightDecal.renderOrder = 1;
        scene.add(lightDecal);
      }
    }

    const floorHaloMaterial = new THREE.MeshBasicMaterial({
      color: sketchVisual ? WAITING_ROOM_SKETCH_BLUEPRINT.palette.floor.halo : 0xb983ff,
      transparent: true,
      opacity: sketchVisual ? WAITING_ROOM_SKETCH_BLUEPRINT.material.floor.haloOpacity : 0.19,
      side: THREE.DoubleSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const floorHalo = new THREE.Mesh(
      new THREE.RingGeometry(
        sketchVisual ? WAITING_ROOM_SKETCH_BLUEPRINT.scene.floor.haloInner : 3.55,
        sketchVisual ? WAITING_ROOM_SKETCH_BLUEPRINT.scene.floor.haloOuter : 5.35,
        sketchVisual ? 80 : 64,
      ),
      floorHaloMaterial,
    );
    floorHalo.rotation.x = -Math.PI / 2;
    floorHalo.position.set(0, -0.027, 0.18);
    scene.add(floorHalo);

    const runway = new THREE.Mesh(
      new THREE.PlaneGeometry(
        sketchVisual ? WAITING_ROOM_SKETCH_BLUEPRINT.scene.floor.runwayWidth : 5.9,
        sketchVisual ? WAITING_ROOM_SKETCH_BLUEPRINT.scene.floor.runwayDepth : 2.2,
      ),
      new THREE.MeshBasicMaterial({
        color: sketchVisual ? WAITING_ROOM_SKETCH_BLUEPRINT.palette.floor.runway : 0xe39a7c,
        transparent: true,
        opacity: sketchVisual ? WAITING_ROOM_SKETCH_BLUEPRINT.material.floor.runwayOpacity : 0.12,
        side: THREE.DoubleSide,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    );
    runway.rotation.x = -Math.PI / 2;
    runway.position.set(0, -0.02, 0.42);
    scene.add(runway);

    const sketchFixtures: { beam: ReturnType<typeof createSketchSpotBeam>; spot: THREE.SpotLight; source: THREE.Vector3; target: THREE.Vector3; t: number }[] = [];
    if (sketchVisual) {
      scene.add(createSketchStageSet());

      const beamSpecs = WAITING_ROOM_SKETCH_BLUEPRINT.scene.beams;
      beamSpecs.forEach((spec, index) => {
        const source = new THREE.Vector3(spec.x, spec.y, spec.z);
        const target = new THREE.Vector3(spec.targetX, 0.48, -1.25);
        const beam = createSketchSpotBeam(source, target, spec.color, 0.96, spec.opacity);
        scene.add(beam);

        const spot = new THREE.SpotLight(
          spec.color,
          WAITING_ROOM_SKETCH_BLUEPRINT.scene.lighting.beamSpotIntensity,
          11.8,
          Math.PI / 6.0,
          0.86,
          1.45,
        );
        spot.position.copy(source);
        spot.target.position.copy(target);
        scene.add(spot, spot.target);
        sketchFixtures.push({ beam, spot, source, target, t: [0.12, 0.26, 0.36, 0.64, 0.74, 0.88][index] });
      });

      const upperGlow = new THREE.PointLight(
        WAITING_ROOM_SKETCH_BLUEPRINT.scene.lighting.upperGlowColor,
        WAITING_ROOM_SKETCH_BLUEPRINT.scene.lighting.upperGlowIntensity,
        10,
        1.8,
      );
      upperGlow.position.set(0, 4.55, 0.25);
      scene.add(upperGlow);
    }

    for (let slotIndex = 0; slotIndex < WAITING_ROOM_MAX_PLAYERS; slotIndex += 1) {
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

    const projectedHead = new THREE.Vector3();
    const updateIdentityLabels = () => {
      const width = Math.max(1, mount.clientWidth);
      const height = Math.max(1, mount.clientHeight);
      stageNodesRef.current.forEach(node => {
        const element = identityRefs.current.get(node.participant.participantId);
        if (!element) return;
        if (!node.actor.visible) {
          element.style.opacity = "0";
          element.style.pointerEvents = "none";
          return;
        }
        element.style.pointerEvents = calibrationModeRef.current ? "none" : "auto";
        const scaleMultiplier = node.baseScale.y
          ? node.actor.scale.y / node.baseScale.y
          : node.targetActorScale;
        const sketchWideIdentity = visualPresetRef.current === "sketch"
          && viewRef.current.viewMode === "wide";
        const projectedHeadHeight = sketchWideIdentity ? 4.06 : 4.18;
        projectedHead
          .set(
            node.actor.position.x,
            node.actor.position.y + projectedHeadHeight * scaleMultiplier,
            node.actor.position.z,
          )
          .project(camera);
        const x = (projectedHead.x * 0.5 + 0.5) * width;
        const y = (-projectedHead.y * 0.5 + 0.5) * height;
        const labelAnchorTop = viewRef.current.viewMode === "close"
          ? Math.max(y - 34, 64)
          : y + (sketchWideIdentity
            ? node.participant.role === "host"
              ? WAITING_ROOM_SKETCH_BLUEPRINT.ownerOverrides.hostWideLabelOffsetPx
              : WAITING_ROOM_SKETCH_BLUEPRINT.ownerOverrides.guestWideLabelOffsetPx
            : -8);
        element.style.left = `${x}px`;
        element.style.top = `${labelAnchorTop}px`;
        element.style.opacity = "1";
      });
    };

    let fixtureLayout = "";
    const render = () => {
      const width = Math.max(1, mount.clientWidth);
      const height = Math.max(1, mount.clientHeight);
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      const nextFixtureLayout = sketchFixtureLayoutKey(camera, width, height);
      if (sketchVisual && fixtureLayout !== nextFixtureLayout) {
        // Attach 3D housings to the SVG chord after resize/preset changes. Only
        // fixture transforms move: geometry, actors and mixers are untouched.
        camera.updateMatrixWorld(true);
        for (const fixture of sketchFixtures) {
          const position = sketchFixtureSource(camera, fixture.t, fixture.source.z);
          if (!position) continue;
          fixture.beam.setEndpoints(position, fixture.target);
          fixture.spot.position.copy(position);
        }
        fixtureLayout = nextFixtureLayout;
      }
      renderer.render(scene, camera);
      updateIdentityLabels();
    };
    renderRef.current = render;

    const emitCalibrationLayout = () => {
      if (!calibrationModeRef.current) return;
      const snapshot: WaitingRoomCalibrationLayout = {};
      stageNodesRef.current.forEach(node => {
        snapshot[node.participant.participantId] = {
          x: Number(node.targetPosition.x.toFixed(4)),
          y: Number(node.targetPosition.y.toFixed(4)),
          z: Number(node.targetPosition.z.toFixed(4)),
          scale: Number(node.targetActorScale.toFixed(4)),
          rotationY: Number(node.targetRotationY.toFixed(4)),
        };
      });
      calibrationCallbackRef.current?.(snapshot);
    };

    const applyLayout = () => {
      const current = viewRef.current;
      const activeParticipants = participantsRef.current;
      const focusedParticipant = activeParticipants.find(
        participant => participant.participantId === current.selectedParticipantId,
      ) ?? activeParticipants.find(participant => participant.role === "host")
        ?? activeParticipants[current.pageIndex * current.pageSize]
        ?? activeParticipants[0]
        ?? null;
      const selected = focusedParticipant?.participantId ?? null;
      const focusSlotIndex = focusedParticipant?.slotIndex ?? 0;

      stageNodesRef.current.forEach(node => {
        const { participant, index } = node;
        let visible = false;
        let x = 0;
        let y = 0;
        let z = 0;
        let rotationY = 0;
        let actorScale = 0.88;
        let ringScale = 0.96;

        if (current.viewMode === "wide") {
          visible = true;
          const placement = wideSlotPlacement(
            participant.slotIndex,
            focusSlotIndex,
            visualPresetRef.current,
          );
          x = placement.x;
          y = placement.y;
          z = placement.z;
          rotationY = placement.rotationY;
          actorScale = placement.scale;
          ringScale = visualPresetRef.current === "sketch" && "ringScale" in placement
            ? placement.ringScale
            : participant.participantId === selected ? 0.96 : placement.scale;
          if (participant.participantId === selected && visualPresetRef.current !== "sketch") {
            actorScale *= 1.03;
            ringScale *= 1.03;
          }
          const calibrationOverride = calibrationModeRef.current
            ? calibrationOverridesRef.current.get(participant.participantId)
            : null;
          if (calibrationOverride) {
            x = calibrationOverride.x;
            y = calibrationOverride.y;
            z = calibrationOverride.z;
            rotationY = calibrationOverride.rotationY;
            actorScale = calibrationOverride.scale;
            ringScale = calibrationOverride.scale;
          }
        } else if (current.viewMode === "close") {
          visible = participant.participantId === selected;
          actorScale = 0.90;
          ringScale = 0.96;
        } else {
          const pageStart = current.pageIndex * current.pageSize;
          visible = index >= pageStart && index < pageStart + current.pageSize;
          const position = centerPosition(index, activeParticipants.length, current.pageSize);
          x = position.x;
          z = position.z;
          rotationY = position.rotationY;
        }

        node.actor.visible = visible;
        node.ring.visible = visible;
        node.targetPosition.set(x, y, z);
        node.targetRotationY = rotationY;
        node.targetActorScale = actorScale;
        node.targetRingScale = ringScale;
        if (!node.layoutReady || current.viewMode !== "wide") {
          node.actor.position.copy(node.targetPosition);
          node.actor.rotation.y = node.targetRotationY;
          node.ring.position.set(x, y + 0.02, z);
          setScale(node, actorScale, ringScale);
          node.layoutReady = true;
        }
        const selectedRing = participant.participantId === selected;
        node.ring.userData.emphasis = selectedRing ? 1 : participant.role === "host" ? 0.55 : 0;
        node.ring.userData.depthBoost = visualPresetRef.current === "sketch" && Math.abs(x) > 2.2
          ? 1.75
          : 0;
        if (visualPresetRef.current === "sketch") {
          const accent = participantSketchRingAccent(participant);
          if (node.ring.userData.accent !== accent) {
            // Recolor only the existing decal materials; actors and mixers stay untouched.
            for (const key of ["underglowMaterial", "haloMaterial", "outerMaterial", "coreMaterial", "innerMaterial", "floorMaterial"]) {
              (node.ring.userData[key] as THREE.MeshBasicMaterial).color.setHex(accent);
            }
            (node.ring.userData.shineMaterial as THREE.MeshBasicMaterial).color
              .setHex(accent).lerp(new THREE.Color(0xffffff), 0.32);
            node.ring.userData.accent = accent;
          }
        }
      });

      slotPlaceholdersRef.current.forEach(placeholder => {
        const slot = slotsRef.current.find(item => item.slotIndex === placeholder.slotIndex);
        const placement = wideSlotPlacement(
          placeholder.slotIndex,
          focusSlotIndex,
          visualPresetRef.current,
        );
        placeholder.group.position.set(placement.x, placement.y + 0.02, placement.z);
        placeholder.group.scale.setScalar(Math.max(
          0.48,
          placement.scale * (visualPresetRef.current === "sketch" ? 1.05 : 1),
        ));
        const showPlaceholder = current.viewMode === "wide"
          && placeholder.slotIndex < WAITING_ROOM_MAX_PLAYERS
          && slot?.state !== "occupied";
        placeholder.group.visible = showPlaceholder;
        const closed = slot?.state === "closed";
        placeholder.ringMaterial.color.setHex(closed ? 0xff4f7d : 0x43dfff);
        placeholder.ringMaterial.opacity = closed ? 0.3 : 0.48;
        placeholder.bodyMaterial.color.setHex(closed ? 0xff557f : 0x4fcfff);
        placeholder.bodyMaterial.opacity = closed ? 0.08 : 0.16;
      });

      if (current.viewMode === "wide") {
        if (visualPresetRef.current === "sketch") {
          const sketchCamera = WAITING_ROOM_SKETCH_BLUEPRINT.scene.camera.wide;
          camera.fov = sketchCamera.fov;
          camera.position.set(sketchCamera.position.x, sketchCamera.position.y, sketchCamera.position.z);
          camera.lookAt(sketchCamera.lookAt.x, sketchCamera.lookAt.y, sketchCamera.lookAt.z);
        } else {
          camera.fov = 30;
          camera.position.set(0, 4.25, 13.05);
          camera.lookAt(0, 1.58, 0.18);
        }
      } else if (current.viewMode === "close") {
        camera.fov = 30;
        camera.position.set(0, 3.16, 9.45);
        camera.lookAt(0, 2.08, 0);
      } else {
        camera.fov = 30;
        camera.position.set(0, 3.08, 9.65);
        camera.lookAt(0, 2.0, 0);
      }
      render();
      emitCalibrationLayout();
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
      if (runtime.clips.length <= 1 || runtime.elapsedSeconds < runtime.holdSeconds) return;

      const nextOrdinal = runtime.transitionOrdinal + 1;
      const nextIndex = selectParticipantNextIdleIndex(
        runtime.participantId,
        runtime.clips.length,
        releaseVersion,
        roomId,
        nextOrdinal,
        runtime.currentIndex,
      );
      const nextClip = selectParticipantIdleClipByIndex(runtime.clips, nextIndex);
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
      if (animationFrame) return;
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
        idleRuntimeByParticipant.forEach(runtime => {
          runtime.mixer.update(deltaSeconds);
          switchIdleIfNeeded(runtime, deltaSeconds);
        });

        const ringTime = nowMs / 1000;
        const transitionAlpha = 1 - Math.exp(-deltaSeconds * 4.2);
        stageNodesRef.current.forEach(node => {
          if (viewRef.current.viewMode === "wide" && node.layoutReady) {
            node.actor.position.lerp(node.targetPosition, transitionAlpha);
            node.actor.rotation.y = THREE.MathUtils.lerp(
              node.actor.rotation.y,
              node.targetRotationY,
              transitionAlpha,
            );
            node.ring.position.x = THREE.MathUtils.lerp(
              node.ring.position.x,
              node.targetPosition.x,
              transitionAlpha,
            );
            node.ring.position.y = THREE.MathUtils.lerp(
              node.ring.position.y,
              node.targetPosition.y + 0.02,
              transitionAlpha,
            );
            node.ring.position.z = THREE.MathUtils.lerp(
              node.ring.position.z,
              node.targetPosition.z,
              transitionAlpha,
            );
            const actorScale = node.baseScale.x
              ? node.actor.scale.x / node.baseScale.x
              : node.targetActorScale;
            const nextActorScale = THREE.MathUtils.lerp(
              actorScale,
              node.targetActorScale,
              transitionAlpha,
            );
            const nextRingScale = THREE.MathUtils.lerp(
              node.ring.scale.x,
              node.targetRingScale,
              transitionAlpha,
            );
            setScale(node, nextActorScale, nextRingScale);
          }

          const phase = Number(node.ring.userData.pulsePhase ?? 0);
          const wave = (Math.sin(ringTime * 2.15 + phase) + 1) * 0.5;
          const emphasis = Number(node.ring.userData.emphasis ?? 0);
          const underglowMaterial = node.ring.userData.underglowMaterial as THREE.MeshBasicMaterial | undefined;
          const haloMaterial = node.ring.userData.haloMaterial as THREE.MeshBasicMaterial | undefined;
          const outerMaterial = node.ring.userData.outerMaterial as THREE.MeshBasicMaterial | undefined;
          const coreMaterial = node.ring.userData.coreMaterial as THREE.MeshBasicMaterial | undefined;
          const innerMaterial = node.ring.userData.innerMaterial as THREE.MeshBasicMaterial | undefined;
          const shineMaterial = node.ring.userData.shineMaterial as THREE.MeshBasicMaterial | undefined;
          const floorMaterial = node.ring.userData.floorMaterial as THREE.MeshBasicMaterial | undefined;
          const sketchRing = Boolean(node.ring.userData.sketchPolish);
          const depthBoost = Number(node.ring.userData.depthBoost ?? 0);
          if (sketchRing) {
            // All five slots use the same bright, non-additive core; only the
            // restrained halo receives distance compensation. No central-only boost.
            if (underglowMaterial) underglowMaterial.opacity = 0.032 + wave * 0.005;
            if (haloMaterial) haloMaterial.opacity = 0.15 + wave * 0.008 + depthBoost * 0.018;
            if (outerMaterial) outerMaterial.opacity = 0.96;
            if (coreMaterial) coreMaterial.opacity = 0.98;
            if (innerMaterial) innerMaterial.opacity = 0.76;
            if (shineMaterial) shineMaterial.opacity = 0.31 + wave * 0.008;
            if (floorMaterial) floorMaterial.opacity = 0.026;
          } else {
            if (underglowMaterial) underglowMaterial.opacity = 0.035 + wave * 0.035 + emphasis * 0.035;
            if (haloMaterial) haloMaterial.opacity = 0.17 + wave * 0.15 + emphasis * 0.09;
            if (outerMaterial) outerMaterial.opacity = 0.12 + wave * 0.12 + emphasis * 0.08;
            if (coreMaterial) coreMaterial.opacity = 0.86 + emphasis * 0.12;
            if (floorMaterial) floorMaterial.opacity = 0.07 + wave * 0.065 + emphasis * 0.055;
          }
        });
        render();
      };
      animationFrame = requestAnimationFrame(tick);
    };

    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    const activeCalibrationPointers = new Map<number, THREE.Vector2>();
    const dragPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const dragOffset = new THREE.Vector3();
    let calibrationParticipantId: string | null = null;
    let pinchStartDistance = 0;
    let pinchStartScale = 1;

    const setRayFromScreenPoint = (clientX: number, clientY: number) => {
      const rect = renderer.domElement.getBoundingClientRect();
      if (!rect.width || !rect.height) return false;
      pointer.x = ((clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);
      return true;
    };

    const participantAt = (clientX: number, clientY: number) => {
      if (!setRayFromScreenPoint(clientX, clientY)) return null;
      const intersections = raycaster.intersectObjects(
        [...stageNodesRef.current.values()].filter(node => node.actor.visible).map(node => node.actor),
        true,
      );
      const hit = intersections[0]?.object;
      let cursor: THREE.Object3D | null = hit ?? null;
      while (cursor && !cursor.userData.participantId) cursor = cursor.parent;
      return (cursor?.userData.participantId as string | undefined) ?? null;
    };

    const pointOnNodePlane = (clientX: number, clientY: number, node: StageNode) => {
      if (!setRayFromScreenPoint(clientX, clientY)) return null;
      dragPlane.constant = -node.targetPosition.y;
      return raycaster.ray.intersectPlane(dragPlane, new THREE.Vector3());
    };

    const currentPointerDistance = () => {
      const points = [...activeCalibrationPointers.values()];
      return points.length < 2 ? 0 : points[0].distanceTo(points[1]);
    };

    const writeCalibrationPlacement = (
      node: StageNode,
      placement: WaitingRoomCalibrationPlacement,
    ) => {
      calibrationOverridesRef.current.set(node.participant.participantId, placement);
      node.targetPosition.set(placement.x, placement.y, placement.z);
      node.targetRotationY = placement.rotationY;
      node.targetActorScale = placement.scale;
      node.targetRingScale = placement.scale;
      node.actor.position.copy(node.targetPosition);
      node.actor.rotation.y = node.targetRotationY;
      node.ring.position.set(placement.x, placement.y + 0.02, placement.z);
      setScale(node, placement.scale, placement.scale);
      render();
      emitCalibrationLayout();
    };

    const onPointerDown = (event: PointerEvent) => {
      if (calibrationModeRef.current && viewRef.current.viewMode === "wide") {
        event.preventDefault();

        if (activeCalibrationPointers.size === 0) {
          const hitParticipantId = participantAt(event.clientX, event.clientY);
          if (!hitParticipantId) return;
          calibrationParticipantId = hitParticipantId;
          const node = stageNodesRef.current.get(hitParticipantId);
          if (!node) return;
          const point = pointOnNodePlane(event.clientX, event.clientY, node);
          if (point) {
            dragOffset.set(
              node.targetPosition.x - point.x,
              0,
              node.targetPosition.z - point.z,
            );
          }
        }

        activeCalibrationPointers.set(
          event.pointerId,
          new THREE.Vector2(event.clientX, event.clientY),
        );
        try {
          renderer.domElement.setPointerCapture(event.pointerId);
        } catch {
          // iOS/WebKit may reject capture during gesture transitions.
        }

        if (activeCalibrationPointers.size === 2 && calibrationParticipantId) {
          const node = stageNodesRef.current.get(calibrationParticipantId);
          pinchStartDistance = currentPointerDistance();
          pinchStartScale = node?.targetActorScale ?? 1;
        }
        return;
      }

      const participantId = participantAt(event.clientX, event.clientY);
      const participant = participantId
        ? participantsRef.current.find(item => item.participantId === participantId)
        : null;
      if (participant) selectCallbackRef.current?.(participant);
    };

    const onPointerMove = (event: PointerEvent) => {
      if (!calibrationModeRef.current || !activeCalibrationPointers.has(event.pointerId)) return;
      event.preventDefault();
      activeCalibrationPointers.set(
        event.pointerId,
        new THREE.Vector2(event.clientX, event.clientY),
      );

      if (!calibrationParticipantId) return;
      const node = stageNodesRef.current.get(calibrationParticipantId);
      if (!node) return;

      const current = calibrationOverridesRef.current.get(calibrationParticipantId) ?? {
        x: node.targetPosition.x,
        y: node.targetPosition.y,
        z: node.targetPosition.z,
        scale: node.targetActorScale,
        rotationY: node.targetRotationY,
      };

      if (activeCalibrationPointers.size >= 2) {
        const distance = currentPointerDistance();
        if (pinchStartDistance > 0 && distance > 0) {
          const scale = THREE.MathUtils.clamp(
            pinchStartScale * (distance / pinchStartDistance),
            0.36,
            1.28,
          );
          writeCalibrationPlacement(node, { ...current, scale });
        }
        return;
      }

      const point = pointOnNodePlane(event.clientX, event.clientY, node);
      if (!point) return;
      writeCalibrationPlacement(node, {
        ...current,
        x: THREE.MathUtils.clamp(point.x + dragOffset.x, -3.6, 3.6),
        z: THREE.MathUtils.clamp(point.z + dragOffset.z, -1.5, 2.6),
      });
    };

    const onPointerEnd = (event: PointerEvent) => {
      if (!activeCalibrationPointers.has(event.pointerId)) return;
      activeCalibrationPointers.delete(event.pointerId);
      try {
        renderer.domElement.releasePointerCapture(event.pointerId);
      } catch {
        // Capture may already be released by WebKit.
      }

      if (activeCalibrationPointers.size === 1 && calibrationParticipantId) {
        const node = stageNodesRef.current.get(calibrationParticipantId);
        const remaining = [...activeCalibrationPointers.values()][0];
        if (node && remaining) {
          const point = pointOnNodePlane(remaining.x, remaining.y, node);
          if (point) {
            dragOffset.set(
              node.targetPosition.x - point.x,
              0,
              node.targetPosition.z - point.z,
            );
          }
        }
        pinchStartDistance = 0;
      } else if (activeCalibrationPointers.size === 0) {
        calibrationParticipantId = null;
        pinchStartDistance = 0;
      }
      emitCalibrationLayout();
    };

    renderer.domElement.style.touchAction = calibrationModeRef.current ? "none" : "auto";
    renderer.domElement.addEventListener("pointerdown", onPointerDown);
    renderer.domElement.addEventListener("pointermove", onPointerMove);
    renderer.domElement.addEventListener("pointerup", onPointerEnd);
    renderer.domElement.addEventListener("pointercancel", onPointerEnd);

    const loader = new GLTFLoader();
    setLoadState("loading");

    const disposeActorInstance = (actor: THREE.Object3D) => {
      const materials = new Set<THREE.Material>();
      actor.traverse(object => {
        const mesh = object as THREE.Mesh;
        if (!mesh.isMesh) return;
        const meshMaterials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        meshMaterials.forEach(material => {
          if (material) materials.add(material);
        });
      });
      materials.forEach(material => material.dispose());
    };

    const stopIdleRuntime = (participantId: string) => {
      const runtime = idleRuntimeByParticipant.get(participantId);
      if (!runtime) return;
      runtime.mixer.stopAllAction();
      runtime.mixer.uncacheRoot(runtime.mixer.getRoot());
      idleRuntimeByParticipant.delete(participantId);
      setIdleRuntimeCount(idleRuntimeByParticipant.size);
    };

    const attachIdleRuntime = (node: StageNode) => {
      const actorIdleClips = idleClipsByAssetId.get(node.characterAssetId) ?? [];
      if (idleRuntimeByParticipant.has(node.participant.participantId) || actorIdleClips.length === 0) return;
      const assignments = selectRoomParticipantIdleIndices(
        participantsRef.current,
        actorIdleClips.length,
        releaseVersion,
        roomId,
      );
      const idleIndex = assignments.get(node.participant.participantId) ?? -1;
      const idleClip = selectParticipantIdleClipByIndex(actorIdleClips, idleIndex);
      if (!idleClip) return;

      const mixer = new THREE.AnimationMixer(node.actor);
      const action = mixer.clipAction(idleClip);
      action.reset();
      action.setLoop(THREE.LoopRepeat, Infinity);
      action.enabled = true;
      action.clampWhenFinished = false;
      action.play();
      action.time = selectParticipantIdlePhaseSeconds(
        node.participant.participantId,
        idleClip.duration,
        releaseVersion,
        roomId,
      );
      mixer.update(0);

      idleRuntimeByParticipant.set(node.participant.participantId, {
        participantId: node.participant.participantId,
        mixer,
        currentAction: action,
        clips: actorIdleClips,
        currentIndex: idleIndex,
        transitionOrdinal: 0,
        elapsedSeconds: 0,
        holdSeconds: selectParticipantIdleHoldSeconds(
          node.participant.participantId,
          idleClip.duration,
          releaseVersion,
          roomId,
          0,
        ),
        retiringAction: null,
        retiringSeconds: 0,
      });
      setIdleRuntimeCount(idleRuntimeByParticipant.size);
    };

    const removeStageNode = (participantId: string) => {
      const node = stageNodesRef.current.get(participantId);
      if (!node) return;
      stopIdleRuntime(participantId);
      scene.remove(node.actor);
      scene.remove(node.ring);
      disposeActorInstance(node.actor);
      disposeObject(node.ring);
      stageNodesRef.current.delete(participantId);
    };

    const createStageNode = (participant: RoomParticipant, index: number) => {
      const characterAssetId = participantCharacterAssetId(participant);
      const source = actorSources.get(characterAssetId) ?? null;
      const actor = source ? cloneSkeleton(source) : fallbackActor(participantUsesFemaleFallback(participant));
      tintActor(
        actor,
        participant,
        index,
        visualPresetRef.current === "sketch",
      );
      actor.name = `WaitingRoomActor:${participant.participantId}:${characterAssetId}`;
      actor.userData.participantId = participant.participantId;
      actor.userData.characterAssetId = characterAssetId;
      scene.add(actor);

      const ring = createParticipantRing(
        visualPresetRef.current === "sketch"
          ? participantSketchRingAccent(participant)
          : participantAccent(participant),
        index * 1.37,
        participant.role === "host",
        visualPresetRef.current === "sketch",
      );
      scene.add(ring);

      const node: StageNode = {
        participant,
        index,
        characterAssetId,
        actor,
        ring,
        baseScale: actor.scale.clone(),
        targetPosition: new THREE.Vector3(),
        targetRotationY: 0,
        targetActorScale: 1,
        targetRingScale: 1,
        layoutReady: false,
      };
      stageNodesRef.current.set(participant.participantId, node);
      attachIdleRuntime(node);
      return node;
    };

    const reconcileParticipants = () => {
      if (disposed || !characterAssetsReady) return;
      const activeParticipants = participantsRef.current;
      const activeIds = new Set(activeParticipants.map(item => item.participantId));

      // Remove only the participant that actually left. Existing actors,
      // mixers, animation phase, and WebGL scene survive untouched.
      for (const participantId of [...stageNodesRef.current.keys()]) {
        if (!activeIds.has(participantId)) removeStageNode(participantId);
      }

      activeParticipants.forEach((participant, index) => {
        const existing = stageNodesRef.current.get(participant.participantId);
        if (!existing) {
          createStageNode(participant, index);
          return;
        }

        // Avatar identity changes replace only that one actor.
        if (existing.characterAssetId !== participantCharacterAssetId(participant)) {
          removeStageNode(participant.participantId);
          createStageNode(participant, index);
          return;
        }

        // READY / NOT READY and connection metadata only refresh the node's
        // logical participant reference. Never restart its AnimationMixer.
        existing.participant = participant;
        existing.index = index;
      });

      const needsFallback = activeParticipants.some(participant => (
        !actorSources.has(participantCharacterAssetId(participant))
      ));
      setRenderedActorCount(stageNodesRef.current.size);
      setLoadState(needsFallback ? "fallback" : "ready");
      applyLayout();
      startIdleLoop();
    };
    reconcileParticipantsRef.current = reconcileParticipants;

    // Load the canonical idle source plus every runtime-ready Character Catalog
    // entry once per room. Actors then clone from memory; roster changes never
    // refetch GLBs or rebuild the Three.js scene.
    const canonicalPromise = loader.loadAsync(HUMAN_CHARACTER_ASSET_URL).catch(error => {
      console.warn("[waiting-room] canonical animation source failed; catalog actors remain static", error);
      return null;
    });
    const idleLibraryPromise = loadLobbyIdleLibrary();
    const catalogPromises = CHARACTER_CATALOG_V1
      .filter(entry => entry.runtimeReady)
      .map(async entry => {
        try {
          const gltf = await loader.loadAsync(entry.assetUrl);
          return { entry, gltf };
        } catch (error) {
          console.warn(`[waiting-room] catalog asset ${entry.id} failed; fallback actor will be used`, error);
          return { entry, gltf: null };
        }
      });

    void Promise.all([canonicalPromise, idleLibraryPromise, Promise.all(catalogPromises)])
      .then(([canonicalGltf, idleLibrary, catalogResults]) => {
        if (disposed) {
          if (canonicalGltf) disposeObject(canonicalGltf.scene);
          catalogResults.forEach(({ gltf }) => {
            if (gltf) disposeObject(gltf.scene);
          });
          return;
        }

        idleClips = idleLibrary?.clips ?? [];
        releaseVersion = idleLibrary?.releaseVersion ?? 0;
        setIdleSource(idleLibrary?.source ?? "none");

        let canonicalMesh: THREE.SkinnedMesh | null = null;
        if (canonicalGltf) {
          try {
            canonicalMesh = findPrimarySkinnedMesh(canonicalGltf.scene);
          } catch (error) {
            console.warn("[waiting-room] canonical source has no compatible skeleton", error);
          }
        }

        for (const { entry, gltf } of catalogResults) {
          if (!gltf) continue;
          const source = gltf.scene;
          normalizeModel(source);
          actorSources.set(entry.id, source);
          disposableSources.push(source);

          if (idleClips.length === 0) continue;
          if (entry.animationProfile === "mixamo-c1" && canonicalGltf && canonicalMesh) {
            try {
              const targetMesh = findPrimarySkinnedMesh(source);
              idleClipsByAssetId.set(
                entry.id,
                retargetQuaterniusClipsToMixamo(
                  canonicalGltf.scene,
                  canonicalMesh.skeleton,
                  targetMesh.skeleton,
                  idleClips,
                ),
              );
            } catch (error) {
              console.warn(`[waiting-room] idle retarget failed for ${entry.id}`, error);
            }
          } else {
            idleClipsByAssetId.set(entry.id, idleClips);
          }
        }

        if (canonicalGltf) disposeObject(canonicalGltf.scene);
        characterAssetsReady = true;
        reconcileParticipants();
      })
      .catch(error => {
        if (disposed) return;
        console.warn("[waiting-room] character initialization failed", error);
        setIdleSource("none");
        characterAssetsReady = true;
        reconcileParticipants();
      });

    const observer = new ResizeObserver(render);
    observer.observe(mount);
    render();

    return () => {
      disposed = true;
      if (animationFrame) cancelAnimationFrame(animationFrame);
      observer.disconnect();
      renderer.domElement.removeEventListener("pointerdown", onPointerDown);
      renderer.domElement.removeEventListener("pointermove", onPointerMove);
      renderer.domElement.removeEventListener("pointerup", onPointerEnd);
      renderer.domElement.removeEventListener("pointercancel", onPointerEnd);
      idleRuntimeByParticipant.forEach(runtime => runtime.mixer.stopAllAction());
      idleRuntimeByParticipant.clear();
      renderRef.current = null;
      layoutRef.current = null;
      reconcileParticipantsRef.current = null;
      stageNodesRef.current.clear();
      slotPlaceholdersRef.current = [];
      sketchReflector?.getRenderTarget().dispose();
      sketchFloorTexture?.dispose();
      disposeObject(scene);
      disposableSources.forEach(disposeObject);
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [roomId, visualPreset]);

  const blueprintLogoRect = sketchStageRect(WAITING_ROOM_SKETCH_BLUEPRINT.screen.logo.bbox);
  const sketchCssVariables = visualPreset === "sketch"
    ? ({
        "--sketch-logo-fill": sketchColorCss(WAITING_ROOM_SKETCH_BLUEPRINT.palette.logo.fill),
        "--sketch-logo-edge": sketchColorCss(WAITING_ROOM_SKETCH_BLUEPRINT.palette.logo.edge),
        "--sketch-logo-glow": sketchColorCss(WAITING_ROOM_SKETCH_BLUEPRINT.palette.logo.glow),
        "--sketch-logo-subtitle": sketchColorCss(WAITING_ROOM_SKETCH_BLUEPRINT.palette.logo.subtitle),
        "--sketch-logo-top": `${blueprintLogoRect.y * 100}%`,
        "--sketch-logo-width": `${blueprintLogoRect.width * 100}%`,
        "--sketch-ready": sketchColorCss(WAITING_ROOM_SKETCH_BLUEPRINT.palette.status.ready),
        "--sketch-not-ready": sketchColorCss(WAITING_ROOM_SKETCH_BLUEPRINT.palette.status.notReady),
        "--sketch-crown": sketchColorCss(WAITING_ROOM_SKETCH_BLUEPRINT.palette.crown.highlight),
        "--sketch-trace-cyan": sketchColorCss(WAITING_ROOM_SKETCH_BLUEPRINT.palette.columns.leftCyan.core),
        "--sketch-trace-magenta": sketchColorCss(WAITING_ROOM_SKETCH_BLUEPRINT.palette.columns.rightMagenta.core),
        "--sketch-trace-blue": sketchColorCss(WAITING_ROOM_SKETCH_BLUEPRINT.palette.truss.bright),
        "--sketch-trace-violet": sketchColorCss(WAITING_ROOM_SKETCH_BLUEPRINT.palette.truss.glow),
      } as CSSProperties)
    : undefined;
  const blueprintLeftColumn = sketchStagePoint(WAITING_ROOM_SKETCH_BLUEPRINT.screen.columns.leftCenter);
  const blueprintRightColumn = sketchStagePoint(WAITING_ROOM_SKETCH_BLUEPRINT.screen.columns.rightCenter);
  const blueprintRingPoints = Object.entries(WAITING_ROOM_SKETCH_BLUEPRINT.screen.rings).map(([name, point]) => ({
    name,
    point: sketchStagePoint(point),
  }));
  const blueprintOpeningLeft = WAITING_ROOM_SKETCH_BLUEPRINT.screen.centerOpening.leftX;
  const blueprintOpeningWidth = WAITING_ROOM_SKETCH_BLUEPRINT.screen.centerOpening.rightX
    - WAITING_ROOM_SKETCH_BLUEPRINT.screen.centerOpening.leftX;
  const traceArchitecture = WAITING_ROOM_SKETCH_BLUEPRINT.traceArchitecture;
  const traceViewBox = `0 0 ${traceArchitecture.viewBox.width} ${traceArchitecture.viewBox.height}`;

  return (
    <div
      className={styles.stage}
      style={sketchCssVariables}
      data-testid="waiting-room-stage"
      data-stage={stageId}
      data-view={viewMode}
      data-scene-generation={sceneGeneration}
      data-actor-count={renderedActorCount}
      data-idle-count={idleRuntimeCount}
      data-idle-source={idleSource}
      data-character-assets={participants.map(participantCharacterAssetId).join(",")}
      data-focus-participant-id={focusedParticipant?.participantId ?? ""}
      data-layout={viewMode === "wide" ? "host-first" : viewMode}
      data-layout-transition={viewMode === "wide" ? "smooth" : "snap"}
      data-label-layout="head-follow"
      data-max-players={WAITING_ROOM_MAX_PLAYERS}
      data-calibration={calibrationMode ? "1" : "0"}
      data-stage-ready={stagePresentationReady ? "1" : "0"}
      data-visual-preset={visualPreset}
      data-floor-style={visualPreset === "sketch" ? "reflective-tile" : "standard"}
      data-ring-style={visualPreset === "sketch" ? "flat-luminous-decals" : "standard"}
      data-sketch-match={visualPreset === "sketch" ? "v36-owner-exact-svg" : "off"}
      data-architecture-source={visualPreset === "sketch" ? "screen-trace" : "threejs"}
      data-riser-source={visualPreset === "sketch" ? "hybrid-threejs-trace" : "threejs"}
      data-floor-grid={visualPreset === "sketch" ? "floor-plane" : "material"}
      data-sketch-blueprint={visualPreset === "sketch" ? WAITING_ROOM_SKETCH_BLUEPRINT.id : "off"}
      data-ceiling-source={visualPreset === "sketch" ? "screen-trace" : "css"}
      data-backdrop-geometry={visualPreset === "sketch" ? "target-tiered-stage" : "standard"}
      data-ring-palette={visualPreset === "sketch" ? "catalog-gender" : "slot"}
      data-ring-geometry={visualPreset === "sketch" ? "two-medium-one-fine" : "standard"}
      data-stage-risers={visualPreset === "sketch" ? "3" : "0"}
      data-ring-reflection={visualPreset === "sketch" ? "contact-glow-only" : "default"}
      data-stage-lighting={visualPreset === "sketch" ? "grand" : "standard"}
      data-character-grade={visualPreset === "sketch" ? "warm-neon" : "standard"}
      data-stage-footprint={visualPreset === "sketch" ? "expanded" : "standard"}
    >
      <div className={styles.architecture} aria-hidden="true">
        {visualPreset === "sketch" && traceArchitecture.enabled && (
          <svg
            className={styles.stageTrace}
            viewBox={traceViewBox}
            preserveAspectRatio="xMidYMin meet"
            data-runtime-trace-source={traceArchitecture.source}
            data-testid="sketch-stage-trace"
          >
            <defs>
              <g id="trace-roof-chords">
                <path d={traceArchitecture.truss.upperPath} />
                <path d={traceArchitecture.truss.lowerPath} />
              </g>
              <linearGradient id="trace-wing-shade-left" x1="0" y1="0" x2="194" y2="0" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#0b14a8" stopOpacity=".72" />
                <stop offset="68%" stopColor="#090d72" stopOpacity=".48" />
                <stop offset="100%" stopColor="#07083f" stopOpacity="0" />
              </linearGradient>
              <linearGradient id="trace-wing-shade-right" x1="0" y1="0" x2="194" y2="0" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#3909aa" stopOpacity=".70" />
                <stop offset="68%" stopColor="#22066e" stopOpacity=".48" />
                <stop offset="100%" stopColor="#0f073d" stopOpacity="0" />
              </linearGradient>
              <linearGradient id="trace-left-rail" x1="0" y1="0" x2="220" y2="0" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="var(--sketch-trace-cyan)" />
                <stop offset="100%" stopColor="var(--sketch-trace-violet)" stopOpacity=".45" />
              </linearGradient>
              <linearGradient id="trace-right-rail" x1="0" y1="0" x2="220" y2="0" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="var(--sketch-trace-magenta)" />
                <stop offset="100%" stopColor="var(--sketch-trace-violet)" stopOpacity=".45" />
              </linearGradient>
              <linearGradient id="trace-roof" x1="0" y1="0" x2="864" y2="0" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="var(--sketch-trace-blue)" />
                <stop offset="48%" stopColor="var(--sketch-trace-violet)" />
                <stop offset="100%" stopColor="var(--sketch-trace-magenta)" />
              </linearGradient>
              <linearGradient id="trace-left-column" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#99f7ff" />
                <stop offset="38%" stopColor="var(--sketch-trace-cyan)" />
                <stop offset="100%" stopColor="#1975ff" />
              </linearGradient>
              <linearGradient id="trace-right-column" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#7934ff" />
                <stop offset="58%" stopColor="var(--sketch-trace-magenta)" />
                <stop offset="100%" stopColor="#ffd2ff" />
              </linearGradient>
              <linearGradient id="trace-reflection-left" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#32e5ff" stopOpacity=".46" />
                <stop offset="100%" stopColor="#146bf9" stopOpacity="0" />
              </linearGradient>
              <linearGradient id="trace-reflection-center" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#a46cff" stopOpacity=".34" />
                <stop offset="100%" stopColor="#2219bd" stopOpacity="0" />
              </linearGradient>
              <linearGradient id="trace-reflection-right" x1="1" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#f45ae7" stopOpacity=".42" />
                <stop offset="100%" stopColor="#a20de2" stopOpacity="0" />
              </linearGradient>
              <linearGradient id="trace-riser-fill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#4d1a9d" stopOpacity=".34" />
                <stop offset="48%" stopColor="#20105f" stopOpacity=".46" />
                <stop offset="100%" stopColor="#080a3d" stopOpacity=".58" />
              </linearGradient>
              <linearGradient id="trace-riser-edge" x1="0" y1="0" x2="864" y2="0" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#596dff" />
                <stop offset="23%" stopColor="#875cff" />
                <stop offset="50%" stopColor="#d45cff" />
                <stop offset="77%" stopColor="#875cff" />
                <stop offset="100%" stopColor="#596dff" />
              </linearGradient>
              <linearGradient id="trace-floor-rim" x1="0" y1="0" x2="864" y2="0" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#2adfff" />
                <stop offset="38%" stopColor="#5c76ff" />
                <stop offset="62%" stopColor="#9a55ff" />
                <stop offset="100%" stopColor="#f044df" />
              </linearGradient>
              <filter id="trace-soft-glow" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur stdDeviation="4" result="blur" />
                <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
              </filter>
              <filter id="trace-column-glow" x="-100%" y="-20%" width="300%" height="140%">
                <feGaussianBlur stdDeviation="8" result="blur" />
                <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
              </filter>
            </defs>

            <g className={styles.traceWallOutline}>
              {traceArchitecture.wallLeftPaths.map(path => <path key={`wl-${path}`} d={path} />)}
              {traceArchitecture.wallRightPaths.map(path => <path key={`wr-${path}`} d={path} />)}
            </g>

            <g className={styles.traceRisers}>
              {traceArchitecture.risers.map((riser, index) => (
                <g key={riser.edge}>
                  <path className={styles.traceRiserGlow} d={riser.edge} />
                  <path className={styles.traceRiserEdge} d={riser.edge} stroke="url(#trace-riser-edge)" />
                  <path className={styles.traceRiserLowerEdge} d={riser.lowerEdge} stroke="url(#trace-riser-edge)" />
                  <path
                    className={styles.traceFootlights}
                    d={riser.edge}
                    strokeDasharray={index === 0 ? "14 36" : index === 1 ? "13 34" : "12 31"}
                  />
                </g>
              ))}
            </g>

            <path className={styles.traceFrontRimGlow} d={traceArchitecture.floor.frontRim} />
            <path className={styles.traceFrontRim} d={traceArchitecture.floor.frontRim} stroke="url(#trace-floor-rim)" />
            <g className={styles.traceFloorGrid}>
              {traceArchitecture.floor.gridHorizontal.map(path => <path key={`gh-${path}`} d={path} />)}
              {traceArchitecture.floor.gridVertical.map(path => <path key={`gv-${path}`} d={path} />)}
              <path d={traceArchitecture.floor.bottomBoundary} />
            </g>

            <g className={styles.traceRailBody}>
              {traceArchitecture.railsLeft.map(path => <path key={`lb-${path}`} d={path} />)}
              {traceArchitecture.railsRight.map(path => <path key={`rb-${path}`} d={path} />)}
            </g>
            <g className={styles.traceRailGlow} filter="url(#trace-soft-glow)">
              {traceArchitecture.railsLeft.map(path => <path key={`lg-${path}`} d={path} stroke="url(#trace-left-rail)" />)}
              {traceArchitecture.railsRight.map(path => <path key={`rg-${path}`} d={path} stroke="url(#trace-right-rail)" />)}
            </g>
            <g className={styles.traceRails}>
              {traceArchitecture.railsLeft.map(path => <path key={`lc-${path}`} d={path} stroke="url(#trace-left-rail)" />)}
              {traceArchitecture.railsRight.map(path => <path key={`rc-${path}`} d={path} stroke="url(#trace-right-rail)" />)}
            </g>

            <g className={styles.traceTruss} stroke="url(#trace-roof)">
              {traceArchitecture.truss.continuations.map(path => (
                <path className={styles.traceTrussBody} key={`tc-${path}`} d={path} />
              ))}
              <path className={styles.traceTrussBody} d={traceArchitecture.truss.upperPath} />
              <path className={styles.traceTrussBody} d={traceArchitecture.truss.lowerPath} />
              {traceArchitecture.truss.braces.map(path => (
                <path className={styles.traceTrussBrace} key={path} d={path} />
              ))}
              <path className={styles.traceTrussEdge} d={traceArchitecture.truss.upperPath} />
              <path className={styles.traceTrussEdge} d={traceArchitecture.truss.lowerPath} />
            </g>
            <g className={styles.traceRoofRim}>
              {traceArchitecture.truss.rim.map(path => <path key={path} d={path} />)}
            </g>

            <g className={styles.traceColumns} filter="url(#trace-column-glow)">
              <polygon points={traceArchitecture.columns.leftPolygon} fill="url(#trace-left-column)" />
              <polygon points={traceArchitecture.columns.rightPolygon} fill="url(#trace-right-column)" />
            </g>
            </g>
          </svg>
        )}
        <span className={styles.lightBarLeft} />
        <span className={styles.lightBarRight} />
        <div className={styles.brand}>
          <strong>AUDITION</strong>
          <small>DANCE TOGETHER</small>
        </div>
      </div>
      <div className={styles.canvas} ref={mountRef} />
      {blueprintMode && visualPreset === "sketch" && (
        <div className={styles.blueprintGuides} data-testid="sketch-blueprint-guides" aria-hidden="true">
          <span className={styles.blueprintCenterLine} style={{ left: "50%" }} />
          <span
            className={styles.blueprintOpening}
            style={{
              left: `${blueprintOpeningLeft * 100}%`,
              width: `${blueprintOpeningWidth * 100}%`,
            }}
          />
          <span
            className={styles.blueprintLogoBox}
            style={{
              left: `${blueprintLogoRect.x * 100}%`,
              top: `${blueprintLogoRect.y * 100}%`,
              width: `${blueprintLogoRect.width * 100}%`,
              height: `${blueprintLogoRect.height * 100}%`,
            }}
          />
          <span
            className={styles.blueprintColumnPoint}
            data-guide="left-column"
            style={{ left: `${blueprintLeftColumn.x * 100}%`, top: `${blueprintLeftColumn.y * 100}%` }}
          />
          <span
            className={styles.blueprintColumnPoint}
            data-guide="right-column"
            style={{ left: `${blueprintRightColumn.x * 100}%`, top: `${blueprintRightColumn.y * 100}%` }}
          />
          {blueprintRingPoints.map(({ name, point }) => (
            <span
              className={styles.blueprintRingPoint}
              data-guide={name}
              key={name}
              style={{ left: `${point.x * 100}%`, top: `${point.y * 100}%` }}
            />
          ))}
        </div>
      )}

      <div
        aria-hidden={stagePresentationReady ? "true" : "false"}
        className={`${styles.stageLoading} ${stagePresentationReady ? styles.stageLoadingReady : ""}`}
        data-testid="waiting-room-stage-loading"
      >
        <div className={styles.stageLoadingMark}>
          <strong>AUDITION</strong>
          <span><i /><i /><i /></span>
          <small>ĐANG TẢI PHÒNG CHỜ</small>
        </div>
      </div>
      <div className={styles.badge}>{loadState === "ready" ? "3D READY" : loadState === "fallback" ? "3D FALLBACK" : "LOADING 3D"}</div>
      <div className={styles.actorIdentities} data-testid="p56-participant-deck">
        {participants.map(participant => {
          const focused = participant.participantId === focusedParticipant?.participantId;
          return (
            <button
              className={`${styles.actorIdentity} ${focused ? styles.actorIdentityFocused : ""}`}
              data-character-asset-id={participantCharacterAssetId(participant)}
              data-focus-role={participant.role}
              data-testid={focused ? "p56-focused-identity" : undefined}
              key={participant.participantId}
              onClick={() => {
                if (!calibrationMode) onSelectParticipant?.(participant);
              }}
              ref={element => {
                if (element) identityRefs.current.set(participant.participantId, element);
                else identityRefs.current.delete(participant.participantId);
              }}
              type="button"
            >
              {participant.role === "host" ? <span className={styles.crown}>♛</span> : null}
              <strong>{participant.displayName}</strong>
              <small>Lv. {levelFor(participant)}</small>
              {participant.role !== "host" ? (
                <b className={statusClass(participant)}>{statusLabel(participant)}</b>
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}
