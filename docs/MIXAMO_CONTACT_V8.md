# M3 Waiting Room — V8 Per-Foot Contact and Crossfade Audit (QA Only)

Owner iPhone evidence: `Video-test(20261121-034125).mp4` (42.433 seconds, 512×1106, 30 FPS). Motion inspection: broad improvements in stationary idle V7, residual Grace twist/liftoff around 8–11s and some hip-led contact mismatch around 13–18s and 25–30s. The recording does not label which animation plays on each actor; **do not attribute time ranges to a named source clip** without additional per-actor telemetry.

## Scope
Working branch `work/m3-waiting-room-integration-v1`. Keep existing accepted gameplay architecture, RoomState/CAS/Realtime protocol, Ready/Start gate, shared start epoch, WebAudio scheduler and global turns untouched. No production Waiting Room changes. Feature gate only on `/tools/lobby-qa-sketch?mixamo=1&contactV4=1&pelvisFix=1&sideStepV6=1&contactV7=1&contactV8=1`. Existing V7 URL works as A/B control; random playback requires **no** `sideStepDemo=1`.

## Implementation

- Source-aware per-foot sampling on native M3 skeleton at 30 FPS; tracks foot, toe and 64%-toe heel/toe weighted shoe-sole proxy in **actor-local** coordinates. Estimators use 12th-percentile floor, 3.6 cm sole/4.8 cm toe height bands, local vertical-change gate and minimum 8-frame grounded spans. These represent probable ground contacts, not actual shoe mesh collision.
- After existing V6 Bored authoring and V7 micro-pelvis bake, V8 selectively authors **independent** left/right hip-leg-to-ankle quaternion corrections using the existing constrained native M3 IK helper, **only once when preparing a clip**. Per-ankle correction is capped at 8mm; per-joint authored deviation is capped at 7.5°, and a jump-vs-source bound of 3.5°. A clip is published only if its aggregate separately measured grounded sole travel improves by >2%; otherwise it stays on V7 unchanged. No runtime IK, foot lock, actor root relocation, additional global turns or new mixers.
- Blend and selection remain seeded shuffle-bag and normal `THREE.AnimationAction.crossFadeTo`. For V8, the pose-compatible chooser additionally weights probable support foot, sole position and incoming contact continuity for every allowed next clip. It does not remove clips. When the incoming/outgoing support sole mismatch exceeds 2.5cm, crossfade is conservatively shortened to at least 0.15s (never extended across the outgoing clip). Shorter fades can also create abrupt poses; owner video review is required.
- Runtime QA diagnostics separately report cumulative L/R grounded sole-proxy travel and L/R travel during crossfades, current gesture, support mask, last sixteen source→target transitions and each foot's initial sole gap. The M3 `AnimationMixer` and actor identity persist through status/focus/Ready changes, as in V7.
- Existing V4/V6/V7 can be independently A/B compared; V8 opt-in does not replace V6 or V7 and does not activate on real Waiting Room.

## Required validation

1. TypeScript, Next.js production build, focused Playwright unit candidate selection.
2. 9 female + 8 male clip/rig results: report applied/rejected clips, L/R raw vs baked travel, max joint delta. Do not claim that every clip was fixed.
3. Five-person random waiting room: V6 Bored still present, all actors preserve mixer UUID, transition snapshots contain support masks, sole gap, fade duration and no browser exceptions.
4. Owner iPhone compares V8 against V7 for foot sliding, weight shift, unnatural knee shapes and motion changes. A quantitative decrease in proxy contact travel **does not** mean the animation looks accepted.

## Risk

Framewise constrained leg solving is a cautious micro-correction, not full Blender reconstruction of source choreography. Sole tracking uses ankle/toe joint approximation. Large slide events, garment/sole geometry errors, camera focus movement and visibly incorrect steps may remain. Stage does not touch gameplay clock.

## Preview query

- V8 five actor random: `/tools/lobby-qa-sketch?m3=five&allM3=1&mixamo=1&contactV4=1&pelvisFix=1&sideStepV6=1&contactV7=1&contactV8=1`
- V7 A/B: same with `contactV8=0`.
