# Animation Flow V2.2.14 — Intermittent Fancy Footwork Finish at Random Stage Positions

Repository: ToanFreelance/audition-mobile-mvp
Branch: work/animation-flow-qa-v2; PR #19 Draft/unmerged; base development
Baseline HEAD: e8148ad45b401c3a1c9b24dd3b3137f78af1ace0
Owner evidence: Video-test(20261021-123734).mp4, portrait 512×1106, 90.2 seconds (iPhone), QA tool set to Fancy Footwork 85_04.

## Symptom / concrete code-path causes

Owner previously confirmed a successful Fancy Finish, but repeated full runs sometimes reached Finish and stayed in living idle. This is a randomized spatial-placement problem and can also be caused by an unrelated NORMAL phrase selection rejection:

1. Prior V2.2.13 `stageForFancyFinish(hiddenStartBeat,finishBeat)` kept the outgoing dance's **same XZ root offset** when blending to ready/standing during canonical HIDDEN37. The idle staging itself could fit the stage, but the much larger authored 85_04 finish path might not fit the 1.35m disc from that offset. At Finish38 `SessionChoreography.compatible()` then fails `engine.placementAtExit("finish-85-04",...)`, leaving the actor idle. The stage can also reject `stage-radius` when idle path clips the disc at the random offset. V2.2.13 never preflighted the *incoming Finish* while choosing the hidden-end pose.
2. Pending staging was added only when selecting a compatible visual NORMAL36 (`if(accepted && ... preFinishHiddenNext)`). But the REAL gameplay player's PERFECT judgement is authoritative and independent of whether any optional QA animation satisfied placement. A random visual selection rejection could silently cancel the staging opportunity for an otherwise valid player Finish.
3. The HUD's `findLast(e.kind==="finish-ready")` could reuse a previous cycle's staging event when the next cycle had no preparation, masking this second cause.

The video itself shows the symptom but does NOT prove every failure is specifically radius; the code contains the above deterministic vulnerability. Actual browser playback/seed reproduction is a separate acceptance gate.

## Narrow V2.2.14 correction

- At the beginning of the existing HIDDEN37, sample the actual outgoing displayed pose and compute a fixed-audience-facing idle pose at Finish38.
- Preflight **both** the idle root path and the subsequent full 85_04 Finish path before committing the preparation. Try the outgoing XZ position first. If incompatible, find the **closest feasible destination** toward the stage center, and finally a small deterministic 2D candidate lattice, always checking the exact same 1.35m radius, introduced angular velocity, fixed audience entry facing, 85_04 spatial/continuation constraints and a root-return speed <=1.35m/s.
- If a nearby endpoint is needed, crossfade **both** full-body pose and root position continuously across the existing four hidden beats using a captured displayed pose and new playback endpoint offset. The first rendered frame uses the unchanged outgoing pose; no teleported root anchor, no modified global clock, no additional turn or SPACE. If the candidate does not exist, the engine explicitly records a failure rather than bypassing a protected dance or stage rule.
- Schedule the visual hidden preparation for every successful last-L9 NORMAL **gameplay judgement**, irrespective of whether the random NORMAL animation selection itself was accepted. Last-L9 NORMAL Miss remains an explicit per-player Finish veto and does not schedule preparation.
- HUD diagnostics for Finish38 reference ONLY this cycle's HIDDEN37 staging event, and expose the actual staging decision `hidden-finish-ready-in-place`, `hidden-finish-ready-recentered`, or the explicit rejection reason. A queued Finish is never shown as "ĐÃ PHÁT" unless a transition history record confirms the same canonical beat.

## Preservation / acceptance

- Gameplay real L9 unchanged: NORMAL36 → HIDDEN37 → FINISH38 (unless NORMAL36 Miss) → REST39–42. Repeat at 60/61/62.
- The source 85_04 window and Flare library are unchanged. NORMAL SPACE, protected floor contacts, gauge, 4beats/global turn, WebAudio authoritative clock, score, RoomState, Supabase and Character Catalog unchanged.
- Focused regression for random visual-normal placement failure still scheduling HIDDEN. Existing real pinned 85_04 source-focused test enhanced for multiple off-centre incoming roots at 120 and 200 BPM, with no initial teleport, stage radius enforcement, same-beat Finish and bounded positional changes. These are tests **authored**, not claimed executed until run.
- On owner iPhone: 120 and 200 BPM, replay >=5 successive randomly seeded Gameplay Preview runs each, assert HIDDEN prep and Finish transition status for EACH canonical L9 cycle. If any run still fails, capture full JSON with seed, normal36 phrase, preflight-stage decision and pending transition.
- Do not merge PR #19 or development/main without explicit owner approval.
