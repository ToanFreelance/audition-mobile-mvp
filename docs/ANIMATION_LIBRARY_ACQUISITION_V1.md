# Animation Library Acquisition V1 — source candidate pool

Owner decision: eight accepted Moonlight Normal motions remain frozen. The
rejected Mixamo Finish composite is not revisited. No DeepMotion, Astra V2.2,
gameplay changes, Meshy rebake or runtime integration in this task.

## Scope

Acquire real source motion, measure it, preserve provenance and provide a
reviewable package. These are recorded source takes, not accepted gameplay
clips and not necessarily different choreography. No runtime slots assigned.

## Acquired source

CMU motion capture, cgspeed MotionBuilder-friendly BVH conversion, distributed
by `una-dinosauria/cmu-mocap`. Immutable source tree:
`09a07f54f3bbb58797325f009282d0b2048a2871`.

The selection is derived from the source motion-description index: modern
dance/ballet, salsa, Charleston/Lindy, Indian dance, novelty/freestyle, and
break/floor sequences. Calibration/ROM, known pose-only takes and mixed
household sequences are excluded. Indian takes with `Unknown` descriptions
are marked as inferred from subject context, not verified choreography.
Check the delivered catalog for successful count, errors and measured ranges.

Actual first batch: 112 downloaded takes, 107 byte-unique takes after five
Charleston duplicate pairs. 107 unique contact sheets and 17 featured videos
were generated. All 112 source files passed parsing/finite-data checks; raw
durations range from 3.342 to 43.925 seconds. All use 31 animated joints.
Four parser/selection tests passed. Full source downloads remain unchanged.

The full raw BVHs are unchanged. The first sample is a converter-added
reference T-pose, not production choreography. Future trimming must omit it.
BVH header sample rates, frame count, finite channel data, full FK hierarchy,
root travel in raw source units, angular-step warnings and SHA-256 are measured.
All raw files must match Git blob hashes from the pinned source tree.

The converter's bundled `READMEFIRST.txt` documents unrestricted use of its
conversion and reproduces CMU permission for research/commercial projects.
The original CMU site returned errors during this pass, so this is preserved
converter-distributed evidence, not a new legal clearance. Keep the complete
notice and credit CMU/NSF EIA-0196217. Do not confuse a mirror code license
with motion-data rights.

## Other sources evaluated — not silently bundled

| Source | Evidence URL | Disposition |
| --- | --- | --- |
| Mixamo | https://helpx.adobe.com/creative-cloud/faq/mixamo-faq.html | Adobe ID required; commercial project use documented. No account download attempted in this pass. Not acquired. |
| Rokoko club pack | https://www.rokoko.com/resources/club-motion-asset-pack | Commercial project use stated; download form asks personal details and marketing consent. Not submitted or bypassed; not acquired. |
| Motorica Dance | https://github.com/orangeduck/motorica-retarget/blob/main/LICENSE.txt | Research use only without written commercial permission; no unauthorised redistribution. Excluded. |
| DanceDB | https://dancedb.cs.ucy.ac.cy/main/performances | Commercial use requires licensing discussion; site retrieval unreliable. Excluded pending permission. |
| NUS/SFU dance | https://mocap.cs.sfu.ca/nusmocap.html | Real dance downloads listed, but commercial/redistribution terms not established on retrieved page. Not acquired. |
| ACCAD/OSU | https://accad.osu.edu/research/motion-lab/mocap-system-and-data | CC BY 3.0 page; dedicated dance samples listed mainly as marker data rather than ready dance BVH. Follow-up candidate; not acquired. |
| MocapFlow GitHub | https://github.com/mocapflow/Free-Mocap-Library-FBX-GLB | Repository contains marketing/index/license, not motion files; external ad-unlock workflow not operated. Not acquired. |

No commercial purchases, new accounts, credential extraction, consent
submission or bypass of any access gate were performed. No proprietary
Audition installation data was ripped.

## Review and limitations

Source previews use the original BVH channel order and forward kinematics.
They show skeletons, not fabricated choreography or already-retargeted Meshy
characters. Raw source units are explicitly unverified; camera framing does
not imply metric body calibration. Videos sample the source timeline at 30 fps
and may show only the first 20 seconds; full raw takes remain intact. Contact
sheets sample the full motion range. Preview resampling does not alter BVHs.

No claim of all-take visual acceptance: skeleton preview review is partial.
Some salsa/Lindy takes need a partner; novelty takes are not modern dance.
Repeated takes and paired recordings are not automatically new choreography.
Finger motion is not captured, conversion T-pose is approximate, shoulders
require target-specific calibration, and floor moves require support-aware
retargeting. Large source angular steps are warnings, not hidden by smoothing.
The quality audit reports body-only angular steps separately from ignored
finger/thumb channels. Its max <=45 degrees and p99 <=10 degree heuristic only
prioritises visual review; it does not award quality acceptance. Contact sheets
05_02, 60_01 and 85_08 were inspected, not all 107 takes or textured targets.

Next asset phase requires source selection, phrase-boundary review, independent
male/female target-aware retarget/bake and textured character visual QA. That
phase is not executed here. Structural source PASS is not Meshy visual PASS.

## Deliverable and reproduction

ZIP includes unchanged BVHs, catalog JSON/CSV, licenses/provenance, per-take
contact sheets, featured MP4s, standalone review index and acquisition scripts.
Large source/preview binaries stay outside Git.

```sh
python scripts/animation-library/acquire.py --out ARTIFACT_DIR
python scripts/animation-library/preview.py --out ARTIFACT_DIR
python scripts/animation-library/quality_audit.py --out ARTIFACT_DIR
python -m unittest discover -s scripts/animation-library -p 'test_*.py'
python scripts/animation-library/package.py --out ARTIFACT_DIR --tree CMU_TREE_JSON --repo REPOSITORY_DIR
```

Requires NumPy, SciPy, Pillow and ffmpeg. Fetch source-tree JSON using GitHub's
Git Trees API for the immutable tree above. No heavy mocap backend or Blender
is required for acquisition-only source previews.
