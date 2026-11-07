# Female Golden Eye V7.1 — Iris Orientation & Brightness Correction
Date: 2026-11-07. Isolated eye-only QA.

## Owner feedback
The owner tested all nine styles on iPhone in the V7 preview and reported that irises appear vertically inverted, with dark, muted color relative to the two accepted golden references. The user explicitly requested to fix implementation, not create sketches or another concept.

## Root cause
The existing Golden V7 atlas uses an image with top-left image origin, uploaded as a Three.js `SRGBColorSpace` texture with `flipY=true`. The GLB upper lid is at smaller local Z (`~ -0.557`), lower lid at larger Z (`~ -0.454`). The V7 shader mapped `eyeArt.y = (z + .509)/.051`, meaning the upper eye sampled the BOTTOM of the image tile, where the bright fan glow was authored, while the dark rim/pupil regions appeared below. This caused upside-down light gradients, with the lower portion unnaturally dark. Under physically based MeshStandardMaterial/ACES, the dark saturated SVG iris was further subdued.

## Focused implementation
- `public/qa/female-origin-eye-golden-v7/eye-iris-golden-v7.js`: invert **only the local vertical atlas axis**: `eyeArt.y=-(z+.509)/.051`. Do not mirror eyeArt.x, change atlas tile ordering, modify textures or invent new art. Preserve `SRGBColorSpace` and `flipY=true` on TextureLoader.
- Brightness in **linear working space**, limited to original eye iris coverage: mix source atlas RGB with sqrt RGB at 22% to lift midtones. In the same masked region, add only a small `0.26 * coverage * liftedIris` amount to MeshStandardMaterial's `totalEmissiveRadiance`. Do not change scene lighting, exposure, skin, face, brow, eyelashes, morph strength, or global color management.
- `index.html`: inject additional emissive shader chunk into existing MeshStandardMaterial, update program cache key for recompilation and cache-bust the shader module with `?v=71`. Update QA labels only.
- **Same route:** `/qa/female-origin-eye-golden-v7/index.html`, no new sketch and no new eye concept. Same iPhone-local `Female_anime_origin.glb` loading and nine style buttons. V6 unchanged.
 
## Validations actually performed
1. Verified work branch HEAD and repo instructions before edits; updated only existing QA branch.
2. JavaScript syntax checks for new shader module and page inline script passed.
3. GLSL snippets have balanced braces; nine selector buttons retained.
4. Coordinate sanity test: with original local eye coordinates, upper lid `z=-.557` maps to tile v ≈ 0.971 (top) and lower lid `z=-.454` maps to v≈ -0.039 (clamped to ≈0.0175, bottom). This reverses the V7 mapping, keeps horizontal direction.
5. Atlas file, morph module and large GLB are unchanged. Color-space remains sRGB decode, no global exposure increase.
6. NOT independently validated on iPhone or production-equivalent Three.js GPU. User screenshot acceptance required, especially star/heart orientation, iris brightness and 3/4 views.

## Remaining limitations
The existing mesh is a single large glTF mesh, source iris pigment coverage is an estimated local-space mask, and the eyes are not independently unwrapped/retopologized iris components. Increased emissive fill may wash highlight detail depending on Safari GPU and scene tone mapping; visually verify before adjusting. This is **not full Golden Concept acceptance**. No gameplay, multiplayer, RoomState, animation clock, stage, Character Catalog or production integration changes. No merge.
