# Golden Mouth V1 — source-specific local facial retopology

Branch base: Golden Eye V8 `1a0ba6e4fd8a1a0e76453a2e698fb9fcc5746576`.
Route: `/qa/female-golden-face-v1/index.html`.

No original/full-head GLB is committed. The input is the owner's original GLB,
SHA-256 `b5ba67fa8b5b2440c0244acf5df0e47c6f7f487b81e9636fcbee4a5afdba1e90`.
Python: numpy, scipy, shapely 2.1.2, Pillow. Node: Three.js 0.180.0.

```bash
python scripts/golden-mouth-v1/build_patch.py /path/original.glb public/qa/female-golden-face-v1
node scripts/golden-mouth-v1/verify.mjs /path/original.glb /path/three/build/three.module.js /tmp/mouth-render/runtime
python scripts/golden-mouth-v1/verify_topology.py
```

`build_patch.py` clips the original baked smile at a fixed ellipse, interpolates
source UVs/normals at every cut triangle, stitches the exact boundary to a common
radial topology, and generates nine lip/perioral poses plus a recessed closed
cavity. The source color is reprojected into a compact local skin texture; the old
lip pigment is replaced with a smooth continuation sampled from surrounding skin.
Imported skin normals are continued across the skin annulus; vermilion uses
geometric normals. This is targeted procedural retopology with calibrated
landmarks and custom shading normals, not a claim of manual Blender sculpting.

`mouth-rig.js` imports NO eye module, controls NO eye state, and adds no targets to
the head. It removes exact mouth face triplets from V8's working index; eye
vertex IDs, pose data, iris, materials and all three eye morph targets remain
unchanged. Its own patch/cavity/rounded teeth have eight immutable relative GPU
position + normal targets (Natural is the basis). No per-frame geometry rebuild.
The local chin support lies inside the fixed patch boundary; no full mandible
bone/rig or anatomical jaw retopology is claimed.

Dispose mouth before eye, then release the GLB. Original comparison calls both
rigs' `setOriginal`, showing the untouched original head and hiding the patch.
Never dispose shared skin/iris textures while loading a replacement model; they
are owned by the resource cache.

## Real render evidence

```bash
blender -b -t 6 --python scripts/golden-eye-v8/prepare_blender.py -- /path/original.glb /tmp/mouth-render
# verify.mjs exports evaluated runtime positions, UV, colors, normals and indices
node scripts/golden-mouth-v1/verify.mjs /path/original.glb /path/three/build/three.module.js /tmp/mouth-render/runtime
blender -b -t 6 --python scripts/golden-mouth-v1/render_blender.py -- /tmp/mouth-render natural soft-smile bright-smile playful-smirk cute-pout surprised shy idol-smile blow-kiss bright-smile-quarter playful-smirk-quarter cute-pout-quarter surprised-quarter blow-kiss-quarter
```

Blender 4.3.2 CPU Cycles, 96 samples, denoising OFF. These are exported Three.js
runtime mesh buffers, not a separately approximated rig or generated concept.
Lighting/material interpretation differs from Safari. These renders do NOT
establish WebGL shader, FPS, touch UI, browser memory or physical iPhone PASS.

`golden-mouth-reference.jpg` is the unchanged owner-provided reference. Evidence
sheets pair crops of that image with actual renders; no new concept is generated.
