# Female Origin · Real Eye Rig V3 — isolated QA

**Status:** Experimental / not artist-approved / not production ready.

## What was actually built
The owner-provided original 44.7 MB Female_anime_origin.glb was processed offline to create a **real glTF 2.0 morph-target GLB**: Female_anime_eye_rig_v3_QA.glb (~49 MB), with 7 named POSITION sparse morph targets: EyeSmile, EyeSad, EyePlayful, EyeAngry, EyeDoll, EyeIdol, and EyeBlink. These target deltas are in the GLB buffer and can be controlled via \`mesh.morphTargetInfluences\` in Three.js; not computed in vertex-shader logic.

Input base positions, UVs, indices, materials, normal textures, and facial surface are retained. Eye iris/pupil hue remapping plus Star/Heart pattern from V1.4 is preserved as an optional *fragment-only* shader.

This QA viewer is an isolated new route \`/qa/female-origin-eye-rig-v3/\`. Older V1/V2 route is kept unchanged. The preview accepts the owner-original GLB already present in iPhone Files and **generates 7 real Three.js BufferGeometry POSITION morph targets locally in memory** using a browser port of the V3 authoring formulas; alternatively accepts the prebuilt V3 GLB if available. No generated binary upload to Supabase or GitHub.

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

## iPhone download failure workaround (2026-11-06)
Owner's iPhone ChatGPT download of the ~49 MB V3 artifact failed before import. The GLB file was inspected on disk (49,362,388 bytes, SHA-256 20547ad7f1ad1e959476d115d471bdf463485af7f624b687d2bbb54a09d95e37; 7 targets verified). To avoid relying on that download, QA now accepts the original GLB already held by the owner. Client-side generation uses the Python V3 formulas and constructs true Three.js relative morph attributes; these targets are in memory, **not persisted to the source GLB**. This differs from downloading the authored V3 GLB while preserving its morph influence behavior. Physical iPhone memory/performance and appearance still need validation.


## Eye Rig V3.1 — 2026-11-07: smooth eyelid falloff (experimental)

**Root cause:** V3's narrow Gaussian upper/lower lid masks and hard lateral corner blend caused high surface-normal distortion and folded triangles near inner eyeliner corners. Owner iPhone images at 75% showed kinked smile/playful/angry lids. Continuing to multiply strength was unsafe.

**Implementation:** Isolated `eye-morph-v31.js` creates the same seven real THREE.BufferGeometry POSITION morph targets at run time from `Female_anime_origin.glb`. The old inline V3 generator is replaced. Upper-lid transition sigma increases from 0.026 to 0.050; lower from 0.023 to 0.041; eye corner smoothstep is expanded. Calibrated maximum displacement is scaled to 90% of newly defined target amounts. Eye iris HSV / star / heart code is UNCHANGED. The old V3 prebaked GLB is rejected to prevent stale morphs from being shown as V3.1. No binary download or Supabase upload.

**Actual validation:** With the owner source GLB (292,645 vertices, 499,762 triangles), original V3 full-weight triangle inversions: Smile 289, Sad 12, Playful 255, Angry 92, Doll 0, Idol 0, Blink 1344. New V3.1: Smile 4, Sad 5, Playful 3, Angry 5, Doll 0, Idol 0, Blink 5 (1.0 morph weight, tests count triangles whose normals reverse relative to the base). At 100% smile normal change p95 decreases from 43.9° to 35.9°. JS and Python positions agree to <=3.0e-8. Offscreen VTK geometry renders were inspected; **not equivalent to iPhone WebGL QA**. Zero-inversion acceptance is NOT achieved, even though reduction is significant.

**Risks:** This is still source-specific procedural sculpting on a fragmented mesh, NOT retopology, a Blender-based eyelid rig, proof that eyelashes have anatomically correct attachments, or a full Blink. Full skin/eyelash collision QA and owner iPhone acceptance remain pending. Existing Blink preview remains capped at 78%. Do not merge into development/main or modify Character Catalog until owner approves and a proper retopo pass is available.
