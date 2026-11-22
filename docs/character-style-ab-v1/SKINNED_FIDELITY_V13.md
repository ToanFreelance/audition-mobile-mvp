# Character Style A+B — V1.3 Premium SkinnedMesh & Retina Fidelity

## Owner direction
Owner accepted V1.2 character direction, modular eyes/hair/glasses and procedural animation tests on real iPhone. Requested a real SkinnedMesh garment demo and asked why characters look soft/low-detail.

## Root cause of softness
The V1.2 renderer unconditionally caps DPR to 1.6 (while Retina iPhone reports approximately 3). This draws only (1.6/3)^2 = 28.4% of the native drawing-buffer pixel count. Additional quality determinants include source VRM texture resolution, the viewport's camera zoom/lighting, and device GPU limits. Do not conclude source texture quality is poor without measurement.

## Implementation scope
- Existing isolated route /tools/character-style-ab-v1 only.
- New SkinnedWardrobe.ts uses actual source VRoid SkinnedMesh, preserved skinIndex/skinWeight, UVs, skeleton and bind matrices. Creates a tint/finish premium overlay with copied geometry and materials under the SAME parent node as the original garment, so it deforms with animation.
- Select source garment material groups only; do not duplicate face/skin/hair. If the source has no matched skinned clothing, the viewer explicitly reports no SkinnedMesh found and falls back to existing material tint — do not pretend this is rigged.
- Remove old static premium jacket/belt shells, which were not skinned and could clip visibly in bone animations.
- Dispose ONLY cloned overlay materials and geometry; source skeleton remains untouched.
- Renderer quality: Mượt DPR cap 1.4, Sắc nét 2.1 (default), Ultra 3.0; cap total buffer pixels for memory/thermal protection.
- Display actual drawing buffer DPR and dimensions; inspect source texture count and largest dimension.
- Improve texture anisotropy to a bounded 4x in this scene only.

## Acceptance matrix
1. On iPhone Safari select Soft Mature, then Fashion Idol. For each choose Basic, then Premium Skinned.
2. In the green catalog status verify Premium SkinnedMesh count > 0. If 0, the source clothing is not skinned or material names don't match and this is NOT a successful SkinnedMesh demo.
3. Run head nod / idle / step / wave and the QA suite. Check that the Premium garment overlay bends with original torso/arms and does not shift off skeleton.
4. Turn Premium/Basic on and off 5x during animation. No ghost clothing or accumulating overlay geometry.
5. Compare Mượt, Sắc nét and Ultra at the SAME face camera view. Read actual DPR and texture resolution. Test FPS/thermal by observation; don't assume Ultra is appropriate for gameplay.
6. Confirm eyes, ponytail, glasses, front/back and local VRM/GLB import still work.

## Boundaries / remaining risks
- This is a SkinnedMesh overlay derived from existing VRoid clothing, NOT an independently authored modular outfit or commercial shop product.
- Texture detail of upstream sample may remain limited despite increasing canvas DPR.
- Duplicating skinned mesh geometry and materials incurs GPU memory/draw calls; limit to QA route, don't port to multiplayer.
- No owner iPhone visual acceptance is claimed from build alone.
- No change to game audio, clock, gauge, Waiting Room, character catalog, production branches or any shop/VIP entitlement logic.

## Branch & PR
work/facial-modular-eye-demo-v1, PR #24 Draft. Do not merge.
