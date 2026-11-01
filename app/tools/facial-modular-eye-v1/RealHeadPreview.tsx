"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import styles from "./FacialEyeLab.module.css";
import { EYE_SET_PACK_URL, EYE_SET_PACK_CACHE_NAME, getEyeSet } from "./EyeSetCatalog";
import type { EyeSetId } from "./EyeSetCatalog";
import { createEyePainter } from "./EyeTextureV19";

export type EyeShapeId = "neutral" | "joyful" | "sad" | "angry" | "surprised" | "playful";
export type IrisPatternId = "classic" | "heart" | "star" | "sparkle" | "spiral";

export type EyeDraft = {
  eyeSetId: EyeSetId;
  eyeSetCustomized: boolean;
  eyeShapeId: EyeShapeId;
  irisPatternId: IrisPatternId;
  blinkEnabled: boolean;
  irisStyleId: "natural" | "radiant" | "velvet" | "crystal";
  irisColor: string;
  symbolColor: string;
  eyeScale: number;
  eyeWidth: number;
  eyeHeight: number;
  eyeSpacing: number;
  irisScale: number;
  pupilScale: number;
  lashStyleId: "natural" | "doll" | "dramatic" | "none";
};
export type EyeView = "front" | "left" | "right" | "close";

// Immutable upload of the reconstructed Claude V2 eye modules.
const ASSET_URL = EYE_SET_PACK_URL;
const CENTERS = [
  new THREE.Vector2(-0.1203, 0.5174),
  new THREE.Vector2(0.1185, 0.5172),
];
type IrisUniforms = {
  mesh: THREE.Mesh;
  sourceMaterial: THREE.Material;
  cosmeticMaterial: THREE.MeshBasicMaterial;
  sourceUv?: Float32Array;
  cleanUv?: Float32Array;
};
type MorphMesh = {
  mesh: THREE.Mesh;
  original: Float32Array;
  worldPositions: Float32Array;
  inverse: THREE.Matrix4;
  affected: Uint32Array;
  lashRoots?: Float32Array;
  anatomicalBlink: boolean;
  blinkDelta?: Float32Array;
  blinkArc?: Float32Array;
  restNormals?: Float32Array;
  blinkNormals?: Float32Array;
  arcNormals?: Float32Array;
};
type PreviewScene = {
  dispose: () => void;
  apply: (draft: EyeDraft) => void;
  aim: (view: EyeView) => void;
};

function smoothstep(a: number, b: number, value: number) {
  const t = THREE.MathUtils.clamp((value - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
}

const SHAPE_PROFILE: Record<EyeShapeId, { open: number; outerLift: number; innerLift: number; brow: number; winkRight?: number }> = {
  neutral: { open: 1, outerLift: 0, innerLift: 0, brow: 0 },
  joyful: { open: 0.89, outerLift: 0.008, innerLift: 0.002, brow: 0.002 },
  sad: { open: 0.87, outerLift: -0.009, innerLift: 0.004, brow: 0.004 },
  angry: { open: 0.79, outerLift: 0.003, innerLift: -0.009, brow: -0.004 },
  surprised: { open: 1.14, outerLift: 0.003, innerLift: 0.003, brow: 0.007 },
  playful: { open: 0.96, outerLift: 0.009, innerLift: 0, brow: 0.004, winkRight: 0.72 },
};

function deformEyes(parts: MorphMesh[], draft: EyeDraft, blink = 0) {
  const profile = SHAPE_PROFILE[draft.eyeShapeId];
  const scaleX = draft.eyeScale * draft.eyeWidth;
  const scaleY = draft.eyeScale * draft.eyeHeight;
  const dest = new THREE.Vector3();
  for (const part of parts) {
    if (!part.mesh.visible) continue;
    const attr = part.mesh.geometry.getAttribute("position") as THREE.BufferAttribute;
    const output = attr.array as Float32Array;
    if (part.affected.length === 0) continue;
    for (const i of part.affected) {
      const k = 3 * i;
      let x = part.worldPositions[k];
      let y = part.worldPositions[k + 1];
      let z = part.worldPositions[k + 2];
      if (part.lashRoots && draft.lashStyleId !== "none") {
        const lengths = { natural: 0.90, doll: 1.12, dramatic: 1.25 };
        const authoredStyle = getEyeSet(draft.eyeSetId)?.lashStyleId ?? "natural";
        const factor = lengths[draft.lashStyleId] / lengths[authoredStyle];
        x = part.lashRoots[k] + (x - part.lashRoots[k]) * factor;
        y = part.lashRoots[k + 1] + (y - part.lashRoots[k + 1]) * factor;
        z = part.lashRoots[k + 2] + (z - part.lashRoots[k + 2]) * factor;
      }
      if (part.blinkDelta) {
        const arc = 4 * blink * (1 - blink);
        x += part.blinkDelta[k] * blink + (part.blinkArc?.[k] ?? 0) * arc;
        y += part.blinkDelta[k + 1] * blink + (part.blinkArc?.[k + 1] ?? 0) * arc;
        z += part.blinkDelta[k + 2] * blink + (part.blinkArc?.[k + 2] ?? 0) * arc;
      }
      let weight = 0;
      let cx = 0;
      let cy = 0;
      for (const eye of CENTERS) {
        const dx = (x - eye.x) / 0.093;
        const dy = (y - eye.y) / 0.077;
        const dz = (z - 0.271) / 0.085;
        const extent = dx * dx + dy * dy + 0.23 * dz * dz;
        const w = 1 - smoothstep(0.26, 1.05, extent);
        if (w > weight) {
          weight = w;
          cx = eye.x;
          cy = eye.y;
        }
      }
      if (weight < 0.00001) {
        dest.set(x, y, z).applyMatrix4(part.inverse);
        output[k] = dest.x; output[k + 1] = dest.y; output[k + 2] = dest.z;
        continue;
      }
      const nextX = x + (x - cx) * (scaleX - 1) * weight + cx * (draft.eyeSpacing - 1) * weight;
      const localX = (x - cx) / 0.067;
      const outer = THREE.MathUtils.clamp(localX * Math.sign(cx), -1, 1);
      const outerWeight = (outer + 1) * 0.5;
      const upperLidWeight = smoothstep(0.006, 0.035, y - cy);
      const open = profile.open * (part.anatomicalBlink ? 1 : 1 - 0.91 * blink) * (profile.winkRight && cx > 0 ? profile.winkRight : 1);
      const cornerLift = profile.outerLift * outerWeight + profile.innerLift * (1 - outerWeight);
      const nextY = y + (
        (y - cy) * (scaleY * open - 1) +
        cornerLift * upperLidWeight +
        profile.brow * smoothstep(0.028, 0.061, y - cy)
      ) * weight;
      dest.set(nextX, nextY, z).applyMatrix4(part.inverse);
      output[k] = dest.x;
      output[k + 1] = dest.y;
      output[k + 2] = dest.z;
    }
    attr.needsUpdate = true;
    if (part.restNormals && part.blinkNormals) {
      const normal = part.mesh.geometry.getAttribute("normal") as THREE.BufferAttribute;
      const values = normal.array as Float32Array;
      const arc = 4 * blink * (1 - blink);
      for (let k = 0; k < values.length; k += 3) {
        dest.set(
          part.restNormals[k] + part.blinkNormals[k] * blink + (part.arcNormals?.[k] ?? 0) * arc,
          part.restNormals[k + 1] + part.blinkNormals[k + 1] * blink + (part.arcNormals?.[k + 1] ?? 0) * arc,
          part.restNormals[k + 2] + part.blinkNormals[k + 2] * blink + (part.arcNormals?.[k + 2] ?? 0) * arc,
        ).normalize();
        values[k] = dest.x; values[k + 1] = dest.y; values[k + 2] = dest.z;
      }
      normal.needsUpdate = true;
    }
  }
}

function materialForIris(mesh: THREE.Mesh, painter: ReturnType<typeof createEyePainter>): IrisUniforms {
  const sourceMaterial = mesh.material as THREE.Material;
  const isVariant = mesh.name.startsWith("EyeSet_");
  // Original ocular shares the face material. Never change its tone mapping.
  if (isVariant) sourceMaterial.toneMapped = false;
  const cosmeticMaterial = new THREE.MeshBasicMaterial({
    map: painter.texture,
    side: sourceMaterial.side,
    toneMapped: false,
  });
  let sourceUv: Float32Array | undefined;
  let cleanUv: Float32Array | undefined;
  if (!isVariant) {
    const uv = mesh.geometry.getAttribute("uv");
    const position = mesh.geometry.getAttribute("position");
    sourceUv = new Float32Array(uv.count * 2);
    cleanUv = new Float32Array(uv.count * 2);
    const center = CENTERS[mesh.name.includes("_L_") ? 0 : 1];
    const point = new THREE.Vector3();
    for (let i = 0; i < uv.count; i++) {
      sourceUv[i * 2] = uv.getX(i); sourceUv[i * 2 + 1] = uv.getY(i);
      point.fromBufferAttribute(position, i).applyMatrix4(mesh.matrixWorld);
      cleanUv[i * 2] = 0.5 + (point.x - center.x) * 0.255 / 0.0291;
      cleanUv[i * 2 + 1] = 0.5 - (point.y - center.y) * 0.255 / 0.0291;
    }
  }
  return { mesh, sourceMaterial, cosmeticMaterial, sourceUv, cleanUv };
}

function isOriginalIris(draft: EyeDraft): boolean {
  return draft.irisPatternId === "classic" &&
    draft.irisStyleId === "natural" &&
    draft.irisScale === 1 &&
    draft.pupilScale === 0.38 &&
    draft.irisColor.toLowerCase() === "#94613f";
}

const ASSET_CACHE_NAME = EYE_SET_PACK_CACHE_NAME;
let pendingAsset: Promise<{ bytes: ArrayBuffer; source: "cache" | "network" }> | null = null;

function fetchCachedGLB(): Promise<{ bytes: ArrayBuffer; source: "cache" | "network" }> {
  // React StrictMode can mount twice before the first fetch resolves.
  pendingAsset ??= loadCachedGLB().catch(error => { pendingAsset = null; throw error; });
  return pendingAsset;
}

async function loadCachedGLB(): Promise<{ bytes: ArrayBuffer; source: "cache" | "network" }> {
  // CacheStorage stores the entire immutable GLB within THIS preview origin.
  // It is best-effort (Safari may evict); HTTP cache is still used as fallback.
  const request = new Request(ASSET_URL, { mode: "cors", cache: "force-cache" });
  let storage: Cache | null = null;
  if (typeof caches !== "undefined") {
    try {
      storage = await caches.open(ASSET_CACHE_NAME);
      const hit = await storage.match(request);
      if (hit) return { bytes: await hit.arrayBuffer(), source: "cache" };
    } catch (error) {
      console.warn("[Eye Lab] Cache unavailable; continuing with CDN", error);
    }
  }
  const response = await fetch(request);
  if (!response.ok) throw new Error("GLB CDN returned " + response.status);
  if (storage) {
    // Persist in parallel with parsing so saving 15 MB doesn't stall first preview.
    void storage.put(request, response.clone()).then(async () => {
      const cacheNames = await caches.keys();
      await Promise.all(cacheNames.filter(name => (name.startsWith("audition-face-lab-glb-") || name.startsWith("audition-eye-set-pack-")) && name !== ASSET_CACHE_NAME)
        .map(name => caches.delete(name)));
    }).catch(error => console.warn("[Eye Lab] GLB cache write skipped", error));
  }
  return { bytes: await response.arrayBuffer(), source: "network" };
}

function mountScene(host: HTMLDivElement, ready: (value: boolean) => void, cacheInfo: (source: "cache" | "network") => void): PreviewScene {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: "high-performance" });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.02;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.35));
  renderer.domElement.className = styles.canvas;
  host.appendChild(renderer.domElement);
  const scene = new THREE.Scene();
  scene.background = new THREE.Color("#171323");
  scene.add(new THREE.HemisphereLight(0xf4eaf5, 0x453454, 1.45));
  const key = new THREE.DirectionalLight(0xffeeea, 1.7);
  key.position.set(1.5, 2.0, 3.0);
  scene.add(key);
  const fill = new THREE.DirectionalLight(0xa4b9ff, 0.7);
  fill.position.set(-2.0, 0.9, 2.5);
  scene.add(fill);

  const camera = new THREE.OrthographicCamera(-0.5, 0.5, 0.5, -0.5, 0.02, 30);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableRotate = true;
  controls.enablePan = true;
  controls.enableZoom = true;
  controls.screenSpacePanning = true;
  controls.enableDamping = false;
  controls.minZoom = 0.68;
  controls.maxZoom = 5.2;
  controls.minPolarAngle = 0.32;
  controls.maxPolarAngle = Math.PI - 0.32;
  controls.mouseButtons = { LEFT: THREE.MOUSE.ROTATE, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.PAN };
  controls.touches = { ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_PAN };
  renderer.domElement.style.touchAction = "none";

  let view: EyeView = "front";
  let currentDraft: EyeDraft | null = null;
  let model: THREE.Group | null = null;
  const morphs: MorphMesh[] = [];
  const iris: IrisUniforms[] = [];
  const painter = createEyePainter();
  const variantIris = new Map<string, IrisUniforms>();
  const eyeSetNodes: THREE.Mesh[] = [];
  const lashNodes: THREE.Mesh[] = [];
  let disposed = false;
  let blinkAmount = 0;
  let blinkTimeout: number | null = null;
  let blinkFrame: number | null = null;
  const render = () => { if (!disposed) renderer.render(scene, camera); };
  const scheduleBlink = () => {
    if (disposed || !model) return;
    blinkTimeout = window.setTimeout(() => {
      blinkTimeout = null;
      if (disposed) return;
      if (!currentDraft?.blinkEnabled || document.hidden) {
        scheduleBlink();
        return;
      }
      const begin = performance.now();
      let previousFrame = -1000;
      const duration = 310;
      const step = (now: number) => {
        if (disposed || !model) return;
        if (!currentDraft?.blinkEnabled) {
          blinkAmount = 0;
          deformEyes(morphs, currentDraft!, 0);
          host.dataset.blinkAmount = "0.000";
          render();
          blinkFrame = null;
          scheduleBlink();
          return;
        }
        const progress = Math.min((now - begin) / duration, 1);
        if (progress === 1 || now - previousFrame >= 30) {
          previousFrame = now;
          blinkAmount = progress === 1 ? 0 : Math.pow(Math.sin(Math.PI * progress), 2);
          deformEyes(morphs, currentDraft, blinkAmount);
          host.dataset.blinkAmount = blinkAmount.toFixed(3);
          render();
        }
        if (progress < 1) blinkFrame = requestAnimationFrame(step);
        else {
          blinkFrame = null;
          scheduleBlink();
        }
      };
      blinkFrame = requestAnimationFrame(step);
    }, 6000 + Math.random() * 4200);
  };
  controls.addEventListener("change", render);
  const fitToHost = () => {
    const width = Math.max(1, host.clientWidth);
    const height = Math.max(1, host.clientHeight);
    const aspect = width / height;
    const halfHeight = 0.53;
    camera.left = -halfHeight * aspect;
    camera.right = halfHeight * aspect;
    camera.top = halfHeight;
    camera.bottom = -halfHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height, false);
    controls.update();
    render();
  };
  const aim = (v: EyeView) => {
    view = v;
    camera.zoom = v === "close" ? 3.0 : 1;
    controls.target.set(0, v === "close" ? 0.521 : 0.51, 0.12);
    camera.position.set(
      v === "left" ? -0.72 : v === "right" ? 0.72 : 0,
      v === "close" ? 0.53 : 0.54,
      v === "close" ? 1.12 : 2.1
    );
    camera.lookAt(controls.target);
    camera.updateProjectionMatrix();
    controls.update();
    fitToHost();
  };
  const resize = new ResizeObserver(fitToHost);
  resize.observe(host);
  aim(view);
  const apply = (draft: EyeDraft) => {
    currentDraft = draft;
    if (!model) return;
    const selectedSet = getEyeSet(draft.eyeSetId);
    const isSet = selectedSet !== undefined;
    if (draft.eyeSetCustomized || (!isSet && !isOriginalIris(draft))) painter.draw(draft);
    for (const control of [...iris, ...variantIris.values()]) {
      if (!control) continue;
      const variant = control.mesh.name.startsWith("EyeSet_");
      control.mesh.material = variant
        ? (draft.eyeSetCustomized ? control.cosmeticMaterial : control.sourceMaterial)
        : (isOriginalIris(draft) ? control.sourceMaterial : control.cosmeticMaterial);
      if (!variant && control.sourceUv && control.cleanUv) {
        control.mesh.geometry.setAttribute("uv", new THREE.BufferAttribute(
          isOriginalIris(draft) ? control.sourceUv : control.cleanUv, 2));
      }
      if (!variant) control.mesh.visible = !isSet;
    }
    for (const node of eyeSetNodes) {
      const active = isSet && node.name.startsWith("EyeSet_" + draft.eyeSetId + "_");
      const lashVariant = node.name.includes("_Lashes_V1");
      node.visible = active && (!lashVariant || draft.lashStyleId !== "none");
    }
    for (const lash of lashNodes) {
      lash.visible = !isSet && draft.lashStyleId !== "none" &&
        lash.name.includes("_" + draft.lashStyleId + "_V12");
    }
    model.traverse(node => {
      if (node.name === "Head_Base_Protected") node.visible = !isSet;
      if (node.name === "Head_Base_Protected_ConceptV191") node.visible = isSet;
      if (node.name.includes("UpperLidBridge_ISSUE")) node.visible = !isSet;
    });
    host.dataset.visibleModules = String(eyeSetNodes.filter(node => node.visible).length);
    if (!draft.blinkEnabled) blinkAmount = 0;
    host.dataset.blinkAmount = blinkAmount.toFixed(3);
    deformEyes(morphs, draft, blinkAmount);
    host.dataset.eyeSet = draft.eyeSetId;
    host.dataset.blinkProfile = isSet ? "anatomical-lid-v191" : "legacy-local-rest";
    const head = model.getObjectByName("Head_Base_Protected_ConceptV191") as THREE.Mesh | undefined;
    host.dataset.skinToneMapped = String((head?.material as THREE.Material | undefined)?.toneMapped);
    host.dataset.lashModule = draft.lashStyleId;
    render();
  };

  const loader = new GLTFLoader();
  void fetchCachedGLB().then(async ({ bytes, source }) => {
    if (disposed) return null;
    const gltf = await loader.parseAsync(bytes, "");
    cacheInfo(source);
    return gltf;
  }).then(gltf => {
    if (!gltf) return;
    if (disposed) {
      gltf.scene.traverse(o => {
        if (o instanceof THREE.Mesh) {
          o.geometry.dispose();
          (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => m.dispose());
        }
      });
      return;
    }
    model = gltf.scene;
    // V1.9.1 default scene is a standalone Natural look. Load the library
    // scene once, then resolve actual modules in-place without another fetch.
    for (const library of gltf.scenes) {
      if (library !== model) model.add(...library.children.slice());
    }
    scene.add(model);
    model.updateMatrixWorld(true);
    model.traverse(object => {
      if (!(object instanceof THREE.Mesh)) return;
      // Clone shared geometry so each semantic mesh may morph independently.
      object.geometry = object.geometry.clone();
      object.frustumCulled = false;
      const positions = object.geometry.getAttribute("position");
      if (!(positions instanceof THREE.BufferAttribute)) return;
      const original = new Float32Array(positions.array as ArrayLike<number>);
      const worldPositions = new Float32Array(original.length);
      const vector = new THREE.Vector3();
      for (let i = 0; i < positions.count; i += 1) {
        vector.fromBufferAttribute(positions, i).applyMatrix4(object.matrixWorld);
        worldPositions[i * 3] = vector.x;
        worldPositions[i * 3 + 1] = vector.y;
        worldPositions[i * 3 + 2] = vector.z;
      }
      // Precompute only vertices in the eye influence volume. This avoids
      // resculpting the entire head on each occasional 310ms blink on iPhone.
      const affectedIndices: number[] = [];
      for (let i = 0; i < positions.count; i += 1) {
        const k = i * 3;
        for (const center of CENTERS) {
          const dx = (worldPositions[k] - center.x) / 0.093;
          const dy = (worldPositions[k + 1] - center.y) / 0.077;
          const dz = (worldPositions[k + 2] - 0.271) / 0.085;
          if (dx * dx + dy * dy + 0.23 * dz * dz < 1.05) {
            affectedIndices.push(i);
            break;
          }
        }
      }
      const anatomicalBlink = object.userData.version === "1.9.1";
      const targets = object.geometry.morphAttributes.position;
      const targetNormals = object.geometry.morphAttributes.normal;
      const worldDelta = (attribute: THREE.BufferAttribute | THREE.InterleavedBufferAttribute | undefined) => {
        if (!attribute) return undefined;
        const array = new Float32Array(original.length);
        const linear = new THREE.Matrix3().setFromMatrix4(object.matrixWorld);
        for (let i = 0; i < attribute.count; i++) {
          vector.fromBufferAttribute(attribute, i).applyMatrix3(linear);
          array[i * 3] = vector.x; array[i * 3 + 1] = vector.y; array[i * 3 + 2] = vector.z;
        }
        return array;
      };
      // Exported glTF targets are applied before the existing bounded sliders.
      // Native weights stay zero so they cannot be applied twice by the GPU.
      object.morphTargetInfluences?.fill(0);
      morphs.push({ mesh: object, original, worldPositions, inverse: object.matrixWorld.clone().invert(),
        affected: anatomicalBlink && targets ? new Uint32Array(Array.from({ length: positions.count }, (_, i) => i)) : new Uint32Array(affectedIndices),
        lashRoots: object.geometry.getAttribute("_lash_root")?.array as Float32Array | undefined,
        anatomicalBlink,
        blinkDelta: anatomicalBlink ? worldDelta(targets?.[0]) : undefined,
        blinkArc: anatomicalBlink ? worldDelta(targets?.[1]) : undefined,
        restNormals: targetNormals ? new Float32Array(object.geometry.getAttribute("normal").array as ArrayLike<number>) : undefined,
        blinkNormals: targetNormals?.[0]?.array as Float32Array | undefined,
        arcNormals: targetNormals?.[1]?.array as Float32Array | undefined });
      if (object.name === "Eye_L_OcularSurface_V1" || object.name === "Eye_R_OcularSurface_V1") {
        object.geometry.setAttribute("aEyeRestPosition", new THREE.BufferAttribute(original.slice(), 3));
      }
      if (object.name.startsWith("Eyelashes_") && object.name.endsWith("_V12")) {
        // Six separate geometry modules, two eyes for each of the three style variants.
        object.visible = false;
        lashNodes.push(object);
      }
      if (object.name === "Eye_L_OcularSurface_V1") iris[0] = materialForIris(object, painter);
      if (object.name === "Eye_R_OcularSurface_V1") iris[1] = materialForIris(object, painter);
      const variantMatch = /^EyeSet_(natural|joyful|sad|playful|angry|doll|idol|star|heart)_([LR])_Ocular_V1$/.exec(object.name);
      if (variantMatch) {
        object.geometry.setAttribute("aEyeRestPosition", new THREE.BufferAttribute(original.slice(), 3));
        variantIris.set(variantMatch[1] + "_" + variantMatch[2], materialForIris(object, painter));
      }
      if (object.name.startsWith("EyeSet_")) {
        object.visible = false;
        eyeSetNodes.push(object);
      }
      // Local source eye/bridge fragments are replaced in the V1.9.1 asset.
    });
    ready(true);
    if (currentDraft) apply(currentDraft);
    render();
    scheduleBlink();
  }).catch(error => {
    if (disposed) return;
    console.warn("[Facial Eye Lab] GLB upload unavailable", error);
    ready(false);
  });

  return {
    apply, aim,
    dispose: () => {
      disposed = true;
      if (blinkTimeout !== null) window.clearTimeout(blinkTimeout);
      if (blinkFrame !== null) cancelAnimationFrame(blinkFrame);
      resize.disconnect();
      controls.removeEventListener("change", render);
      controls.dispose();
      if (model) {
        for (const control of [...iris, ...variantIris.values()]) control?.cosmeticMaterial.dispose();
        model.traverse(o => {
          if (!(o instanceof THREE.Mesh)) return;
          o.geometry.dispose();
          (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => {
            // Shared texture resources may be referenced by multiple meshes.
            m.dispose();
          });
        });
        scene.remove(model);
      }
      painter.dispose();
      renderer.dispose();
      if (renderer.domElement.parentElement === host) host.removeChild(renderer.domElement);
    },
  };
}

export default function RealHeadPreview({ draft, view, resetToken }: { draft: EyeDraft; view: EyeView; resetToken: number }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const instanceRef = useRef<PreviewScene | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [cacheSource, setCacheSource] = useState<"cache" | "network" | null>(null);
  useEffect(() => {
    if (!hostRef.current) return;
    let instance: PreviewScene | null = null;
    try {
      instance = mountScene(hostRef.current, ok => setState(ok ? "ready" : "error"), setCacheSource);
      instanceRef.current = instance;
    } catch (error) {
      console.warn("[Facial Eye Lab] WebGL unavailable", error);
      queueMicrotask(() => setState("error"));
    }
    return () => { instanceRef.current = null; instance?.dispose(); };
  }, []);
  useEffect(() => instanceRef.current?.apply(draft), [draft]);
  useEffect(() => instanceRef.current?.aim(view), [view, resetToken]);
  return (
    <div className={styles.viewport} ref={hostRef} data-testid="eye-preview" data-preview-status={state}>
      {state === "loading" && <div className={styles.previewNote}>Đang tải bộ mắt V1.9.1…</div>}
      {state === "error" && <div className={styles.fallback}>Không thể tải GLB thật hoặc WebGL không khả dụng. Kiểm tra kết nối và tải lại.</div>}
      {state === "ready" && <span className={styles.viewportCaption}>1 ngón xoay · 2 ngón kéo/zoom · {cacheSource === "cache" ? "GLB từ browser cache" : "GLB phiên bản mới"}</span>}
    </div>
  );
}
