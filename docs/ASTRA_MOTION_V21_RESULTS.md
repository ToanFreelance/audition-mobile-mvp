# V2.1 and Finish results — 2026-10-05

Status: tooling implemented; quality refinement is mixed and **not accepted**.
Finish is source-complete but reconstruction **FAIL**. Owner visual acceptance
remains decisive. No runtime, catalog, Waiting Room or gameplay changes.

## Source and boundary evidence

Moonlight tropical boardwalk / beach stage, three matching blonde female NPCs,
visible Audition Spain Moonlight context. This is not the V1 basketball/Boss
source. Normal clips A/B are 480×360, 30 fps, 750 frames each. Existing ranges
were preserved exactly, on a zero-based half-open timeline:

| Motion | Source | Frames | Seconds | Duration |
| --- | --- | --- | --- | --- |
| moonlight-space-001 | A | [86,188) | 2.866667–6.266667 | 3.4 s |
| moonlight-space-002 | A | [188,290) | 6.266667–9.666667 | 3.4 s |
| moonlight-space-003 | A | [290,391) | 9.666667–13.033333 | 3.366667 s |
| moonlight-space-004 | A | [391,492) | 13.033333–16.4 | 3.366667 s |
| moonlight-space-005 | B | [76,177) | 2.533333–5.9 | 3.366667 s |
| moonlight-space-006 | B | [431,532) | 14.366667–17.733333 | 3.366667 s |
| moonlight-space-007 | B | [532,634) | 17.733333–21.133333 | 3.4 s |
| moonlight-space-008 | B | [634,735) | 21.133333–24.5 | 3.366667 s |

Normal 001–007 use the third blonde NPC; 008 uses the first.

Finish source: `Moonlight_Finish_POC_source.mp4`, 960×720, 30 fps, 600 frames,
20 seconds. SHA-256:
`f0cbfd442c40fd5ad86ec623312791d2bcc7d2f548cb961e6d0ec1be70421fd4`.
The source window is 165–185 seconds in the full video.

`finish-special-001`: **[29,283)** = **0.966667–9.433333 seconds**;
254 frames / **8.466667 seconds**. Full-source coordinates:
**165.966667–174.433333 seconds**. Both judgement boundaries are observed,
with ±1 frame observational uncertainty. Frame 29 loses the command row and
shows magenta judgement; frame 31 shows NPC judgements; frames 35–75 display
FINISH; frame 283 is the next judgement. Becoming upright around frame 240 is
not the semantic end. No EOF ending was synthesized.

Selected dancer: first blonde NPC / lane-1. The generic analysis redetected
events [29,283,384,486,587]. Tesseract did not read the stylized Finish banner;
classification was explicitly reviewed, not automatically invented. One complete
Finish variant exists in this supplied clip; no 3–5 variants were fabricated.

## V2.1 measured comparison

Measurements cover all eight clips × both targets. Visual re-rendering in this
pass focuses on six real keyposes each for 003/004/005/008, with V2 footage
beside V2.1. These sheets do not establish full temporal visual acceptance for
the eight V2.1 clips. Finish has a full synchronized 30 fps QA render.

| Evidence | V2 → V2.1 | Interpretation |
| --- | --- | --- |
| Nam 003 minimum shoe Y | −31.1 mm → +2.0 mm | Whole-shoe penetration corrected |
| Nu 004 minimum shoe Y | −54.9 mm → +2.0 mm | Corrected for all measured shoe vertices |
| Nam 003 stance XZ p95 | 0.077 → 0.065 m/s | Small improvement |
| Nam 005 stance XZ p95 | 0.105 → 0.521 m/s | Regression |
| Nu 004 stance XZ p95 | 0.093 → 1.022 m/s | Major regression |
| Nam / Nu 008 stance XZ p95 | 0.107 / 0.112 → 0.418 / 0.578 m/s | Regression |
| 003 hand/elbow depth acceleration RMS | 5.66 → 4.70 | Smoother inferred depth, accuracy unproven |
| 005 hand/elbow depth acceleration RMS | 9.28 → 6.67 | Smoother but wrong gestures remain |
| Nam 004 ankle vertical excursion, left | 0.306 → 0.374 m | Lift not flattened; includes pelvis motion |
| Nam 003 root vertical excursion | 0.089 → 0.120 m | Bounce amplitude retained, not independent fidelity proof |
| Nam 008 ending knee Y, L/R | 0.240/0.332 → 0.068/0.137 m | Visibly deeper kneeling |
| Nu 008 ending knee Y, L/R | 0.245/0.331 → 0.074/0.142 m | Visibly deeper kneeling |
| Nam 003 angular p99 | 14.70° → 17.14°/frame | Regression |
| Nu 008 angular p99 | 15.57° → 18.00°/frame | Regression |

Sliding uses the same V2 inferred contact mask for both versions, not independent
ground truth. Depth acceleration is a smoothness proxy; monocular metric depth
is unvalidated. Ankle vertical excursion mixes body bounce and leg lift. The
18° cap is a filter constraint, not measured mocap accuracy.

Visual observations: 003 keeps the overhead-hand gesture without an observed
shoulder explosion at inspected poses. 004 keeps leg lift but has contact and
torso/hand alignment mismatch. 005 still misses source hand placement. 008 gets
closer to a deep kneel but foot pivot, lunge shape and hand depth remain imperfect.
There is no claim that V2.1 resolves all V2 defects. Full heel/toe contact release,
foot locking and angular continuity require further work.

## Finish root cause and result

The actual RTMW → temporal MotionBERT/reprojection → V2.1 target-owned IK bake
was preserved in the checkpoint and resumed for real-mesh QA after workspace
loss. No new proxy motion or Normal clip was substituted.

Low-confidence body observations: **58.76%**. Estimated pelvis lateral span:
**2.310 m** under the solver's assumed scale. Tracking loses the first NPC during
overlap / floor work. Inverted-frame detector reports zero despite clear inversion
in the source: this is failed observation, not evidence that the motion is upright.

Both target rigs produce diagnostic animation, but upright / feet-supported IK
cannot represent the hand-supported inverted motion. The render shows a leaning
or kneeling body instead of the source inversion, and parts of the lower body
intersect the ground. The sole-only correction cannot fix knee/body collisions.
This is **FAIL**, not a usable Finish animation. Structural validity cannot override
that failure. Actual baked root X spans are 2.115 m (Nam) and 2.011 m (Nu).
Sampled whole-mesh minimum Y is −0.721 m / −0.677 m despite shoe minimum +2 mm.
Both exported Finish clips are 8.466667 seconds at 30 Hz, with 255 keys including
the final boundary hold. Their GLBs pass structural checks; angular max/p99
remain approximately 18°/frame and are warnings.

The minimum next substitution is reliable floor/inversion tracking
plus a pelvis-orientation and hand/knee/foot multi-contact solve; retain the
ingest, job UI, boundary review, append-only writer and QA packaging.

## Validation and scope

- TypeScript typecheck, scoped ESLint, application production build: PASS.
- Seven original pipeline tests + 12 job/review tests + three V2.1 tests: 22 PASS.
- Real Next / Python HTTP integration: 28 checks PASS. Actual Moonlight upload,
  frame-based analysis, lanes, selection, subprocess extraction, both GLBs,
  metadata, videos, Range downloads, and failure/retry paths were exercised.
- The HTTP extraction deliberately used exact verified V2 cache; it is labelled
  V2 and is not evidence of a fresh V2.1 inference through the page.
- Finish backend processing is actual source-derived RTMW/MotionBERT data and
  independent male/female bakes, followed by full real-mesh visual QA.
- GLB preservation/skin/bind/channel/time/finite/quaternion/scale checks and
  angular/root measurements cover both normal and Finish outputs.
- Normal shoe metrics inspect original Foot/Toe-influenced vertices on every
  production frame. Video decode and final ZIP integrity are separately checked.
- **E2E_BROWSER_NOT_RUN_ENVIRONMENT_BLOCKED**. No browser E2E PASS is claimed.
  Browser taps, DOM state, mobile layout and iPhone playback/downloads remain risks.

The Work scratch filesystem was lost during continuations. Existing edits were
restored from the saved Git tree; real targets and bakes were restored from the
verified artifact checkpoint. No working-tree reset or history rewrite was used.
Generated large binaries remain outside Git.

Remaining infrastructure: independently hosted Python worker, persistent artifact
storage, hosting upload/download limits, retention and operational supervision.
The page alone is not an installed cloud mocap service. See
`ASTRA_MOTION_V21_TOOL.md` for API, setup and replay commands.
