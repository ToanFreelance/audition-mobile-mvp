# M3 Premium Cute Anime — V1.1 real geometry + material correction

## Owner instruction

The accepted target is a **cute premium anime 3D** look on the actual
Audition Mobile M3 characters. The owner confirmed that the previous V1
lighting/PBR change looked more three-dimensional, but the male nose was
still too flat and the overall look was not yet premium.

This work edits *real* M3 meshes/materials in Three.js, not AI images.
It is an isolated visual experiment, not a new character system.

## Source of truth, branch and boundaries

- Repository: `ToanFreelance/audition-mobile-mvp`
- Branch: `work/m3-premium-cute-visual-v1`, not `development` or `main`
- Base V1: `2a37de50cb09964021f5e40f214828629898acc4`
- No PR and no merge; concurrent motion/animation branch untouched
- Source M3 VRMs remain those already referenced by the Character Catalog
- M3 still `lobbyReady=true`, `runtimeReady=false`
- Runtime identity, wardrobe selections, RoomState, Ready, CAS, Supabase,
  preload, WebAudio and gameplay remain unchanged

## Root cause and real source mesh investigation

- Earlier M3 assets used `KHR_materials_unlit`; V1 converted compatible
  materials to physically lit `MeshStandardMaterial`.
- V1 still could not sculpt the actual nose: `neurohacker` has a baked head
  with **1701 base vertices**, including real but subtle nose geometry.
- The actual `Headbaked(copy)` runtime `BufferGeometry.computeBoundingBox()`
  also encloses expression morph targets, yielding a larger combined box:
  ~x [-0.142,0.145], y [1.247,1.658]. Its *rest-position attribute* has
  x ~[-0.1004,0.1040], y [1.3603,1.6102].
- Selecting the head by node name or morph-expanded bounding box therefore
  skipped the intended sculpt. The successful solution tests source-mesh
  proportions from raw rest-position vertices and leaves morph targets intact.

## Actual implementation

1. **Male nose geometry**: `m3-premium-face.ts` clones only the matching
   Neurohacker face `BufferGeometry`, applies a soft, bounded displacement
   over the real nose bridge/tip/side planes, and recalculates normals.
   It does not add floating geometry, rename bones, change skin weights,
   rewrite UVs or change the Character Catalog. The earlier 13mm experiment
   was softened after reviewing 3/4 profile renders.
2. **Family-specific lookdev**: `m3-premium-materials.ts` supports an actual
   M3 rig-family profile; the male face has distinct roughness. Compatible
   eye and hair surfaces become `MeshPhysicalMaterial` with restrained
   clearcoat/sheen/anisotropic highlights; skin colors, source textures,
   alpha/transparent settings, appearance snapshots, hair tints and outfits
   are preserved.
3. **Creator lighting**: `CharacterCreationStage3D.tsx` uses more directional
   male facial key/fill/rim lighting, without changing the accepted female
   geometry or the camera/rig ownership model.
4. **Waiting Room lighting**: `WaitingRoomStage3D.tsx` adds a male-only
   directional accent on layer 3. Existing M3 accents remain on layer 2;
   legacy C1/C4 and stage lights/materials are unchanged. No extra actor,
   mixer, timer or React lifecycle changes are introduced.
5. **QA**: `e2e/m3-premium-cute-visual.spec.ts` asserts a real sculpt
   occurred on the male face, none on the female, eye/hair upgrades exist,
   and captures both close-up/front and three-quarter views with a settled
   340ms creator camera transition. Real male, female and five-player room
   fixtures remain included.

## Verified baseline engineering QA

Focused run: https://github.com/ToanFreelance/audition-mobile-mvp/actions/runs/43996638807

- TypeScript PASS
- Production build PASS
- 9/9 focused Playwright PASS
- Neurohacker nose: **337 displaced vertices**, max forward displacement
  `0.00901787449` in model units after the softened V1.1 correction
- Drophunter geometry: **0 affected vertices**
- Physical eye/hair surfaces: **2** for each inspected M3 rig
- Neurohacker bind-space delta: **0**
- Drophunter bind-space delta: `5.96e-7`
- Actual M3 female/male/five-person Chromium fixtures: PASS
- Actual iPhone GPU performance, thermal behavior and final artistic
  acceptance: **not yet verified**

The general Lobby QA workflow continues to fail its historical ESLint
`no-use-before-define` on `reconcileParticipants` in Stage3D. This is
out of scope and was already present in the parent V1 branch.

## Art-quality limits / owner review

This is a **real mesh/material improvement**, NOT a claim that the original
M3 model now equals the owner's AI-generated premium concept image.
The source VRMs still use comparatively low-poly hair, simplistic facial
topology, limited eye geometry and relatively simple garments. Full
premium anime fidelity requires a separate geometry/rig-compatible asset
authoring pass (Blender sculpt, UV/skin/morph validation), not misleading
screenshots or more front lighting.

Owner acceptance should inspect the current stable visual branch preview
on a physical iPhone: face at front/3/4, actual wardrobe variants and
five actors together. Do not merge until explicit owner approval.
