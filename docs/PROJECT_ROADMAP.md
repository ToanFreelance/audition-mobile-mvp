# Audition Mobile roadmap

Phase 1 — Solo Easy Core Gameplay and Phase 2 — Portrait HUD / iPhone UX are complete for the accepted MVP scope and integrated into `development`.

Current phase:

**Phase 3 — Human Character + Animation Controller — functional closeout on `work/character`**

Phase 3 functional owner QA has passed for the humanoid runtime, published Normal Dance pool, Miss reaction, published Final Dance pool, and Finish continuation. The branch is **not merged** into `development` yet. Owner observed rapid iPhone heating / battery drain during debug gameplay; thermal and battery profiling remain an explicit performance debt and are not being misrepresented as complete.

| Phase | Scope | Status |
|---|---|---|
| 0 | Music Config, exact BPM, authored Space Start, FINAL RHYTHM v4, WebAudio | Complete; calibration preserved |
| 1 | Solo Easy commands, progression, penalties, Finish, song result | Complete; owner QA accepted; integrated into `development` |
| 2 | Portrait HUD / iPhone UX | Complete; owner iPhone QA accepted; integrated into `development` |
| 3 | Human character, animation controller, published Normal/Final dance content | **Functional closeout on `work/character`; performance debt open; not integrated** |
| 4 | Multiplayer shared song clock | Planned |
| 5 | Room, lobby, ready and mode selection | Planned |
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

These changes are gameplay-adjacent but preserve the locked Phase 1 architecture; they must remain visible during integration review rather than being hidden inside character work.

### Phase 3 functional closeout checklist

Confirmed by code review / owner Vercel+iPhone QA unless explicitly marked otherwise:

- humanoid GLB loads and character fallback exists;
- Idle / normal published dance / Miss / published Final Dance paths work;
- Normal and Final selection are deterministic presentation decisions;
- 150 ms cross-fade remains song-time-derived;
- exact judgement timestamp remains the animation anchor;
- Finish presentation does not own game-end or scheduler timing;
- successful Finish returns to L6 after the four locked hidden turns (owner QA);
- Finish Miss is now locked to the same four-turn shared rest by scheduler contract + regression test; owner physical retest remains optional before integration;
- Phase 2 HUD remains structurally unchanged by Phase 3;
- Center / Wide / Close remain presentation-only camera presets;
- raw Mixamo FBX is not served by gameplay;
- published release loading falls back safely if unavailable;
- current Vercel branch builds successfully.

Not claimed complete:

- thermal/battery optimization;
- full automated Playwright execution in this closeout pass;
- `work/character → development` integration;
- Phase 4 work.

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

Current Phase 3 path:

`development → work/character → implementation → owner functional QA → functional closeout → performance debt review / owner integration decision → development`

Do not develop directly on `development` or `main`. `main` remains stable/production and is not updated as part of Phase 3 work unless owner explicitly requests a later production promotion.
