# Audition Mobile MVP — Mixamo FBX → M3 Pilot (offline, 2026-11-19)

**Pilot only: NOT yet integrated into Waiting Room, NOT approved on iPhone.**

Existing repo: `ToanFreelance/audition-mobile-mvp`; source work-branch baseline `7035b5d00ac32f8280d34206ba4588c5cd253f5b`. This archive contains only **converted clip data and QA tools**; it does NOT contain the owner's original Adobe Mixamo FBX or M3 rig files. The converted quaternion tracks are supplied to the owner for private review only. Do not push them as individually downloadable animation files to a public repository.

## Implemented source / destination pairs

| Clip | Mixamo file | Target rig | Type | Duration |
|---|---|---|---|---:|
| breathing-idle-2__drophunter | Breathing Idle 2.fbx | Drophunter female | Base idle | 9.97 s |
| breathing-idle-2__neurohacker | Breathing Idle 2.fbx | Neurohacker male | Base idle | 9.97 s |
| warrior-idle__neurohacker | Warrior Idle.fbx | Neurohacker male | Character idle | 11.50 s |
| blow-a-kiss__drophunter | Blow A Kiss.fbx | Drophunter female | One-shot emote | 4.60 s |

FBX input is animation-only, 65 Mixamo skeleton bones, 30 Hz. Direct binary FBX parser handles FBX PreRotation, animated XYZ Euler curves, source hierarchy and centimeter→meter. Retargeting applies source *world-space rotation deltas from rest* to original Drophunter (198 bones) / Neurohacker (102 bones) world-rest skeletons, then converts to local M3 quaternions. 53 tracks include hips translation, upper/lower arms, legs, hands, torso, head and fingers. Final clips preserve Mixamo keyframe timing and are sampled at 30 Hz.

## Reproduce conversion

Requires Python 3.11+ with `numpy`, `scipy` and (only for optional simple skeleton video) `opencv-python`.

```bash
python retarget_mixamo.py --source '/private/mixamo/Breathing Idle 2.fbx' \
  --target '/private/m3-cache/drophunter/body/drophunter.vrm' \
  --output ./converted --clip-id breathing-idle-2__drophunter \
  --rig-family drophunter

python validate_mixamo_pilot.py converted/*.json
```

The output `JSON` follows the existing `BakedMotion` data structure (`fps`, `lastFrame`, `sourceFrameCount`, `tracks`), but **is not committed or loaded by runtime** until owner visual approval. For pilot inspection, four videos show the *actual rigged M3 mesh* CPU-skinned from the downloaded VRM character assets using original bind matrices. The videos are rendered at **12 FPS** for inspection; underlying animation data is 30 FPS. They are **not** a WebGL/iPhone performance test.

## Visual observations and remaining risks

- Breathing looks natural at front/side in the exported M3 mesh, but ankle horizontal path length is ~8–11 cm over ~10 seconds. Small accumulated foot motion needs review before claiming foot-lock.
- Warrior Idle retains dramatic arm extension. Max angular step is **17.02° per 30 Hz frame**, above the 12° threshold used by older Blender idle QA. Do not suppress this finding or silently smooth source timing.
- Blow A Kiss retains a hand-to-mouth gesture on female M3; final hand/face and fingers need owner iPhone inspection.
- All generated quaternions are unit/continuous. This is a structural gate, **not a visual/transition gate**.
- Motion start/end poses may match but **transition velocity** is not automatically C1 continuous. Random scheduler should use base-loop idle primarily; insert one-shot emotes only after a safe bridge or pose-matched transition and return to base idle.
- Five-person Waiting Room, real Ready/Not Ready/Realtime, GPU frame rate, collision with wardrobe variants, and mobile Safari were **not tested** in this offline pilot.

## Intended next gated integration (only after visual approval)

Add the chosen private converted clips into a game-bundled, non-redistributable runtime asset container; avoid distributing standalone animation JSON from public GitHub. In the isolated M3 QA route, load a `mixamo-pilot` profile using the existing Character Catalog → rig family, reuse `AnimationMixer` and the current shuffle-bag; configure `Breathing Idle 2` as base idle and `Blow A Kiss` as rare female one-shot emote. `Warrior Idle` is an optional male character idle. Preserve RoomState/CAS/Realtime and WebAudio authoritative timing. Do not replace accepted Waiting Room animation until owner acceptance.

## Provenance and license

Source FBX were provided by the owner, sourced from Adobe Mixamo. Adobe documents royalty-free use of animations in games, but *separate redistribution of raw animation files is restricted*. Keep Mixamo source FBX and raw/retargeted keyframes outside public repositories and public asset-pack downloads. See https://helpx.adobe.com/creative-cloud/faq/mixamo-faq.html and Adobe Community FAQ on raw redistribution.