# Reproducing V1.9.2 bounded rounded-aperture correction
This is a focused **real GLB vertex transformation** of the V1.9.1 EyeSet asset, not a repaint, a new project or an artist-authored full sculpt.

## Inputs
- Source V1.9.1 GLB SHA-256 `312c0c4fdf74de9c366258d1442039db12c7c82ffa13d6d4fe407854853d9ac4`.
- `scripts/eye-pack-v19/glb_tools.py`.
- Python 3.11+, numpy, scipy.

## Build
```bash
python3 scripts/eye-pack-v192/round_silhouette.py \
  path/to/Female_head_EyeSetPack_9_V191.glb \
  output/Female_head_EyeSetPack_9_V192_candidate.glb
```
`geometry_report.json` is saved beside the output. It records affected nodes and displacements.

## QA
Reuse V1.9.1's glTF/geometry/Blender QA machinery:
```bash
python3 scripts/eye-pack-v191/validate_pack.py \
  output/Female_head_EyeSetPack_9_V192_candidate.glb \
  path/to/Female_head_EyeSetPack_9_V19.glb \
  output/validation_full.json
```
Reimport output GLB to Blender or GLTFLoader; render 9 variants, blink, close-up and 3/4. Test real Safari separately. All validation claims and remaining risks are in `docs/eye-pack-v192/QA_VI.md`. Changing the GLB URL requires a new versioned Cache Storage key.

No production integration and no PR merge without owner approval.
