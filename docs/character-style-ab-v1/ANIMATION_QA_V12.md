# Character Style A+B V1.2 — iPhone orientation, glasses and animation QA

## Owner observations (2026-11-03)
- Soft Mature & Fashion Idol V1.1: Ponytail acceptable, glasses still too large.
- Both VRM avatars load backwards relative to the +Z camera. Manual Flip displays the face.
- Eye presets, outfit Basic/Premium, other modular controls are owner-accepted: preserve.
- Owner explicitly requested direct implementation plus animation QA to find accessory motion clipping.

## Root cause and focused correction
1. VRM source faces -Z; preview camera is at +Z; previous loader applies rotation 0. Add Math.PI on an outer object for VRM; retain zero default for unknown GLB; manual Flip adds Math.PI.
2. Current glasses radius 0.092 world-units too large; reduce to 0.071 (-23%). Lens separation from 0.101 to 0.084; shorten temples, refine depth. Retain head-bone attachment from V1.1.
3. New standalone AnimationQa class: rest-pose procedural bone motion and facial morph QA. Preserve source bone quaternions/morph baselines and restore every frame; no cumulative pose drift. Supports native mesh morph dictionaries plus VRM0 blendShapeMaster groups when exposed via GLTF parser. Unknown morph names are reported as unsupported.

## Manual QA matrix — iPhone Safari
- A/B: load face visible immediately. Flip shows back. Flip disabled shows face.
- A/B: reduce glasses and test at full/front/3-4/face.
- Ponytail + glasses: head nod/shake/tilt; verify attachments follow without slipping.
- Idle/step/wave + Basic/Premium: verify no root-mesh overlap, measure clipping.
- Natural/Doll/Idol: verify tint remains unchanged.
- Facial Blink/Smile/Angry/EyeLook/Mouth: inspect only native supported morphs.
- Run QA suite then Stop/Reset; face/body return to original pose. Repeat after switching avatars.

## Limitations
- Prototype-only tool route: /tools/character-style-ab-v1; NOT gameplay timeline.
- Premium overlays are unskinned geometry and may clip during arm motion, already documented as a known limitation.
- No source model modifications or production actor changes.
- Browser build alone is not owner iPhone Safari visual acceptance.

## Branch
work/facial-modular-eye-demo-v1, PR #24 Draft, no merge.
