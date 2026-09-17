# Phase 4 / P4.5 — Multiplayer Gameplay Integration

Status: core implementation started on `work/multiplayer-clock` after owner iPhone P4.4 PASS.

## Purpose

P4.5 connects the accepted shared start architecture to deterministic multiplayer gameplay without introducing a second gameplay clock.

Authority remains:

`shared startAtServerMs → local AudioContext schedule → local WebAudio song time → shared global turn → local player input/judgement/presentation`

The network distributes room/start/result metadata. It does not own beat, turn, song-time, judgement timing, gauge timing, or animation frame timing.

## Shared vs local state

The frozen `MatchManifest` owns immutable song/chart/config/seed identity.

Shared global state is derived from exact BPM, authored Space Start, absolute turn, and deterministic command derivation. Every client therefore derives the same:

- global absolute turn;
- level / sequence index;
- Finish turns;
- room-wide Finish rest;
- target SPACE time;
- canonical command/hash.

Player-local state may differ:

- input progress;
- judgement;
- score / combo;
- ordinary Miss/success command suppression;
- command visibility;
- character reaction/presentation.

Those local differences must never move the shared global turn or mutate the canonical command for any absolute turn.

## Core runtime seam

`multiplayer/gameplay-runtime.ts` is deliberately separate from the accepted Solo `RhythmRuntime`.

Reason: Solo runtime owns player-specific suppression and historically uses a sequential command PRNG. Multiplayer commands were locked in P4.1 as stateless `match seed + absoluteTurn + purpose` derivations so clients cannot diverge merely because their outcomes differ.

The multiplayer runtime therefore consumes `describeSharedTurn()` for canonical turns and uses `RhythmEngine` only for local score/combo judgement accounting.

It has no RAF, interval, network clock, or independent scheduler. The caller supplies WebAudio song time. Dropped render frames are handled by deterministic catch-up from that same song time.

## Finish

Finish remains a scheduled Level 9 shared turn and never ends the song.

Every Finish outcome uses the same `finishRestTurns = 4` room rest. For the accepted Aloha cadence this preserves:

`T38 Finish → T39–T42 room rest → T43 L6 visible`

Only AUDIO END ends gameplay.

## Current P4.5 split

Part 1:

- deterministic multiplayer gameplay runtime boundary;
- shared/global turn projection from WebAudio song time;
- stateless canonical command consumption;
- local input/judgement/score/suppression state;
- AUDIO END-only termination contract.

Next P4.5 parts will add focused QA/result transport integration and then the actual scheduled WebAudio start seam. Production Phase 2 HUD and Phase 3 character files remain untouched unless an explicit integration blocker is demonstrated.
