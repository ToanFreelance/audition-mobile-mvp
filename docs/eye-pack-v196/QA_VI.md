# Eye Asset Pack V1.9.6 — Concept-aligned full-region prototype

**STATUS: REJECTED — TECHNICAL QA PASS, VISUAL QA FAIL. DO NOT DEPLOY.**

## Art direction
Owner approved the new nine-look Eye Asset Pack illustration on 2026-11-02. The illustration—not any prior V1.9.x GLB—is the source of truth for feminine fashion-rhythm-game eye styling. The first two 3D anchor looks remain Natural (Tự nhiên) and Doll (Búp bê). The seven other sets are deliberately not altered.

## Source and implementation
- Immutable V1.9.3 source GLB SHA-256: `a80088aed5356e2b1b7344f347d77e9c240fdd1ae0755c3771b9de12d31869e4`.
- Candidate exported from GitHub Actions: SHA-256 `f28a2e5f1fda627f3ad9aa3d794ec0ffaa87a3b475e28143a6aca5b81ae623b0`, **57,684,588 bytes**.
- Geometry generator: `scripts/eye-pack-v196/build_v196.py`; source SHA gate and bilateral Natural/Doll rebuild.
- Created 32 new GLB mesh nodes (8 × 2 eyes × 2 looks): static skin patch, socket surface, ocular geometry, eyeliner, lower waterline, crease, eyeliner wing and rooted lash fan.
- Added per-node Blink/BlinkArc POSITION/NORMAL morph targets for the non-static modules. The new ocular textures are original procedural PBR maps; no production Character Catalog registration.
- Removed 40 old Natural/Doll EyeSet nodes from active scene manifests only; old node/mesh data remains available for rollback.
- Preserved 14 source embedded images exactly and left every other EyeSet's POSITION/NORMAL arrays unchanged.
- The exported GLB is not bound to the web runtime; `EyeSetCatalog.ts`, its CDN URL and CacheStorage key remain on V1.9.3.

## QA actually run
GitHub Actions: https://github.com/ToanFreelance/audition-mobile-mvp/actions/runs/41388476861

| Gate | Result |
| --- | --- |
| Exact V1.9.3 source SHA-256 | PASS |
| Python compile / real-GLB reconstruction | PASS |
| Focused geometry regression | PASS |
| Khronos glTF Validator | 0 errors, **28 warnings, 437 infos** (source 0 errors, 24 warnings) |
| Blender GLB re-import and Cycles CPU | PASS, 16 rendered PNG evidence frames (8 before + 8 after) |
| Natural face/eye concept fidelity | **FAIL** |
| Doll face/eye concept fidelity | **FAIL** |
| Seam and eye socket continuity | **FAIL** |
| Open/closed blink visual | **FAIL** |
| Chromium WebGL2 and physical iPhone | NOT RUN — failed earlier art gate |

Blender render quality and artistic acceptance must not be conflated with an executable render, valid glTF, or a successful GitHub Actions job.

## Observed failures and root cause
1. The radial eyelid/socket loft produces a visibly circular patch of folds and shading discontinuities against the unchanged Claude V2 face. Reusing the static original skin triangles does not create a coherent continuous sculpt.
2. Natural and Doll still resemble an oversimplified cartoon face. The iris maps are too flat and do not reproduce the reference's layered optical depth and soft integration behind the upper lid.
3. Eyeliner wing and lash ribbons remain visibly disconnected, spiky, and inconsistent with the accepted feminine silhouette.
4. Closed-eye renders contain fragmented lash/iris elements and a recognizable radial eye-socket crease. The morph is technically present but visually invalid.

**Root cause:** This is not a local contour or material-tuning issue. A low-level procedural annular loft with simple iris maps cannot replace art-directed sculpt/retopology of the whole periorbital region. Attempting another small parameter tweak would repeat the rejected V1.9.3–V1.9.5 failure mode.

## Decision and preserved safety boundaries
- **REJECT V1.9.6 candidate.** Do not wire it into the demo or Vercel Preview.
- PR #24 stays Draft and unmerged. Work only on `work/facial-modular-eye-demo-v1`.
- Keep accepted original 9-look concept and source head unchanged.
- Do not modify gameplay, WebAudio, Supabase, Waiting Room, Character Catalog production or performance architecture.
- Before future deployment: perform actual sculpt/retopology that controls eyelid rim, lacrimal and outer canthus, the surrounding continuous facial skin, iris depth and lashes on both open and closed positions; review Blender reimport front/3/4 and 3 blink states, then Chromium WebGL2, and finally owner iPhone.
- The 7 remaining styles remain out of scope until Natural/Doll achieve convincing art fidelity and the owner approves their appearance.

**Workflow artifacts:** The run above includes source and candidate GLBs, validator JSON, QA diagnostics, and 16 Blender PNG renders. No candidate was published.
