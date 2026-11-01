/**
 * Isolated QA EyeSet catalog for the owner-approved nine-look concept.
 * Each look maps to real named mesh nodes + embedded texture inside the GLB.
 * Do NOT register in production Character Catalog before owner visual acceptance.
 */
export const EYE_SET_PACK_URL =
  "https://d2ol7oe51mr4n9.cloudfront.net/user_3Jb86LOyd6RRYonCk2iie6jkL5h/fe9ad0e8-19b8-4b63-a083-255b50255fcc.glb";
export const EYE_SET_PACK_SHA256 = "68934293d6c8af5581664c94170355b6a7dda7787c168ac1fe111aa4ee3a8aba";
export const EYE_SET_PACK_CACHE_NAME = "audition-eye-set-pack-v1-68934293";

export const EYE_SETS = [
  { id: "natural", label: "Tự nhiên", subtitle: "Mắt hạnh nhân · nâu ấm", color: "#995539", lashStyleId: "natural", eyeShapeId: "neutral", irisPatternId: "classic" },
  { id: "joyful", label: "Tươi cười", subtitle: "Mắt cười · nâu sáng", color: "#a76b40", lashStyleId: "natural", eyeShapeId: "joyful", irisPatternId: "classic" },
  { id: "sad", label: "Buồn", subtitle: "Mí trễ · tím khói", color: "#96718a", lashStyleId: "natural", eyeShapeId: "sad", irisPatternId: "classic" },
  { id: "playful", label: "Tinh nghịch", subtitle: "Mắt xếch · xanh ngọc", color: "#2bafa7", lashStyleId: "dramatic", eyeShapeId: "playful", irisPatternId: "classic" },
  { id: "angry", label: "Giận dữ", subtitle: "Mắt sắc · đỏ rượu", color: "#be404b", lashStyleId: "dramatic", eyeShapeId: "angry", irisPatternId: "classic" },
  { id: "doll", label: "Búp bê", subtitle: "Mắt tròn · tím long lanh", color: "#aa6cc3", lashStyleId: "doll", eyeShapeId: "surprised", irisPatternId: "classic" },
  { id: "idol", label: "Thần tượng", subtitle: "Mắt idol · xanh lấp lánh", color: "#247fdf", lashStyleId: "doll", eyeShapeId: "surprised", irisPatternId: "classic" },
  { id: "star", label: "Ngôi sao", subtitle: "Iris tím · sao vàng", color: "#9b59be", lashStyleId: "doll", eyeShapeId: "neutral", irisPatternId: "star" },
  { id: "heart", label: "Trái tim", subtitle: "Iris hồng · trái tim", color: "#d15f86", lashStyleId: "doll", eyeShapeId: "neutral", irisPatternId: "heart" },
] as const;

export type EyeSetId = (typeof EYE_SETS)[number]["id"] | "original";

export function getEyeSet(id: EyeSetId) {
  return EYE_SETS.find(item => item.id === id);
}

export function eyeSetNodeName(id: Exclude<EyeSetId, "original">, side: "L" | "R", role: "Ocular" | "Lashes") {
  return `EyeSet_${id}_${side}_${role}_V1`;
}
