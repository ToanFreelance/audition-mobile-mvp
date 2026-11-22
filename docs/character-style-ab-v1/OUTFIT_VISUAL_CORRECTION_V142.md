# Character B — Modular Prototype V1.4.2

## Owner visual rejection (2026-11-03 iPhone screenshots)
- Fashion Idol / MToon: black, low-detail torso and long black lower garment.
- Premium: dark maroon, opaque-looking oversized skirt; silhouette loses original garment detail.
- Previous V1.4.1 UV-NaN fix made the shader functional, but did **not** make the outfit visually acceptable.

## Root-cause analysis
1. Old `morphCut` used the same unbounded flare scaling across vertices on long-skirt and upper-body pieces. It exaggerated the underlying geometry into a large cone.
2. `makePremiumMaterial` additionally set color on the original MToon material while the source garment could already contain dark textures. `applyMaterialLooks` also recolored shared source cloth before swap, amplifying misleading dark/saturated surfaces.
3. Fashion Idol's MToon path still renders very dark garment regions not present in the previously approved glTF look. Disabling MToon outline did not cure those dark regions. Do not treat MToon as visual baseline until further source-material research.

## Focused implementation
- Default back to legacy glTF material mode (previous owner-tested appearance). MToon remains a clearly labeled experimental comparison switch.
- Premium uses new pastel fabric texture generated from source map details and alpha. Separate new MeshStandardMaterial avoids compounding a dark MToon shader/color tint; original source Basic material is untouched.
- Only selected clothing main material groups are replaced; MToon outline group is filtered from premium and original related groups are hidden during the swap.
- Bound deformation by garment type: subtle fitted top, shorten long lower garment and a light hem flare. Original skin weights, UVs, skeleton, binding unchanged.
- Restore original geometry and material on Basic; dispose derived textures, geometry and materials on swap.

## QA evidence
Independent QA sandbox before commit: Chromium WebGL2/SwiftShader mobile portrait, both VRoid sample A/B, legacy mode.
- Fashion Idol Basic→Premium→Basic twice: PASS; pixels/color return exactly to Basic after both cycles. Premium replaces 2 skinned pieces, 2,625 vertices modified. Red-dominant pixels in garment ROI reduced from 1.0% Basic to 0.1% Premium and near-black fraction from 25.5% Basic to 4.5% Premium.
- Soft Mature Basic→Premium→Basic twice: PASS; source pixel/color restored; 2 skinned pieces, 2,458 vertices modified. No page JavaScript errors.
- Both with Premium: procedural in-place step QA PASS at runtime.
- TypeScript and Next.js build PASS on tested candidate. Vercel build of final commit must be separately verified.
- This is geometry/material stability QA, NOT artist-grade visual acceptance, and not a license-cleared independent premium garment.

## Explicit limits
- Clothing geometry is still derived from pixiv VRoid samples. These are only comparison/demonstration assets.
- Production quality/skinning, animation clipping through wider choreography, style attractiveness and real iPhone Safari visual acceptance remain pending owner assessment.
- MToon remains an experimental display mode due Fashion Idol's over-dark cloth material.
- No production Character Catalog / RoomState / gameplay / WebAudio changes.
- Branch work/facial-modular-eye-demo-v1, PR #24 Draft; no merge.
