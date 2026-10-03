# Astra Moonlight POC V2 — offline extraction and QA

Offline continuation of V1 commit `6c84f1e6b154b9a4248d274b7258cc10d88729f2`,
on `work/character-rig-animation-v1`. No runtime integration or branch merge.

Result: eight complete-source motion candidates on both real Meshy rigs.
Structural QA passes; high-fidelity/production visual acceptance does not.
The transient workspace was recovered during continuation; sources and original
rigs were re-inspected, and durable checkpoints preserve the reproducible tools.

Confirmed source: `Moonlight_POC_V2_A.mp4` and `Moonlight_POC_V2_B.mp4`, each
480×360, 30 fps, 750 frames. Tropical boardwalk, three matching blonde NPCs,
Audition Spain Moonlight song panel. The old basketball source is not used.

Eight complete source intervals are candidates, not production-accepted clips:

| Clip | Source | Zero-based half-open frames | Source seconds |
|---|---|---|---|
| 001 | A | [86,188) | 2.866667–6.266667 |
| 002 | A | [188,290) | 6.266667–9.666667 |
| 003 | A | [290,391) | 9.666667–13.033333 |
| 004 | A | [391,492) | 13.033333–16.400000 |
| 005 | B | [76,177) | 2.533333–5.900000 |
| 006 | B | [431,532) | 14.366667–17.733333 |
| 007 | B | [532,634) | 17.733333–21.133333 |
| 008 | B | [634,735) | 21.133333–24.500000 |

Both sides of each event have judgement/command UI evidence, with ±1 frame
observational uncertainty. No BPM duration forcing. NPC judgement labels may
appear 1–2 frames after the initial flash. Game-engine activation is not exposed.

The complete long intervals A[492,746), B[177,431) contain floor/inverted moves
and overlap; tracking quality is inadequate. They remain separate rejected
evidence. Leading/trailing fragments are excluded, never repaired with looping.
B278 is a READY overlay, not a Space event.

Primary backend: RTMW x-l 384×288, rtmlib 0.0.13 / ONNX CPU, plus MotionBERT
lite H36M temporal checkpoint. The SimCC confidence mapping is heuristic;
raw peaks remain in NPZ. Camera background registration, confidence-weighted
trajectory smoothing, learned depth prior, reprojection and limb-length losses
operate on padded temporal windows. Single-view depth is not ground truth.

The V1 append-only GLB writer, bone-axis IK, normal transport, actual-mesh
Blender renderer and structural QA are reused. Male/female solve independently.
V2 adds conservative head/palm/clavicle constraints, airborne release evidence,
confidence-aware contacts, angular filtering and post-filter root correction.
Fingers remain bind-local; head/palm depth is weak. The angular cap itself does
not establish improved mocap accuracy.

Original geometry, skin, UV, PBR textures, hierarchy, inverse binds and embedded
Running/Walking clips must pass preservation QA. Owner visual acceptance is
pending; structural PASS will not be called visual PASS.

## Render-discovered deformation fix

Actual-mesh key-pose renders revealed a severe waist pinch in motion 003 that
structural checks did not detect. The spine differential was only about 18–22°;
the hip-to-thigh axial orientation had accumulated approximately 170–180°.
Temporal normal transport alone allowed roll drift in nearly straight chains.
Vertices blended between pelvis and thigh transforms then collapsed inward.

V2 now bounds the second-axis bend normal against each target's own bind plane
in the current body frame: 35° for legs, 75° for arms. Positional two-bone IK
and the measured pole remain active. This is not source-quaternion copying or
swing-only retargeting. Same-frame before/after renders confirm the waist pinch
is removed on male and female; the original meshes and weights are unchanged.

Seven focused tests pass: four existing V1 tests, complete source interval
checks, anatomical roll regression and low-confidence interval encoding.
Both corrected GLBs pass structural QA with eight 30 Hz source-complete clips
and preserved original asset data. This is not owner visual acceptance.

## Identity-tracking correction

Frame-by-frame checks found the initial slow bbox follower captured the middle
NPC instead of the selected third NPC (e.g. A461–464 and B101). These are
measurement failures, not intentional root travel. The third-lane tracker now
predicts head displacement with local optical flow, centers the top-down crop
on that prediction, and zero-weights head-identity jumps over 18 pixels.
Rejected frames remain explicit. Motion 008 retains its separately reviewed
first-lane tracker: head flow is less reliable during its deep crouch.

Source crops 004/005 are widened/repositioned after this identity correction.
The renderer uses 768×576 panels with vertical view span 2.55 and a static
per-clip camera center. It does not follow the actor frame-by-frame or hide root
travel. The original 512-wide panel clipped large, genuinely observed steps.

## Measured quality limits, not hidden by structural PASS

Final same-source MediaPipe Heavy baseline detects 237/811 production frames
with the final crops (the earlier 205 figure used narrower crops). RTMW retains
the A360–365 hands-near-head gesture where this baseline misses the person.
Presence counts and heuristic keypoint weights are not accuracy ground truth.

The final geometry-sampled QA finds shoe penetration of about 3–5 cm in some
frames. Male 004 has an inferred-stance ankle-speed p95 of about 0.75 m/s.
These are unresolved heel/toe/foot-contact defects, not structural failures.
Source 005 has roughly 31% low-confidence whole-body body-joint observations,
and 008 roughly 21%; fingers are unanimated and head/depth remain approximate.
No production quality or all-motion visual PASS is claimed.

## Reproduction and delivery

`requirements-moonlight.txt` pins the primary CPU environment. The independent
MediaPipe environment uses 0.10.21 and NumPy <2. Model URLs/checksums, exact
package versions and Blender 4.5.3 are in the artifact dependency manifest.

`run_moonlight.py` orchestrates the reused stages. It requires explicit paths
to the two extracted Moonlight videos, original textured male/female GLBs,
RTMW ONNX model, official MotionBERT checkout/checkpoint and Blender executable.
The original source hash gate refuses different footage rather than applying
these reviewed frame boundaries to another clip. Boundary review is specific
to these videos; it is not an unverified universal Space detector.

```bash
python scripts/astra-motion-poc/run_moonlight.py \
  --sources /path/to/moonlight-videos \
  --male /path/to/Nam_co_ban_MESHY_TEXTURED_RIG_v1.glb \
  --female /path/to/Nu_co_ban_MESHY_TEXTURED_RIG_v1.glb \
  --pose-model /path/to/rtmw.onnx \
  --motionbert-repo /path/to/MotionBERT \
  --motionbert-checkpoint /path/to/motionbert.bin \
  --blender /path/to/blender \
  --secondary-python /path/to/mediapipe-env/bin/python \
  --secondary-model /path/to/pose_landmarker_heavy.task \
  --out /path/to/offline-artifacts
```

`moonlight_delivery.py evidence` produces exact low-confidence source intervals
and consecutive risk-frame comparisons from the actual mesh renders.
`moonlight_delivery.py package` requires completed human-readable review notes,
eight source clips and eight corresponding full-frame QA videos, verifies GLB
hashes/video counts and writes consolidated QA, per-file SHA256 and a CRC-tested
ZIP. It refuses to imply visual acceptance from structural metrics.

Final named outputs are `Nam_Astra_Moonlight_POC_V2.glb`,
`Nu_Astra_Moonlight_POC_V2.glb`, `Moonlight_V2_Combined_Review.mp4`,
`Moonlight_V2_Final_QA.json` and `Astra_Moonlight_POC_V2.zip`.
Generated binaries remain separate downloadable artifacts, not repository data.

Manual visual review is keypose/contact sheets plus consecutive high-risk
frames; the owner receives full 30 fps videos, not a sparse-frame slideshow.
The review does not claim independent human scrutiny of every rendered frame.
Both target meshes retain recognizable gesture/step elements, but head/palms,
some elbow depth, ground penetration and contact remain defective. V1 uses a
different source, so there is no valid same-choreography accuracy benchmark.

Delivery validation: 811 actual rendered frames per rig (1,622 total), eight
2304×648 / 30 fps comparisons and a 27.033333 s combined review. All 28 artifact
MP4s passed full ffmpeg decode. Motions 004/005/008 are explicitly high-risk,
not visually passed; 008's source kneeling ending is only an approximate lunge.
003 shows the clearest improved hands-near-head key gesture. All eight remain
owner-review candidates, not production-accepted animations.

## Delivery recovery

The workspace reset again during final packaging. The final GLB hashes and six
already-published comparison MP4 hashes were recovered and verified unchanged.
Only 007/008 require re-rendering from the same GLBs; no new pose or solve.
`render_moonlight_batch.py --motions ...` limits that recovery work.
`moonlight_delivery.py combine` assembles complete saved comparisons, and the
packager accepts missing raw PNGs only with explicit model/video SHA256 archive
provenance plus validated frame counts. Risk images identify when their mesh
panels were decoded from archived videos rather than fresh PNGs.
Diagnostic rendering from saved tracks no longer imports inference backends.
The supplied per-motion videos remain the primary visual evidence; transient
before/after PNGs may not survive a workspace reset.

The minimum next solver change is contact optimization on the final deformed
feet/soles, plus confidence-aware depth refinement for occluded wrists/elbows.
Ingest, boundaries, pose contract, target-owned IK, append-only GLB export and
QA packaging remain automated. No manual DeepMotion substitution is required.

Sources: https://github.com/Tau-J/rtmlib ; https://github.com/open-mmlab/mmpose/tree/main/projects/rtmw ; https://github.com/Walter0807/MotionBERT
