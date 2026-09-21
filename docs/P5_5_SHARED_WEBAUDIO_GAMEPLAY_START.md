# Phase 5 / P5.5 — Shared WebAudio Gameplay Start

Branch: `work/lobby-preload`.

P5.5 connects the accepted P5.4 immutable shared start epoch to the existing P4.5 multiplayer gameplay runtime.

## Authority flow

`RoomState COUNTDOWN`
→ one immutable `startAtServerMs`
→ local NTP-style server-clock estimate
→ local AudioContext schedule derived from the same epoch
→ `WebAudioTransport.playAtContextTime()`
→ `MultiplayerGameplayRuntime` reads only `WebAudioTransport.getCurrentTimeMs()`
→ deterministic global turn / level / Finish / command
→ player input and judgement remain local.

P5.5 does not introduce a second gameplay clock.

## Reused architecture

P5.5 reuses the already-accepted P4.5 bridge:

- `multiplayer/audio-gameplay-start.ts`
- `multiplayer/gameplay-runtime.ts`
- `multiplayer/shared-clock.ts`
- `game/web-audio-transport.ts`

The Solo `RhythmRuntime` used by `GameShell` is intentionally not reused for multiplayer because its player-specific sequencing seam is different from the stateless shared-turn derivation locked in P4.1/P4.5.

## Mobile WebAudio activation

Safari/WebKit may require WebAudio activation from a user gesture.

P5.5 therefore creates/resumes a reusable AudioContext from existing lobby gestures:

- Guest Ready;
- Host Start.

The context is later injected into the gameplay `WebAudioTransport`. Creating/unlocking the context does not start music and does not own gameplay timing.

If a countdown page is reloaded and user activation is unavailable, the lobby exposes an explicit audio-activation button. Re-activation never moves `startAtServerMs`. If the immutable epoch is already late, the client reports LATE rather than inventing a replacement start.

## Audio preparation

P5.3 already warms the frozen audio bytes. P5.5 decodes the same frozen audio into the user-unlocked AudioContext while PRELOADING continues.

The multiplayer transport uses `force-cache` so it can reuse P5.3's warmed audio response instead of downloading the full track again inside the 4.5 second start window. Existing Solo transport behavior remains unchanged.

The resolved audio/chart metadata is revalidated against the frozen MatchManifest before scheduling.

## Shared schedule

Every human client calls the existing `scheduleMultiplayerAudioGameplay()` with:

- the restored canonical MatchStartSession;
- the local participant identity;
- the decoded WebAudioTransport;
- the local estimated server-clock offset.

The bridge maps the same `startAtServerMs` onto each local AudioContext.

A late mapping is terminal for that attempt:

- no local epoch replacement;
- no server epoch replacement;
- no seek-to-catch-up workaround.

Production late-device recovery policy remains hardening scope.

## COUNTDOWN → PLAYING

The visual transition into gameplay is derived from the same shared epoch.

At/after the epoch:

- the client switches from lobby presentation to the live multiplayer gameplay view;
- a frozen human participant may advance canonical RoomState metadata from `countdown` to `playing`;
- the server validates exact `matchId + roomRevision + startRevision`;
- the server rejects PLAYING before `startAtServerMs`;
- CAS contention is harmless because all clients preserve the same epoch.

`RoomState.status = playing` is metadata. It does not own song time or turn progression.

The current QA route performs the view transition in place instead of navigating to the Solo root route. This intentionally preserves the scheduled AudioContext/transport and avoids accidentally switching to Solo `RhythmRuntime`.

## Live gameplay consumer

The P5.5 QA gameplay view consumes the actual `MultiplayerGameplayRuntime` and exposes:

- WebAudio song time;
- shared global turn and level;
- deterministic command;
- Finish treatment;
- local score/combo/judgement;
- directional + SPACE input.

No RAF/interval/network event advances global gameplay. RAF only reads a snapshot for presentation.

## End condition

Only WebAudio source end calls `runtime.markAudioEnded()`.

Finish remains a Level 9 shared command and never ends the match.

There is no independent game-over timer.

## Explicit non-goals

P5.5 does not:

- change gauge calibration;
- change Finish cadence or treatment;
- change `sequenceCounts` semantics;
- add server-owned beat/turn messages;
- add drift correction, audio seeking or playback-rate correction;
- implement anti-cheat/result authority;
- merge into `development` or `main`;
- start Phase 6.

## Acceptance focus

Automated acceptance should verify:

1. Host and Guest recover the same immutable `startAtServerMs`.
2. Both schedule WebAudio before that epoch.
3. Both transition into the live multiplayer runtime from that epoch.
4. Canonical RoomState reaches `playing` without changing the epoch.
5. Local WebAudio song time advances on both clients.
6. Host/Guest song positions remain reasonably close in browser QA.
7. Global gameplay derives from WebAudio and the frozen manifest.
8. No replacement epoch is created for a late client.
9. Existing Solo/core regressions remain green.
10. Chromium and WebKit/iPhone emulation both pass the real Host/Guest flow.
