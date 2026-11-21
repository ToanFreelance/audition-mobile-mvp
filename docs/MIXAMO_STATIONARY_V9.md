# M3 Waiting Room — V9 Stationary-Only Idle Shortlist (QA only)

## Why remove clips instead of continuing to lock feet?

Owner's iPhone V7/V8 videos visibly retained foot skating despite small microcorrections. V8's native M3 per-foot contact report from focused CI `44864993096` provides exact **clip-level** evidence across all 17 rig/clip combinations. The recording itself has no per-actor clip names, so the estimates below identify **risk by sampled clip**, not prove that a particular 8-second video window belongs to that clip.

Numbers are **sum of 2 feet' 30fps support-proxy X/Z travel over an entire clip**, *not* one stride length:

| Clip | Female V8 after (cm) | Male V8 after (cm) | QA interpretation |
| --- | ---: | ---: | --- |
| Bored + V6 | 35.9 + 28.3 = 64.2 | 42.2 + 36.9 = 79.1 | Very high retained motion, remove from random |
| Sad Idle | 1.6 + 14.7 = 16.3 | 1.9 + 6.8 = 8.7 | Pronounced unbalanced contact motion, remove |
| Dwarf Idle 2 | 5.1 + 3.3 = 8.4 | 5.8 + 3.6 = 9.4 | Greater than stable shortlist, remove |
| Waving | 0.6 + 0.6 = 1.2 | 0.6 + 0.6 = 1.2 | Only 15 sampled contact frames per foot, exclude conservatively |
| Catwalk Twist | 16.6 + 19.6 = 36.2 | Not available | Already manual-only; exclude from the stationary preset |

Remaining for a *tentative stationary shortlist*:

| Clip | Female V8 after (cm) | Male V8 after (cm) |
| --- | ---: | ---: |
| Breathing Idle 2 | 1.2 + 1.2 = 2.4 | 1.5 + 1.1 = 2.6 |
| Dwarf Idle | 0.9 + 1.6 = 2.5 (V8 rejected, source V7 kept) | 0.9 + 1.7 = 2.6 (V8 rejected) |
| Warrior Idle | Not available | 2.7 + 1.8 = 4.5 |
| Pointing | 0.8 + 0.8 = 1.6 | 1.0 + 1.0 = 2.0 |
| Blow a Kiss | 1.0 + 1.0 = 2.0 (V8 rejected, source V7 kept) | Not available |

**These measurements are NOT absolute proof of stationary shoe soles**, and a crossfade may still skate due to incoming support-pose mismatch. Per-foot support proxies include ankle/toe bone kinematics but not real mesh-to-floor shoe contact.

## Implementation

- Opt-in query `stationaryOnly=1` on existing isolated `/tools/lobby-qa-sketch` route. Real Waiting Room, Character Catalog and gameplay logic remain untouched.
- New `STATIONARY_MIXAMO_GROUPS` in `mixamo-lobby-data.ts` is explicitly curated. Female base: Breathing Idle 2 / Dwarf Idle, emote: Pointing / Blow a Kiss. Male base: Breathing Idle 2 / Dwarf Idle / Warrior Idle, emote: Pointing. No manual-only choices.
- Original `MIXAMO_GROUPS` and packed Mixamo data kept intact for A/B, diagnosis and eventual replacement. In opt-in mode all playback actions and UI select choices are built only from the stationary group: excluded clips cannot enter the auto shuffle bag or be selected/queued by QA commands.
- Original deterministic shuffle-bag, V4/V7/V8 contact processing, mixer retention, participant identity and multi-actor render pipeline remain. Bored and V6 side-step are automatically disabled when the stationary flag is active; do not bake an excluded clip.
- QA exposes `data-m3-stationary-only`, `data-m3-allowed-gestures`, existing per-actor current gestures and stored support/transition metrics.

## Owner acceptance

Compare on iPhone with **5 people + random**, at:
`/tools/lobby-qa-sketch?m3=five&allM3=1&mixamo=1&contactV4=1&pelvisFix=1&sideStepV6=0&contactV7=1&contactV8=1&stationaryOnly=1`

The full-library control uses the same flags but `stationaryOnly=0&sideStepV6=1`. The V9 shortlist may have noticeably less animation variety while waiting for the owner's replacement idle assets. Do **not** merge or proclaim visually accepted until owner's iPhone review.
