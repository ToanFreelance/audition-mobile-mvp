# Anime Lite Heroine V2 — Option A / Independent Character QA

## Scope
Owner authorized a NEW character, not repeated VRoid V1 adjustments.
Isolated iPhone-first experiment: /tools/anime-lite-heroine-v2 on existing
work/facial-modular-eye-demo-v1 and Draft PR #24.
V1 /tools/unified-heroine-v1 unchanged. No Character Catalog, Waiting Room,
WebAudio gameplay, Supabase, Shop/Inventory, production changes or merge.

## New base and license
Pin: https://github.com/kblood/CharacterCreator at commit
852e48f316b90a0937234886630e4fb4cdfd1f78.

Upstream LICENSE-NOTES.md explicitly distinguishes its GPL-3.0-or-later
SOURCE CODE from CC0-1.0 GENERATED 3D BINARY ASSETS (output/base_body.glb,
hair_*.glb, clothing_*.glb). We use generated CC0 models only, never
upstream GPL code. MakeHuman-based character geometry, materials and rig
are wholly independent from Unified Heroine VRoid V1; no V1 geometry reused.
Source hashes and provenance are recorded in
scripts/anime-lite-v2/materialize_assets.mjs.

This is a CC0 stock-derived semi-anime character candidate, NOT a
hand-sculpted commercial Premium asset or finalized game character.

## Technical architecture
- New base: 53 bones, original 92 source morph targets, separate skinned
  hair and clothing meshes.
- Outfit: dress OR T-shirt/jacket/jeans; shoes.
- Hair: Long or French Bob. Eyes: Honey, Hazel and Violet pigment.
- One shared actor UUID and ONE AnimationMixer persist across switches.
- Separate mesh sources are skinned onto the same 53-bone skeleton using
  matching bone names and original inverse bind matrices.
- Native Blink Left/Right retained; soft clean directional lights have no
  dynamic hair-shadow artifacts.
- Dance is an isolated QA gesture, NOT WebAudio gameplay or production
  animation retargeting.
- V1 stays untouched for A/B comparison.

## Source morph critical fix
The upstream glTF imports with ALL 92 morph targets set to 1, distorting
the face and closing eyes. We reset to 0 and choose subtle female,
eye-size, nose-width and proportions morphs. The runtime BAKEs four static
morphs into original rest positions/normals and retains only left/right
Blink on facial mesh. Hidden morph inputs no longer burden WebGL shaders.
Source still has 92 shape keys, but only 2 live Blink targets are exposed
in this experiment. Do not claim all 92 are configurable live.

## Asset storage / build
At prebuild/predev, materialize_assets.mjs fetches 8 SHA-256 pinned CC0
GLBs from a specific upstream Git commit. All filenames include content
hashes and Vercel serves immutable static assets; no iPhone runtime
GitHub connection or Supabase Storage usage. Build still depends on
upstream availability and could be vendored later with approval.

## QA conducted
- Blender 5 loaded new separate CC0 base, hair, dress, shoes, jeans,
  T-shirt and jacket, verified independent 53-bone rig and 92 morphs.
- Blender Cycles render iteration found and rejected a self-generated
  strand coiffure; that sculpt is NOT committed as the candidate.
- Chromium SwiftShader mobile viewport 390x844 DPR2 screenshots:
  full body, face, left/right 3/4, hair swap, outfit swap, Blink, Dance.
  No JavaScript page error, HTTP 4xx/5xx asset failure or actor UUID change.
- Before static morph bake, software render dipped to 2 FPS under QA load.
  After bake, repeat test reached 60 FPS sample with one mixer and same
  actor. This is software rasterizer, NOT physical iPhone hardware proof.
- Physical iPhone art acceptance and longer thermal/FPS QA are PENDING.

## Remaining risks
- New base has 3D facial volume but still semi-realistic stock aesthetics,
  not yet an accepted anime-idol Golden Reference character.
- Eight initial GLBs (~13MB total) may require deferred module loading.
- Existing 157-bone VRoid dance clips are NOT retargeted to 53-bone V2;
  QA gesture only.
- Final gameplay/catalog, premium item/eye pack compatibility and
  production shop/inventory have not been modified or validated.

