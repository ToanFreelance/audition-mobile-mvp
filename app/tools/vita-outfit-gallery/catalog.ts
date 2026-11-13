export const outfits = [
  {
    id: "cyber-blue", name: "Cyber Blue", category: "full outfit",
    pieces: "Blouson color-block · váy xanh · high-top",
    source: "https://booth.pm/en/items/5798462", author: "Pham’s Itemshop · @sirbiblegayy",
    format: "ZIP / VRoid Stable custom items", license: "Sửa texture được phép. Ghi công khi dùng thương mại. Chỉ đọc ZIP của người dùng trên thiết bị.",
    fidelity: "approximate", mesh: "planned", rig: "Vita V1.1", qa: "pending", previewOnly: true,
  },
  {
    id: "sakura-encore", name: "Sakura Encore", category: "full outfit",
    pieces: "Áo thủy thủ · nơ hồng · váy hai tầng",
    source: "Thiết kế mới cho Vita Wardrobe", author: "Audition Mobile MVP",
    format: "Mẫu may 3D tham số", license: "Thiết kế gốc của dự án. Dùng trong preview.",
    fidelity: "original", mesh: "planned", rig: "Vita V1.1", qa: "pending", previewOnly: true,
  },
  {
    id: "mint-track", name: "Mint Track", category: "full outfit",
    pieces: "Track jacket · quần jogger · sneaker",
    source: "Thiết kế mới cho Vita Wardrobe", author: "Audition Mobile MVP",
    format: "Mẫu may 3D tham số", license: "Thiết kế gốc của dự án. Dùng trong preview.",
    fidelity: "original", mesh: "planned", rig: "Vita V1.1", qa: "pending", previewOnly: true,
  },
] as const;
export type OutfitId = typeof outfits[number]["id"];
