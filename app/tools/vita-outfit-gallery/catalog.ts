import manifest from "./manifest.json";

// Isolated research metadata only. No production Character Catalog imports.
export const wardrobeManifest = manifest;
export const wardrobeItems = wardrobeManifest.items;
export type WardrobeItem = (typeof wardrobeItems)[number];

// Keep the existing outfit export/card fields, derived from the locked manifest.
export const outfits = wardrobeItems
  .filter(item => item.type === "outfit")
  .map(item => ({
    ...item,
    name: item.displayName,
    pieces: item.notes.join(" "),
    source: item.sourceUrl ?? "",
    author: item.seller ?? "",
    license: item.licenseNote,
    fidelity: item.exactOrApprox,
    mesh: "not-started",
    rig: item.intendedCharacter,
    qa: "not-validated",
    previewOnly: true,
  }));

export const accessories = wardrobeItems.filter(item => item.type === "accessory");
export type OutfitId = (typeof outfits)[number]["id"];

