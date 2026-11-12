# Vita Wardrobe Lab — Cyber Blue source-asset inspection

Date: 2026-11-12. Scope: isolated wardrobe POC only. Input supplied by owner; creator source archive and textures are **not** committed to GitHub.

## Verified source package

Owner provided `Cyber_Blue.zip` (5,736,271 bytes) and a real iPhone screenshot demonstrating that the V0.1 browser-only inspector correctly reads three custom items.

| Custom item | Embedded `.vroidcustomitem` entries | Verified embedded PNG images | Root transferable group |
| --- | ---: | ---: | --- |
| `cyberbluetops.vroidcustomitem` | 8 | 3 | `TransferableGroupType.N00.Level1.Tops` |
| `cyberblueskirt.vroidcustomitem` | 7 | 3 | `TransferableGroupType.N00.Level1.Bottoms` |
| `cyberblueshoes.vroidcustomitem` | 9 | 6 | `TransferableGroupType.N00.Level1.Shoes` |

All three identify VRoid Studio **1.27.0**. The items contain `v1customitem/meta.json`, `.transferablegroup`, one or more protobuf-like `.transferable` payloads, and a `thumbnails/thumbnail.png` file. The actual clothing textures are PNG byte streams embedded inside transferable payloads (not separate ZIP files). All **12 embedded PNG streams** were validated independently using Pillow's PNG parser: **0 corrupt**. Some are repeated or mostly transparent; the count is PNG occurrences, not the number of distinct final visible material layers.

**Key technical finding:** There is no ready `.glb`, `.vrm`, skeletal bind pose or bone weight table exported as a standalone mesh. The provided custom items represent VRoid-native clothing templates, texture layers and parameters. Converting them to accurately fitted, skinned glTF requires reproducing VRoid's garment generator/template-specific geometry and humanoid deformation or exporting from the official VRoid engine. Do not treat a flat PNG draped on a generic cylinder as the real Cyber Blue outfit.

## V0.2 implemented on isolated work branch

- `zip-reader.ts` now determines Tops/Bottoms/Shoes from authoritative `rootTransferableGroupTypeId`, not just filename guesses.
- For each `.transferable`, a bounded, browser-local PNG signature and IHDR/IEND chunk reader extracts real embedded PNG byte ranges and original dimensions.
- Wardrobe Lab offers a collapsible, lazily loaded source-texture gallery for each item with per-image download. All blobs are local object URLs and revoked on source change / unmount.
- Source textures are **never fetched from remote URL**, included in source control, copied to Vercel storage or sent to a backend.
- No changes to Vita's existing face, accepted outfit, body, rig, animation, Character Catalog, Waiting Room, multiplayer or gameplay.

## Validation evidence

- Owner physical iPhone V0.1: three items and thumbnails imported successfully (screenshot supplied); **new V0.2 texture gallery not yet owner-tested**.
- Offline source verification: owner ZIP extracted, nested item metadata inspected; Pillow verified all 12 actual embedded PNGs by parsing complete IEND-terminated PNGs.
- Vercel build/Preview on this branch to be verified separately after commit. No automated browser/iPhone QA of gallery claimed until run.

## Next experimental gate — garment geometry and skinning

1. Decode clothing template references and visible material/texture layer mapping from `.transferablegroup` and `.transferable` without guessing.
2. Select a compatible VRoid clothing template geometry with its canonical UV map and skin weights (or verify export from official VRoid Studio/XWear). A raw `.vroidcustomitem` is not a skinned 3D mesh.
3. Build **one isolated Cyber Blue top** as a skinned GLB only when the geometry/UV map can be traced and verified. Avoid modifying the accepted Vita V1.1 source.
4. Check front / side / 35° / back, neutral and at least one existing dance animation on the physical iPhone; preserve skeleton and reject cloth/body clipping.
5. Before publishing creator-derived assets in a client-delivered Preview/game, obtain license clarification where redistribution/downloadable game assets are involved. Publisher's page says commercial use requires attribution and **redistribution prohibited**.

Sources:
- Cyber Blue seller terms: https://booth.pm/en/items/5798462
- Official custom-item documentation: https://vroid.pixiv.help/hc/en-us/articles/7467455312409-How-to-import-and-export-custom-items
- Official XWear export: https://vroid.pixiv.help/hc/en-us/articles/38729525846809-How-to-convert-costumes-and-accessories-made-in-VRoid-Studio-to-XWear

**No merge.** Work remains isolated to `work/vita-wardrobe-tryon-poc-v1`.

## V0.3 — Exact source template references mapped (2026-11-12)

This is an **offline inspection of the owner's original Cyber_Blue.zip**, not merely thumbnails. All values below are source metadata extracted from nested `.transferablegroup` and `.transferable` binary data, not inferred from rendered images.

### Cyber Blue Top: two different templates are required

- Top preset reference: `pixiv/VRoid/Clothing/Tops/N00/Initial_050/TransferableGroupType.N00.Level1.Tops.transferablegroup`.
- Primary template material/geometry reference: `N00/N00_005_01_Tops/N00_005_01_Tops/N00_005_01_Tops_01_CLOTH.material`, with `Model.N00.Casual2` shape controls.
- Additional template reference: `N00/N00_010_01_OnePiece/N00_010_01_OnePiece/N00_010_01_Onepiece_00_CLOTH.material` and `Model.N00.BodySuit` shape controls.
- The group also references an independent `SkinAlphaMask`, used for visibility management. Precise visual occlusion needs validation against the engine.
- Actual top item PNG streams: **2048×2048** primary clothing image (4,358,428 embedded PNG bytes), **2048×2048** alpha mask (~25,616 bytes), and **2048×2048** additional template image (~186,058 bytes). Values are from the source binary, not a rendered garment.
- Relevant shape parameters include `WaistSpread`, `SleeveThick`, `SleeveSqueeze`, `SleeveCrease`, `WidthWide`, `HeightLong`, `HoodNarrow`; the extra BodySuit layer also contains numerous arm, neck and torso blendshape controls.
- No position/index/normal/UV buffer or skin-weight table corresponding to these **two exact geometry templates** was found as an exported glTF/FBX/VRM garment. The custom item only references engine templates and their parameters. `GLB` generation must not treat the three PNGs as sufficient for original geometry reconstruction.

### Related set

| Piece | Template reference confirmed in transferable data | Material | Source PNGs |
| --- | --- | --- | --- |
| Top | `Initial_050`, `N00_005_01_Tops` + `N00_010_01_OnePiece` | Casual2 + BodySuit | 3 |
| Skirt | `Initial_043`, `N00_003_01_Bottoms` | Bottoms template | 3 |
| Shoes | `N00_006_01_Shoes` plus two `N00_001_02_Bottoms` additional pieces | Shoes template | 6 |

### Next engineering gate

1. Obtain **lawfully usable canonical garment mesh + UV + bind skeleton** for the *same* VRoid template IDs from an authorized VRM/XWear export or equivalent confirmed source; otherwise prototype a clearly labeled approximation, **not** an exact Cyber Blue garment.
2. Decode the template shape parameter values and UV texture layers. Verify independently that the main top, BodySuit underlayer and skin alpha-mask are mapped correctly.
3. Export a **skinned** top-only GLB (same source skeleton/bind space or a verified retarget to Vita), with optional body-region occlusion that never permanently alters accepted Vita V1.1.
4. Validate front/35°/side/back and existing dance poses on the owner iPhone before proceeding to skirt/shoes.

The official VRoid workflow explicitly supports exporting a custom outfit item to XWear from VRoid Studio; it does **not** imply that `.vroidcustomitem` already contains baked geometry. Documentation:
- https://vroid.pixiv.help/hc/en-us/articles/38729525846809-How-to-convert-costumes-and-accessories-made-in-VRoid-Studio-to-XWear
- https://vroid.pixiv.help/hc/en-us/articles/39513431300377-What-are-custom-items

Creator rights: https://booth.pm/en/items/5798462 (commercial use requires author credit; source redistribution forbidden). Do not commit original ZIP, PNGs, converted creator-derived meshes or embed them into public previews without sufficient rights clarification.
