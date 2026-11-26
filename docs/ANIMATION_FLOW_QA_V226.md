# Animation Flow V2.2.6 — Modern Dance Candidate Intake & Owner Review

Repository: ToanFreelance/audition-mobile-mvp
Branch: work/animation-flow-qa-v2 | PR #19 Draft | Baseline: 97838bf9dcd2f0511b72e2fce55aa06cbf68ea16

## Objective and truthful scope

The owner wants substantially more Street/Hip-hop/Pop dance vocabulary. V2.2.5 owner-tested style coherence is provisionally acceptable, Finish and 8-beat motion already look better. V2.2.6 begins **real source auditioning**; it does not falsely claim 20–25 production-qualified choreography clips.

The CMU Graphics Lab official index and pinned GitHub mirror were checked for the six trial IDs below. Paths exist in pinned mirror revision `SOURCE_PIN = 09a07f54f3bbb58797325f009282d0b2048a2871`. Source descriptions are metadata, not verified visual qualities.

## Six quarantined BVH source candidates

| ID | CMU subject / label | Sample | Intake assessment |
|---|---|---|---|
| 85_01 | JumpTwist | 0.2–3.4 sec | possible Street jump accent; inspect feet/landing |
| 85_02 | JumpTwist | 0.2–3.4 sec | variant; check whether genuinely distinct |
| 85_04 | FancyFootWork | 0.2–3.4 sec | promising standing footwork; verify actual dance segment |
| 85_12 | LongSequenceGood | 0.2–3.4 sec | long-form break sequence: needs segmentation/trim |
| 85_14 | BreakSequencewithFlips | 0.2–3.4 sec | ACROBATIC fixture only, not ordinary SPACE |
| 90_28 | breakdance | 0.2–3.4 sec | floor/special fixture only, not ordinary SPACE |

**Critical:** each 0.2–3.4s portion is an arbitrary FIRST SURVEY EXCERPT, not vetted timing, complete 4/8-beat musical phrase, safe loop, or non-sliding choreography. CMU source frame rate is 120 fps for known shorter files. The two files larger than the connector's trimmed-line response limit were verified through pinned directory metadata; their interior motion is unreviewed.

## Engineering isolation

- `DANCE_REVIEW_CANDIDATES` lives in QA catalog, separate from `NORMAL_PHRASES`, `MODERN_GAMEPLAY_PHRASES`, `FINISH_PHRASES` and `REST_PHRASES`.
- API allowlist `SOURCE_IDS` includes new source IDs. Source-serving endpoint still enforces exact ID allowlist, source pin, timeouts and same origin.
- `/tools/animation-flow-qa-v2/catalog` is a dedicated owner catalog-review page reusing the canonical skeleton viewer; candidate BVH is fetched **only on Play**, not through default preloading. Existing Gameplay QA route and Flare engine are untouched.
- Reviewer can select source, play/pause/replay, change BPM and record Keep Candidate / Re-trim / Reject plus notes, and export JSON. Feedback lives ONLY in React state/ref, disappears on page reload; neither ratings nor clips are committed to production.
- Review is on CMU skeleton; not an accepted female/male mesh or iPhone WebGL visual QA PASS. A rejected stage root/facing placement should be explicitly reported, not bypassed by teleport.

## Subsequent production curation gate

1. Owner reviews videos/clip candidates; send exported review JSON and select candidates that are truly Street/Hip-hop/Pop.
2. Create proper subclips with verified full motion/entry/dismount/beat alignment and non-sliding foot contact.
3. Run retarget/pose/seam/root bound validation, 110/120/160/200 BPM and sparse RAF, compare 4/8 beat transitions.
4. Only then promote clearly accepted candidates into DEFAULT modern style pool. No force-promotion of floor flips into ordinary choreography, no accidental 8-beat extensions or special Finish changes.
5. Target around 20–25 distinctive modern clips gradually, not 20 arbitrary IDs.

## Validation and architecture

Static tests cover candidate-source metadata, exclusion from the 16 normal / 11 modern pools, full pinned-source allowlist and protected floor fixtures. They require execution, and Vercel TypeScript/Next.js build is not a Playwright pass. No change to shared WebAudio authoritative clock, 4-beat turns, hidden/REST budget, gauge, Finish (only AUDIO END ends game), RoomState, Supabase CAS, Character Catalog, published meshes or gameplay timeline.
