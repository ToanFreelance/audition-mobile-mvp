# Isolated Blender Headless Hair Sculpt Demo (GitHub Actions)

**Scope:** Capability test only. No production character, animation, runtime, or catalog changes.

Branch: \`work/blender-headless-hair-demo-v1\`

This experiment creates an original procedural anime bust in Blender, constructs
23 detachable/sculptable hair meshes, renders a baseline, modifies the **existing
hair mesh vertices** (crown volume, swept bangs, face framing, back silhouette),
renders again, exports BEFORE and AFTER GLBs and reimports both GLBs to validate
mesh, material and vertex counts. It never modifies the body geometry.

It uses Ubuntu's system Blender through APT, running in \`--background\`
mode with CPU Cycles. The script does not require any VRoid, licensed asset, paid
addon or GUI. This is an intentionally controlled demonstration of headless
sculpting, **not yet** a Vita/VRM skeleton validation.

## Workflow
\`.github/workflows/blender-hair-sculpt-demo.yml\`

Triggers only for commits under \`tools/blender/**\` or the workflow itself
on \`work/blender-headless-hair-demo-v1\`; manual dispatch is also declared.
All production workflows and runtime remain untouched.

## Outputs
GitHub Actions artifact \`blender-hair-sculpt-demo-<run_id>\` contains:

- \`before.glb\`, \`after.glb\` — actual exported 3D assets
- \`before_front.png\`, \`before_side.png\`, \`before_threequarter.png\`
- \`after_front.png\`, \`after_side.png\`, \`after_threequarter.png\`
- \`hair_sculpt_after.blend\` — editable Blender project
- \`report.json\` — measured vertex modifications, GLB roundtrip, Blender version

PASS requires >= 100 changed hair vertices, > 5cm max displacement and equal
mesh/vertex/material counts before and after GLB reimports. Camera/lights/floor
are excluded from exports. It does **not** claim preservation of a character rig
or VRM expressions; those require a second test using a real rigged character.

## Owner review (iPhone)
Visit repository → Actions → Blender Headless Hair Sculpt Demo →
latest run → Artifacts → download ZIP to the Files app and inspect
PNG images and report.json. No desktop software is needed.

## Local equivalent (optional only)
\`\`\`bash
blender --background --threads 4 --python tools/blender/hair_sculpt_demo.py -- artifacts/blender-hair-demo
\`\`\`
