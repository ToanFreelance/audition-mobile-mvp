# Dark Idol Eye V1 — native topology sculpt + fitted lash, isolated QA

## Purpose and acceptance

Art-pipeline experiment addressing owner rejection of simple iris recolors and
Spider Queen floating attachments. Render candidate **not** commercially premium
or owner-accepted; owner physical iPhone review is primary visual gate.
Single Unified Heroine, PR #24 work branch only. No inventory/shop/gameplay.

## Implementation

- Blender script: scripts/unified-heroine-v1/sculpt_dark_idol_eye_v1.py.
  Reads approved canonical Unified Heroine GLB, locates native FaceEyeline and
  FaceEyelash material polygons, sculpts the outer corner of original face
  vertices in Blender while preserving 57 shape keys, UV and skin weights.
  Exports vertex-index offset map in
  app/tools/unified-heroine-v1/dark-idol-eye-v1-sculpt.json.
- Runtime: UnifiedEyePack applies the sculpt offsets in-place to the existing
  2054-vertex face SkinnedMeshes. On unequip it restores *exact original
  vertex buffers*. No new actor / skeleton / AnimationMixer instance.
- Separate Blender script: scripts/unified-heroine-v1/build_dark_idol_lashes.py
  uses native FaceEyelash skin/morph source as positional reference, models
  two curved upper-lash meshes (~168 triangles), exports actual GLB with
  shape keys Blink and Joy:
  public/characters/unified-heroine-v1/dark-idol-native-lashes-v1-1ba835887c25.glb.
  The GLB is checked into GitHub explicitly despite the generic generated GLB
  ignore rule; Vercel build does **not** require Blender.
- DarkIdolLashOverlay loads the real lash GLB only when selected and mounts it
  under J_Bip_C_Head, correcting static facial inverse-bind offset using the
  source SkinnedMesh applyBoneTransform at the canonical eyelash vertex.
  Drives lash Blink/Joy from existing face morph state, no independent clock.
  Keeps loaded mesh hidden and cached while unequipped.
- Iris texture generation: scripts/unified-heroine-v1/build_dark_idol_eye.mjs
  -> 2048x1024 eye-dark-idol-v1.png; derived from accepted native VRoid iris
  UV layout and alpha, no stickers/logos.
- UV face makeup: scripts/unified-heroine-v1/build_dark_idol_makeup.mjs
  -> 1024x1024 face-dark-idol-makeup-v1.png from original VRoid Face_00
  texture with subtle plum edge treatment at measured eye skin UV.
- Two PNGs generated at prebuild and served static through Vercel. Neither
  touches Supabase Storage. Existing global WebAudio rhythm clock untouched.

## Visual process / limitations

- Early lash mesh floated above eye because raw GLTF face coordinates differ
  from post-skinning pose. Root cause corrected by sampling existing skinned
  eyelash vertex in world space, not by introducing a magic Y offset.
- Side-by-side Premium Idol vs Dark Idol Eye Macro shows dark plum iris and
  some eyeliner/lash shape change; visual result still relatively modest.
- Blender source geometry is not an artist-made hand-sculpted commercial
  product; this is a procedural-proportional sculpt experiment with actual
  mesh edits. Do not claim 90% Golden Concept fidelity.
- Independent Blink/Joy targets on lash GLB approximate native expression,
  not complete per-vertex skinning; inspect 3/4 and Blink on owner iPhone.
- Existing Spider Queen rejected visually; retained as separate technical
  candidate, not treated as a premium visual reference.

## Minimum validation

- Verify unchanged PR base, source GLB and docs; run Blender sculpt + import.
- Run TypeScript, Next.js build with regenerated iris and makeup PNG.
- Mobile Chromium WebGL 390x844 DPR2: PNG/GLB loads, original actor UUID
  persists, one AnimationMixer during dance, eye preset switching,
  Blink Test, Face, 3/4, outfit/hair.
- iPhone Safari owner visual approval remains PENDING.
- No main/development edits, no PR merge.

