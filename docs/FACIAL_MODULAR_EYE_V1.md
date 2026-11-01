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

---
## V1.6 — shrinking iris source-pupil cleanup; old Audition PC eye catalog evidence

### Root cause and narrow shader fix
- In V1.5, irisScale only altered the drawn iris/pupil shader mask; the source Claude V2 atlas still carries a FULL-SIZE dark pupil and limbal ring. Reducing irisRadius exposed the source dark details outside the smaller colored iris.
- V1.6 keeps the default Classic iris unchanged at 100% size. On shrink or fantasy mode, it covers the original source iris/pupil footprint in **rest-position eye coordinates**, then draws one newly sized iris, dark limbal ring and (Classic only) a pupil. Fantasy uses the same newly sized iris background and separate symbol color. No new shell, duplicate iris plane, geometry refactor or GPU loader changes.
- The neutral sclera replacement in the exposed annulus is a shader approximation and MUST be checked for a pale ring/seam against actual source sclera under iPhone PBR. Do not treat build PASS as visual approval. Eye artifact root source geometry and eyelid bridge remain unchanged.
- Default blink behavior and CacheStorage cache key remain unchanged.
- Manual iPhone regression: Classic and Star/Heart at irisScale 0.76, 0.85, 1.00, 1.18; check residual dark pupil, rings, highlight, blink, 3/4 view.

### Original Audition (PC): documented appearance items — avoid assumptions about underlying mesh tech
- VTC official character creation screenshot shows a selectable **face** category in creation workflow (historic PC interface): https://au.vtc.vn/su-kien/game-nhay-pc-545
- VTC official 2023 guide says characters can change eye, nose, mouth styles: https://au.vtc.vn/su-kien/game-thoi-trang-anime-40430
- Audition PC avatar shop has **Face** inventory category; period promotional screenshot (MobyGames): https://www.mobygames.com/game/86544/audition-online/promo/group-18438/image-191518/
- Concrete official examples (later releases, NOT necessarily in initial 2006 version):
  - **Ánh mắt Ác Quỷ** female/male, 2023 fashion week: https://au.vtc.vn/tin-cong-dong/denim-on-denim-thoi-thuong-chiem-song-audition-fashion-week-ngay-thu-hai-40129
  - **Mắt cầu vồng Green Candy** male/female, Mar 2024: https://au.vtc.vn/tin-su-kien-web/audition-fashion-week-nao-loan-giua-tuan-voi-phong-cach-y2k-43108
  - **Make up mắt tím White Daisy** male/female, Jul 2023: https://au.vtc.vn/tin-cong-dong/phong-cach-hoc-duong-quay-tro-lai-audition-fashion-week-trong-ngay-cuoi-40599
- Evidence supports collectible face/eye **looks** and inventory items, not proof each original cosmetic was a distinct skeletal eye mesh or interchangeable geometry contract.
- Proposed Audition-inspired ORIGINAL EyeSet catalog direction: Default Audition, Devil Gaze, Candy Rainbow, Violet Daisy, Angel Eyes, manga Doll; original modeling/textures and compatibility contracts required. Research references are NOT an authorization to copy proprietary game art.

### Validation
- Regress UI state test irisScale=0.76 for Heart mode and JSON value. Pixel/real GPU QA still required; this test does not visually verify absence of the baked pupil.
- Vercel build/TypeScript on exact SHA; owner iPhone confirmation remains required. PR #24 Draft, work branch only.


---

## V1.7 — Clean ocular material, Audition-inspired iris style (2026-11-01)

### Root cause
- V1.6 used a radial source-iris cleanup mask against the old GLB atlas, while the source atlas **and normal/roughness maps remained active** on the ocular surface.
- The baked source iris is not a uniform circular disk. When irisScale is reduced (~0.76–0.85), fragments in the sclera annulus can still show old pupil/ring shading or normal-detail artifacts.
- User physical iPhone screenshot (2026-11-01) explicitly rejected the dirty ring after V1.6.

### Focused implementation
- Keep the original Claude V2 **source material** untouched for the original Classic iris at the default color/size/pupil/style.
- For every customized iris (scale/color/style/pupil/decorative pattern), switch the existing ocular mesh to a **separate, map-free MeshStandardMaterial**. This material does NOT sample source base-color atlas, source normal map or source metallic/roughness map. The old pupil/limbal ring cannot leak through the material when the iris is reduced.
- Generate ONE clean sclera and stylized fashion-game iris using a shader on that same existing ocular mesh (no second geometry, no overlapping cornea shell). Use a crisp limbal ring, smooth color gradient, restrained fiber pattern, single pupil for Classic and simple two-glint highlights.
- Retain independently selectable irisColor / symbolColor, fantasy icon, iris radius, pupil scale, geometry-rest-space anchor, local blink, OrbitControls, sticky mobile layout, cached GLB and L/R eyelash variants.
- Stylization is **original Audition-inspired lookdev**; does not copy assets/textures from VTC/T3.
- Material switch happens in-place (not GLB reload); previously accepted default asset original remains available.
- On scene disposal, dispose additional cosmetic material. Original shared GLB textures are unaffected.

### Acceptance gates
- Compare original Classic at 100%, custom Classic at 0.76/0.83/0.85/1.00/1.18 and Star/Heart at 0.76/0.83/1.00, front and 3/4 views on physical iPhone.
- Sclera around iris must be clean, without ghost pupil, jagged black fringe, white rings or iris double-exposure.
- Check irisColor and symbolColor independent, blink and camera gestures still work, no new seams/hole at eyelid boundary. Existing Claude V2 upper-lid bridge remains a separate unresolved issue.
- Vercel Next.js build + TypeScript, focused UI Playwright regression test where available. Build PASS alone is not visual acceptance.
- Work branch PR #24 Draft; no Supabase, gameplay, Character Catalog, WebAudio or source GLB geometry changes.

---
## V1.8 — OWNER-APPROVED 9 EYESET ASSET PACK, real GLB on Claude V2

**Owner reference:** approved Eye Asset Pack concept (9 named looks: Tự nhiên / Tươi cười / Buồn / Tinh nghịch / Giận dữ / Búp bê / Thần tượng / Ngôi sao / Trái tim). Do not redraw or reapprove the sketch. This is ORIGINAL stylized game art inspired by the approved visual; it is not copied T3/VTC proprietary artwork.

### Real asset
- Asset: `Female_head_EyeSetPack_9_v1_mobile.glb` (16,320,012 bytes).
- SHA-256: `68934293d6c8af5581664c94170355b6a7dda7787c168ac1fe111aa4ee3a8aba`.
- CDN URL: https://d2ol7oe51mr4n9.cloudfront.net/user_3Jb86LOyd6RRYonCk2iie6jkL5h/fe9ad0e8-19b8-4b63-a083-255b50255fcc.glb
- Blender QA collage: https://d2ol7oe51mr4n9.cloudfront.net/user_3Jb86LOyd6RRYonCk2iie6jkL5h/bfa316d5-4f6d-4059-9c30-f25cc6e47a09.jpg
- Original GLB and original five-part HeadBase/Eye/UpperLidBridge geometry and texture remain unchanged inside the pack. Added eighteen separate ocular meshes (two per set), each with independent UV coordinate mapping/rest-space geometry, nine separate baked eye textures and nine PBR materials. There are eighteen separately named EyeSet lash nodes (two per set) referencing the source three actual 3D lash mesh families. Total meshes 29; scene nodes 47.
- Nine textures use newly generated sRGB colors, gradients, limbal rim, pupils/highlights or thematic icon details. The whole ocular surface is textured, so source atlas iris/pupil cannot be read through the new EyeSet material. Only the old upper eyelid bridge/face skin remain and still need separate reconstruction.
- Some EyeSet variants have small, tapered center-aperture geometry adjustments; face skin / eyelid boundary must remain untouched. These are QA variants, NOT production-safe retargeted facial morphs or artist-sculpted complete eyelid meshes.
- Model includes unused variants by default: **runtime must set every `EyeSet_*` node hidden until selected.** The isolated demo controls visibility. External generic GLB viewers may display all variants at once if not configured; this is an authoring pack, not a game-ready skinned avatar.

### Demo architecture
- `EyeSetCatalog.ts` is the standalone catalog mapping nine IDs to proper embedded GLB mesh/texture identities and matching lash family. Do NOT extend production Character Catalog in this PR.
- `RealHeadPreview` resolves the new GLB once via CDN/Cache Storage (versioned key), then switches visible ocular and lash modules in-place. Other EyeSet meshes remain hidden. No 15 MB redownload on every selection.
- Previous mouse orbit, mobile pinch, blink, color/pattern controls, slider and sticky view remain.
- Advanced sliders can continue editing the chosen EyeSet: editor toggles the selected real mesh to its existing clean shader material and uses its current geometry (visually distinct original EyeSet texture may be replaced by the editable treatment). Selecting another packaged set resets overrides and restores that set's own authored material. This limitation is communicated in UI.
- Original Claude V2 eye option included as a baseline and rollback.

### QA actually run
- Re-import 47 GLB mesh objects in Blender. Rendered all nine looks using Blender Cycles CPU in 840x330 close-up, each isolated via named EyeSet visibility.
- Khronos glTF Validator: **0 errors, 5 inherited tangent-space warnings, 6 info messages** about unused original lash UV. No new validation errors.
- GitHub Vercel Next.js build and TypeScript on exact work commit to be verified.
- UI Playwright test added for nine choices/selection/advanced override state; not a substitute for visual WebGL QA.
- Owner physical iPhone acceptance is required for 9 sets, blink, eye seam, line around iris, 3/4 profile, pinch/zoom and mobile performance.

### Known risk
- The owner-reported dirty fringe at irisScale 76% is *not necessarily fully solved by the new pack* because the source head/upper eyelid bridge could still contain baked fragments. The new pack eliminates old iris map **on the ocular variants**; it does not rebuild the old bridge geometry.
- This is asset-level modular selection, NOT full anatomy (eyelid face-skin, rig blink, bone weights) replacement. Do not merge into production or Character Catalog without art QA/owner approval.
