# VRoid Beta Hair → GLB — isolated proof of concept

Status: **experimental / approximate geometry**, not a VRoid Studio exporter.

## FeliKitty test input
- Input: owner's privately supplied `Short_Bob_Hair_Preset_by_FeliKitty.zip`.
- Beta `preset.json`: 84 visible freehand strands grouped across Bangs, Sides, Back, Side Ponytails, Bow and other sections.
- 2 embedded rendered PNG textures.
- Output: head-local, hair-only glTF 2.0 binary (`.glb`): 13 mesh groups, 21,840 triangles, approx. 739 kB.
- No avatar/face/outfit is exported or modified.
- The source creator's conditions allow editing and commercial use but prohibit claiming ownership and redistribution for sale; do not commit the owner's original archive or derivative GLB to this public repository.

## How the prototype conversion works
1. Read the **VRoid Beta** `preset.json` contained within the creator ZIP; do not assume Stable `.vroid` or `.vroidcustomitem` have the same schema.
2. Sample original hair centerline control points with Catmull–Rom and interpolate normals.
3. Sweep each strand's diamond cross-section using its original width/thickness and width curve.
4. Group reconstructed geometry by source hair section/material, embed two original hair textures and a preview color tint.
5. Write glTF 2.0 / GLB with `scenes[0].extras.vroidHairHeadLocal = true`.
6. The isolated Vita Hair Studio importer accepts this explicitly tagged head-local hair-only GLB, without requiring a donor Head bone. Generic untagged headless GLBs are rejected.

## Owner iPhone manual test
1. Download the private converted GLB from the current ChatGPT conversation and save it to iPhone Files.
2. Open the stable `/tools/vita-hair-tryon` route on the `work/vita-hair-tryon-poc-v1` Vercel Preview.
3. Use the existing approved Vita Premium Cute V1.1 avatar (reimport if origin-local IndexedDB is empty).
4. Choose **Short Bob + Pigtails → Nạp file** or **Nạp hairstyle hoặc GLB convert**; select the `.glb`.
5. Inspect front / 35° / side / back. Use fit controls to quantify residual scale/offset mismatch.
6. Compare silhouette with the supplied creator preview. Verify no scalp/face clipping and correct bow placement.

## Explicit limitations
- This is **not** a bit-exact reconstruction of VRoid's proprietary procedural hair mesh engine.
- Hair colors are user-tinted for visual QA; the source grayscale textures and material grouping are preserved.
- Does not recreate physical hair springs / bones / simulation, UV generation subtleties, proprietary smoothing, or all procedural variants.
- Only the VRoid **Beta** embedded `preset.json` schema is supported in this proof of concept. Stable `.vroid`, `.vroidcustomitem` and arbitrary ZIPs cannot be renamed to `.glb`.
- GLB validity checked by a separate glTF mesh reader; owner iPhone geometry/fit/performance acceptance is pending.
- No change to Character Catalog, Waiting Room, RoomState, Supabase, WebAudio or gameplay. No merge.

## 2026-11-12 — Owner physical iPhone feasibility feedback

Owner successfully imported the reconstructed FeliKitty Short Bob hair-only GLB into Vita Hair Studio on an actual iPhone. The look was rated **quite good / workable**, with a **small upward hair fit offset still required**. This confirms a practical import/test workflow for this exact example and supports further VRoid hairstyle exploration; it does **not** certify exact visual parity, a universal converter, collision-free motion, performance, or permission to embed creator source assets into public builds.

Keep fit offset adjustable until the owner supplies a measured value and visually validates a baked asset. The source ZIP and approximate GLB must remain out of this public repository. The author-built converter source (not creator content) is now tracked at `scripts/vroid-beta-hair-to-glb.py`, with usage instructions in `scripts/VROID_BETA_HAIR_CONVERTER.md`. No changes to the approved face/outfit.
