# Female Origin — Eye Asset Pack V5 (Iris & Eyelid)
**Status: Owner iPhone visual acceptance pending. Isolated QA only.**

## Why V4 did not match the approved Eye Asset Pack
V4 reused exactly the same original purple iris appearance in every style: a hue-shift shader changed purple to brown, teal, red or blue, but retained the original pupil silhouette, ring structure, sparkle and reflection profile. V4 eyelid/brow morphs were separate, but insufficient to make the nine styles visually distinct. The owner's latest direction explicitly demands BOTH eye outline/eyelids and iris/pupil appearance match the already-approved nine-style concept. Do not generate another concept image.

## V5 implementation
- New isolated route: `/qa/female-origin-eye-concept-v5/index.html`. The existing V4 route stays unchanged for A/B review.
- Files: `eye-iris-concept-v5.js` is a physically located surface-shading treatment on the actual 3D eye GLB (no 2D HUD eye overlay), with nine independently parameterized iris materials: size/gradient, concentric rims, radial fiber spokes, pupil size and aspect ratio, localized specular-style glints and star/heart motif. Every button changes iris **appearance** rather than only base hue.
- `eye-morph-concept-v5.js` creates eight independently authored THREE.BufferGeometry POSITION morphs for Joyful/Sad/Playful/Angry/Doll/Idol/Star/Heart; Natural retains neutral geometry. The brow and upper/lower lid coefficients are unique per style; one button applies one fixed pose at weight 1 with no strength slider.
- The owner source `Female_anime_origin.glb` (292,645 vertices / 499,762 triangles) is opened from iPhone Files and never uploaded or overwritten. The shader and in-memory morphs are applied without reloading for style changes.

## Numerical geometry QA on the actual owner GLB
Checked every triangle's signed normal relative to the original at full morph weight (499,762 triangles per style). Results:
| Style | Reversed triangles | max |delta local Z| |
| --- | ---: | ---: |
| Joyful | 0 | 0.02129 |
| Sad | 2 | 0.01735 |
| Playful | 0 | 0.03156 |
| Angry | 0 | 0.02541 |
| Doll | 0 | 0.01447 |
| Idol | 0 | 0.01025 |
| Star | 0 | 0.01183 |
| Heart | 0 | 0.01164 |
This is geometry math QA, not physical iPhone quality validation or collision/interpenetration certification. Two triangles remain reversed in Sad, so production acceptance is blocked.

## Required owner visual checks
1. Tươi cười: honey amber smaller iris/pupil and actually curved happy lids, not sleepy horizontal slits.
2. Tinh nghịch: teal iris oval pupil and asymmetrical teasing eye; check lash attachment.
3. Giận dữ: ruby sharp pupil/dark rim, inner brow and lid tension; no folds.
4. Búp bê / Thần tượng: visibly different purple large-eye and sapphire starburst iris designs (not purple source with hue only).
5. Ngôi sao / Trái tim: center motif remains upright, reasonably sized and centered in both pupils at front/3/4.
6. Check neutral and 3/4 on iPhone for shader projection drift, clipped mask, pupil duplication, shade flattening and thermal/FPS issues.
7. No approval/merge into game runtime until owner confirms art fidelity.

## Architectural limitations
This is still fragment material retexturing on the original 3D eye mesh and localized morphs on a fragmented single head mesh, NOT separately replaceable eyeball and iris geometry, Blender-sculpted production shapes, or verified eyelash attachment. This QA tests the approved artistic direction; final modular shop-ready eyes require explicit separated eye components/UV and robust eyelid topology. Do not modify Character Catalog, RoomState, WebAudio, gauge, Finish, gameplay, Supabase or main/development. Do not merge.
