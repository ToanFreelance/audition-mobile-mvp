# Golden Eye V8 — isolated source-specific rig

Route: `/qa/female-golden-eye-v8/index.html`.
Base: `ae50342ad8c90a311dfed38f18deea3a37178ed7` on `work/female-origin-eye-rig-v3-qa`.
V7/V7.1 files are not edited. No GLB is committed or uploaded.

## Rebuild

Python dependencies: numpy, scipy, matplotlib, shapely 2.1.2. Input is the owner-provided original GLB whose SHA-256 is recorded in `eye-rig.json`.

```bash
python scripts/golden-eye-v8/build_patch.py /path/Female_anime_origin.glb public/qa/female-golden-eye-v8
node scripts/golden-eye-v8/verify.mjs /path/Female_anime_origin.glb /path/three@0.180.0/build/three.module.js
```

Commit only `eye-patch.bin.gz` and `eye-boundary.json.gz`, not their raw staging versions. Float deltas are rounded to 0.00001 model units before compression; compression has deterministic mtime=0. The `approved-iris-atlas.webp` is a crop-only extraction from the supplied Golden Iris sheet, not generated artwork. Tile centers/radii in source pixels: `(204,252,161)`, `(556,252,161)`, `(910,252,161)`, `(204,676,161)`, `(556,676,161)`, `(910,676,161)`, `(204,1108,163)`, `(556,1108,163)`, `(910,1108,163)`; resize each crop to 384², assemble row-major, encode WebP quality 94.

## Blender evidence

Blender 4.3.2 CPU Cycles, 96 samples, no denoising. Prepare a private working directory, then render the SAME separation topology, pose delta buffers, sphere/cap construction and extracted atlas used by the browser rig:

```bash
blender -b --threads 6 --python scripts/golden-eye-v8/prepare_blender.py -- /path/Female_anime_origin.glb /tmp/eye-v8-render
blender -b --threads 6 --python scripts/golden-eye-v8/render_blender.py -- /tmp/eye-v8-render natural joyful sad playful angry doll idol star heart playful-quarter doll-quarter
```

The Blender renderer is not a Three.js/WebGL screenshot: lighting, tone mapping, normal-map interpretation and specular response differ. It verifies actual geometry, depth occlusion, gaze and UV orientation. It must not be labeled browser/iPhone acceptance. The cloud browser reported `GL_RENDERER = Disabled`; local Chromium launch was also blocked by the execution sandbox.

## Geometry

- Clip source triangles at the traced ocular aperture; barycentrically interpolate UV/normal/position at the cut boundary.
- Append only boundary vertices; original mesh/texture/indices are retained for exact comparison and disposal.
- Nine fixed contour and brow landmark sets drive a constrained thin-plate deformation field, with anchors outside the eye region. No strength slider.
- Lid depth follows the sphere to avoid its penetrating a raised lower lid (especially Joyful).
- Two spherical ocular surfaces bounded by the eye opening, each with a separate curved iris cap. Both pivots rotate -0.25 radians about mesh-local Z for Playful (screen-right at frontal view); all iris details rotate coherently.
- A complete sphere poked through the shallow scanned temple at 3/4. V8 bounds the sclera surface to each target aperture; the iris rotates independently on the same underlying sphere.
- Upper artwork maps to -local Z, no X mirroring between eyes. Round iris geometry does not inherit the eyelid deformation.
- Geometry changes affect only local QA, not Character Catalog, gameplay, Waiting Room or animations.

## Remaining acceptance

Physical iPhone: first load, all nine presets, switching without reload, original restore, front/36°/zoom, smooth depth occlusion, Safari material appearance, memory use and repeated load/dispose. The shape is not a hand-sculpted full facial retopology; eyelash strips and baked skin detail still come from the original GLB.
