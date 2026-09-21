# Phase 5 / P5.4 — Shared Countdown

Branch: `work/lobby-preload`.

P5.4 extends the accepted P5.3 ALL CLIENTS LOADED gate into one canonical shared countdown. It reuses the existing P4.2/P4.4 clock/start protocol and stops before WebAudio scheduling or gameplay navigation.

## Authority flow

`RoomState PRELOADING + ALL CLIENTS LOADED`
→ each human client collects NTP-style samples from `/api/multiplayer/clock`
→ client estimates server-clock offset from the lowest-RTT samples
→ a frozen human participant requests epoch issue
→ server validates the exact `matchId + roomRevision + startRevision`
→ server runs P4.4 clock-sampling/epoch issue
→ canonical RoomState transitions to `countdown`
→ immutable `startAtServerMs` is persisted in `matchStart`
→ every client derives 3/2/1/GO from that same epoch and its local server-clock estimate.

Realtime remains notification/delivery only. Canonical RoomState remains authority for the epoch and countdown phase.

## Countdown semantics

The countdown number is presentation only. A 100 ms UI refresh updates the displayed label from:

`estimatedServerNowMs = performance.now() + estimatedServerOffsetMs`

and then:

`deriveSharedCountdown(startAtServerMs, estimatedServerNowMs)`.

The interval does not own the countdown, does not issue gameplay turns, and does not trigger audio.

The shared epoch remains immutable after the server issues it. CAS contention between Host/Guest requests adopts the winning canonical snapshot instead of creating a replacement epoch.

## Reload / reconnect

A countdown RoomState persists:

- match/start identity;
- frozen MatchManifest;
- all participant load states;
- `phase = countdown`;
- `safeLeadTimeMs`;
- immutable `startAtServerMs`.

On reload/reconnect the client rehydrates the P4.4 session from canonical RoomState, resamples the server clock locally, and derives the current countdown position from the original epoch.

## Explicit stop

P5.4 does **not**:

- create or resume an AudioContext;
- map the epoch onto AudioContext time;
- schedule/play music;
- navigate to gameplay;
- create a gameplay WebAudio clock;
- advance global turns;
- implement P5.5.

P5.5 owns the shared epoch → local WebAudio scheduling/gameplay transition boundary.
