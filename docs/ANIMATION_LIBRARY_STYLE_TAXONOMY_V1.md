# Animation Library Style Taxonomy V1

## Decision

Do not bind source motions directly to one gameplay mode.

A motion can belong to one **style family** and expose multiple **mode hints**.
This keeps the animation library reusable when Phase 6 game modes expand.

Current style families:

- `pop_casual` — relaxed pop, general dance, casual groove;
- `social_swing` — Charleston, Lindy, Salsa, Latin/social and future duet;
- `modern_stage` — modern/ballet/stage performance;
- `world_folk` — Indian, Russian/folk and future world-dance material;
- `street_break` — break, battle, boss, floor and acrobatic material;
- `party_reaction` — novelty, celebration, waiting-room and reaction.

Mode selection should be data-driven later, for example:

`modeId -> allowed style tags / intensity / partner policy / floor-work policy -> animation pool`

Do not make animation duration authoritative for gameplay timing.

## Current demo pool

The QA source demo now exposes 45 already-acquired CMU motions:

- 16 Grade-A Normal;
- 5 Backup Normal;
- 5 Finish/Special;
- 4 utility/reaction;
- 7 partner-dependent social/duet motions;
- 8 Explore V2 candidates that were visually screened enough to remain interesting,
  but are not promoted to A/B acceptance.

Partner-dependent motions remain excluded from solo Normal.
Explore V2 is review-only and does not imply retarget acceptance.

## Expansion target

The old goal of 8 frozen Astra + ~16 new Normal is too small if the product has
multiple game modes. Keep the eight Astra motions frozen, but grow the source
library before broad retargeting.

Recommended next source target: **60–80 visually useful unique motions**, with
overlapping tags rather than rigid per-mode ownership.

Coverage goal:

- Pop / Casual: 15–20 usable motions;
- Social / Swing / Latin: 12–18, including paired choreography;
- Modern / Stage: 12–18;
- World / Folk: 10–15;
- Street / Break / Boss: 12–18;
- Party / Reaction / Waiting Room: 6–10;
- Finish / Special: 6–10 dramatic candidates.

These are coverage targets, not quotas; a motion may count in multiple mode
hints.

## Acquisition V2 direction

Before adding a new licensing surface, expand the same pinned CMU source first.
The Acquisition V1 selector was intentionally narrow and omitted several
potentially useful non-`dance` descriptions.

High-value CMU expansion terms/subjects to inspect next include:

- Subject 85: jump-twist / kick-flip / break variants;
- Subjects 87–90: cartwheel, handstand, spin, flip and acrobatic sequences;
- `90_32` moonwalk;
- additional modern/ballet phrases from Subjects 5 and 49;
- selected social/paired Salsa and Lindy phrases;
- selected novelty/pop motions only when phone-readable.

All new candidates must remain SOURCE_ONLY until visual review and a later
small male/female retarget POC.

## Locked constraints

No change to:

- eight frozen Astra Normal motions;
- gameplay or WebAudio authority;
- sequenceCounts, gauge or Finish semantics;
- Character Catalog;
- Waiting Room / RoomState / CAS / Realtime;
- Stage or Stage Catalog.

No retarget or runtime publishing is performed by this taxonomy/demo update.
