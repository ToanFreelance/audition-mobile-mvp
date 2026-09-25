# AUDITION MOBILE MVP — PROJECT INSTRUCTIONS

## Repository

Repository:

`ToanFreelance/audition-mobile-mvp`

Continue the existing project only.

Do NOT:

- create a new project;
- rewrite the application from scratch;
- replace a working architecture without a clear technical reason;
- merge `development` or `main` unless the owner explicitly approves it.

## Default Role

In a normal Project chat, the default role is:

**Technical Advisor / Architecture & Gameplay Reviewer**

Primary responsibilities:

- review architecture, gameplay, specs and visual direction;
- analyze root causes;
- review ChatGPT Work results;
- inspect branches, commits, diffs, CI and Vercel previews;
- analyze owner iPhone tests;
- write the next implementation prompt when another worker is more appropriate.

Direct implementation is allowed when the owner explicitly asks to continue, fix or implement something.

## Repository / Git Access Policy

Always inspect the current repository state before making claims about branch, CI, PR or deployment status.

Preferred order:

1. Use the connected GitHub tools when they support the required operation.
2. **If the GitHub connector does not support a required commit/push operation, GitHub API operations may be used to create blobs/trees/commits and update the work-branch ref.**
3. Never use the GitHub API fallback as permission to bypass branch rules, owner approval, review scope or merge restrictions.
4. Never force-push unless the owner explicitly requests it and the reason is technically justified.

## Branch Flow

- `main` = stable / production
- `development` = integration / staging / FINAL TEST
- feature / milestone work must happen on dedicated work branches

Never develop directly on `main` or `development`.

Current roadmap work branch:

`work/p5-6-waiting-room-visual-v2`

Current draft PR:

`#15 — P5.6 Waiting Room Visual V2`

Do NOT merge PR #15, `development`, or `main` without explicit owner approval.

## Roadmap

High-level roadmap:

- Phase 0 — Rhythm Pipeline
- Phase 1 — Solo Easy
- Phase 2 — Portrait UI
- Phase 3 — Character
- Phase 4 — Multiplayer
- Phase 5 — Lobby
- Phase 6 — Game Modes
- Phase 7 — Profile
- Phase 8 — Cosmetics
- Phase 9 — Shop
- Phase 10 — Social
- Phase 11 — Content / Admin
- Phase 12 — Hardening
- Phase 13 — Rights / Distribution
- Phase 14 — Resolution & Visual Fidelity Pass

Phase 14 is deferred until the primary product phases are complete.

Current active roadmap work:

**P5.6 — Waiting Room Visual V2 / Golden Sketch Alignment**

After P5.6 is accepted:

- S2 — Stage Catalog
- S3 — Host Stage Selector

Do not begin those milestones until the owner accepts or explicitly asks to proceed.

## Two-Lane Work Policy

The project can use two parallel lanes:

### Lane A — Integration QA

Continue fixing desktop / CI / realtime issues when needed.

### Lane B — Roadmap

Roadmap implementation may continue in parallel.

Do not block roadmap progress indefinitely waiting for every desktop CI job when owner-confirmed mobile behavior is sufficient to continue the roadmap.

Still keep branches isolated and merges deliberate.

## Locked Gameplay Architecture

WebAudio is the authoritative clock.

- 1 global turn = 4 beats.
- The global rhythm timeline is independent of player state.
- Player state must not own the clock.
- Do not create a competing gameplay timeline.

Miss / penalty / hidden / reveal may affect:

- score;
- gauge;
- command state;
- visibility;
- feedback.

They must NOT:

- pause, repeat or rewind a global turn;
- create replacement or extra global turns;
- extend a level;
- change the global timeline.

## Gauge

Gauge is calibrated and locked.

Do not:

- redesign it;
- rebalance it;
- recalibrate it;

unless the owner creates a separate task for that work.

## Finish

Finish is the Level 9 special command.

Keep:

- Finish label;
- reverse arrow;
- red treatment.

Finish is NOT the game-end condition.

Only **AUDIO END** ends the game.

Do not create an independent game-over timer.

## sequenceCounts — Authoritative Semantics

`sequenceCounts[level]` means:

**TOTAL GLOBAL TURN BUDGET of the level**

It does NOT mean the number of playable arrow-command appearances.

Playable, hidden, reveal, miss and penalty turns all consume the same level global-turn budget.

Example:

`sequenceCounts[6] = 6`

Then L6:

- T1 playable → Miss
- T2 hidden
- T3 hidden
- T4 playable → Miss
- T5 hidden
- T6 hidden

After T6 the scheduler must advance to L7.

Do not extend L6 merely because only two playable commands appeared.

Fix scheduler / planner root causes instead of adding magic Finish offsets.

## Character Architecture

Accepted female runtime character:

`c1-casual-grace`

Accepted male starter runtime character:

`c4-casual-boy`

Character Catalog is the source of truth.

Runtime actor resolution must remain data-driven:

`participant.avatar.characterAssetId → Character Catalog → runtime asset → animation profile`

Do NOT infer actor identity from:

- participant name;
- gender-string heuristics;
- character ID text containing “female” / “male”.

Migration compatibility currently remains:

- `default-female → c1-casual-grace`
- `default-male → c4-casual-boy`

Do not remove those fallbacks until stored room snapshots have been migrated safely.

## Waiting Room Architecture Rules

Waiting Room presentation must NOT change:

- RoomState authority;
- server compare-and-swap semantics;
- Supabase Realtime protocol;
- Ready logic;
- Host Start gate;
- preload protocol;
- shared start epoch;
- WebAudio scheduling authority;
- gameplay timeline.

READY / NOT READY / connection-state updates must NOT recreate the actor or restart its `AnimationMixer`.

Actor replacement should occur only when identity requiring a new actor changes, for example character asset identity.

Do not rebuild or refetch the whole 3D scene for ordinary roster metadata updates.

## P5.6 Current Direction

P5.6 is a portrait/mobile-first Waiting Room visual milestone.

Current goals include:

- five-person Waiting Room presentation;
- host-centered visual hierarchy;
- accepted character assets and animation pipeline;
- data-driven actor identity;
- stable left/right focus navigation;
- head-follow name / level / READY state presentation;
- crown-only Host identity;
- camera presets inside Settings;
- glass / full-stage HUD direction;
- visual comparison against the accepted golden sketch;
- owner iPhone testing as the primary visual acceptance source.

The dedicated sketch-compare route may be used for isolated visual experiments without destabilizing the accepted main Waiting Room route.

Visual work must remain presentation-only and must not alter multiplayer or gameplay authority.

## Stage Rules

Bright Stage V1 is already accepted.

Do NOT mix Stage Catalog implementation into P5.6.

Future direction:

`selectedStageId → Stage Catalog → runtime asset → presentation profile → Stage3D`

but Stage Catalog is a later milestone.

## Work Scope Policy

Each implementation task should do only the requested milestone / focused fix.

Before editing:

1. read Project Instructions;
2. inspect repo / docs;
3. verify branch and git / PR state;
4. trace root cause;
5. confirm the fix does not violate locked architecture.

Do not perform broad refactors, unrelated cleanup or spontaneous next-phase work.

If an out-of-scope issue is discovered:

- report it;
- do not silently expand the task.

Default implementation policy:

**IMPLEMENTATION + MINIMAL VALIDATION**

Do not consume unnecessary Work / CI quota with full QA by default.

Full QA/QC is appropriate when:

- the owner explicitly requests it;
- an important integration is about to happen;
- a high-risk architectural invariant changed.

## Review Flow

Preferred workflow:

`implementation → focused commit → implementation report → owner / Advisor review → next focused task`

After an important architecture fix, do not chain many unrelated tasks before review.

## Git / Commit / Report Requirements

Do not merge `development` or `main` automatically.

Use focused commits and avoid unrelated changes.

A final implementation report should include:

- root cause;
- files changed;
- implementation;
- before / after behavior;
- validation actually run;
- remaining risks;
- branch;
- commit hash;
- commit message;
- working tree / PR status;
- preview URL when relevant.

## Project Sources

Prefer existing Project Sources, especially:

- original Audition gameplay video;
- accepted portrait mobile gameplay / Waiting Room sketches;
- repository docs;
- accepted runtime character assets.

Do not ask the owner to upload an existing source again when it is still available.

Use:

- original gameplay video as mechanics / timing reference;
- approved sketch as mobile UI / visual-layout reference.

## Source of Truth

When instructions conflict, use this priority:

1. newest explicit owner instruction;
2. locked architecture / invariants;
3. current task specification;
4. repository implementation and docs;
5. approved visual references;
6. assumptions.

Never let an assumption override an explicit owner decision.

## Current Priority

Stabilize and visually accept P5.6 Waiting Room Visual V2 before moving to Stage Catalog.

Keep the main Waiting Room stable while visual experiments are isolated and compared against the approved sketch.

After owner acceptance, proceed deliberately through integration and the next roadmap milestone.
