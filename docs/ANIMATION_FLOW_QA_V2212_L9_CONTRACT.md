# Audition L9 Closing Contract V2.2.12 — Owner Approved

Repository ToanFreelance/audition-mobile-mvp
Working branch work/animation-flow-qa-v2; PR #19 Draft, base development
Baseline work HEAD aedfbd255dcd1d1787c0021f915bd9e7e02c27

## Explicit owner rule (2026-10-21)

At EACH L9 Finish cycle:
- Canonical global turn Finish-2 is the **last playable NORMAL**.
- Global turn Finish-1 is an unconditional **HIDDEN** (no player command).
- Global turn Finish is the original protected **FINISH** (red, reverse arrow).
- If and only if that last playable NORMAL is MISS, this player is denied Finish and enters living IDLE immediately at Miss, remaining idle for the reserved HIDDEN, suppressed Finish and full shared REST (turns Finish+1 .. Finish+4).
- Other players still Finish independently if they passed that NORMAL. No player outcome rewinds, pauses, inserts or deletes any global turn.
- AUDIO END alone ends the game.

With frozen default settings (sequenceCounts[9]=6, 0-based turn IDs):
L9 T1=33, T2=34, T3=35, T4=36 **NORMAL last**, T5=37 **HIDDEN always**, T6=38 **FINISH conditional**.
REST39–42 unchanged. Repeated cycle last normal60, hidden61, Finish62.
T35 resolution is a special guarantee for T36: do not let a success-HIDDEN or Miss penalty eat the last guaranteed NORMAL. Earlier hidden slots are subject to the ordinary suppression rules. No extra turns; unavoidable exception is explicitly scoped to the last L9 NORMAL.

## Implementation surfaces

Real multiplayer source:
- multiplayer/determinism.ts: pure deterministic helpers for last-NORMAL and pre-Finish HIDDEN slots; canonical command hash, targetSpaceMs and Finish index remain frozen.
- multiplayer/gameplay-runtime.ts: player-local Finish veto and pre-Finish suppression; snapshot exposes denied Finish turn. A successful last NORMAL advances command to original Finish38 via existing HIDDEN37. On Miss, skip eligibility for Finish and only reveal a new command at original post-REST turn43 (if audio still active).
- components/multiplayer/LiveMultiplayerGameplay.tsx: on last-NORMAL Miss present a dedicated living-IDLE character event immediately rather than a full Miss reaction; no actor recreation and no AnimationMixer reset.
- components/character/character-types.ts, CharacterAnimationController.ts: the explicit per-player idle event is a presentation-only control; locked rhythm/scoring remains under runtime.

Solo Easy production:
- game/runtime.ts: same 3-slot L9 closing cadence within existing appearance sequence and current post-Finish planning. Last-NORMAL Miss skips local Finish and enters existing post-rest handling, without moving any global slot.
- components/GameShell.tsx: turn-local Miss on last L9 NORMAL presents immediate living IDLE.

Isolated Preview:
- lib/animation-flow-v2/gameplay-preview.ts derives eligibility from REAL MultiplayerGameplayRuntime. Suppressed Finish shown as FINISH_BLOCKED (not falsely red FINISH) with no auto SPACE.
- lib/animation-flow-v2/session-choreography.ts: a local idle request at last NORMAL Miss; no extra judgement.
- app/tools/animation-flow-qa-v2/AnimationFlowV2.tsx: explicit Miss report and disabled Finish status in QA HUD.
- lib/animation-flow-v2/engine.ts: 85_04 protected floor spinning Finish still uses strict ENTRY audience orientation, root path/stage radius and entry transition angular limit. Only the *non-upright dismount Hips yaw* is no longer treated as a ground-standing exit-facing rejection; dynamic FinishPresentation recovery must actually place and reorient character. Other CORE/SPACE and Flare safety unchanged.

## Acceptance and risks

Focused e2e test at 120/200 BPM verifies shared turn36/37/38, local success and Miss players, return at43, second Finish at62; no new global turns. Existing gameplay QA simulation seeds a success at final normal so it continues to test Finish success versus Miss at Finish. Remaining tests (real iPhone visual, physical asset retargeting, recovery contact, solo playback through song end, Playwright integration) are NOT claimed passed unless executed.

The source-normalized QA 85_04 is NOT automatically installed as production Character Catalog animation. Actual multiplayer stage still uses accepted runtime presentation assets (Character Catalog). Production mechanical rule + idle are implemented, but owner must separately approve runtime rig retarget/asset publishing before 85_04 can appear on production character meshes.

Branch rules: commit work branch only, PR #19 stays Draft/unmerged; do NOT edit/merge into development/main.
