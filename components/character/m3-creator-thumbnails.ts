import type { M3RigFamily } from "./character-catalog";

// Source-backed item-only PNGs from M3's original trait manifest.
// Kept as references, not redistributed binaries. The preview actor remains
// the source of truth for equipped material variants and hair color.
const BASE = "https://raw.githubusercontent.com/memelotsqui/character-assets/main/";

const HAIR_THUMBNAILS: Readonly<Record<M3RigFamily, Readonly<Record<string, string>>>> = {
  drophunter: {
    short: "head/short.png",
    curledbangs: "head/curledbangs.png",
    ponytail: "head/ponytail.png",
    buns: "head/buns.png",
  },
  neurohacker: {
    short: "head/short.png",
    hair1: "head/hair1.png",
    hair2: "head/hair2.png",
    hair3: "head/hair3.png",
  },
};

export function m3CreatorThumbnailUrl(family: M3RigFamily, relativePath: string): string {
  // Encode spaces in source-generated filenames such as "Logo Tee-icon0.png".
  return BASE + family + "/" + relativePath.split("/").map(encodeURIComponent).join("/");
}

export function m3CreatorHairThumbnailUrl(family: M3RigFamily, hairStyleId: string): string | undefined {
  const relativePath = HAIR_THUMBNAILS[family][hairStyleId];
  return relativePath ? m3CreatorThumbnailUrl(family, relativePath) : undefined;
}
