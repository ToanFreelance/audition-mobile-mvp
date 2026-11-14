# M3 Main Flow Integration V1 — Step 1 Character Creation

Date: 2026-11-14.
Work branch: `work/m3-main-flow-integration-v1`, starting from development `abdf8d9c2e5da3ac403397cc8ca54ecbf526d781`.
Owner-approved target: M3 Female Drophunter + M3 Male Neurohacker Street with gender, hair style/color, source-backed skin-tone texture and saved creator profile.

## Root cause

Existing creator: ProfileV1 saves hair/skin metadata, but preview loads a monolithic GLB from c1/c4 catalog and never applies it to model.
Current Room Browser forwards name and characterAssetId; RoomState avatar outfit defaults to empty, and Stage3D expects CharacterActor's Mixamo clips. M3 rigs (owner-reported female 198 joints, male Neurohacker source 102 joints) are not directly compatible with the existing Mixamo animation adapter. PR19 V2.2.9 CMU→Mixamo QA is isolated, unfinished and does not retarget M3.

## Step 1 changes

- Character Catalog adds `m3-drophunter` / `m3-neurohacker` (m3RigFamily explicitly selects source; never infer from gender or actor name).
- `creatorReady=true`, `runtimeReady=false` until future Waiting Room/Gameplay integration. C1/C4 catalog and fallback `default-female/male` remain unchanged. M3 new creator default is Drophunter; legacy draft validation remains.
- `M3CharacterAssembler` reuses demonstrated one-base, one-skeleton, donor-SkinnedMesh binding strategy with strict joint-order/inverse-bind tolerance. It has no gameplay clock, renderer or AnimationMixer.
- Mandatory Eyes and default garments are independently loaded. Female default = Curled Bangs + Tank Top + Skirt + Short Boots; Male = Short Hair + Streetwear + Cargo Pants + Casual Shoes.
- Hair changes replace only worn skinned hair mesh; no actor reload. Hair colors use existing M3 Basic Colors palette values. Skin-tone changes use source `textureCollections/skin color` actual base/face/mouth maps; no thumbnail-based texture substitution.
- Step 1 uses the accepted creator layout and preview camera; creates distinct actor only when M3 family/identity changes.
- Old C1/C4 profiles can be loaded, M3 on-device QA can migrate deliberately from legacy selection. M3 draft saves in existing localStorage profile V1, while room handoff CTA remains gated because actor preload and gameplay are not implemented.
- No third-party binaries are copied into repo; upstream URLs are research-only. Licensing/commercial use must be resolved before release.

## iPhone acceptance gate

1. Fresh profile loads Drophunter with intact eyes/top/skirt/shoes, then Male Neurohacker with street outfit.
2. Switch hair choices without WebGL scene reset; model stays visible. Observe body and face with each M3 skin tone.
3. Hair color changes only hair; do not mistake text swatch selection for actual mesh color PASS.
4. Save then reload `/character/create`; verify ID, name, skin, hair style/color restored.
5. Existing legacy c1/c4 saved profile still loads.
6. On new M3 identity, no `Continue to Rooms` because `runtimeReady` intentionally false.
7. If any new skin texture fails loading or a garment rig is incompatible, require visible error. No fake geometry/model replacement.
8. Accept only after physical iPhone Safari visual QA.

## Remaining steps (NOT in this commit)

- Step 2: validate/freeze appearance/outfit into RoomState and MatchManifest; add M3 actor cache and idle animation profile to Waiting Room, resource hashes/preload; preserve READY/connection mixer lifetime.
- Step 3: retarget current and PR19 dance choreography to M3 rest pose/bone axes, real iPhone animation/floor/Finish QA, preserve WebAudio clock, 4-beat turns, sequenceCounts and AUDIO END.
- No Shop/Inventory, new clothing, Phase 14, direct development edits, merge, or production catalog activation.

Validation: TypeScript/Next.js build and preview READY must be separately verified; code construction is not a mobile visual PASS.

## Correction — physical iPhone owner findings (2026-11-14)
Owner screenshot: female eyes/hair absent, skirt over head, boots away from feet,
male giant trouser meshes. Root issue: Step 1 M3 assembler added an intermediate
actor Group between base VRM and presentation frame, differing from the accepted
M3 demo's canonical bind-space ownership. This correction makes the base VRM
scene itself own the skeleton and all equipped SkinnedMesh traits. Only an
outside presentation group receives scale/center/camera rotation. Source rig
checks remain; geometric outliers fail closed, not shown as floating garments.

Initial screen is now Tạo hình, selector open for choosing sex/skin. Default
source-backed outfit: Drophunter short hair, original light skin, shirt,
casualshorts, sneakers; Neurohacker short hair, original light skin, Logo Tee,
Cargo Shorts, casual shoes. Existing saved custom profile is not overwritten;
new default applies to fresh profiles and on identity switching.
This is implementation QA only: visual must be retested on physical iPhone.
