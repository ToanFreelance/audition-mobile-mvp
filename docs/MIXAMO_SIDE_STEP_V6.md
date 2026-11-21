# M3 Mixamo Bored — V6 Authored Two-Phase Side-Step QA

## Owner rejection, 21 November 2026

Owner's iPhone video `Video-test(20261121-020713).mp4` (32.2 seconds) shows that V5.1 did not produce a perceptible step and skating persists. The V5.1 attempt only raised an ankle by ~1.3–1.8 cm while reusing ~1.3–2 cm of the original lateral movement. It did not create a new lateral landing or correct the support foot. **V5.1 is visually rejected**, even though its 5/5 synthetic/mesh QA passed.

## What V6 changes

V6 remains opt-in and isolated to `/tools/lobby-qa-sketch?mixamo=1&contactV4=1&pelvisFix=1&sideStepV6=1`. It is intentionally restricted to `Bored` until the owner accepts its motion.

For each M3 rig:
1. Evaluate the existing **source retargeted 30 FPS Bored clip** on the actual native rig; use source foot trajectories to select two side-change moments.
2. Expand each into a self-contained ~1.6-second **two-leg side-step**: the first foot swings outward and lands along the authored source trajectory, then support transfers and the other foot lifts to follow. Both feet blend back to the source pose at event boundaries to avoid snapping at the next clip.
3. Give each swing ankle a **4.5–8.0 cm airborne lateral excursion** and **2.5–3.7 cm lift** (second foot follows at 80–90% of that amplitude), keeping the source's ultimate landing/transition location. A bake count does not guarantee an actual planted shoe is still.
4. Use contact phases instead of freezing one shoe for the entire 48-frame event. The first support shoe is corrected during the first 0.27s swing, then the planted role transfers to the other shoe for the second 0.33s swing. Per-phase support correction is capped at 1.2cm and fades smoothly, with a small X/Y pelvis softening.
5. Solve both legs **at clip-build time only** and bake thigh/shin/ankle quaternion tracks plus small hips X/Y offsets. Preserve the authored head, spine, arms, actor root, stage placement, original clip duration and native playback mixer. For near-reachable targets the solver attempts only mechanically valid corrections within a strict 5mm foot-error margin; thigh 13° and shin/ankle 23° remain hard caps. No runtime IK, actor root lock, or forced leg extension is introduced.
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

## V6 source-foot phase correction (21 Nov)

Native rig Chromium measurements identified that holding the same support shoe for the full 48-frame event was physically invalid: support-ankle displacement relative to the chosen anchor reached approximately 3cm at frame 73 and 8cm at frame 247. Even a 5mm approximate IK solution cannot correctly freeze a naturally travelling contact across this window. The solver must switch which leg is supporting, add airborne swing arcs on the appropriate frame ranges, and cap a per-contact adjustment rather than forcing the entire leg into one location. Any remaining slide beyond these Bored phases and in other Mixamo clips remains open until its own motion study.

## Native M3 evidence from V6.2 focused QA (2026-11-21)

Measured with the unaltered native M3 rig and the existing retargeted Bored clip; all values are clip-local and rounded.

| Rig | Authored side-step A | Side-step B | Lift heights | Max limb rotation delta | Support ankle travel (source → baked, core phase) |
|---|---:|---:|---:|---:|---|
| Female Drophunter | 7cm | 6cm | 2.9cm / 2.5cm | 22.8° | 1.4→1.2cm and 1.2→0.9cm |
| Male Neurohacker | 8cm | 7cm | 3.4cm / 2.9cm | 23° | 1.5→1.3cm and 1.3→1.0cm |

V6 tests at this revision PASS all 3 initial rig checks, including sample projections and 5 independent actor mixers. On the solo 390px portrait QA projection, the stepping left ankle moves ~16 pixels laterally with an ~8-pixel vertical rise near source frame 70. These are **projected bone centers**, not guaranteed shoe-sole ground contact. Added A/B screenshots and tests now compare the exact same source-relative Bored frame with V6 enabled and disabled. No owner iPhone visual acceptance is yet recorded.

**Residual sliding remains possible.** Improvements to the supporting ankle's short-phase travel are modest (~0.2–0.3cm), and other clips plus crossfades have not been rebuilt. Never report this as a complete five-person foot-slide cure.
