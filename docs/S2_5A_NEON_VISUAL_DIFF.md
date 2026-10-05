# S2.5A — Neon Stage Golden Visual Diff Harness

## Goal

Stop subjective visual tuning. Every visual pass must be measured against the owner-approved Neon Stage concept before calling it an improvement.

The harness is presentation-only. It does not alter WebAudio timing, gameplay state, RoomState, gauge, Finish, sequenceCounts, or Stage Catalog authority.

## Deterministic capture route

Use:

`/tools/neon-stage-compare`

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
