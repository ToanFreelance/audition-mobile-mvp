# Vita Wardrobe Lab V0.3 — Interactive Cyber Blue Top Preview

Date: 2026-11-13
Branch: `work/vita-wardrobe-tryon-poc-v1`
Route: `/tools/vita-wardrobe-lab`

## Owner request

Owner explicitly authorized end-to-end progress toward a demo for `Cyber_Blue.zip` on Vita Premium Variant A, with a fallback Work implementation prompt if exact garment conversion could not be completed.

## Source-of-truth

Original owner-supplied `Cyber_Blue.zip`:
- `cyberbluetops.vroidcustomitem` — Tops, VRoid Studio 1.27.0, 3 embedded PNG textures
- `cyberblueskirt.vroidcustomitem` — Bottoms, 3 embedded PNGs
- `cyberblueshoes.vroidcustomitem` — Shoes, 6 embedded PNGs

The top references `N00_005_01_Tops` (Casual2) AND `N00_010_01_OnePiece` (BodySuit), plus a body visibility mask. The original `.vroidcustomitem` provides neither an exported skin-weight buffer nor the canonical geometry/UV layout. Official VRoid Studio offers an editor-mediated export to XWear (see https://vroid.pixiv.help/hc/en-us/articles/38729525846809-How-to-convert-costumes-and-accessories-made-in-VRoid-Studio-to-XWear).

## V0.3 scope — interactive prototype delivered

- Browser-only ZIP import and original PNG textures (V0.2).
- New `cyber-blue-tryon.ts`: a reversible **visual preview**, not claimed original Cyber Blue geometry.
- If the loaded avatar contains a **separate** upper garment mesh: re-use its geometry, bind skeleton and skinning but temporarily substitute source PNG into only identifiable garment material slots. Original Vita materials are kept and restored when toggled off.
- If the avatar's outfit cannot be isolated without painting skin/body: create an **approximate segmented 3D shell** around upper body and arms, with torso attached to chest bone and sleeves to upper-arm bones when available. This fallback is **not** a skinned VRoid template and may have intersections/seams. No arbitrary alteration of accepted skin/hair/face materials.
- A small oscillating shoulder motion probe and 180-degree rotation are available, not represented as a full approved Audition dance motion.
- An explicit toggle restores the original look in-memory. No modifications to the GLB bytes, original variant SHA, Character Catalog, Game, Waiting Room, Supabase or WebAudio timeline.
- All creator assets stay **only** in the owner's browser-selected ZIP. Neither ZIP nor generated user garment is committed or served in the public Vercel deployment.

## Validation and remaining risks

- The original owner's real iPhone V0.1 ZIP parsing and V0.2 local texture extraction previously passed; **V0.3 garment preview has not been tested on the physical iPhone**.
- Vercel Next.js build READY validates compilation only; it cannot certify garment fit, UV parity, exact skinning, or motion. No new automated browser screenshots or physical tests were run for V0.3.
- The two official VRoid garment template meshes + UVs were not available as licensed, directly readable binaries. The fidelity gate for an **exact skinned Cyber Blue** remains blocked. This prototype is not a replacement for that missing template/geometry.
- Final garment target must use source-proven UVs, skin weights, correct arm/hip animation, body-region occlusion and legitimate redistribution rights. Source BOOTH terms may prohibit distributing creator files; inspect terms before using client-delivered assets.

## iPhone QA steps

1. Open the stable wardrobe Preview URL.
2. Import owner `Cyber_Blue.zip` in Wardrobe Lab. No need to export individual PNGs.
3. Optionally import the SHA-validated Vita Premium V1.1 from Files; CC0 is the initial reference.
4. Scroll to **03 / CYBER BLUE 3D TRY-ON**, tap **Mặc thử Cyber Blue Top**.
5. Rotate, try **Thử chuyển động vai**, then restore the original outfit. Take front/35°/side/back screenshots and note if seams, UV patterns or fitting drift are visible.
6. Do not claim test success until the owner has checked on their device.

## Next step: exact garment Work task

Work should inspect and honor existing repo instructions and the corresponding detailed research document, then source or generate legitimate geometry for `N00_005_01_Tops` and `N00_010_01_OnePiece` with matching UVs, bind pose and weights. Prefer official VRoid Studio XWear/VRM conversion where environment supports it. If exact conversion cannot be verified, deliver a distinctly labeled art-quality approximation with owner-controlled fitting (no "exact" claim), focused tests, preview and a candid report.

Never merge a work branch automatically.
