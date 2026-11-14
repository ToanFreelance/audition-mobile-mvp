# B1.3 — Demo-first modular character candidates after owner CharacterCreator feedback

Date: 2026-11-14 (Asia/Ho_Chi_Minh)
Repository: `ToanFreelance/audition-mobile-mvp`
Branch: `work/vita-wardrobe-tryon-poc-v1`
Verified starting remote HEAD: `ab8de045c22d28b489ded5bc57c468b14c62d8d1`
Mode: RESEARCH / DECISION ONLY. No binary downloaded, no rendering, no implementation, no public asset hosting, no purchases, no Shop/Inventory, no production Character Catalog changes.

## Owner feedback and updated constraint

The owner personally tested the publicly accessible **kblood/CharacterCreator** browser demo and values the ability to swap many independent clothing pieces. For the existing Audition MVP demo, prioritize **one persistent body/skeleton per character**, real modular garment changes, male/female, dance compatibility, iPhone access, and safe reuse without downloading an entire new character for each outfit. Premium cute art may be improved later; original Vita V1.1 must not be deleted or silently replaced. License review can be lightweight for **source triage**, but private proof does not imply permission to publicly ship unauthorized assets.

This feedback is **acceptance of the wardrobe interaction approach, not final character art or gameplay integration**.

## Newly checked candidates

| Priority for investigation | Source | Public claim / evidence | Distinguishing constraints |
| --- | --- | --- | --- |
| **A — proven modular mechanism reference** | [kblood/CharacterCreator](https://github.com/kblood/CharacterCreator), [live demo](https://dionysus.dk/webxr/charactercreator/) | Public separate GLBs for body, clothing, shoes and hair; 53-bone MakeHuman rig; real glTF binary inspection in B1.2 confirms three garments have identical rest hierarchy and inverse-bind matrices. CC0 output assets, **GPL-3.0+ current code**. Owner likes wardrobe behavior. | Current source deliberately realistic, not premium cute. The 7.23 MB base GLB was not read fully by connector in B1.2. No local animation/render or iPhone Audition QA yet. Avoid copying GPL runtime code into the application; write a small independent Three.js adapter around CC0 assets if future implementation authorized. |
| **B — best ready-made web demo comparison** | [MidknightGames Character Modular with Animation](https://midnight-beam.itch.io/character-modular-with-animation), [live viewer](https://character-modular.web.app/) | Publisher lists 14 male/female body variants, 16 modular face presets, 13 tops, 8 bottoms, 5 shoes, 14 hairstyles and 35 animations including dance. Mixamo Humanoid, ~2k–7k triangles/assembled model, common 2048² base-color atlas; **$29**, 169 MB ZIP. Site/web demo is reachable, but actual interactive actions not tested by assistant. | Cute/cozy **low-poly** style, potential owner visual rejection (do not assume it replaces higher-quality Vita). Binary and skeleton validation not run, license/content not acquired. |
| **C — most relevant VRM/Three.js framework reference** | [M3-org/CharacterStudio](https://github.com/M3-org/CharacterStudio) plus [documentation](https://m3-org.github.io/characterstudio-docs/docs/about/) | MIT source; trait manifest system, VRM item uploads, outfit/face/hair selection, skin-layer culling, atlas/mesh optimization, GLB/VRM exports; source itself is not an outfit library. Separate public [memelotsqui/character-assets](https://github.com/memelotsqui/character-assets) has VRM parts (hoodie, crop top, sneakers) but no verified redistribution license. | Better anime/cyberpunk potential, but default sample assets are loot/fantasy and not yet verified as Audition art. Prefer architectural study, not a broad framework transplant. |
| **D — stylized/anime art contender** | [TajSensei Stylized Modular Characters](https://tajsensei.itch.io/stylized-modular-characters) | Publisher advertises male/female Humanoid, 11 tops, 6 bottoms, 7 footwear, 17 hairstyles, 11k–22k triangles. Free **male sampler** available; full 98 MB pack from **$9.90**, no separate binary inspected. | Unity Shader Graph for author-provided look. No validated GLB/FBX in archive, commercial terms not independently checked. No automatic successful runtime equip assumed. |
| **E — cartoon asset with animation** | [ThreeDee Gamerz](https://www.fab.com/listings/e36371ee-e19b-47a8-9d74-18047f36f2d0) | Female one base/10 tops/10 bottoms/11 shoes/10 hairstyles; male one base/11 tops/12 bottoms/10 shoes/13 hairstyles, body/face rig and animations, 52 ARKit shapes. | This Fab release is **Blender-source-only** (no GLB/FBX package supplied); exporter + rig normalization required. 5.4k polygons per assembled character, casual low-poly/cartoon style; binary and final mobile look unverified. |
| **F — cartoon alternative with GLB** | [ThreeDee Humanz](https://www.fab.com/listings/7042120c-9c76-4d0e-8d1e-7a5b25dadffa) | Male/female modular clothes, shoes, hair/accessories, Rigify, Blender+FBX+GLB+OBJ as published. | GLB being available does not prove **independent skinned parts** or identical bind matrices; Blender rig conversion & dance tests needed; price and access not acquired. |
| **Architecture only — reject as literal one-actor wardrobe** | [FireTable/project-xiaochun](https://github.com/FireTable/project-xiaochun) | Implements VRM base + outfit delta-patches to reduce downloads, caches assembled models and restores pose on swap. | Swaps/reconstitutes the avatar VRM; **not** demonstrated unchanged base actor and garment-specific SkinnedMesh equip. Useful distribution optimization idea, not replacement for true runtime modular. |
| **Deprioritize for this owner** | [Grab3D Character Mixer](https://grab3d.com/tools/character-mixer/), Ara 3D Gen, MakeHuman-derived generators | Browser or CLI character customization exists. | Grab3D exports one combined GLB on 19-bone rig, low-poly. Ara/MakeHuman are realism-first and do not prove the desired cute wardrobe/look. |

Numbers without an independent binary test are **publisher declarations**. Only CharacterCreator garment skeleton data were directly validated in prior B1.2. No source has new iPhone physical QA in B1.3. Product costs may change.

## Best two-lane demo strategy (proposal, not implementation)

**Technical acceptance lane:** Preserve owner-approved CharacterCreator wardrobe interaction pattern. On an isolated QA route, reuse only CC0 **asset outputs** (not GPL runtime code), independently load `base_body.glb` once, attach `clothing_tshirt.glb` / `clothing_hoodie.glb` / `clothing_jeans.glb` / shoes/hair as independent skinned items, use one skeleton+AnimationMixer, reversible body-region culling, no hidden whole-actor recreation. Verify shared bone inverses against **base**, not just clothing files; use a compatible animation probe and record actual iPhone visual/perf.

**Art selection lane:** Owner compare the MidknightGames live viewer (low poly/cozy) with CharacterCreator, then assess TajSensei and M3 asset look via previews before purchasing anything. A cute anime model replacing the base must come with a consistent modular garment family or validated rig-conversion contract; image-generation similarity is not enough.

**Decision:** Prioritize an **actual Audition isolated modular proof with already verified CharacterCreator CC0 garments** over more OpenSew, VPS/Unity editor setup or speculative AI auto-rig. Its visual look is demo-only; no automatic substitution into production Character Catalog. For a visually stronger new base, evaluate Midknight/TajSensei asset style and mesh sources first.

## Constraints for any follow-up implementation

- Work branch only; no merges, Shop, Inventory, or production actor changes. Keep original Vita Premium Cute A V1.1, accepted Hair Studio and current Character Catalog untouched.
- Do not change WebAudio time, global turns, gauge, Finish, RoomState/CAS, Supabase, waiting-room actor lifetime or animation mixer on roster metadata updates.
- Download asset binaries only through authorized source. CC0 GLBs from CharacterCreator can be used independently under the author's recorded CC0 grant; its **current GPL-3.0 code is a different license** and must not be copied blindly. Other demo assets still require applicable permissions for public hosting.
- True PASS requires a real base + independently loaded tops/bottom/shoes, unchanged skeleton/mixer through outfit changes, no major clipping on dance, and owner physical iPhone acceptance. Cosmetic items not confirmed compatible with existing animation remain EXPERIMENTAL.
- A technical win does not imply artistic PASS or a guaranteed ability to add arbitrary new AI-generated garments without fit/skin QA.

## Verdict

**B1.3 candidate expansion / verification: PASS for discovery and comparative source review.**
**CharacterCreator split-garment binary proof: carried forward from B1.2 only (partial structural PASS).**
**New candidate binary acceptance, full base+dance test, owner art approval, Audition demo: NOT RUN.**

No code, runtime assets, purchases, CI/build, Vercel preview or iPhone QA performed.
