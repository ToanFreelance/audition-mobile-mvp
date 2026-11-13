# AUDITION MOBILE MVP — COSMETICS / WARDROBE WORK HANDOFF

> **Override phạm vi — 2026-11-13, SESSION 1:** yêu cầu mới nhất chỉ cho phép khóa shortlist nữ, xác minh source/license/access, cập nhật manifest/catalog metadata/docs và một commit/push rồi dừng. Các mục conversion/Shop/Inventory/checkpoint bên dưới là lịch sử, không phải quyền triển khai trong phiên này. Xem [bàn giao SESSION 1](vita-female-wardrobe-v1-session-1.md). SESSION 2 đề xuất: **Cyber Blue wearable 3D first**.

**Date:** 2026-11-13 (Asia/Ho_Chi_Minh)  
**Owner authorization:** Work may fix rejected Cyber Blue clothing, research/prototype additional outfit sets, and build an in-game-style Shop → Inventory → Equip test flow, **only on an isolated work branch**. No automatic merges.

## Status and source of truth

Repository: `ToanFreelance/audition-mobile-mvp`  
Starting branch at handoff: `work/vita-wardrobe-tryon-poc-v1`  
Starting verified HEAD **before this documentation commit**: `8ffb0ab6fdfcd843bb8a52599ba52fa49b5695a3`.  
Hair ancestor HEAD: `work/vita-hair-tryon-poc-v1` at `212c4a6df65f3d60e6200e73f86e46f0799be7b5`.  
Current `development` observed at `abdf8d9c2e5da3ac403397cc8ca54ecbf526d781` (check again before Work edits).  
**Always verify branch, HEAD, PR and instructions at execution.** Use the newer working HEAD after this commit, never reset/rebase blindly.

The user is **iPhone-only**, prefers direct playable Vercel Preview, and cannot be expected to use desktop VRoid Studio, Blender GUI, Unity or a local CLI. Work cloud tools and headless GitHub Actions may be explored **only if actually available and verified**, not assumed.

### Owner acceptance / rejection ledger

| Feature | Status | Evidence and exact meaning |
| --- | --- | --- |
| Complete isolated Vita Hair Studio workflow | **Accepted as POC baseline** | Owner explicitly clarified all six original hair options + import, custom curated sources, 3D preview/real thumbnails, camera controls, fit and VRoid Beta → GLB conversion are the accepted **demo approach**, not only FeliKitty. Does **not** certify every hairstyle for premium Vita or production. |
| FeliKitty converted Short Bob | **Positive iPhone POC**, minor fit pending | Real iPhone load succeeded; owner says looks good, needs slightly higher vertical fit, no measured value; no exact converter parity asserted. |
| Approved Vita Premium Cute Variant A V1.1 | **Do not alter** | SHA-256 GLB `d422159770ee8e9fbc9d78f2f256d5ee988651373cbd211aaa99efd7ecf2bad8`; VRM `5e1802f4618fcf8ed182efdc856dda6f9eee4eaaee83ba889397d2a64951ea12`. Keep face, original outfit, identity, rig. |
| Cyber Blue source ZIP + browser intake V0.1/V0.2 | **Functional data inspection** | Owner successfully imported three items on iPhone and viewed multiple real embedded PNG layers. `cyberbluetops` (3 images), `cyberblueskirt` (3), `cyberblueshoes` (6), VRoid 1.27.0. |
| Cyber Blue V0.3 | **Rejected visual** | Giant cylindrical sleeves, boxy torso; fake topology and incorrect UV. |
| Cyber Blue V0.4 | **Rejected visual on real iPhone (2026-11-13)** | Improved silhouette but shoulder/sleeve join, torso/waist proportions and native garment fidelity still unacceptable after moving sliders. Owner uploaded `IMG_4536.jpeg`; original source artifact remains in private chat, **not committed**. Do not label V0.4 accepted or continue random fitting-slider tuning. |
| Shop / Inventory / appearance equip feature | **Not implemented as actual product feature** | `/character/create` has appearance controls and `outfit`/`accessory`/`shoes` equipment slots, but unavailable inventory/shop is explicitly a later Phase 8–9 feature. Build ONLY gated QA preview pending visual acceptance. |

### Already implemented source files — KEEP

- `/tools/vita-hair-tryon`: `app/tools/vita-hair-tryon/page.tsx`, `tryon.css`; docs `docs/vita-hair-studio-v2.md`, `docs/vroid-beta-hair-converter-poc.md`; standard-library Python converter `scripts/vroid-beta-hair-to-glb.py`; instructions `scripts/VROID_BETA_HAIR_CONVERTER.md`.
- `/tools/vita-wardrobe-lab`: `app/tools/vita-wardrobe-lab/page.tsx`, `zip-reader.ts`, `wardrobe.css`, `cyber-blue-tryon.ts`; `docs/vita-wardrobe-cyber-blue-source-qa.md`, `docs/vita-wardrobe-cyber-blue-v03.md`, `docs/vita-wardrobe-cyber-blue-v04.md`.
- `docs/vita-wardrobe-source-research-2026-11-12.md`, `docs/FEATURE_TRACE_LOG.md`.
- Current V0.4 source is valuable as a failure study, but is **not** an approved garment conversion implementation. Preserve a snapshot before any art/rig rewrite.

### Technical root cause to resolve (not just resize)

The Cyber Blue `.vroidcustomitem` source references canonical VRoid templates `N00_005_01_Tops` (Casual2) and `N00_010_01_OnePiece` (BodySuit), and skin-alpha region handling. The source custom item has texture/param data but **no independent, skinned GLB with canonical geometry, weights or UVs**. V0.3/V0.4 generate rough approximations, so incorrect armhole/shoulder continuity, waist fit, UV and clothing-on-clothing penetration cannot be solved by changing width/lift slider alone. Validate skeleton bind space and animation, not just stationary T-pose.

Official VRoid material: https://vroid.pixiv.help/hc/en-us/articles/39513431300377-What-are-custom-items and https://vroid.pixiv.help/hc/en-us/articles/38729525846809-How-to-convert-costumes-and-accessories-made-in-VRoid-Studio-to-XWear . The latter supports conversion in VRoid Studio, **not evidence of an accessible headless CLI**.

### Outfit candidate pipeline: at least THREE wearable looks, not placeholder thumbnails

1. **Cyber Blue** — source https://booth.pm/en/items/5798462 — owner provided `Cyber_Blue.zip` privately; includes top, skirt, shoes. First fix the top and then complete set only if feasible.
2. **13 OUTFIT VROID by [maw]** — source https://booth.pm/en/items/7430616 — freely downloadable `.vroidcustomitem` bundle; assorted interchangeable pieces. Acquire only under creator Terms, no unauthorized embedding or redistribution.
3. **VRoid Pastel Pink Outfit/Pajama Set** — source https://booth.pm/en/items/7692844 — free VRoid stable custom item with two top variants. Confirm source rights and test actual geometry; do not claim ready if ZIP not acquired.
4. Optional **Sweet Pop Jacket** — https://booth.pm/en/items/8009784 (paid custom item; do not purchase without authorization) and **4473D Varsity Jacket Set** — https://booth.pm/en/items/6517690 (commercial-license tier; do not purchase or falsely treat personal license as commercial).
5. A **fully original, repo-owned artist-built outfit** may substitute as a gameplay-safe/Preview-safe option if third-party licensing or geometry export is blocked. Such a generated design must genuinely be original, not an unlicensed near-copy of a creator's artwork.

Per candidate catalog entry, record `itemId`, `displayName`, `category`, `fileFormat`, `assetOrigin`, `licenseStatus`, `thumbnail`, `meshState`, `rigCompatibility`, `qaStatus`, and `previewOnly`. Never mark an illustration as wearable.

### Work assignment — recommended checkpoints

**A. Real geometry feasibility:** inspect source binaries, test VRoid Studio XWear or VRM export only when the actual tools run in Work; alternatively use an authorized garment mesh. Preserve native UVs and rig weights when possible. Blender headless may help mesh processing and rig transfer; Blender alone cannot magically reproduce VRoid generator. Keep exact-vs-approx status explicit.

**B. Art quality first:** choose visually credible mesh shapes; no box/cylinder shirt fallback. Proper collar, armhole, shoulder bridging, sleeve taper/cuffs, vest torso and waist hem, front/back normals, source colors and seams. Avoid painting face/body. Run bind-pose, idle and actual existing dance-clip checks; log major intersections and limitations.

**C. Outfit modular architecture:** separate `hair`, `top`, `bottom`, `shoes`, `accessory`; reversible equip/unequip. Fit and occlusion are local to cosmetics. Resource lifecycle: do not recreate 3D actors or AnimationMixer on metadata-only updates; preserve existing WebAudio/global gameplay clock.

**D. In-game-style QA without production integration:** use a new isolated route such as `/tools/cosmetics-game-qa` derived from established Character Creation look, or an explicitly gated link on `/character/create?cosmeticsQa=1`. Display **Shop preview → Mock owned inventory → Equip/Unequip → Avatar 3D**, plus reload persistence (browser local only) and original look restore. No real purchase, pricing/balance, server inventory or multiplayer canonical avatar changes. Do not silently unlock currently unavailable Character Catalog slots. Treat Vita Premium Cute Variant A as **separate experimental character art**, not an automatic replacement for `c1-casual-grace` in authoritative gameplay.

**E. Visual validation:** compare front/35°/side/rear, shoulders/waist/hand regions, two existing dance animations if technically compatible; avoid false QA claims. Evaluate iPhone portrait memory and visual without pretending a cloud browser is the owner's physical iPhone. Create focused Playwright screenshots, TypeScript, Next.js build, no full regression unless high-risk integration requires it.

**F. Ownership, licensing and delivery:** never put the owner's ZIP/creator textures/derived garment binaries into public repo/client bundle or a publicly downloadable Preview without explicit redistribution rights. Browser-local import of user's files is allowed. Some licensing may also constrain garment-derived deployments; mark uncertain status rather than assuming. No secret/external credentials, no buying.

### Acceptance definition

- Owner iPhone sees genuinely wearable 3D garment variants (at least three **working and rights-cleared** looks if source assets can be obtained; if not, clearly show fewer ready items + honest blocked ones).
- Clothing does not detach or visibly deform at the shoulder, torso or waist during idle and dance stress tests, to owner visual acceptance.
- The accepted full Hair Studio demo remains intact, including FeliKitty ability.
- QA Shop/Inventory/Appearance entry flows are testable **without changing authoritative Character Catalog, multiplayer RoomState, READY/START, Supabase Realtime or WebAudio clock**.
- Original V1.1 asset/face/outfit remain recoverable at all times.
- Deliver Preview, commit SHA, changed files, exact source/rights status, real QA evidence and owner iPhone testing instructions. **No merge to development/main without explicit owner approval.**

## Permissions and remaining dependencies

This handoff authorizes an isolated prototype, not deployment into `development`, real in-game commerce, use of external paid assets, or unauthorized redistribution. The owner `Cyber_Blue.zip`, V1.1 approved GLB and screenshot `IMG_4536.jpeg` are private chat attachments and may require explicit sharing with Work if its new conversation cannot access them. Do not fabricate paths or assume access. No work can be truthfully certified production-ready solely from the information in this document.

