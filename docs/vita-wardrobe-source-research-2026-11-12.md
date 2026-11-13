# Vita Wardrobe — sourced outfit candidates (research only, 2026-11-12)

> **Nghiên cứu lịch sử:** shortlist hiện hành đã được owner thay bằng 3 outfit + 5 accessory tại [SESSION 1](vita-female-wardrobe-v1-session-1.md). Danh sách P1/P2/P3 bên dưới không tự động được phép triển khai; manifest mới là metadata hiện hành.

**Goal:** explore modular clothing for Premium Cute Vita Variant A after owner iPhone acceptance of the VRoid Beta hair import POC. No gameplay/Character Catalog/outfit import implementation in this task. Original approved V1.1 face and outfit remain intact.

## Shortlist — source pages, observed packages and rights

| Priority | Candidate | Source | Price listed | File format / fit | Usage constraints and verification |
| --- | --- | --- | --- | --- | --- |
| P1 | **13 OUTFIT VROID by [maw] — FREE GIFT** | https://booth.pm/en/items/7430616 | 0 JPY | ZIP; `.vroidcustomitem`, mix-and-match pieces; no GLB ready | Creator allows modification and conversion for VRoid/VRC, prohibits redistribution / claiming authorship. **Verify game-distribution rights independently**. Best broad prototype pack. |
| P1 | **Cyber Blue Outfit Set** | https://booth.pm/en/items/5798462 | 0 JPY | ZIP; separate top/skirt/shoes `.vroidcustomitem` | Commercial use requires author credit; redistribution prohibited. Source is good for Audition-like neon/cyber aesthetic. |
| P1 | **VRoid Pastel Pink Outfit/Pajama Set** | https://booth.pm/en/items/7692844 | 0 JPY | Stable VRoid custom item; two top variants | Creator permits broad use / recoloring, disallows passing off as own or resale of asset. Clarify embedded-download/game distribution before release. |
| P2 | **Sweet Girly Coord** | https://booth.pm/en/items/8009838 | 300 JPY | VRoid Studio Custom Item (cardigan + pleated skirt) | Premium cute/pastel reference; confirm precise license and files before buying/using in a game. Not a ready GLB. |
| P2 | **Sweet Pop Jacket** | https://booth.pm/en/items/8009784 | 300 JPY | VRoid Custom Item only; seller explicitly says no XWear or Unity package | Pink/violet pop streetwear aesthetic; rights require review; not directly attachable as glTF clothing. |
| P2 | **4473D Varsity Jacket Set** | https://booth.pm/en/items/6517690 | 500–1,300 JPY personal options; 3,900 JPY commercial | `.vroidcustomitem`; female cropped/skirts and male variants | Seller explicitly requires **commercial license for apps/games**, prohibits redistribution. Do not use personal tier in Audition game. |
| P3 | **4473D Sailor Cardigan** | https://booth.pm/en/items/3674710 | 800 JPY personal; 5,000 JPY commercial | `.vroid` mannequin + cardigan/skirt/bow PNG textures | Soft pink sailor direction, but no isolated skinned garment GLB and app/game commercial tier required. |
| P3 | **Free Kimono with Haori (XWear)** | https://booth.pm/en/items/6848282 | 0 JPY | `.xwear` and `.vroidcustomitem` | Seller allows modification/reuse/re-distribution under page terms; test XWear support separately, culturally distinct from initial casual sportswear goal. |

**Prices, availability and licensing snapshot only** — re-check the actual seller Terms before purchase, conversion, public asset distribution or commercial product use. Free download never implies unrestricted redistribution.

## Technical implications / recommended next isolated POC

1. **Start with a freely downloadable, seller-permitted test asset** from the P1 list. Inspect its actual ZIP entries and licensing first. No assumption that every `.vroidcustomitem` contains reusable body mesh.
2. Clothes are **not hair**: hair-only static meshes can attach to `Head`, but outerwear/skirts must deform with hip/torso/arms/legs, preserving weights, bind pose, bone indices and avoidance of body clipping. Test across standing and dance poses, not T-pose alone.
3. Evaluate **texture/template extraction** for native VRoid cloth parameters and/or isolated garment extraction from an authorized VRM. Do not claim the Beta hair converter works for Stable outfits.
4. Keep a separate **Wardrobe Try-On POC** only if the owner explicitly requests it, and never overwrite approved Vita V1.1 face/outfit. Use a distinct work scope/branch for future implementation once prioritized.
5. If licensed assets cannot be embedded in a public Preview, run local-only import with user-supplied files, as with hair; do not commit creator files to GitHub.

Sources: seller listings above and official VRoid documentation for `.vroidcustomitem` categories: https://vroid.pixiv.help/hc/en-us/articles/900005583186-How-to-Use-Custom-Items and https://vroid.pixiv.help/hc/en-us/articles/7467455312409-How-to-import-and-export-custom-items .

## Proposed next milestone: isolated Vita Wardrobe Studio (recommendation, NOT authorized implementation)

**Gate 0 — Asset/legal feasibility:** Select one free, source-verifiable outfit ZIP (prefer individual upper/top piece first, e.g. Cyber Blue). Read the actual package's terms and file structure without uploading licensed assets to public GitHub. Check whether it contains texture/template parameters (`.vroidcustomitem`), actual `.vrm/.glb` geometry, or `.xwear`. VRoid Studio custom items may contain texture editor/template data; **not** guaranteed skinned geometry.

**Gate 1 — First top-only demo:** Build an isolated wardrobe try-on route only once approved. Original Premium V1.1 body, face, hair, rig and outfit must not be modified in stored source. Import user-supplied clothing in browser memory; match scale, bind pose and skin weights with the original skeleton for body garments. Use original wardrobe as fallback. No claim that attaching static geometry to one torso bone is sufficient.

**Gate 2 — Motion fit:** inspect neutral/T-pose, idle, body turns and existing dance clips; reject shoulder/elbow/torso penetration and z-fighting. Include body occlusion strategy (hide only body regions actually covered, without damaging accepted character) and preserve texture/material quality.

**Gate 3 — Modular clothing categories:** separate top, bottom, shoes, outerwear/accessories into data-driven independent slots and reversible selection. Define clear ownership, author credit, and export/distribution eligibility before any production catalog, no automatic inclusion in Character Catalog.

**Decision rule:** A one-outfit proof of concept passing iPhone visual + dance tests precedes building any general-purpose Stable `.vroidcustomitem` converter or shop. Avoid starting full wardrobe pipeline based only on hair success.

