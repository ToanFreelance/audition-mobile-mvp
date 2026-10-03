# Astra Moonlight POC V2 — offline visual QA in progress

Offline continuation of V1 commit `6c84f1e6b154b9a4248d274b7258cc10d88729f2`,
on `work/character-rig-animation-v1`. No runtime integration or branch merge.

The transient workspace was lost during continuation. Sources and original rigs
were recovered and inspected again. This checkpoint preserves the V2 tooling;
final validation and visual acceptance are not claimed by this checkpoint.

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

Six focused tests pass: the four existing V1 tests, complete source interval
checks, and the anatomical roll regression. Both corrected GLBs pass structural
QA with eight 30 Hz source-complete clips and preserved original asset data.
Full-frame visual review remains in progress.

## Identity-tracking correction

Frame-by-frame checks found the initial slow bbox follower captured the middle
NPC instead of the selected third NPC (e.g. A461–464 and B101). These are
measurement failures, not intentional root travel. The third-lane tracker now
predicts head displacement with local optical flow, centers the top-down crop
on that prediction, and zero-weights head-identity jumps over 18 pixels.
Rejected frames remain explicit. Motion 008 retains its separately reviewed
first-lane tracker: head flow is less reliable during its deep crouch.

Source crops 004/005 are widened/repositioned after this identity correction.
The renderer uses 768×576 panels with unchanged ortho scale 2.55 and a static
per-clip camera center. It does not follow the actor frame-by-frame or hide root
travel. The original 512-wide panel clipped large, genuinely observed steps.

Sources: https://github.com/Tau-J/rtmlib ; https://github.com/open-mmlab/mmpose/tree/main/projects/rtmw ; https://github.com/Walter0807/MotionBERT
