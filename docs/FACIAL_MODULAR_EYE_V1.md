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

---

## V1.2 — real geometry eyelash variants (independent QA checkpoint)

- Full geometry candidate: six named eyelash meshes (left/right × natural/doll/dramatic), 528 new triangles and no degenerate triangles in new modules.
- iPhone optimized GLB URL: `https://d2ol7oe51mr4n9.cloudfront.net/user_3Jb86LOyd6RRYonCk2iie6jkL5h/8fabdabb-c844-40e2-8d53-a8da6a490378.glb`.
- GLB SHA-256: `502ca471fca0c406204801c5b06e4ae7d8bc27b8439e6a15147ba6bbe004a185`, 15,269,648 bytes.
- Runtime explicitly hides all six variant meshes after GLTF import, then shows only the requested style for both eyes; 'None' hides all added variant meshes.
- Current source atlas still contains original lashes, so 'None' **does not fully remove eyelashes**. It hides only the V1.2 modular additions. That limitation remains visible in the UI, not concealed.
- The source upper eyelid bridge is untouched. A trial thin-rim reconstruction was rendered but rejected because it produced bright gaps/artificial border. That trial is not used in the app.
- Real appearance of upper/lower eyelashes, visual quality and iPhone stability require owner QA; no production Character Catalog integration.

### Validation actually run

- GLB structural parse and byte-length consistency: PASS.
- All six new mesh positions/normals finite, norm length 1, nondegenerate triangles: PASS.
- Khronos glTF Validator on mobile candidate: 0 errors, 5 inherited tangent-space warnings, 6 informational notices about unused lash UV (because material uses no map).
- Custom CPU unlit render visually distinguishes Natural, Doll, Dramatic; not a substitute for Three.js PBR/iPhone QA.
- Build/TypeScript validation: check Preview deployment for the exact commit.

### Locked scope

No changes to Waiting Room, gameplay, WebAudio, Supabase, Character Catalog, facial head base geometry, or protected source GLB. Experimental branch and Draft PR #24 only.


---

## V1.3 — expressive eye presets + persistent mobile preview + direct 3D gestures

### Comparative game references
- The Sims 4: facial presets, direct manipulation, eyelid/eyelash/blink compatibility: https://cdn-assets-ts4.pulse.ea.com/Guide/TheSims4_Players_Guide.pdf and https://forums.ea.com/blog/the-sims-game-info-hub-en/summary-of-updates-to-sims%E2%80%99-eye-blinking/13174182
- Black Desert Mobile: face shaping, iris/lens, lash and makeup: https://www.world.blackdesertm.com/Ocean/News/Detail?boardNo=152
- Miitopia: dozens of eye options and layered makeup for whimsical styles: https://play.nintendo.com/news-tips/tips-tricks/tips-and-tricks-make-mii-characters/
- inZOI Studio: expression and pose presets: https://support.playinzoi.com/hc/en-us/articles/44423795432729-What-is-the-Studio

### Modular responsibilities
1. Eye shape and expression presets: neutral, joyful, sad, angry, surprised, playful.
2. Iris styles and iris patterns: natural/radiant/velvet/crystal; classic/heart/star/sparkle/spiral.
3. Separate iris color, pupil/iris dimensions and lash module.
4. Viewport orbit, pinch zoom, two-finger pan, wheel zoom.

### V1.3 implementation
- Uses original V1.2 real Claude V2 GLB and 6 true lash meshes; does NOT create fake/overlapping eyeballs.
- Shape presets use bounded falloff-driven localized vertex deformation: eye aperture, outer/inner-corner lift and eyebrow shift. These are VIEWER PROTOTYPES, not production-ready blink shape keys or genuine new artist-authored eye geometry.
- Whimsical iris patterns render via shader on EXISTING ocular surface, not overlapping 3D layers.
- OrbitControls: one-finger rotate, two-finger dolly+pan, mouse drag rotate, secondary mouse pan, wheel zoom. Reset camera re-applies view preset. Event listeners cleaned on unmount.
- On mobile, sticky compact preview remains visible while user scrolls settings. Long disclosure moves below controls.
- Existing 4 view presets, color options, 6 sliders and 3 lash styles remain.

### Known issues and review gates
- The original false upper-lid membrane remains UNSOLVED. Do not reintroduce the rejected lid bridge patch.
- Atlas lashes remain in HeadBase even with None; current added lash geometry is independently selectable, not full replacement.
- Expression geometry is not rig/blink safe. Extreme values and oblique views require iPhone visual QA for clipping and skin discontinuities.
- No changes to gameplay, Character Catalog, multiplayer, global clock or production assets; preview on Draft PR only.
- Owner iPhone review is required for preset changes, scroll-sticky layout, orbit, pinch, two-finger pan, and eye macro views.

---
## V1.4 — exclusive fantasy iris, source anchor, optional blink and browser cache

### GLB origin and caching
- CloudFront serves immutable Claude V2 mobile GLB (15,269,648 bytes). The demo does NOT fetch its model from Supabase Storage.
- CORS fetch of versioned asset; same-origin CacheStorage key audition-face-lab-glb-v12-502ca471; GLTFLoader.parseAsync uses ArrayBuffer from cache.
- Initial page load may fetch via CDN; next load on same Preview origin reads CacheStorage if present. Browser HTTP force-cache is fallback.
- CacheStorage writes are best-effort and asynchronous. Safari/private browsing/storage pressure can evict entries. Storage is per origin (different Preview hostname = different cache); there is no guarantee of zero downloads on every visit.
- Asset URL and cache key version must change together when GLB changes. Old face-lab caches deleted on successful new write.
- No localStorage for >15MB binary and no new Supabase egress.

### Iris shape and anchor
- Current fantasy heart/star/sparkle/spiral shaders replace the old iris and pupil texture by first filling the old iris footprint with a neutral sclera-like color, then rendering the selected symbol in the same material on the original eye surface.
- Normal/classic mode restores source iris behavior.
- Eye shader now interpolates undeformed/source positions as an extra attribute so iris and fantasy symbol are anchored to the actual mesh as the viewer deforms its shape. No extra eye shell or replacement eyeball.
- This is a shader preview; actual upper eyelid membrane defect remains unresolved.

### Periodic blink
- Optional blink toggle, enabled by default; roughly 310ms closure/reopen at intervals from 6 to 10.2 seconds.
- Uses local eye region geometry deformation with bounded falloff, not production rig or verified blendshape blink.
- Only precomputed affected vertices are updated per blink (not the entire head), with 30ms minimum animation update cadence.
- Visibility pause, frame cancel, timeout cleanup on preview unmount. No gameplay or WebAudio changes.

### QA required
- Build, TypeScript, focused UI tests for toggle + reset.
- Owner iPhone: compare Classic vs Heart/Star: icon must replace iris; change eye size and spacing while symbol remains in place; verify blink and cache hit caption after reopening the same Preview URL.
- Source GLB preserved; no production/catalog/multiplayer changes; PR #24 Draft only.

---
## V1.5 — independent iris / symbol colors and research on real eye sets

### Owner correction
- In V1.4, fantasy modes rendered the selected symbol over a neutral white sclera-colored iris fill.
- In V1.5, keep the ORIGINAL GLB eye surface and rest coordinates, shade the iris disk with the independently selected irisColor, use a subtle radial tint + limbal border, then draw the symbol using separate symbolColor. No second mesh or false eye shell.
- Pattern selector Classic retains natural iris treatment. Fantasy selector retains selected irisColor and user-picked symbolColor independently even when changing iris pattern.
- Added conditional symbol swatches and color picker only when the selected iris pattern is not Classic.
- Existing blink, local vertex changes, cache and touch controls unchanged.

### Research: actual interchangeable eye sets, not slider combinations
- VRoid Studio official face editor has an Eyes Sets category combining irises, highlights, scleras, eyeliner and eyelashes as a set. Official source: https://vroid.pixiv.help/hc/en-us/articles/4406164546969-How-to-edit-faces
- VRoid Studio v2.3.0 (Jul 2025) added 20 eye presets and separate iris, highlight, sclera, eyelid, eyeliner and eyelash variants: https://vroid.pixiv.help/hc/en-us/articles/48894106876825--v2-3-0-Added-new-presets-3D-thumbnails-for-custom-items-Jul-24th-2025
- Reallusion Character Creator maintains HD eyeball/cornea/iris mechanics and detachable eyelashes; CC Eye contains eyeball mesh and texture, CC Eyelash is a replaceable component: https://www.reallusion.com/character-creator/hd-eyes-eyelashes.html and https://www.reallusion.com/content/spec/default.html?p=cta
- Infinity Nikki's makeup library illustrates collection-sized thematic makeup and contact lenses (not a technical GLB interchange standard): https://infinitynikki.th.gl/db/makeup

### Proposed true EyeSet Catalog — designs to author, NOT built/imported
| Eye set ID | Art direction | Actual assets required |
|---|---|---|
| graceful-almond | Soft almond eye, understated natural makeup | Sculpted lid + sclera/ocular + subtle lashes + iris |
| sweet-doll | Big round doll eye, dense curled lashes | Separate eyelid aperture, ocular, lash meshes |
| sleepy-soft | Hooded / sleepy eyes, shorter lashes | Different mesh eye aperture + rig-safe blink profile |
| fox-fierce | Sharp outer corner, winged liner, swept lashes | New eyelid rim/skin transition and independent lash |
| sparkling-fantasy | Anime wide eye, colorful iris, decorative highlight | Custom iris material, lid silhouette, independent lash |
| celestial-cosmic | Moon/galaxy contact lens with fine highlights | Licensed/original iris textures + ocular materials + natural lid |

### Actual interchange contract proposal (not runtime implementation)
EyeSet = {
 id: string;
 version: number;
 compatibleHeadBaseId: string;
 ocularMeshAssetId: string;
 eyelidMorphProfileId: string;
 eyelashMeshAssetId: string;
 irisMaterialProfileId: string;
 eyebrowOrEyeLineProfileId?: string;
 blinkProfileId: string;
}

True swap acceptance: new asset identity and different GLB geometry/shape, aligned common anchors, no z-fighting or exposed seams at the head base, proper blink and expressions at all tested camera angles, PBR visual QA on iPhone. Current preview's face-region modifiers are NOT equivalent to real EyeSet swapping. Any source game/marketplace eye assets must be original or appropriately licensed; do not copy proprietary character assets.

### QA
- Vercel Next.js/TypeScript on exact branch head.
- Focused Playwright verifies selecting Heart and independently changing irisColor to blue and symbolColor to pink, JSON contract holds both.
- Owner iPhone must verify the iris is never flat white in fantasy modes, the symbol color changes independently and remains anchored while adjusting eye size/spacing and blinking.
- Source GLB and remaining upper-lid membrane defect unchanged. Draft PR #24.
