# Animation Flow V2.2.8.3 — Correct Source-Proportion Calibration for Breakdance Intake

Repository: ToanFreelance/audition-mobile-mvp
Work branch: work/animation-flow-qa-v2; PR #19 Draft/unmerged.
Baseline: 99c0ec454fec482b38a16743bbf0d869152eda2f.

## Owner iPhone evidence (2026-10-21)

The V2.2.8.2 intake screenshot shows **0 accepted / 8 rejected**:
85_12 0/4, 85_14 0/3, 90_28 0/1. All eight give `no-2s-upright-dance-with-safe-entry-exit-in-chapter`. BVH sources were loaded; the rejection is local screening, not a network/asset-loading failure.

## Verified, testable root cause

Previous `analyzeExperimentalSource()` measured full-world skeleton height at time 0 and required entry `head.y - hips.y > height * .34`. **CMU subject 90_28 is a crouching/break performer with different anthropometric proportions.** Independent forward-kinematics sampling directly from the pinned 90_28 BVH (771 frames, duration ~6.425 sec) found upright head-to-hips clearance ~7.52 BVH units while both feet were ~16 units below the hips; the whole-bone height is ~24 units. The old global-height cutoff therefore classified valid grounded crouching poses as invalid at the ENTRY gate even before considering a dance excerpt. This is a reference-scale bug, not evidence no Breakdance phrases exist.

At approximately 0.12sec BVH pose intervals, an independent sample using proportion-calibrated boundaries and movement energy identified a *candidate* ~1.05–3.15sec in 90_28. This is preliminary technical evidence, not a Playwright/native/iPhone validation of exact trim.

## Focused fix

- Sample the entire original BVH track and measure `headAboveHips`, `lowerFootBelowHips`, `upperFootBelowHips` and joint movement per frame.
- Calibrate entry/exit posture against the 95th percentile of the source's **positive head/hip clearance** and the 90th percentile of **positive lower-foot/hip clearance**, rather than a fixed fraction of total skeleton height. Require reliable upright torso and both feet below pelvis at entry/exit; require normal upright posture throughout accepted FREE clip. This does not allow inversions to become interruptible.
- Reject missing/invalid source anatomy; keep true inverted/floor segments in source review only.
- Favor *movement* rather than initial idle: require sufficient active frame fraction and motion energy, with scoring that prioritizes active dance over a longer held opening pose.
- Keep window length (>=2sec, <=~4sec), QA-only NORMAL candidate role, stage placement/root radius/facing checks, separate Street bag, all cadence and Finish invariants unchanged.
- The UI now identifies the specific V2.2.8.3 calibration in its version and candidate description; per-source admitted/rejected/played counts remain.
- Regression adds compact/crouched synthetic morphology that old algorithm wrongly rejects; a separate Playwright API integration test fetches the **real** pinned 90_28 source through the existing project proxy, parses it with BVHLoader and asserts at least one >=2sec FREE candidate. This test MUST actually run before claiming end-to-end PASS.

## Risks and acceptance

Vercel TypeScript/Next.js successful build is not proof that any candidate survives runtime `preparePhrase`, heading, continuity, physical foot-ground contact or realistic crossfade. On iPhone, owner should click Reload Breakdance and inspect counts; require **actual 'Đã nạp' >0 AND 'Đã phát' >0** before accepting Gameplay. If some source still has 0, show its per-source reason; do not force unsafe clips. The owner-approved `85_04` remains Finish candidate; Flare remains default.

Do not touch production WebAudio clock, 4 beat/global turn sequenceCounts, gauge, Finish timing/Flare/REST, hidden, RoomState/CAS, Supabase, Character Catalog or accepted stage/actors. PR #19 must remain Draft/unmerged.
