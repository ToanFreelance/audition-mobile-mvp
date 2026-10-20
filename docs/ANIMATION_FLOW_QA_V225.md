# Animation Flow V2.2.5 — Modern Dance Style Coherence (foundation)

Repo: ToanFreelance/audition-mobile-mvp
Branch: work/animation-flow-qa-v2; PR #19 Draft/unmerged
Baseline: eeb7540f52e67a1b2c9e00199cd7d88cfbd73c48 (owner iPhone accepted 8-beat continuity and Flare direction).

## Owner's explicit style decision (2026-10-20)

Default Gameplay Preview shall focus on **Street / Hip-hop / contemporary Pop**. Swing/ballroom/social choreography (Charleston, Lambada) and novelty dance are not allowed in default random gameplay. The owner previously reported aesthetically incoherent sequences such as a Street/Break step suddenly turning into ballroom in the HIDDEN turn. Do not change actual rhythm timing to solve a style issue.

## Actual catalog inventory / provenance

The 16 existing CMU technical windows are unchanged (no artificial sub-window inflation):

- Pop / casual: 111-groove, 141-twist, 143-party, 120-mickey, 94-point — **5**.
- Street / upright footwork: 85-upright, 85-toprock, 94-knee-open, 94-diagonal, 94-pulse, 90-glide — **6**.
- QA-only Swing: 93-charleston, 93-fancy — **2**.
- QA-only Social: 55-lambada — **1**.
- QA-only Novelty: 55-bear, 143-chicken — **2**.

**11 default candidates; five excluded from random Gameplay Preview, none deleted from the QA catalog/Free Lab.** Macarena (143-party) and Mickey (120-mickey) are still provisional pop-adjacent technical examples, not yet accepted as contemporary Pop choreography; owner may exclude them after visual review. Other unverified descriptive CMU motions similarly remain technical candidates. All 16 require visual/semantic acceptance before production.

## Implementation policy

- `style-policy.ts` is a source-of-truth taxonomy keyed by stable phrase IDs; missing/stale mappings are test failures. It does NOT change Character Catalog or production published assets.
- First demo phrase switches to Twist rather than the Macarena test intro; this is a visual-only initial sample, no gameplay judgement.
- Real successful normal SPACE in Gameplay Preview selects only Street/Pop. It prefers its current coherent style chapter of three accepted SPACE moves, then tries the other modern family. When spatial/head-direction constraints make a preferred chapter impossible, fallback goes only to a modern family; it must never silently admit Swing/Social/Novelty.
- L6–L9 HIDDEN continuation is a visual dance bridge drawn from the **same family as the actual currently playing source**, not the globally mixed 16-piece pool. It still prefers a different source/group, may replay the same choreographic source to preserve coherence, and only falls back to ambient idle with an explicit failure reason if no safe placement exists. An internal bridge does not increment the style chapter count or add SPACE/judgement/global turn.
- The normal SPACE `PhraseBag` and HIDDEN `bridgeBag` remain separate and deterministic to avoid changing the seed sequence after a non-command bridge; the original 4-beat WebAudio timeline is authoritative.
- Finish Flare (plus dismount and short living idle), bounds, heading, character assets and 16 source clips are unchanged.

## Regression and evidence

Data-test `e2e/animation-flow-v225-style.spec.ts` validates taxonomy coverage and pool exclusion. Existing V2.2.3/V2.2.4 gameplay tests should assert: no selected normal or successful HIDDEN bridge has legacy style; HIDDEN bridges retain current family; changes of Street/Pop only occur at actual eligible SPACE; global Finish turns remain 38,62,86,110; post-Finish rest remains 39–42; no extra global turns; max root radius ≤1.35; no interpolation teleport.

Review 110,120,160,200 BPM × fades 0.15,0.35,1, with representative seeds and sparse RAF. Run these tests when a test runtime is available; a Vercel build verifies TypeScript but NOT gameplay motion test execution. The real iPhone is the visual acceptance gate.

## Expansion status / next step

Owner requested richer diversity, target 30–40 distinctive clips overall / around 20–25 modern Street/Pop. **This iteration does not claim new motion assets.** Actual expansion requires curating new source takes/windows, visual diversity review, retarget/body contact validation, provenance, and seed/coverage regression. Do not inflate catalog counts or introduce unrelated asset sources without QC. Distinct IDs are not evidence of distinct choreography.

No edits to production gameplay, CharacterAnimationController, WebAudio timing, gauge, CAS, Supabase, Character Catalog, accepted assets or global turn planner.
