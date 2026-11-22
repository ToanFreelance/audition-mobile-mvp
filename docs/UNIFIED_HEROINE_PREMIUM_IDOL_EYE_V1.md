# Unified Heroine — Premium Idol Eye V1 candidate

## Scope
One more ambitious premium eye prototype on the same unified VRoid heroine, PR #24.
Do not change Waiting Room, gameplay, WebAudio, Supabase, Character Catalog or Shop.

## Implementation
- build_premium_idol_eye.mjs produces a 2048x1024 source-UV-compatible iris
  atlas using original iris alpha, rose-violet radial filaments, sapphire pigments,
  dark limbal border, gold microstrands and optical catchlights.
- UnifiedEyePack selects a MeshPhysicalMaterial with low roughness, clearcoat
  and subtle iridescence on the EXISTING skinned iris mesh. No actor/mixer rebuild.
- Uses original real VRoid eyelashes/eyelids and blink morphs. Not a newly
  sculpted lash or eyelid mesh, and not proof of commercial quality.
- The output PNG is generated at prebuild and served through Vercel static asset.
- Visual acceptance on owner iPhone is pending.
