# Facial Modular Eye V1 — isolated 3D customization demo

Route: /tools/facial-modular-eye-v1

## Purpose / owner scope
Prototype facial eye customization with the visible eye module including both eyelashes. Owner wants selectable iris patterns/colors, interactive sizing and a mobile-first page.

This is an ISOLATED PROCEDURAL THREE.JS PREVIEW, deliberately NOT the Tencent HY3D / Claude V2 repaired female head GLB. It is not a production asset, a new character catalog entry, a morph-compatible facial rig, or a claim that the remaining iris membrane defect is fixed.

## Implemented
- 4 procedurally generated iris patterns; six swatches and arbitrary hex via color picker.
- Eye scale, width, height, separation, iris scale and pupil scale sliders.
- Lashes (natural, doll, dramatic, none) as explicit children of each eye group; upper/lower skin rim stays outside the interchangeable lash style.
- Front / left 3/4 / right 3/4 view presets.
- Copy current JSON contract for later asset mapping; restore defaults.
- 3D scene initialized once; controls update transforms and iris texture without creating a new WebGL renderer.
- WebGL unavailability is stated plainly rather than displaying a fake successful 3D preview.
- Scoped CSS module; no changes to runtime, Character Catalog, Supabase, gameplay or P5.6.

## State contract (prototype only)

{
  "schemaVersion": 1,
  "type": "eye-module-poc",
  "irisStyleId": "natural",
  "irisColor": "#94613f",
  "eyeScale": 1,
  "eyeWidth": 1,
  "eyeHeight": 1,
  "eyeSpacing": 1,
  "irisScale": 1,
  "pupilScale": 0.38,
  "lashStyleId": "natural"
}

Numeric values are prototype multipliers, NOT production bone scales or persisted participant data. Controller owns sclera/iris/pupil and lashes; face skin and anatomical eyelid rim require topology/morph integration later.

## Not implemented / gates
- Does not import or modify the 38 MB Claude V2 GLB, its atlas, its eyelashes, face skin or damaged upper-lid patch.
- Does not yet offer production-grade interchangeable topology or rigged blink.
- Procedural preview changes are illustrative; anatomical continuity with an existing face mesh is not yet validated.
- No participant.avatar.face migration or production integration.
- Owner iPhone visual acceptance and real GLB validation remain separate work.

## Focused QA
Run:

npx playwright test e2e/facial-modular-eye-v1.spec.ts --project=desktop --workers=1

Also typecheck/build/lint and inspect on iPhone Safari. The automated tests validate UI state rather than rendered artistic fidelity.
