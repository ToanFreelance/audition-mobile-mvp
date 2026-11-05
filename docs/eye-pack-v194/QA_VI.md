# Eye Asset Pack V1.9.4 — True Eye-Region Reconstruction, Natural / Doll

**STATUS: REAL GLB GENERATED + TECHNICAL QA PARTIAL PASS; VISUAL QA FAIL / OWNER NOT ACCEPTED.**

## Context and root cause
V1.9.3 authored 108 real mascara / eyeliner / lid shade meshes but preserved the original face / lid / ocular region. The owner rejected V1.9.3 physical iPhone previews because the eye-region anatomy diverged sharply from the nine-look concept (irregular aperture, protruding/overstaring eyes, harsh sockets and disconnected lashes).

## Implementation and isolated candidate
- Source: exact V1.9.3 GLB SHA-256 `a80088aed5356e2b1b7344f347d77e9c240fdd1ae0755c3771b9de12d31869e4`, 51,733,472 bytes, retrieved via CloudFront in GitHub Actions.
- Candidate output: `eye_v194_candidate.glb`, SHA-256 **`dc8329040f2f1a647a7b2c3834d87495dd3c76ab368825f292a9f5fa98bdf684`**, **54,171,596 bytes**.
- GitHub Actions run and downloadable QA artifact (source, candidate, validator JSON, Blender evidence): https://github.com/ToanFreelance/audition-mobile-mvp/actions/runs/41381984059
- Script: `scripts/eye-pack-v194/reconstruct_eye_region.py`, deterministic generator with strict source SHA gate. Concept-digitized Natural/Doll landmarks guide the aperture; transforms the **complete local lid patch** (rather than only liner), smooths near-eye Z transition, reconstructs the textured **22-ring ocular cap** geometry, recomputes normals and Blink / BlinkArc morph targets, and retargets six V1.9.3 cosmetic components per eye across all poses. Four eye regions total (L/R Natural, L/R Doll).
- `scripts/eye-pack-v194/test_synthetic.py`: topology / morph smoke test.
- `scripts/eye-pack-v194/render_anchor_qa.py`: Blender 4.0.2 Cycles CPU re-import renders for Natural/Doll with open/closed, three-quarter and full-face variants at matching per-look cameras.
- `.github/workflows/eye-pack-v194.yml`: **isolated** real-asset QA and artifacts only. It **does not publish** to Vercel or change the runtime asset URL.
- Original 14 GLB embedded images SHA-256 unchanged; all 7 other EyeSet geometry POSITION arrays unchanged; skin collar seam vertices preserved exactly. No production Character Catalog / gameplay changes.

## Validation actually performed
| Gate | Outcome | Evidence |
| --- | --- | --- |
| Python compile / synthetic mesh | PASS | GitHub Actions |
| V1.9.3 source SHA integrity | PASS | SHA-256 check |
| Deterministic real GLB export | PASS | Reproduced byte-identical candidate locally |
| Khronos glTF Validator | **0 errors; 24 warnings** | Both source and candidate; warnings are not visual acceptance |
| Blender 4.0.2 GLB re-import + Cycles CPU | PASS (technical render execution) | 16 PNG renders: Natural/Doll × V1.9.3/V1.9.4 × 4 views/poses |
| Local skin-patch outer seam | PASS | Maximum displacement 0 at stationary collar |
| Eye/rim boundary | **NEEDS FIX** | Max XY mismatch ~0.000518 model units Natural; ~0.000718 Doll |
| Topology / normals | **NEEDS REVIEW** | Local triangle normal reversals remain at contour transitions; no visual acceptance |
| Concept visual fidelity | **FAIL** | QA reviewer inspected actual Blender output: Natural less wide-eyed but too hooded / lashes fragmented; Doll too narrow instead of cute and round; eyeliner and eyelashes disconnected; iris region exhibits visibly dirty arc/ring artifacts; socket shadow remains harsh |
| Blink visual | **FAIL** | On full closure, residual fragmented lashes / eyeliner / ocular material visibly persist; not clean |
| Chromium WebGL2 / Three.js | NOT RUN | Deliberately not promoted after failing Blender visual gate |
| Physical iPhone | NOT RUN | Not appropriate until candidate reaches Blender visual acceptance |

## Before / after interpretation
- **Natural:** aperture visibly changes, but the result still does not match the soft, rounded approved reference. Upper lash/liner geometry remains jagged and partly detached; lower lid lacks the reference's continuous clean silhouette.
- **Doll:** opening becomes less round, losing the intended appealing large iris and soft eyelid geometry. Obvious inherited iris texture defects remain.
- **Full blink:** some source cosmetic components and ocular tint show behind eyelid path; not a seamless complete closure.
- **Not a renderer-only excuse:** same Blender camera / lighting with source and candidate reveals poor shape quality on both, meaning the reconstruction algorithm has not adequately authored cohesive art-quality geometry and material transitions.

## Decision / integration gate
**REJECT THIS CANDIDATE for Preview and production.** The current app runtime must continue to use its V1.9.3 GLB. Do **NOT** update `EyeSetCatalog.ts`, source URL/cache key, Vercel Preview, any production Character Catalog entry, multiplayer or gameplay. PR #24 stays Draft / unmerged.

Next repair requires a genuinely coherent upper/lower eyelid **surface + lashes + socket + iris material** rebuild (not another aperture parameter edit): remove inherited painted rings/eyeliner overlap, re-root all fan lashes to the rebuilt lid, enforce perfect eyelid-ocular contact for open/half/closed poses, and inspect Blender images before WebGL2/iPhone QA. No expansion to the other seven eye sets until Natural and Doll pass owner comparison.
