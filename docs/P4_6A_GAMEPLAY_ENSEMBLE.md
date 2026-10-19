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
