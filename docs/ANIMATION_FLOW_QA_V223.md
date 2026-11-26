# Animation Flow V2.2.3 — Immediate SPACE & Living Continuity

Branch work/animation-flow-qa-v2, PR #19 Draft, baseline 6c9ea53467fc9ea970e83bda03e8a23b662e147d. Isolated QA route /tools/animation-flow-qa-v2; not a production rollout.

## Owner feedback
iPhone L5 screenshot shows "Đã nhận SPACE · đợi exit tại beat 65.00". Ten extra normal choreography phrases had BEAT_WINDOW markers only at clip end. The WebAudio-driven four-beat gameplay turn kept progressing but animation could be delayed or clamped at one-shot end. Audition 110/200 BPM references show prompt animation transition after successful SPACE, continuous performance/intentional idle between commands, and Finish dismount → brief standing idle → L6.

## Implementation
- Opt-in SessionChoreography.instantGameplay only for Gameplay Preview. Successful ordinary SPACE evaluates placement against the ACTUALLY DISPLAYED pose and commits its normal choreography at the judgement beat; no BEAT_WINDOW wait on eligible core/idle. Protected ranges, special/fixture, Flare and Free Lab retain existing safety rules. Finish Flare also starts directly from unprotected ordinary SPACE, with stage/body/time validation intact.
- For a normal one-shot reaching its end during HIDDEN/no-new-command, insert an ambient rest-standing movement when placement is safe. This is not a fake gameplay command. Authored seam-closed idle cycles while waiting. Telemetry continuityEvents records its start and rejection reasons. If no safe placement is possible, it reports failure rather than claiming success.
- Flare performs the same imported power move and root/contact-aware dismount. Reserve one final musical beat for a living standing idle (83_01 tail) before L6. Existing 0.2s settle plus this beat plays gentle motion, rather than a frozen pose. Tempo-adjust entry/dismount only above 160 BPM so Flare remains eligible at 200 BPM, without extending REST.
- Enable 110/120/160/200 BPM preset controls. Existing AudioContext beat clock already accepts up to 200. The Lab-only Exit Policy override cannot override Gameplay instant transitions.
- Retain 16 normal phrases, 2 old Finish candidates, current CMU/Flare skeleton pipeline, stage root radius 1.35. No changes to WebAudio production, RoomState, gauge, planner, scheduler, sequenceCounts, Character Catalog or accepted assets.

## Validation / acceptance
- Add e2e/animation-flow-v223-space-continuity.spec.ts for 110/120/160/200 BPM × fades .15/.35/1, exact normal SPACE visual start, pending absence, living-idle telemetry and source animation motion, Flare end idle, turn 38/62 and L6 43.
- Existing V2/V2.1/V2.2/V2.2.1/V2.2.2 tests must remain unmodified. Special/fixture protected exits stay delayed.
- Still synthetic QA loop; owner iPhone WebGL visual gate remains open. Contact proxy is not contact proof, and BPM reference for CMU is still an assumption.
- In reports, distinguish verified build/TS checks from e2e tests actually executed. Do not claim pass if tools cannot execute test suite.
