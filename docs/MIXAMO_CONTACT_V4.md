# Mixamo Waiting Room V4 — contact-aware transition pilot

## Scope / owner finding

The 2026-11-20 owner iPhone clip `Video-test(20261120-141243).mp4` still shows unwanted shoe sliding, especially during changes in body weight/pose. Foot Lock V2 made the knees/leg posture unnatural and remains rejected as a default. V3's small source-derived pelvis correction is available for **Bored only**, gated by `pelvisFix=1`, and does not assert full shoe-contact correctness.

This V4 is an **isolated QA improvement**, not a claim that all Mixamo clips are now foot-slide-free. It does not change the production Waiting Room, M3 V1.9.3 playback, character identity, RoomState/CAS, Realtime, audio clock or gameplay.

## Confirmed code-level transition problem

Before V4, the outgoing clip could start a crossfade with only **0.32 seconds** left, despite a transition of up to **0.55 seconds**. A `LoopOnce` action may therefore reach the final clamped pose before the blend finishes. The code did not check foot pose compatibility when picking the next clip.

V4 uses a shared `transitionWindow(duration)` to schedule and execute the fade, always keeping `fade <= lead < duration`. Bounded 100ms mixer integration gets a 120ms fade-start margin. The fade is capped at 280ms, and the previous `contactV4=0` timings remain available for A/B.

## Pose-aware shuffle bag (NO foot IK)

During QA actor initialization, a disposable mixer samples the **first frame only** of each compatible Mixamo clip against that actor's actual M3 rig. All sampled bone transforms are restored; the normal actor and mixer persist.

At a random transition, V4 compares the current ankle X/Z locations against each eligible clip's first-pose ankles in actor-local coordinates. Near-floor support feet are weighted more strongly than lifted feet. Already-playing clips and immediate repeats retain the existing shuffle-bag exclusions. Gains under 0.7% of character height are ignored so near-ties preserve deterministic shuffle order.

This is transition **selection**, not runtime stance override. V4 does not mutate authored limb rotations, overwrite actor transforms, constrain foot joints, slow the gameplay clock, invent steps or silently replace any of the ten animations. If no candidate has a close starting pose, V4 still chooses the least mismatched eligible clip. Large mismatches therefore **remain a visual risk**; a genuinely suitable stepping bridge would require verified source-foot contact and manually authored Blender poses.

## Contact metrics

A light, passive actor-local tracker samples both foot bones after the main mixer, counting near-floor horizontal displacement. The QA DOM exposes:

- `data-m3-contact-v4`: V4 active in isolated QA only.
- `data-m3-contact-metrics`: per actor `contactSlip`, `crossfadeSlip`, `plantedTravel`, `crossfadeTravel`, `poseGap` and `transitions`.
- `data-m3-motion-review`: existing controls extended with contact diagnostics.

Numbers are **bone/ankle proxies**, not sneaker outsole mesh tracking. The near-floor threshold is derived from rest ankle height; clipping, toe roll, footwear shape, track quantization and lower FPS may affect measurements. `contactSlip` / `crossfadeSlip` are maximum cumulative anchor displacement (meters), not instantaneous velocity. `poseGap` is height-normalized mismatch, not a percent of frames with slide.

## A/B and QA matrix

Use the SAME stable branch-preview hostname for all variants:

- **V4 5 actors:** `/tools/lobby-qa-sketch?m3=five&allM3=1&mixamo=1&contactV4=1` (V4 is on by default on Mixamo QA).
- **V4 + old Bored V3 pelvis:** add `&pelvisFix=1`.
- **Original crossfade control:** `/tools/lobby-qa-sketch?m3=five&allM3=1&mixamo=1&contactV4=0`.
- **Single female/male:** `?m3=female&mixamo=1` and `?m3=male&mixamo=1`.
- **Rejected IK for historical comparison only:** `?m3=female&mixamo=1&footLock=1` (disables V4).

Visual sign-off requires real iPhone Safari: review the unmodified and V4 paths in front/side views; isolate `Bored`, `Sad Idle`, `Dwarf Idle`, `Breathing Idle 2`, and the transitions to/from emotes, on both rig families. Observe whether the standing foot actually stays fixed and if the knee/torso proportions remain credible. Run 5-person random playback long enough to encounter multiple transitions and watch for foot sliding and actor/mixer restarts.

Automated tests: `e2e/mixamo-contact-v4.spec.ts` covers fade window math, contact-aware shuffle choice, contact metric attribution, and a browser M3 mesh smoke. These tests cannot replace owner iPhone visual approval.

## Not in scope / remaining risk

No source FBX or original target VRMs were provided as local inputs to this V4 implementation. It would be unsafe to synthesize stepping keyframes or claim clip-internal slide is corrected without a clip-by-clip support-phase/heel-toe study. Foot sliding **inside a single source clip** can persist. V3's small Bored pelvis correction remains optional, never silently applied to other animations. No changes are made to production gameplay or the character catalogue.
