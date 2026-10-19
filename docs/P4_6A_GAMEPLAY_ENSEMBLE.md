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
Actor GLB/retarget processing happens independently; HTTP browser cache may
reuse downloaded files, but parsed GLB/mixer and associated render resources
are currently actor-owned. Five skinned actors may be costly on iPhone.
No global graphics-quality reductions were applied.
Validate real five-actor scene before any resource-sharing optimization.
