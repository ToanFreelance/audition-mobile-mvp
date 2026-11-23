# M3 Gameplay Step 3 — Initial Retarget Adapter / QA V1

Date: 2026-11-22

Branch: `work/m3-gameplay-integration-step3-v1`, based on accepted Auth V1 QA head `3caa81ceaba7b78db907d44c8a19454c9970fef0`. **This is an isolated work branch; PR #29 remains Draft and is not merged.** No changes to `main` or `development`.

## Root cause and verified architecture

Gameplay uses `CharacterActor` and `CharacterAnimationController`, with canonical `Idle`, `HumanDance01–08`, `HumanMiss`, `HumanFinish`, `HumanFinalDance*` clips. Controller's beat-critical event times come from the supplied audio song-time argument. Existing M3 Waiting Room uses `M3CharacterAssembler` and the separate approved V15 Mixamo Idle library, but no M3 gameplay-compatible Quaternius clip baking or `CharacterPresentation` adapter.

M3 `runtimeReady=false` is intentionally locked: changing it without the retarget, floor/Finish visual QA and frozen multiplayer preload would allow incorrect gameplay. Do **not** change it to test this preview.

## V1 implementation

- `m3-gameplay-retarget.ts`: 22 explicit source Quaternius→M3 bone pairs for both Drophunter and Neurohacker. Rigs are checked by their canonical bone names, no gender/participant-name inference. Bake sample curves at 30 FPS: world-space rest delta, anatomical orientation alignment, target bind quaternion, target local rotations. Hemisphere continuity across frames. No stage root translation is produced, to avoid taking ownership of global movement or changing the authoritative timeline.
- `M3GameplayQaActor`: implements `CharacterPresentation`, composes the exact accepted M3 outfit/eyes/skin/hair from `M3CharacterAssembler`, loads the existing Quaternius source, publishes canonical clip names and uses the **existing** `CharacterAnimationController` for song-time-sampled actions. Any animation/source error is visible and fails closed rather than falling back to an unrelated female character. Renders a separate actor/AnimationMixer, not the Waiting Room mixer.
- `/tools/m3-gameplay-step3`: **isolated QA route** with an AudioContext-based preview song clock, male/female tabs and buttons Dance01, Dance08, Miss, Finish. No song/chart/RoomState/START, score, gauge or replacement global timeline. Standalone preview floor, not accepted gameplay Stage3D.
- `e2e/m3-gameplay-step3.spec.ts`: synthetic rest/bind quaternion retarget determinism and clip-controller timing tests, malformed rigs, `runtimeReady` guard.

## Known limitations / non-acceptance

- This is **first working adapter**, not owner-approved choreographic quality. No proof of physically accurate planted feet, pelvis root motion, realistic elbow/hand arcs, cinematic Finish, clip variety, or end-to-end 4-beat scheduling on iPhone.
- World-space bone rotations alone are a basis for visual QA, not a substitute for validated skeleton-specific IK / contact solving. Root translation intentionally omitted. **Do not fix this using magic timing offsets.**
- Early QA may use fallback Quaternius actions if published release is unavailable; it cannot establish final authored choreography. Frozen release identity/hashes need to be bound in a future version before real multiplayer preload.
- Current `Stage3D` and live gameplay still use accepted legacy actor; no production M3 runtime is enabled. `LiveMultiplayerGameplay` cannot yet accept a real M3 Stage3D actor. Avoid claiming gameplay integration complete.
- Multi-human Supabase LOADED/CAS/shared-epoch, iPhone animation visual QA, cross-device effects and C01 audio tests still open.
- Keep `MatchManifest` avatar identity+look from prior Auth work; do not mix this QA into RoomState or change WebAudio authority, gauge, sequenceCounts, Finish/ AUDIO END.

## iPhone owner checks

1. Open preview route `/tools/m3-gameplay-step3`; choose female; wait for retarget clip names and ready status. If source fails, provide screenshot of visible error.
2. START QA AUDIOCONTEXT (not Host START) → Dance01 → Dance08 → Miss → Finish L9. Watch both feet for sliding/hover, forearms for self-intersection, clothing rig/bind, head orientation, Finish through its clip duration.
3. Change to male and repeat. Compare with the character's accepted Waiting Room standing appearance.
4. Report per-clip PASS / FAIL. DO NOT equate clean build with accepted motion.
5. Once owner accepts retarget visual quality, next Step 3 pass is separate `Stage3D` actor factory + frozen MatchManifest presentation, preloading/LOADED and 2-human shared WebAudio QA; only then consider `runtimeReady=true`.

## Report constraints

Implementation+minimal validation only initially. Do not merge auth PR #29, work branch or development. Do not claim released gameplay is playable because QA buttons animate.


## V1.0.1 — owner iPhone garment explosion regression (2026-11-22)

Owner tested the Step 3 preview on iPhone: in both M3 rigs, shorts/shoes appeared enormous and offset above/beside the body. This **is 3D skinned mesh breakage**, not avatar thumbnails or bad selected apparel. Code audit traced two invalid transforms:
- `M3GameplayQaActor.load` scaled the ancestor QA root by `3.85 / height`.
- `/tools/m3-gameplay-step3` then translated that ancestor to floor-center.
Both operations violated the *accepted M3 Creator V1.4 rule*: detached SkinnedMesh bindings must keep the canonical bind-space hierarchy in authored coordinates. Waiting Room correctly converts its cloned M3 actor bindings to `attached` before scaling for formation; Step 3 QA did not, and should not mutate the accepted VRM/skeleton or Waiting Room setup.

**Focused fix:** Keep the QA actor root identity (scale 1, position 0, zero Euler) and VRM child unchanged. Camera FOV/framing instead adapts to measured native world bounds. Only separate floor/grid decorations are scaled/moved. New pure `frameM3GameplayQaCamera` guard asserts actor's world matrix was not touched; synthetic scene regression verifies the actor and all garment nodes retain their world matrices. No changes to animation retarget, M3 assembler or Stage3D game. Real iPhone QA must confirm *both* sex rigs and actual clothes after reload and after Dance/Miss/Finish; unit tests and build are not 3D visual acceptance.

Preview branch origin stays identical (Cache Storage origin preserved).

## V1.0.2 — complete isolated animation QA controls (2026-11-22)

With the native bind-space garment fix in place, Step 3's isolated preview now offers every canonical gameplay dance action **Dance 01–08**, plus **Miss** and **Finish L9** for both Drophunter and Neurohacker. The QA click goes through the existing `CharacterPresentationEvent` and `CharacterAnimationController`, and a rejected event now shows an error instead of displaying a false positive. A focused synthetic regression dispatches all eight dances and checks the selected clip and AudioContext song-time sample.

**Owner iPhone visual gate (still required):** on the same stable Step 3 Preview URL, verify both M3 rigs after page reload; play each Dance 01–08, Miss, and Finish. Inspect outfit attachment through motion, planted feet / sliding, hand-body or garment intersections, motion heading, and Finish continuity. Check actual animation source label: fallback choreography cannot be accepted as the published dance release.

This is only a QA-tool expansion. **Do not** set M3 `runtimeReady=true`, modify `Stage3D`, enable real Host START, replace Waiting Room animation, or claim visual approval from synthetic tests. Proceed to Stage3D actor factory / frozen manifest / preload-LOADED integration only after the owner approves the iPhone choreography gate.

## V1.0.3 — portrait full-body framing and sticky preview (2026-11-22)

Owner's physical iPhone screenshot of V1.0.2 showed the female rig visibly offset toward the right and both feet cropped; owner also reports the same issue on the male rig. The clothes themselves are no longer enlarged, but the view cannot establish foot-contact acceptance.

**Root cause:** the camera used `Box3.setFromObject(actor.root)` for the center and height, including detached M3 `SkinnedMesh` garment extents. Those geometry bounds are not dependable anchors for this rig. The resize callback also changed only `camera.aspect`, without re-fitting the camera when the Safari viewport changed.

**Focused correction:** frame from the canonical M3 skeleton's `hips`, `head`, bilateral `hand`, `foot` and `toes` landmarks; reserve explicit crown/shoe/ground margins and symmetric dance-arm space; fit horizontal and vertical FOV per current aspect. The floor/grid are independent frozen decorations, positioned just below the resting toe joints. Capture one initial neutral skeleton pose as the immutable QA frame reference; subsequent Safari viewport changes re-fit the camera against that snapshot, never sampling a dancing foot or shifting the floor. Neither the actor nor its SkinnedMesh/skeleton parents are scaled or translated. A synthetic off-center rig plus deliberately offset garment checks joint centering, portrait head/toe NDC visibility, repeated viewport resizing and unchanged world matrices.

**QA UX:** sex selector, preview and status now live in a sticky group for scrolling down through ten actions. Preview height is mobile viewport responsive (`clamp(230px, 40dvh, 440px)`) instead of the previous tall `3 / 4` box. The preview continues rendering during interactions; it is not remounted by ordinary button clicks.

**Owner visual gate remains OPEN:** on the stable branch URL verify complete head–shoes visibility and contact with ground on both rigs, reload and switch sex, scroll and use Dance 01–08 / Miss / Finish without losing the preview. Watch for animation-specific clipping and floating feet. Vercel READY and synthetic tests do not prove owner iPhone acceptance. Do not change `runtimeReady`, gameplay Stage3D, MatchManifest, Waiting Room or WebAudio.

## V1.0.4 — actual rendered silhouette camera calibration (2026-11-22)

The owner retested V1.0.3 on a physical iPhone and confirmed **both** Drophunter and Neurohacker still render shifted toward the right and crop their shoes. The static skeleton-axis prediction was therefore not sufficient for display framing; do not claim the prior skeleton-based fix was accepted.

The Step 3 *isolated QA* camera now makes a one-time, low-resolution offscreen RGBA render of the actual dressed M3 actor at a safe zoomed-out distance, with floor/grid and background hidden only during capture. Nontransparent actor pixels give the final visible silhouette in screen space, including detached/offset skinned geometry. Their bounds are converted into one frozen camera-space world framing reference. The camera fits this silhouette with head/feet margins and recomputes from the same reference on Safari viewport resize—never from dancing bones. No skeleton / clothing / global actor transform changes. A fail-closed readable error is shown if framebuffer capture is blank, fully opaque or clipped. A synthetic test forces visible geometry to the right/bottom despite centered skeleton and checks world-centering, portrait resize, and invalid-buffer handling.

Owner physical iPhone QA is required again for both genders and both idle/action poses. WebGL offscreen capture behavior is device-dependent and the synthetic test does not replace Safari pixel validation. Do not unlock M3 runtime or merge.

## V1.0.5 — physical iPhone persistent right-shift: CSS pixel size vs DPR (2026-11-23)

Owner's fourth physical iPhone screenshot again shows a `~134 px` rightward shift and missing shoes, despite the previous camera/silhouette adjustments. Root cause traced to a **canvas CSS sizing bug**, rather than an actor offset: Step 3 created a WebGLRenderer with `renderer.setPixelRatio(Math.min(1.4, devicePixelRatio))`, then called `renderer.setSize(width, height, false)` without ever setting CSS dimensions on `renderer.domElement`. With `updateStyle=false`, its backing-store `width/height` attributes (1.4× the host) became its **intrinsic CSS dimensions**. The preview container used `overflow: hidden`, hiding the right/bottom of the canvas. For a ~670 CSS-pixel preview width, the intrinsic ~938 CSS-pixel canvas has its visual center at ~469 rather than ~335; **the measured +134px matches the owner's screenshot**. Offscreen silhouette measurements and camera fitting cannot correct this downstream CSS cropping.

**Focused correction** on the QA-only route: set canvas `display:block; width:100%; height:100%` before inserting it into the preview, while retaining the independently configured high-DPR WebGL backing resolution and `setSize(..., false)`. This follows the accepted Character Creator's existing `styles.canvas` CSS rule. Add a real Chromium mobile viewport (390×844, DPR 3) regression that asserts displayed canvas CSS dimensions equal the preview's DOM box even though backing dimensions are >1.2×. The earlier camera-only/skeleton safeguards remain unchanged.

**Secondary lifecycle ordering fix:** the Step 3 actor now executes `CharacterAnimationController.update(0, 0)` before `load()` returns so the Idle quaternion frame is actually applied before any silhouette/camera reference is captured; creating/playing an action does not by itself evaluate the skeleton. This does not start audio or alter gameplay. A synthetic controller test demonstrates the pre-/post-`update(0,0)` difference.

Owner iPhone visual gate **OPEN**: confirm centered full-body view and visible soles/floor on Drophunter and Neurohacker after reload; only after that inspect Dance 01–08 / Miss / Finish motion and sticky behavior. A Vercel build or Chromium simulation is not iPhone visual acceptance. No M3 `runtimeReady` change, MatchManifest change, or merge.

## V1.0.6 — owner-approved center/feet; tall portrait QA and automatic clip review (2026-11-23)

**Owner iPhone acceptance update:** V1.0.5 now shows the Drophunter centered with both shoes fully visible. The owner requests a **taller and narrower sticky QA viewport** for magnifying the character, a narrower action panel, and a checkbox to play all ten available actions sequentially for screen-recorded review. This is not final gameplay motion acceptance.

**Scoped implementation:** Step 3 QA preview uses `width: min(94%, 400px)` (sticky centered) and `height: clamp(390px, 62dvh, 640px)`; start, 2-column action grid and auto-review controls share the compact width. Frame/viewport recalculation remains camera-only; the DPR canvas CSS fix is retained. Video-friendly overlay shows current automatic action and its 1/10 through 10/10 progress.

**Hands-free QA:** Checkbox "Tự động play 10 động tác theo thứ tự". If checked before START QA AUDIOCONTEXT, starts at the first audio-clock frame; if checked after START, starts immediately. Order: Dance 01–08, Miss, Finish L9. The next action starts after **the selected controller clip's actual duration**, plus a 350 ms *QA-only visual separation* (not a gameplay turn). No independent timer, replacement WebAudio clock, global turn, or game-end; sequencing is advanced by the existing render loop using `AudioContext.currentTime`. After the last complete clip it stops and offers "Phát lại toàn bộ 10 động tác". Manual action cancels auto; uncheck cancels auto; changing rig cancels auto. The checkbox remains selected across rig changes, so pressing START on the new rig begins a fresh full sequence. All source/action errors fail visibly.

**Validation/acceptance:** Targeted Chromium mobile DPR3 layout checkbox regression and existing retarget regression are included in the existing isolated QA workflow. Vercel build status does not prove physical iPhone motion fidelity. Owner should record the **full female and male sequence separately**; look for hovering/sliding feet, mesh intersections, unnatural headings, inconsistent motion duration and FinalDance/Finish continuity. Remain on this work branch, no merge, no change to M3 runtime readiness, Waiting Room, Stage3D, RoomState, gauge or WebAudio scheduling authority.

## V1.0.7 — owner iPhone black-screen on auto-play (2026-11-23)

Owner iPhone V1.0.6 screenshot: after checking auto-play, the preview is entirely dark (both M3 and floor/grid absent) while the WebAudio status advances and `AUTO · 1/10 · Dance 01` remains visible. This points to loss of the canvas DOM attachment, **not a gameplay animation/root-motion issue**.

**Root cause:** V1.0.6 introduced a React-controlled conditional progress child `{autoStatus && <div>...}` directly into the same `<div ref={mountRef}>` that Three.js mutates using `element.appendChild(renderer.domElement)`. The empty string / element transition can reset that host's text content during React reconciliation, deleting the imperative WebGL canvas while AudioContext and the RAF loop continue. This boundary violation was not caught by the prior checkbox-only test, which did not actually START auto-play.

**Focused fix:** Keep `m3-gameplay-render-target` as a completely React-empty DOM node owned exclusively by the Three.js renderer; put the React-controlled auto-progress overlay in a **sibling** absolutely positioned inside the unchanged parent `m3-gameplay-preview`. No change to camera calibration, CSS DPR sizing, VRM skinning, action sequencing, animation clock, or viewport dimensions.

**Regression:** an isolated browser QA test waits for M3 ready, checks auto-play, starts AudioContext, waits for `Dance 01` progress, asserts the **original canvas DOM element** remains connected under the Three.js render-target, and checks unchecking auto-play does not remove it. Include both headless browser checks and owner iPhone QA before marking visual acceptance. Work branch only; no runtimeReady/Stage3D/RoomState/Waiting Room or merge changes.

## Step 3.1 — QA-gated real Stage3D integration (2026-11-23)

- Each human client must open its existing /rooms/<roomId>?m3GameplayQa=1 URL on the stable M3 work-branch Preview hostname (or localhost). Production and URLs without the query remain blocked. Owner must manually opt in on both devices before Host START.
- Host START validates frozen avatars and M3 outfits. MatchManifest characterRuntimeVersion records an explicit QA marker; preloading/LOADED on every device checks the same frozen marker and its local opt-in. RoomState CAS, Supabase Realtime, shared epoch, WebAudio and global turns are untouched.
- Preload consumes every distinct M3 body/eyes/hair/top/bottom/shoes/skin file and the retarget source before LOADED. Missing M3 files fail closed; legacy C1/C4 fallback behavior is retained. Cached bytes are reused by the accepted M3CharacterAssembler in Stage3D.
- Stage3D loads the M3 actor/CharacterAnimationController during shared countdown with frozen appearance and frozen published animation release. Native detached bind-space stays at identity; no actor root scaling/translation, extra mixer on roster metadata, or parallel clock.
- OPEN: physical iPhone Stage3D camera/garment acceptance, full 2-human Supabase/CAS/LOADED/song-time sync, and heavy actor parse performance. Preloading validates byte readiness, not full GPU parsing; the stage curtain requires complete actor preparation. Clothing intersections and Dance V2 are deferred. Catalog runtimeReady remains false. No merge.

## Step 3.1.1 — QA Host START server gate correction (2026-11-23)

Owner iPhone Safari test: the M3 Waiting Room opt-in unblocked the client START button, but the server `start-preload` branch still called `roomContainsNonPlayableCharacter` without the QA flag, rejecting M3 before PRELOADING. The frontend converted that API error to a generic "Không thể xác minh START" overlay. Retrying Realtime synchronization could not fix the deterministic refusal.

Focused fix: the server now checks the actual request hostname, the explicit frozen Step 3.1 `characterRuntimeVersion` marker, and authoritative RoomState participant identity/Character Catalog IDs/validated M3 wardrobe against the immutable MatchManifest. The match may start only on the isolated M3 work-branch Preview or localhost; production, missing-marker clients, malformed and mismatched wardrobes remain blocked. The POST /api/multiplayer/room request does not inherit the room page's URL query. Client errors now show the actual failure reason during recovery.

No changes to RoomState CAS, Supabase Realtime, preload/LOADED protocol, shared epoch, WebAudio clock, Character Catalog `runtimeReady`, gameplay, or Dance V2. The focused CI covers accepted solo/duo matches and locked rejection paths. Physical owner iPhone and 2-human multiplayer acceptance still required.
