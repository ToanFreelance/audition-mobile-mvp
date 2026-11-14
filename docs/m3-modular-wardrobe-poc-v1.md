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
