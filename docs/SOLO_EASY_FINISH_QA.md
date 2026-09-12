# Phase 1 Solo Easy — Final QA

**Status: OWNER QA ACCEPTED / READY FOR FINAL INTEGRATION GATE**

This document is the final Phase 1 Solo Easy and Finish behavior record for `work/solo-easy-gameplay`.

## Authoritative architecture

- WebAudio is the authoritative song clock.
- One global turn equals four beats.
- `sequenceCounts[level]` is the total global-turn budget of that level.
- Playable, hidden, suppressed and penalty turns consume existing global-turn slots.
- Suppression may cross a level boundary.
- Suppression never pauses, repeats, rewinds, creates a replacement turn, creates an extra global turn or extends a level.
- Player state does not own the clock.

## Deterministic progression

The initial Solo Easy schedule is:

| Level | Global turns |
|---|---:|
| L6 | 15–20 |
| L7 | 21–26 |
| L8 | 27–32 |
| L9 | 33–38 |

L6→L9 consumes exactly 24 global turns.

For Aloha with `seed=123`, Finish positions are:

`38, 62, 86, 110`

Post-Finish behavior:

`38 Finish → 39–40 hidden → 41 L6 visible`

## Boundary Miss behavior

- L5 final-turn Miss: `14 L5 Miss → 15 L6 hidden → 16 L6 visible`.
- L6 final-turn Miss: `20 L6 Miss → 21–22 L7 hidden → 23 L7 visible`.

These hidden turns consume the destination level's existing budget. They do not add time or turns to the preceding level.

## Finish behavior

- Finish label is visible.
- Finish uses the red reverse-token treatment.
- Input judgement uses `requiredDirection`.
- A correctly completed reverse token renders `requiredDirection`.
- Perfect Finish is scorable.
- Finish does not end the song.
- The post-Finish hidden interval completes on the running global timeline, after which L6 commands return and gameplay continues.

## Game-end authority

Only actual AUDIO END ends gameplay and produces the song result. Finish is never itself the game-end condition.

## Owner QA accepted observations

- No duplicate turns on Miss.
- Cross-level suppression behaves correctly in current owner testing.
- Finish is visible and scorable.
- Reverse Finish input and rendering work correctly.
- Post-Finish rest occurs.
- L6 commands return after Finish.
- Gameplay continues normally after Finish.

## Validation evidence

- Vercel deployment for `afcfae40fa5e8a629720850f67502fde71015048`: PASS.
- Owner real-iPhone QA for the current Phase 1 behavior: PASS / ACCEPTED.
- Latest Work local automated tests/build: **NOT RUN — dependencies unavailable in Work checkout**.
- Static source and test review confirms global-turn budgets, cross-boundary suppression, Finish cadence, reverse rendering and AUDIO END authority.

## Phase 2 presentation debt

- Level 9 long command layout.
- Portrait spacing and safe areas.
- iPhone dynamic browser-toolbar behavior.

These are presentation concerns and are not Phase 1 scheduler blockers. Phase 2 must preserve the WebAudio/global-turn architecture, `sequenceCounts` semantics, suppression behavior, Finish cadence, calibrated gauge and AUDIO END game-end authority.
