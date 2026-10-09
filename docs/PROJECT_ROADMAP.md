# Audition Mobile roadmap

Phase 1 — Solo Easy Core Gameplay, Phase 2 — Portrait HUD / iPhone UX, and Phase 3 — Human Character + Animation Controller are complete for their accepted functional scope and integrated into `development`.

Current integration checkpoint:

**Phase 5 is integrated into `development`, including owner-accepted P5.6 Waiting Room Visual V2. PR #15 merged at `d27168929f9923b1de561133b941977d039d56a1`. S2 Stage Catalog is implemented on PR #16. Current roadmap work is S2.5A — Neon Stage V1 on `work/s2-5a-neon-stage-v1`, stacked on S2. S3 Host Stage Selector has not started.**

Phase 3 functional owner QA passed for the humanoid runtime, published Normal Dance pool, Miss reaction, published Final Dance pool, Finish continuation, and the shared Finish Miss cadence. Phase 3 was merged into `development` at `e1d7a814b95144b3947cfb39503b998564b2bc29`, and owner iPhone staging QA passed. Rapid iPhone heating / battery drain remains explicit performance debt; thermal and battery profiling are not being misrepresented as complete.

| Phase | Scope | Status |
|---|---|---|
| 0 | Music Config, exact BPM, authored Space Start, FINAL RHYTHM v4, WebAudio | Complete; calibration preserved |
| 1 | Solo Easy commands, progression, penalties, Finish, song result | Complete; owner QA accepted; integrated into `development` |
| 2 | Portrait HUD / iPhone UX | Complete; owner iPhone QA accepted; integrated into `development` |
| 3 | Human character, animation controller, published Normal/Final dance content | **Functional PASS; integrated into `development`; thermal/battery debt open** |
| 4 | Multiplayer shared song clock | **P4.1–P4.5 complete; architecture present in `development`** |
| 5 | Room, lobby, Ready, preload, synchronized start and gameplay handoff | **P5.1–P5.6 PASS; owner accepted; integrated into `development`** |
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

### P5.6 — Waiting Room Visual V2

Owner-accepted and integrated into `development` via PR #15 at `d27168929f9923b1de561133b941977d039d56a1`.

Scope:

- portrait Waiting Room presentation is capped at five visible participants;
- participant runtime identity resolves through `participant.avatar.characterAssetId → Character Catalog → runtime asset → animation profile`;
- legacy `default-female/default-male` snapshot mapping remains migration-compatible;
- default Wide presentation uses a five-person focus carousel with left/right focus rotation;
- focus rotation is presentation-only and must not change Host authority, RoomState authority, Ready logic, realtime semantics, preload protocol or WebAudio scheduling;
- actor transforms interpolate without recreating unchanged actors or restarting their AnimationMixer;
- player identity text follows the actor head; Host is identified by a crown rather than a HOST badge;
- Wide / Center / Close camera presets live inside Room Settings so stage arrows remain visually unambiguous.

P5.6 owner visual acceptance: **PASS**.

### Phase 5 closeout status

Phase 5 implementation is **INTEGRATED**.

The accepted Waiting Room baseline is now part of `development`. Further stage work must not regress Waiting Room authority, actor lifetime behavior, or the accepted mobile visual composition.

### MVP Entry Flow V1 / PR #18 — Multi-user QA backlog (DEFERRED)

**Status (owner decision, 2026-10-09): QA DEFERRED / NOT YET ACCEPTED.**
The owner cannot currently run a 3-user test. Keep this as a concrete
QA checkpoint for when enough independent clients/devices are available;
do **not** mark it PASS based only on CI or database simulation, and do
**not** merge PR #18 to `development` without explicit owner approval.

Scope already implemented on `work/mvp-entry-room-flow-v1`: character
creation → Room Browser → Waiting Room 3D, plus canonical server-CAS
automatic Host succession and Host-selected manual role transfer. Supabase transactional fixtures **PASSED** first-join
ordering, slot-0 promotion, READY reset, stale-revision rejection,
subsequent transfers, last-Host exit and live/expired heartbeat cases.
Physical multi-client iPhone QA remains **PENDING**.

**Owner smoke test update (2026-10-09):** Manual **Chuyển Host**
has been tested by the owner and reported working (**OWNER SMOKE PASS**).
This validates the user-observed manual transfer path only; it does not
certify the full three-client scenario, back-to-back transfers, timing
races, disconnect recovery or the separate WebAudio E2E. Keep those
checks deferred and PR #18 unmerged.

**Deferred QA checklist — Host Transfer and room lifecycle:**

- [x] **Owner smoke test — manual Chuyển Host:** Host-selected Guest
  transfer was observed working by the owner on the PR #18 preview.
  Detailed 3-client role/crown/READY/actor and race-condition QA
  remains unchecked below.

- [ ] **Three clients (A/B/C), ideally on separate devices:** A creates
  a room; Guest B joins before Guest C, even when B's slot index is
  higher than C's. Verify identities, Character Catalog actors and
  join order are correct on all clients.
- [ ] **Explicit Host leave:** A presses **Rời phòng** in a WAITING
  room. Verify B becomes canonical Host immediately without closing
  the room; B moves to Host slot 0 with crown and START controls; C
  stays Guest and returns to NOT READY; no duplicate Host or stale
  roster on A/B/C after Realtime/poll reconciliation.
- [ ] **Manual Host choice (NEW):** While room is WAITING, Host A
  taps Guest C (not necessarily earliest joined) → **Chuyển Host** →
  confirms. Verify C becomes Host in slot 0 with crown/START, A
  remains in the room as Guest in C's previous slot, B stays Guest,
  and all human Guest READY states reset. Cancel confirmation and
  selecting oneself/Bot must never transfer Host.
- [ ] **Manual transfer after transfer:** Former Host A can READY
  again; new Host C can choose B to transfer once more, with correct
  3D actor identity and no AnimationMixer recreation. Concurrent
  changes (Guest leaves, Host changes, START freezes match) must fail
  the stale-CAS transfer rather than overriding the newest state.
- [ ] **Second handoff / close empty room:** B subsequently leaves,
  C becomes Host; if the final Host leaves and no Guest remains, the
  room closes and disappears from Room Browser.
- [ ] **Disconnect recovery:** Repeat with A's tab closed/offline,
  keeping B and C active in foreground. After the configured **75 s
  host heartbeat timeout** (allow ~75–95 s for polling), verify the
  earliest **still-active** Guest is promoted exactly once and the
  room remains discoverable. Confirm a brief iOS background pause
  does *not* spuriously steal Host authority.
- [ ] **CAS/Reactivity/3D:** Verify all clients converge to the same
  room revision, Host ID and occupied slots; prior Host cannot issue
  Host-only commands; new Host can change song and use normal
  Ready/START gate; role/READY updates do not recreate unchanged
  actors, restart AnimationMixer or rebuild the Three.js scene.
- [ ] **No takeover mid-match:** Host changes are waiting-only.
  PRELOADING/COUNTDOWN/PLAYING must preserve frozen MatchManifest,
  immutable shared epoch, WebAudio clock and gameplay timeline.
- [ ] **Separate audio E2E blocker:** On two devices kept foreground,
  confirm both clients transition from ALL CLIENTS LOADED through
  shared countdown into P5.5 gameplay, and both song clocks advance.
  Earlier same-iPhone two-browser tests reached server PLAYING while
  Guest displayed `SONG 0 ms / AUDIO STALLED` and Host stayed at
  `scheduling shared epoch…`; do not call this fixed without retest.

**Acceptance gate:** Owner physical-device confirmation of multi-user
Host handoff and audio progression, no RoomState/Realtime/actor
regressions, then owner approval to integrate PR #18. Automated DB
checks and a green Vercel build are technical validation only.
Detailed implementation/QA notes: `docs/MVP_ENTRY_ROOM_FLOW_V1.md`.

### Stage roadmap — S2 / S2.5 / S3

Current milestone:

**S2 — Stage Catalog** on `work/s2-stage-catalog` / draft PR #16.

Locked resolution path:

`selectedStageId → Stage Catalog → runtime asset → presentation profile → Stage3D`

S2 scope is catalog/runtime resolution only. The technical Stage Catalog represents general play environments / venues, not only literal concert stages.

After S2:

**S2.5 — Environment / Venue Pack V1**

Planned catalog/content sequence:

- `bright-stage-v1` — existing accepted Bright Stage;
- `neon-stage-v1` — first new environment; based on the accepted P5.6 Waiting Room stage visual, redrawn/animated for gameplay presentation;
- `football-field-v1` — planned sports environment;
- `classroom-v1` — planned classroom environment;
- `cafe-v1` — planned cafe environment.

S2.5A Neon Stage V1 should reuse the Waiting Room's accepted neon composition/language rather than revive the rejected `neon-club-v3` direction.

The owner-approved concept `neon_audition_dance_arena.png` is the S2.5A visual source of truth. Required visual anchors are the curved overhead truss, cyan/violet fixture palette, large LED backdrop, curved multi-tier risers, glossy reflective floor, and central circular dance mark.

Higgsfield 3D / animation generation may be used for editable blockout and motion-source exploration. Runtime Stage3D/WebAudio authority remains unchanged.

**S3 — Host Stage Selector** follows after the initial environment pack is accepted, so the selector exposes real runnable choices rather than placeholder entries.

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

Completed Phase 5 integration path:

`development → work/lobby → waiting-room/realtime acceptance → development → work/lobby-preload → P5.2 PRELOADING → P5.3 ALL CLIENTS LOADED → P5.4 shared countdown → P5.5 shared WebAudio gameplay handoff → P5.6 Waiting Room Visual V2 → owner iPhone acceptance → PR #15 → development`

Current stage-roadmap path:

`development → work/s2-stage-catalog → Stage Catalog review → owner acceptance → S2.5 Environment / Venue Pack V1 → Neon Stage + additional venues → owner acceptance → S3 Host Stage Selector`

Do not develop directly on `development` or `main`. `main` remains stable/production and is not updated as part of Phase 4 work unless owner explicitly requests a later production promotion.

## Phase 14 — Resolution & Visual Fidelity Pass

Status: **DEFERRED until the primary product phases are complete**.

Purpose: improve final mobile visual clarity without destabilizing gameplay or content architecture.

Planned scope:

- audit WebGL canvas internal resolution versus CSS size;
- calibrate mobile `devicePixelRatio` / renderer pixel-ratio policy with measured iPhone GPU cost;
- review texture resolution and compression for characters, stages and high-visibility UI assets;
- reduce unnecessary softness from glow, transparency and post-processing;
- improve anti-aliasing / edge clarity where supported;
- add an adaptive visual-quality profile so higher fidelity does not compromise stable mobile frame rate;
- run physical iPhone visual/performance QA before accepting higher resolution defaults.

Locked non-goals:

- no gameplay timing changes;
- no WebAudio authority changes;
- no gauge / Finish rebalance;
- no architecture rewrite merely for higher resolution.

This phase must not block the current roadmap. It starts only after the main feature phases and hardening/distribution work are complete.
