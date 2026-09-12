# Audition Mobile roadmap

Phase 1 — Solo Easy Core Gameplay is complete for the current scope. Owner iPhone/Vercel QA is accepted, and final documentation/integration closeout is in progress. The next repository action is a clean fast-forward of `work/solo-easy-gameplay` into `development`.

| Phase | Scope | Status |
|---|---|---|
| 0 | Music Config, exact BPM, authored Space Start, FINAL RHYTHM v4, WebAudio | Complete; calibration preserved |
| 1 | Solo Easy commands, progression, penalties, Finish, song result | Complete; owner QA accepted; awaiting final integration |
| 2 | Portrait HUD / iPhone UX | Next planned phase; starts only after Phase 1 integration and final gate |
| 3 | Human character, animation controller, cross-fades | Planned |
| 4 | Multiplayer shared song clock | Planned |
| 5 | Room, lobby, ready and mode selection | Planned |
| 6 | Additional game modes | Planned |
| 7 | Account, profile, progression | Planned |
| 8 | Modular humanoid clothing, accessories, inventory | Planned |
| 9 | Shop and server-validated economy | Planned |
| 10 | Friends, invitations, presence, chat | Planned |
| 11 | Versioned charts/assets, admin and live operations | Planned |
| 12 | Reconnect, security, telemetry, mobile performance | Planned |
| 13 | Content rights and distribution review | Required before commercial release |

## Phase 2 locked production visual contract

- The Portrait Mobile Gameplay Sketch (`IMG_1975.jpeg`) is the final production UI source of truth; Phase 2 mobile gameplay UI reproduces it 1:1 rather than reinterpreting it.
- Character and stage/background fidelity are deferred until their corresponding phases.
- Locked gameplay architecture and semantics take priority if a visual reference conflicts with them.
- Owner iPhone visual QA is the final visual acceptance gate.

## Phase 1 architecture invariants

- WebAudio is the authoritative song clock. A global turn is four beats: `target(N) = authored Space Start + N × 240000 / BPM_exact`. Player results never move the clock.
- `sequenceCounts[level]` is the **total global-turn budget** of that level. Playable, hidden, suppressed and penalty turns all consume the same existing global-turn budget.
- Hidden and suppressed turns may cross level boundaries. They must not pause, repeat, rewind, create replacement turns, create extra global turns or extend a level.
- Command length is independent from `sequenceCounts`.
- Player command visibility, penalty, score and progression remain separate from the authoritative global timeline. Hidden turns do not recursively produce Miss results.
- Saved charts require an audio URL, title, positive exact BPM, duration and authored Space Start. Missing timing is never generated as a fallback.

## Finish invariants

- Finish is a Level 9 special command that owns an existing scheduled global turn.
- Finish preserves its label, red special treatment and reverse token. Input judgement uses `requiredDirection`; a completed reverse token renders `requiredDirection`.
- Finish is not a game-end condition. Only actual AUDIO END ends gameplay.
- With Aloha and `seed=123`, the deterministic Finish cadence is `38, 62, 86, 110`.
- Post-Finish behavior is `38 Finish → 39–40 hidden → 41 L6 visible`; the timeline continues normally afterward.

## Cross-level suppression examples

- `14 L5 Miss → 15 L6 hidden → 16 L6 visible`.
- `20 L6 Miss → 21–22 L7 hidden → 23 L7 visible`.

## Gauge and presentation constraints

The calibrated gauge geometry, Perfect center, breathing/stretch behavior and scoring thresholds are preserved. Phase 2 must not redesign, rebalance or recalibrate the gauge unless separately scoped and validated.

The known Level 9 long command layout, portrait spacing/safe-area work and iPhone dynamic browser-toolbar behavior are Phase 2 presentation debt, not Phase 1 scheduler blockers.

## Delivery gates

The integration path is:

`work/solo-easy-gameplay → owner review / final gate → clean fast-forward to development → development final QA → Phase 2 branch from development`.

When the source branch is a linear descendant of `development`, integration uses a non-force fast-forward and does not require a squash or merge commit. No direct `main` update is part of the Phase 1 closeout.
