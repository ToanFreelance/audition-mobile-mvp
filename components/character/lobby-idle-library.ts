import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { HUMAN_ANIMATION_LIBRARY_URL } from "./human-animation-library";
import { loadRuntimeAnimationBundle } from "./runtime-animation-bundle";

export const PUBLISHED_IDLE_BUNDLE_URL =
  "https://uaosdkrfxidiwqljmelg.supabase.co/functions/v1/p37-animation-publish-idle";

const IDLE_FETCH_TIMEOUT_MS = 12_000;
const IDLE_RETRY_DELAY_MS = 650;

export type LobbyIdleLibrary = {
  clips: readonly THREE.AnimationClip[];
  releaseVersion: number;
  source: "published" | "builtin";
};

let cachedLobbyIdleLibrary: LobbyIdleLibrary | null = null;
let lobbyIdlePromise: Promise<LobbyIdleLibrary | null> | null = null;

function disposeLibraryScene(root: THREE.Object3D) {
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  const textures = new Set<THREE.Texture>();

  root.traverse(object => {
    const mesh = object as THREE.Mesh;
    if (mesh.geometry) geometries.add(mesh.geometry);
    const meshMaterials = Array.isArray(mesh.material)
      ? mesh.material
      : mesh.material
        ? [mesh.material]
        : [];
    for (const material of meshMaterials) {
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

async function fetchPublishedIdleLibrary() {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), IDLE_FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(PUBLISHED_IDLE_BUNDLE_URL, {
      method: "GET",
      cache: "default",
      headers: { Accept: "application/json" },
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new Error(`published idle endpoint returned ${response.status}`);
    }

    const bundle = loadRuntimeAnimationBundle(await response.json());
    if (bundle.manifest.status !== "published") {
      throw new Error("latest idle bundle is not published");
    }
    const releaseVersion = bundle.manifest.releaseVersion ?? 0;
    const idleIds = bundle.manifest.idleIds;
    const clips = idleIds
      .map(id => bundle.clipsByAssetId.get(id))
      .filter((clip): clip is THREE.AnimationClip => Boolean(clip));

    if (!releaseVersion || clips.length !== idleIds.length || clips.length === 0) {
      throw new Error("published idle bundle has no usable Idle clips");
    }

    return {
      clips,
      releaseVersion,
      source: "published" as const,
    };
  } finally {
    window.clearTimeout(timeout);
  }
}

async function loadBuiltInIdleFallback(): Promise<LobbyIdleLibrary> {
  const loader = new GLTFLoader();
  const library = await loader.loadAsync(HUMAN_ANIMATION_LIBRARY_URL);
  try {
    const idle = library.animations.find(clip => clip.name.toLowerCase() === "idle_loop");
    if (!idle) throw new Error("Quaternius animation library is missing Idle_Loop");
    const clip = idle.clone();
    clip.name = "LobbyIdleFallback";
    return {
      clips: [clip],
      releaseVersion: 0,
      source: "builtin",
    };
  } finally {
    disposeLibraryScene(library.scene);
  }
}

/**
 * Waiting-room-only animation loader.
 *
 * The lobby never downloads the full published dance bundle. It first requests
 * the idle-only projection, retries one transient failure, then falls back to
 * the small rig-compatible Quaternius Idle_Loop so a network hiccup cannot
 * leave actors permanently in T-pose.
 */
export async function loadLobbyIdleLibrary(): Promise<LobbyIdleLibrary | null> {
  if (cachedLobbyIdleLibrary) return cachedLobbyIdleLibrary;
  if (lobbyIdlePromise) return lobbyIdlePromise;

  lobbyIdlePromise = (async () => {
    let lastError: unknown = null;
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        const published = await fetchPublishedIdleLibrary();
        cachedLobbyIdleLibrary = published;
        return published;
      } catch (error) {
        lastError = error;
        if (attempt === 0) {
          await new Promise(resolve => window.setTimeout(resolve, IDLE_RETRY_DELAY_MS));
        }
      }
    }

    console.warn("[waiting-room] published Idle bundle unavailable; using built-in Idle_Loop", lastError);
    try {
      const fallback = await loadBuiltInIdleFallback();
      cachedLobbyIdleLibrary = fallback;
      return fallback;
    } catch (error) {
      console.warn("[waiting-room] built-in Idle fallback unavailable", error);
      return null;
    }
  })().finally(() => {
    lobbyIdlePromise = null;
  });

  return lobbyIdlePromise;
}
