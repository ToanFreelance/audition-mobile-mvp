# Phase 5 / P5.3 — All Clients Loaded

Branch: `work/lobby-preload`.

P5.3 extends the accepted P5.2 PRELOADING handoff by executing the frozen match preload and persisting participant load state in the canonical server-owned RoomState. It stops at the all-loaded gate.

## Authority model

`RoomState PRELOADING + immutable matchStart binding`
→ local participant `IDLE → LOADING`
→ preload frozen match resources
→ P4.4 `MatchLoadedAck`
→ server validates exact `matchId + roomRevision + startRevision + content identity`
→ canonical participant `LOADED`
→ all required P4.4 participants loaded.

Realtime remains only a revision notification path. Reload/reconnect reconstructs the P4.4 session from the immutable matchStart binding plus canonical participant `loadState`.

## Reused P4.4 contracts

P5.3 does not introduce a second start protocol. It reuses:

- `markParticipantLoading`;
- `createLoadedAckForSession`;
- `applyLoadedAck`;
- `allClientsLoaded`;
- P4.4 stale match/revision/start/content rejection semantics.

Bots remain server-owned `loaded` participants.

## Preloaded runtime scope

The browser warms only resources used by the frozen Solo Easy match:

- selected authored music/chart metadata;
- selected audio bytes;
- participant character GLBs;
- frozen full published animation release, or the frozen built-in fallback contract;
- base humanoid animation library and Finish fallback resource;
- deterministic gameplay config identity.

Lobby idle-only animation is presentation-only and is not accepted as proof that gameplay animation content is loaded.

## Explicit stop

P5.3 does **not** start server clock sampling, issue `startAtServerMs`, render a countdown, create/start a WebAudio authoritative clock, navigate to gameplay, or implement P5.4/P5.5.
