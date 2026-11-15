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

## Correction addendum — no world transform on detached bind rig
Detaching M3 garments from donor Skeleton and binding into canonical Skeleton
requires keeping the rig's world transform unchanged. A scaled parent still
applies to BOTH bone matrixWorld and garment matrixWorld, effectively double-
transforming detached-bound meshes. The 3D Creator now keeps M3 model in its
authored world space; camera target, distance and yaw orbit are computed from
actual Box3 bounds. Only stage decorations are scaled. This corrects the
root cause of "giant clothing" and makes skin/hair switching preserve alignment.
The body selector is the first navigation item and the initial open category.

## Creator UX follow-up — 2026-11-15
Physical iPhone feedback: female M3 creator renders correctly after bind-space/camera correction.
Owner requests creation-time customization, NOT an Inventory UI:
- Gender selector in Tạo hình must visibly indicate active gender; enlarged gender glyph inline with label.
- Exactly two source-verified elementary tops and two bottoms per M3 family:
  Drophunter: shirt, lightshirt / casualshorts, sportshorts.
  Neurohacker: logotee, simpleshirt / cargoshorts, shorts.
- Accessories: none in Character Creation, hide the accessory tab for M3.
- Shoes: single fixed basic starter: Drophunter sneakers, Neurohacker simpleshoes.
- The creator-only outfit (top/bottom IDs) is persisted in the optional
  `m3Outfit` property of existing CharacterCreationProfileV1 and local look
  presets. Old profiles without m3Outfit migrate to the matching rig default.
- Actor swaps only per garment slot, canonical skeleton stays; current visual
  gate requires owner physical iPhone test, NOT inferred from successful build.
- RoomState/MatchManifest/Waiting Room/Game remain unchanged. No Shop/Inventory
  implementation, no animation retarget, no changes on development/main.

## V1.3 Creator UX correction — 2026-11-15

Owner iPhone evidence: M3 outfit swapping visually works; however the gender icon+label buttons overflow in the half-width overlay, the overlay hides the actor during outfit selection, the 4 appearance slots are not appropriate for first-time creation and the imported rigs display a raw T-pose.

Scope and implementation:
- Refactor one shared creator options panel: existing legacy actor keeps its former overlay; M3 uses an **inline, compact, scrollable cockpit** in the lower creator dock. The preview stage remains entirely unobstructed. On M3 outfit tab, camera frames the complete actor.
- Gender selector uses two equal-width grid buttons, CSS active outline and stronger color contrast, with an inline glyph and label, no wrapping.
- Remove the four appearance-slot UI and its local state/actions. Existing profile V1 and already saved draft remain compatible; old look-presets storage is not deleted or migrated as Inventory.
- Keep the accepted M3 2-top/2-bottom choices, one pair of shoes per rig and no accessories.
- Static creator-only neutral pose: determine each upper arm/elbow/hand world direction from canonical M3 skeleton, rotate arms downward slightly outward and the forearms gently forward. Do this **after** canonical garment assembly; no 3D actor reload, extra AnimationMixer, or gameplay timing. The rest pose is never rewritten in asset binaries.
- Add creator UI QA selectors and focus/aria state, maintain scoped iPhone no-page-scroll behavior.
- No new marketplace, Inventory, Waiting Room, Gameplay or PR19 animation changes.

Validation required: Next.js TypeScript/production build and READY commit-specific Vercel preview; owner physical iPhone to verify neutral-arm pose with both genders and in-place garment changes, especially hands/shoulders/clipping. The design quality target is premium rhythm-game presentation; avoid representing this as a certified AAA production art pass.

## V1.4 iPhone UX feedback — 2026-11-15

Owner feedback on V1.3 physically tested:
- Left navigation shifts upward, overlaps the Back button whenever the bottom creator dock is expanded.
- Hair option cards are cropped vertically at the bottom of their scroll panel and the UX looks unfinished.
- Remove the "Xoay nhân vật / Drag to rotate" icon/text entirely.
- Invert left/right dragging so the character's perceived direction follows the touch.

Root causes and focused correction:
- `.rail.m3Rail` previously used `top:15%` relative to `.hero`, which shrinks when a dock panel expands. Set a fixed *safe top clearance* referenced to the fixed Back button position and dynamically cap rail height to remaining hero space. Four-item M3 rail remains accessible in portrait.
- Hair used a 2×2 grid in a max-height constrained vertical scroller. Convert **only the M3 hair choices** to a single horizontally scroll-snapped row with a 'VUỐT NGANG' affordance, a partial next card, and hidden scrollbar. Keep gender/skin, outfit and shoes controls compact; retain overflow-y for unusually short screens.
- Remove rotation coach-mark JSX. No changes to actual drag/touch capability.
- M3 uses orbit camera rather than rotating the detached-bind rig. Reverse the sign of the pointer delta **only for M3**. Preserve legacy C1/C4 GLB rotation direction. The M3 skeleton, one-base assembly, hair/skin outfit swapping and neutral pose stay unchanged.
- Preserve single saved CharacterCreationProfile V1; no Waiting Room/Game/PR19 work.

Validation gate: Next.js + TypeScript, Vercel READY and HTTP 200 for deployed commit. Actual rail clearance, horizontal hair swipe and drag direction require owner physical iPhone confirmation. No AAA visual PASS before that.

## V1.5 follow-up — 2026-11-15 iPhone contrast and gender control

Owner confirmed V1.4 navigation/hair UI is improved. Remaining visual feedback:
- Gender symbol and label still visually off-center on both axes.
- Dark skin + dark hair/clothes disappear against the nearly black creator backdrop.

Changes (creator only):
- Replace platform-dependent Unicode gender glyphs with two same-sized 24x24 SVG symbols.
- Center the glyph+label together in a single inline-flex group inside a CSS grid button, preserving aria-pressed/active styling and the selected-rig behavior.
- Add a lightweight 256x512 screen-space lavender/violet CanvasTexture backdrop for the M3 preview, with a brighter, soft central halo for silhouette contrast. This changes the *background*, never the character skin material or texture.
- Add neutral 3-point lighting with a forward fill for dark materials and soft rim for contours, without modifying any M3 source geometry/material or the locked pose/bind architecture. Legacy C1/C4 preview lighting/backdrop stays unchanged.
- Dispose the GPU backdrop texture with preview teardown. No extra render loop or character rebuild.

Required focused validation: Next.js TypeScript/build; Vercel commit deployment READY; HTTP 200. Physical iPhone check for light + deep skin tones, black hair and dark clothing without overexposing pale skin, and SVG button centering. This is not a final mobile visual acceptance until owner confirms.

## V1.6 item-only thumbnails in the M3 creator — 2026-11-15

Owner approved V1.5 Character Creation and explicitly requests thumbnail images
on the corresponding hair, top, bottom and simple-shoes item cells.

Discovery: BOTH source M3 manifests contain an item thumbnail field and, for
textured garments, thumbnailOverrides. We verified the actual PNG content
through GitHub for representative hair, shirts, shorts and shoes and verified
all 18 exact source paths against the complete upstream file tree. The images
are **item-only** renders on transparent backgrounds — NOT full-actor photos,
not composited mannequins and not artificially created garment mockups.

Implementation:
- Add `m3-creator-thumbnails.ts` with a curated, explicit per-rig hair
  thumbnail lookup and an encoder for upstream filenames with spaces.
- Add a `thumbnail` field to each of the 10 existing `M3CreatorGarment`
  catalogue records (4 tops, 4 bottoms and 2 fixed shoes). Images correspond
  to **exact** matching VRM garment IDs from manifest, not a search by name.
- In CharacterCreationV1, render source-backed item-only images inside M3
  hair choices, garment choices and fixed shoes display. Preserve item
  selected state, aria-pressed, labels, the horizontal hair swipe and existing
  two-top/two-bottom layout. Legacy C1/C4 cards retain icon-only presentation.
- Source `raw.githubusercontent.com` PNGs are loaded as plain images with
  lazy loading, async decode and no additional WebGL context. An error produces
  a neutral placeholder, not an invented garment thumbnail.
- Light item-card backing distinguishes dark and white source PNGs; selected
  item retains visible accent border and checkmark.
- Keep the existing one-skeleton/one-actor runtime unchanged. No Shop,
  Inventory, Creator profile schema migration, RoomState, gameplay or PR19 work.

**Accuracy note:** Thumbnail imagery is the source icon variant (and some hair
icons are red); it represents the **item silhouette**, not necessarily the
actor's current material/color variant. The true equipped color and skin are
shown on the main M3 3D preview. Avoid suggesting a color variant exists
if M3 runtime cannot actually equip it.

Licensing: no source PNGs are redistributed in the repo, only referenced from
the existing source CDN/origin; separate commercial distribution rights will
be reviewed before public product release.

Validation: source images 18/18 verified, Next.js/TypeScript build, Vercel
READY + /character/create HTTP 200. Physical iPhone test needed to approve
thumbnail clarity, lazy loading and selection UX. No full E2E or iPhone visual
claim from a build alone.
