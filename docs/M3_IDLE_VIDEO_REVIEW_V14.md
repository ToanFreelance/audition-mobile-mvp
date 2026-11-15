# M3 Waiting Room — Video Reference Review / Idle V1.4

Date: 2026-11-15
Branch: work/m3-waiting-room-integration-v1
Status: IMPLEMENTED FOR PREVIEW / iPhone visual acceptance PENDING

## Owner-provided video sources

1. Video-test(20261115-143645).mp4 — 33.65 s, 512×1106, 30 FPS. Real owner iPhone Waiting Room test.
2. YTDown.com_YouTube_Media_9uaKR_GiZQs_All-Character-Idle-Animations-Zenless-Beta_002_1080p.mp4 — 147.07 s, 910×512, 30 FPS. Zenless Zone Zero idle compilation. Gameplay characters appear during approximately 0–114 s; remaining video is an outro graphic.

## Analysis based on the two videos

Owner clip: repeated torso and arm movement, but unstable foot contact and apparent gliding because V1.3 rotated hips and thighs without foot locking. Zenless reference: mostly planted stances, quiet poses held for a moment, deliberate gesture followed by a visible return to rest.

| Reference interval | Character movement vocabulary | V1.4 adaptation |
|---|---|---|
| 0–11 s | Pink-haired female: planted stance, small head/shoulder shift | Held stance, small torso counter-rotation |
| 12–25 s | Short-haired female: neutral posture, controlled arm emphasis | Relaxed arms and head movement |
| 27–35 s | Red-jacket male: recognisable short upper-body/hand gesture | Hand-on-hip and shirt adjustment |
| 67–76 s | Red-haired woman: expressive upper-body movement with posture recovery | Eased arm gesture followed by full recovery |
| 80–88 s | Male in dark shirt: head dipped briefly then lifted | Look-aside / neck-relax pose |

The Zenless clip has props, bags, pets, weapons, cloth/hair simulation and distinctive choreography that are not compatible with the current M3 wardrobe. Do not reproduce proprietary assets or character-specific choreography. The MP4 provides rendered images, **not animation curves, skeletons or validated foot-contact timestamps**. Our result is an authored approximation of the selected neutral gestures, not a frame-identical extraction. Exact mocap reproduction requires a separate animation capture and rig-retargeting workflow with appropriate rights.

## Implementation / architecture

- **Foot lock:** Save both ankle world poses at spawn as actor-local anchors. Apply small hips shift to create weight transfer, then solve each upper/lower leg to the exact transformed anchor with 2-bone IK. Restore ankle world orientation so shoes do not rotate with the shin. When an actor moves/scales/rotates under formation or camera framing, the anchors follow the actor transform.
- **Base idle:** Eased piecewise stance with pauses, hips/spine/neck counter-pose, quiet breathing and shoulder motion. No free-running oscillation of knees or thighs, no root motion, no ungrounded steps.
- **Four gesture categories:** look-aside, hand-on-hip, outfit-adjust, neck-relax. Each has anticipation → action → hold → recovery, staggered deterministically by room and participant. Hair-brush has no scheduled action because the owner rejected its earlier salute-looking silhouette.
- **Runtime:** Existing Waiting Room 30 FPS render loop. Pose state is owned by the per-participant SkeletonUtils clone and remains stable when READY/connection changes. C1/C4 Mixamo idle and M3 creator save are untouched. Gameplay runtimeReady remains false, and Host Start server/UI gate remains unchanged.
- **QA fixture:** /tools/lobby-qa-sketch?m3=female|male|five exposes per-stage DOM data attributes for completed gestures, active gestures and max current foot error. The probe is scoped to the isolated sketch route, does not create new timers or React rerenders and is not gameplay instrumentation.

## Validation performed

- TypeScript npx tsc --noEmit PASS; Next.js production npm run build PASS; git diff --check PASS.
- Three focused Playwright skeleton tests PASS: 90-second animation lifetime, finite bone rotations, preserved foot positions and orientations, deterministic but varied participant choreography, and foot locking under formation translation/yaw/scale.
- Chromium mobile 390×844 in SwiftShader: female 1 M3, male 1 M3, five-person stage 3 M3 + 2 C1/C4. No JS/console errors, scene generation 1, sampled ankle drift 0.00000 in all three fixtures.
- SwiftShader is software rendering and runs slowly; full gesture aesthetic, timing and thermal performance require physical iPhone owner acceptance. Not all gesture variations have been visually approved.

## Follow-up

Owner to inspect 1–5 real avatars on iPhone, watching shoes, knees, garment clipping, intended gesture readability and actual pacing. Do not merge work branch without explicit owner approval.
