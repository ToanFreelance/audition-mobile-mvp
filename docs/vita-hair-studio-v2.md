# Vita Hair Studio V2 — Try-On POC

Route: `/tools/vita-hair-tryon`
Branch: `work/vita-hair-tryon-poc-v1`

## Accepted baseline and scope

This is an isolated Next.js/Three.js visual experiment. The owner tested the six selections on the original VRoid Vita CC0 base in iPhone Safari and reported that all six hairstyles fit visually. This observation does **not** validate the approved Premium Cute Anime Variant A, multiple avatars, high FPS, or external sources.

Do not modify production Character Catalog, game actors, RoomState, gauge, multiplayer or WebAudio scheduling. No merge.

## V2 additions

- True source photo thumbnails are captured from the active WebGL 3D scene when a hairstyle is selected. Optional "Tạo ảnh 3D thật cho cả 6 kiểu" downloads the public CC0 sample avatars sequentially and captures photos. It can consume substantial mobile bandwidth; not preloaded automatically.
- V1.1 Premium Cute Variant A can be imported from the original Library `Vita-Premium-Cute-V11.glb` or `.vrm` file. The page validates an exact SHA-256 allowlist, then saves the raw accepted binary into **local IndexedDB**, so subsequent visits from the same browser/device can restore this avatar before falling back to Vita CC0.
- Approved V1.1 GLB SHA-256: `d422159770ee8e9fbc9d78f2f256d5ee988651373cbd211aaa99efd7ecf2bad8`.
- Approved V1.1 VRM SHA-256: `5e1802f4618fcf8ed182efdc856dda6f9eee4eaaee83ba889397d2a64951ea12`.
- IndexedDB is origin-scoped. The demo cannot automatically read a private ChatGPT Library artifact from a Vercel public Preview, so the first manual import is required. Import is browser-local, not uploaded.
- Six CC0 selections remain: Vita base hair, HairSample Female, HairSample Male, Vivi, Shibu, Victoria. These load from published VRoid beta samples on GitHub; their runtime hair extraction uses existing V1 demo code.
- Other curated BOOTH/Sketchfab sources appear as **links only** until their binary assets and license rights are verified. No fake hair swap, no unapproved distribution.

## Minimal validation

Vercel preview Next.js build status **READY** is the actual automated validation. Owner physical iPhone Safari acceptance of V2 and 3D screenshot caching is **not yet verified**. Known risks: third-party GitHub asset traffic/CORS availability, Safari IndexedDB persistence in private mode, runtime thumb capture, skinning/fit alignment when comparing heads, texture/material differences between GLB and VRM, and WebGL memory overhead. The optional six-model thumbnail pass is network-heavy.

## Acceptance checklist on physical iPhone

1. Open the isolated Preview route and verify Vita CC0 still displays and all six hair choices can be used.
2. Save/download the original `Vita-Premium-Cute-V11.glb` from ChatGPT Library to iPhone Files; choose **Nạp Vita V1.1 đã duyệt**.
3. Confirm Variant A face/outfit appears and six hair choices fit in front, 35°, side and back.
4. Reload the **same** Preview hostname in Safari. It should restore exact approved Variant A without reselecting the file.
5. Select one style; confirm a real hairstyle thumbnail appears in the tile. Optional generate-all should be used on Wi-Fi.
6. Inspect memory and performance on device. Record any collision or hair clipping.

This is a research POC, not an accepted production cosmetic catalog.

## V2.1 — Owner iPhone orientation and curated import correction (2026-11-12)

- Owner screenshot shows front CLUB panel on approved Variant A but donor hair obscuring the face. Likely cause: donor VRM/approved Variant A Head-local axes disagree. Do not rotate approved avatar.
- Approved Variant A now defaults donor hair to 180° local Y rotation, while accepted CC0 baseline keeps 0°. Manual toggle changes only detachable imported hair; original hair is unchanged.
- Thumbnail cache namespace bumped to prevent showing wrong-facing older photos. Image capture still uses real WebGL.
- Each curated row can accept an owner-provided .glb/.vrm file and reselect/reimport during the session; source links alone do not provide the mesh. No license bypass or remote asset scraping. VRoid custom items and Unity packages need separate export/conversion.
- Physical iPhone validation remains pending for all six donor styles, front/35°/rear and thumbnails. Imported curated assets remain only in browser session memory and require reimport after reload.

## 2026-11-12 — Owner accepts COMPLETE Vita Hair Studio modular-hair demo baseline

The latest explicit owner instruction clarifies that **the entire existing Vita Hair Studio demonstration** is accepted as the ongoing hair exploration baseline, **not only the FeliKitty hairstyle**. This includes the existing six VRoid CC0 hairstyle choices; real WebGL 3D viewing, previews/thumbnails, import, direction correction, fit controls, user-loaded curated styles and the new experimental VRoid Beta ZIP-to-GLB conversion path. Preserve all of these as a coherent standalone proof-of-concept feature.

**Evidence specificity:** The original six choices were visually tested on Vita CC0. The reconstructed FeliKitty GLB was subsequently loaded on an actual iPhone and considered a good visual result with a small still-unmeasured upward fit adjustment. This acceptance does not certify all six on Premium Variant A, all externally curated sources, animation performance, exact VRoid exporter parity, redistribution licenses or production catalog readiness. Do not silently broaden these gates. Leave V1.1 face/outfit unchanged.
