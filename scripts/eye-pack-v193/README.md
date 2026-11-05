# Eye Asset Pack V1.9.3 — Reproducible GLB Eye-Region Pass

Produces one versioned GLB from the **existing V1.9.2** Claude V2 eye asset. Does not create a new application or change gameplay architecture.

Source SHA-256: `7221dac79642b283f85740c3ca3053d49f19f52aabf29a6296fb091c0f265cf2`.

```bash
python3 -m pip install numpy scipy
python3 scripts/eye-pack-v193/rebuild_eye_frames.py \
  /path/to/source-v192.glb /path/to/V193_EyeFrame_candidate.glb
python3 scripts/eye-pack-v193/qa_geometry.py \
  /path/to/source-v192.glb /path/to/V193_EyeFrame_candidate.glb
```

Asset output is a QA candidate; no automatic merge or Character Catalog update. See `docs/eye-pack-v193/QA_VI.md` for root cause, actual validation and remaining artistic differences from the approved concept.
