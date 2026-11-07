# Female Golden Eye V7 — independent iris artwork & corrected eyelids

## Owner-approved golden references (2026-11-07)
1. **Golden Concept – Gói Mắt Nhân Vật:** approved head sheet with nine eye silhouettes, brows and expressions; the owner explicitly locked this as the new Golden Concept.
2. **Iris-only nine-style sheet:** nine glossy circular iris artworks provided later by the owner, illustrating detailed color gradient, pupil shape, star and heart. This is the source of the V7 atlas design, not another sketch.

Follow newest explicit instruction: **implement directly**; don't ask owner to sketch again. This is an isolated QA iteration in the existing repo, not Character Catalog integration.

## V6 root cause
V6's 144x144/48px-per-style atlas sampled entire eyes directly from head images and contained lashes, sclera and stray white reflections. The source GLB already renders its own lashes, sclera and highlights. When that image was projected onto the iris, it doubled the eyelashes/highlights, enlarged white shapes and distorted star/heart. Earlier versions also used hue-shifting on the original purple texture, and asymmetric Playful morphs inaccurately winked one eye.

## What V7 changes
- New isolated route: `/qa/female-origin-eye-golden-v7/index.html`.
- New `golden-iris-atlas-v7.svg`: **9 independent, editable 512x512 vector texture designs (1536x1536 atlas)** created based on the owner's **iris-only reference**, no screenshot collage or copied lashes/skin/sclera. Each has a separately colored limbal ring, concentric iris texture, center pupil and individual glossy highlight patterns. Idol has a four-point blue/cyan sparkle, Star a large golden five-point star and Heart a clean, full pink heart. SVG is a procedural vector re-authoring, NOT pixel-identical source pixels. The exact source iris sheet remains the art direction/acceptance standard.
- New `eye-iris-golden-v7.js`: applies the atlas to the existing physical 3D head through the original glTF texture's iris pigment selection, uses symmetric pupil centers and feathered cleanup of the original pupil to avoid V5's double pupil/rim. DOES NOT paint an entire 2D eye above the 3D head, and does not reconstruct/reload GLB on each style choice. Texture switching changes only a uniform. The actual eye mesh is not yet independently segmented with bespoke UVs.
- New `eye-morph-golden-v7.js`: eight fixed head-mesh POSITION morph targets; Joyful is less compressed than V6, Playful has no eye-specific wink and only subtle outer tension, other brows/poses remain Golden-oriented. Natural keeps neutral mesh.
- New QA page supports loading the original `Female_anime_origin.glb` **locally on iPhone**, choosing any of nine styles, front/3/4/zoom and a **button toggle** to compare original vs Golden V7 eye textures. No strength slider. No Supabase upload/storage use; atlas served by Vercel only.

## Validation performed (accurate scope)
- Confirmed work branch, GitHub HEAD and repo instructions. Work branch is isolated and not merged to development/main.
- Original owner GLB has **292,645 vertices, 499,762 triangles**, 4096x4096 source texture UVs. The V7 shader is calibrated to local eye volume from this file.
- V7 morph shape normal-direction test against original faces on the physical GLB: **0 reversed triangles for each of eight 100% poses**; maximal vertex Z displacement in model units: Joyful 0.00727, Sad 0.00709, Playful 0.00188, Angry 0.01417, Doll 0.01256, Idol 0.00982, Star 0.01082, Heart 0.01082. That checks triangle orientation only, not UV alignment, lash collisions or final visual quality.
- JS module and HTML inline script syntax validated. Shader braces balanced, 9-style ordering validated. Final GLSL compile and actual iPhone visual fidelity are **NOT validated yet**; require real browser QA and owner screenshots. No Full QA run.

## Limitations & acceptance gate
This is a **focused high-resolution texture/material and eye-shape QA pass**, not full Blender sculpt, newly retopologized eyeballs, reusable PBR eyeball prefab or production-grade iris UV islands. Some original specular pixels or shader projection alignment might still differ at 3/4; do not claim 100% Golden match without visual acceptance. Fix topology/material alignment if owner reports problems; don't recreate another concept or blindly change one strength slider.

Golden check:
- Natural: warm chocolate/amber iris, round pupil; not golden V6's washed out pale texture.
- Joyful: eyes genuinely smile while retaining visible iris, not horizontal sleepy slits.
- Sad: soft lavender, inner brow raised, watery/luminous.
- Playful: **both turquoise eyes open** and approximately symmetric, gentle playful tilt (not one closed eye).
- Angry: ruby-red distinct eye with inward brow tension.
- Doll: wide lavender glossy circle.
- Idol: vibrant sapphire iris, visible 4-point cyan center motif.
- Star: large centered upright yellow five-point star.
- Heart: full centered pink two-lobe heart, NOT an oval.
Render all front and 3/4 with the same camera framing as Golden. iPhone owner approval is mandatory.

Do not touch RoomState authority, Supabase CAS/realtime, Ready/Host Start, WebAudio, gameplay clock, gauge, Finish, stage catalogs, Character Catalog or accepted 3D stage. No merge without owner approval.
