# Female Origin Eye Asset Pack V5.1 — Iris Regression Fix
Status: Experimental QA only — owner iPhone visual acceptance PENDING.

## Owner report
On 2026-11-07 all nine V5 styles appeared visually broken: newly colored / overpainted central discs with the old purple iris still visible at the outer ring, inconsistent pupil shapes, unwanted highlight stacking. The V5 screenshots confirm this.

## Verified root cause
In `eye-iris-concept-v5.js` the synthetic repaint mask `irisBoundary=1-smoothstep(.88,1.10,r)` uses `r=length((ax-.116)/.033,(-.508-z)/.036)`, which is much smaller than the true original iris in the source GLB. At local x offset +.042 and z=-.508: V5 irisBoundary=0 (unpainted purple); the previously iPhone-tested V4 region mask is still 1. This is why the iris is split into a bright artificial center and an untouched purple ring. V5 also paints a *second* coreCoverage/pupil over the original 3D eye texture, causing overlapping pupil and highlights.

## Minimal corrective implementation
New route: `/qa/female-origin-eye-concept-v51/index.html`, with `eye-iris-concept-v51.js`. The V5 route remains unchanged for A/B regression inspection. The new route still uses the V5 eight distinct eyelid/brow morphs by importing the existing module (not copying or altering it); Character Catalog/gameplay unchanged.
- Restore the proven V4 eyeRegion + original source violet pigment coverage, including original dark iris rim. Restored V4 full-iris hue transformation has no artificial circular boundary.
- Remove all independent generated discs, synthetic pupilInk and glint painting. Preserve the original iris texture, pupil, and authored highlights (including white glints) instead of layering new circles.
- Keep restrained style-specific saturation, value, radial-fiber/rim variation **only inside original pigment coverage** to distinguish the nine looks without damaging the base eye.
- Star and Heart motifs re-use the approved V4 pupil-centered origin, scale and gate; should not duplicate highlights.
- No Strength slider. Source `Female_anime_origin.glb` remains selected from local iPhone Files, never uploaded or modified. No new large binary download.

## Mathematical checks (not a visual acceptance)
At vEyeLocal.y=.23 and z=-.508, for |x|-.116 in [0,.015,.025,.035,.042,.050]:
V5 old boundary = [1,1,1,.085,0,0].
V4/V5.1 restored eyeRegion = [1,1,1,1,1,1].
New shader has no `irisBoundary`, `coreCoverage`, `irisSize`, or `pupilInk` paths. Shader braces and Javascript syntax validated; eight morph targets remain the same V5 library. This proves coverage correction in the affected range but **does not prove** no texture seams, projection artifacts, correct hue masking everywhere or iPhone WebGL quality.

## Tradeoff and acceptance
V5.1 intentionally prioritizes a correct, single integrated iris surface over unsupported synthetic reshaping of the pupil. Different physical pupil geometry/shapes and fully replaceable iris assets remain **unimplemented** and require separately authored UV/iris geometry or texture masks and 3D rigging. Do NOT claim full Golden Eye Pack fidelity on this patch. After owner iPhone QA confirms the purple rim is gone, proceed to topology-aware authoring for full iris morphology. V5.1 is NOT approved for runtime, main or development. No merge.
