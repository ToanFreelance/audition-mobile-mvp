# Unified Heroine — 3D Depth Lighting QA V1

**Scope:** Isolated visual diagnosis on \`/tools/unified-heroine-v1\`, PR #24 work branch.
No changes to game, Waiting Room, Character Catalog, camera choreography, Supabase,
WebAudio, Shop/Inventory or accepted 3D assets.

## Root cause from existing implementation

Owner iPhone screenshots look visually flat, despite a real 17.7 MB
VRoid-sourced GLB with ~170 skinned primitives, native normals/normal maps,
157 bones and facial morphs.

- Original lighting: 2.5-intensity Hemisphere + three PointLights at
  85/65/100 intensity, ACES exposure 1.4. Very broad, high illumination
  washes out the face's nose/cheek/jaw light-dark gradients.
- Original PBR materials are generally \`roughnessFactor: 0.9\`: light response
  is mostly matte. No actor shadow setup was enabled.
- Straight-on portrait + stylized anime geometry (large eyes, little nasal
  projection) further suppress depth cues.
- This is **not** evidence of 2D sprites or a Three.js inability to draw
  realistic 3D. Additional 3D facial sculpt detail is a separate art concern.

## Isolated implementation

- New \`HeroineStudioDepth.ts\` creates an opt-in light rig on the same scene:
  lowered ambient, directional warm key, cool fill and violet rim, ACES
  exposure 1.16, 512px mobile / 1024px desktop key shadow.
- Only currently visible hair geometry casts dynamic shadows; skin receives.
  Hair/skin material roughness tuning is reversible. No new meshes or actor.
- The default \`Original (Current)\` preset exactly preserves the existing
  lighting setup, exposure and material roughness. Toggle
  \`Studio 3D Depth\` under Camera to compare A/B at the same pose/angle.
- State changes do not reconstruct the GLB, actor, skeleton, eye modules or
  AnimationMixer. Directional shadow is QA-only because even a 512px pass
  may incur mobile GPU cost; do not propagate to gameplay/Waiting Room.
- 3/4 Left and 3/4 Right are existing camera presets. Use both to determine
  whether actual cheek/nose/face volume is sufficient.
- Scene and shadow resources are returned to their original state on dispose.

## Validation and acceptance

- Verify TypeScript and Next.js production build.
- Chromium WebGL mobile viewport 390x844 DPR2 A/B original vs studio:
  camera face/3/4, stable actor UUID, one persistent AnimationMixer
  after dance, no JavaScript page errors. Compare render screenshots.
- **Owner iPhone visual PASS is pending**. Studio lighting demonstrates
  presentation depth but does not magically sculpt better nose/jaw/eyelids.
- If both lighting presets look flat at 3/4 on iPhone, the bottleneck is
  geometry and textures. Use high-quality licensed artist-made facial
  mesh/materials with Golden Reference instead of piling on procedural
  decorative primitives.

## Performance considerations

Shadow maps duplicate geometry submissions; enabled **only** when owner
explicitly selects Studio preset. 512x512 mobile shadow map is a conservative
QA cap, not a certified production performance budget. No full cross-device
thermal/FPS QA was performed. Preserve phase-14 deferral.


## Validation actually performed

- Browser: Playwright Chromium mobile 390x844, DPR2, SwiftShader WebGL.
- One request for the original Unified Heroine GLB; no reload on lighting
  switch. Four same-session captures: Original/Studio Face Close-up and 3/4.
- Original vs Studio Face global mean absolute RGB difference: **11.213**
  (0-255 pixel scale). This is *visual difference*, not fidelity score.
- No JavaScript page errors. Actor UUID remained identical across lighting
  and camera changes. Dance: one persistent AnimationMixer, PLAYING.
- Studio no longer has the overly dark exposure of the first trial; still an
  art-direction experiment. Owner iPhone acceptance and thermal/FPS QA pending.
