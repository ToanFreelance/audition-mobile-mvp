/**
 * Isolated QA EyeSet catalog for the owner-approved nine-look concept.
 * Each look maps to real named mesh nodes + embedded texture inside the GLB.
 * Do NOT register in production Character Catalog before owner visual acceptance.
 */
export const EYE_SET_PACK_URL =
  "https://d2ol7oe51mr4n9.cloudfront.net/user_3Jb86LOyd6RRYonCk2iie6jkL5h/93c65212-1de0-486d-bf4f-9cbf08c58554.glb";
export const EYE_SET_PACK_SHA256 = "312c0c4fdf74de9c366258d1442039db12c7c82ffa13d6d4fe407854853d9ac4";
export const EYE_SET_PACK_CACHE_NAME = "audition-eye-set-pack-v191-312c0c4fdf74";

export const EYE_SETS = [
  { id: "natural", label: "Tự nhiên", subtitle: "Mắt hạnh nhân · nâu ấm", color: "#bd713d", lashStyleId: "natural", eyeShapeId: "neutral", irisPatternId: "classic" },
  { id: "joyful", label: "Tươi cười", subtitle: "Mắt cười · nâu sáng", color: "#ce793c", lashStyleId: "natural", eyeShapeId: "joyful", irisPatternId: "classic" },
  { id: "sad", label: "Buồn", subtitle: "Mí trễ · tím hồng trong", color: "#bd70ac", lashStyleId: "natural", eyeShapeId: "sad", irisPatternId: "classic" },
  { id: "playful", label: "Tinh nghịch", subtitle: "Mắt xếch · xanh ngọc", color: "#13c8bf", lashStyleId: "dramatic", eyeShapeId: "playful", irisPatternId: "classic" },
  { id: "angry", label: "Giận dữ", subtitle: "Mắt sắc · đỏ ruby rực", color: "#e62c51", lashStyleId: "dramatic", eyeShapeId: "angry", irisPatternId: "classic" },
  { id: "doll", label: "Búp bê", subtitle: "Mắt tròn · tím long lanh", color: "#bd75ec", lashStyleId: "doll", eyeShapeId: "surprised", irisPatternId: "classic" },
  { id: "idol", label: "Thần tượng", subtitle: "Mắt idol · xanh lấp lánh", color: "#178fff", lashStyleId: "doll", eyeShapeId: "surprised", irisPatternId: "classic" },
  { id: "star", label: "Ngôi sao", subtitle: "Iris tím · sao vàng", color: "#ab54e7", lashStyleId: "doll", eyeShapeId: "neutral", irisPatternId: "star" },
  { id: "heart", label: "Trái tim", subtitle: "Iris hồng · trái tim", color: "#f15b9f", lashStyleId: "doll", eyeShapeId: "neutral", irisPatternId: "heart" },
] as const;

export type EyeSetId = (typeof EYE_SETS)[number]["id"] | "original";

export function getEyeSet(id: EyeSetId) {
  return EYE_SETS.find(item => item.id === id);
}

export function eyeSetNodeName(id: Exclude<EyeSetId, "original">, side: "L" | "R", role: "Ocular" | "Lashes" | "Lids" | "Skin") {
  return `EyeSet_${id}_${side}_${role}_${role === "Lids" || role === "Skin" ? "V191" : "V1"}`;
}

export const EYE_SET_BLINK_PROFILE = "anatomical-lid-v191";
