# Eye Asset Pack V2.0.4 — nine-look QA candidate

This is a focused QA implementation on PR #24, **not a production asset swap**.

- Input: owner-approved Claude Hybrid V2.0.3 C1 GLB.
- Natural is unchanged; 8 other atlases are adjusted to align with the new nine-look concept.
- New material textures and updated Smile / Sad / Mischief / Angry morph presets are configured. No changes to mesh topology, UV, normals or underlying morph deltas.
- `scripts/eye-pack-v204/build_from_atlases.py` reconstructs the candidate using QA atlas PNGs from the separately delivered asset bundle:
  `python scripts/eye-pack-v204/build_from_atlases.py --base c1_candidate.glb --atlas-dir /path/to/QA --out EyeAssetPack_V204_candidate.glb`
- This repository commit intentionally does **not** include the 68.6 MiB GLB or the generated atlas PNGs and does not alter runtime URL/cache keys.

## Validation performed
- 9/9 presets rendered in Chromium WebGL2 with an eye-region proxy at front, 3/4 left and 3/4 right (27 checks).
- 6 full-GLB WebGL2 checks: Natural front, Smile front, Angry front, Doll 3/4, Star front, Heart front.
- 13 structural checks passed. GLB compaction preserved 20 accessor contents and 13 image contents.
- QA images and scripts were produced as separate conversation artifacts.
- **Not yet validated:** Khronos validator, Three.js production runtime, full Blink, iPhone Safari owner acceptance.
- **Visual acceptance:** pending. Eyelid/eyebrow fidelity remains below the approved concept in some presets; do not claim 90%.

## Branch state
Work branch `work/facial-modular-eye-demo-v1`, PR #24 Draft. No merge and no Preview update.
