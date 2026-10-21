# Animation Flow V2.2.8.1 — 90-glide Travel Accent Isolation

Owner iPhone feedback (2026-10-21): `90-glide` briefly walks backward, then stands idle instead of performing a proper Street/Pop choreography.

Repository: ToanFreelance/audition-mobile-mvp
Branch: work/animation-flow-qa-v2, PR #19 Draft
Baseline HEAD: 31f533e443a51dccd4fc763375b72bd9cfa8ed0d

## Verified root cause
- `90-glide` duplicates the Moonwalk source `90_32`, trimmed to source 3.0–4.2 seconds: 1.2s ≈ 2.4 beats at authored 120 reference BPM, shorter than a 4-beat global turn.
- Unlike source `90-moonwalk`, the duplicate was misdeclared as `role: "core"`. This allowed SessionChoreography's Street style and HIDDEN continuation shuffle to select it as a complete dance.
- At clip end, V2.2.3's accepted living-idle presentation begins; this is the behavior the owner observed.

## Narrow correction
- Keep `NORMAL_PHRASES` at 16 to avoid deleting the source or breaking existing stand-alone Lab preview. Set `90-glide.role = "travel"` (matching the original `MOONWALK_PHRASE`) and label the short excerpt for Lab explicitly.
- Add `isPlayableModernPhrase`: only a `core` motion classified `street` or `pop` may enter the default game choreography pool. The same predicate applies both when choosing a SPACE phrase and when scheduling a same-style HIDDEN bridge. Thus no random `90-glide` selection, including fallback tiers.
- Retain manual Moonwalk via Free Animation Lab (the `90-moonwalk` fixture and the `90-glide` entry in the source preview picker).
- The full source remains available for future design; do not artificially time-stretch 1.2s of moonwalk into a complete 4/8-beat dance.
- Default modern dance pool becomes 10 (Street 5, Pop 5) from 11; non-default/QA pool becomes 6. The opt-in V2.2.8 breakdance intake is unchanged and still guarded.

## Regression
- Updated V2.2.5 and V2.2.6 pool tests assert 16 source entries still exist, 10 default, 6 excluded, and 90-glide stays Lab-only.
- Updated SPACE and HIDDEN continuous-motion tests explicitly disallow `90-glide` in transition history / dance bridges.
- Validate all previously accepted BPM/fade modes (110,120,160,200 × .15,.35,1), Finish/REST, root bounds and Flare with tests **actually executed**; a Vercel TypeScript/Next.js build does not prove on-device motion pass.

No changes to WebAudio, 4 beat global turns, level sequence counts, gauge, RoomState, CAS/Supabase, character rig, scheduler, Finish Flare or production gameplay. Keep PR #19 Draft; do not merge.
