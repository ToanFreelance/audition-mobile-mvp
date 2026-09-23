# C1.1 Casual Grace — temporary female MVP visual salvage

- Owner-provided source: `Meshy_AI_Casual_Grace_biped.zip`, entry
  `Meshy_AI_Casual_Grace_biped/Meshy_AI_Casual_Grace_biped_Animation_Running_withSkin.glb`.
- Source SHA-256: `b966e1600b58e1914bbc4ccec2ce586b476e0c58b2484eb57cc9c3f7c7e3488c`.
- Source: 10,634,408 bytes; 65,709 vertex records; 110,514 triangles;
  1 mesh, 1 material, three embedded 2048 × 2048 JPEG textures; 28 Mixamo-style
  skin joints; two embedded Running clips. Source height approximately 1.70 units.
- C1 full-fidelity baseline after animation stripping: 10,518,624 bytes,
  65,709 vertices, 110,514 triangles, 3 × 2048 JPEG textures;
  SHA-256 `ea7421ea1a796919ab268d31278091e0df6333ee14864e305a97f30ef876b0c3`.
- Failed remote/iPhone preview reference: 697,284 bytes, 12,729 vertices,
  18,108 triangles, 3 × 512 JPEG textures;
  SHA-256 `42de2fb5794d7f771545b89356793fc8e6b8d1b6745223cbdc5100df91cacb6a`.
- Current runtime: `character.glb`, 3,372,068 bytes, 33,398 vertex records,
  48,000 triangles, one skinned mesh, one material, three embedded 1024 × 1024
  JPEG textures, 28 skin joints, no animations; SHA-256
  `69610c20c9f120788bd6fc92ee9e84079a3ea6fbdfdac645ba20f59d1d8346ac`.
  Surviving vertices retain original normals, tangents, UVs, joint indices and
  weights. The face-front and both hands were protected from collapse during
  attribute-aware simplification. Bind matrices and skeleton are unchanged.
- Reproduce ingest with
  `node scripts/ingest-c1-casual-grace.mjs <source-zip> <temporary-full.glb>`
  followed by
  `node scripts/ingest-c1-1-casual-grace.mjs <temporary-full.glb> public/characters/c1-casual-grace/character.glb 48000`.
  The offline step uses free meshoptimizer and sharp. Embedded source
  Running/Walking clips and their data are stripped before simplification.
  Gameplay clips still come from the canonical Quaternius/P3.7 published
  content through the C1 rest/world-space Mixamo adapter.

Owner-supplied/free source is used here only for temporary, non-commercial MVP
validation. Commercial licensing, physical-device visual/thermal acceptance,
and animated face/arm deformation on an actual iPhone are not verified by
structural metadata or offline silhouette renders alone.
