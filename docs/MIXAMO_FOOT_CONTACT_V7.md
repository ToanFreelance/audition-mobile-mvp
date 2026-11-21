# Mixamo Waiting Room — V7 30 FPS Contact Audit and Conservative Bake

## Owner reference and scope

The owner recorded `Video-test(20261121-031838).mp4` (36.4667 seconds, 512×1106, 30 FPS) of **five actors playing random clips with V6 Bored stepping**. Visual concerns persist around periods of lower-body sway and transitions. Camera/focus changes make 2D screen-pixel sliding an unreliable contact measurement. Source/reconstruction must be audited in **actor-local 3D** instead. This is QA-only on `work/m3-waiting-room-integration-v1`, never on the production Waiting Room.

## V7 design

- Enabled explicitly with `contactV7=1` on `/tools/lobby-qa-sketch`, with `mixamo=1&contactV4=1&pelvisFix=1&sideStepV6=1` retained; random playback requires **no** `sideStepDemo=1`.
- Samples **every available clip** at 30 FPS on native M3 bones, including base/emotes and manual catalog gestures. Contact geometry is based on actor-local foot and toe joint positions and their 64%-toward-toes average; it is a **sole proxy**, not mesh-verified sole collision or a full human biomechanics model.
- Grounded candidate windows require toe/sole proximity to independently measured low-quantile floors, low vertical travel, and at least eight consecutive source frames.
- In source-inferred contact windows, compute a tiny 2D pelvis translation offset to counter correlated planted-foot drift. Cap XY plane correction at **1.8cm**, frame-to-frame displacement at **0.6cm**; reject the entire clip when no real aggregate travel improvement is measured or the offset is unsafe. Hold the correction through the planted period and release it over seven frames **after liftoff**. Clips whose contact runs to the final few frames are left untouched to avoid loop/transition snapping.
- Only the `hips.position` X/Z track may be edited, once at actor setup. Never modify arm/head/thigh/ankle/toe rotations, original clip duration, stage placement or actor root. Never run frame-by-frame IK / Foot Lock.
- Cache numeric correction plans per rig geometry signature, rig family and clip; do not recreate actor or AnimationMixer on Ready/status/connection updates.
- The existing V6 Bored authoring is first, V7 sees its final retargeted clip and does not overwrite V6 leg tracks. Existing shuffled random clips and V4 crossfade are retained.

## Verification and limitations

Each catalog report contains source clip name, inferred contact segments/frames, original and corrected near-ground joint-proxy travel, maximum pelvis offset and maximum keyframe jump, plus a rejection/acceptance reason. Every clip is reported, even when not modified. The focused Playwright gate checks the synthetic contact sampler, both real M3 rigs, full catalog coverage, per-clip rejection bounds, and five-actor mixer persistence and V6 coexistence.

**Do not conflate:** (1) contact proxy measurements, (2) visual animation/sole quality, and (3) clip transitions. No source FBX editing or independently authored Blender full-body steps is claimed here. If motion is dominated by independent knee/foot rotation, or never contains a safe airborne release, a shared pelvis correction cannot solve it; it must be separately re-authored from source. Unmodified clips are deliberately logged as unresolved rather than artificially marked fixed.

Owner iPhone visual review remains the acceptance gate. Do not promote to production or merge without explicit approval.

## Test URLs

- V7 + V6 + random **5 people:** `?m3=five&allM3=1&mixamo=1&contactV4=1&pelvisFix=1&sideStepV6=1&contactV7=1`
- V6-only **5 people random**: same URL, `contactV7=0`
- Female/male isolated V7 clip audit: `m3=female` or `m3=male` and all flags as above.

## First real-M3 findings / classifier refinement (21 November)

Initial focused catalog run measured `Bored-step-v6` contact-proxy travel **51.8→42.0cm** (female) and **51.9→41.1cm** (male) over the concatenated inferred grounded intervals; these totals are sums over many sampled frames, **not a single foot slipping 42cm**. For the remaining clips the first classifier found no eight-frame safe release windows. `Sad Idle` produced an unsafe proposed ~7mm one-frame pelvis jump and was correctly rejected.

The classifier has therefore been extended to distinguish:

- Source clips with an explicitly lifted / released foot: plant corrections held until liftoff, then eased off.
- Fully planted **cyclic** idle sway: support correction may span nearly the whole clip ONLY when the foot at the start and end returns to within 1.5cm in actor-local XZ; clip endpoints stay unchanged to preserve V4 transitions.
- More generous near-floor joint tolerances for ordinary Mixamo source clips, while keeping the strict V6 Bored contact classifier so generated swing arcs are not accidentally treated as planted feet.
- Two-pass correction velocity limiting for proposed pelvis offsets. No corrected clip may exceed 6mm displacement in one keyframe, and every clip is independently accepted only if contact motion is actually reduced.

The above is an analysis/authoring quality gate, not a claim that all 17 clips need or receive the same correction. Rejected clips remain source-authored.
