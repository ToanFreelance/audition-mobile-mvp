# Mixamo Waiting Room — V5 source-timed Bored side-step pilot

## Owner feedback and scope

After the V4 contact-aware crossfade and V3 Bored pelvis preview, the owner supplied `Video-test(20261120-145032).mp4` (32.93s). Small foot skating remains visible, especially around 10–12s and 22–26s in the five-person Waiting Room. The owner explicitly prefers an authentic small lateral step instead of skidding. Preserve the improved full-body posture; V2 runtime foot IK is rejected.

This is a **targeted V5 QA pilot** on `work/m3-waiting-room-integration-v1`. No changes to production Waiting Room, gameplay timeline, WebAudio, RoomState/CAS/Realtime, Ready/Start, or Character Catalog. Nothing is merged.

## Implementation

The opt-in `sideStepV5=1` path now runs **once at actor setup**. Only `Bored` (female Drophunter and male Neurohacker native M3 rigs) is eligible. It:

1. Samples all original Bored 30fps foot positions in actor-local space using a temporary mixer, restores every original bone transform afterward.
2. Detects up to two horizontal, near-floor shoe traverses where the source pose does not already lift the foot. It rejects primarily forward steps, large traverses, source-lifted strides, and out-of-bound windows.
3. For each candidate, authors a small 14-frame (0.47s) vertical step arc, preserving the exact source shoe X/Z trajectory and foot world heading. A two-bone analytical solve is performed **offline during clip construction**, not on live playback frames.
4. Rejects the whole step when a frame cannot solve within 3mm positional error or exceeds 11° upper-leg / 19° lower-leg or ankle local rotation delta. No partial/abrupt clips.
5. Bakes the accepted change into 30fps thigh, shin and ankle quaternion tracks only, leaving the entire original torso, head, arms, pelvis track, actor root and clip duration unchanged. Foot motion outside the authored window remains source-authored.
6. Reuses V4 contact-aware crossfade/shuffle-bag, and optional `pelvisFix=1` V3 small Bored pelvis adjustment.

The step height is **0.9× measured source foot travel**, bounded between 1.3 and 2.6cm, rather than relying on the actor bounding box. The first M3 browser run measured a 4.05-unit visual box but only 1.8–2.1cm of maximum lateral travel in 14 frames, so V5's original 4.9cm detection threshold rejected every candidate. V5.1 uses bounded centimeter-scale motion thresholds and keeps the unchanged 11°/19° joint safety caps. This remains a QA design choice awaiting iPhone sign-off, not a gameplay rule.

**Important:** If the source lacks a valid lateral traverse, or the native M3 skeleton cannot safely solve it, this pilot intentionally produces **no step** and keeps the original motion. A true source-specific Blender re-authoring pass may still be required. `Sad Idle` already contains an authored lifted step; it is never altered. Other Mixamo clips remain unchanged.

## A/B URLs (stable branch Preview host)

- V5 5 actors: `/tools/lobby-qa-sketch?m3=five&allM3=1&mixamo=1&contactV4=1&pelvisFix=1&sideStepV5=1`
- V4+V3 control: same route and flags with `sideStepV5=0`
- Single female: `?m3=female&mixamo=1&contactV4=1&pelvisFix=1&sideStepV5=1`
- Single male: `?m3=male&mixamo=1&contactV4=1&pelvisFix=1&sideStepV5=1`

QA DOM `data-m3-side-step-v5` and `data-m3-side-step-metrics` expose clip, baked step count, support side, frame window, distance, lift and maximum per-frame joint deviation. Existing contact-slip telemetry remains independently available.

## Quality gates / limitations

Focused unit tests verify that an unlifting horizontal traverse is selected and an already-lifted step isn't duplicated. Real M3 browser tests should verify a nonzero accepted Bored event on **both rig families**, bounded joint deltas, actor/mixer persistence, and five-person random mode. iPhone Safari visual acceptance is required before promoting V5 to default.

The detected foot contact is an ankle position proxy, **not an outsole collision or heel/toe sensor**. A QA pass cannot claim all skating is eliminated: source Bored can have shared bilateral pelvis sway, and an unedited planted foot may still slide; non-Bored and crossfade events also remain potential contributors.

Use no runtime foot lock. Do not invent root timeline offsets, replace actors, or modify unrelated animation/game systems.

## 2026-11-21 owner video: V5 visibility and QA navigation defect

In the 32.2s iPhone video `Video-test(20261121-020713).mp4`, the owner still sees foot sliding and does not perceive the intended V5 side-step. This feedback **rejects V5.1 visual sign-off** regardless of CI. The previous V5 pilot did only small Y-axis foot arcs (1.3–1.8cm measured at foot-bone level), on Bored only, during clip-relative seconds ~2.07–2.53 and ~8.07–8.53. It does NOT synthesize a new lateral displacement, fix the planted foot, or affect any other random idle clip. It therefore cannot solve all 5-actor random skating.

An additional confirmed review-UI bug was found: `MotionControls` used hard-coded Nữ/Nam/Năm người links that dropped `sideStepV5=1`, `pelvisFix=1` and `contactV4=1`. Navigating between review targets could silently disable V5. To remove this ambiguity, the QA links now preserve selected flags. The details summary declares whether V5 is enabled, and `sideStepDemo=1` plays Bored deterministically on all ready M3 actors. The iPhone reviewer can verify exactly which feature is actually running. `sideStepDemo` does not modify any clip and is QA-only.

**Open visual defect:** A physically convincing side-step requires a longer and grounded contact-phase transition including weight shift, lifted swing shoe, lateral landing, and stable planted shoe. The V5.1 vertical-only arc is not a full side-step. Do not claim the slide is fixed from the existence of two baked events or from mesh smoke PASS. Further motion authoring should be clip-by-clip with side/front 30Hz QA evidence, not increased arbitrary foot IK caps. No default production enablement until owner approval.
