import type { CharacterAssetId, M3RigFamily } from "./character-catalog";
import { getCharacterCatalogEntry } from "./character-catalog";
import { getM3CreatorWardrobeForFamily } from "./m3-creator-outfits";
import { fetchPersistentAsset, isPersistentAssetCached } from "../../lib/persistent-asset-cache";

// All files in this manifest are PUBLIC immutable game artwork, never profile or
// account data. Bump this revision if the upstream M3 files change.
export const M3_ASSET_CACHE_REVISION = "owner-m3-v1.7.2-cache-20261122";
const SOURCE = "https://raw.githubusercontent.com/memelotsqui/character-assets/main/";
const FALLBACK = "https://cdn.jsdelivr.net/gh/memelotsqui/character-assets@main/";
export const M3_ASSET_SOURCE = SOURCE;
/** Public V14 animation pack. This text file is separately cached; the
 * compressed Mixamo JS chunks retain the browser's native hashed-asset cache. */
export const M3_GREETING_CACHE_KEY = "m3:standing-greeting-v14:8ab3d94aaa0b6bfa";
export async function warmM3GreetingAsset(): Promise<void> {
  if (typeof window === "undefined" || !("caches" in window)) return;
  if (await isPersistentAssetCached(M3_GREETING_CACHE_KEY)) return;
  const response = await fetchPersistentAsset("/m3-qa/standing_greeting_2_v14.b64", {
    cacheKey: M3_GREETING_CACHE_KEY,
  });
  if (!response.ok) throw new Error("M3 Greeting V14 not available");
  // Consume this small 7.7 KB response so its body can be reclaimed.
  await response.arrayBuffer();
}
export const M3_FAMILIES = {
  drophunter: {
    body: "body/drophunter.vrm", eyes: "eyes/regulareyes.vrm",
    top: "chest/shirt.vrm", bottom: "legs/casualshorts.vrm", shoes: "feet/sneakers.vrm",
    hair: ["short", "curledbangs", "ponytail", "buns"],
  },
  neurohacker: {
    body: "body/neurohacker.vrm", eyes: "eyes/regulareyes.vrm",
    top: "chest/logotee.vrm", bottom: "legs/cargoshorts.vrm", shoes: "foot/simpleshoes.vrm",
    hair: ["short", "hair1", "hair2", "hair3"],
  },
} as const;

const SKINS = ["originalskin", "tone1skin", "tone2skin", "tone3skin", "tone4skin"] as const;
export type M3SelectedAppearance = {
  hairStyle: string; hairColor: string; skinTone: string;
  m3Outfit?: { top: string; bottom: string };
};
export type M3AssetFile = { family: M3RigFamily; file: string; type: "vrm" | "texture" };
const active = new Map<string, Promise<ArrayBuffer>>();

export function m3SkinFiles(family: M3RigFamily, id: string): readonly string[] {
  const i = SKINS.indexOf(id as typeof SKINS[number]);
  if (i < 0) throw new Error("M3 skin tone not in source catalog: " + id);
  const suffix = i === 0 ? "alt" : String(i);
  const files = [
    "_textureCollections/skin/Anime_Proj_base_NoClothes_skin_BaseColor" + suffix + ".png",
    "_textureCollections/skin/Anime_Proj_base_NoClothes_Face_BaseColor" + suffix + ".png",
  ];
  if (family === "neurohacker") files.push(
    "_textureCollections/skin/" + (i ? "skin" + i : "original") + "_mouth.png");
  return files;
}

/** Only the selected account's rig/outfit/skin is prewarmed. No unused variants. */
export function m3SelectedAssetFiles(assetId: CharacterAssetId, look: M3SelectedAppearance): M3AssetFile[] {
  const entry = getCharacterCatalogEntry(assetId);
  if (!entry?.m3RigFamily || !entry.creatorReady) throw new Error("Unknown M3 rig");
  const family = entry.m3RigFamily;
  const parts = M3_FAMILIES[family];
  const wardrobe = getM3CreatorWardrobeForFamily(family);
  const chosen = look.m3Outfit ?? wardrobe.defaultOutfit;
  const top = wardrobe.top.find(x => x.id === chosen.top);
  const bottom = wardrobe.bottom.find(x => x.id === chosen.bottom);
  if (!top || !bottom ||
      !parts.hair.includes(look.hairStyle as never) ||
      !entry.appearance.hairColors.some(x => x.id === look.hairColor && x.available) ||
      !entry.appearance.skinTones.some(x => x.id === look.skinTone && x.available)) {
    throw new Error("Invalid M3 appearance for selected rig");
  }
  const vrms = [
    parts.body, parts.eyes, top.file, bottom.file, wardrobe.shoes.file,
    "head/" + look.hairStyle + ".vrm",
  ];
  const textures = look.skinTone === "originalskin" ? [] : m3SkinFiles(family, look.skinTone);
  return [
    ...vrms.map(file => ({ family, file, type: "vrm" as const })),
    ...textures.map(file => ({ family, file, type: "texture" as const })),
  ];
}

export function m3CacheKey(family: M3RigFamily, file: string): string {
  // File comes only from our closed catalog; no account ID, email or secrets.
  return "m3-vrm:" + M3_ASSET_CACHE_REVISION + ":" + family + ":" + file;
}

function validContent(file: string, data: ArrayBuffer): boolean {
  if (file.endsWith(".vrm")) {
    // VRM 0.x/1.x both use GLB container; glTF header magic ASCII 'glTF'.
    return data.byteLength >= 20 && new DataView(data).getUint32(0, true) === 0x46546c67;
  }
  if (file.endsWith(".png")) {
    if (data.byteLength < 32) return false;
    const view = new DataView(data);
    return view.getUint32(0, false) === 0x89504e47 && view.getUint32(4, false) === 0x0d0a1a0a;
  }
  return false;
}

/** Cache-first bytes shared by Creator and Waiting Room. Parse fresh THREE
 * objects for each actor; NEVER share mutable skeletons or disposable GPU data.
 * A corrupt cached file is refreshed, then CDN fallback is attempted.
 */
export async function loadM3AssetBytes(family: M3RigFamily, file: string): Promise<ArrayBuffer> {
  const key = m3CacheKey(family, file);
  const pending = active.get(key);
  if (pending) return pending;
  const task = (async () => {
    let lastError: unknown;
    for (const [index, host] of [SOURCE, FALLBACK].entries()) {
      try {
        const response = await fetchPersistentAsset(host + family + "/" + file, {
          cacheKey: key, forceRefresh: index > 0,
        });
        if (!response.ok) throw new Error("M3 asset HTTP " + response.status);
        const buffer = await response.arrayBuffer();
        if (!validContent(file, buffer)) throw new Error("Corrupt M3 asset: " + file);
        return buffer;
      } catch (cause) { lastError = cause; }
    }
    throw lastError ?? new Error("M3 asset unavailable");
  })();
  active.set(key, task);
  try { return await task; }
  finally { active.delete(key); }
}

export async function warmM3AppearanceAssets(
  assetId: CharacterAssetId, look: M3SelectedAppearance,
): Promise<void> {
  if (typeof window === "undefined" || !("caches" in window)) return;
  const files = m3SelectedAssetFiles(assetId, look);
  // Repeat logins should not read full cached VRMs into JS memory just to
  // prewarm. The assembler still validates/decodes the bytes on actual use.
  // Low concurrency: iPhone VRM files are large.
  let cursor = 0;
  await Promise.all([0, 1].map(async () => {
    while (cursor < files.length) {
      const item = files[cursor++];
      if (await isPersistentAssetCached(m3CacheKey(item.family, item.file))) continue;
      await loadM3AssetBytes(item.family, item.file);
    }
  }));
}

export async function inspectM3AppearanceCache(
  assetId: CharacterAssetId, look: M3SelectedAppearance,
): Promise<{ cached: number; total: number; entries: { file: string; cached: boolean }[] }> {
  const files = m3SelectedAssetFiles(assetId, look);
  const entries = await Promise.all(files.map(async item => ({
    file: item.family + "/" + item.file,
    cached: await isPersistentAssetCached(m3CacheKey(item.family, item.file)),
  })));
  return { cached: entries.filter(x => x.cached).length, total: entries.length, entries };
}
