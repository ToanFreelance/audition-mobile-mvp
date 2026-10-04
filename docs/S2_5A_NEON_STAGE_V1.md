# S2.5A — Neon Stage V1

## Status

Active visual/runtime milestone on `work/s2-5a-neon-stage-v1`.

Current implementation direction: real Three.js Stage3D runtime, art-directed directly against the owner-approved concept. The earlier Higgsfield R1–R6 scene-builder blockouts are reference/debug experiments only and are not the final Neon Stage asset.

Parent architecture milestone: S2 Stage Catalog / PR #16.

## Source of truth

Owner-approved Project Source:

`neon_audition_dance_arena.png`

This image is the visual target for Neon Stage V1.

Do not revive the rejected `neon-club-v3` visual direction.

## Visual contract

Preserve the following composition:

- broad curved overhead truss spanning the stage;
- distributed cyan and saturated violet/magenta moving-head fixtures;
- large central LED backdrop;
- strong AUDITION-style center branding zone;
- tall cyan/magenta side light pillars;
- curved multi-tier risers / stairs behind the dance area;
- wide glossy reflective tiled floor;
- central circular neon dance mark;
- strong left/right symmetry with enough depth for multiple camera presets;
- premium bright-neon presentation rather than a dark club cave.

The stage must still read clearly behind gameplay HUD and characters on portrait iPhone.

## Motion contract

Presentation animation may include:

- moving-head pan / tilt;
- soft beam sweeps;
- LED wall pulses / graphic motion;
- emissive edge pulses;
- restrained floor/riser light movement.

Motion must be presentation-only.

Authoritative timing remains:

`WebAudio song time → Stage3D presentation consumer`

Stage animation must never:

- own beat or global-turn state;
- pause/repeat/rewind gameplay;
- extend a level;
- change Finish semantics;
- start/stop gameplay audio.

## 3D workflow

1. Use Higgsfield 3D to create an editable blockout matching the approved concept.
2. Review silhouette, depth, camera framing, floor/riser scale and lighting.
3. Iterate until owner accepts the 3D direction.
4. Export a portable GLB / runtime asset.
5. Add a `neon-stage-v1` presentation profile.
6. Register the runnable asset through Stage Catalog.
7. Validate mobile camera compatibility and runtime lifecycle.
8. Keep Bright Stage V1 untouched.

Higgsfield-generated animation/video may be used as visual reference, but the gameplay stage itself must remain a real Stage3D runtime environment.

## Non-goals

- Host Stage Selector UI (S3);
- RoomState / CAS / Realtime changes;
- Waiting Room layout changes;
- gameplay scheduler changes;
- WebAudio authority changes;
- gauge / Finish changes;
- Stage Catalog redesign beyond what S2 already established.

## Acceptance

Owner reviews:

1. interactive/editable 3D blockout;
2. runtime Neon Stage V1 on mobile;
3. animation / light motion;
4. portrait gameplay readability.

Only after owner acceptance should `neon-stage-v1` become selectable.
