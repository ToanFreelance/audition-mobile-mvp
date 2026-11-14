# M3 Modular Wardrobe V1.4 — Male Streetwear Research / Experimental POC

Date: 2026-11-14
Branch: `work/vita-wardrobe-tryon-poc-v1`
Baseline: `09aea98a00677aad0d2ab0e784082ca50bb30c7d`.
Scope: isolated `/tools/m3-modular-wardrobe` only; no Character Catalog, Vita V1.1, gameplay, Shop or Inventory edits.

## Research and selection

**Chosen experimental source:** M3 CharacterStudio-compatible `memelotsqui/character-assets/neurohacker`.
Source: https://github.com/memelotsqui/character-assets/tree/main/neurohacker
Manifest: https://github.com/memelotsqui/character-assets/blob/main/neurohacker/manifest.json

Manifest explicitly defines separate VRM traits for base body, required eyes,
hair, chest, legs, feet, outer and accessories. Research inventory includes:
Logo Tee, Streetware, Simple Shirt, Sweater, Cargo Pants, Street Pants,
Running Shoes and casual shoes. This is closer to modern street dance than
Anata Male's fantasy chest/armor and has genuine independent trouser/hair slots.
The POC exposes 29 curated source-backed options across 7 slots.

**Evidence from actual binary parsing:** 3 downloadable hair VRMs below the
GitHub API contents threshold (`head/hair1.vrm`, `head/hair2.vrm`,
`head/short.vrm`) were decoded from GLB binaries. Each has 102 joints and
identical joint names/order and identical inverse-bind matrices (max delta=0).
The rig has named hips, spine, chest, upper/lower arms, upper/lower legs, feet.
The model uses VRM + MToon/springbone extensions.

**Important limitation:** the GitHub Contents API returns empty `content` for
source files larger than 1 MiB; the 4.98-MB body and several tops, bottoms and
shoes therefore could not be independently decoded through this connector.
Do NOT call the entire male rig proven compatible from these hair samples.
Live runtime must validate every loaded garment against the actual body: joint
count/order and inverse-bind delta <= 0.0001. Fail visibly if not compatible.
Downloaded source binaries are not committed/mirrored.

## Other candidates considered

- `M3 Anata Male`: working 55-joint fallback, but fantasy/RPG and no hair/bottom slots.
- `kblood/CharacterCreator`: 53-bone shared rig, separately generated T-shirt,
  jeans, shoes, hoodie etc; requires Blender/MPFB asset-building workflow and is
  realistic rather than premium cute anime. Strong technical alternative if M3
  Neurohacker's appearance or rig fails.
- `Fab / Stylized Modular Base Character (UE5 compatible)`: separate skinned
  parts, but acquisition required and insufficient independently swappable
  streetwear variants to qualify without further verification.
- `Ready Player Me`: retired/shut down 2026-01-31; not usable as a new API source.

## Bounded implementation

- Add third explicit identity `male-street`, keep `female` Drophunter and
  `male` Anata unchanged.
- Load the Neurohacker base and mandatory Eyes once per identity.
- Keep one Three.js actor root, one skeleton and one AnimationMixer.
- Equip individual VRM garment SkinnedMeshes onto the body skeleton; donor
  skeletons are never rendered. Cache bound to 14 loaded source parts.
- 3 existing 110-BPM stress animations reused; no gameplay clock involvement.
- Existing sticky iPhone stage and camera controls retained; mobile tabs tightened
  only to make the experimental identity accessible.
- Neurohacker solo tops disallow simultaneous optional outerwear.
- Experimental, NOT iPhone visual acceptance; independent licensing clearance
  still required before distribution.

## Required owner QA

1. Select `Nam · Street` and confirm base/eyes/top/bottom/shoes/hair load.
2. Swap `Streetwear → Logo Tee → Sweater` and `Cargo Pants → Street Pants`,
   then hair, shoes, optional outer/accessories; read status for any rig errors.
3. Confirm `1 mixer / 1 base load` stays constant during garment swaps.
4. Cycle Groove, Street Shuffle, Low & Reach; inspect eyes, armpits, hips,
   thigh/knee bending, shoe anchoring and optional outer clipping.
5. Test iPhone Safari sticky preview, memory and scene responsiveness.
6. Treat every failure as a recorded technical blocker, not a fake fallback.
