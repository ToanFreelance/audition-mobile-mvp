# B1.2 — Direct-download modular character/wardrobe sources (no Unity Hub)

Date: 2026-11-14 (Asia/Ho_Chi_Minh)  
Repo: `ToanFreelance/audition-mobile-mvp`  
Branch: `work/vita-wardrobe-tryon-poc-v1`  
Verified start HEAD: `5adcb8a0fe509752ccd3359875a027fdfb94dffc`  
Mode: Source research + read-only **real binary GLB metadata inspection**; no rendering, no game integration, no purchases.

## Owner request / exact acceptance constraints

**Before installing Unity Hub in Work**, find independent `.fbx`, `.glb`, `.vrm` or `.blend` sources with a **single persistent cute / anime / urban dance base** and truly interchangeable skinned hair, top, bottom and shoes using a common skeleton. Female+male support needed eventually; never replace the accepted Vita V1.1 or consider separate full-character GLB skins a solution. Do not repeat owner-rejected PSX/Quaternius fantasy art as the final character.

## Candidate verification

| Candidate | Acquisition and source | License evidence | Practical result |
|---|---|---|---|
| **kblood/CharacterCreator** | Public GitHub `output/base_body.glb` plus `clothing_tshirt.glb`, `clothing_hoodie.glb`, `clothing_jeans.glb`, `clothing_shoes.glb`, other clothes and hairstyles as separate on-demand GLBs. Three.js demo: https://dionysus.dk/webxr/charactercreator/ | Repository `LICENSE-NOTES.md` releases **output GLB assets as CC0**, while **current project code is GPL-3.0-or-later** (not suitable to integrate into a closed-source application without license compliance). | **Actual garment binary data inspected** through GitHub connector. Technically interesting architecture; realistically styled MakeHuman source, **not accepted cute anime/streetwear final art**. Full base-body binary and actual animation not processed in this checkpoint. |
| **memelotsqui/character-assets** | Public GitHub has direct standalone VRM files, including `drophunter/body/drophunter.vrm`, `drophunter/chest/{croptop,hoodie,shirt,...}.vrm`, `drophunter/feet/{sneakers,hightop,...}.vrm`; similar `neurohacker` family. | **No explicit license file or commercial distribution terms verified in repo.** Public visibility is not a license. | Promising actual wardrobe geometry repository but **LEGAL BLOCKED** for game use; VRM-to-Three.js fit/bind still untested, aesthetic unknown and MMO/fantasy origins. |
| **TajSensei Stylized Modular Characters** | https://tajsensei.itch.io/stylized-modular-characters ; free download listing `Free Male Character.rar` (4.8 MB). Full `Extra Modular Anime Characters` (98 MB) requires **$9.90+**. Publisher advertises male/female, 11 tops, 6 bottoms, 7 shoes, 17 hair, humanoid rigs and 11k–22k triangles; Unity shader graph dependent. | No explicit commercial license text located on itch listing; independent written permission needed. | **POTENTIAL AESTHETIC CANDIDATE**, not downloaded; free tier is only a male sample, full wardrobe paywalled. Do not infer FBX/GLB availability inside downloaded archive from platform labels. |
| **Amir Low Poly Modular Characters** | https://ahmedamirdev.itch.io/amir-low-poly-modular-characters ; **Free.zip 8.1 MB** announced to contain FBX and glTF, 6 era sets + 17 animations. | Listing declares **CC BY 4.0** + commercial use with attribution. | Direct download is offered, but **low-poly modern/medieval/cyberpunk**, not verified to meet owner's premium cute art target; do not use as a final-art substitute. No archive retrieved. |
| **Grab3D Character Mixer** | https://grab3d.com/tools/character-mixer/ ; free browser-based customizer producing a rigged GLB/VRM from 198 source parts. | Website explicitly declares CC0; no sign-in. | Creative builder has **19-bone proprietary rig**, and its normal output is **one combined skinned mesh**, not separate garment GLBs for runtime equip. Not suitable as a verified drop-in Audition wardrobe system; art is Cozy/Blocky/Low Poly. |
| **M3 CharacterStudio / m3-org loot-assets** | Open-source CharacterStudio code + public VRM assets for body/chest/boots/hands/head. | Code MIT; **standalone asset license not independently established** in loot-assets readme. | Mechanical/architecture reference only, historical fantasy look, no production rights confirmed. |

## Real GLB inspection performed

The GitHub connector read the **base64 file contents** of actual files under `kblood/CharacterCreator/output/`; a small GLB parser inspected the binary header, embedded glTF JSON, skinned mesh primitives, accessors, 53-joint skin, and inverse-bind float matrix contents. These are *real file bytes, not listing claims*. GitHub blobs:

| File | Bytes | Vertices | Triangles | Skin joints | UV + JOINTS + WEIGHTS |
|---|---:|---:|---:|---:|---|
| `clothing_tshirt.glb` | 388,104 | 902 | 1,528 | 53 | present |
| `clothing_hoodie.glb` | 684,848 | 1,793 | 3,176 | 53 | present |
| `clothing_jeans.glb` | 428,704 | 950 | 1,712 | 53 | present |
| `clothing_shoes.glb` | 847,684 | 1,846 | 3,320 | 53 | present |

For **T-shirt vs hoodie vs jeans**, the three skins' *53 bone names/order, parent/child hierarchy and local rest transforms* are identical; inverse-bind matrices (53×16 float32 each) are **exactly identical, maximum absolute delta = 0**. The 7.23 MB `base_body.glb` is present in the repository but the connector returned empty content when its large base64 was requested; therefore **comparison against the canonical base body and animation was NOT COMPLETED**. No render or clipping check. Actual GLB bytes were inspected in memory, not copied into the Audition repository.

This is strong evidence that **direct downloadable, professionally organized body/garment GLB pipelines exist** without requiring a Unity Editor. It does **not** establish a cute/anime female final-art family or a complete scalable third-party clothing marketplace.

## Acquisition execution constraints

- Itch.io free download buttons for TajSensei/Amir resolve to a purchase/download page with the free **'No thanks, just take me to the downloads'** flow; no anonymous direct file URL or successful archive transfer was verified here. Do not bypass the platform's flow.
- Runtime container has no working external DNS/network access; the GitHub connector successfully retrieved only the smaller public GLB binaries as base64 for in-memory parsing. No private source data was uploaded, redistributed or committed.
- GitHub repositories without explicit asset license remain **not approved for use in a public product**.

## Verdict / next action

**B1.2 ALTERNATIVE SOURCE SEARCH: PASS (credible direct-format alternatives identified).**  
**Real garment binary metadata/rig-matching test: PARTIAL PASS (3 independent garments),** not base/animation or visual proof.  
**Owner art acceptance + final female/male costume family: BLOCKED/NOT RUN.**

Do **not** install Unity Hub merely because direct GLB sources are undiscovered. The free CC0 `kblood/CharacterCreator` demo is the fastest **technical showcase** of modular swapping with separated files; owner should inspect its look separately and reject it as final if not premium cute. The only more anime/cute **direct storefront** candidate identified here, TajSensei, requires $9.90 for the full wardrobe and clearer asset license/format evidence; do not purchase or claim it replaces Vita yet.

If the owner requires **Premium Cute/Streetwear** and rejects the CC0 realistic look, first perform a **targeted aesthetic/terms/source access check** of TajSensei or continue the already owned 156 Forge Unity package acquisition; do not send Work into arbitrary auto-garment modeling.

No production Character Catalog, Hair Studio, animation mixer, RoomState/Supabase/WebAudio, Shop/Inventory, or `development`/`main` changes.
