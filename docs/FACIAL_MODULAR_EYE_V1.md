# Facial Modular Eye V1.1 — Real Claude V2 Head QA Preview

Route: `/tools/facial-modular-eye-v1`

## Source
- Actual owner Claude V2 modular segmentation GLB (five named meshes: protected head, two ocular surfaces, two upper-lid-bridge issue regions). Source full-detail file is preserved separately in the project conversation.
- This preview uses an immutable stored copy: `https://d2ol7oe51mr4n9.cloudfront.net/user_3Jb86LOyd6RRYonCk2iie6jkL5h/568256ac-c18f-4d72-9188-84db7f5cdba0.glb`
- Optimized preview SHA-256: `09951d0fd65c5cd700ebb5ef45e97eba8e73d6b2ac3921363ccfa2fdcfc500e6`.
- 15,234,036 bytes (full source 38,040,500 bytes). Geometry, indices, UV coordinates and normals unchanged; base-color texture reduced to 2048² JPEG, normal + metallic-roughness reduced to 1024² JPEG. This is not an artist-approved final texture/asset.
- CDN is third-party project-file hosting (not yet repository-owned asset storage); cache/reliability/security to be solved before integration.

## Implemented
- Preserve existing mobile-first layout, style/color controls, sliders and camera views. Added close-eye camera preset.
- Import real modular GLB using GLTFLoader once; no fake procedural face or replacement eye sphere.
- Recolor/modify iris shader on each true ocular surface directly; no extra iris-overlapping plane added. Existing iris highlights and base details are partially retained.
- Deform geometry in the vicinity of each actual eye, with a continuous falloff affecting nearby face skin and bridge in addition to ocular surfaces. No separate eyeball scaling that detaches it from the face. Geometry keeps original topology/UV.
- Controls for eye scale/width/height/spacing, iris color/style/size, pupil diameter and lash intensity; reset and export preset JSON.
- The selectable lash buttons currently adjust dark-lash contrast in the original HeadBase texture region. Real eyelashes are not yet separated or geometrically swappable. 'None' does not remove lash geometry.
- Render on owner iPhone Safari/WebGL; on unavailable WebGL/GLB load, show an explicit failure message instead of a fake pass.
- No updates to Character Catalog, participant avatar schema, Supabase, gameplay clock or actual production character runtime.

## Known unsolved asset defects
- 220 upper-lid bridge triangles and visually apparent false membrane remain part of source GLB. This iteration does NOT claim to fix that geometry.
- The current exported GLB is a STRUCTURAL PROTOTYPE, not a replacement final production face asset. Morph is a viewer-local deformation, not GLB-exported shape keys or rig-safe facial animations.
- Eye morph may change shading on the currently closed/shared topology. Owner must compare frontal, 3/4 and eye macro views at extremes before setting production limits.
- Shader color updates operate on imported atlas and can differ from source textures. Iris presets should be reviewed in the real GPU renderer.
- Lashes require geometry separation + proper eyelid rig boundary before real geometry replacement. Skin-based eyelid rim remains with HeadBase.

## Focused QA / next gate
- Existing Playwright control-state tests; Vercel deployment build confirms compilation.
- Owner physical iPhone screenshots for default, blue iris, eyeSize 0.85/1.15, none/dramatic lash intensity, front and 3/4.
- Future milestone: reconstruct eyelid bridge/occlusion and actual eyelash mesh from the GLB via an artist-reviewed mesh pipeline. Do not integrate this experimental preview into playable characters.
