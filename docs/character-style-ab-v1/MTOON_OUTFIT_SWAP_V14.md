# Character Style A+B V1.4 — VRM MToon fidelity & real outfit geometry swap

## Owner request
Owner observed Ultra DPR barely improves sharpness, and garments already animate in V1.2. V1.3 cloned source SkinnedMeshes, so it did not constitute a real outfit swap. V1.4 is an isolated experiment at `/tools/character-style-ab-v1`, not production integration.

## Verified source data
- Official VRoid AvatarSample_A and AvatarSample_B glTF files include `VRM/MToon` material properties.
- B source has separate materials: `Tops_01_CLOTH`, `Bottoms_01_CLOTH`, `Shoes_01_CLOTH`, all within skinned meshes.
- Old GLTFLoader does not interpret the VRM0 MToon extension; pixiv VRMLoaderPlugin is now used (dependency: `@pixiv/three-vrm@3.5.5`).
- The viewer retains a material-mode switch: `VRM MToon` vs `glTF cũ`. Do not call the old look "MToon".

## Real swap proof of concept
- Unlike V1.3 overdraw duplication, Basic clothing groups are hidden when Premium is equipped.
- Premium is a *different* deformed geometry with flared bottoms and shaped top, original UV/skinIndex/skinWeight/bindMatrix and the source skeleton.
- When Basic is selected again, exact source geometry groups and visibility are restored; premium clones are disposed without touching bones.
- A new commercial-grade separately sculpted garment has not been authored. This is still a licensed-source-derived deformation used to prove swap mechanics.

## Focused QA actually executed
QA sandbox: Ubuntu Linux, Playwright 1.62, Chromium SwiftShader, portrait 390x844.
- Local `npm install @pixiv/three-vrm@3.5.5` + `npm run build`: PASS.
- VRM MToon and glTF legacy loaded successfully, no client JavaScript errors on initial manual combinations.
- Soft Mature: Premium 2 pieces / 90 source SkinnedMeshes / 2,345 altered vertices.
- Fashion Idol: Premium 2 pieces / 94 source SkinnedMeshes / 2,709 altered vertices.
- Soft Mature: three Premium↔Basic cycles PASS, procedural step QA starts, no JS errors.
- Fashion Idol: separate Premium/MToon + Legacy modes PASS; one long continuous repeat/switch test timed out. Do **NOT** claim all-motions/multi-switch PASS.
- Actual iPhone Safari visual fidelity and animation clipping require owner test.

## Known limitations / risks
- MToon may look different from GLTFLoader and can increase shader/texture usage; profile iPhone thermals and FPS.
- Premium geometry is source-derived, not an independent artist-authored outfit or shop SKU.
- Premium outfit fit/occlusion depends on VRoid sample topology, and deformation can create clipping at shoulders/skirt.
- This experiment does not change Camera/Waiting Room, RoomState, Audio, WebAudio, Character Catalog, commercial inventory or licensing.
- PR #24 remains Draft. Never merge without owner approval.
