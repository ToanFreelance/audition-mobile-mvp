import * as THREE from "three";
import { loadRuntimeAnimationBundle } from "./runtime-animation-bundle";

export const PUBLISHED_DANCE_BUNDLE_URL =
  "https://uaosdkrfxidiwqljmelg.supabase.co/functions/v1/p37-animation-publish";

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

export type PublishedDanceLibraryResult = {
  clips: THREE.AnimationClip[];
  release: PublishedDanceReleaseInfo | null;
};

/**
 * Replaces only the normal successful-turn dance slots with the latest
 * canonical published P3.7 release. Idle, miss and Finish remain owned by the
 * existing human animation library.
 *
 * Failure is intentionally soft: presentation falls back to the checked-in
 * human library and gameplay timing remains unaffected.
 */
export async function preferPublishedDanceRelease(
  baseClips: THREE.AnimationClip[],
): Promise<PublishedDanceLibraryResult> {
  try {
    const response = await fetch(PUBLISHED_DANCE_BUNDLE_URL, {
      method: "GET",
      cache: "no-store",
      headers: { Accept: "application/json" },
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
    const replacementSlots = NORMAL_DANCE_SLOT_NAMES.map((slotName, index) => {
      const source = sourceClips[index % sourceClips.length];
      const clip = source.clone();
      clip.name = slotName;
      return clip;
    });

    const retained = baseClips.filter(clip => !NORMAL_DANCE_SLOT_KEYS.has(clip.name.toLowerCase()));
    const clips = [...retained, ...replacementSlots];

    console.info(
      `[character] published Mixamo dance release v${releaseVersion} loaded: ${sourceAssetIds.join(", ")}`,
    );

    return {
      clips,
      release: {
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
    return { clips: baseClips, release: null };
  }
}
