# C4 Casual Boy — owner-supplied male starter

Source file supplied by the owner: `Meshy_AI_Casual_Boy_Portrait_Running.glb`.

Source inspection:

- Source SHA-256: `34038677e0ecfeca64e09b719f86912fcbe15f7842abe0ae47a99969cd4edadb`
- Source bytes: 8,385,216
- 1 mesh / 1 material
- 43,269 vertex records / 74,140 triangles
- 3 embedded 2048 × 2048 JPEG textures
- 28 Mixamo-style skin joints
- 2 embedded Running clips (`Running`, `Running.001`)
- authored height approximately 1.70 units
- vertex payload includes normals, tangents, UVs, joint indices and weights

Prepared C4 runtime candidate keeps the original mesh, skin weights, bind matrices,
normals, tangents and UVs intact. It strips the source Running clips because gameplay
animation remains owned by the accepted canonical presentation pipeline, and resizes the
three embedded textures to 1024 × 1024 for mobile delivery.

Prepared runtime candidate:

- bytes: 3,759,464
- SHA-256: `8e2b505863dd924e775b831df97c45f6f3b26fdb86560a6e24967b9767642f8f`
- 43,269 vertex records / 74,140 triangles
- 1 skinned mesh / 1 material
- 3 × 1024 JPEG textures
- 28 Mixamo-style joints
- 0 embedded animations

Unlike the failed over-optimized early female preview, C4 does **not** simplify geometry
in this first visual-acceptance pass. This intentionally preserves face, hands, skin
weights and silhouette. If iPhone performance later requires geometry reduction, that is
a separate measured optimization pass after owner visual acceptance.

The C4 runtime uses the same accepted Quaternius -> Mixamo world-space retarget adapter
as Casual Grace. WebAudio/gameplay timing is unchanged.
