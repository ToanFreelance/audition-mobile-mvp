import type { LocalAssetZip } from "./asset-lab-local-package";

let currentArchive: LocalAssetZip | null = null;
const listeners = new Set<(archive: LocalAssetZip | null) => void>();

export function getAssetLabSourceArchive() {
  return currentArchive;
}

export function setAssetLabSourceArchive(archive: LocalAssetZip | null) {
  currentArchive = archive;
  for (const listener of listeners) listener(currentArchive);
}

export function subscribeAssetLabSourceArchive(listener: (archive: LocalAssetZip | null) => void) {
  listeners.add(listener);
  listener(currentArchive);
  return () => {
    listeners.delete(listener);
  };
}
