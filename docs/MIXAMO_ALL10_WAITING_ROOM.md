# Mixamo All 10 Waiting Room — isolated QA integration

**Scope:** Owner provided 10 animation-only Mixamo FBX files. Converted 17 source/target-rig variants at 30 FPS (9 Drophunter female, 8 Neurohacker male), then embedded 16-bit quantized, gzip-packed clips into game-only dynamically loaded code modules. No original FBX, independent JSON, or public downloadable animation pack is committed. Full data originals stay in the owner's private deliverable. `?mixamo=1` explicitly enables this experimental player only inside `/tools/lobby-qa-sketch`. Main Waiting Room and old M3 V1.9.3 playback remain unchanged.

## QA routes

- 5 actors: `/tools/lobby-qa-sketch?m3=five&allM3=1&mixamo=1`
- female: `/tools/lobby-qa-sketch?m3=female&mixamo=1`
- male: `/tools/lobby-qa-sketch?m3=male&mixamo=1`
- old baseline: `/tools/lobby-qa-sketch?m3=five&allM3=1` (omit `mixamo`)

Only the existing Character Catalog decides the rig. `mixamo=1` is ignored outside QA route. Each avatar holds its own `AnimationMixer` and seeded bag; REST/READY/connection status do not recreate actors. Actor transform stays fixed; hips-only motion is inside the character skeleton. Existing roster/CAS/Realtime/WebAudio/gameplay architecture is untouched.

## Eligibility and playback

| Source clip | Female | Male | Mode |
|---|---|---|---|
| Breathing Idle 2 | yes | yes | base loop |
| Bored | yes | yes | base loop |
| Dwarf Idle | yes | yes | base loop |
| Dwarf Idle 2 | yes | yes | base loop |
| Warrior Idle | no | yes | base loop |
| Sad Idle | yes | yes | rare emote |
| Waving | yes | yes | rare emote |
| Pointing | yes | yes | rare emote |
| Blow A Kiss | yes | no | rare emote |
| Catwalk Twist L To Twist R | manual QA only | no | no automatic loop: source has nonzero rotation/root delta |

Four base gestures and the male Warrior are selected via a deterministic shuffle-bag avoiding the most recent clip and, when possible, a simultaneously occupied clip. After two additional base plays an emote is selected (then returns to the last base), not a continuous emote loop. Manual clip selection and 0.25× playback are exposed in the QA controls. Clip actions share the actor's mixer, with 0.4–0.55 s quaternion crossfade, not an authored full-body pose-to-pose transition planner. Crossfade quality and feet contacts **require owner iPhone visual QA**.

## Source, encoding and limitations

The code uses the owner-supplied Mixamo 65-bone FBX skeletal curves; source local PreRotation is handled by the offline importer. M3 destinations use the original Drophunter/Neurohacker VRM rest skeletons (not one shared skeleton). All motion frames are retained at 30 Hz; each quaternion component is quantized to signed 16-bit (-32767..32767) and hips offsets to 0.1 mm units, then gzip-compressed for browser loading. Browser code decodes using `DecompressionStream('gzip')` once and retains clip arrays, and only on the experimental route; the loader does not make any separate public FBX/JSON network request.

These are not perfect motion retargets. Position-only origin anchoring does **not** prove foot locking; root lateral motion, crotch mesh penetrations and hands near the face still need inspection. `Waving` is extremely short and should not be continuously repeated. `Catwalk Twist` is intentionally excluded from autoplay because pose/heading do not form a seamless loop. There is no real host/guest Supabase sync QA, no iPhone Safari test, no owner visual sign-off. CI browser screenshots are synthetic QA-room evidence, not evidence of source-fidelity acceptance.

## Validate

The repo keeps source converter and validator: `scripts/m3-idle/mixamo_retarget_pilot.py`, `scripts/m3-idle/validate_mixamo_pilot.py`; originals and VRMs are not committed. Specific CI uses Playwright real mesh route `e2e/mixamo-lobby-all10.spec.ts`. Acceptance gates: all 17 variants select, 5 actors render, stable actor/mixer identity, random across both families; owner inspects foot slides/transitions on iPhone before production enablement.

**Branch:** `work/m3-waiting-room-integration-v1`. Never merge without owner approval.