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
