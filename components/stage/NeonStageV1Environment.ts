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
  motionAccent: boolean;
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
  e20Spot: THREE.SpotLight | null;
  e20GlintMaterial: THREE.SpriteMaterial | null;
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
// High-resolution, already-authored stage artwork for controlled optical QA.
// Do not enable it in gameplay before the owner accepts an iPhone comparison.
const CONCEPT_LED_ASSET_URL = "/stages/neon-stage-v1/golden-led-wall-v2.webp";
const VECTOR_LED_ASSET_URL = "/stages/neon-stage-v1/concept-led-v14.svg";
const TYPOGRAPHY_V16_COMPARE_ASSET_URL =
  "/stages/neon-stage-v1/concept-led-typography-v16.svg";
const CROWN_CLEARANCE_E21_ASSET_URL =
  "/stages/neon-stage-v1/concept-led-crown-clearance-e21.svg";
const CLEAN_BASE_E22_ASSET_URL =
  "/stages/neon-stage-v1/concept-led-clean-base-e22.svg";
const BALANCED_E23_ASSET_URL =
  "/stages/neon-stage-v1/concept-led-balanced-e23.svg";
const ARTWORK_E27_ASSET_URL =
  "/stages/neon-stage-v1/concept-led-artwork-e27.svg";
const ARTWORK_E28_ASSET_URL =
  "/stages/neon-stage-v1/concept-led-artwork-e28.svg";
// Owner rejected the V15 golden-core and traced-lettering experiments.
// V14 is the default, compare-only working baseline, including deprecated V15 URLs.
// Explicit ?ledAsset=legacy preserves the low-resolution WebP control.
// Other stages keep Bright Stage as default. Direct Neon runtime now uses
// the owner-accepted E29 SVG; compare routes retain all historical controls.
function useHiResLedCompare() {
  if (typeof window === "undefined") return false;
  if (window.location.pathname !== "/tools/neon-stage-compare") return false;
  return new URLSearchParams(window.location.search).get("ledAsset") !== "legacy";
}

function useTypographyV16LedCompare() {
  return typeof window !== "undefined"
    && window.location.pathname === "/tools/neon-stage-compare"
    && new URLSearchParams(window.location.search).get("ledAsset") === "typography-v16";
}

// Owner REJECTED the integrated-v1 visual after direct iPhone comparison.
// Old public review URLs must safely fall back to the untouched V14/V16 visual.
// Preserve the previous shader/floor branch ONLY behind an explicitly marked
// forensic route so the failed effect can still be reproduced if required.
function useIntegratedStageFxCompare() {
  return typeof window !== "undefined"
    && window.location.pathname === "/tools/neon-stage-compare"
    && new URLSearchParams(window.location.search).get("stageFx") === "rejected-v17-diagnostic";
}

// Isolated E18 physical-surface trial: never alter accepted/legacy or V16.
function usePhysicalSurfaceE18Compare() {
  return typeof window !== "undefined"
    && window.location.pathname === "/tools/neon-stage-compare"
    && new URLSearchParams(window.location.search).get("stageFx") === "physical-surface-e18";
}

// Retain E18 for identical-viewport A/B. E19 never activates in gameplay.
function usePhysicalReflectionE19Compare() {
  return typeof window !== "undefined"
    && window.location.pathname === "/tools/neon-stage-compare"
    && new URLSearchParams(window.location.search).get("stageFx") === "physical-reflection-e19";
}

// E20 owner-requested refinement remains compare-only; E19 remains A/B control.
function usePhysicalRefinementE20Compare() {
  return typeof window !== "undefined"
    && window.location.pathname === "/tools/neon-stage-compare"
    && new URLSearchParams(window.location.search).get("stageFx") === "physical-refinement-e20";
}

// E21 uses E19 reflection architecture and preserves E20 only as a rejected
// visual diagnostic. Keeps all new work completely isolated from gameplay.
function usePhysicalRepairE21Compare() {
  return typeof window !== "undefined"
    && window.location.pathname === "/tools/neon-stage-compare"
    && new URLSearchParams(window.location.search).get("stageFx") === "physical-repair-e21";
}

// E22 retains the positive E21 camera/logo and upgrades optics/fixture
// geometry independently. All ordinary gameplay URLs remain unchanged.
function usePhysicalFidelityE22Compare() {
  return typeof window !== "undefined"
    && window.location.pathname === "/tools/neon-stage-compare"
    && new URLSearchParams(window.location.search).get("stageFx") === "physical-fidelity-e22";
}

// E23 corrects actual physical LED registration. Only active on isolated
// compare route; E22 and ordinary gameplay retain their original transforms.
function usePhysicalAlignmentE23Compare() {
  return typeof window !== "undefined"
    && window.location.pathname === "/tools/neon-stage-compare"
    && new URLSearchParams(window.location.search).get("stageFx") === "physical-alignment-e23";
}

// E24: only extends the physical lower LED surface on compare route.
function usePhysicalExtensionE24Compare() {
  return typeof window !== "undefined"
    && window.location.pathname === "/tools/neon-stage-compare"
    && new URLSearchParams(window.location.search).get("stageFx") === "physical-extension-e24";
}

// E25 only adjusts the lower *physical extension* against the riser.
// E24 remains a byte-identical rendered control without any E25 geometry.
function usePhysicalExtensionE25Compare() {
  return typeof window !== "undefined"
    && window.location.pathname === "/tools/neon-stage-compare"
    && new URLSearchParams(window.location.search).get("stageFx") === "physical-extension-e25";
}

// E26: owner iPhone top-frame clearance. A small whole-CentralLED shift,
// while E25's structural lower wall follows the updated world-space bounds.
// The source LED artwork, crown, floor and overhead lights stay unchanged.
function usePhysicalRegistrationE26Compare() {
  return typeof window !== "undefined"
    && window.location.pathname === "/tools/neon-stage-compare"
    && new URLSearchParams(window.location.search).get("stageFx") === "physical-registration-e26";
}

// E27: visual-only correction. No game route, room state or timing changes.
function usePhysicalCleanupE27Compare() {
  return typeof window !== "undefined"
    && window.location.pathname === "/tools/neon-stage-compare"
    && new URLSearchParams(window.location.search).get("stageFx") === "physical-cleanup-e27";
}

// E28 is a separate owner QA pass; preserves E27 as a strict control.
function usePhysicalGlossE28Compare() {
  return typeof window !== "undefined"
    && window.location.pathname === "/tools/neon-stage-compare"
    && new URLSearchParams(window.location.search).get("stageFx") === "physical-gloss-e28";
}

// E29 fixes the rejected E28 floor color wash. Keep E28 and E27 as independent controls.
function usePhysicalFloorBalanceE29Compare() {
  return typeof window !== "undefined"
    && window.location.pathname === "/tools/neon-stage-compare"
    && new URLSearchParams(window.location.search).get("stageFx") === "physical-floor-balance-e29";
}

// Owner accepted E29 on iPhone for S2.5A visual fidelity. When this
// NeonStageV1Environment is requested outside the isolated compare route,
// present the same E29 appearance for direct Neon runtime QA. The catalog
// still keeps Bright Stage default/selectable; this doesn't enable S3.
function useAcceptedNeonE29RuntimePresentation() {
  return typeof window !== "undefined"
    && window.location.pathname !== "/tools/neon-stage-compare";
}

function getE28FloorDiagnostic() {
  if (!usePhysicalGlossE28Compare()) return null;
  const value = new URLSearchParams(window.location.search).get("floorDebug");
  return value === "reflection-off" || value === "grid-off" || value === "base-neutral"
    ? value : null;
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

// Presentation-only beat energy. Read from Stage3D's existing authoritative
// WebAudio song time (never owns, changes or schedules the global timeline).
// A brief attack and soft release read as musical breath, not a strobe.
function acceptedSongBeatEnergy(songTimeMs: number, bpm: number, isPlaying: boolean) {
  if (!isPlaying || !Number.isFinite(songTimeMs) || songTimeMs < 0
    || !Number.isFinite(bpm) || bpm <= 0) return 0;
  const beatPosition = songTimeMs * bpm / 60000;
  const index = Math.floor(beatPosition);
  const phase = beatPosition - index;
  const accented = index % 4 === 0;
  // N3: preserve a smooth beat envelope long enough to be visible on iPhone.
  const gentleAttack = 0.58 + 0.42 * (1 - Math.exp(-24.0 * phase));
  const release = Math.exp(-2.2 * phase);
  return (accented ? 1 : 0.68) * gentleAttack * release;
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
  ctx.globalCompositeOperation = "lighter";

  const base = ctx.createLinearGradient(0, 0, 0, canvas.height);
  base.addColorStop(0, "rgba(90,0,205,0.020)");
  base.addColorStop(0.32, "rgba(235,0,198,0.010)");
  base.addColorStop(0.68, "rgba(30,0,135,0.005)");
  base.addColorStop(1, "rgba(7,0,48,0)");
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const xToCanvas = (worldX: number) => ((worldX + 9.9) / 19.8) * canvas.width;
  const sources = [
    { x: -8.7, cyan: true,  a: 0.45, y: 158, w: 0.78 },
    { x: -6.6, cyan: false, a: 0.62, y: 144, w: 0.88 },
    { x: -4.8, cyan: true,  a: 0.66, y: 150, w: 0.82 },
    { x: -3.0, cyan: false, a: 0.72, y: 154, w: 0.86 },
    { x: -1.2, cyan: true,  a: 0.50, y: 148, w: 0.68 },
    { x:  1.2, cyan: false, a: 0.52, y: 150, w: 0.70 },
    { x:  3.0, cyan: true,  a: 0.70, y: 152, w: 0.86 },
    { x:  4.8, cyan: false, a: 0.66, y: 146, w: 0.84 },
    { x:  6.6, cyan: true,  a: 0.60, y: 142, w: 0.80 },
    { x:  8.7, cyan: false, a: 0.44, y: 158, w: 0.76 },
  ] as const;

  const rgba = (cyan: boolean, alpha: number) => (
    cyan
      ? `rgba(34,214,255,${alpha.toFixed(3)})`
      : `rgba(255,39,205,${alpha.toFixed(3)})`
  );

  sources.forEach((source, sourceIndex) => {
    const cx = xToCanvas(source.x);

    // Compact hot pool where the source reflection begins.
    ctx.save();
    ctx.translate(cx, source.y);
    ctx.scale(source.w, 0.62);
    const hot = ctx.createRadialGradient(0, 0, 0, 0, 0, 48);
    hot.addColorStop(0, rgba(source.cyan, source.a));
    hot.addColorStop(0.20, rgba(source.cyan, source.a * 0.52));
    hot.addColorStop(0.62, rgba(source.cyan, source.a * 0.12));
    hot.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = hot;
    ctx.beginPath();
    ctx.arc(0, 0, 48, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Broken mirror fragments: longer toward the camera, but interrupted by
    // dark tile gaps. Small deterministic lateral drift keeps them organic.
    for (let segment = 0; segment < 7; segment += 1) {
      const t = segment / 6;
      const cy = source.y + 28 + segment * 46;
      const drift = Math.sin(sourceIndex * 1.7 + segment * 0.9) * (1.5 + t * 2.2);
      const halfW = 5.0 + source.w * (5.0 + t * 4.0);
      const halfH = 16 + t * 18;
      const alpha = source.a * (0.42 - t * 0.30);
      if (alpha <= 0.025) continue;

      ctx.save();
      ctx.translate(cx + drift, cy);
      ctx.scale(halfW / 42, halfH / 42);
      const fragment = ctx.createRadialGradient(0, 0, 0, 0, 0, 42);
      fragment.addColorStop(0, rgba(source.cyan, alpha));
      fragment.addColorStop(0.16, rgba(source.cyan, alpha * 0.72));
      fragment.addColorStop(0.54, rgba(source.cyan, alpha * 0.20));
      fragment.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = fragment;
      ctx.beginPath();
      ctx.arc(0, 0, 42, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // Narrow hot center inside each fragment, not a continuous laser line.
      const coreAlpha = alpha * 0.62;
      const core = ctx.createLinearGradient(0, cy - halfH, 0, cy + halfH);
      core.addColorStop(0, "rgba(255,255,255,0)");
      core.addColorStop(0.40, rgba(source.cyan, coreAlpha * 0.34));
      core.addColorStop(0.52, rgba(source.cyan, coreAlpha));
      core.addColorStop(0.64, rgba(source.cyan, coreAlpha * 0.28));
      core.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = core;
      ctx.fillRect(cx + drift - 1.25, cy - halfH, 2.5, halfH * 2);
    }
  });

  // Soft mirrored energy from the central ring / LED, kept below the source
  // fragments so the foreground still has dark premium gaps.
  const centerBloom = ctx.createRadialGradient(256, 116, 0, 256, 116, 155);
  centerBloom.addColorStop(0, "rgba(255,26,202,0.075)");
  centerBloom.addColorStop(0.28, "rgba(52,184,255,0.042)");
  centerBloom.addColorStop(0.62, "rgba(90,0,210,0.018)");
  centerBloom.addColorStop(1, "rgba(88,45,190,0)");
  ctx.fillStyle = centerBloom;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Reflection breakup at major tile boundaries.
  ctx.globalCompositeOperation = "destination-out";
  for (let y = 205; y < 500; y += 47) {
    ctx.fillStyle = "rgba(0,0,0,0.16)";
    ctx.fillRect(0, y, canvas.width, 2);
  }
  ctx.globalCompositeOperation = "source-over";

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}


/**
 * Compare-only wet floor: reconstruct light pools from real GLB fixture bounds
 * instead of painting equally-spaced neon lanes in screen/image coordinates.
 * One premultiplied-looking transparent canvas texture, no screen-space
 * reflections, render targets, WebGL extensions, or per-frame allocations.
 */
function makeIntegratedFloorReflectionTexture(model: THREE.Object3D) {
  const width = 1024;
  const height = 1024;
  const planeWidth = 19.2;
  const planeLength = 34.0;
  const planeCenterZ = 11.2;
  const backZ = planeCenterZ - planeLength / 2;

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Integrated floor reflection canvas unavailable.");

  const toX = (x: number) => (x / planeWidth + 0.5) * width;
  const toY = (z: number) => ((z - backZ) / planeLength) * height;

  const fixtureBounds = new Map<string, THREE.Box3>();
  model.traverse(object => {
    const key = object.name.match(/^(DeckUplight|FloorUplight)_\d+/)?.[0];
    if (!key) return;
    const bounds = new THREE.Box3().setFromObject(object);
    if (bounds.isEmpty()) return;
    const existing = fixtureBounds.get(key);
    if (existing) existing.union(bounds);
    else fixtureBounds.set(key, bounds);
  });

  const fixtures = [...fixtureBounds.entries()]
    .map(([key, bounds]) => ({ key, center: bounds.getCenter(new THREE.Vector3()) }))
    .sort((a, b) => a.center.x - b.center.x || a.key.localeCompare(b.key));
  const rgba = (cyan: boolean, alpha: number) => cyan
    ? `rgba(30,210,255,${Math.max(0, Math.min(1, alpha)).toFixed(3)})`
    : `rgba(255,38,207,${Math.max(0, Math.min(1, alpha)).toFixed(3)})`;

  const paintPool = (x: number, y: number, radiusX: number, radiusY: number, cyan: boolean, alpha: number) => {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(radiusX, radiusY);
    const glow = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
    glow.addColorStop(0, rgba(cyan, alpha));
    glow.addColorStop(0.22, rgba(cyan, alpha * 0.54));
    glow.addColorStop(0.65, rgba(cyan, alpha * 0.11));
    glow.addColorStop(1, rgba(cyan, 0));
    ctx.fillStyle = glow;
    ctx.fillRect(-1, -1, 2, 2);
    ctx.restore();
  };

  // Distinct reflections start underneath each physical uplight, and become
  // wider, dimmer and more fragmented toward the spectator/camera.
  ctx.globalCompositeOperation = "lighter";
  fixtures.forEach((fixture, index) => {
    const cyan = index % 2 === 1;
    const x = toX(fixture.center.x);
    const sourceY = toY(fixture.center.z);
    paintPool(x, sourceY + 12, 28, 27, cyan, 0.49);

    for (let band = 0; band < 14; band += 1) {
      const progress = band / 13;
      const z = fixture.center.z + 0.65 + band * 0.78;
      const y = toY(z);
      const drift = Math.sin(index * 1.41 + band * 1.83) * (2.2 + progress * 8.5);
      const intensity = (0.29 + 0.07 * Math.cos(index * 2.1))
        * Math.exp(-progress * 1.65)
        * (0.75 + 0.25 * Math.cos(band * 2.42));
      paintPool(x + drift, y, 14 + progress * 19, 15 + progress * 14, cyan, intensity);
    }
  });

  // Real ring bounds establish scale and location of diffuse reflected energy.
  // No extra sharp ring geometry: the actual GLB ring is already the crisp source.
  const ring = model.getObjectByName("R15 Dance Ring Outer");
  if (ring) {
    const bounds = new THREE.Box3().setFromObject(ring);
    if (!bounds.isEmpty()) {
      const center = bounds.getCenter(new THREE.Vector3());
      const size = bounds.getSize(new THREE.Vector3());
      const x = toX(center.x);
      const y = toY(center.z);
      const rx = Math.max(18, (size.x / planeWidth) * width * 0.56);
      const rz = Math.max(9, (size.z / planeLength) * height * 0.56);
      // Soft ring halo only; full-bright mirrored circles would double the ring.
      paintPool(x, y + 12, rx * 1.18, Math.max(24, rz * 2.0), false, 0.24);
      paintPool(x, y + 34, rx * 0.83, 50, true, 0.13);
      for (const side of [-0.73, 0, 0.73]) {
        const cyan = side === 0;
        for (let step = 0; step < 9; step += 1) {
          const progress = step / 9;
          const taper = Math.exp(-progress * 1.5);
          paintPool(
            x + side * rx + Math.sin(step * 1.4 + side) * 3,
            y + 26 + step * 26,
            12 + progress * 9,
            25 + progress * 8,
            cyan,
            (side === 0 ? 0.20 : 0.30) * taper,
          );
        }
      }
    }
  }

  // Tile joints interrupt reflection coherently across the entire floor;
  // no continuous straight cyan/pink laser columns to the foreground.
  ctx.globalCompositeOperation = "destination-out";
  for (let z = backZ + 1.8; z < backZ + planeLength; z += 2.55) {
    const y = toY(z);
    ctx.fillStyle = "rgba(0,0,0,0.21)";
    ctx.fillRect(0, y, width, 2.2);
  }
  ctx.globalCompositeOperation = "source-over";

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  texture.generateMipmaps = true;
  texture.needsUpdate = true;
  return texture;
}

// E18: bounded reflections traced to authored fixture and ring world positions.
// Single static texture: no per-frame reflection RT, no long straight planes,
// and no rejected V17 wall tint/spill. Tile seams interrupt the reflections.
function makeGroundedE18FloorReflectionTexture(model: THREE.Object3D) {
  const canvas = document.createElement("canvas");
  const size = 1024;
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("E18 floor reflection canvas unavailable.");
  const uvX = (x: number) => (x / 19.2 + 0.5) * size;
  const uvZ = (z: number) => ((z + 5.8) / 34.0) * size;
  const paint = (x: number, z: number, rx: number, rz: number, color: string, alpha: number) => {
    ctx.save();
    ctx.translate(uvX(x), uvZ(z));
    ctx.scale(rx, rz);
    const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
    gradient.addColorStop(0, color.replace("ALPHA", alpha.toFixed(3)));
    gradient.addColorStop(0.35, color.replace("ALPHA", (alpha * 0.35).toFixed(3)));
    gradient.addColorStop(1, color.replace("ALPHA", "0"));
    ctx.fillStyle = gradient;
    ctx.fillRect(-1, -1, 2, 2);
    ctx.restore();
  };
  const boundsByFixture = new Map<string, THREE.Box3>();
  model.traverse(object => {
    const key = object.name.match(/^(DeckUplight|FloorUplight)_\d+/)?.[0];
    if (!key) return;
    const bounds = new THREE.Box3().setFromObject(object);
    if (bounds.isEmpty()) return;
    const previous = boundsByFixture.get(key);
    if (previous) previous.union(bounds);
    else boundsByFixture.set(key, bounds);
  });
  const fixtures = [...boundsByFixture.entries()]
    .map(([key, bounds]) => ({ key, center: bounds.getCenter(new THREE.Vector3()) }))
    .sort((a, b) => a.center.x - b.center.x || a.key.localeCompare(b.key));
  ctx.globalCompositeOperation = "lighter";
  fixtures.forEach((fixture, index) => {
    const cyan = index % 2 === 1;
    const color = cyan ? "rgba(18,208,255,ALPHA)" : "rgba(255,22,204,ALPHA)";
    const x = fixture.center.x;
    const z = fixture.center.z;
    paint(x, z + 0.26, 33, 24, color, 0.78);
    // A wet floor scatters the source into non-uniform local patches.
    // Width and stagger derive from the fixture index and distance.
    for (let band = 0; band < 12; band++) {
      const distance = band / 12;
      const zz = z + 0.55 + band * 0.66;
      const drift = Math.sin(index * 1.77 + band * 2.18) * (0.11 + 0.35 * distance);
      const attenuation = Math.exp(-distance * 2.15);
      const fragmented = 0.60 + 0.40 * Math.pow(Math.sin(band * 1.89 + index * 0.8), 2);
      paint(x + drift, zz, 10 + distance * 20, 14 + distance * 22, color,
        0.49 * attenuation * fragmented);
    }
  });
  const ring = model.getObjectByName("R15 Dance Ring Outer");
  if (ring) {
    const box = new THREE.Box3().setFromObject(ring);
    if (!box.isEmpty()) {
      const center = box.getCenter(new THREE.Vector3());
      const radius = box.getSize(new THREE.Vector3()).x * size / 19.2 * 0.55;
      paint(center.x, center.z + 0.65, radius * 0.98, 56,
        "rgba(250,33,207,ALPHA)", 0.30);
      paint(center.x, center.z + 1.0, radius * 0.68, 84,
        "rgba(24,205,255,ALPHA)", 0.21);
    }
  }
  // Physically consistent dark joints; never draw full-height neon columns.
  ctx.globalCompositeOperation = "destination-out";
  for (let z = -4.0; z < 28.1; z += 2.55) {
    ctx.fillStyle = "rgba(0,0,0,0.30)";
    ctx.fillRect(0, uvZ(z), size, 3);
  }
  ctx.globalCompositeOperation = "source-over";
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  texture.needsUpdate = true;
  return texture;
}

// E19 compares reflection rays against real imported LED geometry using four
// texture reads per floor pixel; no extra render pass, FBO or stacked planes.
function makeE19ReflectedWallFloorMaterial(
  localTexture: THREE.Texture,
  ledTexture: THREE.Texture,
  ledBounds: THREE.Box3,
) {
  return new THREE.ShaderMaterial({
    name: "NeonE19GeometryRegisteredFloorReflection",
    transparent: true,
    depthWrite: false,
    depthTest: true,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
    uniforms: {
      uLocalMap: { value: localTexture },
      uLedMap: { value: ledTexture },
      uLedMin: { value: ledBounds.min.clone() },
      uLedMax: { value: ledBounds.max.clone() },
    },
    vertexShader: `
      varying vec2 vFloorUv;
      varying vec3 vFloorWorld;
      void main() {
        vFloorUv = uv;
        vec4 world = modelMatrix * vec4(position, 1.0);
        vFloorWorld = world.xyz;
        gl_Position = projectionMatrix * viewMatrix * world;
      }
    `,
    fragmentShader: `
      varying vec2 vFloorUv;
      varying vec3 vFloorWorld;
      uniform sampler2D uLocalMap;
      uniform sampler2D uLedMap;
      uniform vec3 uLedMin;
      uniform vec3 uLedMax;
      void main() {
        vec4 localLight = texture2D(uLocalMap, vFloorUv);
        vec3 reflected = vec3(0.0);
        vec3 ray = reflect(normalize(vFloorWorld - cameraPosition), vec3(0.0, 1.0, 0.0));
        if (ray.z < -0.015) {
          float t = (uLedMax.z - vFloorWorld.z) / ray.z;
          if (t > 0.0) {
            vec3 hit = vFloorWorld + ray * t;
            vec2 uv = (hit.xy - uLedMin.xy) / max(uLedMax.xy - uLedMin.xy, vec2(0.001));
            float mask = smoothstep(0.0, 0.09, uv.x)
              * smoothstep(0.0, 0.09, 1.0 - uv.x)
              * smoothstep(0.0, 0.12, uv.y)
              * smoothstep(0.0, 0.12, 1.0 - uv.y);
            if (mask > 0.0) {
              uv = clamp(uv, vec2(0.0), vec2(1.0));
              vec3 light = texture2D(uLedMap, uv).rgb * 0.55
                + texture2D(uLedMap, uv + vec2(0.010, 0.013)).rgb * 0.225
                + texture2D(uLedMap, uv - vec2(0.010, 0.013)).rgb * 0.225;
              float source = smoothstep(0.08, 0.48,
                max(light.r, max(light.g, light.b)));
              float glancing = 1.0 - abs(dot(normalize(cameraPosition - vFloorWorld),
                vec3(0.0, 1.0, 0.0)));
              float seams = 1.0 - 0.35 * (1.0
                - smoothstep(0.0, 0.08, fract(vFloorWorld.z / 2.55)));
              float breakup = 0.80 + 0.20
                * sin(vFloorWorld.x * 13.2 + vFloorWorld.z * 5.6)
                * sin(vFloorWorld.z * 8.7 - vFloorWorld.x * 2.3);
              float falloff = exp(-0.026 * max(0.0, t - 7.0));
              reflected = light * source * mask * seams * breakup
                * falloff * (0.60 + 0.40 * glancing) * 1.35;
            }
          }
        }
        vec3 color = localLight.rgb * localLight.a * 1.40 + reflected;
        gl_FragColor = vec4(color, 0.86);
        #include <colorspace_fragment>
      }
    `,
  });
}

// E20: physically registered but intentionally rough reflections. The
// diffuse wall component reaches the ring even where a perfect specular ray
// would miss CentralLED; broad samples cannot mirror readable text. No FBO.
function makeE20SoftFloorMaterial(
  localTexture: THREE.Texture,
  ledTexture: THREE.Texture,
  ledBounds: THREE.Box3,
  ringCenter: THREE.Vector2,
  ringRadius: number,
) {
  const material = makeE19ReflectedWallFloorMaterial(
    localTexture, ledTexture, ledBounds,
  );
  material.name = "NeonE20SoftWholeFloorReflection";
  material.uniforms.uRingCenter = { value: ringCenter.clone() };
  material.uniforms.uRingRadius = { value: Math.max(0.01, ringRadius) };
  material.fragmentShader = "\n  varying vec2 vFloorUv;\n  varying vec3 vFloorWorld;\n  uniform sampler2D uLocalMap;\n  uniform sampler2D uLedMap;\n  uniform vec3 uLedMin;\n  uniform vec3 uLedMax;\n  uniform vec2 uRingCenter;\n  uniform float uRingRadius;\n\n  vec3 softLed(vec2 uv, vec2 spread) {\n    vec2 p = clamp(uv, vec2(0.0), vec2(1.0));\n    vec3 c = texture2D(uLedMap, p).rgb * 0.18;\n    c += texture2D(uLedMap, clamp(p + spread * vec2( 1.0,  0.4), 0.0, 1.0)).rgb * 0.14;\n    c += texture2D(uLedMap, clamp(p + spread * vec2(-1.0,  0.4), 0.0, 1.0)).rgb * 0.14;\n    c += texture2D(uLedMap, clamp(p + spread * vec2( 0.9, -0.8), 0.0, 1.0)).rgb * 0.14;\n    c += texture2D(uLedMap, clamp(p + spread * vec2(-0.9, -0.8), 0.0, 1.0)).rgb * 0.14;\n    c += texture2D(uLedMap, clamp(p + spread * vec2( 1.9,  1.2), 0.0, 1.0)).rgb * 0.08;\n    c += texture2D(uLedMap, clamp(p + spread * vec2(-1.9, -1.2), 0.0, 1.0)).rgb * 0.08;\n    c += texture2D(uLedMap, clamp(p + spread * vec2( 1.8, -1.2), 0.0, 1.0)).rgb * 0.05;\n    c += texture2D(uLedMap, clamp(p + spread * vec2(-1.8,  1.2), 0.0, 1.0)).rgb * 0.05;\n    return c;\n  }\n\n  void main() {\n    vec4 pools = texture2D(uLocalMap, vFloorUv);\n    float ringDistance = distance(vFloorWorld.xz, uRingCenter);\n    float ringInfluence = 1.0 - smoothstep(\n      uRingRadius * 0.56, uRingRadius * 1.65, ringDistance\n    );\n    float breakup = 0.83 + 0.17\n      * sin(vFloorWorld.x * 10.7 + vFloorWorld.z * 4.8)\n      * sin(vFloorWorld.z * 7.4 - vFloorWorld.x * 2.2);\n    float tileJoint = 1.0 - 0.27\n      * (1.0 - smoothstep(0.0, 0.07, fract(vFloorWorld.z / 2.55)));\n    float distanceFromWall = max(0.0, vFloorWorld.z - uLedMax.z);\n    float reach = exp(-0.014 * distanceFromWall);\n\n    // The low-frequency LED illumination must reach the actual ring as well\n    // as the foreground. Its broad taps cannot reproduce legible lettering.\n    float across = clamp(\n      (vFloorWorld.x - uLedMin.x) / max(uLedMax.x - uLedMin.x, 0.001),\n      0.12, 0.88\n    );\n    vec3 ambientWall = (\n      texture2D(uLedMap, vec2(across * 0.82 + 0.09, 0.38)).rgb\n      + texture2D(uLedMap, vec2(across * 0.74 + 0.13, 0.60)).rgb\n      + texture2D(uLedMap, vec2(across * 0.68 + 0.16, 0.50)).rgb\n    ) / 3.0;\n    vec3 diffuse = ambientWall * (0.12 + 0.07 * ringInfluence)\n      * reach * breakup * tileJoint;\n\n    vec3 reflection = vec3(0.0);\n    vec3 ray = reflect(\n      normalize(vFloorWorld - cameraPosition), vec3(0.0, 1.0, 0.0)\n    );\n    if (ray.z < -0.015) {\n      float t = (uLedMax.z - vFloorWorld.z) / ray.z;\n      if (t > 0.0) {\n        vec3 hit = vFloorWorld + ray * t;\n        vec2 uv = (hit.xy - uLedMin.xy)\n          / max(uLedMax.xy - uLedMin.xy, vec2(0.001));\n        float mask = smoothstep(0.0, 0.07, uv.x)\n          * smoothstep(0.0, 0.07, 1.0 - uv.x)\n          * smoothstep(0.0, 0.10, uv.y)\n          * smoothstep(0.0, 0.10, 1.0 - uv.y);\n        if (mask > 0.0) {\n          vec2 blur = mix(vec2(0.021, 0.025), vec2(0.053, 0.061),\n            ringInfluence);\n          vec3 led = softLed(uv, blur);\n          float emission = smoothstep(0.09, 0.43,\n            max(led.r, max(led.g, led.b)));\n          float distanceFade = exp(-0.018 * max(0.0, t - 4.0));\n          reflection = led * emission * mask * distanceFade\n            * reach * breakup * tileJoint\n            * mix(1.0, 0.49, ringInfluence) * 1.02;\n        }\n      }\n    }\n    // No mirror-sharp LOGO at the dancer's feet. Preserve the existing\n    // GLB ring emission above a soft, low-contrast floor light contribution.\n    vec3 sourcePools = pools.rgb * pools.a\n      * mix(1.42, 1.22, ringInfluence);\n    vec3 color = sourcePools + diffuse + reflection;\n    gl_FragColor = vec4(color, mix(0.82, 0.70, ringInfluence));\n    #include <colorspace_fragment>\n  }\n";
  material.needsUpdate = true;
  return material;
}

// E20: lightweight optical source glint, shared by the moving heads.
// This is a lens effect, NOT a broad purple wash or a post-process bloom.
function makeE20LensGlintTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 128;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("E20 truss flare canvas unavailable.");
  const radial = ctx.createRadialGradient(64, 64, 0, 64, 64, 61);
  radial.addColorStop(0, "rgba(255,255,255,1)");
  radial.addColorStop(0.13, "rgba(255,255,255,0.78)");
  radial.addColorStop(0.34, "rgba(255,255,255,0.16)");
  radial.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = radial;
  ctx.fillRect(0, 0, 128, 128);
  const horizontal = ctx.createLinearGradient(6, 0, 122, 0);
  horizontal.addColorStop(0, "rgba(255,255,255,0)");
  horizontal.addColorStop(0.48, "rgba(255,255,255,0.17)");
  horizontal.addColorStop(0.5, "rgba(255,255,255,0.48)");
  horizontal.addColorStop(0.52, "rgba(255,255,255,0.17)");
  horizontal.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = horizontal;
  ctx.fillRect(6, 62, 116, 4);
  const vertical = ctx.createLinearGradient(0, 6, 0, 122);
  vertical.addColorStop(0, "rgba(255,255,255,0)");
  vertical.addColorStop(0.5, "rgba(255,255,255,0.36)");
  vertical.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = vertical;
  ctx.fillRect(62, 6, 4, 116);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.generateMipmaps = true;
  texture.needsUpdate = true;
  return texture;
}

// Existing glTF lower fixtures already have bodies/yokes. Mount each unique
// fixture once to its stage support instead of generating duplicate heads.
function addE20UplightMounts(
  fxRoot: THREE.Object3D,
  model: THREE.Object3D,
  fixtures: Map<string, THREE.Box3>,
) {
  const padMaterial = new THREE.MeshStandardMaterial({
    name: "NeonE20MountMatteAlloy",
    color: 0x131327,
    metalness: 0.57,
    roughness: 0.40,
    emissive: 0x0a0622,
    emissiveIntensity: 0.10,
  });
  const accentMaterial = new THREE.MeshStandardMaterial({
    name: "NeonE20MountRim",
    color: 0x42405b,
    metalness: 0.63,
    roughness: 0.32,
  });
  const supports: THREE.Box3[] = [];
  model.traverse(object => {
    const mesh = object as THREE.Mesh;
    if (!mesh.isMesh) return;
    if (!/^(?:Mobile_Risers_|Riser[0-3]_|PolishedDanceFloor)/.test(mesh.name)) return;
    const box = new THREE.Box3().setFromObject(mesh);
    if (!box.isEmpty()) supports.push(box);
  });
  [...fixtures.entries()].sort(([a], [b]) => a.localeCompare(b))
    .forEach(([key, box]) => {
      const center = box.getCenter(new THREE.Vector3());
      const dimensions = box.getSize(new THREE.Vector3());
      let supportY = box.min.y - 0.075;
      for (const deck of supports) {
        if (center.x < deck.min.x - 0.05 || center.x > deck.max.x + 0.05
          || center.z < deck.min.z - 0.05 || center.z > deck.max.z + 0.05) continue;
        const top = deck.max.y;
        if (top <= box.min.y + 0.015 && top > supportY) supportY = top;
      }
      // Do not invent tall supports when no suitable deck was found.
      supportY = THREE.MathUtils.clamp(supportY, box.min.y - 0.30, box.min.y);
      const half = THREE.MathUtils.clamp(dimensions.x * 0.43, 0.18, 0.31);
      const depth = THREE.MathUtils.clamp(dimensions.z * 0.43, 0.18, 0.33);
      const mount = new THREE.Group();
      mount.name = key + "_E20PhysicalMount";
      mount.position.set(center.x, supportY, center.z);
      const base = new THREE.Mesh(
        new THREE.BoxGeometry(half * 2.35, 0.085, depth * 2.2), padMaterial,
      );
      base.name = key + "_E20ContactFoot";
      base.position.y = 0.043;
      mount.add(base);
      const upper = Math.max(0.10, box.min.y - supportY + 0.06);
      for (const side of [-1, 1]) {
        const strut = new THREE.Mesh(
          new THREE.BoxGeometry(0.055, upper, depth * 0.55), accentMaterial,
        );
        strut.name = key + (side < 0 ? "_E20YokeL" : "_E20YokeR");
        strut.position.set(side * half * 0.72, upper * 0.5, 0);
        mount.add(strut);
      }
      fxRoot.add(mount);
    });
}

// E21: E19 reflection geometry, softened by rough multi-tap sampling and
// one isotropic, low-frequency ring pool. NEVER reinstate E20's X-dependent
// floor-wide LED lookup: it created vertical stripe artifacts on iPhone.
function makeE21SoftRingReflectionMaterial(
  localTexture: THREE.Texture,
  ledTexture: THREE.Texture,
  ledBounds: THREE.Box3,
  ringCenter: THREE.Vector2,
  ringRadius: number,
) {
  const material = makeE19ReflectedWallFloorMaterial(localTexture, ledTexture, ledBounds);
  material.name = "NeonE21SoftRingReflection";
  material.uniforms.uRingCenter = { value: ringCenter.clone() };
  material.uniforms.uRingRadius = { value: Math.max(0.25, ringRadius) };
  material.fragmentShader = `
    varying vec2 vFloorUv;
    varying vec3 vFloorWorld;
    uniform sampler2D uLocalMap;
    uniform sampler2D uLedMap;
    uniform vec3 uLedMin;
    uniform vec3 uLedMax;
    uniform vec2 uRingCenter;
    uniform float uRingRadius;

    vec3 softMirror(vec2 uv, vec2 blur) {
      uv = clamp(uv, vec2(0.0), vec2(1.0));
      vec3 c = texture2D(uLedMap, uv).rgb * 0.18;
      c += texture2D(uLedMap, clamp(uv + vec2(blur.x, 0.0), 0.0, 1.0)).rgb * 0.16;
      c += texture2D(uLedMap, clamp(uv - vec2(blur.x, 0.0), 0.0, 1.0)).rgb * 0.16;
      c += texture2D(uLedMap, clamp(uv + vec2(0.0, blur.y), 0.0, 1.0)).rgb * 0.14;
      c += texture2D(uLedMap, clamp(uv - vec2(0.0, blur.y), 0.0, 1.0)).rgb * 0.14;
      c += texture2D(uLedMap, clamp(uv + blur * vec2(0.75, 0.75), 0.0, 1.0)).rgb * 0.11;
      c += texture2D(uLedMap, clamp(uv - blur * vec2(0.75, 0.75), 0.0, 1.0)).rgb * 0.11;
      return c;
    }

    void main() {
      vec4 pools = texture2D(uLocalMap, vFloorUv);
      float r = length(vFloorWorld.xz - uRingCenter) / uRingRadius;
      float ringSoft = exp(-1.55 * r * r);
      float brokenTile = 1.0 - 0.25 *
        (1.0 - smoothstep(0.0, 0.07, fract(vFloorWorld.z / 2.55)));
      float noise = 0.92 + 0.08 * sin(vFloorWorld.x * 8.1 + vFloorWorld.z * 3.7)
        * sin(vFloorWorld.z * 5.1 - vFloorWorld.x * 6.3);
      vec3 reflected = vec3(0.0);

      // Mirror rays still use actual CentralLED position exactly as in E19.
      vec3 ray = reflect(normalize(vFloorWorld - cameraPosition), vec3(0.0, 1.0, 0.0));
      if (ray.z < -0.015) {
        float t = (uLedMax.z - vFloorWorld.z) / ray.z;
        if (t > 0.0) {
          vec3 hit = vFloorWorld + ray * t;
          vec2 uv = (hit.xy - uLedMin.xy) / max(uLedMax.xy - uLedMin.xy, vec2(0.001));
          float mask = smoothstep(0.0, 0.09, uv.x)
            * smoothstep(0.0, 0.09, 1.0 - uv.x)
            * smoothstep(0.0, 0.12, uv.y)
            * smoothstep(0.0, 0.12, 1.0 - uv.y);
          if (mask > 0.0) {
            vec2 blur = mix(vec2(0.014, 0.019), vec2(0.037, 0.048), ringSoft);
            vec3 led = softMirror(uv, blur);
            float bright = smoothstep(0.075, 0.44,
              max(led.r, max(led.g, led.b)));
            float falloff = exp(-0.020 * max(0.0, t - 6.0));
            reflected = led * bright * mask * falloff * brokenTile * noise
              * (1.0 - 0.46 * ringSoft) * 1.25;
          }
        }
      }

      // A diffuse ROUND ring-sized pool fills the dancer zone where the
      // geometric specular ray misses the wall. No X-band / striped wash.
      vec3 ringPool = mix(
        vec3(0.025, 0.13, 0.19),
        vec3(0.19, 0.030, 0.14),
        0.5 + 0.5 * sin(1.6 * vFloorWorld.x)
      ) * ringSoft * brokenTile * 0.36;
      vec3 color = pools.rgb * pools.a * (1.32 + 0.18 * ringSoft)
        + reflected + ringPool;
      gl_FragColor = vec4(color, 0.83 - 0.12 * ringSoft);
      #include <colorspace_fragment>
    }
  `;
  material.needsUpdate = true;
  return material;
}

// E21 uses the *rear physical stage wall / cove* to bridge the vertical
// clearance between actual CentralLED bounds and the upper physical riser.
// Opaque architecture only: no new billboard, poster, alpha/glow plane.
function addE21LedRiserStructuralBridge(
  model: THREE.Object3D,
  fxRoot: THREE.Object3D,
  ledBounds: THREE.Box3,
  noDecorativeLip = false,
) {
  const candidateTops: number[] = [];
  model.traverse(object => {
    const mesh = object as THREE.Mesh;
    if (!mesh.isMesh || !/^(?:Mobile_Risers_|Riser[0-3](?:_|$))/.test(mesh.name)) return;
    const box = new THREE.Box3().setFromObject(mesh);
    if (box.isEmpty()) return;
    // Only structure behind the LED and below its lower edge is relevant.
    if (box.max.y < ledBounds.min.y - 0.04
        && box.max.z < ledBounds.max.z + 2.5
        && box.min.z > ledBounds.min.z - 4.0) candidateTops.push(box.max.y);
  });
  const nearestDeckTop = candidateTops.length > 0
    ? Math.max(...candidateTops) : ledBounds.min.y - 0.90;
  const upperY = ledBounds.min.y + 0.025;
  const lowerY = Math.min(upperY - 0.10,
    Math.max(ledBounds.min.y - 2.45, nearestDeckTop - 0.045));
  const height = upperY - lowerY;
  if (!Number.isFinite(height) || height < 0.10) return;
  const width = ledBounds.max.x - ledBounds.min.x;
  const frontZ = ledBounds.max.z - 0.085;
  const backing = new THREE.Mesh(
    new THREE.BoxGeometry(width * 0.982, height, 0.19),
    new THREE.MeshStandardMaterial({
      name: "NeonE21ArchitecturalLowerCove",
      color: 0x10072f,
      emissive: 0x25094f,
      emissiveIntensity: 0.52,
      roughness: 0.61,
      metalness: 0.22,
    }),
  );
  backing.name = "NeonE21PhysicalLedRiserInfill";
  backing.position.set((ledBounds.min.x + ledBounds.max.x) * 0.5,
    (upperY + lowerY) * 0.5, frontZ);
  fxRoot.add(backing);

  // E21's emissive cove lip + the decorative SVG lower line caused the two
  // magenta bars rejected on the E21 screenshot. E22 keeps the solid lower
  // wall, without the redundant luminous bar.
  if (!noDecorativeLip) {
  const lip = new THREE.Mesh(
    new THREE.BoxGeometry(width * 0.966, 0.035, 0.09),
    new THREE.MeshStandardMaterial({
      name: "NeonE21PhysicalCoveLip",
      color: 0x321355,
      emissive: 0xae20d2,
      emissiveIntensity: 1.45,
      roughness: 0.28,
      metalness: 0.48,
    }),
  );
  lip.name = "NeonE21LedLowerStructuralLip";
  lip.position.set(backing.position.x, ledBounds.min.y - 0.022,
    ledBounds.max.z + 0.008);
  fxRoot.add(lip);
  }
  console.info("[NeonStage E21] Physical LED/riser bridge", {
    topY: upperY, bottomY: lowerY, nearestDeckTop,
    width, frontZ,
  });
}


// E24: extrude lower structure to meet the actual rear riser; no changes to
// the real GLB CentralLED mesh's position, dimensions or logo coordinates.
function extendE24PhysicalCentralLed(
  model: THREE.Object3D,
  fxRoot: THREE.Object3D,
  ledBounds: THREE.Box3,
  ledTexture: THREE.Texture,
  fineContactE25 = false,
) {
  const size = ledBounds.getSize(new THREE.Vector3());
  const candidates: {name: string; y: number}[] = [];
  model.traverse(object => {
    const mesh = object as THREE.Mesh;
    if (!mesh.isMesh || !/^(?:Mobile_Risers_|Riser[0-3](?:_|$))/.test(object.name)) return;
    const b = new THREE.Box3().setFromObject(mesh);
    if (b.isEmpty() || b.max.x - b.min.x < size.x * 0.25) return;
    if (b.max.x <= ledBounds.min.x + size.x * 0.08
      || b.min.x >= ledBounds.max.x - size.x * 0.08) return;
    if (b.max.z >= ledBounds.max.z + 2.5 || b.min.z <= ledBounds.min.z - 4.0) return;
    if (b.max.y >= ledBounds.min.y - 0.02) return;
    candidates.push({name: object.name, y: b.max.y});
  });
  candidates.sort((a, b) => b.y - a.y);
  const support = candidates[0];
  if (!support) {
    console.warn("[NeonStage E24] Cannot find physical rear riser support; no invented extension.");
    return;
  }
  const gap = ledBounds.min.y - support.y;
  if (gap < 0.035 || gap > size.y * 0.50) {
    console.warn("[NeonStage E24] Unsafe measured LED-to-riser gap", {gap, support: support.name});
    return;
  }
  const top = ledBounds.min.y + 0.07;
  // E25: 0.045 units extra overlap with the rear stair, without lowering
  // CentralLED or changing any LED art, fixture, floor or beam coordinates.
  const bottom = support.y - (fineContactE25 ? 0.085 : 0.04);
  const height = top - bottom;
  const material = new THREE.ShaderMaterial({
    name: "NeonE24RecessedPhysicalLowerLED",
    uniforms: {
      uLedMap: {value: ledTexture},
      uMinX: {value: ledBounds.min.x},
      uWidth: {value: Math.max(0.001, size.x)},
      uEdgeY: {value: ledBounds.min.y},
      uFade: {value: Math.min(0.34, Math.max(0.10, height * 0.23))},
    },
    vertexShader: `
      varying vec3 vWorld;
      void main() {
        vec4 world = modelMatrix * vec4(position, 1.0);
        vWorld = world.xyz;
        gl_Position = projectionMatrix * viewMatrix * world;
      }
    `,
    fragmentShader: `
      varying vec3 vWorld;
      uniform sampler2D uLedMap;
      uniform float uMinX;
      uniform float uWidth;
      uniform float uEdgeY;
      uniform float uFade;
      void main() {
        float x = clamp((vWorld.x - uMinX) / uWidth, 0.0, 1.0);
        vec3 bottomColor = texture2D(uLedMap, vec2(x, 0.012)).rgb * 0.42
          + texture2D(uLedMap, vec2(mix(0.5, x, 0.60), 0.016)).rgb * 0.33
          + texture2D(uLedMap, vec2(0.5, 0.016)).rgb * 0.25;
        float d = max(0.0, uEdgeY - vWorld.y);
        float upperBlend = 1.0 - smoothstep(0.0, uFade, d);
        vec3 stageNavy = vec3(0.014, 0.009, 0.045);
        vec3 result = mix(stageNavy, bottomColor * 0.74 + stageNavy * 0.26,
          upperBlend * 0.85);
        gl_FragColor = vec4(result, 1.0);
        #include <colorspace_fragment>
      }
    `,
    side: THREE.DoubleSide,
    depthWrite: true,
    depthTest: true,
    transparent: false,
    toneMapped: false,
  });
  const lowerWall = new THREE.Mesh(
    new THREE.BoxGeometry(size.x * 0.992, height, 0.16), material,
  );
  lowerWall.name = "NeonE24PhysicalLEDLowerExtension";
  lowerWall.position.set(
    (ledBounds.min.x + ledBounds.max.x) * 0.5,
    (top + bottom) * 0.5,
    // Still recessed behind the actual CentralLED front face: with 0.16
    // total depth the E25 front is ledBounds.max.z - 0.008 (never in front).
    ledBounds.max.z - (fineContactE25 ? 0.088 : 0.105),
  );
  fxRoot.add(lowerWall);
  console.info("[NeonStage E24] LED extended without art scaling", {
    riser: support.name, gapBefore: gap, supportTop: support.y,
    originalLedBottom: ledBounds.min.y, newLowerWallBottom: bottom,
    fineContactE25,
  });
}

// E22: one continuous low-frequency gloss field under the whole dance floor.
// The two new world-positioned fixture pools are very broad, not screen-X
// texture samples. E19's wall reflection remains a separate blurred lobe.
function makeE22ContinuousFloorReflectionMaterial(
  localTexture: THREE.Texture,
  ledTexture: THREE.Texture,
  ledBounds: THREE.Box3,
  ringCenter: THREE.Vector2,
  ringRadius: number,
  fixtureLeft: THREE.Vector2,
  fixtureRight: THREE.Vector2,
) {
  const material = makeE19ReflectedWallFloorMaterial(
    localTexture, ledTexture, ledBounds,
  );
  material.name = "NeonE22ContinuousPremiumFloor";
  material.uniforms.uRingCenter = { value: ringCenter.clone() };
  material.uniforms.uRingRadius = { value: Math.max(0.4, ringRadius) };
  material.uniforms.uFixtureLeft = { value: fixtureLeft.clone() };
  material.uniforms.uFixtureRight = { value: fixtureRight.clone() };
  material.fragmentShader = `
    varying vec2 vFloorUv;
    varying vec3 vFloorWorld;
    uniform sampler2D uLocalMap;
    uniform sampler2D uLedMap;
    uniform vec3 uLedMin;
    uniform vec3 uLedMax;
    uniform vec2 uRingCenter;
    uniform float uRingRadius;
    uniform vec2 uFixtureLeft;
    uniform vec2 uFixtureRight;

    vec3 roughLed(vec2 uv, vec2 radius) {
      uv = clamp(uv, vec2(0.0), vec2(1.0));
      vec3 c = texture2D(uLedMap, uv).rgb * 0.12;
      c += texture2D(uLedMap, clamp(uv + vec2( radius.x, 0.0), 0.0, 1.0)).rgb * 0.14;
      c += texture2D(uLedMap, clamp(uv + vec2(-radius.x, 0.0), 0.0, 1.0)).rgb * 0.14;
      c += texture2D(uLedMap, clamp(uv + vec2(0.0,  radius.y), 0.0, 1.0)).rgb * 0.12;
      c += texture2D(uLedMap, clamp(uv + vec2(0.0, -radius.y), 0.0, 1.0)).rgb * 0.12;
      c += texture2D(uLedMap, clamp(uv + radius, 0.0, 1.0)).rgb * 0.12;
      c += texture2D(uLedMap, clamp(uv - radius, 0.0, 1.0)).rgb * 0.12;
      c += texture2D(uLedMap, clamp(uv + radius * vec2(-1.0, 1.0), 0.0, 1.0)).rgb * 0.06;
      c += texture2D(uLedMap, clamp(uv + radius * vec2(1.0, -1.0), 0.0, 1.0)).rgb * 0.06;
      return c;
    }

    void main() {
      vec4 localPools = texture2D(uLocalMap, vFloorUv);
      vec2 p = vFloorWorld.xz;
      float ringDistance = length(p - uRingCenter) / uRingRadius;
      float dancerZone = exp(-0.65 * ringDistance * ringDistance);
      float depth = clamp((p.y + 5.8) / 34.0, 0.0, 1.0);

      // This understated color is present at EVERY floor pixel; no mid-floor
      // cut or broad vertical bars keyed to the LED artwork.
      vec3 continuousBase = mix(
        vec3(0.011, 0.007, 0.020),
        vec3(0.014, 0.009, 0.026),
        smoothstep(0.0, 1.0, depth)
      );
      vec2 left = (p - (uFixtureLeft + vec2(0.0, 4.2))) / vec2(5.5, 10.5);
      vec2 right = (p - (uFixtureRight + vec2(0.0, 4.2))) / vec2(5.5, 10.5);
      float cyanFalloff = exp(-dot(left, left));
      float pinkFalloff = exp(-dot(right, right));
      vec3 scatteredLight = vec3(0.006, 0.032, 0.054) * cyanFalloff
        + vec3(0.044, 0.006, 0.032) * pinkFalloff;

      vec3 reflection = vec3(0.0);
      vec3 ray = reflect(normalize(vFloorWorld - cameraPosition), vec3(0.0, 1.0, 0.0));
      if (ray.z < -0.015) {
        float t = (uLedMax.z - vFloorWorld.z) / ray.z;
        if (t > 0.0) {
          vec3 hit = vFloorWorld + ray * t;
          vec2 uv = (hit.xy - uLedMin.xy) /
            max(uLedMax.xy - uLedMin.xy, vec2(0.001));
          // Reflection softly falls away when the specular ray misses the
          // LED surface, instead of creating a rectangular floor cutoff.
          vec2 outsideUv = max(max(-uv, uv - vec2(1.0)), vec2(0.0));
          float sourceFade = exp(-19.0 * length(outsideUv));
          vec2 blur = mix(vec2(0.025, 0.034), vec2(0.064, 0.076), dancerZone);
          vec3 light = roughLed(uv, blur);
          float emissive = smoothstep(0.075, 0.42,
            max(light.r, max(light.g, light.b)));
          float reach = exp(-0.028 * max(0.0, t - 6.0));
          reflection = light * emissive * sourceFade * reach
            * mix(0.98, 0.39, dancerZone) * 1.07;
        }
      }
      float tile = 1.0 - 0.20 *
        (1.0 - smoothstep(0.0, 0.065, fract(p.y / 2.55)));
      float roughness = 0.95 + 0.05 *
        sin(p.x * 7.9 + p.y * 5.1) * sin(p.y * 8.3 - p.x * 5.7);
      vec3 reflectedPools = localPools.rgb * localPools.a * 1.35;
      vec3 color = (continuousBase + scatteredLight
        + reflectedPools + reflection) * tile * roughness;
      gl_FragColor = vec4(color, 0.83);
      #include <colorspace_fragment>
    }
  `;
  material.needsUpdate = true;
  return material;
}

// E23 keeps the E22 continuous-field architecture but dampens mirrored
// lettering and gives ring/foreground the same low-frequency gloss base.
function makeE23UnifiedFloorMaterial(
  localTexture: THREE.Texture,
  ledTexture: THREE.Texture,
  ledBounds: THREE.Box3,
  ringCenter: THREE.Vector2,
  ringRadius: number,
  fixtureLeft: THREE.Vector2,
  fixtureRight: THREE.Vector2,
) {
  const material = makeE22ContinuousFloorReflectionMaterial(
    localTexture, ledTexture, ledBounds, ringCenter, ringRadius,
    fixtureLeft, fixtureRight,
  );
  material.name = "NeonE23UnifiedSoftFloor";
  // Alter only E23's isolated shader variant; E22 remains byte-for-byte
  // in its own compare mode. Preserve dark polished tile seams.
  material.fragmentShader = material.fragmentShader
    .replace(
      "vec3(0.011, 0.007, 0.020)",
      "vec3(0.017, 0.010, 0.029)",
    )
    .replace(
      "vec3(0.014, 0.009, 0.026)",
      "vec3(0.018, 0.011, 0.031)",
    )
    .replace(
      "float sourceFade = exp(-19.0 * length(outsideUv));",
      "float sourceFade = exp(-8.5 * length(outsideUv));",
    )
    .replace(
      "vec2(0.025, 0.034), vec2(0.064, 0.076)",
      "vec2(0.040, 0.054), vec2(0.079, 0.090)",
    )
    .replace(
      "* mix(0.98, 0.39, dancerZone) * 1.07;",
      "* mix(0.62, 0.35, dancerZone) * 0.85;",
    )
    .replace(
      "vec3 reflectedPools = localPools.rgb * localPools.a * 1.35;",
      "vec3 reflectedPools = localPools.rgb * localPools.a * 1.15;",
    );
  material.needsUpdate = true;
  return material;
}

// E24 keeps the single E23 reflection field but uses a nearly uniform
// dark-gloss floor base, with broad low-frequency lighting everywhere.
function makeE24WholeFloorMaterial(
  localTexture: THREE.Texture,
  ledTexture: THREE.Texture,
  bounds: THREE.Box3,
  ringCenter: THREE.Vector2,
  ringRadius: number,
  fixtureLeft: THREE.Vector2,
  fixtureRight: THREE.Vector2,
) {
  const material = makeE23UnifiedFloorMaterial(
    localTexture, ledTexture, bounds, ringCenter, ringRadius,
    fixtureLeft, fixtureRight,
  );
  material.name = "NeonE24ContinuousSoftFloor";
  material.fragmentShader = material.fragmentShader
    .replace("vec3(0.017, 0.010, 0.029)", "vec3(0.022, 0.014, 0.036)")
    .replace("vec3(0.018, 0.011, 0.031)", "vec3(0.023, 0.014, 0.036)")
    .replace("float sourceFade = exp(-8.5 * length(outsideUv));",
      "float sourceFade = exp(-6.0 * length(outsideUv));")
    .replace("vec2(0.040, 0.054), vec2(0.079, 0.090)",
      "vec2(0.071, 0.088), vec2(0.105, 0.122)")
    .replace("* mix(0.62, 0.35, dancerZone) * 0.85;",
      "* mix(0.41, 0.28, dancerZone) * 0.78;")
    .replace("vec3 reflectedPools = localPools.rgb * localPools.a * 1.15;",
      "vec3 reflectedPools = localPools.rgb * localPools.a * 1.10;")
    .replace("vec3 color = (continuousBase + scatteredLight",
      `vec3 uniformBounce = vec3(0.010, 0.005, 0.018)
        * (0.98 + 0.02 * cos(p.y * 0.15));
      vec3 color = (continuousBase + uniformBounce + scatteredLight`);
  material.needsUpdate = true;
  return material;
}

// E27: increase the physically registered reflected light across ONE floor
// surface, retaining the E24 rough specular map and falloff instead of
// adding poster-like mirrored planes or E20's vertical stripe wash.
function makeE27GlossyContinuousFloorMaterial(
  localTexture: THREE.Texture,
  ledTexture: THREE.Texture,
  bounds: THREE.Box3,
  ringCenter: THREE.Vector2,
  ringRadius: number,
  fixtureLeft: THREE.Vector2,
  fixtureRight: THREE.Vector2,
) {
  const material = makeE24WholeFloorMaterial(
    localTexture, ledTexture, bounds, ringCenter, ringRadius,
    fixtureLeft, fixtureRight,
  );
  material.name = "NeonE27GlossyContinuousFloor";
  const substitutions: Array<[string,string]> = [
    ["vec3(0.022, 0.014, 0.036)", "vec3(0.028, 0.019, 0.045)"],
    ["vec3(0.023, 0.014, 0.036)", "vec3(0.029, 0.020, 0.046)"],
    ["float sourceFade = exp(-6.0 * length(outsideUv));",
     "float sourceFade = exp(-4.4 * length(outsideUv));"],
    ["vec2(0.071, 0.088), vec2(0.105, 0.122)",
     "vec2(0.056, 0.073), vec2(0.091, 0.109)"],
    ["* mix(0.41, 0.28, dancerZone) * 0.78;",
     "* mix(0.61, 0.41, dancerZone) * 0.96;"],
    ["vec3 reflectedPools = localPools.rgb * localPools.a * 1.10;",
     "vec3 reflectedPools = localPools.rgb * localPools.a * 1.31;"],
    ["vec3 uniformBounce = vec3(0.010, 0.005, 0.018)",
     "vec3 uniformBounce = vec3(0.014, 0.009, 0.023)"],
    ["float tile = 1.0 - 0.20 *", "float tile = 1.0 - 0.13 *"],
    ["gl_FragColor = vec4(color, 0.83);",
     "gl_FragColor = vec4(color, 0.90);"],
  ];
  for (const [before, after] of substitutions) {
    if (!material.fragmentShader.includes(before)) {
      throw new Error("E27 floor shader source changed unexpectedly: " + before);
    }
    material.fragmentShader = material.fragmentShader.replace(before, after);
  }
  material.needsUpdate = true;
  return material;
}

// E28: soften the physically correct LED mirror lobe that concentrates
// magenta into a SINGLE horizontal tile band. Redistribute a small part
// of its energy as smooth, low-frequency LED bounce over the whole floor.
// This reuses E27's ONE floor shader + GLB tile geometry (no new planes).
function makeE28ContinuousPolishedFloorMaterial(
  localTexture: THREE.Texture,
  ledTexture: THREE.Texture,
  bounds: THREE.Box3,
  ringCenter: THREE.Vector2,
  ringRadius: number,
  fixtureLeft: THREE.Vector2,
  fixtureRight: THREE.Vector2,
) {
  const material = makeE27GlossyContinuousFloorMaterial(
    localTexture, ledTexture, bounds, ringCenter, ringRadius,
    fixtureLeft, fixtureRight,
  );
  material.name = "NeonE28PolishedUniformFloor";
  const changes: Array<[string, string]> = [
    // Less single-band specular from reflected letter strokes; more roughness.
    ["float sourceFade = exp(-4.4 * length(outsideUv));",
     "float sourceFade = exp(-3.65 * length(outsideUv));"],
    ["vec2(0.056, 0.073), vec2(0.091, 0.109)",
     "vec2(0.077, 0.095), vec2(0.118, 0.137)"],
    ["* mix(0.61, 0.41, dancerZone) * 0.96;",
     "* mix(0.42, 0.32, dancerZone) * 0.84;"],
    // Keep local source pools distinct but spread their apparent glow.
    ["vec3 reflectedPools = localPools.rgb * localPools.a * 1.31;",
     "vec3 reflectedPools = localPools.rgb * localPools.a * 1.39;"],
    ["float tile = 1.0 - 0.13 *",
     "float tile = 1.0 - 0.105 *"],
    // Sample fixed low-frequency light colors from the authored LED, rather
    // than mapping image columns to floor X (E20's stripe failure).
    ["vec3 color = (continuousBase + uniformBounce + scatteredLight",
     `vec3 wallEnergy = (
        texture2D(uLedMap, vec2(0.18, 0.44)).rgb
        + texture2D(uLedMap, vec2(0.38, 0.57)).rgb
        + texture2D(uLedMap, vec2(0.62, 0.57)).rgb
        + texture2D(uLedMap, vec2(0.82, 0.44)).rgb
      ) * 0.25;
      // One smooth base applies from the ring through the foreground.
      // No horizontal thresholds, image-derived strips or extra layers.
      vec3 diffuseGloss = wallEnergy * 0.083
        * (0.92 + 0.08 * smoothstep(0.0, 26.0, p.y + 4.0));
      vec3 color = (continuousBase + uniformBounce
        + diffuseGloss + scatteredLight`],
    ["gl_FragColor = vec4(color, 0.90);",
     "gl_FragColor = vec4(color, 0.92);"],
  ];
  for (const [before, after] of changes) {
    if (!material.fragmentShader.includes(before)) {
      throw new Error("E28 floor shader source unexpected: " + before);
    }
    material.fragmentShader = material.fragmentShader.replace(before, after);
  }
  material.needsUpdate = true;
  return material;
}

// E29: E28's fixed four-sample wallEnergy/diffuseGloss painted saturated
// magenta over every floor pixel. DO NOT build on that shader. Restore the
// accepted E27 ray-registered rough reflection, cool the floor's low-frequency
// substrate, and keep only LOCAL fixture/specular highlights. No additional
// floor layers, purple wash, or horizontally sampled LED image bands.
function makeE29BalancedDarkGlossFloorMaterial(
  localTexture: THREE.Texture,
  ledTexture: THREE.Texture,
  bounds: THREE.Box3,
  ringCenter: THREE.Vector2,
  ringRadius: number,
  fixtureLeft: THREE.Vector2,
  fixtureRight: THREE.Vector2,
) {
  const material = makeE27GlossyContinuousFloorMaterial(
    localTexture, ledTexture, bounds, ringCenter, ringRadius,
    fixtureLeft, fixtureRight,
  );
  material.name = "NeonE29BalancedDarkGlossFloor";
  const revisions: Array<[string, string]> = [
    // Preserve dark navy tiles instead of a uniform purple substrate.
    ["vec3(0.028, 0.019, 0.045)", "vec3(0.016, 0.018, 0.030)"],
    ["vec3(0.029, 0.020, 0.046)", "vec3(0.018, 0.020, 0.033)"],
    ["vec3 uniformBounce = vec3(0.014, 0.009, 0.023)",
     "vec3 uniformBounce = vec3(0.005, 0.007, 0.011)"],
    // Stronger local lamp reflections, NOT uniform LED-colored illumination.
    ["vec3 reflectedPools = localPools.rgb * localPools.a * 1.31;",
     "vec3 reflectedPools = localPools.rgb * localPools.a * 1.43;"],
    // Retain the rough mirrored artwork but prevent a readable text band.
    ["* mix(0.61, 0.41, dancerZone) * 0.96;",
     "* mix(0.57, 0.40, dancerZone) * 0.93;"],
    ["gl_FragColor = vec4(color, 0.90);",
     "gl_FragColor = vec4(color, 0.87);"],
  ];
  for (const [before, after] of revisions) {
    if (!material.fragmentShader.includes(before)) {
      throw new Error("E29 floor shader source changed: " + before);
    }
    material.fragmentShader = material.fragmentShader.replace(before, after);
  }
  // Guard against the rejected E28 full-floor violet contamination.
  if (material.fragmentShader.includes("diffuseGloss")
    || material.fragmentShader.includes("wallEnergy")) {
    throw new Error("Rejected E28 wall-color wash leaked into E29.");
  }
  material.needsUpdate = true;
  return material;
}

// E22 swivelling architectural lower fixture. Unlike the E20 box-on-riser
// mounts, the body has an axis pin, U-yoke, tilt barrel and inset glass lens.
// All dimensions are derived from EACH real GLB fixture's bounds. Use only
// with E22; the original imported actor/fixture meshes remain in place.
function addE22SwivelUplightHousings(
  fxRoot: THREE.Object3D,
  model: THREE.Object3D,
  fixtureBounds: Map<string, THREE.Box3>,
  slightlyLarger = false,
) {
  const housing = new THREE.MeshStandardMaterial({
    name: "NeonE22FixtureHousingBlackAlloy",
    color: 0x17192c, metalness: 0.68, roughness: 0.31,
  });
  const trim = new THREE.MeshStandardMaterial({
    name: "NeonE22FixturePivotTrim",
    color: 0x41415f, metalness: 0.78, roughness: 0.24,
  });
  const lensCyan = new THREE.MeshBasicMaterial({
    name: "NeonE22CyanOptic", color: 0x8df5ff, toneMapped: false,
  });
  const lensPink = new THREE.MeshBasicMaterial({
    name: "NeonE22MagentaOptic", color: 0xff8fe8, toneMapped: false,
  });
  const supports: THREE.Box3[] = [];
  model.traverse(object => {
    const mesh = object as THREE.Mesh;
    if (!mesh.isMesh || !/^(?:Mobile_Risers_|Riser[0-3](?:_|$)|PolishedDanceFloor)/.test(mesh.name)) return;
    const box = new THREE.Box3().setFromObject(mesh);
    if (!box.isEmpty()) supports.push(box);
  });
  const barrelGeometry = new THREE.CylinderGeometry(0.15, 0.17, 0.26, 16);
  const lensGeometry = new THREE.CircleGeometry(0.118, 20);
  const pivotGeometry = new THREE.CylinderGeometry(0.048, 0.048, 0.08, 12);
  const indexKeys = [...fixtureBounds.entries()]
    .sort(([a], [b]) => a.localeCompare(b));
  indexKeys.forEach(([key, bounds], index) => {
    const center = bounds.getCenter(new THREE.Vector3());
    const size = bounds.getSize(new THREE.Vector3());
    let deckY = bounds.min.y - 0.08;
    for (const support of supports) {
      if (center.x < support.min.x || center.x > support.max.x
        || center.z < support.min.z || center.z > support.max.z) continue;
      if (support.max.y <= bounds.min.y + 0.015 && support.max.y > deckY) {
        deckY = support.max.y;
      }
    }
    deckY = THREE.MathUtils.clamp(deckY, bounds.min.y - 0.28, bounds.min.y);
    const scale = THREE.MathUtils.clamp(
      Math.min(size.x, size.y) * (slightlyLarger ? 0.75 : 0.64),
      slightlyLarger ? 0.72 : 0.62, slightlyLarger ? 1.26 : 1.15,
    );
    const unit = new THREE.Group();
    unit.name = key + "_E22SwivelHousing";
    unit.position.set(center.x, deckY, bounds.max.z - Math.min(0.16, size.z * 0.24));
    unit.scale.setScalar(scale);
    const pad = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.085, 0.50), housing);
    pad.name = "Footing";
    pad.position.y = 0.044;
    unit.add(pad);
    const turntable = new THREE.Mesh(new THREE.CylinderGeometry(0.21, 0.24, 0.12, 18), trim);
    turntable.name = "SwivelAxisBase";
    turntable.position.y = 0.13;
    unit.add(turntable);
    const height = Math.max(0.37, (center.y - deckY) / scale);
    for (const sign of [-1, 1]) {
      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.055, height * 0.54, 0.10), trim);
      arm.name = sign < 0 ? "TiltYokeLeft" : "TiltYokeRight";
      arm.position.set(sign * 0.19, height * 0.52, 0);
      unit.add(arm);
      const pivot = new THREE.Mesh(pivotGeometry, housing);
      pivot.name = sign < 0 ? "LeftGimbalPin" : "RightGimbalPin";
      pivot.rotation.z = Math.PI / 2;
      pivot.position.set(sign * 0.205, height * 0.75, 0);
      unit.add(pivot);
    }
    const head = new THREE.Group();
    head.name = "TiltingLuminaireHead";
    head.position.y = height * 0.75;
    head.rotation.x = 0.16;
    const body = new THREE.Mesh(barrelGeometry, housing);
    body.name = "OpticalBarrel";
    body.rotation.x = Math.PI / 2;
    head.add(body);
    const glass = new THREE.Mesh(lensGeometry, index % 2 ? lensCyan : lensPink);
    glass.name = "InsetLens";
    glass.position.z = 0.138;
    head.add(glass);
    unit.add(head);
    fxRoot.add(unit);
  });
}

function makeAcceptedFloorGridTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("R15.1 floor-grid canvas unavailable.");

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Golden floor language: dark tile seams establish perspective/depth, with
  // a very small cyan/magenta edge catch from the surrounding stage lights.
  // The floor plane supplies the real perspective so this stays one cheap
  // texture instead of extra geometry.
  const drawSeam = (
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    accent: string,
    major: boolean,
  ) => {
    ctx.lineWidth = major ? 2.2 : 1.6;
    ctx.strokeStyle = major
      ? "rgba(3,4,26,0.88)"
      : "rgba(7,8,38,0.74)";
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();

    ctx.lineWidth = 0.65;
    ctx.strokeStyle = accent;
    ctx.beginPath();
    ctx.moveTo(x1 + 0.75, y1 + 0.75);
    ctx.lineTo(x2 + 0.75, y2 + 0.75);
    ctx.stroke();
  };

  for (let index = 1; index < 10; index += 1) {
    const x = (index / 10) * canvas.width;
    drawSeam(
      x,
      0,
      x,
      canvas.height,
      index % 2 === 0
        ? "rgba(28,196,255,0.24)"
        : "rgba(178,49,255,0.20)",
      index === 5,
    );
  }

  for (let index = 1; index < 13; index += 1) {
    const y = (index / 13) * canvas.height;
    drawSeam(
      0,
      y,
      canvas.width,
      y,
      index % 3 === 0
        ? "rgba(255,28,200,0.22)"
        : "rgba(44,86,220,0.17)",
      index % 4 === 0,
    );
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.needsUpdate = true;
  return texture;
}

function makeAcceptedBackdropGlowTexture() {
  const hiResCompare = useHiResLedCompare() || useAcceptedNeonE29RuntimePresentation();
  const typographyV16Compare = useTypographyV16LedCompare();
  const physicalRepairE21 = usePhysicalRepairE21Compare();
  const physicalFidelityE22 = usePhysicalFidelityE22Compare();
  const physicalAlignmentE23 = usePhysicalAlignmentE23Compare();
  const physicalExtensionE24 = usePhysicalExtensionE24Compare();
  const physicalGlossE28 = usePhysicalGlossE28Compare();
  const physicalFloorBalanceE29 =
    usePhysicalFloorBalanceE29Compare() || useAcceptedNeonE29RuntimePresentation();
  const physicalCleanupE27 = usePhysicalCleanupE27Compare();
  const texture = new THREE.TextureLoader().load(
    physicalFloorBalanceE29 ? ARTWORK_E28_ASSET_URL
      : physicalGlossE28 ? ARTWORK_E28_ASSET_URL
      : physicalCleanupE27 ? ARTWORK_E27_ASSET_URL
      : physicalExtensionE24 ? BALANCED_E23_ASSET_URL
      : physicalAlignmentE23 ? BALANCED_E23_ASSET_URL
      : physicalFidelityE22 ? CLEAN_BASE_E22_ASSET_URL
      : physicalRepairE21 ? CROWN_CLEARANCE_E21_ASSET_URL : typographyV16Compare
      ? TYPOGRAPHY_V16_COMPARE_ASSET_URL
      : hiResCompare ? VECTOR_LED_ASSET_URL : CONCEPT_LED_ASSET_URL,
  );
  texture.colorSpace = THREE.SRGBColorSpace;
  // 512x191 WebP is source-resolution limited; no mip smoothing in legacy mode.
  // The authored 2048x844 SVG is vector at source and rasterized once by the
  // browser at its intrinsic resolution, with mipmaps for distance sampling.
  texture.generateMipmaps = hiResCompare;
  texture.minFilter = hiResCompare
    ? THREE.LinearMipmapLinearFilter
    : THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.anisotropy = 8;
  texture.userData.ledSamplingSize = hiResCompare
    ? new THREE.Vector2(2048, 844)
    : new THREE.Vector2(512, 191);
  texture.userData.ledSharpness = hiResCompare ? 0.0 : 0.40;
  texture.needsUpdate = true;
  return texture;
}

function makePhysicalCentralLedMaterial(texture: THREE.Texture, bounds: THREE.Box3, fullSurface: boolean) {
  // Registered to the actual imported surface, independent of glTF UV seams.
  // Reuse the calibrated V16 source-color shader without a second plane.
  const material = makeAcceptedBackdropMaterial(texture, false);
  const span = bounds.getSize(new THREE.Vector3());
  material.name = fullSurface ? "NeonE19FullSurfaceCentralLed" : "NeonE18PhysicalCentralLed";
  if (fullSurface) {
    // The nested 0.936x0.847 V14 art mask made even the REAL glTF LED read
    // as a poster inside a rectangular panel. Apply V16 to the entire surface.
    material.uniforms.uPhysicalFullSurface = { value: 1 };
    material.fragmentShader = material.fragmentShader
      .replace(
        "uniform float uIntegrated;",
        "uniform float uIntegrated;" + String.fromCharCode(10) +
          "uniform float uPhysicalFullSurface;",
      )
      .replace(
        "vec2 artUv = (vUv - artMin) / artSize;",
        `vec2 artUv = (vUv - artMin) / artSize;
        if (uPhysicalFullSurface > 0.5) {
          gl_FragColor = vec4(modulateNeonEmitters(sampleCrispLed(vUv)), 1.0);
          #include <colorspace_fragment>
          return;
        }`,
      );
  }
  material.depthWrite = true;
  material.uniforms.uWorldMin = { value: bounds.min.clone() };
  material.uniforms.uWorldSize = {
    value: new THREE.Vector2(Math.max(0.001, span.x), Math.max(0.001, span.y)),
  };
  material.vertexShader = `
    varying vec2 vUv;
    uniform vec3 uWorldMin;
    uniform vec2 uWorldSize;
    void main() {
      vec4 world = modelMatrix * vec4(position, 1.0);
      vUv = (world.xy - uWorldMin.xy) / uWorldSize;
      gl_Position = projectionMatrix * viewMatrix * world;
    }
  `;
  material.needsUpdate = true;
  return material;
}

function makeAcceptedBackdropMaterial(texture: THREE.Texture, integrated: boolean) {
  return new THREE.ShaderMaterial({
    name: "R15AcceptedUnifiedBackdropMaterial",
    transparent: false,
    depthWrite: false,
    depthTest: true,
    side: THREE.DoubleSide,
    toneMapped: false,
    uniforms: {
      uMap: { value: texture },
      // Neutral baseline 1.0 is byte-identical to the owner-accepted E29.
      uNeonBreath: { value: 1.0 },
      // Sample in source texels, not CSS pixels: 2048x844 for vector trial,
      // 512x191 for the existing owner baseline.
      uTexelSize: { value: new THREE.Vector2(
        1 / (texture.userData.ledSamplingSize as THREE.Vector2).x,
        1 / (texture.userData.ledSamplingSize as THREE.Vector2).y,
      ) },
      uSharpness: { value: texture.userData.ledSharpness as number },
      uIntegrated: { value: integrated ? 1.0 : 0.0 },
    },
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      varying vec2 vUv;
      uniform sampler2D uMap;
      uniform vec2 uTexelSize;
      uniform float uSharpness;
      uniform float uIntegrated;
      uniform float uNeonBreath;

      vec3 modulateNeonEmitters(vec3 color) {
        // React only to saturated cyan/magenta emitters, NOT the dark
        // backdrop, white text cores or gold crown. Maintain crisp glyphs.
        float high = max(color.r, max(color.g, color.b));
        float magenta = smoothstep(0.07, 0.24, color.r - color.g)
          * smoothstep(0.035, 0.14, color.b - color.g);
        float cyan = smoothstep(0.06, 0.25, color.g - color.r)
          * smoothstep(0.055, 0.22, color.b - color.r);
        float mask = max(magenta, cyan)
          * smoothstep(0.16, 0.54, high);
        return color * mix(1.0, uNeonBreath, mask);
      }

      vec3 sampleCrispLed(vec2 uv) {
        vec2 p = clamp(uv, vec2(0.0), vec2(1.0));
        vec3 center = texture2D(uMap, p).rgb;
        // A vector source has clean inner strokes already. Avoid inventing
        // ringing halos by post-sharpening it.
        if (uSharpness < 0.001) return center;
        vec3 neighbors = (
          texture2D(uMap, clamp(p + vec2(uTexelSize.x, 0.0), 0.0, 1.0)).rgb +
          texture2D(uMap, clamp(p - vec2(uTexelSize.x, 0.0), 0.0, 1.0)).rgb +
          texture2D(uMap, clamp(p + vec2(0.0, uTexelSize.y), 0.0, 1.0)).rgb +
          texture2D(uMap, clamp(p - vec2(0.0, uTexelSize.y), 0.0, 1.0)).rgb
        ) * 0.25;
        vec3 detail = center - neighbors;
        // Conservative local sharpening: preserve the concept's authored
        // soft halo, recover inner-line/letter boundaries without white halos.
        return clamp(center + detail * uSharpness, 0.0, 1.0);
      }

      float rectMask(vec2 p, vec2 center, vec2 size, float feather) {
        vec2 d = abs(p - center) - size * 0.5;
        float edge = max(d.x, d.y);
        return 1.0 - smoothstep(-feather, feather, edge);
      }

      void main() {
        // Physical wall is 1.10x the CentralLED height. Keep the golden artwork
        // at the measured 0.9316 scale inside that wall, with the residual
        // +0.94% X / +6% Y registration baked into the artwork center.
        vec2 artCenter = vec2(0.50945, 0.49091);
        vec2 artSize = vec2(0.93628, 0.84691);
        vec2 artMin = artCenter - artSize * 0.5;
        vec2 artUv = (vUv - artMin) / artSize;

        // Authored deep-violet continuation outside the artwork. This is a
        // generated LED-wall support field, not stretched edge pixels.
        float vertical = smoothstep(0.0, 1.0, vUv.y);
        vec3 bg = mix(
          vec3(0.040, 0.010, 0.115),
          vec3(0.105, 0.020, 0.220),
          0.55 + 0.25 * vertical
        );
        float centerGlow = exp(
          -pow((vUv.x - 0.5) / 0.34, 2.0)
          -pow((vUv.y - 0.46) / 0.58, 2.0)
        );
        float cyanGlow = exp(
          -pow((vUv.x - 0.16) / 0.22, 2.0)
          -pow((vUv.y - 0.45) / 0.62, 2.0)
        );
        float magentaGlow = exp(
          -pow((vUv.x - 0.84) / 0.22, 2.0)
          -pow((vUv.y - 0.45) / 0.62, 2.0)
        );
        bg += vec3(0.080, 0.000, 0.090) * centerGlow;
        bg += vec3(0.000, 0.050, 0.085) * cyanGlow;
        bg += vec3(0.075, 0.000, 0.060) * magentaGlow;

        // This texture already contains the sketch's magenta/pink/gold
        // treatments. Do not re-grade or square its highlights: the old
        // treatment clipped neon cores into soft, smeared ribbons.
        vec3 art = sampleCrispLed(artUv);
        float mask = rectMask(vUv, artCenter, artSize, 0.010);
        if (uIntegrated > 0.5) {
          // V14 authored image coordinates remain fixed: soften only the
          // bounded perimeter, not logo/crown/chevrons in the LED interior.
          // There is no hard rectangular alpha seam defining a "poster".
          float edgeX = smoothstep(0.0, 0.065, artUv.x)
            * smoothstep(0.0, 0.065, 1.0 - artUv.x);
          float edgeY = smoothstep(0.0, 0.12, artUv.y)
            * smoothstep(0.0, 0.12, 1.0 - artUv.y);
          // The outer chevrons reach close to the authored panel edge.
          // Preserve bright LED emitters while feathering dark wall pixels,
          // otherwise the anti-poster treatment dims the neon lines.
          float emitter = smoothstep(0.34, 0.72, max(art.r, max(art.g, art.b)));
          mask = max(edgeX * edgeY,
            0.94 * emitter * rectMask(vUv, artCenter, artSize, 0.010));
          // Physical LED diode modulation applies ONLY to background level,
          // retaining the high-frequency wordmark cores unblurred.
          float diode = 0.975 + 0.025 * cos(artUv.x * 2048.0 * 0.65)
            * cos(artUv.y * 844.0 * 0.65);
          float lowLight = 1.0 - smoothstep(0.17, 0.53, max(art.r, max(art.g, art.b)));
          art *= 1.0 - (1.0 - diode) * lowLight;
        }
        vec3 color = mix(bg, modulateNeonEmitters(art), mask);

        // Subtle matrix grain in the generated continuation makes it read as
        // the same LED surface instead of a flat filler strip.
        float gridX = step(0.94, fract(vUv.x * 92.0));
        float gridY = step(0.94, fract(vUv.y * 46.0));
        color += vec3(0.10, 0.02, 0.14) * gridX * gridY * (1.0 - mask) * 0.20;

        gl_FragColor = vec4(color, 1.0);
        // SRGB textures are sampled in linear light. ShaderMaterial does NOT
        // append output conversion automatically; without this, the LED was
        // displayed in the wrong color space and subsequent overbright tweaks
        // compensated in the wrong domain.
        #include <colorspace_fragment>
      }
    `,
  });
}

function offsetObjectWorldY(object: THREE.Object3D, deltaY: number) {
  const parent = object.parent;
  if (!parent) {
    object.position.y += deltaY;
    return;
  }

  object.updateWorldMatrix(true, false);
  parent.updateWorldMatrix(true, false);
  const worldPosition = object.getWorldPosition(new THREE.Vector3());
  worldPosition.y += deltaY;
  object.position.copy(parent.worldToLocal(worldPosition));
}

function offsetMatchingRootsWorldY(
  model: THREE.Object3D,
  matches: (object: THREE.Object3D) => boolean,
  deltaY: number,
) {
  const matching = new Set<THREE.Object3D>();
  model.traverse(object => {
    if (matches(object)) matching.add(object);
  });

  [...matching].forEach(object => {
    let ancestor = object.parent;
    while (ancestor && ancestor !== model) {
      if (matching.has(ancestor)) return;
      ancestor = ancestor.parent;
    }
    offsetObjectWorldY(object, deltaY);
  });

  model.updateMatrixWorld(true);
}

function applyGoldenVerticalRegistration(model: THREE.Object3D) {
  // Registered from the owner's 22:16 compare capture at canonical portrait
  // size. Horizontal-edge correlation showed three independent residuals:
  // truss ≈ 51 px too low, golden LED ≈ 35 px too low, risers ≈ 50 px too high.
  // Convert those screen deltas to rear-stage world units instead of trying to
  // solve incompatible anchors with another global camera adjustment.
  // 2026-10-06 registered-overlay correction: restore the last owner-positive
  // A710 visual baseline, then adjust only the remaining truss residual.
  // LED, risers, ring and floor stay frozen in this pass.
  const trussWorldYOffset = 0.21;
  const ledWorldYOffset = 0.50;
  const riserWorldYOffset = -0.68;

  offsetMatchingRootsWorldY(
    model,
    object => {
      const name = object.name;
      return /truss/i.test(name) || /^MainFixture_\d+/.test(name);
    },
    trussWorldYOffset,
  );

  const centralLed = model.getObjectByName("CentralLED");
  if (centralLed) {
    offsetObjectWorldY(centralLed, ledWorldYOffset);
    model.updateMatrixWorld(true);
  }

  offsetMatchingRootsWorldY(
    model,
    object => {
      const name = object.name;
      const mesh = object as THREE.Mesh;
      const materialNames = mesh.isMesh
        ? (Array.isArray(mesh.material) ? mesh.material : [mesh.material])
          .filter(Boolean)
          .map(material => material.name.toLowerCase())
        : [];
      return (
        /^Mobile_Risers_/.test(name)
        || /^Riser[0-3](?:_|$)/.test(name)
        || /^(DeckUplight|FloorUplight)_\d+/.test(name)
        || materialNames.some(materialName => materialName.includes("riser polished top"))
      );
    },
    riserWorldYOffset,
  );
}

// E27: remove only two narrow *physical* LED header/base crossbars.
// The owner's E26 close-up shows their overlap with the neon. Do NOT remove
// truss, stair/riser trims, side rails, fixtures, or broad wall panels.
// This is GLB-world-bounds-based, not a screen-space crop/overlay.
function hideE27LedCrossbars(model: THREE.Object3D) {
  const led = model.getObjectByName("CentralLED");
  if (!led) return;
  model.updateMatrixWorld(true);
  const ledBox = new THREE.Box3().setFromObject(led);
  if (ledBox.isEmpty()) return;
  const size = ledBox.getSize(new THREE.Vector3());
  const mid = ledBox.getCenter(new THREE.Vector3());
  const hidden: string[] = [];
  const candidates: {name: string; edge: string; dy: number}[] = [];
  model.traverse(object => {
    const mesh = object as THREE.Mesh;
    if (!mesh.isMesh || mesh === led || !mesh.visible) return;
    // Never modify stage hardware or any other component outside LED frame.
    if (/(?:truss|riser|stair|floor|rail|ring|fixture|uplight|beam|optic|crown|logo)/i.test(mesh.name)) return;
    const bounds = new THREE.Box3().setFromObject(mesh);
    if (bounds.isEmpty()) return;
    const span = bounds.getSize(new THREE.Vector3());
    const center = bounds.getCenter(new THREE.Vector3());
    if (span.x < size.x * 0.58 || span.x > size.x * 1.45) return;
    if (span.y > Math.min(0.45, size.y * 0.105) || span.y < 0.003) return;
    if (Math.abs(center.x - mid.x) > size.x * 0.12) return;
    if (Math.abs(center.z - ledBox.max.z) > 0.90) return;
    const topDistance = Math.abs(center.y - ledBox.max.y);
    const bottomDistance = Math.abs(center.y - ledBox.min.y);
    const nearTop = topDistance <= size.y * 0.21;
    const nearBottom = bottomDistance <= size.y * 0.23;
    if (!nearTop && !nearBottom) return;
    const matNames = (Array.isArray(mesh.material) ? mesh.material : [mesh.material])
      .filter(Boolean).map(mat => mat.name);
    const identity = [mesh.name, ...matNames].join(" ").toLowerCase();
    if (!/(?:led|wall|backdrop|frame|border|header|crossbar|topbar|bottombar|fascia|trim|architecture)/.test(identity)) return;
    const edge = nearTop && (!nearBottom || topDistance < bottomDistance) ? "top" : "bottom";
    candidates.push({name: mesh.name, edge, dy: edge === "top" ? topDistance : bottomDistance});
    mesh.visible = false;
    hidden.push(mesh.name);
  });
  console.info("[NeonStage E27] Physical LED crossbar removal", {
    hidden, candidates, bounds: {min: ledBox.min.toArray(), max: ledBox.max.toArray()},
  });
}

// E26: E25's lower-wall overlap did not address the TOP LED/frame registration.
// Translate the real CentralLED only a small, bounded world-space amount.
// This is not E23's much larger riser-to-LED alignment and NEVER scales artwork.
function lowerE26CentralLedWithinHeader(model: THREE.Object3D) {
  const led = model.getObjectByName("CentralLED");
  if (!led) {
    console.warn("[NeonStage E26] CentralLED missing; skip registration.");
    return;
  }
  model.updateMatrixWorld(true);
  const before = new THREE.Box3().setFromObject(led);
  const size = before.getSize(new THREE.Vector3());
  if (before.isEmpty() || !Number.isFinite(size.y) || size.y <= 0) {
    console.warn("[NeonStage E26] Invalid CentralLED world bounds; skip registration.");
    return;
  }
  // Small compared with the already accepted +0.50 registered LED offset.
  // Up to 0.16 stage units (about a third of that original offset) protects
  // lower chevron endpoints from the heavy descent seen in rejected E23.
  const descent = Math.min(0.16, size.y * 0.035);
  offsetObjectWorldY(led, -descent);
  model.updateMatrixWorld(true);
  const after = new THREE.Box3().setFromObject(led);
  console.info("[NeonStage E26] Subtle whole LED/frame clearance", {
    descent, topBefore: before.max.y, topAfter: after.max.y,
    bottomBefore: before.min.y, bottomAfter: after.min.y,
    heightBefore: size.y, heightAfter: after.getSize(new THREE.Vector3()).y,
  });
}

// E23: close the verified physical LED-to-rear-riser clearance by translating
// (not scaling/stretching) CentralLED. All support geometry comes from the GLB.
// Neither the camera nor global stage positions nor gameplay are affected.
function alignE23LedBottomToRearRiser(model: THREE.Object3D) {
  const led = model.getObjectByName("CentralLED");
  if (!led) return;
  model.updateMatrixWorld(true);
  const ledBox = new THREE.Box3().setFromObject(led);
  if (ledBox.isEmpty()) return;
  const ledWidth = ledBox.max.x - ledBox.min.x;
  const ledHeight = ledBox.max.y - ledBox.min.y;
  let rearRiserTop = Number.NEGATIVE_INFINITY;
  let selectedRiser = "";
  model.traverse(object => {
    const mesh = object as THREE.Mesh;
    if (!mesh.isMesh || !/^(?:Mobile_Risers_|Riser[0-3](?:_|$))/.test(object.name)) return;
    const box = new THREE.Box3().setFromObject(mesh);
    if (box.isEmpty() || box.max.x - box.min.x < ledWidth * 0.18) return;
    const overlapsX = box.max.x >= ledBox.min.x + ledWidth * 0.10
      && box.min.x <= ledBox.max.x - ledWidth * 0.10;
    const nearLedPlane = box.max.z < ledBox.max.z + 2.50
      && box.min.z > ledBox.min.z - 4.0;
    // Only rear-stage top surfaces that are visibly below the current LED
    // are candidates. Exclude lights, borders, and tall nearby truss.
    if (!overlapsX || !nearLedPlane || box.max.y >= ledBox.min.y - 0.02) return;
    if (box.max.y > rearRiserTop) {
      rearRiserTop = box.max.y;
      selectedRiser = object.name;
    }
  });
  if (!Number.isFinite(rearRiserTop)) {
    console.warn("[NeonStage E23] No physically registered rear riser; preserve existing LED Y.");
    return;
  }
  const gap = ledBox.min.y - rearRiserTop;
  const maxSafeTranslation = Math.min(1.65, ledHeight * 0.30);
  const descent = Math.min(maxSafeTranslation, Math.max(0, gap - 0.012));
  if (descent > 0.012) {
    offsetObjectWorldY(led, -descent);
    model.updateMatrixWorld(true);
  }
  console.info("[NeonStage E23] Physical LED/riser alignment", {
    selectedRiser, gapBefore: gap, descent,
    gapAfter: gap - descent,
    capped: gap - descent > 0.06,
    originalLedBottom: ledBox.min.y,
  });
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
  // Runtime only; never perturb deterministic Golden Sketch/E29 compare.
  private readonly motionPassEnabled = typeof window !== "undefined"
    && window.location.pathname !== "/tools/neon-stage-compare"
    && new URLSearchParams(window.location.search).get("stageMotion") !== "off";
  private acceptedLedMaterial: THREE.ShaderMaterial | null = null;
  private readonly acceptedApertureGlowMaterials: THREE.SpriteMaterial[] = [];

  private readonly loader = new GLTFLoader();
  private readonly animatedRoot = new THREE.Group();
  private readonly acceptedFxRoot = new THREE.Group();
  private readonly integratedStageFx = useIntegratedStageFxCompare();
  private readonly physicalFloorBalanceE29 =
    usePhysicalFloorBalanceE29Compare() || useAcceptedNeonE29RuntimePresentation();
  private readonly physicalGlossE28 = usePhysicalGlossE28Compare();
  private readonly e28FloorDiagnostic = getE28FloorDiagnostic();
  private readonly physicalCleanupE27 = usePhysicalCleanupE27Compare()
    || this.physicalGlossE28 || this.physicalFloorBalanceE29;
  private readonly physicalRegistrationE26 =
    usePhysicalRegistrationE26Compare() || this.physicalCleanupE27;
  private readonly physicalExtensionE25 =
    usePhysicalExtensionE25Compare() || this.physicalRegistrationE26;
  private readonly physicalExtensionE24 =
    usePhysicalExtensionE24Compare() || this.physicalExtensionE25;
  private readonly physicalAlignmentE23 = usePhysicalAlignmentE23Compare();
  private readonly physicalFidelityE22 = usePhysicalFidelityE22Compare()
    || this.physicalAlignmentE23 || this.physicalExtensionE24;
  private readonly physicalRepairE21 = usePhysicalRepairE21Compare() || this.physicalFidelityE22;
  private readonly physicalRefinementE20 = usePhysicalRefinementE20Compare();
  private readonly physicalLightingRefinement = this.physicalRefinementE20 || this.physicalRepairE21;
  private readonly physicalReflectionE19 = usePhysicalReflectionE19Compare()
    || this.physicalRefinementE20 || this.physicalRepairE21;
  private readonly physicalSurfaceE18 = usePhysicalSurfaceE18Compare() || this.physicalReflectionE19;
  private readonly pulseMaterials: PulseMaterial[] = [];
  private readonly breathMaterials: BreathMaterial[] = [];
  private readonly beamStates: BeamState[] = [];
  private readonly spotLights: THREE.SpotLight[] = [];
  private readonly acceptedBreathMaterials: AcceptedBreathMaterial[] = [];
  private readonly acceptedMovingHeads: AcceptedMovingHead[] = [];
  private readonly textures: THREE.Texture[] = [];
  private readonly fallbackChildren: THREE.Object3D[] = [];
  private loadedModel: THREE.Object3D | null = null;
  private e24BeamTarget: THREE.Vector3 | null = null;
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
    // Existing camera/truss motion continues on presentation time. Beat
    // modulation ONLY reads WebAudio authority; no new scheduler or timer.
    if (this.loadedModel) {
      this.updateAcceptedR15Runtime(renderTimeSeconds, songTimeMs, bpm, isPlaying);
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
    this.acceptedLedMaterial = null;
    this.acceptedApertureGlowMaterials.length = 0;
    this.lastAcceptedBreathUpdateSeconds = Number.NEGATIVE_INFINITY;
    this.root.clear();
  }


  private prepareAcceptedR15Runtime(model: THREE.Object3D) {
    applyGoldenVerticalRegistration(model);
    if (this.physicalRegistrationE26) {
      lowerE26CentralLedWithinHeader(model);
    }
    if (this.physicalCleanupE27) {
      hideE27LedCrossbars(model);
    }
    if (this.physicalAlignmentE23) {
      alignE23LedBottomToRearRiser(model);
    }
    if (this.physicalExtensionE24) {
      const led = model.getObjectByName("CentralLED");
      const bounds = led ? new THREE.Box3().setFromObject(led) : null;
      if (bounds && !bounds.isEmpty()) {
        const ledSize = bounds.getSize(new THREE.Vector3());
        this.e24BeamTarget = new THREE.Vector3(
          (bounds.min.x + bounds.max.x) / 2,
          bounds.min.y + ledSize.y * 0.68,
          bounds.max.z + 0.30,
        );
      }
    }

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
    if (centralLed?.isMesh && !this.physicalSurfaceE18) {
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

    // Lock the dance-ring palette to the accepted golden plate. The imported
    // ring materials were too white/desaturated on iPhone.
    model.traverse(object => {
      const mesh = object as THREE.Mesh;
      if (!mesh.isMesh || !object.name.toLowerCase().includes("dance ring")) return;

      const normalized = object.name.toLowerCase();
      const color = normalized.includes("outer")
        ? 0xff23d0
        : normalized.includes("mid") || normalized.includes("middle")
          ? 0x16ddff
          : 0xc64dff;
      const hotColor = normalized.includes("outer")
        ? 0xffb8ef
        : normalized.includes("mid") || normalized.includes("middle")
          ? 0xa2f6ff
          : 0xee9dff;
      const targetIntensity = normalized.includes("outer")
        ? 18.0
        : normalized.includes("mid") || normalized.includes("middle")
          ? 17.0
          : 15.8;
      const sources = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      const next = sources.map(source => {
        if (!(source instanceof THREE.MeshStandardMaterial)) return source;
        const material = source.clone();
        material.name = source.name + " GoldenRing";
        material.color.setHex(color);
        material.emissive.setHex(hotColor);
        material.emissiveIntensity = Math.max(material.emissiveIntensity, targetIntensity);
        material.roughness = Math.min(material.roughness, 0.040);
        material.metalness = Math.max(material.metalness, 0.12);
        material.toneMapped = false;
        material.needsUpdate = true;
        return material;
      });
      mesh.material = Array.isArray(mesh.material) ? next : next[0];
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
          material.emissiveIntensity = Math.max(material.emissiveIntensity, 18.0);
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

        // Golden ring materials are calibrated separately against the accepted
        // concept. Do not let generic neon-white tuning desaturate them.
        if (name.includes("goldenring")) return;

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
          material.emissive.setHex(0xb82cff);
          material.emissiveIntensity = 1.78;
        } else if (name.includes("aperture cyan")) {
          material.emissive.setHex(0x16ddff);
          material.emissiveIntensity = Math.max(material.emissiveIntensity, 9.2);
          material.toneMapped = false;
        } else if (name.includes("aperture violet")) {
          material.emissive.setHex(0xff1fd0);
          material.emissiveIntensity = Math.max(material.emissiveIntensity, 10.2);
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
          material.emissive.setHex(0xcdd5ff);
          material.emissiveIntensity = Math.max(material.emissiveIntensity, 2.15);
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
          material.color.multiplyScalar(this.physicalSurfaceE18 ? 0.99 : 0.84);
          material.roughness = Math.min(material.roughness, this.physicalSurfaceE18 ? 0.075 : 0.012);
          material.metalness = Math.max(material.metalness, this.physicalSurfaceE18 ? 0.52 : 0.34);
          material.emissive.setHex(0x0d0438);
          material.emissiveIntensity = this.physicalSurfaceE18 ? 0.16 : 0.10;
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
    // E22: strengthen the stage-light cone cadence from the owner's closeup.
    // E19/E21 retain the exact six-source beam layout.
    if (this.physicalFidelityE22 && !this.physicalAlignmentE23) {
      activeBeamKeys.add("MainFixture_05");
      activeBeamKeys.add("MainFixture_07");
    }
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
    const e20GlintTexture = this.physicalLightingRefinement ? makeE20LensGlintTexture() : null;
    if (e20GlintTexture) this.textures.push(e20GlintTexture);
    const reflectionStreakTexture = this.physicalSurfaceE18 ? null : makeAcceptedReflectionStreakTexture();
    this.textures.push(lightPoolTexture, beamSourceTexture);
    if (reflectionStreakTexture) this.textures.push(reflectionStreakTexture);

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
              uLength: { value: this.physicalExtensionE24
                ? (group.prefix === "MainFixture" ? 4.6 : 3.7) : group.length },
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
                float nearHaze = 1.0 + 0.72 * exp(-vDistance * 6.5);
                float sourceGlow = exp(-vDistance * 4.2) * core;
                vec3 color = mix(uColor, vec3(1.0), min(0.52, sourceGlow));
                float alpha = uOpacity * edgeFade * (0.42 * haze + 0.58 * core) * longitudinal * nearHaze;
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
            const physicalBeamLength = this.physicalExtensionE24
              ? (group.prefix === "MainFixture" ? 4.6 : 3.7)
              : group.length;
            const beam = new THREE.Mesh(
              new THREE.PlaneGeometry(
                group.radius * (this.physicalAlignmentE23 ? 2.46 : this.physicalFidelityE22 ? 2.88 : 2.15),
                physicalBeamLength, 1, 1,
              ),
              beamMaterial!,
            );
            beam.geometry.translate(0, -physicalBeamLength / 2, 0);
            beam.rotation.y = rotationY;
            return beam;
          };

          const beamA = makeBeamPlane(0);
          beamA.name = `${key}_RuntimeBeamSoftA`;
          const beamB = makeBeamPlane(Math.PI / 2);
          beamB.name = `${key}_RuntimeBeamSoftB`;
          beamRoot.add(beamA, beamB);
          if (this.physicalFidelityE22 && !this.physicalAlignmentE23) {
            const beamC = makeBeamPlane(Math.PI / 3);
            beamC.name = key + "_E22VolumetricConeC";
            beamRoot.add(beamC);
          }
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
          hotCoreMaterial.color = presentationColor.clone().lerp(new THREE.Color(0xffffff), 0.56);
          hotCoreMaterial.opacity = 0.94;
          const hotCore = new THREE.Sprite(hotCoreMaterial);
          hotCore.name = `${key}_RuntimeSourceHotCore`;
          hotCore.scale.setScalar(group.prefix === "MainFixture" ? 0.32 : 0.25);
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
            opacity: this.physicalExtensionE24 ? 0.30
              : this.physicalAlignmentE23 ? 0.40
              : this.physicalFidelityE22 ? 0.62
              : group.prefix === "MainFixture" ? 0.43 : 0.34,
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
            opacity: 0.88,
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
          hotCoreMaterial.color = presentationColor.clone().lerp(new THREE.Color(0xffffff), 0.58);
          hotCoreMaterial.opacity = 1.0;
          const hotCore = new THREE.Sprite(hotCoreMaterial);
          hotCore.name = `${key}_RuntimeSourceHotCore`;
          hotCore.scale.setScalar(0.24);
          sourceFxRoot.add(hotCore);
        }

        let e20Spot: THREE.SpotLight | null = null;
        let e20GlintMaterial: THREE.SpriteMaterial | null = null;
        if (this.physicalLightingRefinement && sourceFxRoot && group.prefix === "MainFixture" && e20GlintTexture) {
          e20GlintMaterial = new THREE.SpriteMaterial({
            name: key + "_E20LensFlare",
            map: e20GlintTexture,
            color: presentationColor.clone().lerp(new THREE.Color(0xffffff), 0.44),
            transparent: true,
            opacity: 0.35,
            depthWrite: false,
            depthTest: true,
            blending: THREE.AdditiveBlending,
            toneMapped: false,
          });
          const glint = new THREE.Sprite(e20GlintMaterial);
          glint.name = key + "_E20OpticalGlint";
          glint.position.z = 0.045;
          glint.scale.setScalar(activeBeamKeys.has(key) ? 0.94 : 0.58);
          sourceFxRoot.add(glint);

          // Four real but shadow-free spotlights complement the existing
          // six cheap volumetric beam meshes. Never enable all 16 glTF lights.
          if (["01", "02", "08", "09"].includes(suffix)) {
            e20Spot = new THREE.SpotLight(
              presentationColor, 10.0, 13.8, Math.PI / 8, 0.68, 2.0,
            );
            e20Spot.name = key + "_E20PhotometricSpot";
            e20Spot.castShadow = false;
            this.acceptedFxRoot.add(e20Spot, e20Spot.target);
          }
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
            opacity: 0.62,
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

          if (reflectionStreakTexture) {
          const reflectionCoreMaterial = new THREE.MeshBasicMaterial({
            name: `${key}_RuntimeReflectionCore`,
            map: reflectionStreakTexture,
            color: presentationColor.clone().lerp(new THREE.Color(0xffffff), 0.18),
            transparent: true,
            opacity: 0.64,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
            side: THREE.DoubleSide,
            toneMapped: false,
          });
          reflectionCoreMesh = new THREE.Mesh(new THREE.PlaneGeometry(0.92, 5.6), reflectionCoreMaterial);
          reflectionCoreMesh.name = `${key}_RuntimeReflectionCoreMesh`;
          reflectionCoreMesh.rotation.x = -Math.PI / 2;
          reflectionCoreMesh.position.y = 0.051;
          this.acceptedFxRoot.add(reflectionCoreMesh);

          const reflectionMaterial = new THREE.MeshBasicMaterial({
            name: `${key}_RuntimeReflectionStreak`,
            map: reflectionStreakTexture,
            color: presentationColor.clone().lerp(new THREE.Color(0xffffff), 0.04),
            transparent: true,
            opacity: 0.34,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
            side: THREE.DoubleSide,
            toneMapped: false,
          });
          reflectionMesh = new THREE.Mesh(new THREE.PlaneGeometry(1.70, 13.6), reflectionMaterial);
          reflectionMesh.name = `${key}_RuntimeReflectionStreakMesh`;
          reflectionMesh.rotation.x = -Math.PI / 2;
          reflectionMesh.position.y = 0.049;
          this.acceptedFxRoot.add(reflectionMesh);
          }
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
          motionAccent: group.prefix === "MainFixture"
            && ["01", "04", "06", "09"].includes(suffix),
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
          e20Spot,
          e20GlintMaterial,
        });
      }
    });
  }

  private createAcceptedR15BeautyLighting(model: THREE.Object3D) {
    const ambient = new THREE.AmbientLight(0x2d0a3e, 0.11);
    ambient.name = "R15RuntimeBeautyAmbient";

    // Local fills replace a global purple wash: reveal structure without
    // flattening the dark gaps that make the concept look premium.
    const trussFill = new THREE.PointLight(0x5d35ff, 21.5, 14.5, 1.82);
    trussFill.name = "R15RuntimeTrussFill";
    trussFill.position.set(0, 7.26, -1.35);

    const trussLeftFill = new THREE.PointLight(0x00dfff, 12.8, 9.2, 1.92);
    trussLeftFill.name = "R15RuntimeTrussLeftFill";
    trussLeftFill.position.set(-5.3, 7.01, -1.5);

    const trussRightFill = new THREE.PointLight(0xff00b8, 12.8, 9.2, 1.92);
    trussRightFill.name = "R15RuntimeTrussRightFill";
    trussRightFill.position.set(5.3, 7.01, -1.5);

    const leftArchitectureFill = new THREE.PointLight(0x29dfff, 7.2, 12.5, 1.95);
    leftArchitectureFill.name = "R15RuntimeLeftArchitectureFill";
    leftArchitectureFill.position.set(-6.2, 4.2, -2.0);

    const rightArchitectureFill = new THREE.PointLight(0xff35d1, 7.2, 12.5, 1.95);
    rightArchitectureFill.name = "R15RuntimeRightArchitectureFill";
    rightArchitectureFill.position.set(6.2, 4.2, -2.0);

    const riserFill = new THREE.PointLight(0xaa35ff, 22.0, 11.4, 1.88);
    riserFill.name = "R15RuntimeRiserFill";
    riserFill.position.set(0, 1.47, -2.8);

    const floorCyanFill = new THREE.PointLight(0x08dcff, 4.4, 10.2, 2.15);
    floorCyanFill.name = "R15RuntimeFloorCyanFill";
    floorCyanFill.position.set(-4.2, 0.72, 4.8);

    const floorMagentaFill = new THREE.PointLight(0xff0bc6, 4.4, 10.2, 2.15);
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
    const floorReflectionTexture = this.physicalSurfaceE18
      ? makeGroundedE18FloorReflectionTexture(model)
      : this.integratedStageFx
        ? makeIntegratedFloorReflectionTexture(model)
        : makeAcceptedFloorReflectionTexture();
    const floorGridTexture = makeAcceptedFloorGridTexture();
    const lowerFixtureGlowTexture = makeAcceptedBeamSourceTexture();
    this.textures.push(
      poolTexture,
      backdropTexture,
      floorReflectionTexture,
      floorGridTexture,
      lowerFixtureGlowTexture,
    );

    const centralLed = model.getObjectByName("CentralLED");
    if (centralLed) {
      centralLed.updateWorldMatrix(true, false);
      const ledBounds = new THREE.Box3().setFromObject(centralLed);
      const ledSize = ledBounds.getSize(new THREE.Vector3());
      const ledCenter = ledBounds.getCenter(new THREE.Vector3());

      if (this.physicalSurfaceE18 && (centralLed as THREE.Mesh).isMesh && ledSize.x > 0 && ledSize.y > 0) {
        const physicalLed = centralLed as THREE.Mesh;
        physicalLed.material = makePhysicalCentralLedMaterial(
          backdropTexture, ledBounds, this.physicalReflectionE19,
        );
        this.acceptedLedMaterial = physicalLed.material as THREE.ShaderMaterial;
        physicalLed.renderOrder = 2;
        const physicalFloor = model.getObjectByName("PolishedDanceFloor") as THREE.Mesh | undefined;
        const stats = (mesh: THREE.Mesh | undefined) => mesh?.isMesh ? {
          size: new THREE.Box3().setFromObject(mesh).getSize(new THREE.Vector3()).toArray(),
          vertices: mesh.geometry.getAttribute("position")?.count ?? 0,
          uvCount: mesh.geometry.getAttribute("uv")?.count ?? 0,
          normals: mesh.geometry.getAttribute("normal")?.count ?? 0,
          groups: mesh.geometry.groups.length,
        } : "not-a-mesh";
        console.info("[NeonStage E18] GLB physical surface diagnostics", {
          led: stats(physicalLed), floor: stats(physicalFloor),
          ledMin: ledBounds.min.toArray(), ledMax: ledBounds.max.toArray(),
        });
        if (this.physicalExtensionE24) {
          extendE24PhysicalCentralLed(
            model, this.acceptedFxRoot, ledBounds,
            backdropTexture, this.physicalExtensionE25,
          );
        } else if (this.physicalRepairE21 && !this.physicalAlignmentE23) {
          addE21LedRiserStructuralBridge(
            model, this.acceptedFxRoot, ledBounds, this.physicalFidelityE22,
          );
        }
      } else {
      const backdropMaterial = makeAcceptedBackdropMaterial(backdropTexture, this.integratedStageFx);
      this.acceptedLedMaterial = backdropMaterial;

      // One uninterrupted wall surface. The top stays locked to the registered
      // CentralLED while the extra 10% height continues downward into the
      // concept's lower LED field, removing the black "cut backdrop" band.
      const backdropHeight = ledSize.y * 1.10;
      const backdrop = new THREE.Mesh(
        new THREE.PlaneGeometry(ledSize.x * 0.995, backdropHeight),
        backdropMaterial,
      );
      backdrop.name = "R15AcceptedLedGlowOverlay";
      backdrop.position.set(
        ledCenter.x,
        ledCenter.y - ledSize.y * 0.05,
        ledBounds.max.z + (this.integratedStageFx ? 0.010 : 0.028),
      );
      backdrop.renderOrder = 2;
      this.acceptedFxRoot.add(backdrop);

      if (this.integratedStageFx) {
        // Small local wall-source spill on nearby *3D* architecture, not a
        // fullscreen purple overlay. Anchored to the CentralLED GLB bounds.
        for (const side of [-1, 1]) {
          const wallBounce = new THREE.PointLight(
            side < 0 ? 0x21c8fa : 0xf72bcf, 3.3,
            Math.min(10.5, ledSize.x * 0.72), 2.0,
          );
          wallBounce.name = side < 0
            ? "NeonCompareLeftLedSpill"
            : "NeonCompareRightLedSpill";
          wallBounce.position.set(
            ledCenter.x + side * ledSize.x * 0.37,
            ledCenter.y - ledSize.y * 0.28,
            ledBounds.max.z + 1.15,
          );
          this.acceptedFxRoot.add(wallBounce);
        }
      }
      }
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

    if (this.physicalFidelityE22) {
      addE22SwivelUplightHousings(
        this.acceptedFxRoot, model, lowerFixtureBounds, this.physicalAlignmentE23,
      );
    } else if (this.physicalLightingRefinement) {
      addE20UplightMounts(this.acceptedFxRoot, model, lowerFixtureBounds);
    }

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
        if (this.motionPassEnabled) this.acceptedApertureGlowMaterials.push(material);
        sprite.position.set(
          center.x,
          center.y + size.y * (this.physicalLightingRefinement ? 0.04 : 0.12),
          bounds.max.z + (this.physicalLightingRefinement ? 0.010 : 0.055),
        );
        sprite.renderOrder = 18;
        const diameter = this.physicalLightingRefinement
          ? THREE.MathUtils.clamp(Math.max(size.x, size.y) * 0.78, 0.28, 0.46)
          : THREE.MathUtils.clamp(Math.max(size.x, size.y) * 1.36, 0.46, 0.78);
        sprite.scale.set(diameter, diameter, 1);
        this.acceptedFxRoot.add(sprite);
      });

    const actualLed = model.getObjectByName("CentralLED");
    const actualLedBounds = actualLed ? new THREE.Box3().setFromObject(actualLed) : null;
    const ringNode = this.physicalRefinementE20 || this.physicalRepairE21
      ? model.getObjectByName("R15 Dance Ring Outer") : null;
    const ringBounds = ringNode ? new THREE.Box3().setFromObject(ringNode) : null;
    const ringCenter = ringBounds && !ringBounds.isEmpty()
      ? ringBounds.getCenter(new THREE.Vector3()) : new THREE.Vector3(0, 0, ACCEPTED_R15_DANCE_RING_Z);
    const ringSize = ringBounds && !ringBounds.isEmpty()
      ? ringBounds.getSize(new THREE.Vector3()) : new THREE.Vector3(4, 0, 4);
    const lowerFixtureCenters = [...lowerFixtureBounds.values()]
      .map(bounds => bounds.getCenter(new THREE.Vector3()))
      .sort((a, b) => a.x - b.x);
    const leftFixture = lowerFixtureCenters[0] ?? new THREE.Vector3(-4.0, 0, -3.0);
    const rightFixture = lowerFixtureCenters[lowerFixtureCenters.length - 1]
      ?? new THREE.Vector3(4.0, 0, -3.0);
    const reflectionMaterial = this.physicalFloorBalanceE29 && actualLedBounds && !actualLedBounds.isEmpty()
      ? makeE29BalancedDarkGlossFloorMaterial(
        floorReflectionTexture, backdropTexture, actualLedBounds,
        new THREE.Vector2(ringCenter.x, ringCenter.z),
        Math.max(ringSize.x, ringSize.z) * 0.45,
        new THREE.Vector2(leftFixture.x, leftFixture.z),
        new THREE.Vector2(rightFixture.x, rightFixture.z),
      )
      : this.physicalGlossE28 && actualLedBounds && !actualLedBounds.isEmpty()
      ? makeE28ContinuousPolishedFloorMaterial(
        floorReflectionTexture, backdropTexture, actualLedBounds,
        new THREE.Vector2(ringCenter.x, ringCenter.z),
        Math.max(ringSize.x, ringSize.z) * 0.45,
        new THREE.Vector2(leftFixture.x, leftFixture.z),
        new THREE.Vector2(rightFixture.x, rightFixture.z),
      )
      : this.physicalCleanupE27 && actualLedBounds && !actualLedBounds.isEmpty()
      ? makeE27GlossyContinuousFloorMaterial(
        floorReflectionTexture, backdropTexture, actualLedBounds,
        new THREE.Vector2(ringCenter.x, ringCenter.z),
        Math.max(ringSize.x, ringSize.z) * 0.45,
        new THREE.Vector2(leftFixture.x, leftFixture.z),
        new THREE.Vector2(rightFixture.x, rightFixture.z),
      )
      : this.physicalExtensionE24 && actualLedBounds && !actualLedBounds.isEmpty()
      ? makeE24WholeFloorMaterial(
        floorReflectionTexture, backdropTexture, actualLedBounds,
        new THREE.Vector2(ringCenter.x, ringCenter.z),
        Math.max(ringSize.x, ringSize.z) * 0.45,
        new THREE.Vector2(leftFixture.x, leftFixture.z),
        new THREE.Vector2(rightFixture.x, rightFixture.z),
      )
      : this.physicalAlignmentE23 && actualLedBounds && !actualLedBounds.isEmpty()
      ? makeE23UnifiedFloorMaterial(
        floorReflectionTexture, backdropTexture, actualLedBounds,
        new THREE.Vector2(ringCenter.x, ringCenter.z),
        Math.max(ringSize.x, ringSize.z) * 0.45,
        new THREE.Vector2(leftFixture.x, leftFixture.z),
        new THREE.Vector2(rightFixture.x, rightFixture.z),
      )
      : this.physicalFidelityE22 && actualLedBounds && !actualLedBounds.isEmpty()
      ? makeE22ContinuousFloorReflectionMaterial(
        floorReflectionTexture, backdropTexture, actualLedBounds,
        new THREE.Vector2(ringCenter.x, ringCenter.z),
        Math.max(ringSize.x, ringSize.z) * 0.45,
        new THREE.Vector2(leftFixture.x, leftFixture.z),
        new THREE.Vector2(rightFixture.x, rightFixture.z),
      )
      : this.physicalRepairE21 && actualLedBounds && !actualLedBounds.isEmpty()
      ? makeE21SoftRingReflectionMaterial(
        floorReflectionTexture, backdropTexture, actualLedBounds,
        new THREE.Vector2(ringCenter.x, ringCenter.z),
        Math.max(ringSize.x, ringSize.z) * 0.45,
      )
      : this.physicalRefinementE20 && actualLedBounds && !actualLedBounds.isEmpty()
      ? makeE20SoftFloorMaterial(
        floorReflectionTexture, backdropTexture, actualLedBounds,
        new THREE.Vector2(ringCenter.x, ringCenter.z),
        Math.max(ringSize.x, ringSize.z) * 0.45,
      )
      : this.physicalReflectionE19 && actualLedBounds && !actualLedBounds.isEmpty()
        ? makeE19ReflectedWallFloorMaterial(
          floorReflectionTexture, backdropTexture, actualLedBounds,
        )
      : new THREE.MeshBasicMaterial({
        map: floorReflectionTexture,
        transparent: true,
        opacity: this.physicalSurfaceE18 ? 0.98 : this.integratedStageFx ? 0.92 : 0.74,
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
    reflectionField.position.set(0, this.physicalReflectionE19 ? 0.055 : 0.044, 11.2);
    if (this.physicalReflectionE19) reflectionField.renderOrder = 3;
    if (this.e28FloorDiagnostic === "reflection-off") reflectionField.visible = false;
    this.acceptedFxRoot.add(reflectionField);

    const floorGridMaterial = new THREE.MeshBasicMaterial({
      map: floorGridTexture,
      transparent: true,
      opacity: 0.80,
      depthWrite: false,
      depthTest: true,
      blending: THREE.NormalBlending,
      side: THREE.DoubleSide,
      toneMapped: false,
    });
    const floorGrid = new THREE.Mesh(
      new THREE.PlaneGeometry(19.2, 34.0),
      floorGridMaterial,
    );
    floorGrid.name = "R15AcceptedFloorTileGrid";
    floorGrid.rotation.x = -Math.PI / 2;
    floorGrid.position.set(0, 0.047, 11.2);
    floorGrid.renderOrder = 4;
    if (this.e28FloorDiagnostic === "grid-off") floorGrid.visible = false;
    this.acceptedFxRoot.add(floorGrid);
    if (this.e28FloorDiagnostic === "base-neutral") {
      const floor = model.getObjectByName("PolishedDanceFloor") as THREE.Mesh | undefined;
      if (floor?.isMesh) {
        // Visual diagnostic only: desaturate GLB base material to identify
        // imported tile-row material differences independently of overlays.
        const neutral = new THREE.MeshStandardMaterial({
          name: "NeonE28DiagnosticNeutralPolishedFloor",
          color: 0x121427, roughness: 0.14, metalness: 0.20,
        });
        floor.material = neutral;
      }
    }
    if (this.e28FloorDiagnostic) {
      console.info("[NeonStage E28] Isolated floor render diagnostic", {
        layer: this.e28FloorDiagnostic,
        reflectionField: reflectionField.visible,
        tileGrid: floorGrid.visible,
      });
    }

  }

  private updateAcceptedR15Runtime(
    renderTimeSeconds: number, songTimeMs: number, bpm: number, isPlaying: boolean,
  ) {
    const beatEnergy = this.motionPassEnabled
      ? acceptedSongBeatEnergy(songTimeMs, bpm, isPlaying) : 0;
    // The N1 +11.5% peak on saturated E29 artwork was barely noticeable:
    // alternate visible dim phases and bright accents without flashing.
    const idleBreath = 0.78 + 0.20
      * (0.5 + 0.5 * Math.sin(renderTimeSeconds * (Math.PI * 2 / 2.8)));
    const neonGain = !this.motionPassEnabled ? 1
      : isPlaying ? 0.58 + beatEnergy * 0.92 : idleBreath;
    if (this.acceptedLedMaterial) {
      this.acceptedLedMaterial.uniforms.uNeonBreath.value = neonGain;
    }
    if (renderTimeSeconds - this.lastAcceptedBreathUpdateSeconds >= 1 / 30) {
      this.acceptedBreathMaterials.forEach(state => {
        // The existing rail/riser breath stays smooth in idle. During playback,
        // weak/strong pulses follow the same song-time beat as the central LED.
        if (this.motionPassEnabled) {
          // Some E29 Riser strips already have intensity >=18 and disable
          // tone mapping. Brightening them further stays clipped on Safari.
          // Bring them into a readable dim/bright range for the motion pass.
          const usableBase = Math.min(state.baseEmissiveIntensity, 2.2);
          state.material.emissiveIntensity = usableBase * (
            isPlaying ? 0.38 + beatEnergy * 1.48 : idleBreath
          );
        } else {
          state.material.emissiveIntensity = state.baseEmissiveIntensity
            * acceptedBreathMultiplier(renderTimeSeconds, state.phaseOffsetSeconds);
        }
      });
      this.acceptedApertureGlowMaterials.forEach(material => {
        material.opacity = isPlaying
          ? THREE.MathUtils.clamp(0.46 + beatEnergy * 0.66, 0.40, 1.0)
          : 0.72 + (idleBreath - 0.78) * 0.90;
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
      const accentedHead = this.motionPassEnabled && state.motionAccent;
      const theta = renderTimeSeconds * state.speed
        * (accentedHead ? 1.85 : 1.0) + state.phase;
      const sweep = state.panAmplitude * (
        0.82 * Math.sin(theta)
        + 0.18 * Math.sin(theta * 2 + 0.35)
      ) * (accentedHead ? 1.64 : 1);
      const tilt = state.tiltAmplitude * (
        0.78 * Math.sin(theta + 1.05)
        + 0.22 * Math.sin(theta * 2 - state.phase * 0.25)
      ) * (accentedHead ? 1.38 : 1);
      const glow = 0.5 + 0.5 * Math.sin(theta * 0.72 + 0.6);
      const opticalAccent = accentedHead ? beatEnergy * 0.12 : 0;

      state.panPivot.quaternion
        .copy(state.basePanQuaternion)
        .multiply(deltaQuaternion.setFromAxisAngle(panAxis, sweep));
      state.tiltPivot.quaternion
        .copy(state.baseTiltQuaternion)
        .multiply(deltaQuaternion.setFromAxisAngle(tiltAxis, tilt));

      if (state.beamMaterial) {
        state.beamMaterial.uniforms.uOpacity.value = this.physicalExtensionE24
          ? 0.22 + glow * 0.065 + opticalAccent
          : this.physicalAlignmentE23
          ? 0.205 + glow * 0.065
          : this.physicalFidelityE22
            ? 0.36 + glow * 0.13
          : this.physicalLightingRefinement
            ? 0.21 + glow * 0.09
            : 0.16 + glow * 0.07;
      }
      if (state.e20GlintMaterial) {
        state.e20GlintMaterial.opacity = this.physicalExtensionE24
          ? 0.24 + glow * 0.14 + opticalAccent
          : this.physicalAlignmentE23
          ? 0.17 + glow * 0.13 : 0.27 + glow * 0.24;
      }

      state.sourceAnchor.updateWorldMatrix(true, false);
      state.sourceAnchor.getWorldPosition(worldSource);
      localSource.copy(worldSource);
      this.root.worldToLocal(localSource);

      if (state.sourceFxRoot) {
        state.sourceFxRoot.position.copy(localSource);
        state.sourceFxRoot.visible = true;
      }

      if (!state.floorAimBase || (!state.beamRoot && !state.spillMesh)) {
        if (state.e20Spot) state.e20Spot.intensity = 0;
        return;
      }

      localTarget.copy(state.floorAimBase);
      localTarget.x += Math.sin(theta * 0.82 + state.phase)
        * (accentedHead ? 0.94 : 0.28);
      localTarget.z += Math.sin(theta * 0.64 + state.phase * 0.7)
        * (accentedHead ? 0.40 : 0.24);
      if (this.physicalExtensionE24 && this.e24BeamTarget) {
        // Retain E29's short beams at the upper wall, never hit the floor.
        localTarget.set(
          accentedHead
            ? localTarget.x * 1.45 + 0.55 * Math.sin(theta * 0.72 + state.phase)
            : localTarget.x * 0.72,
          this.e24BeamTarget.y,
          this.e24BeamTarget.z,
        );
      }

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

      if (state.e20Spot) {
        state.e20Spot.position.copy(localSource);
        state.e20Spot.target.position.copy(localTarget);
        state.e20Spot.target.updateMatrixWorld();
        state.e20Spot.intensity = this.physicalExtensionE24
          ? 3.5 + glow * 1.2
          : this.physicalAlignmentE23 ? 4.8 + glow * 1.8 : 8.5 + glow * 3.0;
      }

      if (state.beamRoot) {
        state.beamRoot.position.copy(localSource);
        state.beamRoot.quaternion.setFromUnitVectors(localDown, localDirection);
        state.beamRoot.visible = true;
      }

      if (!state.spillMesh) return;
      if (this.physicalExtensionE24) {
        state.spillMesh.visible = false;
        return;
      }

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
        state.reflectionCoreMesh.material.opacity = this.integratedStageFx
          ? 0.24 + glow * 0.08
          : 0.74 + glow * 0.16;
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
          0.82 + glow * 0.11,
          reflectionLength / 14.2,
          1,
        );
        state.reflectionMesh.material.opacity = this.integratedStageFx
          ? 0.15 + glow * 0.045
          : 0.42 + glow * 0.10;
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
