# Phase 5 Closeout — Integration Readiness

Branch: `work/lobby-preload`

Phase 5 is functionally complete through P5.5 and is ready for owner-approved integration into `development`.

## Accepted milestone chain

`P5.1 Waiting Room`
→ `P5.2 PRELOADING handoff`
→ `P5.3 ALL CLIENTS LOADED`
→ `P5.4 shared countdown`
→ `P5.5 shared WebAudio gameplay start`.

## Locked authority preserved

`WebAudio → song time → global turn → level/turn → gameplay state → player/UI`.

The network and RoomState own room/start metadata only. They do not emit beat/turn authority.

The shared start chain is:

`canonical RoomState`
→ immutable `MatchManifest`
→ exact P4.4 LOADED ACKs
→ one immutable `startAtServerMs`
→ local AudioContext schedule
→ `WebAudioTransport.getCurrentTimeMs()`
→ `MultiplayerGameplayRuntime`.

Player-local score, combo, Miss/suppression, visibility and judgement cannot move the global timeline.

## Acceptance evidence

### Owner physical iPhone

P5.2:
- lobby stable;
- idle animation restored;
- no T-pose;
- Guest has no Start button;
- Host Start moves Host + Guest into PRELOADING.

P5.3:
- all frozen participants reach LOADED;
- ALL CLIENTS LOADED observed.

P5.5:
- Host Start succeeds;
- countdown succeeds;
- transition into live multiplayer gameplay succeeds;
- WebAudio/gameplay starts on physical iPhone.

### Final automated gate

Commit:

`49b793733054a35fd797f264ff40f8efacf614dc`

Full QA:

- TypeScript PASS;
- production build PASS;
- Fast Lobby QA 33/33 PASS;
- core regression 116/116 PASS;
- real Host + Guest E2E 6/6 PASS;
- Chromium/Desktop PASS;
- WebKit/iPhone 13 emulation PASS.

## Known deferred risk / debt

These are not blockers for the Phase 5 functional integration gate:

- production policy for a client that becomes late after the immutable epoch;
- reconnect/resume during active gameplay;
- anti-cheat / server-authoritative result verification;
- thermal/battery optimization;
- production room authentication/privacy hardening;
- long-session telemetry and network quality observability;
- Phase 11 byte-level content versioning/hashes where current MVP identity fingerprints are metadata-derived;
- production visual replacement for the current character/stage candidates.

These belong to later roadmap/hardening/content work unless a concrete regression makes them blocking.

## Integration guard

Do not merge automatically.

Owner approval is required before:

`work/lobby-preload → development`.

After integration:

1. verify `development` contains the exact Phase 5 start chain;
2. run/confirm the integration gate if the merge result is non-fast-forward or otherwise changes the tested tree;
3. perform a short staging smoke if deployment changes;
4. create the next Phase 6 work branch from updated `development`.

Do not develop Phase 6 directly on `work/lobby-preload`, `development`, or `main`.
