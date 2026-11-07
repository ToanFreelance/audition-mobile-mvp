# Female Origin — Eye Concept V4 Fixed-Pose QA

**Status:** Isolated experimental iPhone visual QA. Owner visual acceptance pending.

## Owner direction
No more strength/percentage slider. Every choice must be one fixed eye pose, immediately previewable by tapping its name. Natural uses base mesh; each of the other eight variants has its own POSITION morph target.

## Implementation
Isolated route /qa/female-origin-eye-concept-v4/. Based on the owner original Female_anime_origin.glb, read only from iPhone Files. The new local module eye-morph-concept-v4.js constructs eight independent target attributes: Joyful, Sad, Playful, Angry, Doll, Idol, Star, Heart. The QA sets exactly one target weight to 1 and all others to 0; no global strength scaling. Existing V3.1 route remains unchanged for rollback. Existing approved iris HSV recolor and pupil-centered Star/Heart shader is copied unchanged. No Supabase transfers.

## Geometry QA on owner source
292,645 vertices; 499,762 triangles. Normal-direction triangle reversals against the base at full target: Joyful 3, Sad 3, Playful 3, Angry 2, Doll 0, Idol 0, Star 0, Heart 0. Peak |z| local displacement: Joyful 0.02223, Sad 0.01261, Playful 0.02741, Angry 0.01668. Tested from the same analytic coefficients on original geometry; static geometry check only. These are NOT zero-inversion/final-quality results and not iPhone WebGL acceptance.

## Remaining risks
The source is a single dense, fragmented mesh with no retopologized eyelid/lash components. 2–3 flipped triangles remain in strong presets. Pose-specific displacement is NOT an artist-sculpted Blender rig; if visual is still off, proceed to actual sculpt and retopology rather than reintroducing strength sliders. Blink is not included in owner concept QA. No Character Catalog or game integration, no merge to development/main.
