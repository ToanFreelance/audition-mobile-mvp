# M3 Premium Cute Anime — Visual Pass V1 (branch-isolated candidate)

## Owner direction

Owner approved the **premium cute anime** direction, using the attached image with
silver bob, expressive eyes, peach-orange shirt, dark shorts and white sneakers.
The reference image is an **art-direction target**, not a preexisting 3D mesh,
animation clip, texture atlas or source file that could simply replace the VRM.

The implementation changes the **real, existing M3 SkinnedMeshes**. No new 2D
image, mock screenshot or image-generated texture is used in the application.

## Baseline and scope

- Repository: ToanFreelance/audition-mobile-mvp
- Isolated branch: `work/m3-premium-cute-visual-v1`
- Base: V1.8 `16b36acc0147e6e8e1cf1bb1205539c7290a362b`
- The ongoing V1.8.1 animation work remains on its existing branch; this
  visual branch intentionally does **not** change motion clips, contacts or the
  runtime AnimationMixer.
- Presentation surfaces: M3 Drophunter and Neurohacker in Character Creator
  and Waiting Room. Existing C1/C4 materials are not rewritten.

## Implemented 3D changes

1. `m3-premium-materials.ts` defines surface-aware PBR parameters for real
   VRM body, face, mouth, eyes, hair, top, bottom and shoes.
   Colors, maps, hair tint and all selectable skin tones are retained.
2. Small repeatable fabric tangent-space normal maps convey subtle weave and
   cloth depth on UV-mapped garments without high-resolution downloads.
   Textures are shared across garments **within one assembler**, not generated
   every frame, and disposed with the assembler.
3. `m3-character-assembler.ts` applies material finishing when each part is
   cloned and when skin targets are created, so cosmetic replacements retain
   the finish. No bone weights, inverse bind matrices, UVs or vertex positions
   are touched.
4. `m3-premium-lighting.ts` generates a scene-owned PMREM studio reflection
   environment once. Character Creator also reduces over-bright front fill
   and strengthens directional facial volume. The Waiting Room adds two
   M3-layer-only character lights, retaining the existing stage presentation.
5. The existing WebGL actor cloning, Character Catalog identity, appearance
   serialization, host gating, READY state and gameplay timing remain unchanged.

## Non-goals / limitations

This is a **material and lighting fidelity pass**, **not** a finished hand-sculpted
new model. The original M3 facial contours, triangle geometry, mesh topology,
hair sculpt and garments are unchanged. The illustrative generated image has
more facial topology, hair layering and seam sculpt than the current source VRMs
can reproduce via rendering alone. Matching that image literally requires a
separate rig-compatible Blender sculpt, UV/bind/weight verification, garment
adaptation and iPhone performance review.

The PMREM is created once per scene (not per actor or frame), with a direct
lighting fallback if environment initialization fails. Startup GPU cost and
on-device 5-person FPS/thermal behavior still require owner testing.

## Validation

- Focused GitHub Actions workflow `m3-premium-cute-qa.yml`:
  TypeScript, production build, actual M3 female/male/five WebGL smoke,
  existing appearance and stage-identity regression tests.
- Record PASS only after the actual workflow concludes successfully.
- Tests and screenshot artifacts are engineering evidence; the owner must
  assess face volume, hair/fabric response and smooth mobile performance
  on the actual iPhone.
- Known unrelated general Lobby QA lint gate `reconcileParticipants` existed
  in the parent branch; do not mask it by broad unrelated refactoring.

## Next acceptance

Compare the same M3 outfit and light on the old V1.8 Preview and this isolated
candidate at normal iPhone zoom, both in portrait creator and five-person lobby.

1. The face should be more dimensional without losing the cute anime identity.
2. Hair, eyes, skin, cloth and shoes must have visibly distinct materials.
3. No visual regression in tint/wardrobe, no floating clothing or missing eyes.
4. No excessive shininess, blown highlights or distracting normal aliasing.
5. No unacceptable iPhone startup/FPS/thermal cost.

Only after owner accepts should this isolated presentation change be
reconciled with the separate motion branch. No automatic merge.
