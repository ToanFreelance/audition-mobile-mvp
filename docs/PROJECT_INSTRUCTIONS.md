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

`work/mvp-entry-room-flow-v1` (PR #18 OPEN / Draft; base `development`)

Current milestone:

`PR #18 closeout — C1 Character Creation accepted on iPhone; next Room Browser review pending`.

Screen acceptance order: Character Creation → Room Browser → Waiting Room → Gameplay. No visual work on subsequent screens before owner accepts the current screen.

P5.6 Waiting Room Visual V2 was owner-accepted and merged into `development` via PR #15 at merge commit `d27168929f9923b1de561133b941977d039d56a1`.

PR #16 and PR #17 are merged; their original work branches are historical. Never merge PR #18 or directly change `development`/`main` without explicit owner approval.

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

Phase 14 is deferred until the primary product phases are complete. Phase 12 GPU/FPS/cross-device/DPR/thermal/battery optimization is deferred as performance debt, not considered fixed.

Current active roadmap work: **PR #18 main flow closeout, beginning with C1 Character Creation**. P5.6/PR #15, S2/PR #16 and S2.5A/PR #17 are merged and accepted for their respective recorded scope. Five-Human and AUD01 QA gates remain open; do not claim all multiplayer QA passed.

Future milestones (P4.6 ensemble, remaining S2.5 venues, S3 Host Stage Selector and performance optimization) must not start before the owner accepts the main user flow or explicitly reprioritizes.

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

## P5.6 Accepted Baseline

P5.6 is the accepted portrait/mobile-first Waiting Room visual baseline and is integrated into `development`.

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

S2 Stage Catalog is a **completed historical milestone** (merged PR #16); S2.5A Neon Stage V1 is also merged (PR #17). Current work is PR #18 C1 visual closeout.

Locked stage-resolution direction:

`selectedStageId → Stage Catalog → runtime asset → presentation profile → Stage3D`

S2 owns the catalog/runtime-resolution boundary only.

The technical name remains Stage Catalog, but a catalog entry may represent a broader play environment / venue, not only a concert stage.

Reserved S2.5 environment IDs:

- `bright-stage-v1` — accepted existing default;
- `neon-stage-v1` — planned Neon Stage derived from the accepted P5.6 Waiting Room visual language;
- `football-field-v1` — planned sports venue;
- `classroom-v1` — planned classroom venue;
- `cafe-v1` — planned cafe venue.

S2.5A Neon Stage V1 uses the accepted Waiting Room stage composition as its visual source.

The owner-approved Neon Stage concept image `neon_audition_dance_arena.png` is the visual source of truth for S2.5A. Preserve its core composition: curved overhead truss, cyan/violet lighting, large LED backdrop, curved multi-tier risers, glossy reflective dance floor, and central circular dance mark.

Higgsfield 3D / animation tooling may be used for blockout, redraw and motion-source exploration. The final gameplay runtime remains owned by Stage3D and consumes authoritative song time; generated media must never own gameplay timing.

Host stage-selection UI belongs to S3 and must not be started early.

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


## Stable Phase Preview Alias Policy

Each product phase / milestone must keep one stable work branch for the lifetime of that phase.

Use Vercel's generated Git Branch URL as the official QA origin for that phase:

`<project>-git-<branch>-<scope>.vercel.app`

Rules:

- do not use deployment-specific hash URLs as the normal owner QA link;
- every commit within the same phase continues to deploy behind the same Git Branch URL;
- use a fresh `_vercel_share` token only when deployment protection requires it; changing the query token must not change the hostname;
- browser Cache Storage is origin-scoped, so keeping the hostname stable allows heavy runtime assets to be reused across commits;
- when a new phase starts, create its own work branch and record/use its new stable Vercel Git Branch URL as that phase's QA origin;
- do not rename or replace the phase branch merely for visual iterations;
- deployment-specific URLs may still be used for debugging an exact historical commit, but not as the default owner test link.

This policy exists to reduce repeated Supabase asset egress during iterative mobile QA.

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

**2026-10-15: C1 Character Creation owner visual acceptance PASS (physical iPhone).** The approved concept's second screen has been adapted with confirmed chrome/icons, avatar look-presets, fixed viewport and toolbar clearance. Chromium responsive QA PASS at tablet portrait 768×1024, tablet landscape 1024×768, desktop 1280×800, desktop 1440×900 and short desktop 1024×600; the visual camera correction applies only to narrow tablet-stage framing. **Physical tablet/desktop acceptance is NOT VERIFIED**; browser simulation must not be conflated with native GPU/input/performance evidence.

C1 is accepted; the next screen in the strict sequence is **Room Browser**, not yet started in this review. Wait for the owner's next explicit C2 task before changing it. Then proceed sequentially to Waiting Room and Gameplay. Phase 12/14 performance optimization, P4.6, remaining S2.5 venues and S3 are deferred. Do not merge PR #18 without owner approval.

Never change WebAudio song clock, global turns, gauge, Finish, RoomState CAS/Realtime, frozen MatchManifest, preload/shared epoch, or actor lifetime for these visual adjustments.
