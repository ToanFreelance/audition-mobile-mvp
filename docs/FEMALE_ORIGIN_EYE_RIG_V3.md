# Female Origin · Real Eye Rig V3 — isolated QA

**Status:** Experimental / not artist-approved / not production ready.

## What was actually built
The owner-provided original 44.7 MB Female_anime_origin.glb was processed offline to create a **real glTF 2.0 morph-target GLB**: Female_anime_eye_rig_v3_QA.glb (~49 MB), with 7 named POSITION sparse morph targets: EyeSmile, EyeSad, EyePlayful, EyeAngry, EyeDoll, EyeIdol, and EyeBlink. These target deltas are in the GLB buffer and can be controlled via \`mesh.morphTargetInfluences\` in Three.js; not computed in vertex-shader logic.

Input base positions, UVs, indices, materials, normal textures, and facial surface are retained. Eye iris/pupil hue remapping plus Star/Heart pattern from V1.4 is preserved as an optional *fragment-only* shader.

This QA viewer is an isolated new route \`/qa/female-origin-eye-rig-v3/\`. Older V1/V2 route is kept unchanged. The preview loads the V3 GLB **only via the owner iPhone Files input**; source and generated binary are not committed or transferred to Supabase.

## QA and constraints
Sparse glTF accessors validated for all 7 targets (indices ordered, finite deltas, unchanged source binary chunk). Mesh ~292,645 vertices / ~499,762 triangles. Original head is a highly fragmented source mesh (~4,383 connected geometric components despite one glTF mesh), not a retopologized facial rig. A geometry test identified inverted triangles in several full-strength morphs, especially EyeBlink. **Blink preview is capped at 78%** and **is NOT a proven full eyelid closure**. Do not approve, merge, or use this asset in Character Catalog or gameplay until Blender sculpt/retopology and independent artist visual QA resolve topology, eyelid overlap, normal shading and iPhone performance.

Shape presets are exploratory but are visibly stronger than V2 shader-only offsets. Natural: 0 weights; Joyful: EyeSmile; Sad: EyeSad; Playful: EyePlayful; Angry: EyeAngry; Doll: EyeDoll; Idol, Star and Heart share EyeIdol (different iris fragment shader). 0–100% slider scales active morph. Original button resets all morph weights and iris modification; styles don't recreate actors or meshes.

## Files and deployment scope
- \`public/qa/female-origin-eye-rig-v3/index.html\`: isolated owner iPhone experiment, consumes V3 GLB.
- \`docs/FEMALE_ORIGIN_EYE_RIG_V3.md\`: limitations and evidence.
- The new asset + authoring script are available as QA files in the conversation, **not** as production assets in GitHub due to size and explicit visual-acceptance gate.
- No changes to \`main\`, \`development\`, Character Catalog, animation controller, WebAudio clock, RoomState/CAS, Ready/Start/preload, Finish, gauge, or global timeline. No merge.

## Acceptance
Require: successful iPhone GLB import, distinct eyelid silhouettes for joyful/sad/angry/playful at 100% from original, natural 3/4 look, no eyelashes or eyelids clipping, blink/closure validation, acceptable FPS. These are **not yet PASS**. Before production, produce proper separated lid topology and approved Blender morph targets; this V3 is only a feasibility artifact.
