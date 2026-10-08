# S2.5A — Neon Stage Golden Visual Diff Harness

## Accepted golden plate

Owner-approved stage-only concept:

- canonical dimensions: **941 × 1672**
- aspect ratio: **941:1672**
- source SHA-256: `f03a302766906ed14ab1d225f4aaec7b623d28786670f618412d5d3d0c24c26d`
- no HUD
- no character
- no gauge / D-pad / SPACE / command arrows
- stage branding is part of the golden: crown, AUDITION, DANCE TOGETHER

The compare route must preserve this exact aspect ratio. At a smaller browser viewport it may letterbox, but it must never stretch or independently crop width/height.


## Goal

Stop subjective visual tuning. Every visual pass must be measured against the owner-approved Neon Stage concept before calling it an improvement.

The harness is presentation-only. It does not alter WebAudio timing, gameplay state, RoomState, gauge, Finish, sequenceCounts, or Stage Catalog authority.

## Deterministic capture route

Use:

`/tools/neon-stage-compare` (default: V14 authored SVG; `?ledAsset=legacy` for the low-resolution WebP control; retired V15 query values fall back to V14)

This route renders:

- `neon-stage-v1`
- fixed portrait gameplay camera
- fixed presentation time
- character hidden
- no gameplay HUD
- the same Stage3D runtime used by the product

The Stage3D host exposes:

- `data-visual-compare-mode="1"`
- `data-visual-compare-ready="1"` after the real stage asset is loaded

For automated capture, wait for `data-visual-compare-ready="1"` before taking a screenshot.

## Quantitative diff command

Run:

```bash
npm run visual:neon:diff -- \
  --current path/to/current.png \
  --golden path/to/golden.png \
  --out test-results/neon-stage-visual-diff
```

Historical iPhone screenshots may include Safari chrome and gameplay HUD. Supply independent normalized crops:

```bash
npm run visual:neon:diff -- \
  --current current-iphone.png \
  --golden approved-concept.png \
  --current-crop 0,0.107,1,0.803 \
  --golden-crop 0,0.107,1,0.816
```

The default scorer masks HUD, character, command/gauge and lower controls so stage content is not penalized by gameplay UI. Disable this only for a clean stage-only pair:

```bash
--mask-hud 0
```

## Outputs

The command writes:

- `current-canonical.png`
- `golden-canonical.png`
- `canonical-overlay.png`
- `absolute-difference.png`
- `metrics.json`
- `metrics.csv`

No project screenshot is warped with homography for composition scoring. Camera, scale and position errors must remain visible instead of being corrected away by registration.

## Regions

The scorecard evaluates:

- A — LED / backdrop
- B — AUDITION logo
- C — crown
- D — truss
- E — overhead fixtures
- F — beams
- G — lower fixtures
- H — stairs
- I — center ring
- J — mid-floor
- K — foreground floor

## Metrics

Each region reports:

- RGB mean absolute error
- CIEDE2000 color error
- global SSIM
- average luminance
- saturation
- highlight percentage
- dark-area percentage
- Sobel edge density
- edge IoU
- edge-centroid displacement
- edge bounding-box size displacement

Those are converted into five independent scores:

1. composition / position
2. shape / design
3. color
4. lighting
5. perceptual similarity

The weighted region score is:

- 20% composition
- 15% shape
- 20% color
- 25% lighting
- 20% perceptual

## Acceptance gate

Do not claim 95% merely because one image looks close.

Numeric gate:

- total weighted score >= 95
- every critical region score >= 90
- owner iPhone visual acceptance is still required

The score is a regression guard, not a replacement for owner review.

## Workflow for every visual fix

1. Capture the deterministic runtime.
2. Run the diff.
3. Inspect the five worst regions.
4. Change only the layers responsible for those errors.
5. Capture again.
6. Keep the commit only if the relevant scores improve and unrelated regions do not materially regress.
7. Repeat until the numeric gate is reached, then ask for owner iPhone acceptance.

This replaces the previous workflow of repeatedly changing global glow, purple wash, opacity or camera values without objective evidence.

## V14 / Retina / diagnostic artifacts (2026-10-08)

- Fixed the **compare-only** Retina regression: the first `ResizeObserver` callback formerly overrode DPR 2 with DPR 1; subsequent callbacks now retain the initial cap `min(devicePixelRatio, 2)`. Gameplay rendering remains unchanged.
- Diff CLI now refuses stage crops whose aspect differs from the specified canonical 941:1672 ratio by more than 1%. This avoids presenting stretched iPhone screenshots as registered/accepted visual evidence.
- `--allow-aspect-mismatch 1` permits exploratory screenshots at differing aspect ratios, but sets `aspectMismatchDiagnosticOnly: true` and forces `passesNumericGate: false`. Do not use such scores for golden acceptance.
- Extra output: `canonical-edge-overlay.png` (cyan=current-only, magenta=golden-only, white=shared); `absolute-difference-heatmap.png`; `regions/<REGION>-current.png`, `-golden.png`, `-overlay.png` for all eleven named areas.
- For true fidelity measurement, provide the owner-approved **stage-only** original 941×1672 and a screenshot captured from the exact comparison viewport. The owner-shared 864×1536 Safari image is a useful visual reference, **not** a registered golden-stage source.

## 2026-10-08 — Source provenance and numeric acceptance guard

- Authoritative 941×1672 golden stage-only source digest (SHA-256): `f03a302766906ed14ab1d225f4aaec7b623d28786670f618412d5d3d0c24c26d`.
- The scorer now checks the **original reference image bytes** against this digest. A V14/V15 A/B screenshot, Safari screenshot, proxy, resized image, or different PNG encoding cannot accidentally pass the golden numeric gate.
- For A/B regression comparisons, pass `--reference-kind regression`. It still generates metrics/heatmaps but `passesNumericGate` remains false.
- For canonical, stage-only golden scoring always pass `--mask-hud 0`; masked image comparisons cannot pass even with an approved golden reference.
- `absolute-difference.png` is now *unamplified* literal RGB absolute difference. For boosted diagnosis, use `absolute-difference-heatmap.png`.
- Preserve the original approved golden binary or explicitly re-approve and document any alternate encoding before updating its hash. iPhone visual acceptance remains a separate required gate.

## 2026-10-08 — Owner rejection of V17 integrated wall / floor, measured overlay

The owner's 13:04 iPhone screenshot (IMG_3125.jpeg) rejects the V17
`stageFx=integrated-v1` option due to a pale/lavender rectangular overlay
and inferior reflections. Owner's previously approved Safari comparison
image is `3FD7BDA3-A8F0-47CD-9DCF-5E3C015111B6(2).jpeg`.

**Review guard:** `?stageFx=integrated-v1` no longer selects the rejected
V17 effects, and falls back to the unchanged V14/V16 base artwork. The
rejected effect remains reproducible ONLY through the deliberately named
`?stageFx=rejected-v17-diagnostic` route, never in gameplay.

**Measurement method (no image registration cheating):**

- Current screenshot: 710×1536; Safari golden screenshot: 864×1536.
- Remove browser chrome at y=165..1398 on both. Center-crop golden from
  x=77..787 to match current 710-pixel width at 1:1 physical screenshot
  pixels. No warp, homography, nonuniform stretch or automatic fitting.
- Because the screenshot widths differ and the crop loses side geometry,
  all RGB/edge findings below are **diagnostic only**. Do not use them
  for 95% numeric acceptance. The original approved 941×1672 stage-only
  PNG is still the authoritative quantitative golden plate.

**Observed comparison (approximate screen-pixel anchors):**

- Overhead truss y≈365 in runtime versus y≈286 in Safari sketch
  (≈79px downward difference).
- Top LED edge y≈500 versus y≈450 (≈50px downward difference).
- Riser lip y≈793 versus y≈808 (≈15px upward difference).
- Ring center y≈925 versus y≈956 (≈31px upward difference).
- These are geometry/camera/depth differences, **not** bloom problems.
- Diagnostic average luminance (0..255) for center ring and mid-floor:
  runtime 26.58 versus reference 73.09; for the foreground floor:
  runtime 12.83 versus reference 42.51.
- LED/frame region has RGB MAE ≈72.17, and the ring/mid-floor region ≈80.72,
  but **neither value is a registered golden fidelity score**.

**Shader root cause:** `makeAcceptedBackdropMaterial()` renders a
foreground `R15AcceptedLedGlowOverlay` over a separate neutralized GLB
`CentralLED`. V17 additionally mixed generated violet background with
the artwork using a feathered rectangular UV mask and added wall bounce
PointLights; their broad color field caused an unwanted apparent overlay.
The floor used additive, prepainted canvas reflections without true
specular response, still much darker/less structured than the concept.

**Next controlled work:** inspect actual CentralLED mesh UVs, thickness,
stage-side geometry, camera/view volume, and floor materials. Fix one
source of mismatch per isolated A/B. Do not restore V17 feather/spill or
add more color wash. Keep owner visual acceptance mandatory.


## Owner iPhone E18 review (2026-10-08)

Owner attached `IMG_3127.jpeg` (E18 compare, 710×1536) against the Safari-adapted
golden screenshot (864×1536); V17 rejected screenshot (710×1536) provides
the previous control. All references are **stage-only** after cropping
Y=165..1398. The golden was center-cropped X=77..787 to 710 px at physical
pixel scale. **No image stretching, camera adjustment or homography.**

**Strictly diagnostic, NOT a registered fidelity or 95% acceptance score:**

| Region (common crop) | E18 vs golden RGB MAE | V17 vs golden RGB MAE | E18 Y | Golden Y |
|---|---:|---:|---:|---:|
| LED wall/frame | 69.68 | 67.75 | 72.63 | 73.58 |
| Crown | 66.15 | 60.63 | 105.22 | 121.42 |
| Wordmark | 80.44 | 72.97 | 86.71 | 91.89 |
| Dance ring | 93.75 | 91.28 | 32.62 | 73.16 |
| Mid-floor | 72.45 | 70.72 | 16.33 | 50.86 |
| Foreground floor | 42.50 | 42.03 | 5.98 | 27.13 |

Y = mean Rec.709 gamma-weighted screenshot luminance (0..255), not a
radiometrically linear measurement. Cropped images are not aligned to the
original 941×1672 golden master, so absolute MAE is confounded by
camera/composition shifts. Diagnostics were created from owner screenshots
without nonuniform scaling.

**Result: E18 visual FAIL / do not promote.** The glTF
`CentralLED` now carries the shader, but it still uses the V14-style nested
`artSize = (0.93628, 0.84691)` rectangular matte inside the physical
LED. This repeats the poster-within-a-frame silhouette. The stage floor
remains too dark despite the fixture-anchored lightmap; adding material
metalness does not automatically reflect an emissive LED in a Three.js
WebGL scene without an environment/reflection source.

**E19 opt-in implementation:** compare-only
`?ledAsset=typography-v16&stageFx=physical-reflection-e19`.
The `CentralLED` physical mesh now samples V16 across the entire GLB
surface (no nested matte). The existing floor reflection field uses a
shader that projects the viewer's reflected direction into the actual
CentralLED world bounds, with low-cost blurred taps, tile breakup and
attenuation; the existing local fixture-anchored lightmap remains in use.
No planar second scene render, FBO, new LED plane, V17 wall wash, gameplay
change or unaccepted default-stage promotion. V16 and E18 remain exact
query-selectable controls.

**Pending:** Verify E19 shader compilation, actual 3D wall reflection
placement, occluders and Mobile Safari FPS on owner iPhone screenshots.
Next use same-device E18/E19 screenshot A/B; do not infer acceptance from
Vercel build READY.


## E20 owner-requested lighting and floor refinement (2026-10-08)

Owner iPhone screenshot: `IMG_3130.jpeg`. E19 direction is provisionally
owner-positive. **Do not regress E19 logo/LED/framing**. Owner requests:
reflection over the WHOLE physical dance floor including the ring, stronger
rough/soft reflections at the dancer's feet, genuine truss light and glint,
and grounded low-stage uplight bases.

E20 is explicitly **compare-only**, not gameplay:
`/tools/neon-stage-compare?ledAsset=typography-v16&stageFx=physical-refinement-e20`.
E19 remains available without source changes at
`?ledAsset=typography-v16&stageFx=physical-reflection-e19`.

Implementation:
- The E20 floor shader continues ray/LED-bound registration from E19,
  but adds low-frequency LED illumination over the entire 19.2 × 34
  world-space floor field, including locations whose perfect mirror ray
  falls outside the LED. Ring bounds are taken from the actual GLB
  `R15 Dance Ring Outer` mesh, with substantially wider 9-tap LED
  blur and attenuated legibility under the dancer. Tile breakup and
  progressive reflection falloff remain. No additional reflection plane
  or reflection render target was created.
- Four named upper fixtures now produce actual shadow-free SpotLights,
  aimed each frame at the existing source-to-stage targets, in addition
  to the prior cheap volumetric beam geometry. All main truss heads get
  a bounded source-attached optical glint; the existing E19 beam/sprite
  path is unchanged. No return to V17's global lavender wash.
- Physical mount pads and slim side supports were added one-per-unique
  `DeckUplight_* / FloorUplight_*` fixture group. Pads use real GLB
  bounds and nearest eligible riser/floor support bounds. Existing GLB
  yokes/bodies remain visible; the flare sprites were reduced and
  anchored closer to the actual aperture instead of hovering in front.

Validation gate:
- Next.js/TypeScript/Vercel build must pass; build does NOT validate
  browser WebGL shader compilation or quality.
- Compare E19 and E20 from the **same owner iPhone Safari viewport**.
- Confirm full-floor coverage, blurred/suppressed mirrored AUDITION at
  dance-ring center, readable ring illumination, optical bloom controlled
  at truss lens, uplight base contact and Mobile Safari FPS.
- E20 currently uses additional fragment texture taps, four actual
  non-shadow-casting SpotLights and extra small fixture meshes **only**
  in the compare URL. Profiling and owner image acceptance are required
  before considering any runtime promotion; do not merge PR #17 yet.


## 2026-10-08 — E21 owner rejection follow-up (E20 stripes, crown clearance, LED→riser gap)

Owner's E20 iPhone screenshot `IMG_3132.jpeg` rejects E20 whole-floor
reflections: visible long vertical magenta/cyan stripes are a hard FAIL.
Owner additionally identifies the crown tip being obstructed in both E19
and E20, and an excessively dark/empty structural gap between the lower
LED backdrop and the stairs.

**Preserve as the positive visual baseline:** E19
`?ledAsset=typography-v16&stageFx=physical-reflection-e19`.

**Isolated compare-only E21:**
`?ledAsset=typography-v16&stageFx=physical-repair-e21`.
No gameplay/StageCatalog changes. E19, V16, E20 forensic URLs stay intact.

Changes:
- E21 rejects the E20 shader completely. Its floor material derives from
  E19's existing world-space LED reflection ray. A bounded seven-tap
  blur softens legible reflected typography, and a **radial, isotropic**
  low-frequency ring pool gives dance-center coverage without horizontally
  sampled floor-wide stripe bands. The ring radius/position comes from the
  real `R15 Dance Ring Outer` GLB bounds. No extra reflection planes/FBO.
- V16 source SVG stays untouched. E21 uses separate authored asset
  `concept-led-crown-clearance-e21.svg`: crown translateY 150→183,
  vertical scale 1.075→0.93, horizontal scale remains 1.22. The lower crown
  and more conservative height clear the top frame while preserving a gap
  before AUDITION. Must inspect iPhone lettering/top-clearance before
  accepting.
- E21 adds opaque **physical cove / infill geometry** only BELOW the real
  `CentralLED` lower bound to close the empty interval to the highest
  eligible GLB riser support. Its height is calculated from real world
  bounds and capped at 2.45 stage units to guard against broken assets.
  One recessed lip conceals the seam. No new LED billboard, front-tinted
  overlay or camera/LED vertical registration change. Need iPhone QA to
  confirm riser contact and that the repair does not occlude equipment.
- Keep E20's localized four non-shadow SpotLights and fixture contact
  mounts in E21 only as a separate, already-scoped stage-lighting
  refinement; E20's striped floor fragment shader is NOT used.

Actual validation required:
1. Next.js/TypeScript/Vercel build and route existence.
2. Identical iPhone Safari E19 vs E21 viewport screenshots, stage-only.
3. Detect any crown clipping/wordmark overlap, residual backdrop/riser
   air-gap, dark infill, fixture occlusion, ring reflection sharpness,
   unnatural vertical bands, and overall GPU performance.
4. Vercel READY is not visual PASS; no integration or PR #17 merge without
   owner's acceptance.


## E22 — owner iPhone refinement for lower wall / continuous floor / fixtures (2026-10-08)

**Owner visual evidence:** `IMG_3133.jpeg` (E21 screenshot), plus owner-supplied
reference crops of the under-LED **swivel uplight fixture** and truss beam
cone. E21 is more favorable than E20 but NOT accepted: two horizontal
magenta dividers below the LED, disjoint ring/foreground floor reflection,
weak overhead volumetric shafts and boxy lower fixture supports.

**E22 opt-in URL:**
`/tools/neon-stage-compare?ledAsset=typography-v16&stageFx=physical-fidelity-e22`.
Keep E21 / E19 as immutable same-viewport controls. No gameplay promotion.

### Code/asset changes

- **LED lower bars:** E21 imported `concept-led-crown-clearance-e21.svg`
  contains a horizontal lower magenta `rect` at y=736; `addE21LedRiserStructuralBridge`
  also generated an emissive cove lip, so both lines were visible. A separate
  `concept-led-clean-base-e22.svg` removes only the SVG divider, and E22
  passes `noDecorativeLip` to remove only the extra cove lip. The E21
  lower 3D infill stays opaque and physical; existing crown top clearance,
  AUDITION lettering and geometry camera remain unchanged.
- **Floor:** E22 derives from the known working E19 physical
  LED-reflection material and replaces E21 ring-only emphasis with a
  continuous, very low-frequency floor base. Two broad world-space
  fixture-centered color lobes bridge ring→mid-floor→foreground. Reflected
  logo samples are spread over 9 taps, blur increases near the ring,
  rays leaving the wall edge fade exponentially rather than hard-cutting.
  No X-sampled LED stripe field, screen-space overlay, added render target,
  new reflection plane or E20 shader.
- **Truss:** retain original 4 shadow-free stage spotlights; increase
  cone widths, opacity and select 2 extra moving-head shafts ONLY for
  E22. A third crossed plane increases volumetric beam visibility. The
  optical source remains physically anchored to the GLB lens/pivot.
- **Lower fixtures:** replace E20/E21 box-style mounting additions ONLY
  in E22 with a stage-mounted swivel foot, circular turntable, yoke,
  gimbal pins, angled head and inset optical face. Coordinates and scale
  derive from each actual imported `DeckUplight`/`FloorUplight` mesh
  bounds; the original GLB equipment is not deleted.

### Validation and acceptance

- Next.js compilation and TypeScript checked through Vercel build;
  route remains /tools/neon-stage-compare.
- Pending actual iPhone Safari E22 capture: verify removal of both
  lower magenta lines, a continuous dark glossy reflection across ring
  and foreground, wide directional beams resembling supplied crop,
  stable realistic uplight mounting, camera and logo preservation.
- Performance risk: 2 additional visual beam shafts (each with 3 crossed
  planes), 4 inherited spotlights and extra small fixture geometry; no
  shadows/new render targets. iPhone FPS measurement still required.
- Deployment READY or numeric diagnostics do NOT imply visual acceptance.
  Do not merge PR #17 or change gameplay/Stage Catalog.
