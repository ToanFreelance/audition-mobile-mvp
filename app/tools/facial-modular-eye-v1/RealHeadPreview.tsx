"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import styles from "./FacialEyeLab.module.css";

export type EyeShapeId = "neutral" | "joyful" | "sad" | "angry" | "surprised" | "playful";
export type IrisPatternId = "classic" | "heart" | "star" | "sparkle" | "spiral";

export type EyeDraft = {
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

// Immutable verified upload derived from the owner's Claude V2 modular checkpoint.
// Geometry / UV unchanged; 3 original textures resized for the iPhone QA preview.
const ASSET_URL = "https://d2ol7oe51mr4n9.cloudfront.net/user_3Jb86LOyd6RRYonCk2iie6jkL5h/8fabdabb-c844-40e2-8d53-a8da6a490378.glb";
const CENTERS = [
  new THREE.Vector2(-0.1203, 0.5174),
  new THREE.Vector2(0.1185, 0.5172),
];
type IrisUniforms = {
  tint: { value: THREE.Color };
  symbolTint: { value: THREE.Color };
  style: { value: number };
  pupil: { value: number };
  radius: { value: number };
  center: { value: THREE.Vector2 };
  pattern: { value: number };
};
type MorphMesh = {
  mesh: THREE.Mesh;
  original: Float32Array;
  worldPositions: Float32Array;
  inverse: THREE.Matrix4;
  affected: Uint32Array;
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
    const attr = part.mesh.geometry.getAttribute("position") as THREE.BufferAttribute;
    const output = attr.array as Float32Array;
    if (part.affected.length === 0) continue;
    for (const i of part.affected) {
      const k = 3 * i;
      const x = part.worldPositions[k];
      const y = part.worldPositions[k + 1];
      const z = part.worldPositions[k + 2];
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
        output[k] = part.original[k];
        output[k + 1] = part.original[k + 1];
        output[k + 2] = part.original[k + 2];
        continue;
      }
      const nextX = x + (x - cx) * (scaleX - 1) * weight + cx * (draft.eyeSpacing - 1) * weight;
      const localX = (x - cx) / 0.067;
      const outer = THREE.MathUtils.clamp(localX * Math.sign(cx), -1, 1);
      const outerWeight = (outer + 1) * 0.5;
      const upperLidWeight = smoothstep(0.006, 0.035, y - cy);
      const open = profile.open * (1 - 0.91 * blink) * (profile.winkRight && cx > 0 ? profile.winkRight : 1);
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
  }
}

function shaderWithRestPosition(shader: { vertexShader: string; fragmentShader: string }) {
  // Stable source-geometry coordinates: decorations move WITH the ocular mesh
  // when the editor deforms eyes, instead of drifting in world space.
  shader.vertexShader = [
    "attribute vec3 aEyeRestPosition;",
    "varying vec3 vFaceRest;",
    shader.vertexShader,
  ].join("\n");
  shader.vertexShader = shader.vertexShader.replace(
    "#include <worldpos_vertex>",
    "#include <worldpos_vertex>\nvFaceRest = (modelMatrix * vec4(aEyeRestPosition, 1.0)).xyz;"
  );
  shader.fragmentShader = "varying vec3 vFaceRest;\n" + shader.fragmentShader;
}

function materialForIris(mesh: THREE.Mesh, index: number): IrisUniforms {
  const material = (mesh.material as THREE.MeshStandardMaterial).clone();
  const eye: IrisUniforms = {
    tint: { value: new THREE.Color("#94613f") },
    symbolTint: { value: new THREE.Color("#ffd16b") },
    style: { value: 0 },
    pupil: { value: 0.38 },
    radius: { value: 1 },
    center: { value: CENTERS[index] },
    pattern: { value: 0 },
  };
  material.onBeforeCompile = shader => {
    shaderWithRestPosition(shader);
    shader.uniforms.uIrisTint = eye.tint;
    shader.uniforms.uSymbolTint = eye.symbolTint;
    shader.uniforms.uIrisStyle = eye.style;
    shader.uniforms.uIrisPupil = eye.pupil;
    shader.uniforms.uIrisRadius = eye.radius;
    shader.uniforms.uIrisCenter = eye.center;
    shader.uniforms.uIrisPattern = eye.pattern;
    shader.fragmentShader =
      "uniform vec3 uIrisTint;\nuniform vec3 uSymbolTint;\nuniform float uIrisStyle;\nuniform float uIrisPupil;\nuniform float uIrisRadius;\nuniform vec2 uIrisCenter;\nuniform float uIrisPattern;\n"
      + shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <map_fragment>",
      "#include <map_fragment>\n" + [
        "// Apply color and iris style directly to the existing GLB UV atlas surface.",
        "vec2 irisDelta = vFaceRest.xy - uIrisCenter;",
        "float irisDist = length(irisDelta);",
        "float irisR = 0.029 * uIrisRadius;",
        "float irisMask = 1.0 - smoothstep(irisR * 0.90, irisR * 1.02, irisDist);",
        "float frontMask = smoothstep(0.235, 0.262, vFaceRest.z);",
        "float brightness = dot(diffuseColor.rgb, vec3(0.299,0.587,0.114));",
        "float preserveHighlight = 1.0 - smoothstep(0.54, 0.82, brightness);",
        "float angle = atan(irisDelta.y, irisDelta.x);",
        "float fiber = sin(angle * (uIrisStyle > 2.5 ? 124.0 : 66.0) + irisDist * 920.0);",
        "float fiberAmount = uIrisStyle < 0.5 ? 0.018 : uIrisStyle < 1.5 ? 0.20 : uIrisStyle < 2.5 ? 0.015 : 0.12;",
        "float retainedDetail = mix(0.55, 1.35, clamp(brightness * 2.7,0.0,1.0));",
        "vec3 irisColor = uIrisTint * retainedDetail * (1.0 + fiber * fiberAmount);",
        "float tintAmount = uIrisStyle < 0.5 ? 0.52 : 0.82;",
        "float pupilProtect = smoothstep(irisR * 0.23, irisR * 0.39, irisDist);",
        "diffuseColor.rgb = mix(diffuseColor.rgb, irisColor, irisMask * frontMask * preserveHighlight * tintAmount * pupilProtect);",
        // Preserve owner-approved dark pupil and highlight silhouette from real texture.
        "float pupilExpansion = 1.0 - smoothstep(irisR * uIrisPupil * 0.93, irisR * uIrisPupil * 1.10, irisDist);",
        "diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.008,0.006,0.010), pupilExpansion * frontMask * preserveHighlight * 0.75);",
        // The source GLB still has a full-size baked iris/pupil in its atlas.
        // At small irisScale, recoloring only the new disk exposes the old black
        // pupil/limbal ring outside it. Erase the SOURCE footprint in both modes
        // before redrawing the scaled iris. Do not erase at the default Classic
        // size: preserve the original owner's approved iris detail.
        "if (uIrisRadius < 0.999 || uIrisPattern > 0.5) {",
        "  float sourceFootprint = (1.0 - smoothstep(0.0300, 0.0380, irisDist)) * frontMask;",
        "  float scleraShade = 0.98 - 0.045 * smoothstep(0.019, 0.038, irisDist);",
        "  vec3 reconstructedSclera = vec3(0.91, 0.87, 0.88) * scleraShade;",
        "  diffuseColor.rgb = mix(diffuseColor.rgb, reconstructedSclera, sourceFootprint);",
        "  float newDisk = (1.0 - smoothstep(irisR * 0.93, irisR * 1.025, irisDist)) * frontMask;",
        "  float radial = irisDist / max(irisR, 0.00001);",
        "  float angleScaled = atan(irisDelta.y, irisDelta.x);",
        "  float fiberScaled = sin(angleScaled * 58.0 + radial * 31.0) * 0.055;",
        "  float rimShade = mix(1.08, 0.59, smoothstep(0.12, 1.0, radial));",
        "  vec3 scaledIris = uIrisTint * (rimShade + fiberScaled);",
        "  scaledIris = mix(scaledIris, scaledIris * 0.45, smoothstep(0.77, 0.98, radial));",
        "  diffuseColor.rgb = mix(diffuseColor.rgb, scaledIris, newDisk);",
        "  // Fantasy symbols replace the pupil; natural mode draws one NEW pupil.",
        "  if (uIrisPattern < 0.5) {",
        "    float newPupil = (1.0 - smoothstep(irisR * uIrisPupil * 0.92, irisR * uIrisPupil * 1.12, irisDist)) * frontMask;",
        "    diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.012, 0.008, 0.012), newPupil);",
        "  }",
        "}",
        // Fantasy mode preserves the chosen iris color and draws an independent
        // symbol tint on the SAME ocular mesh (not another shell or white iris).
        "if (uIrisPattern > 0.5) {",
        "  vec2 p = irisDelta / max(irisR, 0.00001);",
        "  float radiusP = length(p);",
        "  float angleP = atan(p.y, p.x);",
        "  float cover = (1.0 - smoothstep(0.90, 1.02, radiusP)) * frontMask;",
        "  float icon = 0.0;",
        "  if (uIrisPattern < 1.5) {",
        "    vec2 hp = vec2(p.x * 1.52, (p.y + 0.075) * 1.52);",
        "    float q = dot(hp,hp) - 1.0;",
        "    float heart = q*q*q - hp.x*hp.x*hp.y*hp.y*hp.y;",
        "    icon = 1.0 - smoothstep(-0.10, 0.055, heart);",
        "  } else if (uIrisPattern < 2.5) {",
        "    float edgeStar = 0.53 + 0.24 * cos(5.0 * (angleP - 1.5707963));",
        "    icon = 1.0 - smoothstep(edgeStar - 0.040, edgeStar + 0.040, radiusP);",
        "  } else if (uIrisPattern < 3.5) {",
        "    float xRay = (1.0 - smoothstep(0.035, 0.17, abs(p.x))) * (1.0 - smoothstep(0.34, 0.82, abs(p.y)));",
        "    float yRay = (1.0 - smoothstep(0.035, 0.17, abs(p.y))) * (1.0 - smoothstep(0.34, 0.82, abs(p.x)));",
        "    float jewel = 1.0 - smoothstep(0.19, 0.24, radiusP);",
        "    icon = max(jewel, max(xRay, yRay));",
        "  } else {",
        "    float spiralRidge = sin(angleP * 3.0 + radiusP * 28.0);",
        "    icon = smoothstep(0.60, 0.86, spiralRidge) * smoothstep(0.10, 0.18, radiusP) * (1.0 - smoothstep(0.75, 0.88, radiusP));",
        "  }",
        "  // Symbol color is independent from the iris palette.",
        "  vec3 symbolFill = uSymbolTint * (0.86 + 0.14 * max(0.0, dot(uSymbolTint, vec3(0.299,0.587,0.114))));",
        "  diffuseColor.rgb = mix(diffuseColor.rgb, symbolFill, icon * cover);",
        "  float glint = smoothstep(0.77, 0.96, brightness) * cover * (1.0 - icon * 0.85);",
        "  diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.95), glint * 0.40);",
        "}",

      ].join("\n")
    );
  };
  material.customProgramCacheKey = () => "audition-real-iris-shader-v16-source-iris-erase";
  mesh.material = material;
  return eye;
}

const ASSET_CACHE_NAME = "audition-face-lab-glb-v12-502ca471";

async function fetchCachedGLB(): Promise<{ bytes: ArrayBuffer; source: "cache" | "network" }> {
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
      await Promise.all(cacheNames.filter(name => name.startsWith("audition-face-lab-glb-") && name !== ASSET_CACHE_NAME)
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
  const lashNodes: THREE.Mesh[] = [];
  let disposed = false;
  let blinkAmount = 0;
  let blinkTimeout: number | null = null;
  let blinkFrame: number | null = null;
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
  const render = () => { if (!disposed) renderer.render(scene, camera); };
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
    deformEyes(morphs, draft, blinkAmount);
    for (const control of iris) {
      if (!control) continue;
      control.tint.value.set(draft.irisColor);
      control.symbolTint.value.set(draft.symbolColor);
      control.style.value = ["natural", "radiant", "velvet", "crystal"].indexOf(draft.irisStyleId);
      control.radius.value = draft.irisScale;
      control.pupil.value = draft.pupilScale;
      control.pattern.value = ["classic", "heart", "star", "sparkle", "spiral"].indexOf(draft.irisPatternId);
    }
    for (const lash of lashNodes) {
      lash.visible = draft.lashStyleId !== "none" && lash.name.includes("_" + draft.lashStyleId + "_V12");
    }
    host.dataset.lashModule = draft.lashStyleId;
    render();
  };

  const loader = new GLTFLoader();
  void fetchCachedGLB().then(async ({ bytes, source }) => {
    const gltf = await loader.parseAsync(bytes, "");
    cacheInfo(source);
    return gltf;
  }).then(gltf => {
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
      morphs.push({ mesh: object, original, worldPositions, inverse: object.matrixWorld.clone().invert(),
        affected: new Uint32Array(affectedIndices) });
      if (object.name === "Eye_L_OcularSurface_V1" || object.name === "Eye_R_OcularSurface_V1") {
        object.geometry.setAttribute("aEyeRestPosition", new THREE.BufferAttribute(original.slice(), 3));
      }
      if (object.name.startsWith("Eyelashes_") && object.name.endsWith("_V12")) {
        // Six separate geometry modules, two eyes for each of the three style variants.
        object.visible = false;
        lashNodes.push(object);
      }
      if (object.name === "Eye_L_OcularSurface_V1") iris[0] = materialForIris(object, 0);
      if (object.name === "Eye_R_OcularSurface_V1") iris[1] = materialForIris(object, 1);
      // Keep original baked eyelashes in the atlas unchanged until source mesh separation passes QA.
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
      setState("error");
    }
    return () => { instanceRef.current = null; instance?.dispose(); };
  }, []);
  useEffect(() => instanceRef.current?.apply(draft), [draft]);
  useEffect(() => instanceRef.current?.aim(view), [view, resetToken]);
  return (
    <div className={styles.viewport} ref={hostRef} data-testid="eye-preview" data-preview-status={state}>
      {state === "loading" && <div className={styles.previewNote}>Đang tải GLB Claude V2 + lông mi 3D (15,3 MB)…</div>}
      {state === "error" && <div className={styles.fallback}>Không thể tải GLB thật hoặc WebGL không khả dụng. Kiểm tra kết nối và tải lại.</div>}
      {state === "ready" && <span className={styles.viewportCaption}>1 ngón xoay · 2 ngón kéo/zoom · {cacheSource === "cache" ? "GLB từ browser cache" : "GLB từ CDN"}</span>}
    </div>
  );
}
