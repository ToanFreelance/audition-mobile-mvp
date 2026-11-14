// Isolated M3 Neurohacker streetwear POC — source-backed separate VRM traits.
// Every path exists in memelotsqui/character-assets/neurohacker (main manifest).
// No binaries or rights to redistribute are implied by this catalog.
import type { WardrobeOption, WardrobeSlot } from "./runtime";

export const STREET_SLOTS: WardrobeSlot[] = [
  "top", "bottom", "shoes", "hair", "outer", "accessory", "hands",
];
export const STREET_OPTIONAL_SLOTS: WardrobeSlot[] = ["outer", "accessory", "hands"];
export const STREET_DEFAULT: Record<WardrobeSlot, string> = {
  top: "streetware", bottom: "cargopants", shoes: "simpleshoes", hair: "short",
  outer: "none", accessory: "none", hands: "none",
  head: "none", neck: "none", waist: "none",
};
export const STREET_WARDROBE: Partial<Record<WardrobeSlot, WardrobeOption[]>> = {
  top: [
    { id: "streetware", label: "Streetwear", file: "chest/streetware.vrm" },
    { id: "logotee", label: "Logo Tee", file: "chest/logotee.vrm" },
    { id: "simpleshirt", label: "Simple Shirt", file: "chest/simpleshirt.vrm" },
    { id: "sweater", label: "Sweater", file: "chest/sweater.vrm" },
    { id: "slottedshirt", label: "Layered Shirt", file: "chest/slottedshirt.vrm" },
    { id: "fulljacket", label: "Full Jacket", file: "chest/fulljacket.vrm" },
  ],
  bottom: [
    { id: "cargopants", label: "Cargo Pants", file: "legs/cargopants.vrm" },
    { id: "streetpants", label: "Street Pants", file: "legs/streetpants.vrm" },
    { id: "tightjeans", label: "Skinny Jeans", file: "legs/tightjeans.vrm" },
    { id: "cargoshorts", label: "Cargo Shorts", file: "legs/cargoshorts.vrm" },
    { id: "shortsandsweats", label: "Sport Shorts", file: "legs/shortsandsweats.vrm" },
    { id: "rolleduppants", label: "Rolled Pants", file: "legs/rolleduppants.vrm" },
  ],
  shoes: [
    { id: "simpleshoes", label: "Casual Shoes", file: "foot/simpleshoes.vrm" },
    { id: "runningshoes", label: "Running Shoes", file: "foot/runningshoes.vrm" },
    { id: "dressshoes", label: "Dress Shoes", file: "foot/dressshoes.vrm" },
    { id: "hikingboots", label: "Hiking Boots", file: "foot/hikingboots.vrm" },
  ],
  hair: [
    { id: "short", label: "Short Hair", file: "head/short.vrm" },
    { id: "hairshort", label: "Short Layer", file: "head/hairshort.vrm" },
    { id: "hair1", label: "Style 1", file: "head/hair1.vrm" },
    { id: "hair2", label: "Style 2", file: "head/hair2.vrm" },
    { id: "hair3", label: "Style 3", file: "head/hair3.vrm" },
    { id: "braided", label: "Braided", file: "head/braided.vrm" },
    { id: "straight", label: "Straight", file: "head/straight.vrm" },
  ],
  outer: [
    { id: "longjacket", label: "Long Jacket", file: "outer/longjacket.vrm" },
  ],
  accessory: [
    { id: "bandolier", label: "Crossbody Strap", file: "accessories/bandolier.vrm" },
    { id: "beltandbag", label: "Belt Bag", file: "accessories/beltandbag.vrm" },
    { id: "chestrig", label: "Chest Bag", file: "accessories/chestrig.vrm" },
  ],
  hands: [
    { id: "fingergloves", label: "Finger Gloves", file: "accessories/fingergloves.vrm" },
    { id: "combatgloves", label: "Sport Gloves", file: "accessories/combatgloves.vrm" },
  ],
};

// Neurohacker manifest: 'solo' chest traits cannot be layered with outerwear.
// Only applies within Neurohacker, never to Drophunter/Anata.
export const STREET_SOLO_TOPS = new Set(["streetware", "fulljacket"]);
export function streetUnavailableReason(
  slot: WardrobeSlot, _optionId: string, equipped: Record<WardrobeSlot, string | null>,
): string | null {
  if (slot === "outer" && STREET_SOLO_TOPS.has(equipped.top ?? "")) {
    return "Áo Streetwear/Full Jacket là loại solo; hãy đổi sang Logo Tee hoặc Sweater trước.";
  }
  return null;
}
