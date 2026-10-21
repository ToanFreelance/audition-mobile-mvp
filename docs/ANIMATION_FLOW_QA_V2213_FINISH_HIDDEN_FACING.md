# Animation Flow V2.2.13 — Fix Fancy Footwork 85_04 failing phrase-facing at actual L9 Finish

Repository: ToanFreelance/audition-mobile-mvp
Branch: work/animation-flow-qa-v2, PR #19 Draft/unmerged
Prior HEAD: 9563adce44a72fe79fd0d751f796dc12027b56b8
Owner iPhone: IMG_3562.png, 200 BPM, Finish choice Fancy Footwork 85_04, selected BVH source window 6.6–14.4 seconds.

## Reproduced failure as evidence

On L9 canonical global Finish 38 the HUD says:
`FINISH TURN 38 · KHÔNG PHÁT finish-85-04 · phrase-facing`.
The selected isolated Finish replay succeeds. The LIVE gameplay transition fails because replay starts 85_04 at the origin from a neutral heading, whereas actual Finish is appended to the dynamic outgoing NORMAL choreography. Previously V2.2.12 exempted non-upright protected interior/dismount yaw but still enforced incoming entry-facing ≤60° and incoming rotation delta ≤45°, so a source clip passing standalone need not be admissible after random HIDDEN bridges. Merely allowing larger yaw on Finish is not a safe fix.

## Implementation V2.2.13

1. Consume the ALREADY-BUDGETED L9 HIDDEN global turn preceding Finish as a **visual-only, beat-authoritative preparation window**.
2. On successful last L9 NORMAL only, SessionChoreography schedules prepare at hidden global target beat (N+4) and Finish at (N+8), without synthesizing any SPACE, scoring judgement, global turn, or music timing change.
3. SourceFlowEngine.stageForFancyFinish:
   - samples the ACTUALLY DISPLAYED outgoing pose exactly at hidden-start beat;
   - uses the already-prepared, closed-seam `rest-standing` source, locks the stage anchor and outgoing XZ offset, validates its ENTIRE path against the unchanged 1.35m radius;
   - chooses idle yaw so the clip will face the fixed stage audience at the exact Finish target, not by snapping at the end;
   - crossfades smoothly from captured pose over hidden 4 beats (minus 0.15 beat margin), with bounded yaw angular velocity and no pose/root instant jump;
   - DOES NOT interrupt current source if it is inside a protected contact/flip interval. In that case reports `protected-outgoing-contact`, not a false PASS.
4. At Finish global turn, the existing `finish-85-04` entry facing, stage-radius and transition-heading gates remain intact; there is no blanket relaxation and no forced animation placement.
5. Choreography counts Fancy Finish as actually accepted only if transition history records `finish-85-04` with `requestedBeat===visualStartBeat===FinishBeat`. A queued protected request is NOT reported as visually started (and any pending target for that attempt is cleared).
6. Gameplay HUD displays both the Finish decision and HIDDEN preparation result (PASS or failure reason) plus actual facing error on rejection. Previous ordinary CORE/SPACE, Flare, root anchoring, recovery and REST scheduling unchanged.
7. Test suite adds real pinned CMU source (111_05 canonical, 83_01 standing, 143_35 normal, 85_04 selected 6.6–14.4): verify smooth, stage-bounded idle preparation inside hidden 4 beats, audience heading at Finish, and exact same-beat 85_04 start for 120/160/200 BPM. Update old regression tests that mistakenly expected NORMAL37 rather than HIDDEN37 and that expected a Finish after last-NORMAL Miss.

## Invariants and risk

- Actual Gameplay rules from V2.2.12 remain NORMAL36 → HIDDEN37 → FINISH38 (if NORMAL36 not Miss) → REST39–42, and repeat at 60/61/62.
- Miss on NORMAL36 causes immediate living idle, local Finish denied, no extra turn; other players independent.
- WebAudio authoritative, 4 beats/global turn, sequenceCounts, gauge locked. Only AUDIO END ends game.
- The hidden stage anticipation is QA motion staging, not a new production Character Catalog asset; 85_04 remains QA source until approved/published.
- A large pre-Finish root displacement can still fail the stage-radius check; a protected ordinary motion can still reject early interruption. Both must be visible and must NOT be silently overridden. A build PASS is not an iPhone visual or source-motion acceptance.
- Test execution only claimed if actually run; Sandbox capacity may prevent focused browser Playwright. Do not merge PR #19 or development/main.
