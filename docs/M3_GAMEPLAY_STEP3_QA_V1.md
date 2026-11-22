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
