# MODULAR CHARACTER FOUNDATION — DANCE QA V1 (2026-10-22)

Status: **EXPERIMENTAL / ASSETS NOT YET OWNER-ACCEPTED**. Work branch `work/modular-character-dance-qa-v1`, based on Animation Flow PR #19 HEAD `b7e3bf0`. No Shop/Inventory server, migration, production Character Catalog edits or PR merge.

## Owner decision

One female body template (`female-base-v1`), one male body template (`male-base-v1`). Face, eyes, skin, scalp and discreet innerwear stay in base. Hair, headwear, top, bottom, shoes and accessories are separate replaceable visual items. No other body shapes in MVP. The accepted `c1-casual-grace` / `c4-casual-boy` runtime GLBs remain intact during trials.

All dance flows, including Street/Breakdance/Finish/Recovery/Idle, use ONE externally authoritative `SourceFlowEngine` for the QA session. Garments follow the same character skeleton (no independent `AnimationMixer`, no second clock or synthetic extra turns). Do not change WebAudio, RoomState/CAS, Ready/preload, Finish, gauge, or global turn budget.

## GLB authoring contract (Tripo/Meshy -> Blender)

1. Create and **artist-approve** one non-generic female base and one male base. Match the agreed visual reference; retain a skin/innerwear layer, face and eyes. AI-produced full-outfit GLBs are NOT by themselves modular characters. Do not put rough procedural body substitutes into production.
2. In Blender, normalize each template to 1.65–1.75 m and a consistent front/up convention, rest T- or A-pose, pelvis origin and Mixamo-compatible skeleton names. Export **one base SkinnedMesh per template** with the body + innerwear, face and eye detail (separate materials allowed), with usable UV and weights. A technical prototype may have 22 bones; actual retarget needs anatomical visual acceptance.
3. Model every skinned garment **against the exact accepted base and its bind/rest pose**. Export top/bottom/shoes with skinIndex/skinWeight and **identical inverse bind transforms**, root origin and scale. Don't independently AI-rig each shirt. For each wardrobe item: `assetId`, `bodyProfileId`, `slot`, `assetUrl`, `hideBodyRegions`, `texture/material variants`, `qaStatus`.
4. Hair/headwear/accessory: preferably weight to Head/Spine or author a formally named attachment socket and a head-local origin. QA V1 currently only accepts skinned equipment meshes. Rigid/socket fitting remains a separate gate, never silently PASS.
5. Replace body regions underneath garments with hide masks/cuts or properly sized surfaces to avoid z-fighting and penetration. QA V1 has not yet implemented region masking.
6. Separate authoring meshes may be batched/merged by body region for iPhone once outfits are selected. Do not equate one big SkinnedMesh with a modular *authoring* source.

## QA upload flow

Open `/tools/animation-flow-qa-v2` on the modular work branch Preview; expand **Modular Character · 2 base GLB + equipment**. Choose `.glb` files from iPhone Files separately for female/male base and optional slots. Select **Nữ Modular QA** or **Nam Modular QA**.

- Files are read in memory by the browser; nothing is uploaded to Supabase/GitHub by this route.
- New base requires exactly one true SkinnedMesh, joint weights and core humanoid bones.
- Each garment must be a true skinned GLB; all required bone names and inverse bind matrices must match the base. Incompatible assets surface an error and **do not fallback to Grace/Boy and claim modular PASS**.
- Changing the base GLB reloads only the QA actor. Changing an equipment GLB updates the same actor/rig in place. SourceFlowEngine/beat/seed remain unmodified.
- Grace/Boy tabs remain reference controls and do not imply modular clothing.

## Gate checklist

A. **Base quality**: female and male face, silhouette, skin, hairline and innerwear owner-accepted in iPhone portrait. No poorly shaped blockouts accepted.
B. **Asset pipeline**: two bases + at least two interchangeable tops per base; shared skeleton, correct bind pose, true skinned GLBs, no torso clipping.
C. **Animation**: CMU vs the same two modular bases at 120 / 200 BPM, SPACE, 85_04, Flare, Breakdance/floor, dismount -> Recovery -> Idle -> dance. No independent clock.
D. **Performance**: 5 independent players, hardware iPhone Safari, load time, FPS/thermal, materials/draw calls and textures. None are automatically PASS from WebGL or build.
E. **Production gating**: owner approves art/QA before updating Character Catalog, starting Shop/Inventory DB work, removing migration fallback, changing published assets or merging.

Known caveats: independent Tripo/Meshy auto-rigs will likely FAIL the shared inverse bind check; Blender template skin-transfer is required. Pose deformation, body intersection and iPhone resource usage are not proven by simple GLB loading.
## Verified cloud QA (2026-10-22)

Vercel build on the dedicated branch and TypeScript PASS at commit a77ea8d. Browser smoke on 390x844 Chromium/WebGL: accepted Grace GLB supplied through the iPhone-style File API loads into the female modular QA tab, a copied same-template GLB attaches as an artificial top test, Boy GLB as a bottom is correctly rejected due to mismatched inverse bind matrix at hips, switching back to accepted Grace keeps working. After playback started, seed remained identical and beats rose continuously (5.12 → 6.62 → 8.02 → 9.94); 0 page errors. The copied GLB is **only a binding-path fixture, not a wearable shirt**. No new high-fidelity female/male body GLB or real modular garment has yet been delivered or visually accepted; no Breakdance contact acceptance. iPhone physical QA outstanding. Existing production actors and PR #19 are untouched.
