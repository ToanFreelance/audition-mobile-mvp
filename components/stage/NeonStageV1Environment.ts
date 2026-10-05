import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import type { StagePresentationCameraPreset } from "./stageCamera";
import { fetchPersistentAsset } from "../../lib/persistent-asset-cache";

type RuntimeUrlResponse = {
  stageId: string;
  url: string;
  expiresInSeconds: number;
  bytes: number;
  sha256: string;
  embeddedAnimations: number;
};

export type NeonStageV1LoadResult = {
  stageId: "neon-stage-v1";
  meshes: number;
  materials: number;
  textures: number;
  triangles: number;
  embeddedAnimations: number;
  reactiveMaterials: number;
};

type PulseMaterial = {
  material: THREE.MeshBasicMaterial;
  baseOpacity: number;
};

type BreathMaterial = {
  material: THREE.MeshBasicMaterial;
  baseOpacity: number;
  phaseOffsetSeconds: number;
};

type BeamState = {
  group: THREE.Group;
  material: THREE.MeshBasicMaterial;
  baseQuaternion: THREE.Quaternion;
  phase: number;
  panAmplitude: number;
  tiltAmplitude: number;
  speed: number;
  light: THREE.SpotLight;
  distance: number;
};

type AcceptedBreathMaterial = {
  material: THREE.MeshStandardMaterial;
  baseEmissiveIntensity: number;
  phaseOffsetSeconds: number;
};

type AcceptedMovingHead = {
  panPivot: THREE.Object3D;
  tiltPivot: THREE.Object3D;
  optical: THREE.SpotLight;
  basePanQuaternion: THREE.Quaternion;
  baseTiltQuaternion: THREE.Quaternion;
  phase: number;
  panAmplitude: number;
  tiltAmplitude: number;
  speed: number;
  sourceAnchor: THREE.Object3D;
  sourceFxRoot: THREE.Group | null;
  floorAimBase: THREE.Vector3 | null;
  beamRoot: THREE.Group | null;
  beamMaterial: THREE.ShaderMaterial | null;
  spillMesh: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial> | null;
  reflectionCoreMesh: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial> | null;
  reflectionMesh: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial> | null;
};

const COLORS = {
  navy: 0x05081f,
  navy2: 0x0a1035,
  cyan: 0x16d9ff,
  cyanSoft: 0x67e7ff,
  blue: 0x2358ff,
  violet: 0x7b36ff,
  magenta: 0xff27df,
  magentaSoft: 0xff73e9,
  white: 0xeaf7ff,
  gold: 0xffc43d,
};

const FLOOR_Y = -0.03;
const REAR_Z = -5.65;
const ACCEPTED_R15_FLOOR_WIDTH = 19.8;
const ACCEPTED_R15_DANCE_RING_Z = 0.25;
const CONCEPT_LED_ASSET_URL = "/stages/neon-stage-v1/concept-led-v10.svg";

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

function makeGlowTexture(color: string, vertical = true) {
  const canvas = document.createElement("canvas");
  canvas.width = vertical ? 32 : 256;
  canvas.height = vertical ? 256 : 32;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Neon Stage V1 glow canvas unavailable.");
  const gradient = vertical
    ? ctx.createLinearGradient(0, 0, 0, canvas.height)
    : ctx.createLinearGradient(0, 0, canvas.width, 0);
  gradient.addColorStop(0, "rgba(0,0,0,0)");
  gradient.addColorStop(0.18, color.replace("1)", "0.08)"));
  gradient.addColorStop(0.50, color);
  gradient.addColorStop(0.82, color.replace("1)", "0.08)"));
  gradient.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

function createLedTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 1280;
  canvas.height = 560;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Neon Stage V1 LED canvas unavailable.");

  const bg = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
  bg.addColorStop(0, "#071c58");
  bg.addColorStop(0.48, "#171060");
  bg.addColorStop(1, "#3a0759");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.globalAlpha = 0.28;
  for (let y = 8; y < canvas.height; y += 12) {
    for (let x = 8; x < canvas.width; x += 12) {
      ctx.fillStyle = (x + y) % 48 === 0 ? "#54e8ff" : "#9d48ff";
      ctx.fillRect(x, y, 2, 2);
    }
  }
  ctx.globalAlpha = 1;

  const rays = [
    { x1: 80, x2: 320, c: "#ff29d9" },
    { x1: 180, x2: 410, c: "#56e8ff" },
    { x1: 310, x2: 500, c: "#8b43ff" },
    { x1: 1200, x2: 960, c: "#ff29d9" },
    { x1: 1100, x2: 870, c: "#56e8ff" },
    { x1: 970, x2: 780, c: "#8b43ff" },
  ];
  ctx.lineWidth = 12;
  ctx.shadowBlur = 24;
  for (const ray of rays) {
    ctx.strokeStyle = ray.c;
    ctx.shadowColor = ray.c;
    ctx.beginPath();
    ctx.moveTo(ray.x1, 70);
    ctx.lineTo(ray.x2, 490);
    ctx.stroke();
  }

  ctx.shadowBlur = 26;
  ctx.strokeStyle = "#ff39df";
  ctx.fillStyle = "#5b125f";
  ctx.lineWidth = 9;
  ctx.font = "italic 900 150px Arial";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.strokeText("AUDITION", canvas.width / 2, 285);
  ctx.fillText("AUDITION", canvas.width / 2, 285);

  ctx.shadowBlur = 16;
  ctx.fillStyle = "#eefbff";
  ctx.font = "700 34px Arial";
  ctx.letterSpacing = "10px";
  ctx.fillText("D A N C E   T O G E T H E R", canvas.width / 2, 385);

  ctx.shadowBlur = 18;
  ctx.fillStyle = "#ffc63c";
  ctx.font = "900 78px Arial";
  ctx.fillText("♛", canvas.width / 2, 132);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

function createRiserGeometry(
  width: number,
  zFront: number,
  depth: number,
  yBottom: number,
  height: number,
  curveDepth: number,
  segments = 64,
) {
  const vertices: number[] = [];
  const indices: number[] = [];
  const half = width / 2;

  for (let i = 0; i <= segments; i += 1) {
    const x = -half + width * (i / segments);
    const t = x / half;
    const frontZ = zFront + curveDepth * t * t;
    const backZ = frontZ - depth;
    vertices.push(
      x, yBottom, frontZ,
      x, yBottom + height, frontZ,
      x, yBottom, backZ,
      x, yBottom + height, backZ,
    );
  }

  for (let i = 0; i < segments; i += 1) {
    const a = i * 4;
    const b = (i + 1) * 4;
    indices.push(
      a, b, a + 1, b, b + 1, a + 1,
      a + 1, b + 1, a + 3, b + 1, b + 3, a + 3,
      a + 2, a + 3, b + 2, b + 2, a + 3, b + 3,
    );
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function createCurveTube(points: THREE.Vector3[], radius: number, material: THREE.Material) {
  const curve = new THREE.CatmullRomCurve3(points);
  return new THREE.Mesh(new THREE.TubeGeometry(curve, 56, radius, 8, false), material);
}

function makeArcPoints(
  width: number,
  zFront: number,
  y: number,
  curveDepth: number,
  segments = 24,
) {
  const half = width / 2;
  return Array.from({ length: segments + 1 }, (_, index) => {
    const x = -half + width * (index / segments);
    const t = x / half;
    return new THREE.Vector3(x, y, zFront + curveDepth * t * t);
  });
}

function alignYToDirection(object: THREE.Object3D, source: THREE.Vector3, target: THREE.Vector3) {
  const direction = target.clone().sub(source);
  object.position.copy(source).add(target).multiplyScalar(0.5);
  object.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.clone().normalize());
  return direction.length();
}

function inspectEnvironment(root: THREE.Object3D) {
  const materials = new Set<THREE.Material>();
  const textures = new Set<THREE.Texture>();
  let meshes = 0;
  let triangles = 0;
  root.traverse(object => {
    const mesh = object as THREE.Mesh;
    if (!mesh.isMesh || !mesh.geometry || !mesh.visible) return;
    meshes += 1;
    const position = mesh.geometry.getAttribute("position");
    const elements = mesh.geometry.index?.count ?? position?.count ?? 0;
    triangles += Math.floor(elements / 3);
    const list = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    list.forEach(material => {
      materials.add(material);
      for (const value of Object.values(material)) if (value instanceof THREE.Texture) textures.add(value);
    });
  });
  return { meshes, materials: materials.size, textures: textures.size, triangles };
}

function architecturalBreathMultiplier(renderTimeSeconds: number, phaseOffsetSeconds = 0) {
  const pulseSeconds = 1.08;
  const position = Math.max(0, renderTimeSeconds + phaseOffsetSeconds) / pulseSeconds;
  const pulseIndex = Math.floor(position) % 4;
  const localPhase = position - Math.floor(position);
  const softEnvelope = Math.sin(Math.PI * localPhase) ** 2;
  const amplitude = pulseIndex === 3 ? 0.72 : 0.24;
  return 1 + amplitude * softEnvelope;
}

function acceptedBreathMultiplier(renderTimeSeconds: number, phaseOffsetSeconds = 0) {
  const pulseSeconds = 1.08;
  const position = Math.max(0, renderTimeSeconds + phaseOffsetSeconds) / pulseSeconds;
  const pulseIndex = Math.floor(position) % 4;
  const localPhase = position - Math.floor(position);
  const softEnvelope = Math.sin(Math.PI * localPhase) ** 2;
  const amplitude = pulseIndex === 3 ? 0.30 : 0.09;
  return 1 + amplitude * softEnvelope;
}

function makeAcceptedLightPoolTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 256;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("R15.1 light-pool canvas unavailable.");

  const gradient = ctx.createRadialGradient(64, 128, 0, 64, 128, 116);
  gradient.addColorStop(0, "rgba(255,255,255,0.88)");
  gradient.addColorStop(0.18, "rgba(255,255,255,0.52)");
  gradient.addColorStop(0.52, "rgba(255,255,255,0.18)");
  gradient.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

function makeAcceptedBeamSourceTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("R15.1 beam-source canvas unavailable.");

  const glow = ctx.createRadialGradient(64, 64, 0, 64, 64, 62);
  glow.addColorStop(0, "rgba(255,255,255,1)");
  glow.addColorStop(0.10, "rgba(255,255,255,0.96)");
  glow.addColorStop(0.28, "rgba(255,255,255,0.55)");
  glow.addColorStop(0.62, "rgba(255,255,255,0.13)");
  glow.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, 128, 128);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

function makeAcceptedReflectionStreakTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 96;
  canvas.height = 512;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("R15.1 reflection-streak canvas unavailable.");

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const horizontal = ctx.createLinearGradient(0, 0, canvas.width, 0);
  horizontal.addColorStop(0, "rgba(255,255,255,0)");
  horizontal.addColorStop(0.30, "rgba(255,255,255,0.08)");
  horizontal.addColorStop(0.43, "rgba(255,255,255,0.52)");
  horizontal.addColorStop(0.50, "rgba(255,255,255,0.98)");
  horizontal.addColorStop(0.57, "rgba(255,255,255,0.52)");
  horizontal.addColorStop(0.70, "rgba(255,255,255,0.08)");
  horizontal.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = horizontal;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.globalCompositeOperation = "destination-in";
  const longitudinal = ctx.createLinearGradient(0, 0, 0, canvas.height);
  longitudinal.addColorStop(0, "rgba(255,255,255,0.96)");
  longitudinal.addColorStop(0.12, "rgba(255,255,255,0.90)");
  longitudinal.addColorStop(0.42, "rgba(255,255,255,0.58)");
  longitudinal.addColorStop(0.74, "rgba(255,255,255,0.24)");
  longitudinal.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = longitudinal;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.globalCompositeOperation = "source-over";

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

function createAcceptedFixtureSourceAnchor(
  tiltPivot: THREE.Object3D,
  fallback: THREE.Object3D,
) {
  const materialMatches: THREE.Mesh[] = [];
  const nameMatches: THREE.Mesh[] = [];

  tiltPivot.updateWorldMatrix(true, true);
  tiltPivot.traverse(object => {
    const mesh = object as THREE.Mesh;
    if (!mesh.isMesh) return;

    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    if (materials.some(material => material?.name.toLowerCase().includes("aperture"))) {
      materialMatches.push(mesh);
      return;
    }

    const nodeName = mesh.name.toLowerCase();
    if (nodeName.includes("aperture") || nodeName.includes("lens")) {
      nameMatches.push(mesh);
    }
  });

  const candidate = materialMatches[0] ?? nameMatches[0] ?? null;
  const worldCenter = new THREE.Vector3();

  if (candidate) {
    candidate.updateWorldMatrix(true, false);
    const bounds = new THREE.Box3().setFromObject(candidate);
    if (!bounds.isEmpty()) {
      bounds.getCenter(worldCenter);
    } else {
      candidate.getWorldPosition(worldCenter);
    }
  } else {
    fallback.updateWorldMatrix(true, false);
    fallback.getWorldPosition(worldCenter);
  }

  const anchor = new THREE.Object3D();
  anchor.name = tiltPivot.name + "_RuntimeApertureAnchor";
  anchor.position.copy(tiltPivot.worldToLocal(worldCenter.clone()));
  tiltPivot.add(anchor);
  return anchor;
}

function acceptedFixturePresentationColor(key: string, fallback: THREE.Color) {
  const authored: Record<string, number> = {
    MainFixture_01: 0xff3bd3,
    MainFixture_02: 0x30dcff,
    MainFixture_04: 0x34d9ff,
    MainFixture_05: 0xff39cf,
    MainFixture_06: 0xff39cf,
    MainFixture_08: 0x34d9ff,
    MainFixture_09: 0xff3bd3,
  };
  return authored[key] === undefined ? fallback.clone() : new THREE.Color(authored[key]);
}

function makeAcceptedFloorReflectionTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("R15.1 floor-reflection canvas unavailable.");

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const base = ctx.createLinearGradient(0, 0, 0, canvas.height);
  base.addColorStop(0, "rgba(168,43,255,0.035)");
  base.addColorStop(0.30, "rgba(227,43,219,0.024)");
  base.addColorStop(0.62, "rgba(86,48,214,0.014)");
  base.addColorStop(1, "rgba(28,20,105,0.004)");
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const xToCanvas = (worldX: number) => ((worldX + 9.9) / 19.8) * canvas.width;
  const sources = [
    { x: -9.0, color: "rgba(45,218,255,0.54)", hot: "rgba(176,246,255,0.64)", w: 0.78, len: 2.70, y: 205 },
    { x: -6.8, color: "rgba(255,55,211,0.70)", hot: "rgba(255,188,239,0.70)", w: 0.86, len: 3.25, y: 180 },
    { x: -5.0, color: "rgba(49,216,255,0.72)", hot: "rgba(182,248,255,0.70)", w: 0.76, len: 3.55, y: 190 },
    { x: -3.0, color: "rgba(255,53,207,0.76)", hot: "rgba(255,184,238,0.72)", w: 0.82, len: 3.80, y: 195 },
    { x: -1.2, color: "rgba(76,208,255,0.58)", hot: "rgba(192,249,255,0.66)", w: 0.62, len: 3.40, y: 188 },
    { x:  1.2, color: "rgba(255,61,219,0.60)", hot: "rgba(255,194,241,0.68)", w: 0.64, len: 3.45, y: 190 },
    { x:  3.0, color: "rgba(50,216,255,0.74)", hot: "rgba(184,248,255,0.71)", w: 0.80, len: 3.80, y: 192 },
    { x:  5.0, color: "rgba(255,54,208,0.72)", hot: "rgba(255,188,239,0.70)", w: 0.84, len: 3.55, y: 184 },
    { x:  6.8, color: "rgba(47,214,255,0.68)", hot: "rgba(178,247,255,0.68)", w: 0.76, len: 3.20, y: 178 },
    { x:  9.0, color: "rgba(255,57,210,0.52)", hot: "rgba(255,190,239,0.62)", w: 0.76, len: 2.65, y: 205 },
  ] as const;

  for (const source of sources) {
    const cx = xToCanvas(source.x);

    ctx.save();
    ctx.translate(cx, source.y);
    ctx.scale(source.w, source.len);
    const tail = ctx.createRadialGradient(0, 0, 0, 0, 0, 72);
    tail.addColorStop(0, source.hot);
    tail.addColorStop(0.13, source.color);
    tail.addColorStop(0.42, source.color.replace(/0\.[0-9]+\)$/, "0.20)"));
    tail.addColorStop(0.72, source.color.replace(/0\.[0-9]+\)$/, "0.07)"));
    tail.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = tail;
    ctx.beginPath();
    ctx.arc(0, 0, 72, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    ctx.save();
    ctx.translate(cx, source.y + 18);
    ctx.scale(source.w * 0.24, source.len * 1.08);
    const core = ctx.createRadialGradient(0, 0, 0, 0, 0, 58);
    core.addColorStop(0, source.hot);
    core.addColorStop(0.12, source.color.replace(/0\.[0-9]+\)$/, "0.56)"));
    core.addColorStop(0.48, source.color.replace(/0\.[0-9]+\)$/, "0.18)"));
    core.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = core;
    ctx.beginPath();
    ctx.arc(0, 0, 58, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    ctx.save();
    ctx.translate(cx, 92);
    ctx.scale(source.w * 0.48, 0.72);
    const impact = ctx.createRadialGradient(0, 0, 0, 0, 0, 58);
    impact.addColorStop(0, source.hot);
    impact.addColorStop(0.18, source.color);
    impact.addColorStop(0.62, source.color.replace(/0\.[0-9]+\)$/, "0.10)"));
    impact.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = impact;
    ctx.beginPath();
    ctx.arc(0, 0, 58, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    ctx.save();
    ctx.translate(cx, source.y + 168);
    ctx.scale(source.w * 0.52, source.len * 1.28);
    const foregroundTail = ctx.createRadialGradient(0, 0, 0, 0, 0, 86);
    foregroundTail.addColorStop(0, source.color.replace(/0\.[0-9]+\)$/, "0.22)"));
    foregroundTail.addColorStop(0.30, source.color.replace(/0\.[0-9]+\)$/, "0.12)"));
    foregroundTail.addColorStop(0.68, source.color.replace(/0\.[0-9]+\)$/, "0.045)"));
    foregroundTail.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = foregroundTail;
    ctx.beginPath();
    ctx.arc(0, 0, 86, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  const centerBloom = ctx.createRadialGradient(256, 118, 0, 256, 118, 160);
  centerBloom.addColorStop(0, "rgba(255,50,205,0.10)");
  centerBloom.addColorStop(0.34, "rgba(143,48,232,0.055)");
  centerBloom.addColorStop(1, "rgba(88,45,190,0)");
  ctx.fillStyle = centerBloom;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

function makeAcceptedBackdropGlowTexture() {
  const texture = new THREE.TextureLoader().load(CONCEPT_LED_ASSET_URL);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.generateMipmaps = true;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.anisotropy = 4;
  texture.needsUpdate = true;
  return texture;
}

function normalizeAcceptedR15Model(model: THREE.Object3D) {
  model.updateMatrixWorld(true);
  const floor = model.getObjectByName("PolishedDanceFloor");
  if (!floor) throw new Error("R15.1 runtime is missing PolishedDanceFloor.");

  const initialFloorBounds = new THREE.Box3().setFromObject(floor);
  const initialFloorSize = initialFloorBounds.getSize(new THREE.Vector3());
  if (!(initialFloorSize.x > 0) || !Number.isFinite(initialFloorSize.x)) {
    throw new Error("R15.1 runtime has invalid floor bounds.");
  }

  model.scale.multiplyScalar(ACCEPTED_R15_FLOOR_WIDTH / initialFloorSize.x);
  model.updateMatrixWorld(true);

  const floorBounds = new THREE.Box3().setFromObject(floor);
  const floorCenter = floorBounds.getCenter(new THREE.Vector3());
  model.position.x -= floorCenter.x;
  model.position.y -= floorBounds.max.y;
  model.updateMatrixWorld(true);

  const ring = model.getObjectByName("R15 Dance Ring Outer");
  if (ring) {
    const ringCenter = new THREE.Box3().setFromObject(ring).getCenter(new THREE.Vector3());
    model.position.z += ACCEPTED_R15_DANCE_RING_Z - ringCenter.z;
  }

  model.updateMatrixWorld(true);
}

export class NeonStageV1Environment {
  readonly root = new THREE.Group();

  private readonly loader = new GLTFLoader();
  private readonly animatedRoot = new THREE.Group();
  private readonly acceptedFxRoot = new THREE.Group();
  private readonly pulseMaterials: PulseMaterial[] = [];
  private readonly breathMaterials: BreathMaterial[] = [];
  private readonly beamStates: BeamState[] = [];
  private readonly spotLights: THREE.SpotLight[] = [];
  private readonly acceptedBreathMaterials: AcceptedBreathMaterial[] = [];
  private readonly acceptedMovingHeads: AcceptedMovingHead[] = [];
  private readonly textures: THREE.Texture[] = [];
  private readonly fallbackChildren: THREE.Object3D[] = [];
  private loadedModel: THREE.Object3D | null = null;
  private lastAcceptedBreathUpdateSeconds = Number.NEGATIVE_INFINITY;
  private disposed = false;

  constructor() {
    this.root.name = "NeonStageV1Environment";
    this.animatedRoot.name = "NeonStageV1PresentationFX";
    this.acceptedFxRoot.name = "NeonStageV1AcceptedR15RuntimeFX";
    this.root.add(this.animatedRoot);
    this.build();
    this.fallbackChildren.push(...this.root.children);
  }

  async load(): Promise<NeonStageV1LoadResult> {
    try {
      const response = await fetch("/api/stage-runtime?stageId=neon-stage-v1", { cache: "no-store" });
      if (!response.ok) throw new Error(`Neon Stage V1 URL HTTP ${response.status}`);
      const runtime = await response.json() as RuntimeUrlResponse;
      if (!runtime.url || runtime.stageId !== "neon-stage-v1") {
        throw new Error("Neon Stage V1 runtime URL response is invalid.");
      }

      const stageResponse = await fetchPersistentAsset(runtime.url, {
        cacheKey: "stage:" + runtime.stageId + ":" + runtime.sha256,
        request: { headers: { Accept: "model/gltf-binary,application/octet-stream,*/*" } },
      });
      if (!stageResponse.ok) throw new Error(`Neon Stage V1 asset HTTP ${stageResponse.status}`);
      const stageBlob = await stageResponse.blob();
      const localStageUrl = URL.createObjectURL(stageBlob);
      let gltf;
      try {
        gltf = await this.loader.loadAsync(localStageUrl);
      } finally {
        URL.revokeObjectURL(localStageUrl);
      }
      if (this.disposed) {
        disposeObject(gltf.scene);
        throw new Error("Neon Stage V1 was disposed before load completed.");
      }

      normalizeAcceptedR15Model(gltf.scene);
      this.prepareAcceptedR15Runtime(gltf.scene);
      this.loadedModel = gltf.scene;
      this.fallbackChildren.forEach(child => {
        child.visible = false;
      });
      this.root.add(gltf.scene, this.acceptedFxRoot);

      const metrics = inspectEnvironment(gltf.scene);
      return {
        stageId: "neon-stage-v1",
        ...metrics,
        embeddedAnimations: gltf.animations.length,
        reactiveMaterials: this.acceptedBreathMaterials.length + this.acceptedMovingHeads.length,
      };
    } catch (error) {
      console.warn("[NeonStageV1] R15.1 asset load failed; procedural fallback remains active:", error);
      const metrics = inspectEnvironment(this.root);
      return {
        stageId: "neon-stage-v1",
        ...metrics,
        embeddedAnimations: 0,
        reactiveMaterials: this.pulseMaterials.length + this.beamStates.length,
      };
    }
  }

  setPresentationCamera(preset: StagePresentationCameraPreset) {
    if (this.loadedModel) {
      const ceiling = this.loadedModel.getObjectByName("CeilingNavy");
      if (ceiling) ceiling.visible = preset !== "intro_top_down";
      return;
    }

    const front = preset === "gameplay_portrait_locked" || preset === "intro_front_push";
    const frontLip = this.root.getObjectByName("NeonFrontLip");
    if (frontLip) frontLip.visible = true;
    const truss = this.root.getObjectByName("NeonOverheadTruss");
    if (truss) truss.visible = preset !== "intro_top_down";
    const frontGlow = this.root.getObjectByName("NeonFrontGlow");
    if (frontGlow) frontGlow.visible = front;
  }

  update(renderTimeSeconds: number, songTimeMs: number, bpm: number, isPlaying: boolean) {
    // Neon Stage motion is presentation-only and intentionally independent of the
    // gameplay/audio clock. Keep the Stage3D contract unchanged.
    void songTimeMs;
    void bpm;
    void isPlaying;

    if (this.loadedModel) {
      this.updateAcceptedR15Runtime(renderTimeSeconds);
      return;
    }

    this.pulseMaterials.forEach(state => {
      state.material.opacity = state.baseOpacity;
    });

    this.breathMaterials.forEach(state => {
      state.material.opacity = Math.min(
        1,
        state.baseOpacity * architecturalBreathMultiplier(renderTimeSeconds, state.phaseOffsetSeconds),
      );
    });

    const localDown = new THREE.Vector3(0, -1, 0);
    this.beamStates.forEach(state => {
      const theta = renderTimeSeconds * state.speed + state.phase;
      const sweep = state.panAmplitude * (
        0.82 * Math.sin(theta)
        + 0.18 * Math.sin(theta * 2 + 0.35)
      );
      const tilt = state.tiltAmplitude * (
        0.78 * Math.sin(theta + 1.05)
        + 0.22 * Math.sin(theta * 2 - state.phase * 0.25)
      );
      const beamGlow = 0.5 + 0.5 * Math.sin(theta * 0.72 + 0.6);

      state.group.quaternion.copy(state.baseQuaternion);
      state.group.rotateZ(sweep);
      state.group.rotateX(tilt);
      state.material.opacity = 0.062 + beamGlow * 0.028;

      const direction = localDown.clone().applyQuaternion(state.group.quaternion).normalize();
      state.light.target.position
        .copy(state.light.position)
        .addScaledVector(direction, state.distance);
      state.light.target.updateMatrixWorld();
      state.light.intensity = 20 + beamGlow * 5;
    });
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.root.removeFromParent();
    disposeObject(this.root);
    this.textures.forEach(texture => texture.dispose());
    this.textures.length = 0;
    this.pulseMaterials.length = 0;
    this.breathMaterials.length = 0;
    this.beamStates.length = 0;
    this.spotLights.length = 0;
    this.acceptedBreathMaterials.length = 0;
    this.acceptedMovingHeads.length = 0;
    this.fallbackChildren.length = 0;
    this.loadedModel = null;
    this.lastAcceptedBreathUpdateSeconds = Number.NEGATIVE_INFINITY;
    this.root.clear();
  }


  private prepareAcceptedR15Runtime(model: THREE.Object3D) {
    const reviewAtmosphere = model.getObjectByName("R15 Review Atmosphere");
    if (reviewAtmosphere) reviewAtmosphere.visible = false;

    model.traverse(object => {
      if (!(object instanceof THREE.Light)) return;
      object.castShadow = false;
      object.intensity = 0;

      if (object.name.endsWith("_OpticalBeam")) {
        object.layers.set(31);
      } else {
        object.visible = false;
      }
    });

    const rejectedLogoNodes: THREE.Object3D[] = [];
    model.traverse(object => {
      const normalized = object.name.toLowerCase().replace(/[\s_.-]+/g, "");
      if (
        normalized.includes("r15auditioninset")
        || normalized.includes("auditionbrand")
        || normalized.includes("dancetogether")
      ) {
        rejectedLogoNodes.push(object);
      }
    });
    rejectedLogoNodes.forEach(object => object.removeFromParent());

    const centralLed = model.getObjectByName("CentralLED") as THREE.Mesh | undefined;
    if (centralLed?.isMesh) {
      const sources = Array.isArray(centralLed.material)
        ? centralLed.material
        : [centralLed.material];
      const next = sources.map(source => {
        if (source instanceof THREE.MeshStandardMaterial) {
          const material = source.clone();
          material.name = source.name + " RuntimeNeutralLED";
          material.map = null;
          material.emissiveMap = null;
          material.color.setHex(0x14052f);
          material.emissive.setHex(0x2c0758);
          material.emissiveIntensity = 0.34;
          material.roughness = 0.44;
          material.metalness = 0.0;
          material.needsUpdate = true;
          return material;
        }
        if (source instanceof THREE.MeshBasicMaterial) {
          const material = source.clone();
          material.name = source.name + " RuntimeNeutralLED";
          material.map = null;
          material.color.setHex(0x18063b);
          material.needsUpdate = true;
          return material;
        }
        return source;
      });
      centralLed.material = Array.isArray(centralLed.material) ? next : next[0];
    }

    const importedCrownNodes: THREE.Object3D[] = [];
    model.traverse(object => {
      const normalizedNodeName = object.name.toLowerCase().replace(/[\s_.-]+/g, "");
      const mesh = object as THREE.Mesh;
      const materialNames = mesh.isMesh
        ? (Array.isArray(mesh.material) ? mesh.material : [mesh.material])
          .filter(Boolean)
          .map(material => material.name.toLowerCase().replace(/[\s_.-]+/g, ""))
        : [];
      if (
        normalizedNodeName.includes("crown")
        || materialNames.some(name => name.includes("crown"))
      ) {
        importedCrownNodes.push(object);
      }
    });
    importedCrownNodes.forEach(object => {
      object.visible = false;
    });

    this.tuneAcceptedR15Materials(model);
    this.optimizeAcceptedR15ForMobile(model);
    this.prepareAcceptedR15Breathing(model);
    this.prepareAcceptedR15MovingHeads(model);
    this.createAcceptedR15BeautyLighting(model);
  }

  private prepareAcceptedR15Breathing(model: THREE.Object3D) {
    const shared = new Map<string, THREE.MeshStandardMaterial>();

    model.traverse(object => {
      const mesh = object as THREE.Mesh;
      if (!mesh.isMesh) return;

      const phase = (() => {
        if (/^Mobile_Rails_L_(Neon|Pixel)/.test(mesh.name)) return 0;
        if (/^Mobile_Rails_R_(Neon|Pixel)/.test(mesh.name)) return 0.10;
        if (/^Mobile_Risers_Neon_/.test(mesh.name)) return 0.05;

        // Backward-compatible names for the unoptimized R15.1 source.
        if (/^(RailCore|RailAccent)_L_/.test(mesh.name)) return 0;
        if (/^(RailCore|RailAccent)_R_/.test(mesh.name)) return 0.10;
        if (/^FrontApron_CyanLip$/.test(mesh.name)) return 0.05;
        if (/^Riser[0-3]_(Cyan|Magenta)Lip$/.test(mesh.name)) return 0.05;
        return null;
      })();
      if (phase === null) return;

      const sources = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      const next = sources.map(source => {
        if (!(source instanceof THREE.MeshStandardMaterial)) return source;
        const key = source.uuid + ":" + phase.toFixed(2);
        const cached = shared.get(key);
        if (cached) return cached;

        const material = source.clone();
        material.name = source.name + " R15.1 Breath " + phase.toFixed(2);
        if (/^(Mobile_Risers_Neon_|Riser[0-3]_(Cyan|Magenta)Lip$)/.test(mesh.name)) {
          material.emissiveIntensity = Math.max(material.emissiveIntensity, 9.0);
          material.toneMapped = false;
        }
        shared.set(key, material);
        this.acceptedBreathMaterials.push({
          material,
          baseEmissiveIntensity: material.emissiveIntensity,
          phaseOffsetSeconds: phase,
        });
        return material;
      });

      mesh.material = Array.isArray(mesh.material) ? next : next[0];
    });
  }

  private tuneAcceptedR15Materials(model: THREE.Object3D) {
    const visited = new Set<THREE.Material>();

    model.traverse(object => {
      const mesh = object as THREE.Mesh;
      if (!mesh.isMesh) return;
      const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];

      materials.forEach(material => {
        if (!material || visited.has(material)) return;
        visited.add(material);
        if (!(material instanceof THREE.MeshStandardMaterial)) return;

        const name = material.name.toLowerCase();

        // CentralLED is intentionally neutralized after the baked P15 texture
        // is removed. Do not let generic LED Matrix tuning re-boost it or the
        // additive backdrop will clip to white/pastel on mobile.
        if (name.includes("runtimeneutralled")) return;

        if (name.includes("architecture navy")) {
          material.emissive.setHex(0x17083a);
          material.emissiveIntensity = 0.26;
        } else if (name.includes("architecture indigo")) {
          material.emissive.setHex(0x47136f);
          material.emissiveIntensity = 0.46;
        } else if (name.includes("riser polished top")) {
          material.emissive.setHex(0x5a0e86);
          material.emissiveIntensity = 0.52;
        } else if (name.includes("aperture cyan")) {
          material.emissive.setHex(0x20d9ff);
          material.emissiveIntensity = Math.max(material.emissiveIntensity, 7.8);
          material.toneMapped = false;
        } else if (name.includes("aperture violet")) {
          material.emissive.setHex(0xff2ed0);
          material.emissiveIntensity = Math.max(material.emissiveIntensity, 8.8);
          material.toneMapped = false;
        } else if (name.includes("neon cyan")) {
          material.emissive.setHex(0x18dcff);
          material.emissiveIntensity = Math.max(material.emissiveIntensity, 7.4);
          material.toneMapped = false;
        } else if (name.includes("neon magenta")) {
          material.emissive.setHex(0xff25cf);
          material.emissiveIntensity = Math.max(material.emissiveIntensity, 9.4);
          material.toneMapped = false;
        } else if (name.includes("neon violet")) {
          material.emissive.setHex(0xb84cff);
          material.emissiveIntensity = Math.max(material.emissiveIntensity, 8.2);
          material.toneMapped = false;
        } else if (name.includes("neon white")) {
          material.emissive.setHex(0xd9ddff);
          material.emissiveIntensity = Math.max(material.emissiveIntensity, 2.8);
          material.toneMapped = false;
        } else if (name.includes("led matrix")) {
          material.emissive.setHex(0x7b22c7);
          material.emissiveIntensity = 1.65;
        } else if (name.includes("pixel magenta")) {
          material.emissive.setHex(0xff35d1);
          material.emissiveIntensity = Math.max(material.emissiveIntensity, 5.2);
          material.toneMapped = false;
        }

        if (name.includes("porcelain tile") || name.includes("polished tile")) {
          material.roughness = Math.min(material.roughness, 0.025);
          material.metalness = Math.max(material.metalness, 0.18);
          material.emissive.setHex(0x110428);
          material.emissiveIntensity = 0.11;
        } else if (name.includes("riser polished top")) {
          material.roughness = Math.min(material.roughness, 0.075);
          material.metalness = Math.max(material.metalness, 0.05);
        }
      });
    });
  }

  private optimizeAcceptedR15ForMobile(model: THREE.Object3D) {
    // Portrait gameplay cannot resolve the fixture micro-detail, but every tiny
    // child mesh still costs a draw call on Safari/WebGL. Preserve the aperture,
    // barrel and the main/rear fixture silhouette; drop only invisible detail.
    model.traverse(object => {
      const name = object.name;
      if (name.includes("_CoolingFin") || name.includes("_RearCap")) {
        object.visible = false;
        return;
      }

      // Base / Yoke / LensBezel are part of the visible portrait silhouette of
      // the lower stage uplights. Keep them; only micro-detail above is culled.
    });
  }

  private prepareAcceptedR15MovingHeads(model: THREE.Object3D) {
    const activeBeamKeys = new Set([
      "MainFixture_01",
      "MainFixture_02",
      "MainFixture_04",
      "MainFixture_06",
      "MainFixture_08",
      "MainFixture_09",
    ]);
    const activeSpillKeys = new Set([
      "MainFixture_01",
      "MainFixture_02",
      "MainFixture_04",
      "MainFixture_06",
      "MainFixture_08",
      "MainFixture_09",
    ]);
    const lightPoolTexture = makeAcceptedLightPoolTexture();
    const beamSourceTexture = makeAcceptedBeamSourceTexture();
    const reflectionStreakTexture = makeAcceptedReflectionStreakTexture();
    this.textures.push(lightPoolTexture, beamSourceTexture, reflectionStreakTexture);

    const groups = [
      { prefix: "MainFixture", count: 11, pan: 11, tilt: 6.5, speed: 0.62, phase: 0.00, length: 10.0, radius: 1.08 },
      { prefix: "RearFixture", count: 5, pan: 10, tilt: 6, speed: 0.58, phase: 0.80, length: 7.2, radius: 0.64 },
    ] as const;

    groups.forEach(group => {
      const center = (group.count - 1) / 2;
      for (let index = 0; index < group.count; index += 1) {
        const suffix = String(index).padStart(2, "0");
        const key = `${group.prefix}_${suffix}`;
        const panPivot = model.getObjectByName(`${key}_PanPivot`);
        const tiltPivot = model.getObjectByName(`${key}_TiltPivot`);
        const optical = model.getObjectByName(`${key}_OpticalBeam`);
        if (!panPivot || !tiltPivot || !(optical instanceof THREE.SpotLight)) continue;

        optical.intensity = 0;
        optical.castShadow = false;

        const sourceAnchor = createAcceptedFixtureSourceAnchor(tiltPivot, optical);
        const presentationColor = acceptedFixturePresentationColor(key, optical.color);
        let sourceFxRoot: THREE.Group | null = null;
        let beamRoot: THREE.Group | null = null;
        let beamMaterial: THREE.ShaderMaterial | null = null;
        if (activeBeamKeys.has(key)) {
          beamMaterial = new THREE.ShaderMaterial({
            name: `${key}_RuntimeBeam`,
            transparent: true,
            depthWrite: false,
            side: THREE.DoubleSide,
            blending: THREE.AdditiveBlending,
            toneMapped: false,
            uniforms: {
              uColor: { value: presentationColor.clone() },
              uLength: { value: group.length },
              uOpacity: { value: group.prefix === "MainFixture" ? 0.18 : 0.13 },
            },
            vertexShader: `
              varying vec2 vUv;
              varying float vDistance;
              uniform float uLength;
              void main() {
                vUv = uv;
                vec3 p = position;
                vDistance = clamp((-p.y) / uLength, 0.0, 1.0);
                p.x *= mix(0.22, 1.42, vDistance);
                gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
              }
            `,
            fragmentShader: `
              varying vec2 vUv;
              varying float vDistance;
              uniform vec3 uColor;
              uniform float uOpacity;
              void main() {
                float radial = abs(vUv.x * 2.0 - 1.0);
                float edgeFade = 1.0 - smoothstep(0.18, 1.0, radial);
                float core = exp(-radial * radial * 7.2);
                float haze = exp(-radial * radial * 0.86);
                float travel = max(0.0, 1.0 - vDistance);
                float longitudinal = 0.18 + 0.82 * pow(travel, 0.32);
                float nearHaze = 1.0 + 1.35 * exp(-vDistance * 6.5);
                float sourceGlow = exp(-vDistance * 4.2) * core;
                vec3 color = mix(uColor, vec3(1.0), min(0.52, sourceGlow));
                float alpha = uOpacity * edgeFade * (0.64 * haze + 0.36 * core) * longitudinal * nearHaze;
                alpha *= 1.0 - smoothstep(0.92, 1.0, vDistance);
                if (alpha < 0.003) discard;
                gl_FragColor = vec4(color, alpha);
              }
            `,
          });

          beamRoot = new THREE.Group();
          beamRoot.name = `${key}_RuntimeBeamRoot`;
          beamRoot.visible = false;

          const makeBeamPlane = (rotationY: number) => {
            const beam = new THREE.Mesh(
              new THREE.PlaneGeometry(group.radius * 2.15, group.length, 1, 1),
              beamMaterial!,
            );
            beam.geometry.translate(0, -group.length / 2, 0);
            beam.rotation.y = rotationY;
            return beam;
          };

          const beamA = makeBeamPlane(0);
          beamA.name = `${key}_RuntimeBeamSoftA`;
          const beamB = makeBeamPlane(Math.PI / 2);
          beamB.name = `${key}_RuntimeBeamSoftB`;
          beamRoot.add(beamA, beamB);
          this.acceptedFxRoot.add(beamRoot);

          sourceFxRoot = new THREE.Group();
          sourceFxRoot.name = `${key}_RuntimeSourceFxRoot`;
          this.acceptedFxRoot.add(sourceFxRoot);

          const sourceMaterial = new THREE.SpriteMaterial({
            map: beamSourceTexture,
            color: presentationColor.clone().lerp(new THREE.Color(0xffffff), 0.08),
            transparent: true,
            opacity: 0.88,
            depthWrite: false,
            depthTest: false,
            blending: THREE.AdditiveBlending,
            toneMapped: false,
          });
          const sourceHalo = new THREE.Sprite(sourceMaterial);
          sourceHalo.name = `${key}_RuntimeSourceHalo`;
          sourceHalo.scale.setScalar(group.prefix === "MainFixture" ? 1.50 : 1.15);
          sourceFxRoot.add(sourceHalo);

          const hotCoreMaterial = sourceMaterial.clone();
          hotCoreMaterial.color = new THREE.Color(0xffffff);
          hotCoreMaterial.opacity = 1.0;
          const hotCore = new THREE.Sprite(hotCoreMaterial);
          hotCore.name = `${key}_RuntimeSourceHotCore`;
          hotCore.scale.setScalar(group.prefix === "MainFixture" ? 0.36 : 0.27);
          sourceFxRoot.add(hotCore);

          const sourceBloomMaterial = sourceMaterial.clone();
          sourceBloomMaterial.color = presentationColor.clone();
          sourceBloomMaterial.opacity = group.prefix === "MainFixture" ? 0.40 : 0.30;
          const sourceBloom = new THREE.Sprite(sourceBloomMaterial);
          sourceBloom.name = `${key}_RuntimeSourceBloom`;
          sourceBloom.scale.setScalar(group.prefix === "MainFixture" ? 1.92 : 1.52);
          sourceFxRoot.add(sourceBloom);

          const plumeMaterial = new THREE.MeshBasicMaterial({
            map: lightPoolTexture,
            color: presentationColor.clone().lerp(new THREE.Color(0xffffff), 0.06),
            transparent: true,
            opacity: group.prefix === "MainFixture" ? 0.43 : 0.34,
            depthWrite: false,
            depthTest: false,
            side: THREE.DoubleSide,
            blending: THREE.AdditiveBlending,
            toneMapped: false,
          });
          const makePlume = (rotationY: number, suffix: string) => {
            const plume = new THREE.Mesh(
              new THREE.PlaneGeometry(group.radius * 3.80, group.prefix === "MainFixture" ? 3.45 : 2.45),
              plumeMaterial,
            );
            plume.name = `${key}_RuntimeSourcePlume${suffix}`;
            plume.geometry.translate(0, -(group.prefix === "MainFixture" ? 1.45 : 1.05), 0);
            plume.rotation.y = rotationY;
            return plume;
          };
          beamRoot.add(
            makePlume(Math.PI / 4, "A"),
            makePlume(-Math.PI / 4, "B"),
          );
        } else if (group.prefix === "MainFixture") {
          // Concept hierarchy: every overhead head reads as a hot source,
          // while only selected heads emit volumetric shafts.
          sourceFxRoot = new THREE.Group();
          sourceFxRoot.name = `${key}_RuntimeSourceFxRoot`;
          this.acceptedFxRoot.add(sourceFxRoot);

          const sourceMaterial = new THREE.SpriteMaterial({
            map: beamSourceTexture,
            color: presentationColor.clone().lerp(new THREE.Color(0xffffff), 0.12),
            transparent: true,
            opacity: 0.78,
            depthWrite: false,
            depthTest: false,
            blending: THREE.AdditiveBlending,
            toneMapped: false,
          });
          const sourceHalo = new THREE.Sprite(sourceMaterial);
          sourceHalo.name = `${key}_RuntimeSourceHalo`;
          sourceHalo.scale.setScalar(0.96);
          sourceFxRoot.add(sourceHalo);

          const hotCoreMaterial = sourceMaterial.clone();
          hotCoreMaterial.color = new THREE.Color(0xffffff);
          hotCoreMaterial.opacity = 1.0;
          const hotCore = new THREE.Sprite(hotCoreMaterial);
          hotCore.name = `${key}_RuntimeSourceHotCore`;
          hotCore.scale.setScalar(0.23);
          sourceFxRoot.add(hotCore);
        }

        let spillMesh: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial> | null = null;
        let reflectionCoreMesh: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial> | null = null;
        let reflectionMesh: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial> | null = null;
        if (activeSpillKeys.has(key)) {
          const poolMaterial = new THREE.MeshBasicMaterial({
            name: `${key}_RuntimeLightPool`,
            map: lightPoolTexture,
            color: presentationColor.clone(),
            transparent: true,
            opacity: 0.48,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
            side: THREE.DoubleSide,
            toneMapped: false,
          });
          spillMesh = new THREE.Mesh(new THREE.PlaneGeometry(1.96, 2.76), poolMaterial);
          spillMesh.name = `${key}_RuntimeLightPoolMesh`;
          spillMesh.rotation.x = -Math.PI / 2;
          spillMesh.position.y = 0.045;
          this.acceptedFxRoot.add(spillMesh);

          const reflectionCoreMaterial = new THREE.MeshBasicMaterial({
            name: `${key}_RuntimeReflectionCore`,
            map: reflectionStreakTexture,
            color: presentationColor.clone().lerp(new THREE.Color(0xffffff), 0.18),
            transparent: true,
            opacity: 0.48,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
            side: THREE.DoubleSide,
            toneMapped: false,
          });
          reflectionCoreMesh = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 5.0), reflectionCoreMaterial);
          reflectionCoreMesh.name = `${key}_RuntimeReflectionCoreMesh`;
          reflectionCoreMesh.rotation.x = -Math.PI / 2;
          reflectionCoreMesh.position.y = 0.051;
          this.acceptedFxRoot.add(reflectionCoreMesh);

          const reflectionMaterial = new THREE.MeshBasicMaterial({
            name: `${key}_RuntimeReflectionStreak`,
            map: reflectionStreakTexture,
            color: presentationColor.clone().lerp(new THREE.Color(0xffffff), 0.04),
            transparent: true,
            opacity: 0.24,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
            side: THREE.DoubleSide,
            toneMapped: false,
          });
          reflectionMesh = new THREE.Mesh(new THREE.PlaneGeometry(1.34, 16.2), reflectionMaterial);
          reflectionMesh.name = `${key}_RuntimeReflectionStreakMesh`;
          reflectionMesh.rotation.x = -Math.PI / 2;
          reflectionMesh.position.y = 0.049;
          this.acceptedFxRoot.add(reflectionMesh);
        }

        const side = (index - center) / Math.max(1, center);
        const floorAimBase = activeBeamKeys.has(key)
          ? (
            group.prefix === "MainFixture"
              ? new THREE.Vector3(
                side * 4.55,
                0.045,
                0.15 + Math.abs(side) * 0.78,
              )
              : new THREE.Vector3(0, 0.045, -1.25)
          )
          : null;

        this.acceptedMovingHeads.push({
          panPivot,
          tiltPivot,
          optical,
          basePanQuaternion: panPivot.quaternion.clone(),
          baseTiltQuaternion: tiltPivot.quaternion.clone(),
          phase: group.phase + side * 0.52,
          panAmplitude: THREE.MathUtils.degToRad(group.pan),
          tiltAmplitude: THREE.MathUtils.degToRad(group.tilt),
          speed: group.speed,
          sourceAnchor,
          sourceFxRoot,
          floorAimBase,
          beamRoot,
          beamMaterial,
          spillMesh,
          reflectionCoreMesh,
          reflectionMesh,
        });
      }
    });
  }

  private createAcceptedR15BeautyLighting(model: THREE.Object3D) {
    const ambient = new THREE.AmbientLight(0x2d0a3e, 0.11);
    ambient.name = "R15RuntimeBeautyAmbient";

    // Local fills replace a global purple wash: reveal structure without
    // flattening the dark gaps that make the concept look premium.
    const trussFill = new THREE.PointLight(0x725dff, 22.0, 15.0, 1.78);
    trussFill.name = "R15RuntimeTrussFill";
    trussFill.position.set(0, 7.05, -1.35);

    const trussLeftFill = new THREE.PointLight(0x20d9ff, 9.0, 9.5, 1.9);
    trussLeftFill.name = "R15RuntimeTrussLeftFill";
    trussLeftFill.position.set(-5.3, 6.8, -1.5);

    const trussRightFill = new THREE.PointLight(0xff28c9, 9.0, 9.5, 1.9);
    trussRightFill.name = "R15RuntimeTrussRightFill";
    trussRightFill.position.set(5.3, 6.8, -1.5);

    const leftArchitectureFill = new THREE.PointLight(0x29dfff, 7.2, 12.5, 1.95);
    leftArchitectureFill.name = "R15RuntimeLeftArchitectureFill";
    leftArchitectureFill.position.set(-6.2, 4.2, -2.0);

    const rightArchitectureFill = new THREE.PointLight(0xff35d1, 7.2, 12.5, 1.95);
    rightArchitectureFill.name = "R15RuntimeRightArchitectureFill";
    rightArchitectureFill.position.set(6.2, 4.2, -2.0);

    const riserFill = new THREE.PointLight(0x8d35ee, 7.5, 10.5, 2.0);
    riserFill.name = "R15RuntimeRiserFill";
    riserFill.position.set(0, 2.15, -2.8);

    const floorCyanFill = new THREE.PointLight(0x20d9ff, 2.8, 9.0, 2.2);
    floorCyanFill.name = "R15RuntimeFloorCyanFill";
    floorCyanFill.position.set(-4.2, 0.72, 4.8);

    const floorMagentaFill = new THREE.PointLight(0xff28c9, 2.8, 9.0, 2.2);
    floorMagentaFill.name = "R15RuntimeFloorMagentaFill";
    floorMagentaFill.position.set(4.2, 0.72, 4.8);

    this.acceptedFxRoot.add(
      ambient,
      trussFill,
      trussLeftFill,
      trussRightFill,
      leftArchitectureFill,
      rightArchitectureFill,
      riserFill,
      floorCyanFill,
      floorMagentaFill,
    );

    const poolTexture = makeAcceptedLightPoolTexture();
    const backdropTexture = makeAcceptedBackdropGlowTexture();
    const floorReflectionTexture = makeAcceptedFloorReflectionTexture();
    const lowerFixtureGlowTexture = makeAcceptedBeamSourceTexture();
    this.textures.push(
      poolTexture,
      backdropTexture,
      floorReflectionTexture,
      lowerFixtureGlowTexture,
    );

    const centralLed = model.getObjectByName("CentralLED");
    if (centralLed) {
      centralLed.updateWorldMatrix(true, false);
      const ledBounds = new THREE.Box3().setFromObject(centralLed);
      const ledSize = ledBounds.getSize(new THREE.Vector3());
      const ledCenter = ledBounds.getCenter(new THREE.Vector3());

      const backdropMaterial = new THREE.MeshBasicMaterial({
        map: backdropTexture,
        transparent: false,
        opacity: 0.74,
        depthWrite: false,
        depthTest: true,
        blending: THREE.NormalBlending,
        side: THREE.DoubleSide,
        toneMapped: false,
      });
      const backdrop = new THREE.Mesh(
        new THREE.PlaneGeometry(ledSize.x * 0.995, ledSize.y * 0.985),
        backdropMaterial,
      );
      backdrop.name = "R15AcceptedLedGlowOverlay";
      backdrop.position.set(ledCenter.x, ledCenter.y, ledBounds.max.z + 0.028);
      this.acceptedFxRoot.add(backdrop);

    }

    // No broad backdrop wash planes: the authored LED plate is the single source
    // of wall color so dark gaps and neon hierarchy remain deterministic.

    // Recreate the luminous aperture language of the lower stage fixtures.
    // Bounds are derived from the real GLB nodes so the glows stay registered
    // with the authored equipment instead of using hand-tuned screen offsets.
    const lowerFixtureBounds = new Map<string, THREE.Box3>();
    model.traverse(object => {
      const match = object.name.match(/^(DeckUplight|FloorUplight)_\d+/);
      if (!match) return;
      object.updateWorldMatrix(true, false);
      const bounds = new THREE.Box3().setFromObject(object);
      if (bounds.isEmpty()) return;
      const key = match[0];
      const existing = lowerFixtureBounds.get(key);
      if (existing) existing.union(bounds);
      else lowerFixtureBounds.set(key, bounds.clone());
    });

    [...lowerFixtureBounds.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .forEach(([key, bounds], index) => {
        const center = bounds.getCenter(new THREE.Vector3());
        const size = bounds.getSize(new THREE.Vector3());
        const palette = [0xff35d1, 0x29dfff, 0xb64dff, 0xff35d1, 0x29dfff] as const;
        const material = new THREE.SpriteMaterial({
          map: lowerFixtureGlowTexture,
          color: palette[index % palette.length],
          transparent: true,
          opacity: 1.0,
          depthWrite: false,
          depthTest: true,
          blending: THREE.AdditiveBlending,
          toneMapped: false,
        });
        const sprite = new THREE.Sprite(material);
        sprite.name = key + "_RuntimeApertureGlow";
        sprite.position.set(center.x, center.y + size.y * 0.12, bounds.max.z + 0.055);
        sprite.renderOrder = 18;
        const diameter = THREE.MathUtils.clamp(Math.max(size.x, size.y) * 1.36, 0.46, 0.78);
        sprite.scale.set(diameter, diameter, 1);
        this.acceptedFxRoot.add(sprite);
      });

    const reflectionMaterial = new THREE.MeshBasicMaterial({
      map: floorReflectionTexture,
      transparent: true,
      opacity: 1.0,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      toneMapped: false,
    });
    const reflectionField = new THREE.Mesh(
      new THREE.PlaneGeometry(19.2, 34.0),
      reflectionMaterial,
    );
    reflectionField.name = "R15AcceptedFloorReflectionField";
    reflectionField.rotation.x = -Math.PI / 2;
    reflectionField.position.set(0, 0.044, 11.2);
    this.acceptedFxRoot.add(reflectionField);

  }

  private updateAcceptedR15Runtime(renderTimeSeconds: number) {
    if (renderTimeSeconds - this.lastAcceptedBreathUpdateSeconds >= 1 / 30) {
      this.acceptedBreathMaterials.forEach(state => {
        state.material.emissiveIntensity =
          state.baseEmissiveIntensity
          * acceptedBreathMultiplier(renderTimeSeconds, state.phaseOffsetSeconds);
      });
      this.lastAcceptedBreathUpdateSeconds = renderTimeSeconds;
    }

    const panAxis = new THREE.Vector3(0, 1, 0);
    const tiltAxis = new THREE.Vector3(1, 0, 0);
    const localDown = new THREE.Vector3(0, -1, 0);
    const worldSource = new THREE.Vector3();
    const localSource = new THREE.Vector3();
    const localTarget = new THREE.Vector3();
    const localDirection = new THREE.Vector3();
    const deltaQuaternion = new THREE.Quaternion();

    this.acceptedMovingHeads.forEach(state => {
      const theta = renderTimeSeconds * state.speed + state.phase;
      const sweep = state.panAmplitude * (
        0.82 * Math.sin(theta)
        + 0.18 * Math.sin(theta * 2 + 0.35)
      );
      const tilt = state.tiltAmplitude * (
        0.78 * Math.sin(theta + 1.05)
        + 0.22 * Math.sin(theta * 2 - state.phase * 0.25)
      );
      const glow = 0.5 + 0.5 * Math.sin(theta * 0.72 + 0.6);

      state.panPivot.quaternion
        .copy(state.basePanQuaternion)
        .multiply(deltaQuaternion.setFromAxisAngle(panAxis, sweep));
      state.tiltPivot.quaternion
        .copy(state.baseTiltQuaternion)
        .multiply(deltaQuaternion.setFromAxisAngle(tiltAxis, tilt));

      if (state.beamMaterial) {
        state.beamMaterial.uniforms.uOpacity.value = 0.18 + glow * 0.08;
      }

      state.sourceAnchor.updateWorldMatrix(true, false);
      state.sourceAnchor.getWorldPosition(worldSource);
      localSource.copy(worldSource);
      this.root.worldToLocal(localSource);

      if (state.sourceFxRoot) {
        state.sourceFxRoot.position.copy(localSource);
        state.sourceFxRoot.visible = true;
      }

      if (!state.floorAimBase || (!state.beamRoot && !state.spillMesh)) return;

      localTarget.copy(state.floorAimBase);
      localTarget.x += Math.sin(theta * 0.82 + state.phase) * 0.28;
      localTarget.z += Math.sin(theta * 0.64 + state.phase * 0.7) * 0.24;

      localDirection.subVectors(localTarget, localSource);
      if (localDirection.lengthSq() < 1e-6) {
        if (state.sourceFxRoot) state.sourceFxRoot.visible = false;
        if (state.beamRoot) state.beamRoot.visible = false;
        if (state.spillMesh) state.spillMesh.visible = false;
        if (state.reflectionCoreMesh) state.reflectionCoreMesh.visible = false;
        if (state.reflectionMesh) state.reflectionMesh.visible = false;
        return;
      }
      localDirection.normalize();

      if (state.beamRoot) {
        state.beamRoot.position.copy(localSource);
        state.beamRoot.quaternion.setFromUnitVectors(localDown, localDirection);
        state.beamRoot.visible = true;
      }

      if (!state.spillMesh) return;

      const hitX = THREE.MathUtils.clamp(localTarget.x, -8.2, 8.2);
      const hitZ = THREE.MathUtils.clamp(localTarget.z, -5.3, 6.4);

      state.spillMesh.position.set(hitX, 0.045, hitZ);
      state.spillMesh.material.opacity = 0.58 + glow * 0.14;
      state.spillMesh.visible = true;

      if (state.reflectionCoreMesh) {
        const coreLength = 4.0 + glow * 0.9;
        state.reflectionCoreMesh.position.set(
          hitX,
          0.051,
          hitZ + coreLength * 0.46,
        );
        state.reflectionCoreMesh.scale.set(
          0.88 + glow * 0.10,
          coreLength / 4.8,
          1,
        );
        state.reflectionCoreMesh.material.opacity = 0.60 + glow * 0.15;
        state.reflectionCoreMesh.visible = true;
      }

      if (state.reflectionMesh) {
        const foregroundZ = 19.2;
        const reflectionLength = THREE.MathUtils.clamp(foregroundZ - hitZ, 12.0, 23.0);
        state.reflectionMesh.position.set(
          hitX,
          0.049,
          hitZ + reflectionLength * 0.5,
        );
        state.reflectionMesh.scale.set(
          0.84 + glow * 0.12,
          reflectionLength / 15.5,
          1,
        );
        state.reflectionMesh.material.opacity = 0.34 + glow * 0.11;
        state.reflectionMesh.visible = true;
      }
    });
  }

  private makeNeonMaterial(color: number, opacity = 1) {
    const material = new THREE.MeshBasicMaterial({
      color,
      transparent: opacity < 1,
      opacity,
      depthWrite: opacity >= 1,
      blending: opacity < 1 ? THREE.AdditiveBlending : THREE.NormalBlending,
      toneMapped: false,
    });
    if (opacity < 1) this.pulseMaterials.push({ material, baseOpacity: opacity });
    return material;
  }

  private addNeonBox(
    parent: THREE.Object3D,
    name: string,
    size: THREE.Vector3,
    position: THREE.Vector3,
    color: number,
    glowScale = 1.5,
    breathPhaseSeconds: number | null = null,
  ) {
    const core = new THREE.Mesh(
      new THREE.BoxGeometry(size.x, size.y, size.z),
      this.makeNeonMaterial(color),
    );
    core.name = name;
    core.position.copy(position);
    parent.add(core);

    const glowMaterial = this.makeNeonMaterial(color, 0.11);
    if (breathPhaseSeconds !== null) {
      this.breathMaterials.push({
        material: glowMaterial,
        baseOpacity: 0.11,
        phaseOffsetSeconds: breathPhaseSeconds,
      });
    }
    const glow = new THREE.Mesh(
      new THREE.BoxGeometry(size.x * glowScale, size.y * glowScale, Math.max(size.z * 1.4, 0.035)),
      glowMaterial,
    );
    glow.name = name + "Glow";
    glow.position.copy(position);
    parent.add(glow);
    return core;
  }

  private build() {
    const bodyMaterial = new THREE.MeshStandardMaterial({
      color: COLORS.navy,
      metalness: 0.58,
      roughness: 0.24,
    });
    const body2Material = new THREE.MeshStandardMaterial({
      color: COLORS.navy2,
      metalness: 0.66,
      roughness: 0.18,
    });
    const floorMaterial = new THREE.MeshStandardMaterial({
      color: 0x070d30,
      metalness: 0.84,
      roughness: 0.13,
    });

    const floor = new THREE.Mesh(new THREE.PlaneGeometry(19.8, 14.2), floorMaterial);
    floor.name = "NeonDanceFloor";
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(0, FLOOR_Y, 0.25);
    this.root.add(floor);

    const gridRoot = new THREE.Group();
    gridRoot.name = "NeonFloorGrid";
    this.root.add(gridRoot);
    for (let x = -9; x <= 9; x += 1.5) {
      const color = Math.round(x / 1.5) % 4 === 0 ? COLORS.cyan : COLORS.violet;
      this.addNeonBox(gridRoot, "FloorGridX", new THREE.Vector3(0.018, 0.012, 13.5), new THREE.Vector3(x, 0.012, 0.2), color, 1.6);
    }
    for (let z = -5.6; z <= 6.2; z += 1.45) {
      const color = Math.round(z / 1.45) % 4 === 0 ? COLORS.magenta : COLORS.blue;
      this.addNeonBox(gridRoot, "FloorGridZ", new THREE.Vector3(18.8, 0.012, 0.018), new THREE.Vector3(0, 0.013, z), color, 1.6);
    }

    const reflectionTextureCyan = makeGlowTexture("rgba(22,217,255,1)", true);
    const reflectionTextureMagenta = makeGlowTexture("rgba(255,39,223,1)", true);
    this.textures.push(reflectionTextureCyan, reflectionTextureMagenta);
    [
      { x: -6.0, map: reflectionTextureCyan, opacity: 0.24 },
      { x: -3.5, map: reflectionTextureMagenta, opacity: 0.19 },
      { x: -1.1, map: reflectionTextureCyan, opacity: 0.13 },
      { x: 1.1, map: reflectionTextureMagenta, opacity: 0.13 },
      { x: 3.5, map: reflectionTextureCyan, opacity: 0.19 },
      { x: 6.0, map: reflectionTextureMagenta, opacity: 0.24 },
    ].forEach((spec, index) => {
      const material = new THREE.MeshBasicMaterial({
        map: spec.map,
        transparent: true,
        opacity: spec.opacity,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
        toneMapped: false,
      });
      const reflection = new THREE.Mesh(new THREE.PlaneGeometry(1.25, 10.5), material);
      reflection.name = "FloorReflection" + index;
      reflection.rotation.x = -Math.PI / 2;
      reflection.position.set(spec.x, 0.02, 0.4);
      this.root.add(reflection);
    });

    [
      { radius: 1.85, color: COLORS.magenta, tube: 0.055 },
      { radius: 1.52, color: COLORS.cyan, tube: 0.05 },
      { radius: 1.22, color: COLORS.blue, tube: 0.042 },
    ].forEach((ring, index) => {
      const mesh = new THREE.Mesh(
        new THREE.TorusGeometry(ring.radius, ring.tube, 10, 96),
        this.makeNeonMaterial(ring.color),
      );
      mesh.name = "NeonDanceRing" + index;
      mesh.rotation.x = Math.PI / 2;
      mesh.position.set(0, 0.055 + index * 0.002, 0.15);
      this.root.add(mesh);
    });

    const risers = [
      { width: 18.4, z: -3.28, depth: 0.78, bottom: 0.02, height: 0.44, curve: 0.86, color: COLORS.magenta },
      { width: 17.0, z: -3.92, depth: 0.74, bottom: 0.43, height: 0.42, curve: 0.74, color: COLORS.cyan },
      { width: 15.7, z: -4.49, depth: 0.70, bottom: 0.83, height: 0.40, curve: 0.62, color: COLORS.violet },
      { width: 14.4, z: -5.01, depth: 0.66, bottom: 1.21, height: 0.36, curve: 0.52, color: COLORS.magentaSoft },
    ];
    risers.forEach((spec, index) => {
      const riser = new THREE.Mesh(
        createRiserGeometry(spec.width, spec.z, spec.depth, spec.bottom, spec.height, spec.curve),
        body2Material,
      );
      riser.name = "NeonRiser" + index;
      this.root.add(riser);
      const edge = createCurveTube(
        makeArcPoints(spec.width, spec.z - 0.018, spec.bottom + spec.height + 0.022, spec.curve),
        0.035,
        this.makeNeonMaterial(spec.color),
      );
      edge.name = "NeonRiserEdge" + index;
      this.root.add(edge);
      const glow = createCurveTube(
        makeArcPoints(spec.width, spec.z - 0.026, spec.bottom + spec.height + 0.026, spec.curve),
        0.085,
        this.makeNeonMaterial(spec.color, 0.09),
      );
      glow.name = "NeonRiserEdgeGlow" + index;
      this.root.add(glow);
    });

    const frontLip = new THREE.Mesh(new THREE.BoxGeometry(18.8, 0.62, 0.92), body2Material);
    frontLip.name = "NeonFrontLip";
    frontLip.position.set(0, 0.27, 5.95);
    this.root.add(frontLip);
    this.addNeonBox(
      this.root,
      "NeonFrontGlow",
      new THREE.Vector3(12.6, 0.075, 0.055),
      new THREE.Vector3(0, 0.6, 5.48),
      COLORS.magenta,
      2.1,
      0.05,
    );

    [-1, 1].forEach(side => {
      const wedge = new THREE.Mesh(new THREE.BoxGeometry(3.1, 0.72, 1.65), bodyMaterial);
      wedge.name = side < 0 ? "FrontWedgeLeft" : "FrontWedgeRight";
      wedge.position.set(side * 7.55, 0.36, 5.0);
      wedge.rotation.y = side * 0.11;
      this.root.add(wedge);
      this.addNeonBox(
        this.root,
        side < 0 ? "FrontWedgeCyan" : "FrontWedgeMagenta",
        new THREE.Vector3(1.75, 0.07, 0.07),
        new THREE.Vector3(side * 7.18, 0.67, 4.34),
        side < 0 ? COLORS.cyan : COLORS.magenta,
        2.2,
        side < 0 ? 0 : 0.10,
      );
    });

    const ledTexture = createLedTexture();
    this.textures.push(ledTexture);
    const ledMaterial = new THREE.MeshBasicMaterial({ map: ledTexture, toneMapped: false });
    const ledWall = new THREE.Mesh(new THREE.PlaneGeometry(12.5, 5.25), ledMaterial);
    ledWall.name = "NeonLedWall";
    ledWall.position.set(0, 4.55, REAR_Z);
    this.root.add(ledWall);

    const screenGlow = new THREE.PointLight(COLORS.violet, 16, 11, 1.6);
    screenGlow.position.set(0, 4.6, -4.8);
    this.root.add(screenGlow);

    [-1, 1].forEach(side => {
      const tower = new THREE.Mesh(new THREE.BoxGeometry(2.05, 6.9, 1.0), bodyMaterial);
      tower.name = side < 0 ? "NeonTowerLeft" : "NeonTowerRight";
      tower.position.set(side * 8.25, 3.55, -4.82);
      tower.rotation.y = side * 0.055;
      this.root.add(tower);

      for (let row = 0; row < 7; row += 1) {
        this.addNeonBox(
          this.root,
          "NeonSideRail",
          new THREE.Vector3(1.75, 0.055, 0.055),
          new THREE.Vector3(side * 8.25, 1.25 + row * 0.83, -4.22),
          side < 0 ? COLORS.cyan : COLORS.magenta,
          2.0,
          side < 0 ? 0 : 0.10,
        );
      }

      this.addNeonBox(
        this.root,
        side < 0 ? "NeonOuterPillarCyan" : "NeonOuterPillarMagenta",
        new THREE.Vector3(0.22, 6.45, 0.12),
        new THREE.Vector3(side * 9.1, 3.7, -4.25),
        side < 0 ? COLORS.cyan : COLORS.magenta,
        2.7,
        side < 0 ? 0 : 0.10,
      );
      this.addNeonBox(
        this.root,
        side < 0 ? "NeonInnerPillarCyan" : "NeonInnerPillarMagenta",
        new THREE.Vector3(0.20, 6.0, 0.10),
        new THREE.Vector3(side * 6.62, 3.85, -5.28),
        side < 0 ? COLORS.cyan : COLORS.magenta,
        2.6,
        side < 0 ? 0 : 0.10,
      );
      this.addNeonBox(
        this.root,
        side < 0 ? "NeonInnerPillarCyan2" : "NeonInnerPillarMagenta2",
        new THREE.Vector3(0.16, 5.65, 0.09),
        new THREE.Vector3(side * 6.18, 3.82, -5.20),
        side < 0 ? COLORS.cyanSoft : COLORS.magentaSoft,
        2.2,
        side < 0 ? 0 : 0.10,
      );
    });

    const trussRoot = new THREE.Group();
    trussRoot.name = "NeonOverheadTruss";
    this.root.add(trussRoot);
    const trussMaterial = new THREE.MeshStandardMaterial({ color: 0x15205b, metalness: 0.88, roughness: 0.22 });
    const trussGlow = this.makeNeonMaterial(COLORS.blue, 0.13);
    const trussXs = Array.from({ length: 33 }, (_, index) => -9.55 + index * (19.1 / 32));
    const trussY = (x: number) => 7.55 + 0.88 * (1 - (x / 9.55) ** 2);
    [-2.15, -2.65, -3.15].forEach((z, index) => {
      const points = trussXs.map(x => new THREE.Vector3(x, trussY(x) + (index === 1 ? 0.14 : 0), z));
      trussRoot.add(createCurveTube(points, 0.07, trussMaterial));
      if (index === 1) trussRoot.add(createCurveTube(points, 0.095, trussGlow));
    });
    for (let index = 0; index < 19; index += 1) {
      const x = -8.85 + index * (17.7 / 18);
      const y = trussY(x);
      const brace = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 1.02, 6), trussMaterial);
      const source = new THREE.Vector3(x, y, -2.15);
      const target = new THREE.Vector3(x + (index % 2 === 0 ? 0.38 : -0.38), y + 0.12, -3.15);
      const length = alignYToDirection(brace, source, target);
      brace.scale.y = length / 1.02;
      trussRoot.add(brace);
    }

    const fixtureXs = [-8.35, -6.85, -5.35, -3.85, -2.35, -0.8, 0.8, 2.35, 3.85, 5.35, 6.85, 8.35];
    fixtureXs.forEach((x, index) => {
      const source = new THREE.Vector3(x, trussY(x) - 0.25, -2.45);
      const target = new THREE.Vector3(
        x * 0.43,
        0.42 + (index % 3) * 0.18,
        -0.2 + (index % 2 ? -0.45 : 0.3),
      );
      const color = index % 4 === 0 || index % 4 === 3 ? COLORS.cyan : COLORS.violet;
      this.createFixture(trussRoot, source, target, color, index);
    });

    const innerXs = [-4.8, -3.2, -1.6, 0, 1.6, 3.2, 4.8];
    innerXs.forEach((x, index) => {
      const source = new THREE.Vector3(x, 6.96 + 0.22 * (1 - (x / 4.8) ** 2), -3.65);
      const target = new THREE.Vector3(x * 0.38, 0.35, -0.5);
      this.createFixture(this.root, source, target, index % 2 === 0 ? COLORS.violet : COLORS.cyan, index + 30, 0.82);
    });

    const lowerXs = [-8.4, -7.1, -5.8, -4.5, -3.1, -1.7, 1.7, 3.1, 4.5, 5.8, 7.1, 8.4];
    lowerXs.forEach((x, index) => {
      const color = index % 3 === 0 ? COLORS.cyan : COLORS.magenta;
      const base = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.20, 0.42), bodyMaterial);
      base.position.set(x, 1.68, -4.68);
      base.name = "NeonLowerFixture";
      this.root.add(base);
      const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.065, 20), this.makeNeonMaterial(color));
      lens.rotation.x = Math.PI / 2;
      lens.position.set(x, 1.78, -4.41);
      this.root.add(lens);
    });

    const cyanFill = new THREE.PointLight(COLORS.cyan, 22, 13, 1.7);
    cyanFill.position.set(-6.2, 4.0, -1.5);
    const magentaFill = new THREE.PointLight(COLORS.magenta, 22, 13, 1.7);
    magentaFill.position.set(6.2, 4.0, -1.5);
    const topViolet = new THREE.PointLight(COLORS.violet, 15, 12, 1.7);
    topViolet.position.set(0, 7.0, -2.6);

    // Constant beauty lighting keeps the accepted stage body readable while
    // moving beams run as an additive presentation layer.
    const beautyHemisphere = new THREE.HemisphereLight(0x6177ff, 0x190426, 1.35);
    beautyHemisphere.name = "NeonBeautyHemisphere";
    const beautyKey = new THREE.DirectionalLight(0xaec0ff, 1.28);
    beautyKey.name = "NeonBeautyKey";
    beautyKey.position.set(0, 9.5, 8.0);
    beautyKey.target.position.set(0, 1.6, -2.3);
    const beautyFill = new THREE.PointLight(0x6b55ff, 10, 19, 1.55);
    beautyFill.name = "NeonBeautyFloorFill";
    beautyFill.position.set(0, 3.8, 4.4);
    this.root.add(
      cyanFill,
      magentaFill,
      topViolet,
      beautyHemisphere,
      beautyKey,
      beautyKey.target,
      beautyFill,
    );
  }

  private createFixture(
    parent: THREE.Object3D,
    source: THREE.Vector3,
    target: THREE.Vector3,
    color: number,
    index: number,
    beamRadius = 0.72,
  ) {
    const fixture = new THREE.Group();
    fixture.name = "NeonFixture" + index;
    fixture.position.copy(source);
    parent.add(fixture);

    const body = new THREE.Mesh(
      new THREE.BoxGeometry(0.34, 0.38, 0.32),
      new THREE.MeshStandardMaterial({ color: 0x080a16, metalness: 0.72, roughness: 0.28 }),
    );
    body.position.y = -0.18;
    fixture.add(body);

    const lens = new THREE.Mesh(
      new THREE.CylinderGeometry(0.13, 0.13, 0.055, 20),
      this.makeNeonMaterial(color),
    );
    lens.rotation.x = Math.PI / 2;
    lens.position.set(0, -0.22, 0.18);
    fixture.add(lens);

    const beamGroup = new THREE.Group();
    beamGroup.position.copy(source);
    const beamMaterial = this.makeNeonMaterial(color, 0.052);
    beamMaterial.side = THREE.DoubleSide;
    beamMaterial.depthWrite = false;
    const length = source.distanceTo(target);
    const beam = new THREE.Mesh(new THREE.ConeGeometry(beamRadius, length, 18, 1, true), beamMaterial);
    beam.position.y = -length / 2;
    beamGroup.quaternion.setFromUnitVectors(
      new THREE.Vector3(0, -1, 0),
      target.clone().sub(source).normalize(),
    );
    const baseQuaternion = beamGroup.quaternion.clone();
    beamGroup.add(beam);
    this.animatedRoot.add(beamGroup);

    const spot = new THREE.SpotLight(color, 22, length + 5, Math.PI / 9, 0.72, 1.25);
    spot.position.copy(source);
    spot.target.position.copy(target);
    this.root.add(spot, spot.target);
    this.spotLights.push(spot);

    const innerFixture = index >= 30;
    this.beamStates.push({
      group: beamGroup,
      material: beamMaterial,
      baseQuaternion,
      phase: index * 0.42,
      panAmplitude: THREE.MathUtils.degToRad(innerFixture ? 18 : 24),
      tiltAmplitude: THREE.MathUtils.degToRad(innerFixture ? 9 : 12),
      speed: innerFixture ? 0.68 : 0.90,
      light: spot,
      distance: length,
    });
  }
}
