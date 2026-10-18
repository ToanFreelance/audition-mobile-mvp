import * as THREE from "three";
import { loadRuntimeAnimationBundle } from "./runtime-animation-bundle";
import { fetchPersistentAsset } from "../../lib/persistent-asset-cache";
import { fetchPublishedAnimationJson, PublishedAnimationTransportError } from "./published-animation-transport";
import { P37_DANCE_POOL_ID, P37_DANCE_POOL_VERSION, P37_DANCE_POOL_SOURCE_VERSION } from "./animation-pool";

export const PUBLISHED_DANCE_BUNDLE_URL =
  "https://uaosdkrfxidiwqljmelg.supabase.co/functions/v1/p37-animation-publish";
export const PUBLISHED_DANCE_MANIFEST_URL = PUBLISHED_DANCE_BUNDLE_URL + "?manifest=1";

const PUBLISHED_DANCE_MANIFEST_TIMEOUT_MS = 8000;
// A versioned bundle contains all clips, so its deadline must not share the
// lightweight manifest's short timeout or be reused by a fallback request.
const PUBLISHED_DANCE_BUNDLE_TIMEOUT_MS = 16000;

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


/**
 * START requires a frozen content identity, not the 10 MB published clip JSON.
 * The lightweight published manifest carries the same ordered role IDs used by
 * loadPublishedDanceRelease(). Full pinned clip validation stays in PRELOADING.
 */
export async function loadPublishedDanceReleaseIdentity(): Promise<{
  releaseVersion: number;
  sourceAssetIds: readonly string[];
} | null> {
  let result: unknown;
  try {
    result = await fetchPublishedAnimationJson(
      signal => fetch(PUBLISHED_DANCE_MANIFEST_URL, {
        method: "GET", cache: "no-cache",
        headers: { Accept: "application/json" }, signal,
      }),
      "manifest", PUBLISHED_DANCE_MANIFEST_TIMEOUT_MS,
    );
  } catch (error) {
    // Explicit 404 means no published release: retain the existing built-in
    // v0 identity. Transient errors must not silently change frozen content.
    if (error instanceof PublishedAnimationTransportError
      && error.message.includes("HTTP 404")) return null;
    throw error;
  }
  if (!result || typeof result !== "object" || Array.isArray(result)) {
    throw new Error("Published animation identity manifest is invalid.");
  }
  const manifest = result as Record<string, unknown>;
  if (manifest.schemaVersion !== 1
    || manifest.poolId !== P37_DANCE_POOL_ID
    || manifest.poolVersion !== P37_DANCE_POOL_VERSION
    || manifest.sourceVersion !== P37_DANCE_POOL_SOURCE_VERSION) {
    throw new Error("Published animation identity manifest version mismatch.");
  }
  if (!Number.isInteger(manifest.releaseVersion) || Number(manifest.releaseVersion) <= 0) {
    throw new Error("Published animation identity has no valid releaseVersion.");
  }
  const isIds = (ids: unknown): ids is string[] =>
    Array.isArray(ids)
    && ids.every(id => typeof id === "string" && id.length > 0)
    && new Set(ids).size === ids.length;
  const { normalIds, finalIds, idleIds, approvedIds } = manifest;
  if (!isIds(normalIds) || normalIds.length === 0 || !isIds(finalIds)
    || !isIds(idleIds) || !isIds(approvedIds)) {
    throw new Error("Published animation identity has invalid role IDs.");
  }
  // Keep ordered de-duplication bit-identical to published clip resolution.
  const sourceAssetIds = [...new Set([...normalIds, ...finalIds, ...idleIds])];
  if (manifest.clipCount !== sourceAssetIds.length
    || sourceAssetIds.some(id => !approvedIds.includes(id))) {
    throw new Error("Published animation identity clip inventory mismatch.");
  }
  return { releaseVersion: Number(manifest.releaseVersion), sourceAssetIds };
}

export type PublishedDanceLibraryResult = {
  clips: THREE.AnimationClip[];
  release: PublishedDanceReleaseInfo | null;
};

let cachedPublishedDanceRelease: LoadedPublishedDanceRelease | null = null;

/**
 * Fetches a versioned immutable animation bundle. A retry uses a new signal
 * and refreshes the cached response only on the retry attempt.
 */
async function fetchVersionedDanceBundle(releaseVersion: number, forceRefresh: boolean) {
  return fetchPublishedAnimationJson(
    (signal, attempt) => fetchPersistentAsset(
      PUBLISHED_DANCE_BUNDLE_URL + "?release=" + releaseVersion,
      {
        cacheKey: "animation-full-release:" + releaseVersion,
        forceRefresh: forceRefresh || attempt > 0,
        request: { headers: { Accept: "application/json" }, signal },
      },
    ),
    "release v" + releaseVersion,
    PUBLISHED_DANCE_BUNDLE_TIMEOUT_MS,
  );
}

/**
 * Optional presentation callers may fall back to built-in clips. Frozen
 * multiplayer preload MUST request the exact manifest release and propagate
 * an unavailable transport error rather than invent releaseVersion 0.
 */
export async function loadPublishedDanceRelease(
  forceRefresh = false,
  frozenReleaseVersion?: number,
): Promise<LoadedPublishedDanceRelease | null> {
  if (frozenReleaseVersion !== undefined
    && (!Number.isInteger(frozenReleaseVersion) || frozenReleaseVersion <= 0)) {
    throw new Error("Invalid frozen published animation release version.");
  }
  if (forceRefresh) cachedPublishedDanceRelease = null;
  if (cachedPublishedDanceRelease
    && (frozenReleaseVersion === undefined
      || cachedPublishedDanceRelease.info.releaseVersion === frozenReleaseVersion)) {
    return cachedPublishedDanceRelease;
  }

  try {
    let expectedReleaseVersion: number | null = frozenReleaseVersion ?? null;
    let bundleJson: unknown;

    if (expectedReleaseVersion === null) {
      // Non-match presentation calls can resolve the latest manifest. Frozen
      // multiplayer sessions never consult 'latest' after START.
      try {
        const manifest = await fetchPublishedAnimationJson(
          signal => fetch(PUBLISHED_DANCE_MANIFEST_URL, {
            method: "GET",
            cache: "no-cache",
            headers: { Accept: "application/json" },
            signal,
          }),
          "manifest",
          PUBLISHED_DANCE_MANIFEST_TIMEOUT_MS,
        ) as Record<string, unknown>;
        const releaseVersion = Number(manifest.releaseVersion ?? 0);
        if (!Number.isInteger(releaseVersion) || releaseVersion <= 0) {
          throw new Error("published animation manifest has no valid releaseVersion");
        }
        expectedReleaseVersion = releaseVersion;
      } catch (manifestError) {
        console.warn(
          "[character] lightweight animation manifest unavailable; falling back to legacy bundle endpoint",
          manifestError,
        );
        // An unavailable manifest does not make its AbortSignal reusable.
        bundleJson = await fetchPublishedAnimationJson(
          signal => fetch(PUBLISHED_DANCE_BUNDLE_URL, {
            method: "GET",
            cache: "default",
            headers: { Accept: "application/json" },
            signal,
          }),
          "legacy bundle",
          PUBLISHED_DANCE_BUNDLE_TIMEOUT_MS,
        );
      }
    }

    if (bundleJson === undefined && expectedReleaseVersion !== null) {
      bundleJson = await fetchVersionedDanceBundle(expectedReleaseVersion, forceRefresh);
    }
    const bundle = loadRuntimeAnimationBundle(bundleJson);
    if (bundle.manifest.status !== "published") {
      throw new Error("latest animation bundle is not published");
    }
    const releaseVersion = bundle.manifest.releaseVersion;
    if (!releaseVersion) {
      throw new Error("published animation release has no releaseVersion");
    }
    if (expectedReleaseVersion !== null && releaseVersion !== expectedReleaseVersion) {
      throw new Error(
        "published animation release mismatch: manifest v" + expectedReleaseVersion + ", bundle v" + releaseVersion,
      );
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
      "[character] published Mixamo release v" + releaseVersion + " loaded: "
        + normalSourceAssetIds.length + " normal · "
        + finalSourceAssetIds.length + " final · "
        + idleSourceAssetIds.length + " idle",
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
    // A frozen match cannot silently substitute built-in clips/release 0.
    // The immutable hash/version check remains authoritative after delivery.
    if (frozenReleaseVersion !== undefined) throw error;
    console.warn(
      "[character] published animation release unavailable; keeping built-in presentation fallback",
      error,
    );
    return null;
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
