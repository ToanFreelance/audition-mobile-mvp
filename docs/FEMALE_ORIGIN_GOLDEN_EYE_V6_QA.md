# Female Origin — Golden Eye V6 (owner-approved reference implementation)

## Accepted source of truth
The owner explicitly approved the **new** 3×3 **"Golden Concept – Gói Mắt Nhân Vật"** on **2026-11-07**, with all nine eye designs mounted on the current bare female head. This image supersedes the older eye-only "Eye Asset Pack" sheet for visual acceptance. The instruction is to implement, **not regenerate any sketches/concepts**.

Original uploaded reference: `6F82BEF5-B453-4AEC-A2A2-6FCE9F4C21E3.jpeg`, 1055×1491 pixels, SHA-256 `597f1847178549352acc508a969046532f4a957935f12355e7ec46a92b1f1ed6`. The image was provided by the owner in this conversation; the nine iris samples are represented in the committed atlas. Keep the owner-supplied original sheet as the visual truth for full eyelids, brows, lashes and head proportions. Do not infer facial shapes from icon names.

## V6 implementation and scope
QA route: `/qa/female-origin-eye-golden-v6/index.html`.
Files:
- `golden-iris-atlas.webp`: a 3×3, 144×144, 48px-per-cell WebP atlas directly sampled from the nine *already approved* Golden head renders, order Natural, Joyful, Sad / Playful, Angry, Doll / Idol, Star, Heart. Reference-derived previews have parts of source eyebrows, lash shadows, or partially occluded irises, so this is **a first golden-texture extraction pass, not a final UV-painted production atlas**. Asset is ~3.2 KiB and served from Vercel, never Supabase.
- `eye-golden-v6.js`: independent sampler and 3D surface projection for each Golden iris tile, guarded by the original GLB violet pigment coverage mask. No new artificial concentric disc/pupil overlay; no more nine versions created merely by a hue shift. Golden tiles provide visibly different pupils, glow, star and heart shapes. Projected by original asset-local coordinates onto the existing 3D head, NOT flat UI artwork.
- `eye-morph-golden-v6.js`: fixed eyelid/brow geometry pose for eight styles, Natural keeps the original source topology. Unlike the historical V5 code, **Playful keeps BOTH eyes open and approximately balanced**; Joyful is curved and visibly open, Sad softer, Angry sharper, and Doll/Idol/Star/Heart open to display their true motifs.
- `index.html`: new isolated iPhone QA route, nine single-tap choices with texture-based selection indicators, front/3/4/eye-zoom camera controls, no 0–100% sliders. Owner continues to load existing `Female_anime_origin.glb` from iPhone Files. The file stays on-device: no Supabase upload/GLB replacement, nor scene reconstruction on style selection.

Historical `/qa/female-origin-eye-concept-v51/` and earlier V5/V4 are preserved exactly for regression comparison.

## Accepted nine style silhouettes (do not substitute generic intensity slider)
| Style | Golden reference features |
| --- | --- |
| Tự nhiên | warm chocolate/caramel iris, round pupil, bright upper glint, soft open lids |
| Tươi cười | smiling gently narrowed but NOT sleepy lids, visible amber iris, lifted lower lid |
| Buồn | lilac-violet round iris, eyebrows lifted toward inner end and relaxed lids |
| Tinh nghịch | turquoise irises, BOTH eyes open similarly with subtle cheeky outer-corner tension — specifically not a one-eye wink |
| Giận dữ | ruby red irises, firm slanted upper lids and inward brow tension |
| Búp bê | large lavender iris and round pupil, glossy prominent catchlights |
| Thần tượng | saturated sapphire eye, blue star-like central motif, sparkles |
| Ngôi sao | distinct, prominent, upright yellow five-point star over purple iris |
| Trái tim | glossy pink heart with two lobes, rounded volume and pointed bottom, centered in pink iris |

## Validation actually performed
- Inspected current working-branch HEAD and `docs/PROJECT_INSTRUCTIONS.md`; did not touch development/main or Character Catalog.
- Verified source original `Female_anime_origin.glb` exists locally: **292,645 vertices, 499,762 triangles**, 1 main mesh, matching the V6 morph generator contract.
- Evaluated V6 fixed pose equations against the *actual source GLB triangles*: normal-direction reversals **0 for all eight morphs**. Vertex displacement max (asset units): Joyful 0.01364, Sad 0.00707, Playful 0.00343, Angry 0.01677, Doll 0.01256, Idol 0.00982, Star/Heart 0.01082. This verifies a limited numerical condition only; it does **not** prove zero eyelid/lash intersections or artistic fidelity.
- Generated and decoded the 144×144 WebP atlas, checked its Git blob hash `6f4425e3e569054e5bbb635acf44980a7f466694` and SHA-256 `df8f5988aa4ad32021dab901faaf41b78cba4adc187148245ab4547f2534d0bc`.
- Checked inline JS syntax, morph/shader module syntax, nine-style order and selector bindings. **GLSL shader compilation, exact atlas orientation/projection, live iPhone browser and 3/4 acceptance remain pending.** Do not claim a visual PASS solely from triangle tests.

## Risks and next acceptance gates
The source is one dense fragmented mesh, not independently rigged eye spheres. V6 projects Golden reference-derived textures onto existing 3D geometry; it does not create separate iris mesh/UV swap packs, complete artist-sculpted eyelid blendshapes, or correct lash topology. The reference is a painted concept, so partial eyelash/sclera pixels may occur in the extracted atlas and must be checked visually before final texture cleanup. Retopology and physically correct eye modularity remain future explicit tasks. In particular, owner must check Tinh nghịch opens both eyes and matches the new Golden, not the older speculative wink. No gameplay/WebAudio/RoomState/CAS/Realtime/gauge/Finish edits. No automatic merge.

Owner visual acceptance is the release gate, first on iPhone at front view and 3/4. If the atlas maps off-center or creates an old-purple halo, fix texture alignment at the source/material level rather than hiding it with a strength slider.
