# Audition Mobile — Golden Player Flow

Status: source-of-truth prototype on `work/golden-flow-prototype`.

This document locks the intended MVP player journey from app entry through the accepted Phase 5 multiplayer gameplay start. The interactive reference implementation lives at:

`/tools/golden-flow`

The route is a product/UX prototype. It does not replace production authentication, profile persistence, matchmaking, room services, or the accepted multiplayer/gameplay runtime.

## Golden journey

`LOGIN`
→ `PROFILE GATE`
→ if no character: `CREATE CHARACTER`
→ `ROOM LIST`
→ `CREATE ROOM`
→ creator becomes `HOST`
→ `WAITING ROOM`
→ `PREPARING / LOADING`
→ `ALL CLIENTS LOADED`
→ shared `3 / 2 / 1 / GO`
→ `GAMEPLAY`.

If the authenticated account already owns its MVP character profile:

`LOGIN → PROFILE GATE → ROOM LIST`

and Character Creation is skipped.

## MVP account / character rule

For this Golden Flow MVP:

- an authenticated account must have a character profile before entering social/game rooms;
- the first authenticated session without a character is gated into Character Creation;
- the prototype models one active MVP character profile per account;
- multiple character slots, deletion, paid appearance changes and advanced cosmetics are deferred;
- authentication provider choice is intentionally not locked by this prototype.

Production persistence and authorization belong to the later Account/Profile implementation. The prototype only locks navigation and UX expectations.

## Character Creation

Required MVP choices:

- gender: Female / Male;
- skin tone;
- basic hair color;
- basic hairstyle;
- character name.

The confirmation CTA remains unavailable while the character name is empty.

Visual customisation in the Golden Flow prototype demonstrates interaction hierarchy only. The current reference humanoid is reused for 3D continuity; final production face/hair/clothing fidelity remains governed by the character art track.

After confirmation the character profile is considered created and the player enters the Room List.

## Room List

Primary actions:

- inspect room cards;
- search/filter presentation;
- Quick Join affordance;
- Create Room.

The Golden Flow showcase uses `Create Room`.

Creating a room:

- creates the social room context;
- places the creator in the host slot;
- makes that player Host immediately;
- transitions directly into the Waiting Room.

Production room discovery, persistence, privacy/password policy, capacity filters, matchmaking and invitations remain later implementation work.

## Waiting Room

The Golden Flow reuses the accepted Phase 5 visual language and current Three.js humanoid stage.

Locked product semantics remain:

- maximum six room slots;
- Host has no Ready state;
- human Guests use Ready / Not Ready;
- Bots may be auto-ready;
- song and stage are visible room configuration;
- Host owns Start;
- Start does not directly start gameplay.

The source-of-truth video should visually read as the same product as the accepted portrait waiting-room sketch.

## Match preparation

Host Start leads to preparation, not directly to gameplay.

Required player-facing progression:

1. prepare frozen match/settings;
2. load exact music/chart data;
3. load character/animation resources;
4. reach `ALL CLIENTS LOADED`;
5. show shared countdown;
6. enter gameplay.

The prototype presents those stages as a compact loading card/banner over the Waiting Room.

Production authority remains the accepted P5.2–P5.5 chain:

`RoomState`
→ immutable `MatchManifest`
→ participant preload
→ exact LOADED ACK
→ one immutable `startAtServerMs`
→ WebAudio schedule
→ multiplayer gameplay runtime.

The prototype may visually simulate this sequence, but it must never redefine that authority.

## Gameplay reference

The Golden Flow gameplay frame follows the accepted portrait gameplay visual hierarchy:

- music / score / level at the top;
- mission/status presentation;
- character/stage as the main visual field;
- horizontal arrow command strip;
- calibrated SPACE timing gauge;
- judgement feedback;
- bottom directional controls / SPACE;
- Finish retains red special treatment.

Gameplay architecture is not duplicated in the prototype. Production rules remain:

`WebAudio → song time → global turn → level/turn → gameplay state → player/UI`.

Finish is not game end. Only AUDIO END ends gameplay.

## Prototype modes

### Manual review

Open:

`/tools/golden-flow`

The reviewer can click through the new-user flow.

### Existing-character branch

Open:

`/tools/golden-flow?profile=existing`

Login/profile check skips Character Creation and enters Room List.

### Source-of-truth recording

Open:

`/tools/golden-flow?autoplay=1`

The route runs a deterministic first-time-user presentation intended for automated portrait recording.

For the shorter returning-user presentation:

`/tools/golden-flow?autoplay=1&profile=existing`

## Video contract

The canonical product-vision video must be recorded from the running prototype rather than generated independently.

Required order:

`Login → Character Creation → Room List/Create Room → Host Waiting Room → Loading → Countdown → Gameplay`.

The video is a UX/product source of truth, not proof that deferred backend systems are production-complete.

AI-generated video may be used for mood/reference exploration, but it must not replace the prototype-derived Golden Flow recording because generated UI/text/state transitions are not deterministic enough to serve as implementation authority.

## Explicit non-goals

This milestone does not:

- implement production authentication;
- introduce a new database/profile schema;
- implement real character persistence;
- implement public room discovery backend;
- implement matchmaking;
- replace the current accepted P5 multiplayer protocol;
- change WebAudio/global turn authority;
- recalibrate gauge;
- change Finish semantics;
- start Phase 6 game-mode implementation;
- integrate production shop/social/profile systems.

## Change-control rule

Future implementation should follow this flow unless the owner explicitly changes the source of truth.

If product logic changes, update in this order:

1. this Golden Player Flow spec;
2. interactive prototype;
3. Golden Flow recording;
4. production implementation milestone.

Do not silently let production UI diverge from the accepted Golden Flow.
