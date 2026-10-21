# Animation Flow V2.2.15 — Recover Dance After a Successful Fancy Finish

Work branch: work/animation-flow-qa-v2
PR #19: Draft / unmerged (base development)
Baseline HEAD: 2e6177e6c68d336a528ba830fe9418b4b9e48baa
Owner evidence: 2026-10-21 IMG_3572.png, 200 BPM. Actual Fancy Finish38 displayed PASS, but at L8 NORMAL global turn51 the character is still playing `rest-standing` with presentation `REST_IDLE`.

## Root cause

V2.2.14 guarded entry into Fancy Finish, including staging its XZ path within HIDDEN37, but did not guarantee that the NEXT ordinary dance could be admitted from the body/root pose left after 85_04 + recovery. When all candidate NORMAL phrases are rejected by unchanged stage/facing constraints, `SessionChoreography.select()` returns false repeatedly, and `FinishPresentation.resume()` is never called. Since `sustain()` exits whenever FinishPresentation is active, the actor remains in REST_IDLE even while global gameplay NORMAL judgements continue.

A second replay bug: the `FinishPresentation` state machine kept re-requesting `rest-standing` once every idle-clip duration, although `SourceFlowEngine.loopIdle` already performs continuous living idle. Repeated requests can interrupt a preparation fade or overwrite a planned dance entry.

## Focused changes

1. In `FinishPresentation.update`, enter `REST_IDLE` once and set the next deadline to null. The authored living idle already loops at the engine level. The presentation cycle remains active until a real successful gameplay SPACE resumes dance. Does not alter the Flare performance timeline or shared turn clock.
2. In `SessionChoreography.select`, arm a post-Finish dance-resume target beat ONLY after the specific owner-selected QA `finish-85-04` has actually started and the shared manifest supplies `resumeBeat`. On Last L9 NORMAL Miss, clear this visual preparation and preserve the local Finish veto.
3. Once recovery has completed and the idle fade has finished, use the REMAINING existing REST beats to call `SourceFlowEngine.stageForPostFinishDance`. Stage continuously from the DISPLAYED pose towards the nearest admissible NORMAL dance entry position and audience heading. Enforce the original 1.35m disc, root transition speed <=1.35m/s, source phrase full-path placement, and heading bounds. Prefer the closest valid target, only trying limited central placements if necessary. No root snap, no extra command, no tempo or global turn change.
4. Save the exact admissible dance ID, then prioritize it at the first eligible NORMAL SPACE after REST (L6 in the next cycle). Only when an engine transition is actually accepted does `FinishPresentation.resume()` clear the cycle and ordinary L6–L9 sustain resume. No early dance before a valid SPACE. If no admissible post-Finish entry exists, preserve the safe idle and report a specific rejection; do not violate spatial/contact locks.
5. Add a visible near-stage status at the first NORMAL after REST: `SAU FINISH · ĐÃ NHẢY LẠI <dance>` with the exact beat; otherwise `CHƯA QUAY LẠI DANCE` and placement reason, so a stale `FINISH ĐÃ PHÁT` label cannot masquerade as full-flow PASS.
6. Regression fixture uses a synthetic canonical Three.js rig to verify an off-centre REST idle smoothly returns within the 1.35m disc, selects a genuine legal normal phrase, starts it on the exact scheduled beat with no delay, and never re-enqueues idle after transition to REST_IDLE.

## Scope / validation

- ONLY QA Animation Flow engine, post-Finish presentation and preview HUD are touched. The already-approved gameplay L9 canonical sequence remains NORMAL36 → HIDDEN37 → FINISH38 → REST39–42; Miss NORMAL36 still denies Finish and starts local idle.
- Preserve authoritative WebAudio clock, 4beats/global-turn, sequenceCounts, gauge, score/CAS multiplayer, Character Catalog, Flare, and all accepted production rig/stage assets.
- TypeScript + Vercel build PASS is not end-to-end proof of dance resumption. Run focused Playwright tests if available and perform repeated owner iPhone playback, 120 and 200 BPM, at least five different seeds for each, confirming FINISH38 then actual dance at next eligible NORMAL43, and continued dance at later L8 turns like 51.
- Do not merge PR #19 or push to development/main without explicit owner approval.
