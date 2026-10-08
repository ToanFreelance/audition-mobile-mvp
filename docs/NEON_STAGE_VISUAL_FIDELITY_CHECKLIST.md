# S2.5A Neon Stage — registered visual fidelity checklist

Source of truth: owner-approved `neon_audition_stage_with_glowing_dance_ring.png`.
Compare: `/tools/neon-stage-compare` (stage only, portrait 941×1672 logical comparison frame).

## 1. LED / branding — current pass
- [x] Inspect source texture, mip filtering, shader linear→sRGB output and renderer pixel density
- [x] Preserve measured crown, wordmark, tagline and chevron UV registration
- [x] Remove artificial highlight squaring and preserve authored colors
- [x] Disable unnecessary mip smoothing; add bounded detail sharpening
- [x] Raise **compare-only** Retina backing resolution without changing camera/view size
- [ ] Owner iPhone capture: edge/overlay check of wordmark, crown, subtitle, side lines
- [ ] Eliminate any remaining physical black seam **only after tracing GLB occluder**, not by moving artwork

## 2. Truss / overhead lights
- [ ] Compare truss silhouette edge density and anchors at identical viewport
- [ ] Fix material readability without global purple fill
- [ ] Verify fixture-body/lens/beam origin and attachment

## 3. Lower fixtures / stairs
- [ ] Snap lower lights to authored deck contact geometry, verify shadows/occlusion
- [ ] Check riser-lip anchors against sketch before altering y positions

## 4. Floor / reflections
- [ ] Compare ring and mid/foreground floor independently (luminance, chroma, structure)
- [ ] Fix reflection registration to fixture and tile geometry, eliminate straight neon lanes
- [ ] Confirm mobile performance and brightness before further tuning

## 5. Final owner acceptance
- [ ] Direct 941×1672 stage viewport overlay (do not align by changing camera)
- [ ] Registered homography **diagnostic only**, alongside unchanged direct overlay
- [ ] Save region crops, edge overlay, absolute diff and input screenshot
- [ ] Do not claim 95% from a build or color metric alone; owner iPhone visual acceptance required
- [ ] Do not touch WebAudio, turn scheduler, gauge, Finish or gameplay flow

**Acceptance gate:** one scoped visual change per pass where possible. A successful
Vercel build verifies compilation, not screenshot fidelity; no automatic
promotion to next visual phase without matching screenshot evidence.

## 2026-10-08 — LED source fidelity A/B (isolated compare-only)
- [x] Verified raster LED is only 512×191; edge loss cannot be solved by filtering/sharpening alone.
- [x] Located existing authored 2048×844 SVG `concept-led-v14.svg` in the SAME stage asset catalog.
- [x] Added **compare-only** option `/tools/neon-stage-compare?ledAsset=vector` for high-resolution artwork sampling.
- [x] Default compare and gameplay continue to use existing golden WebP; no unapproved visual switch.
- [x] Shader sharpening is disabled for vector mode, enabled for the legacy low-resolution mode.
- [ ] Acquire matched iPhone screenshots from `?ledAsset=vector` and default compare.
- [ ] Measure position/size/color/edge/detail region-by-region against golden sketch.
- [ ] DO NOT promote vector to gameplay unless owner visually accepts design. SVG v14 is an earlier authored approximation, **not** the accepted golden screenshot.
