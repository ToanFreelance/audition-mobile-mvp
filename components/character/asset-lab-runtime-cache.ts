import { P37_DANCE_POOL_SOURCE_VERSION } from "./animation-pool";
import type { RuntimeAnimationBundleClipJson } from "./runtime-animation-bundle";

const DB_NAME = "audition-asset-lab";
const DB_VERSION = 1;
const STORE_NAME = "p37-runtime-clips";

type CachedRuntimeClip = {
  key: string;
  sourceVersion: typeof P37_DANCE_POOL_SOURCE_VERSION;
  storedAt: string;
  record: RuntimeAnimationBundleClipJson;
};

export async function getCachedRuntimeClip(assetId: string) {
  const db = await openDb();
  if (!db) return null;
  const cached = await requestResult<CachedRuntimeClip | undefined>(
    db.transaction(STORE_NAME, "readonly").objectStore(STORE_NAME).get(cacheKey(assetId)),
  );
  db.close();
  if (!cached || cached.sourceVersion !== P37_DANCE_POOL_SOURCE_VERSION) return null;
  return cached.record;
}

export async function putCachedRuntimeClip(record: RuntimeAnimationBundleClipJson) {
  const db = await openDb();
  if (!db) return;
  const tx = db.transaction(STORE_NAME, "readwrite");
  tx.objectStore(STORE_NAME).put({
    key: cacheKey(record.assetId),
    sourceVersion: P37_DANCE_POOL_SOURCE_VERSION,
    storedAt: new Date().toISOString(),
    record,
  } satisfies CachedRuntimeClip);
  await transactionDone(tx);
  db.close();
}

export async function listCachedRuntimeClips(assetIds: readonly string[]) {
  const entries = await Promise.all(assetIds.map(async assetId => [assetId, await getCachedRuntimeClip(assetId)] as const));
  return new Map(entries.filter((entry): entry is readonly [string, RuntimeAnimationBundleClipJson] => entry[1] !== null));
}

function cacheKey(assetId: string) {
  return `${P37_DANCE_POOL_SOURCE_VERSION}:${assetId}`;
}

function openDb(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === "undefined") return Promise.resolve(null);
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) db.createObjectStore(STORE_NAME, { keyPath: "key" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Failed to open Asset Lab runtime cache"));
  });
}

function requestResult<T>(request: IDBRequest<T>) {
  return new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("IndexedDB request failed"));
  });
}

function transactionDone(tx: IDBTransaction) {
  return new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("IndexedDB transaction failed"));
    tx.onabort = () => reject(tx.error ?? new Error("IndexedDB transaction aborted"));
  });
}
