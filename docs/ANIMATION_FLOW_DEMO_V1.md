# Animation Flow Demo V1

Route:

`/tools/animation-flow-demo`

Purpose: visually evaluate how curated source motions transition when a simulated
Audition-style 4-beat turn reaches SPACE.

This route is isolated tooling only. It does not use or mutate the production
gauge, gameplay planner, WebAudio authority, sequenceCounts, Finish semantics,
Character Catalog, Waiting Room or frozen Moonlight motions.

## Timing model

- 1 simulated turn = 4 beats.
- Gauge progress is driven in beat-space.
- Animation playback rate = `BPM / 120` for this source demo.
- Crossfade duration is specified in beats and converted to seconds at the
  selected BPM.
- Auto SPACE fires on every 4-beat turn boundary.
- Manual SPACE is available as an additional stress test.

The 120 BPM reference is a demo normalization reference, not a claim that the
CMU source takes were captured to 120 BPM music. Production retarget metadata
must later be tuned per accepted phrase.

## Randomization

Each mode uses a shuffle bag rather than independent random draws.

- Every candidate is traversed before the pool is recycled.
- The previous 4 motions are excluded when an alternative exists.
- A new random run reshuffles the sequence.
- Immediate repeats are therefore prevented.

## Curated demo pools

### Classic — 12

Selected to reduce the raw library's ballet/social bias and emphasize readable
upright dance:

- 111_05
- 120_06
- 141_12
- 90_32
- 55_01
- 93_03
- 93_08
- 94_13
- 94_07
- 05_04
- 05_02
- 143_35

### Team Battle — 12

Selected for stronger silhouette and competitive energy while avoiding the
heaviest floor/inversion material:

- 111_05
- 120_06
- 90_32
- 55_01
- 93_08
- 85_03
- 88_10
- 90_30
- 94_07
- 94_14
- 05_04
- 05_07

### Showdown — 12

Selected deliberately as a transition stress pool:

- 85_03
- 85_04
- 85_05
- 85_08
- 85_10
- 85_14
- 85_01
- 85_06
- 88_06
- 88_08
- 89_03
- 90_14

The UI labels each source transition class:

- FREE — likely suitable for direct turn-boundary crossfade.
- BEAT_WINDOW — likely needs a curated exit marker.
- PROTECTED — hand/floor/inversion phase where immediate crossfade may look
  wrong; kept in Showdown specifically to expose those failures.

V1 intentionally crossfades immediately at SPACE even for PROTECTED sources.
This lets owner testing reveal exactly which transitions require phrase
segmentation or protected exit windows in the next pipeline stage.
