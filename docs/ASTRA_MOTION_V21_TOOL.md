# Astra Motion V2.1 — offline owner tool

Implementation continues `work/character-rig-animation-v1` from
`1232c4fd7636ae21aab2dbcd81ec93aa257211f0`. No gameplay integration.

## Page and job boundary

`/tools/motion-extractor` is an internal, opt-in Next page. The browser uploads,
reviews candidates, polls a job, previews real QA videos and downloads files.
RTMW, MotionBERT, IK and Blender run only in Python. The Python HTTP contract is
independent of Next, so the worker can move to another host without changing
the page. This is a single-operator worker, not a multi-tenant service.

The page is disabled unless `MOTION_TOOL_ENABLED=1` and an owner key of at least
16 characters is configured. The owner signs in through the page; the key is
exchanged for an 8-hour HttpOnly, SameSite Strict HMAC session. Every API request
checks authorization; writes check Origin. The separate worker credential is
server-only. No app-wide authentication or multiplayer state was changed.

| Next API under `/api/motion-extraction` | Worker endpoint | Contract |
| --- | --- | --- |
| `POST /session` | none | `{token}` → owner cookie |
| `GET /session` | none | enabled / authorized |
| `GET /health` | `/health` | authenticated worker health |
| `POST /jobs` | `/jobs` | raw MP4/MOV, `X-Filename`, Content-Length |
| `GET /jobs/:id` | same | versioned state / progress / results |
| `POST /jobs/:id/analyze` | same | asynchronous frame analysis |
| `POST /jobs/:id/review` | same | `{motions:[...]}`; all candidates reviewed |
| `POST /jobs/:id/extract` | same | `{mode: "pipeline" | "verified-cache"}` |
| `GET /jobs/:id/files/:artifactId` | same | allowlisted file, HTTP Range supported |

`schemaVersion: 1`; states: uploaded → analyzing → review → extracting →
completed, or failed. Jobs use atomic JSON updates on worker disk, one processing
thread and a bounded queue. Each extraction retry has an isolated attempt
directory. Worker restart marks interrupted jobs failed. Extraction subprocesses
use the worker Python environment; timeout kills their process group.

Motion metadata separates `sourceMotionId`, `type`, `variantId`, `sourceRange`,
boundary/tracking confidence and `qaStatus`. Types are normal / finish / unknown;
reject is a review decision. No mapping to dance-01…08 or gameplay slots exists.
Result labels are candidate status only; `visualAccepted` and
`productionAccepted` never become true automatically.

## Generic analysis and review

ffprobe/ffmpeg verify decode and record original dimensions, fps and duration.
Limits: 256 MB upload, 120 seconds, 4096 maximum source dimension, 120 source fps.
Analysis uses a canonical 480×360, 30 Hz timeline. Non-4:3 input is currently
resized to that frame; this can distort proportions and needs separate QA.
Source seconds are preserved; no runtime beat duration is imposed.

Repeated aligned command circles locate the HUD row from the video. Observed
row disappearance proposes boundaries; no Moonlight frame numbers, crop or BPM
is used in the generic detector. YOLOX HumanArt across five initial frames finds
lanes; RTMW gives initial tracking confidence. This is a heuristic, not calibrated
probability or a guarantee of actor identity. The strongest initial lane may
be the wrong character; owner lane review is mandatory.

Optional Tesseract scans three frames after each onset for a Finish banner.
An OCR hit proposes Finish but leaves classification unknown. On the verified
Finish source, stylized text was not recognized: `finishOcrFrames=[]`.
The visible FINISH banner and both judgements were reviewed separately.
No events / no lanes must not turn into invented motion. Frame-0 and EOF
intervals are incomplete. Edited boundaries require evidence; included unknown,
unreviewed, overlapping or incomplete motions are rejected by the worker.

## Extraction and V2.1 changes

The adapter reuses V2 RTMW whole-body, MotionBERT flip ensemble/reprojection,
target-owned two-bone IK, append-only GLB, real-mesh Cycles rendering and structural
QA. Male 28-joint and female 66-joint Meshy rigs are solved independently. Original
meshes, weights, UVs, materials, images, inverse binds and existing animations
remain byte-for-byte in the original GLB data prefix.

- Head optical flow bounds the person crop; large identity jumps lower confidence.
- MotionBERT windows overlap with temporal blending; low-confidence long gaps
  use bounded interpolation, retaining their low confidence.
- V2.1 target refinement weights observed XY strongly, regularizes depth
  acceleration and limb lengths, and retains raw confidence.
- IK uses each target bind plane transported to its current limb direction.
  Deeper leg flexion (170° maximum) and image-supported knee lowering improve
  kneeling. Direction/rotation smoothing is reduced to retain lift and accents.
- Original Foot/Toe-weighted vertices determine ankle clearance and a final
  whole-shoe root correction to +2 mm. This is not whole-body collision handling
  or a validated heel/toe pivot/contact classifier.
- The 18°/frame continuity cap remains. It limits extremes but can alter contact;
  improved smoothness or fidelity must be measured, not assumed.

`--v21` is opt-in on `moonlight_bake.py` / `solve_target.py`; V2 defaults remain.
`refine_v21.py` accepts saved targets. `compare_v21.py` measures before/after with
a fixed V2 contact mask and builds real-render contact sheets.

`verified-cache` is explicit, never an automatic dependency-failure fallback.
It requires exact source SHA, frame range, lane, original rig data and hashes of
each reused artifact. It is labelled V2, not a fresh V2.1 solve. Finish cannot use
Normal cache. This mode validated the page without repeating eight inferences.

`resume_motion_qa.py` resumes saved real bakes after transient workspace loss.
It verifies source SHA, GLB structure, original rig preservation, clip set and
source ranges, then renders and packages. It does not fabricate missing frames
or rerun/rewrite the mocap pipeline. Render directories themselves are bound to
the GLB hash, Blender version and render settings.

## Worker setup

Install `requirements-v21.txt`, ffmpeg/ffprobe, Blender 4.5.3 LTS, and CPU Torch
2.6.0. Optional Tesseract enables banner hints. Use the same RTMW and HumanArt
ONNX models as V2. MotionBERT repository revision:
`705d3a95354db8bdb696b3492e47a3b5537174ff`.
The lite checkpoint SHA-256 is enforced:
`9811155371db4ca5d20f31a36a232d41012e12e1333882888a564d741861148f`.

Required settings (secrets must stay outside Git):

| Process | Settings |
| --- | --- |
| Next | `MOTION_TOOL_ENABLED`, `MOTION_TOOL_TOKEN`, `MOTION_WORKER_URL`, `MOTION_WORKER_TOKEN`; optional `MOTION_TOOL_ORIGIN` |
| Python | `MOTION_WORKER_TOKEN`, `MOTION_JOB_ROOT`, `MOTION_MALE_RIG`, `MOTION_FEMALE_RIG`, `MOTION_DETECTOR`, `MOTION_POSE_MODEL`, `MOTIONBERT_REPO`, `MOTIONBERT_CHECKPOINT`, `MOTION_BLENDER` |
| Verified V2 reuse | `MOTION_VERIFIED_CACHE` points to intact V2 artifact package |

Run the worker with `python scripts/astra-motion-poc/motion_jobs.py --port 8765`.
It binds localhost by default; deploy behind a private authenticated reverse
proxy for a separate host. Run Next with `npm run dev -- -H 127.0.0.1` locally.
Expose only the Next page to the owner; keep worker and artifact storage private.

The local adapter has no object-store upload, shared durable queue, per-user
quotas, automatic retention or extraction cancellation. Hosting large relay
uploads/downloads and a persistent CPU worker needs independent deployment
validation. A Vercel page deployment alone does not provision these services.

## Validation commands

```sh
npm run typecheck
npm run lint:motion
npm run build
python -m unittest discover -s scripts/astra-motion-poc -p 'test_*.py'
python scripts/astra-motion-poc/test_motion_http.py --source SOURCE_A.mp4 --out HTTP_REPORT_DIR
python scripts/astra-motion-poc/resume_motion_qa.py --out FINISH_ARTIFACTS --source FINISH_SOURCE.mp4
python scripts/astra-motion-poc/compare_v21.py --before V2_ARTIFACTS --after V21_ARTIFACTS
```

HTTP harness starts Next and Python in the same process namespace, uploads the
real video, analyzes it, selects 003, extracts verified V2 assets, checks result
schema/downloads and exercises errors. This is not browser UI automation.

Browser status: **E2E_BROWSER_NOT_RUN_ENVIRONMENT_BLOCKED**. Work browser/dev
server permission could not be controlled by the owner; no permission request
is required to continue implementation. DOM interaction, mobile layout, taps,
iPhone video playback and browser downloads remain unverified.

Finish remains a Level 9 special command, never game-end. No global turns or
level duration are changed. Only AUDIO END ends gameplay.
