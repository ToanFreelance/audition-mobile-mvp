# Golden Mouth V2 — M01 native surface

Blender **4.3.2**, Cycles **CPU**. Source SHA-256:
`b5ba67fa8b5b2440c0244acf5df0e47c6f7f487b81e9636fcbee4a5afdba1e90`.
No source GLB in Git. Owner's attached `(6)` file matches requested `(5)` bytes.

This is controlled proportional deformation of the imported original head in an
editable Blender shape key. It is not hand-operated brush sculpting and not a
procedural lip-strip/skin replacement generator. Basis and M01 share all
292645 vertex identities, 499762 triangles and original UVs/materials.

## Reconstruct the editable asset

```bash
blender --background --factory-startup --threads 8 --python-exit-code 1 \
 --python scripts/golden-mouth-v2/sculpt_m01.py -- \
 --source /path/Female_anime_origin.glb --output /path/m01/iteration-02 \
 --sculpt --iteration 2 --render front left35 right35 profile mouth clay
```

The script saves `m01-native.blend` **before** rendering. Also writes sparse
native deltas, evaluated Blender normals, source vertex positions and a manifest.
Use `--iteration 1` to reproduce the first attempt. In Blender, select `node_0`,
Object Data → Shape Keys → `M01_Natural_EXPERIMENTAL`; weight 0 restores Basis.
Original textures are embedded in the imported/saved `.blend`.

## Compare actual runtime geometry with the sculpt

```bash
node scripts/golden-mouth-v2/export_comparison.mjs \
 /path/Female_anime_origin.glb /path/three/build/three.module.js \
 /path/m01/iteration-02/m01-native.json.gz /path/m01/comparison-runtime
blender --background --factory-startup --threads 8 --python-exit-code 1 \
 --python scripts/golden-mouth-v2/render_comparison.py -- /path/m01 \
 original:front original:left35 original:right35 original:profile original:mouth original:clay \
 v1:front v1:mouth v1:clay \
 v2:front v2:left35 v2:right35 v2:profile v2:mouth v2:clay
```

Three.js pinned **0.180.0**. Comparison uses unchanged V1 and V8 modules.
All geometry is exported from actual runtime buffers, then rendered in Cycles
with the same framing/scale/lights. Original uses original eyes; V1/V2 use V8.
Golden art is cropped/scaled only; no generated replacement reference.

## Browser regression

```bash
python -m http.server 8765 --bind 127.0.0.1 --directory public &
qa_server_pid=$!
trap 'kill "$qa_server_pid" 2>/dev/null || true' EXIT
node scripts/golden-mouth-v2/browser_check.mjs \
 http://127.0.0.1:8765/qa/female-golden-mouth-v2/index.html \
 /path/Female_anime_origin.glb /path/playwright/index.mjs \
 /path/chrome-headless-shell /path/node_modules/three /path/m01/webgl
```

Run server and browser in the same executor command when separate command
invocations have isolated loopback namespaces. The test routes CDN Three.js
requests to the identical installed r180 package; all renderer/shader code runs
normally in the browser. This is transport substitution, not a renderer mock.

Full `/usr/bin/chromium` fails ProcessSingleton socket EPERM in this executor.
Chrome Headless Shell **157.0.8103.38**, ANGLE/SwiftShader works. The bundled
Playwright downloader's v151 URL returned a 195-byte HTML page, not ZIP.
The actual binary was downloaded using Chrome for Testing's official stable
manifest, from `storage.googleapis.com/chrome-for-testing-public/157.0.8103.38/linux64/chrome-headless-shell-linux64.zip`.
ZIP integrity was verified by Python zipfile extraction. No claim of an official
published checksum for Chrome. Browser flag list is in `browser_check.mjs`.

## Runtime isolation

`/qa/female-golden-mouth-v2/index.html` is separate from the existing V1 route.
M01 applies an absolute sparse native pose; no triangle/index replacement, new
skin mesh, new material or additional eye morph slot. V8 requires exactly three
eye morph slots; this invariant is retained. After an eye preset switch, the QA
orchestrator reapplies the independent mouth pose to the same geometry object.
Mouth selection does not call any eye APIs or reset gaze/blink/expression.
Original comparison uses the untouched original geometry. No gameplay/catalog,
Supabase, source GLB upload, or V8 source changes.

No open-mouth rig, teeth or other mouth presets are implemented. Future wide-open
poses may require separate topology planning; neutral M01 does not prove them.
