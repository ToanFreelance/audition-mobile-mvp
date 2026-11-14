# M3 / Drophunter single-base modular wardrobe demo — V1

Date: 2026-11-14
Work branch: `work/vita-wardrobe-tryon-poc-v1`
Starting HEAD: `27baf744b2cf7dea194badc45d25feadd360d89b`
Owner-authorized scope: isolated POC only. Route: `/tools/m3-modular-wardrobe`.

## Implementation

- Reuse `three` and `GLTFLoader` already installed in Audition (no new dependencies and no M3 application/framework fork).
- Load one Drophunter body and separate true skinned VRM assets for top, bottom, shoes and hair **directly in the viewer** from the original public GitHub repo, with jsDelivr fallback. No third-party asset binaries stored in the Audition repo.
- Validate joint **count and order** plus inverse-bind matrices against the body; fail safely when mismatched.
- Replace only the affected SkinnedMesh, binding its geometry/material onto the persistent body's skeleton. Independent donor rigs never enter the rendered scene.
- One actor root, one `THREE.AnimationMixer`, one original QA dance loop at 110 BPM based on body humanoid bones. This is strictly a visual deformation probe and does **not** use/affect WebAudio authoritative game timing or production animation clips.
- Cache asset parts per session and refuse stale async swap completions.
- Orbit/preset cameras, dance pause/play, per-slot choices, metric panel and errors; portrait mobile-first CSS.
- No changes to Character Catalog, Vita V1.1, Hair Studio, Waiting Room, multiplayer or gameplay.

## Source & legal scope

Third-party Drophunter source: https://github.com/memelotsqui/character-assets/tree/main/drophunter

No license file/redistribution grant was found in that external repository. The POC **references** source-hosted assets in the browser, but does not copy or mirror them. This is not clearance for public product distribution or bundling; publisher permission and future compliant self-hosting remain required.

## Explicit QA gates

1. `/tools/m3-modular-wardrobe` loads Drophunter base with 198-ish joints (actual number reported) or displays a real error.
2. Replace top Tank Top → Crop Top, and change bottom/skirt, shoes and hair without incrementing base loads or mixer count.
3. Confirm the active mesh's skeleton is the exact body skeleton, not a per-trait VRM mixer.
4. Visual inspect front/side/back + moving dance: shoulders, arms, hips, feet, hair attachment and clipping. The demo deliberately does not claim perfect M3 dynamic body culling yet.
5. Owner iPhone portrait acceptance is still required; five-human mobile FPS, SpringBone physics and actual Audition choreography are **not** covered here.
6. If asset-server CORS/availability or bind-pose validation blocks, report BLOCKED rather than silently drawing a substitute.

## Validation

- GitHub work-branch HEAD before implementation: `27baf744b2cf7dea194badc45d25feadd360d89b`.
- Git commit: `ce2429b0192fa77be68e9f978300b9da46f07fe4` (four focused files).
- Vercel deployment `dpl_BcrnvheVBKJxmz8FYbV3U5C65XJ3`: **READY**, source commit matches; logs show `✓ Compiled successfully`, `Finished TypeScript`, and the route `○ /tools/m3-modular-wardrobe` pre-rendered.
- Stable Git Branch Preview: `https://audition-mobile-mvp-git-work-vi-570b67-toan-freelances-projects.vercel.app/tools/m3-modular-wardrobe`.
- No live in-browser render, base VRM parsing or actual outfit swap has been completed by the assistant. No physical iPhone test; performance, clipping, visual and gameplay animation remain **NOT RUN**.
- No Playwright or full CI suite run. The Vercel `next build` result is a compile/deployment check only.
- Open risk: actual third-party VRM downloads depend on external origin/CORS; `GLTFLoader` intentionally does not implement the full M3 MToon material/springbone stack. The QA route uses a minimal Three.js material fallback and original QA dance loop, not the full CharacterStudio runtime.
- Source files lack a verified independent asset reuse license; do not integrate into production distribution.

## V1.1 — iPhone owner eye-socket defect (2026-11-14)

Owner tested the V1 preview on physical iPhone: multiple outfits **successfully swapped** with the UI showing **198 joints, 1 mixer, 1 base load and 13 cached files**; however the face rendered without eyes, exposing the empty eye area. This is independent of clothing switching. The screenshot is not stored in the repository.

**Root cause verified:** The Drophunter source `drophunter/manifest.json` explicitly includes `requiredTraits: ["body", "eyes"]`, with Eyes source `eyes/regulareyes.vrm`. Isolated Audition V1 loaded body + four wardrobe slots but **omitted the mandatory Eyes trait**. The engine therefore displayed eye sockets without their intended skinned eye mesh; M3's original manifest-led assembly would normally include it.

**Focused correction:** Load `eyes/regulareyes.vrm` as a **fixed required base component**, check skeleton compatibility, bind it to the persistent base rig, keep materials/morph target metadata, and expose `EYES ✓` status. Do not add a new actor or mixer; do not implement eye geometry manually. If the third-party file is unavailable or violates bind-pose bounds, show an explicit error instead of claiming a repair.

**After/acceptance:** With eyes loaded, on iPhone observe pupils/eyeballs correctly placed from front and side under all hairstyles. Verify the original wardrobe controls still work and the counter remains `1 mixer / 1 base load`. Loader and build validation is **not equivalent** to physical visual PASS. No Shop/Inventory, Character Catalog, actor production, WebAudio or gameplay changes.

## V1.2 — Expanded wardrobe and 3 animation stress probes (2026-11-14)

**Owner approval/input:** Physical iPhone owner screenshot confirmed eye correction and functional outfit changes, with 198 joints, 1 mixer, 1 base load. Owner requested more of the M3 Drophunter-supported clothing items and harder motion QA; this authorizes isolated POC expansion, not production Character Catalog / Shop.

**Source inventory:** Inspected Drophunter's real `manifest.json` and GitHub tree. There are **44 actual skinned VRM options** across 6 selectable groups: 10 hair, 10 tops, 9 bottoms, 10 footwear, 3 outer, 2 accessories. Required `body` and `eyes` stay fixed. No third-party files were mirrored to the Audition repository.

**Implementation scope:**
- Added all 44 source-backed option IDs/paths with horizontal mobile browsing and lazy load on item selection.
- Optional `outer` and `accessory` can be explicitly removed without any actor/mixer rebuild.
- Applied focused Drophunter restrictions: outer disabled with `hoodie`, `dress`, `fulljacket`; pants vs tall boots or `legstrapandcompress`. When changing top/bottom, incompatible optional items detach; tall boots on new pants selection switch to permitted short boots.
- Added three **original generated QA clips** at 110 BPM, each over 8 beats: `Groove` (sway + arms); `Street Shuffle` (cross/step + leg lift + torso rotation); `Low & Reach` (crouch, raised arms, deep knee motion). The samples are bound only to the persistent body's humanoid bone UUIDs. All share the **same existing Three.js AnimationMixer**; changing visual clip uses two actions and fade transition, never creates a new mixer or timer.
- Stress test intentionally targets shoulders/armpits, hair/neck, hip/skirt, knees and shoes. Probes are NOT imported Audition animation clips or an authoritative gameplay clock.

**Validation gate:** Confirm Vercel build/TypeScript and route existence, not merely git push. Then owner should test iPhone actual motions and outfit swaps; the QA must remain explicitly **NOT iPhone PASS** until owner verifies. No Playwright/full QA unless needed; no main/development changes or merge. The independent VRM server, full body occlusion, MToon and springbone remain unverified production issues.

**V1.2 cache memory bound:** The isolated runtime now retains up to **14 source VRM parts** using an insertion-order recently-used cache. The canonical `body`, required `eyes`, and all **currently equipped** slot sources are pinned and never evicted while worn. Removed/disused donors are disposed only when above budget; reselecting an evicted item downloads its source again. This is a qualitative memory precaution, **not a measured iPhone memory/FPS claim**.

## V1.2.1 — iPhone motion initialization regression fix (2026-11-14)

**Owner physical iPhone screenshot:** M3 V1.2 enters `Missing humanoid joints for motion groove (4 tracks)`; the base still reports **198 joints / 1 mixer / 1 base load**, but initialization stops before required Eyes and equipped garment loading. This regression is isolated to new QA animation generation, not evidence of an invalid Drophunter rig.

**Confirmed root cause (source-backed):** Drophunter raw glTF joint names contain periods, e.g. `upper_arm.L` and `lower_leg.R`. The project's Three.js **r180** `GLTFLoader._createUniqueName` applies `PropertyBinding.sanitizeNodeName` to every node. That operation **removes reserved characters including '.'**, so runtime bone names are `upper_armL` and `lower_legR`. The authored V1.2 `makeMotionClip` looked up the unsanitized raw strings; only `hips`, `spine`, `chest` quaternion tracks and `hips.position` survived → exactly **4 tracks**, triggering the guard. Upstream Three.js sources: `examples/jsm/loaders/GLTFLoader.js`, `src/animation/PropertyBinding.js` at `r180`.

**Focused fix:** Resolve human bone roles through **the same Three.js node-name sanitizer used by the loader**, preferring resolved runtime names and retaining raw-name fallback. Both rotation and hips translation tracks use this helper. Missing required bones produce a detailed error rather than silently dropping limb animation. Three generated stress clips, a single `AnimationMixer` and body/garment asset source remain unchanged. No gameplay clock, animation scheduler or production Character Catalog was modified.

**Expected clip counts on Drophunter:** Groove 12, Street Shuffle 14, Low & Reach 15 (assuming the author's intended named joints exist). These are *expected*, not browser-verified until iPhone/interactive QA.

**Validation:** Git/Vercel build and TypeScript result to be recorded when observed. Owner iPhone retry remains necessary for visual and functional PASS; do not infer runtime success solely from build.

## V1.3 — M3 Anata Male + sticky iPhone viewport (2026-11-14)

Owner accepted Drophunter female wardrobe and all three motion probes on physical iPhone, explicitly authorized testing a male model and requested a sticky 3D preview while scrolling wardrobe choices.

**Architecture:** Gender/character selection is an **explicit character identity change** that can dispose the previous isolated QA actor and create one distinct base/skeleton/mixer. Within a selected character, individual clothing swaps continue to **reuse the exact existing actor and mixer**; no garment rig is added to the scene.

**Female:** Drophunter remains unchanged, sourced from `memelotsqui/character-assets/drophunter`: 198 joints, Eyes required, 44 independent outfit options, 6 female slots.

**Male:** Anata Male from `M3-org/loot-assets/anata/male`: `Body/male.vrm` is the only base. Official manifest is source of 14 chest, 15 shoes, 16 head items, 11 hands, 3 neck and 15 waist = **74 separate selections across 6 male slots**. `Weapon` excluded intentionally: extreme file sizes and irrelevant to dance QA. This pack does **not** offer a separate male hair or trousers slot; never invent them or mix female Drophunter garment data onto the 55-joint male rig. Only the published source URLs are referenced; no third-party binary in repo.

**Real source metadata preflight:** Male cap, slippers and amulet GLB/VRM data independently inspected. Each skin has 55 joints with identical bone order; cap vs slippers inverse-bind max absolute delta `2.384185791015625e-7`, amulet vs cap delta 0. Actual male base binary, WebGL runtime and male garment QA have not yet been inspected in-browser. Validate at runtime against base inverse-bind skeleton with `EPSILON=0.0001`; fail visibly if mismatch.

**Sticky preview:** Stage section becomes `position:sticky` on small viewports, with compact avatar switch / 3D viewport / camera controls. Motion selection, status, metrics and clothing scroll **below sticky section** in regular document flow; do not wrap stage in an overflow-hidden ancestor. The sticky preview itself is portrait-sized to leave room to scroll and click outfit controls below.

**Three QA motions:** Generated `Groove`, `Street Shuffle` and `Low & Reach`, reused across both humaniod skeletons when compatible; not the authoritative Audition gameplay timeline. Body switch resets the local QA actor/mixer as a new identity; ordinary equip does not.

**Validation:** Vercel Next.js build, TypeScript and route existence to check explicitly. The original owner female QA remains accepted for the previous version; **male and sticky Preview still require physical iPhone tests**. No merge, PR, Shop/Inventory, Vita replacement, Character Catalog or WebAudio/Supabase modifications.
