# Animation Flow V2.2.9 — Owner-selected 85_04 as a selectable Finish

Repo: ToanFreelance/audition-mobile-mvp
Work branch: work/animation-flow-qa-v2, PR #19 Draft.
Baseline: 841bfd06e07b8ce7fe06c6753522cb1da27f6fa5.

## Owner observation (2026-10-21)

iPhone screenshot confirmed **6 experimental ordinary Breakdance excerpts loaded**: 85_12 3, 85_14 2, 90_28 1. Counter 'Đã phát trong Gameplay: 0' means no experimental transition has yet occurred on that run; merely loading clips does not imply they have played.

Owner asked why the NEW Finish was missing. Root cause: 85_04 was tagged only as `candidate-85-04` in the isolated Dance Review catalog; the Gameplay Finish selector enumerated Flare and the two existing Finish phrases, and SessionChoreography never knew about the owner-selected source.

## Focused implementation

- Add `finish-85-04` to QA `FINISH_PHRASES` with `role:finish`, explicit `PROTECTED` policy and the existing `recover-narrow` rest recovery mapping. This is distinct from `NORMAL_PHRASES`. It is NOT a production asset.
- First-pass visible demo uses an 85_04 source excerpt at **0.2–4.2 seconds**, fitting 8 authored beats at assumed BPM120; this is an **unapproved trial trim**, not the entire raw original take or a final owner-approved edit. The full source remains in Dance Catalog. The 0.5 beat Finish hold and ~0.8 beat recover-narrow lie within the existing ~20 beat shared Finish→L6 window; no global turn addition.
- Do not preload 85_04 for all users. `selectFinish("finish-85-04")` loads the original source lazily via the pinned CMU allowlist, prepares it on the existing canonical rig, then arms the actual Gameplay Finish selector and resets that QA session. If load/prepare fails, retain prior selected Finish and show the error; do not silently claim active.
- Old Flare remains the default. Exact `finish-85-04` only is allowed direct visual start on successful Finish when outgoing phrase has no protected contact. The global WebAudio beat timeline is never shifted to make room for a Finish. The existing FinishPresentation manages the authored hold→recovery→living idle during REST.
- A separate 'Xem Finish đã chọn' button plays this Finish at beat4 on isolated source preview so owner can compare it with Flare directly; a normal Gameplay run uses actual Level 5/9 Finish events.
- Keep ordinary experimental intake 6 clips and their separate selection counts unchanged.

## Validation and known risks

- Verify Vercel TypeScript/Next.js build for exact work-branch commit. New Playwright spec asserts Finish catalog role/policy, recovery mapping, absence from normal dance, and selector/lazy loading smoke. Only call Playwright PASS if executed.
- On owner iPhone check Finish 85_04 visual body, entry, protected end, recovery→idle, and compare the 0.2–4.2sec demonstration cut with full original. This cut is intentionally provisional. The finish selector might legitimately reject spatially incompatible incoming/recovery poses; inspect existing placement/FinishPresentation events rather than bypassing 1.35m root constraints or doing a magic turn offset.
- Preserve Flare, existing accepted Level 1–9 choreography continuity, instant ordinary SPACE, 4beat turn budget, Finish red treatment, sequenceCounts, REST and AUDIO END semantics. Do not change production Character Catalog, RoomState/CAS, Supabase or main/development.
- No merge until explicit owner approval.
