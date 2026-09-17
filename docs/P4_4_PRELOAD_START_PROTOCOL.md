# Phase 4 / P4.4 — Preload / All Clients Loaded / Synchronized Countdown

Status: core start-protocol implementation on `work/multiplayer-clock`.

## Purpose

P4.4 introduces the pre-game start gate between the accepted waiting-room Ready contract and future P4.5 multiplayer gameplay integration. It does not move gameplay authority to the server/network and does not start actual multiplayer gameplay.

Authoritative flow:

`WAITING_ROOM → frozen MatchManifest → PRELOADING → ALL CLIENTS LOADED → server clock sampling → one immutable future startAtServerMs → epoch-derived 3/2/1 countdown → local AudioContext schedule → ready for P4.5`

## Match snapshot identity

The immutable `MatchManifest` now carries exact start-critical identity for:

- matchId / roomId / roomRevision;
- participant snapshots;
- songId;
- audio version + hash;
- chart version + hash;
- gameplay config version + hash;
- character runtime version;
- animation release version + hash;
- deterministic seed;
- exact BPM;
- authored Space Start;
- sequenceCounts;
- commandLengths;
- locked `finishRestTurns = 4`.

The frozen manifest is never mutated by the preload protocol.

## Ready vs Loaded

READY remains waiting-room consent only.

LOADED is a separate technical start-session state. Every active participant in the frozen manifest, including the host, must pass the LOADED gate. The host still has no Ready state. Open/closed empty room slots are not in the frozen participant list and therefore do not participate in the LOADED gate.

Bots may ACK immediately in QA, but they use the same versioned ACK validation path as humans.

## LOADED ACK semantics

Every ACK is bound to:

- roomId;
- matchId;
- roomRevision;
- startRevision;
- participantId;
- exact manifest/content identities.

Stale or mismatched ACKs are ignored/rejected and cannot satisfy the active gate. A cancelled start session rejects further ACKs. A restart uses a new `startRevision`, so delayed events from an older attempt cannot unlock the new start.

## Preflight resource contract

### Critical / exact-match

These must match the frozen manifest before LOADED can be accepted:

- selected audio version/hash;
- chart/command version/hash;
- frozen manifest version;
- deterministic gameplay config version/hash and seed-bearing manifest.

### Presentation resources with approved fallback

Character runtime and animation release identity are still represented in the ACK. The client may report `ready` or `fallback-ready` only when the required production resource or an already-approved safe runtime fallback is actually prepared. Optional cosmetics must not block the beat-critical start gate when the runtime can safely degrade.

This is not permission to skip character/animation initialization silently; it makes fallback readiness explicit and version-bound.

## Start epoch semantics

P4.4 defaults to a 4.5 second safe lead time and rejects configuration below 3 seconds. This is intentionally conservative relative to the accepted P4.3 iPhone QA RTT near 290 ms.

The epoch can only be issued after every active participant is LOADED and the session has entered server clock sampling. Once issued, `startAtServerMs` is immutable. A late client is reported as late by the existing P4.2 AudioContext mapping; the client never moves the room epoch independently.

## Countdown semantics

The visual countdown is derived from the same immutable `startAtServerMs` used for AudioContext scheduling.

`setInterval(1000)` may be used only to refresh presentation. It must not own the countdown number or trigger gameplay start independently.

## Authority boundary

P4.4 metadata may describe loading state, ACKs, cancellation/restart identity and the one start epoch. It does not carry player judgement, per-beat events, per-turn authority, frame-by-frame song time, or animation synchronization.

After local audio begins, WebAudio remains the authoritative gameplay/song clock inside each client. Network latency does not change seed, sequenceCounts, Finish cadence, command derivation or the global timeline.

## Deferred

- P4.5 gameplay integration;
- production kick/cancel/retry policy for a truly late device;
- authenticated/private-room hardening;
- Phase 5 lobby/waiting-room UI.
