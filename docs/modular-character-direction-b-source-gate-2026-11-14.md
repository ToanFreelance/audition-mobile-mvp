# SESSION B0 — Single-Base Modular Character Ecosystem Source Gate

Date: 2026-11-14 (Asia/Ho_Chi_Minh)  
Repository: `ToanFreelance/audition-mobile-mvp`  
Work branch: `work/vita-wardrobe-tryon-poc-v1`  
Verified starting remote HEAD: `0a5ec6d9075363d1850c6b12407b7535e81efbb9`  
Mode: **SOURCE / RIGHTS / FEASIBILITY REVIEW ONLY**. The owner explicitly selected Direction B (a new cute/street-dance modular character ecosystem) and authorized starting that direction. This report is **not** authorization to purchase licenses, introduce third-party asset binaries, replace Vita V1.1, migrate production Character Catalog, or implement Shop/Inventory.

## Non-negotiable objective

- ONE persistent base/rig per character identity; interchangeable **real skinned** top, bottom, shoe, hairstyle and accessory assets.
- Preserve one animation authority / skeleton per actor and reuse it on cosmetic changes. A collection of full-character GLBs swapping whole actors is **not an acceptable modular implementation**.
- Female **and** male character roadmap; modern dance / K-pop / cute anime/stylized aesthetic. Do not repeat owner-rejected Quaternius / PSX low-poly models as final art.
- Five-human iPhone portrait gameplay, stable actor lifecycle, resource budgets. Gameplay/Supabase/WebAudio architecture untouched.
- The owner operates from iPhone only; no local desktop DCC requirement.

## Publisher/source-verified shortlist (no asset binaries acquired)

| Order / role | Candidate | Published modular contents | Price/status | Artistic judgement | Verified blocker |
| --- | --- | --- | --- | --- | --- |
| **1 — visual/production candidate** | [BoZo Stylized Modular Characters — Anime Pack](https://assetstore.unity.com/packages/3d/characters/humanoids/humans/bozo-stylized-modular-characters-anime-pack-323550) | One morphable male/female body family; publisher lists **17 tops, 15 bottoms, 12 footwear**, hair/accessory slots, facial blendshapes, Humanoid rig, 13–25k tris per assembled avatar; compatible with author's other 2.6 packs | **USD 40** listing observed, 2026-10-30 release 2.6.5, Standard Unity EULA; no purchase | Closest candidate here to cute/anime + many outfit variations, **owner visual approval pending** | Unity .unitypackage and Shader Graph/URP workflow, not verified FBX/GLB/Blender source or Three.js shader parity; real skeleton/skin compatibility not tested; pack rights & legal embedding in web app need review |
| **2 — first zero-cost mechanical gate** | [156 Forge Modular Anime School Girl — Lite](https://assetstore.unity.com/packages/3d/characters/humanoids/humans/modular-anime-school-girl-lite-edition-free-starter-pack-407058) | ONE modular female body; **2 tops, 1 bottom, 2 hair parts**, shoes/accessories; Unity Humanoid/Mixamo, 4–9k tris (publisher); admits possible clipping | **Free**; 2.4 MB Unity Asset Store pack; published 2026-10-08; Standard Unity EULA | Anime proof candidate, NOT accepted final game art | Only female; school uniform vs dance streetwear; Unity account/authorized access and source file verification pending; no actual Three.js/animation QA |
| **3 — possible expansion after Lite** | [156 Forge Modular Anime School Girl — Full](https://assetstore.unity.com/packages/3d/characters/humanoids/humans/modular-anime-school-girl-custom-toon-shaders-built-in-urp-409046) | Publisher lists **10 tops, 6 bottoms, 4 shoes** plus hair/face options on same family | **USD 36** observed; 2026-11-04 | Same-family reuse promising, but schoolwear focus | Need prove Lite→Full shared skeleton and adequate streetwear variety; no male |
| **4 — secondary technical candidate** | [RocketArts Stylized Modular Characters 2.0](https://marketplace.unity.com/packages/3d/characters/humanoids/stylized-modular-characters-2-0-262315) | Publisher explicitly claims single humanoid skeleton and runtime part-binding; 26 presets, 2 custom bases and 35 models, 15.5–20.5k tris | **USD 89.99** observed, 2026-10-27 | Stylized, less assured cute/anime art | Unity-specific customization code/Shader Graph, no source downloaded or Three.js proof |
| **5 — dance-oriented art comparison only** | [Kameworks Modular Anime Character Dancer — Noel](https://kameworks.artstation.com/projects/qJE9XR) | Publisher advertises female/male anime dance outfits and bundled dance clips, up/down/shoes and hair variants | Unity seller catalog recently listed **USD 99.99**; purchase not authorized | Strong dance relevance, but holiday/event look may not match everyday Audition | Package-name/marketing count inconsistency (6 outfits in name vs 12 in description), no binary or joint/bind validation |
| **NOT final-art candidate** | [Quaternius Universal Base + Modular Outfits Fantasy](https://quaternius.com/packs/modularcharacteroutfitsfantasy.html) | 12 outfits / 62 modular parts + same-series base; actual free standard archive advertised; CC0 | Free | **Rejected direction for final owner aesthetics** in prior research; mechanical control only | Do not spend another session selling fantasy low-poly as accepted Audition art |

**Confidence levels:** all counts, support, price and file sizes in this table are **publisher declarations**, not independently measured binary facts. Source pages were read on 2026-11-14. A “modular” claim means no binary validation until imported and inspected. Prices may change. Nothing above has an owner artistic PASS.

## Rights and hosting

- [Unity Asset Store Terms/EULA](https://unity.com/legal/as-terms), especially 2.2.1 / 2.2.1.1 and [official FAQ](https://assetstore.unity.com/browse/eula-faq): licensed assets may generally be embedded in original game products, but not redistributed as standalone assets or supplied for extraction. Whether a WebGL/Three.js GLB delivered to clients counts as compliant embedding for these specific assets requires careful legal/product review; obtain publisher's written guidance before public binary delivery if uncertain.
- Asset Store license acquisition requires proper customer account. **Free does not mean public-domain.** Do not scrape protected downloads, bypass account access, commit purchased Unity files into a public repo, or assume generic Unity sample pack license covers a hosted GLB viewer.
- Source-render screenshots/marketing visuals are visual references only; do not use as product asset substitutes.

## Architecture decision for Direction B

A provisional canonical **source body/skeleton family** is selected *only after* real source binaries validate the contract:

`characterBodyId + skeletonId + outfitSlots + appearanceIds → one actor / one shared skeleton / one AnimationMixer`

Required slots: `hair`, `top`, `bottom`, `shoes`, `accessories` (some outfits may be atomic compound outfits but still bind to the same canonical rig). Accessories can use explicit sockets where appropriate; gloves/shoes may need skinned meshes.

Each imported garment must state source license, asset hash, bind-space signature, exact skin bone mapping, material/texture provenance, body occlusion profile, and author QA verdict. Matching humanoid bone *names* is not sufficient: compare hierarchy/rest matrices/inverse-bind matrices numerically.

Runtime shall load just base + equipped pieces; no whole-character substitution for a shirt, no per-equipped-item AnimationMixer recreation, and no gameplay timeline changes.

## Stop/go gates in order

### B1 — Free asset availability (minimal immediate next gate)
1. Obtain **156 Forge Lite** through a legitimate Unity Asset Store account flow, if available to the authorized worker. Do not assume that an anonymous HTTP link is an asset download.
2. Inspect actual package contents in isolation. Identify independently skinned body/top A/top B/bottom/shoes, rig and textures. Report hashes and component counts.
3. Confirm source EULA/license scope for private research; do not publish raw binaries in GitHub/Vercel.
4. **STOP if no package access, no actual two skinned top parts, or no suitable extraction path.** No synthetic clothing fallback.

### B2 — Real modular/animation proof (only if B1 passes)
1. Convert permitted source pieces to GLB using legitimate tools and preserve original skin, UV, materials and inverse bind pose.
2. Compare base/top A/top B exact skeleton hierarchy and bind matrices; measure discrepancies.
3. Drive one canonical skeleton with one existing compatible Audition dance clip in a private isolated viewer; switch two tops and shoes/bottom if available without actor/mixer replacement.
4. Four-view neutral + stress frames (shoulders/armholes/hips/knees), owner iPhone acceptance; measure render cost and asset sizes only from measured data.
5. **Mechanical PASS and artistic PASS are separate.** Schoolgirl art does not automatically replace Vita.

### B3 — Production-art candidate selection (not automatically authorized)
If B1/B2 prove mechanics but art lacks quality, visually review BoZo Anime with owner **before** any purchase. Request/source a sample GLB/FBX or an authorized trial and confirm Unity-to-Three.js conversion and shader replacement. Only consider the USD 40 purchase after visual fit and legal/format diligence.

### B4 — Repeatability threshold
At least **two genuinely different tops + one bottom + one shoe** on one female base and compatibility evidence for a male counterpart, all under one repeatable rig/attachment process, with clean animation QA. If authoring one new outfit requires sculpting/weight-paint repair every time, the scalability gate is **BLOCKED**, not a pass.

## Repository/owner safety

- Original Vita GLB SHA-256 `d422159770ee8e9fbc9d78f2f256d5ee988651373cbd211aaa99efd7ecf2bad8` remains frozen; Hair Studio remains accepted.
- Do not modify Character Catalog, `CharacterActor`, RoomState/CAS/Realtime, WebAudio, gauge, Finish or Waiting Room; do not implement Shop/Inventory.
- This document is a scope and source audit. **No third-party binary downloaded, no GLB exported, no Blender/motion/Playwright/real iPhone test, no Vercel preview, no asset purchase.** Next Work run must identify actual execution availability before any GUI claims.

## Verdict

**B0 SOURCE GATE: PASS for identifying credible source families.**

**B1 BINARY/LICENSING: BLOCKED (no acquired/authorized Unity package).**

**B2 RIG/ANIMATION: NOT RUN.**  
**VISUAL / OWNER ACCEPTANCE: NOT RUN.**

Most economical path: attempt authorized FREE 156 Forge Lite source verification first; keep BoZo Anime as the strongest candidate for later owner artwork review. Do not commit to a paid AI generator or GPU VPS before this same-base mechanic is demonstrated.
