# Audition Mobile roadmap

Phase 1 — Solo Easy Core Gameplay and Phase 2 — Portrait HUD / iPhone UX are complete for the accepted MVP scope and integrated into `development`.

Current next planned phase:

**Phase 3 — Human Character + Animation Controller**

Phase 3 must start from `development` on a dedicated work branch. Do not develop directly on `development` or `main`.

| Phase | Scope | Status |
|---|---|---|
| 0 | Music Config, exact BPM, authored Space Start, FINAL RHYTHM v4, WebAudio | Complete; calibration preserved |
| 1 | Solo Easy commands, progression, penalties, Finish, song result | Complete; owner QA accepted; integrated into `development` |
| 2 | Portrait HUD / iPhone UX | Complete; owner iPhone QA accepted; integrated into `development` |
| 3 | Human character, animation controller, cross-fades | **Next planned phase** |
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

Replace the current placeholder/procedural character with a production-oriented humanoid character pipeline while preserving the authoritative gameplay timeline and the completed Phase 2 portrait HUD.

Phase 3 is presentation/character work. It must not redesign Solo Easy gameplay, gauge calibration, command scheduling, judgement timing, Finish semantics, or the WebAudio clock architecture.

### Phase 3 architecture contract

- WebAudio remains the authoritative song clock.
- Character animation is a **consumer** of authoritative song/gameplay timing; it never owns or modifies the gameplay clock.
- Do not use a separate animation timer as a competing rhythm timeline for beat-critical dance transitions.
- `Stage3D` may use render-frame time for interpolation/rendering only. Beat/dance phase that must align with music should be derived from authoritative song time / BPM exposed by gameplay state.
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

### Proposed Phase 3 milestones

#### P3.1 — Character pipeline foundation

Goal: establish the production character asset/runtime contract without changing gameplay.

- Inspect and isolate current placeholder character creation in `Stage3D`.
- Define a small character presentation interface.
- Load one humanoid GLB/GLTF test character.
- Validate rig, scale, origin, orientation and portrait framing.
- Keep existing stage/background and camera presets working.
- Add graceful fallback if character asset loading fails.
- No dance-state logic yet beyond a basic idle clip.

Acceptance:

- character loads reliably on iPhone/Safari;
- no HUD regression;
- no gameplay/runtime changes;
- no uncaught loader/WebGL errors.

#### P3.2 — Animation controller

Goal: create a presentation-only character animation state machine.

Initial states should remain intentionally small:

- `idle`;
- `dance` / primary dance loop;
- `hit-accent` or success reaction if needed;
- `miss` reaction if needed.

Requirements:

- one owner for animation state transitions;
- avoid scattered direct `AnimationAction.play()` calls across UI/gameplay code;
- use `AnimationMixer` and named clips/actions;
- define deterministic transition rules;
- no gameplay timing ownership.

Acceptance:

- no animation action leaks;
- repeated state changes remain stable;
- idle/dance transitions are visually clean.

#### P3.3 — WebAudio-derived dance sync

Goal: synchronize beat-critical character motion to the authoritative song timeline.

- Expose only the minimum timing presentation data needed by `Stage3D` / character controller, for example authoritative song time, BPM and/or derived beat phase.
- Remove reliance on hard-coded independent rhythm constants for beat-critical character motion.
- Render interpolation may still use `requestAnimationFrame`, but phase alignment must come from authoritative song time.
- Do not create a second scheduler.

Acceptance:

- changing song BPM keeps character beat motion aligned;
- menu/camera/control settings do not alter song/character phase;
- dropped frames do not permanently drift character rhythm away from WebAudio.

#### P3.4 — Dance clips + cross-fades

Goal: make transitions production-quality rather than abrupt.

- Add a minimal set of approved dance clips.
- Cross-fade between idle/dance/reaction clips.
- Tune fade durations for mobile visual quality.
- Avoid clip restart spam on every React render/turn update.
- Keep reactions visual-only and bounded in duration.

Acceptance:

- no visible pose snapping during normal transitions;
- repeated Perfect/Miss events do not corrupt mixer state;
- character returns to the expected loop cleanly.

#### P3.5 — Portrait framing + camera integration

Goal: ensure the real humanoid works with the accepted portrait gameplay composition.

- Validate `Center`, `Wide`, `Close` camera presets against the new humanoid.
- Keep character readable without covering command/judgement/leaderboard/controls.
- Tune model scale, root position and camera target before changing HUD geometry.
- Preserve safe-area and dynamic viewport behavior.

Acceptance:

- 390×844 and 430×932 remain usable;
- character does not clip through primary HUD regions in normal gameplay;
- camera preset changes remain presentation-only.

#### P3.6 — Mobile performance + owner QA

Goal: close Phase 3 with a stable mobile character pipeline.

Validate:

- iPhone Safari rendering stability;
- character load time;
- texture memory / material count;
- animation mixer cleanup;
- resize/orientation behavior;
- no WebAudio/gameplay timing regression;
- owner visual QA.

Only after owner acceptance should Phase 3 be integrated into `development`.

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
- Post-Finish behavior is `38 Finish → 39–40 hidden → 41 L6 visible`; the timeline continues normally afterward.

## Cross-level suppression examples

- `14 L5 Miss → 15 L6 hidden → 16 L6 visible`.
- `20 L6 Miss → 21–22 L7 hidden → 23 L7 visible`.

## Gauge and presentation constraints

The calibrated gauge geometry, Perfect center, breathing/stretch behavior and scoring thresholds are preserved. Future phases must not redesign, rebalance or recalibrate the gauge unless separately scoped and validated.

## Delivery gates

Completed Phase 2 integration path:

`development → work/portrait-ui → implementation → owner iPhone/Vercel QA → clean fast-forward to development`

Phase 3 delivery path:

`development → dedicated work/character branch → milestone implementation → owner review / QA → development → final integration gate`

Do not develop directly on `development` or `main`. `main` remains stable/production and is not updated as part of Phase 3 work unless owner explicitly requests a later production promotion.
