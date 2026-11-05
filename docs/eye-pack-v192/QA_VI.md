# Eye Asset Pack V1.9.2 — Rounded Silhouette Correction (QA)
**Status: PARTIALLY READY / NOT VISUALLY ACCEPTED.** Owner reference is the approved 9-eye concept. This pass is a focused geometry fairing, not a complete manual sculpt or full concept reconstruction.

## Root cause
V1.9.1 authored upper/lower eye apertures using asymmetrical landmark PCHIP contours. While expression improved over V1.9, a few eye openings looked uneven/pinched or squashed against their iris. Uniformly lowering the aperture worsened the result and caused hard eyelash strokes; the first prototype was rejected before deployment.

## Real geometry implementation
- **Source:** V1.9.1 GLB SHA-256 `312c0c4fdf74de9c366258d1442039db12c7c82ffa13d6d4fe407854853d9ac4`.
- **Output:** 9-set V1.9.2 QA GLB SHA-256 `7221dac79642b283f85740c3ca3053d49f19f52aabf29a6296fb091c0f265cf2`, 49,084,496 bytes.
- **Asset:** https://d2ol7oe51mr4n9.cloudfront.net/user_3Jb86LOyd6RRYonCk2iie6jkL5h/c5fb69e0-0b87-4bbb-9fd2-77e6e122c931.glb
- **9-eye contact sheet:** https://d2ol7oe51mr4n9.cloudfront.net/user_3Jb86LOyd6RRYonCk2iie6jkL5h/ecb4703c-4283-45fa-9b49-7170a66f8f65.jpg
- **Algorithm:** preserve exact canthus endpoints, fit analytic soft rounded eyelid openings with per-set apertures, reduce unintentional midline waviness, apply same localized displacement to EyeSet Skin, Lids, Ocular and Lashes for both eyes. Lash ribbon tips follow their corresponding lid roots instead of independent vertical falloff. All authored Blink/BlinkArc POSITION morphs transformed consistently.
- **Scope:** 71 module meshes modified, 154,915 affected vertices. Original head mesh/UV, all 14 embedded images and the 9 accepted iris texture bytes unchanged; no new meshes or materials. Original Claude rollback retained. One source module is outside the affected zone.
- **Crucial:** EyeSet ocular is warped with lids at the shared boundary to preserve seam/edge and avoid iris showing between pieces. No extra iris geometry.
- Changes remain confined to independent EyeSet QA pack and the preview asset reference/cache key. Production Character Catalog and rhythm gameplay untouched.

## Validation actually run
- **Khronos glTF Validator:** 0 errors, 12 warnings (tangent-space); 12 infos. Do not claim warning-free or fully portable normal-map behavior.
- **Geometry validator (full):** PASS; topology/UV/normal, 9 iris images byte-identical to V1.9, common source head unchanged, exact skin/lid/ocular seams, no winding reversals, 5 blink poses per set, 54 closed-eye depth probes at 0°/±28°, **0 visible ocular pixels when closed** in those probes.
- **Blender 4.5 / Cycles CPU:** GLB exported and re-imported, rendered 9 EyeSets at consistent camera/light, Natural half blink + closed; QA contact sheet generated from reimported asset.
- **Chromium WebGL2 / ANGLE SwiftShader:** GLTFLoader parsed the new full GLB, Three.js rendered Natural under WebGL2, no JS console errors. This uses software GPU, not physical iPhone Safari.
- **GitHub/Vercel:** Next.js/TypeScript build result should be checked on the new commit and reported separately.
- **Not run:** full physical iPhone Safari acceptance, real-device performance/thermal test, comprehensive Playwright suite.

## Remaining artistic risks
- Still does not replicate the 2D reference perfectly: source Claude V2 socket skin/eyebrow shading and original eyelash design remain, so face may look less soft/cute than concept.
- The shape change is **procedural mesh fairing**, not freehand sculpt with an art-directed facial rig. Must be evaluated on iPhone for all 9 shapes, 3/4 angles, blink and gaze.
- No change to accepted iris palette. Owner acceptance is required before any production integration.

## Branch discipline
- Branch: `work/facial-modular-eye-demo-v1`; PR #24 Draft/open. Do not merge.
- Development/main, multiplayer, Supabase protocol, WebAudio, gauge, Waiting Room and Character Catalog untouched.
