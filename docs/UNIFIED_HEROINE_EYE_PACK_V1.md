# Unified Heroine — Real Eye Pack V1 / Technical & Visual QA

## Task / scope
Owner requests a genuine 3D modular eye proof on the existing unified VRoid heroine, not a new hero or shop implementation.
Route: /tools/unified-heroine-v1 on PR #24 work/facial-modular-eye-demo-v1.

## Real assets + architecture
- The existing source VRoid A Face.baked has real SkinnedMesh iris geometry, shared face materials/UV, 56 morph targets and one 157-bone rig.
- scripts/unified-heroine-v1/build_eye_pack.mjs extracts the embedded EyeIris 1024x512 RGBA atlas from the actual generated GLB and bakes five separate PNG texture assets: Natural, Doll, Idol, Star, Heart.
- Preserves the original atlas alpha mask and UV boundaries, rasterizes distinct iris hues and decorative symbols into the native atlas. Not billboard quads or screen compositing.
- UnifiedEyePack.ts is an isolated runtime controller: eyeAssetId -> atlas texture URL + preset morphs -> existing EyeIris material on one actor. It does not reconstruct actor, geometry, rig, skeleton, AnimationMixer or global gameplay clock.
- Natural uses the GLB embedded original image; other four PNG textures lazy-load once and are cached by the controller. No extra GLB load on eye changes. Texture URLs are asset-versioned and cached by Vercel, not Supabase.
- Real VRoid face Blink morph test, Auto Blink and expression morphs are separate from the demo dance clip. EyeMacro camera is an isolated optical QA preset.
- Glasses frames are moved outward along the character-local front direction to address their partial embedding in the face; iPhone reinspection required.
- The eyelashes, eyeliner and lids are the existing real VRoid face geometry. Eye Pack V1 adds textured iris/pupil decoration and expression morph presets, NOT individually sculpted modular lash/eyelid meshes.

## QA (executed in Chromium headless / WebGL / SwiftShader)
- 5 presets were loaded into the 3D viewer; all 5 presented distinct canvas output.
- One GLB network request and four additional EyePack PNG requests over five preset selections; each PNG is only ~45 KB (Natural PNG ~156 KB but reused from the GLB).
- Blink Test produced nonzero image change; 10 morph meshes recognized.
- Eye pack changed while Dance, hair, accessories and outfit toggles remained functional, actor UUID constant, one AnimationMixer, zero page exceptions.
- Same mobile canvas: CSS 370x565, backing buffer 740x1130 at DPR=2.
- Pixel differences measured for screenshot comparisons are small across the whole canvas because eyes occupy a small portion; use EyeMacro for visual evaluation.
- Requires owner iPhone front/3/4/eye macro visual acceptance and scrutiny of pattern shape, blink, eyelash/liner fidelity and glasses offset.
- Browser render QA proves functionality only. It does NOT mean 90% concept fidelity and does NOT validate shop entitlements, inventory persistence or onboarding.

## Future capability proven vs pending
Proven at demo scope: modular texture asset IDs, runtime look swaps, loaded-asset caching, expression/blink integration and animation coexistence on one character.
Pending roadmap: Character Catalog/DB registration, ownership and paid entitlements, inventory migrations, save/load, user asset selections, server authorization, multi-character localization, mobile memory/thermal profiles and artist-quality eyelash/lid modular mesh rebuild.
No Supabase Storage, Waiting Room, WebAudio, gauge or authoritative global timeline changes.

## Source & rights
Original meshes, UVs and face assets belong to pixiv VRoid samples A/B, subject to their licensing terms.
The supplied 9-eye artwork is Golden art direction, not automatically proof of 1:1 geometry. Do not commercialize without licensing/review.
