import * as THREE from "three";
import { loadRuntimeAnimationBundle } from "./runtime-animation-bundle";

export const PUBLISHED_DANCE_BUNDLE_URL =
  "https://uaosdkrfxidiwqljmelg.supabase.co/functions/v1/p37-animation-publish";

const PUBLISHED_DANCE_FETCH_TIMEOUT_MS = 3500;

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

export type PublishedDanceReleaseInfo = {
  releaseVersion: number;
  sourceAssetIds: readonly string[];
  sourceClipCount: number;
};

export type LoadedPublishedDanceRelease = {
  sourceClips: THREE.AnimationClip[];
  info: PublishedDanceReleaseInfo;
};

export type PublishedDanceLibraryResult = {
  clips: THREE.AnimationClip[];
  release: PublishedDanceReleaseInfo | null;
};

/**
 * Fetches and validates the latest canonical published P3.7 dance release.
 * Failure is intentionally soft because character presentation must retain its
 * built-in human-library fallback and must never affect gameplay timing.
 */
export async function loadPublishedDanceRelease(): Promise<LoadedPublishedDanceRelease | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), PUBLISHED_DANCE_FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(PUBLISHED_DANCE_BUNDLE_URL, {
      method: "GET",
      cache: "no-store",
      headers: { Accept: "application/json" },
      signal: controller.signal,
    });
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

    const sourceAssetIds = bundle.manifest.processingIds.filter(id => bundle.clipsByAssetId.has(id));
    if (sourceAssetIds.length === 0) {
      throw new Error("published animation release contains no usable clips");
    }

    const sourceClips = sourceAssetIds.map(id => bundle.clipsByAssetId.get(id) as THREE.AnimationClip);
    console.info(
      `[character] published Mixamo dance release v${releaseVersion} loaded: ${sourceAssetIds.join(", ")}`,
    );

    return {
      sourceClips,
      info: {
        releaseVersion,
        sourceAssetIds,
        sourceClipCount: sourceClips.length,
      },
    };
  } catch (error) {
    console.warn(
      "[character] published dance release unavailable; keeping built-in human dance fallback",
      error,
    );
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Replaces only the normal successful-turn dance slots. Idle, miss and Finish
 * remain owned by the human animation library.
 */
export function applyPublishedDanceRelease(
  baseClips: THREE.AnimationClip[],
  published: LoadedPublishedDanceRelease,
): PublishedDanceLibraryResult {
  const replacementSlots = NORMAL_DANCE_SLOT_NAMES.map((slotName, index) => {
    const source = published.sourceClips[index % published.sourceClips.length];
    const clip = source.clone();
    clip.name = slotName;
    return clip;
  });

  const retained = baseClips.filter(clip => !NORMAL_DANCE_SLOT_KEYS.has(clip.name.toLowerCase()));
  return {
    clips: [...retained, ...replacementSlots],
    release: published.info,
  };
}

/** Backward-compatible helper for callers that already have a complete fallback library. */
export async function preferPublishedDanceRelease(
  baseClips: THREE.AnimationClip[],
): Promise<PublishedDanceLibraryResult> {
  const published = await loadPublishedDanceRelease();
  if (!published) return { clips: baseClips, release: null };
  return applyPublishedDanceRelease(baseClips, published);
}
