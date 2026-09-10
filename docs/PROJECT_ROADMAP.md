# Audition Mobile roadmap

Active: **Phase 1 — Solo Easy core gameplay**, branch `work/solo-easy-gameplay`.
Owner acceptance and real iPhone QA are pending. No merge to development yet.

| Phase | Scope | Status |
|---|---|---|
| 0 | Music Config, exact BPM, authored Space Start, FINAL RHYTHM v4, WebAudio | Substantially complete; preserve calibration |
| 1 | Solo Easy commands, progression, penalties, Finish, song result | Active: Finish reproduction and correctness |
| 2 | Portrait HUD and iPhone UX | Gated on Phase 1 acceptance |
| 3 | Human character, animation controller, cross-fades | Planned; no prototype cherry-pick into Phase 1 |
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

## Architecture invariants

- Global timeline derives from absolute WebAudio song time: target(N) = authored Space Start + N × 240000 / BPM_exact. Player results never move the clock.
- Player command visibility, penalty, score and progression are separate from global turns. Hidden turns exist and do not recursively Miss.
- Saved chart must have audio URL, title and positive exact BPM, duration and authored Space Start. Never generate missing timing.
- Preserve AuditionGauge geometry, Perfect center, breathing/stretch and scoring thresholds. Do not retune FINAL RHYTHM v4 without a reproducible analyzer regression.
- Sequence means playable appearances; command length is independent. Finish is special Level 9 with reverse input. Only actual audio end produces song result.
- Future networking synchronizes chart version and song epoch; clients render locally. Never stream slider positions per frame.
- Character animations never control rhythm. Future assets require clear provenance/license in docs/ASSET_LICENSES.md; modular clothing should share a compatible humanoid rig.

## Delivery gates

Latest accepted development → work branch → local build/typecheck/tests → Vercel Preview → cloud QA → owner iPhone acceptance → squash/merge development → final development QA.
No direct development/main commits. No GitHub Actions workflows. Phase 1 must stop at owner acceptance; Phase 2 starts on a new branch only after development final QA.
