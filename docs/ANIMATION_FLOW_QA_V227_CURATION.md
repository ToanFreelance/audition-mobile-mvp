# Animation Flow V2.2.7 — Owner-directed motion curation intake

Branch: work/animation-flow-qa-v2; PR #19 Draft; baseline HEAD dac0571c8c2141abe87f9a3e7b38d5d90ed23aeb.

## New owner decisions (20 Oct 2026)
- 85_04 Fancy Footwork: retain as **Finish candidate**. This is a selected *creative direction*, not a command to overwrite accepted/default Flare, bypass the REST budget, or mark the exact full motion cut approved.
- 85_12 Long Break Sequence: split into **multiple ordinary dance candidates**.
- 85_14 Break Sequence with Flips: try multiple dance candidates **only where safe**; protect floor/inversion and reject unsuitable sections.
- 90_28 Breakdance: retain as **dance candidate**. As a floor source, keep protected exits until a reliable upright transition is demonstrated; do not assume SPACE can interrupt it arbitrarily.
- 85_01 and 85_02: unchanged, pending owner review.

## Implemented curation staging, not gameplay promotion

New isolated module `lib/animation-flow-v2/clip-curation.ts` maps the four source IDs to owner intention / category / caveats. No source is added to `NORMAL_PHRASES`, `FINISH_PHRASES`, `SessionChoreography` or published character assets. Flare remains unchanged.

Dance Catalog route continues to load **whole pinned original BVHs** and display them in the readable 3D bone/joint renderer. After source load, it samples 8 representative animated skeleton joints about every 0.15 source seconds and derives a normalized motion-energy curve plus crude head-over-hip upright classification. For 85_12, choose four draft segments; for 85_14, three; for 85_04 and 90_28, one whole-source draft each. Internal division boundaries are set around low-energy upright neighborhoods near equally spaced time targets. These are **provisional QA markers only**, never evidence that a body/foot contact, stylistic phrase, safe exit, floor/radius, beat, or quality gate passed.

The owner can edit each segment start/end in seconds, play only that segment, then export curationSegments and notes as JSON. The UI reports all excerpts as `needs-motion-and-contact-review`, and explicitly warns they cannot enter runtime until safe exits and root bounds are established.

## Required follow-up before actual runtime activation

1. Inspect owner-selected ranges for legible motion and actual separate dance vocabulary. Some source fragments may contain inversion: split only at safe grounded poses and/or play as protected one-shot.
2. For 85_04 test Finish entry → source phrase → dismount → living idle against the existing REST budget and BPM 110/120/160/200; keep Flare default unless owner explicitly requests replacement.
3. For 85_12 create true prepared phrases only after adjusted ranges; run placement/facing/entry ΔXZ/contact/8beat continuation tests and anti-repeat coverage.
4. For 85_14/90_28 require named protectedRanges, contact-safe transitions, no mid-flip SPACE cuts, and deliberate treatment for source root travel. If a safe normal transition cannot be found, keep as special/Finish candidate rather than silently violating architecture.
5. Owner iPhone visual acceptance remains primary gate. Raw skeleton fit and source-index name alone cannot prove character mesh retarget or musical tempo.
6. Run new Playwright source-curation test when environment available; Vercel TS/Next build alone is not gameplay motion PASS.

Locked architecture unchanged: WebAudio is authoritative; 4 beats per global turn; HIDDEN/MISS/REST do not create turns; gauge remains locked; Finish is not game end; only AUDIO END ends; RoomState, CAS, Supabase, character assets, stages and main/development not touched. Never merge PR #19 without owner approval.
