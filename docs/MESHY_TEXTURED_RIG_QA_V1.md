# Meshy Textured Rig QA V1

## Scope

Branch: `work/character-rig-animation-v1`

Base: `development@d27168929f9923b1de561133b941977d039d56a1`

This pass does not modify Character Catalog, Waiting Room authority, gameplay timing, WebAudio, gauge, Finish semantics, sequenceCounts, Stage Catalog, or multiplayer protocol.

## Source inputs

Original visual assets:

- `Nam_co_ban.glb`
- `Nu_co_ban.glb`

Meshy rig outputs:

- male: 28-joint Mixamo-compatible skin + embedded `Running`
- female: 66-joint Mixamo-compatible skin + embedded `Walking`

## Transfer result

Generated QA assets:

- `Nam_co_ban_MESHY_TEXTURED_RIG_v1.glb`
- `Nu_co_ban_MESHY_TEXTURED_RIG_v1.glb`

The Meshy auto-rig geometry preserves the original triangle order but duplicates triangle-corner vertices. The transfer therefore restores:

- original `TEXCOORD_0`;
- original normal map;
- original base-color texture;
- original metallic/roughness texture;
- original PBR material.

Skin, bone hierarchy, inverse bind matrices and the Meshy embedded animation remain authoritative from the Meshy file.

Validation:

- male: 1 skin · 28 joints · Running clip · 1 material · 3 textures · 3 embedded images;
- female: 1 skin · 66 joints · Walking clip · 1 material · 3 textures · 3 embedded images;
- sampled triangle geometry correspondence is within `1e-5` after Meshy scale normalization;
- UV assignment covers every Meshy vertex;
- UV seam conflicts encountered while assigning reused Meshy vertices: male 22, female 6 out of ~1.47M vertices.

These assets remain QA-only until owner iPhone visual/deformation acceptance.

## QA route

`/tools/character-rig-qa`

The route now accepts arbitrary embedded clips rather than requiring legacy `QA_Idle / QA_NormalDance / QA_Miss / QA_Finish` clip names.

Current expected test:

- male: Rest Pose + Running;
- female: Rest Pose + Walking.

Audition-style motion clips will be added only after video-to-motion extraction/retargeting is validated.
