# Phase 4 / P4.5 — Multiplayer Gameplay Integration

Status: implementation on `work/multiplayer-clock` after owner iPhone P4.4 PASS.

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

## Shared epoch → WebAudio

`multiplayer/audio-gameplay-start.ts` is the P4.4→P4.5 integration bridge.

It maps the immutable `startAtServerMs` through the accepted P4.2 offset estimate onto the local AudioContext timeline, creates the local multiplayer runtime with `WebAudioTransport.getCurrentTimeMs()` as its time source, and schedules the decoded audio buffer at that exact AudioContext time.

`WebAudioTransport.playAtContextTime()` rejects an already-past epoch rather than silently moving one client to a replacement start time. The late-device room policy remains separate from clock authority.

## Finish

Finish remains a scheduled Level 9 shared turn and never ends the song.

Every Finish outcome uses the same `finishRestTurns = 4` room rest. For the accepted Aloha cadence this preserves:

`T38 Finish → T39–T42 room rest → T43 L6 visible`

Only AUDIO END ends gameplay.

## Result transport

P4.5 adds `player-judgement` as player-local result metadata. It is bound to match/start identity by the envelope and carries the participant, absolute turn, judgement, song-time, target, level, Finish flag, and canonical command hash.

This event may feed remote presentation/leaderboard state. It is explicitly not a command to advance the global turn. Server-authoritative anti-cheat/result verification remains later hardening scope.

## Deterministic QA

`/tools/multiplayer-qa` now includes P4.5 checks for:

- divergent Perfect/Miss local outcomes while global turn remains identical;
- canonical command identity independent of local suppression;
- T38 Finish outcome divergence converging on shared T43 resume;
- dropped-frame catch-up from WebAudio time;
- AUDIO END-only match termination;
- judgement metadata generation;
- real Supabase transport of result metadata without turn authority.

Playwright is not required for the current owner-validation pass.

## Non-goals

- Phase 5 lobby / 3D waiting room;
- broad Phase 2 HUD redesign;
- Stage3D redesign;
- gauge recalibration;
- server-authoritative anti-cheat;
- per-beat/per-turn/song-time network synchronization.
