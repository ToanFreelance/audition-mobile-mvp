# Phase 1 Finish investigation

Status: owner acceptance pending. No development merge or Phase 2/3 work.

## Reproduction before planner changes

Baseline gameplay commit eb8faac. The newest unrelated Vercel deployment belonged to the retired character branch and was excluded.
Baseline cloud browser crashed in Stage3D when WebGL was unavailable. Commit 07b1e39 added optional-renderer fallback and debug/seed wiring **without changing planner logic**.

Observed real Aloha audio on that preview, seed 123, deliberately all-Miss (no seeking or alternate runtime):

| WebAudio ms | Global turn | Playable turn | State / evidence |
|---|---:|---:|---|
| 64698.440 | 22 | 24 | L5 penalty=1; global clock continues |
| 144698.425 | 56 | 57 | L7 command visible |
| 247628.439 | 100 | 110 | L9, sequenceIndex=6, Finish cycle=1, final=true, command hidden |
| 269518.407 | 109 | 110 | Finish visible; **all nine arrows blue**, no FINISH label |
| 276538.424 | 112 | 110 | ending, no command, gameEnded=false |
| 277432.018 | 112 | 110 | song-finished and DANCE COMPLETE result |

Finish target=271338.769ms; revealAt=269403.102ms; missed Finish resolves at zone exit=271778.154ms.
This reproduces the missing visual distinction. Song-end handling itself correctly waits for actual decoded audio end.

## Why Aloha does not repeat under the specified rules

Actual saved chart: BPM_exact=101.0504, spaceStartMs=10083, durationMs=277432.
Turn duration=2375.052449ms; ending reserve=2 turns; last playable target index=110.

- Initial normal appearances: 15 low-level + 24 high-level =39.
- First L6 target index=15; last normal L9 target index=61.
- Earliest Finish #1 target index=63, at159711.304ms.
- A full subsequent cycle has24 normal appearances plus1 Finish.
- From previous Finish to first L6:1 arrival turn +1 hidden pass.
- From first L6 through the next Finish:24 arrivals +24 hidden passes.
- Total=25 arrival turns +25 hidden passes=50 global turns. No rests or Miss penalties are included twice.
- Only110−63=47 turns remain. Earliest Finish #2 would be index113 at278463.927ms, beyond the audio itself even with zero ending reserve.

Therefore reducing50 to force a repeat would violate the current reveal/appearance rules.
The helper now exposes this cost breakdown; its default result remains50.
Misses add their explicit extra cost and can only reduce remaining capacity.
A default 600000ms deterministic chart (101.0544BPM, Space Start10060ms) produces Finish target indexes63,124,185,246; each intermediate Finish resumes L6.

## Changes

- Finish label and red reverse tokens are connected to the production runtime. Completed tokens become green; required input stays opposite for reverse tokens.
- Perfect streak comes from consecutive runtime judgements; Replay resets runtime and transport together.
- Song Select filters authored playable charts. Duration display uses seconds, exact BPM is displayed.
- Debug reports saved/decoded timeline, global and playable targets, Finish costs, remaining capacity, reveal, penalties and ending state. Normal UI hides diagnostics.
- Nine-command fitting and pointer touch behavior are small Phase 1 usability fixes; gauge component and calibration remain unchanged.
- /tools/solo-qa embeds the same production game in390×844 or430×932 for cloud inspection. It does not alter chart, audio clock or gameplay rules.

## Validation / remaining uncertainty

- Deterministic coverage includes full default cycles, saved Aloha timeline, per-player penalties independent of global time, repeat boundaries, reverse input and audio-end behavior.
- Local optimized Next build and TypeScript pass. The legacy prebuild analyzer tried a network fetch that this environment canceled; local build used existing generated output with npm --ignore-scripts run build. No analyzer tuning.
- Local browser-backed smoke tests attempted but Chromium exited with SIGSEGV before page creation. This is not reported as a test pass; cloud QA is separate.
- Only Aloha currently exists in saved music_charts. Cannon105 and Please Tell Me Why80.28 have synthetic formula coverage only; real saved-chart/audio regression remains pending.
- Command lengths1–9 are configurable and provisional; mixed-mode original video cannot conclusively settle Solo Easy lengths.
- The final Finish is currently held until the ending window. With perfect Aloha play this leaves a long no-command gap after154961.199ms until269403.102ms. This is a real gameplay pacing uncertainty requiring owner rule confirmation; no new turns or partial repeat have been silently invented.
- Real iPhone: dynamic toolbar/safe-area, rapid D-pad and opposite red input, SPACE timing at start/1min/2min/end, orientation, background/resume and final result require owner QA.
