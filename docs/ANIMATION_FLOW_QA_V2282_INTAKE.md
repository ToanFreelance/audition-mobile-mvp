# Animation Flow V2.2.8.2 — Breakdance Intake & Selection Diagnosis

Repository: ToanFreelance/audition-mobile-mvp
Work branch: work/animation-flow-qa-v2, PR #19 Draft, base development
Baseline: e595c2c63ff30e88d64226aa5f4ca2b5ea390635

## Owner iPhone regression (2026-10-21)

The short 90-glide has correctly disappeared, but tapping "Nạp Breakdance vào Gameplay thử" does not visibly add new motions. Diagnosis against the actual V2.2.8 source identified two **independent deterministic root causes**:

1. The intake ran `proposeReviewSegments` first and rejected an ENTIRE multi-second 1/4-take chapter if any one sampled frame placed the dancer on the floor or inverted. Floor/break sources naturally contain these frames, so useful standing intervals nested in the long chapter were never considered.
2. Even if intake accepted a candidate, `SessionChoreography.select` filtered experimental `PhraseBag` through the first nonempty style preference tier. As long as that tier contained regular Street or Pop candidates instead of the newly loaded break phrase, the opt-in clips could be loaded but never actually chosen.
3. The UI only displayed one summary count and generic status, so it hid whether each source failed to download/parse, failed posture screening, failed stage placement, or was simply never selected.

## Focused fix

- Sample original BVH motion for **upright, moving subwindows** within each owner-reviewed chapter, approximately 2.0–4.0 source seconds long. Test head above hips, foot below pelvis, stable standing boundary frames and movement energy. Reject true inverted and floor/handstand intervals. This does not declare a physical foot-contact proof, final choreography edit or retarget approval.
- Evaluate source subdivisions separately, rather than rejecting an entire long chapter for a single unsafe frame outside the desired subwindow. Retain owner-approved 85_12 (four chapters), conditional 85_14 (three), and conditional 90_28 (one); keep 85_04 as separate Finish candidate.
- Experimental `PhraseBag` now tests spatial/heading compatibility directly for eligible Street SPACE moments rather than being constrained by a previously chosen base style tier. Style chapters, anti-repeat and immediate valid SPACE remain intact; nothing is placed outside the 1.35 stage bound.
- UI displays per-source counts/reasons and a separate number of experimental transitions actually **played**, not just preloaded. A retry clears stale diagnostics and prepared candidates; export JSON keeps accepted spec and rejection information.
- Strict non-eligible floor segments remain in the dedicated full-source Catalog, not silently force-promoted or allowed mid-flip SPACE interrupts.

## Acceptance / validation

- Vercel TS and Next.js build against exact commit, PR remains Draft/unmerged.
- Focused new/updated test uses animated synthetic standing BVH and inverted-head case, asserts safely moving sections are discoverable, idle-only is rejected and detailed per-source UI present. Test code is not evidence of execution until a browser/test runner actually runs it.
- On owner iPhone: load, check per-source 85_12/85_14/90_28 counts and messages. If >0, press Gameplay Auto Perfect and look for "Đã phát trong Gameplay" counter; verify new break-* transition entries in exported JSON. If 0, report exact reasons. Do not claim additional gameplay choreography without observed accepted + played counts.
- End-to-end root pose/facing, floor contact, 4/8 beat continuity, Flare/REST, BPM 110/120/160/200 remain visual/runtime acceptance gates.

No changes to production gameplay, WebAudio authority, global 4-beat turn schedule, gauge, Finish Flare, Character Catalog, RoomState/CAS, Supabase or stages. No automatic merge.
