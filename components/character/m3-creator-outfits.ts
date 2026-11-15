import { getCharacterCatalogEntry, type M3RigFamily } from "./character-catalog";

/**
 * Curated creation-time clothing only (NOT Inventory/Shop).
 * Source paths verified against memelotsqui/character-assets manifests.
 * Never mix donor assets between Drophunter and Neurohacker rigs.
 */
export type M3CreatorOutfit = Readonly<{ top: string; bottom: string }>;
export type M3CreatorGarment = Readonly<{ id: string; label: string; file: string; thumbnail: string }>;
export type M3CreatorWardrobe = Readonly<{
  top: readonly M3CreatorGarment[];
  bottom: readonly M3CreatorGarment[];
  shoes: M3CreatorGarment;
  defaultOutfit: M3CreatorOutfit;
}>;

const WARDROBES: Record<M3RigFamily, M3CreatorWardrobe> = {
  drophunter: {
    top: [
      { id: "shirt", label: "Áo thường", file: "chest/shirt.vrm", thumbnail: "chest/shirt/Shirt-icon0.png" },
      { id: "lightshirt", label: "Áo nhẹ", file: "chest/lightshirt.vrm", thumbnail: "chest/lightshirt/Light Shirt-icon0.png" },
    ],
    bottom: [
      { id: "casualshorts", label: "Quần ngắn", file: "legs/casualshorts.vrm", thumbnail: "legs/casualshorts/Casual Shorts-icon0.png" },
      { id: "sportshorts", label: "Quần thể thao", file: "legs/sportshorts.vrm", thumbnail: "legs/sportshorts/Sport Shorts-icon0.png" },
    ],
    shoes: { id: "sneakers", label: "Sneakers cơ bản", file: "feet/sneakers.vrm", thumbnail: "feet/sneakers.png" },
    defaultOutfit: { top: "shirt", bottom: "casualshorts" },
  },
  neurohacker: {
    top: [
      { id: "logotee", label: "Áo T-shirt", file: "chest/logotee.vrm", thumbnail: "chest/logotee/Logo Tee-icon0.png" },
      { id: "simpleshirt", label: "Áo thường", file: "chest/simpleshirt.vrm", thumbnail: "chest/simpleshirt/Simple Shirt-icon0.png" },
    ],
    bottom: [
      { id: "cargoshorts", label: "Cargo Shorts", file: "legs/cargoshorts.vrm", thumbnail: "legs/cargoshorts/Cargoshorts-icon0.png" },
      { id: "shorts", label: "Quần ngắn", file: "legs/shorts.vrm", thumbnail: "legs/shorts/Shorts-icon0.png" },
    ],
    shoes: { id: "simpleshoes", label: "Giày cơ bản", file: "foot/simpleshoes.vrm", thumbnail: "foot/simpleshoes.png" },
    defaultOutfit: { top: "logotee", bottom: "cargoshorts" },
  },
};

export function getM3CreatorWardrobeForFamily(family: M3RigFamily): M3CreatorWardrobe {
  return WARDROBES[family];
}

export function getM3CreatorWardrobe(assetId: string): M3CreatorWardrobe | null {
  const family = getCharacterCatalogEntry(assetId)?.m3RigFamily;
  return family ? WARDROBES[family] : null;
}

export function defaultM3CreatorOutfit(assetId: string): M3CreatorOutfit | undefined {
  const wardrobe = getM3CreatorWardrobe(assetId);
  return wardrobe ? { ...wardrobe.defaultOutfit } : undefined;
}

export function isValidM3CreatorOutfit(assetId: string, value: unknown): value is M3CreatorOutfit {
  const wardrobe = getM3CreatorWardrobe(assetId);
  if (!wardrobe || !value || typeof value !== "object") return false;
  const outfit = value as Partial<M3CreatorOutfit>;
  return wardrobe.top.some(item => item.id === outfit.top)
    && wardrobe.bottom.some(item => item.id === outfit.bottom);
}

export function resolveM3CreatorOutfit(assetId: string, value: unknown): M3CreatorOutfit | undefined {
  return isValidM3CreatorOutfit(assetId, value)
    ? { top: value.top, bottom: value.bottom }
    : defaultM3CreatorOutfit(assetId);
}
