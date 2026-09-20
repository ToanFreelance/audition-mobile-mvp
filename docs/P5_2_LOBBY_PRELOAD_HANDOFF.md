# Phase 5 / P5.2 — Lobby → Preload Handoff

Branch: `work/lobby-preload`.

P5.2 connects the accepted P5 waiting-room Start action to the existing P4.4 preload/start protocol. It does not preload assets, accept LOADED ACKs, sample the server clock, issue a countdown epoch, start audio, or enter gameplay.

## Authoritative transition

`WAITING RoomState@N → frozen MatchManifest@N → P4.4 MatchStartSession(startRevision) → PRELOADING RoomState@(N+1)`

The canonical room snapshot persists only the immutable start binding needed to reconstruct the P4.4 preloading session:

- matchId;
- frozen roomRevision;
- startRevision;
- safe lead time;
- immutable MatchManifest.

Realtime remains a notification/delivery layer. Host and Guest recover the same preloading identity from the server-owned room snapshot, including after a snapshot refetch.

## Invariants

- Host only may create the start session.
- The waiting-room Start gate must pass before the handoff.
- MatchManifest must still match the authoritative waiting-room revision.
- Server CAS owns the waiting → preloading transition.
- Double Start cannot replace an active preloading session.
- Guest receives the exact same matchId, frozen roomRevision and startRevision.
- P4.4 participant load state begins at IDLE. P5.3 owns actual preload + LOADED ACK.
- No countdown, audio scheduling or gameplay timeline is introduced here.
