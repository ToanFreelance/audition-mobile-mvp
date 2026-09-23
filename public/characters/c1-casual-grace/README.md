# C1 Casual Grace — temporary female MVP character

Owner-provided source: `Meshy_AI_Casual_Grace_biped.zip`.

Validated Work baseline:
- full-fidelity runtime SHA-256: `ea7421ea1a796919ab268d31278091e0df6333ee14864e305a97f30ef876b0c3`
- 10,518,624 bytes
- 65,709 vertices / 110,514 triangles
- 28 Mixamo-style skin joints
- embedded Running/Walking gameplay clips removed.

Current remote/iPhone preview runtime:
- SHA-256: `42de2fb5794d7f771545b89356793fc8e6b8d1b6745223cbdc5100df91cacb6a`
- 697,284 bytes
- 12,729 vertices / 18,108 triangles
- 28 skin joints
- 0 embedded animations
- 3 embedded 512×512 JPEG textures.

The preview asset is derived from the same validated skinned source. It keeps
the C1 rig/skin contract while reducing mobile transfer/render cost for device
acceptance. The full-fidelity runtime remains preserved in the owner handoff
and is the visual-quality reference until iPhone review is complete.

Gameplay animation remains the existing Quaternius/P3.7 animation pool,
retargeted to the Mixamo skeleton by the C1 rest/world-space adapter. Root
translation is not emitted by the adapter.

`scripts/ingest-c1-casual-grace.mjs` preserves the reproducible high-fidelity
source ingest that strips source Running/Walking animation tracks.

Owner-supplied/free source is used only for temporary, non-commercial MVP
validation. Commercial licensing has not been verified.
