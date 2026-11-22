# Character Style A+B — V1.4.1 MToon black-silhouette fix

## Owner observation (iPhone Safari, 2026-11-03)
- In the `VRM MToon` mode, the entire avatar renders as a pure black silhouette.
- Environment/stage renders, so this is not a general WebGL context or camera failure.
- glTF legacy mode renders the original avatar normally.

## Root cause (isolated and experimentally reproduced)
`app/tools/character-style-ab-v1/page.tsx` calls `material.update()` **without the mandatory `delta: number` argument**. The implementation of `@pixiv/three-vrm` MToonMaterial uses delta to advance UV animation. An undefined delta makes UV offsets invalid (`NaN`), causing sampled textures to appear black. Disabling eye/hair/outfit material changes and disabling MToon outlines do not resolve the bug; supplying the frame delta does.

## Focused implementation
- MToon material update calls use `material.update(delta)` with the scene's existing bounded frame delta.
- Correct TypeScript signatures for `Stage.vrmMaterials` and `vrmData.materials`.
- No changes to model assets, MToon color choices, outfits, modular eyes/hair, animation QA, renderer resolution, gameplay or Character Catalog.

## QA performed
- Chromium WebGL2/SwiftShader (390x844 portrait), official VRoid AvatarSample_A.
- Baseline MToon screenshot: black fraction 61.27% of the central test region (near-black max RGB under 25).
- With ONLY the delta parameter fix: black fraction 0.90% for same region and view. Previously-black face and clothing have visible colors.
- Legacy glTF remains unaffected; no console errors in this controlled check.
- Soft Mature: additional Basic, Premium outfit swap and Step procedural animation screenshots remained colored; no JS errors.
- A separate same-session Fashion Idol screenshot stress test was interrupted by the QA browser/session. This does NOT count as device or full cross-avatar visual acceptance.
- TypeScript/Next.js build checked in an isolated QA environment. Vercel Preview state should be checked after commit.

## Acceptance to confirm on iPhone
1. Open the new preview route `/tools/character-style-ab-v1`.
2. With VRM MToon selected (default), inspect Soft Mature and Fashion Idol (front/3-4/full); both must show material colors instead of black.
3. Toggle MToon ↔ glTF legacy; check face/eye/outfit and brightness.
4. Toggle Premium, Ponytail, Glasses and Step animation; verify materials stay visible.
5. If Safari still differs from Chromium, collect the screenshot, iPhone OS version and selected options; **do not** mark iPhone PASS from desktop proxy QA.

Branch `work/facial-modular-eye-demo-v1`, PR #24 Draft, no merges.
