import * as THREE from "three";
import { loadRuntimeAnimationBundle } from "./runtime-animation-bundle";

export const PUBLISHED_DANCE_BUNDLE_URL =
  "https://uaosdkrfxidiwqljmelg.supabase.co/functions/v1/p37-animation-publish";

const PUBLISHED_DANCE_CONNECT_TIMEOUT_MS = 8000;

const NORMAL_DANCE_SLOT_NAMES = [
  "HumanDance01",
  "HumanDance02",
  "HumanDance03",
  "HumanDance04",
  "HumanDance05",
  "HumanDance06",
  "HumanDance07",
  "HumanDance08",
] as const;

const NORMAL_DANCE_SLOT_KEYS = new Set(
  NORMAL_DANCE_SLOT_NAMES.map(name => name.toLowerCase()),
);

export const FINAL_DANCE_CLIP_PREFIX = "HumanFinalDance" as const;

export type PublishedDanceReleaseInfo = {
  releaseVersion: number;
  sourceAssetIds: readonly string[];
  sourceClipCount: number;
  normalSourceAssetIds: readonly string[];
  finalSourceAssetIds: readonly string[];
  idleSourceAssetIds: readonly string[];
};

export type LoadedPublishedDanceRelease = {
  normalSourceClips: THREE.AnimationClip[];
  finalSourceClips: THREE.AnimationClip[];
  idleSourceClips: THREE.AnimationClip[];
  info: PublishedDanceReleaseInfo;
};

export type PublishedDanceLibraryResult = {
  clips: THREE.AnimationClip[];
  release: PublishedDanceReleaseInfo | null;
};

let cachedPublishedDanceRelease: LoadedPublishedDanceRelease | null = null;

/**
 * Fetches and validates the latest canonical animation release. Failure stays
 * presentation-only and must never affect gameplay timing.
 */
export async function loadPublishedDanceRelease(forceRefresh = false): Promise<LoadedPublishedDanceRelease | null> {
  if (forceRefresh) cachedPublishedDanceRelease = null;
  if (cachedPublishedDanceRelease) return cachedPublishedDanceRelease;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), PUBLISHED_DANCE_CONNECT_TIMEOUT_MS);
  let responseReceived = false;

  try {
    const response = await fetch(PUBLISHED_DANCE_BUNDLE_URL, {
      method: "GET",
      cache: "no-store",
      headers: { Accept: "application/json" },
      signal: controller.signal,
    });

    responseReceived = true;
    clearTimeout(timeout);

    if (!response.ok) {
      throw new Error(`published animation endpoint returned ${response.status}`);
    }

    const bundle = loadRuntimeAnimationBundle(await response.json());
    if (bundle.manifest.status !== "published") {
      throw new Error("latest animation bundle is not published");
    }
    const releaseVersion = bundle.manifest.releaseVersion;
    if (!releaseVersion) {
      throw new Error("published animation release has no releaseVersion");
    }

    const normalSourceAssetIds = bundle.manifest.normalIds.filter(id => bundle.clipsByAssetId.has(id));
    const finalSourceAssetIds = bundle.manifest.finalIds.filter(id => bundle.clipsByAssetId.has(id));
    const idleSourceAssetIds = bundle.manifest.idleIds.filter(id => bundle.clipsByAssetId.has(id));
    if (normalSourceAssetIds.length === 0) {
      throw new Error("published animation release contains no usable normal clips");
    }

    const normalSourceClips = normalSourceAssetIds.map(id => bundle.clipsByAssetId.get(id) as THREE.AnimationClip);
    const finalSourceClips = finalSourceAssetIds.map(id => bundle.clipsByAssetId.get(id) as THREE.AnimationClip);
    const idleSourceClips = idleSourceAssetIds.map(id => bundle.clipsByAssetId.get(id) as THREE.AnimationClip);
    const sourceAssetIds = [...new Set([...normalSourceAssetIds, ...finalSourceAssetIds, ...idleSourceAssetIds])];

    console.info(
      `[character] published Mixamo release v${releaseVersion} loaded: ${normalSourceAssetIds.length} normal · ${finalSourceAssetIds.length} final · ${idleSourceAssetIds.length} idle`,
    );

    const loaded: LoadedPublishedDanceRelease = {
      normalSourceClips,
      finalSourceClips,
      idleSourceClips,
      info: {
        releaseVersion,
        sourceAssetIds,
        sourceClipCount: sourceAssetIds.length,
        normalSourceAssetIds,
        finalSourceAssetIds,
        idleSourceAssetIds,
      },
    };
    cachedPublishedDanceRelease = loaded;
    return loaded;
  } catch (error) {
    console.warn(
      "[character] published animation release unavailable; keeping built-in presentation fallback",
      error,
    );
    return null;
  } finally {
    if (!responseReceived) clearTimeout(timeout);
  }
}

/**
 * Replaces normal successful-turn dance slots and installs zero or more Final
 * variants. Published Idle clips stay exposed through loadPublishedDanceRelease
 * for Waiting Room use and do not replace Solo gameplay Idle automatically.
 */
export function applyPublishedDanceRelease(
  baseClips: THREE.AnimationClip[],
  published: LoadedPublishedDanceRelease,
): PublishedDanceLibraryResult {
  const replacementSlots = NORMAL_DANCE_SLOT_NAMES.map((slotName, index) => {
    const source = published.normalSourceClips[index % published.normalSourceClips.length];
    const clip = source.clone();
    clip.name = slotName;
    return clip;
  });

  const finalVariants = published.finalSourceClips.map((source, index) => {
    const clip = source.clone();
    clip.name = `${FINAL_DANCE_CLIP_PREFIX}${String(index + 1).padStart(2, "0")}`;
    return clip;
  });

  const retained = baseClips.filter(clip => {
    const key = clip.name.toLowerCase();
    return !NORMAL_DANCE_SLOT_KEYS.has(key) && !key.startsWith(FINAL_DANCE_CLIP_PREFIX.toLowerCase());
  });
  return {
    clips: [...retained, ...replacementSlots, ...finalVariants],
    release: published.info,
  };
}

export async function preferPublishedDanceRelease(
  baseClips: THREE.AnimationClip[],
): Promise<PublishedDanceLibraryResult> {
  const published = await loadPublishedDanceRelease();
  if (!published) return { clips: baseClips, release: null };
  return applyPublishedDanceRelease(baseClips, published);
}
