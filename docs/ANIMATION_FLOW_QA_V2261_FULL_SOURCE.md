# Animation Flow V2.2.6.1 — Full BVH Source Playback Fix

Owner iPhone feedback (20 Oct 2026): all six candidates play briefly then freeze, not complete animation. This is a QA Preview defect, not evidence the source BVHs are bad. V2.2.6 uses identical 0.2–3.4s excerpt windows and its one-shot engine clamps at 3.2s.

## Focused correction
- Keep candidate ID/provenance and existing unapproved 0.2–3.4s subclip proposals for metadata compatibility, but do not render those proposals in raw source review.
- In dedicated /tools/animation-flow-qa-v2/catalog, lazy-load COMPLETE pinned BVH using same allowlisted source endpoint.
- Use a separate native Three.js AnimationMixer + SkeletonHelper for full source take, not SourceFlowEngine.preparePhrase or stage 1.35m placement. Original rotations/Y and all frames are retained. Render BVH centimetre-scale at 0.01, follow root XZ to keep wandering subjects in view; do not feed these raw positions back to gameplay.
- Motion clock uses demo AudioContext beat mapping to synthetic assumed 120 BPM reference (duration relative to real time adjusts proportionally with selected BPM). This is a visual tempo experiment, not validated source musical tempo, and never changes production WebAudio.
- Expose actual BVH clip.duration and elapsed/duration progress. At full end clearly show full clip completed, suspend clock and offer replay. Never fake seamless floor/acrobatic loop.
- Feedback stays session-local/exportable JSON, include raw full source duration. Only fetch selected source, preserve Gameplay/Flare/styles/RoomState/gauge/Character Catalog.

## Validation and known risks
- Verify commit-matched TypeScript + Next.js Vercel build. Add e2e/animation-flow-v2261-full-source.spec.ts; run only if runtime available and report honestly.
- Owner iPhone: review full 85_01 and 85_12 source; verify progress and whether physical source itself pauses. Long originals can include idle and acrobatics that will need trim for final gameplay. Full native source preview is not accepted gameplay phrase, root-bound fit, retargeted character mesh or commercial-use rights approval.
- No changes to production WebAudio, global 4 beat turns, HIDDEN/REST, Finish Flare, performance gauge, RoomState/Supabase.
- Work branch only: work/animation-flow-qa-v2, PR #19 Draft, never merge without owner approval.