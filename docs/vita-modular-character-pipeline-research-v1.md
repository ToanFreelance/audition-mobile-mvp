# Vita Modular Character Pipeline — Architecture Feasibility Study V1

Date: 2026-11-13 (Asia/Ho_Chi_Minh)
Repository: ToanFreelance/audition-mobile-mvp
Branch: work/vita-wardrobe-tryon-poc-v1
Verified start HEAD: 23c3bfca155dcbedcc45be5a43c8fbfe897788f1
Mode: RESEARCH AND DESIGN DECISION ONLY. No runtime, character assets, converter, QA route, Shop/Inventory, or production changes.

## Decision

**Provisional technical pilot: Quaternius Universal Base Characters + Modular Character Outfits (Fantasy), isolated from production and Vita V1.1.**

This is a *demonstration candidate for the invariant "one compatible female body + at least three different wearable outfits + common animation skeleton"*, not a recommendation to replace the accepted Vita art, existing characters, or Final Audition look.

**Architectural reference:** M3 CharacterStudio (MIT source for a Three.js/WebGL/VRM customizer, skinned-mesh combination and underlying face culling). This is an implementation pattern/reference, *not* a rights-cleared wearable collection and not approval to transplant its code.

**Long-term anime-art route:** maintain the approved Vita Premium Cute Variant A V1.1 unchanged as an art target until an actual compatible anime wardrobe pack and commercial rights are demonstrated. VRoid/XWear remains a possible authoring pipeline **only** with accessible Windows/macOS editor or native exported assets; Work Debian currently cannot launch VRoid.

Do not mark the three selected BOOTH wardrobe sources (Sweet Pop Jacket, Sweet Girly Coord, Cyber Blue) as wearable: only Cyber Blue ZIP has been inspected, and V0.3/V0.4 plus surface-remesh art probes were rejected by the owner.

## Repository / source baseline

- Production Character Catalog: `c1-casual-grace` and `c4-casual-boy`. Existing `CharacterActor` resolves animation profiles and retargets Quaternius clips to **Mixamo** for those accepted characters. Do not change this production path.
- Approved separate Vita V1.1: GLB SHA-256 `d422159770ee8e9fbc9d78f2f256d5ee988651373cbd211aaa99efd7ecf2bad8`; Blender-source body and 155-joint skin confirmed by Sessions 2–3. Its approved look and complete Hair Studio POC remain frozen.
- `docs/vita-wardrobe-cyber-blue-native-extraction.md`: actual Work host was Debian, Blender available, VRoid Studio unavailable; native custom-item conversion not run. `docs/vita-wardrobe-cyber-blue-top-v1.md`: donor-body voxel remesh was mechanically skinned but aesthetically rejected.
- `app/tools/vita-outfit-gallery/manifest.json` contains the owner's 3 outfits + 5 accessories and source/license/blocked status. It remains the current wardrobe source-of-truth, unchanged by this analysis.

## Candidate comparison

| Ecosystem | Genuine shared wardrobe? | Browser/Work feasibility | Artistic proximity to accepted Vita | Rights | Assessment |
| --- | --- | --- | --- | --- | --- |
| Quaternius Universal Base + Modular Character Outfits (Fantasy) | **Yes, asset author advertises 12 outfits, 62 modular parts, 3 texture variations and shared humanoid compatibility** | glTF/FBX; Linux and Three.js can parse; free Standard packs are large and must be downloaded/inspected in a separate bounded pilot | Low-to-medium; low-poly fantasy, **not Premium Cute idol/street** | Publisher labels both packs **CC0** | **First technical pilot** for wardrobe architecture only |
| M3 CharacterStudio | Software for modular avatars, layer-based face culling, atlasing and Three.js/VRM export; **not an outfit collection** | Web/JS implementation available | Depends entirely on assets | Code MIT; independently verify sample assets | Architecture reference only, do not port wholesale |
| VRoid Studio + XWear | Yes, including body fitting, clothing authoring and VRM exports | Native editor **not present** on current Linux Work host; .vroidcustomitem alone is not game-ready glTF | **High** for anime look | Rights depend on each item/author; Cyber Blue redistribution unresolved | Later authoring path only, remains BLOCKED for current Work |
| KayKit | Many rigged CC0 stylized characters and animation packs, but no verified multi-outfit same-body solution in this research | glTF/FBX | Low; chibi/low-poly | Pack-level CC0 | Secondary comparison, not selected |
| Ready Player Me | Service announced discontinued after 2026-01-31 | Hosted service not suitable to depend on | Uncertain | Contract-specific | Exclude as a new dependency |
| AI/procedural Blender single-outfit reconstruction | No stable compatible catalog demonstrated; previous owner prototypes fail artistic QA | Headless Blender works but art iteration expensive | Unproven | Derived assets can be restricted | Do not repeat as default pipeline |

## Confirmed compatibility evidence (publisher + independent demonstration)

Quaternius Universal Base Characters: 6 regular/teen/superhero male/female bases, 20 hairstyles, roughly 13k triangles per model, humanoid rig, glTF support, CC0.

Quaternius Modular Character Outfits (Fantasy): 12 outfit presets, 62 separate components, 3 material color variants per outfit; explicitly compatible with Universal Base Characters, exports glTF/FBX, CC0. Version notes mention improved modular fit and female aggregate files.

Independent published browser spike (Cinevva, 2026-05-10): inspected 65-joint identical-name/identical-bind skeletons in Quaternius base/outfit/animation packs; successfully rebinds outfit meshes by name to cloned body skeleton in Three.js; hides base-body slot where replacement garment covers it. This is **third-party reported test evidence, not our own asset download/QA**. The live hosted proof is available at:
https://app.cinevva.com/spikes/50-universal-characters/

The standard packs are relatively large (~122 MB base + ~280 MB outfits at observed itch.io listing), not suitable to download all on a mobile page. A later isolated pilot must select only necessary mesh/texture parts for a lightweight Preview.

## Proposed modular contract (pilot only)

- Canonical **pilot** rig and body: one female from the Quaternius same-pack family. Do not change `CharacterActor` or production Character Catalog.
- Each outfit slot is a **genuinely rigged garment mesh**, with explicit `skeletonId`, source rig and bind-pose identifiers, fit profile, body-region occlusion policy and rights metadata.
- Slots: body/outfit, arms/sleeves, legs/bottom, feet/shoes, hair, optional head/neck accessories. Not all kits split into exactly top/bottom — inspect actual meshes before promising mix-and-match categories.
- Rebind source `SkinnedMesh` by bone-name **only when the skeleton hierarchy, bind transforms and bone inverses have been numerically verified**. Same names alone are insufficient.
- `SkeletonUtils.clone` for per-character skeleton independence; reuse animation root/mixer across ordinary outfit changes. Never replace actor identity or reset playback for cosmetic metadata changes.
- Hide garment-covered body regions or use verified body mesh variants; avoid overdraw/intersections. For compound outfits keep restore reversible and rollback on error.
- Save outfit IDs/color variants, not whole GLBs. No DB/Shop/Inventory this phase.
- Source animation clips remain time-independent render assets; no effect on WebAudio clock, global turns, gauge, Finish, RoomState, Supabase, or READY/START.

## One-session proof gate (NOT AUTHORIZED BY THIS RESEARCH COMMIT)

When owner explicitly requests an implementation pilot, use one dedicated isolated work checkpoint for **three real outfits on ONE compatible female base** from Quaternius. This is a technical test, NOT an art integration or wholesale repository rewrite.

1. Download only free Standard versions through source-authorized channels; capture pack SHA, exact license files, mesh/skin/bind metadata. Stop if access blocked; no paywall bypass.
2. Choose actual three distinct female-fit outfit presets that exist in downloaded content; avoid guessing filenames.
3. Inspect bone names, order, hierarchy and bind matrices across base+three garments; document whether exact shared rig.
4. Build a small isolated viewer; swap Outfit A/B/C with one shared animation mixer and correct occlusion, no per-swap reconstruction.
5. Show front/35°/side/back + neutral/idle and one existing compatible dance clip; report iPhone FPS/device memory only from real measurements.
6. Owner judges **mechanical compatibility** separately from **visual suitability**. Never claim this fantasy kit reproduces Vita Premium Cute or source Cyber Blue.

**STOP/REJECT if** different bind poses require substantial per-outfit retargeting, three eligible outfits cannot be obtained, or any listed license conflicts with test deployment. If pilot passes technically but fails anime aesthetic, retain the architecture learnings and search for an **anime-style pack authored for the same common base**, or create **one approved original anime base and a reusable garment template family** with professional assets. Do not retroactively switch Vita's rig or face without explicit owner approval.

## Sources verified 2026-11-13

- Quaternius base (official): https://quaternius.com/packs/universalbasecharacters.html
- Quaternius outfits (official): https://quaternius.com/packs/modularcharacteroutfitsfantasy.html
- Quaternius outfits (itch.io terms & Standard packages): https://quaternius.itch.io/modular-character-outfits-fantasy
- Independent interactive web proof: https://app.cinevva.com/spikes/50-universal-characters/
- Independent implementation writeup: https://app.cinevva.com/blog/2026-05-10-open-world-browser-part-25-universal-characters
- Three.js character customizer reference: https://github.com/M3-org/CharacterStudio
- VRoid official XWear supported software, export details: https://vroid.pixiv.help/hc/en-us/articles/39513229598233-What-is-XWear
- VRoid v2 official fitting and VRM export: https://vroid.com/en/news/26gn98sTuPJQ53LxDQRyFg
- KayKit CC0 example: https://kaylousberg.itch.io/kaykit-adventurers
- Ready Player Me discontinued-service notice (third-party): https://learn.framevr.io/blog/rpm-closure

## Validation and delivery

Read-only GitHub branch/PR and repo architecture inspection + public source research. This commit contains documentation ONLY: **no code, new assets, downloads, auto-rig, Blender session, actual local runtime swap, iPhone or Vercel Preview**. Pilot outcome still **UNTESTED locally**, with an unusually promising publisher+independent working example.

No merge, no PR, no commit to main/development.
