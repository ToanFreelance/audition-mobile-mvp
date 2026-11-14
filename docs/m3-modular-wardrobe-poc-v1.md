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

To be filled only with actually executed checks. A code commit alone is not a real browser/iPhone QA PASS.
