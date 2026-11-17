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


## Addendum — 2026-11-17: actual owner MP4 received and measured (source gate remains OPEN)

A new *direct conversation upload* `Idle-animation-reference.mp4` was read successfully and independently verified by ffprobe: 910×512 pixels, 30 fps, **2677 frames**, 89.233333 s. Original nine performance ordering was inspected on an extracted multi-frame contact sheet. The previously inaccessible Library copy is no longer a blocker.

The assistant also recovered the exact V1.9 MediaPipe 0.10.32 full PoseLandmarker toolchain from historical Actions artifact `14297222508` (includes `pose_landmarker_full.task`). Actual nine-clip M3 bone pivot projections came from focused 9/9 Playwright run `44059611164`, artifact `14318121104`. In the offline source environment, MediaPipe processed **all nine** selected windows at 30 fps using the same initial `300,110,315,375` crop and visibility threshold 0.60. The model was not modified for the source.

Eight original-source tracks were sufficient for fixed-camera 2D baseline reprojection. **M02 failed** (bear with heavy props): only six anatomical points in one source frame were returned; 0.28% average joint coverage. Repeated image-mode trials with full, tight and wide crops failed to recover a stable pose. M02 is **NOT** a valid source skeleton or measured retarget.

| ID | Existing source frame range (inclusive) | Tracked 12-joint observations | Mean joint coverage | Median detected visibility | Baseline P50 2D | Baseline P95 2D |
|---|---|---:|---:|---:|---:|---:|
| F01 | 0–312 | 3756 | 100.0% | 0.9863 | 8.48 px | 57.17 px |
| F02 | 348–759 | 4820 | 97.5% | 0.9925 | 7.41 px | 33.51 px |
| F03 | 768–997 | 2729 | 98.9% | 0.9955 | 13.24 px | 31.78 px |
| F04 | 1020–1251 | 2737 | 98.3% | 0.9667 | 10.01 px | 41.13 px |
| F05 | 1287–1593 | 3167 | 86.0% | 0.9556 | 7.80 px | 24.74 px |
| M01 | 1611–1944 | 4008 | 100.0% | 0.9923 | 12.85 px | 35.20 px |
| M02 | 1980–2160 | insufficient | 0.28% | 0.9935 on 1 detected frame | N/A | N/A |
| X01 | 2198–2440 | 2277 | 78.1% | 0.9567 | 11.56 px | 38.72 px |
| M03 | 2466–2659 | 2204 | 94.7% | 0.9279 | 12.37 px | 36.19 px |

These values are **real source-to-existing-M3 2D baseline errors** produced by a global per-clip similarity fit on the FIRST 30 frames only, NOT optimization results or new retarget improvements. Source detection confidence denotes MediaPipe's `visibility`, not verified anatomical accuracy; missing joints were explicitly excluded. The F03/M03 historical V1.9 baseline varies slightly because the newly uploaded MP4/source detection is not guaranteed byte-identical to the prior analysis artifacts, and the current source tracks have different observation counts. Do not report these differences as improvement.

### Manual review flags

- F01 highest P95 joint: right wrist 86.6 px.
- F02: right wrist 54.8 px.
- F03: right elbow 45.9 px and left elbow 43.4 px.
- F04: possible left/right shoulder inversions around frames `1076,1078,1139,1148,1153,1159,1167,1169` (some may be genuine torso turns), left ankle P95 70.2 px.
- F05: 86.0% coverage, left wrist P95 51.3 px.
- M01: right wrist P95 42.3 px.
- M02: source Landmarker failure; no valid reprojection.
- X01: 78.1% coverage, possible shoulder inversions at `2233,2236,2351,2352`, right wrist P95 69.6 px.
- M03: possible shoulder inversions at `2467,2506,2507`, right wrist P95 59.9 px.

Source-frame windows above are verified to be within the actual MP4, but the exact choreographic cut boundaries between clips have **not** been human-accepted. A flipped shoulder sign is only a *flag*; no anatomical correction is assumed. Shoulder occlusion or side-facing posture can cause false positives.

**Artifacts generated in the private conversation environment, not committed to GitHub:**

- Eight complete `<ID>-source-skeleton.mp4` recordings over original imagery and absolute source timecode. M02 diagnostic video contains no valid skeleton and is excluded.
- Eight full-length `<ID>-source-vs-M3-overlay.mp4` yellow-source/blue-M3-rig overlays at 30 fps. These are **joint-only overlays**, *not* full rendered M3 actors.
- Nine `<ID>-source-landmarks.json` (including M02 failure evidence), eight per-joint reprojection CSV/JSON reports, nine-clip aggregate summary and tracking coverage.
- Three private conversation ZIP bundles (source skeleton, 2D overlays, measurement data), retained outside the Git repository.

### Gate status after receiving the source

- Gate A: **PARTIAL**, 8/9 automated skeleton tracks; M02 failed, F04/X01/M03 require left/right validation, F05/X01 have poorer landmark coverage.
- Gate B: **NOT DONE**, constrained 3D reconstruction not performed.
- Gate C: **NOT DONE**, no nine-clip measured M3 retarget; original V1.8.1 motion JSON files retained.
- Gate D: **PARTIAL BASELINE**, 8/9 fixed-camera 2D baseline discrepancies measured; NO before/after retarget delta.
- Gate E: **9/9 existing M3 30 Hz isolated projection Playwright PASS** on run `44059611164`; actor lifecycle stable in that QA, but no independent new 5-human READY QA or contact/collision scan.
- Gate F: **OPEN**, owner iPhone art review must follow actual 3D retarget, full rendered comparisons and five-person footage.

The critical unresolved task is to repair unreliable source tracking, especially M02 with an appropriate animation/anime pose solution or manual verified ground truth, then fit source trajectories to M3 anatomical bone constraints and generate real side-by-side motion videos. Do **not** accept the eight skeleton overlay results as final V1.9.1 artistic delivery. No source video is publicly uploaded and no merges occurred.


## Addendum — source-derived 3D world estimates, biomechanical rejection

The owner source was also passed through MediaPipe Tasks `pose_world_landmarks` at the original 30 fps for all nine selected windows. This output is a **model-inferred single-camera 3D pose** in pelvis-relative nominal world units — no camera-depth ground truth. The projected 2D joint trajectories and these inferred 3D trajectories must not be conflated.

| Clip | World landmark coverage | Inter-frame world-coordinate jump flags (distance >0.20 units) | Unstable 3D estimated limb lengths (CV >15%) |
|---|---:|---:|---|
| F01 | 100.0% | 23 | None in 8 tested limbs |
| F02 | 97.5% | 30 | None in 8 tested limbs |
| F03 | 98.9% | 31 | Right upper arm, right forearm |
| F04 | 98.3% | 131 | Right upper arm, both forearms |
| F05 | 86.0% | 60 | Both forearms |
| M01 | 100.0% | 11 | None in 8 tested limbs |
| M02 | 0.28% | 0 (insufficient evidence) | Not measurable |
| X01 | 78.1% | 122 | Both upper arms and forearms |
| M03 | 94.7% | 12 | None in 8 tested limbs |

For example, F04 forearm length CV is **37.37% left** and **32.27% right**; X01 forearm length CV is **23.42% left** and **28.06% right**; F03 right upper arm CV **22.69%**. A real animated skeleton cannot have dynamically changing bone lengths. This is evidence that the source model estimates are not physically stable enough for direct bone-rotation baking. Jump flags are conservative screening heuristics, **not** confirmed body motion errors in every flagged frame.

A separate reproducible script was committed: `scripts/m3-idle/world_estimates_v191.py`. It accepts the actual private MP4, model, manually reviewed nine ROI entries and export directory, writes per-clip 3D estimate JSON and biomechanical-audit JSON, with **`retarget_ready=false` always** pending constrained reconstruction. Tests in `test_world_estimates_v191.py` ensure missing source poses stay missing and unstable bone lengths cannot silently pass. No automatically inferred coordinates are substituted for verified M3 rig constraints.

An additional private conversation bundle, `M3-V191-3D-estimates-biomechanics-9-clips.zip`, contains the actual per-frame world estimates and these audits; it was NOT committed to public GitHub.

**Current 3D gate outcome: REJECT DIRECT RETARGET.** Required next method is measured-2D constrained reconstruction with fixed M3 bone lengths, joint limits, confidence-weighted loss, occlusion treatment, anatomical L/R review, 3D foot support/contact, then frame-aligned comparison using *rendered* M3 actors in front/side view. M02 requires a different source-tracking strategy because the human pose model fails on its bear morphology. No animations, random selection or gameplay were changed as part of this evaluation.


## Addendum — actual M3 WebGL full-motion browser recordings (existing runtime)

A new isolated Playwright suite `e2e/m3-idle-v191-motion-record.spec.ts` captured **real assembled M3 characters** (not synthetic stick-figures) while the current M3 `AnimationMixer` played each baked clip at normal runtime speed. Three tests in GitHub Actions run `44065383460` **PASSED 3/3**:

1. Female Drophunter existing library: F01, F02, F03, F04, F05 at normal playback speed, preserved scene generation and actor instance through recording.
2. Male Neurohacker existing library: M01, M02, X01, M03 at normal playback speed, preserved actor instance.
3. Five-person QA fixture: 30 seconds of random Waiting Room playback, stable scene generation and M3 instances, no page errors.

Run `44065383460` had a **post-processing infrastructure failure** after the tests: the GitHub runner did not have the system `ffmpeg` binary. The raw WebM footage was uploaded successfully as artifact `14320147395`. It was downloaded into the private analysis environment, validated with ffprobe, converted to H264 MP4, and the waiting/loading portions were trimmed for owner viewing:

- `M3-V191-female-full-library-real-motion.mp4` — 52.84 s.
- `M3-V191-male-full-library-real-motion.mp4` — 35.04 s.
- `M3-V191-five-person-random-real-motion.mp4` — 32.32 s.

The separate CI workflow `.github/workflows/m3-idle-v191-motion-evidence.yml` was corrected to install FFmpeg before MP4 transcoding. The owner-visible MP4 files are private conversation attachments, not repository media.

**Crucial distinction:** These recordings demonstrate **existing V1.8.1-era M3 runtime motion**, not newly reconstructed V1.9.1 animations. They were not synchronized frame-by-frame against source MP4 and do not prove artistic acceptance. The five-person fixture is NOT a five-human Supabase READY/reconnect test. The source-to-M3 3D retarget gate remains FAILED/OPEN. No changes to M3 motion JSON or runtime behavior were made.

Static source-vs-real-M3 contact sheet and a 24 high-error source/M3 skeleton frame montage were also generated privately; they support visual review but do not replace full per-clip actor comparisons.


## 2026-11-17 — Dựng chuyển động F01 và M01 từ nguồn đã rà soát

F01 (Drophunter, khung 0–312) và M01 (Neurohacker, 1611–1944) hiện dùng khóa chuyển động mới 30 Hz. Bảy clip còn lại giữ chuyển động hiện hành. Video nguồn và dữ liệu quan sát theo từng khung được giao riêng cho chủ dự án.

Hai lần nhận dạng độc lập về trọng số mô hình, mốc ảnh đánh dấu tay và quang lưu hai chiều cung cấp mục tiêu 2D. Những vùng mất dấu có cờ riêng. Bộ giải khớp với chiều dài xương lấy từ VRM, giới hạn quay, ràng buộc theo thời gian và tiếp xúc chân. Hướng sâu của tay là ước lượng. Camera mỗi clip được cố định trước khi so trước/sau. Bảy khung mỗi clip được loại khỏi bộ giải; lỗi ở bốn mốc khuỷu/cổ tay đánh dấu riêng trên nguồn như sau.

| Clip | P50 trước → sau (px nguồn) | P95 trước → sau (px nguồn) |
|---|---:|---:|
| F01 | 10,23 → 4,12 | 15,30 → 6,84 |
| M01 | 23,81 → 14,72 | 36,80 → 19,13 |

Kiểm tra lưới da với trang phục mặc định ở từng khung của hai clip và 16 đường chuyển liên quan ghi nhận 0 giao cắt trong các cặp được kiểm. Phân vị 95 của sai phân bậc hai cổ tay tăng ở cả hai clip. F02, F03, F04, F05, X01 và M03 thiếu quan sát tin cậy ở tay, chân hoặc cả hai trong những đoạn quan trọng. M02 chỉ có mốc ngoài trên bộ đồ gấu. Các số đo, góc chính diện/nghiêng và kiểm tra của chủ dự án trên iPhone là các bước riêng của nghiệm thu.
