# M3 Waiting Room Idle V1.9 — Measured Reference Skeleton Gate

## Owner verdict and scope

The owner rejected V1.8.1 on visual grounds: character performances still read as robotic, and the distinctive source gestures are not legible. The owner explicitly approved drawing a pose skeleton on the **actual video**, capturing all joints at matching timestamps, then measuring M3 reprojection rather than subjective rotation tuning.

This is the FIRST MEASUREMENT GATE, not a claim that V1.9 retargeting or 100% fidelity has been achieved. No existing 9 clips were reauthored in this pass. Random/shuffle-bag, contact IK, RoomState, READY, M3 lobby-only capability and global gameplay authority remain unchanged.

## Verified source and sampling

- Source: owner-supplied Video-test(20261116-031643).mp4, 910×512, 30 FPS, 2677 frames. This MP4 is a private input and is NOT committed to GitHub.
- F03: 25.60–33.23 s, absolute frames 768–997 inclusive, 230 samples.
- M03: 82.20–88.63 s, absolute frames 2466–2659 inclusive, 194 samples.
- MediaPipe Tasks PoseLandmarker full model (0.10.32), video inference in frame order. Crop x=300,y=110,w=315,h=375. Confidence >= 0.60 for 12 anatomical landmarks (shoulders, elbows, wrists, hips, knees, ankles). Missing or occluded joints remain absent; no fabricated trajectory.
- F03 coverage: all joint tracks 100% except right elbow 83.9% and right wrist 96.5%.
- M03 coverage: right elbow 64.9%, right wrist 77.8%, left wrist 97.4%, right knee 94.3%; other selected joints 100%. Source occlusion/estimated joint-center ambiguity is material.

## Real M3 rig measurement

- New opt-in reviewer command v19-sample exists ONLY on /tools/lobby-qa-sketch?v19capture=1. It seeks F03/M03 to an exact local 30Hz clip time and projects 12 actual M3 bone pivots through the current Three.js camera.
- Two focused Playwright captures on real assembled SkinnedMesh rigs: F03 230 frames, M03 194 frames. All 12 M3 projected pivots were finite; actor instance identity and scene generation remained stable.
- Camera alignment: one global 2D similarity transform per clip, estimated from shoulder/hip pivot landmarks in first 30 frames. Do not register each frame separately: that would conceal motion errors.
- Metrics: per-joint and aggregate pixel error, P50/P95/max, torso-normalized errors, joint-velocity errors, visibility coverage and per-frame CSV. Reference and M3 overlays are drawn on the actual original MP4.

## Baseline measurable error (prior V1.8.1, NO correction applied)

| Metric | F03 | M03 |
| --- | ---: | ---: |
| Compared frames | 230 | 194 |
| Joint observations | 2715 | 2201 |
| Mean pixel error | 14.16 | 16.48 |
| P50 pixel error | 13.52 | 12.64 |
| P95 pixel error | 31.53 | 36.39 |
| P50 torso-normalized | 0.236 | 0.153 |
| P95 torso-normalized | 0.550 | 0.440 |

F03's biggest P95 errors are right elbow 46.2 px, left elbow 43.4 px and left wrist 35.2 px; worst frame window is around source frames 850–858 (~28.33–28.60 s).
M03's biggest P95 errors are right wrist 57.2 px, right ankle 40.8 px and right knee 37.1 px; worst high-confidence window includes source frame 2594 (~86.47 s).

These values are **observed 2D reprojection discrepancies**, not '1 minus similarity' or true 3D accuracy. Different character proportions, camera and joint-center definitions contribute. Even a zero 2D reprojection error would not prove 3D pose equivalence.

## Actual files and QA

- scripts/m3-idle/reference_metrics_v19.py: track the original source MP4, optionally export yellow-skeleton video; compare M3 pose export with fixed-camera registration, write per-frame CSV and yellow/blue overlay MP4.
- scripts/m3-idle/test_reference_metrics_v19.py: five synthetic tests ensure correct camera calibration, detected wrist deviations, visibility omission, timestamp rejection and clip ID matching.
- components/character/m3-lobby-idle.ts and components/multiplayer/WaitingRoomStage3D.tsx: opt-in frame seek and projected rig pivot capture strictly on the isolated sketch QA route; no production timeline change.
- e2e/m3-idle-v19-projection.spec.ts and .github/workflows/m3-idle-v19-qa.yml: real F03/M03 30Hz projection artifact and focused regression.
- .github/workflows/m3-idle-v19-pose-toolchain.yml: isolated Python 3.13 pose inference package/model bundle for processing the owner's private source in the assistant analysis environment, without committing source media.
- Run https://github.com/ToanFreelance/audition-mobile-mvp/actions/runs/44012954641 — TypeScript PASS, production build PASS, Python measurement tests 5/5 PASS, real M3 Playwright 2/2 PASS.
- Projection JSON artifact 14297616982 includes F03-m3-2d.json and M03-m3-2d.json.
- Actual 2D reference overlays, per-frame CSV, measurement reports and source-versus-M3 overlay MP4 were produced from the user-supplied MP4 in the analysis environment and retained as owner-visible conversation artifacts. They are not source files in the repository.

## Required next gate before changing M3 motion clips

1. Inspect the source overlay frame by frame and reject joints whose tracked positions are wrong even when MediaPipe confidence appears high.
2. Establish per-joint targets on the M3 skeleton with physically plausible rotations, pelvis/COM constraints, foot contact, joint limits and camera-relative geometric calibration. Do not directly copy 2D pixel coordinates into bone Euler rotations.
3. Optimize F03 and M03 and rerun the EXACT same measured reproduction; report delta per joint, P50/P95, pose timing and source silhouette. Measure contact skating and mesh/clothing intersections separately.
4. Only after owner accepts improvement and motion remains plausible in front/side views should the new method be expanded to the other seven clips.

## Explicit limitations

- A single Zenless camera cannot uniquely determine occluded joint motion, relative depth and real 3D rotations; exact 100% 3D equivalence is not a verifiable promise from this source.
- The tracker detects 2D landmarks but errors remain, especially with game equipment/occlusions. Manual artistic scoring does not replace metrics, but checks for bad estimates remain mandatory.
- These F03/M03 baseline numbers DO NOT prove the rest of the nine clips are accurate.
- iPhone hardware FPS/visual acceptance, real clothing collision in all outfits, and post-optimization motion fidelity remain OPEN.
- General Lobby QA still has historical ESLint no-use-before-define errors at reconcileParticipants. Do not bypass or claim full integrated QA PASS.

Branch: work/m3-waiting-room-integration-v1. No PR, no merge. Stable branch Vercel Preview remains the owner QA route.
