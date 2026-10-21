# Animation Flow V2.2.10.1 — 85_04 Finish Replay Must Actually Start

Repository: ToanFreelance/audition-mobile-mvp
Working branch: work/animation-flow-qa-v2, PR #19 Draft, base development.
Baseline: 23912d1ee67909a4bf1c76700b04717c3b818d5e.

## Owner evidence / failure

2026-10-21 iPhone 11-second recording Video-test(20261021-053229).mp4:
- At 0.5s Finish picker still shows older 'wide stance' finish.
- Around 5–7s owner selects 'FINISH · Fancy Footwork (85_04 · thử nghiệm)' and activates nearby 'Xem Finish'.
- At 6.5 and 9.7s the quick-status label still reads **'85_04 · chưa tải đoạn dài'**.
- The rendered/telemetry dancer is instead **Macarena 143_35**, followed by **REST 83_01**; the visible 85_04 Finish never starts.

This is a replay integrity defect, not evidence of inadequate 85_04 source footage. The previous V2.2.10 commit added long-window analysis and compact controls, but the generic replay path still started a random/old normal choreography ('143-party') and set a one-shot `replayTarget` request at a later beat. The subsequent `advance()` unconditionally cleared that request whether `engine.request()` succeeded or not. Therefore source 85_04 could be selected in the UI while a different animation played. Additionally, the prepared phrase cache could be treated as valid even without the new long-window metadata.

## Focused correction

1. For **isolated non-Flare Finish replay**, after preparing and resetting the QA session, directly start the exact selected phrase with `SourceFlowEngine.start(id,0)`, then call `FinishPresentation.begin(id,0,null)` and `update(0)`. This is a dedicated source QA presentation from beat0, not a fake shared Gameplay Finish turn; real Gameplay events continue to use the existing authoritative global 4-beat turn schedule. The `engine.start` creates real transition history consumed by FinishPresentation; there is no ad-hoc animation timer.
2. Preflight each candidate long 85_04 source interval with an actual isolated `engine.start` placement check, not only root travel. Reject candidate windows violating stage/facing. Never warp root path or compromise Flare. Reset to a known QA pose if no interval is suitable and surface the exact failure.
3. Treat a cached `finish-85-04` phrase without `finishWindowRef` as stale and force re-prepare.
4. Show `current` animation ID, FinishPresentation phase and beat adjacent to preview, plus a prominent exact error if preparation/start fails. This prevents false visual success if the user merely changes dropdown values.
5. Keep the existing dynamic source-window selection, budget derived from the shared manifest, Finish recovery/idle, and the approved Flare untouched.
6. Tighten Playwright smoke so selecting 85_04 must show a real source-time range (not 'chưa tải'); pressing 'Xem Finish' must show `finish-85-04` and `FINISH_ACCENT` in telemetry, without a Finish error. Vercel build alone is not runtime PASS.

## Remaining acceptance gates

- User iPhone 85_04 visibly dances for a meaningful duration, then recover-narrow / idle before L6 with no extra/repeated global turns.
- Any failure finding safe Finish entry/exit and recover must be reported, not replaced silently by Macarena/REST.
- Dedicated isolated Finish replay is visibly labeled as QA, not an actual gameplay Finish event. Actual L5 and L9 still need owner tests separately.
- Playwright motion integration and physical retarget/foot-contact acceptance remain open until actually executed.
- No modifications to production WebAudio clock, 4 beat global turns, gauge, Character Catalog, multiplayer/CAS/Supabase, stages, development/main. PR #19 remains Draft; no merge.
