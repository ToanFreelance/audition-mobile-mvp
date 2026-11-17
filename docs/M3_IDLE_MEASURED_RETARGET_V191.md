# M3 Waiting Room Idle V1.9.1 — Nine-Performance Measurement and Retarget Gate

## Status: PARTIAL IMPLEMENTATION; OWNER VISUAL GATE OPEN

Owner requirement: all nine independent selected performances must be measured against the **actual 89.23-second reference**, reconstructed in 3D, retargeted to M3 and rendered side-by-side. A lower 2D reprojection error does not demonstrate correct 3D motion.

**This change is measurement/QA infrastructure, not a nine-clip motion reconstruction.** No animation JSON was altered and no full-motion source-vs-M3 comparison was generated. Do not count any clip as V1.9.1 completed.

## Repository / inputs

- Branch: `work/m3-waiting-room-integration-v1`
- Initial verified HEAD: `89c05975c59bb66857c6f4ec961713a8c9c86e63`
- V1.9 baseline: F03/M03 12-joint MediaPipe tracking and fixed-first-30-frame camera comparison
- Owner private video: `Video-test(20261116-031643).mp4`, previously reported 910×512 / 30 fps / 2677 frames. **Not stored in GitHub.**
- During V1.9.1, a Library entry with the exact filename was found, but raw-byte materialization was refused by the file service. The frames therefore could NOT be inspected/retracked in this session. Prior V1.9 screenshots, JSON and earlier documentation are not substitutes for source measurements.
- No alternate online compilation is an acceptable substitute for the specific owner-selected nine-performance cut.

## Nine existing asset source windows (unverified against re-opened MP4)

These are **precise metadata ranges from the existing baked-motion JSON files**, not newly validated original scene boundaries. Endpoints are inclusive, 30 fps.

| ID | Existing asset | Source frames | Source time (s) | Frames | Rig |
| --- | --- | --- | --- | ---: | --- |
| F01 | drophunter.json | 0–312 | 0.000–10.400 | 313 | Drophunter female |
| F02 | F02.json | 348–759 | 11.600–25.300 | 412 | Drophunter female |
| F03 | F03.json | 768–997 | 25.600–33.233 | 230 | Drophunter female |
| F04 | F04.json | 1020–1251 | 34.000–41.700 | 232 | Drophunter female |
| F05 | F05.json | 1287–1593 | 42.900–53.100 | 307 | Drophunter female |
| M01 | neurohacker.json | 1611–1944 | 53.700–64.800 | 334 | Neurohacker male |
| M02 | M02.json | 1980–2160 | 66.000–72.000 | 181 | Neurohacker male |
| X01 | X01.json | 2198–2440 | 73.267–81.333 | 243 | Neurohacker male |
| M03 | M03.json | 2466–2659 | 82.200–88.633 | 194 | Neurohacker male |

These ranges include 2446 of the video's 2677 reported frames, excluding unselected gaps. Verify boundaries at source-frame level before retargeting.

## Implemented

1. The **isolated** `/tools/lobby-qa-sketch?v19capture=1` joint projection hook now accepts F01–F05, M01–M03 and X01, but only for a compatible M3 rig. It still projects actual Three.js SkinnedMesh bone pivots through the same camera. No production runtime or multiplayer changes.
2. `e2e/m3-idle-v19-projection.spec.ts` includes all nine clip fixtures and their source-frame-aligned offsets. Every sample must contain twelve finite actual M3 pivot projections. Actor instance and scene generation must remain stable.
3. `scripts/m3-idle/reference_metrics_v191.py` reuses the existing V1.9 MediaPipe tracker with **nine separate clip windows**. The script requires an original MP4 plus a separately reviewed per-clip ROI JSON. It exports nine `<ID>-source-skeleton.mp4` videos, per-frame landmark JSON, per-joint measured visibility coverage and warnings for frame jumps or potential L/R swaps. It does not interpolate occluded joints. Every result is explicitly flagged for human frame review.
4. New synthetic tests verify nine distinct asset windows, frame alignment, left/right identity warnings, explicit occlusion and complete ROI configuration.
5. The focused CI workflow now includes the nine-clip projection test and synthetic V1.9.1 audits. CI PASS, if obtained, proves tooling integrity only.

### Run offline tracking when source access is available

```bash
python scripts/m3-idle/reference_metrics_v191.py --template-only --output-dir /tmp/m3-v191
# Manually inspect the source and fill ALL NINE entries in roi-REVIEW-BEFORE-USE.json.
# The seven null ROIs are deliberately not guessed.
python scripts/m3-idle/reference_metrics_v191.py \
  --video 'Video-test(20261116-031643).mp4' \
  --rois /tmp/m3-v191/roi-REVIEW-BEFORE-USE.json \
  --model /path/to/pose_landmarker_full.task \
  --output-dir /tmp/m3-v191/measured
```

This command **has not been executed successfully against the owner MP4 in this session** because the private source bytes could not be accessed.

## Measured status

| Metric | F03 V1.9 historical baseline | M03 V1.9 historical baseline | V1.9.1 |
| --- | ---: | ---: | --- |
| P50 2D reprojection error | 13.52 px | 12.64 px | Not measured |
| P95 2D reprojection error | 31.53 px | 36.39 px | Not measured |
| P50 torso-normalized | 23.6% | 15.3% | Not measured |
| P95 torso-normalized | 55.0% | 44.0% | Not measured |

Seven additional source tracking reports: **NOT AVAILABLE**. Confidence/coverage for those clips: **NOT MEASURED**. 3D reconstruction and corrected retargeting for all nine: **NOT PERFORMED**. Quantitative before/after motion improvement: **NOT ESTABLISHED**.

## Independent quality gates

- Gate A — Actual source tracking: **BLOCKED** by inaccessible raw video; source boundaries and per-clip ROIs unverified.
- Gate B — Camera-constrained 3D motion reconstruction: **NOT PERFORMED**. Single-camera depth and occluded limbs cannot be recovered uniquely.
- Gate C — Measured M3 retarget: **NOT PERFORMED**. Existing V1.8.1 clips are intentionally retained.
- Gate D — Real source-vs-render reprojection across all nine: **NOT PERFORMED**. No new error deltas or source silhouettes reported.
- Gate E — Full nine-clip isolated rig-projection regression: **IMPLEMENTED; see actual CI result before claiming PASS**. Five-person realtime/READY regression and garment intersections are still open.
- Gate F — Owner iPhone visual acceptance: **OPEN**.

## Engineering interpretation / root cause

Existing V1.8.1 uses a mixture of OpenCV optical flow, landmarks, manually supplied wrist trajectories and Blender F-Curve accents. Image-plane correspondence is incomplete and 3D depth inferred. The runtime additionally operates an authored stance/foot-contact trajectory separate from the source landmark tracking. This explains the known risk of gesture mismatch, mechanical coordination and abrupt pose-to-stance adaptation, but not a new verified quantitative causal attribution for each of the nine clips.

The existing adaptive contact IK and shuffle-bag were left unchanged to avoid slipping/actor lifecycle regressions. No footage or synthetic numbers are presented as retarget acceptance.

## Architecture / review

Locked: WebAudio gameplay clock and global turn budget, gauge/Finish, RoomState CAS, Supabase Realtime, READY/START/preload, Character Catalog and M3 `lobbyReady=true/runtimeReady=false`. No Premium Cute integration. No merge into development/main.

**Next owner acceptance requires authorized access to the exact raw video, full nine-clip tracking/reconstruction, quantitative before-after reports, nine original/skeleton/M3 side-by-side motion videos, actual five-person recordings and physical iPhone approval.**
