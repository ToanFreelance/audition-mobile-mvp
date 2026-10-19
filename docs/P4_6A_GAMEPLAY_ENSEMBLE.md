# P4.6A — Multiplayer Gameplay Ensemble: Formation Foundation

## Scope
Dedicated branch `work/p4-6-gameplay-ensemble`, based on development
`abdf8d9c2e5da3ac403397cc8ca54ecbf526d781`. No changes to PR #19.
P4.6A adds only actor/presentation runtime and isolated in-memory QA.
P4.6C remote animation and outcome sync is NOT implemented.

## Data & lifecycle
`MatchManifest.participants[] -> participantId + slotIndex + avatar.characterAssetId
-> avatarCharacterAssetId legacy migration -> Character Catalog -> CharacterActor`.
Each participant owns one distinct CharacterActor with independent loaded GLB,
animation mixer and production animation controller. Local presentation judgement
events continue to target ONLY the local actor. Remote participants remain in
production idle state; no fake Perfect/Miss/Finish, no new network packets.
Actor reconciliation is keyed by participantId and catalog assetId and is
independent of roster metadata. No additional RAF or WebGL renderer.

## Formation
Formation slots use immutable room slotIndex order and deterministic
center-out positions. All actors have floorY=0.02 and a slight Z stagger.
The gold ring marks only the local actor, without editing gameplay HUD.

| Stage | X scale | Z offset | Ensemble camera extra Z | Rationale |
|---|---:|---:|---:|---|
| Bright Stage | 1.00 | 0.00 | +1.3 | Keep original dance mark clear |
| Neon Stage | 0.94 | +2.00 | +1.5 | Reuse accepted foreground dance pad placement |
| Basketball Court | 1.08 | 0.00 | +1.3 | Open center court with slightly broader spacing |
| Haunted Classroom | 1.00 | 0.00 | +1.0 | Shallow stagger between desks; floor remains fixed |

The portrait-only ensemble camera then adds count-based spread distance;
single actor and landscape retain production presets. Existing stage geometry,
materials, lighting, animations, Stage Catalog and solo gameplay remain unchanged.

## QA
`/tools/p4-6-ensemble-qa`: four accepted stage selectors, 1–5 independent
actor fixtures, local marker, real character loads, actual mixer lifecycle and
actor diagnostic state. The route does not create Supabase rooms, does not
modify RoomState and never claims multiplayer synchronization.
WebGL device availability is required to inspect real meshes.
Use physical iPhone for silhouette, foot contact, occlusion, frame time,
thermal and battery validation. Browser-only/CI results cannot clear that gate.

## Current constraints
GLB network requests are deduplicated per asset URL through a small
in-memory binary Promise cache; each CharacterActor still parses an isolated
GLB, skeleton, mixer and controller. There is NO unsafe shared-GPU disposal.
Retarget CPU cost and five skinned actors remain potential iPhone bottlenecks.
No global graphics-quality reductions were applied.
Validate real five-actor scene before any resource-sharing optimization.

For an out-of-scope historical manifest of six occupants, Stage3D retains
the previous single-local-actor rendering instead of truncating the frozen
roster and potentially dropping local-player presentation.

The QA route initializes with one real actor to keep stage switching responsive
on constrained GPUs; the owner can explicitly select up to five independent
actors. Focused CI tests use a longer action timeout only for costly stage
switching, without turning asset/load failures into false PASS.

Gameplay presentation readiness waits for the stage and LOCAL actor only;
remote asset loading/errors are reported independently and cannot delay the
shared WebAudio timeline or hold the local entry curtain closed.

## P4.6A iPhone formation spacing follow-up (2026-10-19)
Owner iPhone captures showed that all five actual actors load on every
accepted venue, but the four- and five-player groups crowded the center despite
clear lateral stage space. This is a formation-slot spacing issue, not a camera,
stage-geometry, character identity or animation issue.

Only counts 4 and 5 have wider world-X positions; one-to-three actors, Z
stagger, floor height, camera profiles, scene art and runtime ownership are
unchanged. Four: inner +/-1.02, outer +/-3.05 versus +/-0.80 and +/-2.15.
Five: inner +/-1.68, outer +/-3.35 versus +/-1.30 and +/-2.50.
Existing stage-specific X scales continue to apply: Bright 1.00, Neon 0.94,
Basketball 1.08, Classroom 1.00. Max five-player X is 3.618 (Basketball);
the smallest horizontal adjacent gap is 1.570 (Neon).

This improves spacing by construction but does not claim cleared props,
animation envelopes, stage occlusion, real iPhone frame rates, or owner visual
acceptance. Owner to retest 4/5 actors across the four stages.

## P4.6A iPhone row-formation follow-up (2026-10-19, supersedes earlier spacing layout)
Owner reported three performers still clustered on every stage and five in
Neon still crowded. Apply one row to counts 1–3, three rear + one front to 4,
and three rear + two front to 5. Camera sits at positive world-Z, so **front
actors must have greater Z**, not smaller. The front four-player slot is offset
between rear center/right to avoid direct overlap. The two five-player front
slots align with the rear left/center and center/right gaps.

| Count | X slots (pre stage scale) | Z slots (pre stage offset) |
|---|---|---|
| 1 | 0 | 0.25 |
| 2 | -1.55, +1.55 | both 0.50 |
| 3 | -2.35, 0, +2.35 | all 0.55 |
| 4 | -2.50, 0, +2.50, +1.25 | back x3 at 0.45; front at 1.90 |
| 5 | -3.00, 0, +3.00, -1.65, +1.65 | back x3 at 0.45; front x2 at 1.95 |

Neon scaleX is now 1.12 instead of 0.94; its stage-specific Z offset +2
remains intact. Bright/Classroom remain x1.00, Basketball x1.08. No change
to stage/environment art, camera, character actors, mixers, WebAudio or
network/gameplay protocol. The earlier 4–5 single-row spacing note above is
historical and no longer current. Owner iPhone visual/animation clearance
and mobile GPU/FPS acceptance still require a new hardware test.

## P4.6A Neon five-person spacing follow-up (2026-10-19)
Owner's iPhone visual test confirms four-person 3+1 looks compositionally
unbalanced, and five-person Neon still needs slightly more shoulder clearance.
For **five-person Neon only**, effective scaleX increases from 1.12 to 1.20
(+7.14%). Outer actor centers change from +/-3.36 to +/-3.60; forward
actors change from +/-1.848 to +/-1.980. This remains inside the existing
+/-3.62 tested actor-center envelope. Other counts and other stages do not
change; camera and Z remain unchanged. A symmetric two-rear/two-front layout
is proposed for four players but **not implemented** pending owner selection.
Hardware silhouette/performance acceptance remains open.
