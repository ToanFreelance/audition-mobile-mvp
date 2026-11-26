# Animation Flow V2.2.11 — SPACE Crossfade, Selected Finish in Gameplay, L9 Scheduler Audit

Repository: ToanFreelance/audition-mobile-mvp
Work branch: work/animation-flow-qa-v2, PR #19 Draft, base development.
Baseline: ecfc4eb1aa7a330100ff144300070d7901f2bed1.
Owner iPhone source: Video-test(20261021-070013).mp4 (60.53sec, 512x1106, 200 BPM).

## Findings grounded in actual code and owner footage

1. At 200 BPM, the owner's 0.35-beat crossfade is 0.105 seconds. SourceFlowEngine interpolates whole-body quaternions during this tiny interval, making pose changes on valid normal SPACE look abrupt even though the start beat is correct.
2. The owner-selected Fancy Footwork 85_04 is confirmed to work in ISOLATED Finish replay. At actual gameplay Finish, however, SessionChoreography.compatible required BOTH an immediate stage placement and canFollowAtEnd() against the STATIC unaligned recover-narrow template. FinishPresentation actually builds a grounded/mirrored/adapted recovery dynamically from the displayed Finish exit pose, so the early static recovery test falsely rejects otherwise valid Fancy candidates. In this case no request(id) was made, so NORMAL/REST continued while the HUD still showed the selected option.
3. The iPhone video shows L9 turn 36 HIDDEN, turn37 NORMAL and turn38 FINISH, then REST; 85_04 is selected but not necessarily started. Do not conflate Finish slot display with actual animation transition.
4. Verified separately on production source-of-truth files ON development:
   - `game/solo-easy.ts` sequenceCounts [1,2,3,4,5,6,6,6,6], L9 ordinary indices 0..4, Finish index5.
   - `multiplayer/determinism.ts` firstFinishTurn=38; global turn37 = L9 normal #5/6, turn38 = Finish #6/6.
   - `multiplayer/gameplay-runtime.ts::resolve` skips HIDDEN/MISS suppression when the next turn is Finish (`while (... && !describeSharedTurn(...).isFinish)`). Thus, whether the preceding SPACE was PERFECT or MISS, there is **no HIDDEN between global turn37 and Finish38**. Turn36 can be HIDDEN from the earlier successful L9 normal turn35, and 39–42 are REST. Do not edit the actual multiplayer scheduler.

## Focused fixes

- In `SourceFlowEngine.commit()` calculate incoming-vs-displayed current quaternion difference and allocate a longer **presentation-only** crossfade when the requested fade in 200BPM would last merely ~105ms; bounded at 0.9 beat (max 0.27 sec at 200BPM). Do NOT modify request beat, visualStartBeat, scoring, phrase playback rate, protected transitions, Finish/Flare or global turn count. Honor longer owner-selected fades.
- For `finish-85-04` only, keep strict incoming path-radius, audience-relative placement, heading entry/exit, protected range, and immediate valid global Finish judgement; skip the incorrect static unaligned recover-narrow `canFollowAtEnd` preflight. Let FinishPresentation build the actual dynamic recovery at Finish exit. All other Finish selection rules unchanged.
- Show *accepted/denied Finish* with selected ID, global turn, actual visual beat and placement rejection reason in Gameplay HUD immediately beside Preview. Never suggest that a red Finish command confirms Fancy animation actually played.
- Add regression covering real shared scheduler L9 turn37 NORMAL → turn38 FINISH, prior HIDDEN36, REST39–42; a mock regression proving unaligned recovery alone cannot veto the specifically selected Fancy Finish; and 200BPM UI smoke.

## Remaining risk and acceptance criteria

- At L9 Finish38 verify the engine transition history `b === "finish-85-04"` and `requestedBeat === visualStartBeat` when the outgoing phrase is not protected; if rejected for radius/heading the visible HUD must disclose that rather than silently substituting a normal dance.
- Owner iPhone video remains the PRIMARY motion acceptance gate. 0.9 beat cap is a QA visual adjustment; confirm motion continuity and root-anchor stability at 110,120,160,200 BPM and 0.15,0.35,1 fade. A Vercel Next.js build is NOT a Playwright or full motion QA pass.
- Dynamic recovery may still fail placement at the actual Finish exit; this is reported in FinishPresentation events; do not force invalid contacts, extraneous turns or radius offsets.
- Vercel Sandbox was already HTTP402 (Hobby sandbox limit until 2026-11-01), so browser execution cannot be claimed without another available authorized runner.
- Flare is the accepted default; 85_04 remains optional QA Finish. No modifications to development/main, WebAudio authoritative 4beats, global sequence counts, gauge, RoomState CAS/Supabase, accepted rigs/stages or Finish-as-AUDIO-END semantic. PR #19 stays Draft.
