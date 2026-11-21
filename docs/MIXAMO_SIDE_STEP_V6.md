# M3 Mixamo Bored — V6 Authored Two-Phase Side-Step QA

## Owner rejection, 21 November 2026

Owner's iPhone video `Video-test(20261121-020713).mp4` (32.2 seconds) shows that V5.1 did not produce a perceptible step and skating persists. The V5.1 attempt only raised an ankle by ~1.3–1.8 cm while reusing ~1.3–2 cm of the original lateral movement. It did not create a new lateral landing or correct the support foot. **V5.1 is visually rejected**, even though its 5/5 synthetic/mesh QA passed.

## What V6 changes

V6 remains opt-in and isolated to `/tools/lobby-qa-sketch?mixamo=1&contactV4=1&pelvisFix=1&sideStepV6=1`. It is intentionally restricted to `Bored` until the owner accepts its motion.

For each M3 rig:
1. Evaluate the existing **source retargeted 30 FPS Bored clip** on the actual native rig; use source foot trajectories to select two side-change moments.
2. Expand each into a self-contained ~1.6-second, **two-lift side-tap** with weight shift, swing outward, planted hold, recovery lift and settle. A step out/return is used because this idle must keep the original clip start/end pose; a permanently translated stance would snap at loop/crossfade boundaries.
3. Give the swing ankle a genuine **4.5–8.0 cm new lateral reach** and **2.5–3.7 cm lift**, proportional to a feasible constrained solution, rather than adding Y lift to the tiny original X displacement.
4. While the swing foot moves, stabilize its opposite support ankle in M3 actor-local space with fade-in/out over the event window, and add only a small pelvis weight-shift along X.
5. Solve both legs **at clip-build time only** and bake the resulting thigh/shin/ankle quaternion tracks plus hips X position. Preserve the authored head, spine, arms, stage placement, original clip length and native playback mixer. A candidate is entirely rejected if any frame exceeds 13° thigh, 23° shin/ankle, 5 mm target error, or the core support foot moves more than the allowed contact margin. No per-frame runtime foot IK or actor lock is introduced.
6. Playback reuses the V4 contact-aware shuffle-bag/crossfade. `Sad Idle` retains its own authored step and all other Mixamo clips are untouched.

These are clip-local values in the native retargeted M3 rig; real rendered shoe-sole geometry is not measured by this solver. `Bored` remains one clip out of the random library. V6 **does not assert that unrelated clip/transition sliding is fixed**.

## 30 FPS evidence and visual approval

The QA-only event `m3-idle-review` with `{command:"v6-sample",id:"bored",value:seconds}` freezes the rig at the requested clip-relative time and publishes `data-m3-v6-pose-evidence` with per-actor projected left/right ankle, knee, hips and other joints. The focused Playwright test emits side-by-side time samples and screenshots for both female and male rig. It also validates real baked step reach/lift, support-foot drift, angle bounds, five-person actor persistence and restored random playback.

**Owner acceptance gate:** On iPhone Safari with five actors, both side-step and recovery must be visually recognizable, and the support shoe must stay planted without knee clipping/strange foot rotation. Verify in front/side views, and separately inspect transitions or other clips where residual sliding is noticed. QA PASS alone does not grant visual acceptance.

## A/B routes

- V6 five actors (Bored replay): `?m3=five&allM3=1&mixamo=1&contactV4=1&pelvisFix=1&sideStepV6=1&sideStepDemo=1`
- V5.1 control: same route with `sideStepV5=1&sideStepV6=0`
- V4+V3 original control: same route with `sideStepV5=0&sideStepV6=0`
- V6 individual rigs: `m3=female` or `m3=male`, preserving flags

Everything lives on `work/m3-waiting-room-integration-v1`. Do not merge or change production/RoomState/CAS/Realtime/Ready/Start/Gameplay/WebAudio/Character Catalog.
