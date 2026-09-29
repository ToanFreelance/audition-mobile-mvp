# Audition Video-to-Motion Handoff V1

## Branch

`work/character-rig-animation-v1`

Base: latest accepted `development` after P5.6 merge.

## Prepared character QA assets

Local/generated owner-download assets:

- `Nam_co_ban_MESHY_TEXTURED_RIG_v1.glb`
- `Nu_co_ban_MESHY_TEXTURED_RIG_v1.glb`

Both preserve the Meshy auto-rig skin/skeleton and restore the original Tripo PBR texture stack.

Embedded source clips:

- Nam: `Running`
- Nữ: `Walking`

Do not promote these assets into Character Catalog until owner iPhone deformation/material QA is accepted.

## Prepared video-to-motion inputs

From the higher-quality Audition source:

- `audition_normal_two_actor_20s.mp4`
  - source range: approximately 194s–214s
  - 720x720 / 30 fps
  - cropped to the two dominant right-side dancers
  - intended for Normal dance motion extraction

- `audition_finish_two_actor_11s.mp4`
  - source range: approximately 119.5s–130.5s
  - 720x720 / 30 fps
  - cropped to the two dominant right-side dancers
  - intended for Finish motion extraction

The crop removes the three left-side dancers from the full five-person stage to reduce pose ambiguity.

## Preferred extraction path

Use a dedicated video-to-motion solver. The input clips are presentation references only; gameplay timing remains WebAudio-authoritative.

Preferred output:

- FBX or GLB motion;
- body skeleton only is sufficient;
- Mixamo-compatible naming is preferred but not required;
- preserve root translation when the source phrase genuinely travels;
- no gameplay timing or turn data should be embedded in the asset.

After motion export:

1. inspect source skeleton and track names;
2. retarget to the accepted Meshy character skeleton;
3. trim to exact four-beat phrase boundaries for Normal dance candidates;
4. preserve Finish as a bounded one-shot presentation clip;
5. test Nam + Nữ on the isolated rig QA route;
6. only after owner acceptance, publish into the animation content pipeline.

## Semantic contract

Normal gameplay remains:

- `dance-01`
- `dance-02`
- `dance-03`
- `dance-04`
- `dance-05`
- `dance-06`
- `dance-07`
- `dance-08`

Additional motion variety belongs under presentation variants of these eight semantic slots.

Finish remains:

- `finish-special`

Only AUDIO END ends the game.
