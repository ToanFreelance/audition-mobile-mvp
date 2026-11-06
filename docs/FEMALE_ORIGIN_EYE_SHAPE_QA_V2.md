# Female Origin Eye Shape QA V2
Status: EXPERIMENTAL — OWNER VISUAL ACCEPTANCE PENDING, NOT PRODUCTION.

## Goal
The owner accepted the original-iris hue recolor and pupil-aligned Star/Heart effects in Eye QA V1.4. This V2 extends the isolated QA to the nine styles from the approved Eye Asset Pack without swapping the head or overwriting the original GLB.

## Implementation
- Same GLB is loaded directly through iPhone Files using the browser File API (no Supabase/server upload).
- Keep the existing shader's HSV iris recolor and pupil-centered star/heart motifs byte-for-byte.
- Add GPU vertex shader deformations in the same GLB mesh around the frontal upper/lower eyelids and eyebrows. Position masks are calibrated against the original mesh: eye center |x|≈0.116, upper lid local z≈-0.558, lower lid -0.464, brow -0.646, +Y faces camera.
- Expression catalog: Natural retains original contour; Joyful lowers upper lid; Sad droops outer corner and lifts brow; Playful creates asymmetric half-lid; Angry lowers inner lid/brow; Doll/Idol/Star/Heart retain more open shapes.
- UI lets the owner compare against original head, adjust strength 0–100%, and preview a temporary partial blink in the isolated QA route. It does not re-create scene or reload assets when changing style.
- Vertex shader onBeforeCompile updates shared uniforms; geometry and material source GLB are not edited/exported.

## Explicit limitations
Not retopology, fully separated eyeball mesh, artist-sculpted facial blendshapes, production-ready eyelid closure, or true runtime cosmetic asset modularity. The face/eyes/brows remain one imported mesh. Blink is only a local deformation QA, NOT final blink. The local-coordinate thresholds are asset-specific and require adjustment if mesh changes. Deformation can visually clip at aggressive slider strength; require owner iPhone inspection and subsequent Blender sculpt/retopo before merging.

## Safety & scope
Only the static /qa/female-origin-eyes-v1/index.html lab is changed. No Character Catalog, multiplayer, RoomState, Supabase, WebAudio, global rhythm timeline, Finish, gauge or game runtime. No merge to development/main.

## Checks
JavaScript syntax parsed; shader source construction manually checked. GitHub diff / Vercel build should be inspected after commit. Physical iPhone visual/performance QA remains owner-pending.
