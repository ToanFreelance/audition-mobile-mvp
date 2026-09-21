# Audition Mobile roadmap

Phase 1 — Solo Easy Core Gameplay, Phase 2 — Portrait HUD / iPhone UX, and Phase 3 — Human Character + Animation Controller are complete for their accepted functional scope and integrated into `development`.

Current integration checkpoint:

**Phase 5 — Room / lobby / Ready / preload / shared countdown / WebAudio gameplay handoff is integrated into `development` at `991abb65e4a0c2a7fb5175a80284b533206a7a94`. P5.1–P5.5 implementation, Full QA, Vercel staging and owner Host iPhone acceptance are PASS.**

Current product-alignment milestone:

**Golden Player Flow + Golden Visual Direction on `work/golden-flow-prototype` now lock logic and design together before Phase 6. The intended MVP journey is Login → profile gate → Character Creation when required → Room List/Create Room → Host Waiting Room → preparation/loading → shared countdown → Gameplay. The approved neon portrait sketch is the Visual Source of Truth V1 for Login, Character Creation, Room List, Waiting Room and Preparing/Loading. Gameplay must be redesigned in the same visual system while preserving the accepted WebAudio/global-turn architecture. Waiting Room and Gameplay use local-player-first composition: the account owner's character is large and centered; other participants are arranged around/behind it in an arc/ring. Character Creation uses a real 3D preview with drag-to-rotate 360°. This is a UX/design-system/source-of-truth milestone, not Phase 6. Phase 6 has not started.**

Phase 3 functional owner QA passed for the humanoid runtime, published Normal Dance pool, Miss reaction, published Final Dance pool, Finish continuation, and the shared Finish Miss cadence. Phase 3 was merged into `development` at `e1d7a814b95144b3947cfb39503b998564b2bc29`, and owner iPhone staging QA passed. Rapid iPhone heating / battery drain remains explicit performance debt; thermal and battery profiling are not being misrepresented as complete.

| Phase | Scope | Status |
|---|---|---|
| 0 | Music Config, exact BPM, authored Space Start, FINAL RHYTHM v4, WebAudio | Complete; calibration preserved |
| 1 | Solo Easy commands, progression, penalties, Finish, song result | Complete; owner QA accepted; integrated into `development` |
| 2 | Portrait HUD / iPhone UX | Complete; owner iPhone QA accepted; integrated into `development` |
| 3 | Human character, animation controller, published Normal/Final dance content | **Functional PASS; integrated into `development`; thermal/battery debt open** |
| 4 | Multiplayer shared song clock | **P4.1–P4.5 complete; architecture present in `development`** |
| 5 | Room, lobby, Ready, preload, synchronized start and gameplay handoff | **P5.1–P5.5 PASS; integrated into `development`** |
| Golden Flow | Login → character gate → rooms → Phase 5 → gameplay UX source of truth | **In review on `work/golden-flow-prototype`; Phase 6 not started** |
| 6 | Additional game modes | Planned |
| 7 | Account, profile, progression | Planned |
| 8 | Modular humanoid clothing, accessories, inventory | Planned |
| 9 | Shop and server-validated economy | Planned |
| 10 | Friends, invitations, presence, chat | Planned |
| 11 | Versioned charts/assets, admin and live operations | Planned |
| 12 | Reconnect, security, telemetry, mobile performance | Planned |
| 13 | Content rights and distribution review | Required before commercial release |

## Phase 2 closeout

Phase 2 production visual contract was the Portrait Mobile Gameplay Sketch (`IMG_1975.jpeg`). The accepted portrait gameplay implementation now includes:

- portrait structural shell;
- safe-area and dynamic mobile viewport handling;
- top HUD / music / level / mission / leaderboard / combo layout;
- production command-strip arrow presentation;
- asset-based judgement labels;
- asset-based SPACE and D-pad controls with touch-friendly hit targets;
- tactile SPACE press feedback;
- portrait utility menu with control-layout, camera-preset and control-size settings;
- local preference persistence for those settings.

Intentional Phase 2 deviations / deferrals:

- Character fidelity is deferred to Phase 3.
- Stage/background fidelity remains deferred to its corresponding visual/content work.
- Chat is intentionally deferred by owner decision.
- Replay / Play Again is intentionally removed. A player must not own authority to restart an active or completed future multiplayer match; room/lobby flow will own subsequent matches in later phases.

Owner iPhone/Vercel QA accepted the Phase 2 result. `work/portrait-ui` was cleanly fast-forwarded into `development` at commit `9e8774e77f578afb81f958e90057c56ec22b1c36`.

## Phase 2 locked production visual contract

- The Portrait Mobile Gameplay Sketch (`IMG_1975.jpeg`) remains the production UI source of truth for the completed Phase 2 scope.
- Character and stage/background fidelity were explicit exceptions during Phase 2.
- Locked gameplay architecture and semantics always take priority if a visual reference conflicts with them.
- Owner iPhone visual QA is the final visual acceptance gate for portrait UI changes.

## Phase 3 — Human Character + Animation Controller

### Phase 3 goal

Replace the placeholder/procedural character with a production-oriented humanoid character pipeline while preserving the authoritative gameplay timeline and the completed Phase 2 portrait HUD.

Phase 3 is presentation/character work. It must not redesign Solo Easy gameplay, gauge calibration, command scheduling, judgement timing, Finish semantics, or the WebAudio clock architecture.

### Phase 3 architecture contract

- WebAudio remains the authoritative song clock.
- Character animation is a **consumer** of authoritative song/gameplay timing; it never owns or modifies the gameplay clock.
- Do not use a separate animation timer as a competing rhythm timeline for beat-critical dance transitions.
- `Stage3D` may use render-frame time for interpolation/rendering only. Beat/dance phase that must align with music is derived from authoritative song time exposed by gameplay state.
- Character misses, hits, dance clips and visual reactions must not pause, repeat, rewind or extend global turns.
- Existing camera presets (`Center`, `Wide`, `Close`) remain compatible with the character pipeline.
- Do not change the accepted Phase 2 HUD geometry unless a character-framing blocker is explicitly identified and reviewed.

### Character asset contract

Preferred runtime format:

- glTF / GLB;
- humanoid skeletal rig;
- skinned mesh;
- reusable animation clips;
- mobile-conscious texture/material budget.

Use owner-created, generated or appropriately licensed assets. Do not copy character models, animation assets, clothing or textures from the commercial Audition game.

Prefer the existing direct Three.js architecture. Do not introduce React Three Fiber or replace the stage renderer unless there is a demonstrated technical blocker.

Use standard Three.js animation facilities (`AnimationMixer`, `AnimationAction`, GLTF loading) before adding another animation framework.

### Phase 3 milestone history

#### P3.1 — Character pipeline foundation

Implemented:

- production-oriented `CharacterActor` boundary;
- humanoid GLB loading with direct Three.js `GLTFLoader`;
- scale/origin normalization and portrait framing integration;
- fallback character path if the humanoid load fails;
- mount/update/dispose lifecycle separated from gameplay state.

Acceptance status: **PASS**.

#### P3.2 — Animation controller

Implemented:

- presentation-only `CharacterAnimationController`;
- `idle`, normal dance, Miss and Finish presentation paths;
- one owner for animation action transitions;
- action lane reuse / cloning so same-clip consecutive turns can re-anchor safely;
- mixer/action cleanup on dispose.

Acceptance status: **PASS**.

#### P3.3 — WebAudio-derived dance sync

Implemented:

- judgement events carry the exact authoritative SPACE timestamp plus absolute turn / level / Finish identity;
- animation phase is derived from `songTimeMs - actionStartSongTimeMs`;
- dropped render frames catch up to song time instead of accumulating animation drift;
- animation state never owns or modifies the global turn scheduler.

Acceptance status: **PASS**.

#### P3.4 — Dance clips + cross-fades

Historical validation used RobotExpressive as a temporary test pool. That pool is no longer the active production-content path.

The retained runtime contract is:

- 150 ms song-time-derived cross-fade;
- deterministic semantic choreography IDs;
- exact authoritative action anchors;
- same-clip consecutive turns use separate action lanes;
- Miss blends to a bounded reaction then back to Idle;
- Finish is presentation-only and never extends scheduler timing.

Acceptance status: **PASS; superseded content source by P3.7**.

#### P3.5 — Portrait framing + camera integration

Implemented and owner-tested:

- normalized humanoid height `3.4` world units;
- stable actor root `(0, 0.02, 0.25)`;
- portrait `Center`, `Wide`, `Close` camera contracts;
- fixed torso-oriented framing rather than camera chasing animated bones;
- compatibility with accepted Phase 2 portrait HUD and safe-area behavior.

Portrait camera presets remain:

- `Center`: FOV 38, y 3.45, z 18.5, target y 1.75;
- `Wide`: FOV 41, y 3.65, z 20.5, target y 1.75;
- `Close`: FOV 36, y 3.3, z 17.9, target y 1.8.

Acceptance status: **PASS**.

#### P3.6 — Mobile rendering lifecycle + performance baseline

Implemented baseline protections:

- mobile DPR cap `1.25`; desktop cap `1.6`;
- antialiasing retained;
- placeholder stage reduced to one static SpotLight plus existing material accents;
- `Stage3D` RAF suspends while the document is hidden and resumes without creating a competing gameplay clock;
- one mount-owned RAF with visibility listener, ResizeObserver, character, mixer/actions, scene resources and renderer cleanup.

Owner physical iPhone QA result:

- functional rendering/gameplay integration passes;
- owner observed the device heating quickly and battery draining quickly during debug gameplay.

Therefore **P3.6 is not a completed thermal/performance acceptance gate**. The current behavior is recorded as known debt rather than hidden behind a PASS label. Profiling should measure GPU/RAF cost, SkinnedMesh/AnimationMixer evaluation, debug UI update frequency, runtime bundle parse/load, stage rendering cost and Safari behavior before changing quality settings.

#### P3.7 — Human asset + published animation content pipeline

Implemented:

- Quaternius UBC humanoid as canonical Phase 3 reference character;
- owner-acquired Mixamo dance source package kept private;
- Asset Lab preview/review flow;
- automatic browser-side FBX → canonical rig bake;
- 30 FPS quaternion-only runtime clips with root translation stripped;
- IndexedDB runtime-ready cache;
- immutable versioned publisher backed by private Supabase Storage;
- idempotent publish guard;
- runtime bundle validation and safe legacy fallback;
- separate mutable review approval from published content roles;
- `NORMAL` and `FINAL` pool roles;
- deterministic Final Dance selection from seed + absolute turn, never `Math.random()`;
- published release v3 with 13 Normal selections and 3 Final selections;
- gameplay consumes published runtime JSON, never raw FBX.

Current Final pool in release v3:

- `dance_mixamo_006` — Breakdance Freezes;
- `dance_mixamo_007` — Capoeira;
- `dance_mixamo_015` — Flair.

Owner QA confirmed published animations load and play after the large-bundle timeout regression was fixed. Legacy CMU FancyFootWork slices remain fallback-only and are not the canonical live Normal pool.

Acceptance status: **FUNCTIONAL PASS**.

### Phase 3 gameplay-adjacent fixes discovered during integration

Phase 3 exposed pre-existing/adjacent Finish contract issues that were fixed on `work/character` before integration:

- non-final Finish uses one shared `finishRestTurns = 4` global rest, independent of Perfect/Great/Cool/Bad/Miss outcome;
- player-specific Finish judgement may affect score/combo/gauge/animation but may not change the next global turn, level, reveal time, or Finish cadence;
- non-final Finish recomputes finality from its authoritative current turn instead of allowing stale cached planning state to stop the timeline;
- owner QA reconfirmed `T38 Finish success → T39–42 hidden → T43 L6 visible`;
- a deterministic regression test locks the same T43 L6 schedule for Finish Miss and verifies success/miss players receive the same reveal schedule;
- deterministic Aloha Finish cadence remains `38, 62, 86, 110`;
- `debug=1` adds an owner-QA-only Finish SPACE assist and does not change non-debug production input behavior.

These changes are gameplay-adjacent but preserve the locked Phase 1 architecture; they remain visible in the Phase 3 integration history.

### Phase 3 functional closeout checklist

Confirmed by code review / owner Vercel+iPhone QA unless explicitly marked otherwise:

- humanoid GLB loads and character fallback exists;
- Idle / normal published dance / Miss / published Final Dance paths work;
- Normal and Final selection are deterministic presentation decisions;
- 150 ms cross-fade remains song-time-derived;
- exact judgement timestamp remains the animation anchor;
- Finish presentation does not own game-end or scheduler timing;
- successful Finish returns to L6 after the four locked hidden turns (owner QA);
- Finish Miss uses the same four-turn shared rest and owner physical iPhone retest passed;
- Phase 2 HUD remains structurally unchanged by Phase 3;
- Center / Wide / Close remain presentation-only camera presets;
- raw Mixamo FBX is not served by gameplay;
- published release loading falls back safely if unavailable;
- Phase 3 Vercel builds and owner staging iPhone QA passed;
- `work/character` was merged into `development` as `e1d7a814b95144b3947cfb39503b998564b2bc29`.

Not claimed complete:

- thermal/battery optimization;
- full automated Playwright execution in the Phase 3 closeout pass.

### Phase 3 non-goals

Do not include in Phase 3 unless separately approved:

- multiplayer synchronization;
- lobby/room character lineup;
- character creation/customization UI;
- clothing inventory/equipment system;
- cosmetics shop;
- social/profile systems;
- chat;
- stage/background redesign;
- new game modes.

Those remain assigned to later roadmap phases.

## Phase 4 — Multiplayer shared song clock

Status: **P4.1–P4.5 complete; accepted multiplayer clock/start/gameplay architecture is present in `development`.**

Historical implementation branch: `work/multiplayer-clock`.

Detailed P4.1 contract: `docs/P4_1_MULTIPLAYER_DOMAIN.md`.

### P4.1 — Multiplayer Domain Foundation + Deterministic QA Harness

P4.1 is additive architecture only. It must not modify the accepted Solo Easy runtime, gauge calibration, WebAudio transport, Stage3D, character animation pipeline, or Phase 2 gameplay HUD.

Locked P4.1 requirements:

- one shared global timeline drives all participants;
- maximum six occupied participants;
- Human and Bot share one participant model; Bot never owns a clock or scheduler;
- host has no Ready state; human guests use NOT_READY / READY; bots are auto-ready;
- Start requires at least one non-host participant and every occupied non-host participant Ready;
- READY and pre-game LOADED are separate states;
- participants carry avatar snapshots so Phase 5 can render a 3D social waiting room without replacing the room domain model;
- MatchManifest freezes song/chart/content versions, room revision, seed, exact BPM, authored Space Start, participant snapshots and gameplay settings for one match;
- multiplayer canonical commands are stateless per global turn (`match seed + absoluteTurn + purpose`) rather than dependent on a sequential PRNG stream;
- mixed player outcomes may alter player-local state but never shared absolute turn, level, Finish cadence, target song time or canonical command;
- locked Finish cadence remains `38, 62, 86, 110` and every non-final Finish uses the room-wide T39–T42 rest before T43 L6 resume;
- `/tools/multiplayer-qa` provides deterministic one-iPhone validation with one human host plus five simulated bots.

P4.1 does **not** implement real-time networking, shared server start-epoch mapping, pre-game client-loaded acknowledgements, or the Phase 5 lobby/waiting-room presentation.

Completed sequence:

`P4.2 shared start clock → P4.3 networking transport → P4.4 preload/start protocol → P4.5 multiplayer gameplay integration → Phase 5 lobby/3D waiting room`


## Phase 5 — Room / Lobby / Ready / Match Start

Current branch: `work/lobby-preload`.

Phase 5 binds the accepted Phase 4 multiplayer architecture to the production-facing waiting-room flow without moving gameplay authority away from WebAudio.

### P5.1 — Waiting Room Foundation

Implemented and accepted:

- portrait 3D waiting room bound to canonical `RoomState`;
- maximum six slots;
- Host has no Ready state;
- human Guest Ready / Not Ready;
- Bot auto-ready;
- Start gate through the existing room-domain rules;
- dedicated waiting-room Three.js scene;
- participant/avatar snapshots;
- lobby presentation remains independent from gameplay timing.

P5.1b completed the visual-fidelity pass against the portrait waiting-room sketch without changing room or gameplay authority.

### P5.2 — Lobby → PRELOADING handoff

Implemented and owner physical-tested:

`Guest READY → Host START → canonical RoomState refetch → immutable MatchManifest → P4.4 MatchStartSession → WAITING revision N → PRELOADING revision N+1`.

Canonical RoomState persists the exact match/start binding. Realtime remains notification/delivery only.

Owner iPhone acceptance: **PASS**.

### P5.3 — ALL CLIENTS LOADED

Implemented:

- real frozen resource preload;
- participant `IDLE → LOADING → LOADED`;
- exact P4.4 LOADED ACK validation;
- canonical load-state persistence;
- reload/reconnect recovery from `matchStart + participants[].loadState`;
- actual selected audio/chart, gameplay config, characters and animation resources included in preload.

Expected CAS contention between Host/Guest is retry-safe and adopts the winning canonical snapshot.

Owner iPhone acceptance: **PASS**.

### P5.4 — Shared Countdown

Implemented:

`ALL CLIENTS LOADED → NTP-style server-clock sampling → one immutable startAtServerMs → canonical COUNTDOWN → 3/2/1/GO derived from the shared epoch`.

Countdown is presentation only. It does not own audio, gameplay start or global turns.

Automated acceptance:

- Fast Lobby QA PASS;
- Core regression PASS;
- real Host + Guest PASS;
- Chromium PASS;
- WebKit/iPhone emulation PASS.

Acceptance status: **PASS**.

### P5.5 — Shared WebAudio Gameplay Start

Implemented:

`shared startAtServerMs → local AudioContext mapping → scheduled WebAudio start → MultiplayerGameplayRuntime → canonical PLAYING metadata`.

Locked authority remains:

`shared server epoch → local WebAudio song time → global turn / level / Finish / canonical command → player-local input and judgement`.

Important behavior:

- existing P4.5 runtime is reused; no second multiplayer scheduler exists;
- Safari/WebKit AudioContext is unlocked from lobby user gestures;
- P5.3-warmed audio bytes are reused for P5.5 decode;
- late clients do not move or replace the shared epoch;
- RoomState `playing` is metadata only;
- only AUDIO END ends gameplay;
- Finish never ends the match.

Final Full QA on commit `49b793733054a35fd797f264ff40f8efacf614dc`:

- TypeScript: PASS;
- production build: PASS;
- Fast Lobby QA: 33/33 PASS;
- full core regression: 116/116 PASS;
- real Host + Guest E2E: 6/6 PASS;
- Chromium/Desktop: PASS;
- WebKit/iPhone 13 emulation: PASS;
- Vercel deployment: READY.

Owner physical iPhone Host test confirmed:

- Start succeeds;
- preload/countdown succeeds;
- transition into multiplayer gameplay succeeds;
- WebAudio playback/gameplay starts successfully.

Owner physical P5.5 Host acceptance: **PASS**.

### Phase 5 closeout status

Phase 5 implementation is **INTEGRATED INTO `development`**.

Integration was a clean fast-forward to `991abb65e4a0c2a7fb5175a80284b533206a7a94`. The tested Phase 5 runtime tree was preserved and Vercel staging reached READY.

Before starting Phase 6, the project is using `work/golden-flow-prototype` to lock the end-to-end MVP product journey and source-of-truth recording. This alignment milestone does not modify Phase 5 multiplayer authority.

Do not develop Phase 6 directly on `work/golden-flow-prototype`, `development`, or `main`.

## Phase 1 architecture invariants

- WebAudio is the authoritative song clock. A global turn is four beats: `target(N) = authored Space Start + N × 240000 / BPM_exact`. Player results never move the clock.
- `sequenceCounts[level]` is the **total global-turn budget** of that level. Playable, hidden, suppressed and penalty turns all consume the same existing global-turn budget.
- Hidden and suppressed turns may cross level boundaries. They must not pause, repeat, rewind, create replacement turns, create extra global turns or extend a level.
- Command length is independent from `sequenceCounts`.
- Player command visibility, penalty, score and progression remain separate from the authoritative global timeline. Hidden turns do not recursively produce Miss results.
- Saved charts require an audio URL, title, positive exact BPM, duration and authored Space Start. Missing timing is never generated as a fallback.

## Finish invariants

- Finish is a Level 9 special command that owns an existing scheduled global turn.
- Finish preserves its label, red special treatment and reverse token. Input judgement uses `requiredDirection`; a completed reverse token renders `requiredDirection`.
- Finish is not a game-end condition. Only actual AUDIO END ends gameplay.
- With Aloha and `seed=123`, the deterministic Finish cadence is `38, 62, 86, 110`.
- Reference review of the original 110 BPM gameplay establishes the shared post-Finish cadence: after a non-final Finish, command presentation rests and the room resumes together. The accepted Aloha mapping is `38 Finish → 39–42 hidden → 43 L6 visible`.
- Those four hidden slots consume the existing L6→L9 global-turn budget. They do not add replacement turns, extend a level or shift the locked `38, 62, 86, 110` Finish cadence.
- The shared scheduler uses one `finishRestTurns = 4` contract for every player outcome. Perfect/Great/Cool/Bad/Miss may change player state but may not change global turn, next level, reveal time, or room cadence.
- Ordinary non-Finish Miss suppression remains player-specific presentation/gameplay state; it does not own the global clock.
- Character Final Dance may consume this authoritative presentation window, but animation duration must never own or change scheduler timing.

## Cross-level suppression examples

- `14 L5 Miss → 15 L6 hidden → 16 L6 visible`.
- `20 L6 Miss → 21–22 L7 hidden → 23 L7 visible`.

## Gauge and presentation constraints

The calibrated gauge geometry, Perfect center, breathing/stretch behavior and scoring thresholds are preserved. Future phases must not redesign, rebalance or recalibrate the gauge unless separately scoped and validated.

## Delivery gates

Completed Phase 2 integration path:

`development → work/portrait-ui → implementation → owner iPhone/Vercel QA → clean fast-forward to development`

Completed Phase 3 integration path:

`development → work/character → implementation → owner functional QA → shared-Finish regression → integration review → development → owner staging iPhone PASS`

Completed Phase 4 path:

`development → work/multiplayer-clock → P4.1–P4.5 → focused validation → owner review → development`

Current Phase 5 integration path:

`development → work/lobby → waiting-room/realtime acceptance → development → work/lobby-preload → P5.2 PRELOADING → P5.3 ALL CLIENTS LOADED → P5.4 shared countdown → P5.5 shared WebAudio gameplay handoff → Full QA → owner iPhone Host PASS → pending owner-approved merge to development`

Do not develop directly on `development` or `main`. `main` remains stable/production and is not updated as part of Phase 4 work unless owner explicitly requests a later production promotion.
