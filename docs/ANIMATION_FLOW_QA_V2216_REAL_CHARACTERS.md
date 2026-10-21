# Animation Flow V2.2.16 — Real Character QA V1 / Accepted Rigs

Repository ToanFreelance/audition-mobile-mvp
Work branch work/animation-flow-qa-v2, PR #19 Draft/unmerged, base development.
Baseline HEAD 4bfa5a284c2c7aa67c4e3e3564e221823b7c1cb3.

## Owner decision 2026-10-21

TripoAI free generation/export/rigging is unavailable for the new proposed models. Owner explicitly elects to TEMPORARILY USE the two accepted runtime characters:
- c1-casual-grace (Casual Grace)
- c4-casual-boy (Casual Boy)
No third-party purchase, newly generated asset, new project or Character Catalog production modification is authorized.

## Verified root cause

The QA tool formerly displayed canonical CMU skeleton using SourceFlowEngine for `view=source`, but switching its existing Female/Male reference buttons created a **different CharacterActor** and loaded the production Quaternius/published animation pool with a distinct AnimationMixer and choreography. It even skipped the canonical SPACE/Finish selection path when the character was visible. A green animation on the reference actor did not validate the CMU→Mixamo retarget at all.

## Focused change

1. Add `lib/animation-flow-v2/live-character-retarget.ts`, a QA-only live CMU→Mixamo anatomical world-delta adapter. Load the original catalog asset URLs using GLTFLoader, require an ACTUAL SkinnedMesh (never report fallback PASS), normalize display size, preserve the model's skin weights, material, face and texture. Rig selection maps CMU canonical joint names to the matching semantic Mixamo bones; quaternion deltas are aligned in anatomical rest spaces and converted into target bone-local rotations in parent-first order. `SourceFlowEngine` alone samples pose and owns root translation, fade and global beat, while the adapter updates the skinned GLB every rendered frame. This is not the existing Quaternius→Mixamo production clip baker.
2. Replace old `CharacterActor` independent reference playback on QA tabs with `Skeleton / Grace CMU→Mesh / Boy CMU→Mesh`. Switching views never calls resetRun, never creates new command, never changes bpm, seed, gauge, clock, or Finish. The isolated Dance Catalog remains source-only.
3. Stop gating `SessionChoreography.select/update()` on `view=source`. The same engine must receive every accepted SPACE, HIDDEN, Finish, recovery, REST and next dance regardless of the visible mesh.
4. Finish picker and independent Finish replay preserve the currently selected character view, rather than silently snapping back to source skeleton. Compare same active phrase/time across Skeleton and both mesh views.
5. Expose status showing actual GLB retarget (not published controller), mapped bone count, triangles and skinned mesh count, and record QA-only retarget path in telemetry export. No production/Character Catalog mutation.
6. If GLB missing, lacks SkinnedMesh or required human joints, surface a prominent error and show the canonical skeleton; never insert procedural fallback and label it PASS.

## Acceptance gates and known risks

This FIRST-PASS live adapter is not a fully QA-approved production retarget profile:
- Check knees/elbows/shoulder bends and rest-basis anatomical direction; rotation mapping alone may need arm-plane IK/stance adjustment for extreme breakdance.
- Check root placement, floor grounding/contact, knee inversion at 85_04, crossfade visual, foot sliding and camera size on owner iPhone.
- Verify performance and memory of *each* accepted model on 200 BPM. Switching actors destroys the old model; no mixer or refetch on ordinary SPACE.
- Playwright smoke (when runner available) requires the actual GLTF skin, switching without beat reset, preserved view when selecting/replaying 85_04. Three source conditions are not proven merely by Vercel TypeScript build.
- The working real-character renderer must remain isolated to /tools/animation-flow-qa-v2. Do not modify/merge production Character Catalog, accepted character assets, MultiplayerGameplayRuntime, RoomState, Supabase, stage, WebAudio authoritative clock, 4beats/turn, sequenceCounts, gauge or Flare.
- PR19 stays Draft/unmerged pending owner visual acceptance on iPhone.
