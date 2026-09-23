# C1 Casual Grace — temporary female MVP character

Owner-provided source: Meshy_AI_Casual_Grace_biped.zip.

Source Running GLB:
- SHA-256: b966e1600b58e1914bbc4ccec2ce586b476e0c58b2484eb57cc9c3f7c7e3488c
- 10,634,408 bytes
- 65,709 vertices / 110,514 triangles
- 1 skinned mesh, 28 Mixamo-style joints, 3 embedded 2K textures
- embedded Running clips are source-only and are not gameplay animation content

Work baseline runtime produced by commit 83e641a:
- SHA-256: ea7421ea1a796919ab268d31278091e0df6333ee14864e305a97f30ef876b0c3
- 10,518,624 bytes
- source mesh/skin preserved, embedded animations stripped

Current remote-preview runtime:
- SHA-256: b71c95cbe0d9364d0c135125ad7409ab52672bfd6a190e228eb5b2c3837dd212
- 272,236 bytes
- 5,051 vertices / 6,190 triangles
- 28 skin joints
- 0 embedded animations
- 3 embedded 256px JPEG textures

The current remote-preview asset is a temporary mobile smoke-test derivative created during handoff. Physical-device visual/deformation acceptance is still required before this optimization is approved for production use.

The connector cannot stream the handoff binary directly into GitHub, so Git stores the preview GLB as one base64 text payload:
public/characters/c1-casual-grace/asset-parts/character.glb.b64.part00.txt

predev and prebuild run scripts/materialize-c1-character.mjs, which decodes the payload, validates exact byte length + SHA-256 + glTF 2.0 magic, and writes:
public/characters/c1-casual-grace/character.glb

scripts/ingest-c1-casual-grace.mjs remains the reproducible high-fidelity ingest path that strips source Running/Walking animation tracks without changing the original mesh/skin.

Gameplay animation content remains the existing Quaternius/P3.7 animation pool, retargeted to the Mixamo skeleton by the C1 rest/world-space adapter. Root translation is not emitted by the adapter.

This source is being used only for temporary/non-commercial MVP validation. Commercial licensing and final multi-character mobile optimization are not verified by this milestone.
