const CACHE_NAME = "audition-runtime-assets-v1";
const CACHE_PATH = "/__audition_runtime_asset_cache__/";

export type PersistentAssetFetchOptions = {
  cacheKey: string;
  forceRefresh?: boolean;
  request?: RequestInit;
};

function canUsePersistentCache() {
  return typeof window !== "undefined" && "caches" in window;
}

function cacheRequest(cacheKey: string) {
  const url = new URL(CACHE_PATH + encodeURIComponent(cacheKey), window.location.origin);
  return new Request(url.toString(), { method: "GET" });
}

/**
 * Fetches an immutable/versioned runtime asset once and persists the response in
 * Cache Storage. Cache failures are presentation-only: network loading remains
 * the fallback and gameplay timing is never derived from this layer.
 */
export async function fetchPersistentAsset(
  url: string,
  options: PersistentAssetFetchOptions,
): Promise<Response> {
  const requestInit: RequestInit = {
    ...options.request,
    method: options.request?.method ?? "GET",
  };

  if (!canUsePersistentCache() || requestInit.method !== "GET") {
    return fetch(url, requestInit);
  }

  let cache: Cache | null = null;
  let keyRequest: Request | null = null;
  try {
    cache = await window.caches.open(CACHE_NAME);
    keyRequest = cacheRequest(options.cacheKey);
    if (!options.forceRefresh) {
      const cached = await cache.match(keyRequest);
      if (cached) return cached.clone();
    }
  } catch (error) {
    console.warn("[asset-cache] persistent cache lookup unavailable", error);
  }

  const response = await fetch(url, {
    ...requestInit,
    cache: "no-store",
  });

  if (response.ok && cache && keyRequest) {
    try {
      await cache.put(keyRequest, response.clone());
    } catch (error) {
      console.warn("[asset-cache] unable to persist runtime asset", error);
    }
  }

  return response;
}

export const persistentRuntimeAssetCacheName = CACHE_NAME;

// Lightweight cache status check for the iPhone QA route. No personal profile
// or bearer tokens are ever written to Cache Storage.
export async function isPersistentAssetCached(cacheKey: string): Promise<boolean> {
  if (!canUsePersistentCache()) return false;
  try {
    const cache = await window.caches.open(CACHE_NAME);
    return Boolean(await cache.match(cacheRequest(cacheKey)));
  } catch { return false; }
}

/** Removes one immutable byte cache entry for isolated QA only. Never clears
 * audio cache, session cookies, account profiles or other users' cache. */
export async function removePersistentAssetCached(cacheKey: string): Promise<boolean> {
  if (!canUsePersistentCache()) return false;
  try {
    const cache = await window.caches.open(CACHE_NAME);
    return cache.delete(cacheRequest(cacheKey));
  } catch { return false; }
}
