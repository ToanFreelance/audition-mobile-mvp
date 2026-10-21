# Animation Flow V2.2.6.2 — Catalog Full-Source Readability Fix

Repo: ToanFreelance/audition-mobile-mvp | branch work/animation-flow-qa-v2 | PR #19 Draft/unmerged.
Parent: 1c3398ba546fba87490db6ca9b6bf9a51c01d17a (V2.2.6.1).

## Owner iPhone evidence (2026-10-20)

Screenshot of candidate-85-01 shows ~3.7/8.3s playback, but the person is a tiny, thin blue skeleton amid an enormous arena/grid. In V2.2.6 the original 3.2-second review used normal, visible shaded 3D bones/joints. V2.2.6.1 corrected playback duration by using raw Three.js SkeletonHelper but also switched rendering representation to a thin SkeletonHelper at fixed raw-unit .01 scaling with the old stage framing. Duration PASS did not equal visual acceptance.

## Root-cause and focused implementation

- Keep native AnimationMixer for the ENTIRE source BVH, with all captured quaternions, Y movement, floor/crossover/flip frames, and full clip duration. No trim or stage spatial fitting.
- Sample multiple early source poses and measure world-space raw bone vertical span. Compute DISPLAY-ONLY scale = clamp(1.7m / tallest observed span, 0.002, 0.2); calibrate initial source floor offset. This is not exported to source motion or production gameplay.
- Render the original animated BVH skeleton with the SAME visible shaded 3D InstancedMesh bone cylinders and joint spheres used by the old short-clip QA viewer. Relative bone world positions are centered around the animated root XZ and normalized with computed review scale. Retain original source Y displacements/jumps.
- Dedicated Catalog camera at (0,1.45,4.25) viewing around 0.85m center with 34° vertical FOV, source actor approximately 1.7m tall. Allow user OrbitControls. Original Gameplay QA camera/controls unchanged.
- Hide large gameplay ring, floor and grid ONLY on catalog route, eliminating framing dominance and misleading stage-radius evaluation.
- Instrument the review stage DOM with `data-review-bone-count`, `data-review-visible-height-meters` and display scale for focused browser validation. All source-playback timing/progress/replay stays unchanged.
- Report accurate review status: full raw file is shown in display-only normalized rig, not placed in a 1.35m stage and not published or retargeted production mesh.

## Validation

- Vercel Next.js/TypeScript build and commit-matched Preview. Add assertions to focused full-source Playwright spec: actual duration >3.2s; bone count >20; effective display height 1.35–1.95m. Assert only when browser test is actually run; adding spec is not a PASS.
- Owner iPhone visual remains authority: first test candidate-85-01, then 85_04 or 85_12. Confirm source actor occupies ~50–65% of canvas height in standing sequence without giant arena; full take (8.3s for 85_01) remains playable.
- Review camera/static display scale is a visual presentation tool; animation may include genuine long standing pauses, source travel, flipping or bad mocap. No claim all six candidates approved.

No changes to WebAudio gameplay clock, 4beats/global turn, SPACE, HIDDEN, Finish/Flare, gauge, RoomState, Supabase, Character Catalog, or the 11 modern Gameplay phrases. PR remains Draft; no merge.