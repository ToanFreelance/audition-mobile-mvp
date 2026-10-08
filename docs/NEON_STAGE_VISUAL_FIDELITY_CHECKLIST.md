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

## 2026-10-08 — Golden master lettering fidelity A/B (isolated compare-only)
- [x] Compare the approved 2048×844 golden source directly with its 448×185 WebP fallback.
- [x] Trace the master image's actual AUDITION lettering/subtitle contours (no replacement font) into a transparent high-resolution SVG.
- [x] Add `?ledAsset=golden-core` compare-only hybrid: original golden WebP illumination + native letter cores, ONE LED mesh/shader.
- [x] Keep both previous baseline and `?ledAsset=vector` comparison intact; gameplay unchanged.
- [ ] Owner screenshot A/B of baseline, vector and golden-core under same iPhone viewport.
- [ ] Evaluate LED color/edge registration before any gameplay promotion.
- [ ] Full 2048×844 raster upload still preferable for all-background high-frequency fidelity; this pass restores lettering/detail only.

## 2026-10-08 — Exact golden lettering on high-resolution vector background

- [x] Inspected owner iPhone vector/WebP pair `IMG_3116.jpeg`/`IMG_3117.jpeg`.
- [x] Isolated root cause: SVG v14 draws its wordmark with browser-rendered Arial Black and a 33px bloom stroke, **not** the approved sketch's lettering.
- [x] Created `public/stages/neon-stage-v1/concept-led-golden-lettering-v15.svg`, preserving v14 vector background/crown/chevrons while replacing both wordmark and tagline with traced native contours from approved 2048×844 golden master.
- [x] Replaced 33px blurry font halo with a narrow pink under-stroke + restrained outer glow; white core remains unfiltered, preserving sharp edges.
- [x] Exposed compare-only `/tools/neon-stage-compare?ledAsset=vector-golden-lettering` with existing shader, camera, stage geometry, render settings.
- [ ] Compare owner iPhone screenshots of v14 vector versus golden-lettering v15 at identical viewport; record direct overlay, logo edge error, color and position.
- [ ] If background/crown differ visibly from sketch, reconstruct them independently; **do not** claim full LED or game stage acceptance on lettering improvement alone.
- [ ] Promotion to gameplay requires owner approval. Existing gameplay source remains unchanged.

## 2026-10-08 — Owner rejection of V15 / V14 restoration

- **REJECTED:** both `golden-core` shader compositing and `vector-golden-lettering` traced SVG. Keep their source assets for diagnostic history, but no longer load either in the compare workflow.
- **WORKING BASELINE:** `/tools/neon-stage-compare` and `?ledAsset=vector` now both render `concept-led-v14.svg`. Obsolete V15 query values also safely fall back to V14, never to V15 artwork.
- **CONTROL:** `?ledAsset=legacy` retains the original 512×191 low-resolution WebP. Gameplay always continues to use this existing source; owner approval is required before any promotion.
- Preserved the 941×1672 compare framing, existing perspective/camera, and compare-only Retina pixel ratio. No unrelated rendering or gameplay changes.
- Remaining root cause: V14 still uses runtime SVG `Arial Black` italic text with 33px/19px/10.5px strokes and Gaussian glow. This differs geometrically from the approved raster sketch; improving source resolution alone cannot repair font fallback, italic contours or outline widths.
- **NOT VISUALLY ACCEPTED:** do not mark logo/backdrop PASS until direct iPhone crops and aligned region-wise diff against the approved 941×1672 sketch are inspected. No arbitrary homography for scores.

## 2026-10-08 — Retina root cause and measurable visual capture

- [x] Found high-impact rendering bug: Stage3D initialization selected compare DPR 2, but `resize()` immediately forced compare DPR 1; fixed without changing gameplay DPR.
- [x] Added direct edge overlay, heatmap and region image outputs to the existing Golden Diff CLI; no warp or new scene architecture.
- [x] Guarded against aspect-distorted crop scoring; mismatch cannot pass the numeric gate.
- [ ] Re-capture V14 on the new DPR-preserving preview; existing older screenshots predate the fix.
- [ ] Acquire the actual 941×1672 owner-approved golden image file for numerically registered scoring; Safari screenshots at different viewport aspect are diagnostic references only.
- [ ] Defer typography edits until the original reference and iPhone capture are aligned; V15 traced-lettering and golden-core remain rejected.

## 2026-10-08 — PASS C golden reference authenticity

- [x] Guard numerical PASS with exact golden SHA-256, canonical aspect, no HUD masks, and reference kind.
- [x] Correct the absolute-difference file to unamplified RGB error; heatmap remains the visualization.
- [ ] Source PNG 941×1672 needs to be available for local automated comparison.
- [ ] Re-capture post-Retina-fix V14 iPhone viewport for visual scoring; don't restore V15.

## 2026-10-08 — Safari iPhone V16 typography A/B (owner review required)

- The owner's 16:39 Safari-conformed sketch is the *visual composition* reference; it is not a byte-identical replacement for the original 941×1672 stage-only SHA-verified golden image.
- Baseline owner iPhone runtime screenshot is the 10:18 V14 compare frame. These screenshots have 710×1536 and 864×1536 dimensions; they cannot be treated as strict pixel-registered pairs. Browser chrome must be excluded, and neither side can be nonuniformly stretched into a formal acceptance claim.
- Measured against the panel width in the screenshots: runtime wordmark occupies approximately 67%, sketch approximately 61–64%; crown approximately 13–15%, sketch approximately 15–17%; subtitle approximately 30%, sketch approximately 34–36%. Boundaries are visual/ROI approximations, not certified golden pixel measurements.
- Added compare-only `?ledAsset=typography-v16` using a single full authored V14 SVG copy, with only logo horizontal scale 1.11→1.00, crown x/y scales 1.10/1.00→1.22/1.075, and subtitle font size/spacing 48/18→54/19.
- **Not fixed by this pass:** the `Arial Black` font fallback and underlying glyph contour mismatch. Do not claim a typography PASS until owner iPhone A/B. The failed V15 trace/overlay remains disabled; this experiment is not a V15 restoration.
- Defaults stay V14 on `/tools/neon-stage-compare`; `?ledAsset=vector` remains V14; `?ledAsset=legacy` remains WebP. Gameplay asset, runtime clock, camera, mesh placement, and approved stage geometry remain unchanged.
- After owner screenshot review, choose either retain/reject this measured geometry variant, then address lettering source paths independently. Defer truss/beam/floor changes pending branding acceptance.
