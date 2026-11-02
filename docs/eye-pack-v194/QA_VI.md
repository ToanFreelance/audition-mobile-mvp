# Eye Asset Pack V1.9.4 — True eye-region reconstruction experiment

**STATUS: IMPLEMENTATION SCRIPT ONLY / GLB CANDIDATE NOT YET PRODUCED OR VISUALLY ACCEPTED**

## Why V1.9.3 was rejected
V1.9.3 changed lashes and makeup geometry but preserved the original head skin, eyelid patch and ocular meshes. The owner iPhone reference still shows wide-eyed, irregular socket contours, harsh local shadows and insufficiently soft upper/lower lids. Technical pass did not equal visual approval.

## Focus
Run `scripts/eye-pack-v194/reconstruct_eye_region.py` against the exact V1.9.3 GLB SHA-256 `a80088aed5356e2b1b7344f347d77e9c240fdd1ae0755c3771b9de12d31869e4`. Reconstruct the concept-derived **Natural** and **Doll** eye apertures on both sides. Move the entire localized lid-patch geometry with a stationary outer seam, regenerate normals and eyelid Blink/BlinkArc morphs; reconstruct the ocular cap's 22 concentric rings without altering accepted iris UV or textures; retarget each new V1.9.3 cosmetic mesh for all three eye poses. Leave the other seven looks and production Character Catalog untouched.

This is a deterministic geometry algorithm, **not freehand Blender sculpt**. It is an unreviewed candidate-generation approach, not evidence of a successful visual resculpt.

## Local test actually executed
- Python syntax compilation: PASS.
- `scripts/eye-pack-v194/test_synthetic.py`: PASS on **synthetic** V1.9.1-compatible topology for 4 eyes; tests the code paths only, not actual source asset or appearance.
- Real V1.9.3 GLB generation: **BLOCKED** (CloudFront binary could not be downloaded in the implementation environment).
- Blender export/reimport/render: NOT RUN.
- Khronos glTF Validator: NOT RUN.
- Chromium WebGL2/Three.js: NOT RUN.
- Physical owner iPhone visual test: NOT RUN.

## Run
```bash
pip install numpy scipy
python3 scripts/eye-pack-v194/reconstruct_eye_region.py /path/to/v193.glb /path/to/v194_candidate.glb
python3 scripts/eye-pack-v194/test_synthetic.py
```

The generator refuses any source GLB whose SHA-256 differs from the verified V1.9.3 asset. It writes a sidecar JSON report.

## Integration gate
**Do not update** `EyeSetCatalog.ts`, GLB URL/cache key, or Vercel Preview until the exported candidate is validated against the actual source with Blender reimport, glTF Validator, WebGL2, shape-key blink, front and 3/4 side-by-side images, and physical iPhone owner visual acceptance. No production character/gameplay/Supabase/WebAudio changes. PR #24 must stay Draft; do not merge.
